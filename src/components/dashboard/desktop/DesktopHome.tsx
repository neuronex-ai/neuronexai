"use client";

import { addDays, endOfDay, format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Mic,
  Sparkles,
  Stethoscope,
  UserPlus,
  Video,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { NewAppointmentModal } from "@/components/agenda/NewAppointmentModal";
import { NewPatientModal } from "@/components/patients/NewPatientModal";
import { Button } from "@/components/ui/button";
import { useSynapse } from "@/context/SynapseContext";
import { useAppointmentsByDateRange } from "@/hooks/use-appointments-by-date-range";
import { useFinancialAccount } from "@/hooks/use-financial-account";
import { useNotifications } from "@/hooks/use-notifications";
import { usePendingPatientsCount } from "@/hooks/use-pending-patients-count";
import { useProfile } from "@/hooks/use-profile";
import { getAppointmentDisplayTitle } from "@/lib/appointment-utils";
import { cn } from "@/lib/utils";
import type { Appointment } from "@/types";

import {
  buildAttentionQueue,
  getActiveAppointments,
  getNextScheduleItem,
  getTodayAppointments,
  isOnlineAppointment,
} from "./dashboard-command-center-model";

const firstNameFromProfile = (profile?: {
  first_name?: string | null;
  full_name?: string | null;
  name?: string | null;
} | null) =>
  profile?.first_name ||
  profile?.full_name?.split(" ")[0] ||
  profile?.name?.split(" ")[0] ||
  "Doutor";

const greetingForHour = (hour: number) => {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
};

const shortSuggestionLabel = (label: string) => {
  const clean = label.trim();
  if (clean.length <= 25) return clean;
  return `${clean.slice(0, 24).trimEnd()}…`;
};

type SynapseSuggestion = {
  id: string;
  label: string;
  prompt: string;
};

const Surface = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <section
    className={cn(
      "rounded-[34px] border border-foreground/[0.07] bg-background/72 shadow-[0_34px_90px_-60px_hsl(var(--foreground)/0.35)] backdrop-blur-2xl dark:border-white/[0.065] dark:bg-white/[0.025] dark:shadow-[0_34px_90px_-60px_rgba(0,0,0,0.95)]",
      className,
    )}
  >
    {children}
  </section>
);

export const DesktopHome = () => {
  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);
  const [prompt, setPrompt] = useState("");

  const { data: profile } = useProfile();
  const { data: upcomingRaw, isLoading: loadingAppointments } =
    useAppointmentsByDateRange(startOfDay(today), endOfDay(addDays(today, 7)));
  const { data: pendingPatientsRaw } = usePendingPatientsCount();
  const { notifications, isLoading: notificationsLoading } = useNotifications({
    enableRealtime: false,
    syncBadge: false,
  });
  const { isConnected: financialConnected, isLoading: financialLoading } =
    useFinancialAccount();

  const {
    setActiveTab,
    setInputDraft,
    setShellState,
    toggleVoiceMode,
  } = useSynapse();

  const firstName = firstNameFromProfile(profile);
  const greeting = greetingForHour(today.getHours());
  const pendingPatients = Number(pendingPatientsRaw || 0);

  const activeAppointments = useMemo(
    () => getActiveAppointments((upcomingRaw || []) as Appointment[]),
    [upcomingRaw],
  );
  const todayAppointments = useMemo(
    () => getTodayAppointments(activeAppointments, today),
    [activeAppointments, today],
  );
  const nextAppointment = useMemo(
    () => getNextScheduleItem(activeAppointments, new Date()),
    [activeAppointments],
  );
  const nextItems = useMemo(
    () => activeAppointments.filter((item) => item.id !== nextAppointment?.id).slice(0, 2),
    [activeAppointments, nextAppointment?.id],
  );

  const attentionItems = useMemo(
    () =>
      buildAttentionQueue({
        notifications,
        appointments: activeAppointments,
        pendingPatients,
        financialConnected,
        financialLoading,
        limit: 3,
      }),
    [
      activeAppointments,
      financialConnected,
      financialLoading,
      notifications,
      pendingPatients,
    ],
  );

  const synapseSuggestions = useMemo(() => {
    const candidates: SynapseSuggestion[] = [];

    if (nextAppointment) {
      const patientName =
        getAppointmentDisplayTitle(nextAppointment) ||
        nextAppointment.patient_name ||
        "próximo paciente";
      const patientFirstName = patientName.trim().split(/\s+/)[0] || "sessão";
      const appointmentTime = format(new Date(nextAppointment.start_time), "HH:mm");

      candidates.push({
        id: "next-session",
        label: shortSuggestionLabel(`Preparar ${patientFirstName}`),
        prompt: `Prepare minha próxima sessão com ${patientName}, marcada para ${appointmentTime}. Resuma somente o contexto clínico autorizado e o que merece minha atenção antes do atendimento.`,
      });
    }

    if (pendingPatients > 0) {
      candidates.push({
        id: "pending-patients",
        label: shortSuggestionLabel(`Revisar ${pendingPatients} cadastros`),
        prompt: `Tenho ${pendingPatients} ${pendingPatients === 1 ? "cadastro de paciente pendente" : "cadastros de pacientes pendentes"}. Organize o que precisa da minha atenção e me ajude a decidir o próximo passo.`,
      });
    }

    if (attentionItems.length > 0) {
      const topAttention = attentionItems[0];
      candidates.push({
        id: "attention",
        label: "Revisar pendências",
        prompt: `Revise comigo as pendências que merecem atenção agora. Comece por: ${topAttention.title}. ${topAttention.description}`,
      });
    }

    if (!financialLoading && !financialConnected) {
      candidates.push({
        id: "financial",
        label: "Organizar financeiro",
        prompt: "Revise minha situação financeira operacional na NeuroNex e me diga o que merece atenção agora, separando gestão financeira do que depende do NeuroFinance.",
      });
    }

    if (todayAppointments.length > 0) {
      candidates.push({
        id: "today",
        label: "Resumo do dia",
        prompt: `Faça um resumo operacional do meu dia. Tenho ${todayAppointments.length} ${todayAppointments.length === 1 ? "sessão" : "sessões"} hoje. Mostre agenda, preparos importantes e pendências relacionadas sem alterar nada sem minha confirmação.`,
      });
    }

    if (activeAppointments.length > 0) {
      candidates.push({
        id: "week",
        label: "Organizar semana",
        prompt: `Organize minha semana clínica a partir dos ${activeAppointments.length} compromissos carregados na agenda dos próximos dias. Destaque conflitos, espaços livres e o que precisa de preparação.`,
      });
    }

    const fallbacks: SynapseSuggestion[] = [
      {
        id: "fallback-day",
        label: "Organizar meu dia",
        prompt: "Organize meu dia na NeuroNex usando apenas meu contexto autorizado. Mostre primeiro o que realmente exige uma decisão ou ação minha.",
      },
      {
        id: "fallback-agenda",
        label: "Checar agenda",
        prompt: "Revise minha agenda e me mostre somente o que merece atenção agora, incluindo próximos horários, conflitos ou lacunas relevantes.",
      },
      {
        id: "fallback-pending",
        label: "Ver pendências",
        prompt: "Mostre minhas pendências atuais na NeuroNex em ordem de prioridade e sugira o próximo passo para cada uma, sem executar mudanças sem confirmação.",
      },
    ];

    const unique = new Map<string, SynapseSuggestion>();
    [...candidates, ...fallbacks].forEach((suggestion) => {
      if (!unique.has(suggestion.label)) unique.set(suggestion.label, suggestion);
    });

    return Array.from(unique.values()).slice(0, 3);
  }, [
    activeAppointments.length,
    attentionItems,
    financialConnected,
    financialLoading,
    nextAppointment,
    pendingPatients,
    todayAppointments.length,
  ]);

  const openSynapse = (text = "") => {
    const clean = text.trim();
    setActiveTab("chat");
    if (clean) setInputDraft(clean);
    setShellState("compact");
  };

  const submitPrompt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!prompt.trim()) return;
    openSynapse(prompt);
    setPrompt("");
  };

  const startVoice = async () => {
    setActiveTab("voice");
    setShellState("pill");
    await toggleVoiceMode();
  };

  return (
    <div className="desktop-lumen-page desktop-content-offset relative min-h-screen w-full bg-transparent pb-24 text-foreground">
      <main className="page-spacing relative z-10 mx-auto flex w-full max-w-[1840px] flex-col gap-6 px-6 md:px-8 lg:px-12 xl:px-16">
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <NewAppointmentModal selectedDate={today}>
            <Button variant="outline" className="h-11 rounded-2xl px-4 font-bold">
              <Calendar className="mr-2 h-4 w-4" /> Agendar
            </Button>
          </NewAppointmentModal>
          <NewPatientModal>
            <Button variant="outline" className="h-11 rounded-2xl px-4 font-bold">
              <UserPlus className="mr-2 h-4 w-4" /> Paciente
            </Button>
          </NewPatientModal>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.36fr)_minmax(360px,0.64fr)]">
          <Surface className="overflow-hidden p-6 md:p-8 lg:p-10">
            <div className="flex min-h-[500px] flex-col">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Synapse</span>
              </div>

              <div className="my-auto py-9 md:py-10">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                  {format(today, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </p>
                <h1 className="mt-3 max-w-4xl text-[clamp(2.55rem,4.8vw,5.5rem)] font-black leading-[0.92] tracking-[-0.075em]">
                  {greeting}, {firstName}
                </h1>
                <p className="mt-5 max-w-2xl text-sm font-medium leading-relaxed text-muted-foreground md:text-base">
                  O que você quer resolver agora?
                </p>
              </div>

              <form onSubmit={submitPrompt}>
                <div className="mb-3 flex flex-wrap gap-2">
                  {synapseSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() => openSynapse(suggestion.prompt)}
                      className="group relative overflow-hidden rounded-full border border-foreground/[0.09] bg-background/45 px-4 py-2.5 text-xs font-bold text-foreground shadow-[inset_0_1px_0_hsl(var(--background)/0.85),0_8px_28px_-18px_hsl(var(--foreground)/0.45)] backdrop-blur-2xl transition-[transform,background-color,border-color] hover:-translate-y-0.5 hover:border-foreground/[0.14] hover:bg-background/65 dark:border-white/[0.1] dark:bg-white/[0.055] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_10px_30px_-20px_rgba(0,0,0,0.95)] dark:hover:border-white/[0.16] dark:hover:bg-white/[0.085]"
                      aria-label={`Perguntar ao Synapse: ${suggestion.label}`}
                    >
                      <span className="relative z-10">{suggestion.label}</span>
                    </button>
                  ))}
                </div>

                <div className="flex min-h-[72px] items-center gap-3 rounded-[26px] border border-foreground/[0.09] bg-muted/25 p-2 pl-5 dark:border-white/[0.08] dark:bg-white/[0.035]">
                  <Sparkles className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <input
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Pergunte ou peça algo à NeuroNex"
                    className="min-w-0 flex-1 bg-transparent py-3 text-base font-medium outline-none placeholder:text-muted-foreground/65"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => void startVoice()}
                    className="h-12 w-12 shrink-0 rounded-[18px]"
                    aria-label="Falar com o Synapse"
                  >
                    <Mic className="h-5 w-5" />
                  </Button>
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!prompt.trim()}
                    className="h-12 w-12 shrink-0 rounded-[18px]"
                    aria-label="Abrir no Synapse"
                  >
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </div>
              </form>
            </div>
          </Surface>

          <div className="flex flex-col gap-6">
            <Surface className="p-6 md:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Agora</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.045em]">Próxima sessão</h2>
                </div>
                {nextAppointment ? (
                  <span className="rounded-full border border-foreground/[0.08] px-3 py-1.5 text-xs font-bold text-muted-foreground dark:border-white/[0.08]">
                    {format(new Date(nextAppointment.start_time), "HH:mm")}
                  </span>
                ) : null}
              </div>

              {loadingAppointments ? (
                <div className="mt-8 h-36 animate-pulse rounded-[26px] bg-muted/40" />
              ) : nextAppointment ? (
                <button
                  type="button"
                  onClick={() => navigate("/agenda", { state: { openAppointmentId: nextAppointment.id } })}
                  className="group mt-8 w-full rounded-[28px] border border-foreground/[0.08] bg-foreground p-5 text-left text-background transition-transform hover:-translate-y-0.5 dark:border-white/10 dark:bg-white dark:text-zinc-950"
                >
                  <div className="flex items-center gap-2 text-background/60 dark:text-zinc-950/55">
                    {isOnlineAppointment(nextAppointment) ? <Video className="h-4 w-4" /> : <Stethoscope className="h-4 w-4" />}
                    <span className="text-[10px] font-black uppercase tracking-[0.16em]">
                      {isOnlineAppointment(nextAppointment) ? "Online" : "Consultório"}
                    </span>
                  </div>
                  <p className="mt-5 truncate text-2xl font-black tracking-[-0.045em]">
                    {getAppointmentDisplayTitle(nextAppointment) || nextAppointment.patient_name || "Paciente"}
                  </p>
                  <div className="mt-5 flex items-center justify-between text-sm font-bold">
                    <span>{format(new Date(nextAppointment.start_time), "HH:mm")}</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </button>
              ) : (
                <div className="mt-8 flex min-h-36 flex-col items-center justify-center rounded-[26px] border border-dashed border-foreground/[0.1] p-5 text-center dark:border-white/10">
                  <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
                  <p className="mt-3 font-bold">Sem sessão próxima.</p>
                  <p className="mt-1 text-sm text-muted-foreground">Sua agenda está livre por enquanto.</p>
                </div>
              )}
            </Surface>

            <Surface className="p-6 md:p-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Depois</p>
                  <h2 className="mt-2 text-xl font-black tracking-[-0.04em]">Próximos horários</h2>
                </div>
                <Button variant="ghost" className="rounded-xl text-xs font-bold" onClick={() => navigate("/agenda")}>Agenda</Button>
              </div>
              <div className="mt-5 space-y-2">
                {nextItems.length ? nextItems.map((appointment) => (
                  <button
                    key={appointment.id}
                    type="button"
                    onClick={() => navigate("/agenda", { state: { openAppointmentId: appointment.id } })}
                    className="flex w-full items-center gap-4 rounded-[20px] px-3 py-3 text-left transition-colors hover:bg-muted/45"
                  >
                    <span className="w-12 text-sm font-black tabular-nums">{format(new Date(appointment.start_time), "HH:mm")}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">
                      {getAppointmentDisplayTitle(appointment) || appointment.patient_name || "Paciente"}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
                  </button>
                )) : (
                  <p className="py-4 text-sm font-medium text-muted-foreground">Nada urgente depois disso.</p>
                )}
              </div>
            </Surface>
          </div>
        </div>

        <Surface className="p-6 md:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Atenção</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.045em]">O que merece um olhar</h2>
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {todayAppointments.length} {todayAppointments.length === 1 ? "sessão hoje" : "sessões hoje"}
            </p>
          </div>

          {notificationsLoading ? (
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-[24px] bg-muted/35" />)}
            </div>
          ) : attentionItems.length ? (
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {attentionItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.actionUrl)}
                  className="group rounded-[26px] border border-foreground/[0.07] p-5 text-left transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-muted/30 dark:border-white/[0.06]"
                >
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
                  <p className="mt-3 line-clamp-1 text-base font-black tracking-[-0.02em]">{item.title}</p>
                  <p className="mt-2 line-clamp-2 text-sm font-medium leading-relaxed text-muted-foreground">{item.description}</p>
                  <ArrowRight className="mt-5 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-6 flex min-h-28 items-center gap-4 rounded-[26px] border border-dashed border-foreground/[0.1] p-5 dark:border-white/10">
              <CheckCircle2 className="h-6 w-6 text-emerald-500/70" />
              <div>
                <p className="font-bold">Tudo em dia.</p>
                <p className="mt-1 text-sm font-medium text-muted-foreground">Nenhuma pendência acionável precisa ocupar sua Home agora.</p>
              </div>
            </div>
          )}
        </Surface>
      </main>
    </div>
  );
};

export default DesktopHome;
