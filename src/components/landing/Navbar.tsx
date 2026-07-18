import {
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  FileText,
  Landmark,
  MessageCircle,
  Network,
  Sparkles,
  UsersRound,
  Video,
  WalletCards,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

const productLinks = [
  {
    to: "/agenda-para-psicologos",
    label: "Agenda",
    description: "Sessões, recorrência e políticas.",
    icon: CalendarDays,
  },
  {
    to: "/pacientes-para-psicologos",
    label: "Pacientes",
    description: "Contexto longitudinal em um só lugar.",
    icon: UsersRound,
  },
  {
    to: "/prontuario-para-psicologos",
    label: "Prontuário",
    description: "Registro clínico vivo e conectado.",
    icon: FileText,
  },
  {
    to: "/teleconsulta-para-psicologos",
    label: "Teleconsulta",
    description: "Da sala ao prontuário, sem retrabalho.",
    icon: Video,
  },
  {
    to: "/synapse",
    label: "Synapse",
    description: "Ações por voz e texto, com sua confirmação.",
    icon: Sparkles,
  },
  {
    to: "/neurobox",
    label: "NeuroBox",
    description: "Grafos, fluxos e raciocínio clínico visual.",
    icon: Network,
  },
  {
    to: "/neurofinance",
    label: "NeuroFinance",
    description: "Conta, Pix, pagamentos e recursos fiscais.",
    icon: Landmark,
  },
  {
    to: "/gestao-financeira-para-psicologos",
    label: "Gestão financeira",
    description: "Receitas, despesas e planejamento.",
    icon: WalletCards,
  },
  {
    to: "/neurozap-para-psicologos",
    label: "NeuroZap",
    description: "WhatsApp Business conectado à NeuroNex.",
    icon: MessageCircle,
  },
];

export const Navbar = () => {
  const [productsOpen, setProductsOpen] = useState(false);
  const productMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProductsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    setProductsOpen(false);
  }, [location.pathname]);

  const handleSectionClick = (target: string) => {
    if (location.pathname !== "/") {
      navigate(`/#${target}`);
      return;
    }

    document.getElementById(target)?.scrollIntoView({
      behavior: "auto",
    });
  };

  return (
    <nav className="pointer-events-none fixed inset-x-0 top-0 z-[100] hidden justify-center py-4 md:flex">
      <div className="global-retina-navbar public-liquid-navbar pointer-events-auto relative flex w-[min(880px,calc(100vw-24px))] items-center justify-between gap-3 rounded-[30px] border border-black/[0.075] bg-white/[0.72] px-2.5 py-2.5 shadow-[0_30px_90px_-46px_rgba(0,0,0,0.68),inset_0_1px_0_rgba(255,255,255,0.7)] ring-1 ring-white/40 backdrop-blur-3xl transition-[transform,background-color,border-color,box-shadow] duration-500 ease-apple hover:-translate-y-0.5 hover:bg-white/[0.78] dark:border-white/[0.055] dark:bg-[#080808]/82 dark:ring-white/[0.025] dark:hover:bg-[#0a0a0a]/88 motion-reduce:transform-none motion-reduce:transition-none">
        <div className="flex items-center gap-2 border-r border-black/[0.055] pr-3 dark:border-white/[0.08]">
          <Link
            to="/"
            aria-label="Ir para a página inicial da NeuroNex"
            className="public-tactile group flex min-h-11 items-center gap-3 rounded-[22px] px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-[18px] border border-black/[0.06] bg-white/80 shadow-[0_18px_44px_-30px_rgba(0,0,0,0.34)] transition-[transform,background-color,border-color,box-shadow] duration-300 group-hover:scale-[1.025] dark:border-white/[0.08] dark:bg-white/[0.045] dark:shadow-[0_18px_48px_-30px_rgba(255,255,255,0.26)] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
              <Logo className="h-6 w-6" />
            </span>
            <span className="whitespace-nowrap font-sans text-[10px] font-black uppercase tracking-[0.22em] text-foreground">
              NEURONEX
            </span>
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center gap-3 font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground xl:gap-5">
          <button
            type="button"
            onClick={() => handleSectionClick("diferenciais")}
            className="hidden min-h-11 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-foreground xl:block"
          >
            DIFERENCIAIS
          </button>

          <div
            ref={productMenuRef}
            className="relative"
            onMouseEnter={() => setProductsOpen(true)}
            onMouseLeave={() => setProductsOpen(false)}
            onFocus={() => setProductsOpen(true)}
            onBlur={(event) => {
              if (
                !(event.relatedTarget instanceof Node) ||
                !productMenuRef.current?.contains(event.relatedTarget)
              ) {
                setProductsOpen(false);
              }
            }}
          >
            <button
              type="button"
              aria-expanded={productsOpen}
              aria-controls="public-product-menu"
              className="flex min-h-11 items-center gap-1.5 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-foreground"
              onClick={() => setProductsOpen((current) => !current)}
            >
              PRODUTOS
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200",
                  productsOpen && "rotate-180",
                )}
              />
            </button>

            <AnimatePresence>
              {productsOpen ? (
                <motion.div
                  id="public-product-menu"
                  aria-label="Produtos NeuroNex"
                  initial={
                    shouldReduceMotion
                      ? false
                      : { opacity: 0, x: "-50%", y: -6, scale: 0.985 }
                  }
                  animate={{ opacity: 1, x: "-50%", y: 0, scale: 1 }}
                  exit={
                    shouldReduceMotion
                      ? { opacity: 0, x: "-50%" }
                      : {
                          opacity: 0,
                          x: "-50%",
                          y: -4,
                          scale: 0.99,
                        }
                  }
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 470, damping: 38, mass: 0.72 }
                  }
                  className="public-glass-surface public-product-menu-surface absolute left-1/2 top-[calc(100%+8px)] w-[min(660px,calc(100vw-32px))] rounded-[26px] p-1.5 text-foreground xl:w-[780px]"
                >
                  <div className="grid grid-cols-3 gap-1" role="list">
                    {productLinks.map((item, index) => {
                      const isActive = location.pathname === item.to;

                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          aria-current={isActive ? "page" : undefined}
                          role="listitem"
                          className={cn(
                            "public-product-menu-item public-tactile group relative flex min-h-[80px] gap-3 overflow-hidden rounded-[18px] px-3.5 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            index === productLinks.length - 1 && "col-span-1",
                          )}
                        >
                          {isActive ? (
                            <span
                              className="absolute inset-1 rounded-[14px] bg-foreground/[0.07] dark:bg-white/[0.08]"
                            />
                          ) : null}
                          <item.icon
                            aria-hidden="true"
                            className="relative mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                          />
                          <span className="relative min-w-0">
                            <span className="flex items-center gap-2 font-sans text-[10px] font-bold uppercase tracking-[0.12em]">
                              {item.label}
                            </span>
                            <span className="mt-1.5 block font-sans text-[9px] font-semibold uppercase leading-relaxed tracking-[0.08em] text-muted-foreground">
                              {item.description}
                            </span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                  <Link
                    to="/produto"
                    className="public-product-menu-footer public-tactile mt-1 flex min-h-12 items-center justify-between rounded-[17px] px-4 font-sans text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:text-foreground"
                  >
                    Ver todo o ecossistema
                    <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                  </Link>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <Link
            to="/download"
            className="flex min-h-11 items-center transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-foreground"
          >
            DOWNLOAD
          </Link>
          <Link
            to="/blog"
            className="hidden min-h-11 items-center transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-foreground xl:flex"
          >
            NEUROX
          </Link>
        </div>

        <div className="flex items-center gap-1 border-l border-black/[0.055] pl-3 dark:border-white/[0.08]">
          <ThemeToggle />
          <Button
            asChild
            size="sm"
            className="public-tactile hidden h-11 rounded-full bg-foreground px-7 font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-background shadow-none hover:bg-foreground/90 md:inline-flex"
          >
            <Link to="/auth">ENTRAR</Link>
          </Button>
        </div>
      </div>
    </nav>
  );
};
