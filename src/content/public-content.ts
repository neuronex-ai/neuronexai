import publicContentJson from "./public-content.json";

export type PublicFeatureStatus = "Disponível" | "Beta" | "Em evolução";

export type PublicLink = {
  label: string;
  href: string;
};

export type PublicFaq = {
  question: string;
  answer: string;
};

export type PublicSection = {
  title: string;
  text: string;
  bullets?: string[];
};

export type PublicOffer = {
  name: string;
  price: number;
  priceCurrency: "BRL";
  url: string;
};

export type PublicAuthor = {
  id: string;
  name: string;
  type: "Organization" | "Person";
  role: string;
  url: string;
};

export type PublicPageKind =
  | "home"
  | "product"
  | "financial"
  | "pricing"
  | "trust"
  | "blog"
  | "updates"
  | "comparison"
  | "support"
  | "legal";

export type PublicPageDefinition = {
  route: string;
  file: string | null;
  kind: PublicPageKind;
  status: PublicFeatureStatus;
  modifiedAt: string;
  title: string;
  description: string;
  keywords: string[];
  eyebrow: string;
  heading: string;
  lead: string;
  highlights: string[];
  sections: PublicSection[];
  faq: PublicFaq[];
  image: string;
  imageAlt: string;
  related: PublicLink[];
};

export type PublicArticle = {
  slug: string;
  publicationStatus?: "published" | "draft";
  route: string;
  file: string;
  bodyFile: string;
  title: string;
  seoTitle?: string;
  description: string;
  excerpt: string;
  category: string;
  keywords: string[];
  authorId: string;
  reviewer: string;
  publishedAt: string;
  modifiedAt: string;
  image: string;
  imageAlt: string;
  related: PublicLink[];
};

export type PublicUpdate = {
  date: string;
  status: PublicFeatureStatus;
  title: string;
  text: string;
};

export type PublicContentCatalog = {
  site: {
    url: string;
    defaultImage: string;
    lastModified: string;
    organization: {
      name: string;
      legalName: string;
      email: string;
      telephone: string;
      logo: string;
      address: {
        streetAddress: string;
        addressLocality: string;
        addressRegion: string;
        addressCountry: string;
      };
      description: string;
    };
    offers: PublicOffer[];
  };
  authors: PublicAuthor[];
  pages: PublicPageDefinition[];
  articles: PublicArticle[];
  updates: PublicUpdate[];
};

export const PUBLIC_CONTENT = publicContentJson as PublicContentCatalog;
export const PUBLIC_PAGES = PUBLIC_CONTENT.pages;
export const PUBLIC_ARTICLES = PUBLIC_CONTENT.articles.filter(
  ({ publicationStatus }) => publicationStatus !== "draft",
);
export const PUBLIC_UPDATES = PUBLIC_CONTENT.updates;

export function normalizePublicPath(pathname: string) {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/u, "");
}

export function getPublicPage(pathname: string) {
  const route = normalizePublicPath(pathname);
  return PUBLIC_PAGES.find((page) => page.route === route);
}

export function getPublicArticle(pathnameOrSlug: string) {
  const route = pathnameOrSlug.startsWith("/")
    ? normalizePublicPath(pathnameOrSlug)
    : `/blog/${pathnameOrSlug}`;
  return PUBLIC_ARTICLES.find((article) => article.route === route);
}

export function getPublicAuthor(authorId: string) {
  return PUBLIC_CONTENT.authors.find((author) => author.id === authorId);
}
