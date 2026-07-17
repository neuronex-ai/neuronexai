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
  const [scrolled, setScrolled] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const productMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
      behavior: shouldReduceMotion ? "auto" : "smooth",
    });
  };

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.6,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[100] hidden justify-center md:flex",
        scrolled ? "py-4" : "py-6",
      )}
    >
      <AnimatePresence>
        {productsOpen ? (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-[-1] bg-background/34 backdrop-blur-[14px] dark:bg-black/48"
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
          />
        ) : null}
      </AnimatePresence>
      <motion.div
        layout={!shouldReduceMotion}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "public-glass-surface pointer-events-auto relative flex w-[min(980px,calc(100vw-24px))] items-center justify-between gap-4 rounded-full px-4 py-3 xl:gap-8 xl:px-8",
          scrolled
            ? "border-border/60 bg-background/78"
            : "border-border/45 bg-background/64",
          "dark:border-white/10 dark:bg-black/64",
        )}
      >
        <motion.div
          whileHover={shouldReduceMotion ? undefined : { scale: 1.015 }}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
        >
          <Link
            to="/"
            aria-label="Ir para a página inicial da NeuroNex"
            className="public-tactile flex min-h-11 items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
          >
            <Logo className="h-7 w-7" />
            <span className="ml-3 whitespace-nowrap font-mono text-[12px] font-bold uppercase tracking-[0.24em] text-foreground">
              NeuroNex
            </span>
          </Link>
        </motion.div>

        <div className="flex items-center gap-4 font-sans text-[11px] font-semibold uppercase tracking-normal text-muted-foreground xl:gap-7">
          <button
            type="button"
            onClick={() => handleSectionClick("diferenciais")}
            className="hidden min-h-11 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-foreground xl:block"
          >
            Diferenciais
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
              Produtos
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
                  className="public-glass-surface public-product-menu-surface absolute left-1/2 top-[calc(100%+9px)] w-[min(660px,calc(100vw-32px))] rounded-[28px] p-2 text-foreground xl:w-[780px]"
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
                            "public-product-menu-item public-tactile group relative flex min-h-[86px] gap-3 overflow-hidden rounded-[18px] px-4 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            index === productLinks.length - 1 && "col-span-1",
                          )}
                        >
                          {isActive ? (
                            <motion.span
                              layoutId="public-product-active"
                              className="absolute inset-1 rounded-[14px] bg-foreground/[0.07] dark:bg-white/[0.08]"
                              transition={{ duration: shouldReduceMotion ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
                            />
                          ) : null}
                          <item.icon
                            aria-hidden="true"
                            className="relative mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                          />
                          <span className="relative min-w-0">
                            <span className="flex items-center gap-2 font-sans text-sm font-bold normal-case tracking-normal">
                              {item.label}
                            </span>
                            <span className="mt-1.5 block font-sans text-xs font-medium normal-case leading-relaxed tracking-normal text-muted-foreground">
                              {item.description}
                            </span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                  <Link
                    to="/produto"
                    className="public-product-menu-footer public-tactile mt-1 flex min-h-12 items-center justify-between rounded-[17px] px-4 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:text-foreground"
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
            Download
          </Link>
          <Link
            to="/blog"
            className="hidden min-h-11 items-center transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-foreground xl:flex"
          >
            NeuroX
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button
            asChild
            size="sm"
            className="public-tactile hidden h-11 rounded-full bg-foreground px-7 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-background shadow-none hover:bg-foreground/90 md:inline-flex"
          >
            <Link to="/auth">Entrar</Link>
          </Button>
        </div>
      </motion.div>
    </motion.nav>
  );
};
