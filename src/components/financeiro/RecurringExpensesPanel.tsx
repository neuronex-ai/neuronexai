import { useRecurringExpenses } from "@/hooks/use-recurring-expenses";
import { useState } from "react";
import {
  Loader2,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  CalendarDays,
  DollarSign,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const RecurringExpensesPanel = () => {
  const {
    data: expenses,
    isLoading,
    addExpense,
    isAdding,
    deleteExpense,
    toggleExpense,
  } = useRecurringExpenses();

  const [isOpen, setIsOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("1");

  const handleSubmit = () => {
    if (!description || !amount) return;
    addExpense(
      {
        description,
        amount: parseFloat(amount),
        category: category || null,
        day_of_month: parseInt(dayOfMonth),
        active: true,
      },
      {
        onSuccess: () => {
          setDescription("");
          setAmount("");
          setCategory("");
          setDayOfMonth("1");
          setIsOpen(false);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center p-10">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight">
            Despesas Fixas
          </h3>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest mt-1">
            {expenses?.length || 0} despesas cadastradas
          </p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="h-9 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Nova
            </Button>
          </DialogTrigger>
          <DialogContent className="finance-modal-surface rounded-[28px] border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                Nova Despesa Recorrente
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5 mt-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  Descrição
                </Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Aluguel do consultório"
                  className="rounded-xl border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Valor (R$)
                  </Label>
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0,00"
                    min="0"
                    step="0.01"
                    className="rounded-xl border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Dia do Mês
                  </Label>
                  <Input
                    type="number"
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(e.target.value)}
                    min="1"
                    max="31"
                    className="rounded-xl border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  Categoria (opcional)
                </Label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ex: Infraestrutura, Software, etc."
                  className="rounded-xl border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800"
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={!description || !amount || isAdding}
                className="w-full h-12 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black text-[10px] uppercase tracking-widest"
              >
                {isAdding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Salvar Despesa"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Empty State */}
      {(!expenses || expenses.length === 0) && (
        <div className="flex flex-col items-center justify-center text-center py-16 space-y-4">
          <div className="w-16 h-16 rounded-[24px] bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 flex items-center justify-center">
            <DollarSign className="h-7 w-7 text-zinc-300 dark:text-zinc-700" />
          </div>
          <div>
            <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight">
              Sem despesas fixas
            </h4>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest mt-1 max-w-[250px]">
              Cadastre suas despesas recorrentes para um melhor controle
              financeiro.
            </p>
          </div>
        </div>
      )}

      {/* Expenses List */}
      {expenses && expenses.length > 0 && (
        <div className="space-y-3">
          {expenses.map((expense) => (
            <div
              key={expense.id}
              className={`flex items-center justify-between p-5 rounded-[20px] border transition-all duration-300 group ${expense.active
                  ? "bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                  : "bg-zinc-50/50 dark:bg-zinc-900/20 border-zinc-100 dark:border-zinc-900 opacity-60"
                }`}
            >
              <div className="flex items-center gap-4 min-w-0">
                <button
                  onClick={() =>
                    toggleExpense({
                      id: expense.id,
                      currentState: expense.active,
                    })
                  }
                  className="shrink-0 transition-colors"
                  title={expense.active ? "Desativar" : "Ativar"}
                >
                  {expense.active ? (
                    <ToggleRight className="h-6 w-6 text-emerald-500" />
                  ) : (
                    <ToggleLeft className="h-6 w-6 text-zinc-300 dark:text-zinc-600" />
                  )}
                </button>
                <div className="min-w-0">
                  <p
                    className={`text-xs font-black uppercase tracking-tight truncate ${expense.active
                        ? "text-zinc-900 dark:text-white"
                        : "text-zinc-400 dark:text-zinc-600 line-through"
                      }`}
                  >
                    {expense.description}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                      <CalendarDays className="h-3 w-3" />
                      Dia {expense.day_of_month}
                    </span>
                    {expense.category && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                        <Tag className="h-3 w-3" />
                        {expense.category}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <span className="text-sm font-black text-rose-500 dark:text-rose-400 tabular-nums">
                  -{formatCurrency(expense.amount)}
                </span>
                <button
                  onClick={() => deleteExpense(expense.id)}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-300 dark:text-zinc-700 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                  title="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}

          {/* Total */}
          <div className="flex items-center justify-between px-5 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
              Total Mensal
            </span>
            <span className="text-sm font-black text-zinc-900 dark:text-white tabular-nums">
              {formatCurrency(
                expenses
                  .filter((e) => e.active)
                  .reduce((sum, e) => sum + e.amount, 0)
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
