import {
  assertEquals,
  assertFalse,
  assertStringIncludes,
} from "jsr:@std/assert@1";
import {
  deterministicNeuroReadResponse,
  sanitizeSynapseResponse,
  sanitizeSynapseResponseWithWidget,
} from "./response-sanitizer.ts";

Deno.test("sanitizer traduz identificadores conhecidos sem apagar a resposta", () => {
  const result = sanitizeSynapseResponse(
    "Consultei (`get_patient_timeline`) e `get_clinical_history` para revisar Carlos.",
  );

  assertStringIncludes(result, "linha do tempo clínica");
  assertStringIncludes(result, "histórico clínico");
  assertStringIncludes(result, "Carlos");
  assertFalse(result.includes("get_patient_timeline"));
});

Deno.test("sanitizer preserva linguagem natural e nomes dos produtos", () => {
  assertEquals(
    sanitizeSynapseResponse(
      "Abri o NeuroFlow e organizei as hipóteses clínicas.",
    ),
    "Abri o NeuroFlow e organizei as hipóteses clínicas.",
  );
});

Deno.test("sanitizer mascara identificador desconhecido", () => {
  assertEquals(
    sanitizeSynapseResponse(
      "Usei `search_private_internal_index` para concluir.",
    ),
    "Usei recurso interno do Synapse para concluir.",
  );
});

Deno.test("sanitizer preserva o payload do componente visual", () => {
  const response = sanitizeSynapseResponseWithWidget(
    'Usei `get_clinical_history`.\n\n```json synapse_widget\n{"__actionType":"patient_card"}\n```',
  );
  assertStringIncludes(response, "histórico clínico");
  assertStringIncludes(response, '"__actionType":"patient_card"');
});

Deno.test("NeuroView forçado encerra com a mensagem útil do executor", () => {
  assertEquals(
    deterministicNeuroReadResponse("analyze_neuroview_patient_patterns", {
      ok: true,
      message: "Encontrei três padrões recorrentes no histórico de Carlos.",
      data: { summary: "resumo alternativo" },
    }),
    "Encontrei três padrões recorrentes no histórico de Carlos.",
  );
  assertEquals(
    deterministicNeuroReadResponse("create_neuroflow_from_patient_history", {
      ok: true,
    }),
    null,
  );
});
