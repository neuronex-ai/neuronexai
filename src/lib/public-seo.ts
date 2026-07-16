import publicPageCatalog from "../content/public-pages.json";

export const PUBLIC_SITE_URL = publicPageCatalog.siteUrl;

type PublicPageCatalogEntry = {
  route: string;
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
};

export type PublicSeoConfig = {
  title: string;
  description: string;
  keywords: string[];
  canonicalPath?: string;
  indexable: boolean;
  imagePath?: string;
  imageAlt: string;
  pageType?: "website" | "profile";
};

export type JsonLdNode = Record<string, unknown>;

export type PublicStructuredData = {
  "@context": "https://schema.org";
  "@graph": JsonLdNode[];
};

const DEFAULT_IMAGE = publicPageCatalog.defaultImage;
const PUBLIC_PAGES = publicPageCatalog.pages as PublicPageCatalogEntry[];

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
  "NeuroZap: automacao por WhatsApp Business, NeuroNex e Synapse AI para cobranca, no-show, lembretes e contexto operacional supervisionado.",
  "Workspace de Teleconsulta: prontuário integrado com captação incremental de áudio e transcrição via Deepgram.",
];

const organizationId = `${PUBLIC_SITE_URL}/#organization`;
const websiteId = `${PUBLIC_SITE_URL}/#website`;
const softwareId = `${PUBLIC_SITE_URL}/#software`;

const normalizePathname = (pathname: string) => {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "");
};

const pageKeywords = (page?: PublicPageCatalogEntry) =>
  [...new Set([...(page?.keywords || []), ...DEFAULT_KEYWORDS])];

export function getPublicSeoConfig(pathname: string): PublicSeoConfig {
  const normalizedPath = normalizePathname(pathname);
  const publicConfig = PUBLIC_PAGES.find(({ route }) => route === normalizedPath);

  if (publicConfig) {
    return {
      title: publicConfig.title,
      description: publicConfig.description,
      keywords: pageKeywords(publicConfig),
      canonicalPath: publicConfig.route,
      indexable: true,
      imagePath: publicConfig.image || DEFAULT_IMAGE,
      imageAlt: publicConfig.route === "/neurofinance"
        ? "Tela do NeuroFinance com conta, saldo e movimentações financeiras"
        : publicConfig.route === "/neurobox"
          ? "Tela do NeuroView com grafo clínico no NeuroBox"
          : publicConfig.route === "/neurozap-para-psicologos"
            ? "NeuroZap com WhatsApp Business, Synapse AI e aprovação humana"
            : publicConfig.route === "/teleconsulta-para-psicologos"
              ? "Teleconsulta NeuroNex com sala online e transcrição"
              : publicConfig.route === "/pacientes-para-psicologos"
                ? "Prontuário e acompanhamento de pacientes na NeuroNex"
                : "Interface da plataforma NeuroNex AI",
      pageType: "website",
    };
  }

  return {
    title: "NeuroNex AI",
    description: "Área operacional da plataforma NeuroNex.",
    keywords: DEFAULT_KEYWORDS,
    indexable: false,
    imagePath: DEFAULT_IMAGE,
    imageAlt: "Interface da plataforma NeuroNex AI",
    pageType: "website",
  };
}

export function absolutePublicUrl(path = "/") {
  return new URL(path, `${PUBLIC_SITE_URL}/`).toString();
}

const buildOrganizationNode = (): JsonLdNode => ({
  "@type": "Organization",
  "@id": organizationId,
  name: "NeuroNex AI",
  legalName: "NEURONEX AI LTDA",
  url: `${PUBLIC_SITE_URL}/`,
  logo: absolutePublicUrl("/pwa-512.png"),
  image: absolutePublicUrl(DEFAULT_IMAGE),
  slogan: "Sistema Operacional Clínico com IA e Core Banking Integrado.",
  description:
    "Plataforma brasileira de inteligência artificial e infraestrutura clínica para psicólogos, com gestão, prontuário, teleconsulta, NeuroFinance, NeuroBox, NeuroZap e Synapse AI.",
  foundingLocation: {
    "@type": "Place",
    address: {
      "@type": "PostalAddress",
      addressLocality: "São Paulo",
      addressRegion: "SP",
      addressCountry: "BR",
    },
  },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    email: "contato@neuronexai.com.br",
    telephone: "+55-47-98873-0611",
    areaServed: "BR",
    availableLanguage: ["pt-BR"],
    url: absolutePublicUrl("/contato"),
  },
});

const buildWebsiteNode = (): JsonLdNode => ({
  "@type": "WebSite",
  "@id": websiteId,
  name: "NeuroNex AI",
  alternateName: ["NeuroNex", "NeuroNex AI Brasil"],
  url: `${PUBLIC_SITE_URL}/`,
  publisher: { "@id": organizationId },
  inLanguage: "pt-BR",
  about: { "@id": softwareId },
});

const buildPlatformSoftwareNode = (): JsonLdNode => ({
  "@type": "SoftwareApplication",
  "@id": softwareId,
  name: "NeuroNex AI",
  alternateName: "Sistema Operacional Clínico NeuroNex",
  url: `${PUBLIC_SITE_URL}/`,
  applicationCategory: [
    "MedicalApplication",
    "BusinessApplication",
    "FinancialApplication",
  ],
  applicationSubCategory: "Clinical Operating System with AI and integrated core banking",
  operatingSystem: ["Web", "Windows", "iOS", "Android"],
  browserRequirements: "Requires HTML5 compatible browser.",
  softwareVersion: "2.0-beta",
  inLanguage: "pt-BR",
  countriesSupported: "BR",
  creator: { "@id": organizationId },
  provider: { "@id": organizationId },
  maintainer: { "@id": organizationId },
  audience: [
    {
      "@type": "Audience",
      audienceType: "Psicólogos",
      geographicArea: {
        "@type": "Country",
        name: "Brasil",
      },
    },
    {
      "@type": "BusinessAudience",
      audienceType: "Clínicas de psicologia",
    },
  ],
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "BRL",
    offerCount: 2,
    availability: "https://schema.org/OnlineOnly",
    url: `${PUBLIC_SITE_URL}/#waitlist`,
    offers: [
      {
        "@type": "Offer",
        name: "Plano Essential",
        category: "Subscription",
        url: `${PUBLIC_SITE_URL}/#waitlist`,
      },
      {
        "@type": "Offer",
        name: "Plano Profissional",
        category: "Subscription",
        url: `${PUBLIC_SITE_URL}/#waitlist`,
      },
    ],
  },
  featureList: PLATFORM_FEATURES,
  screenshot: [
    absolutePublicUrl("/landing/screenshots/desktop/dark/01-dashboard-command-center-dark.webp"),
    absolutePublicUrl("/landing/screenshots/desktop/dark/17-neuroview-3d-dark.webp"),
    absolutePublicUrl("/landing/screenshots/desktop/dark/nova remessa/08-neurofinance-conta-saldo-dark.webp"),
  ],
  softwareAddOn: [
    { "@id": `${PUBLIC_SITE_URL}/synapse#software` },
    { "@id": `${PUBLIC_SITE_URL}/neurofinance#financial-product` },
    { "@id": `${PUBLIC_SITE_URL}/neurobox#software` },
    { "@id": `${PUBLIC_SITE_URL}/neurozap-para-psicologos#software` },
  ],
  isAccessibleForFree: false,
});

const buildBreadcrumbNode = (url: string, config: PublicSeoConfig): JsonLdNode => ({
  "@type": "BreadcrumbList",
  "@id": `${url}#breadcrumb`,
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "NeuroNex AI",
      item: `${PUBLIC_SITE_URL}/`,
    },
    ...(config.canonicalPath === "/"
      ? []
      : [
          {
            "@type": "ListItem",
            position: 2,
            name: config.title,
            item: url,
          },
        ]),
  ],
});

const buildWebPageNode = (config: PublicSeoConfig, url: string, image: string): JsonLdNode => ({
  "@type": config.pageType === "profile" ? "ProfilePage" : "WebPage",
  "@id": `${url}#webpage`,
  url,
  name: config.title,
  headline: config.title,
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
});

const buildNeuroFinanceNodes = (): JsonLdNode[] => [
  {
    "@type": "FinancialProduct",
    "@id": `${PUBLIC_SITE_URL}/neurofinance#financial-product`,
    name: "NeuroFinance por NeuroNex",
    url: absolutePublicUrl("/neurofinance"),
    category: "Core banking e gestão financeira para psicólogos",
    description:
      "Infraestrutura financeira integrada ao consultório de psicologia para conta digital, Área Pix, cobranças, boletos, pagamentos, saques, conciliação, NFS-e/RPS, antecipação de recebíveis e capital de giro preditivo pela Synapse AI.",
    provider: { "@id": organizationId },
    feesAndCommissionsSpecification: absolutePublicUrl("/termos-de-uso"),
    termsOfService: absolutePublicUrl("/termos-de-uso"),
    areaServed: {
      "@type": "Country",
      name: "Brasil",
    },
    audience: {
      "@type": "Audience",
      audienceType: "Psicólogos e clínicas de psicologia",
    },
    isRelatedTo: { "@id": softwareId },
  },
  {
    "@type": "Service",
    "@id": `${PUBLIC_SITE_URL}/neurofinance#service`,
    name: "Gestão financeira e automação de fluxo de caixa para clínicas",
    serviceType: "Financial management software with integrated payment operations",
    provider: { "@id": organizationId },
    areaServed: "BR",
    description:
      "Serviço digital para organizar receitas, despesas, Pix, boletos, NFS-e/RPS, antecipação, conciliação e decisões de capital de giro dentro da NeuroNex.",
  },
];

const buildSynapseNodes = (): JsonLdNode[] => [
  {
    "@type": "SoftwareApplication",
    "@id": `${PUBLIC_SITE_URL}/synapse#software`,
    name: "Synapse AI",
    url: absolutePublicUrl("/synapse"),
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Agente operacional por voz e texto para psicólogos",
    operatingSystem: ["Web", "Windows", "iOS", "Android"],
    creator: { "@id": organizationId },
    provider: { "@id": organizationId },
    isPartOf: { "@id": softwareId },
    description:
      "Agente operacional da NeuroNex com voz, texto, WhatsApp, RAG clínico, permissões, confirmação por PIN ou validação de voz assistida e trilha de auditoria.",
    featureList: [
      "Comandos por voz e texto",
      "Contexto clínico e financeiro autorizado",
      "Confirmação assistida para ações sensíveis",
      "Integração com NeuroZap, NeuroBox e NeuroFinance",
    ],
  },
];

const buildNeuroBoxNodes = (): JsonLdNode[] => [
  {
    "@type": "SoftwareApplication",
    "@id": `${PUBLIC_SITE_URL}/neurobox#software`,
    name: "NeuroBox",
    url: absolutePublicUrl("/neurobox"),
    applicationCategory: ["MedicalApplication", "BusinessApplication"],
    applicationSubCategory: "Clinical AI toolkit for psychologists",
    operatingSystem: ["Web", "Windows", "iOS", "Android"],
    creator: { "@id": organizationId },
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
    screenshot: [
      absolutePublicUrl("/landing/screenshots/desktop/dark/17-neuroview-3d-dark.webp"),
      absolutePublicUrl("/landing/screenshots/desktop/light/18-neuropulse-sintetizando-white.webp"),
      absolutePublicUrl("/landing/screenshots/desktop/dark/19-neuroflow--fluxo-aberto-e-conexoes-relevantes-dark.webp"),
    ],
    softwareAddOn: [
      {
        "@type": "SoftwareApplication",
        name: "NeuroView",
        applicationSubCategory: "Clinical graph visualization",
      },
      {
        "@type": "SoftwareApplication",
        name: "NeuroPulse",
        applicationSubCategory: "Mermaid clinical diagram generation",
      },
      {
        "@type": "SoftwareApplication",
        name: "NeuroFlow",
        applicationSubCategory: "Clinical and operational flow canvas",
      },
      {
        "@type": "SoftwareApplication",
        name: "NeuroScan",
        applicationSubCategory: "Clinical intake extraction and structuring",
      },
    ],
  },
];

const buildNeuroZapNodes = (): JsonLdNode[] => [
  {
    "@type": "SoftwareApplication",
    "@id": `${PUBLIC_SITE_URL}/neurozap-para-psicologos#software`,
    name: "NeuroZap",
    url: absolutePublicUrl("/neurozap-para-psicologos"),
    applicationCategory: ["BusinessApplication", "MedicalApplication"],
    applicationSubCategory: "WhatsApp Business automation for psychology clinics",
    operatingSystem: ["Web", "Windows"],
    creator: { "@id": organizationId },
    provider: { "@id": organizationId },
    isPartOf: { "@id": softwareId },
    description:
      "NeuroZap conecta WhatsApp Business, NeuroNex, Synapse AI e NeuroFinance para cobrancas, lembretes, no-show e follow-up com contexto operacional, aprovacao humana e trilha de auditoria.",
    featureList: [
      "Rascunhos de cobranca com contexto financeiro",
      "Lembretes e no-show supervisionados",
      "Aprovacao humana antes do envio",
      "Integração com Synapse AI e NeuroFinance",
      "Travas por plano, permissao e auditoria",
    ],
  },
  {
    "@type": "Service",
    "@id": `${PUBLIC_SITE_URL}/neurozap-para-psicologos#service`,
    name: "Automacao de WhatsApp Business para clinicas de psicologia",
    serviceType: "Operational communication automation",
    provider: { "@id": organizationId },
    areaServed: "BR",
    description:
      "Servico da NeuroNex para preparar mensagens de cobranca, lembrete, reagendamento e follow-up com Synapse AI e aprovacao do profissional.",
  },
];

const buildTeleconsultaNodes = (): JsonLdNode[] => [
  {
    "@type": "SoftwareApplication",
    "@id": `${PUBLIC_SITE_URL}/teleconsulta-para-psicologos#software`,
    name: "Teleconsulta NeuroNex",
    url: absolutePublicUrl("/teleconsulta-para-psicologos"),
    applicationCategory: "MedicalApplication",
    applicationSubCategory: "Telehealth workspace for psychologists",
    operatingSystem: ["Web", "iOS", "Android"],
    creator: { "@id": organizationId },
    provider: { "@id": organizationId },
    isPartOf: { "@id": softwareId },
    description:
      "Workspace de teleconsulta para psicologos com agenda, pre-sala, video, prontuario, transcricao incremental via Deepgram e apoio do Synapse AI.",
    featureList: [
      "Sala online vinculada a agenda e paciente",
      "Transcricao incremental via Deepgram",
      "Resumo e proximos passos revisaveis pelo psicologo",
      "Estados de sala vazia, carregamento, erro e limite de plano",
    ],
  },
];

const buildPatientOperationsNodes = (): JsonLdNode[] => [
  {
    "@type": "SoftwareApplication",
    "@id": `${PUBLIC_SITE_URL}/pacientes-para-psicologos#software`,
    name: "Pacientes NeuroNex",
    url: absolutePublicUrl("/pacientes-para-psicologos"),
    applicationCategory: "MedicalApplication",
    applicationSubCategory: "Patient operations and clinical record workspace",
    operatingSystem: ["Web", "iOS", "Android"],
    creator: { "@id": organizationId },
    provider: { "@id": organizationId },
    isPartOf: { "@id": softwareId },
    description:
      "Superficie de pacientes da NeuroNex com cadastro, prontuario vivo, Portal do Paciente, diario, humor, documentos, NeuroScan, NeuroView e Synapse AI.",
    featureList: [
      "Cadastro e prontuario conectados",
      "Portal do Paciente separado da area profissional",
      "Diario, humor e continuidade entre sessoes",
      "NeuroScan, NeuroView, NeuroPulse e Synapse AI",
      "Permissoes, estados vazios, carregamento, erro e travas por plano",
    ],
  },
];

const buildPageSpecificNodes = (canonicalPath: string): JsonLdNode[] => {
  if (canonicalPath === "/neurofinance") return buildNeuroFinanceNodes();
  if (canonicalPath === "/synapse") return buildSynapseNodes();
  if (canonicalPath === "/neurobox") return buildNeuroBoxNodes();
  if (canonicalPath === "/neurozap-para-psicologos") return buildNeuroZapNodes();
  if (canonicalPath === "/teleconsulta-para-psicologos") return buildTeleconsultaNodes();
  if (canonicalPath === "/pacientes-para-psicologos") return buildPatientOperationsNodes();
  return [];
};

export function buildPublicStructuredData(config: PublicSeoConfig): PublicStructuredData | null {
  if (!config.indexable || !config.canonicalPath) return null;

  const url = absolutePublicUrl(config.canonicalPath);
  const image = absolutePublicUrl(config.imagePath || DEFAULT_IMAGE);
  const graph = [
    buildOrganizationNode(),
    buildWebsiteNode(),
    buildPlatformSoftwareNode(),
    buildWebPageNode(config, url, image),
    buildBreadcrumbNode(url, config),
    ...buildPageSpecificNodes(config.canonicalPath),
  ];

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}
