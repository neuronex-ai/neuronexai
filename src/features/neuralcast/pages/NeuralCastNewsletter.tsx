import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Clock3, Search } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { getNeuralCastArticle, NEURALCAST_ARTICLES, NEURALCAST_CATEGORIES } from "../content";
import {
  NeuralCastArticleCard,
  NeuralCastShell,
  NeuralCastSubscribeForm,
} from "../components/NeuralCastUI";
import { useNeuralCastSeo } from "../hooks";
import { triggerNeuralCastTactileFeedback } from "../utils/tactile";
import { cn } from "@/lib/utils";

function NeuralCastArticleView({ slug }: { slug: string }) {
  const article = getNeuralCastArticle(slug);

  useNeuralCastSeo({
    title: article ? `${article.title} | NeuralCast` : "Artigo não encontrado | NeuralCast",
    description: article?.excerpt ?? "O artigo solicitado não foi encontrado no arquivo da NeuralCast.",
    canonicalPath: article ? `/neuralcast/newsletter/${article.slug}` : "/neuralcast/newsletter",
    type: article ? "article" : "website",
  });

  if (!article) {
    return (
      <NeuralCastShell>
        <section className="px-5 py-28 md:px-8 md:py-40">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#17130f]/[0.45]">Arquivo NeuralCast</p>
            <h1 className="mt-6 text-5xl font-black leading-none tracking-[-0.065em] md:text-7xl">Este artigo ainda não existe.</h1>
            <p className="mx-auto mt-6 max-w-xl text-lg font-semibold leading-relaxed text-[#17130f]/[0.62]">O endereço pode ter mudado ou a publicação ainda não foi liberada.</p>
            <Link
              to="/neuralcast/newsletter"
              className="neuralcast-tactile mt-9 inline-flex h-14 items-center rounded-full bg-[#17130f] px-7 text-xs font-black uppercase tracking-[0.12em] text-[#f4e8d1]"
              onPointerDown={() => triggerNeuralCastTactileFeedback(6)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar aos artigos
            </Link>
          </div>
        </section>
      </NeuralCastShell>
    );
  }

  const related = NEURALCAST_ARTICLES.filter((item) => item.slug !== article.slug).slice(0, 2);

  return (
    <NeuralCastShell>
      <article>
        <header className="px-5 pb-20 pt-16 md:px-8 md:pb-28 md:pt-24">
          <div className="mx-auto max-w-[1120px]">
            <Link
              to="/neuralcast/newsletter"
              className="neuralcast-tactile inline-flex min-h-11 items-center rounded-full px-1 text-xs font-black uppercase tracking-[0.12em] text-[#17130f]/[0.60] transition-colors hover:text-[#17130f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a97838]/45"
              onPointerDown={() => triggerNeuralCastTactileFeedback(6)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Arquivo de artigos
            </Link>
            <div className="mt-14 grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
              <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a97838]">{article.eyebrow}</p><div className="mt-7 space-y-2 text-sm font-semibold text-[#17130f]/[0.50]"><p>{article.publishedAt}</p><p className="inline-flex items-center"><Clock3 className="mr-2 h-4 w-4" /> {article.readTime}</p></div></div>
              <div><h1 className="max-w-[12ch] text-balance text-[clamp(4rem,9vw,8.8rem)] font-black leading-[0.84] tracking-[-0.075em]">{article.title}</h1><p className="mt-8 max-w-3xl text-pretty text-xl font-semibold leading-relaxed text-[#17130f]/[0.64] md:text-2xl">{article.excerpt}</p></div>
            </div>
          </div>
        </header>

        {article.quote ? <section className="neuralcast-dark-section bg-[#17130f] px-5 py-20 text-[#f4e8d1] md:px-8 md:py-28"><blockquote className="mx-auto max-w-[1120px] text-balance text-4xl font-black leading-[0.98] tracking-[-0.055em] md:text-6xl">“{article.quote}”</blockquote></section> : null}

        <section className="px-5 py-20 md:px-8 md:py-28"><div className="mx-auto max-w-[1120px]">{article.sections.map((section, index) => <section key={`${article.slug}-${index}`} className="grid gap-8 border-t border-[#17130f]/[0.15] py-12 first:border-t-0 first:pt-0 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16 md:py-16"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#17130f]/[0.42]">{String(index + 1).padStart(2, "0")} · {article.category}</p>{section.heading ? <h2 className="mt-5 text-balance text-3xl font-black leading-[0.96] tracking-[-0.05em] md:text-4xl">{section.heading}</h2> : null}</div><div><div className="space-y-6">{section.paragraphs.map((paragraph) => <p key={paragraph} className="text-lg font-medium leading-[1.75] text-[#17130f]/[0.72] md:text-xl">{paragraph}</p>)}</div>{section.bullets?.length ? <ul className="mt-9 grid gap-3 sm:grid-cols-2">{section.bullets.map((bullet) => <li key={bullet} className="border-t border-[#17130f]/[0.15] py-4 text-sm font-black leading-relaxed">{bullet}</li>)}</ul> : null}</div></section>)}</div></section>

        {article.closingQuestion ? <section className="bg-[#a97838] px-5 py-20 md:px-8 md:py-28"><div className="mx-auto max-w-[1120px]"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#17130f]/[0.50]">Para continuar a conversa</p><h2 className="mt-6 max-w-[15ch] text-balance text-4xl font-black leading-[0.95] tracking-[-0.055em] md:text-6xl">{article.closingQuestion}</h2></div></section> : null}

        <section id="newsletter" className="neuralcast-dark-section bg-[#17130f] px-5 py-20 text-[#f4e8d1] md:px-8 md:py-28"><div className="mx-auto grid max-w-[1120px] gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-end"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d5ad69]">Newsletter NeuralCast</p><h2 className="mt-5 max-w-[11ch] text-balance text-4xl font-black leading-[0.94] tracking-[-0.055em] md:text-6xl">Receba o próximo texto.</h2></div><div><p className="text-base font-medium leading-relaxed text-[#f4e8d1]/[0.58]">Artigos autorais sobre liderança, comportamento, cultura e relações de trabalho.</p><NeuralCastSubscribeForm inverted /></div></div></section>

        {related.length ? (
          <section className="px-5 py-20 md:px-8 md:py-28">
            <div className="mx-auto max-w-[1120px]">
              <div className="flex items-end justify-between gap-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#17130f]/[0.45]">Continue lendo</p>
                  <h2 className="mt-5 text-4xl font-black tracking-[-0.055em] md:text-6xl">Outras reflexões.</h2>
                </div>
                <Link
                  to="/neuralcast/newsletter"
                  className="neuralcast-tactile hidden min-h-11 items-center rounded-full px-1 text-xs font-black uppercase tracking-[0.12em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a97838]/45 md:inline-flex"
                  onPointerDown={() => triggerNeuralCastTactileFeedback(6)}
                >
                  Ver arquivo <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
              <div className="mt-10 grid gap-5 lg:grid-cols-2">{related.map((item) => <NeuralCastArticleCard key={item.slug} article={item} />)}</div>
            </div>
          </section>
        ) : null}
      </article>
    </NeuralCastShell>
  );
}

function NeuralCastArchive() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof NEURALCAST_CATEGORIES)[number]>("Todos");

  useNeuralCastSeo({
    title: "Newsletter NeuralCast | Artigos de Pedro Luiz Pereira",
    description: "Arquivo de artigos da NeuralCast sobre liderança, comportamento, cultura, comunicação e desenvolvimento humano.",
    canonicalPath: "/neuralcast/newsletter",
  });

  const filteredArticles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    return NEURALCAST_ARTICLES.filter((article) => {
      const matchesCategory = category === "Todos" || article.category === category;
      const haystack = `${article.title} ${article.excerpt} ${article.category}`.toLocaleLowerCase("pt-BR");
      return matchesCategory && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [category, query]);

  return (
    <NeuralCastShell>
      <section className="px-5 pb-16 pt-16 md:px-8 md:pb-24 md:pt-24"><div className="mx-auto max-w-[1320px]"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a97838]">Newsletter NeuralCast</p><div className="mt-6 grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end"><h1 className="max-w-[10ch] text-balance text-[clamp(4.5rem,11vw,10rem)] font-black leading-[0.82] tracking-[-0.08em]">Ideias para ler, pensar e aplicar.</h1><p className="max-w-xl text-lg font-semibold leading-relaxed text-[#17130f]/[0.62] md:text-xl">O arquivo público de Pedro Luiz Pereira sobre liderança, comportamento, cultura, comunicação e desenvolvimento humano.</p></div></div></section>

      <section className="neuralcast-card-material border-y border-[#17130f]/[0.12] bg-[#f4e8d1]/[0.28] px-5 py-8 md:px-8">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {NEURALCAST_CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                onPointerDown={() => triggerNeuralCastTactileFeedback(6)}
                className={cn(
                  "neuralcast-tactile min-h-10 rounded-full border px-4 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a97838]/45",
                  category === item
                    ? "border-[#17130f] bg-[#17130f] text-[#f4e8d1]"
                    : "border-[#17130f]/[0.15] bg-transparent text-[#17130f]/[0.62] hover:border-[#17130f]/[0.35] hover:text-[#17130f]",
                )}
              >
                {item}
              </button>
            ))}
          </div>
          <label className="relative block w-full lg:max-w-sm">
            <span className="sr-only">Buscar artigos</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#17130f]/[0.42]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por tema ou palavra"
              className="neuralcast-field h-12 w-full rounded-full border border-[#17130f]/[0.15] bg-[#ead8b7] pl-11 pr-5 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#17130f]/[0.15]"
            />
          </label>
        </div>
      </section>

      <section className="px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-[1320px]">
          <div className="mb-8 flex items-center justify-between gap-4">
            <p className="text-sm font-black">{filteredArticles.length} {filteredArticles.length === 1 ? "artigo encontrado" : "artigos encontrados"}</p>
            <p className="text-xs font-semibold text-[#17130f]/[0.45]">Arquivo em expansão</p>
          </div>
          {filteredArticles.length ? (
            <div className="grid gap-5 lg:grid-cols-2">{filteredArticles.map((article) => <NeuralCastArticleCard key={article.slug} article={article} />)}</div>
          ) : (
            <div className="neuralcast-card-material rounded-[32px] border border-[#17130f]/[0.12] bg-[#f4e8d1]/[0.35] px-6 py-20 text-center">
              <h2 className="text-3xl font-black tracking-[-0.045em]">Nenhum texto encontrado.</h2>
              <p className="mt-3 text-sm font-semibold text-[#17130f]/[0.55]">Tente outra palavra ou volte para a categoria “Todos”.</p>
            </div>
          )}
        </div>
      </section>

      <section id="newsletter" className="neuralcast-dark-section bg-[#17130f] px-5 py-24 text-[#f4e8d1] md:px-8 md:py-32"><div className="mx-auto grid max-w-[1320px] gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-end"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d5ad69]">Assine a NeuralCast</p><h2 className="mt-5 max-w-[12ch] text-balance text-5xl font-black leading-[0.9] tracking-[-0.065em] md:text-7xl">O próximo artigo pode chegar até você.</h2></div><div><p className="max-w-2xl text-lg font-medium leading-relaxed text-[#f4e8d1]/[0.58]">Uma seleção autoral, sem ruído e sem excesso de envios.</p><NeuralCastSubscribeForm inverted /></div></div></section>
    </NeuralCastShell>
  );
}

const NeuralCastNewsletter = () => {
  const { slug } = useParams<{ slug?: string }>();
  return slug ? <NeuralCastArticleView slug={slug} /> : <NeuralCastArchive />;
};

export default NeuralCastNewsletter;
