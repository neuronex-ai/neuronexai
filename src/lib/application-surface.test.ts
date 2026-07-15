import { describe, expect, it } from "vitest";

import { routeUsesOperationalProviders } from "./application-surface";

describe("application surface provider boundary", () => {
  it.each([
    "/auth",
    "/portal/ativar",
    "/confirmar-agendamento/token",
    "/join/token",
    "/anamnese-externa/id",
    "/dashboard",
    "/pacientes/id",
    "/financeiro/conta",
    "/neurozap",
  ])("loads operational providers for %s", (pathname) => {
    expect(routeUsesOperationalProviders(pathname)).toBe(true);
  });

  it.each([
    "/",
    "/synapse",
    "/neurofinance",
    "/ajuda",
    "/contato",
    "/documentos-legais",
    "/termos-de-uso",
    "/politica-de-privacidade",
    "/configuracoes-de-cookies",
    "/id/perfil-publico",
    "/authentic",
    "/rota-inexistente",
  ])("keeps public or unknown route %s outside operational providers", (pathname) => {
    expect(routeUsesOperationalProviders(pathname)).toBe(false);
  });
});
