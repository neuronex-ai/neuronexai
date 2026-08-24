"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarRange, Clock, Info, Loader2, Plus, RotateCcw, Save, Settings, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { AppModalShell, ModalHeroIcon } from "@/components/ui/app-modal-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  appointmentPolicyFingerprint,
  type AppointmentConsequence,
  type AppointmentPolicyDraft,
  type ChargePolicy,
  DEFAULT_APPOINTMENT_POLICY,
  type FiscalPolicy,
  normalizeAppointmentPolicyDraft,
  type PackageCreditPolicy,
} from "@/lib/appointment-policy-form";
import { cn } from "@/lib/utils";

const DAYS_OF_WEEK = [
  { id: "0", label: "Domingo", short: "Dom" },
  { id: "1", label: "Segunda-feira", short: "Seg" },
  { id: "2", label: "Terça-feira", short: "Ter" },
  { id: "3", label: "Quarta-feira", short: "Qua" },
  { id: "4", label: "Quinta-feira", short: "Qui" },
  { id: "5", label: "Sexta-feira", short: "Sex" },
  { id: "6", label: "Sábado", short: "Sáb" },
];

const CONSEQUENCE_OPTIONS: Array<{ value: AppointmentConsequence; label: string }> = [
  { value: "manual_review", label: "Revisar cada caso" },
  { value: "consume_credit", label: "Consumir crédito reservado" },
  { value: "keep_charge", label: "Manter cobrança" },
  { value: "partial_fee", label: "Aplicar cobrança parcial" },
  { value: "waive", label: "Isentar consequência" },
];

const PACKAGE_CREDIT_OPTIONS: Array<{ value: PackageCreditPolicy; label: string }> = [
  { value: "release_reserved_credit", label: "Liberar o crédito reservado" },
  { value: "keep_reserved_credit", label: "Manter o crédito reservado" },
  { value: "manual_review", label: "Enviar para revisão manual" },
];

const CHARGE_OPTIONS: Array<{ value: ChargePolicy; label: string }> = [
  {
    value: "cancel_pending_keep_paid_as_credit",
    label: "Cancelar pendente e preservar pagamento como crédito",
  },
  { value: "keep_existing", label: "Manter cobranças existentes" },
  { value: "refund_paid", label: "Preparar reembolso do valor pago" },
  { value: "manual_review", label: "Enviar para revisão manual" },
];

const FISCAL_OPTIONS: Array<{ value: FiscalPolicy; label: string }> = [
  {
    value: "disable_unissued_review_issued",
    label: "Bloquear emissão nova e revisar notas emitidas",
  },
  { value: "keep_existing", label: "Manter tratamento fiscal existente" },
  { value: "manual_review", label: "Enviar para revisão fiscal" },
];

type WorkingDayHours = { enabled: boolean; start: string; end: string };
type WorkingHours = Record<string, WorkingDayHours>;
type AdditionalWorkingHours = Record<string, Array<{ id: string; start: string; end: string }>>;

interface AvailabilityImpact {
  valid: boolean;
  effectiveFrom: string;
  conflictCount: number;
  conflicts: Array<{
    appointmentId: string;
    patientId: string | null;
    patientName?: string | null;
    seriesId: string | null;
    startTime: string;
    endTime: string;
    reasonCode: string;
  }>;
}

type AvailabilityStrategy = "keep_exceptions" | "resolve_before_save" | "keep_previous_until";
type WaitlistMigrationStrategy = "migrate_all" | "keep_previous";

interface EffectiveAppointmentPolicy {
  configured: boolean;
  version: number | null;
  effectiveAt: string | null;
  freeCancellationHours: number | string;
  freeRescheduleHours: number | string;
  minimumPatientReactionHours: number | string;
  professionalResponseSlaHours: number | string;
  lateCancellationConsequence: AppointmentConsequence;
  noShowConsequence: AppointmentConsequence;
  packageCreditPolicy: PackageCreditPolicy;
  chargePolicy: ChargePolicy;
  fiscalPolicy: FiscalPolicy;
  timezone: string;
}

const DEFAULT_WORKING_HOURS: WorkingHours = {
  "0": { enabled: false, start: "08:00", end: "12:00" },
  "1": { enabled: true, start: "08:00", end: "19:00" },
  "2": { enabled: true, start: "08:00", end: "19:00" },
  "3": { enabled: true, start: "08:00", end: "19:00" },
  "4": { enabled: true, start: "08:00", end: "19:00" },
  "5": { enabled: true, start: "08:00", end: "19:00" },
  "6": { enabled: false, start: "08:00", end: "12:00" },
};

const effectivePolicyToDraft = (policy: EffectiveAppointmentPolicy): AppointmentPolicyDraft => ({
  freeCancellationHours: String(policy.freeCancellationHours),
  freeRescheduleHours: String(policy.freeRescheduleHours),
  minimumPatientReactionHours: String(policy.minimumPatientReactionHours),
  professionalResponseSlaHours: String(policy.professionalResponseSlaHours),
  lateCancellationConsequence: policy.lateCancellationConsequence,
  noShowConsequence: policy.noShowConsequence,
  packageCreditPolicy: policy.packageCreditPolicy,
  chargePolicy: policy.chargePolicy,
  fiscalPolicy: policy.fiscalPolicy,
  timezone: policy.timezone,
});

const validateWorkingHours = (hours: WorkingHours, additional: AdditionalWorkingHours) => {
  for (const day of DAYS_OF_WEEK) {
    const interval = hours[day.id];
    if (!interval?.enabled) continue;
    const intervals = [interval, ...(additional[day.id] || [])].sort((left, right) => left.start.localeCompare(right.start));
    for (const [index, current] of intervals.entries()) {
      if (!current.start || !current.end || current.start >= current.end) {
        throw new Error(`Em ${day.label}, o horário final deve ser posterior ao inicial.`);
      }
      if (index > 0 && intervals[index - 1].end > current.start) {
        throw new Error(`Em ${day.label}, existem períodos sobrepostos.`);
      }
    }
  }
};

const workingHoursFingerprint = (hours: WorkingHours) => JSON.stringify(
  Object.fromEntries(Object.entries(hours).sort(([left], [right]) => left.localeCompare(right))),
);

const availabilityFingerprint = (hours: WorkingHours, additional: AdditionalWorkingHours) =>
  `${workingHoursFingerprint(hours)}:${JSON.stringify(additional)}`;

const workingHoursToWindows = (hours: WorkingHours, additional: AdditionalWorkingHours) => DAYS_OF_WEEK.flatMap((day) => {
  const interval = hours[day.id];
  if (!interval?.enabled) return [];
  return [interval, ...(additional[day.id] || [])].map((window) => ({
    weekday: Number(day.id),
    start_time: window.start,
    end_time: window.end,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo",
  }));
});

const toLocalDateTimeInput = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

interface PolicyNumberFieldProps {
  id: string;
  label: string;
  description: string;
  value: string;
  min: number;
  max: number;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const PolicyNumberField = ({
  id,
  label,
  description,
  value,
  min,
  max,
  onChange,
  disabled,
}: PolicyNumberFieldProps) => (
  <div className="space-y-2">
    <Label htmlFor={id} className="text-sm font-bold text-foreground">
      {label}
    </Label>
    <Input
      id={id}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step="0.25"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      aria-describedby={`${id}-help`}
      className="h-11 rounded-xl border-border/70 bg-background font-semibold"
    />
    <p id={`${id}-help`} className="text-xs leading-relaxed text-muted-foreground">
      {description}
    </p>
  </div>
);

interface PolicySelectFieldProps<T extends string> {
  id: string;
  label: string;
  description: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  disabled?: boolean;
}

const PolicySelectField = <T extends string>({
  id,
  label,
  description,
  value,
  options,
  onChange,
  disabled,
}: PolicySelectFieldProps<T>) => (
  <div className="space-y-2">
    <Label htmlFor={id} className="text-sm font-bold text-foreground">
      {label}
    </Label>
    <Select value={value} onValueChange={(nextValue) => onChange(nextValue as T)} disabled={disabled}>
      <SelectTrigger id={id} aria-describedby={`${id}-help`} className="border-border/70 bg-background">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="agenda-menu-surface">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <p id={`${id}-help`} className="text-xs leading-relaxed text-muted-foreground">
      {description}
    </p>
  </div>
);

export const AgendaSettingsModal = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const saveInFlightRef = useRef(false);
  const pendingPolicyIdempotencyKeyRef = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [workingHours, setWorkingHours] = useState<WorkingHours>({ ...DEFAULT_WORKING_HOURS });
  const [originalWorkingHours, setOriginalWorkingHours] = useState<WorkingHours>({ ...DEFAULT_WORKING_HOURS });
  const [additionalWorkingHours, setAdditionalWorkingHours] = useState<AdditionalWorkingHours>({});
  const [originalAdditionalWorkingHours, setOriginalAdditionalWorkingHours] = useState<AdditionalWorkingHours>({});
  const [originalWorkingHoursFingerprint, setOriginalWorkingHoursFingerprint] = useState(
    availabilityFingerprint(DEFAULT_WORKING_HOURS, {}),
  );
  const [availabilityImpact, setAvailabilityImpact] = useState<AvailabilityImpact | null>(null);
  const [availabilityStrategy, setAvailabilityStrategy] = useState<AvailabilityStrategy | null>(null);
  const [waitlistStrategy, setWaitlistStrategy] = useState<WaitlistMigrationStrategy>("migrate_all");
  const [effectiveFrom, setEffectiveFrom] = useState(() => toLocalDateTimeInput(new Date()));
  const [availabilityReason, setAvailabilityReason] = useState("");
  const [policyDraft, setPolicyDraft] = useState<AppointmentPolicyDraft>({ ...DEFAULT_APPOINTMENT_POLICY });
  const [originalPolicyFingerprint, setOriginalPolicyFingerprint] = useState(
    appointmentPolicyFingerprint(DEFAULT_APPOINTMENT_POLICY),
  );
  const [policyVersion, setPolicyVersion] = useState<number | null>(null);
  const [policyEffectiveAt, setPolicyEffectiveAt] = useState<string | null>(null);
  const [policyReason, setPolicyReason] = useState("");
  const [policyAvailable, setPolicyAvailable] = useState(true);

  const policyFingerprint = useMemo(() => {
    try {
      return appointmentPolicyFingerprint(policyDraft);
    } catch {
      return null;
    }
  }, [policyDraft]);
  const policyChanged = policyFingerprint === null || policyFingerprint !== originalPolicyFingerprint;
  const workingHoursChanged = availabilityFingerprint(workingHours, additionalWorkingHours) !== originalWorkingHoursFingerprint;

  const updatePolicy = <K extends keyof AppointmentPolicyDraft>(
    field: K,
    value: AppointmentPolicyDraft[K],
  ) => {
    pendingPolicyIdempotencyKeyRef.current = null;
    setPolicyDraft((current) => ({ ...current, [field]: value }));
  };

  const loadSettings = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    setPolicyReason("");
    setAvailabilityImpact(null);
    setAvailabilityStrategy(null);
    setWaitlistStrategy("migrate_all");
    setEffectiveFrom(toLocalDateTimeInput(new Date()));
    setAvailabilityReason("");
    pendingPolicyIdempotencyKeyRef.current = null;

    try {
      const database = supabase;
      const [profileResult, policyResult, availabilityResult] = await Promise.all([
        database.from("profiles").select("working_hours").eq("id", user.id).single(),
        database.rpc("get_effective_appointment_policy"),
        database
          .from("professional_availability_versions")
          .select("id,professional_availability_windows(weekday,start_time,end_time)")
          .eq("status", "active")
          .order("version_number", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const profileHours = !profileResult.error && profileResult.data?.working_hours && typeof profileResult.data.working_hours === "object"
        ? profileResult.data.working_hours as WorkingHours
        : { ...DEFAULT_WORKING_HOURS };
      let loadedHours = profileHours;
      const loadedAdditional: AdditionalWorkingHours = {};
      const versionWindows = availabilityResult.data?.professional_availability_windows as Array<{
        weekday: number;
        start_time: string;
        end_time: string;
      }> | undefined;
      if (!availabilityResult.error && versionWindows?.length) {
        loadedHours = Object.fromEntries(DAYS_OF_WEEK.map((day) => [day.id, {
          enabled: false,
          start: profileHours[day.id]?.start || "08:00",
          end: profileHours[day.id]?.end || "18:00",
        }])) as WorkingHours;
        const grouped = new Map<number, typeof versionWindows>();
        versionWindows
          .sort((left, right) => left.start_time.localeCompare(right.start_time))
          .forEach((window) => grouped.set(window.weekday, [...(grouped.get(window.weekday) || []), window]));
        for (const [weekday, dayWindows] of grouped) {
          const [first, ...rest] = dayWindows;
          loadedHours[String(weekday)] = { enabled: true, start: first.start_time.slice(0, 5), end: first.end_time.slice(0, 5) };
          loadedAdditional[String(weekday)] = rest.map((window) => ({
            id: crypto.randomUUID(),
            start: window.start_time.slice(0, 5),
            end: window.end_time.slice(0, 5),
          }));
        }
      }
      setWorkingHours(loadedHours);
      setOriginalWorkingHours(loadedHours);
      setAdditionalWorkingHours(loadedAdditional);
      setOriginalAdditionalWorkingHours(loadedAdditional);
      setOriginalWorkingHoursFingerprint(availabilityFingerprint(loadedHours, loadedAdditional));

      if (policyResult.error) {
        setPolicyAvailable(false);
        setPolicyDraft({ ...DEFAULT_APPOINTMENT_POLICY });
        setOriginalPolicyFingerprint(appointmentPolicyFingerprint(DEFAULT_APPOINTMENT_POLICY));
        setPolicyVersion(null);
        setPolicyEffectiveAt(null);
      } else {
        setPolicyAvailable(true);
        const policy = policyResult.data as EffectiveAppointmentPolicy;
        const nextDraft = effectivePolicyToDraft(policy);
        setPolicyDraft(nextDraft);
        setOriginalPolicyFingerprint(appointmentPolicyFingerprint(nextDraft));
        setPolicyVersion(policy.version);
        setPolicyEffectiveAt(policy.effectiveAt);
      }
    } catch (error) {
      setWorkingHours({ ...DEFAULT_WORKING_HOURS });
      setOriginalWorkingHours({ ...DEFAULT_WORKING_HOURS });
      setAdditionalWorkingHours({});
      setOriginalAdditionalWorkingHours({});
      setOriginalWorkingHoursFingerprint(availabilityFingerprint(DEFAULT_WORKING_HOURS, {}));
      setPolicyAvailable(false);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (open) void loadSettings();
  }, [open, loadSettings]);

  const handleSave = async () => {
    if (!user || saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    setIsSaving(true);

    try {
      validateWorkingHours(workingHours, additionalWorkingHours);
      const database = supabase;
      const windows = workingHoursToWindows(workingHours, additionalWorkingHours);
      let impact = availabilityImpact;
      let selectedAvailabilityStrategy = availabilityStrategy;

      if (workingHoursChanged) {
        const effectiveDate = new Date(effectiveFrom);
        if (Number.isNaN(effectiveDate.getTime())) {
          throw new Error("Informe quando a nova grade começa a valer.");
        }
        const previewResult = await database.rpc("preview_availability_change", {
          p_windows: windows,
          p_effective_from: effectiveDate.toISOString(),
        });
        if (previewResult.error) {
          throw new Error(previewResult.error.message || "Não foi possível revisar o impacto da nova grade.");
        }
        impact = previewResult.data as AvailabilityImpact;
        setAvailabilityImpact(impact);

        if (impact.conflictCount > 0 && !selectedAvailabilityStrategy) {
          toast.info("Revise os agendamentos afetados antes de confirmar a nova grade.");
          return;
        }
        if (selectedAvailabilityStrategy === "resolve_before_save" && impact.conflictCount > 0) {
          toast.info("Abra o primeiro conflito, ajuste-o e depois volte para salvar a grade.");
          return;
        }
        selectedAvailabilityStrategy ||= "keep_exceptions";
        if (selectedAvailabilityStrategy === "keep_previous_until" && effectiveDate <= new Date()) {
          throw new Error("Escolha uma data futura para manter a grade anterior até lá.");
        }
      }

      let policyPayload: Record<string, unknown> | null = null;
      if (policyChanged) {
        if (!policyAvailable) {
          throw new Error("As regras comerciais não estão disponíveis. Reabra esta tela e tente novamente.");
        }

        const normalizedPolicy = normalizeAppointmentPolicyDraft(policyDraft);
        const reason = policyReason.trim();
        if (!reason) {
          throw new Error("Informe o motivo da nova versão das regras comerciais.");
        }

        pendingPolicyIdempotencyKeyRef.current ||= `appointment-policy:${crypto.randomUUID()}`;
        policyPayload = {
          free_cancellation_hours: normalizedPolicy.freeCancellationHours,
          free_reschedule_hours: normalizedPolicy.freeRescheduleHours,
          minimum_patient_reaction_hours: normalizedPolicy.minimumPatientReactionHours,
          professional_response_sla_hours: normalizedPolicy.professionalResponseSlaHours,
          late_cancellation_consequence: normalizedPolicy.lateCancellationConsequence,
          no_show_consequence: normalizedPolicy.noShowConsequence,
          package_credit_policy: normalizedPolicy.packageCreditPolicy,
          charge_policy: normalizedPolicy.chargePolicy,
          fiscal_policy: normalizedPolicy.fiscalPolicy,
          timezone: normalizedPolicy.timezone,
          reason,
          idempotency_key: pendingPolicyIdempotencyKeyRef.current,
        };
      }

      const availabilityPayload = workingHoursChanged ? {
        windows,
        effective_from: new Date(effectiveFrom).toISOString(),
        strategy: selectedAvailabilityStrategy || "keep_exceptions",
        waitlist_strategy: waitlistStrategy,
        waitlist_entry_ids: null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo",
        reason: availabilityReason.trim() || "Grade de atendimento atualizada pelo profissional.",
      } : null;

      let bundleResult: {
        availability?: { impact?: AvailabilityImpact };
        policy?: { version?: number; effectiveAt?: string };
      } = {};
      if (availabilityPayload || policyPayload) {
        const { data, error } = await database.rpc("save_agenda_settings_bundle", {
          p_availability: availabilityPayload,
          p_policy: policyPayload,
        });
        if (error) throw new Error(error.message || "Não foi possível salvar as configurações da agenda.");
        bundleResult = (data || {}) as typeof bundleResult;
      }

      const createdPolicyVersion = Boolean(policyPayload);
      if (createdPolicyVersion) {
        setOriginalPolicyFingerprint(appointmentPolicyFingerprint(policyDraft));
        setPolicyVersion(typeof bundleResult.policy?.version === "number" ? bundleResult.policy.version : policyVersion);
        setPolicyEffectiveAt(typeof bundleResult.policy?.effectiveAt === "string" ? bundleResult.policy.effectiveAt : new Date().toISOString());
        setPolicyReason("");
        pendingPolicyIdempotencyKeyRef.current = null;
      }

      const savedAvailability = Boolean(availabilityPayload);
      if (savedAvailability) {
        setOriginalWorkingHours(workingHours);
        setOriginalAdditionalWorkingHours(additionalWorkingHours);
        setOriginalWorkingHoursFingerprint(availabilityFingerprint(workingHours, additionalWorkingHours));
        setAvailabilityImpact((bundleResult.availability?.impact || impact) as AvailabilityImpact);
        window.dispatchEvent(new CustomEvent("agenda-availability-updated"));
      }

      toast.success(
        createdPolicyVersion && savedAvailability
          ? "Nova grade e nova versão comercial salvas."
          : createdPolicyVersion
            ? "Nova versão das regras comerciais criada."
            : savedAvailability
              ? selectedAvailabilityStrategy === "keep_previous_until"
                ? "Nova grade programada para a data escolhida."
                : "Nova grade ativa a partir de agora."
              : "Nenhuma alteração pendente.",
      );
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar configurações.");
    } finally {
      saveInFlightRef.current = false;
      setIsSaving(false);
    }
  };

  const updateDay = <K extends keyof WorkingDayHours>(
    dayId: string,
    field: K,
    value: WorkingDayHours[K],
  ) => {
    setAvailabilityImpact(null);
    setAvailabilityStrategy(null);
    setWorkingHours((current) => ({
      ...current,
      [dayId]: {
        ...(current[dayId] ?? DEFAULT_WORKING_HOURS[dayId] ?? { enabled: false, start: "08:00", end: "18:00" }),
        [field]: value,
      },
    }));
  };

  const addWorkingPeriod = (dayId: string) => {
    setAvailabilityImpact(null);
    setAvailabilityStrategy(null);
    setAdditionalWorkingHours((current) => ({
      ...current,
      [dayId]: [...(current[dayId] || []), { id: crypto.randomUUID(), start: "14:00", end: "18:00" }],
    }));
  };

  const updateWorkingPeriod = (dayId: string, periodId: string, field: "start" | "end", value: string) => {
    setAvailabilityImpact(null);
    setAvailabilityStrategy(null);
    setAdditionalWorkingHours((current) => ({
      ...current,
      [dayId]: (current[dayId] || []).map((period) => period.id === periodId ? { ...period, [field]: value } : period),
    }));
  };

  const removeWorkingPeriod = (dayId: string, periodId: string) => {
    setAvailabilityImpact(null);
    setAvailabilityStrategy(null);
    setAdditionalWorkingHours((current) => ({
      ...current,
      [dayId]: (current[dayId] || []).filter((period) => period.id !== periodId),
    }));
  };

  const formattedEffectiveAt = policyEffectiveAt
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(policyEffectiveAt))
    : null;

  const handlePrimaryAction = () => {
    if (availabilityStrategy === "resolve_before_save" && availabilityImpact?.conflicts[0]) {
      setOpen(false);
      navigate(`/agenda?appointmentId=${availabilityImpact.conflicts[0].appointmentId}`);
      return;
    }
    void handleSave();
  };

  return (
    <AppModalShell
      open={open}
      onOpenChange={setOpen}
      preventClose={isSaving}
      size="lg"
      className="agenda-modal-surface"
      bodyClassName="agenda-modal-body"
      headerClassName="agenda-modal-header border-b"
      footerClassName="agenda-modal-footer"
      eyebrow="Agenda"
      title="Disponibilidade e regras"
      description="Defina sua grade de atendimento e as regras comerciais usadas em novos convites."
      heroIcon={<ModalHeroIcon icon={Clock} ariaLabel="Configurações da agenda" />}
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className="agenda-floating-pill agenda-header-control agenda-icon-control agenda-tactile h-11 w-11 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Configurar agenda e regras comerciais"
        >
          <Settings className="h-4 w-4" />
        </Button>
      }
      footer={
        <Button
          onClick={handlePrimaryAction}
          disabled={isSaving || isLoading}
          className="agenda-primary-action h-12 w-full rounded-2xl text-[10.5px] font-black uppercase tracking-[0.16em] disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
          ) : (
            <Save className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          {isSaving
            ? "Salvando..."
            : availabilityStrategy === "resolve_before_save" && availabilityImpact?.conflictCount
              ? "Abrir primeiro conflito"
              : availabilityImpact?.conflictCount && !availabilityStrategy
                ? "Escolher como continuar"
                : "Salvar agenda e regras"}
        </Button>
      }
    >
      {isLoading ? (
        <div className="flex min-h-[18rem] items-center justify-center" role="status" aria-label="Carregando configurações">
          <Loader2 className="h-8 w-8 motion-safe:animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      ) : (
        <div className="space-y-5">
          <section aria-labelledby="working-hours-heading" className="agenda-liquid-surface rounded-3xl border p-4 sm:p-5">
            <div className="mb-4">
              <h3 id="working-hours-heading" className="text-base font-black text-foreground">
                Grade semanal
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Estes intervalos limitam os horários que podem ser oferecidos ao paciente.
              </p>
            </div>

            <div className="space-y-3">
              {DAYS_OF_WEEK.map((day) => {
                const hours = workingHours[day.id] || { enabled: false, start: "08:00", end: "18:00" };
                return (
                  <div
                    key={day.id}
                    className={cn(
                      "agenda-liquid-card rounded-2xl border motion-safe:transition-colors",
                      hours.enabled ? "opacity-100" : "opacity-65",
                    )}
                  >
                    <div className={cn("flex items-center gap-3 p-3 sm:p-4", hours.enabled && "pb-2")}>
                      <Switch
                        checked={hours.enabled}
                        onCheckedChange={(checked) => updateDay(day.id, "enabled", checked)}
                        aria-label={`Ativar ${day.label}`}
                      />
                      <span className="flex-1 truncate text-sm font-bold text-foreground">
                        <span className="hidden sm:inline">{day.label}</span>
                        <span className="sm:hidden">{day.short}</span>
                      </span>

                      {hours.enabled ? (
                        <div className="hidden items-center gap-2 sm:flex">
                          <Input
                            type="time"
                            value={hours.start}
                            onChange={(event) => updateDay(day.id, "start", event.target.value)}
                            className="h-11 w-[104px] rounded-xl border-border/70 bg-background text-center text-sm font-bold"
                            aria-label={`Início em ${day.label}`}
                          />
                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">até</span>
                          <Input
                            type="time"
                            value={hours.end}
                            onChange={(event) => updateDay(day.id, "end", event.target.value)}
                            className="h-11 w-[104px] rounded-xl border-border/70 bg-background text-center text-sm font-bold"
                            aria-label={`Fim em ${day.label}`}
                          />
                        </div>
                      ) : null}
                    </div>

                    {hours.enabled ? (
                      <div className="px-3 pb-3 sm:hidden">
                        <div className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={hours.start}
                            onChange={(event) => updateDay(day.id, "start", event.target.value)}
                            className="h-11 flex-1 rounded-xl border-border/70 bg-background text-center text-sm font-bold"
                            aria-label={`Início em ${day.label}`}
                          />
                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">até</span>
                          <Input
                            type="time"
                            value={hours.end}
                            onChange={(event) => updateDay(day.id, "end", event.target.value)}
                            className="h-11 flex-1 rounded-xl border-border/70 bg-background text-center text-sm font-bold"
                            aria-label={`Fim em ${day.label}`}
                          />
                        </div>
                      </div>
                    ) : null}
                    {hours.enabled ? (
                      <div className="border-t border-border/35 px-3 pb-3 pt-2 sm:px-4">
                        {(additionalWorkingHours[day.id] || []).map((period, index) => (
                          <div key={period.id} className="mt-2 flex items-center gap-2">
                            <span className="w-14 text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground">Período {index + 2}</span>
                            <Input type="time" value={period.start} onChange={(event) => updateWorkingPeriod(day.id, period.id, "start", event.target.value)} className="h-11 min-w-0 flex-1 rounded-xl border-border/60 bg-background text-center text-xs font-bold" aria-label={`Início do período ${index + 2} em ${day.label}`} />
                            <span className="text-[9px] font-bold uppercase text-muted-foreground">até</span>
                            <Input type="time" value={period.end} onChange={(event) => updateWorkingPeriod(day.id, period.id, "end", event.target.value)} className="h-11 min-w-0 flex-1 rounded-xl border-border/60 bg-background text-center text-xs font-bold" aria-label={`Fim do período ${index + 2} em ${day.label}`} />
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeWorkingPeriod(day.id, period.id)} className="notification-liquid-control h-11 w-11 rounded-full" aria-label={`Remover período ${index + 2} de ${day.label}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        ))}
                        <Button type="button" variant="ghost" size="sm" onClick={() => addWorkingPeriod(day.id)} className="notification-liquid-control mt-2 h-11 rounded-full px-3 text-[10px] font-black"><Plus className="mr-1 h-3.5 w-3.5" />Adicionar período</Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          {workingHoursChanged ? (
            <section aria-labelledby="availability-change-heading" className="agenda-liquid-surface rounded-[26px] border p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="synapse-chat-glass flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] border">
                  <CalendarRange className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 id="availability-change-heading" className="text-base font-black text-foreground">A partir de agora, sem alterar o passado</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">A nova grade será versionada. Agendamentos anteriores nunca são reescritos.</p>
                </div>
              </div>

              {availabilityImpact?.conflictCount ? (
                <div className="mt-4 space-y-3">
                  <div className="flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.08] p-3.5">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <div><p className="text-sm font-black text-foreground">{availabilityImpact.conflictCount} {availabilityImpact.conflictCount === 1 ? "sessão ficará fora" : "sessões ficarão fora"} da nova grade</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Escolha conscientemente o que fazer antes de salvar.</p></div>
                  </div>
                  <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                    {availabilityImpact.conflicts.map((conflict) => (
                      <div key={conflict.appointmentId} className="synapse-chat-glass flex items-center justify-between gap-3 rounded-[16px] border px-3 py-2.5">
                        <div className="min-w-0"><p className="truncate text-xs font-black text-foreground">{conflict.patientName || (conflict.seriesId ? "Sessão recorrente" : "Agendamento individual")}</p><p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(conflict.startTime))}{conflict.seriesId ? " · parte de uma série" : ""}</p></div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setOpen(false); navigate(`/agenda?appointmentId=${conflict.appointmentId}`); }} className="notification-liquid-control h-11 rounded-full px-3 text-[10px] font-black">Abrir</Button>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-2">
                    {[
                      { value: "keep_exceptions" as const, title: "Salvar e manter como exceções", description: "A nova grade vale agora; estas sessões continuam nos horários atuais." },
                      { value: "resolve_before_save" as const, title: "Reencaixar com o Synapse antes", description: "Abrimos cada conflito com sugestões compatíveis; nada muda na grade até você terminar." },
                      { value: "keep_previous_until" as const, title: "Programar a nova grade", description: "A regra atual continua até a data que você escolher." },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={availabilityStrategy === option.value}
                        onClick={() => {
                          setAvailabilityStrategy(option.value);
                          if (option.value === "keep_previous_until" && new Date(effectiveFrom) <= new Date()) {
                            const tomorrow = new Date();
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            setEffectiveFrom(toLocalDateTimeInput(tomorrow));
                          }
                        }}
                        className={cn("agenda-choice-card synapse-chat-glass rounded-[18px] border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", availabilityStrategy === option.value && "synapse-liquid-tab-active")}
                      >
                        <span className="block text-xs font-black text-foreground">{option.title}</span><span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{option.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {availabilityStrategy === "keep_previous_until" ? (
                <div className="mt-4 space-y-2"><Label htmlFor="availability-effective-from" className="text-xs font-black">Nova grade começa em</Label><Input id="availability-effective-from" type="datetime-local" value={effectiveFrom} min={toLocalDateTimeInput(new Date())} onChange={(event) => { setEffectiveFrom(event.target.value); setAvailabilityImpact(null); }} className="agenda-field h-11 rounded-2xl font-bold" /></div>
              ) : null}

              <div className="mt-4 space-y-2">
                <Label className="text-xs font-black">Lista de espera</Label>
                <Select value={waitlistStrategy} onValueChange={(value) => setWaitlistStrategy(value as WaitlistMigrationStrategy)}>
                  <SelectTrigger className="agenda-field h-11 rounded-2xl font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent className="agenda-menu-surface notification-liquid-menu rounded-[18px] p-1.5"><SelectItem value="migrate_all" className="notification-liquid-menu-item rounded-[13px] py-2.5">Aplicar a nova grade à lista</SelectItem><SelectItem value="keep_previous" className="notification-liquid-menu-item rounded-[13px] py-2.5">Manter as regras antigas da lista</SelectItem></SelectContent>
                </Select>
              </div>

              <div className="mt-4 space-y-2"><Label htmlFor="availability-reason" className="text-xs font-black">Motivo (opcional)</Label><Textarea id="availability-reason" value={availabilityReason} onChange={(event) => setAvailabilityReason(event.target.value)} placeholder="Ex.: Novo horário de atendimento no segundo semestre" className="agenda-field min-h-20 rounded-2xl" /></div>

              <Button type="button" variant="ghost" onClick={() => { setWorkingHours(originalWorkingHours); setAdditionalWorkingHours(originalAdditionalWorkingHours); setAvailabilityImpact(null); setAvailabilityStrategy(null); }} className="notification-liquid-control mt-4 h-11 rounded-full px-4 text-xs font-bold"><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Descartar mudança da grade</Button>
            </section>
          ) : null}

          <section aria-labelledby="commercial-policy-heading" className="agenda-liquid-surface rounded-3xl border p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-background">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="commercial-policy-heading" className="text-base font-black text-foreground">
                  Regras comerciais do agendamento
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {policyVersion ? `Versão ${policyVersion}` : "Configuração padrão"}
                  {formattedEffectiveAt ? ` · vigente desde ${formattedEffectiveAt}` : ""}
                </p>
              </div>
            </div>

            <div className="mt-4 flex gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/[0.07] p-4 text-sm text-foreground" role="note">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden="true" />
              <p className="leading-relaxed">
                Convites já enviados mantêm as regras congeladas neles. Ao salvar uma alteração, uma nova versão é criada
                somente para novos envios. Esta tela não altera convites ou ocorrências existentes.
              </p>
            </div>

            {!policyAvailable ? (
              <p className="mt-4 rounded-2xl border border-destructive/25 bg-destructive/10 p-4 text-sm leading-relaxed text-destructive" role="alert">
                Não foi possível carregar as regras comerciais. A grade semanal ainda pode ser salva, mas as regras ficam
                bloqueadas até uma nova tentativa.
              </p>
            ) : null}

            <fieldset disabled={!policyAvailable} className="mt-5 space-y-6 disabled:opacity-60">
              <legend className="sr-only">Prazos e consequências comerciais</legend>

              <div className="grid gap-4 sm:grid-cols-2">
                <PolicyNumberField
                  id="free-cancellation-hours"
                  label="Cancelamento gratuito"
                  description="Antecedência mínima, em horas, para cancelar sem consequência automática."
                  value={policyDraft.freeCancellationHours}
                  min={0}
                  max={8760}
                  onChange={(value) => updatePolicy("freeCancellationHours", value)}
                />
                <PolicyNumberField
                  id="free-reschedule-hours"
                  label="Reagendamento gratuito"
                  description="Antecedência mínima, em horas, para pedir outro horário sem consequência automática."
                  value={policyDraft.freeRescheduleHours}
                  min={0}
                  max={8760}
                  onChange={(value) => updatePolicy("freeRescheduleHours", value)}
                />
                <PolicyNumberField
                  id="minimum-patient-reaction-hours"
                  label="Prazo mínimo do paciente"
                  description="Tempo mínimo garantido para o paciente reagir a uma mudança feita pelo profissional."
                  value={policyDraft.minimumPatientReactionHours}
                  min={0}
                  max={720}
                  onChange={(value) => updatePolicy("minimumPatientReactionHours", value)}
                />
                <PolicyNumberField
                  id="professional-response-sla-hours"
                  label="Prazo de resposta profissional"
                  description="Tempo máximo, em horas, para responder a uma solicitação do paciente."
                  value={policyDraft.professionalResponseSlaHours}
                  min={0.01}
                  max={720}
                  onChange={(value) => updatePolicy("professionalResponseSlaHours", value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <PolicySelectField
                  id="late-cancellation-consequence"
                  label="Cancelamento fora do prazo"
                  description="Consequência proposta quando o paciente cancela depois do prazo gratuito."
                  value={policyDraft.lateCancellationConsequence}
                  options={CONSEQUENCE_OPTIONS}
                  onChange={(value) => updatePolicy("lateCancellationConsequence", value)}
                />
                <PolicySelectField
                  id="no-show-consequence"
                  label="Ausência do paciente"
                  description="Consequência proposta quando a sessão termina sem comparecimento."
                  value={policyDraft.noShowConsequence}
                  options={CONSEQUENCE_OPTIONS}
                  onChange={(value) => updatePolicy("noShowConsequence", value)}
                />
              </div>

              <PolicySelectField
                id="package-credit-policy"
                label="Crédito de pacote"
                description="Define o tratamento do crédito reservado quando uma ação exige ajuste."
                value={policyDraft.packageCreditPolicy}
                options={PACKAGE_CREDIT_OPTIONS}
                onChange={(value) => updatePolicy("packageCreditPolicy", value)}
              />
              <PolicySelectField
                id="charge-policy"
                label="Cobranças"
                description="Define o tratamento financeiro padrão; estados sensíveis continuam exigindo revisão."
                value={policyDraft.chargePolicy}
                options={CHARGE_OPTIONS}
                onChange={(value) => updatePolicy("chargePolicy", value)}
              />
              <PolicySelectField
                id="fiscal-policy"
                label="Documentos fiscais"
                description="Define o tratamento fiscal padrão sem reescrever documentos já autorizados."
                value={policyDraft.fiscalPolicy}
                options={FISCAL_OPTIONS}
                onChange={(value) => updatePolicy("fiscalPolicy", value)}
              />

              <div className="space-y-2">
                <Label htmlFor="appointment-policy-timezone" className="text-sm font-bold text-foreground">
                  Fuso horário
                </Label>
                <Input
                  id="appointment-policy-timezone"
                  value={policyDraft.timezone}
                  onChange={(event) => updatePolicy("timezone", event.target.value)}
                  placeholder="America/Sao_Paulo"
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby="appointment-policy-timezone-help"
                  className="h-11 rounded-xl border-border/70 bg-background font-semibold"
                />
                <p id="appointment-policy-timezone-help" className="text-xs leading-relaxed text-muted-foreground">
                  Use um identificador IANA. Prazos e datas dos próximos convites serão calculados neste fuso.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="appointment-policy-reason" className="text-sm font-bold text-foreground">
                  Motivo da nova versão {policyChanged ? <span className="text-destructive">*</span> : null}
                </Label>
                <Textarea
                  id="appointment-policy-reason"
                  value={policyReason}
                  onChange={(event) => {
                    pendingPolicyIdempotencyKeyRef.current = null;
                    setPolicyReason(event.target.value);
                  }}
                  placeholder="Ex.: ajuste do prazo de cancelamento informado aos pacientes"
                  required={policyChanged}
                  disabled={!policyChanged || !policyAvailable}
                  maxLength={500}
                  aria-describedby="appointment-policy-reason-help"
                  className="min-h-24 border-border/70 bg-background"
                />
                <p id="appointment-policy-reason-help" className="text-xs leading-relaxed text-muted-foreground">
                  {policyChanged
                    ? "Obrigatório para registrar por que a nova versão foi criada."
                    : "Edite alguma regra para criar uma nova versão imutável."}
                </p>
              </div>
            </fieldset>
          </section>
        </div>
      )}
    </AppModalShell>
  );
};
