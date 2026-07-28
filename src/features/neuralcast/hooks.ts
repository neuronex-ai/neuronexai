import { useEffect, useState } from "react";

import neuralCastFavicon from "./assets/logo-dark.png";

function upsertMeta(
  selector: string,
  attributes: Record<string, string>,
  content: string,
) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    Object.entries(attributes).forEach(([name, value]) => element?.setAttribute(name, value));
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

const neuralCastIconLinks = [
  {
    selector: 'link[rel="icon"][sizes="192x192"]',
    attributes: { rel: "icon", type: "image/png", sizes: "192x192" },
  },
  {
    selector: 'link[rel="icon"][sizes="512x512"]',
    attributes: { rel: "icon", type: "image/png", sizes: "512x512" },
  },
  {
    selector: 'link[rel="apple-touch-icon"]',
    attributes: { rel: "apple-touch-icon", sizes: "192x192" },
  },
  {
    selector: 'link[rel="shortcut icon"]',
    attributes: { rel: "shortcut icon", type: "image/png" },
  },
] as const;

export function useNeuralCastSeo({
  title,
  description,
  canonicalPath,
  type = "website",
}: {
  title: string;
  description: string;
  canonicalPath: string;
  type?: "website" | "article";
}) {
  useEffect(() => {
    const canonicalUrl = `https://www.neuronexai.com.br${canonicalPath}`;
    const brandImageUrl = new URL(neuralCastFavicon, window.location.origin).href;
    const previousIcons = neuralCastIconLinks.map(({ selector, attributes }) => {
      let element = document.head.querySelector<HTMLLinkElement>(selector);
      const created = !element;

      if (!element) {
        element = document.createElement("link");
        document.head.appendChild(element);
      }

      const previousHref = element.getAttribute("href");
      Object.entries(attributes).forEach(([name, value]) => element?.setAttribute(name, value));
      element.setAttribute("href", neuralCastFavicon);

      return { created, element, previousHref };
    });

    document.title = title;

    upsertMeta('meta[name="description"]', { name: "description" }, description);
    upsertMeta('meta[name="robots"]', { name: "robots" }, "index, follow, max-image-preview:large");
    upsertMeta('meta[property="og:type"]', { property: "og:type" }, type);
    upsertMeta('meta[property="og:title"]', { property: "og:title" }, title);
    upsertMeta('meta[property="og:description"]', { property: "og:description" }, description);
    upsertMeta('meta[property="og:url"]', { property: "og:url" }, canonicalUrl);
    upsertMeta('meta[property="og:image"]', { property: "og:image" }, brandImageUrl);
    upsertMeta('meta[property="og:image:alt"]', { property: "og:image:alt" }, "Logo oficial da NeuralCast");
    upsertMeta('meta[property="og:site_name"]', { property: "og:site_name" }, "NeuralCast");
    upsertMeta('meta[name="application-name"]', { name: "application-name" }, "NeuralCast");
    upsertMeta('meta[name="twitter:card"]', { name: "twitter:card" }, "summary_large_image");
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title" }, title);
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description" }, description);
    upsertMeta('meta[name="twitter:image"]', { name: "twitter:image" }, brandImageUrl);
    upsertMeta('meta[name="twitter:image:alt"]', { name: "twitter:image:alt" }, "Logo oficial da NeuralCast");

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    document.getElementById("neuralcast-structured-data")?.remove();
    const structuredData = document.createElement("script");
    structuredData.id = "neuralcast-structured-data";
    structuredData.type = "application/ld+json";
    structuredData.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": type === "article" ? "Article" : "WebSite",
      name: title,
      headline: title,
      description,
      url: canonicalUrl,
      image: brandImageUrl,
      publisher: { "@type": "Organization", name: "NeuralCast", logo: brandImageUrl },
      author: { "@type": "Person", name: "Pedro Luiz Pereira" },
    });
    document.head.appendChild(structuredData);

    return () => {
      document.getElementById("neuralcast-structured-data")?.remove();
      previousIcons.forEach(({ created, element, previousHref }) => {
        if (created) {
          element.remove();
          return;
        }

        if (previousHref) {
          element.setAttribute("href", previousHref);
        } else {
          element.removeAttribute("href");
        }
      });
    };
  }, [canonicalPath, description, title, type]);
}

export function useNeuralCastMobileLanding() {
  const getMatches = () =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
  const [isMobile, setIsMobile] = useState(getMatches);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    setIsMobile(media.matches);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  return isMobile;
}
