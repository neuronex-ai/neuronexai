import publicPageCatalog from "../content/public-pages.json";

export const PUBLIC_SITE_URL = publicPageCatalog.siteUrl;

export type PublicSeoConfig = {
  title: string;
  description: string;
  canonicalPath?: string;
  indexable: boolean;
  imagePath?: string;
  pageType?: "website" | "profile";
};

const DEFAULT_IMAGE = publicPageCatalog.defaultImage;

const normalizePathname = (pathname: string) => {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "");
};

export function getPublicSeoConfig(pathname: string): PublicSeoConfig {
  const normalizedPath = normalizePathname(pathname);
  const publicConfig = publicPageCatalog.pages.find(
    ({ route }) => route === normalizedPath,
  );

  if (publicConfig) {
    return {
      title: publicConfig.title,
      description: publicConfig.description,
      canonicalPath: publicConfig.route,
      indexable: true,
      imagePath: publicConfig.image || DEFAULT_IMAGE,
      pageType: "website",
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
        "Synapse por texto e voz; WhatsApp previsto no Beta Desktop",
        "Gestão financeira e NeuroFinance",
        "NeuroBox com inteligências especializadas",
      ],
    },
    webPage,
  ];
}
