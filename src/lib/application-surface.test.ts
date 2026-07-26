import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { routeUsesOperationalProviders } from "./application-surface";

describe("application surface provider boundary", () => {
  it("keeps authentication available to public and operational surfaces through one provider", () => {
    const appSource = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
    const providerOpen = appSource.indexOf("<SessionContextProvider>");
    const surfaceGate = appSource.indexOf("<ApplicationSurfaceGate />");
    const providerClose = appSource.indexOf("</SessionContextProvider>");

    expect(providerOpen).toBeGreaterThan(-1);
    expect(surfaceGate).toBeGreaterThan(providerOpen);
    expect(providerClose).toBeGreaterThan(surfaceGate);
    expect(appSource.match(/<SessionContextProvider>/g)).toHaveLength(1);
  });

  it.each([
    "/auth",
    "/portal/ativar",
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
    "/comparar",
    "/comparar/neuronex-vs-psicomanager",
    "/confirmar-agendamento/token",
    "/id/perfil-publico",
    "/authentic",
    "/rota-inexistente",
  ])("keeps public or unknown route %s outside operational providers", (pathname) => {
    expect(routeUsesOperationalProviders(pathname)).toBe(false);
  });
});
