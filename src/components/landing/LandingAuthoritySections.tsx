"use client";

import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Monitor,
  Smartphone,
  UserRound,
  Workflow,
} from "lucide-react";
import { Link } from "react-router-dom";

import { FadeIn } from "@/components/animations/FadeIn";
import { PublicStatusBadge } from "@/components/public/PublicPageShell";
import { PublicProductShowcase } from "@/components/public/PublicProductShowcase";
import {
  PUBLIC_ARTICLES,
  PUBLIC_UPDATES,
  getPublicPage,
} from "@/content/public-content";
import { getPublicMediaCollection } from "@/content/public-product-media";

const continuityMedia = getPublicMediaCollection("prontuario");

const ecosystemItems = [
  {
    icon: Monitor,
    title: "Professional",
    status: "Disponível" as const,
    text: "O espaço onde você agenda, atende, registra, cobra e acompanha a rotina do consultório.",
  },
  {
    icon: Smartphone,
    title: "Professional mobile",
    status: "Em evolução" as const,
    text: "Uma experiência mobile-first para ações rápidas. Esta frente ainda está em evolução.",
  },
  {
    icon: UserRound,
    title: "Portal do Paciente",
    status: "Disponível" as const,
    text: "Um lugar próprio para sessões, humor, tarefas, documentos, pacotes e cobranças compartilhadas.",
  },
  {
    icon: Workflow,
    title: "Jornadas públicas",
    status: "Disponível" as const,
    text: "Perfil, confirmações, convites, anamneses, ajuda e documentos legais sem abrir a área profissional.",
  },
];

export const LandingEcosystemAuthoritySection = () => (
  <section className="public-section-stage bg-background px-5 py-20 md:px-8 md:py-28">
    <div className="public-neurox-hero mx-auto max-w-[1480px] px-5 py-16 md:px-10 md:py-24">
      <FadeIn>
        <div className="mx-auto max-w-5xl text-center">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Acessos separados, rotina conectada
          </p>
          <h2 className="public-neurox-title mt-7 text-balance text-[clamp(2.8rem,6vw,4.8rem)] font-black leading-[1.02] tracking-tight">
            Cada pessoa vê o que precisa.<br />A rotina continua conectada.
          </h2>
          <p className="mx-auto mt-8 max-w-3xl text-base font-semibold leading-relaxed text-muted-foreground/78 md:text-2xl">
            O psicólogo trabalha na área profissional. O paciente acessa o Portal.
            Informações autorizadas continuam ligadas, sem misturar papéis ou permissões.
          </p>
        </div>
      </FadeIn>
      <div className="mt-14 grid overflow-hidden rounded-[36px] border border-border/45 dark:border-white/10 md:grid-cols-2 xl:grid-cols-4">
        {ecosystemItems.map((item, index) => (
          <FadeIn key={item.title} delay={index * 0.05}>
            <article className="public-ecosystem-node group h-full min-h-[268px] px-6 py-8 md:px-7 md:py-9">
              <div className="flex items-center justify-between gap-4">
                <item.icon className="h-6 w-6 text-muted-foreground" />
                {item.status !== "Disponível" ? (
                  <span className="font-mono text-[8px] font-black uppercase text-muted-foreground/68">
                    Em evolução
                  </span>
                ) : null}
              </div>
              <h3 className="mt-10 text-2xl font-black leading-tight">
                {item.title}
              </h3>
              <p className="mt-4 text-sm font-medium leading-relaxed text-muted-foreground/70">
                {item.text}
              </p>
            </article>
          </FadeIn>
        ))}
      </div>
      <div className="mt-9 text-center">
        <Link
          to="/produto"
          className="public-tactile inline-flex min-h-12 items-center rounded-full border border-border/55 bg-background/46 px-6 font-mono text-[10px] font-black uppercase tracking-[0.18em] backdrop-blur-xl dark:border-white/10"
        >
          Conhecer a operação completa{" "}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </div>
    </div>
  </section>
);

export const LandingContinuityAuthoritySection = () => {
  const portalPage = getPublicPage("/portal-do-paciente");
  const recordPage = getPublicPage("/prontuario-para-psicologos");
  if (!portalPage || !recordPage) return null;

  return (
    <section className="public-section-stage public-inverted-section px-6 py-20 text-background dark:text-zinc-950 md:py-28">
      <div className="mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <FadeIn>
          <div>
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] opacity-45">
              Continuidade com limites claros
            </p>
            <h2 className="mt-6 text-balance text-5xl font-black leading-[1.02] md:text-6xl">
              O prontuário fica com o profissional. O paciente recebe apenas o que foi compartilhado.
            </h2>
            <p className="mt-7 max-w-2xl text-base font-medium leading-relaxed opacity-66 md:text-xl">
              O profissional mantém resumo, sessões, anamneses, humor, metas,
              planos, financeiro e arquivos. O paciente acessa somente o que foi
              destinado ao seu espaço.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to={recordPage.route}
                className="public-tactile inline-flex min-h-12 items-center justify-center rounded-full bg-background px-5 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-foreground dark:bg-zinc-950 dark:text-white"
              >
                Ver prontuário <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                to={portalPage.route}
                className="public-tactile inline-flex min-h-12 items-center justify-center rounded-full border border-background/20 px-5 font-mono text-[10px] font-black uppercase tracking-[0.16em] dark:border-zinc-950/20"
              >
                Ver Portal do Paciente
              </Link>
            </div>
          </div>
        </FadeIn>
        <FadeIn delay={0.12}>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <PublicProductShowcase
                hideHeader
                title="Prontuário por dentro"
                images={continuityMedia}
                className="!bg-transparent !px-0 !py-0 text-foreground"
                frameClassName="!max-w-none"
              />
            </div>
            {[
              "Notas clínicas privadas permanecem na área profissional.",
              "Humor, tarefas e documentos compartilhados mantêm finalidade própria.",
              "Políticas de agenda aparecem antes de confirmar, remarcar ou cancelar.",
              "Pacotes e cobranças ficam visíveis conforme vínculo e permissão.",
            ].map((item) => (
              <div
                key={item}
                className="border-t border-background/15 py-4 text-sm font-bold leading-relaxed dark:border-zinc-950/15"
              >
                {item}
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
};

export const LandingKnowledgeAuthoritySection = () => (
  <section className="public-section-stage public-solid-subtle px-6 py-20 md:py-28">
    <div className="mx-auto max-w-[1240px]">
      <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
        <FadeIn>
          <div>
            <BookOpen className="h-7 w-7 text-muted-foreground" />
            <p className="mt-8 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Conteúdo e transparência
            </p>
            <h2 className="mt-5 text-balance text-5xl font-black leading-[1.02] md:text-6xl">
              Produto profundo exige explicação profunda.
            </h2>
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="border-y border-border/45 py-6 dark:border-white/10">
            {PUBLIC_UPDATES.map((update) => (
              <div
                key={`${update.status}-${update.title}`}
                className="flex items-center justify-between gap-5 border-b border-border/35 py-4 last:border-b-0 dark:border-white/10"
              >
                <div>
                  <p className="text-sm font-black">{update.title}</p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    {update.status}
                  </p>
                </div>
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
            <Link
              to="/novidades"
              className="mt-5 inline-flex min-h-11 items-center text-[10px] font-black uppercase tracking-[0.16em]"
            >
              Ver status público <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </FadeIn>
      </div>
      <div className="mt-14 grid gap-5 lg:grid-cols-3">
        {PUBLIC_ARTICLES.map((article, index) => (
          <FadeIn key={article.slug} delay={index * 0.05}>
            <article className="group h-full border-t border-border/55 py-6 dark:border-white/10">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {article.category}
              </p>
              <h3 className="mt-5 text-2xl font-black leading-tight">
                {article.title}
              </h3>
              <p className="mt-4 text-sm font-medium leading-relaxed text-muted-foreground/70">
                {article.excerpt}
              </p>
              <Link
                to={article.route}
                className="mt-7 inline-flex min-h-11 items-center text-[10px] font-black uppercase tracking-[0.16em]"
              >
                Ler artigo{" "}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </article>
          </FadeIn>
        ))}
      </div>
    </div>
  </section>
);

export const MobileAuthoritySections = () => (
  <>
    <section className="bg-background px-5 py-16">
      <div className="text-center">
        <p className="font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Acessos separados, rotina conectada
        </p>
        <h2 className="mt-5 text-[2.55rem] font-black leading-[0.92] tracking-normal">
          Cada pessoa vê o que precisa.
        </h2>
      </div>
      <div className="mt-10 divide-y divide-border/45 border-y border-border/45 dark:divide-white/10 dark:border-white/10">
        {ecosystemItems.map((item) => (
          <article key={item.title} className="py-6">
            <div className="flex items-start justify-between gap-4">
              <item.icon className="h-5 w-5 text-muted-foreground" />
              <PublicStatusBadge status={item.status} />
            </div>
            <h3 className="mt-5 text-xl font-black">{item.title}</h3>
            <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground/70">
              {item.text}
            </p>
          </article>
        ))}
      </div>
      <Link
        to="/produto"
        className="mt-7 inline-flex min-h-11 items-center text-[9px] font-black uppercase tracking-[0.16em]"
      >
        Conhecer a operação completa <ArrowRight className="ml-2 h-4 w-4" />
      </Link>
    </section>

    <section className="bg-foreground px-5 py-16 text-background dark:bg-white dark:text-zinc-950">
      <p className="font-mono text-[8px] font-bold uppercase tracking-[0.16em] opacity-45">
        Continuidade
      </p>
      <h2 className="mt-5 text-[2.55rem] font-black leading-[0.92] tracking-normal">
        O prontuário fica com o profissional. O paciente recebe o que foi compartilhado.
      </h2>
      <p className="mt-5 text-sm font-medium leading-relaxed opacity-64">
        Dados profissionais permanecem privados; humor, tarefas, documentos,
        progresso e financeiro são compartilhados conforme finalidade.
      </p>
      <div className="mt-8">
        <PublicProductShowcase
          hideHeader
          title="Prontuário por dentro"
          images={continuityMedia}
          className="!bg-transparent !px-0 !py-0 text-foreground"
          frameClassName="!max-w-none"
        />
      </div>
      <div className="mt-7 grid gap-3">
        <Link
          to="/prontuario-para-psicologos"
          className="flex min-h-12 items-center justify-between rounded-lg bg-background px-4 text-[9px] font-black uppercase tracking-[0.14em] text-foreground dark:bg-zinc-950 dark:text-white"
        >
          Ver prontuário <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          to="/portal-do-paciente"
          className="flex min-h-12 items-center justify-between rounded-lg border border-background/20 px-4 text-[9px] font-black uppercase tracking-[0.14em] dark:border-zinc-950/20"
        >
          Ver portal <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>

    <section className="bg-background px-5 py-16">
      <BookOpen className="h-6 w-6 text-muted-foreground" />
      <h2 className="mt-6 text-[2.55rem] font-black leading-[0.92] tracking-normal">
        Conteúdo para operar melhor.
      </h2>
      <div className="mt-9 divide-y divide-border/45 border-y border-border/45 dark:divide-white/10 dark:border-white/10">
        {PUBLIC_ARTICLES.map((article) => (
          <article key={article.slug} className="py-6">
            <p className="font-mono text-[8px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              {article.category}
            </p>
            <h3 className="mt-4 text-xl font-black leading-tight">
              {article.title}
            </h3>
            <Link
              to={article.route}
              className="mt-5 inline-flex min-h-11 items-center text-[9px] font-black uppercase tracking-[0.16em]"
            >
              Ler artigo <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </article>
        ))}
      </div>
    </section>
  </>
);
