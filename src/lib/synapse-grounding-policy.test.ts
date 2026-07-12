import { describe, expect, it } from "vitest";
import { requiresCanonicalSynapseAgent } from "./synapse-grounding-policy";

describe("requiresCanonicalSynapseAgent", () => {
  it.each([
    "Crie um NeuroFlow para Carlos",
    "Analise Carlos no NeuroView",
    "Gere um diagrama no NeuroPulse",
    "Mostre minha agenda de hoje",
    "Qual é o saldo do NeuroFinance?",
  ])("protege intenção operacional: %s", (message) => {
    expect(requiresCanonicalSynapseAgent(message)).toBe(true);
  });

  it("permite conversa geral no gateway de recuperação", () => {
    expect(requiresCanonicalSynapseAgent("Escreva uma frase breve sobre autocuidado.")).toBe(false);
  });
});

