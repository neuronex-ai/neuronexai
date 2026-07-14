export const PUBLIC_SITE_URL = "https://www.neuronexai.com.br";

export type PublicSeoConfig = {
  title: string;
  description: string;
  canonicalPath?: string;
  indexable: boolean;
  imagePath?: string;
  pageType?: "website" | "profile";
};

const DEFAULT_IMAGE = "/landing/screenshots/desktop/dark/01-dashboard-command-center-dark.webp";

const publicRoutes: Record<string, Omit<PublicSeoConfig, "indexable">> = {
  "/": {
    title: "NeuroNex AI | Gestão, Synapse e NeuroFinance para psicólogos",
    description:
      "Plataforma para psicólogos com agenda, prontuário, teleconsulta, NeuroFinance e Synapse por texto, voz e WhatsApp.",
    canonicalPath: "/",
    imagePath: DEFAULT_IMAGE,
  },
  "/synapse": {
    title: "Synapse AI | Assistente agêntico para psicólogos | NeuroNex",
    description:
      "Conheça o Synapse: inteligência contextual por texto, voz e WhatsApp, com ações assistidas, NeuroBox e confirmação antes de operações sensíveis.",
    canonicalPath: "/synapse",
    imagePath: "/landing/screenshots/desktop/dark/15-synapse-chat-dark.webp",
  },
  "/neurofinance": {
    title: "NeuroFinance | Gestão financeira conectada à clínica | NeuroNex",
    description:
      "Organize receitas e despesas e, quando sua conta estiver habilitada, concentre cobranças, Pix, boletos e pagamentos no fluxo da clínica.",
    canonicalPath: "/neurofinance",
    imagePath: "/landing/screenshots/desktop/dark/nova remessa/08-neurofinance-conta-saldo-dark.webp",
  },
  "/ajuda": {
    title: "Central de Ajuda NeuroNex",
    description:
      "Orientações sobre agenda, pacientes, prontuário, teleconsulta, financeiro, Synapse e configurações da NeuroNex.",
    canonicalPath: "/ajuda",
  },
  "/contato": {
    title: "Contato | NeuroNex",
    description:
      "Fale com a NeuroNex sobre suporte, planos, NeuroFinance, privacidade, LGPD e uso da plataforma.",
    canonicalPath: "/contato",
  },
  "/documentos-legais": {
    title: "Documentos legais | NeuroNex",
    description:
      "Acesse os Termos de Uso, a Política de Privacidade e as configurações de cookies da NeuroNex.",
    canonicalPath: "/documentos-legais",
  },
  "/termos-de-uso": {
    title: "Termos de Uso | NeuroNex",
    description:
      "Consulte as condições de uso, responsabilidades, planos, integrações e serviços financeiros da plataforma NeuroNex.",
    canonicalPath: "/termos-de-uso",
  },
  "/politica-de-privacidade": {
    title: "Política de Privacidade e LGPD | NeuroNex",
    description:
      "Entenda como a NeuroNex coleta, utiliza, protege, retém e exclui dados pessoais e dados de integrações autorizadas.",
    canonicalPath: "/politica-de-privacidade",
  },
  "/configuracoes-de-cookies": {
    title: "Configurações e Política de Cookies | NeuroNex",
    description:
      "Conheça as categorias de cookies da NeuroNex e saiba como controlar preferências funcionais, analíticas e de marketing.",
    canonicalPath: "/configuracoes-de-cookies",
  },
};

const normalizePathname = (pathname: string) => {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "");
};

export function getPublicSeoConfig(pathname: string): PublicSeoConfig {
  const normalizedPath = normalizePathname(pathname);
  const publicConfig = publicRoutes[normalizedPath];

  if (publicConfig) {
    return {
      ...publicConfig,
      indexable: true,
      imagePath: publicConfig.imagePath || DEFAULT_IMAGE,
      pageType: "website",
    };
  }

  if (normalizedPath.startsWith("/id/")) {
    return {
      title: "Perfil profissional | NeuroNex",
      description: "Perfil público de um profissional verificado no ecossistema NeuroNex.",
      canonicalPath: normalizedPath,
      indexable: true,
      imagePath: DEFAULT_IMAGE,
      pageType: "profile",
    };
  }

  return {
    title: "NeuroNex AI",
    description: "Área operacional da plataforma NeuroNex.",
    indexable: false,
    imagePath: DEFAULT_IMAGE,
    pageType: "website",
  };
}

export function absolutePublicUrl(path = "/") {
  return new URL(path, `${PUBLIC_SITE_URL}/`).toString();
}

export function buildPublicStructuredData(config: PublicSeoConfig) {
  if (!config.indexable || !config.canonicalPath) return [];

  const url = absolutePublicUrl(config.canonicalPath);
  const image = absolutePublicUrl(config.imagePath || DEFAULT_IMAGE);
  const webPage = {
    "@context": "https://schema.org",
    "@type": config.pageType === "profile" ? "ProfilePage" : "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: config.title,
    description: config.description,
    inLanguage: "pt-BR",
    isPartOf: { "@id": `${PUBLIC_SITE_URL}/#website` },
    primaryImageOfPage: image,
  };

  if (config.canonicalPath !== "/") return [webPage];

  return [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "NeuroNex AI",
      url: `${PUBLIC_SITE_URL}/`,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, Windows",
      audience: {
        "@type": "Audience",
        audienceType: "Psicólogos e clínicas de psicologia",
      },
      description: config.description,
      featureList: [
        "Agenda e gestão de pacientes",
        "Prontuário, documentos e teleconsulta",
        "Synapse por texto, voz e WhatsApp",
        "Gestão financeira e NeuroFinance",
        "NeuroBox com inteligências especializadas",
      ],
    },
    webPage,
  ];
}
