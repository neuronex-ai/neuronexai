"use client";

import { motion } from "framer-motion";
import {
  ArrowUpRight,
  CalendarClock,
  Clock3,
  Stethoscope,
  Trash2,
} from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ProfileCardProps {
  name: string;
  subtitle?: string;
  avatarSrc?: string | null;
  statusText: string;
  active?: boolean;
  clinicalContext?: string | null;
  contactText?: string | null;
  lastSessionText?: string;
  nextSessionText?: string;
  className?: string;
  onOpen?: () => void;
  onDelete?: () => void;
}

export default function ProfileCard({
  name,
  subtitle = "Prontuário clínico",
  avatarSrc,
  statusText,
  active = false,
  clinicalContext,
  contactText,
  lastSessionText = "Sem sessão anterior",
  nextSessionText = "Sem agendamento",
  className,
  onOpen,
  onDelete,
}: ProfileCardProps) {
  const initials = name.trim().slice(0, 2).toUpperCase() || "PX";

  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    onOpen?.();
  };

  const stopAndRun =
    (action?: () => void) => (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      action?.();
    };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: "easeOut" }}
      className={cn("relative w-full pb-11", className)}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 top-[72%] z-0 rounded-[28px] bg-[linear-gradient(145deg,#18181b_0%,#09090b_100%)] shadow-[0_34px_72px_-24px_rgba(0,0,0,0.34)] dark:bg-[linear-gradient(145deg,#fafafa_0%,#ffffff_100%)] dark:shadow-[0_34px_78px_-24px_rgba(255,255,255,0.34)]"
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 flex h-11 items-center justify-center px-5 text-center text-[11px] font-semibold tracking-[-0.01em] text-white dark:text-zinc-950">
        <CalendarClock className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{nextSessionText}</span>
      </div>

      {/*
        This card intentionally does not use the shared <Card /> primitive.
        The primitive carries the global `glass-panel` class, whose legacy
        design-token background is dark by default and can override this
        route's light appearance. Keeping the patient surface self-contained
        lets the explicit light/dark palette below follow the resolved theme.
      */}
      <div
        data-slot="patient-profile-card"
        role={onOpen ? "link" : undefined}
        tabIndex={onOpen ? 0 : undefined}
        aria-label={onOpen ? `Abrir prontuário de ${name}` : undefined}
        onClick={onOpen}
        onKeyDown={handleCardKeyDown}
        className={cn(
          "relative z-10 w-full cursor-pointer overflow-hidden rounded-[28px] border border-black/[0.07] bg-[radial-gradient(120%_120%_at_30%_10%,#ffffff_0%,#f8f8f9_55%,#efeff1_100%)] text-zinc-950 shadow-[0_22px_48px_-30px_rgba(0,0,0,0.34)] outline-none transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-black/[0.10] hover:shadow-[0_28px_58px_-28px_rgba(0,0,0,0.42)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:border-white/[0.07] dark:bg-[radial-gradient(120%_120%_at_30%_10%,#1a1a1a_0%,#0f0f10_60%,#0b0b0c_100%)] dark:text-white dark:shadow-[0_26px_58px_-30px_rgba(0,0,0,0.86)] dark:hover:border-white/[0.10]",
          className,
        )}
      >
        <CardContent className="p-6 sm:p-7">
          <div className="mb-5 flex items-center justify-between gap-4 text-[11px] font-semibold text-zinc-500 dark:text-neutral-300">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  "inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-zinc-950 dark:bg-white",
                  active ? "opacity-100" : "opacity-35",
                )}
                aria-hidden="true"
              />
              <span className="truncate">{statusText}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2 opacity-75">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              <span className="max-w-[132px] truncate tabular-nums">{lastSessionText}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 shrink-0 rounded-full border border-black/10 bg-white ring-2 ring-black/[0.04] dark:border-white/10 dark:bg-neutral-900 dark:ring-white/[0.07]">
              <AvatarImage src={avatarSrc || undefined} alt="" />
              <AvatarFallback className="rounded-full bg-zinc-950 text-sm font-black uppercase tracking-[0.12em] text-white dark:bg-white dark:text-zinc-950">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h3 className="truncate text-xl font-semibold tracking-[-0.035em] sm:text-[22px]">
                {name}
              </h3>
              <p className="mt-0.5 truncate text-xs font-medium text-zinc-500 dark:text-neutral-400">
                {subtitle}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-2 text-[11px] font-medium text-zinc-600 dark:text-neutral-400">
            <div className="flex min-w-0 items-center gap-2.5">
              <Stethoscope className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{clinicalContext || "Sem diagnóstico definido"}</span>
            </div>
            <div className="min-w-0 truncate pl-6 text-zinc-500 dark:text-neutral-500">
              {contactText || "Contato não informado"}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={stopAndRun(onOpen)}
              className="h-11 justify-start gap-2.5 rounded-2xl border border-black/[0.05] bg-black/[0.06] px-4 text-xs font-semibold text-zinc-950 shadow-none hover:bg-black/[0.10] dark:border-white/[0.03] dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
            >
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              Prontuário
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={stopAndRun(onDelete)}
              className="h-11 justify-start gap-2.5 rounded-2xl border border-black/[0.05] bg-black/[0.06] px-4 text-xs font-semibold text-zinc-950 shadow-none hover:bg-destructive hover:text-destructive-foreground dark:border-white/[0.03] dark:bg-white/10 dark:text-white dark:hover:bg-destructive dark:hover:text-destructive-foreground"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Excluir
            </Button>
          </div>
        </CardContent>
      </div>
    </motion.div>
  );
}
