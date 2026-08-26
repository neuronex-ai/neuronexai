export type SynapseTextAgentProgressEvent = {
  stage?: string;
  label?: string;
  detail?: string;
  toolName?: string;
  recordsFound?: number;
  generatedAt?: string;
};

export type SynapseTextAgentProgressDetail = {
  sessionId: string;
  event: SynapseTextAgentProgressEvent;
  emittedAt: string;
};

export const SYNAPSE_TEXT_AGENT_PROGRESS_EVENT = "neuronex:synapse-text-agent-progress";

export function emitSynapseTextAgentProgress(
  sessionId: string,
  event: SynapseTextAgentProgressEvent,
) {
  if (typeof window === "undefined" || !sessionId) return;

  window.dispatchEvent(
    new CustomEvent<SynapseTextAgentProgressDetail>(SYNAPSE_TEXT_AGENT_PROGRESS_EVENT, {
      detail: {
        sessionId,
        event,
        emittedAt: new Date().toISOString(),
      },
    }),
  );
}
