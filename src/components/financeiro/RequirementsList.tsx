"use client";

import { AlertCircle, CheckCircle2, ChevronRight, Clock, Info } from "lucide-react";

import { useFinancialAccount } from "@/hooks/use-financial-account";
import { cn } from "@/lib/utils";

interface RequirementsListProps {
  onSelectRequirement: (id: string) => void;
  activeRequirement: string | null;
}

const toneIcon = {
  rejected: AlertCircle,
  missing: AlertCircle,
  pending: Clock,
  review: Clock,
  neutral: Info,
  approved: CheckCircle2,
};

const toneCopy = {
  rejected: "Correção necessária",
  missing: "Envio necessário",
  pending: "Pendente",
  review: "Em análise",
  neutral: "Aguardando retorno",
  approved: "Aprovado",
};

export const RequirementsList = ({ onSelectRequirement, activeRequirement }: RequirementsListProps) => {
  const { isLoading, actionableApprovalStages, openApprovalStages } = useFinancialAccount();

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-2xl bg-zinc-100 dark:bg-white/5" />
        ))}
      </div>
    );
  }

  const items = actionableApprovalStages.length > 0 ? actionableApprovalStages : [];

  if (items.length === 0) {
    const hasOpenNonActionable = openApprovalStages.length > 0;

    return (
      <div className="px-6 py-12 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-500/10">
          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
        </div>
        <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-900 dark:text-white">
          Sem ações manuais
        </h4>
        <p className="mt-2 text-[9px] uppercase leading-relaxed tracking-tight text-zinc-500">
          {hasOpenNonActionable
            ? "A conta está aguardando análise. Não há nada para reenviar agora."
            : "Não há pendências acionáveis para corrigir neste momento."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="mb-6">
        <h5 className="mb-4 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">
          Pendências acionáveis
        </h5>
      </div>

      {items.map((stage) => {
        const Icon = toneIcon[stage.tone] || Info;
        const isActive = activeRequirement === stage.id;

        return (
          <button
            key={stage.id}
            onClick={() => onSelectRequirement(stage.id)}
            className={cn(
              "group relative w-full overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300",
              isActive
                ? "z-20 scale-[1.02] border-zinc-900/20 bg-white shadow-xl dark:border-white/20 dark:bg-white/10"
                : "border-zinc-100 bg-transparent hover:border-zinc-200 dark:border-white/5 dark:hover:border-white/10"
            )}
          >
            <div className="relative z-10 flex items-start gap-4">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm",
                  stage.tone === "rejected"
                    ? "bg-red-50 dark:bg-red-500/10"
                    : stage.tone === "pending" || stage.tone === "missing"
                      ? "bg-amber-50 dark:bg-amber-500/10"
                      : "bg-blue-50 dark:bg-blue-500/10"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4",
                    stage.tone === "rejected"
                      ? "text-red-500"
                      : stage.tone === "pending" || stage.tone === "missing"
                        ? "text-amber-500"
                        : "text-blue-500"
                  )}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      "truncate text-[9px] font-black uppercase tracking-tight",
                      isActive ? "text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-400"
                    )}
                  >
                    {stage.label}
                  </span>
                  <ChevronRight
                    className={cn(
                      "h-3 w-3 transition-transform",
                      isActive ? "translate-x-0.5 text-zinc-900 dark:text-white" : "text-zinc-300"
                    )}
                  />
                </div>
                <p className="text-[8px] font-medium uppercase tracking-widest text-zinc-400">
                  {toneCopy[stage.tone]} · {stage.statusLabel}
                </p>
              </div>
            </div>

            {isActive && (
              <div className="absolute inset-y-0 left-0 w-1 rounded-full bg-zinc-900 dark:bg-white" />
            )}
          </button>
        );
      })}
    </div>
  );
};
