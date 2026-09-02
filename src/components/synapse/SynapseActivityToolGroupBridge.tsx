import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useSynapse } from '@/context/SynapseContext';
import {
  categoryForSynapseTool,
  humanizeSynapseTool,
  integrationForSynapseTool,
  normalizeSynapseToolName,
} from '@/lib/synapse-agent-presentation';
import {
  SYNAPSE_TEXT_AGENT_PROGRESS_EVENT,
  type SynapseTextAgentProgressDetail,
} from '@/lib/synapse-text-agent-progress';
import {
  SynapseActivityToolGroup,
  type SynapseActivityGroupModel,
  type SynapseActivityToolItem,
} from './SynapseActivityToolGroup';

const MAX_GROUPS = 12;

const textValue = (value: unknown, fallback = '') => String(value || fallback).trim().slice(0, 180);

export const SynapseActivityToolGroupBridge = () => {
  const { activeSessionId, activeTab, shellState, timeline } = useSynapse();
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [runs, setRuns] = useState<SynapseActivityGroupModel[]>([]);
  const currentRunId = useRef<string | null>(null);

  useEffect(() => {
    setRuns([]);
    currentRunId.current = null;
  }, [activeSessionId]);

  useEffect(() => {
    const handleProgress = (rawEvent: Event) => {
      const detail = (rawEvent as CustomEvent<SynapseTextAgentProgressDetail>).detail;
      if (!detail || !activeSessionId || detail.sessionId !== activeSessionId) return;

      const event = detail.event || {};
      const stage = textValue(event.stage).toLowerCase();
      const toolName = normalizeSynapseToolName(event.toolName);
      const emittedAt = Number.isFinite(Date.parse(detail.emittedAt)) ? Date.parse(detail.emittedAt) : Date.now();
      const eventLabel = textValue(event.label);
      const eventDetail = textValue(event.detail);

      if (stage === 'received') {
        const id = `synapse-run-${detail.emittedAt}`;
        currentRunId.current = id;
        setRuns((current) => [
          {
            id,
            title: eventLabel || 'Processando solicitação',
            description: eventDetail || 'Entendendo a solicitação e preparando o contexto.',
            state: 'pending' as const,
            startedAt: emittedAt,
            tools: [],
          },
          ...current,
        ].slice(0, MAX_GROUPS));
        return;
      }

      const updateCurrentRun = (updater: (run: SynapseActivityGroupModel) => SynapseActivityGroupModel) => {
        setRuns((current) => current.map((run) => run.id === currentRunId.current ? updater(run) : run));
      };

      if (stage === 'planning') {
        updateCurrentRun((run) => ({
          ...run,
          title: eventLabel || 'Organizando execução',
          description: eventDetail || run.description,
          state: 'pending',
        }));
        return;
      }

      if (stage === 'tool_started' && toolName) {
        updateCurrentRun((run) => {
          const occurrence = run.tools.filter((tool) => normalizeSynapseToolName(tool.toolName) === toolName).length + 1;
          const tool: SynapseActivityToolItem = {
            id: `${run.id}:${toolName}:${occurrence}`,
            toolName,
            title: humanizeSynapseTool(toolName),
            subtitle: eventDetail || eventLabel || undefined,
            state: 'pending',
            category: categoryForSynapseTool(toolName),
            integration: integrationForSynapseTool(toolName),
            startedAt: emittedAt,
          };
          return {
            ...run,
            title: 'Executando ferramentas',
            description: eventLabel || run.description,
            state: 'pending',
            tools: [...run.tools, tool],
          };
        });
        return;
      }

      if (stage === 'tool_finished' && toolName) {
        updateCurrentRun((run) => {
          let updated = false;
          const tools = [...run.tools].reverse().map((tool) => {
            if (!updated && tool.state === 'pending' && normalizeSynapseToolName(tool.toolName) === toolName) {
              updated = true;
              return {
                ...tool,
                state: 'completed' as const,
                subtitle: eventDetail || tool.subtitle,
                finishedAt: emittedAt,
              };
            }
            return tool;
          }).reverse();
          return { ...run, tools };
        });
        return;
      }

      if (stage === 'confirmation_required') {
        updateCurrentRun((run) => ({
          ...run,
          title: 'Aguardando confirmação',
          description: eventDetail || 'Revise a ação antes de confirmar.',
          state: 'waiting',
        }));
        return;
      }

      if (stage === 'pending_confirm') {
        updateCurrentRun((run) => ({
          ...run,
          title: 'Executando ação confirmada',
          description: eventDetail || run.description,
          state: 'pending',
        }));
        return;
      }

      if (stage === 'pending_cancel') {
        updateCurrentRun((run) => ({
          ...run,
          title: 'Ação cancelada',
          description: eventDetail || 'A execução foi cancelada antes de alterar o sistema.',
          state: 'interrupted',
          finishedAt: emittedAt,
        }));
        return;
      }

      if (stage === 'finalizing') {
        updateCurrentRun((run) => ({
          ...run,
          title: eventLabel || 'Consolidando resultado',
          description: eventDetail || run.description,
          state: 'pending',
          tools: run.tools.map((tool) => tool.state === 'pending' ? { ...tool, state: 'completed' as const, finishedAt: emittedAt } : tool),
        }));
        return;
      }

      if (stage === 'responding') {
        updateCurrentRun((run) => ({
          ...run,
          title: 'Execução concluída',
          description: eventDetail || eventLabel || run.description,
          state: 'completed',
          finishedAt: emittedAt,
          tools: run.tools.map((tool) => tool.state === 'pending' ? { ...tool, state: 'completed' as const, finishedAt: emittedAt } : tool),
        }));
        return;
      }

      if (stage === 'error') {
        updateCurrentRun((run) => ({
          ...run,
          title: 'Execução interrompida',
          description: eventDetail || eventLabel || 'Não foi possível concluir a execução.',
          state: 'interrupted',
          finishedAt: emittedAt,
          tools: run.tools.map((tool) => tool.state === 'pending' ? { ...tool, state: 'failed' as const, finishedAt: emittedAt } : tool),
        }));
      }
    };

    window.addEventListener(SYNAPSE_TEXT_AGENT_PROGRESS_EVENT, handleProgress);
    return () => window.removeEventListener(SYNAPSE_TEXT_AGENT_PROGRESS_EVENT, handleProgress);
  }, [activeSessionId]);

  useEffect(() => {
    if (activeTab !== 'timeline' || shellState !== 'compact' || typeof document === 'undefined') {
      setTarget(null);
      return;
    }

    let host: HTMLElement | null = null;
    const resolveTarget = () => {
      const viewport = document.getElementById('synapse-tabpanel');
      if (!viewport) return;
      const row = viewport.querySelector<HTMLElement>('.synapse-timeline-row');
      const empty = viewport.querySelector<HTMLElement>('.synapse-empty-state');
      const container = row?.parentElement || empty?.parentElement;
      if (!container) return;

      host = container.querySelector<HTMLElement>('[data-synapse-activity-groups-host="true"]');
      if (!host) {
        host = document.createElement('div');
        host.dataset.synapseActivityGroupsHost = 'true';
        container.prepend(host);
      }
      setTarget(host);
    };

    resolveTarget();
    const observer = new MutationObserver(resolveTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (host?.isConnected) host.remove();
      setTarget(null);
    };
  }, [activeTab, shellState]);

  const interfaceGroup = useMemo<SynapseActivityGroupModel | null>(() => {
    const candidates = timeline
      .slice(-24)
      .filter((entry) => entry.toolId || entry.state === 'executing' || entry.state === 'error');
    if (!candidates.length) return null;
    const tools = candidates.map((entry) => ({
      id: `timeline:${entry.id}`,
      toolName: entry.toolId,
      title: entry.label,
      subtitle: entry.detail,
      state: entry.state === 'error' ? 'failed' as const : entry.state === 'executing' ? 'pending' as const : 'completed' as const,
      category: categoryForSynapseTool(entry.toolId),
      integration: integrationForSynapseTool(entry.toolId),
      startedAt: entry.timestamp.getTime(),
      finishedAt: entry.state === 'executing' ? undefined : entry.timestamp.getTime(),
    }));
    const hasError = tools.some((tool) => tool.state === 'failed');
    const hasPending = tools.some((tool) => tool.state === 'pending');
    return {
      id: 'synapse-interface-activity',
      title: 'Atividade da interface',
      description: 'Ações aplicadas no painel pelo Synapse.',
      state: hasError ? 'interrupted' : hasPending ? 'pending' : 'completed',
      startedAt: candidates[0].timestamp.getTime(),
      finishedAt: hasPending ? undefined : candidates[candidates.length - 1].timestamp.getTime(),
      tools,
    };
  }, [timeline]);

  const groups = useMemo(
    () => interfaceGroup ? [...runs, interfaceGroup] : runs,
    [interfaceGroup, runs],
  );

  useEffect(() => {
    if (!target || !groups.length) return;
    document.documentElement.dataset.synapseActivityGroups = 'active';
    return () => {
      delete document.documentElement.dataset.synapseActivityGroups;
    };
  }, [groups.length, target]);

  if (!target || !groups.length) return null;

  return (
    <>
      <style>{`
        html[data-synapse-activity-groups="active"] [data-synapse-activity-groups-host="true"] ~ .synapse-timeline-row,
        html[data-synapse-activity-groups="active"] [data-synapse-activity-groups-host="true"] ~ .synapse-empty-state,
        html[data-synapse-activity-groups="active"] [data-synapse-activity-groups-host="true"] ~ p {
          display: none !important;
        }
      `}</style>
      {createPortal(
        <div className="space-y-2.5 pb-2" data-synapse-activity-groups-container="true">
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.11em] text-muted-foreground/72">Execuções recentes</span>
            <span className="text-[9px] font-medium text-muted-foreground/55">{groups.length}</span>
          </div>
          {groups.map((group) => (
            <div key={group.id}>
              <SynapseActivityToolGroup group={group} />
            </div>
          ))}
        </div>,
        target,
      )}
    </>
  );
};
