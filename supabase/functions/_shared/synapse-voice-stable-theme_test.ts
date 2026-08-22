import {
  buildSynapseVoiceFunctions,
  SYNAPSE_VOICE_TOOLSET_VERSION,
} from "./synapse-voice-toolset.ts";

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

Deno.test("live voice stays below the Deepgram function ceiling", () => {
  const functions = buildSynapseVoiceFunctions();
  assert(functions.length === 15, `esperadas 15 funções, recebidas ${functions.length}`);
  assert(
    SYNAPSE_VOICE_TOOLSET_VERSION === "neuronex.voice-core.v12-theme-stable",
    "toolset estável de voz inesperado",
  );
});

Deno.test("theme control is described on the existing interface tool", () => {
  const tool = buildSynapseVoiceFunctions().find((candidate) => candidate.name === "request_interface_action");
  const description = String(tool?.description || "");
  assert(description.includes("__synapse_theme:light"), "tema claro ausente");
  assert(description.includes("__synapse_theme:dark"), "tema escuro ausente");
  assert(description.includes("__synapse_theme:toggle"), "alternância ausente");
});
