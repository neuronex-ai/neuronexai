import { describe, expect, it } from "vitest";
import {
  normalizeNeuroPulseMermaid,
  validateNeuroPulseMermaidContract,
} from "../neuropulse-mermaid";

describe("neuropulse mermaid contract", () => {
  it("accepts strict flowchart TD mermaid", () => {
    const mermaid = [
      "flowchart TD",
      '  A["Contexto"] --> B["Gatilho"]',
      "  classDef context fill:#111,stroke:#fff,color:#fff;",
      "  class A context;",
    ].join("\n");

    expect(validateNeuroPulseMermaidContract(mermaid)).toBe(mermaid);
  });

  it("falls back when model returns graph TD or prose", () => {
    const normalized = normalizeNeuroPulseMermaid({
      raw: "Segue:\n```mermaid\ngraph TD\nA[solto]-->B[fora]\n```",
      input: "paciente evita conversas e fica ansioso",
      lensLabel: "TCC",
    });

    expect(normalized).toMatch(/^flowchart TD/);
    expect(normalized).toContain("classDef");
  });
});
