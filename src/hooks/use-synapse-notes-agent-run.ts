import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";
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

export type SynapseNotesAgentEventType =
  | "node_reveal"
  | "edge_reveal"
  | "focus_node"
  | "focus_link"
  | "complete"
  | "error";

export interface SynapseNotesAgentEvent {
  id: string;
  run_id: string;
  sequence: number;
  event_type: SynapseNotesAgentEventType;
  payload: Record<string, unknown>;
  created_at: string;
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

const normalizeEvent = (value: unknown): SynapseNotesAgentEvent | null => {
  if (!value || typeof value !== "object") return null;
  const event = value as Record<string, unknown>;
  const eventType = String(event.event_type || "") as SynapseNotesAgentEventType;
  if (!["node_reveal", "edge_reveal", "focus_node", "focus_link", "complete", "error"].includes(eventType)) return null;
  const sequence = Number(event.sequence);
  if (!Number.isInteger(sequence) || sequence < 1) return null;
  return {
    id: String(event.id || `${event.run_id || "run"}-${sequence}`),
    run_id: String(event.run_id || ""),
    sequence,
    event_type: eventType,
    payload: event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
      ? event.payload as Record<string, unknown>
      : {},
    created_at: String(event.created_at || ""),
  };
};

const mergeEvents = (current: SynapseNotesAgentEvent[], incoming: unknown[]) => {
  const bySequence = new Map(current.map((event) => [event.sequence, event]));
  incoming.forEach((value) => {
    const event = normalizeEvent(value);
    if (event) bySequence.set(event.sequence, event);
  });
  return Array.from(bySequence.values()).sort((a, b) => a.sequence - b.sequence);
};

const replayDelay = (event: SynapseNotesAgentEvent | undefined, reducedMotion: boolean | null) => {
  if (reducedMotion) return 0;
  if (!event) return 180;
  if (event.event_type === "focus_node" || event.event_type === "focus_link") return 680;
  if (event.event_type === "node_reveal") return 360;
  if (event.event_type === "edge_reveal") return 240;
  return 180;
};

export const useSynapseNotesAgentRun = (runId?: string | null) => {
  const shouldReduceMotion = useReducedMotion();
  const [run, setRun] = useState<SynapseNotesAgentRun | null>(null);
  const [events, setEvents] = useState<SynapseNotesAgentEvent[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(!runId);
  const [replayCursor, setReplayCursor] = useState(0);
  const [isLoading, setIsLoading] = useState(Boolean(runId));
  const [realtimeState, setRealtimeState] = useState<SynapseNotesAgentRealtimeState>(runId ? "connecting" : "idle");

  useEffect(() => {
    if (!runId) {
      setRun(null);
      setEvents([]);
      setEventsLoaded(true);
      setReplayCursor(0);
      setIsLoading(false);
      setRealtimeState("idle");
      return;
    }

    let isMounted = true;
    let pollTimer: number | null = null;
    let pollDelay = 1500;
    setIsLoading(true);
    setRealtimeState("connecting");
    setEvents([]);
    setEventsLoaded(false);
    setReplayCursor(0);

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

    const fetchEvents = async () => {
      const { data, error } = await supabase
        .from("synapse_notes_agent_run_events" as any)
        .select("id,run_id,sequence,event_type,payload,created_at")
        .eq("run_id", runId)
        .order("sequence", { ascending: true });

      if (!isMounted) return;
      if (error) {
        console.error("[Synapse Notes Agent] Falha ao carregar eventos:", error);
        setEventsLoaded(true);
        return;
      }
      setEvents((current) => mergeEvents(current, data || []));
      setEventsLoaded(true);
    };

    void fetchRun();
    void fetchEvents();

    // Realtime now reuses a channel when its topic matches an existing one. A
    // previous effect can still be unsubscribing when this effect starts (for
    // example, during a React remount), so give this subscription its own topic.
    const channel = supabase
      .channel(`synapse_notes_agent_run_${runId}:${Date.now()}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "synapse_notes_agent_runs", filter: `id=eq.${runId}` },
        (payload) => {
          const next = normalizeRun((payload as any).new);
          if (next) setRun(next);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "synapse_notes_agent_run_events", filter: `run_id=eq.${runId}` },
        (payload) => setEvents((current) => mergeEvents(current, [(payload as any).new])),
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
          void fetchEvents();
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

  useEffect(() => {
    if (!runId || replayCursor >= events.length) return;
    const nextEvent = events[replayCursor];
    const timer = window.setTimeout(
      () => setReplayCursor((current) => Math.min(current + 1, events.length)),
      replayDelay(nextEvent, shouldReduceMotion),
    );
    return () => window.clearTimeout(timer);
  }, [events, replayCursor, runId, shouldReduceMotion]);

  const playedEvents = useMemo(() => events.slice(0, replayCursor), [events, replayCursor]);
  const activeEvent = playedEvents.length ? playedEvents[playedEvents.length - 1] : null;

  return {
    run,
    events,
    eventsLoaded,
    playedEvents,
    activeEvent,
    isReplaying: replayCursor < events.length,
    isLoading,
    realtimeState,
  };
};
