import { describe, expect, it } from "vitest";

import { PUBLIC_ARTICLES, PUBLIC_PAGES } from "@/content/public-content";
import { COMPARISON_PUBLIC_PAGES } from "@/content/comparison-content";
import {
  absolutePublicUrl,
  buildPublicStructuredData,
  getPublicSeoConfig,
  PUBLIC_SITE_URL,
} from "./public-seo";

const graphFor = (pathname: string) =>
  buildPublicStructuredData(getPublicSeoConfig(pathname))?.["@graph"] ?? [];

const hasType = (
  item: Record<string, unknown>,
  type: string,
) =>
  item["@type"] === type ||
  (Array.isArray(item["@type"]) && item["@type"].includes(type));

describe("public SEO routes", () => {
  it.each(
    [
      ...PUBLIC_PAGES.map(({ route }) => route),
      ...PUBLIC_ARTICLES.map(({ route }) => route),
      ...COMPARISON_PUBLIC_PAGES.map(({ route }) => route),
    ],
  )("keeps %s indexable with a canonical URL", (pathname) => {
    const config = getPublicSeoConfig(pathname);

    expect(config.indexable).toBe(true);
    expect(config.canonicalPath).toBe(pathname);
    expect(absolutePublicUrl(config.canonicalPath)).toBe(
      `${PUBLIC_SITE_URL}${pathname === "/" ? "/" : pathname}`,
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
    "/sobre-nos",
    "/rota-inexistente",
  ])("marks operational or unavailable route %s as noindex", (pathname) => {
    const config = getPublicSeoConfig(pathname);

    expect(config.indexable).toBe(false);
    expect(config.canonicalPath).toBeUndefined();
    expect(buildPublicStructuredData(config)).toBeNull();
  });

  it("publishes the organization, website and product catalog on the home page", () => {
    const graph = graphFor("/");
    const application = graph.find(
      (item) => hasType(item, "SoftwareApplication"),
    );

    expect(graph.some((item) => item["@type"] === "Organization")).toBe(true);
    expect(graph.some((item) => item["@type"] === "WebSite")).toBe(true);
    expect(graph.some((item) => item["@type"] === "WebPage")).toBe(true);
    expect(application?.applicationCategory).toEqual([
      "HealthApplication",
      "BusinessApplication",
      "FinanceApplication",
    ]);
    expect(application?.offers).toHaveLength(2);
    expect(application?.offers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          "@type": "Offer",
          price: expect.any(Number),
          priceCurrency: "BRL",
          availability: "https://schema.org/InStock",
        }),
      ]),
    );
  });

  it("publishes page-specific financial, product and breadcrumb schemas", () => {
    const financeGraph = graphFor("/neurofinance");
    const neuroboxGraph = graphFor("/neurobox");

    expect(
      financeGraph.some((item) => item["@type"] === "FinancialProduct"),
    ).toBe(true);
    expect(financeGraph.some((item) => item["@type"] === "Service")).toBe(true);
    expect(
      neuroboxGraph.some(
        (item) =>
          hasType(item, "SoftwareApplication") &&
          item.name === "NeuroBox",
      ),
    ).toBe(true);
    expect(
      neuroboxGraph.some((item) => item["@type"] === "BreadcrumbList"),
    ).toBe(true);
  });

  it("publishes blog collection and article schemas with verified dates", () => {
    const blogGraph = graphFor("/blog");
    const article = PUBLIC_ARTICLES[0];
    const articleGraph = graphFor(article.route);
    const articleNode = articleGraph.find(
      (item) => item["@type"] === "BlogPosting",
    );

    expect(blogGraph.some((item) => item["@type"] === "Blog")).toBe(true);
    expect(blogGraph.some((item) => item["@type"] === "ItemList")).toBe(true);
    expect(articleNode?.datePublished).toBe(article.publishedAt);
    expect(articleNode?.dateModified).toBe(article.modifiedAt);
    expect(articleNode?.author).toEqual(
      expect.objectContaining({ name: "Equipe NeuroNex" }),
    );
  });

  it("publishes comparison collection, breadcrumbs and FAQ without review claims", () => {
    const indexGraph = graphFor("/comparar");
    const detailGraph = graphFor(
      "/comparar/neuronex-vs-psicomanager",
    );
    const itemList = indexGraph.find((item) => item["@type"] === "ItemList");
    const breadcrumb = detailGraph.find(
      (item) => item["@type"] === "BreadcrumbList",
    );

    expect(indexGraph.some((item) => item["@type"] === "CollectionPage")).toBe(true);
    expect(itemList?.itemListElement).toHaveLength(7);
    expect(detailGraph.some((item) => item["@type"] === "FAQPage")).toBe(true);
    expect(breadcrumb?.itemListElement).toHaveLength(3);
    expect(detailGraph.some((item) => hasType(item, "Product"))).toBe(false);
    expect(detailGraph.some((item) => hasType(item, "Review"))).toBe(false);
  });
});
