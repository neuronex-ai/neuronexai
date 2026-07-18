"use client";

import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Calendar,
  Users,
  DollarSign,
  Settings,
  LogOut,
  Search,
  NotebookPen,
  Bell,
  Video,
  HelpCircle,
  Moon,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { useUnreadNotificationCount } from "@/hooks/use-notifications";
import { useIsMobile } from "@/hooks/use-mobile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProfile } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/components/auth/SessionContextProvider";
import { CommandSearch } from "./CommandSearch";
import { TrialStatusIndicator } from "@/components/subscription";
import { SYNAPSE_PAGE_ACTION_EVENT, type SynapseInterfaceAction } from "@/lib/synapse-interface-actions";

export const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { unreadCount } = useUnreadNotificationCount();
  const { data: profile } = useProfile();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDarkTheme = theme === "dark";
  const isMobile = useIsMobile();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    const handleSynapseAction = (event: Event) => {
      const action = (event as CustomEvent<SynapseInterfaceAction>).detail;
      if (action?.destination === "global.search") setIsSearchOpen(true);
    };
    window.addEventListener(SYNAPSE_PAGE_ACTION_EVENT, handleSynapseAction);
    return () => window.removeEventListener(SYNAPSE_PAGE_ACTION_EVENT, handleSynapseAction);
  }, []);

  const navigation = [
    { name: "Painel", href: "/dashboard", icon: LayoutDashboard },
    { name: "Agenda", href: "/agenda", icon: Calendar },
    { name: "Teleconsulta", href: "/teleconsulta", icon: Video },
    { name: "Pacientes", href: "/pacientes", icon: Users },
    { name: "Notas", href: "/notas", icon: NotebookPen },
    { name: "Financeiro", href: "/financeiro", icon: DollarSign },
  ];

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) toast.success("Até logo.");
    navigate("/auth");
  };

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Usuário';

  const dockItemClass = (active: boolean) => cn(
    "desktop-retina-interactive relative flex items-center justify-center w-10 h-10 rounded-2xl cursor-pointer group",
    active
      ? isDarkTheme
        ? "bg-white text-black shadow-[0_18px_48px_-28px_rgba(255,255,255,0.48),inset_0_1px_0_rgba(255,255,255,0.65)]"
        : "bg-zinc-950 text-white shadow-[0_18px_44px_-26px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.12)]"
      : isDarkTheme
        ? "text-white/42 hover:bg-white/[0.065] hover:text-white"
        : "text-zinc-400 hover:bg-black/[0.045] hover:text-zinc-900"
  );

  const activeDotClass = cn(
    "absolute -bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full",
    isDarkTheme
      ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
      : "bg-zinc-900 shadow-[0_0_8px_rgba(24,24,27,0.18)]"
  );

  const utilityButtonClass = cn(
    "desktop-retina-interactive w-10 h-10 rounded-2xl",
    isDarkTheme
      ? "text-white/42 hover:bg-white/[0.065] hover:text-white"
      : "text-zinc-400 hover:bg-black/[0.045] hover:text-zinc-900"
  );

  const tooltipClass = cn(
    "text-[9px] font-black uppercase px-4 py-2 rounded-xl tracking-[0.2em] backdrop-blur-xl",
    isDarkTheme
      ? "border-white/10 bg-[#0a0a0a]/95 text-white/58"
      : "border-zinc-200 bg-white/95 text-zinc-500"
  );

  const NavItem = ({ item }: { item: typeof navigation[0] }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.href || (item.href !== '/dashboard' && location.pathname.startsWith(item.href));

    return (
      <Tooltip key={item.name}>
        <TooltipTrigger asChild>
          <Link to={item.href} id={`nav-${item.href.replace('/', '')}`}>
            <div className={dockItemClass(isActive)}>
              <Icon className={cn("h-4 w-4 transition-transform duration-500", isActive ? "scale-100" : "group-hover:scale-110")} />
              {isActive && <span className={activeDotClass} />}
            </div>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom" className={tooltipClass}>{item.name}</TooltipContent>
      </Tooltip>
    );
  };

  if (isMobile) return null;

  return (
    <nav id="navbar-container" className="fixed top-7 left-0 right-0 z-[60] flex justify-center pointer-events-none px-4">
      <div
        className={cn(
          "global-retina-navbar pointer-events-auto flex items-center gap-3 rounded-[30px] px-2.5 py-2.5 backdrop-blur-3xl transition-[transform,background-color,border-color,box-shadow] duration-500 ease-apple hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none",
          isDarkTheme
            ? "border border-white/[0.055] bg-[#080808]/82 ring-1 ring-white/[0.025] hover:bg-[#0a0a0a]/88"
            : "border border-black/[0.075] bg-white/[0.72] shadow-[0_30px_90px_-46px_rgba(0,0,0,0.68),inset_0_1px_0_rgba(255,255,255,0.7)] ring-1 ring-white/40 hover:bg-white/[0.78] hover:shadow-[0_42px_112px_-56px_rgba(0,0,0,0.78),inset_0_1px_0_rgba(255,255,255,0.8)]"
        )}
      >
        <div className={cn("flex items-center gap-2 pr-4 border-r", isDarkTheme ? "border-white/[0.08]" : "border-black/[0.055]")}>
          <Link
            to="/dashboard"
            aria-label="Ir para o dashboard NeuroNex"
            className={cn(
              "group flex items-center gap-3 rounded-[22px] px-1.5 py-1 transition-colors duration-300 hover:bg-black/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/[0.055]",
            )}
          >
            <span
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-[18px] border transition-[transform,background-color,border-color,box-shadow] duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100",
                isDarkTheme
                  ? "border-white/[0.08] bg-white/[0.045] shadow-[0_18px_48px_-30px_rgba(255,255,255,0.26)]"
                  : "border-black/[0.06] bg-white/80 shadow-[0_18px_44px_-30px_rgba(0,0,0,0.34)]",
              )}
            >
              <img
                src={isDarkTheme ? "/favicon-light.png" : "/favicon-dark.png"}
                alt=""
                aria-hidden="true"
                className="h-6 w-6 object-contain transition-transform duration-500 group-hover:scale-105"
              />
            </span>
            <span className={cn("text-[10px] font-black tracking-[0.28em] uppercase hidden md:block transition-colors duration-500", isDarkTheme ? "text-white" : "text-zinc-900")}>NeuroNex AI</span>
          </Link>
          <TrialStatusIndicator compact className="hidden xl:inline-flex" />
        </div>

        <div id="main-navigation" className="flex items-center gap-1">
          {navigation.map((item) => <NavItem key={item.name} item={item} />)}
        </div>

        <div className={cn("flex items-center gap-1 pl-4 border-l", isDarkTheme ? "border-white/[0.08]" : "border-black/[0.055]")}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button id="global-search" size="icon" variant="ghost" className={utilityButtonClass} onClick={() => setIsSearchOpen(true)}>
                <Search className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className={tooltipClass}>Buscar</TooltipContent>
          </Tooltip>

          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button id="notifications-trigger" size="icon" variant="ghost" className={cn("relative", utilityButtonClass)} aria-label={`Notificações${unreadCount > 0 ? `, ${unreadCount} não lidas` : ''}`}>
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full border-2 border-background bg-red-500 px-1 text-[7px] font-black text-white shadow-[0_0_8px_rgba(239,68,68,0.55)]">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className={tooltipClass}>Notificações</TooltipContent>
            </Tooltip>
            <PopoverContent
              align="center"
              sideOffset={14}
              className={cn(
                "notification-popover-surface z-[70] h-[560px] max-h-[72vh] w-[420px] overflow-hidden rounded-[30px] p-0 shadow-[0_36px_88px_-42px_rgba(0,0,0,0.72)]",
                isDarkTheme
                  ? "desktop-retina-modal border border-white/10 bg-[#080808]/95 ring-1 ring-white/5"
                  : "border border-zinc-200 bg-white/95 ring-1 ring-black/5"
              )}
            >
              <AlertsPanel />
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative ml-1 h-10 w-10 overflow-hidden rounded-2xl p-0 ring-offset-background transition-transform duration-200 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:scale-100">
                <Avatar className="h-10 w-10 border border-zinc-200 dark:border-white/10 rounded-2xl">
                  <AvatarImage src={profile?.avatar_url || ''} alt={fullName} className="object-cover" />
                  <AvatarFallback className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[10px] font-black">{fullName.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className={cn(
                "w-64 backdrop-blur-[32px] rounded-[32px] p-3 z-[9999] shadow-[0_48px_96px_-24px_rgba(0,0,0,0.5)]",
                isDarkTheme
                  ? "desktop-retina-modal border border-white/10 bg-[#080808]/95 ring-1 ring-white/5"
                  : "border border-zinc-200 bg-white/95 ring-1 ring-black/5"
              )}
              sideOffset={14}
            >
              <div className="flex items-center gap-4 p-3 mb-2">
                <Avatar className="h-12 w-12 border border-zinc-200 dark:border-white/10 rounded-2xl">
                  <AvatarImage src={profile?.avatar_url || ''} alt={fullName} className="object-cover" />
                  <AvatarFallback className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-black">{fullName.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col space-y-0.5">
                  <span className="text-sm font-black text-zinc-900 dark:text-white tracking-tight uppercase">{fullName}</span>
                  <span className="text-[9px] text-zinc-400 dark:text-zinc-600 truncate max-w-[140px] font-bold uppercase tracking-widest">{user?.email || 'Sem e-mail'}</span>
                </div>
              </div>

              <DropdownMenuSeparator className="bg-zinc-100 dark:bg-white/5 mx-2 my-2" />
              <DropdownMenuItem className="cursor-pointer rounded-2xl focus:bg-zinc-100 dark:focus:bg-white/[0.04] my-1 py-3 px-4 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all text-[11px] font-black uppercase tracking-widest" onClick={() => navigate('/ajustes')}>
                <Settings className="mr-3 h-4 w-4" /><span>Ajustes</span>
              </DropdownMenuItem>
              <div className="flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-zinc-100 dark:hover:bg-white/[0.04] select-none transition-all my-1">
                <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                  {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}<span>Interface</span>
                </div>
                <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-900 dark:hover:bg-white text-zinc-500 hover:text-white dark:hover:text-black">
                  {theme === 'dark' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <DropdownMenuItem className="cursor-pointer rounded-2xl focus:bg-zinc-100 dark:focus:bg-white/[0.04] my-1 py-3 px-4 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all text-[11px] font-black uppercase tracking-widest" onClick={() => navigate('/ajuda')}>
                <HelpCircle className="mr-3 h-4 w-4" /><span>Suporte</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-100 dark:bg-white/5 mx-2 my-2" />
              <DropdownMenuItem className="cursor-pointer rounded-2xl focus:bg-rose-500 focus:text-white text-rose-500 my-1 py-3 px-4 transition-all text-[11px] font-black uppercase tracking-widest shadow-sm" onClick={handleLogout}>
                <LogOut className="mr-3 h-4 w-4" /><span>Encerrar</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <CommandSearch open={isSearchOpen} setOpen={setIsSearchOpen} />
    </nav>
  );
};
