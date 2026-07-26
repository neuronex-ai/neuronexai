import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  PUBLIC_ARTICLES,
  PUBLIC_CONTENT,
  PUBLIC_PAGES,
  PUBLIC_UPDATES,
} from "./public-content";
import {
  COMPARISON_PUBLIC_PAGES,
  COMPARISONS,
} from "./comparison-content";

const PUBLIC_STATUSES = ["Disponível", "Beta", "Em evolução"];
const FORBIDDEN_PROVIDER_TERMS =
  /\b(?:deepgram|evolution\s*api|evolutionapi|jitsi|jaas)\b/iu;
const FORBIDDEN_NEUROZAP_NAMES =
  /NeuroZap\s+(?:Desktop|Beta)|Desktop\s+Beta/iu;
const neuroZapLandingSource = readFileSync(
  join(process.cwd(), "src/pages/public/NeuroZapLanding.tsx"),
  "utf8",
);
const teleconsultaLandingSource = readFileSync(
  join(process.cwd(), "src/pages/public/TeleconsultaLanding.tsx"),
  "utf8",
);

describe("public content catalog", () => {
  it("keeps routes, files, titles and headings unique", () => {
    expect(new Set(PUBLIC_PAGES.map(({ route }) => route)).size).toBe(
      PUBLIC_PAGES.length,
    );
    expect(
      new Set(
        PUBLIC_PAGES.map(({ file }) => file).filter(
          (file): file is string => Boolean(file),
        ),
      ).size,
    ).toBe(PUBLIC_PAGES.filter(({ file }) => file).length);
    expect(new Set(PUBLIC_PAGES.map(({ title }) => title)).size).toBe(
      PUBLIC_PAGES.length,
    );
    expect(new Set(PUBLIC_PAGES.map(({ heading }) => heading)).size).toBe(
      PUBLIC_PAGES.length,
    );
  });

  it("uses only the approved public availability states", () => {
    for (const status of [
      ...PUBLIC_PAGES.map(({ status }) => status),
      ...PUBLIC_UPDATES.map(({ status }) => status),
    ]) {
      expect(PUBLIC_STATUSES).toContain(status);
    }
  });

  it("does not publish the founder page before its brief is validated", () => {
    expect(PUBLIC_PAGES.some(({ route }) => route === "/sobre-nos")).toBe(false);
  });

  it("does not expose suppliers or subprocessors in Teleconsulta and NeuroZap", () => {
    const sensitivePages = PUBLIC_PAGES.filter(({ route }) =>
      [
        "/teleconsulta-para-psicologos",
        "/neurozap-para-psicologos",
      ].includes(route),
    );

    expect(sensitivePages).toHaveLength(2);
    for (const page of sensitivePages) {
      expect(JSON.stringify(page)).not.toMatch(FORBIDDEN_PROVIDER_TERMS);
    }
    expect(neuroZapLandingSource).not.toMatch(FORBIDDEN_PROVIDER_TERMS);
    expect(teleconsultaLandingSource).not.toMatch(FORBIDDEN_PROVIDER_TERMS);
  });

  it("uses NeuroZap as the product name and exposes Beta only as its status", () => {
    const page = PUBLIC_PAGES.find(
      ({ route }) => route === "/neurozap-para-psicologos",
    );

    expect(page?.status).toBe("Beta");
    expect(page?.eyebrow).toBe("NeuroZap");
    expect(JSON.stringify(page)).not.toMatch(FORBIDDEN_NEUROZAP_NAMES);
    expect(neuroZapLandingSource).not.toMatch(FORBIDDEN_NEUROZAP_NAMES);
    expect(JSON.stringify(page).match(/\bBeta\b/gu)).toHaveLength(1);
    expect(neuroZapLandingSource.match(/\bbeta\b/giu) ?? []).toHaveLength(0);
    expect(PUBLIC_PAGES.some(({ route }) => route === "/download")).toBe(true);
    expect(PUBLIC_PAGES.some(({ route }) => route === "/precos")).toBe(false);
  });

  it("publishes only reviewed articles with verified authors", () => {
    expect(PUBLIC_ARTICLES).toHaveLength(23);
    expect(
      PUBLIC_CONTENT.articles.filter(
        ({ publicationStatus }) => publicationStatus === "draft",
      ),
    ).toHaveLength(0);
    expect(PUBLIC_ARTICLES.filter(({ route }) => route.includes("/blog/neuronex-vs-"))).toHaveLength(5);
    for (const article of PUBLIC_ARTICLES) {
      expect(article.authorId).toBe("equipe-neuronex");
      expect(article.modifiedAt >= article.publishedAt).toBe(true);
      expect(
        PUBLIC_CONTENT.authors.some(({ id }) => id === article.authorId),
      ).toBe(true);
    }
  });

  it("publishes seven honest comparison definitions reviewed in July 2026", () => {
    expect(COMPARISONS).toHaveLength(7);
    expect(COMPARISONS.map(({ slug }) => slug)).toEqual([
      "neuronex-vs-psicomanager",
      "neuronex-vs-psicogest",
      "neuronex-vs-corpora",
      "neuronex-vs-sintropia",
      "neuronex-vs-psipront",
      "neuronex-vs-terabase",
      "neuronex-vs-psinexus",
    ]);

    for (const comparison of COMPARISONS) {
      expect(comparison.reviewedAt).toBe("2026-07");
      expect(comparison.faq).toHaveLength(6);
      expect(comparison.comparisonRows.length).toBeGreaterThanOrEqual(5);
      expect(comparison.faq.at(-1)?.answer).not.toMatch(
        /importa(?:ção|r).*(?:automática|automaticamente).*(?:sim|disponível)/iu,
      );
    }
  });

  it("keeps comparison routes, files and titles unique across the public catalog", () => {
    const allRoutes = [
      ...PUBLIC_PAGES.map(({ route }) => route),
      ...PUBLIC_ARTICLES.map(({ route }) => route),
      ...COMPARISON_PUBLIC_PAGES.map(({ route }) => route),
    ];
    const comparisonFiles = COMPARISON_PUBLIC_PAGES.map(({ file }) => file);
    const comparisonTitles = COMPARISON_PUBLIC_PAGES.map(({ title }) => title);

    expect(new Set(allRoutes).size).toBe(allRoutes.length);
    expect(new Set(comparisonFiles).size).toBe(comparisonFiles.length);
    expect(new Set(comparisonTitles).size).toBe(comparisonTitles.length);
  });
});
