import {
  appointmentPlanSummary,
  cancelAppointmentActionPlan,
  executeAppointmentActionPlan,
  getAppointmentActionPlanStatus,
  normalizeAppointmentPlanChannel,
  prepareAppointmentActionPlan,
} from "./appointment-action-plans.ts";

const equal = (actual: unknown, expected: unknown, message: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: esperado ${JSON.stringify(expected)}, recebido ${JSON.stringify(actual)}`);
  }
};

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PLAN_ID = "22222222-2222-4222-8222-222222222222";
const CONVERSATION_ID = "33333333-3333-4333-8333-333333333333";
const HASH = "a".repeat(64);

const mockAdmin = (calls: Array<{ name: string; params: Record<string, unknown> }>) => ({
  rpc(name: string, params: Record<string, unknown>) {
    calls.push({ name, params });
    return Promise.resolve({
      data: {
        planId: PLAN_ID,
        planVersion: 1,
        planHash: HASH,
        status: "awaiting_confirmation",
        summary: {
          title: "Criar agendamento",
          agenda: { patientName: "Ana", startTime: "2030-01-10T15:00:00Z" },
          financial: { impactMessage: "Nenhum ajuste financeiro externo será criado." },
        },
      },
      error: null,
    });
  },
});

Deno.test("canais do Synapse são normalizados para o contrato canônico", () => {
  equal(normalizeAppointmentPlanChannel("panel"), "synapse_text", "painel");
  equal(normalizeAppointmentPlanChannel("voice"), "synapse_voice", "voz");
  equal(normalizeAppointmentPlanChannel("whatsapp"), "synapse_whatsapp", "WhatsApp");
  equal(normalizeAppointmentPlanChannel("professional_app"), "professional_app", "app");
});

Deno.test("preparação envia snapshot e proveniência à RPC interna", async () => {
  const calls: Array<{ name: string; params: Record<string, unknown> }> = [];
  const admin = mockAdmin(calls);
  const plan = await prepareAppointmentActionPlan(
    { admin, userId: USER_ID, sessionId: CONVERSATION_ID, channel: "voice", toolCallId: "call-1" },
    "create_appointment",
    "create",
    { patient_id: USER_ID, occurrence_count: 6 },
    "synapse:conversation:call-1:create",
  );
  equal(plan.planHash, HASH, "hash retornado");
  equal(calls[0].name, "prepare_appointment_action_plan_internal", "RPC de preparação");
  equal((calls[0].params.p_provenance as Record<string, unknown>).origin_channel, "synapse_voice", "origem");
  equal((calls[0].params.p_input as Record<string, unknown>).occurrence_count, 6, "recorrência");
});

Deno.test("execução confirma exatamente id, versão, hash e conversa", async () => {
  const calls: Array<{ name: string; params: Record<string, unknown> }> = [];
  await executeAppointmentActionPlan(
    { admin: mockAdmin(calls), userId: USER_ID, sessionId: CONVERSATION_ID, channel: "panel" },
    { planId: PLAN_ID, planVersion: 1, planHash: HASH },
  );
  equal(calls[0].name, "execute_appointment_action_plan_internal", "RPC de execução");
  equal(calls[0].params.p_conversation_id, CONVERSATION_ID, "continuidade da conversa");
  equal(calls[0].params.p_confirmation_channel, "synapse_text", "canal de confirmação");
});

Deno.test("consulta e cancelamento permanecem vinculados ao proprietário", async () => {
  const calls: Array<{ name: string; params: Record<string, unknown> }> = [];
  const context = { admin: mockAdmin(calls), userId: USER_ID, sessionId: CONVERSATION_ID };
  await getAppointmentActionPlanStatus(context, PLAN_ID, 1);
  await cancelAppointmentActionPlan(context, { planId: PLAN_ID, planVersion: 1, planHash: HASH });
  equal(calls.map((call) => call.name), [
    "get_appointment_action_plan_status_internal",
    "cancel_appointment_action_plan_internal",
  ], "RPCs de continuidade");
  equal(calls[1].params.p_actor_user_id, USER_ID, "proprietário");
});

Deno.test("referência adulterada não chega ao banco", async () => {
  const calls: Array<{ name: string; params: Record<string, unknown> }> = [];
  let rejected = false;
  try {
    await executeAppointmentActionPlan(
      { admin: mockAdmin(calls), userId: USER_ID, sessionId: CONVERSATION_ID },
      { planId: PLAN_ID, planVersion: 1, planHash: "hash-forjado" },
    );
  } catch {
    rejected = true;
  }
  equal(rejected, true, "hash inválido rejeitado");
  equal(calls.length, 0, "nenhuma RPC chamada");
});

Deno.test("resumo do plano é humano e não inclui referências técnicas", () => {
  const text = appointmentPlanSummary({
    planId: PLAN_ID,
    planVersion: 1,
    planHash: HASH,
    status: "awaiting_confirmation",
    summary: {
      title: "Criar agendamento",
      agenda: { patientName: "Ana", startTime: "2030-01-10T15:00:00Z" },
      financial: { impactMessage: "Nenhum ajuste financeiro externo será criado." },
    },
  });
  equal(text.includes("Ana"), true, "paciente no resumo");
  equal(text.includes(PLAN_ID), false, "id oculto");
  equal(text.includes(HASH), false, "hash oculto");
});
