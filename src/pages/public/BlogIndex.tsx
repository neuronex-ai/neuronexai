"use client";

import { ArrowRight, BookOpen, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";

import {
  PublicBreadcrumbs,
  PublicPageHero,
} from "@/components/public/PublicPageShell";
import { Footer } from "@/components/landing/Footer";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { Navbar } from "@/components/landing/Navbar";
import { PUBLIC_ARTICLES, getPublicPage } from "@/content/public-content";

const BlogIndex = () => {
  const page = getPublicPage("/blog");
  if (!page) return null;

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="hidden md:block">
        <Navbar />
      </div>
      <LandingMobileNav />
      <main className="pt-24 md:pt-32">
        <PublicBreadcrumbs page={page} />
        <PublicPageHero page={page} />
        <section className="px-5 pb-20 md:px-8 md:pb-28">
          <div className="mx-auto max-w-[1240px]">
            <div className="grid gap-5 lg:grid-cols-3">
              {PUBLIC_ARTICLES.map((article) => (
                <article
                  key={article.slug}
                  className="group flex h-full flex-col overflow-hidden rounded-lg border border-border/45 bg-card/70 dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <div className="overflow-hidden">
                    <img
                      src={article.image}
                      alt={article.imageAlt}
                      width={1280}
                      height={720}
                      loading="lazy"
                      decoding="async"
                      className="aspect-video w-full object-cover transition-transform duration-500 motion-reduce:transition-none group-hover:scale-[1.02]"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-center justify-between gap-4 text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                      <span>{article.category}</span>
                      <span className="inline-flex items-center gap-2">
                        <CalendarDays className="h-3.5 w-3.5" />
                        16 jul. 2026
                      </span>
                    </div>
                    <h2 className="mt-6 text-2xl font-black leading-tight">
                      {article.title}
                    </h2>
                    <p className="mt-4 text-sm font-medium leading-relaxed text-muted-foreground/72">
                      {article.excerpt}
                    </p>
                    <Link
                      to={article.route}
                      className="mt-auto inline-flex min-h-11 items-center pt-8 text-[10px] font-black uppercase tracking-[0.16em]"
                    >
                      Ler artigo <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-14 flex items-start gap-4 border-y border-border/45 py-8 dark:border-white/10">
              <BookOpen className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
              <p className="max-w-3xl text-sm font-medium leading-relaxed text-muted-foreground/72">
                Os artigos são educativos, identificam autoria e revisão e não
                substituem orientação clínica, jurídica, fiscal ou regulatória.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default BlogIndex;
