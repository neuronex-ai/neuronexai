import { useState, type ElementType } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  Clock,
  ExternalLink,
  Gauge,
  Headphones,
  Info,
  Moon,
  Shield,
  Sun,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFinancialAccount } from "@/hooks/use-financial-account";
import { buildNeuroFinanceSupportUrl } from "@/lib/neurofinance-support";
import { cn, formatCurrency } from "@/lib/utils";

interface LimitItem {
  label: string;
  maximum: number;
  period: string;
  icon: ElementType;
}

const REFERENCE_LIMITS: LimitItem[] = [
  { label: "Envio diurno", maximum: 20_000, period: "por transação, das 6h às 20h", icon: Sun },
  { label: "Envio noturno", maximum: 1_000, period: "por transação, das 20h às 6h", icon: Moon },
  { label: "Envios no dia", maximum: 50_000, period: "valor acumulado por dia", icon: ArrowUpRight },
  { label: "Recebimentos no dia", maximum: 100_000, period: "valor acumulado por dia", icon: ArrowDownRight },
];

export function PixLimites() {
  const { account } = useFinancialAccount();
  const [showDetails, setShowDetails] = useState(false);
  const reduceMotion = Boolean(useReducedMotion());
  const supportUrl = buildNeuroFinanceSupportUrl({
    userId: account?.user_id,
    accountId: account?.id,
  });

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[30px] border border-border/65 bg-card/82 p-6 text-card-foreground shadow-[0_32px_92px_-70px_hsl(var(--foreground)/0.62)] backdrop-blur-3xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,hsl(var(--foreground)/0.055),transparent_38%)]" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-foreground text-background shadow-[0_18px_42px_-28px_hsl(var(--foreground)/0.75)]">
            <Gauge className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-black uppercase tracking-[0.08em] text-foreground">Limites do Pix</h3>
            <p className="mt-1 text-[10px] font-semibold text-muted-foreground">Valores de segurança da sua conta NeuroFinance</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border/55 bg-background/55 px-3 py-2 text-[8px] font-black uppercase tracking-[0.16em] text-muted-foreground">
            <span className={cn("h-2 w-2 rounded-full", account?.status === "active" ? "bg-emerald-500" : "bg-amber-500")} />
            {account?.status === "active" ? "Conta ativa" : "Em validação"}
          </div>
        </div>
      </section>

      <section aria-label="Limites de referência" className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {REFERENCE_LIMITS.map((limit, index) => (
          <motion.article
            key={limit.label}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduceMotion ? 0 : index * 0.06 }}
            className="rounded-[24px] border border-border/60 bg-card/68 p-5 text-card-foreground shadow-[0_18px_55px_-46px_hsl(var(--foreground)/0.55)] backdrop-blur-xl"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-foreground/[0.065] text-foreground">
                <limit.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">{limit.label}</p>
                <p className="mt-0.5 text-[9px] text-muted-foreground/75">{limit.period}</p>
              </div>
            </div>
            <div className="mt-5 border-t border-border/45 pt-4">
              <p className="text-[8px] font-black uppercase tracking-[0.16em] text-muted-foreground">Limite de referência</p>
              <p className="mt-1 text-xl font-black tracking-tight text-foreground">{formatCurrency(limit.maximum)}</p>
            </div>
          </motion.article>
        ))}
      </section>

      <section className="rounded-[26px] border border-border/60 bg-card/68 p-5 text-card-foreground backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <h4 className="text-xs font-black text-foreground">Como os limites funcionam</h4>
            <p className="mt-1 text-[10px] font-medium leading-relaxed text-muted-foreground">
              Os valores podem variar conforme o horário, a análise de segurança e a situação da conta. A validação final ocorre antes de cada operação.
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-expanded={showDetails}
          aria-controls="pix-limit-details"
          onClick={() => setShowDetails((current) => !current)}
          className="mt-4 flex min-h-11 w-full items-center justify-between rounded-[16px] border border-border/55 bg-background/45 px-4 text-left text-[9px] font-black uppercase tracking-[0.13em] text-foreground transition-colors hover:bg-muted/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
        >
          Ver horários e solicitar alteração
          <ChevronDown className={cn("h-4 w-4 transition-transform motion-reduce:transition-none", showDetails && "rotate-180")} />
        </button>

        <AnimatePresence initial={false}>
          {showDetails ? (
            <motion.div
              id="pix-limit-details"
              initial={reduceMotion ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 space-y-3 rounded-[18px] border border-border/55 bg-background/45 p-4 text-[10px] font-medium leading-relaxed text-muted-foreground">
                <p className="flex items-start gap-2"><Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span><strong className="text-foreground">Período diurno:</strong> das 6h às 20h.</span></p>
                <p className="flex items-start gap-2"><Moon className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span><strong className="text-foreground">Período noturno:</strong> das 20h às 6h, com proteção adicional.</span></p>
                <p className="flex items-start gap-2"><Shield className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>Alterações dependem de uma nova análise de segurança. A equipe NeuroNex acompanha a solicitação.</span></p>
                <Button asChild variant="outline" className="mt-1 h-11 w-full rounded-[15px] text-[9px] font-black uppercase tracking-[0.13em]">
                  <a href={supportUrl} target="_blank" rel="noreferrer">
                    <Headphones className="mr-2 h-4 w-4" /> Falar com o suporte NeuroNex <ExternalLink className="ml-2 h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>
    </div>
  );
}
