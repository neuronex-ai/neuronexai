import { assertEquals } from "jsr:@std/assert@1";

import { shouldBlockSynapseExternalAction } from "./synapse-channel-policy.ts";

Deno.test("WhatsApp blocks real financial and communication side effects by default", () => {
  for (const toolName of [
    "create_neurofinance_charge",
    "create_fiscal_invoice",
    "send_appointment_reminder",
    "send_patient_email",
  ]) {
    assertEquals(shouldBlockSynapseExternalAction({ channel: "whatsapp", toolName }), true);
  }
});

Deno.test("panel and local confirmed actions remain available", () => {
  assertEquals(shouldBlockSynapseExternalAction({ channel: "panel", toolName: "create_fiscal_invoice" }), false);
  assertEquals(shouldBlockSynapseExternalAction({ channel: "whatsapp", toolName: "create_appointment" }), false);
});

Deno.test("supervised rollout requires an explicit true flag", () => {
  assertEquals(shouldBlockSynapseExternalAction({
    channel: "whatsapp",
    toolName: "send_patient_email",
    allowWhatsappExternalActions: "true",
  }), false);
  assertEquals(shouldBlockSynapseExternalAction({
    channel: "whatsapp",
    toolName: "send_patient_email",
    allowWhatsappExternalActions: "1",
  }), true);
});
