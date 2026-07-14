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
    "/rota-inexistente",
  ])("marks operational or unknown route %s as noindex", (pathname) => {
    const config = getPublicSeoConfig(pathname);

    expect(config.indexable).toBe(false);
    expect(config.canonicalPath).toBeUndefined();
    expect(buildPublicStructuredData(config)).toEqual([]);
  });

  it("keeps verified public professional profiles indexable without exposing a token route", () => {
    const config = getPublicSeoConfig("/id/perfil-publico");

    expect(config.indexable).toBe(true);
    expect(config.pageType).toBe("profile");
    expect(config.canonicalPath).toBe("/id/perfil-publico");
  });

  it("publishes product structured data on the home page", () => {
    const structuredData = buildPublicStructuredData(getPublicSeoConfig("/"));

    expect(structuredData.some((item) => item["@type"] === "SoftwareApplication")).toBe(true);
    expect(structuredData.some((item) => item["@type"] === "WebPage")).toBe(true);
  });
});
