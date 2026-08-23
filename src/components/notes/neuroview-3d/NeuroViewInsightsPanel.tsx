import { useEffect, useMemo, useState } from "react";
import { CalendarClock, EyeOff, Pin, Radar, Sparkles, TimerReset } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { Patient } from "@/types";
import { EvidenceExplanationDialog, EvidenceScoreCards } from "../clinical-evidence/EvidenceExplanation";
import { getEvidenceSourceLabel } from "../clinical-evidence/evidence-model";
import type { AttentionReason, EvidenceNode, NeuroVisionLens, PatientAttentionSummary } from "../clinical-evidence/evidence-types";
import type { GraphNode } from "../graph/graph-types";
import { getNodeEvidence } from "./model";

type OverrideUpdate = {
  sourceType: EvidenceNode["sourceType"];
  sourceId: string;
  priority?: number;
  isPinned?: boolean;
  isHidden?: boolean;
  themeOverride?: string | null;
};

type Props = {
  darkMode: boolean;
  lens: NeuroVisionLens;
  focusedPatient: GraphNode | null;
  inspectedNode: GraphNode | null;
  graphNodes: GraphNode[];
  evidence: EvidenceNode[];
  timeEnd: number | null;
  evidenceAvailable: boolean;
  onInspectNode: (nodeId: string) => void;
  onUpdateOverride?: (update: OverrideUpdate) => Promise<void>;
  onAnnounce: (message: string) => void;
};

const percent = (value: number) => `${Math.round(value * 100)}%`;

const reasonColor: Record<AttentionReason["type"], string> = {
  "recorded-risk": "bg-rose-400",
  "overdue-action": "bg-amber-300",
  "pending-review": "bg-violet-300",
  "observed-mood-change": "bg-cyan-300",
};

const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(date)
    : "Data indisponível";
};

export const NeuroViewInsightsPanel = ({
  darkMode,
  lens,
  focusedPatient,
  inspectedNode,
  graphNodes,
  evidence,
  timeEnd,
  evidenceAvailable,
  onInspectNode,
  onUpdateOverride,
  onAnnounce,
}: Props) => {
  const inspectedEvidence = inspectedNode ? getNodeEvidence(inspectedNode) : null;
  const [theme, setTheme] = useState(inspectedEvidence?.theme || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => setTheme(inspectedEvidence?.theme || ""), [inspectedEvidence?.id, inspectedEvidence?.theme]);

  const patient = focusedPatient?.data as (Patient & {
    attentionReasons?: AttentionReason[];
    attentionSummary?: PatientAttentionSummary;
  }) | undefined;
  const patientEvidence = useMemo(() => evidence
    .filter((item) => item.patientId === patient?.id && !item.hidden)
    .filter((item) => timeEnd === null || new Date(item.occurredAt).getTime() <= timeEnd)
    .sort((left, right) => right.gravity.score - left.gravity.score
      || new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()),
  [evidence, patient?.id, timeEnd]);

  const sessionEvidence = useMemo(() => {
    const lastSession = patient?.last_session ? new Date(patient.last_session).getTime() : Number.NEGATIVE_INFINITY;
    return patientEvidence.filter((item) => new Date(item.updatedAt).getTime() >= lastSession).slice(0, 7);
  }, [patient?.last_session, patientEvidence]);

  const themes = useMemo(() => {
    const counts = new Map<string, { count: number; sources: Set<string>; latest: number }>();
    patientEvidence.forEach((item) => {
      const current = counts.get(item.theme) || { count: 0, sources: new Set<string>(), latest: 0 };
      current.count += 1;
      current.sources.add(item.sourceType);
      current.latest = Math.max(current.latest, new Date(item.occurredAt).getTime());
      counts.set(item.theme, current);
    });
    return Array.from(counts.entries())
      .sort((left, right) => right[1].count - left[1].count || right[1].latest - left[1].latest)
      .slice(0, 6);
  }, [patientEvidence]);

  const attentionPatients = useMemo(() => graphNodes
    .filter((node) => node.type === "patient")
    .map((node) => ({
      node,
      reasons: (node.data?.attentionReasons || []) as AttentionReason[],
      summary: node.data?.attentionSummary as PatientAttentionSummary | undefined,
    }))
    .filter(({ reasons, summary }) => reasons.length > 0 || Boolean(summary?.score))
    .sort((left, right) => Number(right.reasons.some((reason) => reason.type === "recorded-risk"))
      - Number(left.reasons.some((reason) => reason.type === "recorded-risk"))
      || right.reasons.length - left.reasons.length
      || (right.summary?.score || 0) - (left.summary?.score || 0)), [graphNodes]);
  const nodeIdForEvidence = (item: EvidenceNode) => graphNodes.find(
    (node) => getNodeEvidence(node)?.id === item.id,
  )?.id || item.id;

  const updateOverride = async (update: OverrideUpdate, message: string) => {
    if (!onUpdateOverride) return;
    setSaving(true);
    try {
      await onUpdateOverride(update);
      onAnnounce(message);
    } catch (error) {
      onAnnounce(error instanceof Error ? error.message : "Não foi possível atualizar a evidência.");
    } finally {
      setSaving(false);
    }
  };

  const shellClass = cn(
    "pointer-events-auto w-[338px] overflow-hidden rounded-[26px] border shadow-[0_28px_90px_-42px_rgba(0,0,0,0.82)] backdrop-blur-3xl",
    darkMode ? "border-white/10 bg-[#0b0b0e]/82 text-white" : "border-black/10 bg-white/82 text-zinc-950",
  );
  const secondary = darkMode ? "text-white/48" : "text-zinc-500";

  if (inspectedEvidence) {
    const gravity = inspectedEvidence.gravity;
    return (
      <aside className={shellClass} aria-label="Por que esta evidência está aqui">
        <div className={cn("border-b px-5 pb-4 pt-5", darkMode ? "border-white/8" : "border-black/8")}>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em]">
            <Sparkles className="h-3.5 w-3.5" />
            Por que está aqui?
          </div>
          <h2 className="mt-2 text-base font-semibold leading-snug tracking-[-0.02em]">{inspectedEvidence.title}</h2>
          <p className={cn("mt-1 text-[11px]", secondary)}>
            {getEvidenceSourceLabel(inspectedEvidence.sourceType)} · {dateLabel(inspectedEvidence.occurredAt)} · tema {inspectedEvidence.theme}
          </p>
        </div>
        <ScrollArea className="max-h-[min(62vh,560px)]">
          <div className="space-y-5 p-5">
            {!gravity.eligible ? (
              <div className={cn("rounded-2xl border p-3 text-xs leading-relaxed", darkMode ? "border-violet-300/18 bg-violet-300/8" : "border-violet-500/15 bg-violet-500/5")}>
                Esta evidência aguarda revisão. Ela pode ser explorada, mas ainda não altera a gravidade clínica.
              </div>
            ) : null}
            <EvidenceScoreCards evidence={inspectedEvidence} />
            <p className={cn("text-[11px] leading-relaxed", secondary)}>
              Perto = precisa de atenção · maior = mais denso · pulso = mais tensão · confiança = força da base revisada.
            </p>
            <EvidenceExplanationDialog
              evidence={inspectedEvidence}
              body={typeof inspectedNode?.data?.content === "string" ? inspectedNode.data.content : null}
              darkMode={darkMode}
            />

            {evidenceAvailable && onUpdateOverride ? (
              <div className={cn("space-y-4 border-t pt-4", darkMode ? "border-white/8" : "border-black/8")}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span>Prioridade do psicólogo</span>
                    <span className={secondary}>{inspectedEvidence.priority}%</span>
                  </div>
                  <Slider
                    value={[inspectedEvidence.priority]}
                    min={0}
                    max={100}
                    step={10}
                    disabled={saving}
                    aria-label="Prioridade clínica definida pelo psicólogo"
                    onValueCommit={([priority]) => void updateOverride({
                      sourceType: inspectedEvidence.sourceType,
                      sourceId: inspectedEvidence.sourceId,
                      priority,
                    }, "Prioridade da evidência atualizada.")}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="neurovision-theme" className="text-xs">Tema clínico revisado</label>
                  <Input
                    id="neurovision-theme"
                    value={theme}
                    disabled={saving}
                    onChange={(event) => setTheme(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      void updateOverride({
                        sourceType: inspectedEvidence.sourceType,
                        sourceId: inspectedEvidence.sourceId,
                        themeOverride: theme.trim() || null,
                      }, "Tema da evidência atualizado.");
                    }}
                    className={cn("h-10 rounded-xl", darkMode ? "border-white/10 bg-white/[0.04]" : "border-black/10 bg-black/[0.025]")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={() => void updateOverride({
                      sourceType: inspectedEvidence.sourceType,
                      sourceId: inspectedEvidence.sourceId,
                      isPinned: !inspectedEvidence.pinned,
                    }, inspectedEvidence.pinned ? "Evidência desafixada." : "Evidência fixada.")}
                    className="rounded-xl text-xs"
                  >
                    <Pin className="h-3.5 w-3.5" /> {inspectedEvidence.pinned ? "Desafixar" : "Fixar"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={() => void updateOverride({
                      sourceType: inspectedEvidence.sourceType,
                      sourceId: inspectedEvidence.sourceId,
                      isHidden: true,
                    }, "Evidência ocultada do NeuroVision.")}
                    className="rounded-xl text-xs"
                  >
                    <EyeOff className="h-3.5 w-3.5" /> Ocultar
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </aside>
    );
  }

  if (lens === "session-prep") {
    return (
      <aside className={shellClass} aria-label="Preparação de sessão">
        <div className={cn("border-b px-5 pb-4 pt-5", darkMode ? "border-white/8" : "border-black/8")}>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em]"><CalendarClock className="h-3.5 w-3.5" /> Preparar sessão</div>
          <h2 className="mt-2 text-base font-semibold">{focusedPatient?.label || "Escolha um paciente"}</h2>
          <p className={cn("mt-1 text-[11px] leading-relaxed", secondary)}>
            {focusedPatient ? "O que mudou desde a última sessão, com origem e motivo visíveis." : "Selecione um núcleo para reunir o contexto clínico revisado."}
          </p>
        </div>
        {focusedPatient ? (
          <ScrollArea className="max-h-[min(62vh,560px)]">
            <div className="space-y-2 p-3">
              {patient?.risk_score !== null && patient?.risk_score !== undefined ? (
                <div className={cn("rounded-2xl border px-3 py-2.5 text-xs", darkMode ? "border-white/8 bg-white/[0.035]" : "border-black/8 bg-black/[0.025]")}>
                  Risco registrado: <strong>{patient.risk_score}/{patient.risk_score_scale || 10}</strong>
                </div>
              ) : null}
              {sessionEvidence.length ? sessionEvidence.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onInspectNode(nodeIdForEvidence(item))}
                  className={cn("w-full rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", darkMode ? "border-white/8 bg-white/[0.025] hover:bg-white/[0.07]" : "border-black/8 bg-black/[0.018] hover:bg-black/[0.05]")}
                >
                  <span className="block truncate text-xs font-semibold">{item.title}</span>
                  <span className={cn("mt-1 block text-[10px]", secondary)}>{getEvidenceSourceLabel(item.sourceType)} · {dateLabel(item.occurredAt)} · atenção {percent(item.gravity.score)}</span>
                </button>
              )) : <p className={cn("p-4 text-center text-xs", secondary)}>Nenhuma mudança indexada desde a última sessão.</p>}
            </div>
          </ScrollArea>
        ) : null}
      </aside>
    );
  }

  if (lens === "patterns") {
    return (
      <aside className={shellClass} aria-label="Padrões longitudinais">
        <div className={cn("border-b px-5 pb-4 pt-5", darkMode ? "border-white/8" : "border-black/8")}>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em]"><TimerReset className="h-3.5 w-3.5" /> Padrões longitudinais</div>
          <h2 className="mt-2 text-base font-semibold">{focusedPatient?.label || "Escolha um paciente"}</h2>
          <p className={cn("mt-1 text-[11px] leading-relaxed", secondary)}>Recorrência e convergência entre fontes revisadas ao longo do tempo.</p>
        </div>
        {focusedPatient ? (
          <div className="space-y-2 p-3">
            {themes.length ? themes.map(([name, stats]) => (
              <div key={name} className={cn("rounded-2xl border p-3", darkMode ? "border-white/8 bg-white/[0.025]" : "border-black/8 bg-black/[0.018]")}>
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-xs font-semibold">{name}</span>
                  <span className="text-xs tabular-nums">{stats.count}×</span>
                </div>
                <p className={cn("mt-1 text-[10px]", secondary)}>{stats.sources.size} {stats.sources.size === 1 ? "fonte" : "fontes"} · última evidência {dateLabel(new Date(stats.latest).toISOString())}</p>
              </div>
            )) : <p className={cn("p-4 text-center text-xs", secondary)}>Ainda não há temas revisados suficientes para este período.</p>}
          </div>
        ) : null}
      </aside>
    );
  }

  if (lens === "attention") {
    return (
      <aside className={shellClass} aria-label="NeuroTrack">
        <div className={cn("border-b px-5 pb-4 pt-5", darkMode ? "border-white/8" : "border-black/8")}>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em]"><Radar className="h-3.5 w-3.5" /> NeuroTrack</div>
          <h2 className="mt-2 text-base font-semibold">Atenção objetiva</h2>
          <p className={cn("mt-1 text-[11px] leading-relaxed", secondary)}>Sinais registrados e pendências operacionais; não representa diagnóstico.</p>
        </div>
        <ScrollArea className="max-h-[min(62vh,560px)]">
          <div className="space-y-2 p-3">
            {attentionPatients.map(({ node, reasons, summary }) => (
              <button key={node.id} type="button" onClick={() => onInspectNode(node.id)} className={cn("w-full rounded-2xl border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", darkMode ? "border-white/8 bg-white/[0.025] hover:bg-white/[0.07]" : "border-black/8 bg-black/[0.018] hover:bg-black/[0.05]")}>
                <span className="flex items-center justify-between gap-3">
                  <span className="truncate text-xs font-semibold">{node.label}</span>
                  {summary ? <span className="text-[10px] tabular-nums opacity-60">atenção {percent(summary.score)}</span> : null}
                </span>
                {summary?.dominantTheme ? <span className={cn("mt-1 block truncate text-[10px]", secondary)}>Tema mais presente: {summary.dominantTheme} · confiança {percent(summary.confidence)}</span> : null}
                <span className="mt-2 flex flex-wrap gap-1.5">
                  {reasons.map((reason) => <span key={reason.type} className="inline-flex items-center gap-1 text-[9px]"><span className={cn("h-1.5 w-1.5 rounded-full", reasonColor[reason.type])} />{reason.label}</span>)}
                  {!reasons.length ? <span className={cn("text-[9px]", secondary)}>Sem sinal objetivo registrado</span> : null}
                </span>
              </button>
            ))}
            {!attentionPatients.length ? <p className={cn("p-4 text-center text-xs", secondary)}>Nenhum sinal objetivo de atenção está registrado agora.</p> : null}
          </div>
        </ScrollArea>
      </aside>
    );
  }

  return null;
};

export const NeuroVisionInsightsPanel = NeuroViewInsightsPanel;
