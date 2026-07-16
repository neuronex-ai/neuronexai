"use client";

import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  Check,
  ClipboardList,
  FileText,
  Layers3,
  LockKeyhole,
  Network,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { ElementType, ReactNode } from "react";
import { Link } from "react-router-dom";

import { Footer } from "@/components/landing/Footer";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { Navbar } from "@/components/landing/Navbar";
import { Button } from "@/components/ui/button";
import type {
  PublicFeatureStatus,
  PublicPageDefinition,
} from "@/content/public-content";
import { cn } from "@/lib/utils";

const sectionIcons: ElementType<{ className?: string }>[] = [
  Layers3,
  ShieldCheck,
  BrainCircuit,
  ClipboardList,
  Network,
  FileText,
];

const statusStyles: Record<PublicFeatureStatus, string> = {
  Disponível:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  Beta: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  "Em evolução":
    "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
};

export function PublicStatusBadge({
  status,
  className,
}: {
  status: PublicFeatureStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em]",
        statusStyles[status],
        className,
      )}
    >
      {status}
    </span>
  );
}

export function PublicBreadcrumbs({
  page,
  articleTitle,
}: {
  page?: PublicPageDefinition;
  articleTitle?: string;
}) {
  return (
    <nav
      aria-label="Navegação estrutural"
      className="mx-auto flex min-h-11 max-w-[1320px] items-center gap-2 overflow-x-auto px-5 text-[10px] font-bold text-muted-foreground md:px-8"
    >
      <Link to="/" className="rounded-lg py-2 hover:text-foreground">
        Início
      </Link>
      <span aria-hidden="true">/</span>
      {articleTitle ? (
        <>
          <Link to="/blog" className="rounded-lg py-2 hover:text-foreground">
            Blog
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="truncate text-foreground/75">
            {articleTitle}
          </span>
        </>
      ) : (
        <span aria-current="page" className="truncate text-foreground/75">
          {page?.eyebrow}
        </span>
      )}
    </nav>
  );
}

export function PublicPageHero({
  page,
  actions,
}: {
  page: PublicPageDefinition;
  actions?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden px-5 pb-20 pt-8 md:px-8 md:pb-28 md:pt-14">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_50%_0%,hsl(var(--foreground)/0.07),transparent_64%)]" />
      <div className="relative z-10 mx-auto max-w-[1320px]">
        <div className="mx-auto max-w-5xl text-center">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border/45 bg-foreground/[0.035] px-4 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground dark:border-white/10 dark:bg-white/[0.045]">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
              {page.eyebrow}
            </span>
            <PublicStatusBadge status={page.status} />
          </div>
          <h1 className="mx-auto mt-8 max-w-5xl text-balance text-[2.9rem] font-black leading-[0.9] tracking-[-0.055em] sm:text-[3.7rem] md:text-[5rem] lg:text-[6rem]">
            {page.heading}
          </h1>
          <p className="mx-auto mt-7 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground/74 md:text-xl">
            {page.lead}
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            {actions ?? (
              <>
                <Button
                  asChild
                  className="h-14 rounded-2xl bg-foreground px-7 text-[10px] font-black uppercase tracking-[0.18em] text-background"
                >
                  <Link to="/create-account">
                    Começar grátis <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-14 rounded-2xl px-7 text-[10px] font-black uppercase tracking-[0.18em]"
                >
                  <Link to="/contato">Falar com a equipe</Link>
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="mt-16 overflow-hidden rounded-[32px] border border-border/45 bg-card shadow-[0_36px_120px_-76px_rgba(0,0,0,0.8)] dark:border-white/10 dark:bg-[#08090b]">
          <img
            src={page.image}
            alt={page.imageAlt}
            width={1280}
            height={720}
            loading="eager"
            decoding="async"
            className="block aspect-video w-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}

const PageHighlights = ({ page }: { page: PublicPageDefinition }) => (
  <section className="bg-foreground px-5 py-16 text-background dark:bg-white dark:text-zinc-950 md:px-8 md:py-20">
    <div className="mx-auto grid max-w-[1240px] gap-3 md:grid-cols-3">
      {page.highlights.map((highlight) => (
        <article
          key={highlight}
          className="border-t border-background/16 py-6 dark:border-zinc-950/15 md:px-6"
        >
          <Check aria-hidden="true" className="h-5 w-5 opacity-55" />
          <h2 className="mt-7 text-2xl font-black leading-tight">{highlight}</h2>
        </article>
      ))}
    </div>
  </section>
);

const PageSections = ({ page }: { page: PublicPageDefinition }) => (
  <div>
    {page.sections.map((section, index) => {
      const Icon = sectionIcons[index % sectionIcons.length];
      const inverted = index % 3 === 1;

      return (
        <section
          key={section.title}
          className={cn(
            "px-5 py-20 md:px-8 md:py-28",
            inverted &&
              "bg-foreground text-background dark:bg-white dark:text-zinc-950",
          )}
        >
          <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
            <div>
              <Icon
                aria-hidden="true"
                className={cn(
                  "h-7 w-7",
                  inverted ? "opacity-55" : "text-muted-foreground",
                )}
              />
              <p
                className={cn(
                  "mt-8 text-[9px] font-black uppercase tracking-[0.2em]",
                  inverted ? "opacity-45" : "text-muted-foreground",
                )}
              >
                {String(index + 1).padStart(2, "0")} · {page.eyebrow}
              </p>
            </div>
            <article>
              <h2 className="text-balance text-4xl font-black leading-none md:text-6xl">
                {section.title}
              </h2>
              <p
                className={cn(
                  "mt-6 max-w-3xl text-base font-medium leading-relaxed md:text-lg",
                  inverted ? "opacity-66" : "text-muted-foreground/72",
                )}
              >
                {section.text}
              </p>
              {section.bullets?.length ? (
                <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                  {section.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className={cn(
                        "flex min-h-14 items-center gap-3 border-t py-4 text-sm font-bold",
                        inverted
                          ? "border-background/14 dark:border-zinc-950/14"
                          : "border-border/55",
                      )}
                    >
                      <BadgeCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          </div>
        </section>
      );
    })}
  </div>
);

const PageFaq = ({ page }: { page: PublicPageDefinition }) => {
  if (!page.faq.length) return null;

  return (
    <section className="px-5 py-20 md:px-8 md:py-28">
      <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[0.78fr_1.22fr]">
        <div>
          <LockKeyhole className="h-7 w-7 text-muted-foreground" />
          <p className="mt-8 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            Dúvidas frequentes
          </p>
          <h2 className="mt-4 text-4xl font-black leading-none md:text-5xl">
            Respostas claras antes de começar.
          </h2>
        </div>
        <div className="divide-y divide-border/45 border-y border-border/45 dark:divide-white/10 dark:border-white/10">
          {page.faq.map((faq) => (
            <details key={faq.question} className="group py-1">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-5 text-base font-black marker:hidden">
                {faq.question}
                <span
                  aria-hidden="true"
                  className="text-xl text-muted-foreground transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="max-w-3xl pb-6 text-sm font-medium leading-relaxed text-muted-foreground/74 md:text-base">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
};

const PageRelated = ({ page }: { page: PublicPageDefinition }) => (
  <section className="px-5 pb-20 md:px-8 md:pb-28">
    <div className="mx-auto max-w-[1180px] border-y border-border/45 py-10 dark:border-white/10">
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
        Continue explorando
      </p>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {page.related.map((link) => (
          <Link
            key={`${link.href}-${link.label}`}
            to={link.href}
            className="group flex min-h-16 items-center justify-between gap-4 rounded-lg border border-border/45 px-5 py-4 text-sm font-black transition-colors hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/10 dark:hover:bg-white dark:hover:text-zinc-950"
          >
            {link.label}
            <ArrowRight
              aria-hidden="true"
              className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1"
            />
          </Link>
        ))}
      </div>
    </div>
  </section>
);

export function PublicPageShell({
  page,
  children,
}: {
  page: PublicPageDefinition;
  children?: ReactNode;
}) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background font-sans text-foreground">
      <div className="hidden md:block">
        <Navbar />
      </div>
      <LandingMobileNav />
      <main className="pt-24 md:pt-32">
        <PublicBreadcrumbs page={page} />
        <PublicPageHero page={page} />
        <PageHighlights page={page} />
        {children}
        <PageSections page={page} />
        <PageFaq page={page} />
        <PageRelated page={page} />
        <section className="px-5 pb-20 md:px-8 md:pb-28">
          <div className="mx-auto max-w-[1180px] bg-foreground px-7 py-12 text-center text-background dark:bg-white dark:text-zinc-950 md:px-12 md:py-16">
            <ShieldCheck aria-hidden="true" className="mx-auto h-7 w-7 opacity-55" />
            <h2 className="mx-auto mt-7 max-w-4xl text-balance text-4xl font-black leading-none md:text-6xl">
              Conecte esta área ao restante da sua prática.
            </h2>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                asChild
                className="h-14 rounded-2xl bg-background px-7 text-[10px] font-black uppercase tracking-[0.18em] text-foreground dark:bg-zinc-950 dark:text-white"
              >
                <Link to="/create-account">
                  Começar agora <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-14 rounded-2xl border-background/20 bg-transparent px-7 text-[10px] font-black uppercase tracking-[0.18em] text-background dark:border-zinc-950/20 dark:text-zinc-950"
              >
                <Link to="/precos">Comparar planos</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
