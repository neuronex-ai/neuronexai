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
import {
  useAgendaV2,
  type AgendaPlanSmartFitCandidate,
} from "@/hooks/use-agenda-v2";
import { useUpdateAppointment } from "@/hooks/use-update-appointment";
import type { ProfessionalAppointmentAction } from "@/hooks/use-appointment-professional-action";
import { mapFinancialEntryToTransaction } from "@/hooks/use-financial-entries";
import {
  EdgeFunctionInvocationError,
  normalizeEdgeFunctionError,
} from "@/lib/invoke-edge-function";
import {
  buildEventNotes,
  getAppointmentMetadata,
  getEditableAppointmentNotes,
  getEventCategoryLabel,
  getSessionTypeLabel,
  normalizeAppointmentSyncStatus,
  type AppointmentMetadata,
} from "@/lib/appointment-metadata";
import {
  getAppointmentDetailStatusLabel,
  getAppointmentOriginLabel,
  getAppointmentRecurrencePosition,
} from "@/lib/appointment-detail-presentation";
import { getAppointmentDisplayTitle, getDurationString } from "@/lib/appointment-utils";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
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
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  Loader2,
  ListPlus,
  Mail,
  MessageCircle,
  MoreHorizontal,
  QrCode,
  Repeat,
  ShieldCheck,
  TimerReset,
  User,
  Video,
  WandSparkles,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getAppointmentPlanErrorMessage } from "@/lib/appointment-action-plan-errors";

type AppointmentDetailReview = {
  updates: Partial<Appointment>;
  changes: Array<{
    label: string;
    before: string;
    after: string;
  }>;
  queuesGoogleSync: boolean;
  originChannel?: "professional_app" | "synapse_text";
};

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
  const [smartFitCandidates, setSmartFitCandidates] = useState<AgendaPlanSmartFitCandidate[]>([]);
  const [allowShorterSmartFit, setAllowShorterSmartFit] = useState(false);
  const [detailReview, setDetailReview] = useState<AppointmentDetailReview | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isPreparingWhatsappInvite, setIsPreparingWhatsappInvite] = useState(false);
  const loadedAppointmentKeyRef = useRef<string | null>(null);
  const historyButtonRef = useRef<HTMLButtonElement>(null);
  const historyBackButtonRef = useRef<HTMLButtonElement>(null);
  const shouldRestoreHistoryFocusRef = useRef(false);
  const invitationIdempotencyKeyRef = useRef<string | null>(null);
  const whatsappInvitationIdempotencyKeyRef = useRef<string | null>(null);

  const navigate = useNavigate();
  const sendEmail = useSendEmail();
  const updateAppointment = useUpdateAppointment();
  const {
    suggestAppointmentSmartFit,
    isSuggestingAppointmentSmartFit,
  } = useAgendaV2();
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const shouldReduceMotion = useReducedMotion();
  const lifecycle = useAppointmentLifecycle(appointment.id, open);

  const metadata = useMemo(() => getAppointmentMetadata(appointment), [appointment]);
  const kind = metadata.kind || "session";
  const isSession = kind === "session";
  const isEvent = kind === "event";
  const displayTitle = getAppointmentDisplayTitle(appointment);
  const recurrence = metadata.recurrence;
  const detailStatusLabel = getAppointmentDetailStatusLabel(appointment);
  const originLabel = getAppointmentOriginLabel(appointment);
  const recurrencePosition = getAppointmentRecurrencePosition(appointment);
  const invitationBlockedByPendingRequest = Boolean(lifecycle.pendingRequest);
  const invitationUnavailable = lifecycle.isLoading
    || invitationBlockedByPendingRequest
    || ["cancelled", "in_progress", "completed", "closed"].includes(
      appointment.lifecycle_status || "",
    );
  const smartFitAvailable = new Date(appointment.end_time) > new Date()
    && !["cancelled", "in_progress", "completed", "closed"].includes(appointment.lifecycle_status || "");

  const loadData = useCallback(async () => {
    setStep(1);
    setDetailReview(null);
    setDetailError(null);
    const currentMetadata = getAppointmentMetadata(appointment);

    setNotes(getEditableAppointmentNotes(appointment));
    setStartTime(format(new Date(appointment.start_time), "HH:mm"));
    setEndTime(format(new Date(appointment.end_time), "HH:mm"));
    setEventTitle(currentMetadata.eventTitle || displayTitle || "");
    setEventCategory(currentMetadata.eventCategory || "outro");
    setEventLocation(currentMetadata.eventLocation || appointment.location || "");
    setSessionType(currentMetadata.sessionType || "follow_up");
    setModality(currentMetadata.modality === "online" || appointment.type === "online" ? "online" : "presencial");
    setSmartFitCandidates([]);
    setAllowShorterSmartFit(false);

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
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
      throw new Error("Informe os horários de início e fim.");
    }
    const sourceDate = new Date(appointment.start_time);
    const [startHours, startMinutes] = startTime.split(":").map(Number);
    const [endHours, endMinutes] = endTime.split(":").map(Number);
    if (
      startHours > 23
      || endHours > 23
      || startMinutes > 59
      || endMinutes > 59
    ) {
      throw new Error("Revise os horários informados.");
    }
    const newStart = new Date(sourceDate);
    const newEnd = new Date(sourceDate);
    newStart.setHours(startHours, startMinutes, 0, 0);
    newEnd.setHours(endHours, endMinutes, 0, 0);
    if (newEnd <= newStart) {
      throw new Error("O horário final precisa ser posterior ao início no mesmo dia.");
    }

    return {
      start_time: newStart.toISOString(),
      end_time: newEnd.toISOString(),
    };
  };

  const buildDetailReview = (): AppointmentDetailReview | null => {
    const timeUpdates = buildTimeUpdates();
    let nextNotes = notes;
    let nextLocation = appointment.location;
    const nextType = isSession ? modality : appointment.type;

    if (isEvent) {
      nextNotes = buildEventNotes({
        ...metadata,
        kind,
        eventTitle: eventTitle.trim() || "Compromisso",
        eventCategory,
        eventCategoryLabel: getEventCategoryLabel(eventCategory),
        eventLocation: eventLocation.trim(),
        eventNotes: notes.trim(),
      });
      nextLocation = eventLocation.trim() || null;
    } else if (modality !== (metadata.modality === "online" || appointment.type === "online" ? "online" : "presencial")) {
      nextLocation = modality === "online" ? appointment.location || "Teleconsulta NeuroNex" : appointment.location || "Consultório";
    }

    const startChanged = new Date(timeUpdates.start_time).getTime() !== new Date(appointment.start_time).getTime();
    const endChanged = new Date(timeUpdates.end_time).getTime() !== new Date(appointment.end_time).getTime();
    const typeChanged = nextType !== appointment.type;
    const locationChanged = (nextLocation || "").trim() !== (appointment.location || "").trim();
    const notesChanged = nextNotes !== (appointment.notes || "");
    const editableNotesChanged = notes.trim() !== getEditableAppointmentNotes(appointment).trim();
    const eventMetadataChanged = isEvent && (
      (eventTitle.trim() || "Compromisso") !== (metadata.eventTitle || displayTitle || "Compromisso")
      || eventCategory !== (metadata.eventCategory || "outro")
      || eventLocation.trim() !== (metadata.eventLocation || appointment.location || "").trim()
      || notes.trim() !== (metadata.eventNotes || getEditableAppointmentNotes(appointment)).trim()
    );
    const currentModality = metadata.modality === "online" || appointment.type === "online" ? "online" : "presencial";
    const sessionMetadataChanged = isSession && (
      sessionType !== (metadata.sessionType || "follow_up")
      || modality !== currentModality
    );
    const hasAnyChange = startChanged
      || endChanged
      || typeChanged
      || locationChanged
      || notesChanged
      || eventMetadataChanged
      || sessionMetadataChanged;

    if (!hasAnyChange) {
      return null;
    }

    if (
      (startChanged || endChanged)
      && new Date(timeUpdates.start_time).getTime() <= Date.now()
    ) {
      throw new Error("Escolha um horário futuro para reagendar.");
    }

    const currentSyncStatus = metadata.syncStatus === "pending_professional_review"
      ? metadata.syncStatus
      : normalizeAppointmentSyncStatus(metadata.syncStatus, {
        googleEventId: appointment.google_event_id,
        origin: metadata.origin,
      });
    const nextMetadata: AppointmentMetadata = {
      ...metadata,
      kind,
      syncStatus: appointment.google_event_id ? "queued" : currentSyncStatus,
    };

    if (isEvent) {
      nextMetadata.eventTitle = eventTitle.trim() || "Compromisso";
      nextMetadata.eventCategory = eventCategory;
      nextMetadata.eventCategoryLabel = getEventCategoryLabel(eventCategory);
      nextMetadata.eventLocation = eventLocation.trim();
      nextMetadata.eventNotes = notes.trim();
    } else {
      nextMetadata.sessionType = sessionType;
      nextMetadata.modality = modality;
      nextMetadata.durationMinutes = Math.max(
        1,
        Math.round((new Date(timeUpdates.end_time).getTime() - new Date(timeUpdates.start_time).getTime()) / 60000),
      );
    }

    const updates: Partial<Appointment> = {};
    if (startChanged || endChanged) Object.assign(updates, timeUpdates);
    if (typeChanged) updates.type = nextType;
    if (locationChanged) updates.location = nextLocation;
    if (notesChanged) updates.notes = nextNotes;
    if (eventMetadataChanged || sessionMetadataChanged || startChanged || endChanged) {
      updates.metadata = nextMetadata;
    }

    const changes: AppointmentDetailReview["changes"] = [];
    if (startChanged || endChanged) {
      changes.push({
        label: "Horário",
        before: `${format(new Date(appointment.start_time), "HH:mm")}–${format(new Date(appointment.end_time), "HH:mm")}`,
        after: `${startTime}–${endTime}`,
      });
    }
    if (isEvent && eventTitle.trim() !== (metadata.eventTitle || displayTitle || "").trim()) {
      changes.push({
        label: "Título",
        before: metadata.eventTitle || displayTitle || "Compromisso",
        after: eventTitle.trim() || "Compromisso",
      });
    }
    if (isEvent && eventCategory !== (metadata.eventCategory || "outro")) {
      changes.push({
        label: "Categoria",
        before: getEventCategoryLabel(metadata.eventCategory || "outro"),
        after: getEventCategoryLabel(eventCategory),
      });
    }
    if (isSession && sessionType !== (metadata.sessionType || "follow_up")) {
      changes.push({
        label: "Tipo de sessão",
        before: getSessionTypeLabel(metadata.sessionType || "follow_up"),
        after: getSessionTypeLabel(sessionType),
      });
    }
    if (isSession && modality !== currentModality) {
      changes.push({
        label: "Modalidade",
        before: currentModality === "online" ? "Online" : "Presencial",
        after: modality === "online" ? "Online" : "Presencial",
      });
    }
    if (locationChanged) {
      changes.push({
        label: "Local",
        before: appointment.location || "Não informado",
        after: nextLocation || "Não informado",
      });
    }
    if (editableNotesChanged) {
      changes.push({
        label: "Notas",
        before: getEditableAppointmentNotes(appointment).trim() ? "Com conteúdo" : "Sem notas",
        after: notes.trim() ? "Conteúdo atualizado" : "Sem notas",
      });
    }

    return {
      updates,
      changes,
      queuesGoogleSync: Boolean(appointment.google_event_id),
    };
  };

  const reviewDetails = () => {
    setDetailError(null);
    try {
      const review = buildDetailReview();
      if (!review) {
        setDetailError("Nenhuma alteração foi feita.");
        return;
      }
      setDetailReview(review);
      setStep(2);
    } catch (error) {
      setDetailReview(null);
      setDetailError(
        error instanceof Error
          ? error.message
          : "Revise as alterações antes de continuar.",
      );
    }
  };

  const saveDetails = async () => {
    if (!detailReview) {
      reviewDetails();
      return;
    }
    setDetailError(null);
    try {
      await updateAppointment.mutateAsync({
        id: appointment.id,
        updates: detailReview.updates,
        originChannel: detailReview.originChannel,
        suppressErrorToast: true,
      });
      toast.success("Agendamento atualizado.");
      setOpen(false);
    } catch (error) {
      setDetailError(getAppointmentPlanErrorMessage(error, "reschedule"));
      setStep(1);
    }
  };

  const loadSmartFitCandidates = async () => {
    setSmartFitCandidates([]);
    try {
      const result = await suggestAppointmentSmartFit({
        appointmentId: appointment.id,
        allowShorter: allowShorterSmartFit,
        minimumDurationMinutes: 30,
      });
      setSmartFitCandidates(result.candidates);
      if (!result.candidates.length) {
        setDetailError("Não encontrei um encaixe compatível nos próximos 14 dias.");
      }
    } catch (error) {
      setDetailError(getAppointmentPlanErrorMessage(error, "reschedule"));
    }
  };

  const applySmartFitCandidate = async (candidate: AgendaPlanSmartFitCandidate) => {
    const nextMetadata: AppointmentMetadata = {
      ...metadata,
      durationMinutes: candidate.durationMinutes,
    };
    setDetailError(null);
    setDetailReview({
      updates: {
        start_time: candidate.startTime,
        end_time: candidate.endTime,
        metadata: nextMetadata,
      },
      changes: [{
        label: "Reencaixe do Synapse",
        before: format(new Date(appointment.start_time), "dd/MM/yyyy · HH:mm"),
        after: `${format(new Date(candidate.startTime), "dd/MM/yyyy · HH:mm")} · ${candidate.durationMinutes} min`,
      }],
      queuesGoogleSync: Boolean(appointment.google_event_id),
      originChannel: "synapse_text",
    });
    setStep(2);
  };

  const handleWhatsApp = async () => {
    setDetailError(null);
    if (lifecycle.isLoading) {
      setDetailError("Aguarde um instante enquanto verificamos este agendamento.");
      return;
    }
    if (invitationBlockedByPendingRequest) {
      setDetailError("Analise o pedido de reagendamento antes de enviar uma nova confirmação.");
      return;
    }
    if (!patientData?.phone) {
      setDetailError("Adicione o WhatsApp do paciente no cadastro para enviar o convite.");
      return;
    }
    const rawPhone = String(patientData.phone).replace(/\D/g, "");
    const phone = rawPhone.startsWith("55") ? rawPhone : `55${rawPhone}`;
    whatsappInvitationIdempotencyKeyRef.current ||= crypto.randomUUID();
    const invitationTab = window.open("about:blank", "_blank");
    if (invitationTab) invitationTab.opener = null;
    setIsPreparingWhatsappInvite(true);
    try {
      const { data, error } = await supabase.functions.invoke("prepare-appointment-whatsapp-invite", {
        body: {
          appointmentId: appointment.id,
          idempotencyKey: whatsappInvitationIdempotencyKeyRef.current,
        },
      });
      if (error) {
        throw await normalizeEdgeFunctionError(
          error,
          "Não foi possível preparar o convite pelo WhatsApp.",
        );
      }
      const confirmationUrl = typeof data?.confirmationUrl === "string"
        ? data.confirmationUrl
        : "";
      const whatsappMessage = typeof data?.whatsappMessage === "string"
        ? data.whatsappMessage
        : "";
      if (!confirmationUrl || !whatsappMessage) {
        throw new Error("Não foi possível gerar o link de confirmação agora.");
      }
      whatsappInvitationIdempotencyKeyRef.current = null;
      const whatsappUrl =
        `https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage)}`;
      if (invitationTab) {
        invitationTab.location.replace(whatsappUrl);
      } else {
        setDetailError(
          "O convite ficou pronto, mas o navegador bloqueou a nova aba. Libere pop-ups e tente novamente.",
        );
      }
      await lifecycle.refetch();
      toast.success("Convite pronto para enviar no WhatsApp.");
    } catch (error) {
      invitationTab?.close();
      whatsappInvitationIdempotencyKeyRef.current = null;
      setDetailError(getUserFacingErrorMessage(error, "save"));
    } finally {
      setIsPreparingWhatsappInvite(false);
    }
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
        onError: (error) => {
          if (!(error instanceof EdgeFunctionInvocationError) || !error.retryWithSameRequest) {
            invitationIdempotencyKeyRef.current = null;
          }
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
  const neurofinanceChargeId = String(
    transactionData?.metadata?.neurofinance_charge_id
    || appointment.charge_id
    || "",
  ).trim() || null;

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
      className="agenda-modal-surface agenda-viewport-modal appointment-detail-shell desktop-retina-modal desktop-retina-form flex w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-[30px] border p-0 sm:max-w-[740px]"
      drawerClassName="max-h-[92dvh]"
      contentStyle={{ maxHeight: "min(760px, calc(100dvh - 1.5rem))" }}
    >
      <AnimatePresence initial={false} mode="wait">
        {activeView === "details" ? (
          <motion.div
            key="appointment-details"
            initial={shouldReduceMotion ? false : { opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -14 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onAnimationComplete={restoreHistoryButtonFocus}
            className="flex min-h-0 flex-1 flex-col bg-transparent"
          >
        <div className="agenda-modal-header flex shrink-0 items-center justify-between border-b px-5 pb-4 pt-5 backdrop-blur-2xl sm:px-6">
          <div className="min-w-0 flex-1 pr-2">
            <div className="mb-1">
              <h2 className="text-xl font-bold text-foreground tracking-tight">
                {isSession ? "Detalhes da sessão" : "Detalhes do evento"}
              </h2>
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
              onClick={openHistory}
              className="group appointment-liquid-control h-11 max-w-[180px] shrink-0 rounded-full border border-border/45 px-3 text-xs font-black text-foreground"
              aria-label={`${detailStatusLabel}. Abrir histórico do agendamento.`}
            >
              <span className="truncate">{detailStatusLabel}</span>
              <ChevronRight
                className="ml-1 h-3.5 w-3.5 shrink-0 -translate-x-1 opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0 group-hover:opacity-70 group-focus-visible:translate-x-0 group-focus-visible:opacity-70 motion-reduce:transition-none"
                aria-hidden="true"
              />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="appointment-liquid-control h-11 w-11 shrink-0 rounded-2xl border border-border/45 text-muted-foreground hover:text-foreground"
                  aria-label="Mais ações"
                >
                  <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="agenda-menu-surface desktop-retina-modal w-80 rounded-[20px] p-2 shadow-xl"
              >
                {isSession ? (
                  <>
                    <DropdownMenuItem
                      onSelect={handleSendEmail}
                      disabled={sendEmail.isPending || invitationUnavailable}
                      className="min-h-11 rounded-[14px] px-3 text-sm font-medium"
                    >
                      {sendEmail.isPending
                        ? <Loader2 className="mr-3 h-4 w-4 animate-spin motion-reduce:animate-none" aria-label="Preparando convite" />
                        : <Mail className="mr-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                      Convite de confirmação por e-mail
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => void handleWhatsApp()}
                      disabled={isPreparingWhatsappInvite || invitationUnavailable}
                      className="min-h-11 rounded-[14px] px-3 text-sm font-medium"
                    >
                      {isPreparingWhatsappInvite
                        ? <Loader2 className="mr-3 h-4 w-4 animate-spin motion-reduce:animate-none" aria-label="Preparando convite" />
                        : <MessageCircle className="mr-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                      Convite de confirmação por WhatsApp
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-border/45" />
                  </>
                ) : null}
                <DropdownMenuItem
                  onSelect={() => setProfessionalAction("archive")}
                  className="min-h-11 rounded-[14px] px-3 text-sm font-medium"
                >
                  <Archive className="mr-3 h-4 w-4 text-amber-500" aria-hidden="true" />
                  Arquivar {isSession ? "agendamento" : "evento"}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/45" />
                <DropdownMenuItem
                  onSelect={() => setProfessionalAction("cancel")}
                  className="min-h-11 rounded-[14px] px-3 text-sm font-medium text-rose-600 focus:bg-rose-500/10 focus:text-rose-600 dark:text-rose-300"
                >
                  <XCircle className="mr-3 h-4 w-4" aria-hidden="true" />
                  Cancelar {isSession ? "agendamento" : "evento"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="appointment-liquid-control h-11 w-11 shrink-0 rounded-2xl border border-border/45 text-muted-foreground transition-colors hover:text-foreground active:scale-[0.98] motion-reduce:active:scale-100" aria-label={`Fechar detalhes ${isSession ? "da sessão" : "do evento"}`}>
              <X className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="patient-record-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4 [scrollbar-gutter:stable] sm:px-6">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="details"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={shouldReduceMotion ? { duration: 0 } : undefined}
                className="space-y-4"
              >
                {detailError ? (
                  <div
                    className="synapse-liquid-toolbar flex items-start gap-3 rounded-[18px] p-3"
                    role="status"
                    aria-live="polite"
                  >
                    <span className="synapse-liquid-control flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]">
                      <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </span>
                    <p className="pt-2 text-xs font-semibold leading-relaxed text-foreground">
                      {detailError}
                    </p>
                  </div>
                ) : null}
                <div className="appointment-liquid-card flex items-center justify-between rounded-[22px] border border-border/45 p-4">
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="agenda-tactile appointment-liquid-control h-11 w-11 rounded-xl text-muted-foreground hover:text-foreground"
                        onClick={() => navigate(`/pacientes/${appointment.patient_id}`)}
                        aria-label={`Abrir prontuário de ${patientData?.name || appointment.patient_name || "paciente"}`}
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    )}
                </div>

                {lifecycle.visibleRequest ? (
                  <AppointmentRescheduleReview
                    request={lifecycle.visibleRequest}
                    isReviewing={lifecycle.isReviewing}
                    onReview={lifecycle.reviewRequest}
                  />
                ) : null}

                {smartFitAvailable ? (
                  <section className="agenda-liquid-surface rounded-[22px] border p-4" aria-labelledby={`smart-fit-${appointment.id}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="synapse-chat-glass flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border">
                          <WandSparkles className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <h3 id={`smart-fit-${appointment.id}`} className="text-sm font-black text-foreground">
                            Reencaixe inteligente
                          </h3>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            O Synapse prioriza a duração completa e respeita grade, bloqueios e outros compromissos.
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void loadSmartFitCandidates()}
                        disabled={isSuggestingAppointmentSmartFit || updateAppointment.isPending}
                        className="notification-liquid-control min-h-11 shrink-0 rounded-full border-border/45 px-4 text-xs font-black"
                      >
                        {isSuggestingAppointmentSmartFit
                          ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />
                          : <WandSparkles className="mr-2 h-4 w-4" />}
                        Sugerir horários
                      </Button>
                    </div>

                    <button
                      type="button"
                      aria-pressed={allowShorterSmartFit}
                      onClick={() => {
                        setAllowShorterSmartFit((current) => !current);
                        setSmartFitCandidates([]);
                      }}
                      className={cn(
                        "synapse-chat-glass mt-3 flex min-h-11 w-full items-center justify-between rounded-[15px] border px-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        allowShorterSmartFit && "synapse-liquid-tab-active",
                      )}
                    >
                      <span className="flex items-center gap-2 text-xs font-bold text-foreground">
                        <TimerReset className="h-3.5 w-3.5" aria-hidden="true" />
                        Permitir redução somente desta sessão
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">
                        mínimo 30 min
                      </span>
                    </button>

                    {smartFitCandidates.length ? (
                      <div className="mt-3 grid gap-2" aria-live="polite">
                        {smartFitCandidates.map((candidate) => (
                          <button
                            key={`${candidate.startTime}-${candidate.durationMinutes}`}
                            type="button"
                            disabled={updateAppointment.isPending}
                            onClick={() => void applySmartFitCandidate(candidate)}
                            className="agenda-choice-card synapse-chat-glass flex min-h-12 items-center justify-between gap-3 rounded-[16px] border px-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-black text-foreground">
                                {format(new Date(candidate.startTime), "EEE, dd 'de' MMM · HH:mm", { locale: ptBR })}
                              </span>
                              <span className="mt-0.5 block text-[10px] font-semibold text-muted-foreground">
                                {candidate.keepsFullDuration ? "Duração original preservada" : "Exceção personalizada"}
                              </span>
                            </span>
                            <span className="shrink-0 rounded-full bg-foreground/[0.07] px-2.5 py-1 text-[10px] font-black text-foreground">
                              {candidate.durationMinutes} min
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </section>
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

                  <FieldShell label={isSession ? "Sessão" : "Evento"} icon={isSession ? <Video className="w-3.5 h-3.5" /> : <CalendarDays className="w-3.5 h-3.5" />}>
                    <div className="space-y-1">
                      <p className="text-lg font-bold text-foreground tracking-tight">
                        {isSession
                          ? getSessionTypeLabel(metadata.sessionType)
                          : getEventCategoryLabel(metadata.eventCategory || eventCategory)}
                      </p>
                      <p className="text-sm font-medium text-muted-foreground">
                        {isSession
                          ? `${appointment.type === "online" ? "Online" : "Presencial"} • ${getDurationString(appointment.start_time, appointment.end_time)}`
                          : getDurationString(appointment.start_time, appointment.end_time)}
                      </p>
                    </div>
                  </FieldShell>
                </div>

                <div className={cn("grid gap-3", recurrencePosition && "sm:grid-cols-2")}>
                  <CompactDetailCard
                    label="Origem"
                    value={originLabel}
                    icon={
                      originLabel === "Lista de espera"
                        ? <ListPlus className="h-4 w-4" aria-hidden="true" />
                        : originLabel === "Google Agenda"
                          ? <CalendarDays className="h-4 w-4" aria-hidden="true" />
                          : <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    }
                  />
                  {recurrencePosition ? (
                    <CompactDetailCard
                      label="Recorrência"
                      value={recurrencePosition.label}
                      ariaLabel={`Ocorrência ${recurrencePosition.accessibleLabel}`}
                      detail={
                        recurrence?.frequency
                          ? RECURRENCE_LABELS[recurrence.frequency] || "Série recorrente"
                          : "Série recorrente"
                      }
                      icon={<Repeat className="h-4 w-4" aria-hidden="true" />}
                    />
                  ) : null}
                </div>

                {isSession && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FieldShell label="Tipo de sessão" icon={<FileText className="w-3.5 h-3.5" />}>
                      <Select value={sessionType} onValueChange={setSessionType}>
                        <SelectTrigger className={inputClassName}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="agenda-menu-surface">
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
                        <SelectContent className="agenda-menu-surface">
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

                {isSession && transactionData && (
                  <div className="appointment-liquid-card rounded-[22px] border border-border/45 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground flex items-center gap-2 mb-2">
                          <Banknote className="w-3.5 h-3.5" />
                          {neurofinanceChargeId ? "Cobrança NeuroFinance" : "Cobrança"}
                        </span>
                        <p className="text-2xl font-light text-foreground tracking-tighter tabular-nums">
                          R$ <span className="font-bold">{Number(transactionData.amount || 0).toFixed(2).replace(".", ",")}</span>
                        </p>
                        {recurrencePosition ? (
                          <p className="mt-1 text-[11px] font-bold text-muted-foreground">
                            Recorrência {recurrencePosition.label}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex flex-wrap justify-end gap-2">
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
                        {neurofinanceChargeId ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              navigate(`/financeiro?view=cobrancas-historia&chargeId=${encodeURIComponent(neurofinanceChargeId)}`);
                              setOpen(false);
                            }}
                            className="appointment-liquid-control h-11 w-11 shrink-0 rounded-2xl border border-border/45 text-muted-foreground hover:text-foreground"
                            aria-label="Abrir detalhes desta cobrança no NeuroFinance"
                          >
                            <ChevronRight className="h-5 w-5" aria-hidden="true" />
                          </Button>
                        ) : null}
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
                key="review"
                initial={shouldReduceMotion ? false : { opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={shouldReduceMotion ? { duration: 0 } : undefined}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                    Antes de confirmar
                  </p>
                  <h2 className="text-xl font-black tracking-tight text-foreground">
                    Revise as alterações
                  </h2>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Apenas os itens abaixo serão atualizados.
                  </p>
                </div>

                <ol className="grid gap-2">
                  {(detailReview?.changes || []).map((change, index) => (
                    <li
                      key={`${change.label}-${index}`}
                      className="synapse-liquid-toolbar flex items-start gap-3 rounded-[18px] p-3"
                    >
                      <span className="synapse-liquid-control flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] text-xs font-black tabular-nums">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-foreground">{change.label}</p>
                        <div className="mt-1 grid gap-1 text-[11px] sm:grid-cols-2">
                          <p className="truncate text-muted-foreground">
                            <span className="font-bold">Antes:</span> {change.before}
                          </p>
                          <p className="truncate text-foreground">
                            <span className="font-bold">Depois:</span> {change.after}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>

                {detailReview?.queuesGoogleSync ? (
                  <div className="appointment-liquid-card flex items-start gap-3 rounded-[18px] border border-border/45 p-3">
                    <Repeat className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      O Google Agenda será atualizado em segundo plano depois da confirmação.
                    </p>
                  </div>
                ) : null}

                {detailError ? (
                  <div className="synapse-liquid-toolbar flex items-start gap-3 rounded-[18px] p-3" role="status" aria-live="polite">
                    <span className="synapse-liquid-control flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]">
                      <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </span>
                    <p className="pt-2 text-xs font-semibold text-foreground">{detailError}</p>
                  </div>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {step === 1 && (
          <div className="agenda-modal-footer flex shrink-0 flex-col justify-end gap-3 border-t p-4 backdrop-blur-2xl sm:flex-row sm:items-center">
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
              onClick={reviewDetails}
              disabled={updateAppointment.isPending}
              className="agenda-primary-action min-h-11 w-full rounded-xl px-6 font-bold tracking-wide sm:w-auto"
            >
              Revisar alterações
            </Button>
          </div>
        )}
        {step === 2 && (
          <div className="agenda-modal-footer flex shrink-0 items-center justify-between gap-3 border-t p-4 backdrop-blur-2xl">
            <Button
              type="button"
              variant="ghost"
              disabled={updateAppointment.isPending}
              onClick={() => {
                setDetailError(null);
                setStep(1);
              }}
              className="appointment-liquid-control min-h-11 rounded-xl border border-border/45 px-5 font-bold text-muted-foreground"
            >
              Voltar
            </Button>
            <Button
              type="button"
              onClick={() => void saveDetails()}
              disabled={updateAppointment.isPending || !detailReview}
              className="agenda-primary-action min-h-11 rounded-xl px-6 font-bold tracking-wide"
            >
              {updateAppointment.isPending
                ? <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" />
                : "Confirmar e fechar"}
            </Button>
          </div>
        )}
          </motion.div>
        ) : (
          <motion.div
            key="appointment-history"
            initial={shouldReduceMotion ? false : { opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 14 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onAnimationComplete={() => historyBackButtonRef.current?.focus()}
            className="flex min-h-0 flex-1 flex-col bg-transparent"
          >
            <header className="agenda-modal-header flex shrink-0 items-start justify-between gap-3 border-b px-5 py-4 backdrop-blur-2xl sm:px-6">
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
                aria-label={`Fechar detalhes ${isSession ? "da sessão" : "do evento"}`}
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
      itemKind={isEvent ? "event" : "session"}
      action={professionalAction}
      open={Boolean(professionalAction)}
      onOpenChange={(nextOpen) => { if (!nextOpen) setProfessionalAction(null); }}
      onCompleted={() => setOpen(false)}
    />
    </>
  );
};

const inputClassName =
  "agenda-field appointment-liquid-control h-11 w-full rounded-xl px-3 text-sm font-bold text-foreground outline-none";

const CompactDetailCard = ({
  label,
  value,
  detail,
  icon,
  ariaLabel,
}: {
  label: string;
  value: string;
  detail?: string;
  icon: React.ReactNode;
  ariaLabel?: string;
}) => (
  <div
    className="synapse-liquid-toolbar flex min-h-16 items-center gap-3 rounded-[18px] border border-border/35 px-3 py-2.5"
    aria-label={ariaLabel}
  >
    <span className="synapse-liquid-control flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] text-muted-foreground">
      {icon}
    </span>
    <div className="min-w-0">
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="truncate text-sm font-black text-foreground">{value}</p>
      {detail ? (
        <p className="truncate text-[10px] font-semibold text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  </div>
);

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
