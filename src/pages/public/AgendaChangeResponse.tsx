import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type AgendaChangeOption = {
  startTime?: string;
  endTime?: string;
};

type AgendaChangeItem = {
  id: string;
  status?: string;
  originalStartTime?: string;
  proposedStartTime?: string;
  availableOptions?: AgendaChangeOption[];
};

type AgendaChangeBatch = {
  status?: string;
  expiresAt?: string;
  professional?: { name?: string };
  items?: AgendaChangeItem[];
};

type Decision = "accept" | "reject" | "request_change";

type ItemDecision = {
  decision: Decision;
  requestedStartTime?: string;
};

type AgendaResponsePayload = {
  ok?: boolean;
  found?: boolean;
  batch?: AgendaChangeBatch;
  error?: string;
  error_code?: string;
};

const clean = (value: unknown, max = 500) => String(value ?? "").trim().slice(0, max);
const validToken = (value: unknown) => {
  const token = clean(value, 256);
  return token.length >= 32 && /^[A-Za-z0-9_-]+$/.test(token) ? token : "";
};

const formatDateTime = (value: unknown) => {
  const date = new Date(clean(value, 100));
  if (!Number.isFinite(date.getTime())) return "Horário a confirmar";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

async function agendaResponse(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("agenda-change-response", { body });
  if (error) throw error;
  const payload = (data || {}) as AgendaResponsePayload;
  if (payload.ok === false) throw new Error(payload.error || "Não foi possível processar esta revisão agora.");
  return payload;
}

export default function AgendaChangeResponse() {
  const token = useMemo(() => validToken(new URLSearchParams(window.location.search).get("token")), []);
  const [batch, setBatch] = useState<AgendaChangeBatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");
  const [comment, setComment] = useState("");
  const [decisions, setDecisions] = useState<Record<string, ItemDecision>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!token) {
        setError("Este link é inválido ou expirou.");
        setLoading(false);
        return;
      }
      try {
        const payload = await agendaResponse({ action: "get", token });
        if (cancelled) return;
        if (!payload.found || !payload.batch) {
          setError("Este link não está mais disponível.");
          setLoading(false);
          return;
        }
        const next = payload.batch;
        setBatch(next);
        const defaults: Record<string, ItemDecision> = {};
        for (const item of next.items || []) {
          if (item?.id && item.status === "pending") defaults[item.id] = { decision: "accept" };
        }
        setDecisions(defaults);
        setCompleted(next.status === "completed");
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("Não foi possível carregar esta revisão agora.");
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const updateDecision = (itemId: string, decision: Decision) => {
    setDecisions((current) => ({
      ...current,
      [itemId]: {
        decision,
        ...(decision === "request_change" ? { requestedStartTime: current[itemId]?.requestedStartTime || "" } : {}),
      },
    }));
  };

  const updateRequestedTime = (itemId: string, requestedStartTime: string) => {
    setDecisions((current) => ({
      ...current,
      [itemId]: { decision: "request_change", requestedStartTime },
    }));
  };

  const submit = async () => {
    if (!token || !batch) return;
    const pending = (batch.items || []).filter((item) => item.status === "pending");
    const payload = pending.map((item) => {
      const selected = decisions[item.id];
      if (!selected) return null;
      if (selected.decision === "request_change" && !clean(selected.requestedStartTime, 120)) return null;
      return {
        itemId: item.id,
        decision: selected.decision,
        ...(selected.decision === "request_change" ? { requestedStartTime: selected.requestedStartTime } : {}),
      };
    });
    if (!payload.length || payload.some((value) => !value)) {
      setError("Revise a resposta de cada horário antes de confirmar.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await agendaResponse({
        action: "respond",
        token,
        decisions: payload,
        comment: clean(comment, 1000) || null,
      });
      setCompleted(true);
      setSubmitting(false);
    } catch (rpcError) {
      const message = clean(rpcError instanceof Error ? rpcError.message : rpcError, 500).toLowerCase();
      setError(
        /expired|invalid|window|disponível/.test(message)
          ? "Este link não está mais disponível para resposta."
          : /horário|available/.test(message)
            ? "O horário escolhido não está mais disponível. Recarregue a página e escolha outro."
            : "Não foi possível registrar sua resposta agora.",
      );
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f4f6f7] px-4 py-8 text-zinc-950 sm:py-12">
      <section className="mx-auto w-full max-w-3xl rounded-[30px] border border-black/5 bg-white/90 p-5 shadow-[0_30px_90px_rgba(15,23,42,0.10)] backdrop-blur-2xl sm:p-8">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-zinc-500">Agenda segura · NeuroNex</p>

        {loading ? (
          <div className="py-10">
            <h1 className="text-3xl font-bold tracking-[-0.04em]">Carregando sua revisão…</h1>
            <p className="mt-2 text-sm text-zinc-500">Consultando as alterações propostas.</p>
          </div>
        ) : completed ? (
          <div className="py-12 text-center">
            <h1 className="text-4xl font-bold tracking-[-0.04em]">Resposta registrada</h1>
            <p className="mx-auto mt-3 max-w-lg text-zinc-500">Seu profissional recebeu sua resposta. Você pode fechar esta página.</p>
          </div>
        ) : error && !batch ? (
          <div className="py-10">
            <h1 className="text-3xl font-bold tracking-[-0.04em]">Revisão indisponível</h1>
            <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>
          </div>
        ) : (
          <>
            <h1 className="mt-2 text-4xl font-bold tracking-[-0.045em]">Revise as alterações</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
              {clean(batch?.professional?.name, 160) || "Seu profissional"} propôs novos horários. Nenhuma resposta é registrada apenas por abrir esta página.
            </p>

            <div className="mt-7 grid gap-4">
              {(batch?.items || []).map((item, index) => {
                const selected = decisions[item.id];
                return (
                  <article key={item.id || index} className="rounded-3xl border border-black/5 bg-zinc-50/70 p-4 sm:p-5">
                    <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr] sm:gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">Horário anterior</p>
                        <p className="mt-1 font-bold">{formatDateTime(item.originalStartTime)}</p>
                      </div>
                      <span className="text-zinc-300">→</span>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">Proposta</p>
                        <p className="mt-1 font-bold">{formatDateTime(item.proposedStartTime)}</p>
                      </div>
                    </div>

                    {item.status === "pending" ? (
                      <div className="mt-5 grid gap-2">
                        {([
                          ["accept", "Aceitar novo horário"],
                          ["reject", "Manter horário anterior"],
                          ["request_change", "Pedir outro horário"],
                        ] as Array<[Decision, string]>).map(([value, label]) => (
                          <label key={value} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm">
                            <input
                              type="radio"
                              name={`decision-${item.id}`}
                              value={value}
                              checked={selected?.decision === value}
                              onChange={() => updateDecision(item.id, value)}
                              className="mt-0.5"
                            />
                            <span>{label}</span>
                          </label>
                        ))}

                        {selected?.decision === "request_change" ? (
                          <select
                            value={selected.requestedStartTime || ""}
                            onChange={(event) => updateRequestedTime(item.id, event.target.value)}
                            className="mt-1 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                          >
                            <option value="">Escolha um horário alternativo</option>
                            {(item.availableOptions || []).map((option) => (
                              <option key={clean(option.startTime, 120)} value={clean(option.startTime, 120)}>
                                {formatDateTime(option.startTime)}
                              </option>
                            ))}
                          </select>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm font-semibold text-zinc-500">Resposta já registrada.</p>
                    )}
                  </article>
                );
              })}
            </div>

            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value.slice(0, 1000))}
              placeholder="Comentário opcional para o profissional"
              className="mt-5 min-h-24 w-full resize-y rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
            />

            {error ? (
              <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>
            ) : null}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-medium text-zinc-500">Link individual, temporário e protegido.</p>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submit()}
                className="rounded-full bg-zinc-950 px-6 py-3 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Registrando…" : "Confirmar respostas"}
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
