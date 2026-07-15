import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import publicPageCatalog from "../src/content/public-pages.json" with { type: "json" };

export const PUBLIC_SITE_URL = publicPageCatalog.siteUrl;
export const PUBLIC_ENTRY_DIRECTORY = "public-pages";
export const publicPages = publicPageCatalog.pages;
export const publicEntryPages = publicPages.filter((page) => page.file);

const DEFAULT_IMAGE = publicPageCatalog.defaultImage;

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const absoluteUrl = (resourcePath) =>
  new URL(resourcePath, `${PUBLIC_SITE_URL}/`).toString();

const publicNavigation = [
  ["Início", "/"],
  ["Synapse", "/synapse"],
  ["NeuroFinance", "/neurofinance"],
  ["Ajuda", "/ajuda"],
  ["Contato", "/contato"],
  ["Privacidade", "/politica-de-privacidade"],
];

export function renderPublicStaticShell(page) {
  const highlights = page.highlights
    .map(
      (item) =>
        `<li style="border:1px solid #27272a;border-radius:16px;padding:14px 16px;">${escapeHtml(item)}</li>`,
    )
    .join("");
  const navigation = publicNavigation
    .map(([label, href]) => `<a href="${href}" style="color:#fff;">${label}</a>`)
    .join("");

  return `<main id="static-public-shell" style="min-height:100vh;padding:64px 24px;background:#050506;color:#f7f7f8;font-family:Inter,Arial,sans-serif;">
    <div style="max-width:900px;margin:0 auto;">
      <p style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#a1a1aa;">${escapeHtml(page.eyebrow)}</p>
      <h1 style="max-width:800px;font-size:clamp(42px,8vw,76px);line-height:.94;letter-spacing:-.055em;">${escapeHtml(page.heading)}</h1>
      <p style="max-width:740px;font-size:19px;line-height:1.65;color:#d4d4d8;">${escapeHtml(page.lead)}</p>
      <ul style="max-width:740px;display:grid;gap:10px;margin:30px 0 0;padding:0;list-style:none;">${highlights}</ul>
      <nav aria-label="Páginas públicas" style="display:flex;flex-wrap:wrap;gap:16px;margin-top:36px;">${navigation}</nav>
      <p style="margin-top:40px;color:#a1a1aa;">A interface completa e os recursos interativos ficam disponíveis com JavaScript habilitado.</p>
    </div>
  </main>`;
}

function routeStructuredData(page) {
  const url = absoluteUrl(page.route);
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: page.title,
      description: page.description,
      inLanguage: "pt-BR",
      isPartOf: { "@id": `${PUBLIC_SITE_URL}/#website` },
      primaryImageOfPage: absoluteUrl(page.image || DEFAULT_IMAGE),
    },
  ];
}

function replaceMeta(html, attribute, key, content) {
  const expression = new RegExp(`<meta\\s+${attribute}="${key}"[^>]*>`, "i");
  return html.replace(
    expression,
    `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />`,
  );
}

export function buildPublicEntryHtml(template, page) {
  const canonical = absoluteUrl(page.route);
  const image = absoluteUrl(page.image || DEFAULT_IMAGE);
  let html = template;

  html = html.replace(
    /\s*<style id="neuronex-entry-visibility-style">[\s\S]*?<\/style>/i,
    "",
  );
  html = html.replace(
    /\s*<script id="neuronex-entry-visibility-script">[\s\S]*?<\/script>/i,
    "",
  );
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(page.title)}</title>`);
  html = replaceMeta(html, "name", "title", page.title);
  html = replaceMeta(html, "name", "description", page.description);
  html = replaceMeta(html, "name", "robots", "index, follow, max-image-preview:large");
  html = replaceMeta(html, "property", "og:url", canonical);
  html = replaceMeta(html, "property", "og:title", page.title);
  html = replaceMeta(html, "property", "og:description", page.description);
  html = replaceMeta(html, "property", "og:image", image);
  html = replaceMeta(html, "name", "twitter:url", canonical);
  html = replaceMeta(html, "name", "twitter:title", page.title);
  html = replaceMeta(html, "name", "twitter:description", page.description);
  html = replaceMeta(html, "name", "twitter:image", image);
  html = html.replace(
    /<link\s+rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
  );
  html = html.replace(
    /<script id="neuronex-route-structured-data"[\s\S]*?<\/script>/i,
    `<script id="neuronex-route-structured-data" type="application/ld+json">${JSON.stringify(routeStructuredData(page)).replaceAll("<", "\\u003c")}</script>`,
  );
  html = html.replace(
    /<main id="static-public-shell"[\s\S]*?<\/main>/i,
    renderPublicStaticShell(page),
  );

  return html;
}

export async function generatePublicEntryPages(outputRoot = path.resolve("dist")) {
  const template = await readFile(path.join(outputRoot, "index.html"), "utf8");
  const targetDirectory = path.join(outputRoot, PUBLIC_ENTRY_DIRECTORY);
  await mkdir(targetDirectory, { recursive: true });

  await Promise.all(
    publicEntryPages.map((page) =>
      writeFile(path.join(targetDirectory, page.file), buildPublicEntryHtml(template, page), "utf8"),
    ),
  );
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  await generatePublicEntryPages();
  console.log(`[NeuroNex] ${publicEntryPages.length} public entry pages generated.`);
}
