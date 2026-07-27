"use client";

import { ArrowRight, BookOpen, CalendarDays, Mail, Newspaper } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";

import { Footer } from "@/components/landing/Footer";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { Navbar } from "@/components/landing/Navbar";
import { PublicBreadcrumbs } from "@/components/public/PublicPageShell";
import { Button } from "@/components/ui/button";
import { PUBLIC_ARTICLES, getPublicPage } from "@/content/public-content";
import { getPublicArticleMedia } from "@/content/public-product-media";
import { useTheme } from "@/hooks/use-theme";

const editorialTopics = [
  "Como escolher um sistema para psicólogos",
  "O que avaliar antes de trocar de prontuário",
  "Inteligência artificial para psicólogos",
  "Agenda, prontuário e financeiro integrados",
  "Quanto custa usar várias ferramentas no consultório",
  "Como reduzir tarefas administrativas",
  "Limites éticos da IA na psicologia",
];

const BlogIndex = () => {
  const page = getPublicPage("/blog");
  const shouldReduceMotion = useReducedMotion();
  const { theme } = useTheme();
  const mediaTheme = theme === "light" ? "light" : "dark";
  if (!page) return null;

  return (
    <div className="public-lumen-page min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="hidden md:block">
        <Navbar />
      </div>
      <LandingMobileNav />

      <main className="pt-24 md:pt-[6.5rem]">
        <PublicBreadcrumbs page={page} />

        <section className="px-5 pb-10 pt-0 md:px-8 md:pb-14">
          <div className="public-neurox-hero mx-auto flex min-h-[calc(100svh-6rem)] max-w-[1480px] items-center justify-center overflow-hidden px-5 py-20 text-center md:min-h-[calc(100svh-6.5rem)] md:px-10 md:py-24">
            <div className="relative z-10 mx-auto max-w-5xl">
              <motion.p
                initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-muted-foreground"
              >
                Conteúdo educativo da NeuroNex
              </motion.p>
              <motion.h1
                initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: shouldReduceMotion ? 0 : 0.06 }}
                className="public-neurox-title mt-7 text-balance text-[clamp(3rem,7vw,5.8rem)] font-black leading-[1.02] tracking-tight"
              >
                NeuroX.
              </motion.h1>
              <motion.p
                initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: shouldReduceMotion ? 0 : 0.12 }}
                className="mx-auto mt-8 max-w-3xl text-pretty text-xl font-semibold leading-relaxed text-muted-foreground/82 md:mt-10 md:text-3xl"
              >
                Ideias claras sobre tecnologia, rotina clínica, gestão e dinheiro para ajudar você a decidir melhor.
              </motion.p>
              <motion.div
                initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: shouldReduceMotion ? 0 : 0.18 }}
                className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
              >
                <Button
                  asChild
                  className="public-tactile h-14 min-w-[190px] rounded-full bg-foreground px-7 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-background shadow-[0_18px_45px_-24px_hsl(var(--foreground)/0.72)]"
                >
                  <a href="#edicoes">
                    Ler edições <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="public-tactile h-14 min-w-[190px] rounded-full border-border/70 bg-background/46 px-7 font-mono text-[10px] font-black uppercase tracking-[0.18em] backdrop-blur-xl"
                >
                  <Link to="/comparar">Comparar sistemas</Link>
                </Button>
              </motion.div>
            </div>
          </div>
        </section>

        <section id="edicoes" className="px-5 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-[1320px]">
            <div className="mb-10 flex flex-col justify-between gap-5 border-t border-border/45 pt-8 dark:border-white/10 md:flex-row md:items-end">
              <div>
                <p className="font-mono text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                  Edições recentes
                </p>
                <h2 className="mt-4 text-4xl font-black leading-none md:text-6xl">
                  Conteúdo para quem também administra um consultório.
                </h2>
              </div>
              <p className="max-w-md text-sm font-medium leading-relaxed text-muted-foreground/72">
                Cada texto parte de uma dúvida concreta sobre agenda, pacientes, dinheiro, tecnologia ou limites da inteligência artificial.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {PUBLIC_ARTICLES.map((article, index) => {
                const articleMedia = getPublicArticleMedia(
                  article.slug,
                  mediaTheme,
                );

                return (
                <motion.article
                  key={article.slug}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ delay: shouldReduceMotion ? 0 : index * 0.06 }}
                  className="public-neurox-card group overflow-hidden rounded-[28px]"
                >
                  <Link to={article.route} className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {articleMedia ? (
                      <div className="overflow-hidden bg-muted/25 dark:bg-black">
                        <img
                          src={articleMedia.src}
                          alt={articleMedia.alt}
                          width={640}
                          height={360}
                          loading="lazy"
                          decoding="async"
                          className="aspect-video w-full object-contain transition-transform duration-700 group-hover:scale-[1.018] motion-reduce:transition-none"
                        />
                      </div>
                    ) : null}
                    <div className="flex min-h-[294px] flex-col p-6">
                      <div className="flex items-center justify-between gap-3 font-mono text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground/78">
                        <span>{article.category}</span>
                        <CalendarDays aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                      </div>
                      <h3 className="mt-6 text-2xl font-black leading-tight">
                        {article.title}
                      </h3>
                      <p className="mt-4 text-sm font-medium leading-relaxed text-muted-foreground/72">
                        {article.excerpt}
                      </p>
                      <span className="mt-auto inline-flex min-h-11 items-center pt-8 font-mono text-[10px] font-black uppercase tracking-[0.16em]">
                        Ler edição <ArrowRight className="ml-2 h-4 w-4" />
                      </span>
                    </div>
                  </Link>
                </motion.article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-5 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-[1180px]">
            <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr]">
              <div>
                <BookOpen aria-hidden="true" className="h-6 w-6 text-muted-foreground" />
                <p className="mt-7 font-mono text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  Temas da biblioteca
                </p>
                <h2 className="mt-4 text-4xl font-black leading-none md:text-5xl">
                  Uma linha editorial para decisões reais.
                </h2>
              </div>
              <ul className="divide-y divide-border/45 border-y border-border/45 dark:divide-white/10 dark:border-white/10">
                {editorialTopics.map((topic) => (
                  <li key={topic} className="flex min-h-14 items-center py-4 text-sm font-bold leading-relaxed md:text-base">
                    {topic}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="public-inverted-section px-5 py-20 text-background dark:text-zinc-950 md:px-8 md:py-28">
          <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <Newspaper className="h-7 w-7 opacity-55" />
              <p className="mt-8 font-mono text-[9px] font-black uppercase tracking-[0.22em] opacity-45">
                NeuroX
              </p>
              <h2 className="mt-4 text-4xl font-black leading-none md:text-6xl">
                Uma newsletter para pensar a clínica antes da próxima ferramenta.
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "IA com controle profissional",
                "Operação clínica sem retrabalho",
                "Financeiro claro para psicólogos",
                "Continuidade entre sessões",
              ].map((item) => (
                <div
                  key={item}
                  className="min-h-24 border-t border-background/14 py-5 text-lg font-black leading-tight dark:border-zinc-950/14"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-16 md:px-8 md:py-24">
          <div className="mx-auto flex max-w-[1180px] flex-col gap-5 border-y border-border/45 py-8 dark:border-white/10 md:flex-row md:items-start">
            <BookOpen className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
            <p className="max-w-3xl text-sm font-medium leading-relaxed text-muted-foreground/72">
              Os textos da NeuroX são educativos, têm autoria e revisão
              identificadas e não substituem orientação clínica, jurídica,
              fiscal ou regulatória.
            </p>
            <Mail className="ml-auto hidden h-5 w-5 text-muted-foreground md:block" />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default BlogIndex;
