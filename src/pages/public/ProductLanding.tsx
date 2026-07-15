import { ArrowRight, Check, Layers3, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { Footer } from "@/components/landing/Footer";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { Navbar } from "@/components/landing/Navbar";
import { Button } from "@/components/ui/button";
import publicPageCatalog from "@/content/public-pages.json";

type ProductSection = {
  title: string;
  text: string;
};

type ProductPage = {
  route: string;
  eyebrow: string;
  heading: string;
  lead: string;
  highlights: string[];
  sections?: ProductSection[];
  image?: string;
};

const productPages = publicPageCatalog.pages as ProductPage[];

export const ProductLanding = ({ route }: { route: string }) => {
  const page = productPages.find((item) => item.route === route);

  if (!page) return null;

  return (
    <div className="min-h-screen overflow-x-hidden bg-background font-sans text-foreground">
      <div className="hidden md:block"><Navbar /></div>
      <LandingMobileNav />
      <main>
        <section className="relative overflow-hidden px-5 pb-20 pt-32 md:px-8 md:pb-28 md:pt-48">
          <div className="pointer-events-none absolute left-1/2 top-0 h-[620px] w-[980px] -translate-x-1/2 rounded-full bg-foreground/[0.045] blur-[170px] dark:bg-white/[0.035]" />
          <div className="relative z-10 mx-auto max-w-[1240px]">
            <div className="mx-auto max-w-5xl text-center">
              <div className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border/45 bg-foreground/[0.035] px-4 py-2 text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground dark:border-white/10 dark:bg-white/[0.045]">
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                {page.eyebrow}
              </div>
              <h1 className="mt-8 text-[clamp(3.2rem,7vw,7rem)] font-black leading-[0.86] tracking-[-0.075em]">{page.heading}</h1>
              <p className="mx-auto mt-7 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground/72 md:text-xl">{page.lead}</p>
              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild className="h-14 rounded-2xl bg-foreground px-7 text-[10px] font-black uppercase tracking-[0.2em] text-background">
                  <Link to="/create-account">Começar grátis <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="outline" className="h-14 rounded-2xl px-7 text-[10px] font-black uppercase tracking-[0.2em]">
                  <Link to="/contato">Falar com a equipe</Link>
                </Button>
              </div>
            </div>

            {page.image ? (
              <div className="mt-16 overflow-hidden rounded-[34px] border border-border/45 bg-card shadow-[0_36px_120px_-76px_rgba(0,0,0,0.8)] dark:border-white/10 dark:bg-[#08090b]">
                <img src={page.image} alt={`Interface ${page.eyebrow} na NeuroNex`} width={1280} height={720} loading="eager" className="block aspect-video w-full object-cover" />
              </div>
            ) : null}
          </div>
        </section>

        <section className="bg-foreground px-5 py-20 text-background dark:bg-white dark:text-zinc-950 md:px-8 md:py-28">
          <div className="mx-auto max-w-[1240px]">
            <div className="grid gap-3 md:grid-cols-3">
              {page.highlights.map((highlight) => (
                <article key={highlight} className="rounded-[26px] border border-background/10 bg-background/[0.07] p-6 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]">
                  <Check aria-hidden="true" className="h-5 w-5 opacity-55" />
                  <h2 className="mt-8 text-xl font-black tracking-[-0.035em]">{highlight}</h2>
                </article>
              ))}
            </div>
          </div>
        </section>

        {page.sections?.length ? (
          <section className="px-5 py-20 md:px-8 md:py-28">
            <div className="mx-auto max-w-[1100px]">
              <div className="mx-auto max-w-4xl text-center">
                <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">Como se conecta</p>
                <h2 className="mt-6 text-4xl font-black leading-[0.9] tracking-[-0.06em] md:text-7xl">Uma parte da NeuroNex. <span className="text-muted-foreground/35">O mesmo fluxo operacional.</span></h2>
              </div>
              <div className="mt-12 grid gap-4 md:grid-cols-2">
                {page.sections.map((section, index) => (
                  <article key={section.title} className="rounded-[32px] border border-border/40 bg-card/75 p-7 dark:border-white/10 dark:bg-white/[0.03]">
                    {index % 2 === 0 ? <Layers3 aria-hidden="true" className="h-6 w-6 text-muted-foreground" /> : <ShieldCheck aria-hidden="true" className="h-6 w-6 text-muted-foreground" />}
                    <h3 className="mt-9 text-3xl font-black leading-[0.95] tracking-[-0.05em]">{section.title}</h3>
                    <p className="mt-4 text-sm font-medium leading-relaxed text-muted-foreground/70">{section.text}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="px-5 pb-20 md:px-8 md:pb-28">
          <div className="mx-auto max-w-[1100px] rounded-[42px] bg-foreground p-8 text-center text-background dark:bg-white dark:text-zinc-950 md:p-12">
            <h2 className="mx-auto max-w-4xl text-4xl font-black leading-[0.88] tracking-[-0.065em] md:text-6xl">Conecte esta área ao restante da sua prática.</h2>
            <Button asChild className="mt-8 h-14 rounded-2xl bg-background px-7 text-[10px] font-black uppercase tracking-[0.2em] text-foreground dark:bg-zinc-950 dark:text-white">
              <Link to="/create-account">Começar agora <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default ProductLanding;
