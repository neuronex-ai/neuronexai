import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
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
import {
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useState,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import {
  MotionNavigationMenu,
  MotionNavigationMenuContent,
  MotionNavigationMenuItem,
  MotionNavigationMenuLink,
  MotionNavigationMenuList,
  MotionNavigationMenuTrigger,
} from "@/components/ui/motion-navigation-menu";
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

const menuHighlightClass =
  "rounded-[18px] bg-foreground/[0.055] dark:bg-white/[0.07]";

export const Navbar = () => {
  const [productsOpen, setProductsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setProductsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setProductsOpen(false);
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const handleSectionClick = (target: string) => {
    if (location.pathname !== "/") {
      navigate(`/#${target}`);
      return;
    }

    document.getElementById(target)?.scrollIntoView({
      behavior: "auto",
    });
  };

  const handleMenuNavigate = (
    event: ReactMouseEvent<HTMLAnchorElement>,
    to: string,
  ) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    setProductsOpen(false);
    navigate(to);
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

          <MotionNavigationMenu
            value={productsOpen ? "products" : ""}
            onValueChange={(value) => setProductsOpen(value === "products")}
            viewport
            springBounce={0}
            springStiffness={350}
            springDamping={32}
            viewportClassName="public-product-menu-surface !border-black/[0.08] !bg-[rgba(246,247,249,0.80)] shadow-[0_40px_110px_-32px_rgba(0,0,0,0.5)] ring-1 ring-inset ring-white/75 !backdrop-blur-[56px] !backdrop-saturate-[185%] dark:!border-white/[0.12] dark:!bg-[rgba(12,12,14,0.78)] dark:shadow-[0_42px_120px_-30px_rgba(0,0,0,0.92)] dark:ring-white/[0.09] rounded-[28px]"
            className="shrink-0"
          >
            <MotionNavigationMenuList
              className="gap-0"
              highlightClassName="rounded-[18px] bg-foreground/[0.045] dark:bg-white/[0.055]"
            >
              <MotionNavigationMenuItem
                value="products"
                onMouseEnter={() => setProductsOpen(true)}
                onMouseLeave={(event) => {
                  const nextTarget = event.relatedTarget;
                  const navigationRoot = event.currentTarget.closest(
                    '[data-slot="navigation-menu"]',
                  );

                  if (
                    !(nextTarget instanceof Node) ||
                    !navigationRoot?.contains(nextTarget)
                  ) {
                    setProductsOpen(false);
                  }
                }}
              >
                <MotionNavigationMenuTrigger
                  aria-controls="public-product-menu"
                  className={cn(
                    navControlClass,
                    "h-auto gap-0 bg-transparent py-0 hover:bg-transparent focus:bg-transparent",
                    productsOpen && "public-navbar-control-active",
                  )}
                >
                  Produtos
                </MotionNavigationMenuTrigger>

                <MotionNavigationMenuContent
                  className="!p-0 w-[min(820px,calc(100vw-32px))]"
                  highlightClassName={menuHighlightClass}
                  innerClassName="p-3"
                >
                  <div
                    id="public-product-menu"
                    role="group"
                    aria-label="Produtos NeuroNex"
                    className="relative isolate"
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 -z-10 rounded-[24px] bg-gradient-to-br from-white/52 via-white/8 to-transparent dark:from-white/[0.055] dark:via-transparent"
                    />

                    <div className="grid gap-2 lg:grid-cols-[0.82fr_1.55fr]">
                      <MotionNavigationMenuLink
                        href="/produto"
                        onClick={(event) => handleMenuNavigate(event, "/produto")}
                        className="public-tactile min-h-[282px] justify-between rounded-[22px] border border-border/45 bg-background/58 p-5 text-foreground dark:border-white/[0.075] dark:bg-white/[0.025]"
                      >
                        <span className="flex size-11 items-center justify-center rounded-[15px] border border-border/55 bg-background/80 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.045]">
                          <Sparkles className="size-4.5 text-foreground" />
                        </span>
                        <span className="space-y-2">
                          <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                            Ecossistema NeuroNex
                          </span>
                          <span className="block text-lg font-semibold tracking-[-0.03em] text-foreground">
                            Toda a clínica em um fluxo contínuo.
                          </span>
                          <span className="block text-xs font-medium leading-relaxed text-muted-foreground">
                            Conheça a visão geral e como agenda, prontuário, IA e gestão trabalham juntos.
                          </span>
                          <span className="inline-flex items-center gap-1.5 pt-1 text-xs font-semibold text-foreground">
                            Visão geral
                            <ArrowUpRight className="size-3.5" />
                          </span>
                        </span>
                      </MotionNavigationMenuLink>

                      <div className="grid gap-2 md:grid-cols-2">
                        {productGroups.map((group) => (
                          <section
                            key={group.label}
                            className="rounded-[22px] border border-border/40 bg-background/30 p-1.5 dark:border-white/[0.065] dark:bg-white/[0.012]"
                          >
                            <div className="px-3 pb-2 pt-2.5">
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-foreground/70">
                                {group.label}
                              </p>
                              <p className="mt-1 text-[10px] font-medium leading-relaxed text-muted-foreground">
                                {group.description}
                              </p>
                            </div>

                            <div className="grid gap-0.5">
                              {group.links.map((item) => {
                                const isActive = location.pathname === item.to;

                                return (
                                  <MotionNavigationMenuLink
                                    key={item.to}
                                    href={item.to}
                                    data-active={isActive ? "true" : undefined}
                                    aria-current={isActive ? "page" : undefined}
                                    onClick={(event) =>
                                      handleMenuNavigate(event, item.to)
                                    }
                                    className="public-tactile grid min-h-[52px] grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[18px] px-3 py-2 text-left"
                                  >
                                    <span
                                      className={cn(
                                        "flex size-8 items-center justify-center rounded-[12px] border border-border/50 bg-background/72 text-muted-foreground transition-colors dark:border-white/[0.08] dark:bg-white/[0.035]",
                                        isActive &&
                                          "bg-foreground text-background dark:bg-white dark:text-zinc-950",
                                      )}
                                    >
                                      <item.icon className="size-3.5" />
                                    </span>
                                    <span className="min-w-0 space-y-0.5">
                                      <span className="block text-xs font-semibold tracking-[-0.01em] text-foreground">
                                        {item.label}
                                      </span>
                                      <span className="block truncate text-[9px] font-medium text-muted-foreground">
                                        {item.description}
                                      </span>
                                    </span>
                                    <ArrowUpRight className="size-3 text-muted-foreground/70" />
                                  </MotionNavigationMenuLink>
                                );
                              })}
                            </div>
                          </section>
                        ))}
                      </div>
                    </div>

                    <div
                      className="mt-2 grid gap-1.5 sm:grid-cols-3"
                      aria-label="Mais opções"
                    >
                      {publicLinks.map((item) => {
                        const isActive = location.pathname === item.to;

                        return (
                          <MotionNavigationMenuLink
                            key={item.to}
                            href={item.to}
                            data-active={isActive ? "true" : undefined}
                            aria-current={isActive ? "page" : undefined}
                            onClick={(event) => handleMenuNavigate(event, item.to)}
                            className="public-product-menu-footer public-tactile grid min-h-[64px] grid-cols-[auto_1fr] items-center gap-3 rounded-[18px] px-3.5 py-3"
                          >
                            <span className="flex size-8 items-center justify-center rounded-[12px] border border-border/45 bg-background/55 dark:border-white/[0.07] dark:bg-white/[0.025]">
                              <item.icon className="size-3.5" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-xs font-semibold text-foreground">
                                {item.label}
                              </span>
                              <span className="mt-0.5 block truncate text-[9px] font-medium text-muted-foreground">
                                {item.description}
                              </span>
                            </span>
                          </MotionNavigationMenuLink>
                        );
                      })}
                    </div>
                  </div>
                </MotionNavigationMenuContent>
              </MotionNavigationMenuItem>
            </MotionNavigationMenuList>
          </MotionNavigationMenu>

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
