import { useState } from "react";
import { motion } from "framer-motion";
import { Crown, Infinity as InfinityIcon, Sparkles, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useFounderProgram } from "@/hooks/use-founder-program";

interface FounderProfileBadgeProps {
  reduceMotion?: boolean;
  className?: string;
}

export const FounderProfileBadge = ({ reduceMotion = false, className }: FounderProfileBadgeProps) => {
  const { member, isFounder, isDevelopmentCollaborator } = useFounderProgram();

  if (!isFounder || !member) return null;

  const title = isDevelopmentCollaborator
    ? "Founder • Desenvolvimento colaborativo"
    : "Founder • Usuário fundador da NeuroNex";

  return (
    <motion.div
      animate={
        reduceMotion
          ? undefined
          : { opacity: [0.78, 1, 0.78], scale: [1, 1.018, 1] }
      }
      transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
      className={cn(
        "relative flex items-center gap-1.5 overflow-hidden rounded-full border border-amber-300/30 bg-gradient-to-b from-amber-100/95 to-amber-200/80 px-3 py-2 text-[8px] font-black uppercase tracking-[0.16em] text-amber-950 shadow-[0_10px_30px_-16px_rgba(245,158,11,0.7)]",
        "dark:border-amber-200/20 dark:from-amber-200/95 dark:to-amber-300/80 dark:text-amber-950",
        className,
      )}
      title={title}
      aria-label={title}
    >
      <Crown className="h-3 w-3" aria-hidden="true" />
      {member.badge_label}
    </motion.div>
  );
};

export const FounderProgramAnnouncementGate = () => {
  const {
    member,
    shouldShowAnnouncement,
    isDevelopmentCollaborator,
    hasLifetimeProfessional,
    acknowledgeAnnouncement,
    isAcknowledging,
  } = useFounderProgram();
  const [dismissedLocally, setDismissedLocally] = useState(false);

  if (!member) return null;

  const open = shouldShowAnnouncement && !dismissedLocally;

  const acknowledge = async () => {
    setDismissedLocally(true);
    try {
      await acknowledgeAnnouncement();
    } catch (error) {
      console.error("[FounderProgram] Failed to acknowledge announcement", error);
      toast.error("Não foi possível registrar a confirmação agora. O aviso poderá aparecer novamente no próximo acesso.");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && open) void acknowledge();
      }}
    >
      <DialogContent className="desktop-retina-modal overflow-hidden rounded-[34px] border border-white/10 bg-zinc-950/95 p-0 shadow-[0_50px_140px_-36px_rgba(0,0,0,0.95)] backdrop-blur-[80px] sm:max-w-[620px]">
        <div className="relative overflow-hidden p-7 sm:p-9">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,0.2),transparent_68%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,transparent_20%,rgba(255,255,255,0.025)_48%,transparent_72%)]"
          />

          <div className="relative z-10">
            <div className="mb-8 flex items-start justify-between gap-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-amber-200/20 bg-amber-200/10 shadow-[0_16px_50px_-24px_rgba(251,191,36,0.8)]">
                <Crown className="h-5 w-5 text-amber-200" aria-hidden="true" />
              </div>
              <FounderProfileBadge reduceMotion className="shrink-0" />
            </div>

            <DialogHeader className="space-y-4 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-[0.22em] text-amber-200/80">
                  {member.modal_eyebrow}
                </span>
                {hasLifetimeProfessional ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-white/70">
                    <InfinityIcon className="h-3 w-3" aria-hidden="true" />
                    Professional vitalício
                  </span>
                ) : null}
              </div>
              <DialogTitle className="max-w-[520px] text-3xl font-black leading-[1.03] tracking-[-0.045em] text-white sm:text-[34px]">
                {member.modal_title}
              </DialogTitle>
              <DialogDescription className="max-w-[540px] whitespace-pre-line text-[14px] font-medium leading-7 text-white/62">
                {member.modal_body}
              </DialogDescription>
            </DialogHeader>

            {isDevelopmentCollaborator ? (
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-white/[0.07] bg-white/[0.035] p-4">
                  <div className="flex items-center gap-2 text-white/85">
                    <UsersRound className="h-4 w-4 text-amber-200" aria-hidden="true" />
                    <span className="text-[9px] font-black uppercase tracking-[0.16em]">Desenvolvimento colaborativo</span>
                  </div>
                  <p className="mt-2 text-xs font-medium leading-5 text-white/48">
                    Feedback, testes de produto e participação próxima na evolução das experiências da NeuroNex.
                  </p>
                </div>
                <div className="rounded-[22px] border border-white/[0.07] bg-white/[0.035] p-4">
                  <div className="flex items-center gap-2 text-white/85">
                    <Sparkles className="h-4 w-4 text-amber-200" aria-hidden="true" />
                    <span className="text-[9px] font-black uppercase tracking-[0.16em]">Acesso Founder</span>
                  </div>
                  <p className="mt-2 text-xs font-medium leading-5 text-white/48">
                    Seu reconhecimento Founder permanece associado à conta enquanto o programa estiver ativo.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="mt-8 flex flex-col gap-4 border-t border-white/[0.07] pt-6 sm:flex-row sm:items-end sm:justify-between">
              <p className="max-w-[360px] text-[9px] font-medium leading-4 text-white/30">
                O selo Founder reconhece sua participação como usuário fundador nesta fase da NeuroNex; não representa participação societária. Quando indicado, “Desenvolvimento” se refere à colaboração em feedback e testes do produto.
              </p>
              <Button
                type="button"
                onClick={() => void acknowledge()}
                disabled={isAcknowledging}
                className="h-12 shrink-0 rounded-2xl bg-white px-6 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-950 shadow-[0_16px_44px_-22px_rgba(255,255,255,0.8)] hover:bg-white/90"
              >
                {isAcknowledging ? "Registrando..." : member.modal_cta_label}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
