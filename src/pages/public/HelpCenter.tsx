"use client";

import { useMemo, useState } from "react";
import { ArrowRight, ChevronDown, LifeBuoy, Search } from "lucide-react";
import { Link } from "react-router-dom";

import { Footer } from "@/components/landing/Footer";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { Navbar } from "@/components/landing/Navbar";
import { PublicRouteBreadcrumbs } from "@/components/public/PublicPageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const articles = [
  { category: "Início", title: "Como começar no NeuroNex", summary: "Configure seu perfil, cadastre pacientes e organize a agenda.", steps: ["Revise seus dados em Ajustes.", "Cadastre os primeiros pacientes.", "Configure sua disponibilidade."] },
  { category: "Dashboard", title: "Entendendo a Central da Clínica", summary: "Use o radar, a próxima sessão e a fila de trabalho.", steps: ["Revise o Radar de Atenção.", "Consulte a Próxima Sessão.", "Acompanhe a Fila de Trabalho."] },
  { category: "Agenda", title: "Organizar agenda e atendimentos", summary: "Crie compromissos e consulte o dia, a semana e o mês.", steps: ["Escolha uma visualização.", "Crie o compromisso.", "Atualize o status quando necessário."] },
  { category: "Pacientes", title: "Cadastrar e acompanhar pacientes", summary: "Organize cadastro, histórico, metas e documentos.", steps: ["Cadastre os dados necessários.", "Abra o perfil do paciente.", "Mantenha o histórico atualizado."] },
  { category: "Financeiro", title: "Gestão Financeira e NeuroFinance", summary: "Entenda a diferença entre gestão e movimentação financeira.", steps: ["A gestão organiza receitas e despesas.", "O NeuroFinance reúne recursos bancários.", "As duas camadas possuem papéis diferentes."] },
  { category: "Synapse", title: "Usar o Synapse", summary: "Consulte a rotina por texto ou voz.", steps: ["Abra o Synapse.", "Faça uma pergunta objetiva.", "Revise a resposta e abra o módulo indicado."] },
];

const HelpCenter = () => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    return articles.filter((article) => !term || `${article.category} ${article.title} ${article.summary}`.toLowerCase().includes(term));
  }, [query]);

  return (
    <div className="public-lumen-page min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="hidden md:block"><Navbar /></div>
      <LandingMobileNav />
      <PublicRouteBreadcrumbs route="/ajuda" />
      <main className="px-5 pb-20 pt-24 md:px-8 md:pb-28 md:pt-[6.5rem]">
        <section className="public-neurox-hero mx-auto max-w-[1320px] px-8 py-16 text-center md:px-14 md:py-20">
          <div className="mx-auto max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/45 px-4 py-2 text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground"><LifeBuoy className="h-4 w-4" />Central de Ajuda</div>
          <h1 className="public-neurox-title mt-8 text-[clamp(3rem,6vw,5.4rem)] font-black leading-[1.02] tracking-tight">Encontre uma resposta e <span className="text-muted-foreground">continue seu trabalho.</span></h1>
          <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-relaxed text-muted-foreground/70 md:text-xl">Pesquise orientações diretas sobre as principais áreas da NeuroNex.</p>
          <div className="relative mx-auto mt-9 max-w-2xl"><Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input aria-label="Buscar na Central de Ajuda" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar assunto..." className="h-16 rounded-[22px] pl-14 text-base" /></div>
          </div>
        </section>

        <section className="mx-auto mt-12 max-w-4xl space-y-3">
          {results.map((article, index) => (
            <article key={article.title} className="public-neurox-card overflow-hidden rounded-[26px]">
              <button
                id={`help-article-trigger-${index}`}
                type="button"
                aria-expanded={open === article.title}
                aria-controls={`help-article-panel-${index}`}
                onClick={() => setOpen(open === article.title ? null : article.title)}
                className="public-tactile flex w-full items-start gap-4 p-6 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <div className="min-w-0 flex-1"><p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground">{article.category}</p><h2 className="mt-2 text-lg font-black">{article.title}</h2><p className="mt-2 text-sm font-medium text-muted-foreground/70">{article.summary}</p></div>
                <ChevronDown aria-hidden="true" className={cn("h-4 w-4 transition-transform", open === article.title && "rotate-180")} />
              </button>
              {open === article.title ? <ol id={`help-article-panel-${index}`} role="region" aria-labelledby={`help-article-trigger-${index}`} className="space-y-3 border-t border-border/40 px-6 py-6 dark:border-white/10">{article.steps.map((step, stepIndex) => <li key={step} className="flex gap-4 text-sm font-medium text-muted-foreground/75"><span className="font-mono text-xs opacity-50">0{stepIndex + 1}</span>{step}</li>)}</ol> : null}
            </article>
          ))}
          {!results.length ? <div className="rounded-[26px] border border-dashed border-border/50 p-10 text-center text-sm text-muted-foreground">Nenhum artigo encontrado.</div> : null}
        </section>

        <section className="public-closing-scene mx-auto mt-8 flex max-w-4xl flex-col items-center justify-between gap-5 rounded-[28px] p-6 text-background dark:text-zinc-950 md:flex-row"><div className="relative z-10"><h2 className="text-xl font-black">Ainda precisa de ajuda?</h2><p className="mt-2 text-sm font-medium opacity-60">Fale com a equipe pelo canal oficial.</p></div><Button asChild className="public-tactile relative z-10 h-12 rounded-full bg-background px-6 font-mono text-[9px] font-black uppercase tracking-[0.18em] text-foreground dark:bg-zinc-950 dark:text-white"><Link to="/contato">Falar com a equipe <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></section>
      </main>
      <Footer />
    </div>
  );
};

export default HelpCenter;
