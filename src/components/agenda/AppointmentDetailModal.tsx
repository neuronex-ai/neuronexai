"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ResponsiveModal } from "@/components/ui/ResponsiveModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSendEmail } from "@/hooks/use-send-email";
import { useUpdateAppointment } from "@/hooks/use-update-appointment";
import { mapFinancialEntryToTransaction } from "@/hooks/use-financial-entries";
import {
  APPOINTMENT_STATUS_META,
  APPOINTMENT_STATUS_VALUES,
  getAppointmentStatusMeta,
  normalizeAppointmentStatus,
  type AppointmentStatus,
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
import { AnimatePresence, motion } from "framer-motion";
import {
  Banknote,
  Briefcase,
  CalendarDays,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  Loader2,
  Mail,
  MessageCircle,
  QrCode,
  Repeat,
  ShieldCheck,
  User,
  Video,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  const [patientData, setPatientData] = useState<any>(null);
  const [transactionData, setTransactionData] = useState<any>(null);
  const [packageData, setPackageData] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<AppointmentStatus>("unscored");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventCategory, setEventCategory] = useState("outro");
  const [eventLocation, setEventLocation] = useState("");
  const [sessionType, setSessionType] = useState("follow_up");
  const [modality, setModality] = useState<"presencial" | "online">("presencial");

  const navigate = useNavigate();
  const sendEmail = useSendEmail();
  const updateAppointment = useUpdateAppointment();
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const metadata = useMemo(() => getAppointmentMetadata(appointment), [appointment]);
  const kind = metadata.kind || "session";
  const isSession = kind === "session";
  const isEvent = kind === "event";
  const displayTitle = getAppointmentDisplayTitle(appointment);
  const statusMeta = getAppointmentStatusMeta(status, appointment.notes);
  const recurrence = metadata.recurrence;

  useEffect(() => {
    if (!open) return;
    loadData();
  }, [open, appointment.id]);

  const loadData = async () => {
    setStep(1);
    const currentMetadata = getAppointmentMetadata(appointment);

    setNotes(getEditableAppointmentNotes(appointment));
    setStatus(normalizeAppointmentStatus(appointment.status, appointment.notes));
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

  const saveDetails = async (overrideStatus?: AppointmentStatus) => {
    const nextStatus = overrideStatus || status;
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
        status: nextStatus,
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
    if (!patientData?.email) {
      toast.error("Paciente sem e-mail cadastrado.");
      return;
    }
    sendEmail.mutate({
      type: "reminder",
      params: {
        patientEmail: patientData.email,
        patientName: patientData.name,
        startTime: new Date(appointment.start_time).toISOString(),
        appointmentId: appointment.id,
        action: "reminder",
      },
    });
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
    <ResponsiveModal
      open={open}
      onOpenChange={setOpen}
      trigger={children}
      className="w-[calc(100vw-1rem)] bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-[40px] border border-zinc-200 dark:border-white/[0.08] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] dark:shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] rounded-[24px] p-0 overflow-hidden sm:max-w-[680px] flex flex-col"
      drawerClassName="max-h-[92dvh]"
      contentStyle={{ maxHeight: "min(700px, calc(100dvh - 1rem))" }}
    >
      <div className="flex flex-col flex-1 min-h-0 bg-gradient-to-b from-zinc-50/50 dark:from-card/50 to-transparent">
        <div className="px-5 pt-5 pb-3 sm:px-6 flex items-center justify-between shrink-0">
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
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {format(new Date(appointment.start_time), "dd 'de' MMMM, yyyy", { locale: ptBR })}
            </p>
          </div>

          <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="rounded-full w-9 h-9 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all active:scale-90 shrink-0">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="px-5 py-3 sm:px-6 overflow-y-auto custom-scrollbar flex-1 min-h-0">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div key="details" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 p-4 rounded-2xl bg-zinc-100/60 dark:bg-secondary/20 border border-zinc-200 dark:border-border/10 flex items-center justify-between shadow-sm">
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
                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-background/50" onClick={() => navigate(`/pacientes/${appointment.patient_id}`)}>
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    )}
                  </div>

                  {isSession && (
                    <div className="flex sm:flex-col gap-2 shrink-0">
                      <Button variant="outline" onClick={handleWhatsApp} className="flex-1 sm:flex-none h-auto py-3 rounded-[20px] bg-zinc-100/60 dark:bg-secondary/20 border-zinc-200 dark:border-border/10 hover:bg-emerald-50 hover:text-emerald-600">
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" onClick={handleSendEmail} disabled={sendEmail.isPending} className="flex-1 sm:flex-none h-auto py-3 rounded-[20px] bg-zinc-100/60 dark:bg-secondary/20 border-zinc-200 dark:border-border/10 hover:bg-blue-50 hover:text-blue-600">
                        {sendEmail.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                      </Button>
                    </div>
                  )}
                </div>

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
                    <div className="rounded-2xl bg-background/70 border border-zinc-200 dark:border-border/10 px-4 py-3">
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">Frequência</p>
                      <p className="mt-1 text-sm font-bold text-foreground">
                        {recurrence?.enabled ? RECURRENCE_LABELS[recurrence.frequency || "weekly"] || recurrence.frequency : "Sem recorrência"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-background/70 border border-zinc-200 dark:border-border/10 px-4 py-3">
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">Ocorrências</p>
                      <p className="mt-1 text-sm font-bold text-foreground">{recurrence?.enabled ? recurrence.count || 1 : 1}</p>
                    </div>
                    <div className="rounded-2xl bg-background/70 border border-zinc-200 dark:border-border/10 px-4 py-3">
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">Duração</p>
                      <p className="mt-1 text-sm font-bold text-foreground">{getDurationString(appointment.start_time, appointment.end_time)}</p>
                    </div>
                  </div>
                </FieldShell>

                <FieldShell label="Status do agendamento" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
                  <Select value={status} onValueChange={(value) => setStatus(value as AppointmentStatus)}>
                    <SelectTrigger className={inputClassName}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {APPOINTMENT_STATUS_VALUES.map((value) => {
                        const meta = APPOINTMENT_STATUS_META[value];
                        return (
                          <SelectItem key={value} value={value}>
                            {meta.label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </FieldShell>

                {isSession && transactionData && (
                  <div className="p-4 rounded-2xl bg-zinc-100/60 dark:bg-secondary/20 border border-zinc-200 dark:border-border/10 shadow-sm">
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
                    className="min-h-[88px] bg-zinc-100/60 dark:bg-secondary/20 border-zinc-200 dark:border-border/10 hover:bg-zinc-200/60 dark:hover:bg-secondary/30 focus:bg-zinc-200/60 dark:focus:bg-secondary/30 rounded-2xl resize-none text-foreground px-4 py-3 text-sm transition-all focus:border-border/20 focus:ring-0 placeholder:text-muted-foreground/50"
                    placeholder={isSession ? "Adicione observações da sessão..." : "Adicione notas internas do compromisso..."}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div key="success" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center text-center space-y-4 py-8">
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
          <div className="p-4 bg-zinc-50/60 dark:bg-card/60 border-t border-zinc-200 dark:border-border/10 flex flex-col gap-3 backdrop-blur-xl shrink-0 sm:flex-row sm:justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={updateAppointment.isPending}
                  className="w-full sm:w-auto rounded-full px-5 h-10 font-bold text-red-600 border-red-500/20 hover:bg-red-500/10 hover:text-red-700"
                >
                  Cancelar
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2">
                <DropdownMenuItem
                  onClick={() => void saveDetails("cancelled_by_patient")}
                  className="rounded-xl px-3 py-2.5 text-sm font-bold text-red-600 focus:bg-red-500/10 focus:text-red-700"
                >
                  Paciente cancelou
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => void saveDetails("cancelled_by_professional")}
                  className="rounded-xl px-3 py-2.5 text-sm font-bold text-red-600 focus:bg-red-500/10 focus:text-red-700"
                >
                  Eu cancelei
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              onClick={() => saveDetails()}
              disabled={updateAppointment.isPending}
              className="w-full sm:w-auto rounded-full px-6 h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg transition-all active:scale-95 tracking-wide"
            >
              {updateAppointment.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Salvar e Fechar"}
            </Button>
          </div>
        )}
      </div>
    </ResponsiveModal>
  );
};

const inputClassName =
  "w-full h-10 rounded-xl bg-background/70 border border-zinc-200 dark:border-border/10 px-3 text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all";

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
  <div className={cn("p-4 rounded-2xl bg-zinc-100/60 dark:bg-secondary/20 border border-zinc-200 dark:border-border/10 space-y-3 shadow-sm", className)}>
    <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground flex items-center gap-2">
      {icon}
      {label}
    </span>
    {children}
  </div>
);
