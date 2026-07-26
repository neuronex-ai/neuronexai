import { ArrowRight, Check, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

import {
  PublicPageShell,
  PublicProductHero,
} from "@/components/public/PublicPageShell";
import { Button } from "@/components/ui/button";
import { PUBLIC_PLAN_CARDS } from "@/content/public-plan-catalog";
import { getPublicPage } from "@/content/public-content";

const MICROSOFT_STORE_URL =
  "https://apps.microsoft.com/detail/9PKGGSPS44CD?hl=pt-BR&gl=BR";

const DownloadPlans = () => (
  <section id="planos" className="public-section-stage scroll-mt-24 px-5 py-20 md:px-8 md:py-28">
    <div className="mx-auto max-w-[1180px]">
      <div className="mx-auto max-w-3xl text-center">
        <p className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
          Planos NeuroNex
        </p>
        <h2 className="mt-5 text-balance text-4xl font-black leading-none md:text-6xl">
          Escolha pelo tipo de operação que você precisa.
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-relaxed text-muted-foreground/72 md:text-lg">
          O Essential organiza o começo da prática. O Profissional amplia limites e conecta recursos clínicos, financeiros e de IA por R$ 229,90 ao mês.
        </p>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-2">
        {PUBLIC_PLAN_CARDS.map((plan) => (
          <article key={plan.name} className="public-neurox-card flex h-full flex-col rounded-[30px] p-7 md:p-8">
            <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">
              {plan.eyebrow}
            </p>
            <h3 className="mt-4 text-3xl font-black">{plan.name}</h3>
            <p className="mt-4 text-4xl font-black tracking-tight">
              {plan.price}
              <span className="ml-2 text-sm font-semibold text-muted-foreground">{plan.period}</span>
            </p>
            <p className="mt-5 text-sm font-medium leading-relaxed text-muted-foreground/72">
              {plan.description}
            </p>
            <ul className="mt-7 grid gap-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-3 text-sm font-semibold leading-relaxed text-foreground/78">
                  <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
            <Button asChild className="mt-8 h-14 w-full rounded-full bg-foreground text-[11px] font-bold text-background md:mt-auto md:translate-y-5">
              <Link to={plan.href}>
                {plan.cta} <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </article>
        ))}
      </div>
    </div>
  </section>
);

const DownloadLanding = () => {
  const page = getPublicPage("/download");
  if (!page) return null;

  return (
    <PublicPageShell
      page={page}
      hero={
        <PublicProductHero
          page={page}
          actions={
            <>
              <Button
                asChild
                className="public-tactile h-14 rounded-full bg-foreground px-7 font-mono text-[10px] font-black uppercase text-background"
              >
                <a
                  href={MICROSOFT_STORE_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir Microsoft Store
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                className="public-tactile h-14 rounded-full border-border/70 bg-background/38 px-7 font-mono text-[10px] font-black uppercase backdrop-blur-xl"
              >
                <a href="#planos">Ver planos <ArrowRight className="ml-2 h-4 w-4" /></a>
              </Button>
            </>
          }
        />
      }
    >
      <DownloadPlans />
    </PublicPageShell>
  );
};

export default DownloadLanding;
