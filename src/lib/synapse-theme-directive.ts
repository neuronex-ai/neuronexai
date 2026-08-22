export type SynapseThemeDirective = "light" | "dark" | "toggle";

const THEME_DIRECTIVE_PATTERN = /^__synapse_theme:(light|dark|toggle)$/i;

export function synapseThemeDirectiveFromAction(
  action: { query?: unknown } | null | undefined,
): SynapseThemeDirective | null {
  const value = String(action?.query || "").trim();
  const match = value.match(THEME_DIRECTIVE_PATTERN);
  return match ? match[1].toLowerCase() as SynapseThemeDirective : null;
}

export function resolveSynapseThemeTarget(
  directive: SynapseThemeDirective,
  currentTheme: "light" | "dark",
): "light" | "dark" {
  if (directive === "toggle") return currentTheme === "dark" ? "light" : "dark";
  return directive;
}
