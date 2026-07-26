import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import {
  absolutePublicUrl,
  buildPublicStructuredData,
  getPublicSeoConfig,
} from "@/lib/public-seo";

const ROUTE_SCHEMA_ID = "neuronex-route-structured-data";

function upsertMeta(selector: string, attributes: Record<string, string>, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    Object.entries(attributes).forEach(([name, value]) => element?.setAttribute(name, value));
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function updateCanonical(url?: string) {
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!url) {
    canonical?.remove();
    return;
  }

  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = url;
}

export function PublicSeoManager() {
  const location = useLocation();

  useEffect(() => {
    const config = getPublicSeoConfig(location.pathname);
    const canonicalUrl = config.canonicalPath
      ? absolutePublicUrl(config.canonicalPath)
      : undefined;
    const imageUrl = absolutePublicUrl(config.imagePath);

    document.documentElement.lang = "pt-BR";
    document.title = config.title;

    upsertMeta('meta[name="title"]', { name: "title" }, config.title);
    upsertMeta('meta[name="description"]', { name: "description" }, config.description);
    upsertMeta('meta[name="keywords"]', { name: "keywords" }, config.keywords.join(", "));
    upsertMeta(
      'meta[name="robots"]',
      { name: "robots" },
      config.indexable ? "index, follow, max-image-preview:large" : "noindex, nofollow",
    );
    upsertMeta('meta[property="og:type"]', { property: "og:type" }, config.pageType || "website");
    upsertMeta('meta[property="og:title"]', { property: "og:title" }, config.title);
    upsertMeta('meta[property="og:description"]', { property: "og:description" }, config.description);
    upsertMeta('meta[property="og:image"]', { property: "og:image" }, imageUrl);
    upsertMeta('meta[property="og:image:alt"]', { property: "og:image:alt" }, config.imageAlt);
    upsertMeta('meta[property="og:image:width"]', { property: "og:image:width" }, "1280");
    upsertMeta('meta[property="og:image:height"]', { property: "og:image:height" }, "720");
    upsertMeta('meta[property="og:locale"]', { property: "og:locale" }, "pt_BR");
    upsertMeta('meta[property="og:site_name"]', { property: "og:site_name" }, "NeuroNex AI");
    upsertMeta('meta[name="application-name"]', { name: "application-name" }, "NeuroNex AI");
    upsertMeta('meta[name="twitter:card"]', { name: "twitter:card" }, "summary_large_image");
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title" }, config.title);
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description" }, config.description);
    upsertMeta('meta[name="twitter:image"]', { name: "twitter:image" }, imageUrl);
    upsertMeta('meta[name="twitter:image:alt"]', { name: "twitter:image:alt" }, config.imageAlt);

    if (canonicalUrl) {
      upsertMeta('meta[property="og:url"]', { property: "og:url" }, canonicalUrl);
      upsertMeta('meta[name="twitter:url"]', { name: "twitter:url" }, canonicalUrl);
    } else {
      document.head.querySelector('meta[property="og:url"]')?.remove();
      document.head.querySelector('meta[name="twitter:url"]')?.remove();
    }
    updateCanonical(canonicalUrl);

    document.getElementById(ROUTE_SCHEMA_ID)?.remove();
    const structuredData = buildPublicStructuredData(config);
    if (structuredData) {
      const script = document.createElement("script");
      script.id = ROUTE_SCHEMA_ID;
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }
  }, [location.pathname]);

  return null;
}
