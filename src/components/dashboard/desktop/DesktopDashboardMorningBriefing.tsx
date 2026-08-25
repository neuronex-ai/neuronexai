"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpRight, CalendarDays, ListChecks } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  DesktopWorkspacePanel,
} from "@/components/ui/desktop-workspace";
import { useSessionNotes } from "@/hooks/use-session-notes";
import type { AISummary, Appointment, SessionNote } from "@/types";

import type { AttentionQueueItem } from "./dashboard-command-center-model";
import {
  buildDailyBriefingContext,
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
  financialConnected: boolean;
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

const countLabel = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`;

const BriefingInlineAction = ({
  children,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={ariaLabel}
    className="dashboard-briefing-inline-action rounded-md font-bold text-foreground underline decoration-foreground/30 decoration-1 underline-offset-4 outline-none transition-colors hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
  >
    {children}
  </button>
);

const BriefingMetricButton = ({
  icon: Icon,
  label,
  value,
  detail,
  onClick,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: number;
  detail: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="dashboard-briefing-mini-card group flex min-h-[92px] w-full items-center gap-3 rounded-[22px] border p-3.5 text-left outline-none transition-[border-color,background-color,transform] duration-200 hover:border-foreground/15 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.985] motion-reduce:transition-none motion-reduce:active:scale-100"
  >
    <span className="dashboard-briefing-mini-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border text-muted-foreground">
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span className="mt-1 flex items-baseline gap-1.5">
        <strong className="text-xl font-bold tracking-[-0.04em] text-foreground tabular-nums">
          {value}
        </strong>
        <span className="truncate text-[11px] font-semibold text-muted-foreground">
          {detail}
        </span>
      </span>
    </span>
    <ArrowUpRight
      className="h-4 w-4 shrink-0 text-muted-foreground/55 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none"
      aria-hidden="true"
    />
  </button>
);

export const DesktopDashboardMorningBriefing = ({
  today,
  firstName,
  todayAppointments,
  weekAppointmentsCount,
  attentionItems,
  nextAppointment,
  followingAppointment,
  isLoading,
  financialConnected,
}: DesktopDashboardMorningBriefingProps) => {
  const navigate = useNavigate();
  const [summaryOpen, setSummaryOpen] = useState(false);
  const patientId = nextAppointment?.patient_id || "";
  const { data: sessionNotes = [], isLoading: loadingSessionNotes } =
    useSessionNotes(patientId);
  const latestSessionNote = sessionNotes[0];
  const latestSummaryText = getSessionSummaryText(latestSessionNote);
  const latestTopics = getSummaryTopics(latestSessionNote?.ai_summary);
  const latestNextSteps = getSummaryNextSteps(latestSessionNote?.ai_summary);
  const counts = getDailyBriefingCounts(todayAppointments);
  const briefingContext = buildDailyBriefingContext({
    counts,
    attentionItems,
    financialConnected,
  });
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

  const openBriefingContext = () => {
    if (briefingContext.actionPath === "#dashboard-pendencias") {
      openPendingWorkspace();
      return;
    }
    navigate(briefingContext.actionPath);
  };

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

          <div className="dashboard-briefing-metrics mt-auto">
            <section className="dashboard-briefing-summary-card rounded-[32px] border p-5 sm:p-6" aria-labelledby="dashboard-daily-briefing-title">
              <p id="dashboard-daily-briefing-title" className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Seu dia, em poucas palavras
              </p>
              <p className="mt-4 max-w-[48ch] text-[clamp(1.05rem,1.55vw,1.4rem)] font-medium leading-[1.45] tracking-[-0.025em] text-foreground">
                Para hoje, você tem{" "}
                <BriefingInlineAction onClick={() => openAgenda("all")} ariaLabel="Abrir todos os agendamentos de hoje">
                  {countLabel(counts.total, "agendamento", "agendamentos")}
                </BriefingInlineAction>{" "}
                marcados: {" "}
                <BriefingInlineAction onClick={() => openAgenda("Pendente")} ariaLabel="Abrir agendamentos pendentes de hoje">
                  {countLabel(counts.pending, "pendente", "pendentes")}
                </BriefingInlineAction>{" "}
                e{" "}
                <BriefingInlineAction onClick={() => openAgenda("Confirmada")} ariaLabel="Abrir agendamentos confirmados de hoje">
                  {countLabel(counts.confirmed, "confirmado", "confirmados")}
                </BriefingInlineAction>.
              </p>
              <p className="mt-3 max-w-[58ch] text-sm font-medium leading-relaxed text-muted-foreground">
                {briefingContext.before}
                <BriefingInlineAction onClick={openBriefingContext} ariaLabel={briefingContext.actionLabel}>
                  {briefingContext.actionLabel}
                </BriefingInlineAction>
                {briefingContext.after}
              </p>
              <p className="mt-4 text-[10px] font-semibold text-muted-foreground/75">
                {weekAppointmentsCount} compromissos nos próximos sete dias
              </p>
            </section>

            <div className="dashboard-briefing-rail rounded-[30px] border p-2.5">
              <BriefingMetricButton
                icon={ListChecks}
                label="Revisar antes"
                value={clinicalSignals}
                detail={clinicalSignals === 1 ? "sinal" : "sinais"}
                onClick={openPendingWorkspace}
              />
              <BriefingMetricButton
                icon={CalendarDays}
                label="Operação do dia"
                value={counts.total}
                detail={`${counts.online} online`}
                onClick={() => openAgenda("all")}
              />
            </div>
          </div>
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
