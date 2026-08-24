import type { GraphNode } from "./graph-types";

const COMPACT_LABEL_WORD_LIMIT = 2;

export const getNeuroVisionDisplayLabel = (node: Pick<GraphNode, "label" | "type">) => {
  const label = (node.label || "Sem título").trim().replace(/\s+/g, " ");
  if (node.type === "patient") return label;

  const words = label.split(" ");
  if (words.length <= COMPACT_LABEL_WORD_LIMIT) return label;
  return `${words.slice(0, COMPACT_LABEL_WORD_LIMIT).join(" ")}…`;
};

export const shouldUseNeuroVisionLabelSurface = (node: Pick<GraphNode, "type">) =>
  node.type === "patient";
