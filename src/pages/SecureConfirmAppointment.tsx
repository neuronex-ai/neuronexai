import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { addMonths, differenceInMinutes, format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  UserRound,
  Video,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

type PublicFlowState =
  | "awaiting_action"
  | "confirmed"
  | "cancelled"
  | "waiting_for_professional"
  | "reschedule_accepted"
  | "request_declined_actions_open"
  | "professional_late_actions_open"
  | "closed";

interface PublicAppointment {
  start_time: string;
  end_time: string;
  type: "presencial" | "online" | "block";
  flow_state: PublicFlowState;
  location: string | null;
  patient_action_due_at?: string | null;
  financial_right_protected?: boolean;
}

interface PublicProfessional {
  name: string;
  clinic: string;
  avatarUrl: string | null;
}

interface RescheduleRequest {
  originalStartTime: string;
  originalEndTime: string;
  requestedStartTime: string;
  requestedEndTime: string;
  reason: string | null;
  reviewReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  requestedAt: string | null;
  withinFreeWindow: boolean | null;
  professionalResponseDueAt: string | null;
  financialRightProtected: boolean;
  reactionDueAt: string | null;
  expiredWithoutResponseAt: string | null;
  protectionMessage: string | null;
}

interface AppointmentPolicy {
  freeCancellationCutoffAt: string;
  freeRescheduleCutoffAt: string;
  minimumPatientReactionHours: number;
  professionalResponseSlaHours: number;
  lateCancellationMessage: string;
  noShowMessage: string;
  creditMessage: string;
  chargeMessage: string;
  fiscalMessage: string;
  timezone: string;
  calendarMinDate: string;
  calendarMaxDate: string;
}

interface PublicActionOption {
  allowed: boolean;
  message: string;
  deadline?: string | null;
}

interface AppointmentResponse {
  appointment: PublicAppointment;
  patient: { firstName: string };
  professional: PublicProfessional;
  rescheduleRequest: RescheduleRequest | null;
  policy: AppointmentPolicy | null;
  actions: {
    confirm: PublicActionOption;
    cancel: PublicActionOption;
    reschedule: PublicActionOption;
  };
}

interface AvailabilitySlot {
  label: string;
  startTime: string;
  endTime: string;
}

interface AvailabilityResponse {
  date: string;
  durationMinutes: number;
  intervalMinutes: number;
  availableSlots: AvailabilitySlot[];
  reason: "availability_not_configured" | "professional_unavailable" | "no_available_slots" | null;
  generatedAt?: string;
}

type WizardStep =
  | "overview"
  | "cancel"
  | "reschedule"
  | "confirmed"
  | "cancelled"
  | "reschedule_sent"
  | "reschedule_approved"
  | "closed";

const finalStepFor = (status: PublicFlowState): WizardStep | null => {
  if (status === "confirmed") return "confirmed";
  if (status === "cancelled") return "cancelled";
  if (status === "waiting_for_professional") return "reschedule_sent";
  if (status === "reschedule_accepted") return "reschedule_approved";
  if (status === "closed") return "closed";
  return null;
};

const reopensPatientActions = (status: PublicFlowState) =>
  status === "request_declined_actions_open" || status === "professional_late_actions_open";

const dateTimeLabel = (value: string, timeZone = "America/Sao_Paulo") => {
  const label = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
};

const compactDateTimeLabel = (value: string, timeZone = "America/Sao_Paulo") =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const calendarDateFromIso = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
};

const availabilityMessage: Record<Exclude<AvailabilityResponse["reason"], null>, string> = {
  availability_not_configured: "O profissional ainda não publicou a grade de atendimento.",
  professional_unavailable: "O profissional não atende neste dia.",
  no_available_slots: "Não há horários livres nesta data.",
};

export default function SecureConfirmAppointment() {
  const { token = "" } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const initializedRef = useRef(false);
  const stepPanelRef = useRef<HTMLElement>(null);
  const [step, setStep] = useState<WizardStep>("overview");
  const [context, setContext] = useState<AppointmentResponse | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot>();
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  const appointment = context?.appointment;
  const professional = context?.professional;
  const rescheduleRequest = context?.rescheduleRequest ?? null;
  const policyTimeZone = context?.policy?.timezone || "America/Sao_Paulo";

  const loadAppointment = useCallback(async (silent = false) => {
    if (!token || token === "invalid") {
      setLoadError(true);
      setInitialLoading(false);
      return;
    }

    if (!silent) setInitialLoading(true);
    const { data, error } = await supabase.functions.invoke<AppointmentResponse>("get-appointment-by-token", {
      body: { token },
    });
    if (error || !data?.appointment) {
      setLoadError(true);
      setContext(null);
      setInitialLoading(false);
      return;
    }

    setContext(data);
    setLoadError(false);
    const serverStep = finalStepFor(data.appointment.flow_state);
    const reopened = reopensPatientActions(data.appointment.flow_state);
    if (!initializedRef.current || (silent && (serverStep || reopened))) {
      setStep(reopened ? "overview" : serverStep || "overview");
      if (reopened) {
        setSelectedDate(undefined);
        setSelectedSlot(undefined);
        setAvailability(null);
      }
    }
    initializedRef.current = true;
    setInitialLoading(false);
  }, [token]);

  useEffect(() => {
    void loadAppointment();
  }, [loadAppointment]);

  useEffect(() => {
    if (!appointment || ["confirmed", "cancelled", "reschedule_accepted", "closed"].includes(appointment.flow_state)) return;
    const interval = window.setInterval(() => void loadAppointment(true), 10_000);
    return () => window.clearInterval(interval);
  }, [appointment, loadAppointment]);

  useEffect(() => {
    if (!initializedRef.current) return;
    window.requestAnimationFrame(() => stepPanelRef.current?.focus());
  }, [step]);

  useEffect(() => {
    if (!appointment || ["confirmed", "cancelled", "reschedule_accepted", "closed"].includes(appointment.flow_state)) return;
    const revalidateWhenVisible = () => {
      if (document.visibilityState === "visible") void loadAppointment(true);
    };
    document.addEventListener("visibilitychange", revalidateWhenVisible);
    window.addEventListener("focus", revalidateWhenVisible);
    return () => {
      document.removeEventListener("visibilitychange", revalidateWhenVisible);
      window.removeEventListener("focus", revalidateWhenVisible);
    };
  }, [appointment, loadAppointment]);

  const loadAvailability = useCallback(async (date: Date) => {
    setAvailabilityLoading(true);
    setSelectedSlot(undefined);
    try {
      const { data, error } = await supabase.functions.invoke<AvailabilityResponse>("get-public-availability", {
        body: { token, date: format(date, "yyyy-MM-dd") },
      });
      if (error || !data) throw error || new Error("Disponibilidade indisponível.");
      setAvailability(data);
    } catch (error) {
      console.error("[SecureConfirmAppointment:availability]", error);
      setAvailability(null);
      toast.error("Não foi possível atualizar os horários.");
    } finally {
      setAvailabilityLoading(false);
    }
  }, [token]);

  const selectDate = (date?: Date) => {
    setSelectedDate(date);
    setAvailability(null);
    setSelectedSlot(undefined);
    if (date) void loadAvailability(date);
  };

  const processAction = async (
    action: "confirm" | "cancel" | "reschedule",
    extra: Record<string, unknown> = {},
  ) => {
    const { data, error } = await supabase.functions.invoke<AppointmentResponse & { success: boolean }>(
      "process-public-appointment",
      { body: { token, action, ...extra } },
    );
    if (error || !data?.success) throw error || new Error("Não foi possível processar o agendamento.");
    setContext(data);
    return data;
  };

  const confirmAppointment = async () => {
    setActionLoading(true);
    try {
      await processAction("confirm");
      setStep("confirmed");
      toast.success("Consulta confirmada.");
    } catch (error) {
      console.error("[SecureConfirmAppointment:confirm]", error);
      toast.error("Não foi possível confirmar a consulta.");
    } finally {
      setActionLoading(false);
    }
  };

  const cancelAppointment = async () => {
    setActionLoading(true);
    try {
      await processAction("cancel", { reason: cancellationReason.trim() || null });
      setStep("cancelled");
      toast.success("Agendamento cancelado.");
    } catch (error) {
      console.error("[SecureConfirmAppointment:cancel]", error);
      toast.error("Não foi possível cancelar o agendamento.");
    } finally {
      setActionLoading(false);
    }
  };

  const requestReschedule = async () => {
    if (!selectedSlot) {
      toast.error("Selecione um horário disponível.");
      return;
    }
    setActionLoading(true);
    try {
      await processAction("reschedule", {
        requestedStartTime: selectedSlot.startTime,
        requestedEndTime: selectedSlot.endTime,
        reason: rescheduleReason.trim() || null,
      });
      setStep("reschedule_sent");
      toast.success("Solicitação enviada ao profissional.");
    } catch (error) {
      console.error("[SecureConfirmAppointment:reschedule]", error);
      if (selectedDate) await loadAvailability(selectedDate);
      toast.error("O horário pode ter sido ocupado. Escolha novamente.");
    } finally {
      setActionLoading(false);
    }
  };

  const durationMinutes = useMemo(() => {
    if (!appointment) return 0;
    return differenceInMinutes(new Date(appointment.end_time), new Date(appointment.start_time));
  }, [appointment]);

  if (initialLoading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background" aria-busy="true">
        <div className="space-y-3 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Carregando agendamento...</p>
        </div>
      </main>
    );
  }

  if (loadError || !appointment || !professional || !context) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-5 text-center">
        <Card className="w-full max-w-md rounded-[28px] border-border/70 shadow-xl">
          <CardContent className="p-8">
            <XCircle className="mx-auto h-14 w-14 text-destructive" aria-hidden="true" />
            <h1 className="mt-5 text-2xl font-bold tracking-tight">Link inválido ou expirado</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Solicite ao profissional um novo e-mail de confirmação.
            </p>
            <Button className="mt-6 h-12 w-full rounded-xl" onClick={() => navigate("/")}>Ir para a NeuroNex</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const secondStage = step !== "overview";
  const motionProps = shouldReduceMotion
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0 } }
    : { initial: { opacity: 0, x: 16 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -12 }, transition: { duration: 0.2 } };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background px-4 py-6 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-primary/[0.08] to-transparent" />
      <div className="relative mx-auto w-full max-w-3xl">
        <header className="mb-5 flex items-center justify-between gap-4 px-1">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">NeuroNex</p>
            <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Gerenciar agendamento</h1>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-3 py-2 text-xs font-semibold text-muted-foreground shadow-sm">
            <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            Link seguro
          </div>
        </header>

        <ol className="mb-4 grid grid-cols-2 gap-2" aria-label={`Etapa ${secondStage ? 2 : 1} de 2`}>
          <li className="h-1.5 rounded-full bg-primary" aria-label="Etapa 1 concluída" />
          <li className={`h-1.5 rounded-full ${secondStage ? "bg-primary" : "bg-muted"}`} aria-current={secondStage ? "step" : undefined} aria-label="Etapa 2" />
        </ol>

        <Card className="overflow-hidden rounded-[28px] border-border/70 bg-card/95 shadow-2xl backdrop-blur-xl">
          <CardContent className="p-0">
            <AnimatePresence mode="wait">
              <motion.section ref={stepPanelRef} tabIndex={-1} key={step} {...motionProps} className="p-5 outline-none sm:p-8">
                {step === "overview" ? (
                  <OverviewStep
                    appointment={appointment}
                    professional={professional}
                    patientFirstName={context.patient.firstName}
                    durationMinutes={durationMinutes}
                    policy={context.policy}
                    rescheduleRequest={rescheduleRequest}
                    actions={context.actions}
                    loading={actionLoading}
                    onConfirm={() => void confirmAppointment()}
                    onCancel={() => setStep("cancel")}
                    onReschedule={() => setStep("reschedule")}
                  />
                ) : null}

                {step === "cancel" ? (
                  <div className="space-y-6">
                    <BackButton disabled={actionLoading} onClick={() => setStep("overview")} />
                    <div>
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                        <XCircle className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <h2 className="text-2xl font-bold tracking-tight">Deseja realmente cancelar este agendamento?</h2>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        O profissional será avisado e essa ação ficará registrada no histórico.
                      </p>
                      <p className="mt-3 rounded-xl border border-border/70 bg-muted/20 p-3 text-sm leading-relaxed text-muted-foreground">
                        {context.actions.cancel.message}
                      </p>
                    </div>
                    <div>
                      <label htmlFor="cancellation-reason" className="mb-2 block text-sm font-semibold">Motivo do cancelamento <span className="font-normal text-muted-foreground">(opcional)</span></label>
                      <Textarea
                        id="cancellation-reason"
                        value={cancellationReason}
                        onChange={(event) => setCancellationReason(event.target.value)}
                        maxLength={500}
                        className="min-h-28 rounded-2xl"
                        placeholder="Se desejar, conte brevemente o motivo."
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button variant="outline" className="h-12 rounded-xl" disabled={actionLoading} onClick={() => setStep("overview")}>Não, voltar</Button>
                      <Button variant="destructive" className="h-12 rounded-xl" disabled={actionLoading} onClick={() => void cancelAppointment()}>
                        {actionLoading ? <><Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /><span className="sr-only">Cancelando agendamento</span></> : "Sim, cancelar"}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {step === "reschedule" ? (
                  <div className="space-y-6">
                    <BackButton disabled={actionLoading} onClick={() => setStep("overview")} />
                    <div>
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <CalendarDays className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <h2 className="text-2xl font-bold tracking-tight">Solicitar novo horário</h2>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        A consulta atual permanece em {compactDateTimeLabel(appointment.start_time, policyTimeZone)} até a aprovação do profissional.
                      </p>
                      <p className="mt-3 rounded-xl border border-border/70 bg-muted/20 p-3 text-sm leading-relaxed text-muted-foreground">
                        {context.actions.reschedule.message}
                      </p>
                    </div>

                    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                      <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={selectDate}
                          disabled={{
                            before: context.policy ? calendarDateFromIso(context.policy.calendarMinDate) : startOfDay(new Date()),
                            after: context.policy ? calendarDateFromIso(context.policy.calendarMaxDate) : addMonths(new Date(), 6),
                          }}
                          locale={ptBR}
                          className="mx-auto"
                        />
                      </div>
                      <div className="min-h-72 rounded-2xl border border-border/70 bg-muted/20 p-4" aria-live="polite">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold">Horários livres</p>
                            <p className="text-xs text-muted-foreground">Duração preservada: {durationMinutes} min</p>
                          </div>
                          {selectedDate ? (
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" disabled={availabilityLoading} onClick={() => void loadAvailability(selectedDate)} aria-label="Atualizar horários">
                              <RefreshCw className={`h-4 w-4 ${availabilityLoading ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />
                            </Button>
                          ) : null}
                        </div>
                        {!selectedDate ? <p className="text-sm text-muted-foreground">Selecione um dia no calendário.</p> : null}
                        {availabilityLoading ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Consultando a agenda...</div>
                        ) : null}
                        {!availabilityLoading && availability?.reason ? (
                          <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">{availabilityMessage[availability.reason]}</p>
                        ) : null}
                        {!availabilityLoading && availability?.availableSlots.length ? (
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-2">
                            {availability.availableSlots.map((slot) => (
                              <button
                                key={slot.startTime}
                                type="button"
                                aria-pressed={selectedSlot?.startTime === slot.startTime}
                                onClick={() => setSelectedSlot(slot)}
                                className={`min-h-11 rounded-xl border px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${selectedSlot?.startTime === slot.startTime ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"}`}
                              >
                                {slot.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="reschedule-reason" className="mb-2 block text-sm font-semibold">Mensagem ao profissional <span className="font-normal text-muted-foreground">(opcional)</span></label>
                      <Textarea
                        id="reschedule-reason"
                        value={rescheduleReason}
                        onChange={(event) => setRescheduleReason(event.target.value)}
                        maxLength={500}
                        className="min-h-24 rounded-2xl"
                        placeholder="Explique sua preferencia, se necessario."
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button variant="outline" className="h-12 rounded-xl" disabled={actionLoading} onClick={() => setStep("overview")}>Voltar</Button>
                      <Button className="h-12 rounded-xl" disabled={actionLoading || !selectedSlot} onClick={() => void requestReschedule()}>
                        {actionLoading ? <><Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /><span className="sr-only">Enviando solicitação</span></> : "Confirmar solicitação"}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {step === "confirmed" ? (
                  <ResultStep icon={<CheckCircle2 className="h-11 w-11" />} tone="success" title="Consulta confirmada" description={`Sua presença foi confirmada para ${compactDateTimeLabel(appointment.start_time, policyTimeZone)}.`} onClose={() => navigate("/")} />
                ) : null}
                {step === "cancelled" ? (
                  <ResultStep icon={<XCircle className="h-11 w-11" />} tone="danger" title="Agendamento cancelado" description={`O profissional foi notificado e o cancelamento foi registrado no histórico. ${context.actions.cancel.message}`} onClose={() => navigate("/")} />
                ) : null}
                {step === "reschedule_sent" ? (
                  <ResultStep
                    icon={<RotateCcw className="h-11 w-11" />}
                    tone="warning"
                    title="Solicitação enviada"
                    description={rescheduleRequest?.requestedStartTime ? `Você solicitou ${compactDateTimeLabel(rescheduleRequest.requestedStartTime, policyTimeZone)}. O horário original permanece até a resposta do profissional.` : "O profissional recebeu a pendência. O horário original permanece até a resposta."}
                    detail={rescheduleRequest?.professionalResponseDueAt
                      ? `O profissional deve responder até ${compactDateTimeLabel(rescheduleRequest.professionalResponseDueAt, policyTimeZone)}. ${rescheduleRequest.financialRightProtected ? "Seus direitos financeiros estão protegidos." : "O servidor preservou o instante exato do seu pedido."}`
                      : "Esta página será atualizada quando a solicitação for analisada."}
                    onClose={() => navigate("/")}
                  />
                ) : null}
                {step === "reschedule_approved" ? (
                  <ResultStep icon={<CheckCircle2 className="h-11 w-11" />} tone="success" title="Novo horário aprovado" description={`A consulta agora está marcada para ${compactDateTimeLabel(appointment.start_time, policyTimeZone)}.`} detail={rescheduleRequest?.reviewReason || undefined} onClose={() => navigate("/")} />
                ) : null}
                {step === "closed" ? (
                  <ResultStep icon={<ShieldCheck className="h-11 w-11" />} tone="neutral" title="Consulta encerrada" description="Este agendamento não aceita mais alterações por este link." onClose={() => navigate("/")} />
                ) : null}
              </motion.section>
            </AnimatePresence>
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
          Suas escolhas ficam protegidas no histórico de auditoria da NeuroNex.
        </p>
      </div>
    </main>
  );
}

function OverviewStep({
  appointment,
  professional,
  patientFirstName,
  durationMinutes,
  policy,
  rescheduleRequest,
  actions,
  loading,
  onConfirm,
  onCancel,
  onReschedule,
}: {
  appointment: PublicAppointment;
  professional: PublicProfessional;
  patientFirstName: string;
  durationMinutes: number;
  policy: AppointmentPolicy | null;
  rescheduleRequest: RescheduleRequest | null;
  actions: AppointmentResponse["actions"];
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onReschedule: () => void;
}) {
  const isRejected = appointment.flow_state === "request_declined_actions_open";
  const isProfessionalOverdue = appointment.flow_state === "professional_late_actions_open";
  const patientActionDeadline = rescheduleRequest?.reactionDueAt || appointment.patient_action_due_at;
  const financialProtection = Boolean(
    appointment.financial_right_protected || rescheduleRequest?.financialRightProtected,
  );

  return (
    <div className="space-y-6">
      {isRejected || isProfessionalOverdue ? (
        <section
          className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-4"
          aria-labelledby="patient-action-status-title"
          role="status"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
              {financialProtection ? <ShieldCheck className="h-5 w-5" aria-hidden="true" /> : <RotateCcw className="h-5 w-5" aria-hidden="true" />}
            </div>
            <div className="min-w-0">
              <h2 id="patient-action-status-title" className="font-bold">
                {isProfessionalOverdue ? "Resposta do profissional em atraso" : "O horário original foi mantido"}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {isProfessionalOverdue
                  ? "A NeuroNex preservou seus direitos financeiros. O horário original continua visível, mas o silêncio do profissional não confirma presença nem autoriza penalidade."
                  : "Você pode confirmar o horário original, cancelar ou solicitar uma alternativa diferente."}
              </p>
              {rescheduleRequest?.reviewReason ? (
                <p className="mt-3 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm">
                  <span className="font-semibold">Retorno do profissional:</span> {rescheduleRequest.reviewReason}
                </p>
              ) : null}
              {patientActionDeadline ? (
                <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <Clock3 className="h-4 w-4" aria-hidden="true" />
                  Você pode agir até {compactDateTimeLabel(patientActionDeadline, policy?.timezone)}.
                </p>
              ) : null}
              {financialProtection ? (
                <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  Nenhuma penalidade financeira automática será aplicada enquanto o caso estiver protegido.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <div className="flex items-center gap-4 rounded-2xl border border-border/70 bg-muted/25 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
          {professional.avatarUrl ? <img src={professional.avatarUrl} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-6 w-6" aria-hidden="true" />}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">Convite para {patientFirstName}</p>
          <h2 className="truncate text-lg font-bold">{professional.name}</h2>
          <p className="truncate text-sm text-muted-foreground">{professional.clinic}</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Resumo da consulta</p>
        <h3 className="mt-2 text-2xl font-bold tracking-tight">{dateTimeLabel(appointment.start_time, policy?.timezone)}</h3>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        <SummaryItem icon={<Clock3 className="h-4 w-4" />} label="Duração" value={`${durationMinutes} minutos`} />
        <SummaryItem icon={appointment.type === "online" ? <Video className="h-4 w-4" /> : <MapPin className="h-4 w-4" />} label="Modalidade" value={appointment.type === "online" ? "Online" : "Presencial"} />
        <SummaryItem icon={<MapPin className="h-4 w-4" />} label="Local" value={appointment.location || "A combinar"} />
      </dl>

      {policy ? (
        <section className="rounded-2xl border border-border/70 bg-muted/20 p-4" aria-labelledby="appointment-policy-title">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            <h3 id="appointment-policy-title" className="text-sm font-bold">Prazos e proteção desta consulta</h3>
          </div>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold text-muted-foreground">Cancelar sem perda de crédito</dt>
              <dd className="mt-1 font-semibold">Até {compactDateTimeLabel(policy.freeCancellationCutoffAt, policy.timezone)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted-foreground">Solicitar outro horário sem perda de crédito</dt>
              <dd className="mt-1 font-semibold">Até {compactDateTimeLabel(policy.freeRescheduleCutoffAt, policy.timezone)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Depois desses prazos: {policy.lateCancellationMessage} O servidor revalida o horário exato ao receber cada ação.
          </p>
        </section>
      ) : null}

      <div className="grid gap-3">
        <div className="rounded-2xl border border-border/60 bg-background/50 p-3">
          <Button className="h-12 w-full rounded-xl text-base" aria-busy={loading} disabled={loading || !actions.confirm.allowed} onClick={onConfirm}>
            {loading ? <><Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /><span className="sr-only">Confirmando consulta</span></> : <><CheckCircle2 className="mr-2 h-5 w-5" />Confirmar</>}
          </Button>
          <p className="mt-2 px-1 text-xs leading-relaxed text-muted-foreground">{actions.confirm.message}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-background/50 p-3">
            <Button variant="outline" className="h-12 w-full rounded-xl" disabled={loading || !actions.reschedule.allowed} onClick={onReschedule}><RotateCcw className="mr-2 h-4 w-4" />Solicitar reagendamento</Button>
            <p className="mt-2 px-1 text-xs leading-relaxed text-muted-foreground">{actions.reschedule.message}</p>
          </div>
          <div className="rounded-2xl border border-destructive/20 bg-background/50 p-3">
            <Button variant="outline" className="h-12 w-full rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={loading || !actions.cancel.allowed} onClick={onCancel}><XCircle className="mr-2 h-4 w-4" />Cancelar</Button>
            <p className="mt-2 px-1 text-xs leading-relaxed text-muted-foreground">{actions.cancel.message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
      <dt className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">{icon}{label}</dt>
      <dd className="mt-2 truncate text-sm font-bold" title={value}>{value}</dd>
    </div>
  );
}

function BackButton({ disabled, onClick }: { disabled?: boolean; onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="-ml-2 rounded-full" disabled={disabled} onClick={onClick}>
      <ArrowLeft className="mr-2 h-4 w-4" />Voltar
    </Button>
  );
}

function ResultStep({
  icon,
  tone,
  title,
  description,
  detail,
  onClose,
}: {
  icon: React.ReactNode;
  tone: "success" | "danger" | "warning" | "neutral";
  title: string;
  description: string;
  detail?: string;
  onClose: () => void;
}) {
  const tones = {
    success: "bg-emerald-500/12 text-emerald-600",
    danger: "bg-destructive/10 text-destructive",
    warning: "bg-amber-500/12 text-amber-600",
    neutral: "bg-muted text-muted-foreground",
  };
  return (
    <div className="mx-auto max-w-lg space-y-6 py-7 text-center" role="status">
      <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${tones[tone]}`}>{icon}</div>
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {detail ? <p className="rounded-2xl border border-border/70 bg-muted/25 p-4 text-sm font-medium">{detail}</p> : null}
      <Button variant="secondary" className="h-12 w-full rounded-xl" onClick={onClose}>Concluir</Button>
    </div>
  );
}
