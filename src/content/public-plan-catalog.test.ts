import { describe, expect, it } from "vitest";

import { PUBLIC_PLAN_CARDS, PUBLIC_PLAN_COMPARISON } from "./public-plan-catalog";

describe("public plan catalog", () => {
  it("publishes only the Essential and Professional plans", () => {
    expect(PUBLIC_PLAN_CARDS.map(({ name }) => name)).toEqual([
      "Essential",
      "Profissional",
    ]);
  });

  it.each([
    ["Pacientes ativos", "5", "250"],
    ["Vínculos ativos no Portal", "5", "250"],
    ["Synapse por texto", "30 ações/mês", "500 ações/mês"],
    ["Synapse por voz", "5 minutos/mês", "60 minutos/mês"],
  ])("keeps the approved limits for %s", (feature, essential, professional) => {
    const row = PUBLIC_PLAN_COMPARISON.find(([label]) => label === feature);

    expect(row).toEqual([feature, essential, professional]);
  });

  it("keeps the approved Essential teleconsultation allowance", () => {
    const row = PUBLIC_PLAN_COMPARISON.find(([label]) => label === "Teleconsultas");

    expect(row?.[1]).toBe("5 sessões e 150 min/mês");
  });

  it("lists all four NeuroBox products only in Professional", () => {
    const row = PUBLIC_PLAN_COMPARISON.find(([label]) => label === "NeuroBox");

    expect(row?.[1]).toBe("—");
    expect(row?.[2]).toBe("NeuroView, NeuroFlow, NeuroPulse e NeuroScan");
  });

  it("describes NeuroZap and Synapse no WhatsApp without overpromising access", () => {
    const neuroZap = PUBLIC_PLAN_COMPARISON.find(
      ([label]) => label === "NeuroZap",
    );
    const synapse = PUBLIC_PLAN_COMPARISON.find(
      ([label]) => label === "Synapse no WhatsApp",
    );

    expect(neuroZap?.[2]).toContain("Beta");
    expect(synapse?.[2]).toBe("Acesso conforme disponibilidade");
  });
});
