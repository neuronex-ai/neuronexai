import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { ArrowRight, Check, Loader2, Mail, Mic2 } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import type { NeuralCastArticle } from "@/content/neuralcast-content";
import { cn } from "@/lib/utils";

const PAPER = "#ead8b7";
const PAPER_LIGHT = "#f4e8d1";
const INK = "#17130f";
const GOLD = "#a97838";

function upsertMeta(selector: string, attributes: Record<string, string>, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    Object.entries(attributes).forEach(([name, value]) => element?.setAttribute(name, value));
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

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
    document.title = title;

    upsertMeta('meta[name="description"]', { name: "description" }, description);
    upsertMeta('meta[name="robots"]', { name: "robots" }, "index, follow, max-image-preview:large");
    upsertMeta('meta[property="og:type"]', { property: "og:type" }, type);
    upsertMeta('meta[property="og:title"]', { property: "og:title" }, title);
    upsertMeta('meta[property="og:description"]', { property: "og:description" }, description);
    upsertMeta('meta[property="og:url"]', { property: "og:url" }, canonicalUrl);
    upsertMeta('meta[property="og:site_name"]', { property: "og:site_name" }, "NeuralCast");
    upsertMeta('meta[name="application-name"]', { name: "application-name" }, "NeuralCast");
    upsertMeta('meta[name="twitter:card"]', { name: "twitter:card" }, "summary_large_image");
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title" }, title);
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description" }, description);

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
      publisher: {
        "@type": "Organization",
        name: "NeuralCast",
      },
      author: {
        "@type": "Person",
        name: "Pedro Luiz Pereira",
      },
    });
    document.head.appendChild(structuredData);
  }, [canonicalPath, description, title, type]);
}

export function NeuralCastMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/neuralcast"
      aria-label="NeuralCast — página inicial"
      className="inline-flex items-center gap-3 text-[#17130f]"
    >
      <span className="relative grid h-10 w-16 place-items-center" aria-hidden="true">
        <Mic2 className="absolute left-0 h-7 w-7 stroke-[2.2]" />
        <svg viewBox="0 0 52 42" className="absolute right-0 h-9 w-11 fill-none stroke-current stroke-[2.1]">
          <path d="M4 18 17 6l15 4 12 12-9 14-18-2Z" />
          <path d="m17 6 0 28M32 10 17 22l18 14M17 22 44 22" />
          <circle cx="4" cy="18" r="2.6" fill="currentColor" />
          <circle cx="17" cy="6" r="2.6" fill="currentColor" />
          <circle cx="32" cy="10" r="2.6" fill="currentColor" />
          <circle cx="44" cy="22" r="2.6" fill="currentColor" />
          <circle cx="35" cy="36" r="2.6" fill="currentColor" />
          <circle cx="17" cy="34" r="2.6" fill="currentColor" />
        </svg>
      </span>
      {compact ? null : <span className="text-xl font-semibold tracking-[-0.04em]">NeuralCast</span>}
    </Link>
  );
}

export function NeuralCastHeader() {
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-[#17130f]/10 bg-[#ead8b7]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-[1320px] items-center justify-between px-5 md:px-8">
        <NeuralCastMark />
        <nav aria-label="Navegação NeuralCast" className="hidden items-center gap-8 md:flex">
          <Link
            to="/neuralcast"
            className={cn(
              "text-sm font-semibold text-[#17130f]/[0.65] transition-colors hover:text-[#17130f]",
              pathname === "/neuralcast" && "text-[#17130f]",
            )}
          >
            Início
          </Link>
          <Link
            to="/neuralcast/newsletter"
            className={cn(
              "text-sm font-semibold text-[#17130f]/[0.65] transition-colors hover:text-[#17130f]",
              pathname.startsWith("/neuralcast/newsletter") && "text-[#17130f]",
            )}
          >
            Artigos
          </Link>
          <a
            href="#newsletter"
            className="inline-flex h-11 items-center rounded-full bg-[#17130f] px-5 text-xs font-black uppercase tracking-[0.12em] text-[#f4e8d1] transition-transform hover:-translate-y-0.5"
          >
            Assinar
          </a>
        </nav>
        <Link
          to="/neuralcast/newsletter"
          className="inline-flex h-10 items-center rounded-full border border-[#17130f]/20 px-4 text-xs font-bold md:hidden"
        >
          Artigos
        </Link>
      </div>
    </header>
  );
}

export function NeuralCastShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#ead8b7] font-sans text-[#17130f] selection:bg-[#17130f] selection:text-[#f4e8d1]">
      <NeuralCastHeader />
      <main>{children}</main>
      <footer className="border-t border-[#f4e8d1]/[0.15] bg-[#17130f] px-5 py-10 text-[#f4e8d1] md:px-8">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="brightness-0 invert"><NeuralCastMark /></div>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#f4e8d1]/60">
              Neurociência, comportamento, cultura e liderança traduzidos em ideias aplicáveis para pessoas e organizações.
            </p>
          </div>
          <div className="text-sm text-[#f4e8d1]/[0.55] md:text-right">
            <p>Pedro Luiz Pereira</p>
            <p className="mt-1">Uma publicação independente em parceria experimental com NeuroNex / NeuroX.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function NeuralCastSubscribeForm({ inverted = false }: { inverted?: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setStatus("error");
      setMessage("Digite um e-mail válido para continuar.");
      return;
    }

    setStatus("loading");
    setMessage("");

    const { error } = await supabase.rpc("subscribe_neuralcast_newsletter", {
      p_email: normalizedEmail,
      p_name: name.trim() || null,
      p_source: window.location.pathname,
    });

    if (error) {
      setStatus("error");
      setMessage("Não foi possível concluir sua inscrição agora. Tente novamente em instantes.");
      return;
    }

    setStatus("success");
    setMessage("Inscrição confirmada. Os próximos textos chegam até você.");
    setEmail("");
    setName("");
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8" noValidate>
      <div className="grid gap-3 md:grid-cols-[0.75fr_1fr_auto]">
        <label className="sr-only" htmlFor="neuralcast-name">Nome</label>
        <input
          id="neuralcast-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Seu nome"
          autoComplete="name"
          className={cn(
            "h-14 rounded-full border px-5 text-sm font-semibold outline-none transition focus:ring-2",
            inverted
              ? "border-[#f4e8d1]/20 bg-[#f4e8d1]/[0.08] text-[#f4e8d1] placeholder:text-[#f4e8d1]/[0.45] focus:ring-[#f4e8d1]/[0.35]"
              : "border-[#17130f]/[0.15] bg-[#f4e8d1]/[0.65] text-[#17130f] placeholder:text-[#17130f]/[0.45] focus:ring-[#17130f]/20",
          )}
        />
        <label className="sr-only" htmlFor="neuralcast-email">E-mail</label>
        <input
          id="neuralcast-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="voce@empresa.com.br"
          autoComplete="email"
          required
          className={cn(
            "h-14 rounded-full border px-5 text-sm font-semibold outline-none transition focus:ring-2",
            inverted
              ? "border-[#f4e8d1]/20 bg-[#f4e8d1]/[0.08] text-[#f4e8d1] placeholder:text-[#f4e8d1]/[0.45] focus:ring-[#f4e8d1]/[0.35]"
              : "border-[#17130f]/[0.15] bg-[#f4e8d1]/[0.65] text-[#17130f] placeholder:text-[#17130f]/[0.45] focus:ring-[#17130f]/20",
          )}
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className={cn(
            "inline-flex h-14 items-center justify-center rounded-full px-7 text-xs font-black uppercase tracking-[0.12em] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60",
            inverted ? "bg-[#f4e8d1] text-[#17130f]" : "bg-[#17130f] text-[#f4e8d1]",
          )}
        >
          {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Mail className="mr-2 h-4 w-4" /> Assinar</>}
        </button>
      </div>
      {message ? (
        <p
          role="status"
          className={cn(
            "mt-4 flex items-center gap-2 text-sm font-semibold",
            status === "success"
              ? inverted ? "text-[#f4e8d1]" : "text-[#17130f]"
              : "text-red-700",
          )}
        >
          {status === "success" ? <Check className="h-4 w-4" /> : null}
          {message}
        </p>
      ) : null}
      <p className={cn("mt-4 text-xs leading-relaxed", inverted ? "text-[#f4e8d1]/[0.48]" : "text-[#17130f]/[0.48]")}>
        Conteúdo autoral, sem excesso de e-mails. Você poderá sair da lista quando desejar.
      </p>
    </form>
  );
}

export function NeuralCastArticleCard({
  article,
  inverted = false,
}: {
  article: NeuralCastArticle;
  inverted?: boolean;
}) {
  return (
    <article
      className={cn(
        "group flex min-h-[360px] flex-col justify-between rounded-[30px] border p-7 transition-transform duration-300 hover:-translate-y-1 md:p-9",
        inverted
          ? "border-[#f4e8d1]/[0.16] bg-[#f4e8d1]/[0.045] text-[#f4e8d1]"
          : "border-[#17130f]/[0.12] bg-[#f4e8d1]/[0.38] text-[#17130f]",
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-4 text-[10px] font-black uppercase tracking-[0.16em] opacity-55">
          <span>{article.category}</span>
          <span>{article.readTime}</span>
        </div>
        <h2 className="mt-8 text-balance text-3xl font-black leading-[0.94] tracking-[-0.055em] md:text-4xl">
          {article.title}
        </h2>
        <p className="mt-5 text-sm font-medium leading-relaxed opacity-65 md:text-base">{article.excerpt}</p>
      </div>
      <div className="mt-10 flex items-center justify-between gap-4 border-t border-current/[0.12] pt-5">
        <span className="text-xs font-semibold opacity-55">{article.publishedAt}</span>
        <Link
          to={`/neuralcast/newsletter/${article.slug}`}
          className="inline-flex items-center text-xs font-black uppercase tracking-[0.12em]"
        >
          Ler artigo <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </article>
  );
}

export const neuralCastPalette = { paper: PAPER, paperLight: PAPER_LIGHT, ink: INK, gold: GOLD };
