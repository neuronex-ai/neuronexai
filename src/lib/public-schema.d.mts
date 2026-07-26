import type {
  PublicArticle,
  PublicContentCatalog,
  PublicFaq,
  PublicPageDefinition,
} from "../content/public-content";
import type { ComparisonDefinition } from "../content/comparison-content";

export type PublicSeoConfig = {
  route: string;
  title: string;
  description: string;
  keywords: string[];
  canonicalPath?: string;
  indexable: boolean;
  imagePath: string;
  imageAlt: string;
  pageType: "website" | "article";
  contentKind: PublicPageDefinition["kind"] | "article" | "unknown";
  faq: PublicFaq[];
  source: PublicPageDefinition | PublicArticle | ComparisonDefinition | null;
};

export type JsonLdNode = Record<string, unknown>;

export type PublicStructuredData = {
  "@context": "https://schema.org";
  "@graph": JsonLdNode[];
};

export const PUBLIC_SITE_URL: string;
export const publicContent: PublicContentCatalog;

export function normalizePublicPath(pathname: string): string;
export function absolutePublicUrl(path?: string): string;
export function validatePublicContentCatalog(): PublicContentCatalog;
export function getPublicSeoConfig(pathname: string): PublicSeoConfig;
export function buildPublicStructuredData(
  config: PublicSeoConfig,
): PublicStructuredData | null;
