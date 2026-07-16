import { Transaction } from "@/types";
import { format } from "date-fns";

interface FinancialStatementTemplateProps {
  transactions: Transaction[];
  period: { from: Date | undefined; to: Date | undefined };
  summary: { income: number; expense: number; balance: number };
  professionalName: string;
}

export const FinancialStatementTemplate = ({
  transactions,
  period,
  summary,
  professionalName,
}: FinancialStatementTemplateProps) => {
  const formatMoney = (value: number) =>
    (value || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  const periodLabel = period.from && period.to
    ? `${format(period.from, "dd/MM/yyyy")} até ${format(period.to, "dd/MM/yyyy")}`
    : "Período completo";

  return (
    <div className="relative mx-auto min-h-[1000px] w-full max-w-[800px] bg-white font-sans text-zinc-900 print:w-full">
      <div className="bg-zinc-950 p-12 text-white">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="mb-1 text-3xl font-bold tracking-tight">Extrato NeuroFinance</h1>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Relatório financeiro</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-medium">{professionalName}</p>
            <p className="mt-1 text-sm text-zinc-400">{periodLabel}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.055]">
          <div className="border-r border-white/10 p-5">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Entradas</p>
            <p className="text-xl font-bold text-emerald-400">{formatMoney(summary.income)}</p>
          </div>
          <div className="border-r border-white/10 p-5">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Saídas</p>
            <p className="text-xl font-bold text-rose-400">{formatMoney(summary.expense)}</p>
          </div>
          <div className="bg-white/[0.035] p-5">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Resultado</p>
            <p className="text-xl font-bold text-white">{formatMoney(summary.balance)}</p>
          </div>
        </div>
      </div>

      <div className="p-12 pt-8">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-zinc-100 text-[10px] uppercase tracking-wider text-zinc-500">
              <th className="w-24 pb-3 pl-2 font-bold">Data</th>
              <th className="pb-3 font-bold">Descrição</th>
              <th className="w-32 pb-3 text-center font-bold">Categoria</th>
              <th className="w-32 pb-3 pr-2 text-right font-bold">Valor</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {transactions.map((transaction, index) => (
              <tr key={transaction.id} className={index % 2 === 0 ? "bg-white" : "bg-zinc-50"}>
                <td className="border-b border-zinc-100 py-3 pl-2 font-mono text-xs text-zinc-500">
                  {transaction.date && !Number.isNaN(new Date(transaction.date).getTime())
                    ? format(new Date(transaction.date), "dd/MM/yy")
                    : "--/--/--"}
                </td>
                <td className="border-b border-zinc-100 py-3 font-medium text-zinc-700">
                  {transaction.description}
                </td>
                <td className="border-b border-zinc-100 py-3 text-center">
                  <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                    {transaction.category || "Geral"}
                  </span>
                </td>
                <td
                  className={`border-b border-zinc-100 py-3 pr-2 text-right font-mono font-bold ${
                    transaction.type === "income" ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {transaction.type === "expense" ? "-" : "+"}
                  {formatMoney(transaction.amount).replace("R$", "").trim()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-16 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Gerado pelo NeuroFinance</p>
        </div>
      </div>
    </div>
  );
};
