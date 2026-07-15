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

type LifecycleStatus =
  | "created"
  | "invitation_sent"
  | "awaiting_confirmation"
  | "awaiting_reconfirmation"
  | "confirmed"
  | "cancellation_requested"
  | "cancelled"
  | "reschedule_requested"
  | "reschedule_approved"
  | "reschedule_rejected"
  | "in_progress"
  | "completed"
  | "closed";

interface PublicAppointment {
  id: string;
  start_time: string;
  end_time: string;
  type: "presencial" | "online" | "block";
  status: string;
  lifecycle_status: LifecycleStatus;
  location: string | null;
  payment_status?: string | null;
  confirmation_revision?: number;
  confirmed_revision?: number | null;
  updated_at?: string | null;
}

interface PublicProfessional {
  id: string;
  name: string;
  clinic: string;
  avatarUrl: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
}

interface RescheduleRequest {
  id: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  originalStartTime: string;
  originalEndTime: string;
  requestedStartTime: string;
  requestedEndTime: string;
  reason: string | null;
  reviewReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface AppointmentResponse {
  appointment: PublicAppointment;
  patient: { firstName: string };
  professional: PublicProfessional;
  rescheduleRequest: RescheduleRequest | null;
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
  | "reschedule_rejected"
  | "closed";

const finalStepFor = (status: LifecycleStatus): WizardStep | null => {
  if (status === "confirmed") return "confirmed";
  if (status === "cancelled") return "cancelled";
  if (status === "reschedule_requested") return "reschedule_sent";
  if (status === "reschedule_approved") return "reschedule_approved";
  if (status === "reschedule_rejected") return "reschedule_rejected";
  if (["in_progress", "completed", "closed"].includes(status)) return "closed";
  return null;
};

const dateTimeLabel = (value: string) => {
  const label = format(new Date(value), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
};

const compactDateTimeLabel = (value: string) =>
  format(new Date(value), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR });

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
  const rescheduleRequest = context?.rescheduleRequest;

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
      if (!silent) setLoadError(true);
      setInitialLoading(false);
      return;
    }

    setContext(data);
    setLoadError(false);
    const serverStep = finalStepFor(data.appointment.lifecycle_status);
    if (!initializedRef.current || (silent && serverStep)) {
      setStep(serverStep || "overview");
    }
    initializedRef.current = true;
    setInitialLoading(false);
  }, [token]);

  useEffect(() => {
    void loadAppointment();
  }, [loadAppointment]);

  useEffect(() => {
    if (appointment?.lifecycle_status !== "reschedule_requested") return;
    const interval = window.setInterval(() => void loadAppointment(true), 10_000);
    return () => window.clearInterval(interval);
  }, [appointment?.lifecycle_status, loadAppointment]);

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
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" aria-hidden="true" />
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

        <div className="mb-4 grid grid-cols-2 gap-2" aria-label={`Etapa ${secondStage ? 2 : 1} de 2`}>
          <div className="h-1.5 rounded-full bg-primary" />
          <div className={`h-1.5 rounded-full ${secondStage ? "bg-primary" : "bg-muted"}`} />
        </div>

        <Card className="overflow-hidden rounded-[28px] border-border/70 bg-card/95 shadow-2xl backdrop-blur-xl">
          <CardContent className="p-0">
            <AnimatePresence mode="wait">
              <motion.section key={step} {...motionProps} className="p-5 sm:p-8">
                {step === "overview" ? (
                  <OverviewStep
                    appointment={appointment}
                    professional={professional}
                    patientFirstName={context.patient.firstName}
                    durationMinutes={durationMinutes}
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
                        {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sim, cancelar"}
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
                        A consulta atual permanece em {compactDateTimeLabel(appointment.start_time)} até a aprovação do profissional.
                      </p>
                    </div>

                    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                      <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={selectDate}
                          disabled={{ before: startOfDay(new Date()), after: addMonths(new Date(), 6) }}
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
                              <RefreshCw className={`h-4 w-4 ${availabilityLoading ? "animate-spin" : ""}`} aria-hidden="true" />
                            </Button>
                          ) : null}
                        </div>
                        {!selectedDate ? <p className="text-sm text-muted-foreground">Selecione um dia no calendário.</p> : null}
                        {availabilityLoading ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Consultando a agenda...</div>
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
                        {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirmar solicitação"}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {step === "confirmed" ? (
                  <ResultStep icon={<CheckCircle2 className="h-11 w-11" />} tone="success" title="Consulta confirmada" description={`Sua presença foi confirmada para ${compactDateTimeLabel(appointment.start_time)}.`} onClose={() => navigate("/")} />
                ) : null}
                {step === "cancelled" ? (
                  <ResultStep icon={<XCircle className="h-11 w-11" />} tone="danger" title="Agendamento cancelado" description="O profissional foi notificado e o cancelamento foi registrado no histórico." onClose={() => navigate("/")} />
                ) : null}
                {step === "reschedule_sent" ? (
                  <ResultStep
                    icon={<RotateCcw className="h-11 w-11" />}
                    tone="warning"
                    title="Solicitação enviada"
                    description={rescheduleRequest?.requestedStartTime ? `Você solicitou ${compactDateTimeLabel(rescheduleRequest.requestedStartTime)}. O horário original permanece até a resposta do profissional.` : "O profissional recebeu a pendência. O horário original permanece até a resposta."}
                    detail="Esta página será atualizada quando a solicitação for analisada."
                    onClose={() => navigate("/")}
                  />
                ) : null}
                {step === "reschedule_approved" ? (
                  <ResultStep icon={<CheckCircle2 className="h-11 w-11" />} tone="success" title="Novo horário aprovado" description={`A consulta agora está marcada para ${compactDateTimeLabel(appointment.start_time)}.`} detail={rescheduleRequest?.reviewReason || undefined} onClose={() => navigate("/")} />
                ) : null}
                {step === "reschedule_rejected" ? (
                  <ResultStep icon={<RotateCcw className="h-11 w-11" />} tone="warning" title="Horário original mantido" description={`O pedido de reagendamento não foi aceito. Sua consulta continua em ${compactDateTimeLabel(appointment.start_time)}.`} detail={rescheduleRequest?.reviewReason || undefined} onClose={() => navigate("/")} />
                ) : null}
                {step === "closed" ? (
                  <ResultStep icon={<ShieldCheck className="h-11 w-11" />} tone="neutral" title="Consulta encerrada" description="Este agendamento não aceita mais alterações por este link." onClose={() => navigate("/")} />
                ) : null}
              </motion.section>
            </AnimatePresence>
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
          As alterações ficam vinculadas ao ID do agendamento e ao histórico de auditoria.
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
  loading,
  onConfirm,
  onCancel,
  onReschedule,
}: {
  appointment: PublicAppointment;
  professional: PublicProfessional;
  patientFirstName: string;
  durationMinutes: number;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onReschedule: () => void;
}) {
  return (
    <div className="space-y-6">
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
        <h3 className="mt-2 text-2xl font-bold tracking-tight">{dateTimeLabel(appointment.start_time)}</h3>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        <SummaryItem icon={<Clock3 className="h-4 w-4" />} label="Duração" value={`${durationMinutes} minutos`} />
        <SummaryItem icon={appointment.type === "online" ? <Video className="h-4 w-4" /> : <MapPin className="h-4 w-4" />} label="Modalidade" value={appointment.type === "online" ? "Online" : "Presencial"} />
        <SummaryItem icon={<MapPin className="h-4 w-4" />} label="Local" value={appointment.location || "A combinar"} />
      </dl>

      <div className="grid gap-3">
        <Button className="h-12 rounded-xl text-base" disabled={loading} onClick={onConfirm}>
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><CheckCircle2 className="mr-2 h-5 w-5" />Confirmar</>}
        </Button>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button variant="outline" className="h-12 rounded-xl" disabled={loading} onClick={onReschedule}><RotateCcw className="mr-2 h-4 w-4" />Solicitar reagendamento</Button>
          <Button variant="outline" className="h-12 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={loading} onClick={onCancel}><XCircle className="mr-2 h-4 w-4" />Cancelar</Button>
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
