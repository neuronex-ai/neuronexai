import { useMemo, useState } from "react";
import { Calculator, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { useNeurofinanceSimulator, type SimulatorMethod } from "@/hooks/use-neurofinance-simulator";

export function SalesSimulator() {
  const [amount, setAmount] = useState("700,00");
  const [method, setMethod] = useState<SimulatorMethod>("card");
  const [installments, setInstallments] = useState(1);
  const [passFees, setPassFees] = useState(false);
  const { simulate } = useNeurofinanceSimulator();
  const cents = Math.round(Number(amount.replace(/\./g, "").replace(",", ".")) * 100) || 0;
  const result = useMemo(() => simulate({ amount: cents, method, installments, passFeesToClient: passFees }), [cents, method, installments, passFees, simulate]);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-[28px] border border-zinc-200/70 bg-white/72 p-6 dark:border-white/10 dark:bg-white/[0.025]">
        <h3 className="text-lg font-black text-zinc-950 dark:text-white">Simulador de vendas</h3>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Simule cobrança por cartão, boleto ou Pix antes de enviar ao paciente.</p>
        <div className="mt-6 space-y-4">
          <label className="block text-xs font-black uppercase tracking-widest text-zinc-400">Total a cobrar</label>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} className="h-12 rounded-[16px]" />
          <div className="grid grid-cols-3 gap-2">
            {[
              ["card", "Cartão"],
              ["boleto", "Boleto"],
              ["pix", "Pix"],
            ].map(([id, label]) => (
              <button key={id} onClick={() => setMethod(id as SimulatorMethod)} className={`rounded-[16px] px-4 py-3 text-xs font-black uppercase tracking-wider ${method === id ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950" : "bg-zinc-100 text-zinc-500 dark:bg-white/[0.06]"}`}>
                {label}
              </button>
            ))}
          </div>
          {method === "card" ? (
            <select value={installments} onChange={(e) => setInstallments(Number(e.target.value))} className="h-12 w-full rounded-[16px] border border-zinc-200 bg-white px-4 text-sm dark:border-white/10 dark:bg-white/[0.04]">
              {Array.from({ length: 12 }).map((_, index) => (
                <option key={index + 1} value={index + 1}>{index + 1} parcela{index ? "s" : ""}</option>
              ))}
            </select>
          ) : null}
          <label className="flex items-center gap-3 text-sm font-bold text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" checked={passFees} onChange={(e) => setPassFees(e.target.checked)} />
            Repassar taxas para o cliente
          </label>
          <Button className="rounded-[16px] bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
            <Calculator className="mr-2 h-4 w-4" />
            Simular venda
          </Button>
        </div>
      </section>
      <aside className="rounded-[28px] border border-zinc-200/70 bg-white/72 p-6 dark:border-white/10 dark:bg-white/[0.025]">
        <h3 className="text-lg font-black text-zinc-950 dark:text-white">Resultado da simulação</h3>
        <div className="mt-6 space-y-5">
          <div className="flex justify-between border-b border-zinc-200 pb-4 text-sm dark:border-white/10">
            <span>Se a cobrança for</span>
            <strong>{formatCurrency(result.chargedAmount / 100)}</strong>
          </div>
          <div className="flex justify-between text-sm">
            <span>Taxa estimada</span>
            <strong>{result.feeAmount == null ? "Consulte as condições" : formatCurrency(result.feeAmount / 100)}</strong>
          </div>
          <div className="flex justify-between text-sm">
            <span>Você recebe</span>
            <strong className="text-emerald-600 dark:text-emerald-400">{result.netAmount == null ? "A confirmar" : formatCurrency(result.netAmount / 100)}</strong>
          </div>
          <div className="rounded-[18px] bg-zinc-100 p-4 text-xs leading-relaxed text-zinc-500 dark:bg-white/[0.06] dark:text-zinc-400">
            <Info className="mb-2 h-4 w-4" />
            Esta é uma simulação. O valor final aparece antes da confirmação.
          </div>
        </div>
      </aside>
    </div>
  );
}
