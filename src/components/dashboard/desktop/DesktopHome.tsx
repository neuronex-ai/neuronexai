"use client";

import { addDays, differenceInMinutes, endOfDay, format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Mic,
  Search,
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

const attentionHeadingForHour = (hour: number) => {
  if (hour < 12) return "Antes de começar";
  if (hour < 18) return "Entre uma sessão e outra";
  return "Antes de encerrar";
};

const shortSuggestionLabel = (label: string) => {
  const clean = label.trim();
  if (clean.length <= 25) return clean;
  return `${clean.slice(0, 24).trimEnd()}…`;
};

const appointmentName = (appointment?: Appointment | null) =>
  appointment
    ? getAppointmentDisplayTitle(appointment) || appointment.patient_name || "Paciente"
    : "Paciente";

type SynapseSuggestionKind = "prepare" | "consult" | "act";

type SynapseSuggestion = {
  id: string;
  kind: SynapseSuggestionKind;
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
      "rounded-[32px] border border-foreground/[0.07] bg-background/70 shadow-[0_30px_80px_-58px_hsl(var(--foreground)/0.32)] backdrop-blur-2xl dark:border-white/[0.06] dark:bg-white/[0.024] dark:shadow-[0_30px_80px_-58px_rgba(0,0,0,0.9)]",
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

  const { setActiveTab, setInputDraft, setShellState, toggleVoiceMode } = useSynapse();

  const firstName = firstNameFromProfile(profile);
  const greeting = greetingForHour(today.getHours());
  const attentionHeading = attentionHeadingForHour(today.getHours());
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
    [activeAppointments, financialConnected, financialLoading, notifications, pendingPatients],
  );

  const nextAppointmentContext = useMemo(() => {
    if (!nextAppointment) return null;
    const minutes = differenceInMinutes(new Date(nextAppointment.start_time), new Date());
    if (minutes <= 5) return "agora";
    if (minutes < 60) return `em ${minutes} min`;
    if (minutes < 24 * 60) return `em ${Math.max(1, Math.round(minutes / 60))} h`;
    return format(new Date(nextAppointment.start_time), "EEE", { locale: ptBR });
  }, [nextAppointment]);

  const synapseSuggestions = useMemo(() => {
    const nextName = appointmentName(nextAppointment);
    const nextFirstName = nextName.trim().split(/\s+/)[0] || "sessão";

    const prepare: SynapseSuggestion = nextAppointment
      ? {
          id: "prepare-next",
          kind: "prepare",
          label: shortSuggestionLabel(`Preparar ${nextFirstName}`),
          prompt: `Prepare minha próxima sessão com ${nextName}, marcada para ${format(new Date(nextAppointment.start_time), "HH:mm")}. Resuma somente o contexto clínico autorizado e o que merece minha atenção antes do atendimento.`,
        }
      : todayAppointments.length > 0
        ? {
            id: "prepare-today",
            kind: "prepare",
            label: "Preparar minhas sessões",
            prompt: `Ajude a preparar minhas ${todayAppointments.length} ${todayAppointments.length === 1 ? "sessão" : "sessões"} de hoje. Mostre somente contexto autorizado e pontos que merecem atenção antes de cada atendimento.`,
          }
        : {
            id: "prepare-day",
            kind: "prepare",
            label: "Preparar meu dia",
            prompt: "Prepare meu dia na NeuroNex usando apenas meu contexto autorizado. Priorize agenda, contexto clínico e o que exige preparação antes dos atendimentos.",
          };

    const consult: SynapseSuggestion = attentionItems.length > 0
      ? {
          id: "consult-attention",
          kind: "consult",
          label: "Ver o que é urgente",
          prompt: `Revise o que merece minha atenção agora. Comece por: ${attentionItems[0].title}. ${attentionItems[0].description}`,
        }
      : {
          id: "consult-day",
          kind: "consult",
          label: todayAppointments.length > 0 ? "Resumo do dia" : "Checar agenda",
          prompt: todayAppointments.length > 0
            ? `Faça um resumo operacional do meu dia. Tenho ${todayAppointments.length} ${todayAppointments.length === 1 ? "sessão" : "sessões"} hoje. Mostre agenda, preparos e informações relevantes sem executar mudanças.`
            : "Revise minha agenda e mostre somente o que merece atenção agora, incluindo próximos horários, conflitos ou lacunas relevantes.",
        };

    let act: SynapseSuggestion;
    if (pendingPatients > 0) {
      act = {
        id: "act-patients",
        kind: "act",
        label: shortSuggestionLabel(`Organizar ${pendingPatients} cadastros`),
        prompt: `Tenho ${pendingPatients} ${pendingPatients === 1 ? "cadastro de paciente pendente" : "cadastros de pacientes pendentes"}. Organize o que precisa da minha atenção e prepare os próximos passos sem executar mudanças sem minha confirmação.`,
      };
    } else if (!financialLoading && !financialConnected) {
      act = {
        id: "act-financial",
        kind: "act",
        label: "Organizar financeiro",
        prompt: "Revise minha situação financeira operacional na NeuroNex e prepare os próximos passos, separando gestão financeira do que depende do NeuroFinance. Não execute mudanças sem minha confirmação.",
      };
    } else if (today.getHours() >= 18) {
      act = {
        id: "act-close-day",
        kind: "act",
        label: "Fechar meu dia",
        prompt: "Ajude a fechar meu dia na NeuroNex. Revise registros, pendências e próximos compromissos e prepare o que ficou para amanhã, sem executar mudanças sem confirmação.",
      };
    } else {
      act = {
        id: "act-organize",
        kind: "act",
        label: today.getHours() < 12 ? "Organizar meu dia" : "Organizar próximos passos",
        prompt: "Organize meus próximos passos na NeuroNex com base no contexto atual da clínica. Priorize o que exige decisão ou ação e não execute mudanças sem minha confirmação.",
      };
    }

    return [prepare, consult, act];
  }, [attentionItems, financialConnected, financialLoading, nextAppointment, pendingPatients, today, todayAppointments.length]);

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
      <main className="page-spacing relative z-10 mx-auto flex w-full max-w-[1840px] flex-col gap-5 px-6 md:px-8 lg:px-12 xl:px-16">
        <div className="flex flex-wrap justify-end gap-1.5 pt-1">
          <NewAppointmentModal selectedDate={today}>
            <Button variant="ghost" className="h-9 rounded-xl border border-foreground/[0.07] px-3 text-xs font-bold text-muted-foreground hover:text-foreground dark:border-white/[0.06]">
              <Calendar className="mr-1.5 h-3.5 w-3.5" /> Agendar
            </Button>
          </NewAppointmentModal>
          <NewPatientModal>
            <Button variant="ghost" className="h-9 rounded-xl border border-foreground/[0.07] px-3 text-xs font-bold text-muted-foreground hover:text-foreground dark:border-white/[0.06]">
              <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Paciente
            </Button>
          </NewPatientModal>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.6fr)]">
          <Surface className="overflow-hidden p-6 md:p-8 lg:p-9">
            <div className="flex min-h-[420px] flex-col">
              <div className="flex items-center gap-1.5 text-muted-foreground/55">
                <Sparkles className="h-3.5 w-3.5" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em]">Synapse</span>
              </div>

              <div className="my-auto py-5 md:py-7">
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                  {format(today, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </p>
                <h1 className="mt-2.5 max-w-4xl text-[clamp(2.35rem,4.35vw,5rem)] font-black leading-[0.93] tracking-[-0.072em]">
                  {greeting}, {firstName}
                </h1>
                <p className="mt-3.5 text-sm font-medium text-muted-foreground md:text-[15px]">
                  O que você quer resolver agora?
                </p>
              </div>

              <form onSubmit={submitPrompt}>
                <div className="mb-2.5 flex flex-wrap gap-2">
                  {synapseSuggestions.map((suggestion) => {
                    const Icon = suggestion.kind === "prepare" ? Sparkles : suggestion.kind === "consult" ? Search : ArrowRight;
                    return (
                      <button
                        key={suggestion.id}
                        type="button"
                        onClick={() => openSynapse(suggestion.prompt)}
                        className={cn(
                          "group flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[11px] font-bold text-foreground backdrop-blur-2xl transition-[transform,background-color,border-color] hover:-translate-y-0.5",
                          suggestion.kind === "prepare" && "border-foreground/[0.09] bg-background/55 hover:bg-background/75 dark:border-white/[0.1] dark:bg-white/[0.06] dark:hover:bg-white/[0.09]",
                          suggestion.kind === "consult" && "border-foreground/[0.07] bg-muted/30 hover:bg-muted/45 dark:border-white/[0.075] dark:bg-white/[0.035] dark:hover:bg-white/[0.065]",
                          suggestion.kind === "act" && "border-foreground/[0.11] bg-foreground/[0.035] hover:bg-foreground/[0.06] dark:border-white/[0.12] dark:bg-white/[0.07] dark:hover:bg-white/[0.1]",
                        )}
                        aria-label={`Perguntar ao Synapse: ${suggestion.label}`}
                      >
                        <Icon className="h-3 w-3 text-muted-foreground" />
                        <span>{suggestion.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex min-h-[70px] items-center gap-3 rounded-[24px] border border-foreground/[0.14] bg-background/68 p-2 pl-5 shadow-[inset_0_1px_0_hsl(var(--background)/0.9),0_20px_45px_-35px_hsl(var(--foreground)/0.55)] backdrop-blur-2xl transition-[border-color,background-color] focus-within:border-foreground/[0.24] focus-within:bg-background/82 dark:border-white/[0.13] dark:bg-white/[0.055] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_20px_45px_-35px_rgba(0,0,0,0.95)] dark:focus-within:border-white/[0.22] dark:focus-within:bg-white/[0.075]">
                  <Sparkles className="h-4.5 w-4.5 shrink-0 text-muted-foreground/70" />
                  <input
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Pergunte ou peça algo à NeuroNex"
                    className="min-w-0 flex-1 bg-transparent py-3 text-base font-medium outline-none placeholder:text-muted-foreground/55"
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => void startVoice()} className="h-11 w-11 shrink-0 rounded-[16px]" aria-label="Falar com o Synapse">
                    <Mic className="h-5 w-5" />
                  </Button>
                  <Button type="submit" size="icon" disabled={!prompt.trim()} className="h-11 w-11 shrink-0 rounded-[16px]" aria-label="Abrir no Synapse">
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </div>
              </form>
            </div>
          </Surface>

          <Surface className="overflow-hidden p-0">
            <div className="p-6 md:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">Agora</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.045em]">Próxima sessão</h2>
                </div>
                {nextAppointment ? (
                  <span className="rounded-full bg-muted/35 px-3 py-1.5 text-[11px] font-bold text-muted-foreground">
                    {format(new Date(nextAppointment.start_time), "HH:mm")}
                  </span>
                ) : null}
              </div>

              {loadingAppointments ? (
                <div className="mt-6 h-32 animate-pulse rounded-[22px] bg-muted/35" />
              ) : nextAppointment ? (
                <button
                  type="button"
                  onClick={() => navigate("/agenda", { state: { openAppointmentId: nextAppointment.id } })}
                  className="group mt-6 w-full rounded-[24px] bg-foreground/[0.035] p-5 text-left transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-foreground/[0.055] dark:bg-white/[0.045] dark:hover:bg-white/[0.07]"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {isOnlineAppointment(nextAppointment) ? <Video className="h-3.5 w-3.5" /> : <Stethoscope className="h-3.5 w-3.5" />}
                    <span className="text-[9px] font-black uppercase tracking-[0.15em]">
                      {isOnlineAppointment(nextAppointment) ? "Online" : "Consultório"}
                    </span>
                    {nextAppointmentContext ? <span className="text-[11px] font-semibold">· {nextAppointmentContext}</span> : null}
                  </div>
                  <p className="mt-4 truncate text-[1.65rem] font-black tracking-[-0.05em]">
                    {appointmentName(nextAppointment)}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-sm font-bold">
                    <span>{format(new Date(nextAppointment.start_time), "HH:mm")}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </div>
                </button>
              ) : (
                <div className="mt-6 flex min-h-28 items-center gap-3 rounded-[22px] bg-muted/20 p-4">
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-bold">Sem sessão próxima.</p>
                    <p className="mt-0.5 text-xs font-medium text-muted-foreground">Sua agenda está livre por enquanto.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-foreground/[0.06] px-6 py-5 dark:border-white/[0.055] md:px-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">Depois</p>
                  <h3 className="mt-1.5 text-base font-black tracking-[-0.03em]">Próximos horários</h3>
                </div>
                <Button variant="ghost" className="h-8 rounded-lg px-2.5 text-[11px] font-bold text-muted-foreground" onClick={() => navigate("/agenda")}>Agenda</Button>
              </div>

              <div className="relative mt-4">
                {nextItems.length ? (
                  <>
                    <div className="absolute bottom-4 left-[4.5px] top-4 w-px bg-foreground/[0.08] dark:bg-white/[0.07]" />
                    <div className="space-y-1">
                      {nextItems.map((appointment) => (
                        <button
                          key={appointment.id}
                          type="button"
                          onClick={() => navigate("/agenda", { state: { openAppointmentId: appointment.id } })}
                          className="group relative flex w-full items-center gap-3 rounded-xl py-2.5 pl-5 pr-1 text-left hover:bg-muted/25"
                        >
                          <span className="absolute left-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-muted-foreground/45 ring-1 ring-foreground/[0.08]" />
                          <span className="w-11 text-xs font-black tabular-nums">{format(new Date(appointment.start_time), "HH:mm")}</span>
                          <span className="min-w-0 flex-1 truncate text-sm font-bold">{appointmentName(appointment)}</span>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/35 transition-transform group-hover:translate-x-0.5" />
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="py-2 text-xs font-medium text-muted-foreground">Nada urgente depois disso.</p>
                )}
              </div>
            </div>
          </Surface>
        </div>

        {notificationsLoading ? (
          <Surface className="p-5">
            <div className="h-16 animate-pulse rounded-[20px] bg-muted/25" />
          </Surface>
        ) : attentionItems.length <= 1 ? (
          <Surface className="px-5 py-4 md:px-6">
            {attentionItems.length === 1 ? (
              <button type="button" onClick={() => navigate(attentionItems[0].actionUrl)} className="group flex w-full items-center gap-4 text-left">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.17em] text-muted-foreground">{attentionHeading}</span>
                    <span className="text-[11px] font-semibold text-muted-foreground">{todayAppointments.length} {todayAppointments.length === 1 ? "sessão hoje" : "sessões hoje"}</span>
                  </div>
                  <p className="mt-1.5 truncate text-sm font-black">{attentionItems[0].title}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs font-medium text-muted-foreground">{attentionItems[0].description}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-muted-foreground/65" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.17em] text-muted-foreground">{attentionHeading}</span>
                    <span className="text-[11px] font-semibold text-muted-foreground">{todayAppointments.length} {todayAppointments.length === 1 ? "sessão hoje" : "sessões hoje"}</span>
                  </div>
                  <p className="mt-1 text-sm font-bold">Tudo em dia. Nenhuma pendência precisa ocupar sua Home agora.</p>
                </div>
              </div>
            )}
          </Surface>
        ) : (
          <Surface className="overflow-hidden p-0">
            <div className="flex flex-col gap-2 px-6 pb-4 pt-5 sm:flex-row sm:items-end sm:justify-between md:px-7">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">{attentionHeading}</p>
                <h2 className="mt-1.5 text-xl font-black tracking-[-0.04em]">O que merece um olhar</h2>
              </div>
              <p className="text-xs font-medium text-muted-foreground">{todayAppointments.length} {todayAppointments.length === 1 ? "sessão hoje" : "sessões hoje"}</p>
            </div>
            <div className="grid border-t border-foreground/[0.06] dark:border-white/[0.055] md:grid-cols-3">
              {attentionItems.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.actionUrl)}
                  className={cn(
                    "group p-5 text-left transition-colors hover:bg-muted/25 md:p-6",
                    index > 0 && "border-t border-foreground/[0.06] dark:border-white/[0.055] md:border-l md:border-t-0",
                  )}
                >
                  <p className="text-[8px] font-black uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
                  <p className="mt-2 line-clamp-1 text-sm font-black tracking-[-0.02em]">{item.title}</p>
                  <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-relaxed text-muted-foreground">{item.description}</p>
                  <ArrowRight className="mt-3.5 h-3.5 w-3.5 text-muted-foreground/50 transition-transform group-hover:translate-x-1" />
                </button>
              ))}
            </div>
          </Surface>
        )}
      </main>
    </div>
  );
};

export default DesktopHome;
