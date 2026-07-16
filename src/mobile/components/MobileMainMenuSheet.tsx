"use client";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  Calendar,
  DollarSign,
  LayoutDashboard,
  LogIn,
  LogOut,
  NotebookPen,
  Settings,
  Sparkles,
  Users,
  Video,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

type MobileMainMenuSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publicMode: boolean;
  onWaitlist: () => void;
};

type MenuItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const PRIVATE_MENU: MenuItem[] = [
  { label: "Painel", href: "/dashboard", icon: LayoutDashboard },
  { label: "Agenda", href: "/agenda", icon: Calendar },
  { label: "Pacientes", href: "/pacientes", icon: Users },
  { label: "Teleconsulta", href: "/teleconsulta", icon: Video },
  { label: "Notas", href: "/notas", icon: NotebookPen },
  { label: "Financeiro", href: "/financeiro", icon: DollarSign },
  { label: "Synapse AI", href: "/synapse-ai", icon: Sparkles },
  { label: "Integrações", href: "/ajustes?tab=integrations", icon: Zap },
  { label: "Ajustes", href: "/ajustes", icon: Settings },
];

const PUBLIC_MENU: MenuItem[] = [
  { label: "Início", href: "/", icon: LayoutDashboard },
  { label: "Preços", href: "/precos", icon: DollarSign },
  { label: "Contato", href: "/contato", icon: Zap },
];

export function MobileMainMenuSheet({ open, onOpenChange, publicMode, onWaitlist }: MobileMainMenuSheetProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const menuItems = publicMode ? PUBLIC_MENU : PRIVATE_MENU;
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Usuário";
  const initials = fullName.substring(0, 2).toUpperCase();

  const isActive = (href: string) => {
    const [path] = href.split("?");
    if (path === "/dashboard") return location.pathname === "/dashboard";
    if (path === "/financeiro") return location.pathname.startsWith("/financeiro");
    return location.pathname === path || (path !== "/" && location.pathname.startsWith(`${path}/`));
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Não foi possível encerrar a sessão.");
      return;
    }
    onOpenChange(false);
    navigate("/auth");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="z-[220] w-full max-w-none border-none bg-background p-0 text-foreground shadow-none focus:outline-none dark:bg-[#050505] md:hidden"
      >
        <div className="flex h-full flex-col overflow-hidden bg-white text-zinc-950 dark:bg-[#050505] dark:text-white">
          <div className="px-7 pb-8 pt-[calc(3.25rem+env(safe-area-inset-top))]">
            <div className="flex items-center justify-between gap-4">
              {!publicMode ? (
                <Link
                  to="/ajustes"
                  onClick={() => onOpenChange(false)}
                  className="flex min-w-0 items-center gap-4 rounded-[24px] active:scale-[0.99]"
                >
                  <Avatar className="h-14 w-14 border border-zinc-200 shadow-2xl dark:border-white/10">
                    <AvatarImage src={profile?.avatar_url || ""} />
                    <AvatarFallback className="bg-zinc-950 text-sm font-black text-white dark:bg-white dark:text-zinc-950">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-black tracking-[-0.04em] text-zinc-950 dark:text-white">{fullName}</p>
                    <p className="mt-0.5 truncate text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">{user?.email}</p>
                  </div>
                </Link>
              ) : (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">NeuroNex</p>
                  <h2 className="mt-1 text-2xl font-black tracking-[-0.05em]">Menu</h2>
                </div>
              )}
              <ThemeToggle />
            </div>
          </div>

          <div className="mobile-scroll-owner flex-1 overflow-y-auto px-4 pb-6">
            <div className="grid gap-1.5">
              {menuItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      "flex min-h-[58px] items-center gap-5 rounded-[24px] px-5 text-[15px] font-black tracking-[-0.01em] transition-all duration-200 active:scale-[0.98]",
                      active
                        ? "bg-zinc-950 text-white shadow-[0_18px_44px_-28px_rgba(0,0,0,0.75)] dark:bg-white dark:text-zinc-950"
                        : "text-zinc-600 active:bg-zinc-100 dark:text-zinc-300 dark:active:bg-white/[0.08]",
                    )}
                  >
                    <item.icon className={cn("h-5 w-5", active ? "text-current" : "text-zinc-500 dark:text-zinc-400")} strokeWidth={1.7} />
                    <span className="flex-1">{item.label}</span>
                    <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-current/60" : "bg-zinc-300 dark:bg-white/20")} />
                  </Link>
                );
              })}
            </div>

            {publicMode ? (
              <div className="mt-6 grid gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    onWaitlist();
                  }}
                  className="h-[52px] rounded-[18px] text-[9px] font-black uppercase tracking-[0.12em]"
                >
                  Lista de espera
                </Button>
                <Button asChild className="h-[52px] rounded-[18px] text-[9px] font-black uppercase tracking-[0.12em]">
                  <Link to="/auth" onClick={() => onOpenChange(false)}>
                    <LogIn className="mr-2 h-4 w-4" /> Entrar
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>

          {!publicMode ? (
            <div className="border-t border-zinc-200 bg-white p-5 pb-[calc(1.2rem+env(safe-area-inset-bottom))] dark:border-white/10 dark:bg-[#050505]">
              <Button
                type="button"
                variant="outline"
                onClick={logout}
                className="h-[52px] w-full rounded-[18px] border-red-500/25 bg-white text-[9px] font-black uppercase tracking-[0.12em] text-red-500 dark:bg-white/[0.04] dark:text-red-300"
              >
                <LogOut className="mr-2 h-4 w-4" /> Encerrar sessão
              </Button>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
