"use client";

import { CalendarDays, CircleDot } from "lucide-react";

import { Footer } from "@/components/landing/Footer";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { Navbar } from "@/components/landing/Navbar";
import {
  PublicBreadcrumbs,
  PublicPageHero,
  PublicStatusBadge,
} from "@/components/public/PublicPageShell";
import { PUBLIC_UPDATES, getPublicPage } from "@/content/public-content";

const formatPublicDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));

const UpdatesLanding = () => {
  const page = getPublicPage("/novidades");
  if (!page) return null;

  return (
    <div className="public-lumen-page min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="hidden md:block">
        <Navbar />
      </div>
      <LandingMobileNav />
      <main className="pt-24 md:pt-32">
        <PublicBreadcrumbs page={page} />
        <PublicPageHero page={page} />
        <section className="public-section-stage px-5 pb-20 md:px-8 md:pb-28">
          <div className="mx-auto max-w-[1040px] border-y border-border/45 dark:border-white/10">
            {PUBLIC_UPDATES.map((update) => (
              <article
                key={`${update.date}-${update.title}`}
                className="public-tactile grid gap-6 rounded-[28px] border-b border-border/45 px-5 py-10 last:border-b-0 hover:bg-foreground/[0.035] dark:border-white/10 dark:hover:bg-white/[0.04] md:grid-cols-[190px_minmax(0,1fr)] md:px-7"
              >
                <div>
                  <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    {formatPublicDate(update.date)}
                  </p>
                  <PublicStatusBadge status={update.status} className="mt-4" />
                </div>
                <div>
                  <div className="flex items-start gap-3">
                    <CircleDot className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                    <div>
                      <h2 className="text-3xl font-black leading-tight">
                        {update.title}
                      </h2>
                      <p className="mt-4 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground/72">
                        {update.text}
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default UpdatesLanding;
