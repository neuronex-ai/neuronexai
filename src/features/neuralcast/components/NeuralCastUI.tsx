import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { ArrowRight, BookOpenText, Check, Home, Loader2, Mail, Menu, PenLine, Radio, X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";

import "../neuralcast.css";
import logoBeige from "../assets/logo-beige.png";
import logoDark from "../assets/logo-dark.png";
import type { NeuralCastArticle } from "../content";
import { triggerNeuralCastTactileFeedback } from "../utils/tactile";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type NeuralCastLogoSurface = "light" | "dark";

const routeNavItems = [
  { label: "Início", to: "/neuralcast", icon: Home },
  { label: "Artigos", to: "/neuralcast/newsletter", icon: BookOpenText },
];

const sectionNavItems = [
  { label: "Proposta", target: "manifesto", icon: PenLine },
  { label: "Reels", target: "reels", icon: Radio },
  { label: "Assinar", target: "newsletter", icon: Mail },
];

function NeuralCastWordmarkLink({ className }: { className?: string }) {
  return (
    <Link
      to="/neuralcast"
      aria-label="NeuralCast — página inicial"
      className={cn(
        "neuralcast-tactile inline-flex min-h-12 items-center rounded-full px-3 text-2xl font-black tracking-[-0.055em] text-[#17130f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a97838]/45",
        className,
      )}
      onPointerDown={() => triggerNeuralCastTactileFeedback(6)}
    >
      NeuralCast
    </Link>
  );
}

export function NeuralCastLogo({
  surface = "light",
  compact = false,
  className,
}: {
  surface?: NeuralCastLogoSurface;
  compact?: boolean;
  className?: string;
}) {
  const src = surface === "dark" ? logoBeige : logoDark;
  const textColor = surface === "dark" ? "text-[#f4e8d1]" : "text-[#17130f]";

  return (
    <Link
      to="/neuralcast"
      aria-label="NeuralCast — página inicial"
      className={cn(
        "neuralcast-tactile inline-flex min-h-12 items-center gap-3 rounded-full px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a97838]/45",
        textColor,
        className,
      )}
      onPointerDown={() => triggerNeuralCastTactileFeedback(6)}
    >
      <img
        src={src}
        alt=""
        className={cn(
          "h-12 w-12 rounded-[15px] object-cover shadow-sm ring-1 md:h-14 md:w-14 md:rounded-[18px]",
          surface === "dark" ? "ring-[#f4e8d1]/[0.18]" : "ring-[#17130f]/[0.12]",
        )}
      />
      {compact ? null : <span className="text-xl font-semibold tracking-[-0.045em] md:text-2xl">NeuralCast</span>}
    </Link>
  );
}

export function NeuralCastHeader() {
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!hash) return;

    const target = hash.replace("#", "");
    window.requestAnimationFrame(() => {
      document.getElementById(target)?.scrollIntoView({
        behavior: shouldReduceMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  }, [hash, shouldReduceMotion]);

  const isRouteActive = (to: string) =>
    to === "/neuralcast" ? pathname === to : pathname.startsWith(to);

  const scrollToSection = (target: string) => {
    triggerNeuralCastTactileFeedback();
    setMobileMenuOpen(false);

    const canScrollInCurrentPage = target === "newsletter" || pathname === "/neuralcast";
    if (!canScrollInCurrentPage) {
      navigate(`/neuralcast#${target}`);
      return;
    }

    window.requestAnimationFrame(() => {
      document.getElementById(target)?.scrollIntoView({
        behavior: shouldReduceMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  };

  return (
    <>
      <motion.header
        initial={shouldReduceMotion ? false : { y: -18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-none fixed inset-x-0 top-5 z-[100] hidden justify-center px-4 md:flex lg:top-7"
      >
        <nav
          aria-label="Navegação NeuralCast"
          className="neuralcast-liquid-nav pointer-events-auto flex w-fit max-w-[calc(100vw-32px)] items-center justify-between gap-2 rounded-[30px] px-2 py-2"
        >
          <NeuralCastWordmarkLink className="neuralcast-navbar-brand shrink-0" />

          <div className="flex shrink-0 items-center gap-1 text-[#17130f]/70">
            {routeNavItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                aria-current={isRouteActive(item.to) ? "page" : undefined}
                className={cn(
                  "neuralcast-nav-control neuralcast-tactile inline-flex min-h-11 items-center gap-2 rounded-[18px] px-4 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a97838]/45",
                  isRouteActive(item.to) && "neuralcast-nav-control-active",
                )}
                onPointerDown={() => triggerNeuralCastTactileFeedback(6)}
              >
                <item.icon aria-hidden="true" className="h-3.5 w-3.5 lg:hidden" />
                {item.label}
              </Link>
            ))}

            {sectionNavItems.slice(0, 2).map((item) => (
              <button
                key={item.target}
                type="button"
                onClick={() => scrollToSection(item.target)}
                className="neuralcast-nav-control neuralcast-tactile hidden min-h-11 items-center gap-2 rounded-[18px] px-4 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a97838]/45 lg:inline-flex"
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => scrollToSection("newsletter")}
            className="neuralcast-primary-button neuralcast-tactile inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-5 text-xs font-black uppercase tracking-[0.12em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d5ad69]/55"
          >
            Assinar
          </button>
        </nav>
      </motion.header>

      <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <motion.header
          initial={shouldReduceMotion ? false : { y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-0 top-0 z-[100] flex items-center justify-between px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top))] md:hidden"
        >
          <NeuralCastWordmarkLink className="neuralcast-mobile-bar px-4 text-base tracking-[-0.035em]" />

          <div className="flex items-center gap-2">
            <Link
              to="/neuralcast/newsletter"
              className="neuralcast-mobile-bar neuralcast-tactile inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold text-[#17130f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a97838]/45"
              onPointerDown={() => triggerNeuralCastTactileFeedback(6)}
            >
              Artigos
            </Link>
            <DialogTrigger asChild>
              <button
                type="button"
                className="neuralcast-mobile-bar neuralcast-tactile grid h-11 w-11 place-items-center rounded-[17px] text-[#17130f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a97838]/45"
                aria-label="Abrir menu NeuralCast"
                onPointerDown={() => triggerNeuralCastTactileFeedback()}
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
            </DialogTrigger>
          </div>
        </motion.header>

        <DialogContent
          showCloseButton={false}
          overlayClassName="bg-[#17130f]/18 backdrop-blur-[2px] md:hidden"
          className="neuralcast-mobile-menu !inset-0 !left-0 !top-0 z-[111] !flex !h-[100dvh] !max-h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 overflow-y-auto !rounded-none !border-0 !p-0 !shadow-none md:hidden motion-reduce:duration-0 motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none"
        >
          <DialogTitle className="sr-only">Menu de navegação NeuralCast</DialogTitle>
          <DialogDescription className="sr-only">
            Acesse a página inicial, os artigos e as seções principais da NeuralCast.
          </DialogDescription>

          <div className="relative z-10 flex items-center justify-between border-b border-[#17130f]/10 px-5 pb-4 pt-[calc(1.25rem+env(safe-area-inset-top))]">
            <div>
              <p className="text-xl font-black tracking-[-0.045em] text-[#17130f]">NeuralCast</p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#17130f]/45">Editorial</p>
            </div>
            <DialogClose asChild>
              <button
                type="button"
                className="neuralcast-tactile grid h-11 w-11 place-items-center rounded-full border border-[#17130f]/15 bg-[#f4e8d1]/55 text-[#17130f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a97838]/45"
                aria-label="Fechar menu"
                onPointerDown={() => triggerNeuralCastTactileFeedback()}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </DialogClose>
          </div>

          <nav aria-label="Navegação principal NeuralCast" className="relative z-10 grid gap-4 px-5 py-8">
            {routeNavItems.map((item, index) => (
              <motion.div
                key={item.to}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={shouldReduceMotion ? { duration: 0 } : { delay: index * 0.04 + 0.08, duration: 0.34 }}
              >
                <Link
                  to={item.to}
                  aria-current={isRouteActive(item.to) ? "page" : undefined}
                  className={cn(
                    "neuralcast-menu-item neuralcast-tactile flex min-h-16 items-center justify-between gap-4 rounded-[26px] px-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a97838]/45",
                    isRouteActive(item.to) && "neuralcast-menu-item-active",
                  )}
                  onPointerDown={() => triggerNeuralCastTactileFeedback()}
                >
                  <span>
                    <span className="block text-3xl font-black tracking-normal text-[#17130f]">{item.label}</span>
                    <span className="mt-1 block text-xs font-semibold text-[#17130f]/52">
                      {item.to === "/neuralcast" ? "Página inicial e manifesto" : "Arquivo e leitura completa"}
                    </span>
                  </span>
                  <item.icon className="h-5 w-5 text-[#a97838]" aria-hidden="true" />
                </Link>
              </motion.div>
            ))}

            <div className="mt-2 grid gap-2 rounded-[26px] border border-[#17130f]/10 bg-[#f4e8d1]/35 p-2">
              {sectionNavItems.map((item, index) => (
                <motion.div
                  key={item.target}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { delay: index * 0.04 + 0.16, duration: 0.34 }}
                >
                  <button
                    type="button"
                    onClick={() => scrollToSection(item.target)}
                    className="neuralcast-tactile flex min-h-14 w-full items-center justify-between rounded-[20px] px-4 text-left text-sm font-black uppercase tracking-[0.12em] text-[#17130f]/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a97838]/45"
                  >
                    {item.label}
                    <item.icon className="h-4 w-4 text-[#a97838]" aria-hidden="true" />
                  </button>
                </motion.div>
              ))}
            </div>
          </nav>

          <div className="relative z-10 mt-auto px-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => scrollToSection("newsletter")}
              className="neuralcast-primary-button neuralcast-tactile flex min-h-14 w-full items-center justify-center rounded-full px-6 text-xs font-black uppercase tracking-[0.12em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d5ad69]/55"
            >
              Assinar newsletter <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function NeuralCastShell({ children }: { children: ReactNode }) {
  return (
    <div className="neuralcast-page min-h-screen bg-[#ead8b7] font-sans text-[#17130f] selection:bg-[#17130f] selection:text-[#f4e8d1]">
      <NeuralCastHeader />
      <main className="relative z-10 pt-[5.5rem] md:pt-32">{children}</main>
      <footer className="neuralcast-dark-section relative z-10 border-t border-[#f4e8d1]/[0.15] bg-[#17130f] px-5 py-10 text-[#f4e8d1] md:px-8 md:py-14">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <NeuralCastLogo surface="dark" />
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#f4e8d1]/[0.6]">
              Neurociência, comportamento, cultura e liderança traduzidos em ideias aplicáveis para pessoas e organizações.
            </p>
          </div>
          <div className="text-sm text-[#f4e8d1]/[0.55] md:text-right">
            <p>Pedro Luiz Pereira</p>
            <p className="mt-1">Uma publicação independente em parceria experimental com NeuroNex / NeuroX.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function NeuralCastSubscribeForm({ inverted = false }: { inverted?: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setStatus("error");
      setMessage("Digite um e-mail válido para continuar.");
      return;
    }

    setStatus("loading");
    setMessage("");

    const { error } = await supabase.rpc("subscribe_neuralcast_newsletter", {
      p_email: normalizedEmail,
      p_name: name.trim() || null,
      p_source: window.location.pathname,
    });

    if (error) {
      setStatus("error");
      setMessage("Não foi possível concluir sua inscrição agora. Tente novamente em instantes.");
      return;
    }

    setStatus("success");
    setMessage("Inscrição confirmada. Os próximos textos chegam até você.");
    setEmail("");
    setName("");
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8" noValidate>
      <div className="grid gap-3 md:grid-cols-[0.75fr_1fr_auto]">
        <label className="sr-only" htmlFor="neuralcast-name">Nome</label>
        <input
          id="neuralcast-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Seu nome"
          autoComplete="name"
          className={cn(
            "neuralcast-field h-14 rounded-full border px-5 text-sm font-semibold outline-none transition focus:ring-2",
            inverted
              ? "border-[#f4e8d1]/[0.20] bg-[#f4e8d1]/[0.08] text-[#f4e8d1] placeholder:text-[#f4e8d1]/[0.45] focus:ring-[#f4e8d1]/[0.35]"
              : "border-[#17130f]/[0.15] bg-[#f4e8d1]/[0.65] text-[#17130f] placeholder:text-[#17130f]/[0.45] focus:ring-[#17130f]/[0.20]",
          )}
        />
        <label className="sr-only" htmlFor="neuralcast-email">E-mail</label>
        <input
          id="neuralcast-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="voce@empresa.com.br"
          autoComplete="email"
          required
          className={cn(
            "neuralcast-field h-14 rounded-full border px-5 text-sm font-semibold outline-none transition focus:ring-2",
            inverted
              ? "border-[#f4e8d1]/[0.20] bg-[#f4e8d1]/[0.08] text-[#f4e8d1] placeholder:text-[#f4e8d1]/[0.45] focus:ring-[#f4e8d1]/[0.35]"
              : "border-[#17130f]/[0.15] bg-[#f4e8d1]/[0.65] text-[#17130f] placeholder:text-[#17130f]/[0.45] focus:ring-[#17130f]/[0.20]",
          )}
        />
        <button
          type="submit"
          disabled={status === "loading"}
          onPointerDown={() => triggerNeuralCastTactileFeedback()}
          className={cn(
            "neuralcast-tactile inline-flex h-14 items-center justify-center rounded-full px-7 text-xs font-black uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-60",
            inverted ? "bg-[#f4e8d1] text-[#17130f]" : "bg-[#17130f] text-[#f4e8d1]",
          )}
        >
          {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Mail className="mr-2 h-4 w-4" /> Assinar</>}
        </button>
      </div>
      {message ? (
        <p
          role="status"
          className={cn(
            "mt-4 flex items-center gap-2 text-sm font-semibold",
            status === "success" ? (inverted ? "text-[#f4e8d1]" : "text-[#17130f]") : "text-red-700",
          )}
        >
          {status === "success" ? <Check className="h-4 w-4" /> : null}
          {message}
        </p>
      ) : null}
      <p className={cn("mt-4 text-xs leading-relaxed", inverted ? "text-[#f4e8d1]/[0.48]" : "text-[#17130f]/[0.48]")}>
        Conteúdo autoral, sem excesso de e-mails. Você poderá sair da lista quando desejar.
      </p>
    </form>
  );
}

export function NeuralCastArticleCard({ article, inverted = false }: { article: NeuralCastArticle; inverted?: boolean }) {
  return (
    <article
      className={cn(
        "neuralcast-card-material neuralcast-tactile group flex min-h-[360px] flex-col justify-between rounded-[30px] border p-7 md:p-9",
        inverted
          ? "border-[#f4e8d1]/[0.16] bg-[#f4e8d1]/[0.045] text-[#f4e8d1]"
          : "border-[#17130f]/[0.12] bg-[#f4e8d1]/[0.38] text-[#17130f]",
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-4 text-[10px] font-black uppercase tracking-[0.16em] opacity-55">
          <span>{article.category}</span>
          <span>{article.readTime}</span>
        </div>
        <h2 className="mt-8 text-balance text-3xl font-black leading-[0.94] tracking-[-0.055em] md:text-4xl">{article.title}</h2>
        <p className="mt-5 text-sm font-medium leading-relaxed opacity-65 md:text-base">{article.excerpt}</p>
      </div>
      <div className="mt-10 flex items-center justify-between gap-4 border-t border-current/[0.12] pt-5">
        <span className="text-xs font-semibold opacity-55">{article.publishedAt}</span>
        <Link
          to={`/neuralcast/newsletter/${article.slug}`}
          className="inline-flex min-h-11 items-center rounded-full px-1 text-xs font-black uppercase tracking-[0.12em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a97838]/45"
          onPointerDown={() => triggerNeuralCastTactileFeedback(6)}
        >
          Ler artigo <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </article>
  );
}
