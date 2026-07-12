import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementType,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

export const DesktopWorkspaceShell = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "relative overflow-hidden rounded-[40px] border border-foreground/[0.105] bg-background/72 p-3 shadow-[0_22px_90px_-76px_hsl(var(--foreground)/0.42)] ring-1 ring-background/70 backdrop-blur-2xl dark:border-white/[0.055] dark:bg-white/[0.02] dark:ring-white/[0.015] dark:shadow-[0_22px_70px_-60px_rgba(0,0,0,0.86)] md:p-4",
      className,
    )}
  >
    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)/0.46),transparent_42%),linear-gradient(135deg,hsl(var(--foreground)/0.018),transparent_46%)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.006),transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.006),transparent_46%)]" />
    <div className="relative z-10">{children}</div>
  </div>
);

export const DesktopWorkspacePanel = ({
  children,
  className,
  highContrast = false,
  ...props
}: ComponentPropsWithoutRef<"section"> & {
  highContrast?: boolean;
}) => (
  <section
    {...props}
    className={cn(
      "relative overflow-hidden rounded-[34px] border shadow-[0_24px_74px_-56px_hsl(var(--foreground)/0.44)] ring-1 ring-background/65 backdrop-blur-2xl dark:shadow-[0_24px_68px_-54px_rgba(0,0,0,0.9)] dark:ring-white/[0.018]",
      highContrast
        ? "border-foreground bg-foreground text-background dark:border-white dark:bg-white dark:text-zinc-950"
        : "border-foreground/[0.105] bg-background/74 text-foreground dark:border-white/[0.08] dark:bg-white/[0.04]",
      className,
    )}
  >
    <div
      className={cn(
        "pointer-events-none absolute inset-0",
        highContrast
          ? "bg-[radial-gradient(circle_at_8%_0%,hsl(var(--background)/0.04),transparent_32%),linear-gradient(135deg,hsl(var(--background)/0.02),transparent_44%)] dark:bg-[radial-gradient(circle_at_8%_0%,rgba(0,0,0,0.04),transparent_32%),linear-gradient(135deg,rgba(0,0,0,0.02),transparent_44%)]"
          : "bg-[linear-gradient(180deg,hsl(var(--background)/0.58),transparent_44%),linear-gradient(135deg,hsl(var(--foreground)/0.012),transparent_48%)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.006),transparent_44%),linear-gradient(135deg,rgba(255,255,255,0.006),transparent_48%)]",
      )}
    />
    <div className="relative z-10">{children}</div>
  </section>
);

export const DesktopWorkspaceIcon = ({
  icon: Icon,
  className,
}: {
  icon: ElementType<{ className?: string }>;
  className?: string;
}) => (
  <span
    className={cn(
      "flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] border border-foreground/[0.105] bg-background/76 text-muted-foreground shadow-sm dark:border-white/[0.07] dark:bg-white/[0.055]",
      className,
    )}
  >
    <Icon className="h-4 w-4" />
  </span>
);

export type DesktopActionTileProps = {
  icon: ElementType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  active?: boolean;
  className?: string;
};

export const DesktopActionTile = forwardRef<
  HTMLButtonElement,
  DesktopActionTileProps
>(({ icon: Icon, label, onClick, active = false, className }, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={onClick}
    aria-label={label}
    className={cn(
      "group flex w-[86px] shrink-0 flex-col items-center gap-1.5 rounded-[18px] px-2 py-2 transition-all duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100",
      className,
    )}
  >
    <span
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-[20px] border shadow-sm transition-all duration-300 group-hover:text-foreground",
        active
          ? "border-foreground bg-foreground text-background dark:border-white dark:bg-white dark:text-zinc-950"
          : "border-foreground/[0.105] bg-background/76 text-muted-foreground dark:border-white/[0.07] dark:bg-white/[0.045] dark:group-hover:bg-white/[0.08]",
      )}
    >
      <Icon className="h-4 w-4 transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
    </span>
    <span className="w-full text-center text-[8px] font-black uppercase leading-tight tracking-[0.1em] text-muted-foreground transition-colors group-hover:text-foreground">
      {label}
    </span>
  </button>
));
DesktopActionTile.displayName = "DesktopActionTile";

export const DesktopMiniStat = ({
  label,
  value,
  detail,
  tone = "default",
  accent = false,
  className,
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: "default" | "success" | "warning" | "destructive";
  accent?: boolean;
  className?: string;
}) => (
  <div
    className={cn(
      "rounded-[22px] border border-foreground/[0.105] bg-background/76 p-4 shadow-sm dark:border-white/10 dark:bg-zinc-950",
      accent &&
        "border-foreground bg-foreground text-background dark:border-white dark:bg-white dark:text-zinc-950",
      tone === "success" && "border-emerald-500/20 bg-emerald-500/[0.055]",
      tone === "warning" && "border-amber-500/25 bg-amber-500/[0.06]",
      tone === "destructive" && "border-rose-500/25 bg-rose-500/[0.055]",
      className,
    )}
  >
    <p
      className={cn(
        "text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground",
        accent && "text-background/58 dark:text-zinc-950/55",
      )}
    >
      {label}
    </p>
    <p
      className={cn(
        "mt-2 truncate text-2xl font-black leading-none tracking-[-0.05em] text-foreground tabular-nums",
        accent && "text-background dark:text-zinc-950",
      )}
    >
      {value}
    </p>
    {detail ? (
      <p
        className={cn(
          "mt-2 line-clamp-2 text-xs font-medium leading-relaxed text-muted-foreground",
          accent && "text-background/62 dark:text-zinc-950/62",
        )}
      >
        {detail}
      </p>
    ) : null}
  </div>
);
