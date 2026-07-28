"use client";

import {
  ArrowRight,
  BadgeCheck,
  Check,
  CircleCheck,
  Compass,
  GitCompareArrows,
  Info,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";

import { Footer } from "@/components/landing/Footer";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { Navbar } from "@/components/landing/Navbar";
import {
  PublicTimeGainSection,
  PublicWorkflowComparisonSection,
} from "@/components/public/PublicPositioningSections";
import { Button } from "@/components/ui/button";
import {
  type ComparisonDefinition,
  type ComparisonSlug,
  getComparisonBySlug,
} from "@/content/comparison-content";

const ComparisonBreadcrumbs = ({ comparison }: { comparison: ComparisonDefinition }) => (
  <nav
    aria-label="Navegação estrutural"
    className="mx-auto flex min-h-11 max-w-[1240px] items-center gap-2 overflow-x-auto whitespace-nowrap px-5 text-xs font-bold text-muted-foreground md:px-8"
  >
    <Link
      to="/"
      className="rounded-lg py-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      Início
    </Link>
    <span aria-hidden="true">/</span>
    <Link
      to="/comparar"
      className="rounded-lg py-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      Comparar
    </Link>
    <span aria-hidden="true">/</span>
    <span aria-current="page" className="truncate text-foreground/75">
      NeuroNex vs {comparison.competitor}
    </span>
  </nav>
);

const QuickSummary = ({ comparison }: { comparison: ComparisonDefinition }) => (
  <section
    aria-labelledby="quick-summary-title"
    className="px-5 py-20 md:px-8 md:py-28"
  >
    <div className="mx-auto max-w-[1180px]">
      <div className="max-w-3xl">
        <GitCompareArrows aria-hidden="true" className="h-7 w-7 text-muted-foreground" />
        <p className="mt-7 font-mono text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
          Resumo rápido
        </p>
        <h2
          id="quick-summary-title"
          className="mt-4 text-balance text-4xl font-black leading-none md:text-6xl"
        >
          Duas propostas para prioridades diferentes.
        </h2>
      </div>

      <div className="mt-12 grid gap-4 lg:grid-cols-2">
        <article className="public-neurox-card rounded-[28px] p-6 md:p-8">
          <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">
            {comparison.competitor}
          </p>
          <h3 className="mt-4 text-2xl font-black leading-tight">
            {comparison.competitorAdvantage}
          </h3>
          <div className="mt-8 border-t border-border/55 pt-5 dark:border-white/10">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
              Faz mais sentido para
            </p>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-muted-foreground/80">
              {comparison.competitorBestUse}
            </p>
          </div>
        </article>

        <article className="public-inverted-section rounded-[28px] p-6 text-background dark:text-zinc-950 md:p-8">
          <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] opacity-50">
            NeuroNex
          </p>
          <h3 className="mt-4 text-2xl font-black leading-tight">
            {comparison.neuroNexAdvantage}
          </h3>
          <div className="mt-8 border-t border-background/15 pt-5 dark:border-zinc-950/15">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] opacity-50">
              Faz mais sentido para
            </p>
            <p className="mt-3 text-sm font-semibold leading-relaxed opacity-75">
              {comparison.neuroNexBestUse}
            </p>
          </div>
        </article>
      </div>
    </div>
  </section>
);

const Perspective = ({ comparison }: { comparison: ComparisonDefinition }) => (
  <div className="public-section-sequence">
    <section className="border-y border-border/45 px-5 py-20 dark:border-white/10 md:px-8 md:py-28">
      <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
        <div>
          <Scale aria-hidden="true" className="h-7 w-7 text-muted-foreground" />
          <p className="mt-8 font-mono text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            O que {comparison.competitor} faz bem
          </p>
        </div>
        <article>
          <h2 className="text-balance text-4xl font-black leading-[0.98] md:text-6xl">
            Uma escolha válida para a prioridade certa.
          </h2>
          <p className="mt-6 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground/78 md:text-lg">
            {comparison.competitorRecognition}
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {comparison.competitorStrengths.map((strength) => (
              <li
                key={strength}
                className="flex min-h-14 items-center gap-3 border-t border-border/55 py-4 text-sm font-bold dark:border-white/10"
              >
                <BadgeCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
                {strength}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>

    <section className="public-inverted-section px-5 py-20 text-background dark:text-zinc-950 md:px-8 md:py-28">
      <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
        <div>
          <Compass aria-hidden="true" className="h-7 w-7 opacity-55" />
          <p className="mt-8 font-mono text-[9px] font-black uppercase tracking-[0.2em] opacity-50">
            A mudança de perspectiva
          </p>
        </div>
        <article>
          <h2 className="text-balance text-4xl font-black leading-[0.98] md:text-6xl">
            A NeuroNex conecta as partes da rotina.
          </h2>
          <p className="mt-6 max-w-3xl text-base font-medium leading-relaxed opacity-72 md:text-lg">
            {comparison.neuroNexDifference}
          </p>
          <Link
            to="/produto"
            className="public-tactile mt-8 inline-flex min-h-12 items-center gap-2 rounded-full border border-background/20 px-5 py-3 text-sm font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background dark:border-zinc-950/20 dark:focus-visible:ring-zinc-950"
          >
            Conhecer a operação completa
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </article>
      </div>
    </section>
  </div>
);

const UseCaseComparison = ({ comparison }: { comparison: ComparisonDefinition }) => (
  <section
    aria-labelledby="use-case-title"
    className="px-5 py-20 md:px-8 md:py-28"
  >
    <div className="mx-auto max-w-[1180px]">
      <div className="max-w-4xl">
        <p className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
          Comparação por casos de uso
        </p>
        <h2
          id="use-case-title"
          className="mt-4 text-balance text-4xl font-black leading-none md:text-6xl"
        >
          Compare o foco e a forma de uso, não uma lista de “sim” e “não”.
        </h2>
        <p className="mt-6 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground/75 md:text-lg">
          Os pontos abaixo descrevem as propostas consideradas nesta página.
          Eles não afirmam que uma função está ausente quando essa informação
          não foi confirmada.
        </p>
      </div>

      <div className="mt-12 divide-y divide-border/50 border-y border-border/50 dark:divide-white/10 dark:border-white/10">
        {comparison.comparisonRows.map((row) => (
          <article
            key={row.topic}
            className="grid gap-6 py-8 lg:grid-cols-[0.5fr_1fr_1fr] lg:gap-8"
          >
            <div>
              <h3 className="text-xl font-black leading-tight">{row.topic}</h3>
              {row.relatedHref ? (
                <Link
                  to={row.relatedHref}
                  className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl py-2 text-xs font-black text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Ver na NeuroNex
                  <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </div>
            <div className="rounded-[22px] bg-muted/40 p-5 dark:bg-white/[0.04]">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                {comparison.competitor}
              </p>
              <p className="mt-3 text-sm font-semibold leading-relaxed">
                {row.competitorPerspective}
              </p>
            </div>
            <div className="rounded-[22px] border border-border/65 p-5 dark:border-white/10">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                NeuroNex
              </p>
              <p className="mt-3 text-sm font-semibold leading-relaxed">
                {row.neuroNexPerspective}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  </section>
);

const ChoiceSection = ({ comparison }: { comparison: ComparisonDefinition }) => (
  <section
    aria-labelledby="choice-title"
    className="border-y border-border/45 px-5 py-20 dark:border-white/10 md:px-8 md:py-28"
  >
    <div className="mx-auto max-w-[1180px]">
      <p className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
        Quando escolher cada um
      </p>
      <h2
        id="choice-title"
        className="mt-4 max-w-3xl text-balance text-4xl font-black leading-none md:text-6xl"
      >
        A melhor escolha começa pela sua prioridade.
      </h2>

      <div className="mt-12 grid gap-4 lg:grid-cols-2">
        <article className="public-neurox-card rounded-[28px] p-6 md:p-8">
          <h3 className="text-2xl font-black leading-tight">
            Escolha {comparison.competitor} se…
          </h3>
          <ul className="mt-7 space-y-4">
            {comparison.chooseCompetitorIf.map((reason) => (
              <li key={reason} className="flex gap-3 text-sm font-semibold leading-relaxed">
                <CircleCheck
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
                />
                {reason}
              </li>
            ))}
          </ul>
        </article>

        <article className="public-neurox-card rounded-[28px] p-6 md:p-8">
          <h3 className="text-2xl font-black leading-tight">
            Escolha a NeuroNex se…
          </h3>
          <ul className="mt-7 space-y-4">
            {comparison.chooseNeuroNexIf.map((reason) => (
              <li key={reason} className="flex gap-3 text-sm font-semibold leading-relaxed">
                <Check
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
                />
                {reason}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </div>
  </section>
);

const ComparisonFaq = ({ comparison }: { comparison: ComparisonDefinition }) => (
  <section
    aria-labelledby="comparison-faq-title"
    className="px-5 py-20 md:px-8 md:py-28"
  >
    <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[0.72fr_1.28fr]">
      <div>
        <Info aria-hidden="true" className="h-7 w-7 text-muted-foreground" />
        <p className="mt-8 font-mono text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
          Perguntas frequentes
        </p>
        <h2
          id="comparison-faq-title"
          className="mt-4 text-balance text-4xl font-black leading-none md:text-5xl"
        >
          Respostas diretas antes de decidir.
        </h2>
      </div>

      <div className="divide-y divide-border/50 border-y border-border/50 dark:divide-white/10 dark:border-white/10">
        {comparison.faq.map((faq) => (
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
            <p className="max-w-3xl px-3 pb-6 text-sm font-medium leading-relaxed text-muted-foreground/78 md:text-base">
              {faq.answer}
            </p>
          </details>
        ))}
      </div>
    </div>
  </section>
);

const RelatedLinks = ({ comparison }: { comparison: ComparisonDefinition }) => (
  <section
    aria-labelledby="related-links-title"
    className="px-5 pb-20 md:px-8 md:pb-28"
  >
    <div className="mx-auto max-w-[1180px] border-y border-border/45 py-10 dark:border-white/10">
      <p className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
        Continue explorando
      </p>
      <h2 id="related-links-title" className="sr-only">
        Páginas relacionadas à comparação
      </h2>
      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {comparison.related.map((link) => (
          <Link
            key={link.href}
            to={link.href}
            className="public-glass-capsule public-tactile group flex min-h-24 flex-col justify-between gap-3 rounded-[22px] px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex items-center justify-between gap-4 text-sm font-black">
              {link.label}
              <ArrowRight
                aria-hidden="true"
                className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1 motion-reduce:transition-none"
              />
            </span>
            <span className="text-xs font-medium leading-relaxed text-muted-foreground">
              {link.description}
            </span>
          </Link>
        ))}
      </div>
    </div>
  </section>
);

export const ComparisonLanding = ({ slug }: { slug?: ComparisonSlug | string }) => {
  const params = useParams<{ slug: string }>();
  const comparison = getComparisonBySlug(slug ?? params.slug);

  if (!comparison) return <Navigate to="/404" replace />;

  return (
    <div className="public-lumen-page min-h-screen overflow-x-hidden bg-background font-sans text-foreground">
      <div className="hidden md:block">
        <Navbar />
      </div>
      <LandingMobileNav />

      <main className="relative z-10 pt-24 md:pt-[6.5rem]">
        <ComparisonBreadcrumbs comparison={comparison} />

        <section className="px-5 pb-16 pt-12 text-center md:px-8 md:pb-24 md:pt-20">
          <div className="mx-auto max-w-5xl">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">
              Comparação para psicólogos
            </p>
            <h1 className="mx-auto mt-7 max-w-[16ch] text-balance text-[clamp(3rem,6vw,5.4rem)] font-black leading-[1.02] tracking-tight">
              NeuroNex vs {comparison.competitor}
            </h1>
            <p className="mx-auto mt-8 max-w-3xl text-pretty text-lg font-semibold leading-relaxed text-muted-foreground/80 md:text-2xl">
              {comparison.heroText}
            </p>
            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                asChild
                className="public-tactile h-14 rounded-full bg-foreground px-7 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-background"
              >
                <Link to="/create-account">
                  Começar grátis <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="public-tactile h-14 rounded-full border-border/70 bg-background/45 px-7 font-mono text-[10px] font-black uppercase tracking-[0.16em] backdrop-blur-xl"
              >
                <Link to="/produto">Ver como funciona</Link>
              </Button>
            </div>
            <p className="mx-auto mt-8 max-w-2xl text-xs font-medium leading-relaxed text-muted-foreground/65">
              Informações organizadas a partir de dados públicos verificados em{" "}
              <time dateTime={comparison.reviewedAt}>julho de 2026</time>.
              Recursos, planos e condições podem mudar; confirme os detalhes
              diretamente com cada fornecedor.
            </p>
          </div>
        </section>

        <QuickSummary comparison={comparison} />
        <Perspective comparison={comparison} />
        <UseCaseComparison comparison={comparison} />
        <PublicWorkflowComparisonSection competitor={comparison.competitor} />
        <PublicTimeGainSection />
        <ChoiceSection comparison={comparison} />
        <ComparisonFaq comparison={comparison} />
        <RelatedLinks comparison={comparison} />

        <section className="public-inverted-section px-5 py-20 text-center text-background dark:text-zinc-950 md:px-8 md:py-28">
          <div className="mx-auto max-w-4xl">
            <ShieldCheck aria-hidden="true" className="mx-auto h-7 w-7 opacity-55" />
            <h2 className="mt-7 text-balance text-4xl font-black leading-none md:text-6xl">
              Não quer otimizar apenas uma parte da clínica?
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-relaxed opacity-70 md:text-lg">
              Conheça a operação completa da NeuroNex e veja se ela combina
              com a forma como você quer cuidar do consultório.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                asChild
                className="public-tactile h-14 rounded-full bg-background px-7 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-foreground dark:bg-zinc-950 dark:text-white"
              >
                <Link to="/create-account">
                  Começar grátis <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="public-tactile h-14 rounded-full border-background/20 bg-transparent px-7 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-background dark:border-zinc-950/20 dark:text-zinc-950"
              >
                <Link to="/comparar">Ver outras comparações</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default ComparisonLanding;
