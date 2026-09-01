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
  const args: Record<string, unknown> = { ...asRecord(appointmentStep.arguments) };

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

  const args = { ...(step.arguments as Record<string, unknown>) };
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
