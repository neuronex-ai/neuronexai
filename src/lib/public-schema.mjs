import publicContent from "../content/public-content.json" with { type: "json" };
import {
  COMPARISON_PUBLIC_ENTRIES,
  COMPARISON_PUBLIC_PAGES,
} from "../content/comparison-content.ts";

export const PUBLIC_SITE_URL = publicContent.site.url;

const DEFAULT_KEYWORDS = [
  "sistema para psicólogos",
  "software para psicólogos",
  "sistema operacional para consultórios de psicologia",
  "agenda prontuário e financeiro integrados",
  "inteligência artificial para psicólogos com controle humano",
  "gestão de consultório de psicologia",
];

const PUBLIC_STATUS = new Set(["Disponível", "Beta", "Em evolução"]);
const FORBIDDEN_PUBLIC_PROVIDER_PATTERN =
  /\b(?:Deepgram|Evolution\s+API|Jitsi|JaaS)\b/iu;

const organizationId = `${PUBLIC_SITE_URL}/#organization`;
const websiteId = `${PUBLIC_SITE_URL}/#website`;
const softwareId = `${PUBLIC_SITE_URL}/#software`;

export function normalizePublicPath(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/u, "");
}

export function absolutePublicUrl(path = "/") {
  return new globalThis.URL(path, `${PUBLIC_SITE_URL}/`).toString();
}

const pageByRoute = new Map(
  publicContent.pages.map((page) => [normalizePublicPath(page.route), page]),
);
const publicArticles = publicContent.articles.filter(
  ({ publicationStatus }) => publicationStatus !== "draft",
);
const articleByRoute = new Map(
  publicArticles.map((article) => [
    normalizePublicPath(article.route),
    article,
  ]),
);
const comparisonByRoute = new Map(
  COMPARISON_PUBLIC_PAGES.map((comparison) => [
    normalizePublicPath(comparison.route),
    comparison,
  ]),
);

const uniqueKeywords = (keywords = []) =>
  [...new Set([...keywords, ...DEFAULT_KEYWORDS])];

export function validatePublicContentCatalog() {
  const routes = new Set();
  const files = new Set();
  const errors = [];

  for (const page of publicContent.pages) {
    if (routes.has(page.route)) errors.push(`Rota pública duplicada: ${page.route}`);
    routes.add(page.route);

    if (page.file) {
      if (files.has(page.file)) errors.push(`Arquivo público duplicado: ${page.file}`);
      files.add(page.file);
    }

    if (!page.route.startsWith("/")) errors.push(`Rota inválida: ${page.route}`);
    if (!page.title.trim()) errors.push(`Title ausente em ${page.route}`);
    if (!page.heading.trim()) errors.push(`H1 ausente em ${page.route}`);
    if (!page.description.trim()) errors.push(`Description ausente em ${page.route}`);
    if (!page.modifiedAt) errors.push(`modifiedAt ausente em ${page.route}`);
    if (!PUBLIC_STATUS.has(page.status)) {
      errors.push(`Status público inválido em ${page.route}: ${page.status}`);
    }

    const visibleCopy = JSON.stringify({
      heading: page.heading,
      lead: page.lead,
      highlights: page.highlights,
      sections: page.sections,
      faq: page.faq,
    });
    if (
      ["/teleconsulta-para-psicologos", "/neurozap-para-psicologos"].includes(
        page.route,
      ) &&
      FORBIDDEN_PUBLIC_PROVIDER_PATTERN.test(visibleCopy)
    ) {
      errors.push(`Fornecedor interno exposto em ${page.route}`);
    }

    for (const link of page.related) {
      if (!link.href.startsWith("/") && !link.href.startsWith("https://")) {
        errors.push(`Link inválido em ${page.route}: ${link.href}`);
      }
    }
  }

  for (const comparison of COMPARISON_PUBLIC_PAGES) {
    if (routes.has(comparison.route)) {
      errors.push(`Rota pública duplicada: ${comparison.route}`);
    }
    routes.add(comparison.route);

    if (files.has(comparison.file)) {
      errors.push(`Arquivo público duplicado: ${comparison.file}`);
    }
    files.add(comparison.file);

    if (!comparison.route.startsWith("/comparar")) {
      errors.push(`Rota comparativa inválida: ${comparison.route}`);
    }
    if (!comparison.title.trim() || !comparison.heading.trim()) {
      errors.push(`Metadados comparativos incompletos em ${comparison.route}`);
    }
    if (!comparison.description.trim() || !comparison.modifiedAt) {
      errors.push(`Description ou data ausente em ${comparison.route}`);
    }
    if (comparison.reviewedAt !== "2026-07") {
      errors.push(`Revisão comparativa inválida em ${comparison.route}`);
    }
    if (!PUBLIC_STATUS.has(comparison.status)) {
      errors.push(`Status público inválido em ${comparison.route}`);
    }

    for (const link of comparison.related) {
      if (!link.href.startsWith("/") && !link.href.startsWith("https://")) {
        errors.push(`Link inválido em ${comparison.route}: ${link.href}`);
      }
    }
  }

  for (const article of publicArticles) {
    if (routes.has(article.route)) {
      errors.push(`Rota de artigo duplicada: ${article.route}`);
    }
    routes.add(article.route);

    if (files.has(article.file)) {
      errors.push(`Arquivo de artigo duplicado: ${article.file}`);
    }
    files.add(article.file);

    if (!article.route.startsWith("/blog/")) {
      errors.push(`Rota de artigo inválida: ${article.route}`);
    }
    if (!article.title.trim() || !article.description.trim()) {
      errors.push(`Metadados incompletos em ${article.route}`);
    }
    if (article.seoTitle !== undefined && !article.seoTitle.trim()) {
      errors.push(`SEO title vazio em ${article.route}`);
    }
    if (!article.publishedAt || !article.modifiedAt) {
      errors.push(`Datas editoriais ausentes em ${article.route}`);
    }
    if (!publicContent.authors.some((author) => author.id === article.authorId)) {
      errors.push(`Autor desconhecido em ${article.route}: ${article.authorId}`);
    }
  }

  if (pageByRoute.has("/sobre-nos") || articleByRoute.has("/sobre-nos")) {
    errors.push("/sobre-nos não pode ser publicada sem brief factual validado");
  }

  if (errors.length) {
    throw new Error(`[NeuroNex Public] Catálogo inválido:\n- ${errors.join("\n- ")}`);
  }

  return publicContent;
}

export function getPublicSeoConfig(pathname) {
  const route = normalizePublicPath(pathname);
  const page = pageByRoute.get(route);

  if (page) {
    return {
      route: page.route,
      title: page.title,
      description: page.description,
      keywords: uniqueKeywords(page.keywords),
      canonicalPath: page.route,
      indexable: true,
      imagePath: page.image || publicContent.site.defaultImage,
      imageAlt: page.imageAlt,
      pageType: "website",
      contentKind: page.kind,
      faq: page.faq,
      source: page,
    };
  }

  const comparison = comparisonByRoute.get(route);
  if (comparison) {
    return {
      route: comparison.route,
      title: comparison.title,
      description: comparison.description,
      keywords: uniqueKeywords(comparison.keywords),
      canonicalPath: comparison.route,
      indexable: true,
      imagePath: comparison.image || publicContent.site.defaultImage,
      imageAlt: comparison.imageAlt,
      pageType: "website",
      contentKind: "comparison",
      faq: comparison.faq,
      source: comparison,
    };
  }

  const article = articleByRoute.get(route);
  if (article) {
    return {
      route: article.route,
      title: article.seoTitle || `${article.title} | NeuroNex`,
      description: article.description,
      keywords: uniqueKeywords(article.keywords),
      canonicalPath: article.route,
      indexable: true,
      imagePath: article.image || publicContent.site.defaultImage,
      imageAlt: article.imageAlt,
      pageType: "article",
      contentKind: "article",
      faq: [],
      source: article,
    };
  }

  return {
    route,
    title: "NeuroNex AI",
    description: "Área operacional da plataforma NeuroNex.",
    keywords: DEFAULT_KEYWORDS,
    indexable: false,
    imagePath: publicContent.site.defaultImage,
    imageAlt: "Interface da plataforma NeuroNex AI",
    pageType: "website",
    contentKind: "unknown",
    faq: [],
    source: null,
  };
}

const buildOrganizationNode = () => ({
  "@type": "Organization",
  "@id": organizationId,
  name: publicContent.site.organization.name,
  legalName: publicContent.site.organization.legalName,
  url: `${PUBLIC_SITE_URL}/`,
  logo: absolutePublicUrl(publicContent.site.organization.logo),
  image: absolutePublicUrl(publicContent.site.defaultImage),
  slogan: "Seu consultório inteiro, trabalhando junto.",
  description: publicContent.site.organization.description,
  email: publicContent.site.organization.email,
  telephone: publicContent.site.organization.telephone,
  address: {
    "@type": "PostalAddress",
    ...publicContent.site.organization.address,
  },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    email: publicContent.site.organization.email,
    telephone: publicContent.site.organization.telephone,
    areaServed: "BR",
    availableLanguage: ["pt-BR"],
    url: absolutePublicUrl("/contato"),
  },
});

const buildWebsiteNode = () => ({
  "@type": "WebSite",
  "@id": websiteId,
  name: "NeuroNex AI",
  alternateName: ["NeuroNex", "NeuroNex AI Brasil"],
  url: `${PUBLIC_SITE_URL}/`,
  publisher: { "@id": organizationId },
  inLanguage: "pt-BR",
  about: { "@id": softwareId },
});

const platformFeatures = [
  "Agenda conectada ao paciente, ao atendimento, ao prontuário e ao financeiro.",
  "Synapse por voz e texto com contexto autorizado e confirmação humana.",
  "NeuroFinance com conta, Pix, pagamentos, cobranças, saques e recursos fiscais conforme elegibilidade.",
  "NeuroBox com grafos, fluxos, diagramas, anamneses e arquivos revisáveis.",
  "Teleconsulta integrada à agenda, ao paciente, ao consentimento e ao prontuário.",
  "Portal do Paciente separado da área profissional, com permissões próprias.",
];

const publicOffers = () =>
  publicContent.site.offers.map((offer) => ({
    "@type": "Offer",
    name: offer.name,
    price: offer.price,
    priceCurrency: offer.priceCurrency,
    availability: "https://schema.org/InStock",
    url: absolutePublicUrl(offer.url),
    category: "Subscription",
  }));

const buildPlatformSoftwareNode = () => ({
  "@type": ["WebApplication", "SoftwareApplication"],
  "@id": softwareId,
  name: "NeuroNex AI",
  alternateName: "Sistema operacional para consultórios de psicologia",
  url: `${PUBLIC_SITE_URL}/`,
  applicationCategory: [
    "HealthApplication",
    "BusinessApplication",
    "FinanceApplication",
  ],
  applicationSubCategory:
    "Sistema operacional que conecta a rotina clínica e administrativa de consultórios de psicologia",
  operatingSystem: ["Web", "Windows"],
  browserRequirements: "Navegador compatível com HTML5.",
  inLanguage: "pt-BR",
  countriesSupported: "BR",
  creator: { "@id": organizationId },
  provider: { "@id": organizationId },
  audience: {
    "@type": "Audience",
    audienceType: "Psicólogos e clínicas de psicologia",
    geographicArea: { "@type": "Country", name: "Brasil" },
  },
  offers: publicOffers(),
  featureList: platformFeatures,
  screenshot: [
    absolutePublicUrl(
      "/images/prints-sistema/DESKTOP/ESCURO/1. DASHBOARD/dashboard--visao-geral--primeira-dobra-clinica-financeiro--escuro--pagina--001.png",
    ),
    absolutePublicUrl(
      "/images/prints-sistema/DESKTOP/ESCURO/6. NEURODRIVE/neuroview--grafo-3d--rede-completa-e-legenda--escuro--pagina--012.png",
    ),
    absolutePublicUrl(
      "/images/prints-sistema/DESKTOP/ESCURO/8. NEUROFINANCE/neurofinance--conta-e-saldo--dashboard-cartao-mascarado--escuro--pagina--001.png",
    ),
  ],
});

const breadcrumbItemsFor = (config, url) => {
  const items = [
    {
      "@type": "ListItem",
      position: 1,
      name: "NeuroNex AI",
      item: `${PUBLIC_SITE_URL}/`,
    },
  ];

  if (config.contentKind === "article") {
    items.push({
      "@type": "ListItem",
      position: 2,
      name: "NeuroX",
      item: absolutePublicUrl("/blog"),
    });
  }

  if (
    config.contentKind === "comparison" &&
    config.canonicalPath !== "/comparar"
  ) {
    items.push({
      "@type": "ListItem",
      position: 2,
      name: "Comparar sistemas",
      item: absolutePublicUrl("/comparar"),
    });
  }

  if (config.canonicalPath !== "/") {
    items.push({
      "@type": "ListItem",
      position: items.length + 1,
      name: config.source.heading || config.source.title,
      item: url,
    });
  }

  return items;
};

const buildBreadcrumbNode = (config, url) => ({
  "@type": "BreadcrumbList",
  "@id": `${url}#breadcrumb`,
  itemListElement: breadcrumbItemsFor(config, url),
});

const buildWebPageNode = (config, url, image) => ({
  "@type":
    config.contentKind === "blog" ||
    config.contentKind === "updates" ||
    (config.contentKind === "comparison" && config.canonicalPath === "/comparar")
      ? "CollectionPage"
      : "WebPage",
  "@id": `${url}#webpage`,
  url,
  name: config.title,
  headline: config.source.heading || config.source.title,
  description: config.description,
  keywords: config.keywords,
  inLanguage: "pt-BR",
  isPartOf: { "@id": websiteId },
  publisher: { "@id": organizationId },
  about: [{ "@id": softwareId }],
  primaryImageOfPage: {
    "@type": "ImageObject",
    url: image,
    caption: config.imageAlt,
  },
  breadcrumb: { "@id": `${url}#breadcrumb` },
  dateModified: config.source.modifiedAt,
});

const pageApplicationName = new Map([
  ["/synapse", "Synapse AI"],
  ["/neurobox", "NeuroBox"],
  ["/neurozap-para-psicologos", "NeuroZap"],
  ["/teleconsulta-para-psicologos", "Teleconsulta NeuroNex"],
  ["/pacientes-para-psicologos", "Pacientes NeuroNex"],
  ["/portal-do-paciente", "Portal do Paciente NeuroNex"],
  ["/prontuario-para-psicologos", "Prontuário Vivo NeuroNex"],
  ["/agenda-para-psicologos", "Agenda NeuroNex"],
  ["/gestao-financeira-para-psicologos", "Gestão Financeira NeuroNex"],
]);

const buildProductNode = (config, url) => ({
  "@type": ["WebApplication", "SoftwareApplication"],
  "@id": `${url}#software`,
  name: pageApplicationName.get(config.canonicalPath) || config.source.eyebrow,
  url,
  applicationCategory:
    config.contentKind === "financial"
      ? "FinanceApplication"
      : config.canonicalPath === "/neurozap-para-psicologos"
        ? "CommunicationApplication"
        : "HealthApplication",
  operatingSystem: ["Web", "Windows"],
  provider: { "@id": organizationId },
  isPartOf: { "@id": softwareId },
  description: config.description,
  featureList: [
    ...config.source.highlights,
    ...config.source.sections.map((section) => section.title),
  ],
  screenshot: absolutePublicUrl(config.imagePath),
  offers: publicOffers(),
});

const buildFinanceNodes = (config, url) => [
  {
    "@type": "FinancialProduct",
    "@id": `${url}#financial-product`,
    name: "NeuroFinance por NeuroNex",
    url,
    category: "Infraestrutura financeira integrada para psicólogos",
    description: config.description,
    provider: { "@id": organizationId },
    feesAndCommissionsSpecification: absolutePublicUrl("/termos-de-uso"),
    termsOfService: absolutePublicUrl("/termos-de-uso"),
    areaServed: { "@type": "Country", name: "Brasil" },
    audience: {
      "@type": "Audience",
      audienceType: "Psicólogos e clínicas de psicologia",
    },
    isRelatedTo: { "@id": softwareId },
  },
  {
    "@type": "Service",
    "@id": `${url}#service`,
    name: "NeuroFinance",
    serviceType: "Conta, pagamentos e cobranças integradas à operação clínica",
    provider: { "@id": organizationId },
    areaServed: "BR",
    description: config.description,
    offers: publicOffers().filter((offer) => offer.name === "Plano Profissional"),
  },
];

const buildPricingNode = (url) => ({
  "@type": "OfferCatalog",
  "@id": `${url}#offers`,
  name: "Planos NeuroNex",
  url,
  itemListElement: publicOffers(),
});

const buildFaqNode = (config, url) => ({
  "@type": "FAQPage",
  "@id": `${url}#faq`,
  mainEntity: config.faq.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
});

const buildBlogIndexNode = (url) => ({
  "@type": "Blog",
  "@id": `${url}#blog`,
  name: "NeuroX",
  url,
  publisher: { "@id": organizationId },
  inLanguage: "pt-BR",
  blogPost: publicArticles.map((article) => ({
    "@id": `${absolutePublicUrl(article.route)}#article`,
  })),
});

const buildItemListNode = (url, items, listName) => ({
  "@type": "ItemList",
  "@id": `${url}#items`,
  name: listName,
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.heading || item.title,
    url: absolutePublicUrl(item.route || "/novidades"),
  })),
});

const buildArticleNode = (config, url, image) => {
  const article = config.source;
  const author =
    publicContent.authors.find((candidate) => candidate.id === article.authorId) ||
    publicContent.authors[0];

  return {
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    url,
    headline: article.title,
    description: article.description,
    articleSection: article.category,
    keywords: config.keywords,
    inLanguage: "pt-BR",
    datePublished: article.publishedAt,
    dateModified: article.modifiedAt,
    author: {
      "@type": author.type,
      name: author.name,
      url: absolutePublicUrl(author.url),
    },
    reviewedBy: {
      "@type": "Organization",
      name: article.reviewer,
      url: `${PUBLIC_SITE_URL}/`,
    },
    publisher: { "@id": organizationId },
    isPartOf: { "@id": `${absolutePublicUrl("/blog")}#blog` },
    mainEntityOfPage: { "@id": `${url}#webpage` },
    image: [image],
  };
};

const buildArticleWebPageNode = (config, url, image) => ({
  "@type": "WebPage",
  "@id": `${url}#webpage`,
  url,
  name: config.title,
  headline: config.source.title,
  description: config.description,
  inLanguage: "pt-BR",
  isPartOf: { "@id": websiteId },
  publisher: { "@id": organizationId },
  primaryImageOfPage: {
    "@type": "ImageObject",
    url: image,
    caption: config.imageAlt,
  },
  breadcrumb: { "@id": `${url}#breadcrumb` },
  datePublished: config.source.publishedAt,
  dateModified: config.source.modifiedAt,
});

export function buildPublicStructuredData(config) {
  if (!config.indexable || !config.canonicalPath) return null;

  const url = absolutePublicUrl(config.canonicalPath);
  const image = absolutePublicUrl(config.imagePath || publicContent.site.defaultImage);
  const graph = [];

  if (config.canonicalPath === "/") {
    graph.push(
      buildOrganizationNode(),
      buildWebsiteNode(),
      buildPlatformSoftwareNode(),
    );
  }

  if (config.contentKind === "article") {
    graph.push(
      buildArticleWebPageNode(config, url, image),
      buildBreadcrumbNode(config, url),
      buildArticleNode(config, url, image),
    );
  } else {
    graph.push(buildWebPageNode(config, url, image), buildBreadcrumbNode(config, url));

    if (
      ["product", "financial"].includes(config.contentKind) &&
      config.canonicalPath !== "/produto"
    ) {
      graph.push(buildProductNode(config, url));
    }

    if (config.contentKind === "financial") {
      graph.push(...buildFinanceNodes(config, url));
    }

    if (config.contentKind === "pricing") {
      graph.push(buildPricingNode(url));
    }

    if (config.contentKind === "blog") {
      graph.push(
        buildBlogIndexNode(url),
        buildItemListNode(url, publicArticles, "Edições NeuroX"),
      );
    }

    if (config.contentKind === "updates") {
      graph.push(
        buildItemListNode(url, publicContent.updates, "Novidades NeuroNex"),
      );
    }

    if (
      config.contentKind === "comparison" &&
      config.canonicalPath === "/comparar"
    ) {
      graph.push(
        buildItemListNode(
          url,
          COMPARISON_PUBLIC_ENTRIES,
          "Comparações de sistemas para psicólogos",
        ),
      );
    }

    if (config.faq.length) {
      graph.push(buildFaqNode(config, url));
    }
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

validatePublicContentCatalog();

export { publicContent };
