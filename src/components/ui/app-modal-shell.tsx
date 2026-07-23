"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveModal } from "@/components/ui/ResponsiveModal";
import { cn } from "@/lib/utils";

type ModalHeroIconState = "neutral" | "warning" | "loading" | "success" | "error";
type ModalHeroIconAnimation = "none" | "fingerprint";
type ModalHeroIconTone = "neutral" | "status";

type IconComponent = React.ElementType<{ className?: string }>;

interface ModalHeroIconProps {
  icon: IconComponent;
  state?: ModalHeroIconState;
  animation?: ModalHeroIconAnimation;
  tone?: ModalHeroIconTone;
  ariaLabel?: string;
  className?: string;
}

const heroIconStateClass: Record<ModalHeroIconState, string> = {
  neutral: "border-border bg-background text-foreground shadow-[0_18px_48px_-30px_rgba(0,0,0,0.58)]",
  warning: "border-foreground/15 bg-background text-foreground shadow-[0_18px_48px_-30px_rgba(0,0,0,0.58)]",
  loading: "border-border bg-background text-foreground shadow-[0_18px_48px_-30px_rgba(0,0,0,0.58)]",
  success: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 shadow-[0_18px_52px_-34px_rgba(16,185,129,0.55)]",
  error: "border-destructive/25 bg-destructive/10 text-destructive shadow-[0_18px_52px_-34px_rgba(244,63,94,0.55)]",
};

export function ModalHeroIcon({
  icon: Icon,
  state = "neutral",
  animation = "none",
  tone = "neutral",
  ariaLabel,
  className,
}: ModalHeroIconProps) {
  const shouldReduceMotion = Boolean(useReducedMotion());
  const isFingerprint = animation === "fingerprint";

  const iconMotion = shouldReduceMotion
    ? undefined
    : isFingerprint
      ? {
        scale: [1, 1.04, 1],
        opacity: [0.82, 1, 0.9],
      }
      : state === "loading"
        ? { rotate: 360 }
        : state === "success"
          ? { scale: [1, 1.08, 1] }
          : state === "error"
            ? { x: [0, -2, 2, -2, 0] }
            : undefined;

  const iconTransition = isFingerprint
    ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" as const }
    : state === "loading"
      ? { duration: 1.1, repeat: Infinity, ease: "linear" as const }
      : { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 6, scale: 0.94 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className={cn(
        "relative flex h-12 w-12 items-center justify-center rounded-[18px] border",
        "bg-background/95 ring-1 ring-background/65 backdrop-blur-2xl",
        tone === "status" ? heroIconStateClass[state] : heroIconStateClass[state === "error" || state === "success" ? state : "neutral"],
        className,
      )}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      {isFingerprint && !shouldReduceMotion ? (
        <>
          <motion.span
            className="pointer-events-none absolute inset-1 rounded-[16px] border border-foreground/20"
            animate={{ opacity: [0, 0.32, 0], scale: [0.78, 1.12, 1.28] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
          />
          <motion.span
            className="pointer-events-none absolute inset-2 rounded-[14px] border border-foreground/15"
            animate={{ opacity: [0.2, 0, 0.22], scale: [1, 1.18, 0.9] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.22 }}
          />
        </>
      ) : null}
      <motion.div animate={iconMotion} transition={iconTransition} className="relative z-10">
        <Icon className="h-5 w-5" />
      </motion.div>
    </motion.div>
  );
}

type AppModalShellSize = "sm" | "md" | "lg" | "xl";
type AppModalShellAlign = "center" | "left";

interface AppModalShellProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  heroIcon?: React.ReactNode;
  footer?: React.ReactNode;
  size?: AppModalShellSize;
  align?: AppModalShellAlign;
  dataSynapseTarget?: string;
  preventClose?: boolean;
  className?: string;
  bodyClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
  contentStyle?: React.CSSProperties;
}

const sizeClass: Record<AppModalShellSize, string> = {
  sm: "sm:max-w-[26rem]",
  md: "sm:max-w-[32rem]",
  lg: "sm:max-w-[44rem]",
  xl: "sm:max-w-[56rem]",
};

export function AppModalShell({
  children,
  open,
  onOpenChange,
  trigger,
  title,
  description,
  eyebrow,
  heroIcon,
  footer,
  size = "md",
  align = "center",
  dataSynapseTarget,
  preventClose = false,
  className,
  bodyClassName,
  headerClassName,
  footerClassName,
  contentStyle,
}: AppModalShellProps) {
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && preventClose) return;
    onOpenChange?.(nextOpen);
  };

  return (
    <ResponsiveModal
      dataSynapseTarget={dataSynapseTarget}
      open={open}
      onOpenChange={handleOpenChange}
      trigger={trigger}
      contentStyle={contentStyle}
      showCloseButton={false}
      className={cn(
        "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-visible border-0 bg-transparent p-0 shadow-none",
        sizeClass[size],
      )}
      drawerClassName="border-0 bg-transparent p-0 shadow-none"
    >
      <div
        className={cn(
          "relative flex max-h-[calc(100dvh-1rem)] min-h-0 w-full flex-col overflow-hidden rounded-[28px] border border-border/70 bg-background text-foreground shadow-[0_36px_110px_-46px_rgba(0,0,0,0.62)] ring-1 ring-foreground/[0.03] dark:border-white/10 dark:bg-[#09090b]",
          "isolate",
          "sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-[30px]",
          className,
        )}
      >
        {!preventClose ? (
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleOpenChange(false);
            }}
            style={{
              position: "absolute",
              left: "auto",
              right: "max(0.75rem, env(safe-area-inset-right))",
              top: "max(0.75rem, env(safe-area-inset-top))",
              insetInlineStart: "auto",
              insetInlineEnd: "max(0.75rem, env(safe-area-inset-right))",
              transform: "none",
            }}
            className="app-modal-close pointer-events-auto z-[1000] flex h-11 w-11 items-center justify-center rounded-full border border-border/45 bg-muted/70 text-muted-foreground shadow-sm backdrop-blur-xl transition-[transform,color,background-color,border-color] hover:bg-muted hover:text-foreground active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:active:scale-100 dark:border-white/[0.045] dark:bg-white/[0.035]"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}

        <div
          className={cn(
            "shrink-0 px-5 pb-3 text-center sm:px-7",
            "pt-6 sm:pt-7",
            align === "left" && "text-left",
            headerClassName,
          )}
        >
          {heroIcon ? <div className="mb-4 flex justify-center">{heroIcon}</div> : null}
          {eyebrow ? (
            <p className="mx-auto max-w-[34rem] text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
              {eyebrow}
            </p>
          ) : null}
          <DialogTitle className="mx-auto mt-2 max-w-[34rem] text-2xl font-black leading-tight tracking-normal text-foreground sm:text-[1.7rem]">
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription className="mx-auto mt-3 max-w-[34rem] text-sm font-medium leading-relaxed text-muted-foreground sm:text-[15px]">
              {description}
            </DialogDescription>
          ) : null}
        </div>

        <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-3 custom-scrollbar sm:px-7", bodyClassName)}>
          {children}
        </div>

        {footer ? (
          <div
            className={cn(
              "shrink-0 border-t border-border/65 bg-background/95 px-5 py-4 shadow-[0_-18px_50px_-38px_rgba(0,0,0,0.5)] backdrop-blur-xl dark:border-white/10 dark:bg-[#09090b]/95 sm:px-7",
              footerClassName,
            )}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </ResponsiveModal>
  );
}
