"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ShieldCheck } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AccountResolutionForm } from "@/components/financeiro/AccountResolutionForm";
import { AsaasAccountStatusTimeline } from "@/components/financeiro/AsaasAccountStatusTimeline";
import { RequirementsList } from "@/components/financeiro/RequirementsList";

interface NeuroFinanceVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRequirement: string | null;
  setSelectedRequirement: (req: string | null) => void;
  onSuccess: () => void;
}

export function NeuroFinanceVerificationModal({
  open,
  onOpenChange,
  selectedRequirement,
  setSelectedRequirement,
  onSuccess,
}: NeuroFinanceVerificationModalProps) {
  const reduceMotion = Boolean(useReducedMotion());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="finance-modal-surface flex h-[88vh] flex-col overflow-hidden rounded-[34px] border border-zinc-200/80 bg-white p-0 text-zinc-950 shadow-[0_42px_120px_-42px_rgba(24,24,27,0.38)] dark:border-white/10 dark:bg-zinc-950 dark:text-white sm:max-w-[1180px]">
        <DialogHeader className="shrink-0 border-b border-zinc-200/80 bg-white px-8 py-7 dark:border-white/[0.07] dark:bg-zinc-950">
          <DialogTitle className="text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
            Análise cadastral
          </DialogTitle>
          <DialogDescription className="text-sm font-medium tracking-tight text-zinc-500">
            Acompanhe a análise e corrija pendências quando necessário.
          </DialogDescription>
        </DialogHeader>

        <div className="relative flex flex-1 overflow-hidden bg-zinc-50/80 dark:bg-zinc-950">
          <div className="premium-noise pointer-events-none absolute inset-0 opacity-[0.012] dark:opacity-[0.035]" />

          <aside className="relative z-10 hidden w-[360px] space-y-6 overflow-y-auto border-r border-zinc-200/70 bg-white p-7 dark:border-white/[0.07] dark:bg-zinc-950 lg:block">
            <RequirementsList
              onSelectRequirement={setSelectedRequirement}
              activeRequirement={selectedRequirement}
            />

            <div className="rounded-[26px] border border-zinc-200/70 bg-white/70 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-white/5">
                <ShieldCheck className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
              </div>
              <h4 className="text-xs font-black uppercase tracking-[0.16em] text-zinc-900 dark:text-white">
                Acompanhamento
              </h4>
              <p className="mt-2 text-xs font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
                A linha do tempo mostra cada etapa da análise. Pendências que exigem sua ação aparecem aqui com a orientação necessária.
              </p>
            </div>
          </aside>

          <div className="relative z-10 flex-1 overflow-auto bg-zinc-50/[0.94] p-6 dark:bg-black/30 sm:p-10 lg:p-12">
            <AnimatePresence mode="wait">
              {selectedRequirement ? (
                <motion.div
                  key={selectedRequirement}
                  initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -20 }}
                  transition={{ duration: reduceMotion ? 0 : 0.3 }}
                  className="mx-auto max-w-xl"
                >
                  <AccountResolutionForm requirement={selectedRequirement} onSuccess={onSuccess} />
                </motion.div>
              ) : (
                <motion.div
                  key="timeline"
                  initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -18 }}
                  transition={{ duration: reduceMotion ? 0 : 0.3 }}
                  className="mx-auto flex min-h-full max-w-3xl flex-col justify-center space-y-6"
                >
                  <AsaasAccountStatusTimeline />

                  <div className="rounded-[28px] border border-zinc-200/70 bg-white/80 p-6 text-center shadow-sm dark:border-white/10 dark:bg-white/[0.03] lg:hidden">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-white/5">
                      <ShieldCheck className="h-6 w-6 text-zinc-400 dark:text-zinc-500" />
                    </div>
                    <h4 className="text-sm font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                      Acompanhamento cadastral
                    </h4>
                    <p className="mx-auto mt-2 max-w-md text-xs font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
                      Quando uma correção documental ou cadastral for necessária, as ações disponíveis aparecerão nesta tela.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
