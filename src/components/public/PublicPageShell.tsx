"use client";

import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  Check,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  FileText,
  FlaskConical,
  Layers3,
  LockKeyhole,
  Network,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState, type ElementType, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";

import { Footer } from "@/components/landing/Footer";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { Navbar } from "@/components/landing/Navbar";
import { PublicProductShowcase } from "@/components/public/PublicProductShowcase";
import { Button } from "@/components/ui/button";
import type {
  PublicFeatureStatus,
  PublicPageDefinition,
} from "@/content/public-content";
import { getPublicPage } from "@/content/public-content";
import {
  getPublicMediaCollection,
  getPublicRouteMediaConfig,
} from "@/content/public-product-media";
import { cn } from "@/lib/utils";

const sectionIcons: ElementType<{ className?: string }>[] = [
  Layers3,
  ShieldCheck,
  BrainCircuit,
  ClipboardList,
  Network,
  FileText,
];

const statusIcons: Record<PublicFeatureStatus, ElementType<{ className?: string }>> = {
  Disponível: CheckCircle2,
  Beta: FlaskConical,
  "Em evolução": CircleDashed,
};

export function PublicStatusBadge({
  status,
  className,
}: {
  status: PublicFeatureStatus;
  className?: string;
}) {
  const StatusIcon = statusIcons[status];

  return (
    <span
      className={cn(
        "public-glass-capsule inline-flex min-h-8 items-center gap-2 rounded-full px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-foreground/70 dark:text-white/70",
        className,
      )}
    >
      <StatusIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
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
      className="pointer-events-auto fixed left-5 top-7 z-[95] hidden min-h-10 max-w-[min(22rem,calc(100vw-2.5rem))] items-center gap-2 overflow-x-auto whitespace-nowrap text-[10px] font-bold text-muted-foreground/78 md:flex 2xl:left-[max(1.5rem,calc((100vw-1500px)/2+1.5rem))]"
    >
      <Link to="/" className="rounded-lg py-2 hover:text-foreground">
        Início
      </Link>
      <span aria-hidden="true">/</span>
      {articleTitle ? (
        <>
          <Link to="/blog" className="rounded-lg py-2 hover:text-foreground">
            NeuroX
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

export function PublicRouteBreadcrumbs({ route }: { route: string }) {
  const page = getPublicPage(route);
  return page ? <PublicBreadcrumbs page={page} /> : null;
}

const SYNAPSE_HEADING_WORDS = ["voz", "texto"] as const;

function SynapseAnimatedHeading() {
  const shouldReduceMotion = useReducedMotion();
  const [wordIndex, setWordIndex] = useState(0);
  const [typedWord, setTypedWord] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (shouldReduceMotion) return undefined;

    const currentWord = SYNAPSE_HEADING_WORDS[wordIndex];
    const wordIsComplete = typedWord === currentWord;
    const wordIsEmpty = typedWord.length === 0;
    let delay = isDeleting ? 55 : 95;

    if (!isDeleting && wordIsComplete) delay = 1_350;
    if (isDeleting && wordIsEmpty) delay = 240;

    const timer = window.setTimeout(() => {
      if (!isDeleting && wordIsComplete) {
        setIsDeleting(true);
        return;
      }

      if (isDeleting && wordIsEmpty) {
        setWordIndex((current) => (current + 1) % SYNAPSE_HEADING_WORDS.length);
        setIsDeleting(false);
        return;
      }

      const nextLength = typedWord.length + (isDeleting ? -1 : 1);
      setTypedWord(currentWord.slice(0, nextLength));
    }, delay);

    return () => window.clearTimeout(timer);
  }, [isDeleting, shouldReduceMotion, typedWord, wordIndex]);

  const visualWord = shouldReduceMotion ? "voz e texto" : typedWord;

  return (
    <>
      <span className="block">Converse com</span>
      <span className="block md:whitespace-nowrap">
        Sua clínica por{" "}
        <span
          aria-hidden="true"
          className="inline-flex min-w-[9ch] items-baseline text-left text-muted-foreground"
        >
          <span>{visualWord || "\u00a0"}</span>
          <span
            className="ml-[0.08em] inline-block h-[0.82em] w-[0.055em] translate-y-[0.04em] rounded-full bg-current animate-pulse motion-reduce:animate-none"
          />
        </span>
        <span className="sr-only">voz ou texto</span>
      </span>
    </>
  );
}

export function PublicProductHero({
  page,
  actions,
  showImage = true,
}: {
  page: PublicPageDefinition;
  actions?: ReactNode;
  showImage?: boolean;
}) {
  const mediaConfig = getPublicRouteMediaConfig(page.route);

  return (
    <>
      <section className="public-product-hero px-5 md:px-8">
        <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-[1240px] items-center justify-center pb-16 pt-[8.25rem] text-center md:pb-20 md:pt-[9rem]">
          <div className="mx-auto max-w-5xl">
            <div className="flex min-h-8 items-center justify-center gap-3">
              <span className="font-mono text-[9px] font-bold uppercase text-muted-foreground">
                {page.eyebrow}
              </span>
              {page.status === "Disponível" ? null : (
                <PublicStatusBadge status={page.status} />
              )}
            </div>
            <h1
              className={cn(
                "public-product-title public-neurox-title mx-auto mt-7 whitespace-pre-line pb-[0.12em] text-balance text-[clamp(3rem,6vw,5.4rem)] font-black leading-[1.02] tracking-tight",
                page.route === "/synapse" ? "max-w-[22ch]" : "max-w-[15ch]",
              )}
            >
              {page.route === "/synapse" ? <SynapseAnimatedHeading /> : page.heading}
            </h1>
            <p className="mx-auto mt-7 max-w-[840px] text-pretty text-lg font-semibold leading-relaxed text-muted-foreground/78 md:text-2xl">
              {page.lead}
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              {actions ?? (
                <>
                  <Button
                    asChild
                    className="public-tactile h-14 rounded-full bg-foreground px-7 font-mono text-[10px] font-black uppercase text-background"
                  >
                    <Link to="/create-account">
                      Começar grátis <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="public-tactile h-14 rounded-full border-border/70 bg-background/38 px-7 font-mono text-[10px] font-black uppercase backdrop-blur-xl"
                  >
                    <Link to={page.route === "/produto" ? "/comparar" : "/produto"}>
                      {page.route === "/produto"
                        ? "Comparar sistemas"
                        : "Conhecer a operação completa"}
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {showImage && mediaConfig?.variant === "screenshots" ? (
        <PublicProductShowcase
          title={mediaConfig.title}
          eyebrow={mediaConfig.eyebrow}
          description={mediaConfig.description}
          images={getPublicMediaCollection(mediaConfig.key)}
          className={cn(
            "public-product-media-band",
            page.route === "/prontuario-para-psicologos" &&
              "public-product-media-band--paper",
          )}
          frameClassName="public-product-media-frame"
        />
      ) : null}

      {showImage && mediaConfig?.variant === "youtube" ? (
        <PublicProductShowcase
          variant="youtube"
          title={mediaConfig.title}
          eyebrow={mediaConfig.eyebrow}
          description={mediaConfig.description}
          video={{
            source: mediaConfig.videoSource,
            title: mediaConfig.videoTitle,
          }}
          className="public-product-media-band"
          frameClassName="public-product-media-frame"
        />
      ) : null}
    </>
  );
}

export function PublicPageHero(props: {
  page: PublicPageDefinition;
  actions?: ReactNode;
  showImage?: boolean;
}) {
  return <PublicProductHero {...props} />;
}

export function PublicEditorialHero({
  eyebrow,
  title,
  lead,
  actions,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  actions: ReactNode;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="px-5 pb-10 pt-0 md:px-8 md:pb-14">
      <div className="public-neurox-hero mx-auto flex min-h-[calc(100svh-6rem)] max-w-[1480px] items-center justify-center overflow-hidden px-5 py-20 text-center md:min-h-[calc(100svh-6.5rem)] md:px-10 md:py-24">
        <div className="relative z-10 mx-auto max-w-5xl">
          <motion.p
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-muted-foreground"
          >
            {eyebrow}
          </motion.p>
          <motion.h1
            initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.06 }}
            className="public-neurox-title mt-7 text-balance text-[clamp(3rem,7vw,5.8rem)] font-black leading-[1.02] tracking-tight"
          >
            {title}
          </motion.h1>
          <motion.p
            initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.12 }}
            className="mx-auto mt-8 max-w-3xl text-pretty text-xl font-semibold leading-relaxed text-muted-foreground/82 md:mt-10 md:text-3xl"
          >
            {lead}
          </motion.p>
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.18 }}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            {actions}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

const PageHighlights = ({ page }: { page: PublicPageDefinition }) => {
  return (
    <section className="public-section-stage public-inverted-section px-5 py-16 text-background dark:text-zinc-950 md:px-8 md:py-20">
      <div className="mx-auto grid max-w-[1240px] gap-3 md:grid-cols-3">
        {page.highlights.map((highlight) => (
          <article
            key={highlight}
            className="public-highlight-item border-t border-background/16 py-6 dark:border-zinc-950/15 md:px-6"
          >
            <Check aria-hidden="true" className="h-5 w-5 opacity-55" />
            <h2 className="mt-7 text-2xl font-black leading-tight">{highlight}</h2>
          </article>
        ))}
      </div>
    </section>
  );
};

const PageSections = ({ page }: { page: PublicPageDefinition }) => {
  return (
  <div className="public-section-sequence">
    {page.sections.map((section, index) => {
      const Icon = sectionIcons[index % sectionIcons.length];
      const inverted = index % 2 === 1;

      return (
        <section
          key={section.title}
          className={cn(
            "public-section-stage px-5 py-20 md:px-8 md:py-28",
            inverted &&
              "public-inverted-section text-background dark:text-zinc-950",
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
              <h2 className="text-balance text-4xl font-black leading-[1.02] md:text-5xl">
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
};

const PageFaq = ({ page }: { page: PublicPageDefinition }) => {
  if (!page.faq.length) return null;

  return (
    <section className="public-section-stage px-5 py-20 md:px-8 md:py-28">
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
              <summary className="public-tactile flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 rounded-2xl px-3 py-5 text-base font-black marker:hidden hover:bg-foreground/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/[0.045]">
                {faq.question}
                <span
                  aria-hidden="true"
                  className="text-xl text-muted-foreground transition-transform group-open:rotate-45 motion-reduce:transition-none"
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
  <section className="public-section-stage px-5 pb-20 md:px-8 md:pb-28">
    <div className="mx-auto max-w-[1180px] border-y border-border/45 py-10 dark:border-white/10">
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
        Continue explorando
      </p>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {page.related.map((link) => (
          <Link
            key={`${link.href}-${link.label}`}
            to={link.href}
            className="public-glass-capsule public-tactile group flex min-h-16 items-center justify-between gap-4 rounded-[22px] px-5 py-4 text-sm font-black hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white dark:hover:text-zinc-950"
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
  hero,
}: {
  page: PublicPageDefinition;
  children?: ReactNode;
  hero?: ReactNode;
}) {
  return (
    <div className="public-lumen-page min-h-screen overflow-x-hidden bg-background font-sans text-foreground">
      <div className="hidden md:block">
        <Navbar />
      </div>
      <LandingMobileNav />
      <main className="relative z-10">
        <PublicBreadcrumbs page={page} />
        {hero ?? <PublicProductHero page={page} />}
        <PageHighlights page={page} />
        {children}
        <PageSections page={page} />
        <PageFaq page={page} />
        <PageRelated page={page} />
        <section className="public-section-stage public-inverted-section px-5 py-20 text-center text-background dark:text-zinc-950 md:px-8 md:py-28">
          <div className="mx-auto max-w-[1180px]">
            <ShieldCheck aria-hidden="true" className="mx-auto h-7 w-7 opacity-55" />
            <h2 className="mx-auto mt-7 max-w-4xl text-balance text-4xl font-black leading-none md:text-6xl">
              Não conecte só uma parte do consultório.
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-relaxed opacity-65 md:text-lg">
              Conheça a operação completa da NeuroNex e veja como cada etapa continua a anterior.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                asChild
                className="public-tactile h-14 rounded-full bg-background px-7 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-foreground dark:bg-zinc-950 dark:text-white"
              >
                <Link to="/create-account">
                  Começar grátis <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="public-tactile h-14 rounded-full border-background/20 bg-transparent px-7 font-mono text-[10px] font-black uppercase text-background dark:border-zinc-950/20 dark:text-zinc-950"
              >
                <Link to="/comparar">Comparar com meu sistema atual</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
