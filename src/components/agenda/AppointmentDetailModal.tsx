"use client";

import { Button } from "@/components/ui/button";
import { AppointmentRescheduleReview } from "@/components/agenda/AppointmentRescheduleReview";
import { AppointmentTimelinePanel } from "@/components/agenda/AppointmentTimelineDialog";
import { AppointmentProfessionalActionDialog } from "@/components/agenda/AppointmentProfessionalActionDialog";
import { ResponsiveModal } from "@/components/ui/ResponsiveModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSendEmail } from "@/hooks/use-send-email";
import { useAppointmentLifecycle } from "@/hooks/use-appointment-lifecycle";
import { useUpdateAppointment } from "@/hooks/use-update-appointment";
import type { ProfessionalAppointmentAction } from "@/hooks/use-appointment-professional-action";
import { mapFinancialEntryToTransaction } from "@/hooks/use-financial-entries";
import {
  getAppointmentStatusMeta,
  normalizeAppointmentStatus,
} from "@/lib/appointment-status";
import {
  buildEventNotes,
  getAppointmentMetadata,
  getEditableAppointmentNotes,
  getEventCategoryLabel,
  getSessionTypeLabel,
  type AppointmentMetadata,
} from "@/lib/appointment-metadata";
import { getAppointmentDisplayTitle, getDurationString } from "@/lib/appointment-utils";
import { formatTimeBrazil } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Appointment } from "@/types";
import { format, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  Archive,
  Banknote,
  Briefcase,
  CalendarDays,
  CheckCircle,
  ChevronRight,
  Clock,
  Clock3,
  CreditCard,
  FileText,
  Loader2,
  Mail,
  MessageCircle,
  MoreHorizontal,
  QrCode,
  Repeat,
  ShieldCheck,
  User,
  Video,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const EVENT_CATEGORIES = [
  { value: "reuniao", label: "Reunião" },
  { value: "supervisao", label: "Supervisão" },
  { value: "particular", label: "Particular" },
  { value: "bloqueio", label: "Bloqueio de Agenda" },
  { value: "formacao", label: "Formação / Curso" },
  { value: "administrativo", label: "Administrativo" },
  { value: "google", label: "Google Agenda" },
  { value: "outro", label: "Outro" },
];

const SESSION_TYPES = [
  { value: "first_visit", label: "Primeira Consulta" },
  { value: "follow_up", label: "Acompanhamento" },
  { value: "emergency", label: "Emergência / Encaixe" },
];

const MODALITY_OPTIONS = [
  { value: "presencial", label: "Presencial" },
  { value: "online", label: "Online" },
] as const;

const RECURRENCE_LABELS: Record<string, string> = {
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
};

const LIFECYCLE_LABELS: Record<string, string> = {
  created: "Criado",
  invitation_sent: "Convite enviado",
  awaiting_confirmation: "Aguardando confirmação",
  awaiting_reconfirmation: "Aguardando nova confirmação",
  confirmed: "Confirmado pelo paciente",
  cancellation_requested: "Cancelamento solicitado",
  cancelled: "Cancelado",
  reschedule_requested: "Reagendamento pendente",
  reschedule_approved: "Reagendamento aprovado",
  reschedule_rejected: "Reagendamento recusado",
  professional_response_overdue: "Resposta profissional em atraso",
  in_progress: "Em atendimento",
  completed: "Realizado",
  closed: "Encerrado",
};

export const AppointmentDetailModal = ({
  children,
  appointment,
  open: controlledOpen,
  onOpenChange,
}: {
  children?: React.ReactNode;
  appointment: Appointment;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [activeView, setActiveView] = useState<"details" | "history">("details");
  const [patientData, setPatientData] = useState<any>(null);
  const [transactionData, setTransactionData] = useState<any>(null);
  const [packageData, setPackageData] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventCategory, setEventCategory] = useState("outro");
  const [eventLocation, setEventLocation] = useState("");
  const [sessionType, setSessionType] = useState("follow_up");
  const [modality, setModality] = useState<"presencial" | "online">("presencial");
  const [professionalAction, setProfessionalAction] = useState<ProfessionalAppointmentAction | null>(null);
  const loadedAppointmentKeyRef = useRef<string | null>(null);
  const historyButtonRef = useRef<HTMLButtonElement>(null);
  const historyBackButtonRef = useRef<HTMLButtonElement>(null);
  const shouldRestoreHistoryFocusRef = useRef(false);
  const invitationIdempotencyKeyRef = useRef<string | null>(null);

  const navigate = useNavigate();
  const sendEmail = useSendEmail();
  const updateAppointment = useUpdateAppointment();
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const shouldReduceMotion = useReducedMotion();
  const lifecycle = useAppointmentLifecycle(appointment.id, open);

  const metadata = useMemo(() => getAppointmentMetadata(appointment), [appointment]);
  const kind = metadata.kind || "session";
  const isSession = kind === "session";
  const isEvent = kind === "event";
  const displayTitle = getAppointmentDisplayTitle(appointment);
  const statusMeta = getAppointmentStatusMeta(
    normalizeAppointmentStatus(appointment.status, appointment.notes),
    appointment.notes,
  );
  const recurrence = metadata.recurrence;
  const lifecycleLabel = appointment.lifecycle_status
    ? LIFECYCLE_LABELS[appointment.lifecycle_status] || "Situação do agendamento atualizada"
    : null;
  const invitationBlockedByPendingRequest = Boolean(lifecycle.pendingRequest);

  const loadData = useCallback(async () => {
    setStep(1);
    const currentMetadata = getAppointmentMetadata(appointment);

    setNotes(getEditableAppointmentNotes(appointment));
    setStartTime(format(new Date(appointment.start_time), "HH:mm"));
    setEndTime(format(new Date(appointment.end_time), "HH:mm"));
    setEventTitle(currentMetadata.eventTitle || displayTitle || "");
    setEventCategory(currentMetadata.eventCategory || "outro");
    setEventLocation(currentMetadata.eventLocation || appointment.location || "");
    setSessionType(currentMetadata.sessionType || "follow_up");
    setModality(currentMetadata.modality === "online" || appointment.type === "online" ? "online" : "presencial");

    if (appointment.patient_id) {
      const { data: patient } = await supabase
        .from("patients")
        .select("email, phone, name")
        .eq("id", appointment.patient_id)
        .single();
      setPatientData(patient);
    } else {
      setPatientData(null);
    }

    const { data: financialEntry } = await supabase
      .from("financial_entries")
      .select("*")
      .eq("professional_id", appointment.user_id)
      .eq("appointment_id", appointment.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const transaction = financialEntry ? mapFinancialEntryToTransaction(financialEntry as any) : null;
    setTransactionData(transaction);

    const packageId = transaction?.package_id || currentMetadata.financial?.packageId;
    if (packageId) {
      const { data: pkg } = await supabase
        .from("patient_packages")
        .select("*")
        .eq("id", packageId)
        .maybeSingle();
      setPackageData(pkg);
    } else {
      setPackageData(null);
    }
  }, [appointment, displayTitle]);

  useEffect(() => {
    if (!open) {
      loadedAppointmentKeyRef.current = null;
      setActiveView("details");
      return;
    }

    const appointmentKey = `${appointment.id}:${appointment.updated_at || appointment.start_time}`;
    if (loadedAppointmentKeyRef.current === appointmentKey) return;
    loadedAppointmentKeyRef.current = appointmentKey;
    void loadData();
  }, [appointment.id, appointment.start_time, appointment.updated_at, loadData, open]);

  const openHistory = () => {
    shouldRestoreHistoryFocusRef.current = false;
    setActiveView("history");
  };

  const returnToDetails = () => {
    shouldRestoreHistoryFocusRef.current = true;
    setActiveView("details");
  };

  const restoreHistoryButtonFocus = () => {
    if (!shouldRestoreHistoryFocusRef.current) return;
    shouldRestoreHistoryFocusRef.current = false;
    historyButtonRef.current?.focus();
  };

  const buildTimeUpdates = () => {
    const datePart = format(new Date(appointment.start_time), "yyyy-MM-dd");
    const newStart = new Date(`${datePart}T${startTime}:00-03:00`);
    const newEnd = new Date(`${datePart}T${endTime}:00-03:00`);
    if (newEnd <= newStart) newEnd.setDate(newEnd.getDate() + 1);

    return {
      start_time: newStart.toISOString(),
      end_time: newEnd.toISOString(),
    };
  };

  const saveDetails = async () => {
    const timeUpdates = buildTimeUpdates();
    const nextMetadata: AppointmentMetadata = {
      ...metadata,
      kind,
      syncStatus: appointment.google_event_id ? "pending" : metadata.syncStatus || "pending",
    };

    let nextNotes = notes;
    let nextLocation = appointment.location;

    if (isEvent) {
      nextMetadata.eventTitle = eventTitle.trim() || "Compromisso";
      nextMetadata.eventCategory = eventCategory;
      nextMetadata.eventCategoryLabel = getEventCategoryLabel(eventCategory);
      nextMetadata.eventLocation = eventLocation.trim();
      nextMetadata.eventNotes = notes.trim();
      nextNotes = buildEventNotes(nextMetadata);
      nextLocation = eventLocation.trim() || null;
    } else {
      nextMetadata.sessionType = sessionType;
      nextMetadata.modality = modality;
      nextMetadata.durationMinutes = Math.max(
        1,
        Math.round((new Date(timeUpdates.end_time).getTime() - new Date(timeUpdates.start_time).getTime()) / 60000)
      );
      nextLocation = modality === "online" ? appointment.location || "Teleconsulta NeuroNex" : appointment.location || "Consultório";
    }

    await updateAppointment.mutateAsync({
      id: appointment.id,
      updates: {
        ...timeUpdates,
        type: isSession ? modality : appointment.type,
        notes: nextNotes,
        location: nextLocation,
        metadata: nextMetadata,
      },
    });

    toast.success("Agendamento atualizado.");
    setOpen(false);
  };

  const handleWhatsApp = () => {
    if (!patientData?.phone) {
      toast.error("Paciente sem telefone cadastrado.");
      return;
    }
    const phone = patientData.phone.replace(/\D/g, "");
    const message = encodeURIComponent(
      `Olá ${patientData.name}! Gostaria de lembrá-lo(a) da sua consulta agendada para ${format(new Date(appointment.start_time), "dd/MM")} às ${formatTimeBrazil(appointment.start_time)}.`
    );
    window.open(`https://wa.me/55${phone}?text=${message}`, "_blank");
  };

  const handleSendEmail = () => {
    if (lifecycle.isLoading) {
      toast.info("Aguarde a verificação das pendências deste agendamento.");
      return;
    }
    if (invitationBlockedByPendingRequest) {
      toast.error("Analise a solicitação de reagendamento antes de reenviar a confirmação.");
      return;
    }
    if (!patientData?.email) {
      toast.error("Paciente sem e-mail cadastrado.");
      return;
    }
    invitationIdempotencyKeyRef.current ||= crypto.randomUUID();
    sendEmail.mutate(
      {
        type: "reminder",
        params: {
          patientEmail: patientData.email,
          patientName: patientData.name,
          startTime: new Date(appointment.start_time).toISOString(),
          appointmentId: appointment.id,
          idempotencyKey: invitationIdempotencyKeyRef.current,
          action: "invite",
        },
      },
      {
        onSuccess: () => {
          invitationIdempotencyKeyRef.current = null;
          void lifecycle.refetch();
        },
        onError: () => {
          invitationIdempotencyKeyRef.current = null;
        },
      },
    );
  };

  const paymentStatus = useMemo(() => {
    if (!transactionData) return null;
    if (transactionData.status === "paid") return { label: "Pago", className: "text-emerald-500 bg-emerald-500/10" };
    const dueDate = new Date(transactionData.date);
    if (isBefore(dueDate, startOfDay(new Date()))) return { label: "Atrasado", className: "text-red-500 bg-red-500/10" };
    return { label: "Pendente", className: "text-amber-500 bg-amber-500/10" };
  }, [transactionData]);

  const methodIcon = (method?: string) => {
    switch (method) {
      case "pix":
        return <QrCode className="h-4 w-4" />;
      case "credit_card":
      case "debit_card":
        return <CreditCard className="h-4 w-4" />;
      default:
        return <Banknote className="h-4 w-4" />;
    }
  };

  return (
    <>
    <ResponsiveModal
      open={open}
      onOpenChange={setOpen}
      trigger={children}
      showCloseButton={false}
      className="appointment-detail-shell desktop-retina-modal desktop-retina-form flex w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-[30px] border border-border/55 bg-background/94 p-0 shadow-2xl backdrop-blur-3xl sm:max-w-[740px]"
      drawerClassName="max-h-[92dvh]"
      contentStyle={{ maxHeight: "min(760px, calc(100dvh - 1.5rem))" }}
    >
      <AnimatePresence initial={false} mode="wait">
        {activeView === "details" ? (
          <motion.div
            key="appointment-details"
            initial={shouldReduceMotion ? false : { opacity: 0, x: -48 }}
            animate={{ opacity: 1, x: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -48 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
            onAnimationComplete={restoreHistoryButtonFocus}
            className="flex min-h-0 flex-1 flex-col bg-transparent"
          >
        <div className="flex shrink-0 items-center justify-between border-b border-border/40 bg-background/48 px-5 pb-4 pt-5 backdrop-blur-2xl sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h2 className="text-xl font-bold text-foreground tracking-tight">
                {isSession ? "Ficha da Sessão" : "Ficha do Compromisso"}
              </h2>
              <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full border", statusMeta.bgClass, statusMeta.borderClass)}>
                <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusMeta.dotClass)} />
                <span className={cn("text-[9px] font-black uppercase tracking-[0.1em] whitespace-nowrap", statusMeta.textClass)}>
                  {statusMeta.label}
                </span>
              </div>
              {appointment.lifecycle_status && appointment.lifecycle_status !== "created" ? (
                <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.07] px-2.5 py-1 text-primary">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  <span className="whitespace-nowrap text-[9px] font-black uppercase tracking-[0.1em]">
                    {lifecycleLabel}
                  </span>
                </div>
              ) : null}
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {format(new Date(appointment.start_time), "dd 'de' MMMM, yyyy", { locale: ptBR })}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              ref={historyButtonRef}
              type="button"
              variant="ghost"
              size="icon"
              onClick={openHistory}
              className="appointment-liquid-control relative h-11 w-11 shrink-0 rounded-2xl border border-border/45 text-muted-foreground hover:text-foreground"
              aria-label="Abrir histórico do agendamento"
            >
              <Clock3 className="h-5 w-5" aria-hidden="true" />
              {lifecycle.events.length ? (
                <span
                  className="absolute -right-1 -top-1 min-w-5 rounded-full bg-primary px-1 text-[10px] font-black leading-5 text-primary-foreground"
                  aria-hidden="true"
                >
                  {lifecycle.events.length > 99 ? "99+" : lifecycle.events.length}
                </span>
              ) : null}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="appointment-liquid-control h-11 w-11 shrink-0 rounded-2xl border border-border/45 text-muted-foreground transition-colors hover:text-foreground active:scale-[0.98] motion-reduce:active:scale-100" aria-label="Fechar ficha da sessão">
              <X className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="patient-record-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4 [scrollbar-gutter:stable] sm:px-6">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="details"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
                transition={shouldReduceMotion ? { duration: 0 } : undefined}
                className="space-y-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="appointment-liquid-card flex flex-1 items-center justify-between rounded-[22px] border border-border/45 p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        {isSession ? <User className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground mb-0.5">
                          {isSession ? "Paciente" : "Compromisso"}
                        </p>
                        <h4 className="text-base font-bold text-foreground tracking-tight truncate">
                          {isSession ? patientData?.name || appointment.patient_name || "Paciente" : displayTitle}
                        </h4>
                      </div>
                    </div>
                    {isSession && (
                      <Button variant="ghost" size="icon" className="appointment-liquid-control h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground" onClick={() => navigate(`/pacientes/${appointment.patient_id}`)}>
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    )}
                  </div>

                  {isSession && (
                    <div className="flex shrink-0 gap-2 sm:flex-col">
                      <Button variant="outline" onClick={handleWhatsApp} className="appointment-liquid-control h-11 flex-1 rounded-[16px] border-border/45 px-3 hover:text-emerald-600 sm:w-11 sm:flex-none sm:px-0" aria-label="Enviar lembrete pelo WhatsApp">
                        <MessageCircle className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleSendEmail}
                        disabled={
                          sendEmail.isPending ||
                          lifecycle.isLoading ||
                          invitationBlockedByPendingRequest ||
                          ["cancelled", "in_progress", "completed", "closed"].includes(appointment.lifecycle_status || "")
                        }
                        className="appointment-liquid-control h-11 flex-1 rounded-[16px] border-border/45 px-3 hover:text-sky-600 sm:w-11 sm:flex-none sm:px-0"
                        aria-label="Enviar convite de confirmação por e-mail"
                        title={
                          invitationBlockedByPendingRequest
                            ? "Analise o reagendamento pendente antes de enviar uma nova confirmação"
                            : "Enviar convite de confirmação por e-mail"
                        }
                      >
                        {sendEmail.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Enviando convite" /> : <Mail className="h-4 w-4" aria-hidden="true" />}
                      </Button>
                    </div>
                  )}
                </div>

                {lifecycle.visibleRequest ? (
                  <AppointmentRescheduleReview
                    request={lifecycle.visibleRequest}
                    isReviewing={lifecycle.isReviewing}
                    onReview={lifecycle.reviewRequest}
                  />
                ) : null}

                {isEvent && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FieldShell label="Título" className="sm:col-span-2">
                      <input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} className={inputClassName} />
                    </FieldShell>
                    <FieldShell label="Categoria">
                      <select value={eventCategory} onChange={(e) => setEventCategory(e.target.value)} className={inputClassName}>
                        {EVENT_CATEGORIES.map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </select>
                    </FieldShell>
                    <FieldShell label="Local / Link">
                      <input value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} className={inputClassName} />
                    </FieldShell>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FieldShell label="Horário" icon={<Clock className="w-3.5 h-3.5" />}>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClassName} />
                      <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClassName} />
                    </div>
                  </FieldShell>

                  <FieldShell label={isSession ? "Sessão" : "Origem"} icon={isSession ? <Video className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}>
                    <div className="space-y-1">
                      <p className="text-lg font-bold text-foreground tracking-tight">
                        {isSession ? getSessionTypeLabel(metadata.sessionType) : metadata.origin === "google" ? "Google Agenda" : "NeuroNex"}
                      </p>
                      <p className="text-sm font-medium text-muted-foreground">
                        {isSession
                          ? `${appointment.type === "online" ? "Online" : "Presencial"} • ${getDurationString(appointment.start_time, appointment.end_time)}`
                          : metadata.syncStatus === "synced" ? "Sincronizado" : "Pendente de sync"}
                      </p>
                    </div>
                  </FieldShell>
                </div>

                {isSession && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FieldShell label="Tipo de sessão" icon={<FileText className="w-3.5 h-3.5" />}>
                      <Select value={sessionType} onValueChange={setSessionType}>
                        <SelectTrigger className={inputClassName}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SESSION_TYPES.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FieldShell>

                    <FieldShell label="Modalidade" icon={<Video className="w-3.5 h-3.5" />}>
                      <Select value={modality} onValueChange={(value) => setModality(value as "presencial" | "online")}>
                        <SelectTrigger className={inputClassName}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MODALITY_OPTIONS.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FieldShell>
                  </div>
                )}

                <FieldShell label="Recorrência" icon={<Repeat className="w-3.5 h-3.5" />}>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="appointment-liquid-control rounded-[16px] border border-border/40 px-4 py-3">
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">Frequência</p>
                      <p className="mt-1 text-sm font-bold text-foreground">
                        {recurrence?.enabled ? RECURRENCE_LABELS[recurrence.frequency || "weekly"] || recurrence.frequency : "Sem recorrência"}
                      </p>
                    </div>
                    <div className="appointment-liquid-control rounded-[16px] border border-border/40 px-4 py-3">
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">Ocorrências</p>
                      <p className="mt-1 text-sm font-bold text-foreground">{recurrence?.enabled ? recurrence.count || 1 : 1}</p>
                    </div>
                    <div className="appointment-liquid-control rounded-[16px] border border-border/40 px-4 py-3">
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">Duração</p>
                      <p className="mt-1 text-sm font-bold text-foreground">{getDurationString(appointment.start_time, appointment.end_time)}</p>
                    </div>
                  </div>
                </FieldShell>

                <FieldShell label="Status do agendamento" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
                  <div className="appointment-liquid-control rounded-[16px] border border-border/40 px-4 py-3">
                    <p className="text-sm font-bold text-foreground">{statusMeta.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Presença, conclusão e cancelamento devem ser registrados pelas ações próprias de cada fluxo.
                    </p>
                  </div>
                </FieldShell>

                {isSession && transactionData && (
                  <div className="appointment-liquid-card rounded-[22px] border border-border/45 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground flex items-center gap-2 mb-2">
                          <Banknote className="w-3.5 h-3.5" /> Cobrança
                        </span>
                        <p className="text-2xl font-light text-foreground tracking-tighter tabular-nums">
                          R$ <span className="font-bold">{Number(transactionData.amount || 0).toFixed(2).replace(".", ",")}</span>
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <div className="flex items-center gap-2 text-foreground font-medium text-sm bg-background/50 px-3 py-1.5 rounded-full border border-border/10">
                          {methodIcon(transactionData.payment_method)}
                          <span className="capitalize">{transactionData.payment_method?.replace("_", " ") || "Não definido"}</span>
                        </div>
                        {paymentStatus && (
                          <span className={cn("px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest", paymentStatus.className)}>
                            {paymentStatus.label}
                          </span>
                        )}
                        {packageData && (
                          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 text-[10px] font-black uppercase tracking-widest">
                            <Briefcase className="h-3 w-3" /> Via Pacote
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-2 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" /> {isSession ? "Notas da Sessão" : "Notas Internas"}
                  </label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="appointment-liquid-control min-h-[96px] resize-none rounded-[18px] border-border/45 px-4 py-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground/50 focus:border-ring/35 focus:ring-2 focus:ring-ring/15"
                    placeholder={isSession ? "Adicione observações da sessão..." : "Adicione notas internas do compromisso..."}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={shouldReduceMotion ? false : { scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={shouldReduceMotion ? { duration: 0 } : undefined}
                className="flex flex-col items-center text-center space-y-4 py-8"
              >
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle className="h-10 w-10 text-emerald-500" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-foreground">Atualizado</h2>
                  <p className="text-muted-foreground text-sm">As informações foram salvas e sincronizadas quando aplicável.</p>
                </div>
                <Button onClick={() => setOpen(false)} className="rounded-full px-6 h-10 bg-primary text-primary-foreground font-bold shadow-lg mt-3">Fechar Ficha</Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {step === 1 && (
          <div className="flex shrink-0 flex-col gap-3 border-t border-border/40 bg-background/54 p-4 backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" className="appointment-liquid-control min-h-11 rounded-xl border border-border/45 px-4 text-xs font-bold text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="mr-2 h-4 w-4" aria-hidden="true" />
                  Ações
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="desktop-retina-modal w-72 rounded-[20px] border-border/55 bg-popover/96 p-2 shadow-xl">
                <DropdownMenuItem
                  onSelect={() => setProfessionalAction("archive")}
                  className="min-h-11 rounded-[14px] px-3 text-sm font-medium"
                >
                  <Archive className="mr-3 h-4 w-4 text-amber-500" aria-hidden="true" />
                  Remover da agenda
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/45" />
                <DropdownMenuItem
                  onSelect={() => setProfessionalAction("cancel")}
                  className="min-h-11 rounded-[14px] px-3 text-sm font-medium text-rose-600 focus:bg-rose-500/10 focus:text-rose-600 dark:text-rose-300"
                >
                  <XCircle className="mr-3 h-4 w-4" aria-hidden="true" />
                  Cancelar agendamento
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={updateAppointment.isPending}
              onClick={() => setOpen(false)}
              className="appointment-liquid-control min-h-11 w-full rounded-xl border-border/45 px-5 font-bold sm:w-auto"
            >
              Descartar alterações
            </Button>

            <Button
              onClick={() => void saveDetails()}
              disabled={updateAppointment.isPending}
              className="min-h-11 w-full rounded-xl bg-foreground px-6 font-bold tracking-wide text-background shadow-sm transition-transform active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 sm:w-auto"
            >
              {updateAppointment.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Salvar e Fechar"}
            </Button>
            </div>
          </div>
        )}
          </motion.div>
        ) : (
          <motion.div
            key="appointment-history"
            initial={shouldReduceMotion ? false : { opacity: 0, x: 48 }}
            animate={{ opacity: 1, x: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 48 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
            onAnimationComplete={() => historyBackButtonRef.current?.focus()}
            className="flex min-h-0 flex-1 flex-col bg-transparent"
          >
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border/40 bg-background/48 px-5 py-4 backdrop-blur-2xl sm:px-6">
              <div className="flex min-w-0 items-start gap-3">
                <Button
                  ref={historyBackButtonRef}
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={returnToDetails}
                  className="appointment-liquid-control h-11 w-11 shrink-0 rounded-2xl border border-border/45 text-muted-foreground hover:text-foreground"
                  aria-label="Voltar aos detalhes do agendamento"
                >
                  <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                </Button>
                <div className="min-w-0 pt-0.5">
                  <h2 className="text-xl font-bold tracking-tight text-foreground">
                    Histórico do agendamento
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Eventos mais recentes primeiro.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                className="appointment-liquid-control h-11 w-11 shrink-0 rounded-2xl border border-border/45 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Fechar ficha da sessão"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </header>
            <AppointmentTimelinePanel
              events={lifecycle.events}
              isLoading={lifecycle.isLoading}
              error={lifecycle.error instanceof Error ? lifecycle.error : null}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </ResponsiveModal>
    <AppointmentProfessionalActionDialog
      appointmentId={appointment.id}
      patientName={patientData?.name || appointment.patient_name || displayTitle}
      patientEmail={patientData?.email}
      startTime={appointment.start_time}
      action={professionalAction}
      open={Boolean(professionalAction)}
      onOpenChange={(nextOpen) => { if (!nextOpen) setProfessionalAction(null); }}
      onCompleted={() => setOpen(false)}
    />
    </>
  );
};

const inputClassName =
  "appointment-liquid-control h-10 w-full rounded-xl border border-border/40 px-3 text-sm font-bold text-foreground outline-none transition-colors focus:border-ring/35 focus:ring-2 focus:ring-ring/15";

const FieldShell = ({
  label,
  icon,
  children,
  className,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("appointment-liquid-card space-y-3 rounded-[22px] border border-border/45 p-4", className)}>
    <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground flex items-center gap-2">
      {icon}
      {label}
    </span>
    {children}
  </div>
);
