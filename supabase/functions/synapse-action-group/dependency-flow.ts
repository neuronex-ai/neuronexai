import type {
  SynapseActionGroupStep,
  SynapseActionGroupStepResult,
} from "../_shared/synapse-action-group.ts";

const clean = (value: unknown, max = 5000) =>
  String(value ?? "").trim().slice(0, max);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const normalizeName = (value: unknown) =>
  clean(value, 180)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const positiveNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  const raw = clean(value, 120).replace(/\s+/g, " ");
  if (!raw) return null;
  const match = raw.match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0].replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const positiveInteger = (value: unknown) => {
  const parsed = positiveNumber(value);
  return parsed === null ? null : Math.max(1, Math.round(parsed));
};

const isoDateOnly = (value: unknown) => {
  const raw = clean(value, 80);
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const candidate = iso
    ? `${iso[1]}-${iso[2]}-${iso[3]}`
    : br
      ? `${br[3]}-${br[2]}-${br[1]}`
      : null;
  if (!candidate) return null;
  const [year, month, day] = candidate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return candidate;
};

const todayInSaoPaulo = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
};

const canonicalPaymentMethod = (value: unknown) => {
  const normalized = normalizeName(value);
  if (normalized === "pix") return "pix";
  if (normalized === "boleto") return "boleto";
  if (["card", "cartao", "cartao de credito"].includes(normalized)) return "card";
  if (["undefined", "a definir", "paciente decide"].includes(normalized)) return "undefined";
  return clean(value, 80).toLowerCase();
};

const weeklyCadenceRequested = (step: SynapseActionGroupStep, args: Record<string, unknown>) => {
  const context = normalizeName([
    args.frequency,
    args.recurrence,
    args.recurrence_rule,
    step.spokenSummary,
    step.title,
  ].filter(Boolean).join(" "));
  return /\bsemanal\b/.test(context) ||
    /\bpor semana\b/.test(context) ||
    /\b(?:uma|1) (?:sessao|consulta|agendamento) por semana\b/.test(context);
};

const normalizedAppointmentArguments = (step: SynapseActionGroupStep) => {
  const args: Record<string, unknown> = { ...asRecord(step.arguments) };
  const count = positiveInteger(args.occurrence_count || args.occurrenceCount);
  const duration = positiveInteger(
    args.duration_minutes ?? args.durationMinutes ??
      args.preferred_duration_minutes ?? args.preferredDurationMinutes,
  );

  if (count) {
    args.occurrence_count = count;
    args.occurrenceCount = count;
  }
  if (duration) {
    // Agenda v2 still reads both names in different layers. Keep them identical so
    // a review edit such as "60 minutos" cannot leave the old preferred duration behind.
    args.duration_minutes = duration;
    args.durationMinutes = duration;
    args.preferred_duration_minutes = duration;
    args.preferredDurationMinutes = duration;
  }
  if ((count || 1) > 1 && weeklyCadenceRequested(step, args)) {
    // "quatro sessões no mês, aproximadamente uma por semana" is weekly cadence.
    // Never translate that intent into one occurrence per month.
    args.frequency = "weekly";
  }
  return args;
};

const normalizedFinancialArguments = (step: SynapseActionGroupStep) => {
  const args: Record<string, unknown> = { ...asRecord(step.arguments) };
  if (step.toolName !== "create_neurofinance_charge") return args;

  const amount = positiveNumber(args.amount);
  if (amount !== null) args.amount = amount;
  if (args.payment_method !== undefined) {
    args.payment_method = canonicalPaymentMethod(args.payment_method);
  }

  const dueDate = isoDateOnly(args.due_date);
  if (!dueDate) {
    throw new Error(
      "O vencimento da cobrança precisa ser uma data real no formato AAAA-MM-DD; regras como ‘2 dias antes’ devem ser calculadas antes da confirmação.",
    );
  }
  if (dueDate < todayInSaoPaulo()) {
    throw new Error("O vencimento da cobrança não pode estar no passado.");
  }
  args.due_date = dueDate;
  return args;
};

const patientIdentity = (step: SynapseActionGroupStep) => {
  const args = asRecord(step.arguments);
  const id = clean(args.patient_id || args.patientId, 120);
  if (id) return `id:${id}`;
  const name = normalizeName(
    args.patient_name || args.patientName,
  );
  return name ? `name:${name}` : "";
};

const samePatient = (
  left: SynapseActionGroupStep,
  right: SynapseActionGroupStep,
) => {
  const leftIdentity = patientIdentity(left);
  const rightIdentity = patientIdentity(right);
  return Boolean(
    leftIdentity && rightIdentity && leftIdentity === rightIdentity,
  );
};

const appendDependency = (dependencies: string[], stepId?: string | null) => {
  if (!stepId || dependencies.includes(stepId)) return dependencies;
  return [...dependencies, stepId];
};

const COMMUNICATION_TOOLS = new Set([
  "send_patient_email",
  "send_appointment_reminder",
]);

const APPOINTMENT_LINKED_FINANCE_TOOLS = new Set([
  "create_neurofinance_charge",
  "create_financial_entry",
]);

/**
 * The model may describe dependencies, but the server owns the final graph.
 * A finance step or appointment communication for the same patient cannot
 * outlive an appointment creation that appears earlier in the same package.
 */
export function inferRequiredStepDependencies(
  sourceSteps: SynapseActionGroupStep[],
): SynapseActionGroupStep[] {
  const steps = sourceSteps.map((step) => ({
    ...step,
    dependencies: Array.from(new Set(step.dependencies || [])),
  }));

  for (const [index, step] of steps.entries()) {
    const previous = steps.slice(0, index);
    const stepArguments = asRecord(step.arguments);
    const appointmentId = clean(
      stepArguments.appointment_id || stepArguments.appointmentId,
      120,
    );
    const appointment = appointmentId
      ? null
      : [...previous].reverse().find((candidate) =>
        candidate.toolName === "create_appointment" &&
        samePatient(candidate, step)
      ) || null;

    if (APPOINTMENT_LINKED_FINANCE_TOOLS.has(step.toolName) && appointment) {
      step.dependencies = appendDependency(
        step.dependencies,
        appointment.stepId,
      );
      continue;
    }

    if (COMMUNICATION_TOOLS.has(step.toolName) && appointment) {
      step.dependencies = appendDependency(
        step.dependencies,
        appointment.stepId,
      );
      const linkedCharge = [...previous].reverse().find((candidate) =>
        candidate.toolName === "create_neurofinance_charge" &&
        samePatient(candidate, step) &&
        candidate.dependencies.includes(appointment.stepId)
      );
      step.dependencies = appendDependency(
        step.dependencies,
        linkedCharge?.stepId,
      );
    }
  }

  return steps;
}

/**
 * Dedicated child cards own their own external effects. The canonical Agenda
 * plan therefore creates only the appointment, avoiding duplicate charges or
 * confirmations while still using the official immutable planner.
 */
export function appointmentArgumentsForCanonicalPlan(
  appointmentStep: SynapseActionGroupStep,
  steps: SynapseActionGroupStep[],
) {
  const dependents = steps.filter((step) =>
    step.dependencies.includes(appointmentStep.stepId)
  );
  const hasDedicatedCharge = dependents.some((step) =>
    step.toolName === "create_neurofinance_charge"
  );
  const hasDedicatedCommunication = dependents.some((step) =>
    COMMUNICATION_TOOLS.has(step.toolName)
  );
  const args = normalizedAppointmentArguments(appointmentStep);

  if (hasDedicatedCharge) {
    args.financial_mode = "none";
    args.financial = {
      mode: "none",
      value_per_session: 0,
      total: 0,
      charge_mode: "per_occurrence",
    };
  }

  if (hasDedicatedCommunication) {
    args.send_confirmation = false;
    args.communication = {
      sendConfirmation: false,
      provider: "configured",
      template: "appointment_invitation",
      reminderPolicy: "professional_settings",
    };
  }

  return args;
}

export function hasIncompleteDependency(
  step: SynapseActionGroupStep,
  results: Map<string, SynapseActionGroupStepResult>,
) {
  return (step.dependencies || []).some((dependency) =>
    results.get(dependency)?.status !== "completed"
  );
}

export function executionArgumentsForStep(
  step: SynapseActionGroupStep,
  steps: SynapseActionGroupStep[],
  results: Map<string, SynapseActionGroupStepResult>,
) {
  if (
    step.toolName === "create_appointment" &&
    step.canonicalPlanRef?.kind === "appointment"
  ) {
    return {
      plan_id: step.canonicalPlanRef.id,
      plan_version: step.canonicalPlanRef.version,
      plan_hash: step.canonicalPlanRef.hash,
      agenda_v2: step.canonicalPlanRef.executionMode === "agenda_v2",
    };
  }

  const args = normalizedFinancialArguments(step);
  if (clean(args.appointment_id || args.appointmentId, 120)) {
    return args;
  }

  const appointmentDependency = (step.dependencies || [])
    .map((dependency) =>
      steps.find((candidate) => candidate.stepId === dependency)
    )
    .find((candidate) => candidate?.toolName === "create_appointment");
  const appointmentResult = appointmentDependency
    ? results.get(appointmentDependency.stepId)
    : null;
  if (appointmentResult?.status === "completed" && appointmentResult.recordId) {
    args.appointment_id = appointmentResult.recordId;
  }
  return args;
}

export function primaryRecordIdFromResult(toolName: string, result: unknown) {
  const data = asRecord(asRecord(result).data);
  const nestedResult = asRecord(data.result);
  const appointment = asRecord(data.appointment);
  const charge = asRecord(data.charge);
  const invoice = asRecord(data.invoice);
  const appointmentIds = Array.isArray(nestedResult.appointmentIds)
    ? nestedResult.appointmentIds
    : Array.isArray(data.appointmentIds)
      ? data.appointmentIds
      : [];
  const candidates = toolName === "create_appointment"
    ? [
      appointmentIds[0],
      nestedResult.appointmentId,
      data.appointmentId,
      appointment.id,
    ]
    : [
      data.id,
      charge.id,
      invoice.id,
      appointment.id,
    ];
  for (const candidate of candidates) {
    const id = clean(candidate, 120);
    if (id) return id;
  }
  return null;
}
