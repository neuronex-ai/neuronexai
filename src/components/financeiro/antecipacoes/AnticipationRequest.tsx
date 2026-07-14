import { useMemo, useState } from "react";
import { Loader2, SlidersHorizontal, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { NEUROFINANCE_ANTICIPATION_ENABLED, useNeurofinanceAnticipations } from "@/hooks/use-neurofinance-anticipations";

export function AnticipationRequest() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { eligible, simulate, request } = useNeurofinanceAnticipations();
  const payments = useMemo(() => eligible.data || [], [eligible.data]);
  const selected = useMemo(() => payments.find((item) => item.provider_payment_id === selectedId), [payments, selectedId]);
  const simulation = simulate.data?.simulation;

  if (!NEUROFINANCE_ANTICIPATION_ENABLED) {
    return (
      <div className="rounded-[28px] border border-amber-500/20 bg-amber-500/10 p-8 text-sm text-amber-900 dark:text-amber-100">
        <h3 className="text-lg font-black text-zinc-950 dark:text-white">Antecipação indisponível</h3>
        <p className="mt-2 max-w-2xl">
          A antecipação de recebíveis permanece desabilitada até confirmação do enquadramento contratual e da responsabilidade prevista no Anexo I com a Asaas.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-[28px] border border-zinc-200/70 bg-white/70 p-6 dark:border-white/10 dark:bg-white/[0.025]">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-zinc-950 dark:text-white">Disponível para antecipar</h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Escolha uma cobrança elegível e veja o valor antes de confirmar.</p>
          </div>
          <Button variant="outline" className="rounded-[16px]">
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Filtros
          </Button>
        </div>

        {!payments.length ? (
          <div className="flex min-h-[330px] flex-col items-center justify-center text-center">
            <TrendingUp className="mb-5 h-12 w-12 text-zinc-300 dark:text-zinc-700" />
            <h4 className="font-black text-zinc-950 dark:text-white">Nenhuma cobrança foi encontrada</h4>
            <p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">Isso pode acontecer quando não há cobranças elegíveis ou quando elas ainda estão em processamento.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <button
                key={payment.id}
                onClick={() => {
                  setSelectedId(payment.provider_payment_id);
                  simulate.mutate(payment.provider_payment_id);
                }}
                className={`w-full rounded-[20px] border p-4 text-left transition-all ${selectedId === payment.provider_payment_id ? "border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950" : "border-zinc-200 bg-white/70 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/[0.035] dark:hover:bg-white/[0.06]"}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-black">{payment.description || "Cobrança disponível"}</p>
                    <p className="mt-1 text-xs opacity-60">{payment.payment_method_type || "método informado"} • {payment.due_date || "vencimento a confirmar"}</p>
                  </div>
                  <p className="font-black">{formatCurrency((payment.gross_amount || 0) / 100)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <aside className="rounded-[28px] border border-zinc-200/70 bg-white/72 p-6 dark:border-white/10 dark:bg-white/[0.035]">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400">Resumo</p>
        <div className="mt-6 space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Selecionado</span>
            <strong className="text-zinc-950 dark:text-white">{formatCurrency((selected?.gross_amount || 0) / 100)}</strong>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Valor a receber</span>
            <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(Number(simulation?.netValue || simulation?.anticipatedValue || ((selected?.net_amount || 0) / 100) || 0))}</strong>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Taxa</span>
            <strong className="text-zinc-950 dark:text-white">{simulation?.fee != null ? formatCurrency(Number(simulation.fee)) : "Antes de confirmar"}</strong>
          </div>
        </div>
        <Button
          disabled={!selectedId || request.isPending}
          onClick={() => selectedId && request.mutate(selectedId)}
          className="mt-8 h-12 w-full rounded-[16px] bg-zinc-950 text-[10px] font-black uppercase tracking-[0.15em] text-white dark:bg-white dark:text-zinc-950"
        >
          {request.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Solicitar antecipação
        </Button>
        <p className="mt-4 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Esta é uma simulação. O valor final aparece antes da confirmação e pode exigir análise.
        </p>
      </aside>
    </div>
  );
}
