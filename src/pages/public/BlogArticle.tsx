"use client";

import { ArrowRight, CalendarDays, ShieldCheck } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Link, useParams } from "react-router-dom";
import remarkGfm from "remark-gfm";

import { Footer } from "@/components/landing/Footer";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { Navbar } from "@/components/landing/Navbar";
import {
  PublicBreadcrumbs,
  PublicStatusBadge,
} from "@/components/public/PublicPageShell";
import {
  PublicTimeGainSection,
  PublicWorkflowComparisonSection,
} from "@/components/public/PublicPositioningSections";
import { getPublicArticleBody } from "@/content/public-article-content";
import { getPublicArticle, getPublicAuthor } from "@/content/public-content";
import { getPublicArticleMedia } from "@/content/public-product-media";
import { useTheme } from "@/hooks/use-theme";

const articleDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

const formatArticleDate = (date: string) =>
  articleDateFormatter.format(new Date(date));

const BlogArticle = () => {
  const { slug = "" } = useParams<{ slug: string }>();
  const { theme } = useTheme();
  const article = getPublicArticle(slug);
  if (!article) return null;

  const articleMedia = getPublicArticleMedia(
    article.slug,
    theme === "light" ? "light" : "dark",
  );
  const author = getPublicAuthor(article.authorId);
  const body = getPublicArticleBody(article).replace(/^# .+\r?\n+/u, "");
  const publishedAt = formatArticleDate(article.publishedAt);
  const modifiedAt = formatArticleDate(article.modifiedAt);
  const wasReviewedOnPublication =
    article.publishedAt.slice(0, 10) === article.modifiedAt.slice(0, 10);

  return (
    <div className="public-lumen-page min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="hidden md:block">
        <Navbar />
      </div>
      <LandingMobileNav />
      <main className="pt-24 md:pt-32">
        <PublicBreadcrumbs articleTitle={article.title} />
        <article>
          <header className="px-5 pb-10 pt-0 md:px-8 md:pb-14">
            <div className="public-neurox-hero mx-auto max-w-[1320px] px-8 py-16 md:px-14 md:py-20">
              <div className="mx-auto max-w-[1120px]">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                    {article.category}
                  </span>
                  <PublicStatusBadge status="Disponível" />
                </div>
                <h1 className="public-neurox-title mt-8 max-w-5xl text-balance text-[clamp(2.8rem,6vw,5.2rem)] font-black leading-[1.04] tracking-tight">
                  {article.title}
                </h1>
                <p className="mt-7 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground/74 md:text-xl">
                  {article.description}
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-5 border-y border-border/45 py-5 text-sm text-muted-foreground dark:border-white/10">
                  <span className="font-bold text-foreground">
                    {author?.name ?? "Equipe NeuroNex"}
                  </span>
                  <span>{author?.role}</span>
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays aria-hidden="true" className="h-4 w-4" />
                    {wasReviewedOnPublication ? (
                      <>
                        Publicado e revisado em{" "}
                        <time dateTime={article.publishedAt}>{publishedAt}</time>
                      </>
                    ) : (
                      <>
                        Publicado em{" "}
                        <time dateTime={article.publishedAt}>{publishedAt}</time>
                        {" · "}
                        revisado em{" "}
                        <time dateTime={article.modifiedAt}>{modifiedAt}</time>
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </header>

          {articleMedia ? (
            <div className="px-5 md:px-8">
              <div className="public-scroll-showcase mx-auto max-w-[1240px] overflow-hidden rounded-[34px] p-3 md:p-4">
                <img
                  src={articleMedia.src}
                  alt={articleMedia.alt}
                  width={1280}
                  height={720}
                  loading="eager"
                  decoding="async"
                  className="aspect-video w-full bg-muted/25 object-contain dark:bg-black"
                />
              </div>
            </div>
          ) : null}

          <div className="px-5 py-16 md:px-8 md:py-24">
            <div className="prose prose-zinc mx-auto max-w-[780px] dark:prose-invert prose-headings:scroll-mt-28 prose-headings:font-black prose-headings:tracking-normal prose-p:font-medium prose-p:leading-relaxed prose-p:text-muted-foreground prose-a:font-bold prose-a:text-foreground prose-li:text-muted-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
            </div>
          </div>

          {article.category === "Comparativos" ? (
            <>
              <PublicWorkflowComparisonSection />
              <PublicTimeGainSection />
            </>
          ) : null}
        </article>

        <section className="px-5 pb-20 md:px-8 md:pb-28">
          <div className="mx-auto max-w-[1120px] border-y border-border/45 py-10 dark:border-white/10">
            <div className="flex items-start gap-4">
              <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
              <div>
                <h2 className="text-xl font-black">Continue explorando</h2>
                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  {article.related.map((link) => (
                    <Link
                      key={link.href}
                      to={link.href}
                      className="group flex min-h-14 items-center justify-between gap-4 rounded-lg border border-border/45 px-4 py-3 text-sm font-black hover:bg-foreground hover:text-background dark:border-white/10 dark:hover:bg-white dark:hover:text-zinc-950"
                    >
                      {link.label}
                      <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default BlogArticle;
