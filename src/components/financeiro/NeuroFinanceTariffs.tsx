import { useMemo } from "react";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  CalendarClock,
  CreditCard,
  FileCheck2,
  Info,
  ReceiptText,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useNeuroFinanceTariffs } from "@/hooks/use-neurofinance-tariffs";
import { cn } from "@/lib/utils";
import type { TariffRule } from "@/lib/neurofinance-types";

const categoryIcons = {
  Receber: ArrowDownToLine,
  Cartões: CreditCard,
  Movimentar: ArrowLeftRight,
  Antecipar: CalendarClock,
  "Serviços adicionais": FileCheck2,
} as const;

export function NeuroFinanceTariffs() {
  const { data, isLoading } = useNeuroFinanceTariffs();

  const groups = useMemo(
    () => {
      const tariffsData: TariffRule[] = Array.isArray(data) ? data : [];
      return Object.entries(
        tariffsData.reduce<Record<string, TariffRule[]>>((result, tariff) => {
          (result[tariff.category] ||= []).push(tariff);
          return result;
        }, {}),
      );
    },
    [data],
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 rounded-[24px]" />
        <Skeleton className="h-72 rounded-[24px]" />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[30px] border border-zinc-200/70 bg-white/72 shadow-[0_24px_80px_-52px_rgba(0,0,0,0.35)] backdrop-blur-3xl dark:border-white/[0.07] dark:bg-[#0b0b0d]/78">
      <div className="relative border-b border-zinc-200/70 px-8 py-7 dark:border-white/[0.07]">
        <div className="premium-noise pointer-events-none absolute inset-0 opacity-[0.02] dark:opacity-[0.04]" />
        <div className="relative flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] border border-zinc-200 bg-zinc-950 text-white shadow-lg dark:border-white/10 dark:bg-white dark:text-zinc-950">
            <ReceiptText className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-zinc-950 dark:text-white">
              Tarifas claras, antes de confirmar
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              Você sempre vê o custo e o prazo antes de cobrar, transferir ou antecipar.
              O valor efetivo de cada operação aparece no extrato.
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-zinc-200/70 dark:divide-white/[0.07]">
        {groups.map(([category, tariffs]) => {
          const Icon = categoryIcons[category as keyof typeof categoryIcons] || Info;
          return (
            <section
              key={category}
              className="grid gap-5 px-8 py-7 lg:grid-cols-[190px_minmax(0,1fr)]"
            >
              <div className="flex items-center gap-3 self-start">
                <div className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-zinc-100 text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                  <Icon className="h-4 w-4" />
                </div>
                <h4 className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-800 dark:text-zinc-200">
                  {category}
                </h4>
              </div>

              <div className="divide-y divide-zinc-200/70 dark:divide-white/[0.06]">
                {tariffs.map((tariff) => (
                  <div
                    key={tariff.id}
                    className="grid gap-3 py-4 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_190px_190px]"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-zinc-950 dark:text-white">
                        {tariff.display_name}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                        {tariff.description}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-400">
                        Quanto custa
                      </p>
                      <p
                        className={cn(
                          "mt-1 text-xs font-bold text-zinc-800 dark:text-zinc-200",
                          tariff.price_label?.includes("Consulte") &&
                            "text-amber-600 dark:text-amber-400",
                        )}
                      >
                        {tariff.price_label || "Sem tarifa informada"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-400">
                        Quando fica disponível
                      </p>
                      <p className="mt-1 text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        {tariff.settlement_label || "Conforme a operação"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="flex items-center gap-2 border-t border-zinc-200/70 bg-zinc-50/70 px-8 py-4 text-xs text-zinc-500 dark:border-white/[0.07] dark:bg-white/[0.025] dark:text-zinc-400">
        <Info className="h-4 w-4 shrink-0" />
        Condições vigentes desde junho de 2026. Operações sujeitas à análise exibem o valor final antes da confirmação.
      </div>
    </div>
  );
}
