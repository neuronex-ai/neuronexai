import { describe, expect, it } from "vitest";

import {
  absolutePublicUrl,
  buildPublicStructuredData,
  getPublicSeoConfig,
  PUBLIC_SITE_URL,
} from "./public-seo";

describe("public SEO routes", () => {
  it.each([
    ["/", "/"],
    ["/synapse", "/synapse"],
    ["/neurofinance/", "/neurofinance"],
    ["/neurobox", "/neurobox"],
    ["/ajuda", "/ajuda"],
    ["/contato", "/contato"],
    ["/documentos-legais", "/documentos-legais"],
    ["/termos-de-uso", "/termos-de-uso"],
    ["/politica-de-privacidade", "/politica-de-privacidade"],
    ["/configuracoes-de-cookies", "/configuracoes-de-cookies"],
  ])("keeps %s indexable with canonical path %s", (pathname, canonicalPath) => {
    const config = getPublicSeoConfig(pathname);

    expect(config.indexable).toBe(true);
    expect(config.canonicalPath).toBe(canonicalPath);
    expect(absolutePublicUrl(config.canonicalPath)).toBe(
      `${PUBLIC_SITE_URL}${canonicalPath === "/" ? "/" : canonicalPath}`,
    );
  });

  it.each([
    "/auth",
    "/dashboard",
    "/portal/ativar",
    "/join/private-token",
    "/confirmar-agendamento/private-token",
    "/anamnese-externa/private-token",
    "/id/perfil-publico",
    "/rota-inexistente",
  ])("marks operational or unknown route %s as noindex", (pathname) => {
    const config = getPublicSeoConfig(pathname);

    expect(config.indexable).toBe(false);
    expect(config.canonicalPath).toBeUndefined();
    expect(buildPublicStructuredData(config)).toBeNull();
  });

  it("does not index professional profiles until the profile can be validated for search", () => {
    const config = getPublicSeoConfig("/id/perfil-publico");

    expect(config.indexable).toBe(false);
    expect(config.canonicalPath).toBeUndefined();
    expect(buildPublicStructuredData(config)).toBeNull();
  });

  it("publishes product structured data on the home page", () => {
    const structuredData = buildPublicStructuredData(getPublicSeoConfig("/"));
    const graph = structuredData?.["@graph"] || [];

    expect(graph.some((item) => item["@type"] === "SoftwareApplication")).toBe(true);
    expect(graph.some((item) => item["@type"] === "WebPage")).toBe(true);
    expect(graph.some((item) => item["@type"] === "Organization")).toBe(true);
  });

  it("publishes page-specific structured data for strategic public products", () => {
    const financeGraph = buildPublicStructuredData(getPublicSeoConfig("/neurofinance"))?.["@graph"] || [];
    const neuroboxGraph = buildPublicStructuredData(getPublicSeoConfig("/neurobox"))?.["@graph"] || [];

    expect(financeGraph.some((item) => item["@type"] === "FinancialProduct")).toBe(true);
    expect(
      neuroboxGraph.some(
        (item) => item["@type"] === "SoftwareApplication" && item.name === "NeuroBox",
      ),
    ).toBe(true);
  });
});
