"use client";

import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useProjectedCashFlow, ProjectionMode, ViewType, ChartPoint } from "@/hooks/use-projected-cash-flow";
import { Loader2, Info, TrendingUp, CalendarDays, Download, ArrowUpRight, ArrowDownRight, User, Layers, PieChart, ShieldCheck } from "lucide-react";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val);
};

const itemTransition = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as any }
};

export const CashFlowScenarios = () => {
  const [mode] = useState<ProjectionMode>('mixed');
  const [viewType, setViewType] = useState<ViewType>('monthly');
  const [rangeDays, setRangeDays] = useState(180);
  const [selectedPoint, setSelectedPoint] = useState<ChartPoint | null>(null);

  const { data, isLoading } = useProjectedCashFlow(mode, rangeDays, viewType);

  const chartData = viewType === 'daily'
    ? data?.filter(point => point.Projetado !== 0 || point.Realizado !== 0)
    : data;

  const exportCsv = () => {
    const rows = chartData || [];
    if (rows.length === 0) {
      toast.info("Não há dados para exportar.");
      return;
    }

    const csvRows = [
      ["periodo", "data", "projetado", "realizado", "eventos"],
      ...rows.map((point) => [
        point.fullLabel,
        format(new Date(point.date), "yyyy-MM-dd"),
        String(point.Projetado),
        String(point.Realizado),
        point.details.map((detail) => `${detail.type}:${detail.description}:${detail.amount}`).join(" | "),
      ]),
    ];

    const csv = csvRows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `projecao-financeira-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("CSV de projecao gerado.");
  };

  const handleChartClick = (state: { activeTooltipIndex?: number | string | null; activeIndex?: number | string | null }) => {
    const rawIndex = state.activeTooltipIndex ?? state.activeIndex;
    const index = typeof rawIndex === "number" ? rawIndex : Number.parseInt(String(rawIndex), 10);
    const point = Number.isInteger(index) ? chartData?.[index] : undefined;

    if (point) setSelectedPoint(point);
  };

  const incomeItems = selectedPoint?.details.filter(d => d.type === 'income') || [];
  const expenseItems = selectedPoint?.details.filter(d => d.type === 'expense') || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      className="h-full w-full flex flex-col p-10 bg-white dark:bg-[#0A0A0B] rounded-[48px] border border-zinc-200/50 dark:border-white/5 relative shadow-2xl shadow-black/5 dark:shadow-black/40 overflow-hidden min-h-[550px]"
    >
      {/* Ambient backgrounds */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px] -mr-32 -mt-32 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-zinc-500/5 rounded-full blur-[100px] -ml-20 -mb-20 pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6 z-10 relative">
        <div className="flex items-center gap-6">
          <div className="w-14 h-14 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-black flex items-center justify-center shadow-2xl scale-110">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-[0.2em] leading-none text-shadow-sm">Projeção Financeira</h3>
              <UITooltip>
                <TooltipTrigger>
                  <div className="w-5 h-5 rounded-full border border-zinc-200 dark:border-white/10 flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-white/5 transition-all">
                    <Info className="h-2.5 w-2.5 text-zinc-400" />
                  </div>
                </TooltipTrigger>
                <TooltipContent className="bg-zinc-900 dark:bg-white border-none text-[10px] font-bold uppercase tracking-wider px-4 py-2 text-white dark:text-black rounded-xl shadow-2xl backdrop-blur-3xl">
                  Projeção baseada nas suas receitas e despesas.
                </TooltipContent>
              </UITooltip>
            </div>
            <p className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.4em] mt-2 opacity-60">Previsão de Entradas e Saídas</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={exportCsv}
            className="h-12 w-12 bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-2xl transition-all shadow-sm active:scale-95"
          >
            <Download className="h-5 w-5" />
          </Button>

          <Select value={rangeDays.toString()} onValueChange={(v) => setRangeDays(Number(v))}>
            <SelectTrigger className="h-12 w-[200px] bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl focus:ring-0 text-zinc-900 dark:text-white shadow-sm pr-4">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-4 w-4 text-zinc-400" />
                <SelectValue placeholder="Período" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-[#0A0A0B] border-zinc-200 dark:border-white/10 rounded-2xl p-2 backdrop-blur-3xl shadow-3xl">
              <SelectItem value="30" className="text-[10px] font-black uppercase tracking-wider rounded-xl cursor-pointer">30 Dias</SelectItem>
              <SelectItem value="90" className="text-[10px] font-black uppercase tracking-wider rounded-xl cursor-pointer">90 Dias</SelectItem>
              <SelectItem value="180" className="text-[10px] font-black uppercase tracking-wider rounded-xl cursor-pointer">180 Dias</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex bg-zinc-100 dark:bg-white/5 p-1.5 rounded-2xl border border-zinc-200 dark:border-white/10 backdrop-blur-sm">
            {[{ label: 'Diário', val: 'daily' }, { label: 'Mensal', val: 'monthly' }].map((btn) => (
              <motion.button
                key={btn.val}
                whileTap={{ scale: 0.95 }}
                onClick={() => setViewType(btn.val as ViewType)}
                className={cn(
                  "px-6 py-2 text-[10px] font-black rounded-xl transition-all duration-500 uppercase tracking-[0.1em]",
                  viewType === btn.val
                    ? "bg-white dark:bg-white/10 text-zinc-900 dark:text-white shadow-xl dark:shadow-white/5"
                    : "text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                )}
              >
                {btn.label}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 w-full min-h-[400px] relative z-10 -mx-4 group/chart">
        {isLoading ? (
          <div className="h-full flex items-center justify-center flex-col gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-zinc-200 dark:text-white/10" />
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">Sincronizando Dados</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              onClick={handleChartClick}
              style={{ cursor: 'pointer' }}
              margin={{ top: 20, right: 40, left: 40, bottom: 20 }}
            >
              <defs>
                <linearGradient id="gradProjected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="currentColor" stopOpacity={0.15} className="text-zinc-900 dark:text-white" />
                  <stop offset="95%" stopColor="currentColor" stopOpacity={0} className="text-zinc-900 dark:text-white" />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="12 12"
                stroke="currentColor"
                vertical={false}
                className="text-zinc-100 dark:text-white/[0.03]"
              />
              <XAxis
                dataKey="date"
                hide={false}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#71717a', fontSize: 10, fontWeight: '900', letterSpacing: '0.15em', fontFamily: 'inherit' }}
                tickFormatter={(val) => format(new Date(val), 'MMM', { locale: ptBR }).toUpperCase()}
                dy={25}
              />
              <YAxis hide />
              <Tooltip
                cursor={{ stroke: 'currentColor', strokeWidth: 1, strokeDasharray: '8 8', className: 'text-zinc-200 dark:text-white/10' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="bg-white/80 dark:bg-[#0A0A0B]/80 backdrop-blur-3xl border border-zinc-200/50 dark:border-white/10 p-6 rounded-[32px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] min-w-[240px] relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-3xl -mr-12 -mt-12" />
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-4 flex items-center justify-between">
                          {format(new Date(d.date), "dd MMM yyyy", { locale: ptBR })}
                          <ShieldCheck className="w-4 h-4 text-zinc-900 dark:text-white" />
                        </p>
                        <div className="space-y-4">
                          <div>
                            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.3em] mb-1">Saldo Previsto</p>
                            <p className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter leading-none">
                              {formatCurrency(d.Projetado)}
                            </p>
                          </div>
                          {d.Realizado > 0 && (
                            <div>
                              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.3em] mb-1">Realizado</p>
                              <p className="text-sm font-black text-zinc-600 dark:text-zinc-500 tracking-tight">
                                {formatCurrency(d.Realizado)}
                              </p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="Projetado"
                stroke="currentColor"
                strokeWidth={4}
                fill="url(#gradProjected)"
                className="text-zinc-900 dark:text-white"
                dot={viewType === 'monthly' ? { fill: 'currentColor', stroke: 'var(--background)', strokeWidth: 4, r: 6 } : false}
                activeDot={{ r: 9, strokeWidth: 0, fill: 'currentColor', className: 'shadow-2xl' }}
                animationDuration={2000}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <AnimatePresence>
        {selectedPoint && (
          <Sheet open={true} onOpenChange={() => setSelectedPoint(null)}>
            <SheetContent
              side="right"
              className="bg-white dark:bg-[#0A0A0B] border-l border-zinc-200 dark:border-white/5 sm:max-w-[550px] w-full p-0 flex flex-col overflow-hidden outline-none shadow-3xl"
            >
              {/* Sidebar Background Elements */}
              <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-zinc-50 dark:from-white/2 to-transparent pointer-events-none" />
              <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-primary/2 rounded-full blur-[100px] -mr-32 -mb-32" />

              <div className="pt-16 pb-8 px-10 relative z-10 border-b border-zinc-100 dark:border-white/5">
                <SheetHeader className="mb-8">
                  <div className="flex items-center gap-6 mb-4">
                    <div className="w-14 h-14 rounded-[20px] bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-black shadow-2xl scale-110">
                      <PieChart className="h-6 w-6" />
                    </div>
                    <div>
                      <SheetTitle className="text-2xl font-black text-zinc-900 dark:text-white tracking-tighter mb-1 uppercase">Detalhes do Período</SheetTitle>
                      <SheetDescription className="text-zinc-400 font-black uppercase tracking-[0.3em] text-[10px] opacity-70">
                        Período: <span className="text-zinc-900 dark:text-white ml-2">{selectedPoint?.fullLabel}</span>
                      </SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                <div className="grid grid-cols-2 gap-4">
                  <motion.div {...itemTransition} className="p-6 rounded-[28px] bg-white dark:bg-white/5 border border-zinc-100 dark:border-white/5 shadow-xl">
                    <p className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.3em] mb-3 opacity-60">Fluxo Realizado</p>
                    <p className="text-2xl font-black text-zinc-900 dark:text-white tracking-tighter">{formatCurrency(selectedPoint?.Realizado || 0)}</p>
                  </motion.div>
                  <motion.div {...itemTransition} className="p-6 rounded-[28px] bg-zinc-900 dark:bg-white border border-transparent shadow-2xl scale-105">
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-black uppercase tracking-[0.3em] mb-3 opacity-80">Saldo Projetado</p>
                    <p className="text-2xl font-black text-white dark:text-black tracking-tighter">{formatCurrency(selectedPoint?.Projetado || 0)}</p>
                  </motion.div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-10 py-10 space-y-10 custom-scrollbar relative z-10 pb-20">
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-zinc-100 dark:border-white/5 pb-4">
                    <div className="flex items-center gap-3">
                      <ArrowUpRight className="w-4 h-4 text-zinc-900 dark:text-white" />
                      <h4 className="text-[11px] font-black text-zinc-900 dark:text-white uppercase tracking-[0.4em]">Receitas</h4>
                    </div>
                    <span className="text-[10px] font-black text-zinc-900 dark:text-white bg-zinc-900/10 dark:bg-white/10 px-4 py-1.5 rounded-full border border-zinc-900/10 dark:border-white/10 uppercase tracking-[0.2em]">
                      +{formatCurrency(incomeItems.reduce((acc, i) => acc + i.amount, 0))}
                    </span>
                  </div>

                  <div className="grid gap-3">
                    {incomeItems.length === 0 ? (
                      <div className="py-12 text-center rounded-[32px] border border-dashed border-zinc-200 dark:border-white/10 bg-zinc-50/30 dark:bg-white/[0.02] transition-colors">
                        <p className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.4em] opacity-40">Sem movimentações</p>
                      </div>
                    ) : (
                      incomeItems.map((item, idx) => (
                        <motion.div
                          key={idx}
                          {...itemTransition}
                          transition={{ delay: idx * 0.1 }}
                          className="flex items-center justify-between p-6 rounded-[32px] bg-white dark:bg-white/5 border border-zinc-100 dark:border-white/5 hover:border-zinc-900 dark:hover:border-white transition-all group cursor-default shadow-sm hover:shadow-xl"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-white/5 flex items-center justify-center text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white group-hover:bg-zinc-900/10 dark:group-hover:bg-white/10 transition-all duration-500">
                              {item.source === 'package' ? <Layers className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                            </div>
                            <div>
                              <p className="text-sm font-black text-zinc-900 dark:text-white mb-1 tracking-tight">{item.description}</p>
                              {item.patient_name && (
                                <span className="flex items-center gap-2 text-[9px] text-zinc-400 font-black uppercase tracking-[0.1em] opacity-60">
                                  <User className="h-3 w-3" /> {item.patient_name}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-sm font-black text-zinc-900 dark:text-white">+{formatCurrency(item.amount)}</span>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-zinc-100 dark:border-white/5 pb-4">
                    <div className="flex items-center gap-3">
                      <ArrowDownRight className="w-4 h-4 text-zinc-400" />
                      <h4 className="text-[11px] font-black text-zinc-900 dark:text-white uppercase tracking-[0.4em]">Despesas</h4>
                    </div>
                    <span className="text-[10px] font-black text-zinc-500 bg-zinc-500/10 px-4 py-1.5 rounded-full border border-zinc-500/10 uppercase tracking-[0.2em]">
                      -{formatCurrency(Math.abs(expenseItems.reduce((acc, i) => acc + i.amount, 0)))}
                    </span>
                  </div>

                  <div className="grid gap-3">
                    {expenseItems.length === 0 ? (
                      <div className="py-12 text-center rounded-[32px] border border-dashed border-zinc-100 dark:border-white/10 bg-zinc-50/30 dark:bg-white/[0.02]">
                        <p className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.4em] opacity-40">Nenhuma despesa</p>
                      </div>
                    ) : (
                      expenseItems.map((item, idx) => (
                        <motion.div
                          key={idx}
                          {...itemTransition}
                          transition={{ delay: (incomeItems.length + idx) * 0.1 }}
                          className="flex items-center justify-between p-6 rounded-[32px] bg-zinc-50 dark:bg-[#0C0C0D] border border-zinc-100 dark:border-white/5 opacity-70 hover:opacity-100 transition-all shadow-inner group cursor-default"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/5 flex items-center justify-center text-zinc-300 dark:text-zinc-600 border border-zinc-200 dark:border-white/10 group-hover:scale-110 transition-transform duration-500">
                              <ArrowDownRight className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-sm font-black text-zinc-600 dark:text-zinc-400 mb-1 tracking-tight">{item.description}</p>
                              <span className="text-[9px] text-zinc-400 font-black uppercase tracking-[0.2em] opacity-40">Despesa</span>
                            </div>
                          </div>
                          <span className="text-sm font-black text-zinc-500">-{formatCurrency(item.amount)}</span>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-[#0D0D0E]/80 backdrop-blur-3xl">
                <Button className="w-full bg-zinc-900 dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-100 h-14 rounded-[24px] font-black text-[11px] uppercase tracking-[0.4em] transition-all shadow-2xl active:scale-95">
                  Exportar Relatório
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
