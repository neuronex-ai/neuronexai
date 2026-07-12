import {
  sanitizeVoiceAuditPayload,
  validateVoiceToolCall,
  VoiceToolPolicyError,
} from "./synapse-voice-policy.ts";
import { MUTATING_TOOLS } from "../synapse-text-fallback/tools.ts";
import {
  getSynapseToolPolicy,
  SYNAPSE_TEXT_CONFIRMATION_TOOLS,
} from "./synapse-tool-contract.ts";

const equal = (actual: unknown, expected: unknown, message: string) => {
  if (actual !== expected) {
    throw new Error(`${message}: esperado ${expected}, recebido ${actual}`);
  }
};

Deno.test("NeuroView permanece uma leitura segura em texto e voz", () => {
  const policy = validateVoiceToolCall("analyze_neuroview_patient_patterns");
  equal(policy.riskLevel, "low", "risco do NeuroView");
  equal(policy.confirmationRequired, false, "confirmação do NeuroView");
  equal(policy.executor, "read", "executor do NeuroView");
});

Deno.test("NeuroFlow e NeuroPulse exigem confirmação nos dois canais", () => {
  for (
    const tool of [
      "create_neuroflow_from_patient_history",
      "create_neuropulse_cause_effect_diagram",
    ]
  ) {
    const policy = validateVoiceToolCall(tool);
    equal(policy.riskLevel, "high", `risco de ${tool}`);
    equal(policy.confirmationRequired, true, `confirmação por voz de ${tool}`);
    equal(MUTATING_TOOLS.has(tool), true, `confirmação por texto de ${tool}`);
    equal(
      SYNAPSE_TEXT_CONFIRMATION_TOOLS.has(tool),
      true,
      `contrato canônico de ${tool}`,
    );
  }
});

Deno.test("operações financeiras destrutivas continuam bloqueadas por voz", () => {
  let blocked = false;
  try {
    validateVoiceToolCall("neurofinance_refund");
  } catch (error) {
    blocked = error instanceof VoiceToolPolicyError &&
      error.riskLevel === "blocked";
  }
  equal(blocked, true, "bloqueio de estorno por voz");
});

Deno.test("texto e voz consultam a mesma política canônica", () => {
  const mutation = getSynapseToolPolicy("create_appointment");
  equal(mutation?.executor, "mutation", "executor de agendamento");
  equal(mutation?.confirmationRequired, true, "confirmação de agendamento");
  equal(mutation?.voiceAvailability, "confirmation", "disponibilidade por voz");

  const deletion = getSynapseToolPolicy("delete_file");
  equal(
    deletion?.confirmationRequired,
    true,
    "confirmação por texto para exclusão",
  );
  equal(
    deletion?.voiceAvailability,
    "blocked",
    "bloqueio por voz para exclusão",
  );
});

Deno.test("telemetria de voz não persiste dados clínicos identificáveis", () => {
  const payload = sanitizeVoiceAuditPayload({
    patient_name: "Paciente Exemplo",
    diagnosis: "conteúdo clínico",
    amount: 350,
    action: "create_neuroflow_from_patient_history",
  });

  equal(payload.patient_name, "[redacted:string:16]", "nome do paciente");
  equal(payload.diagnosis, "[redacted:string:16]", "diagnóstico");
  equal(payload.amount, "[redacted:number]", "valor financeiro");
  equal(
    payload.action,
    "create_neuroflow_from_patient_history",
    "metadado operacional",
  );
});
