import { describe, expect, it } from "vitest";
import {
  resolveSynapseThemeTarget,
  synapseThemeDirectiveFromAction,
} from "@/lib/synapse-theme-directive";

describe("Synapse desktop theme directive", () => {
  it("accepts only the internal light/dark/toggle markers", () => {
    expect(synapseThemeDirectiveFromAction({ query: "__synapse_theme:light" })).toBe("light");
    expect(synapseThemeDirectiveFromAction({ query: "__synapse_theme:dark" })).toBe("dark");
    expect(synapseThemeDirectiveFromAction({ query: "__synapse_theme:toggle" })).toBe("toggle");
    expect(synapseThemeDirectiveFromAction({ query: "tema escuro" })).toBeNull();
  });

  it("resolves toggle against the current desktop theme", () => {
    expect(resolveSynapseThemeTarget("toggle", "dark")).toBe("light");
    expect(resolveSynapseThemeTarget("toggle", "light")).toBe("dark");
  });
});
