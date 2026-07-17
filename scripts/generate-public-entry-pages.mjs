import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  PUBLIC_SITE_URL,
  absolutePublicUrl,
  buildPublicStructuredData,
  getPublicSeoConfig,
  publicContent,
  validatePublicContentCatalog,
} from "../src/lib/public-schema.mjs";

export { PUBLIC_SITE_URL };

export const PUBLIC_ENTRY_DIRECTORY = "public-pages";
export const PUBLIC_LAST_MODIFIED = publicContent.site.lastModified;

const articleEntries = publicContent.articles.map((article) => ({
  ...article,
  kind: "article",
  status: "Disponível",
  eyebrow: article.category,
  heading: article.title,
  lead: article.excerpt,
  highlights: [],
  sections: [],
  faq: [],
}));

export const publicPages = [...publicContent.pages, ...articleEntries];
export const publicEntryPages = publicPages.filter((page) => page.file);

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const staticStyle = {
  page:
    "min-height:100vh;padding:48px 24px 80px;background:#050506;color:#f7f7f8;font-family:Inter,Arial,sans-serif;",
  container: "max-width:1040px;margin:0 auto;",
  eyebrow:
    "font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#a1a1aa;",
  h1:
    "max-width:920px;font-size:clamp(42px,8vw,78px);line-height:.94;letter-spacing:0;margin:22px 0;",
  lead:
    "max-width:780px;font-size:19px;line-height:1.65;color:#d4d4d8;margin:0;",
  nav:
    "display:flex;flex-wrap:wrap;gap:14px;margin:0 0 44px;padding-bottom:24px;border-bottom:1px solid #27272a;",
  section: "padding:42px 0;border-top:1px solid #27272a;",
  h2:
    "max-width:820px;font-size:clamp(28px,5vw,46px);line-height:1.04;letter-spacing:0;margin:0;",
  paragraph:
    "max-width:780px;font-size:17px;line-height:1.7;color:#d4d4d8;margin:16px 0 0;",
  list:
    "max-width:780px;display:grid;gap:10px;margin:24px 0 0;padding:0;list-style:none;",
  item:
    "border-top:1px solid #27272a;padding:14px 0;font-size:15px;line-height:1.5;",
  related:
    "display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin-top:24px;",
  relatedItem:
    "display:block;border:1px solid #3f3f46;border-radius:8px;padding:16px;color:#fff;text-decoration:none;",
};

const markdownStyle = {
  h2: {
    maxWidth: 820,
    fontSize: 42,
    lineHeight: 1.04,
    margin: "38px 0 0",
  },
  h3: {
    fontSize: 24,
    lineHeight: 1.2,
    margin: "32px 0 0",
  },
  paragraph: {
    maxWidth: 780,
    fontSize: 17,
    lineHeight: 1.7,
    color: "#d4d4d8",
    margin: "16px 0 0",
  },
  list: {
    maxWidth: 780,
    display: "grid",
    gap: 10,
    margin: "24px 0 0",
    paddingLeft: 24,
  },
  item: {
    padding: "4px 0",
    fontSize: 15,
    lineHeight: 1.5,
  },
  link: {
    color: "#fff",
    textDecoration: "underline",
  },
  strong: {
    color: "#fff",
  },
};

const publicNavigation = [
  ["Início", "/"],
  ["Produto", "/produto"],
  ["Synapse", "/synapse"],
  ["NeuroFinance", "/neurofinance"],
  ["NeuroBox", "/neurobox"],
  ["Pacientes", "/pacientes-para-psicologos"],
  ["Teleconsulta", "/teleconsulta-para-psicologos"],
  ["Download", "/download"],
  ["NeuroX", "/blog"],
  ["Novidades", "/novidades"],
  ["Segurança", "/seguranca-e-etica"],
];

const renderNavigation = () =>
  publicNavigation
    .map(
      ([label, href]) =>
        `<a href="${href}" style="color:#fff;text-decoration:none;">${escapeHtml(label)}</a>`,
    )
    .join("");

const renderHighlights = (highlights = []) => {
  if (!highlights.length) return "";
  return `<ul style="${staticStyle.list}">${highlights
    .map((item) => `<li style="${staticStyle.item}">${escapeHtml(item)}</li>`)
    .join("")}</ul>`;
};

const renderSections = (sections = []) =>
  sections
    .map((section) => {
      const bullets = section.bullets?.length
        ? `<ul style="${staticStyle.list}">${section.bullets
            .map(
              (bullet) =>
                `<li style="${staticStyle.item}">${escapeHtml(bullet)}</li>`,
            )
            .join("")}</ul>`
        : "";

      return `<section style="${staticStyle.section}">
        <h2 style="${staticStyle.h2}">${escapeHtml(section.title)}</h2>
        <p style="${staticStyle.paragraph}">${escapeHtml(section.text)}</p>
        ${bullets}
      </section>`;
    })
    .join("");

const renderFaq = (faq = []) => {
  if (!faq.length) return "";
  return `<section style="${staticStyle.section}">
    <h2 style="${staticStyle.h2}">Dúvidas frequentes</h2>
    ${faq
      .map(
        (item) => `<article style="padding:22px 0;border-top:1px solid #27272a;">
          <h3 style="font-size:19px;line-height:1.35;margin:0;">${escapeHtml(item.question)}</h3>
          <p style="${staticStyle.paragraph}">${escapeHtml(item.answer)}</p>
        </article>`,
      )
      .join("")}
  </section>`;
};

const renderRelated = (related = []) => {
  if (!related.length) return "";
  return `<section style="${staticStyle.section}">
    <h2 style="${staticStyle.h2}">Continue explorando</h2>
    <div style="${staticStyle.related}">
      ${related
        .map(
          (link) =>
            `<a href="${escapeHtml(link.href)}" style="${staticStyle.relatedItem}">${escapeHtml(link.label)}</a>`,
        )
        .join("")}
    </div>
  </section>`;
};

const readArticleBody = async (entry) =>
  readFile(
    path.resolve("src/content/articles", entry.bodyFile),
    "utf8",
  );

const renderArticleBody = (body) =>
  renderToStaticMarkup(
    React.createElement(
      ReactMarkdown,
      {
        remarkPlugins: [remarkGfm],
        components: {
          h2: ({ children }) =>
            React.createElement("h2", { style: markdownStyle.h2 }, children),
          h3: ({ children }) =>
            React.createElement(
              "h3",
              { style: markdownStyle.h3 },
              children,
            ),
          p: ({ children }) =>
            React.createElement(
              "p",
              { style: markdownStyle.paragraph },
              children,
            ),
          ul: ({ children }) =>
            React.createElement("ul", { style: markdownStyle.list }, children),
          ol: ({ children }) =>
            React.createElement("ol", { style: markdownStyle.list }, children),
          li: ({ children }) =>
            React.createElement("li", { style: markdownStyle.item }, children),
          a: ({ children, href }) =>
            React.createElement(
              "a",
              {
                href,
                style: markdownStyle.link,
              },
              children,
            ),
          strong: ({ children }) =>
            React.createElement(
              "strong",
              { style: markdownStyle.strong },
              children,
            ),
        },
      },
      body.replace(/^# .+\r?\n+/u, ""),
    ),
  );

const renderBlogCards = () =>
  `<section style="${staticStyle.section}">
    <h2 style="${staticStyle.h2}">Edições em destaque</h2>
    <div style="${staticStyle.related}">
      ${publicContent.articles
        .map(
          (article) =>
            `<article style="border:1px solid #3f3f46;border-radius:8px;padding:20px;">
              <p style="${staticStyle.eyebrow}">${escapeHtml(article.category)}</p>
              <h3 style="font-size:22px;line-height:1.2;margin:12px 0;">${escapeHtml(article.title)}</h3>
              <p style="font-size:15px;line-height:1.6;color:#d4d4d8;">${escapeHtml(article.excerpt)}</p>
              <a href="${article.route}" style="color:#fff;">Ler edição</a>
            </article>`,
        )
        .join("")}
    </div>
  </section>`;

const renderUpdates = () =>
  `<section style="${staticStyle.section}">
    <h2 style="${staticStyle.h2}">Estado atual do produto</h2>
    ${publicContent.updates
      .map(
        (update) =>
          `<article style="padding:24px 0;border-top:1px solid #27272a;">
            <p style="${staticStyle.eyebrow}">${escapeHtml(update.status)} · ${escapeHtml(update.date)}</p>
            <h3 style="font-size:24px;line-height:1.2;margin:12px 0 0;">${escapeHtml(update.title)}</h3>
            <p style="${staticStyle.paragraph}">${escapeHtml(update.text)}</p>
          </article>`,
      )
      .join("")}
  </section>`;

export async function renderPublicStaticShell(entry) {
  const isArticle = entry.kind === "article";
  const articleBody = isArticle
    ? await renderArticleBody(await readArticleBody(entry))
    : "";
  const pageExtras =
    entry.kind === "blog"
      ? renderBlogCards()
      : entry.kind === "updates"
        ? renderUpdates()
        : "";

  return `<main id="static-public-shell" style="${staticStyle.page}">
    <div style="${staticStyle.container}">
      <nav aria-label="Páginas públicas" style="${staticStyle.nav}">${renderNavigation()}</nav>
      <header style="padding:24px 0 48px;">
        <p style="${staticStyle.eyebrow}">${escapeHtml(entry.eyebrow)} · ${escapeHtml(entry.status || "Disponível")}</p>
        <h1 style="${staticStyle.h1}">${escapeHtml(entry.heading)}</h1>
        <p style="${staticStyle.lead}">${escapeHtml(entry.lead)}</p>
        ${renderHighlights(entry.highlights)}
      </header>
      ${
        isArticle
          ? `<article style="${staticStyle.section}">${articleBody}</article>`
          : `${pageExtras}${renderSections(entry.sections)}${renderFaq(entry.faq)}`
      }
      ${renderRelated(entry.related)}
      <section style="${staticStyle.section}">
        <h2 style="${staticStyle.h2}">Conheça a NeuroNex</h2>
        <p style="${staticStyle.paragraph}">Crie uma conta ou instale a NeuroNex no Windows para começar a organizar sua rotina.</p>
        <div style="${staticStyle.related}">
          <a href="/create-account" style="${staticStyle.relatedItem}">Começar grátis</a>
          <a href="/download" style="${staticStyle.relatedItem}">Baixar para Windows</a>
        </div>
      </section>
    </div>
  </main>`;
}

export function renderPublicSitemap(entries = publicPages) {
  const urls = entries
    .map((entry) => {
      const lastModified = entry.modifiedAt || PUBLIC_LAST_MODIFIED;
      return `  <url>\n    <loc>${escapeHtml(absolutePublicUrl(entry.route))}</loc>\n    <lastmod>${escapeHtml(lastModified.slice(0, 10))}</lastmod>\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function replaceMeta(html, attribute, key, content) {
  const expression = new RegExp(`<meta\\s+${attribute}="${key}"[^>]*>`, "i");
  const replacement = `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />`;
  return expression.test(html)
    ? html.replace(expression, replacement)
    : html.replace("</head>", `  ${replacement}\n</head>`);
}

const replaceRootContent = (html, shell) => {
  const emptyRoot = /<div\s+id="root"\s*>\s*<\/div>/i;
  if (!emptyRoot.test(html)) {
    throw new Error(
      "[NeuroNex Public] O template precisa conter <div id=\"root\"></div>.",
    );
  }
  return html.replace(emptyRoot, `<div id="root">${shell}</div>`);
};

export async function buildPublicEntryHtml(template, entry) {
  const config = getPublicSeoConfig(entry.route);
  const canonical = absolutePublicUrl(entry.route);
  const image = absolutePublicUrl(entry.image || publicContent.site.defaultImage);
  const structuredData = buildPublicStructuredData(config);
  const shell = await renderPublicStaticShell(entry);
  let html = template;

  html = html.replace(
    /\s*<noscript>[\s\S]*?id="static-public-shell"[\s\S]*?<\/noscript>/iu,
    "",
  );
  html = html.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(config.title)}</title>`,
  );
  html = replaceMeta(html, "name", "title", config.title);
  html = replaceMeta(html, "name", "description", config.description);
  html = replaceMeta(html, "name", "keywords", config.keywords.join(", "));
  html = replaceMeta(
    html,
    "name",
    "robots",
    "index, follow, max-image-preview:large",
  );
  html = replaceMeta(html, "property", "og:type", config.pageType);
  html = replaceMeta(html, "property", "og:url", canonical);
  html = replaceMeta(html, "property", "og:title", config.title);
  html = replaceMeta(html, "property", "og:description", config.description);
  html = replaceMeta(html, "property", "og:image", image);
  html = replaceMeta(html, "property", "og:image:alt", config.imageAlt);
  html = replaceMeta(html, "name", "twitter:url", canonical);
  html = replaceMeta(html, "name", "twitter:title", config.title);
  html = replaceMeta(html, "name", "twitter:description", config.description);
  html = replaceMeta(html, "name", "twitter:image", image);
  html = replaceMeta(html, "name", "twitter:image:alt", config.imageAlt);
  html = html.replace(
    /<link\s+rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
  );
  html = html.replace(
    /<script id="neuronex-route-structured-data"[\s\S]*?<\/script>/i,
    `<script id="neuronex-route-structured-data" type="application/ld+json">${JSON.stringify(structuredData).replaceAll("<", "\\u003c")}</script>`,
  );
  html = replaceRootContent(html, shell);

  return html;
}

export async function generatePublicEntryPages(outputRoot = path.resolve("dist")) {
  validatePublicContentCatalog();
  const template = await readFile(path.join(outputRoot, "index.html"), "utf8");
  const targetDirectory = path.join(outputRoot, PUBLIC_ENTRY_DIRECTORY);
  await mkdir(targetDirectory, { recursive: true });

  await Promise.all(
    publicEntryPages.map(async (entry) => {
      const target = path.join(targetDirectory, entry.file);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, await buildPublicEntryHtml(template, entry), "utf8");
    }),
  );

  const home = publicContent.pages.find((page) => page.route === "/");
  if (!home) throw new Error("[NeuroNex Public] Home ausente no catálogo.");

  await writeFile(
    path.join(outputRoot, "index.html"),
    await buildPublicEntryHtml(template, home),
    "utf8",
  );
  await writeFile(
    path.join(outputRoot, "sitemap.xml"),
    renderPublicSitemap(),
    "utf8",
  );
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  await generatePublicEntryPages();
  await writeFile(path.resolve("public/sitemap.xml"), renderPublicSitemap(), "utf8");
  console.log(
    `[NeuroNex] ${publicEntryPages.length} entradas públicas e a home foram geradas.`,
  );
}
