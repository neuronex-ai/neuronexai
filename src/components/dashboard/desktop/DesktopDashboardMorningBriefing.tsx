"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUp, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  DesktopWorkspacePanel,
} from "@/components/ui/desktop-workspace";
import { useSessionNotes } from "@/hooks/use-session-notes";
import type { AISummary, Appointment, SessionNote } from "@/types";

import type { AttentionQueueItem } from "./dashboard-command-center-model";
import {
  getDailyBriefingCounts,
} from "./desktop-dashboard-morning-briefing-model";
import { NextScheduleCard } from "./NextScheduleCard";

type AgendaBriefingStatus = "all" | "Pendente" | "Confirmada";

type DesktopDashboardMorningBriefingProps = {
  today: Date;
  firstName: string;
  todayAppointments: Appointment[];
  weekAppointmentsCount: number;
  attentionItems: AttentionQueueItem[];
  nextAppointment?: Appointment;
  followingAppointment?: Appointment;
  isLoading: boolean;
};

const getSessionSummaryText = (note?: SessionNote | null) => {
  const summary = note?.ai_summary;
  if (summary?.summary) return summary.summary;
  if (note?.notes) return note.notes;
  return null;
};

const getSummaryTopics = (summary?: AISummary | null) =>
  summary?.topics?.filter(Boolean).slice(0, 3) || [];

const getSummaryNextSteps = (summary?: AISummary | null) =>
  summary?.next_steps?.filter(Boolean).slice(0, 2) || [];

export const DesktopDashboardMorningBriefing = ({
  today,
  firstName,
  todayAppointments,
  weekAppointmentsCount,
  attentionItems,
  nextAppointment,
  followingAppointment,
  isLoading,
}: DesktopDashboardMorningBriefingProps) => {
  const navigate = useNavigate();
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [synapsePrompt, setSynapsePrompt] = useState("");
  const patientId = nextAppointment?.patient_id || "";
  const { data: sessionNotes = [], isLoading: loadingSessionNotes } =
    useSessionNotes(patientId);
  const latestSessionNote = sessionNotes[0];
  const latestSummaryText = getSessionSummaryText(latestSessionNote);
  const latestTopics = getSummaryTopics(latestSessionNote?.ai_summary);
  const latestNextSteps = getSummaryNextSteps(latestSessionNote?.ai_summary);
  const counts = getDailyBriefingCounts(todayAppointments);
  const clinicalSignals = attentionItems.filter(
    (item) => item.category === "sessions" || item.category === "appointments",
  ).length;

  useEffect(() => {
    setSummaryOpen(false);
  }, [nextAppointment?.id]);

  const openAgenda = (status: AgendaBriefingStatus = "all") => {
    navigate("/agenda", {
      state: {
        synapseView: "daily",
        synapseDate: today.toISOString(),
        briefingAgendaDate: format(today, "yyyy-MM-dd"),
        briefingAgendaStatus: status,
      },
    });
  };

  const openPendingWorkspace = () => {
    const target = document.getElementById("dashboard-pendencias");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    target?.focus({ preventScroll: true });
  };

  const openSynapse = (prompt: string) => {
    navigate(`/synapse-ai?q=${encodeURIComponent(prompt)}`);
  };

  const submitSynapsePrompt = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = synapsePrompt.trim();
    if (!prompt) return;
    openSynapse(prompt);
  };

  const synapsePlaceholder = counts.total > 0
    ? "O que merece atenção antes da próxima sessão?"
    : "Como posso aproveitar a agenda livre de hoje?";
  const synapseSuggestions = [
    clinicalSignals > 0
      ? "Revisar sinais antes da próxima sessão"
      : counts.total > 0
        ? "Preparar a próxima sessão"
        : "Planejar a semana",
    "Preparar cobranças da semana",
    "Há pendências de ontem?",
  ];

  return (
    <DesktopWorkspacePanel
      highContrast
      className="dashboard-high-contrast-panel dashboard-morning-panel min-h-[264px] p-0"
    >
      <div className="grid min-h-[264px] lg:grid-cols-[minmax(0,1.22fr)_minmax(390px,0.78fr)]">
        <div className="flex min-h-[264px] flex-col gap-5 p-6 lg:px-8 lg:py-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-background/52">
              {format(today, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </p>
            <h1 className="mt-3 max-w-2xl text-4xl font-black leading-[0.92] tracking-[-0.065em] text-background lg:text-5xl">
              Bom dia, {firstName}.
            </h1>
          </div>

          <section className="dashboard-synapse-day mt-auto rounded-[32px] border p-5 sm:p-6" aria-labelledby="dashboard-synapse-day-title">
            <div className="flex items-center gap-2">
              <span className="dashboard-synapse-day-icon flex h-8 w-8 items-center justify-center rounded-xl border text-muted-foreground">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </span>
              <h2 id="dashboard-synapse-day-title" className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Synapse do dia
              </h2>
            </div>

            <p className="dashboard-synapse-day-brief mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-[clamp(0.95rem,1.15vw,1.05rem)] font-medium leading-relaxed tracking-[-0.02em] text-foreground">
              {counts.total > 0 ? (
                <>
                  <span>Hoje:</span>
                  <button type="button" onClick={() => openAgenda("all")} className="dashboard-synapse-chip" aria-label={`Abrir os ${counts.total} agendamentos de hoje`}>
                    {counts.total} {counts.total === 1 ? "sessão" : "sessões"}
                  </button>
                  {counts.pending > 0 ? <span aria-hidden="true">·</span> : null}
                  {counts.pending > 0 ? (
                    <button type="button" onClick={() => openAgenda("Pendente")} className="dashboard-synapse-chip" aria-label={`Abrir os ${counts.pending} agendamentos pendentes de hoje`}>
                      {counts.pending} {counts.pending === 1 ? "pendente" : "pendentes"}
                    </button>
                  ) : null}
                  {counts.online > 0 ? <span aria-hidden="true">·</span> : null}
                  {counts.online > 0 ? (
                    <button type="button" onClick={() => openAgenda("all")} className="dashboard-synapse-chip" aria-label={`Abrir a agenda de hoje, que inclui ${counts.online} agendamentos online`}>
                      {counts.online} online
                    </button>
                  ) : null}
                </>
              ) : (
                <>
                  <span>Agenda livre hoje.</span>
                  <button type="button" onClick={() => openAgenda("all")} className="dashboard-synapse-chip" aria-label={`Abrir os ${weekAppointmentsCount} compromissos dos próximos sete dias`}>
                    {weekAppointmentsCount} {weekAppointmentsCount === 1 ? "compromisso" : "compromissos"} nos próximos sete dias
                  </button>
                </>
              )}
              {clinicalSignals > 0 ? <span aria-hidden="true">·</span> : null}
              {clinicalSignals > 0 ? (
                <button type="button" onClick={openPendingWorkspace} className="dashboard-synapse-chip" aria-label={`Revisar ${clinicalSignals} ${clinicalSignals === 1 ? "sinal" : "sinais"} antes da próxima sessão`}>
                  {clinicalSignals} {clinicalSignals === 1 ? "sinal para revisar" : "sinais para revisar"}
                </button>
              ) : null}
            </p>

            <form className="mt-4" onSubmit={submitSynapsePrompt}>
              <label className="sr-only" htmlFor="dashboard-synapse-prompt">Pergunte ao Synapse sobre seu dia</label>
              <div className="dashboard-synapse-composer flex min-h-11 items-center gap-2 rounded-2xl border px-3">
                <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  id="dashboard-synapse-prompt"
                  type="text"
                  value={synapsePrompt}
                  onChange={(event) => setSynapsePrompt(event.target.value)}
                  placeholder={synapsePlaceholder}
                  className="min-w-0 flex-1 bg-transparent py-2 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/65"
                />
                <button type="submit" className="dashboard-synapse-send flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-background outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-45" aria-label="Enviar pergunta ao Synapse" disabled={!synapsePrompt.trim()}>
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </form>

            <div className="mt-2 flex flex-wrap gap-2" aria-label="Sugestões para o Synapse">
              {synapseSuggestions.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => openSynapse(suggestion)} className="dashboard-synapse-suggestion rounded-full border px-3 text-xs font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                  {suggestion}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="next-schedule-stage relative min-h-[264px] border-t border-background/10 bg-background/[0.07] p-4 dark:border-zinc-950/10 dark:bg-zinc-950/[0.035] lg:border-l lg:border-t-0">
          <NextScheduleCard
            today={today}
            appointment={nextAppointment}
            followingAppointment={followingAppointment}
            isLoading={isLoading}
            expanded={summaryOpen}
            onExpandedChange={setSummaryOpen}
            latestSummaryText={latestSummaryText}
            latestTopics={latestTopics}
            latestNextSteps={latestNextSteps}
            loadingSessionNotes={loadingSessionNotes}
          />
        </div>
      </div>
    </DesktopWorkspacePanel>
  );
};
