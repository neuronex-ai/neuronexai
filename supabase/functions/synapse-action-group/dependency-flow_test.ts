import type {
  SynapseActionGroupStep,
  SynapseActionGroupStepResult,
} from "../_shared/synapse-action-group.ts";
import {
  appointmentArgumentsForCanonicalPlan,
  executionArgumentsForStep,
  hasIncompleteDependency,
  inferRequiredStepDependencies,
  primaryRecordIdFromResult,
} from "./dependency-flow.ts";

const equal = (actual: unknown, expected: unknown, message: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}: esperado ${JSON.stringify(expected)}, recebido ${
        JSON.stringify(actual)
      }`,
    );
  }
};

const step = (
  stepId: string,
  order: number,
  toolName: string,
  argumentsValue: Record<string, unknown>,
): SynapseActionGroupStep => ({
  stepId,
  order,
  area: toolName === "create_appointment"
    ? "Agenda"
    : toolName === "create_neurofinance_charge"
    ? "NeuroFinance"
    : "Comunicação",
  title: stepId,
  spokenSummary: stepId,
  actionType: toolName,
  risk: toolName === "create_neurofinance_charge" ? "neurofinance" : "normal",
  dependencies: [],
  expectedEffect: "persist_record",
  editableFields: [],
  toolName,
  arguments: argumentsValue,
});

const bundle = () =>
  inferRequiredStepDependencies([
    step("appointment", 1, "create_appointment", {
      patient_id: "patient-123",
      datetime: "2099-09-04T07:00:00-03:00",
      financial_mode: "neurofinance",
      send_confirmation: true,
    }),
    step("charge", 2, "create_neurofinance_charge", {
      patient_id: "patient-123",
      amount: 250,
      due_date: "2099-09-03",
      payment_method: "boleto",
    }),
    step("confirmation", 3, "send_patient_email", {
      patient_id: "patient-123",
      subject: "Confirmação",
      body: "Sua consulta foi agendada.",
    }),
  ]);

Deno.test("servidor liga cobrança e comunicação ao agendamento do mesmo pacote", () => {
  const steps = bundle();
  equal(
    steps[0].dependencies,
    [],
    "agendamento não depende das etapas posteriores",
  );
  equal(
    steps[1].dependencies,
    ["appointment"],
    "cobrança depende do agendamento",
  );
  equal(
    steps[2].dependencies,
    ["appointment", "charge"],
    "comunicação depende do agendamento e da cobrança vinculada",
  );
});

Deno.test("falha do agendamento bloqueia cobrança e comunicação", () => {
  const steps = bundle();
  const results = new Map<string, SynapseActionGroupStepResult>([[
    "appointment",
    {
      stepId: "appointment",
      status: "failed",
      message: "Horário indisponível",
    },
  ]]);
  equal(hasIncompleteDependency(steps[1], results), true, "cobrança bloqueada");
  equal(
    hasIncompleteDependency(steps[2], results),
    true,
    "comunicação bloqueada",
  );
});

Deno.test("comunicação financeira depende das cobranças anteriores mesmo sem novo agendamento", () => {
  const steps = inferRequiredStepDependencies([
    step("charge-1", 1, "create_neurofinance_charge", {
      patient_id: "patient-123",
      amount: 200,
      due_date: "2099-09-04",
      payment_method: "pix",
    }),
    step("charge-2", 2, "create_neurofinance_charge", {
      patient_id: "patient-123",
      amount: 200,
      due_date: "2099-09-05",
      payment_method: "pix",
    }),
    step("email", 3, "send_patient_email", {
      patient_id: "patient-123",
      subject: "Cobranças emitidas",
      body: "As duas cobranças foram emitidas.",
    }),
  ]);

  equal(
    steps[2].dependencies,
    ["charge-1", "charge-2"],
    "e-mail depende de todas as cobranças anteriores do mesmo paciente",
  );

  const results = new Map<string, SynapseActionGroupStepResult>([
    ["charge-1", {
      stepId: "charge-1",
      status: "completed",
      message: "Cobrança criada",
    }],
    ["charge-2", {
      stepId: "charge-2",
      status: "failed",
      message: "Cobrança recusada",
    }],
  ]);
  equal(
    hasIncompleteDependency(steps[2], results),
    true,
    "e-mail fica bloqueado se qualquer cobrança falhar",
  );
});

Deno.test("plano oficial da Agenda não duplica efeitos dos cards dependentes", () => {
  const steps = bundle();
  const args = appointmentArgumentsForCanonicalPlan(steps[0], steps);
  const financial = args.financial as Record<string, unknown>;
  const communication = args.communication as Record<string, unknown>;
  equal(
    financial.mode,
    "none",
    "cobrança fica a cargo do card NeuroFinance",
  );
  equal(
    communication.sendConfirmation,
    false,
    "comunicação fica a cargo do card de comunicação",
  );
});

Deno.test("executor usa a referência canônica e injeta o agendamento na cobrança", () => {
  const steps = bundle();
  steps[0].canonicalPlanRef = {
    kind: "appointment",
    id: "11111111-1111-4111-8111-111111111111",
    version: 2,
    hash: "a".repeat(64),
    executionMode: "appointment",
  };
  equal(executionArgumentsForStep(steps[0], steps, new Map()), {
    plan_id: "11111111-1111-4111-8111-111111111111",
    plan_version: 2,
    plan_hash: "a".repeat(64),
    agenda_v2: false,
  }, "agendamento executa a versão preparada pela Agenda");

  const results = new Map<string, SynapseActionGroupStepResult>([[
    "appointment",
    {
      stepId: "appointment",
      status: "completed",
      message: "Agendamento criado",
      recordId: "appointment-456",
    },
  ]]);
  const chargeArgs = executionArgumentsForStep(
    steps[1],
    steps,
    results,
  ) as Record<string, unknown>;
  equal(
    chargeArgs.appointment_id,
    "appointment-456",
    "cobrança recebe o vínculo criado",
  );
});

Deno.test("executor extrai o identificador criado pelo plano oficial", () => {
  equal(
    primaryRecordIdFromResult("create_appointment", {
      data: { result: { appointmentIds: ["appointment-789"] } },
    }),
    "appointment-789",
    "primeiro agendamento materializado",
  );
});
