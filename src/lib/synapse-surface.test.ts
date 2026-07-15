import { describe, expect, it } from "vitest";

import { routeSupportsDesktopSynapseShell } from "./synapse-surface";

describe("Synapse desktop shell surface boundary", () => {
  it.each([
    "/dashboard",
    "/agenda",
    "/pacientes/paciente-id",
    "/notas",
    "/financeiro/conta",
    "/ajustes",
    "/teleconsulta",
    "/neurozap",
  ])("supports the professional desktop route %s", (pathname) => {
    expect(routeSupportsDesktopSynapseShell(pathname)).toBe(true);
  });

  it.each([
    "/",
    "/synapse",
    "/neurofinance",
    "/auth",
    "/portal",
    "/portal/agenda",
    "/join/convite",
    "/anamnese-externa/ficha",
    "/initial-settings",
    "/synapse-ai",
    "/rota-inexistente",
  ])("keeps the shell outside the route %s", (pathname) => {
    expect(routeSupportsDesktopSynapseShell(pathname)).toBe(false);
  });
});
