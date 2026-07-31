import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
  CircleHelp,
  MapPin,
  ExternalLink,
  ReceiptText,
  Pencil,
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
import { useAddAppointment, type NewAppointmentData } from "@/hooks/use-add-appointment";
import { useActivePatientPackages } from "@/hooks/use-active-patient-packages";
import { usePatientPackages } from "@/hooks/use-patient-packages";
import { useFinancialAccount } from "@/hooks/use-financial-account";
import { useNeurofinanceSimulator, type SimulatorMethod } from "@/hooks/use-neurofinance-simulator";
import { useProfile } from "@/hooks/use-profile";
import { useSubscription } from "@/context/SubscriptionContext";
import {
  useAgendaSeriesTemplates,
  useAgendaV2,
  useProfessionalAgendaTimezone,
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
  getSessionTypeLabel,
} from "@/lib/appointment-metadata";
import {
  APPOINTMENT_FORM_ID,
  appointmentPayloadFingerprint,
  findFirstInvalidAppointmentField,
  getAppointmentErrorMessage,
  getAppointmentFieldOrder,
  getAppointmentFieldsForStep,
  getAppointmentFieldStep,
  getInitialAppointmentSlot,
  getAppointmentStepLabels,
  getOccurrenceOverrideIssue,
  normalizeOccurrenceOverride,
  dateAtTimeInZone,
  revealAppointmentField,
  resolveAppointmentFinancialMode,
  validateAppointmentTiming,
} from "@/lib/appointment-form-flow";
import { AdvancedRecurrenceEditor } from "@/components/agenda/AdvancedRecurrenceEditor";
import { EventCategoryManagerDialog } from "@/components/agenda/EventCategoryManagerDialog";
import { useProfessionalEventCategories } from "@/hooks/use-professional-event-categories";
import {
  agendaRecurrenceDraftToRule,
  agendaRuleToRecurrenceDraft,
  createAgendaRecurrenceDraft,
  recurrenceRuleSummary,
  type AgendaRecurrenceDraft,
  type OccurrenceOverride,
} from "@/lib/agenda-scheduling";
import { getAppointmentRecurrenceTerminology } from "@/lib/appointment-recurrence-terminology";
import { DEFAULT_PROFESSIONAL_EVENT_CATEGORIES } from "@/lib/professional-event-categories";
import {
  AppointmentPlanReviewRequiredError,
  isAppointmentPlanReviewRequiredError,
  type AppointmentActionPlan,
} from "@/lib/appointment-action-plans";
import {
  hasNeurofinancePatientDocument,
  patientRegistrationPath,
} from "@/lib/neurofinance-patient-document";
import { getAppointmentPlanErrorMessage } from "@/lib/appointment-action-plan-errors";
import { useNavigate } from "react-router-dom";

// ─── Validação ────────────────────────────────────────────────────────

const createFormSchema = (timeZone: string) => z
  .object({
    eventType: z.enum(["session", "event"]).default("session"),

    // Sessão Clínica
    patientId: z.string().optional(),
    date: z.date({ required_error: "Selecione uma data" }).refine(
      (d) => d >= startOfDay(new Date()),
      { message: "Não é possível agendar para datas passadas" }
    ),
    startTime: z.string().min(1, "Horário de início obrigatório"),
    duration: z.number().min(15, "Mínimo 15 minutos").max(1440, "Máximo 24 horas"),
    type: z.enum(["first_visit", "follow_up", "emergency", "block"]).default("follow_up"),
    modality: z.enum(["presencial", "online"]).default("presencial"),
    sessionLocation: z.string().optional(),
    notes: z.string().optional(),

    // Evento Geral
    eventTitle: z.string().trim().optional(),
    eventCategory: z.string().optional(),
    endTime: z.string().optional(),
    eventLocation: z.string().optional(),

    // Financeiro
    shouldCreateTransaction: z.boolean().default(false),
    shouldGenerateNeurofinanceCharge: z.boolean().default(false),
    transactionAmount: z.coerce.number().optional(),
    transactionMethod: z.enum(["patient_choice", "pix", "money", "credit_card", "debit_card", "boleto", "mixed"]).optional(),
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
  )
  .refine(
    (data) => data.eventType !== "session" || !data.usePackage || Boolean(data.packageId),
    { message: "Selecione o pacote que será utilizado", path: ["packageId"] },
  )
  .refine(
    (data) => !data.shouldGenerateNeurofinanceCharge || data.shouldCreateTransaction,
    { message: "Ative o lançamento financeiro para gerar a cobrança", path: ["shouldGenerateNeurofinanceCharge"] },
  )
  .superRefine((data, context) => {
    validateAppointmentTiming({
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      timeZone,
    }).forEach((issue) => {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [issue.field],
        message: issue.message,
      });
    });
  });

type FormValues = z.infer<ReturnType<typeof createFormSchema>>;

// ─── Constantes ───────────────────────────────────────────────────────

const addMinutesToTime = (time: string, minutesToAdd: number) => {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes + minutesToAdd, 0, 0);
  return format(date, "HH:mm");
};

const buildAppointmentTimes = (values: FormValues, timeZone: string) => {
  const startDateTime = dateAtTimeInZone(values.date, values.startTime, timeZone);
  if (!startDateTime) throw new Error("Data ou horário inicial inválido.");

  let endDateTime: Date;
  if (values.endTime) {
    const resolvedEnd = dateAtTimeInZone(values.date, values.endTime, timeZone);
    if (!resolvedEnd) throw new Error("Horário final inválido.");
    endDateTime = resolvedEnd;
  } else {
    endDateTime = new Date(startDateTime);
    endDateTime.setMinutes(endDateTime.getMinutes() + values.duration);
  }

  return { startDateTime, endDateTime };
};

const normalizeFinancialEntryPaymentMethod = (method?: FormValues["transactionMethod"]) => {
  if (method === "pix" || method === "boleto") return method;
  if (method === "credit_card" || method === "debit_card") return "card";
  if (method === "money") return "cash";
  return "other";
};

const neurofinancePaymentMethods = (method?: FormValues["transactionMethod"]) => {
  if (method === "patient_choice") return ["pix", "card", "boleto"];
  if (method === "credit_card" || method === "debit_card") return ["card"];
  if (method === "pix" || method === "boleto") return [method];
  return ["pix", "card", "boleto"];
};

const professionalLocationFromProfile = (
  profile?: {
    address?: string | null;
    professional_address?: Record<string, unknown> | null;
  } | null,
) => {
  const structuredLabel = profile?.professional_address?.label;
  if (typeof structuredLabel === "string" && structuredLabel.trim()) return structuredLabel.trim();
  return profile?.address?.trim() || "";
};

const paymentMethodLabel = (method?: FormValues["transactionMethod"]) => {
  if (method === "patient_choice") return "Paciente decide";
  if (method === "credit_card") return "Cartão";
  if (method === "debit_card") return "Débito";
  if (method === "money") return "Dinheiro";
  if (method === "boleto") return "Boleto";
  if (method === "mixed") return "Misto";
  return "Pix";
};

const neurofinanceMethodLabel = (method: string) => {
  if (method === "card") return "Cartão";
  if (method === "boleto") return "Boleto";
  return "Pix";
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
  const [seriesPreviewFingerprint, setSeriesPreviewFingerprint] = useState<string | null>(null);
  const [seriesPreviewError, setSeriesPreviewError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [validationAnnouncement, setValidationAnnouncement] = useState("");
  const [recurrenceDraft, setRecurrenceDraft] = useState<AgendaRecurrenceDraft>(() =>
    createAgendaRecurrenceDraft(selectedDate || initialDate || new Date()),
  );
  const [templateName, setTemplateName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templateDraftName, setTemplateDraftName] = useState("");
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [smartFitSuggestions, setSmartFitSuggestions] = useState<Record<number, AgendaPlanSmartFitCandidate[]>>({});
  const [preparedSinglePlan, setPreparedSinglePlan] = useState<{
    fingerprint: string;
    idempotencyKey: string;
    plan: AppointmentActionPlan;
  } | null>(null);
  const [preparedSeriesPlan, setPreparedSeriesPlan] = useState<{
    fingerprint: string;
    idempotencyKey: string;
    plan: AppointmentActionPlan;
  } | null>(null);
  const [isPreparingSinglePlan, setIsPreparingSinglePlan] = useState(false);
  const [isPreparingSeriesPlan, setIsPreparingSeriesPlan] = useState(false);
  const idempotencyIntentRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const previewRequestSequenceRef = useRef(0);
  const singlePlanRequestSequenceRef = useRef(0);
  const seriesPlanRequestSequenceRef = useRef(0);
  const currentSingleFingerprintRef = useRef<string | null>(null);
  const currentSingleIdempotencyKeyRef = useRef<string | null>(null);
  const currentSeriesFingerprintRef = useRef<string | null>(null);
  const currentSeriesIdempotencyKeyRef = useRef<string | null>(null);
  const lastSingleDraftIdentityRef = useRef<string | null>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);
  const { data: patients } = usePatients();
  const navigate = useNavigate();
  const {
    mutateAsync: createAppointment,
    prepareAsync: prepareAppointment,
    isPending: isCreatingAppointment,
  } = useAddAppointment();
  const { profile, rememberAppointmentLocation } = useProfile();
  const { canAccess, isLoading: isLoadingSubscription } = useSubscription();
  const {
    account: financialAccount,
    isApproved: isFinancialAccountApproved,
    isLoading: isLoadingFinancialAccount,
  } = useFinancialAccount();
  const { simulate: simulateNeurofinance } = useNeurofinanceSimulator();
  const { data: professionalTimezone = "America/Sao_Paulo" } = useProfessionalAgendaTimezone();
  const {
    previewAgendaPlan,
    prepareAgendaSeries,
    executePreparedAgendaSeries,
    isPreviewingAgendaPlan,
    isPreparingAgendaSeries,
    isCreatingAgendaSeries,
    suggestAgendaPlanSmartFit,
    isSuggestingAgendaPlanSmartFit,
  } = useAgendaV2();
  const {
    data: seriesTemplates,
    saveTemplate,
    isSavingTemplate,
    renameTemplate,
    isRenamingTemplate,
    archiveTemplate,
    isArchivingTemplate,
  } = useAgendaSeriesTemplates();

  const effectiveDate = selectedDate || initialDate;
  const initialSlot = getInitialAppointmentSlot({
    effectiveDate,
    selectedTime,
    workingHours: profile?.working_hours,
  });
  const formSchema = useMemo(
    () => createFormSchema(professionalTimezone),
    [professionalTimezone],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      eventType: "session",
      patientId: "",
      date: initialSlot.date,
      startTime: initialSlot.startTime,
      duration: 50,
      type: "follow_up",
      modality: "presencial",
      sessionLocation: "",
      notes: "",
      eventTitle: "",
      eventCategory: "",
      endTime: addMinutesToTime(initialSlot.startTime, 50),
      eventLocation: "",
      shouldCreateTransaction: false,
      shouldGenerateNeurofinanceCharge: false,
      transactionAmount: 0,
      transactionMethod: "patient_choice",
      installments: 1,
      usePackage: false,
      recurrence: false,
      recurrenceFrequency: "weekly",
      recurrenceCount: 4,
    },
  });

  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (!isOpen || selectedTime) return;
    if (!justOpened && !profile?.working_hours) return;
    if (form.formState.dirtyFields.date || form.formState.dirtyFields.startTime) return;
    const slot = getInitialAppointmentSlot({
      effectiveDate,
      workingHours: profile?.working_hours,
      durationMinutes: form.getValues("duration") || 50,
    });
    form.setValue("date", slot.date);
    form.setValue("startTime", slot.startTime);
    form.setValue("endTime", addMinutesToTime(slot.startTime, form.getValues("duration") || 50));
  }, [effectiveDate, form, isOpen, profile?.working_hours, selectedTime]);

  // Atualizar data quando selecionada externamente
  useEffect(() => {
    if (effectiveDate) {
      const slot = getInitialAppointmentSlot({
        effectiveDate,
        selectedTime,
        durationMinutes: form.getValues("duration") || 50,
      });
      form.setValue("date", slot.date);
      if (!selectedTime) {
        form.setValue("startTime", slot.startTime);
        form.setValue("endTime", addMinutesToTime(slot.startTime, form.getValues("duration") || 50));
      }
    }
    if (effectiveDate) {
      setRecurrenceDraft((current) => ({
        ...current,
        weekDays: current.overrides.length ? current.weekDays : [effectiveDate.getDay()],
        monthDays: current.overrides.length ? current.monthDays : [effectiveDate.getDate()],
      }));
    }
  }, [effectiveDate, form, selectedTime]);

  useEffect(() => {
    if (!selectedTime) return;
    form.setValue("startTime", selectedTime);
    form.setValue("endTime", addMinutesToTime(selectedTime, form.getValues("duration") || 50));
  }, [selectedTime, form]);

  const eventType = form.watch("eventType");
  const recurrenceTerminology = getAppointmentRecurrenceTerminology(eventType);
  const {
    categories: persistedEventCategories,
    isSuccess: eventCategoriesLoaded,
  } = useProfessionalEventCategories({ enabled: eventType === "event" });
  const eventCategories = eventCategoriesLoaded
    ? persistedEventCategories
    : DEFAULT_PROFESSIONAL_EVENT_CATEGORIES;
  const compatibleSeriesTemplates = useMemo(
    () =>
      (seriesTemplates || []).filter((template) => {
        const latestVersion = [...template.appointment_series_template_versions]
          .sort((left, right) => right.version_number - left.version_number)[0];
        const templateEventType = latestVersion?.default_config?.eventType;
        return eventType === "event"
          ? templateEventType === "event"
          : templateEventType !== "event";
      }),
    [eventType, seriesTemplates],
  );
  const selectedPatientId = form.watch("patientId");
  const selectedPatient = useMemo(
    () => patients?.find((patient) => patient.id === selectedPatientId) || null,
    [patients, selectedPatientId],
  );
  const hasPatientDocument = hasNeurofinancePatientDocument(selectedPatient);
  const professionalDefaultLocation = useMemo(
    () => professionalLocationFromProfile(profile),
    [profile],
  );
  const hasNeurofinanceEntitlement = canAccess("advanced_finance");
  const canUseNeurofinance =
    hasNeurofinanceEntitlement
    && isFinancialAccountApproved
    && financialAccount?.charges_enabled !== false;
  const {
    data: resolvedFinancial,
    isLoading: isResolvingFinancial,
    isError: isFinancialResolutionError,
    refetch: retryFinancialResolution,
  } = usePatientFinancialResolution(eventType === "session" ? selectedPatientId : null);
  const selectedPackageId = form.watch("packageId");
  const usePackageSwitch = form.watch("usePackage");
  const shouldCreateTransaction = form.watch("shouldCreateTransaction");
  const shouldGenerateNeurofinanceCharge = form.watch("shouldGenerateNeurofinanceCharge");
  const startTime = form.watch("startTime");
  const duration = form.watch("duration");
  const modality = form.watch("modality");
  const recurrenceEnabled = form.watch("recurrence");
  const recurrenceFrequency = form.watch("recurrenceFrequency");
  const recurrenceCount = form.watch("recurrenceCount") || 1;
  const selectedFormDate = form.watch("date");
  const selectedEndTime = form.watch("endTime");
  const watchedFormValues = form.watch();

  useEffect(() => {
    if (!isOpen || !professionalDefaultLocation) return;
    if (form.getValues("sessionLocation") || form.formState.dirtyFields.sessionLocation) return;
    form.setValue("sessionLocation", professionalDefaultLocation);
  }, [form, isOpen, professionalDefaultLocation]);

  useEffect(() => {
    if (eventType === "event") return;
    if (!startTime || !duration) return;
    form.setValue("endTime", addMinutesToTime(startTime, duration));
  }, [duration, eventType, form, startTime]);

  useEffect(() => {
    setSeriesPreview(null);
    setSeriesPreviewFingerprint(null);
    setSeriesPreviewError(null);
    previewRequestSequenceRef.current += 1;
  }, [
    duration,
    eventType,
    recurrenceCount,
    recurrenceEnabled,
    recurrenceFrequency,
    selectedEndTime,
    selectedFormDate,
    startTime,
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
    setSelectedTemplateId("");
    setTemplateDraftName("");
    setSubmissionError(null);
    setValidationAnnouncement("");
    if (eventType === "event") {
      form.setValue("usePackage", false);
      form.setValue("packageId", "");
      form.setValue("shouldCreateTransaction", false);
      form.setValue("shouldGenerateNeurofinanceCharge", false);
      form.setValue("transactionAmount", 0);
      form.clearErrors([
        "usePackage",
        "packageId",
        "shouldCreateTransaction",
        "shouldGenerateNeurofinanceCharge",
        "transactionAmount",
        "transactionMethod",
        "installments",
      ]);
    }
  }, [eventType, form]);

  useEffect(() => {
    if (!isOpen) setIsCategoryManagerOpen(false);
  }, [isOpen]);

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
  const isCheckingFinancialRules = Boolean(selectedPatientId)
    && (isLoadingPackages || isLoadingPatientPackages || isResolvingFinancial);
  const isSubmitting =
    isCreatingAppointment ||
    isPreparingSinglePlan ||
    isPreparingSeriesPlan ||
    isPreparingAgendaSeries ||
    isPreviewingAgendaPlan ||
    isCreatingAgendaSeries;

  // Cada paciente começa com uma decisão financeira neutra. Sugestões e pacotes
  // continuam visíveis, mas só são aplicados depois de uma escolha explícita.
  useEffect(() => {
    if (eventType !== "session") return;
    form.setValue("usePackage", false);
    form.setValue("packageId", "");
    form.setValue("shouldCreateTransaction", false);
    form.setValue("shouldGenerateNeurofinanceCharge", false);
    form.setValue("transactionAmount", 0);
  }, [eventType, form, selectedPatientId]);

  useEffect(() => {
    if (eventType !== "session" || isCheckingFinancialRules || !activePackages?.length) return;
    if (!form.getValues("packageId")) {
      form.setValue("packageId", activePackages[0].id);
    }
  }, [activePackages, eventType, form, isCheckingFinancialRules]);

  // Zerar valor da transação quando usa pacote
  useEffect(() => {
    if (usePackageSwitch && activePackages?.length) {
      form.setValue("transactionAmount", 0);
      form.setValue("shouldCreateTransaction", false);
      form.setValue("shouldGenerateNeurofinanceCharge", false);
    }
  }, [usePackageSwitch, activePackages, form]);

  useEffect(() => {
    if (!shouldCreateTransaction || !canUseNeurofinance) {
      form.setValue("shouldGenerateNeurofinanceCharge", false);
    }
  }, [canUseNeurofinance, form, shouldCreateTransaction]);

  // ── Número total de passos ─────────────────────────────────────────
  const stepLabels = getAppointmentStepLabels(eventType, recurrenceEnabled);
  const totalSteps = stepLabels.length;

  const buildAgendaPlanInput = useCallback((
    values: FormValues,
    metadata?: ReturnType<typeof buildSessionMetadata> | ReturnType<typeof buildEventMetadata>,
    recurrence = recurrenceDraft,
  ): AgendaV2PlanInput => {
    const { startDateTime, endDateTime } = buildAppointmentTimes(values, professionalTimezone);
    const recurrenceRule = agendaRecurrenceDraftToRule(recurrence);
    const sessionLocation = values.modality === "online"
      ? "Teleconsulta NeuroNex"
      : values.sessionLocation?.trim() || "Consultório";
    const eventLocation = values.eventLocation?.trim() || null;
    const selectedFinancialMode = resolveAppointmentFinancialMode({
      eventType: values.eventType,
      usePackage: values.usePackage,
      packageId: selectedPackage?.id || values.packageId,
      shouldCreateTransaction: values.shouldCreateTransaction,
      shouldGenerateNeurofinanceCharge: values.shouldGenerateNeurofinanceCharge,
      canUseNeurofinance,
      insuranceConfigured: resolvedFinancial?.planType === "insurance",
    });

    const financial: AgendaV2PlanInput["financial"] = selectedFinancialMode === "package"
      ? {
          mode: "package",
          package_id: selectedPackage?.id || values.packageId || null,
          charge_mode: "per_occurrence",
        }
      : selectedFinancialMode === "neurofinance"
        ? {
            mode: "neurofinance",
            value_per_session: values.transactionAmount || 0,
            payment_method: normalizeFinancialEntryPaymentMethod(values.transactionMethod),
            installments: values.installments || 1,
            charge_mode: "per_occurrence",
          }
          : selectedFinancialMode === "manual"
          ? {
              mode: "manual",
              value_per_session: values.transactionAmount || 0,
              payment_method: normalizeFinancialEntryPaymentMethod(values.transactionMethod),
              charge_mode: "per_occurrence",
            }
          : selectedFinancialMode === "insurance"
            ? {
                mode: "insurance",
                value_per_session: (resolvedFinancial?.expectedReceivableCents || 0) / 100,
                charge_mode: "per_occurrence",
              }
          : { mode: "none" };

    return {
      patient_id: values.eventType === "session" ? values.patientId || null : null,
      first_start_time: startDateTime.toISOString(),
      duration_minutes: Math.max(15, differenceInMinutes(endDateTime, startDateTime)),
      timezone: professionalTimezone,
      type: values.eventType === "session" ? values.modality : "block",
      recurrence_rule: toAgendaV2RecurrenceRule(recurrenceRule),
      overrides: toAgendaV2Overrides(recurrence.overrides),
      excluded_occurrence_numbers: recurrence.excludedOccurrenceNumbers,
      notes: values.notes?.trim() || null,
      location: values.eventType === "event" ? eventLocation : sessionLocation,
      metadata,
      template_version_id: selectedTemplateId
        ? [...(seriesTemplates?.find((item) => item.id === selectedTemplateId)?.appointment_series_template_versions || [])]
            .sort((left, right) => right.version_number - left.version_number)[0]?.id || null
        : null,
      default_config: values.eventType === "event"
        ? {
            eventType: "event",
            durationMinutes: values.duration,
            eventCategory: values.eventCategory || null,
            eventLocation,
            metadata: metadata || {},
            notes: values.notes?.trim() || null,
            location: eventLocation,
            excluded_occurrence_numbers: recurrence.excludedOccurrenceNumbers,
          }
        : {
            eventType: "session",
            type: values.type,
            modality: values.modality,
            durationMinutes: values.duration,
            location: sessionLocation,
            metadata: metadata || {},
            notes: values.notes?.trim() || null,
            excluded_occurrence_numbers: recurrence.excludedOccurrenceNumbers,
          },
      financial,
    };
  }, [
    canUseNeurofinance,
    professionalTimezone,
    recurrenceDraft,
    resolvedFinancial?.expectedReceivableCents,
    resolvedFinancial?.planType,
    selectedPackage?.id,
    selectedTemplateId,
    seriesTemplates,
  ]);

  const currentPreviewFingerprint = appointmentPayloadFingerprint(
    buildAgendaPlanInput(watchedFormValues),
  );

  const idempotencyKeyForPayload = useCallback((payload: unknown) => {
    const fingerprint = appointmentPayloadFingerprint(payload);
    if (idempotencyIntentRef.current?.fingerprint !== fingerprint) {
      idempotencyIntentRef.current = {
        fingerprint,
        key: `agenda-${crypto.randomUUID()}`,
      };
    }
    return idempotencyIntentRef.current.key;
  }, []);

  const buildAppointmentIntentContext = useCallback((values: FormValues) => {
    const { startDateTime, endDateTime } = buildAppointmentTimes(values, professionalTimezone);
    const selectedFinancialMode = resolveAppointmentFinancialMode({
      eventType: values.eventType,
      usePackage: values.usePackage,
      packageId: selectedPackage?.id || values.packageId,
      shouldCreateTransaction: values.shouldCreateTransaction,
      shouldGenerateNeurofinanceCharge: values.shouldGenerateNeurofinanceCharge,
      canUseNeurofinance,
      insuranceConfigured: resolvedFinancial?.planType === "insurance",
    });
    const durationMinutes = Math.round((endDateTime.getTime() - startDateTime.getTime()) / 60_000);
    const metadata = values.eventType === "event"
      ? buildEventMetadata({
          title: values.eventTitle || "Compromisso",
          category: values.eventCategory || "outro",
          categoryLabel: eventCategories.find((item) => item.slug === values.eventCategory)?.name,
          location: values.eventLocation || null,
          notes: values.notes || "",
          origin: "neuronex",
          syncStatus: "not_configured",
        })
      : buildSessionMetadata({
          sessionType: values.type,
          modality: values.modality,
          durationMinutes,
          notes: values.notes || "",
          origin: "neuronex",
          syncStatus: "not_configured",
          financial: {
            mode: selectedFinancialMode,
            usePackage: values.usePackage,
            packageId: values.packageId || selectedPackage?.id || null,
            transactionAmount: values.shouldCreateTransaction
              ? values.transactionAmount || 0
              : null,
            transactionMethod: values.transactionMethod || null,
            installments: values.installments || 1,
            neurofinanceChargeRequested: values.shouldGenerateNeurofinanceCharge,
          },
        });

    return {
      startDateTime,
      endDateTime,
      selectedFinancialMode,
      metadata,
    };
  }, [
    canUseNeurofinance,
    eventCategories,
    professionalTimezone,
    resolvedFinancial?.planType,
    selectedPackage?.id,
  ]);

  const buildSingleAppointmentIntent = useCallback((values: FormValues) => {
    const {
      startDateTime,
      endDateTime,
      selectedFinancialMode,
      metadata,
    } = buildAppointmentIntentContext(values);

    let notes = values.notes || "";
    let location: string | null = null;
    if (values.eventType === "event") {
      notes = buildEventNotesFromMetadata(metadata);
      location = values.eventLocation || null;
    } else {
      const prefix = values.type === "first_visit" ? "[Primeira Consulta] " : "";
      notes = `${prefix}${values.notes || (values.type === "first_visit" ? "Primeira Consulta" : "")}`;
      location = values.modality === "online"
        ? "Teleconsulta NeuroNex"
        : values.sessionLocation?.trim() || "Consultório";
    }

    const payloadBase: Omit<NewAppointmentData, "idempotency_key" | "prepared_plan"> = {
      patient_id: values.eventType === "session" ? values.patientId || null : null,
      start_time: startDateTime,
      end_time: endDateTime,
      type: values.eventType === "session" ? values.modality : "block",
      notes,
      location,
      metadata,
      package_id: selectedFinancialMode === "package"
        ? selectedPackage?.id || values.packageId || null
        : null,
      financial: selectedFinancialMode === "package"
        ? {
            mode: "package",
            value_per_session: 0,
            total: 0,
            charge_mode: "per_occurrence",
          }
        : selectedFinancialMode === "manual"
          ? {
              mode: "manual",
              value_per_session: values.transactionAmount || 0,
              total: values.transactionAmount || 0,
              charge_mode: "per_occurrence",
              payment_method: normalizeFinancialEntryPaymentMethod(values.transactionMethod),
              installments: values.installments || 1,
            }
          : selectedFinancialMode === "neurofinance"
            ? {
                mode: "neurofinance",
                value_per_session: values.transactionAmount || 0,
                total: values.transactionAmount || 0,
                charge_mode: "per_occurrence",
                payment_method: normalizeFinancialEntryPaymentMethod(values.transactionMethod),
                installments: values.installments || 1,
              }
            : selectedFinancialMode === "insurance"
              ? {
                  mode: "insurance",
                  value_per_session: (resolvedFinancial?.expectedReceivableCents || 0) / 100,
                  total: (resolvedFinancial?.expectedReceivableCents || 0) / 100,
                  charge_mode: "per_occurrence",
                }
              : {
                  mode: "none",
                  value_per_session: 0,
                  total: 0,
                  charge_mode: "per_occurrence",
                },
    };
    const fingerprint = appointmentPayloadFingerprint(payloadBase);

    return {
      fingerprint,
      metadata,
      payload: {
        ...payloadBase,
        idempotency_key: idempotencyKeyForPayload(payloadBase),
      } satisfies NewAppointmentData,
    };
  }, [
    buildAppointmentIntentContext,
    idempotencyKeyForPayload,
    resolvedFinancial?.expectedReceivableCents,
    selectedPackage?.id,
  ]);

  const buildSeriesAppointmentIntent = useCallback((values: FormValues) => {
    const { metadata } = buildAppointmentIntentContext(values);
    const input = buildAgendaPlanInput(values, metadata);
    const fingerprint = appointmentPayloadFingerprint(input);
    return {
      input,
      fingerprint,
      idempotencyKey: idempotencyKeyForPayload(input),
    };
  }, [buildAgendaPlanInput, buildAppointmentIntentContext, idempotencyKeyForPayload]);

  const currentSingleAppointmentIntent = useMemo(() => {
    if (recurrenceEnabled) return null;
    try {
      return buildSingleAppointmentIntent(watchedFormValues);
    } catch {
      return null;
    }
  }, [buildSingleAppointmentIntent, recurrenceEnabled, watchedFormValues]);
  const currentSingleFingerprint = currentSingleAppointmentIntent?.fingerprint || null;
  const currentSingleIdempotencyKey = currentSingleAppointmentIntent?.payload.idempotency_key || null;
  const currentSingleDraftIdentity = currentSingleFingerprint && currentSingleIdempotencyKey
    ? `${currentSingleFingerprint}:${currentSingleIdempotencyKey}`
    : null;
  currentSingleFingerprintRef.current = currentSingleFingerprint;
  currentSingleIdempotencyKeyRef.current = currentSingleIdempotencyKey;

  const currentSeriesAppointmentIntent = useMemo(() => {
    if (!recurrenceEnabled) return null;
    try {
      return buildSeriesAppointmentIntent(watchedFormValues);
    } catch {
      return null;
    }
  }, [buildSeriesAppointmentIntent, recurrenceEnabled, watchedFormValues]);
  const currentSeriesFingerprint = currentSeriesAppointmentIntent?.fingerprint || null;
  const currentSeriesIdempotencyKey = currentSeriesAppointmentIntent?.idempotencyKey || null;
  currentSeriesFingerprintRef.current = currentSeriesFingerprint;
  currentSeriesIdempotencyKeyRef.current = currentSeriesIdempotencyKey;

  useEffect(() => {
    if (lastSingleDraftIdentityRef.current === currentSingleDraftIdentity) return;
    lastSingleDraftIdentityRef.current = currentSingleDraftIdentity;
    singlePlanRequestSequenceRef.current += 1;
    setIsPreparingSinglePlan(false);
    setPreparedSinglePlan((current) => (
      current?.fingerprint === currentSingleFingerprint
      && current.idempotencyKey === currentSingleIdempotencyKey
        ? current
        : null
    ));
  }, [currentSingleDraftIdentity, currentSingleFingerprint, currentSingleIdempotencyKey]);

  useEffect(() => {
    if (isOpen) return;
    singlePlanRequestSequenceRef.current += 1;
    setPreparedSinglePlan(null);
    setIsPreparingSinglePlan(false);
  }, [isOpen]);

  useEffect(() => {
    seriesPlanRequestSequenceRef.current += 1;
    setIsPreparingSeriesPlan(false);
    setPreparedSeriesPlan((current) => (
      current?.fingerprint === currentSeriesFingerprint
      && current.idempotencyKey === currentSeriesIdempotencyKey
        ? current
        : null
    ));
  }, [currentSeriesFingerprint, currentSeriesIdempotencyKey]);

  useEffect(() => {
    if (isOpen) return;
    seriesPlanRequestSequenceRef.current += 1;
    setPreparedSeriesPlan(null);
    setIsPreparingSeriesPlan(false);
  }, [isOpen]);

  const loadSeriesPreview = useCallback(async (values: FormValues, recurrence = recurrenceDraft) => {
    const input = buildAgendaPlanInput(values, undefined, recurrence);
    const fingerprint = appointmentPayloadFingerprint(input);
    const requestSequence = ++previewRequestSequenceRef.current;
    setSeriesPreviewError(null);
    const overrideIssue = getOccurrenceOverrideIssue(recurrence.overrides);
    if (overrideIssue) {
      setSeriesPreview(null);
      setSeriesPreviewFingerprint(null);
      setSeriesPreviewError(overrideIssue.message);
      setSubmissionError(overrideIssue.message);
      setValidationAnnouncement(`Ocorrência ${overrideIssue.occurrenceNumber}: ${overrideIssue.message}`);
      window.setTimeout(() => {
        if (bodyScrollRef.current) {
          const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
          revealAppointmentField(
            bodyScrollRef.current,
            `occurrence-${overrideIssue.occurrenceNumber}`,
            reducedMotion,
          );
          bodyScrollRef.current
            .querySelector<HTMLElement>(
              `[data-appointment-field="occurrence-${overrideIssue.occurrenceNumber}"] [data-override-field="${overrideIssue.field}"]`,
            )
            ?.focus({ preventScroll: true });
        }
      }, 0);
      return null;
    }
    setSubmissionError(null);
    setValidationAnnouncement("");
    try {
      const preview = await previewAgendaPlan(input);
      if (requestSequence !== previewRequestSequenceRef.current) return null;
      setSeriesPreview(preview);
      setSeriesPreviewFingerprint(fingerprint);
      return preview;
    } catch (error) {
      if (requestSequence !== previewRequestSequenceRef.current) return null;
      const message =
        error instanceof Error ? error.message : "Não foi possível verificar a disponibilidade.";
      setSeriesPreview(null);
      setSeriesPreviewFingerprint(null);
      setSeriesPreviewError(message);
      return null;
    }
  }, [buildAgendaPlanInput, previewAgendaPlan, recurrenceDraft]);

  useEffect(() => {
    if (!recurrenceEnabled) return;
    if (seriesPreviewFingerprint === currentPreviewFingerprint) return;
    previewRequestSequenceRef.current += 1;
    setSeriesPreview(null);
    setSeriesPreviewFingerprint(null);
    setSeriesPreviewError(null);
  }, [currentPreviewFingerprint, recurrenceEnabled, seriesPreviewFingerprint]);

  useEffect(() => {
    if (!isOpen || !recurrenceEnabled || step !== totalSteps) return;
    if (seriesPreview && seriesPreviewFingerprint === currentPreviewFingerprint) return;

    const timeout = window.setTimeout(() => {
      void form.trigger().then((isValid) => {
        if (isValid) void loadSeriesPreview(form.getValues());
      });
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [
    currentPreviewFingerprint,
    form,
    isOpen,
    loadSeriesPreview,
    recurrenceEnabled,
    seriesPreview,
    seriesPreviewFingerprint,
    step,
    totalSteps,
  ]);

  // ── Submit ─────────────────────────────────────────────────────────
  const onSubmit = async (values: FormValues) => {
    setSubmissionError(null);

    try {
      if (values.shouldGenerateNeurofinanceCharge && !canUseNeurofinance) {
        setStep(3);
        throw new Error("Ative uma conta NeuroFinance elegível para gerar a cobrança.");
      }
      if (values.shouldGenerateNeurofinanceCharge && !hasPatientDocument) {
        form.setValue("shouldGenerateNeurofinanceCharge", false);
        setStep(3);
        setSubmissionError(
          "Complete o CPF do paciente para gerar a cobrança, ou continue sem cobrança NeuroFinance.",
        );
        setValidationAnnouncement("O CPF do paciente é necessário apenas para a cobrança NeuroFinance.");
        return;
      }

      if (values.recurrence) {
        const previewInput = buildAgendaPlanInput(values);
        const previewFingerprint = appointmentPayloadFingerprint(previewInput);
        const latestPreview = seriesPreview?.valid
          && seriesPreviewFingerprint === previewFingerprint
          ? seriesPreview
          : await loadSeriesPreview(values);
        if (!latestPreview?.valid) {
          setStep(totalSteps);
          setSubmissionError("Revise as datas em conflito antes de criar a série.");
          return;
        }

        const seriesIntent = buildSeriesAppointmentIntent(values);
        if (
          !preparedSeriesPlan
          || preparedSeriesPlan.fingerprint !== seriesIntent.fingerprint
          || preparedSeriesPlan.idempotencyKey !== seriesIntent.idempotencyKey
        ) {
          const prepared = await prepareSeriesAppointmentForReview(values);
          if (prepared) {
            const message = "O plano da recorrência foi atualizado. Revise o resumo e confirme novamente.";
            setSubmissionError(message);
            setValidationAnnouncement(message);
          }
          return;
        }
        const result = await executePreparedAgendaSeries({
          plan: preparedSeriesPlan.plan,
        });
        toast.success(result.result.message || "Série criada com segurança.");
      } else {
        const singleIntent = buildSingleAppointmentIntent(values);
        if (
          !preparedSinglePlan
          || preparedSinglePlan.fingerprint !== singleIntent.fingerprint
          || preparedSinglePlan.idempotencyKey !== singleIntent.payload.idempotency_key
        ) {
          const prepared = await prepareSingleAppointmentForReview(values);
          if (prepared) {
            const message = "O plano foi atualizado. Revise o resumo e confirme novamente.";
            setSubmissionError(message);
            setValidationAnnouncement(message);
          }
          return;
        }
        await createAppointment({
          ...singleIntent.payload,
          prepared_plan: preparedSinglePlan.plan,
        });
      }

      const typedLocation = values.sessionLocation?.trim();
      if (
        values.eventType === "session"
        && values.modality === "presencial"
        && typedLocation
        && !professionalDefaultLocation
      ) {
        try {
          await rememberAppointmentLocation(typedLocation);
        } catch (error) {
          console.warn("[NewAppointmentModal] Não foi possível memorizar o local da consulta.", error);
        }
      }

      onOpenChange(false);
      form.reset();
      setRecurrenceDraft(createAgendaRecurrenceDraft(effectiveDate || new Date()));
      setSelectedTemplateId("");
      setTemplateDraftName("");
      setTemplateName("");
      idempotencyIntentRef.current = null;
      singlePlanRequestSequenceRef.current += 1;
      setPreparedSinglePlan(null);
      seriesPlanRequestSequenceRef.current += 1;
      setPreparedSeriesPlan(null);
      setSeriesPreview(null);
      setSeriesPreviewFingerprint(null);
      setSeriesPreviewError(null);
      setStep(1);
    } catch (error: unknown) {
      if (isAppointmentPlanReviewRequiredError(error)) {
        setPreparedSinglePlan(null);
        await revealSingleAppointmentPlanError(error);
        return;
      }
      const agendaError = error as Error & { preview?: AgendaV2Preview };
      if (agendaError.preview) {
        setSeriesPreview(agendaError.preview);
        setSeriesPreviewError(agendaError.message);
        setStep(totalSteps);
      }
      const message = error instanceof Error
        ? error.message
        : "Não foi possível registrar o agendamento.";
      setSubmissionError(message);
    }
  };

  const revealFirstInvalidField = async (
    errors: FieldErrors<FormValues> = form.formState.errors,
    preferredField?: string,
  ) => {
    const currentErrors = { ...errors } as Record<string, unknown>;
    getAppointmentFieldOrder(eventType, recurrenceEnabled).forEach((fieldName) => {
      const fieldError = form.getFieldState(fieldName as FieldPath<FormValues>).error;
      if (fieldError) currentErrors[fieldName] = fieldError;
    });
    const firstField = preferredField || findFirstInvalidAppointmentField(
      currentErrors,
      eventType,
      recurrenceEnabled,
    );
    const targetStep = firstField
      ? getAppointmentFieldStep(firstField, eventType, recurrenceEnabled)
      : 1;
    const message = firstField
      ? getAppointmentErrorMessage(currentErrors, firstField)
        || form.getFieldState(firstField as FieldPath<FormValues>).error?.message
      : null;

    setStep(targetStep);
    setSubmissionError(message || "Revise o campo destacado para continuar.");
    setValidationAnnouncement(
      message ? `Campo inválido: ${message}` : "Há um campo que precisa ser revisado.",
    );

    if (firstField) {
      const nextFrame = () => new Promise<void>((resolve) => {
        const schedule = window.requestAnimationFrame
          || ((callback: FrameRequestCallback) => window.setTimeout(callback, 0));
        schedule(() => resolve());
      });
      await nextFrame();
      await nextFrame();
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      const revealed = bodyScrollRef.current
        ? revealAppointmentField(bodyScrollRef.current, firstField, reducedMotion)
        : false;
      if (!revealed) {
        try {
          form.setFocus(firstField as FieldPath<FormValues>);
        } catch {
          // Controles compostos sem ref usam o alvo DOM marcado acima.
        }
      }
    }
  };

  const revealSingleAppointmentPlanError = async (error: unknown) => {
    if (isAppointmentPlanReviewRequiredError(error)) {
      const issue = Array.isArray(error.issues) ? error.issues[0] : undefined;
      if (issue?.field) {
        form.setError(issue.field as FieldPath<FormValues>, {
          type: "server",
          message: issue.message,
        });
      }
      await revealFirstInvalidField(form.formState.errors, issue?.field);
      return issue?.message || error.message;
    }

    const message = error instanceof Error
      ? error.message
      : "Não foi possível preparar o agendamento para revisão.";
    setSubmissionError(message);
    setValidationAnnouncement(message);
    return message;
  };

  const prepareSingleAppointmentForReview = async (values: FormValues) => {
    let intent: ReturnType<typeof buildSingleAppointmentIntent>;
    try {
      intent = buildSingleAppointmentIntent(values);
    } catch (error) {
      await revealSingleAppointmentPlanError(error);
      return false;
    }
    const idempotencyKey = intent.payload.idempotency_key;
    if (!idempotencyKey) {
      await revealSingleAppointmentPlanError(
        new Error("Não foi possível identificar esta tentativa de agendamento."),
      );
      return false;
    }

    const requestSequence = ++singlePlanRequestSequenceRef.current;
    setPreparedSinglePlan(null);
    setIsPreparingSinglePlan(true);
    setSubmissionError(null);
    setValidationAnnouncement("Validando o plano do agendamento.");

    try {
      const plan = await prepareAppointment(intent.payload);
      const isLatestDraft =
        requestSequence === singlePlanRequestSequenceRef.current
        && currentSingleFingerprintRef.current === intent.fingerprint
        && currentSingleIdempotencyKeyRef.current === idempotencyKey;
      if (!isLatestDraft) return false;

      if (plan.status === "review_required") {
        throw new AppointmentPlanReviewRequiredError(plan);
      }
      if (plan.status !== "awaiting_confirmation") {
        throw new Error("O plano não está disponível para confirmação. Atualize os dados e tente novamente.");
      }

      setPreparedSinglePlan({
        fingerprint: intent.fingerprint,
        idempotencyKey,
        plan,
      });
      setSubmissionError(null);
      setValidationAnnouncement("Plano validado. Revise os dados antes de confirmar.");
      return true;
    } catch (error) {
      if (requestSequence !== singlePlanRequestSequenceRef.current) return false;
      setPreparedSinglePlan(null);
      await revealSingleAppointmentPlanError(error);
      return false;
    } finally {
      if (requestSequence === singlePlanRequestSequenceRef.current) {
        setIsPreparingSinglePlan(false);
      }
    }
  };

  const prepareSeriesAppointmentForReview = useCallback(async (values: FormValues) => {
    let intent: ReturnType<typeof buildSeriesAppointmentIntent>;
    try {
      intent = buildSeriesAppointmentIntent(values);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Não foi possível preparar esta recorrência.";
      setSubmissionError(message);
      setValidationAnnouncement(message);
      return false;
    }

    const requestSequence = ++seriesPlanRequestSequenceRef.current;
    setPreparedSeriesPlan(null);
    setIsPreparingSeriesPlan(true);
    setSubmissionError(null);
    setValidationAnnouncement("Validando o plano da recorrência.");

    try {
      const plan = await prepareAgendaSeries({
        input: intent.input,
        idempotencyKey: intent.idempotencyKey,
      });
      const isLatestDraft = requestSequence === seriesPlanRequestSequenceRef.current
        && currentSeriesFingerprintRef.current === intent.fingerprint
        && currentSeriesIdempotencyKeyRef.current === intent.idempotencyKey;
      if (!isLatestDraft) return false;

      setPreparedSeriesPlan({
        fingerprint: intent.fingerprint,
        idempotencyKey: intent.idempotencyKey,
        plan,
      });
      setSubmissionError(null);
      setValidationAnnouncement("Plano validado. Revise a recorrência antes de confirmar.");
      return true;
    } catch (error) {
      if (requestSequence !== seriesPlanRequestSequenceRef.current) return false;
      setPreparedSeriesPlan(null);
      const agendaError = error as Error & { preview?: AgendaV2Preview };
      if (agendaError.preview) {
        const previewInput = buildAgendaPlanInput(values);
        setSeriesPreview(agendaError.preview);
        setSeriesPreviewFingerprint(appointmentPayloadFingerprint(previewInput));
        setSeriesPreviewError(agendaError.message);
        setStep(totalSteps);
      }
      if (isAppointmentPlanReviewRequiredError(error)) {
        const issue = error.issues[0];
        const message = issue?.message || error.message;
        setSubmissionError(message);
        setValidationAnnouncement(
          issue?.occurrenceNumber
            ? `Ocorrência ${issue.occurrenceNumber}: ${message}`
            : message,
        );
        if (issue?.occurrenceNumber && bodyScrollRef.current) {
          const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
          revealAppointmentField(
            bodyScrollRef.current,
            `occurrence-${issue.occurrenceNumber}`,
            reducedMotion,
          );
        }
      } else {
        const message = agendaError.message || "Não foi possível preparar esta recorrência.";
        setSubmissionError(message);
        setValidationAnnouncement(message);
      }
      return false;
    } finally {
      if (requestSequence === seriesPlanRequestSequenceRef.current) {
        setIsPreparingSeriesPlan(false);
      }
    }
  }, [
    buildAgendaPlanInput,
    buildSeriesAppointmentIntent,
    prepareAgendaSeries,
    totalSteps,
  ]);

  useEffect(() => {
    if (
      !isOpen
      || !recurrenceEnabled
      || step !== totalSteps
      || !seriesPreview?.valid
      || seriesPreviewFingerprint !== currentPreviewFingerprint
      || !currentSeriesFingerprint
      || !currentSeriesIdempotencyKey
    ) {
      return;
    }
    if (
      preparedSeriesPlan?.fingerprint === currentSeriesFingerprint
      && preparedSeriesPlan.idempotencyKey === currentSeriesIdempotencyKey
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void prepareSeriesAppointmentForReview(form.getValues());
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [
    currentPreviewFingerprint,
    currentSeriesFingerprint,
    currentSeriesIdempotencyKey,
    form,
    isOpen,
    prepareSeriesAppointmentForReview,
    preparedSeriesPlan,
    recurrenceEnabled,
    seriesPreview?.valid,
    seriesPreviewFingerprint,
    step,
    totalSteps,
  ]);

  const onInvalid = (errors: FieldErrors<FormValues>) => {
    void revealFirstInvalidField(errors);
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
    const template = compatibleSeriesTemplates.find((item) => item.id === templateId);
    setTemplateDraftName(template?.name || "");
    const version = [...(template?.appointment_series_template_versions || [])]
      .sort((left, right) => right.version_number - left.version_number)[0];
    if (!version) return;
    const savedDuration = Number(version.default_config?.durationMinutes);
    if (Number.isFinite(savedDuration) && savedDuration >= 15) {
      form.setValue("duration", savedDuration);
    }
    if (eventType === "event") {
      if (typeof version.default_config?.eventLocation === "string") {
        form.setValue("eventLocation", version.default_config.eventLocation);
      }
      if (
        typeof version.default_config?.eventCategory === "string" &&
        eventCategories.some((category) => category.slug === version.default_config.eventCategory)
      ) {
        form.setValue("eventCategory", version.default_config.eventCategory, { shouldDirty: true });
      }
    } else {
      if (version.default_config?.modality === "presencial" || version.default_config?.modality === "online") {
        form.setValue("modality", version.default_config.modality);
      }
      if (typeof version.default_config?.location === "string") {
        form.setValue("sessionLocation", version.default_config.location);
      }
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
      excludedOccurrenceNumbers: current.excludedOccurrenceNumbers,
    }));
    toast.success(`Modelo “${template?.name}” aplicado. Revise o que desejar.`);
  };

  const handleRenameSeriesTemplate = async () => {
    if (!selectedTemplateId) return;
    const name = templateDraftName.trim();
    if (!name) {
      setSubmissionError("Dê um nome curto ao modelo.");
      return;
    }
    try {
      await renameTemplate({ templateId: selectedTemplateId, name });
      setSubmissionError(null);
      toast.success("Nome do modelo atualizado.");
    } catch (error) {
      setSubmissionError(getAppointmentPlanErrorMessage(error, "generic"));
    }
  };

  const handleArchiveSeriesTemplate = async () => {
    if (!selectedTemplateId) return;
    try {
      await archiveTemplate(selectedTemplateId);
      setSelectedTemplateId("");
      setTemplateDraftName("");
      setSubmissionError(null);
      toast.success("Modelo excluído.");
    } catch (error) {
      setSubmissionError(getAppointmentPlanErrorMessage(error, "generic"));
    }
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
        defaultConfig: eventType === "event"
          ? {
              eventType: "event",
              durationMinutes: form.getValues("duration"),
              eventCategory: form.getValues("eventCategory") || null,
              eventLocation: form.getValues("eventLocation") || null,
            }
          : {
              eventType: "session",
              durationMinutes: form.getValues("duration"),
              modality: form.getValues("modality"),
              location: form.getValues("sessionLocation") || null,
            },
        sourcePatientId: eventType === "session" ? form.getValues("patientId") || null : null,
      });
      setTemplateName("");
      toast.success(
        eventType === "event"
          ? "Modelo de eventos salvo."
          : "Modelo salvo sem copiar dados financeiros do paciente.",
      );
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
      const next = normalizeOccurrenceOverride({
        occurrenceNumber,
        source: "professional" as const,
        reason: previous?.reason || "Ajuste individual definido na criação da série.",
        ...previous,
        ...patch,
      });
      return {
        ...current,
        overrides: (
          next
            ? [
                ...current.overrides.filter((item) => item.occurrenceNumber !== occurrenceNumber),
                next,
              ]
            : current.overrides.filter((item) => item.occurrenceNumber !== occurrenceNumber)
        ).sort((left, right) => left.occurrenceNumber - right.occurrenceNumber),
      };
    });
  };

  const excludeOccurrence = (
    occurrenceNumber: number,
    displayOccurrenceNumber: number,
  ) => {
    if (seriesPreview && seriesPreview.totalOccurrences <= 1) {
      setSubmissionError(`Mantenha pelo menos um ${recurrenceTerminology.singular} na recorrência.`);
      return;
    }
    if (recurrenceDraft.terminationKind === "open" && occurrenceNumber === 1) {
      setSubmissionError(
        `Em uma recorrência sem data final, mantenha o primeiro ${recurrenceTerminology.singular} e ajuste sua data ou horário.`,
      );
      return;
    }
    setSubmissionError(null);
    setSmartFitSuggestions((current) => {
      const next = { ...current };
      delete next[displayOccurrenceNumber];
      return next;
    });
    const nextDraft: AgendaRecurrenceDraft = {
      ...recurrenceDraft,
      excludedOccurrenceNumbers: Array.from(new Set([
        ...recurrenceDraft.excludedOccurrenceNumbers,
        occurrenceNumber,
      ])).sort((left, right) => left - right),
      overrides: recurrenceDraft.overrides.filter(
        (item) => item.occurrenceNumber !== occurrenceNumber,
      ),
    };
    const keptOccurrences = (seriesPreview?.occurrences || [])
      .filter((item) => (
        (item.originalOccurrenceNumber || item.occurrenceNumber) !== occurrenceNumber
      ))
      .map((item, index) => ({
        ...item,
        originalOccurrenceNumber: item.originalOccurrenceNumber || item.occurrenceNumber,
        occurrenceNumber: index + 1,
      }));
    if (seriesPreview && keptOccurrences.length) {
      const optimisticInput = buildAgendaPlanInput(form.getValues(), undefined, nextDraft);
      setSeriesPreview({
        ...seriesPreview,
        totalOccurrences: keptOccurrences.length,
        occurrences: keptOccurrences,
        conflicts: keptOccurrences.filter((item) => item.status === "conflict"),
        valid: keptOccurrences.every((item) => item.status !== "conflict"),
        firstStartTime: keptOccurrences[0].startTime,
        lastStartTime: keptOccurrences[keptOccurrences.length - 1].startTime,
      });
      setSeriesPreviewFingerprint(appointmentPayloadFingerprint(optimisticInput));
    }
    setRecurrenceDraft(nextDraft);
    void loadSeriesPreview(form.getValues(), nextDraft);
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
        setSubmissionError(
          `Não encontrei uma janela válida nos próximos 14 dias para este ${recurrenceTerminology.singular}.`,
        );
      }
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "Não foi possível sugerir um reencaixe.");
    }
  };

  const applySmartFitCandidate = async (
    occurrenceNumber: number,
    candidate: AgendaPlanSmartFitCandidate,
    displayOccurrenceNumber = occurrenceNumber,
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
    setSmartFitSuggestions((current) => ({ ...current, [displayOccurrenceNumber]: [] }));
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
                  <FormItem className="space-y-2.5" data-appointment-field="patientId">
                  <FormLabel className={labelBase}>Paciente</FormLabel>
                  <div className="grid grid-cols-[1fr_3rem] gap-2">
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger
                          ref={field.ref}
                          data-appointment-focus
                          className={cn(inputBase, "font-medium px-4 shadow-inner data-[state=open]:border-primary/50")}
                        >
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className={selectPopover}>
                        {patients?.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="cursor-pointer py-3 pr-4 text-sm text-foreground/70 focus:bg-accent focus:text-foreground">
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
                <FormItem className="space-y-2.5" data-appointment-field="eventTitle">
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
                <FormItem className="space-y-2.5" data-appointment-field="eventCategory">
                  <FormLabel className={labelBase}>Categoria</FormLabel>
                  <div className="grid grid-cols-[minmax(0,1fr)_3rem] gap-2">
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger ref={field.ref} data-appointment-focus className={cn(inputBase, "font-medium px-4 shadow-inner")}>
                          <SelectValue placeholder="Selecione a categoria..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className={selectPopover}>
                        {eventCategories.map((category) => (
                          <SelectItem key={category.slug} value={category.slug} className="cursor-pointer py-3 pr-4 text-sm text-foreground/70 focus:bg-accent focus:text-foreground">
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCategoryManagerOpen(true)}
                      className={cn(inputBase, "w-12 p-0")}
                      aria-label="Gerenciar categorias de evento"
                      aria-haspopup="dialog"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
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
      <div
        className={cn(
          "grid items-start gap-3",
          showEndTime
            ? "grid-cols-[minmax(0,1fr)_7.75rem_7.75rem]"
            : "grid-cols-[minmax(0,1fr)_7.75rem]",
        )}
      >
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="grid min-w-0 grid-rows-[auto_3rem_auto] gap-2 space-y-0" data-appointment-field="date">
              <FormLabel className={labelBase}>Data</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      data-appointment-focus
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
            <FormItem className="grid min-w-0 grid-rows-[auto_3rem_auto] gap-2 space-y-0" data-appointment-field="startTime">
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
                    className={cn(inputBase, "agenda-time-input agenda-time-input--start px-3 text-center font-bold")}
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
              <FormItem className="agenda-step-enter grid min-w-0 grid-rows-[auto_3rem_auto] gap-2 space-y-0" data-appointment-field="endTime">
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
                        const nextDuration = differenceInMinutes(endDate, startDate);
                        form.setValue("duration", nextDuration > 0 ? nextDuration : 15, {
                          shouldValidate: true,
                        });
                      }}
                      className={cn(inputBase, "agenda-time-input agenda-time-input--end px-3 text-center font-bold")}
                    />
                    <Clock className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/80" />
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
          <FormItem className={cn(cardBase, "flex flex-row items-center justify-between")} data-appointment-field="recurrence">
            <div className="space-y-1">
              <FormLabel className="text-sm font-bold text-foreground flex items-center gap-2">
                <Repeat className="h-4 w-4 text-muted-foreground/60" />
                Recorrência
              </FormLabel>
              <p className="text-xs text-muted-foreground/60">
                A quantidade total inclui {recurrenceTerminology.firstOccurrence}.
              </p>
            </div>
            <FormControl>
              <Switch data-appointment-focus checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-foreground" />
            </FormControl>
          </FormItem>
        )}
      />

      {form.watch("recurrence") && (
        <div className="agenda-step-enter mt-3 space-y-3">
          {compatibleSeriesTemplates.length ? (
            <div className="agenda-liquid-surface rounded-[20px] border p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-black text-foreground">
                <WandSparkles className="h-3.5 w-3.5" /> Repetir uma configuração
              </div>
              <Select value={selectedTemplateId} onValueChange={applySeriesTemplate}>
                <SelectTrigger className="agenda-field h-11 rounded-2xl font-semibold">
                  <SelectValue placeholder="Escolha e ajuste só o que mudar" />
                </SelectTrigger>
                <SelectContent className="agenda-menu-surface notification-liquid-menu rounded-[18px] p-1.5">
                  {compatibleSeriesTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id} className="notification-liquid-menu-item rounded-[13px] py-2.5">
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTemplateId ? (
                <div className="synapse-liquid-toolbar mt-2 flex items-center gap-1 rounded-[16px] p-1">
                  <Input
                    value={templateDraftName}
                    onChange={(event) => setTemplateDraftName(event.target.value)}
                    className="synapse-liquid-control h-11 min-w-0 flex-1 rounded-[13px] border-0 bg-transparent px-3 text-xs font-bold shadow-none"
                    aria-label="Nome do modelo selecionado"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => void handleRenameSeriesTemplate()}
                    disabled={isRenamingTemplate || !templateDraftName.trim()}
                    className="synapse-liquid-control h-11 w-11 shrink-0 rounded-[13px]"
                    aria-label="Salvar novo nome do modelo"
                  >
                    {isRenamingTemplate
                      ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                      : <Pencil className="h-4 w-4" />}
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={isArchivingTemplate}
                        className="synapse-liquid-control h-11 w-11 shrink-0 rounded-[13px] text-muted-foreground hover:text-foreground"
                        aria-label="Excluir modelo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      className="agenda-menu-surface w-64 rounded-[18px] border-border/50 p-3"
                    >
                      <p className="text-sm font-black text-foreground">Excluir este modelo?</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Os agendamentos já criados não serão alterados.
                      </p>
                      <Button
                        type="button"
                        onClick={() => void handleArchiveSeriesTemplate()}
                        disabled={isArchivingTemplate}
                        className="agenda-primary-action mt-3 h-11 w-full rounded-full text-xs font-black"
                      >
                        {isArchivingTemplate
                          ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                          : "Excluir modelo"}
                      </Button>
                    </PopoverContent>
                  </Popover>
                </div>
              ) : null}
            </div>
          ) : null}
          <AdvancedRecurrenceEditor
            value={recurrenceDraft}
            onChange={setRecurrenceDraft}
            eventType={eventType}
          />
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
              <FormItem className="space-y-2.5" data-appointment-field="type">
                <FormLabel className={labelBase}>Tipo de Sessão</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger ref={field.ref} data-appointment-focus className={cn(inputBase, "px-4 text-left font-medium shadow-inner [&>span:first-child]:text-left")}>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className={selectPopover}>
                    <SelectItem value="first_visit" className="cursor-pointer py-3 pr-4 text-sm text-foreground/70 focus:bg-accent focus:text-foreground">
                      Primeira Consulta (Avaliação)
                    </SelectItem>
                    <SelectItem value="follow_up" className="cursor-pointer py-3 pr-4 text-sm text-foreground/70 focus:bg-accent focus:text-foreground">
                      Sessão de Acompanhamento
                    </SelectItem>
                    <SelectItem value="emergency" className="cursor-pointer py-3 pr-4 text-sm text-rose-400 focus:bg-rose-500/10 focus:text-rose-300">
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
              <FormItem className="space-y-2.5" data-appointment-field="modality">
                <FormLabel className={labelBase}>Modalidade</FormLabel>
                <FormControl>
                  <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-2 gap-3">
                    {[
                      { id: "presencial", icon: Building2, label: "Presencial" },
                      { id: "online", icon: Video, label: "Online" },
                    ].map((m) => (
                      <FormItem key={m.id}>
                        <FormControl>
                          <RadioGroupItem data-appointment-focus value={m.id} id={`modality-${m.id}`} className="peer sr-only" />
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
                <FormItem className="space-y-2.5" data-appointment-field="sessionLocation">
                  <FormLabel className={labelBase}>Local da consulta</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ex: Clínica, sala 302, endereço completo..."
                      className={cn(inputBase, "px-4 font-medium")}
                    />
                  </FormControl>
                  {professionalDefaultLocation && field.value === professionalDefaultLocation ? (
                    <p className="px-1 text-[11px] text-muted-foreground">
                      Preenchido com o endereço salvo em Ajustes. Você pode alterar só para esta sessão.
                    </p>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}

          <FormField
            control={form.control}
            name="duration"
            render={({ field }) => (
              <FormItem className="space-y-2.5" data-appointment-field="duration">
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
              <FormItem className="space-y-2.5" data-appointment-field="notes">
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
              <FormItem className="space-y-2.5" data-appointment-field="eventLocation">
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
              <FormItem className="space-y-2.5" data-appointment-field="notes">
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

      {!isCheckingFinancialRules && selectedPatientId && isFinancialResolutionError ? (
        <div className="agenda-liquid-card rounded-2xl border border-amber-500/25 p-4" role="status">
          <p className="text-sm font-bold text-foreground">Não foi possível carregar a sugestão financeira.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Você pode continuar sem lançamento ou tentar novamente. Nenhum valor foi preenchido automaticamente.
          </p>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void retryFinancialResolution()}
            className="agenda-tactile notification-liquid-control mt-3 min-h-11 rounded-full px-4 text-xs font-bold"
          >
            Tentar novamente
          </Button>
        </div>
      ) : null}

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
              <FormItem className={cn(cardBase, "flex flex-row items-center justify-between")} data-appointment-field="usePackage">
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
                    data-appointment-focus
                    checked={field.value}
                    onCheckedChange={(val) => {
                      field.onChange(val);
                      if (!val) {
                        form.setValue("shouldCreateTransaction", false);
                        form.setValue("shouldGenerateNeurofinanceCharge", false);
                        form.setValue("transactionAmount", 0);
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
                <div className="agenda-step-enter space-y-3" data-appointment-field="packageId">
                  <RadioGroup onValueChange={field.onChange} value={field.value || activePackages[0]?.id} className="grid gap-3">
                    {activePackages.map((pkg) => (
                      <div key={pkg.id}>
                        <RadioGroupItem data-appointment-focus value={pkg.id} id={pkg.id} className="peer sr-only" />
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
              <FormItem className={cn(cardBase, "flex flex-row items-center justify-between")} data-appointment-field="shouldCreateTransaction">
                <div className="space-y-1">
                  <FormLabel className="text-sm font-bold text-foreground flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground/60" />
                    Gerar Lançamento Financeiro?
                  </FormLabel>
                  <p className="text-xs text-muted-foreground/60">Registra como "A Receber". Desative para continuar sem cobrança.</p>
                </div>
                <FormControl>
                  <Switch
                    data-appointment-focus
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked);
                      if (!checked) {
                        form.setValue("shouldGenerateNeurofinanceCharge", false);
                        return;
                      }
                      if (
                        Number(form.getValues("transactionAmount") || 0) <= 0
                        && Number(resolvedFinancial?.sessionValueCents || 0) > 0
                      ) {
                        form.setValue("transactionAmount", Number(resolvedFinancial?.sessionValueCents) / 100);
                      }
                    }}
                    className="data-[state=checked]:bg-foreground"
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {shouldCreateTransaction && (
            <div className="agenda-step-enter space-y-4 pt-1">
              <FormField
                control={form.control}
                name="shouldGenerateNeurofinanceCharge"
                render={({ field }) => (
                  <FormItem className={cn(cardBase, "flex min-h-20 flex-row items-center justify-between gap-4")} data-appointment-field="shouldGenerateNeurofinanceCharge">
                    <div className="min-w-0 space-y-1">
                      <FormLabel className="flex items-center gap-2 text-sm font-bold text-foreground">
                        <ReceiptText className="h-4 w-4 text-muted-foreground/60" aria-hidden="true" />
                        Gerar cobrança via NeuroFinance
                      </FormLabel>
                      <p className="text-xs leading-relaxed text-muted-foreground/70">
                        {isLoadingSubscription || isLoadingFinancialAccount
                          ? "Verificando plano e conta..."
                          : canUseNeurofinance
                            ? "Cria um link de pagamento e acompanha o recebimento."
                            : !hasNeurofinanceEntitlement
                              ? "Disponível nos planos Professional e Enterprise."
                              : "Ative e conclua a aprovação da conta NeuroFinance."}
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        data-appointment-focus
                        checked={field.value}
                        disabled={!canUseNeurofinance || isLoadingSubscription || isLoadingFinancialAccount}
                        onCheckedChange={(checked) => {
                          if (checked && !hasPatientDocument) {
                            field.onChange(false);
                            setSubmissionError(null);
                            return;
                          }
                          field.onChange(checked);
                          if (
                            checked
                            && ["money", "mixed", "debit_card"].includes(form.getValues("transactionMethod") || "")
                          ) {
                            form.setValue("transactionMethod", "patient_choice");
                          }
                        }}
                        className="shrink-0 data-[state=checked]:bg-foreground"
                        aria-label="Gerar cobrança via NeuroFinance"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {canUseNeurofinance && selectedPatient && !hasPatientDocument ? (
                <div
                  className="synapse-liquid-toolbar flex flex-col gap-3 rounded-[18px] p-3 sm:flex-row sm:items-center sm:justify-between"
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="synapse-liquid-control flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-muted-foreground">
                      <CircleHelp className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-foreground">CPF necessário para a cobrança</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        Complete o cadastro de {selectedPatient.name} ou continue sem gerar a cobrança NeuroFinance.
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        form.setValue("shouldGenerateNeurofinanceCharge", false);
                        setSubmissionError(null);
                      }}
                      className="synapse-liquid-control h-11 rounded-[13px] px-3 text-[11px] font-black"
                    >
                      Sem cobrança
                    </Button>
                    <Button
                      type="button"
                      onClick={() => navigate(patientRegistrationPath(selectedPatient))}
                      className="agenda-primary-action h-11 rounded-full px-4 text-[11px] font-black"
                    >
                      Completar CPF
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="flex gap-3">
                <FormField
                  control={form.control}
                  name="transactionAmount"
                  render={({ field }) => (
                    <FormItem className="flex-1 space-y-2" data-appointment-field="transactionAmount">
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
                    <FormItem className="w-[104px] space-y-2" data-appointment-field="installments">
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
                  <FormItem className="space-y-2" data-appointment-field="transactionMethod">
                    <FormLabel className={labelBase}>Forma de Pagamento</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className={cn(
                          "grid gap-2",
                          shouldGenerateNeurofinanceCharge
                            ? "grid-cols-2 sm:grid-cols-4"
                            : "grid-cols-2 sm:grid-cols-5",
                        )}
                      >
                        {[
                          { id: "patient_choice", icon: CircleHelp, label: "Paciente decide" },
                          { id: "pix", icon: QrCode, label: "Pix" },
                          ...(!shouldGenerateNeurofinanceCharge
                            ? [{ id: "money", icon: Banknote, label: "Dinheiro" }]
                            : []),
                          { id: "credit_card", icon: CreditCard, label: "Cartão" },
                          { id: "boleto", icon: FileText, label: "Boleto" },
                        ].map((m) => (
                          <FormItem key={m.id}>
                            <FormControl>
                              <RadioGroupItem data-appointment-focus value={m.id} id={`pay-${m.id}`} className="peer sr-only" />
                            </FormControl>
                            <label
                              htmlFor={`pay-${m.id}`}
                              className="agenda-choice-card flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-2xl border p-3 text-center text-muted-foreground peer-data-[state=checked]:border-foreground/25 peer-data-[state=checked]:text-foreground"
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

  const renderReviewSummary = () => {
    const values = form.getValues();
    const { startDateTime, endDateTime } = buildAppointmentTimes(values, professionalTimezone);
    const location = values.sessionLocation?.trim() || professionalDefaultLocation || "Local não informado";
    const amount = Number(values.transactionAmount || 0);
    const amountLabel = amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const recurrenceLabel = values.recurrence
      ? recurrenceRuleSummary(agendaRecurrenceDraftToRule(recurrenceDraft))
      : recurrenceTerminology.singleLabel;
    const occurrenceLabel = values.recurrence && seriesPreview
      ? `${seriesPreview.totalOccurrences} ${seriesPreview.totalOccurrences === 1 ? recurrenceTerminology.singular : recurrenceTerminology.plural}`
      : recurrenceLabel;
    const selectedMethods = neurofinancePaymentMethods(values.transactionMethod);
    const feeSummaries = selectedMethods.map((method) => ({
      method,
      ...simulateNeurofinance({
        amount: Math.round(amount * 100),
        method: method as SimulatorMethod,
        installments: values.installments || 1,
      }),
    }));

    const financialTitle = values.eventType === "event"
      ? "Sem cobrança"
      : values.usePackage && selectedPackage
        ? "Saldo do pacote reservado"
        : values.shouldGenerateNeurofinanceCharge
          ? "Cobrança NeuroFinance automática"
          : values.shouldCreateTransaction
            ? "Lançamento a receber"
            : resolvedFinancial?.planType === "insurance"
              ? "Repasse de convênio"
              : "Sem cobrança automática";

    const financialDescription = values.eventType === "event"
      ? "Este compromisso entra na agenda sem movimentar o financeiro."
      : values.usePackage && selectedPackage
        ? `${sessionsToReserve ?? "As próximas"} ${sessionsToReserve === 1 ? "sessão será reservada" : "sessões serão reservadas"} no pacote ${selectedPackage.description || "ativo"}.`
        : values.shouldGenerateNeurofinanceCharge
          ? values.transactionMethod === "patient_choice"
            ? `O NeuroFinance gera ${values.recurrence ? "uma cobrança por sessão criada" : "um link de pagamento"} de ${amountLabel}. O paciente escolhe Pix, cartão ou boleto.`
            : `O NeuroFinance gera ${values.recurrence ? "uma cobrança por sessão criada" : "um link de pagamento"} de ${amountLabel} por ${paymentMethodLabel(values.transactionMethod)}.`
          : values.shouldCreateTransaction
            ? `Cria ${values.recurrence ? "um lançamento por sessão" : "um lançamento"} de ${amountLabel} como “A receber” · ${paymentMethodLabel(values.transactionMethod)}.`
            : resolvedFinancial?.planType === "insurance"
              ? `Prevê ${(resolvedFinancial.expectedReceivableCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} de repasse, sem cobrar o paciente.`
              : "O agendamento será criado sem lançamento ou cobrança.";

    const reviewItems = values.eventType === "session"
      ? [
          {
            title: selectedPatient?.name || "Paciente",
            description: `${format(startDateTime, "EEEE, dd 'de' MMMM", { locale: ptBR })} · ${format(startDateTime, "HH:mm")}–${format(endDateTime, "HH:mm")} · ${occurrenceLabel}`,
          },
          {
            title: `${getSessionTypeLabel(values.type)} · ${values.modality === "online" ? "Online" : "Presencial"}`,
            description: values.modality === "online"
              ? "O link seguro da teleconsulta será preparado ao criar."
              : location,
            mapsLocation: values.modality === "presencial" && location !== "Local não informado"
              ? location
              : null,
          },
          {
            title: financialTitle,
            description: financialDescription,
            feeSummaries: values.shouldGenerateNeurofinanceCharge ? feeSummaries : [],
          },
        ]
      : [
          {
            title: values.eventTitle || "Compromisso",
            description: `${format(startDateTime, "EEEE, dd 'de' MMMM", { locale: ptBR })} · ${format(startDateTime, "HH:mm")}–${format(endDateTime, "HH:mm")} · ${occurrenceLabel}`,
          },
          {
            title: "Detalhes registrados",
            description: values.eventLocation?.trim() || "Sem local definido.",
          },
        ];

    return (
      <section className="agenda-step-enter space-y-4" aria-labelledby="appointment-review-heading">
        <div className="space-y-1.5">
          <h3 id="appointment-review-heading" className="text-lg font-bold tracking-tight text-foreground">
            O que vai acontecer
          </h3>
          <p className="text-sm font-medium text-muted-foreground">
            Revise o fluxo. A disponibilidade será confirmada novamente ao criar.
          </p>
        </div>

        <ol className="relative space-y-3" aria-label="Resumo do agendamento">
          {reviewItems.map((item, index) => (
            <li key={`${index}-${item.title}`} className="relative grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3">
              {index < reviewItems.length - 1 ? (
                <span
                  className="absolute bottom-[-0.75rem] left-[1.34rem] top-11 w-px bg-border/70"
                  aria-hidden="true"
                />
              ) : null}
              <span className="synapse-chat-glass relative z-10 flex h-11 w-11 items-center justify-center rounded-full border text-sm font-black text-foreground">
                {index + 1}
              </span>
              <div className="agenda-liquid-card min-w-0 rounded-[20px] border p-4">
                <p className="text-sm font-black text-foreground">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>

                {"mapsLocation" in item && item.mapsLocation ? (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.mapsLocation)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="agenda-tactile notification-liquid-control mt-3 inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-xs font-bold text-foreground"
                  >
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    Ver no Google Maps
                    <ExternalLink className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                  </a>
                ) : null}

                {"feeSummaries" in item && item.feeSummaries?.length ? (
                  <dl className="mt-3 grid gap-1.5 border-t border-border/55 pt-3">
                    {item.feeSummaries.map((summary) => (
                      <div key={summary.method} className="flex items-center justify-between gap-3 text-[11px]">
                        <dt className="font-bold text-muted-foreground">{neurofinanceMethodLabel(summary.method)}</dt>
                        <dd className="text-right font-semibold text-foreground">
                          {summary.netAmount == null
                            ? "Taxa confirmada no pagamento"
                            : `Líquido estimado ${(summary.netAmount / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
                          {summary.settlementLabel ? ` · ${summary.settlementLabel}` : ""}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </section>
    );
  };

  const renderRecurrencePreview = () => {
    const recurrenceRule = agendaRecurrenceDraftToRule(recurrenceDraft);
    return (
      <div className="agenda-step-enter space-y-4">
        <div className="space-y-1.5">
          <h3 className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
            <span className="rounded-full bg-secondary/20 p-2">
              <Repeat className="h-4 w-4 text-foreground" aria-hidden="true" />
            </span>
            Datas da recorrência
          </h3>
          <p className="ml-1 text-sm font-medium text-muted-foreground">
            Ajuste apenas {eventType === "event" ? "os eventos" : "as sessões"} que fugirem do padrão.
          </p>
        </div>

        {isPreviewingAgendaPlan ? (
          <div className={cn(cardBase, "flex min-h-32 items-center justify-center gap-3")} role="status">
            <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            <span className="text-sm font-medium text-muted-foreground">Verificando todas as datas...</span>
          </div>
        ) : null}

        {!isPreviewingAgendaPlan && seriesPreviewError ? (
          <div className="synapse-liquid-toolbar flex items-start gap-3 rounded-[18px] p-3" role="status" aria-live="polite">
            <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="text-xs font-semibold leading-relaxed text-foreground">{seriesPreviewError}</p>
          </div>
        ) : null}

        {!isPreviewingAgendaPlan && seriesPreview ? (
          <>
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
                  const sourceOccurrenceNumber =
                    occurrence.originalOccurrenceNumber || occurrence.occurrenceNumber;
                  const override = recurrenceDraft.overrides.find(
                    (item) => item.occurrenceNumber === sourceOccurrenceNumber,
                  );
                  return (
                  <li
                    key={`${occurrence.occurrenceNumber}-${occurrence.startTime}`}
                    data-appointment-occurrence={occurrence.occurrenceNumber}
                    data-appointment-field={`occurrence-${occurrence.occurrenceNumber}`}
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
                          data-override-field="date"
                          value={override?.date || format(new Date(occurrence.startTime), "yyyy-MM-dd")}
                          onChange={(event) => updateOccurrenceOverride(sourceOccurrenceNumber, { date: event.target.value })}
                          className="agenda-field h-11 rounded-xl text-xs font-semibold"
                          aria-label={`Data do ${recurrenceTerminology.singular} ${occurrence.occurrenceNumber}`}
                        />
                        <Input
                          type="time"
                          data-override-field="startTime"
                          value={override?.startTime || format(new Date(occurrence.startTime), "HH:mm")}
                          onChange={(event) => updateOccurrenceOverride(sourceOccurrenceNumber, { startTime: event.target.value })}
                          className="agenda-field h-11 rounded-xl text-xs font-semibold"
                          aria-label={`Horário do ${recurrenceTerminology.singular} ${occurrence.occurrenceNumber}`}
                        />
                        <Input
                          type="number"
                          data-override-field="durationMinutes"
                          min={15}
                          max={1440}
                          value={override?.durationMinutes || occurrence.durationMinutes}
                          onChange={(event) => updateOccurrenceOverride(sourceOccurrenceNumber, { durationMinutes: Number(event.target.value) })}
                          className="agenda-field h-11 rounded-xl text-xs font-semibold"
                          aria-label={`Duração do ${recurrenceTerminology.singular} ${occurrence.occurrenceNumber}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => excludeOccurrence(
                            sourceOccurrenceNumber,
                            occurrence.occurrenceNumber,
                          )}
                          className="agenda-tactile notification-liquid-control h-11 w-11 rounded-full"
                          aria-label={`Excluir ${recurrenceTerminology.singular} ${occurrence.occurrenceNumber} desta recorrência`}
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
                                onClick={() => applySmartFitCandidate(
                                  sourceOccurrenceNumber,
                                  candidate,
                                  occurrence.occurrenceNumber,
                                )}
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
                    Use esta configuração de novo sem preencher tudo.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Input
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  placeholder={`Ex.: 4 ${recurrenceTerminology.plural} · terceira de manhã`}
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
              {eventType === "event"
                ? "A série de eventos é confirmada depois da validação de disponibilidade."
                : "A série e as reservas de pacote são confirmadas juntas."}
              {eventType === "session" && shouldGenerateNeurofinanceCharge
                ? " Depois, o NeuroFinance cria e vincula as cobranças de cada sessão."
                : eventType === "session"
                  ? " E-mails em lote e notas fiscais não são gerados nesta etapa."
                  : null}
            </p>
          </>
        ) : null}
      </div>
    );
  };

  const renderFinalReview = () => (
    <div className="agenda-step-enter space-y-6">
      {renderReviewSummary()}
      {recurrenceEnabled ? renderRecurrencePreview() : null}
    </div>
  );

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
    setSubmissionError(null);
    setValidationAnnouncement("");
    const fields = getAppointmentFieldsForStep(
      eventType,
      recurrenceEnabled,
      step,
    ) as FieldPath<FormValues>[];
    const isValid = fields.length ? await form.trigger(fields) : true;
    if (!isValid) {
      await revealFirstInvalidField();
      return;
    }

    const isEnteringReview = step === totalSteps - 1;
    if (isEnteringReview) {
      if (recurrenceEnabled) {
        const preview = await loadSeriesPreview(form.getValues());
        if (!preview) return;
        if (!preview.valid) {
          nextStep();
          return;
        }
        const prepared = await prepareSeriesAppointmentForReview(form.getValues());
        if (!prepared) return;
      } else {
        const prepared = await prepareSingleAppointmentForReview(form.getValues());
        if (!prepared) return;
      }
    }
    nextStep();
  };

  const submitButtonLabel = useMemo(() => {
    if (recurrenceEnabled) {
      return eventType === "event" ? "Criar série de eventos" : "Criar série";
    }
    if (eventType === "event") return "Registrar Evento";
    return "Registrar Agendamento";
  }, [eventType, recurrenceEnabled]);

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <>
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
        <div ref={bodyScrollRef} className="px-5 py-3 sm:px-6 overflow-y-auto custom-scrollbar flex-1 min-h-0">
          <Form {...form}>
            <form
              id={APPOINTMENT_FORM_ID}
              onSubmit={form.handleSubmit(onSubmit, onInvalid)}
              className="space-y-3"
            >
              <p className="sr-only" role="status" aria-live="assertive" aria-atomic="true">
                {validationAnnouncement}
              </p>
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && (
                eventType === "session"
                  ? renderStep3()
                  : renderFinalReview()
              )}
              {step === 4 && eventType === "session" && renderFinalReview()}
              {submissionError ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="synapse-liquid-toolbar flex items-start gap-3 rounded-[18px] p-3 text-sm"
                >
                  <span className="synapse-liquid-control flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] text-muted-foreground">
                    <CircleHelp className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <p className="min-w-0 pt-2 text-xs font-semibold leading-relaxed text-foreground">
                    {submissionError}
                  </p>
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
              disabled={isSubmitting}
              className="agenda-primary-action h-11 rounded-full px-6 font-bold tracking-wide"
            >
              {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continuar"}
            </Button>
          ) : (
            <Button
              type="submit"
              form={APPOINTMENT_FORM_ID}
              disabled={
                isSubmitting
                || (recurrenceEnabled && (
                  !seriesPreview?.valid
                  || seriesPreviewFingerprint !== currentPreviewFingerprint
                ))
              }
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
      <EventCategoryManagerDialog
        open={isCategoryManagerOpen}
        onOpenChange={setIsCategoryManagerOpen}
        selectedSlug={form.watch("eventCategory")}
        onSelect={(slug) => {
          form.setValue("eventCategory", slug, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }}
        onArchived={(slug) => {
          if (form.getValues("eventCategory") === slug) {
            form.setValue("eventCategory", "", { shouldDirty: true, shouldValidate: true });
          }
        }}
      />
    </>
  );
}
