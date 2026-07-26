"use client";

import {
  ArrowRight,
  BadgeCheck,
  GitCompareArrows,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Footer } from "@/components/landing/Footer";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { Navbar } from "@/components/landing/Navbar";
import { Button } from "@/components/ui/button";
import {
  COMPARISON_GUIDE,
  COMPARISON_INDEX_META,
  COMPARISONS,
} from "@/content/comparison-content";

const ComparisonIndex = () => {
  return (
    <div className="public-lumen-page min-h-screen overflow-x-hidden bg-background font-sans text-foreground">
      <div className="hidden md:block">
        <Navbar />
      </div>
      <LandingMobileNav />

      <main className="relative z-10 pt-24 md:pt-[6.5rem]">
        <nav
          aria-label="Navegação estrutural"
          className="mx-auto flex min-h-11 max-w-[1240px] items-center gap-2 px-5 text-xs font-bold text-muted-foreground md:px-8"
        >
          <Link
            to="/"
            className="rounded-lg py-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Início
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-foreground/75">
            Comparar sistemas
          </span>
        </nav>

        <section className="px-5 pb-16 pt-12 text-center md:px-8 md:pb-24 md:pt-20">
          <div className="mx-auto max-w-5xl">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">
              Escolha com contexto
            </p>
            <h1 className="mx-auto mt-7 max-w-[14ch] text-balance text-[clamp(3rem,6vw,5.4rem)] font-black leading-[1.02] tracking-tight">
              Compare sistemas para psicólogos
            </h1>
            <p className="mx-auto mt-8 max-w-3xl text-pretty text-lg font-semibold leading-relaxed text-muted-foreground/80 md:text-2xl">
              Compare não só a lista de recursos, mas o trabalho que sobra
              depois de usá-los. Aqui você entende o foco de cada proposta e
              o que muda entre uma IA textual e uma operação conectada.
            </p>
            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                asChild
                className="public-tactile h-14 rounded-full bg-foreground px-7 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-background"
              >
                <a href="#comparacoes">
                  Ver comparações <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                className="public-tactile h-14 rounded-full border-border/70 bg-background/45 px-7 font-mono text-[10px] font-black uppercase tracking-[0.16em] backdrop-blur-xl"
              >
                <Link to="/produto">Conhecer a NeuroNex</Link>
              </Button>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="comparison-principle-title"
          className="public-inverted-section px-5 py-16 text-background dark:text-zinc-950 md:px-8 md:py-20"
        >
          <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
            <div>
              <Scale aria-hidden="true" className="h-7 w-7 opacity-55" />
              <p className="mt-8 font-mono text-[9px] font-black uppercase tracking-[0.2em] opacity-50">
                Comparação justa
              </p>
            </div>
            <div>
              <h2
                id="comparison-principle-title"
                className="text-balance text-4xl font-black leading-[0.98] md:text-6xl"
              >
                Cada sistema resolve bem determinadas partes da clínica.
              </h2>
              <p className="mt-6 max-w-3xl text-base font-medium leading-relaxed opacity-70 md:text-lg">
                A NeuroNex foi projetada para fazer essas partes trabalharem
                juntas. As comparações abaixo reconhecem o foco de cada
                concorrente e não tratam recursos como uma disputa de “tem ou
                não tem”.
              </p>
              <p className="mt-8 border-t border-background/15 pt-5 text-sm font-medium opacity-60 dark:border-zinc-950/15">
                Informações organizadas a partir de dados públicos verificados
                em <time dateTime={COMPARISON_INDEX_META.reviewedAt}>julho de 2026</time>.
                Recursos, planos e condições podem mudar; confirme os detalhes
                diretamente com cada fornecedor.
              </p>
            </div>
          </div>
        </section>

        <section
          id="comparacoes"
          aria-labelledby="comparison-list-title"
          className="scroll-mt-24 px-5 py-20 md:px-8 md:py-28"
        >
          <div className="mx-auto max-w-[1240px]">
            <div className="max-w-3xl">
              <GitCompareArrows
                aria-hidden="true"
                className="h-7 w-7 text-muted-foreground"
              />
              <p className="mt-7 font-mono text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                Comparações disponíveis
              </p>
              <h2
                id="comparison-list-title"
                className="mt-4 text-balance text-4xl font-black leading-none md:text-6xl"
              >
                Entenda a proposta antes de olhar a lista de recursos.
              </h2>
            </div>

            <div className="mt-12 grid gap-4 lg:grid-cols-2">
              {COMPARISONS.map((comparison) => (
                <article
                  key={comparison.slug}
                  className="public-neurox-card flex min-h-[360px] flex-col rounded-[28px] p-6 md:p-8"
                >
                  <div className="flex items-start justify-between gap-5">
                    <div>
                      <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                        NeuroNex vs
                      </p>
                      <h3 className="mt-3 text-3xl font-black leading-none md:text-4xl">
                        {comparison.competitor}
                      </h3>
                    </div>
                    <BadgeCheck
                      aria-hidden="true"
                      className="h-6 w-6 shrink-0 text-muted-foreground"
                    />
                  </div>

                  <dl className="mt-8 grid gap-6 sm:grid-cols-2">
                    <div className="border-t border-border/55 pt-4 dark:border-white/10">
                      <dt className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                        Principal vantagem
                      </dt>
                      <dd className="mt-3 text-sm font-semibold leading-relaxed">
                        {comparison.competitorAdvantage}
                      </dd>
                    </div>
                    <div className="border-t border-border/55 pt-4 dark:border-white/10">
                      <dt className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                        Faz mais sentido para
                      </dt>
                      <dd className="mt-3 text-sm font-semibold leading-relaxed">
                        {comparison.competitorBestUse}
                      </dd>
                    </div>
                  </dl>

                  <Link
                    to={comparison.route}
                    className="public-tactile mt-auto flex min-h-12 items-center justify-between gap-4 rounded-2xl border border-border/60 px-4 py-3 text-sm font-black hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/10 dark:hover:bg-white dark:hover:text-zinc-950"
                    aria-label={`Comparar NeuroNex e ${comparison.competitor}`}
                  >
                    Ver comparação completa
                    <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          aria-labelledby="comparison-guide-title"
          className="border-y border-border/45 px-5 py-20 dark:border-white/10 md:px-8 md:py-28"
        >
          <div className="mx-auto max-w-[1180px]">
            <p className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              Resumo por prioridade
            </p>
            <h2
              id="comparison-guide-title"
              className="mt-4 max-w-3xl text-balance text-4xl font-black leading-none md:text-6xl"
            >
              Comece pelo que mais pesa na sua rotina.
            </h2>

            <ul className="mt-12 grid gap-3 md:grid-cols-2">
              {COMPARISON_GUIDE.map((item) => (
                <li key={item.label}>
                  <Link
                    to={item.href}
                    className="public-glass-capsule public-tactile flex min-h-20 items-center justify-between gap-5 rounded-[22px] px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="text-sm font-semibold text-muted-foreground">
                      {item.label}
                    </span>
                    <strong className="inline-flex items-center gap-2 text-right text-sm font-black">
                      {item.choice}
                      <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                    </strong>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="public-inverted-section px-5 py-20 text-center text-background dark:text-zinc-950 md:px-8 md:py-28">
          <div className="mx-auto max-w-4xl">
            <ShieldCheck aria-hidden="true" className="mx-auto h-7 w-7 opacity-55" />
            <h2 className="mt-7 text-balance text-4xl font-black leading-none md:text-6xl">
              Não quer otimizar apenas uma parte da clínica?
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-relaxed opacity-70 md:text-lg">
              Conheça a operação completa da NeuroNex e veja como agenda,
              atendimento, paciente, documentos, cobranças, financeiro e IA
              trabalham juntos.
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
                <Link to="/produto">Ver como funciona</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default ComparisonIndex;
