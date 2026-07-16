import type { LucideIcon } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type PatientStatusTone = "neutral" | "blue" | "green" | "amber" | "red";

const toneClass: Record<PatientStatusTone, string> = {
  neutral: "bg-zinc-500/10 text-zinc-600 dark:bg-zinc-400/10 dark:text-zinc-300",
  blue: "bg-blue-500/10 text-blue-600 dark:bg-blue-400/12 dark:text-blue-300",
  green: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/12 dark:text-emerald-300",
  amber: "bg-amber-500/11 text-amber-700 dark:bg-amber-400/12 dark:text-amber-300",
  red: "bg-rose-500/10 text-rose-600 dark:bg-rose-400/12 dark:text-rose-300",
};

export function PatientStatusIcon({
  icon: Icon,
  label,
  tone = "neutral",
  className,
}: {
  icon: LucideIcon;
  label: string;
  tone?: PatientStatusTone;
  className?: string;
}) {
  return (
    <TooltipProvider delayDuration={280}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="img"
            aria-label={label}
            tabIndex={0}
            className={cn(
              "patient-status-icon inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/45",
              toneClass[tone],
              className,
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-64 rounded-xl px-3 py-2 text-xs leading-relaxed">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
