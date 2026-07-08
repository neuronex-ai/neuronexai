import { buildNeuroPulseFallbackMermaid, extractMermaidCode } from "@/lib/mermaid-content";

export const NEUROPULSE_MERMAID_CLASSES = [
  "context",
  "trigger",
  "cognition",
  "emotion",
  "behavior",
  "consequence",
  "intervention",
] as const;

const stripFence = (value: string) =>
  value
    .replace(/^```(?:mermaid)?\s*/i, "")
    .replace(/```$/i, "")
    .replace(/\r\n/g, "\n")
    .trim();

export const validateNeuroPulseMermaidContract = (value: string) => {
  const mermaid = stripFence(value);
  if (!/^flowchart\s+TD\b/i.test(mermaid)) {
    throw new Error("NeuroPulse Mermaid precisa iniciar com flowchart TD.");
  }
  if (/<[a-z!/]/i.test(mermaid)) {
    throw new Error("NeuroPulse Mermaid nao pode conter HTML.");
  }

  const nodeLines = mermaid.split("\n").filter((line) => /^\s*[A-Z][A-Z0-9]*\["/.test(line));
  const edgeLines = mermaid.split("\n").filter((line) => /-->|---/.test(line));
  if (nodeLines.length > 18) throw new Error("NeuroPulse Mermaid excede 18 nos.");
  if (edgeLines.length > 28) throw new Error("NeuroPulse Mermaid excede 28 arestas.");
  return mermaid;
};

export const normalizeNeuroPulseMermaid = ({
  raw,
  input,
  lensLabel,
}: {
  raw: string;
  input: string;
  lensLabel: string;
}) => {
  const extracted = extractMermaidCode(raw) || stripFence(raw);
  try {
    return validateNeuroPulseMermaidContract(extracted);
  } catch {
    return validateNeuroPulseMermaidContract(buildNeuroPulseFallbackMermaid({ input, lensLabel }));
  }
};

export const neuroPulsePromptContract = (lensLabel: string, input: string) => `
Atue como especialista em ${lensLabel}.
Gere APENAS um diagrama Mermaid no contrato abaixo.

CONTRATO OBRIGATORIO:
- Comece exatamente com: flowchart TD
- Nao use markdown, cercas de codigo, HTML ou comentarios.
- Use ids simples em maiusculas: A, B, C, D...
- Use labels sempre entre aspas: A["texto"]
- Maximo de 18 nos e 28 conexoes.
- Use classes: ${NEUROPULSE_MERMAID_CLASSES.join(", ")}.
- Inclua classDef para cada classe usada.
- Modele causa e efeito: contexto -> gatilho -> cognicao -> emocao -> comportamento -> consequencia -> intervencao.

Relato:
"${input}"
`.trim();
