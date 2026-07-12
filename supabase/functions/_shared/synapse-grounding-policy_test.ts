import { assertEquals } from "jsr:@std/assert@1";
import { requiresCanonicalSynapseAgent } from "./synapse-grounding-policy.ts";

Deno.test("gateway genérico recusa intenções Neuro operacionais", () => {
  assertEquals(
    requiresCanonicalSynapseAgent("Crie um NeuroFlow para Carlos"),
    true,
  );
  assertEquals(
    requiresCanonicalSynapseAgent("Analise Carlos no NeuroView"),
    true,
  );
  assertEquals(
    requiresCanonicalSynapseAgent("Gere um NeuroPulse de causa e efeito"),
    true,
  );
});

Deno.test("gateway genérico continua disponível para conversa geral", () => {
  assertEquals(
    requiresCanonicalSynapseAgent("Escreva uma mensagem acolhedora"),
    false,
  );
});
