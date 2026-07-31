import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/components/agenda/AppointmentDetailModal.tsx"),
  "utf8",
);

describe("appointment detail review contract", () => {
  it("keeps title and context controls in separate visual structures", () => {
    expect(source).toContain('aria-label="Contexto do agendamento"');
    expect(source).toContain("synapse-liquid-toolbar");
    expect(source).toContain("PopoverTrigger");
    expect(source).toContain("Lista de espera · confirmado pelo paciente");
    expect(source).not.toContain("isWaitlistOriginExpanded");
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
