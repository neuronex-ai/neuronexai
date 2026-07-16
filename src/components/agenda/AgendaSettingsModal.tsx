"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, Info, Loader2, Save, Settings, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

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

const validateWorkingHours = (hours: WorkingHours) => {
  for (const day of DAYS_OF_WEEK) {
    const interval = hours[day.id];
    if (!interval?.enabled) continue;
    if (!interval.start || !interval.end || interval.start >= interval.end) {
      throw new Error(`Em ${day.label}, o horário final deve ser posterior ao inicial.`);
    }
  }
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
      <SelectContent>
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
  const saveInFlightRef = useRef(false);
  const pendingPolicyIdempotencyKeyRef = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [workingHours, setWorkingHours] = useState<WorkingHours>({ ...DEFAULT_WORKING_HOURS });
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
    pendingPolicyIdempotencyKeyRef.current = null;

    try {
      const database = supabase as any;
      const [profileResult, policyResult] = await Promise.all([
        database.from("profiles").select("working_hours").eq("id", user.id).single(),
        database.rpc("get_effective_appointment_policy"),
      ]);

      if (profileResult.error) {
        console.error("Error loading working hours:", profileResult.error);
        setWorkingHours({ ...DEFAULT_WORKING_HOURS });
      } else if (profileResult.data?.working_hours && typeof profileResult.data.working_hours === "object") {
        setWorkingHours(profileResult.data.working_hours as WorkingHours);
      } else {
        setWorkingHours({ ...DEFAULT_WORKING_HOURS });
      }

      if (policyResult.error) {
        console.error("Error loading appointment policy:", policyResult.error);
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
      console.error("Error loading agenda settings:", error);
      setWorkingHours({ ...DEFAULT_WORKING_HOURS });
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
      validateWorkingHours(workingHours);
      let createdPolicyVersion = false;

      if (policyChanged) {
        if (!policyAvailable) {
          throw new Error("As regras comerciais não estão disponíveis. Reabra esta tela e tente novamente.");
        }

        const normalizedPolicy = normalizeAppointmentPolicyDraft(policyDraft);
        const reason = policyReason.trim();
        if (!reason) {
          throw new Error("Informe o motivo da nova versão das regras comerciais.");
        }

        const database = supabase as any;
        pendingPolicyIdempotencyKeyRef.current ||= `appointment-policy:${crypto.randomUUID()}`;
        const { data, error } = await database.rpc("create_appointment_policy_version", {
          p_free_cancellation_hours: normalizedPolicy.freeCancellationHours,
          p_free_reschedule_hours: normalizedPolicy.freeRescheduleHours,
          p_minimum_patient_reaction_hours: normalizedPolicy.minimumPatientReactionHours,
          p_professional_response_sla_hours: normalizedPolicy.professionalResponseSlaHours,
          p_late_cancellation_consequence: normalizedPolicy.lateCancellationConsequence,
          p_no_show_consequence: normalizedPolicy.noShowConsequence,
          p_package_credit_policy: normalizedPolicy.packageCreditPolicy,
          p_charge_policy: normalizedPolicy.chargePolicy,
          p_fiscal_policy: normalizedPolicy.fiscalPolicy,
          p_timezone: normalizedPolicy.timezone,
          p_effective_at: null,
          p_reason: reason,
          p_idempotency_key: pendingPolicyIdempotencyKeyRef.current,
        });

        if (error) throw new Error(error.message || "Não foi possível criar a nova versão das regras.");

        const savedFingerprint = appointmentPolicyFingerprint(policyDraft);
        setOriginalPolicyFingerprint(savedFingerprint);
        setPolicyVersion(typeof data?.version === "number" ? data.version : policyVersion);
        setPolicyEffectiveAt(typeof data?.effectiveAt === "string" ? data.effectiveAt : new Date().toISOString());
        setPolicyReason("");
        pendingPolicyIdempotencyKeyRef.current = null;
        createdPolicyVersion = true;
      }

      const cleanHours = JSON.parse(JSON.stringify(workingHours)) as WorkingHours;
      const { error } = await supabase.from("profiles").update({ working_hours: cleanHours }).eq("id", user.id);
      if (error) throw error;

      toast.success(
        createdPolicyVersion
          ? "Agenda salva e nova versão das regras criada."
          : "Horários atualizados com sucesso.",
      );
      setOpen(false);
    } catch (error) {
      console.error("Save agenda settings error:", error);
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
    setWorkingHours((current) => ({
      ...current,
      [dayId]: {
        ...(current[dayId] ?? DEFAULT_WORKING_HOURS[dayId] ?? { enabled: false, start: "08:00", end: "18:00" }),
        [field]: value,
      },
    }));
  };

  const formattedEffectiveAt = policyEffectiveAt
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(policyEffectiveAt))
    : null;

  return (
    <AppModalShell
      open={open}
      onOpenChange={setOpen}
      preventClose={isSaving}
      size="lg"
      eyebrow="Agenda"
      title="Disponibilidade e regras"
      description="Defina sua grade de atendimento e as regras comerciais usadas em novos convites."
      heroIcon={<ModalHeroIcon icon={Clock} ariaLabel="Configurações da agenda" />}
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className="desktop-retina-interactive h-10 w-10 shrink-0 rounded-full border border-border/50 bg-background/70 text-muted-foreground hover:border-border hover:bg-background hover:text-foreground"
          aria-label="Configurar agenda e regras comerciais"
        >
          <Settings className="h-4 w-4" />
        </Button>
      }
      footer={
        <Button
          onClick={() => void handleSave()}
          disabled={isSaving || isLoading}
          className="h-12 w-full rounded-2xl bg-foreground text-[10.5px] font-black uppercase tracking-[0.16em] text-background shadow-xl disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
          ) : (
            <Save className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          {isSaving ? "Salvando..." : "Salvar agenda e regras"}
        </Button>
      }
    >
      {isLoading ? (
        <div className="flex min-h-[18rem] items-center justify-center" role="status" aria-label="Carregando configurações">
          <Loader2 className="h-8 w-8 motion-safe:animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      ) : (
        <div className="space-y-5">
          <section aria-labelledby="working-hours-heading" className="rounded-3xl border border-border/60 bg-muted/20 p-4 sm:p-5">
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
                      "rounded-2xl border motion-safe:transition-colors",
                      hours.enabled ? "border-border/70 bg-background" : "border-border/35 bg-transparent opacity-70",
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
                            className="h-10 w-[104px] rounded-xl border-border/70 bg-background text-center text-sm font-bold"
                            aria-label={`Início em ${day.label}`}
                          />
                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">até</span>
                          <Input
                            type="time"
                            value={hours.end}
                            onChange={(event) => updateDay(day.id, "end", event.target.value)}
                            className="h-10 w-[104px] rounded-xl border-border/70 bg-background text-center text-sm font-bold"
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
                            className="h-10 flex-1 rounded-xl border-border/70 bg-background text-center text-sm font-bold"
                            aria-label={`Início em ${day.label}`}
                          />
                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">até</span>
                          <Input
                            type="time"
                            value={hours.end}
                            onChange={(event) => updateDay(day.id, "end", event.target.value)}
                            className="h-10 flex-1 rounded-xl border-border/70 bg-background text-center text-sm font-bold"
                            aria-label={`Fim em ${day.label}`}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="commercial-policy-heading" className="rounded-3xl border border-border/60 bg-muted/20 p-4 sm:p-5">
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
