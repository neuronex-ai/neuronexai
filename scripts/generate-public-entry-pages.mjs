import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PUBLIC_SITE_URL = "https://www.neuronexai.com.br";
export const PUBLIC_ENTRY_DIRECTORY = "public-pages";

const DEFAULT_IMAGE =
  "/landing/screenshots/desktop/dark/01-dashboard-command-center-dark.webp";

export const publicEntryPages = [
  {
    route: "/synapse",
    file: "synapse.html",
    title: "Synapse AI | Assistente agêntico para psicólogos | NeuroNex",
    description:
      "Conheça o Synapse: inteligência contextual por texto, voz e WhatsApp, com ações assistidas, NeuroBox e confirmação antes de operações sensíveis.",
    eyebrow: "Synapse AI",
    heading: "Um cérebro para texto, voz e WhatsApp.",
    lead:
      "O Synapse usa o contexto permitido da clínica para localizar informações, preparar próximos passos e levar o profissional à área certa. O WhatsApp chega pelo NeuroZap, planejado para o Beta Desktop.",
    highlights: ["Modo agêntico com confirmação", "NeuroBox", "Texto, voz e WhatsApp"],
    image: "/landing/screenshots/desktop/dark/15-synapse-chat-dark.webp",
  },
  {
    route: "/neurofinance",
    file: "neurofinance.html",
    title: "NeuroFinance | Gestão financeira conectada à clínica | NeuroNex",
    description:
      "Organize receitas e despesas e, quando sua conta estiver habilitada, concentre cobranças, Pix, boletos e pagamentos no fluxo da clínica.",
    eyebrow: "NeuroFinance",
    heading: "Gestão para decidir. NeuroFinance para movimentar.",
    lead:
      "A gestão financeira organiza a operação. Os recursos transacionais ficam disponíveis conforme plano, cadastro, análise e situação da conta. Dados fiscais podem ser preparados; emissão de NFS-e e automações ainda estão em evolução.",
    highlights: ["Cobranças, Pix e boletos", "Saldo e movimentações", "Preparação fiscal transparente"],
    image:
      "/landing/screenshots/desktop/dark/nova remessa/08-neurofinance-conta-saldo-dark.webp",
  },
  {
    route: "/ajuda",
    file: "ajuda.html",
    title: "Central de Ajuda NeuroNex",
    description:
      "Orientações sobre agenda, pacientes, prontuário, teleconsulta, financeiro, Synapse e configurações da NeuroNex.",
    eyebrow: "Central de Ajuda",
    heading: "Encontre a orientação certa para cada área da NeuroNex.",
    lead:
      "Consulte respostas sobre acesso, agenda, pacientes, prontuário, teleconsulta, financeiro, Portal do Paciente, Synapse e configurações.",
    highlights: ["Dúvidas por área", "Privacidade e segurança", "Contato com a equipe"],
  },
  {
    route: "/contato",
    file: "contato.html",
    title: "Contato | NeuroNex",
    description:
      "Fale com a NeuroNex sobre suporte, planos, NeuroFinance, privacidade, LGPD e uso da plataforma.",
    eyebrow: "Contato",
    heading: "Converse com a equipe NeuroNex.",
    lead:
      "Use os canais oficiais para falar sobre suporte, planos, NeuroFinance, privacidade, LGPD ou adoção da plataforma em uma clínica.",
    highlights: ["Suporte ao produto", "Planos e clínicas", "Privacidade e LGPD"],
  },
  {
    route: "/documentos-legais",
    file: "documentos-legais.html",
    title: "Documentos legais | NeuroNex",
    description:
      "Acesse os Termos de Uso, a Política de Privacidade e as configurações de cookies da NeuroNex.",
    eyebrow: "Documentos legais",
    heading: "Regras claras para usar a NeuroNex.",
    lead:
      "Esta página reúne Termos de Uso, Política de Privacidade e informações sobre cookies em endereços públicos próprios.",
    highlights: ["Termos de Uso", "Política de Privacidade", "Configurações de cookies"],
  },
  {
    route: "/termos-de-uso",
    file: "termos-de-uso.html",
    title: "Termos de Uso | NeuroNex",
    description:
      "Consulte as condições de uso, responsabilidades, planos, integrações e serviços financeiros da plataforma NeuroNex.",
    eyebrow: "Termos de Uso",
    heading: "Condições de uso da plataforma NeuroNex.",
    lead:
      "Consulte responsabilidades, regras de conta, planos, integrações, serviços financeiros, disponibilidade e encerramento de uso.",
    highlights: ["Responsabilidades", "Planos e integrações", "Serviços financeiros"],
  },
  {
    route: "/politica-de-privacidade",
    file: "politica-de-privacidade.html",
    title: "Política de Privacidade e LGPD | NeuroNex",
    description:
      "Entenda como a NeuroNex coleta, utiliza, protege, retém e exclui dados pessoais e dados de integrações autorizadas.",
    eyebrow: "Privacidade e LGPD",
    heading: "Como a NeuroNex trata e protege dados.",
    lead:
      "Conheça as finalidades, bases de tratamento, medidas de proteção, prazos, direitos do titular e regras de integrações autorizadas.",
    highlights: ["Direitos do titular", "Proteção de dados", "Integrações autorizadas"],
  },
  {
    route: "/configuracoes-de-cookies",
    file: "configuracoes-de-cookies.html",
    title: "Configurações e Política de Cookies | NeuroNex",
    description:
      "Conheça as categorias de cookies da NeuroNex e saiba como controlar preferências funcionais, analíticas e de marketing.",
    eyebrow: "Cookies",
    heading: "Entenda e controle suas preferências de cookies.",
    lead:
      "Veja a finalidade de cookies essenciais, funcionais, analíticos e de marketing e como revisar suas escolhas.",
    highlights: ["Cookies essenciais", "Preferências funcionais", "Medição e marketing"],
  },
];

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const absoluteUrl = (resourcePath) => new URL(resourcePath, `${PUBLIC_SITE_URL}/`).toString();

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
