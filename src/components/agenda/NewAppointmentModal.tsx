import { useState, useEffect, useMemo, useRef } from "react";
import { useForm, type FieldErrors, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  FileText,
  DollarSign,
  Briefcase,
  X,
  CreditCard,
  Banknote,
  QrCode,
  Repeat,
  Loader2,
  Building2,
  Video,
  CalendarPlus,
  AlertTriangle,
  CheckCircle2,
  Package,
  Sparkles,
  Link2,
  StickyNote,
  Plus,
  Save,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { differenceInMinutes, format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ResponsiveModal } from "@/components/ui/ResponsiveModal";
import { usePatients } from "@/hooks/use-patients";
import { useAddAppointment } from "@/hooks/use-add-appointment";
import { useActivePatientPackages } from "@/hooks/use-active-patient-packages";
import { usePatientPackages } from "@/hooks/use-patient-packages";
import { useAppointmentSeries } from "@/hooks/use-appointment-series";
import {
  useAgendaSeriesTemplates,
  useAgendaV2,
  usePatientFinancialResolution,
  toAgendaV2Overrides,
  toAgendaV2RecurrenceRule,
  type AgendaV2PlanInput,
  type AgendaPlanSmartFitCandidate,
  type AgendaV2Preview,
} from "@/hooks/use-agenda-v2";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { NewPatientModal } from "@/components/patients/NewPatientModal";
import {
  buildEventMetadata,
  buildEventNotes as buildEventNotesFromMetadata,
  buildSessionMetadata,
} from "@/lib/appointment-metadata";
import {
  APPOINTMENT_FORM_ID,
  findFirstInvalidAppointmentField,
  getAppointmentFieldStep,
  getAppointmentStepLabels,
} from "@/lib/appointment-form-flow";
import { AdvancedRecurrenceEditor } from "@/components/agenda/AdvancedRecurrenceEditor";
import {
  agendaRecurrenceDraftToRule,
  agendaRuleToRecurrenceDraft,
  createAgendaRecurrenceDraft,
  recurrenceRuleSummary,
  type AgendaRecurrenceDraft,
  type OccurrenceOverride,
} from "@/lib/agenda-scheduling";

// ─── Validação ────────────────────────────────────────────────────────

const formSchema = z
  .object({
    eventType: z.enum(["session", "event"]).default("session"),

    // Sessão Clínica
    patientId: z.string().optional(),
    date: z.date({ required_error: "Selecione uma data" }).refine(
      (d) => d >= startOfDay(new Date()),
      { message: "Não é possível agendar para datas passadas" }
    ),
    startTime: z.string().min(1, "Horário de início obrigatório"),
    duration: z.number().min(15, "Mínimo 15 minutos"),
    type: z.enum(["first_visit", "follow_up", "emergency", "block"]).default("follow_up"),
    modality: z.enum(["presencial", "online"]).default("presencial"),
    sessionLocation: z.string().optional(),
    notes: z.string().optional(),

    // Evento Geral
    eventTitle: z.string().optional(),
    eventCategory: z.string().optional(),
    endTime: z.string().optional(),
    eventLocation: z.string().optional(),

    // Financeiro
    shouldCreateTransaction: z.boolean().default(false),
    transactionAmount: z.coerce.number().optional(),
    transactionMethod: z.enum(["pix", "money", "credit_card", "debit_card", "boleto", "mixed"]).optional(),
    installments: z.coerce.number().min(1).default(1),
    usePackage: z.boolean().default(false),
    packageId: z.string().optional(),

    // Recorrência
    recurrence: z.boolean().default(false),
    recurrenceFrequency: z.enum(["weekly", "biweekly", "monthly"]).default("weekly"),
    recurrenceCount: z.coerce.number().min(1).max(500).optional(),
  })
  .refine(
    (data) => !data.recurrence || (data.recurrenceCount || 0) >= 2,
    { message: "Informe pelo menos 2 ocorrências", path: ["recurrenceCount"] },
  )
  .refine(
    (data) => {
      if (data.eventType === "session") return !!data.patientId && data.patientId.length > 0;
      return true;
    },
    { message: "Selecione um paciente", path: ["patientId"] }
  )
  .refine(
    (data) => {
      if (data.eventType === "event") return !!data.eventTitle && data.eventTitle.length > 0;
      return true;
    },
    { message: "Informe o título do evento", path: ["eventTitle"] }
  )
  .refine(
    (data) => {
      if (data.eventType === "event") return !!data.eventCategory && data.eventCategory.length > 0;
      return true;
    },
    { message: "Selecione uma categoria", path: ["eventCategory"] }
  )
  .refine(
    (data) => {
      if (data.eventType === "event") return !!data.endTime && data.endTime.length > 0;
      return true;
    },
    { message: "Informe o horário final", path: ["endTime"] }
  )
  .refine(
    (data) => {
      if (data.eventType !== "session" || data.usePackage || !data.shouldCreateTransaction) return true;
      return typeof data.transactionAmount === "number" && data.transactionAmount > 0;
    },
    { message: "Informe um valor maior que zero", path: ["transactionAmount"] }
  );

type FormValues = z.infer<typeof formSchema>;

// ─── Constantes ───────────────────────────────────────────────────────

const EVENT_CATEGORIES = [
  { value: "reuniao", label: "Reunião" },
  { value: "supervisao", label: "Supervisão" },
  { value: "particular", label: "Particular" },
  { value: "bloqueio", label: "Bloqueio de Agenda" },
  { value: "formacao", label: "Formação / Curso" },
  { value: "administrativo", label: "Administrativo" },
  { value: "outro", label: "Outro" },
];

const addMinutesToTime = (time: string, minutesToAdd: number) => {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes + minutesToAdd, 0, 0);
  return format(date, "HH:mm");
};

const buildAppointmentTimes = (values: FormValues) => {
  const startDateTime = new Date(values.date);
  const [hours, minutes] = values.startTime.split(":").map(Number);
  startDateTime.setHours(hours, minutes, 0, 0);

  let endDateTime: Date;
  if (values.endTime) {
    endDateTime = new Date(values.date);
    const [endHours, endMinutes] = values.endTime.split(":").map(Number);
    endDateTime.setHours(endHours, endMinutes, 0, 0);
    if (endDateTime <= startDateTime) endDateTime.setDate(endDateTime.getDate() + 1);
  } else {
    endDateTime = new Date(startDateTime);
    endDateTime.setMinutes(endDateTime.getMinutes() + values.duration);
  }

  return { startDateTime, endDateTime };
};

// ─── Props ────────────────────────────────────────────────────────────

interface NewAppointmentModalProps {
  isOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  selectedDate?: Date | null;
  initialDate?: Date | null;
  selectedTime?: string | null;
  children?: React.ReactNode;
}

// ─── Pill Toggle ──────────────────────────────────────────────────────

function PillToggle({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const options = [
    { id: "session", icon: Sparkles, label: "Sessão Clínica" },
    { id: "event", icon: CalendarPlus, label: "Evento Geral" },
  ] as const;

  return (
    <div className="synapse-liquid-toolbar flex w-full gap-1 rounded-[20px] p-1">
      {options.map((opt) => {
        const isActive = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "agenda-tactile synapse-liquid-control relative flex min-h-11 flex-1 select-none items-center justify-center gap-2 rounded-[16px] px-2 py-3 text-[10px] font-black uppercase tracking-[0.12em]",
              isActive
                ? "synapse-liquid-tab-active text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <opt.icon className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">{opt.label}</span>
            <span className="sm:hidden">{opt.id === "session" ? "Sessão" : "Evento"}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────

export function NewAppointmentModal({
  isOpen: externalIsOpen,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
  selectedDate,
  initialDate,
  selectedTime,
  children,
}: NewAppointmentModalProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : externalOpen !== undefined ? externalOpen : internalIsOpen;
  const onOpenChange = externalOnOpenChange || setInternalIsOpen;

  const [step, setStep] = useState(1);
  const [seriesPreview, setSeriesPreview] = useState<AgendaV2Preview | null>(null);
  const [seriesPreviewError, setSeriesPreviewError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [recurrenceDraft, setRecurrenceDraft] = useState<AgendaRecurrenceDraft>(() =>
    createAgendaRecurrenceDraft(selectedDate || initialDate || new Date()),
  );
  const [templateName, setTemplateName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [smartFitSuggestions, setSmartFitSuggestions] = useState<Record<number, AgendaPlanSmartFitCandidate[]>>({});
  const idempotencyKeyRef = useRef(`agenda-v2-${crypto.randomUUID()}`);
  const { data: patients } = usePatients();
  const { mutateAsync: createAppointment, isPending: isCreatingAppointment } = useAddAppointment();
  const {
    createSeries,
    isCreatingSeries,
  } = useAppointmentSeries();
  const {
    previewAgendaPlan,
    createAgendaSeries,
    isPreviewingAgendaPlan,
    isCreatingAgendaSeries,
    suggestAgendaPlanSmartFit,
    isSuggestingAgendaPlanSmartFit,
  } = useAgendaV2();
  const {
    data: seriesTemplates,
    saveTemplate,
    isSavingTemplate,
  } = useAgendaSeriesTemplates();

  const effectiveDate = selectedDate || initialDate;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      eventType: "session",
      patientId: "",
      date: effectiveDate || new Date(),
      startTime: selectedTime || "09:00",
      duration: 50,
      type: "follow_up",
      modality: "presencial",
      sessionLocation: "",
      notes: "",
      eventTitle: "",
      eventCategory: "",
      endTime: addMinutesToTime(selectedTime || "09:00", 50),
      eventLocation: "",
      shouldCreateTransaction: true,
      transactionAmount: 0,
      transactionMethod: "pix",
      installments: 1,
      usePackage: false,
      recurrence: false,
      recurrenceFrequency: "weekly",
      recurrenceCount: 4,
    },
  });

  // Atualizar data quando selecionada externamente
  useEffect(() => {
    if (effectiveDate) form.setValue("date", effectiveDate);
    if (effectiveDate) {
      setRecurrenceDraft((current) => ({
        ...current,
        weekDays: current.overrides.length ? current.weekDays : [effectiveDate.getDay()],
        monthDays: current.overrides.length ? current.monthDays : [effectiveDate.getDate()],
      }));
    }
  }, [effectiveDate, form]);

  useEffect(() => {
    if (!selectedTime) return;
    form.setValue("startTime", selectedTime);
    form.setValue("endTime", addMinutesToTime(selectedTime, form.getValues("duration") || 50));
  }, [selectedTime, form]);

  const eventType = form.watch("eventType");
  const selectedPatientId = form.watch("patientId");
  const { data: resolvedFinancial, isLoading: isResolvingFinancial } =
    usePatientFinancialResolution(eventType === "session" ? selectedPatientId : null);
  const selectedPackageId = form.watch("packageId");
  const usePackageSwitch = form.watch("usePackage");
  const shouldCreateTransaction = form.watch("shouldCreateTransaction");
  const startTime = form.watch("startTime");
  const duration = form.watch("duration");
  const modality = form.watch("modality");
  const recurrenceEnabled = form.watch("recurrence");
  const recurrenceFrequency = form.watch("recurrenceFrequency");
  const recurrenceCount = form.watch("recurrenceCount") || 1;
  const selectedFormDate = form.watch("date");
  const selectedEndTime = form.watch("endTime");

  useEffect(() => {
    if (!startTime || !duration) return;
    form.setValue("endTime", addMinutesToTime(startTime, duration));
  }, [duration, form, startTime]);

  useEffect(() => {
    setSeriesPreview(null);
    setSeriesPreviewError(null);
  }, [
    duration,
    eventType,
    recurrenceCount,
    recurrenceEnabled,
    recurrenceFrequency,
    selectedEndTime,
    selectedFormDate,
    startTime,
    recurrenceDraft,
  ]);

  useEffect(() => {
    form.setValue("recurrenceCount", recurrenceDraft.terminationKind === "count" ? recurrenceDraft.count : 2);
    form.setValue(
      "recurrenceFrequency",
      recurrenceDraft.kind === "monthly" ? "monthly" : recurrenceDraft.interval === 2 ? "biweekly" : "weekly",
    );
  }, [form, recurrenceDraft.count, recurrenceDraft.interval, recurrenceDraft.kind, recurrenceDraft.terminationKind]);

  // Reset step quando muda de tipo
  useEffect(() => {
    setStep(1);
  }, [eventType]);

  // ── Pacotes ativos ─────────────────────────────────────────────────
  const { data: activePackages, isLoading: isLoadingPackages } = useActivePatientPackages(
    eventType === "session" ? selectedPatientId || "" : ""
  );
  const { data: patientPackages, isLoading: isLoadingPatientPackages } = usePatientPackages(
    eventType === "session" ? selectedPatientId || "" : ""
  );

  const hasActivePackage = !!activePackages && activePackages.length > 0;
  const selectedPackage = useMemo(() => {
    return activePackages?.find((p) => p.id === selectedPackageId) || activePackages?.[0];
  }, [activePackages, selectedPackageId]);

  const remainingSessions = selectedPackage
    ? selectedPackage.total_sessions - selectedPackage.sessions_used - (selectedPackage.sessions_reserved || 0)
    : 0;
  const sessionsToReserve = recurrenceEnabled
    ? recurrenceDraft.terminationKind === "count"
      ? recurrenceDraft.count
      : null
    : 1;
  const afterDebitSessions = sessionsToReserve === null
    ? null
    : remainingSessions - sessionsToReserve;
  const latestPackage = patientPackages?.[0];
  const latestPackageRemaining = latestPackage
    ? latestPackage.total_sessions - latestPackage.sessions_used - (latestPackage.sessions_reserved || 0)
    : 0;
  const latestPackageIsExpired = !!latestPackage?.end_date && new Date(`${latestPackage.end_date}T23:59:59`) < new Date();
  const projectedUncoveredBalance = latestPackage ? Math.min(latestPackageRemaining - 1, -1) : -1;
  const isCheckingFinancialRules = isLoadingPackages || isLoadingPatientPackages || isResolvingFinancial;
  const isSubmitting =
    isCreatingAppointment ||
    isPreviewingAgendaPlan ||
    isCreatingSeries ||
    isCreatingAgendaSeries;

  // Auto‑ativar pacote quando tem pacotes, ou abrir lançamento quando não tem
  useEffect(() => {
    if (eventType !== "session" || step !== 3) return;
    if (hasActivePackage) {
      form.setValue("usePackage", true);
      if (activePackages && activePackages.length > 0 && !form.getValues("packageId")) {
        form.setValue("packageId", activePackages[0].id);
      }
    } else if (resolvedFinancial?.planType === "insurance" || resolvedFinancial?.planType === "monthly" || resolvedFinancial?.planType === "exempt") {
      form.setValue("usePackage", false);
      form.setValue("shouldCreateTransaction", false);
      if (resolvedFinancial.sessionValueCents > 0) {
        form.setValue("transactionAmount", resolvedFinancial.sessionValueCents / 100);
      }
    } else {
      form.setValue("usePackage", false);
      form.setValue("shouldCreateTransaction", resolvedFinancial?.shouldCreateCharge ?? true);
      if (form.getValues("transactionAmount") === 0) {
        form.setValue("transactionAmount", resolvedFinancial?.sessionValueCents
          ? resolvedFinancial.sessionValueCents / 100
          : 150);
      }
    }
  }, [hasActivePackage, activePackages, step, eventType, form, resolvedFinancial]);

  // Zerar valor da transação quando usa pacote
  useEffect(() => {
    if (usePackageSwitch && activePackages?.length) {
      form.setValue("transactionAmount", 0);
      form.setValue("shouldCreateTransaction", false);
    }
  }, [usePackageSwitch, activePackages, form]);

  // ── Número total de passos ─────────────────────────────────────────
  const stepLabels = getAppointmentStepLabels(eventType, recurrenceEnabled);
  const totalSteps = stepLabels.length;

  const buildAgendaPlanInput = (
    values: FormValues,
    metadata?: ReturnType<typeof buildSessionMetadata> | ReturnType<typeof buildEventMetadata>,
    recurrence = recurrenceDraft,
  ): AgendaV2PlanInput => {
    const { startDateTime, endDateTime } = buildAppointmentTimes(values);
    const recurrenceRule = agendaRecurrenceDraftToRule(recurrence);
    const sessionLocation = values.modality === "online"
      ? "Teleconsulta NeuroNex"
      : values.sessionLocation?.trim() || "Consultório";
    const eventLocation = values.eventLocation?.trim() || null;

    const financial: AgendaV2PlanInput["financial"] = values.eventType !== "session"
      ? { mode: "none" }
      : values.usePackage && (selectedPackage?.id || values.packageId)
        ? {
            mode: "package",
            package_id: selectedPackage?.id || values.packageId || null,
            charge_mode: "per_occurrence",
          }
        : resolvedFinancial?.planType === "insurance" && !values.shouldCreateTransaction
          ? { mode: "insurance", charge_mode: "per_occurrence" }
          : values.shouldCreateTransaction
            ? {
                mode: "manual",
                value_per_session: values.transactionAmount || 0,
                payment_method: values.transactionMethod || "pix",
                charge_mode: "per_occurrence",
              }
            : { mode: "none" };

    return {
      patient_id: values.eventType === "session" ? values.patientId || null : null,
      first_start_time: startDateTime.toISOString(),
      duration_minutes: Math.max(15, differenceInMinutes(endDateTime, startDateTime)),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo",
      type: values.eventType === "session" ? values.modality : "block",
      recurrence_rule: toAgendaV2RecurrenceRule(recurrenceRule),
      overrides: toAgendaV2Overrides(recurrence.overrides),
      notes: values.notes?.trim() || null,
      location: values.eventType === "event" ? eventLocation : sessionLocation,
      metadata,
      template_version_id: selectedTemplateId
        ? [...(seriesTemplates?.find((item) => item.id === selectedTemplateId)?.appointment_series_template_versions || [])]
            .sort((left, right) => right.version_number - left.version_number)[0]?.id || null
        : null,
      default_config: {
        type: values.type,
        modality: values.modality,
        durationMinutes: values.duration,
        location: values.eventType === "event" ? eventLocation : sessionLocation,
      },
      financial,
    };
  };

  const loadSeriesPreview = async (values: FormValues, recurrence = recurrenceDraft) => {
    setSeriesPreviewError(null);
    try {
      const preview = await previewAgendaPlan(buildAgendaPlanInput(values, undefined, recurrence));
      setSeriesPreview(preview);
      return preview;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível verificar a disponibilidade.";
      setSeriesPreview(null);
      setSeriesPreviewError(message);
      toast.error(message);
      return null;
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────
  const onSubmit = async (values: FormValues) => {
    setSubmissionError(null);
    const { startDateTime, endDateTime } = buildAppointmentTimes(values);

    let notesStr = values.notes || "";
    let locStr: string | null = null;

    const durationMinutes = Math.round((endDateTime.getTime() - startDateTime.getTime()) / 60000);
    const metadata = values.eventType === "event"
      ? buildEventMetadata({
          title: values.eventTitle || "Compromisso",
          category: values.eventCategory || "outro",
          categoryLabel: EVENT_CATEGORIES.find((item) => item.value === values.eventCategory)?.label,
          location: values.eventLocation || null,
          notes: values.notes || "",
          origin: "neuronex",
          syncStatus: "pending",
        })
      : buildSessionMetadata({
          sessionType: values.type,
          modality: values.modality,
          durationMinutes,
          notes: values.notes || "",
          origin: "neuronex",
          syncStatus: "pending",
          financial: {
            usePackage: values.usePackage,
            packageId: values.packageId || selectedPackage?.id || null,
            transactionAmount: values.shouldCreateTransaction ? values.transactionAmount || 0 : null,
            transactionMethod: values.transactionMethod || null,
            installments: values.installments || 1,
          },
        });

    if (values.eventType === "event") {
      notesStr = buildEventNotesFromMetadata(metadata);
    } else if (values.eventType === "session") {
      const prefix = values.type === "first_visit" ? "[Primeira Consulta] " : "";
      notesStr = `${prefix}${values.notes || (values.type === "first_visit" ? "Primeira Consulta" : "")}`;
      locStr = values.modality === "online" ? "Teleconsulta NeuroNex" : values.sessionLocation?.trim() || "Consultório";
    }

    const appointmentPayload = {
      patient_id: values.eventType === "session" ? values.patientId || null : null,
      start_time: startDateTime,
      end_time: endDateTime,
      type: (values.eventType === "session"
        ? values.modality
        : "block") as "presencial" | "online" | "block",
      notes: notesStr,
      location: values.eventType === "event" ? values.eventLocation || null : locStr,
      metadata,
      package_id: null,
      financial: values.eventType === "session" && values.shouldCreateTransaction
        ? {
            mode: "manual" as const,
            value_per_session: values.transactionAmount || 0,
            total: values.transactionAmount || 0,
            charge_mode: "per_occurrence" as const,
            payment_method: values.transactionMethod || "pix",
            installments: values.installments || 1,
          }
        : { mode: "none" as const, value_per_session: 0, total: 0, charge_mode: "per_occurrence" as const },
    };

    try {
      if (values.recurrence) {
        const latestPreview = seriesPreview?.valid
          ? seriesPreview
          : await loadSeriesPreview(values);
        if (!latestPreview?.valid) {
          setStep(totalSteps);
          toast.error("Revise as datas em conflito antes de criar a série.");
          return;
        }

        const result = await createAgendaSeries({
          input: buildAgendaPlanInput(values, metadata),
          idempotencyKey: idempotencyKeyRef.current,
        });
        toast.success(result.result.message || "Série criada com segurança.");
      } else if (
        values.eventType === "session"
        && values.usePackage
        && selectedPackage?.id
        && values.patientId
      ) {
        const result = await createSeries({
          patientId: values.patientId,
          packageId: selectedPackage.id,
          startTime: startDateTime,
          endTime: endDateTime,
          frequency: "single",
          occurrenceCount: 1,
          type: values.modality as "presencial" | "online",
          notes: notesStr || null,
          location: locStr,
          metadata,
        });
        if (!result.success) {
          throw new Error("A disponibilidade mudou. Nenhum agendamento foi criado.");
        }
      } else {
        await createAppointment(appointmentPayload);
      }

      onOpenChange(false);
      form.reset();
      setRecurrenceDraft(createAgendaRecurrenceDraft(effectiveDate || new Date()));
      setSelectedTemplateId("");
      setTemplateName("");
      idempotencyKeyRef.current = `agenda-v2-${crypto.randomUUID()}`;
      setSeriesPreview(null);
      setSeriesPreviewError(null);
      setStep(1);
    } catch (error: unknown) {
      const agendaError = error as Error & { preview?: AgendaV2Preview };
      if (agendaError.preview) {
        setSeriesPreview(agendaError.preview);
        setSeriesPreviewError(agendaError.message);
        setStep(totalSteps);
      }
      const message = error instanceof Error
        ? error.message
        : "Não foi possível registrar o agendamento.";
      toast.error(message);
      setSubmissionError(message);
    }
  };

  const onInvalid = (errors: FieldErrors<FormValues>) => {
    const firstField = findFirstInvalidAppointmentField(errors);
    const targetStep = firstField
      ? getAppointmentFieldStep(firstField, eventType, recurrenceEnabled)
      : 1;

    setStep(targetStep);
    setSubmissionError("Revise o campo destacado para continuar.");

    if (firstField) {
      window.setTimeout(() => {
        form.setFocus(firstField as FieldPath<FormValues>);
      }, 0);
    }
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, totalSteps));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  // ─── Style tokens ────────────────────────────────────────────────
  const inputBase =
    "agenda-field h-12 rounded-2xl text-sm text-foreground focus:ring-0";
  const labelBase = "text-[9px] uppercase tracking-[0.14em] font-bold text-muted-foreground ml-1";
  const cardBase =
    "agenda-liquid-card rounded-2xl border p-4";
  const selectPopover = "agenda-menu-surface notification-liquid-menu z-[9999] overflow-hidden rounded-[18px] p-1.5";

  const applySeriesTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = seriesTemplates?.find((item) => item.id === templateId);
    const version = [...(template?.appointment_series_template_versions || [])]
      .sort((left, right) => right.version_number - left.version_number)[0];
    if (!version) return;
    const savedDuration = Number(version.default_config?.durationMinutes);
    if (Number.isFinite(savedDuration) && savedDuration >= 15) {
      form.setValue("duration", savedDuration);
    }
    if (version.default_config?.modality === "presencial" || version.default_config?.modality === "online") {
      form.setValue("modality", version.default_config.modality);
    }
    if (typeof version.default_config?.location === "string") {
      form.setValue("sessionLocation", version.default_config.location);
    }
    const rule = version.recurrence_rule;
    const termination = rule.termination.kind === "count"
      ? { kind: "count" as const, count: rule.termination.count || 4 }
      : rule.termination.kind === "until"
        ? { kind: "until" as const, untilDate: rule.termination.until_date || "" }
        : { kind: "open" as const, horizonDays: 90 };
    setRecurrenceDraft((current) => ({
      ...agendaRuleToRecurrenceDraft({
        kind: rule.kind,
        interval: rule.interval,
        weekDays: rule.week_days,
        monthDays: rule.month_days,
        customDates: rule.kind === "range_distribution"
          ? [rule.until_date || ""]
          : rule.custom_dates,
        missingMonthDay: rule.missing_month_day,
        termination,
      }, form.getValues("date")),
      customizeOccurrences: current.customizeOccurrences,
      overrides: current.overrides,
    }));
    toast.success(`Modelo “${template?.name}” aplicado. Revise o que desejar.`);
  };

  const handleSaveSeriesTemplate = async () => {
    const name = templateName.trim();
    if (!name) {
      setSubmissionError("Dê um nome curto ao modelo antes de salvar.");
      return;
    }
    try {
      await saveTemplate({
        name,
        recurrenceRule: toAgendaV2RecurrenceRule(agendaRecurrenceDraftToRule(recurrenceDraft)),
        defaultConfig: {
          durationMinutes: form.getValues("duration"),
          modality: form.getValues("modality"),
          location: form.getValues("sessionLocation") || null,
        },
        sourcePatientId: eventType === "session" ? form.getValues("patientId") || null : null,
      });
      setTemplateName("");
      toast.success("Modelo salvo sem copiar dados financeiros do paciente.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível salvar o modelo.";
      setSubmissionError(message);
    }
  };

  const updateOccurrenceOverride = (
    occurrenceNumber: number,
    patch: Partial<OccurrenceOverride>,
  ) => {
    setRecurrenceDraft((current) => {
      const previous = current.overrides.find((item) => item.occurrenceNumber === occurrenceNumber);
      const next = {
        occurrenceNumber,
        source: "professional" as const,
        reason: previous?.reason || "Ajuste individual definido na criação da série.",
        ...previous,
        ...patch,
      };
      return {
        ...current,
        overrides: [
          ...current.overrides.filter((item) => item.occurrenceNumber !== occurrenceNumber),
          next,
        ].sort((left, right) => left.occurrenceNumber - right.occurrenceNumber),
      };
    });
  };

  const clearOccurrenceOverride = (occurrenceNumber: number) => {
    setRecurrenceDraft((current) => ({
      ...current,
      overrides: current.overrides.filter((item) => item.occurrenceNumber !== occurrenceNumber),
    }));
  };

  const requestSmartFit = async (occurrenceNumber: number, allowShorter = false) => {
    setSubmissionError(null);
    try {
      const result = await suggestAgendaPlanSmartFit({
        input: buildAgendaPlanInput(form.getValues()),
        occurrenceNumber,
        allowShorter,
        minimumDurationMinutes: 30,
      });
      setSmartFitSuggestions((current) => ({
        ...current,
        [occurrenceNumber]: result.candidates,
      }));
      if (!result.candidates.length) {
        setSubmissionError("Não encontrei uma janela válida nos próximos 14 dias para esta sessão.");
      }
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "Não foi possível sugerir um reencaixe.");
    }
  };

  const applySmartFitCandidate = async (
    occurrenceNumber: number,
    candidate: AgendaPlanSmartFitCandidate,
  ) => {
    const nextOverride: OccurrenceOverride = {
      occurrenceNumber,
      date: format(new Date(candidate.startTime), "yyyy-MM-dd"),
      startTime: format(new Date(candidate.startTime), "HH:mm"),
      durationMinutes: candidate.durationMinutes,
      source: "synapse",
      reason: candidate.keepsFullDuration
        ? "Reencaixe inteligente confirmado pelo profissional."
        : "Reencaixe inteligente com duração reduzida, confirmado pelo profissional.",
    };
    const nextDraft: AgendaRecurrenceDraft = {
      ...recurrenceDraft,
      customizeOccurrences: true,
      overrides: [
        ...recurrenceDraft.overrides.filter((item) => item.occurrenceNumber !== occurrenceNumber),
        nextOverride,
      ].sort((left, right) => left.occurrenceNumber - right.occurrenceNumber),
    };
    setRecurrenceDraft(nextDraft);
    setSmartFitSuggestions((current) => ({ ...current, [occurrenceNumber]: [] }));
    await loadSeriesPreview(form.getValues(), nextDraft);
  };

  // ─── STEP 1 ───────────────────────────────────────────────────────

  const renderStep1 = () => {
    return (
      <div className="agenda-step-enter space-y-4">
        {/* Pill Toggle */}
        <FormField
          control={form.control}
          name="eventType"
          render={({ field }) => (
            <FormItem>
              <PillToggle value={field.value} onChange={field.onChange} />
            </FormItem>
          )}
        />

        {/* ── Sessão Clínica ─────────────────────────── */}
        {eventType === "session" && (
          <div className="agenda-step-enter space-y-4">
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
                <div className="p-2 rounded-full bg-secondary/20">
                  <User className="h-4 w-4 text-foreground" />
                </div>
                Quem será atendido?
              </h3>
              <p className="text-sm font-medium text-muted-foreground ml-1">Selecione o paciente e o horário da sessão.</p>
            </div>

            <FormField
              control={form.control}
              name="patientId"
              render={({ field }) => (
                  <FormItem className="space-y-2.5">
                  <FormLabel className={labelBase}>Paciente</FormLabel>
                  <div className="grid grid-cols-[1fr_3rem] gap-2">
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className={cn(inputBase, "font-medium px-4 shadow-inner data-[state=open]:border-primary/50")}>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className={selectPopover}>
                        {patients?.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="text-foreground/70 focus:bg-accent focus:text-foreground py-3 px-4 cursor-pointer text-sm">
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <NewPatientModal
                      onCreated={(patient) => {
                        if (patient?.id) {
                          form.setValue("patientId", patient.id, { shouldDirty: true, shouldValidate: true });
                        }
                      }}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(inputBase, "w-12 p-0")}
                        aria-label="Criar novo paciente"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </NewPatientModal>
                  </div>
                  <FormMessage className="text-rose-400 pl-1" />
                </FormItem>
              )}
            />

            {renderDateTimeRow(true)}
            {renderRecurrenceToggle()}
          </div>
        )}

        {/* ── Evento Geral ───────────────────────────── */}
        {eventType === "event" && (
          <div className="agenda-step-enter space-y-4">
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
                <div className="rounded-full bg-primary/10 p-2">
                  <CalendarPlus className="h-4 w-4 text-primary" />
                </div>
                Novo Compromisso
              </h3>
              <p className="text-sm font-medium text-muted-foreground ml-1">Registre um evento ou compromisso administrativo.</p>
            </div>

            <FormField
              control={form.control}
              name="eventTitle"
              render={({ field }) => (
                <FormItem className="space-y-2.5">
                  <FormLabel className={labelBase}>Título do Evento</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ex: Supervisão Clínica, Reunião de Equipe..."
                        className={cn(inputBase, "px-4 font-medium")}
                    />
                  </FormControl>
                  <FormMessage className="text-rose-400 pl-1" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="eventCategory"
              render={({ field }) => (
                <FormItem className="space-y-2.5">
                  <FormLabel className={labelBase}>Categoria</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className={cn(inputBase, "font-medium px-4 shadow-inner")}>
                        <SelectValue placeholder="Selecione a categoria..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className={selectPopover}>
                      {EVENT_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value} className="text-foreground/70 focus:bg-accent focus:text-foreground py-3 px-4 cursor-pointer text-sm">
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-rose-400 pl-1" />
                </FormItem>
              )}
            />

            {renderDateTimeRow(true)}
            {renderRecurrenceToggle()}
          </div>
        )}
      </div>
    );
  };

  // ─── Date & Time Row (shared) ─────────────────────────────────────

  const renderDateTimeRow = (showEndTime = false) => (
    <div className="grid grid-cols-1 gap-4">
      <div className={cn("flex gap-3", showEndTime && "flex-wrap")}>
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex-1 flex flex-col space-y-2 min-w-[140px]">
              <FormLabel className={labelBase}>Data</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(inputBase, "w-full pl-4 text-left font-medium shadow-sm relative overflow-hidden group", !field.value && "text-muted-foreground")}
                    >
                      <div className="absolute inset-0 bg-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      {field.value ? format(field.value, "dd MMM", { locale: ptBR }) : <span>--/--</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-40 group-hover:opacity-100 transition-opacity mr-2" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent
                  className="agenda-menu-surface notification-popover-surface w-auto overflow-hidden rounded-3xl border p-0"
                  align="start"
                >
                  <div className="p-4">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date < startOfDay(new Date())}
                      initialFocus
                      className="bg-transparent text-foreground rounded-xl"
                      classNames={{
                        day_selected: "bg-primary text-primary-foreground hover:bg-primary/90 focus:bg-primary/90 rounded-full font-bold",
                        day_today: "bg-secondary text-foreground rounded-full",
                      }}
                    />
                  </div>
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="startTime"
          render={({ field }) => (
            <FormItem className="w-[124px] space-y-2">
              <FormLabel className={labelBase}>{showEndTime ? "Início" : "Horário"}</FormLabel>
              <FormControl>
                <div className="relative group">
                  <Input
                    type="time"
                    {...field}
                    onChange={(event) => {
                      field.onChange(event);
                      form.setValue("endTime", addMinutesToTime(event.target.value, form.getValues("duration") || 50));
                    }}
                    className={cn(inputBase, "px-3 text-center font-bold")}
                  />
                  <Clock className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/20 pointer-events-none" />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {showEndTime && (
          <FormField
            control={form.control}
            name="endTime"
            render={({ field }) => (
              <FormItem className="agenda-step-enter w-[124px] space-y-2">
                <FormLabel className={labelBase}>Fim</FormLabel>
                <FormControl>
                  <div className="relative group">
                    <Input
                      type="time"
                      {...field}
                      onChange={(event) => {
                        field.onChange(event);
                        const start = form.getValues("startTime");
                        if (!start || !event.target.value) return;
                        const date = form.getValues("date") || new Date();
                        const startDate = new Date(date);
                        const [startHours, startMinutes] = start.split(":").map(Number);
                        startDate.setHours(startHours, startMinutes, 0, 0);
                        const endDate = new Date(date);
                        const [endHours, endMinutes] = event.target.value.split(":").map(Number);
                        endDate.setHours(endHours, endMinutes, 0, 0);
                        if (endDate <= startDate) endDate.setDate(endDate.getDate() + 1);
                        form.setValue("duration", Math.max(15, differenceInMinutes(endDate, startDate)));
                      }}
                      className={cn(inputBase, "px-3 text-center font-bold")}
                    />
                    <Clock className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/20 pointer-events-none" />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>
    </div>
  );

  // ─── Recurrence Toggle (shared) ───────────────────────────────────

  const renderRecurrenceToggle = () => (
    <div className="pt-1">
      <FormField
        control={form.control}
        name="recurrence"
        render={({ field }) => (
          <FormItem className={cn(cardBase, "flex flex-row items-center justify-between")}>
            <div className="space-y-1">
              <FormLabel className="text-sm font-bold text-foreground flex items-center gap-2">
                <Repeat className="h-4 w-4 text-muted-foreground/60" />
                Recorrência
              </FormLabel>
              <p className="text-xs text-muted-foreground/60">A quantidade total inclui a primeira sessão.</p>
            </div>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-foreground" />
            </FormControl>
          </FormItem>
        )}
      />

      {form.watch("recurrence") && (
        <div className="agenda-step-enter mt-3 space-y-3">
          {seriesTemplates?.length ? (
            <div className="agenda-liquid-surface rounded-[20px] border p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-black text-foreground">
                <WandSparkles className="h-3.5 w-3.5" /> Usar um modelo salvo
              </div>
              <Select value={selectedTemplateId} onValueChange={applySeriesTemplate}>
                <SelectTrigger className="agenda-field h-11 rounded-2xl font-semibold">
                  <SelectValue placeholder="Escolha um modelo e edite só o necessário" />
                </SelectTrigger>
                <SelectContent className="agenda-menu-surface notification-liquid-menu rounded-[18px] p-1.5">
                  {seriesTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id} className="notification-liquid-menu-item rounded-[13px] py-2.5">
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <AdvancedRecurrenceEditor value={recurrenceDraft} onChange={setRecurrenceDraft} />
        </div>
      )}
    </div>
  );

  // ─── STEP 2: Details ──────────────────────────────────────────────

  const renderStep2 = () => (
    <div className="agenda-step-enter space-y-4">
      {eventType === "session" && (
        <>
          <div className="space-y-1.5 mb-4">
            <h3 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
              <div className="p-2 rounded-full bg-secondary/20">
                <FileText className="h-4 w-4 text-foreground" />
              </div>
              Detalhes da Sessão
            </h3>
            <p className="text-sm font-medium text-muted-foreground ml-1">Defina o tipo de atendimento e observações.</p>
          </div>

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem className="space-y-2.5">
                <FormLabel className={labelBase}>Tipo de Sessão</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className={cn(inputBase, "font-medium px-4 shadow-inner")}>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className={selectPopover}>
                    <SelectItem value="first_visit" className="text-foreground/70 focus:bg-accent focus:text-foreground py-3 px-4 cursor-pointer text-sm">
                      Primeira Consulta (Avaliação)
                    </SelectItem>
                    <SelectItem value="follow_up" className="text-foreground/70 focus:bg-accent focus:text-foreground py-3 px-4 cursor-pointer text-sm">
                      Sessão de Acompanhamento
                    </SelectItem>
                    <SelectItem value="emergency" className="text-rose-400 focus:bg-rose-500/10 focus:text-rose-300 py-3 px-4 cursor-pointer text-sm">
                      Emergência / Encaixe
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage className="text-rose-400 pl-1" />
              </FormItem>
            )}
          />

          {/* Modality */}
          <FormField
            control={form.control}
            name="modality"
            render={({ field }) => (
              <FormItem className="space-y-2.5">
                <FormLabel className={labelBase}>Modalidade</FormLabel>
                <FormControl>
                  <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-2 gap-3">
                    {[
                      { id: "presencial", icon: Building2, label: "Presencial" },
                      { id: "online", icon: Video, label: "Online" },
                    ].map((m) => (
                      <FormItem key={m.id}>
                        <FormControl>
                          <RadioGroupItem value={m.id} id={`modality-${m.id}`} className="peer sr-only" />
                        </FormControl>
                        <label
                          htmlFor={`modality-${m.id}`}
                          className="agenda-choice-card flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-[20px] border p-4 text-muted-foreground peer-data-[state=checked]:border-foreground/25 peer-data-[state=checked]:text-foreground"
                        >
                          <m.icon className="h-6 w-6 mb-2" />
                          <span className="text-[9px] font-black uppercase tracking-widest">{m.label}</span>
                        </label>
                      </FormItem>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {modality === "presencial" ? (
            <FormField
              control={form.control}
              name="sessionLocation"
              render={({ field }) => (
                <FormItem className="space-y-2.5">
                  <FormLabel className={labelBase}>Local da consulta</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ex: Clínica, sala 302, endereço completo..."
                      className={cn(inputBase, "px-4 font-medium")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}

          <FormField
            control={form.control}
            name="duration"
            render={({ field }) => (
              <FormItem className="space-y-2.5">
                <FormLabel className={labelBase}>Duração (min)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    onChange={(e) => {
                      const nextDuration = Number(e.target.value);
                      field.onChange(nextDuration);
                      form.setValue("endTime", addMinutesToTime(form.getValues("startTime"), nextDuration || 50));
                    }}
                    className={cn(inputBase, "px-4 font-medium")}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem className="space-y-2.5">
                <FormLabel className={labelBase}>Observações</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Ex: Paciente relatou ansiedade..."
                    className={cn(inputBase, "min-h-[88px] resize-none px-4 py-3 placeholder:text-muted-foreground/50 h-auto")}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}

      {eventType === "event" && (
        <>
          <div className="space-y-1.5 mb-4">
            <h3 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
              <div className="rounded-full bg-primary/10 p-2">
                <StickyNote className="h-4 w-4 text-primary" />
              </div>
              Detalhes do Evento
            </h3>
            <p className="text-sm font-medium text-muted-foreground ml-1">Informações adicionais sobre o compromisso.</p>
          </div>

          <FormField
            control={form.control}
            name="eventLocation"
            render={({ field }) => (
              <FormItem className="space-y-2.5">
                <FormLabel className={labelBase}>Local ou Link</FormLabel>
                <FormControl>
                  <div className="relative group">
                    <Link2 className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30 pointer-events-none" />
                    <Input
                      {...field}
                      placeholder="Ex: Sala 202, endereço completo ou link externo..."
                        className={cn(inputBase, "pl-10 font-medium")}
                    />
                  </div>
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem className="space-y-2.5">
                <FormLabel className={labelBase}>Notas Internas</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Anotações privadas sobre o compromisso..."
                    className={cn(inputBase, "min-h-[88px] resize-none px-4 py-3 placeholder:text-muted-foreground/50 h-auto")}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </>
      )}
    </div>
  );

  // ─── STEP 3: Financial Alignment (Session only) ───────────────────

  const renderStep3 = () => (
    <div className="agenda-step-enter space-y-4">
      <div className="space-y-1.5 mb-4">
        <h3 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
          <div className="p-2 rounded-full bg-secondary/20">
            <DollarSign className="h-4 w-4 text-foreground" />
          </div>
          Fluxo Financeiro
        </h3>
        <p className="text-sm font-medium text-muted-foreground ml-1">Como será cobrado este atendimento?</p>
      </div>

      {/* Loading */}
      {isCheckingFinancialRules && (
        <div className="agenda-liquid-card flex items-center gap-3 rounded-2xl border p-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground font-medium">Verificando planos do paciente...</span>
        </div>
      )}

      {!isCheckingFinancialRules && resolvedFinancial ? (
        <div className="agenda-liquid-surface rounded-[22px] border p-4">
          <div className="flex items-start gap-3">
            <span className="synapse-chat-glass flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border">
              {resolvedFinancial.planType === "insurance"
                ? <Building2 className="h-4 w-4" />
                : <Sparkles className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-foreground">
                {resolvedFinancial.planType === "insurance"
                  ? resolvedFinancial.agreement?.name || "Repasse de convênio"
                  : resolvedFinancial.planType === "monthly"
                    ? "Mensalidade do paciente"
                    : resolvedFinancial.planType === "exempt"
                      ? "Atendimento sem cobrança"
                      : "Configuração sugerida"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {resolvedFinancial.planType === "insurance" && resolvedFinancial.agreement
                  ? resolvedFinancial.agreement.repassType === "percentage"
                    ? `${resolvedFinancial.agreement.repassPercentage || 0}% do repasse · previsão de ${(resolvedFinancial.expectedReceivableCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. Sem cobrança direta por padrão.`
                    : `Repasse previsto de ${(resolvedFinancial.expectedReceivableCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. Sem cobrança direta por padrão.`
                  : resolvedFinancial.planType === "per_session"
                    ? `Valor sugerido: ${(resolvedFinancial.sessionValueCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} por sessão.`
                    : "Esta sessão não gera uma nova cobrança por padrão."}
              </p>
              <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
                Base: {resolvedFinancial.source === "patient_profile"
                  ? "configuração do paciente"
                  : resolvedFinancial.source === "patient_history"
                    ? "histórico recente"
                    : "padrão profissional"}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Cenário A: Paciente tem pacote ativo ─────────────── */}
      {!isCheckingFinancialRules && hasActivePackage && (
        <div className="agenda-step-enter space-y-4">
          {/* Info Card – saldo do pacote */}
          <div className="rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/[0.07] border border-emerald-500/20 p-4">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 shrink-0">
                <Package className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">Pacote Ativo Encontrado</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedPackage?.description || "Pacote"} —{" "}
                  <span className="font-bold text-emerald-500">{remainingSessions} sessões restantes</span>
                </p>
                {usePackageSwitch && (
                  <p className="agenda-step-enter mt-1 text-xs text-muted-foreground/70">
                    {afterDebitSessions === null
                      ? "O saldo necessário será calculado na revisão de todas as datas."
                      : <>Após reserva: <span className={cn("font-mono font-bold", afterDebitSessions <= 1 ? "text-amber-500" : "text-emerald-600 dark:text-emerald-400")}>{afterDebitSessions}</span> sessões</>}
                  </p>
                )}
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            </div>
          </div>

          {/* Switch – usar pacote */}
          <FormField
            control={form.control}
            name="usePackage"
            render={({ field }) => (
              <FormItem className={cn(cardBase, "flex flex-row items-center justify-between")}>
                <div className="space-y-1">
                  <FormLabel className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground/60" />
                    Debitar desta sessão do pacote ativo?
                  </FormLabel>
                  <p className="text-xs text-muted-foreground/60">
                    {field.value
                      ? `Saldo restante passará de ${remainingSessions} para ${afterDebitSessions}.`
                      : "Desative para gerar uma cobrança avulsa."}
                  </p>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={(val) => {
                      field.onChange(val);
                      if (!val) {
                        form.setValue(
                          "shouldCreateTransaction",
                          resolvedFinancial?.planType === "insurance"
                            ? false
                            : resolvedFinancial?.shouldCreateCharge ?? true,
                        );
                        if (form.getValues("transactionAmount") === 0) {
                          form.setValue(
                            "transactionAmount",
                            resolvedFinancial?.sessionValueCents
                              ? resolvedFinancial.sessionValueCents / 100
                              : 150,
                          );
                        }
                      }
                    }}
                    className="data-[state=checked]:bg-emerald-500"
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Seleção de pacote (quando tem múltiplos) */}
          {usePackageSwitch && activePackages && activePackages.length > 1 && (
            <FormField
              control={form.control}
              name="packageId"
              render={({ field }) => (
                <div className="agenda-step-enter space-y-3">
                  <RadioGroup onValueChange={field.onChange} defaultValue={field.value || activePackages[0]?.id} className="grid gap-3">
                    {activePackages.map((pkg) => (
                      <div key={pkg.id}>
                        <RadioGroupItem value={pkg.id} id={pkg.id} className="peer sr-only" />
                        <label
                          htmlFor={pkg.id}
                          className={cn(
                            cardBase,
                            "agenda-choice-card flex cursor-pointer flex-col items-start peer-data-[state=checked]:border-foreground/25"
                          )}
                        >
                          <div className="flex w-full items-center justify-between">
                            <span className="font-bold text-base text-foreground">{pkg.description}</span>
                            <span className="text-xs font-mono text-muted-foreground bg-secondary/50 px-2 py-1 rounded-full">
                              {Math.max(pkg.total_sessions - pkg.sessions_used - (pkg.sessions_reserved || 0), 0)} disponíveis
                            </span>
                          </div>
                        </label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              )}
            />
          )}
        </div>
      )}

      {/* ── Cenário B: Sem pacote ativo ──────────────────────── */}
      {!isCheckingFinancialRules && !hasActivePackage && (
        <div className="agenda-step-enter space-y-4">
          {/* Alerta sutil */}
          <div className="rounded-2xl bg-amber-500/5 dark:bg-amber-500/[0.07] border border-amber-500/20 p-4">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-2xl bg-amber-500/10 shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">
                  {latestPackage
                    ? latestPackageIsExpired
                      ? "Pacote encontrado, mas expirado"
                      : "Pacote sem saldo disponível"
                    : "Nenhum pacote ativo encontrado"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {latestPackage
                    ? `Saldo atual: ${Math.max(latestPackageRemaining, 0)} sessão. Saldo projetado sem cobertura: ${projectedUncoveredBalance} sessão.`
                    : "O paciente não possui pacotes com saldo disponível. Gere um lançamento financeiro avulso ou continue sem cobrança."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Cenário C: Override / Lançamento Financeiro ──────── */}
      {!isCheckingFinancialRules && (!usePackageSwitch || !hasActivePackage) && (
        <div className="agenda-step-enter space-y-4">
          <FormField
            control={form.control}
            name="shouldCreateTransaction"
            render={({ field }) => (
              <FormItem className={cn(cardBase, "flex flex-row items-center justify-between")}>
                <div className="space-y-1">
                  <FormLabel className="text-sm font-bold text-foreground flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground/60" />
                    Gerar Lançamento Financeiro?
                  </FormLabel>
                  <p className="text-xs text-muted-foreground/60">Registra como "A Receber". Desative para continuar sem cobrança.</p>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-foreground" />
                </FormControl>
              </FormItem>
            )}
          />

          {shouldCreateTransaction && (
            <div className="agenda-step-enter space-y-4 pt-1">
              <div className="flex gap-3">
                <FormField
                  control={form.control}
                  name="transactionAmount"
                  render={({ field }) => (
                    <FormItem className="flex-1 space-y-2">
                      <FormLabel className={labelBase}>Valor (R$)</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground/30 text-sm font-bold">R$</span>
                          <Input type="number" {...field} className={cn(inputBase, "pl-10 font-bold")} />
                        </div>
                      </FormControl>
                      <FormMessage className="text-rose-400 pl-1" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="installments"
                  render={({ field }) => (
                    <FormItem className="w-[104px] space-y-2">
                      <FormLabel className={labelBase}>Parcelas</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} min={1} className={cn(inputBase, "text-center font-bold")} />
                      </FormControl>
                      <FormMessage className="text-rose-400 pl-1" />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="transactionMethod"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className={labelBase}>Forma de Pagamento</FormLabel>
                    <FormControl>
                      <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-3 gap-2">
                        {[
                          { id: "pix", icon: QrCode, label: "Pix" },
                          { id: "money", icon: Banknote, label: "Dinheiro" },
                          { id: "credit_card", icon: CreditCard, label: "Cartão" },
                        ].map((m) => (
                          <FormItem key={m.id}>
                            <FormControl>
                              <RadioGroupItem value={m.id} id={`pay-${m.id}`} className="peer sr-only" />
                            </FormControl>
                            <label
                              htmlFor={`pay-${m.id}`}
                              className="agenda-choice-card flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-2xl border p-3 text-muted-foreground peer-data-[state=checked]:border-foreground/25 peer-data-[state=checked]:text-foreground"
                            >
                              <m.icon className="h-6 w-6 mb-2" />
                              <span className="text-[9px] font-black uppercase tracking-widest">{m.label}</span>
                            </label>
                          </FormItem>
                        ))}
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderRecurrencePreview = () => {
    const recurrenceRule = agendaRecurrenceDraftToRule(recurrenceDraft);
    return (
      <div className="agenda-step-enter space-y-4">
        <div className="space-y-1.5">
          <h3 className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
            <span className="rounded-full bg-secondary/20 p-2">
              <Repeat className="h-4 w-4 text-foreground" aria-hidden="true" />
            </span>
            Revisar recorrência
          </h3>
          <p className="ml-1 text-sm font-medium text-muted-foreground">
            Confira todas as datas antes de confirmar. A disponibilidade será revalidada ao criar.
          </p>
        </div>

        {isPreviewingAgendaPlan ? (
          <div className={cn(cardBase, "flex min-h-32 items-center justify-center gap-3")} role="status">
            <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            <span className="text-sm font-medium text-muted-foreground">Verificando todas as datas...</span>
          </div>
        ) : null}

        {!isPreviewingAgendaPlan && seriesPreviewError ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.07] p-4 text-sm text-red-600" role="alert">
            {seriesPreviewError}
          </div>
        ) : null}

        {!isPreviewingAgendaPlan && seriesPreview ? (
          <>
            <div
              className={cn(
                "rounded-2xl border p-4",
                seriesPreview.valid
                  ? "border-emerald-500/25 bg-emerald-500/[0.07]"
                  : "border-amber-500/25 bg-amber-500/[0.07]",
              )}
            >
              <div className="flex items-start gap-3">
                {seriesPreview.valid ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
                )}
                <div>
                  <p className="font-bold text-foreground">
                    {seriesPreview.totalOccurrences} {seriesPreview.totalOccurrences === 1 ? "sessão" : "sessões"} · {recurrenceRuleSummary(recurrenceRule)}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {seriesPreview.valid
                      ? "Todos os horários estão disponíveis neste momento."
                      : `${seriesPreview.conflicts.length} ${seriesPreview.conflicts.length === 1 ? "conflito encontrado" : "conflitos encontrados"}. Volte e ajuste a data ou o horário.`}
                  </p>
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ["Regra", recurrenceRuleSummary(recurrenceRule)],
                ["Quantidade total", String(seriesPreview.totalOccurrences)],
                ["Duração", `${seriesPreview.durationMinutes} min`],
                ["Horário", format(new Date(seriesPreview.firstStartTime), "HH:mm")],
                ["Primeira data", format(new Date(seriesPreview.firstStartTime), "dd/MM/yyyy")],
                ["Última data", format(new Date(seriesPreview.lastStartTime), "dd/MM/yyyy")],
              ].map(([label, value]) => (
                <div key={label} className={cn(cardBase, "space-y-1 p-3")}>
                  <dt className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
                  <dd className="text-sm font-bold text-foreground">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="space-y-2" aria-label="Datas da série">
              <p className={labelBase}>Datas geradas</p>
              <ol className="grid gap-2">
                {seriesPreview.occurrences.map((occurrence) => {
                  const override = recurrenceDraft.overrides.find(
                    (item) => item.occurrenceNumber === occurrence.occurrenceNumber,
                  );
                  return (
                  <li
                    key={`${occurrence.occurrenceNumber}-${occurrence.startTime}`}
                    className={cn(
                      "agenda-liquid-card min-h-12 rounded-2xl border px-4 py-3",
                      occurrence.status === "conflict"
                        ? "border-red-500/25 bg-red-500/[0.06]"
                        : occurrence.occurrenceStatus === "customized"
                          ? "border-sky-500/25 bg-sky-500/[0.06]"
                          : "border-border/60",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background text-xs font-bold tabular-nums">
                          {occurrence.occurrenceNumber}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground">
                            {format(new Date(occurrence.startTime), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                          </p>
                          {occurrence.reason || occurrence.adjustmentReason || occurrence.overrideReason ? (
                            <p className={cn("mt-0.5 text-xs", occurrence.reason ? "text-red-600" : "text-muted-foreground")}>
                              {occurrence.reason || occurrence.adjustmentReason || occurrence.overrideReason}
                            </p>
                          ) : null}
                          {occurrence.occurrenceStatus === "customized" ? (
                            <span className="mt-1 inline-flex rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-black text-sky-600">
                              Personalizada
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                        {format(new Date(occurrence.startTime), "HH:mm")} · {occurrence.durationMinutes} min
                      </span>
                    </div>
                    {recurrenceDraft.customizeOccurrences ? (
                      <div className="mt-3 grid grid-cols-[1fr_100px_90px_44px] gap-2 border-t border-border/45 pt-3">
                        <Input
                          type="date"
                          value={override?.date || format(new Date(occurrence.startTime), "yyyy-MM-dd")}
                          onChange={(event) => updateOccurrenceOverride(occurrence.occurrenceNumber, { date: event.target.value })}
                          className="agenda-field h-11 rounded-xl text-xs font-semibold"
                          aria-label={`Data da sessão ${occurrence.occurrenceNumber}`}
                        />
                        <Input
                          type="time"
                          value={override?.startTime || format(new Date(occurrence.startTime), "HH:mm")}
                          onChange={(event) => updateOccurrenceOverride(occurrence.occurrenceNumber, { startTime: event.target.value })}
                          className="agenda-field h-11 rounded-xl text-xs font-semibold"
                          aria-label={`Horário da sessão ${occurrence.occurrenceNumber}`}
                        />
                        <Input
                          type="number"
                          min={15}
                          max={1440}
                          value={override?.durationMinutes || occurrence.durationMinutes}
                          onChange={(event) => updateOccurrenceOverride(occurrence.occurrenceNumber, { durationMinutes: Number(event.target.value) })}
                          className="agenda-field h-11 rounded-xl text-xs font-semibold"
                          aria-label={`Duração da sessão ${occurrence.occurrenceNumber}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => clearOccurrenceOverride(occurrence.occurrenceNumber)}
                          className="agenda-tactile notification-liquid-control h-11 w-11 rounded-full"
                          aria-label={`Restaurar padrão da sessão ${occurrence.occurrenceNumber}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : null}
                    {occurrence.status === "conflict" ? (
                      <div className="mt-3 border-t border-red-500/15 pt-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => requestSmartFit(occurrence.occurrenceNumber, false)}
                            disabled={isSuggestingAgendaPlanSmartFit}
                            className="agenda-primary-action agenda-tactile min-h-11 rounded-full px-4 text-xs font-black"
                          >
                            {isSuggestingAgendaPlanSmartFit
                              ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              : <WandSparkles className="mr-1.5 h-3.5 w-3.5" />}
                            Sugerir reencaixe
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => requestSmartFit(occurrence.occurrenceNumber, true)}
                            disabled={isSuggestingAgendaPlanSmartFit}
                            className="agenda-tactile notification-liquid-control min-h-11 rounded-full px-4 text-xs font-bold"
                          >
                            Incluir janelas de 30 min
                          </Button>
                        </div>
                        {smartFitSuggestions[occurrence.occurrenceNumber]?.length ? (
                          <div className="mt-2 grid gap-2">
                            {smartFitSuggestions[occurrence.occurrenceNumber].map((candidate) => (
                              <button
                                key={`${candidate.startTime}-${candidate.durationMinutes}`}
                                type="button"
                                onClick={() => applySmartFitCandidate(occurrence.occurrenceNumber, candidate)}
                                className="agenda-choice-card agenda-tactile synapse-chat-glass flex min-h-11 items-center justify-between rounded-[15px] border px-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <span className="text-xs font-black text-foreground">
                                  {format(new Date(candidate.startTime), "EEE, dd/MM · HH:mm", { locale: ptBR })}
                                </span>
                                <span className="text-[10px] font-bold text-muted-foreground">
                                  {candidate.durationMinutes} min{candidate.keepsFullDuration ? " · duração preservada" : " · duração reduzida"}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                  );
                })}
              </ol>
            </div>

            {recurrenceDraft.customizeOccurrences ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => loadSeriesPreview(form.getValues())}
                disabled={isPreviewingAgendaPlan}
                className="notification-liquid-control h-11 w-full rounded-full font-bold"
              >
                {isPreviewingAgendaPlan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Repeat className="mr-2 h-4 w-4" />}
                Revalidar personalizações
              </Button>
            ) : null}

            <div className="agenda-liquid-surface rounded-[22px] border p-4">
              <div className="flex items-start gap-3">
                <span className="synapse-chat-glass flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border">
                  <Save className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-foreground">Salvar como modelo</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Reutiliza regra, duração e modalidade. Paciente e financeiro nunca são copiados.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Input
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  placeholder="Ex.: 4 sessões · terceira de manhã"
                  className="agenda-field h-11 rounded-2xl font-semibold"
                  aria-label="Nome do modelo de recorrência"
                />
                <Button
                  type="button"
                  onClick={handleSaveSeriesTemplate}
                  disabled={isSavingTemplate}
                  className="agenda-primary-action agenda-tactile h-11 rounded-full px-4 font-bold"
                >
                  {isSavingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                </Button>
              </div>
            </div>

            <p className="agenda-liquid-card rounded-2xl border border-border/60 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
              A série, seus agendamentos e, quando escolhido, as reservas do pacote serão criados na mesma operação. Cobranças, e-mails em lote e notas fiscais não serão gerados nesta etapa.
            </p>
          </>
        ) : null}
      </div>
    );
  };

  // ─── Progress Dots ────────────────────────────────────────────────

  const renderProgressDots = () => {
    if (totalSteps <= 1) return null;
    return (
      <div
        className="mt-2 flex items-center gap-3"
        aria-label={`Etapa ${step} de ${totalSteps}: ${stepLabels[step - 1]}`}
      >
        <span className="text-[11px] font-semibold text-muted-foreground">
          Etapa {step} de {totalSteps} · {stepLabels[step - 1]}
        </span>
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {stepLabels.map((label, index) => (
            <span
              key={label}
              className={cn(
                "h-1 rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none",
                step >= index + 1 ? "w-8 bg-primary" : "w-4 bg-primary/20",
              )}
            />
          ))}
        </div>
      </div>
    );
  };

  // ─── Modal Title ──────────────────────────────────────────────────

  const modalTitle = useMemo(() => {
    if (eventType === "event") return "Novo Compromisso";
    return "Novo Agendamento";
  }, [eventType]);

  // ─── Footer Button Logic ──────────────────────────────────────────

  const canAdvance = step < totalSteps;

  const handleContinue = async () => {
    if (eventType === "session" && step === 1) {
      const isValid = await form.trigger([
        "patientId",
        "date",
        "startTime",
        "endTime",
        "recurrence",
        "recurrenceFrequency",
        "recurrenceCount",
      ]);
      if (isValid) nextStep();
    } else if (eventType === "session" && step === 2) {
      const isValid = await form.trigger(["type", "modality", "duration"]);
      if (isValid) nextStep();
      else setSubmissionError("Revise o campo destacado para continuar.");
    } else if (eventType === "session" && recurrenceEnabled && step === 3) {
      const isValid = await form.trigger([
        "shouldCreateTransaction",
        "transactionAmount",
        "transactionMethod",
        "installments",
        "usePackage",
        "packageId",
      ]);
      if (isValid) {
        const preview = await loadSeriesPreview(form.getValues());
        if (preview) nextStep();
      } else {
        setSubmissionError("Revise o campo destacado para continuar.");
      }
    } else if (eventType === "event" && step === 1) {
      const isValid = await form.trigger([
        "eventTitle",
        "eventCategory",
        "date",
        "startTime",
        "endTime",
        "recurrence",
        "recurrenceFrequency",
        "recurrenceCount",
      ]);
      if (isValid) nextStep();
    } else if (eventType === "event" && step === 2 && recurrenceEnabled) {
      await loadSeriesPreview(form.getValues());
      nextStep();
    } else {
      nextStep();
    }
  };

  const submitButtonLabel = useMemo(() => {
    if (recurrenceEnabled) return "Criar série";
    if (eventType === "event") return "Registrar Evento";
    return "Registrar Agendamento";
  }, [eventType, recurrenceEnabled]);

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <ResponsiveModal
      dataSynapseTarget="new-appointment-modal"
      open={isOpen}
      onOpenChange={onOpenChange}
      trigger={children}
      showCloseButton={false}
      className="agenda-modal-surface agenda-viewport-modal desktop-retina-modal desktop-retina-form flex w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-[28px] border p-0 sm:max-w-[640px]"
      drawerClassName="max-h-[92dvh]"
      contentStyle={{ maxHeight: "min(680px, calc(100dvh - 1rem))" }}
    >
      <div className="agenda-modal-body flex min-h-0 flex-1 flex-col">
        {/* Header */}
        <div className="agenda-modal-header flex shrink-0 items-center justify-between border-b px-5 pb-3 pt-5 sm:px-6">
          <div>
            <h2 className="text-xl font-bold text-foreground tracking-tight">{modalTitle}</h2>
            {renderProgressDots()}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="agenda-tactile notification-liquid-control h-11 w-11 rounded-full border border-border/50 text-muted-foreground hover:text-foreground"
            aria-label="Fechar novo agendamento"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>

        {/* Body */}
        <div className="px-5 py-3 sm:px-6 overflow-y-auto custom-scrollbar flex-1 min-h-0">
          <Form {...form}>
            <form
              id={APPOINTMENT_FORM_ID}
              onSubmit={form.handleSubmit(onSubmit, onInvalid)}
              className="space-y-3"
            >
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && (
                eventType === "session"
                  ? renderStep3()
                  : recurrenceEnabled
                    ? renderRecurrencePreview()
                    : null
              )}
              {step === 4 && recurrenceEnabled && eventType === "session" && renderRecurrencePreview()}
              {submissionError ? (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
                >
                  {submissionError}
                </div>
              ) : null}
            </form>
          </Form>
        </div>

        {/* Footer */}
        <div className="agenda-modal-footer flex shrink-0 items-center justify-between border-t p-4 backdrop-blur-xl">
          {step > 1 ? (
            <Button
              type="button"
              variant="ghost"
              onClick={prevStep}
              className="agenda-tactile notification-liquid-control h-11 rounded-full px-5 text-muted-foreground hover:text-foreground"
            >
              Voltar
            </Button>
          ) : (
            <div />
          )}

          {canAdvance ? (
            <Button
              type="button"
              onClick={handleContinue}
              className="agenda-primary-action h-11 rounded-full px-6 font-bold tracking-wide"
            >
              Continuar
            </Button>
          ) : (
            <Button
              type="submit"
              form={APPOINTMENT_FORM_ID}
              disabled={isSubmitting || (recurrenceEnabled && !seriesPreview?.valid)}
              className={cn(
                "agenda-primary-action h-11 rounded-full px-6 font-bold tracking-wide",
              )}
            >
              {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : submitButtonLabel}
            </Button>
          )}
        </div>
      </div>
    </ResponsiveModal>
  );
}
