import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import publicPageCatalog from "../src/content/public-pages.json" with { type: "json" };

export const PUBLIC_SITE_URL = publicPageCatalog.siteUrl;
export const PUBLIC_ENTRY_DIRECTORY = "public-pages";
export const publicPages = publicPageCatalog.pages;
export const publicEntryPages = publicPages.filter((page) => page.file);
export const PUBLIC_LAST_MODIFIED = publicPageCatalog.lastModified;

const DEFAULT_IMAGE = publicPageCatalog.defaultImage;
const DEFAULT_KEYWORDS = [
  "sistema para psicólogos",
  "software para psicólogos",
  "sistema operacional clínico com IA",
  "plataforma de IA com core banking para psicólogos",
  "prontuário psicológico com IA",
  "gestão financeira para clínicas de psicologia",
];

const PLATFORM_FEATURES = [
  "Synapse AI: agente operacional por voz, texto e WhatsApp para comandos clínicos, administrativos e financeiros com confirmação assistida.",
  "NeuroFinance: core banking integrado com conta digital, Área Pix, cobranças, boletos, antecipação de recebíveis, conciliação e NFS-e/RPS.",
  "NeuroView: mapeamento de sintomas, eventos e evolução clínica do paciente em grafos 2D e 3D Universe.",
  "NeuroPulse: tradução de texto clínico em diagramas Mermaid baseados em abordagens como TCC, Psicanálise e formulação de caso.",
  "NeuroFlow: canvas para fluxos clínicos, operacionais e financeiros conectados ao prontuário e ao RAG do Synapse.",
  "NeuroZap: automação por WhatsApp Business, NeuroNex e Synapse AI para cobrança, no-show, lembretes e contexto operacional supervisionado.",
  "Workspace de Teleconsulta: prontuário integrado com captação incremental de áudio, transcrição autorizada e revisão profissional sob responsabilidade da NeuroNex.",
];

const organizationId = `${PUBLIC_SITE_URL}/#organization`;
const websiteId = `${PUBLIC_SITE_URL}/#website`;
const softwareId = `${PUBLIC_SITE_URL}/#software`;

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const absoluteUrl = (resourcePath) =>
  new URL(resourcePath, `${PUBLIC_SITE_URL}/`).toString();

export function renderPublicSitemap(pages = publicPages) {
  const urls = pages
    .map(
      (page) => `  <url>\n    <loc>${escapeHtml(absoluteUrl(page.route))}</loc>\n    <lastmod>${escapeHtml(PUBLIC_LAST_MODIFIED)}</lastmod>\n  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

const publicNavigation = [
  ["Início", "/"],
  ["Synapse", "/synapse"],
  ["NeuroFinance", "/neurofinance"],
  ["NeuroBox", "/neurobox"],
  ["NeuroZap", "/neurozap-para-psicologos"],
  ["Teleconsulta", "/teleconsulta-para-psicologos"],
  ["Pacientes", "/pacientes-para-psicologos"],
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
  const image = absoluteUrl(page.image || DEFAULT_IMAGE);
  const keywords = [...new Set([...(page.keywords || []), ...DEFAULT_KEYWORDS])];
  const graph = [
    {
      "@type": "Organization",
      "@id": organizationId,
      name: "NeuroNex AI",
      legalName: "NEURONEX AI LTDA",
      url: `${PUBLIC_SITE_URL}/`,
      logo: absoluteUrl("/pwa-512.png"),
      image: absoluteUrl(DEFAULT_IMAGE),
      slogan: "Sistema Operacional Clínico com IA e Core Banking Integrado.",
      description:
        "Plataforma brasileira de inteligência artificial e infraestrutura clínica para psicólogos, com gestão, prontuário, teleconsulta, NeuroFinance, NeuroBox, NeuroZap e Synapse AI.",
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer service",
        email: "contato@neuronexai.com.br",
        telephone: "+55-47-98873-0611",
        areaServed: "BR",
        availableLanguage: ["pt-BR"],
        url: absoluteUrl("/contato"),
      },
    },
    {
      "@type": "WebSite",
      "@id": websiteId,
      name: "NeuroNex AI",
      url: `${PUBLIC_SITE_URL}/`,
      publisher: { "@id": organizationId },
      inLanguage: "pt-BR",
      about: { "@id": softwareId },
    },
    {
      "@type": "SoftwareApplication",
      "@id": softwareId,
      name: "NeuroNex AI",
      alternateName: "Sistema Operacional Clínico NeuroNex",
      url: `${PUBLIC_SITE_URL}/`,
      applicationCategory: ["MedicalApplication", "BusinessApplication", "FinancialApplication"],
      applicationSubCategory: "Clinical Operating System with AI and integrated core banking",
      operatingSystem: ["Web", "Windows", "iOS", "Android"],
      browserRequirements: "Requires HTML5 compatible browser.",
      softwareVersion: "2.0-beta",
      inLanguage: "pt-BR",
      countriesSupported: "BR",
      creator: { "@id": organizationId },
      provider: { "@id": organizationId },
      audience: {
        "@type": "Audience",
        audienceType: "Psicólogos e clínicas de psicologia",
        geographicArea: { "@type": "Country", name: "Brasil" },
      },
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "BRL",
        offerCount: 2,
        availability: "https://schema.org/OnlineOnly",
        url: `${PUBLIC_SITE_URL}/#waitlist`,
        offers: [
          { "@type": "Offer", name: "Plano Essential", category: "Subscription", url: `${PUBLIC_SITE_URL}/#waitlist` },
          { "@type": "Offer", name: "Plano Profissional", category: "Subscription", url: `${PUBLIC_SITE_URL}/#waitlist` },
        ],
      },
      featureList: PLATFORM_FEATURES,
      screenshot: [
        absoluteUrl("/landing/screenshots/desktop/dark/01-dashboard-command-center-dark.webp"),
        absoluteUrl("/landing/screenshots/desktop/dark/17-neuroview-3d-dark.webp"),
        absoluteUrl("/landing/screenshots/desktop/dark/nova remessa/08-neurofinance-conta-saldo-dark.webp"),
      ],
      softwareAddOn: [
        { "@id": `${PUBLIC_SITE_URL}/synapse#software` },
        { "@id": `${PUBLIC_SITE_URL}/neurofinance#financial-product` },
        { "@id": `${PUBLIC_SITE_URL}/neurobox#software` },
        { "@id": `${PUBLIC_SITE_URL}/neurozap-para-psicologos#software` },
      ],
    },
    {
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: page.title,
      headline: page.title,
      description: page.description,
      keywords,
      inLanguage: "pt-BR",
      isPartOf: { "@id": websiteId },
      publisher: { "@id": organizationId },
      about: [{ "@id": softwareId }],
      primaryImageOfPage: {
        "@type": "ImageObject",
        url: image,
        caption: "Interface da plataforma NeuroNex AI",
      },
    },
  ];

  if (page.route === "/neurofinance") {
    graph.push({
      "@type": "FinancialProduct",
      "@id": `${PUBLIC_SITE_URL}/neurofinance#financial-product`,
      name: "NeuroFinance por NeuroNex",
      url,
      category: "Core banking e gestão financeira para psicólogos",
      description:
        "Infraestrutura financeira integrada ao consultório de psicologia para conta digital, Área Pix, cobranças, boletos, pagamentos, saques, conciliação, NFS-e/RPS, antecipação de recebíveis e capital de giro preditivo pela Synapse AI.",
      provider: { "@id": organizationId },
      feesAndCommissionsSpecification: absoluteUrl("/termos-de-uso"),
      termsOfService: absoluteUrl("/termos-de-uso"),
      areaServed: { "@type": "Country", name: "Brasil" },
      isRelatedTo: { "@id": softwareId },
    });
  }

  if (page.route === "/synapse") {
    graph.push({
      "@type": "SoftwareApplication",
      "@id": `${PUBLIC_SITE_URL}/synapse#software`,
      name: "Synapse AI",
      url,
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Agente operacional por voz e texto para psicólogos",
      operatingSystem: ["Web", "Windows", "iOS", "Android"],
      provider: { "@id": organizationId },
      isPartOf: { "@id": softwareId },
      description:
        "Agente operacional da NeuroNex com voz, texto, WhatsApp, RAG clínico, permissões, confirmação por PIN ou validação de voz assistida e trilha de auditoria.",
    });
  }

  if (page.route === "/neurobox") {
    graph.push({
      "@type": "SoftwareApplication",
      "@id": `${PUBLIC_SITE_URL}/neurobox#software`,
      name: "NeuroBox",
      url,
      applicationCategory: ["MedicalApplication", "BusinessApplication"],
      applicationSubCategory: "Clinical AI toolkit for psychologists",
      operatingSystem: ["Web", "Windows", "iOS", "Android"],
      provider: { "@id": organizationId },
      isPartOf: { "@id": softwareId },
      description:
        "Conjunto de ferramentas de IA profunda da NeuroNex com NeuroView, NeuroFlow, NeuroPulse, NeuroScan, NeuroFinance e intermediação em tempo real pelo Synapse.",
      featureList: [
        "NeuroView: grafos clínicos 2D e 3D Universe",
        "NeuroPulse: diagramas Mermaid para formulação clínica",
        "NeuroFlow: canvas de fluxos clínicos e operacionais",
        "NeuroScan: estruturação assistida de fichas de anamnese",
        "Synapse: agente de voz e texto com agência assistida",
      ],
    });
  }

  if (page.route === "/neurozap-para-psicologos") {
    graph.push({
      "@type": "SoftwareApplication",
      "@id": `${PUBLIC_SITE_URL}/neurozap-para-psicologos#software`,
      name: "NeuroZap",
      url,
      applicationCategory: ["BusinessApplication", "MedicalApplication"],
      applicationSubCategory: "WhatsApp Business automation for psychology clinics",
      operatingSystem: ["Web", "Windows"],
      provider: { "@id": organizationId },
      isPartOf: { "@id": softwareId },
      description:
        "NeuroZap conecta WhatsApp Business, NeuroNex, Synapse AI e NeuroFinance para cobranças, lembretes, no-show e follow-up com contexto operacional, aprovação humana e trilha de auditoria.",
      featureList: [
        "Rascunhos de cobrança com contexto financeiro",
        "Lembretes e no-show supervisionados",
        "Aprovacao humana antes do envio",
        "Integração com Synapse AI e NeuroFinance",
        "Travas por plano, permissão e auditoria",
      ],
    });
  }

  if (page.route === "/teleconsulta-para-psicologos") {
    graph.push({
      "@type": "SoftwareApplication",
      "@id": `${PUBLIC_SITE_URL}/teleconsulta-para-psicologos#software`,
      name: "Teleconsulta NeuroNex",
      url,
      applicationCategory: "MedicalApplication",
      applicationSubCategory: "Telehealth workspace for psychologists",
      operatingSystem: ["Web", "iOS", "Android"],
      provider: { "@id": organizationId },
      isPartOf: { "@id": softwareId },
      description:
        "Workspace de teleconsulta para psicólogos com agenda, pré-sala, vídeo, prontuário, transcrição incremental autorizada e apoio do Synapse AI sob responsabilidade da NeuroNex.",
      featureList: [
        "Sala online vinculada a agenda e paciente",
        "Transcrição incremental autorizada",
        "Resumo e próximos passos revisáveis pelo psicólogo",
        "Estados de sala vazia, carregamento, erro e limite de plano",
      ],
    });
  }

  if (page.route === "/pacientes-para-psicologos") {
    graph.push({
      "@type": "SoftwareApplication",
      "@id": `${PUBLIC_SITE_URL}/pacientes-para-psicologos#software`,
      name: "Pacientes NeuroNex",
      url,
      applicationCategory: "MedicalApplication",
      applicationSubCategory: "Patient operations and clinical record workspace",
      operatingSystem: ["Web", "iOS", "Android"],
      provider: { "@id": organizationId },
      isPartOf: { "@id": softwareId },
      description:
        "Superfície de pacientes da NeuroNex com cadastro, prontuário vivo, Portal do Paciente, diário, humor, documentos, NeuroScan, NeuroView e Synapse AI.",
      featureList: [
        "Cadastro e prontuário conectados",
        "Portal do Paciente separado da área profissional",
        "Diário, humor e continuidade entre sessões",
        "NeuroScan, NeuroView, NeuroPulse e Synapse AI",
        "Permissoes, estados vazios, carregamento, erro e travas por plano",
      ],
    });
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
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
  html = replaceMeta(
    html,
    "name",
    "keywords",
    [...new Set([...(page.keywords || []), ...DEFAULT_KEYWORDS])].join(", "),
  );
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

  await writeFile(path.join(outputRoot, "sitemap.xml"), renderPublicSitemap(), "utf8");
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  await generatePublicEntryPages();
  await writeFile(path.resolve("public/sitemap.xml"), renderPublicSitemap(), "utf8");
  console.log(`[NeuroNex] ${publicEntryPages.length} public entry pages generated.`);
}
