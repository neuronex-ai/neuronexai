import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Download,
  FileText,
  Landmark,
  MessageCircle,
  Network,
  Scale,
  Sparkles,
  UsersRound,
  Video,
  WalletCards,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import {
  type FocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
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

const productGroups = [
  {
    label: "Rotina clínica",
    description: "Do agendamento ao registro do atendimento.",
    links: productLinks.slice(0, 4),
  },
  {
    label: "Inteligência e gestão",
    description: "Contexto, análise e operação conectados.",
    links: productLinks.slice(4),
  },
];

const publicLinks = [
  {
    to: "/comparar",
    label: "Comparar sistemas",
    description: "Diferenças de proposta e fluxo.",
    icon: Scale,
  },
  {
    to: "/download",
    label: "Baixar NeuroNex",
    description: "Opções de instalação.",
    icon: Download,
  },
  {
    to: "/blog",
    label: "NeuroX",
    description: "Conteúdo para sua prática.",
    icon: BookOpen,
  },
];

const navControlClass =
  "public-navbar-control public-tactile flex min-h-11 items-center rounded-[18px] px-4 text-xs font-semibold tracking-[-0.01em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export const Navbar = () => {
  const [productsOpen, setProductsOpen] = useState(false);
  const [productMenuPosition, setProductMenuPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const productMenuRef = useRef<HTMLDivElement>(null);
  const productButtonRef = useRef<HTMLButtonElement>(null);
  const productPopoverRef = useRef<HTMLDivElement>(null);
  const productCloseTimerRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && productsOpen) {
        productButtonRef.current?.focus();
        setProductsOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [productsOpen]);

  useEffect(
    () => () => {
      if (productCloseTimerRef.current !== null) {
        window.clearTimeout(productCloseTimerRef.current);
      }
    },
    [],
  );

  useLayoutEffect(() => {
    if (!productsOpen) return;

    const updateProductMenuPosition = () => {
      const trigger = productButtonRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const menuWidth = Math.min(
        window.innerWidth - 32,
        window.innerWidth >= 1280 ? 860 : 720,
      );
      const halfMenuWidth = menuWidth / 2;
      const unclampedLeft = rect.left + rect.width / 2;

      setProductMenuPosition({
        left: Math.max(
          16 + halfMenuWidth,
          Math.min(window.innerWidth - 16 - halfMenuWidth, unclampedLeft),
        ),
        top: rect.bottom,
      });
    };

    updateProductMenuPosition();
    window.addEventListener("resize", updateProductMenuPosition);

    return () =>
      window.removeEventListener("resize", updateProductMenuPosition);
  }, [productsOpen]);

  useEffect(() => {
    setProductsOpen(false);
  }, [location.pathname]);

  const keepProductsOpen = () => {
    if (productCloseTimerRef.current !== null) {
      window.clearTimeout(productCloseTimerRef.current);
      productCloseTimerRef.current = null;
    }
    setProductsOpen(true);
  };

  const toggleProducts = () => {
    if (productCloseTimerRef.current !== null) {
      window.clearTimeout(productCloseTimerRef.current);
      productCloseTimerRef.current = null;
    }
    setProductsOpen((isOpen) => !isOpen);
  };

  const closeProductsSoon = () => {
    if (productCloseTimerRef.current !== null) {
      window.clearTimeout(productCloseTimerRef.current);
    }
    productCloseTimerRef.current = window.setTimeout(() => {
      setProductsOpen(false);
      productCloseTimerRef.current = null;
    }, 100);
  };

  const handleProductsBlur = (event: FocusEvent<HTMLElement>) => {
    const nextTarget = event.relatedTarget;
    if (
      nextTarget instanceof Node &&
      (productMenuRef.current?.contains(nextTarget) ||
        productPopoverRef.current?.contains(nextTarget))
    ) {
      return;
    }

    setProductsOpen(false);
  };

  const handleProductButtonKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      keepProductsOpen();
      window.requestAnimationFrame(() => {
        productPopoverRef.current
          ?.querySelector<HTMLElement>("a[href]")
          ?.focus();
      });
      return;
    }

    if (event.key === "Tab" && !event.shiftKey && productsOpen) {
      const firstProductLink =
        productPopoverRef.current?.querySelector<HTMLElement>("a[href]");
      if (firstProductLink) {
        event.preventDefault();
        firstProductLink.focus();
      }
    }
  };

  const handleProductPopoverKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key !== "Tab") return;

    const focusableItems = Array.from(
      productPopoverRef.current?.querySelectorAll<HTMLElement>("a[href]") ?? [],
    );
    if (focusableItems.length === 0) return;

    if (event.shiftKey && event.target === focusableItems[0]) {
      event.preventDefault();
      productButtonRef.current?.focus();
      return;
    }

    if (
      !event.shiftKey &&
      event.target === focusableItems[focusableItems.length - 1]
    ) {
      const nextNavbarControl = productMenuRef.current
        ?.nextElementSibling as HTMLElement | null;
      if (nextNavbarControl) {
        event.preventDefault();
        nextNavbarControl.focus();
      }
    }
  };

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
            <span className="whitespace-nowrap font-sans text-sm font-semibold tracking-[-0.025em] text-foreground">
              NeuroNex
            </span>
          </Link>
        </div>

        <div className="flex shrink-0 items-center justify-center gap-1 font-sans text-muted-foreground">
          <button
            type="button"
            onClick={() => handleSectionClick("diferenciais")}
            className={navControlClass}
          >
            Diferenciais
          </button>

          <div
            ref={productMenuRef}
            className="relative"
            onMouseEnter={keepProductsOpen}
            onMouseLeave={closeProductsSoon}
            onBlur={handleProductsBlur}
          >
            <button
              ref={productButtonRef}
              type="button"
              aria-expanded={productsOpen}
              aria-controls="public-product-menu"
              className={cn(
                navControlClass,
                "gap-1.5",
                productsOpen && "public-navbar-control-active",
              )}
              onClick={toggleProducts}
              onKeyDown={handleProductButtonKeyDown}
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

            {typeof document !== "undefined" &&
            productsOpen &&
            productMenuPosition
              ? createPortal(
                  <motion.div
                        ref={productPopoverRef}
                        initial={
                          shouldReduceMotion
                            ? false
                            : { opacity: 0, x: "-50%", y: -6, scale: 0.985 }
                        }
                        animate={{ opacity: 1, x: "-50%", y: 0, scale: 1 }}
                        transition={
                          shouldReduceMotion
                            ? { duration: 0 }
                            : {
                                type: "spring",
                                stiffness: 470,
                                damping: 38,
                                mass: 0.72,
                              }
                        }
                        style={{
                          left: productMenuPosition.left,
                          top: productMenuPosition.top,
                        }}
                        className="pointer-events-auto fixed z-[200] w-[min(720px,calc(100vw-32px))] pt-2 text-foreground xl:w-[860px]"
                        onMouseEnter={keepProductsOpen}
                        onMouseLeave={closeProductsSoon}
                        onFocus={keepProductsOpen}
                        onBlur={handleProductsBlur}
                        onKeyDown={handleProductPopoverKeyDown}
                      >
                        <div
                          id="public-product-menu"
                          role="group"
                          aria-label="Produtos NeuroNex"
                          className="public-product-menu-surface relative isolate max-h-[calc(100vh-7rem)] overflow-x-hidden overflow-y-auto rounded-[32px] border border-black/[0.1] bg-[rgba(255,255,255,0.86)] p-3 shadow-[0_36px_90px_-30px_rgba(0,0,0,0.42)] ring-1 ring-inset ring-white/70 backdrop-blur-[48px] backdrop-saturate-[145%] dark:border-white/[0.1] dark:bg-[rgba(8,8,10,0.86)] dark:shadow-[0_40px_96px_-26px_rgba(0,0,0,0.88)] dark:ring-white/[0.08]"
                        >
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/55 via-white/10 to-transparent dark:from-white/[0.07] dark:via-transparent"
                          />
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/25"
                          />
                          <div className="relative z-10">
                            <div className="flex items-start justify-between gap-6 px-3 pb-3 pt-2">
                              <div>
                                <p className="text-sm font-semibold tracking-[-0.015em]">
                                  Ecossistema NeuroNex
                                </p>
                                <p className="mt-1 text-xs font-medium leading-relaxed text-muted-foreground">
                                  Uma operação contínua, organizada por finalidade.
                                </p>
                              </div>
                              <Link
                                to="/produto"
                                className="public-tactile inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-border/60 bg-background/60 px-4 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/10 dark:bg-white/[0.04]"
                              >
                                Visão geral
                                <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                              </Link>
                            </div>

                            <div className="grid gap-2 md:grid-cols-2">
                              {productGroups.map((group) => {
                                const headingId = `product-group-${group.label
                                  .replaceAll(" ", "-")
                                  .toLowerCase()}`;

                                return (
                                  <section
                                    key={group.label}
                                    aria-labelledby={headingId}
                                    className="rounded-[24px] border border-border/45 bg-background/32 p-2 dark:border-white/[0.07] dark:bg-white/[0.018]"
                                  >
                                    <div className="px-3 pb-2 pt-2">
                                      <h3 id={headingId} className="text-xs font-semibold text-foreground">
                                        {group.label}
                                      </h3>
                                      <p className="mt-1 text-[11px] font-medium leading-relaxed text-muted-foreground">
                                        {group.description}
                                      </p>
                                    </div>
                                    <div className="grid gap-1" role="list">
                                      {group.links.map((item) => {
                                        const isActive = location.pathname === item.to;

                                        return (
                                          <Link
                                            key={item.to}
                                            to={item.to}
                                            aria-current={isActive ? "page" : undefined}
                                            role="listitem"
                                            className="public-product-menu-item public-tactile group flex min-h-[62px] items-center gap-3 rounded-[18px] px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                          >
                                            <span
                                              className={cn(
                                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] border border-border/55 bg-background/70 text-muted-foreground transition-colors group-hover:text-foreground dark:border-white/[0.08] dark:bg-white/[0.035]",
                                                isActive && "bg-foreground text-background dark:bg-white dark:text-zinc-950",
                                              )}
                                            >
                                              <item.icon aria-hidden="true" className="h-4 w-4" />
                                            </span>
                                            <span className="min-w-0">
                                              <span className="block text-[13px] font-semibold tracking-[-0.015em]">
                                                {item.label}
                                              </span>
                                              <span className="mt-0.5 block truncate text-[10px] font-medium text-muted-foreground">
                                                {item.description}
                                              </span>
                                            </span>
                                          </Link>
                                        );
                                      })}
                                    </div>
                                  </section>
                                );
                              })}
                            </div>

                            <div className="mt-2 grid gap-1.5 sm:grid-cols-3" role="list" aria-label="Mais opções">
                              {publicLinks.map((item) => (
                                <Link
                                  key={item.to}
                                  to={item.to}
                                  role="listitem"
                                  className="public-product-menu-footer public-tactile group flex min-h-[66px] items-center gap-3 rounded-[18px] px-3.5 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  <item.icon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                                  <span className="min-w-0">
                                    <span className="block text-xs font-semibold">{item.label}</span>
                                    <span className="mt-0.5 block truncate text-[10px] font-medium text-muted-foreground">
                                      {item.description}
                                    </span>
                                  </span>
                                </Link>
                              ))}
                            </div>
                          </div>
                        </div>
                  </motion.div>,
                  document.body,
                )
              : null}
          </div>

          <button
            type="button"
            onClick={() => handleSectionClick("pricing")}
            className={navControlClass}
          >
            Preços
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <Button
            asChild
            size="sm"
            className="public-tactile hidden h-11 rounded-full bg-foreground px-6 font-sans text-xs font-semibold tracking-[-0.01em] text-background shadow-none hover:bg-foreground/90 md:inline-flex"
          >
            <Link to="/auth">Entrar</Link>
          </Button>
        </div>
      </div>
    </nav>
  );
};
