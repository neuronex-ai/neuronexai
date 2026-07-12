import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SynapseNotesAgentProduct = "neuroview" | "neuroflow" | "neuropulse";
export type SynapseNotesAgentStatus =
  | "queued"
  | "gathering"
  | "reasoning"
  | "drafting"
  | "applying"
  | "completed"
  | "failed"
  | "cancelled";

export interface SynapseNotesAgentStep {
  title: string;
  status: "pending" | "active" | "completed" | "failed";
  description?: string;
  at?: string;
}

export interface SynapseNotesAgentTrace {
  steps?: SynapseNotesAgentStep[];
  nodes?: Array<{ id: string; type?: string; weight?: number; reason?: string }>;
  links?: Array<{ source: string; target: string; reason?: string }>;
  summary?: string;
}

export interface SynapseNotesAgentRun {
  id: string;
  user_id: string;
  product: SynapseNotesAgentProduct;
  patient_id: string | null;
  chat_session_id: string | null;
  status: SynapseNotesAgentStatus;
  intent: string | null;
  progress: number;
  steps: SynapseNotesAgentStep[];
  trace: SynapseNotesAgentTrace;
  result: Record<string, unknown>;
  target_flow_id: string | null;
  pulse_entry_id: string | null;
  note_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export type SynapseNotesAgentRealtimeState = "idle" | "connecting" | "subscribed" | "degraded";

const TERMINAL_RUN_STATUSES = new Set<SynapseNotesAgentStatus>(["completed", "failed", "cancelled"]);

const normalizeRun = (value: unknown): SynapseNotesAgentRun | null => {
  if (!value || typeof value !== "object") return null;
  const run = value as Record<string, any>;
  return {
    ...run,
    steps: Array.isArray(run.steps) ? run.steps : [],
    trace: run.trace && typeof run.trace === "object" ? run.trace : {},
    result: run.result && typeof run.result === "object" ? run.result : {},
    progress: Number.isFinite(Number(run.progress)) ? Number(run.progress) : 0,
  } as SynapseNotesAgentRun;
};

export const useSynapseNotesAgentRun = (runId?: string | null) => {
  const [run, setRun] = useState<SynapseNotesAgentRun | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(runId));
  const [realtimeState, setRealtimeState] = useState<SynapseNotesAgentRealtimeState>(runId ? "connecting" : "idle");

  useEffect(() => {
    if (!runId) {
      setRun(null);
      setIsLoading(false);
      setRealtimeState("idle");
      return;
    }

    let isMounted = true;
    let pollTimer: number | null = null;
    let pollDelay = 1500;
    setIsLoading(true);
    setRealtimeState("connecting");

    const fetchRun = async (fromPolling = false) => {
      const { data, error } = await supabase
        .from("synapse_notes_agent_runs" as any)
        .select("*")
        .eq("id", runId)
        .maybeSingle();

      if (!isMounted) return;
      if (error) {
        console.error("[Synapse Notes Agent] Falha ao carregar run:", error);
        if (!fromPolling) setRun(null);
        if (fromPolling) {
          pollDelay = Math.min(Math.round(pollDelay * 1.45), 4000);
          pollTimer = window.setTimeout(() => void fetchRun(true), pollDelay);
        }
      } else {
        const next = normalizeRun(data);
        setRun(next);
        if (fromPolling && next && !TERMINAL_RUN_STATUSES.has(next.status)) {
          pollDelay = Math.min(Math.round(pollDelay * 1.45), 4000);
          pollTimer = window.setTimeout(() => void fetchRun(true), pollDelay);
        }
      }
      setIsLoading(false);
    };

    const beginPolling = () => {
      if (!isMounted || pollTimer !== null) return;
      setRealtimeState("degraded");
      pollDelay = 1500;
      pollTimer = window.setTimeout(() => {
        pollTimer = null;
        void fetchRun(true);
      }, pollDelay);
    };

    void fetchRun();

    const channel = supabase
      .channel(`synapse_notes_agent_run_${runId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "synapse_notes_agent_runs", filter: `id=eq.${runId}` },
        (payload) => {
          const next = normalizeRun((payload as any).new);
          if (next) setRun(next);
        },
      )
      .subscribe((status) => {
        if (!isMounted) return;
        if (status === "SUBSCRIBED") {
          setRealtimeState("subscribed");
          if (pollTimer !== null) {
            window.clearTimeout(pollTimer);
            pollTimer = null;
          }
          void fetchRun();
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          beginPolling();
        }
      });

    return () => {
      isMounted = false;
      if (pollTimer !== null) window.clearTimeout(pollTimer);
      supabase.removeChannel(channel);
    };
  }, [runId]);

  return { run, isLoading, realtimeState };
};
