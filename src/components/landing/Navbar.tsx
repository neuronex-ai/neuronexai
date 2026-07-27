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

const navControlClass =
  "public-navbar-control public-tactile flex min-h-11 items-center rounded-[20px] px-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
    <nav className="pointer-events-none fixed inset-x-0 top-7 z-[100] hidden justify-center px-4 md:flex">
      <div className="global-retina-navbar public-liquid-navbar pointer-events-auto relative flex w-fit max-w-[calc(100vw-32px)] items-center justify-between gap-3 rounded-[30px] border border-black/[0.075] bg-white/[0.72] px-2 py-2 ring-1 ring-white/40 backdrop-blur-3xl transition-[background-color,border-color,box-shadow] duration-500 ease-apple dark:border-white/[0.055] dark:bg-[#080808]/82 dark:ring-white/[0.025] motion-reduce:transition-none">
        <div className="flex shrink-0 items-center">
          <Link
            to="/"
            aria-label="Ir para a página inicial da NeuroNex"
            className="public-navbar-brand public-tactile group flex min-h-12 items-center gap-3 rounded-full px-3 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-[18px] border border-black/[0.06] bg-white/80 shadow-[0_18px_44px_-30px_rgba(0,0,0,0.34)] transition-[transform,background-color,border-color,box-shadow] duration-300 group-hover:scale-105 dark:border-white/[0.08] dark:bg-white/[0.045] dark:shadow-[0_18px_48px_-30px_rgba(255,255,255,0.26)] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
              <Logo className="h-6 w-6" />
            </span>
            <span className="whitespace-nowrap font-sans text-[10px] font-black uppercase tracking-[0.28em] text-foreground">
              NeuroNex
            </span>
          </Link>
        </div>

        <div className="flex shrink-0 items-center justify-center gap-1.5 font-sans text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 dark:text-white/45">
          <button
            type="button"
            onClick={() => handleSectionClick("diferenciais")}
            className={cn(navControlClass, "hidden xl:flex")}
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
              className={cn(
                navControlClass,
                "gap-1.5",
                productsOpen && "public-navbar-control-active",
              )}
              onClick={() => setProductsOpen(true)}
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
                  className="absolute left-1/2 top-full w-[min(620px,calc(100vw-32px))] pt-2 text-foreground xl:w-[720px]"
                >
                  <div
                    id="public-product-menu"
                    role="group"
                    aria-label="Produtos NeuroNex"
                    className="public-glass-surface public-product-menu-surface rounded-[30px] p-2.5 border border-black/[0.08] bg-white/80 backdrop-blur-xl shadow-2xl dark:border-white/[0.08] dark:bg-zinc-950/85"
                  >
                    <div className="grid grid-cols-3 gap-1.5" role="list">
                      {productLinks.map((item, index) => {
                        const isActive = location.pathname === item.to;

                        return (
                          <Link
                            key={item.to}
                            to={item.to}
                            aria-current={isActive ? "page" : undefined}
                            role="listitem"
                            className={cn(
                              "public-product-menu-item public-tactile group relative flex min-h-[88px] gap-3 overflow-hidden rounded-[20px] px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              index === productLinks.length - 1 && "col-span-1",
                            )}
                          >
                            {isActive ? (
                              <span
                                className="absolute inset-1 rounded-2xl bg-black/[0.045] dark:bg-white/[0.065]"
                              />
                            ) : null}
                            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-black/[0.055] bg-white/70 text-zinc-400 shadow-[0_16px_36px_-28px_rgba(0,0,0,0.42)] transition-colors group-hover:text-zinc-900 dark:border-white/[0.08] dark:bg-white/[0.045] dark:text-white/45 dark:group-hover:text-white">
                              <item.icon aria-hidden="true" className="h-4 w-4" />
                            </span>
                            <span className="relative min-w-0 pt-0.5">
                              <span className="flex items-center gap-2 font-sans text-[10px] font-black uppercase tracking-[0.18em]">
                                {item.label}
                              </span>
                              <span className="mt-1.5 block font-sans text-[10px] font-medium normal-case leading-relaxed tracking-normal text-zinc-500 dark:text-white/45">
                                {item.description}
                              </span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                    <Link
                      to="/produto"
                      className="public-product-menu-footer public-tactile mt-1 flex min-h-12 items-center justify-between rounded-[18px] px-4 font-sans text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 transition-colors hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:text-zinc-900 dark:text-white/45 dark:hover:text-white dark:focus-visible:text-white"
                    >
                      Conhecer a operation completa
                      <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                    </Link>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <Link
            to="/comparar"
            className={navControlClass}
          >
            COMPARAR
          </Link>
          <Link
            to="/download"
            className={cn(navControlClass, "hidden lg:flex")}
          >
            DOWNLOAD
          </Link>
          <Link
            to="/blog"
            className={cn(navControlClass, "hidden xl:flex")}
          >
            NEUROX
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <Button
            asChild
            size="sm"
            className="public-tactile hidden h-11 rounded-full bg-foreground px-7 font-sans text-[10px] font-black uppercase tracking-[0.18em] text-background shadow-none hover:bg-foreground/90 md:inline-flex"
          >
            <Link to="/auth">ENTRAR</Link>
          </Button>
        </div>
      </div>
    </nav>
  );
};