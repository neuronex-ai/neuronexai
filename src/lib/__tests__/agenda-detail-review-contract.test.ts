import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/components/agenda/AppointmentDetailModal.tsx"),
  "utf8",
);
const whatsappInvite = readFileSync(
  resolve(
    process.cwd(),
    "supabase/functions/prepare-appointment-whatsapp-invite/index.ts",
  ),
  "utf8",
);

describe("appointment detail review contract", () => {
  it("keeps a single status disclosure and a single action menu in the header", () => {
    expect(source).toContain("Detalhes da sessão");
    expect(source).toContain("Detalhes do evento");
    expect(source).toContain("Abrir histórico do agendamento");
    expect(source).toContain('aria-label="Mais ações"');
    expect(source).toContain("Convite de confirmação por e-mail");
    expect(source).toContain("Convite de confirmação por WhatsApp");
    expect(source).toContain("Arquivar {isSession ? \"agendamento\" : \"evento\"}");
    expect(source).not.toContain("Status do agendamento");
    expect(source).not.toContain("PopoverTrigger");
    expect(source).not.toContain(">Ações<");
  });

  it("shows compact origin and recurrence context with an exact charge deep link", () => {
    expect(source).toContain('label="Origem"');
    expect(source).toContain('label="Recorrência"');
    expect(source).toContain("getAppointmentRecurrencePosition");
    expect(source).toContain("chargeId=${encodeURIComponent(neurofinanceChargeId)}");
    expect(source).toContain("Abrir detalhes desta cobrança no NeuroFinance");
  });

  it("uses the canonical invitation lifecycle for WhatsApp confirmations", () => {
    expect(source).toContain("prepare-appointment-whatsapp-invite");
    expect(whatsappInvite).toContain('db.rpc("prepare_appointment_invitation"');
    expect(whatsappInvite).toContain('db.rpc("record_appointment_invitation"');
    expect(whatsappInvite).toContain("/confirmar-agendamento/${rawToken}");
    expect(whatsappInvite).toContain('provider: "whatsapp_link"');
  });

  it("requires a real review step before persisting edits", () => {
    expect(source).toContain("const buildDetailReview");
    expect(source).toContain("const reviewDetails");
    expect(source).toContain("Revise as alterações");
    expect(source).toContain("Confirmar e fechar");
    expect(source).not.toContain('key="success"');
  });

  it("reviews Synapse smart-fit before applying it", () => {
    expect(source).toContain('originChannel: "synapse_text"');
    expect(source).toContain('label: "Reencaixe do Synapse"');
    expect(source).toContain("setDetailReview({");
    expect(source).toContain("setStep(2)");
  });
});
