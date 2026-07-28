import { ArrowDownRight, ArrowRight, CircleDot, Quote, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import pedroPortrait from "../assets/pedro-luiz-pereira.jpg";
import { NEURALCAST_ARTICLES } from "../content";
import {
  NeuralCastArticleCard,
  NeuralCastLogo,
  NeuralCastShell,
  NeuralCastSubscribeForm,
} from "../components/NeuralCastUI";
import { NeuralCastReelsSection } from "../components/NeuralCastReels";
import { useNeuralCastMobileLanding, useNeuralCastSeo } from "../hooks";
import { triggerNeuralCastTactileFeedback } from "../utils/tactile";

function PedroPortraitFrame({ compact = false }: { compact?: boolean }) {
  return (
    <figure
      className={`shrink-0 overflow-hidden border border-[#f4e8d1]/[0.18] bg-[#f4e8d1]/[0.10] shadow-[0_18px_45px_rgba(0,0,0,0.22)] ${
        compact ? "w-20 rounded-[23px] p-1" : "w-28 rounded-[28px] p-1.5 md:w-32"
      }`}
    >
      <div className={`overflow-hidden border border-[#17130f]/[0.10] bg-[#f4e8d1] ${compact ? "rounded-[18px]" : "rounded-[24px]"}`}>
        <img
          src={pedroPortrait}
          alt="Pedro Luiz Pereira, Diretor de Gente e Gestão na Metal Group"
          className="aspect-square w-full object-cover object-top"
          loading="eager"
          decoding="async"
        />
      </div>
    </figure>
  );
}

function DesktopLanding() {
  const featuredArticle = NEURALCAST_ARTICLES.find((article) => article.featured) ?? NEURALCAST_ARTICLES[0];

  return (
    <>
      <section className="relative overflow-hidden px-5 pb-16 pt-10 md:px-8 md:pb-24 md:pt-16">
        <div className="pointer-events-none absolute -right-40 top-0 h-[520px] w-[520px] rounded-full border border-[#17130f]/[0.10]" />
        <div className="pointer-events-none absolute -right-20 top-20 h-[360px] w-[360px] rounded-full border border-[#17130f]/[0.10]" />
        <div className="mx-auto grid min-h-[calc(100svh-8rem)] max-w-[1320px] items-center gap-12 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] lg:gap-16">
          <div className="relative z-10 min-w-0 py-8">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#17130f]/[0.15] bg-[#f4e8d1]/[0.42] px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em]">
              <Sparkles className="h-3.5 w-3.5" /> Neurociência aplicada a pessoas e organizações
            </p>
            <h1 className="mt-8 max-w-[11ch] text-balance text-[clamp(4rem,7.9vw,7.5rem)] font-black leading-[0.84] tracking-[-0.065em]">
              Ideias que transformam a forma de liderar.
            </h1>
            <p className="mt-8 max-w-2xl text-pretty text-lg font-semibold leading-relaxed text-[#17130f]/[0.66] md:text-2xl">
              Uma publicação de Pedro Luiz Pereira sobre comportamento, cultura, comunicação e desenvolvimento humano — com profundidade, clareza e aplicação prática.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/neuralcast/newsletter"
                className="neuralcast-tactile inline-flex h-14 items-center justify-center rounded-full bg-[#17130f] px-7 text-xs font-black uppercase tracking-[0.12em] text-[#f4e8d1]"
                onPointerDown={() => triggerNeuralCastTactileFeedback(6)}
              >
                Explorar artigos <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <a
                href="#manifesto"
                className="neuralcast-tactile inline-flex h-14 items-center justify-center rounded-full border border-[#17130f]/[0.18] bg-[#f4e8d1]/[0.35] px-7 text-xs font-black uppercase tracking-[0.12em] transition-colors hover:bg-[#f4e8d1]/[0.70]"
                onPointerDown={() => triggerNeuralCastTactileFeedback(6)}
              >
                Entender a proposta <ArrowDownRight className="ml-2 h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[560px] min-w-0 lg:mx-0 lg:justify-self-end">
            <div className="neuralcast-dark-section relative aspect-[4/5] overflow-hidden rounded-[42px] border border-[#17130f]/[0.12] bg-[#17130f] p-7 text-[#f4e8d1] shadow-[0_40px_100px_rgba(23,19,15,0.18)] md:p-10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(169,120,56,0.45),transparent_34%),linear-gradient(145deg,transparent_0%,rgba(244,232,209,0.04)_55%,rgba(244,232,209,0.12)_100%)]" />
              <div className="absolute -bottom-20 -right-14 text-[15rem] font-black leading-none tracking-[-0.12em] text-[#f4e8d1]/[0.035] md:text-[20rem]">PLP</div>
              <div className="relative flex h-full flex-col justify-between">
                <div className="flex items-start justify-between">
                  <NeuralCastLogo surface="dark" compact />
                  <PedroPortraitFrame />
                </div>
                <div>
                  <Quote className="h-9 w-9 text-[#d5ad69]" />
                  <p className="mt-5 max-w-[14ch] text-balance text-[2.35rem] font-black leading-[0.98] tracking-[-0.04em]">
                    Pessoas não são peças. São sistemas vivos em desenvolvimento.
                  </p>
                  <div className="mt-9 border-t border-[#f4e8d1]/[0.18] pt-5">
                    <p className="text-lg font-black">Pedro Luiz Pereira</p>
                    <p className="mt-1 text-sm font-medium text-[#f4e8d1]/[0.55]">Diretor de Gente e Gestão na Metal Group</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="neuralcast-dark-section bg-[#17130f] px-5 py-10 text-[#f4e8d1] md:px-8">
        <div className="mx-auto grid max-w-[1320px] gap-8 md:grid-cols-3 md:gap-0">
          {["Liderança que desenvolve", "Comportamento que explica", "Cultura que sustenta"].map((item, index) => (
            <div key={item} className="border-[#f4e8d1]/[0.14] md:border-l md:px-8 first:md:border-l-0 first:md:pl-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d5ad69]">0{index + 1}</p>
              <p className="mt-3 text-2xl font-black tracking-[-0.04em]">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="manifesto" className="px-5 py-24 md:px-8 md:py-36">
        <div className="mx-auto grid max-w-[1320px] gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
          <div><CircleDot className="h-8 w-8 text-[#a97838]" /><p className="mt-8 text-[10px] font-black uppercase tracking-[0.2em] text-[#17130f]/[0.45]">A proposta</p></div>
          <div>
            <h2 className="max-w-[13ch] text-balance text-5xl font-black leading-[0.9] tracking-[-0.065em] md:text-7xl">Traduzir complexidade sem transformar pessoas em fórmulas.</h2>
            <div className="mt-10 grid gap-8 border-t border-[#17130f]/[0.15] pt-8 md:grid-cols-2">
              <p className="text-base font-semibold leading-relaxed text-[#17130f]/[0.65] md:text-lg">A NeuralCast nasce como um espaço editorial para organizar ideias, provocar conversas e aproximar neurociência, comportamento e vida organizacional.</p>
              <p className="text-base font-semibold leading-relaxed text-[#17130f]/[0.65] md:text-lg">Sem receitas prontas. Sem jargão pelo jargão. Cada texto parte de uma pergunta real e busca oferecer repertório para decisões mais humanas e conscientes.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="neuralcast-dark-section bg-[#17130f] px-5 py-24 text-[#f4e8d1] md:px-8 md:py-36">
        <div className="mx-auto max-w-[1320px]">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d5ad69]">Artigo em destaque</p><h2 className="mt-5 max-w-[12ch] text-balance text-5xl font-black leading-[0.9] tracking-[-0.065em] md:text-7xl">{featuredArticle.title}</h2></div>
            <p className="max-w-md text-base font-medium leading-relaxed text-[#f4e8d1]/[0.58]">{featuredArticle.excerpt}</p>
          </div>
          <div className="mt-12 grid gap-8 rounded-[36px] border border-[#f4e8d1]/[0.14] bg-[#f4e8d1]/[0.035] p-7 md:grid-cols-[1.1fr_0.9fr] md:p-12">
            <blockquote className="text-balance text-3xl font-black leading-[1.02] tracking-[-0.045em] md:text-5xl">“{featuredArticle.quote}”</blockquote>
            <div className="flex flex-col justify-between border-t border-[#f4e8d1]/[0.14] pt-7 md:border-l md:border-t-0 md:pl-9 md:pt-0">
              <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d5ad69]">{featuredArticle.eyebrow}</p><p className="mt-4 text-sm font-semibold text-[#f4e8d1]/[0.55]">{featuredArticle.publishedAt} · {featuredArticle.readTime}</p></div>
              <Link
                to={`/neuralcast/newsletter/${featuredArticle.slug}`}
                className="neuralcast-tactile mt-10 inline-flex h-14 items-center justify-center rounded-full bg-[#f4e8d1] px-7 text-xs font-black uppercase tracking-[0.12em] text-[#17130f]"
                onPointerDown={() => triggerNeuralCastTactileFeedback(6)}
              >
                Ler artigo completo <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-24 md:px-8 md:py-36">
        <div className="mx-auto max-w-[1320px]">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#17130f]/[0.45]">Últimas publicações</p><h2 className="mt-5 text-5xl font-black leading-none tracking-[-0.065em] md:text-7xl">Ideias para continuar pensando.</h2></div>
            <Link
              to="/neuralcast/newsletter"
              className="neuralcast-tactile inline-flex min-h-11 items-center rounded-full px-1 text-xs font-black uppercase tracking-[0.12em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a97838]/45"
              onPointerDown={() => triggerNeuralCastTactileFeedback(6)}
            >
              Ver todos os artigos <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-2">{NEURALCAST_ARTICLES.map((article) => <NeuralCastArticleCard key={article.slug} article={article} />)}</div>
        </div>
      </section>

      <section id="newsletter" className="bg-[#a97838] px-5 py-24 md:px-8 md:py-32">
        <div className="mx-auto grid max-w-[1320px] gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#17130f]/[0.55]">Newsletter NeuralCast</p><h2 className="mt-5 max-w-[12ch] text-balance text-5xl font-black leading-[0.9] tracking-[-0.065em] md:text-7xl">Novas ideias, direto ao ponto.</h2></div>
          <div><p className="max-w-2xl text-lg font-semibold leading-relaxed text-[#17130f]/[0.68]">Receba artigos de Pedro Luiz Pereira sobre liderança, comportamento, cultura e relações de trabalho.</p><NeuralCastSubscribeForm /></div>
        </div>
      </section>

      <NeuralCastReelsSection />
    </>
  );
}

function MobileLanding() {
  const featuredArticle = NEURALCAST_ARTICLES.find((article) => article.featured) ?? NEURALCAST_ARTICLES[0];

  return (
    <>
      <section className="relative overflow-hidden px-4 pb-14 pt-10">
        <div className="pointer-events-none absolute -right-24 top-6 h-72 w-72 rounded-full border border-[#17130f]/[0.10]" />
        <div className="relative">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#17130f]/[0.14] bg-[#f4e8d1]/[0.45] px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em]"><Sparkles className="h-3.5 w-3.5" /> Neurociência aplicada</p>
          <h1 className="mt-7 text-[3.35rem] font-black leading-[0.86] tracking-normal">
            <span className="block">Ideias que</span>
            <span className="block">transformam</span>
            <span className="block">a forma de</span>
            <span className="block">liderar.</span>
          </h1>
          <p className="mt-7 text-[17px] font-semibold leading-relaxed text-[#17130f]/[0.66]">Uma publicação de Pedro Luiz Pereira sobre comportamento, cultura, comunicação e desenvolvimento humano.</p>
          <div className="mt-8 grid gap-3">
            <Link
              to="/neuralcast/newsletter"
              className="neuralcast-tactile inline-flex h-14 items-center justify-center rounded-full bg-[#17130f] px-6 text-xs font-black uppercase tracking-[0.11em] text-[#f4e8d1]"
              onPointerDown={() => triggerNeuralCastTactileFeedback(6)}
            >
              Explorar artigos <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <a
              href="#manifesto"
              className="neuralcast-tactile inline-flex h-14 items-center justify-center rounded-full border border-[#17130f]/[0.18] bg-[#f4e8d1]/[0.38] px-6 text-xs font-black uppercase tracking-[0.11em]"
              onPointerDown={() => triggerNeuralCastTactileFeedback(6)}
            >
              Entender a proposta <ArrowDownRight className="ml-2 h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="neuralcast-dark-section relative mt-10 overflow-hidden rounded-[34px] bg-[#17130f] p-6 text-[#f4e8d1] shadow-[0_30px_80px_rgba(23,19,15,0.24)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_15%,rgba(169,120,56,0.5),transparent_34%)]" />
          <div className="relative">
            <div className="flex items-start justify-between gap-5">
              <NeuralCastLogo surface="dark" compact />
              <PedroPortraitFrame compact />
            </div>
            <Quote className="mt-12 h-8 w-8 text-[#d5ad69]" />
            <p className="mt-6 text-[1.9rem] font-black leading-[1.05] tracking-normal">
              <span className="block">Pessoas não são peças.</span>
              <span className="block">São sistemas vivos</span>
              <span className="block">em desenvolvimento.</span>
            </p>
            <div className="mt-8 border-t border-[#f4e8d1]/[0.16] pt-5">
              <p className="font-black">Pedro Luiz Pereira</p>
              <p className="mt-1 text-xs text-[#f4e8d1]/[0.55]">Diretor de Gente e Gestão na Metal Group</p>
            </div>
          </div>
        </div>
      </section>

      <section className="neuralcast-dark-section bg-[#17130f] px-4 py-12 text-[#f4e8d1]">
        <div className="grid gap-6">{["Liderança que desenvolve", "Comportamento que explica", "Cultura que sustenta"].map((item, index) => <div key={item} className="border-t border-[#f4e8d1]/[0.15] pt-5"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#d5ad69]">0{index + 1}</p><p className="mt-2 text-2xl font-black tracking-[-0.04em]">{item}</p></div>)}</div>
      </section>

      <section id="manifesto" className="px-4 py-20"><CircleDot className="h-7 w-7 text-[#a97838]" /><p className="mt-6 text-[9px] font-black uppercase tracking-[0.2em] text-[#17130f]/[0.45]">A proposta</p><h2 className="mt-5 text-balance text-5xl font-black leading-[0.9] tracking-[-0.065em]">Traduzir complexidade sem transformar pessoas em fórmulas.</h2><div className="mt-8 space-y-5 border-t border-[#17130f]/[0.15] pt-7 text-base font-semibold leading-relaxed text-[#17130f]/[0.66]"><p>A NeuralCast organiza ideias, provoca conversas e aproxima neurociência, comportamento e vida organizacional.</p><p>Sem receitas prontas. Cada texto parte de uma pergunta real e oferece repertório para decisões mais humanas e conscientes.</p></div></section>

      <section className="neuralcast-dark-section bg-[#17130f] px-4 py-20 text-[#f4e8d1]"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#d5ad69]">Artigo em destaque</p><h2 className="mt-5 text-balance text-5xl font-black leading-[0.9] tracking-[-0.065em]">{featuredArticle.title}</h2><blockquote className="mt-9 rounded-[28px] border border-[#f4e8d1]/[0.14] bg-[#f4e8d1]/[0.04] p-6 text-3xl font-black leading-[1.02] tracking-[-0.045em]">“{featuredArticle.quote}”</blockquote><Link to={`/neuralcast/newsletter/${featuredArticle.slug}`} className="neuralcast-tactile mt-7 inline-flex h-14 w-full items-center justify-center rounded-full bg-[#f4e8d1] px-6 text-xs font-black uppercase tracking-[0.11em] text-[#17130f]" onPointerDown={() => triggerNeuralCastTactileFeedback(6)}>Ler artigo completo <ArrowRight className="ml-2 h-4 w-4" /></Link></section>

      <section className="px-4 py-20"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#17130f]/[0.45]">Últimas publicações</p><h2 className="mt-5 text-5xl font-black leading-[0.9] tracking-[-0.065em]">Ideias para continuar pensando.</h2><div className="mt-9 grid gap-5">{NEURALCAST_ARTICLES.map((article) => <NeuralCastArticleCard key={article.slug} article={article} />)}</div></section>

      <section id="newsletter" className="bg-[#a97838] px-4 py-20"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#17130f]/[0.55]">Newsletter NeuralCast</p><h2 className="mt-5 text-balance text-5xl font-black leading-[0.9] tracking-[-0.065em]">Novas ideias, direto ao ponto.</h2><p className="mt-6 text-base font-semibold leading-relaxed text-[#17130f]/[0.68]">Receba os próximos artigos de Pedro Luiz Pereira.</p><NeuralCastSubscribeForm /></section>

      <NeuralCastReelsSection mobile />
    </>
  );
}

const NeuralCastLanding = () => {
  useNeuralCastSeo({
    title: "NeuralCast | Neurociência, liderança e comportamento",
    description: "Artigos e reflexões de Pedro Luiz Pereira sobre liderança, comportamento, cultura, comunicação e desenvolvimento humano.",
    canonicalPath: "/neuralcast",
  });

  const isMobile = useNeuralCastMobileLanding();

  return <NeuralCastShell>{isMobile ? <MobileLanding /> : <DesktopLanding />}</NeuralCastShell>;
};

export default NeuralCastLanding;
