import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";
import type {
  AdvancedRecurrenceRule,
  OccurrenceOverride,
} from "@/lib/agenda-scheduling";
import {
  AppointmentPlanReviewRequiredError,
  executeAgendaActionPlan,
  prepareAgendaActionPlan,
  type AppointmentActionOriginChannel,
  type AppointmentActionPlan,
} from "@/lib/appointment-action-plans";
import type { AppointmentMetadata } from "@/lib/appointment-metadata";
import { getAppointmentPlanErrorMessage } from "@/lib/appointment-action-plan-errors";

export interface AgendaV2PlanInput {
  patient_id: string | null;
  first_start_time: string;
  duration_minutes: number;
  timezone: string;
  type: "presencial" | "online" | "block";
  recurrence_rule: {
    kind: AdvancedRecurrenceRule["kind"];
    interval?: number;
    week_days?: number[];
    month_days?: number[];
    custom_dates?: string[];
    missing_month_day?: "last_business_day";
    until_date?: string;
    termination: {
      kind: "count" | "until" | "open";
      count?: number;
      until_date?: string;
    };
  };
  overrides?: Array<{
    occurrence_number: number;
    date?: string;
    start_time?: string;
    duration_minutes?: number;
    modality?: "presencial" | "online";
    location?: string | null;
    reason?: string;
    source?: "professional" | "synapse" | "availability_change";
  }>;
  excluded_occurrence_numbers?: number[];
  notes?: string | null;
  location?: string | null;
  metadata?: AppointmentMetadata;
  template_version_id?: string | null;
  default_config?: Record<string, unknown>;
  financial?: {
    mode: "none" | "manual" | "neurofinance" | "package" | "insurance";
    value_per_session?: number;
    payment_method?: string;
    installments?: number;
    package_id?: string | null;
    charge_mode?: "per_occurrence" | "series";
    exception_reason?: string | null;
  };
}

export interface AgendaV2Occurrence {
  occurrenceNumber: number;
  originalOccurrenceNumber?: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  occurrenceStatus: "standard" | "adjusted" | "customized";
  changedFields: string[];
  adjustmentReason?: string | null;
  overrideReason?: string | null;
  status: "available" | "conflict";
  reasonCode?: string | null;
  reason?: string | null;
}

export interface PatientFinancialResolution {
  source: "patient_profile" | "patient_history" | "professional_default";
  planType: "per_session" | "monthly" | "insurance" | "exempt";
  sessionValueCents: number;
  expectedReceivableCents: number;
  shouldCreateCharge: boolean;
  billingDay?: number | null;
  agreement?: {
    id: string;
    name: string;
    repassType: "currency" | "percentage";
    repassValueCents?: number | null;
    repassPercentage?: number | null;
    expectedReceiptDays: number;
  } | null;
}

export interface AgendaV2Preview {
  valid: boolean;
  ruleKind: string;
  terminationKind: string;
  totalOccurrences: number;
  durationMinutes: number;
  firstStartTime: string;
  lastStartTime: string;
  availabilityVersionId: string | null;
  occurrences: AgendaV2Occurrence[];
  conflicts: AgendaV2Occurrence[];
  financial: PatientFinancialResolution | Record<string, never>;
}

export interface AgendaPlanSmartFitCandidate {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  keepsFullDuration: boolean;
  distanceMinutes: number;
}

export interface AgendaPlanSmartFitResult {
  occurrenceNumber: number;
  originalStartTime: string;
  originalEndTime: string;
  requiresConfirmation: true;
  candidates: AgendaPlanSmartFitCandidate[];
}

export interface AppointmentSmartFitResult {
  appointmentId: string;
  originalStartTime: string;
  originalEndTime: string;
  requiresConfirmation: true;
  candidates: Array<AgendaPlanSmartFitCandidate & { reasonCodes?: string[] }>;
}

export interface AgendaSeriesTemplate {
  id: string;
  name: string;
  source_patient_id: string | null;
  source_series_id: string | null;
  updated_at: string;
  appointment_series_template_versions: Array<{
    id: string;
    version_number: number;
    recurrence_rule: AgendaV2PlanInput["recurrence_rule"];
    default_config: Record<string, unknown>;
    created_at: string;
  }>;
}

export interface AgendaSeriesPlanRequest {
  input: AgendaV2PlanInput;
  idempotencyKey: string;
  originChannel?: AppointmentActionOriginChannel;
}

export type CompletedAgendaSeriesPlan = AppointmentActionPlan & {
  status: "completed";
  result: {
    seriesId: string;
    appointmentIds: string[];
    totalOccurrences: number;
    message: string;
  };
};

const rpcError = (error: unknown, fallback: string) => {
  const message = getAppointmentPlanErrorMessage(error, "create");
  return message || fallback;
};

export function useProfessionalAgendaTimezone() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["professional-agenda-timezone", user?.id],
    enabled: Boolean(user?.id),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const policy = await supabase.rpc("get_effective_appointment_policy");
      const policyValue = policy.data && typeof policy.data === "object"
        ? String((policy.data as Record<string, unknown>).timezone || "").trim()
        : "";
      if (!policy.error && policyValue) return policyValue;

      const preferences = await supabase
        .from("user_preferences")
        .select("timezone")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!preferences.error && preferences.data?.timezone) {
        return preferences.data.timezone;
      }
      return "America/Sao_Paulo";
    },
  });
}

export const toAgendaV2Overrides = (overrides: OccurrenceOverride[] = []) => overrides.map((override) => ({
  occurrence_number: override.occurrenceNumber,
  date: override.date,
  start_time: override.startTime,
  duration_minutes: override.durationMinutes,
  modality: override.modality,
  location: override.location,
  reason: override.reason,
  source: override.source || "professional",
}));

export const toAgendaV2RecurrenceRule = (
  rule: AdvancedRecurrenceRule,
): AgendaV2PlanInput["recurrence_rule"] => ({
  kind: rule.kind,
  interval: rule.interval,
  week_days: rule.weekDays,
  month_days: rule.monthDays,
  custom_dates: rule.customDates,
  missing_month_day: rule.missingMonthDay,
  until_date: rule.kind === "range_distribution" ? rule.customDates?.[0] : undefined,
  termination: rule.termination.kind === "count"
    ? { kind: "count", count: rule.termination.count }
    : rule.termination.kind === "until"
      ? { kind: "until", until_date: rule.termination.untilDate }
      : { kind: "open" },
});

export function useAgendaV2() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const previewMutation = useMutation({
    mutationFn: async (input: AgendaV2PlanInput) => {
      if (!user?.id) throw new Error("Sessão expirada. Entre novamente.");
      const database = supabase;
      const { data, error } = await database.rpc("preview_agenda_plan", { p_input: input });
      if (error) throw new Error(rpcError(error, "Não foi possível revisar a recorrência."));
      return data as AgendaV2Preview;
    },
  });

  const prepareMutation = useMutation({
    mutationFn: async ({
      input,
      idempotencyKey,
      originChannel = "professional_app",
    }: AgendaSeriesPlanRequest) => {
      if (!user?.id) throw new Error("Sessão expirada. Entre novamente.");
      const prepared = await prepareAgendaActionPlan(
        input as unknown as Record<string, unknown>,
        idempotencyKey,
        originChannel,
      );
      if (prepared.status === "review_required") {
        const error = new AppointmentPlanReviewRequiredError(prepared) as AppointmentPlanReviewRequiredError & {
          preview?: AgendaV2Preview;
        };
        const latest = await supabase.rpc("preview_agenda_plan", { p_input: input });
        if (!latest.error) error.preview = latest.data as AgendaV2Preview;
        throw error;
      }
      if (prepared.status !== "awaiting_confirmation") {
        throw new Error("O plano não está disponível para confirmação.");
      }
      return prepared;
    },
  });

  const executeMutation = useMutation({
    mutationFn: async ({
      plan,
      originChannel = "professional_app",
    }: {
      plan: AppointmentActionPlan;
      originChannel?: AppointmentActionOriginChannel;
    }) => {
      if (!user?.id) throw new Error("Sessão expirada. Entre novamente.");
      if (plan.status !== "awaiting_confirmation") {
        throw new Error("O plano revisado não está mais disponível para confirmação.");
      }
      const executed = await executeAgendaActionPlan(plan, originChannel);
      if (executed.status !== "completed") {
        throw new Error(
          String(executed.result?.message || "")
          || "Os horários mudaram durante a confirmação. Revise a série novamente.",
        );
      }
      return executed as CompletedAgendaSeriesPlan;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["appointments"] }),
        queryClient.invalidateQueries({ queryKey: ["appointmentsByDateRange"] }),
        queryClient.invalidateQueries({ queryKey: ["agenda-series-templates"] }),
      ]);
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({
      input,
      idempotencyKey,
      originChannel = "professional_app",
    }: {
      input: AgendaV2PlanInput;
      idempotencyKey: string;
      originChannel?: "professional_app" | "synapse_text" | "synapse_voice" | "synapse_whatsapp";
    }) => {
      if (!user?.id) throw new Error("Sessão expirada. Entre novamente.");
      const database = supabase;
      const prepared = await database.rpc("prepare_agenda_action_plan", {
        p_action: "create_series_v2",
        p_input: input,
        p_provenance: { origin_channel: originChannel },
        p_idempotency_key: idempotencyKey,
      });
      if (prepared.error) throw new Error(rpcError(prepared.error, "Não foi possível preparar a série."));
      if (prepared.data?.status === "review_required") {
        const error = new Error("A agenda mudou. Revise os conflitos antes de criar a série.") as Error & {
          preview?: AgendaV2Preview;
        };
        const latest = await database.rpc("preview_agenda_plan", { p_input: input });
        if (!latest.error) error.preview = latest.data as AgendaV2Preview;
        throw error;
      }
      if (prepared.data?.status !== "awaiting_confirmation") {
        throw new Error("O plano não está disponível para confirmação.");
      }

      const executed = await database.rpc("execute_agenda_action_plan", {
        p_plan_id: prepared.data.planId,
        p_plan_version: prepared.data.planVersion,
        p_plan_hash: prepared.data.planHash,
        p_confirmation_channel: originChannel,
      });
      if (executed.error) throw new Error(rpcError(executed.error, "Não foi possível criar a série."));
      if (executed.data?.status !== "completed") {
        throw new Error(
          executed.data?.result?.message
          || "Os horários mudaram durante a confirmação. Revise a série novamente.",
        );
      }
      return executed.data as {
        status: "completed";
        result: { seriesId: string; appointmentIds: string[]; totalOccurrences: number; message: string };
      };
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["appointments"] }),
        queryClient.invalidateQueries({ queryKey: ["appointmentsByDateRange"] }),
        queryClient.invalidateQueries({ queryKey: ["agenda-series-templates"] }),
      ]);
    },
  });

  const smartFitMutation = useMutation({
    mutationFn: async ({
      input,
      occurrenceNumber,
      allowShorter = false,
      minimumDurationMinutes = 30,
    }: {
      input: AgendaV2PlanInput;
      occurrenceNumber: number;
      allowShorter?: boolean;
      minimumDurationMinutes?: number;
    }) => {
      if (!user?.id) throw new Error("Sessão expirada. Entre novamente.");
      const database = supabase;
      const { data, error } = await database.rpc("suggest_agenda_plan_smart_fit", {
        p_input: input,
        p_occurrence_number: occurrenceNumber,
        p_search_days: 14,
        p_allow_shorter: allowShorter,
        p_minimum_duration_minutes: minimumDurationMinutes,
      });
      if (error) throw new Error(rpcError(error, "Não foi possível sugerir um reencaixe."));
      return data as AgendaPlanSmartFitResult;
    },
  });

  const existingAppointmentSmartFitMutation = useMutation({
    mutationFn: async ({
      appointmentId,
      anchorStart,
      allowShorter = false,
      minimumDurationMinutes = 30,
    }: {
      appointmentId: string;
      anchorStart?: string | null;
      allowShorter?: boolean;
      minimumDurationMinutes?: number;
    }) => {
      if (!user?.id) throw new Error("Sessão expirada. Entre novamente.");
      const database = supabase;
      const { data, error } = await database.rpc("suggest_appointment_smart_fit", {
        p_appointment_id: appointmentId,
        p_anchor_start: anchorStart || null,
        p_search_days: 14,
        p_allow_shorter: allowShorter,
        p_minimum_duration_minutes: minimumDurationMinutes,
      });
      if (error) throw new Error(rpcError(error, "Não foi possível sugerir um reencaixe."));
      return data as AppointmentSmartFitResult;
    },
  });

  return {
    previewAgendaPlan: previewMutation.mutateAsync,
    prepareAgendaSeries: prepareMutation.mutateAsync,
    executePreparedAgendaSeries: executeMutation.mutateAsync,
    createAgendaSeries: createMutation.mutateAsync,
    isPreviewingAgendaPlan: previewMutation.isPending,
    isPreparingAgendaSeries: prepareMutation.isPending,
    isExecutingAgendaSeries: executeMutation.isPending,
    isCreatingAgendaSeries: createMutation.isPending || executeMutation.isPending,
    suggestAgendaPlanSmartFit: smartFitMutation.mutateAsync,
    isSuggestingAgendaPlanSmartFit: smartFitMutation.isPending,
    suggestAppointmentSmartFit: existingAppointmentSmartFitMutation.mutateAsync,
    isSuggestingAppointmentSmartFit: existingAppointmentSmartFitMutation.isPending,
  };
}

export function usePatientFinancialResolution(patientId?: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["patient-appointment-financial", user?.id, patientId],
    enabled: Boolean(user?.id && patientId),
    queryFn: async () => {
      const database = supabase;
      const { data, error } = await database.rpc("resolve_patient_appointment_financial", {
        p_patient_id: patientId,
      });
      if (error) throw new Error(rpcError(error, "Não foi possível resolver o financeiro do paciente."));
      return data as PatientFinancialResolution;
    },
    staleTime: 60_000,
  });
}

export function useAgendaSeriesTemplates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const templatesQueryKey = ["agenda-series-templates", user?.id] as const;
  const query = useQuery({
    queryKey: templatesQueryKey,
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const database = supabase;
      const { data, error } = await database
        .from("appointment_series_templates")
        .select("id,name,source_patient_id,source_series_id,updated_at,appointment_series_template_versions(id,version_number,recurrence_rule,default_config,created_at)")
        .eq("is_archived", false)
        .order("updated_at", { ascending: false });
      if (error) throw new Error(rpcError(error, "Não foi possível carregar os modelos."));
      return (data || []) as AgendaSeriesTemplate[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({
      templateId,
      name,
      recurrenceRule,
      defaultConfig,
      sourcePatientId,
      sourceSeriesId,
    }: {
      templateId?: string | null;
      name: string;
      recurrenceRule: AgendaV2PlanInput["recurrence_rule"];
      defaultConfig?: Record<string, unknown>;
      sourcePatientId?: string | null;
      sourceSeriesId?: string | null;
    }) => {
      const database = supabase;
      const { data, error } = await database.rpc("save_appointment_series_template", {
        p_template_id: templateId || null,
        p_name: name,
        p_recurrence_rule: recurrenceRule,
        p_default_config: defaultConfig || {},
        p_source_patient_id: sourcePatientId || null,
        p_source_series_id: sourceSeriesId || null,
      });
      if (error) throw new Error(rpcError(error, "Não foi possível salvar o modelo."));
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agenda-series-templates"] }),
  });

  const renameMutation = useMutation({
    mutationFn: async ({ templateId, name }: { templateId: string; name: string }) => {
      const normalizedName = name.trim();
      if (!normalizedName) throw new Error("Dê um nome curto ao modelo.");
      const { error } = await supabase
        .from("appointment_series_templates")
        .update({ name: normalizedName, updated_at: new Date().toISOString() })
        .eq("id", templateId)
        .eq("professional_id", user!.id);
      if (error) throw new Error(rpcError(error, "Não foi possível renomear o modelo."));
      return { templateId, name: normalizedName };
    },
    onSuccess: ({ templateId, name }) => {
      queryClient.setQueryData<AgendaSeriesTemplate[]>(templatesQueryKey, (current = []) =>
        current.map((template) => (
          template.id === templateId
            ? { ...template, name, updated_at: new Date().toISOString() }
            : template
        )),
      );
      void queryClient.invalidateQueries({ queryKey: ["agenda-series-templates"] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from("appointment_series_templates")
        .update({ is_archived: true, updated_at: new Date().toISOString() })
        .eq("id", templateId)
        .eq("professional_id", user!.id);
      if (error) throw new Error(rpcError(error, "Não foi possível excluir o modelo."));
      return templateId;
    },
    onSuccess: (templateId) => {
      queryClient.setQueryData<AgendaSeriesTemplate[]>(templatesQueryKey, (current = []) =>
        current.filter((template) => template.id !== templateId),
      );
      void queryClient.invalidateQueries({ queryKey: ["agenda-series-templates"] });
    },
  });

  return {
    ...query,
    saveTemplate: saveMutation.mutateAsync,
    isSavingTemplate: saveMutation.isPending,
    renameTemplate: renameMutation.mutateAsync,
    isRenamingTemplate: renameMutation.isPending,
    archiveTemplate: archiveMutation.mutateAsync,
    isArchivingTemplate: archiveMutation.isPending,
  };
}
