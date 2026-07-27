import generatedCatalog from "@/content/public-product-media.generated.json";

export type PublicMediaTheme = "light" | "dark";

export type PublicMediaImage = {
  src: string;
  alt: string;
  caption: string;
  name: string;
  kind: string;
};

export type PublicMediaCollection = {
  light: readonly PublicMediaImage[];
  dark: readonly PublicMediaImage[];
};

export const PUBLIC_MEDIA_BASE_KEYS = [
  "dashboard",
  "agenda",
  "teleconsulta",
  "pacientes",
  "prontuario",
  "neurodrive",
  "neuroview",
  "neuroflow",
  "neuropulse",
  "gestao-financeira",
  "neurofinance",
  "neuroid",
  "ajustes",
  "busca-global",
  "portal-paciente",
  "synapse",
] as const;

export type PublicMediaBaseKey = (typeof PUBLIC_MEDIA_BASE_KEYS)[number];
export type PublicMediaKey = PublicMediaBaseKey | "neurobox" | "produto";

const baseCatalog = generatedCatalog as Record<
  PublicMediaBaseKey,
  PublicMediaCollection
>;

function uniqueImages(images: readonly PublicMediaImage[]) {
  const seen = new Set<string>();
  return images.filter((image) => {
    if (seen.has(image.src)) return false;
    seen.add(image.src);
    return true;
  });
}

function combineCollections(keys: readonly PublicMediaBaseKey[]): PublicMediaCollection {
  return {
    light: uniqueImages(keys.flatMap((key) => baseCatalog[key].light)),
    dark: uniqueImages(keys.flatMap((key) => baseCatalog[key].dark)),
  };
}

function findImage(
  key: PublicMediaBaseKey,
  theme: PublicMediaTheme,
  nameFragment: string,
) {
  return (
    baseCatalog[key][theme].find((image) => image.name.includes(nameFragment)) ??
    baseCatalog[key][theme][0]
  );
}

function compactImages(
  images: ReadonlyArray<PublicMediaImage | undefined>,
): PublicMediaImage[] {
  return uniqueImages(
    images.filter((image): image is PublicMediaImage => Boolean(image)),
  );
}

function createProductCollection(theme: PublicMediaTheme): PublicMediaImage[] {
  return compactImages([
    findImage("dashboard", theme, "primeira-dobra"),
    findImage("agenda", theme, "calendario-mensal--visao-completa"),
    findImage("pacientes", theme, "lista--cartoes"),
    findImage("prontuario", theme, "resumo--indicadores"),
    findImage("gestao-financeira", theme, "visao-geral"),
    findImage("neurofinance", theme, "conta-e-saldo--dashboard"),
    findImage("neuroview", theme, "grafo-2d"),
    findImage("neuroflow", theme, "canvas--mapa-clinico"),
    findImage("neuropulse", theme, "diagrama-clinico-pronto"),
    findImage("ajustes", theme, "login-e-seguranca"),
    findImage("busca-global", theme, "resultados"),
  ]);
}

const neuroboxCollection = combineCollections([
  "neurodrive",
  "neuroview",
  "neuroflow",
  "neuropulse",
]);

const productCollection: PublicMediaCollection = {
  light: createProductCollection("light"),
  dark: createProductCollection("dark"),
};

const portalCollection: PublicMediaCollection = {
  // Esta remessa não contém Portal claro; não exibimos uma captura escura
  // quando a página está no tema claro.
  light: [],
  dark: baseCatalog["portal-paciente"].dark,
};

const synapseCollection: PublicMediaCollection = {
  // A remessa atual do Synapse contém apenas capturas escuras. Mantemos o
  // seletor por tema e usamos o mesmo conjunto no claro até chegar a variante.
  light: baseCatalog.synapse.dark,
  dark: baseCatalog.synapse.dark,
};

export function getPublicMediaCollection(key: PublicMediaKey): PublicMediaCollection {
  if (key === "neurobox") return neuroboxCollection;
  if (key === "produto") return productCollection;
  if (key === "portal-paciente") return portalCollection;
  if (key === "synapse") return synapseCollection;
  return baseCatalog[key];
}

export function getPublicMediaImage(
  key: PublicMediaKey,
  theme: PublicMediaTheme,
  nameFragment?: string,
) {
  const images = getPublicMediaCollection(key)[theme];
  if (!nameFragment) return images[0];
  return images.find((image) => image.name.includes(nameFragment)) ?? images[0];
}

export type PublicRouteMediaConfig =
  | {
      variant: "screenshots";
      key: PublicMediaKey;
      title: string;
      eyebrow?: string;
      description?: string;
    }
  | {
      variant: "youtube";
      title: string;
      eyebrow?: string;
      description?: string;
      videoTitle: string;
      videoSource: string;
    }
  | {
      variant: "none";
    };

const routeMediaConfig: Record<string, PublicRouteMediaConfig> = {
  "/produto": {
    variant: "screenshots",
    key: "produto",
    title: "NeuroNex por dentro",
    eyebrow: "Produto real",
  },
  "/synapse": {
    variant: "screenshots",
    key: "synapse",
    title: "Synapse AI por dentro",
    eyebrow: "Produto real",
    description:
      "Veja como texto, sugestões e voz aparecem no fluxo de trabalho da clínica.",
  },
  "/neurofinance": {
    variant: "screenshots",
    key: "neurofinance",
    title: "NeuroFinance por dentro",
    eyebrow: "Conta e operação financeira",
  },
  "/gestao-financeira-para-psicologos": {
    variant: "screenshots",
    key: "gestao-financeira",
    title: "Gestão Financeira por dentro",
  },
  "/neurobox": {
    variant: "screenshots",
    key: "neurobox",
    title: "NeuroBox por dentro",
    description:
      "Notas, tarefas, documentos, mapas clínicos e sínteses visuais no mesmo espaço de trabalho.",
  },
  "/neurozap-para-psicologos": { variant: "none" },
  "/pacientes-para-psicologos": {
    variant: "screenshots",
    key: "pacientes",
    title: "Pacientes por dentro",
  },
  "/portal-do-paciente": {
    variant: "screenshots",
    key: "portal-paciente",
    title: "Portal do Paciente por dentro",
  },
  "/teleconsulta-para-psicologos": {
    variant: "screenshots",
    key: "teleconsulta",
    title: "Teleconsulta por dentro",
  },
  "/prontuario-para-psicologos": {
    variant: "screenshots",
    key: "prontuario",
    title: "Prontuário por dentro",
  },
  "/agenda-para-psicologos": {
    variant: "screenshots",
    key: "agenda",
    title: "Agenda por dentro",
  },
  "/seguranca-e-etica": {
    variant: "screenshots",
    key: "ajustes",
    title: "Segurança e controle por dentro",
  },
  "/download": {
    variant: "screenshots",
    key: "produto",
    title: "NeuroNex por dentro",
  },
  "/novidades": {
    variant: "screenshots",
    key: "produto",
    title: "O produto em evolução",
  },
};

export function getPublicRouteMediaConfig(route: string) {
  return routeMediaConfig[route];
}

type ArticleMediaSelection = {
  key: PublicMediaKey;
  nameFragment?: string;
};

const articleMediaSelection: Record<string, ArticleMediaSelection> = {
  "agenda-online-para-psicologos": {
    key: "agenda",
    nameFragment: "calendario-mensal--visao-completa",
  },
  "anamnese-psicologica-digital": {
    key: "prontuario",
    nameFragment: "anamnese--formulario",
  },
  "como-reduzir-faltas-e-inadimplencia-na-clinica": {
    key: "gestao-financeira",
    nameFragment: "cobranca-manual",
  },
  "documentos-psicologicos-laudo-relatorio-atestado-declaracao": {
    key: "prontuario",
    nameFragment: "documentos-oficiais",
  },
  "ia-para-psicologos-na-pratica": {
    key: "neuropulse",
    nameFragment: "diagrama-clinico-pronto",
  },
  "lgpd-para-psicologos-no-prontuario-digital": {
    key: "ajustes",
    nameFragment: "login-e-seguranca--2fa",
  },
  "melhores-sistemas-para-psicologos-comparativo-2026": { key: "dashboard" },
  "neuronex-vs-corpora": { key: "dashboard" },
  "neuronex-vs-psicogest": { key: "dashboard" },
  "neuronex-vs-psicomanager": { key: "dashboard" },
  "neuronex-vs-psipront": { key: "dashboard" },
  "neuronex-vs-sintropia": { key: "dashboard" },
  "pix-e-cobranca-automatica-para-psicologos": {
    key: "neurofinance",
    nameFragment: "area-pix",
  },
  "portal-do-paciente-para-psicologos": { key: "portal-paciente" },
  "prontuario-eletronico-para-psicologos": {
    key: "prontuario",
    nameFragment: "resumo--indicadores",
  },
  "receita-saude-para-psicologos": {
    key: "prontuario",
    nameFragment: "fiscal--acoes",
  },
  "sistema-para-psicologos-como-escolher": { key: "produto" },
  "software-para-psicologos-com-inteligencia-artificial": {
    key: "synapse",
    nameFragment: "inicio--sugestoes",
  },
  "teleconsulta-para-psicologos": {
    key: "teleconsulta",
    nameFragment: "visao-geral",
  },
  "transcricao-de-sessao-com-ia-para-psicologos": {
    key: "teleconsulta",
    nameFragment: "revisao-gerada",
  },
  "ia-para-psicologos-com-etica-e-controle": {
    key: "ajustes",
    nameFragment: "login-e-seguranca",
  },
  "sistema-operacional-para-clinica-de-psicologia": { key: "produto" },
  "gestao-financeira-para-psicologos-do-fluxo-de-caixa-ao-neurofinance": {
    key: "gestao-financeira",
    nameFragment: "visao-geral",
  },
};

export function getPublicArticleMedia(slug: string, theme: PublicMediaTheme) {
  const selection = articleMediaSelection[slug] ?? { key: "produto" as const };
  return getPublicMediaImage(selection.key, theme, selection.nameFragment);
}
