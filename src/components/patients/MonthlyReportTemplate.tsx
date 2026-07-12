import { Activity, Calendar, PackageCheck, Target, TrendingUp } from "lucide-react";

interface MonthlyReportTemplateProps {
  patientName: string;
  month: string;
  professionalName: string;
  stats: {
    attended: number;
    cancelled: number;
    next: string | null;
  };
  financialSummary?: {
    totalInvested: string;
    packagesActive: string;
  };
  clinicalSummary?: string;
}

export const MonthlyReportTemplate = ({
  patientName,
  month,
  professionalName,
  stats,
  financialSummary,
  clinicalSummary,
}: MonthlyReportTemplateProps) => {
  const professionalInitials = professionalName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  return (
    <article className="relative mx-auto flex aspect-[210/297] w-full flex-col overflow-hidden bg-[#fbfbfa] font-sans text-zinc-900 shadow-2xl print:m-0 print:shadow-none">
      <div className="h-1.5 w-full bg-zinc-950" />

      <div className="flex flex-1 flex-col p-10 sm:p-12">
        <header className="mb-10 border-b border-zinc-200 pb-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-zinc-500">
              NeuroNex · acompanhamento clínico
            </p>
            <p className="rounded-full border border-zinc-200 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
              {month}
            </p>
          </div>

          <div className="flex items-end justify-between gap-8">
            <div className="max-w-[70%]">
              <h1 className="text-3xl font-semibold leading-[1.05] tracking-[-0.035em] text-zinc-950">
                Relatório mensal de acompanhamento
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                Uma síntese objetiva do período, preparada para facilitar o acompanhamento do cuidado.
              </p>
            </div>
            <div className="min-w-0 text-right">
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Paciente</p>
              <p className="mt-1 truncate text-base font-semibold text-zinc-900">{patientName}</p>
            </div>
          </div>
        </header>

        <section aria-label="Resumo do período" className="mb-9 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-zinc-950 p-4 text-white">
            <div className="mb-5 flex items-center gap-2 text-zinc-400">
              <Activity className="h-4 w-4" aria-hidden="true" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em]">Sessões</span>
            </div>
            <p className="text-2xl font-semibold tabular-nums">{stats.attended}</p>
            <p className="mt-1 text-[10px] text-zinc-400">{stats.cancelled} cancelada(s)</p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="mb-5 flex items-center gap-2 text-zinc-500">
              <Calendar className="h-4 w-4" aria-hidden="true" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em]">Próxima sessão</span>
            </div>
            <p className="truncate text-base font-semibold text-zinc-900">{stats.next || "A agendar"}</p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-100/70 p-4">
            <div className="mb-5 flex items-center gap-2 text-zinc-500">
              <Target className="h-4 w-4" aria-hidden="true" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em]">Continuidade</span>
            </div>
            <p className="text-base font-semibold leading-tight text-zinc-900">Evolução em acompanhamento</p>
          </div>
        </section>

        <section className="mb-9">
          <div className="mb-4 flex items-center gap-2 border-b border-zinc-200 pb-3">
            <TrendingUp className="h-4 w-4 text-zinc-500" aria-hidden="true" />
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-700">Visão geral</h2>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm leading-7 text-zinc-600">
            {clinicalSummary ||
              "Neste mês, o acompanhamento permaneceu orientado às metas terapêuticas definidas em conjunto, com atenção à continuidade do cuidado e aos próximos passos do processo."}
          </div>
        </section>

        {financialSummary ? (
          <section className="mb-9">
            <div className="mb-4 flex items-center gap-2 border-b border-zinc-200 pb-3">
              <PackageCheck className="h-4 w-4 text-zinc-500" aria-hidden="true" />
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-700">Plano de atendimento</h2>
            </div>
            <div className="grid grid-cols-[1fr_auto] items-center gap-6 rounded-2xl bg-zinc-950 p-5 text-white">
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Pacote atual</p>
                <p className="mt-1 truncate text-sm font-medium">{financialSummary.packagesActive}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Valor do pacote</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{financialSummary.totalInvested}</p>
              </div>
            </div>
          </section>
        ) : null}

        <footer className="mt-auto flex items-center justify-between border-t border-zinc-200 pt-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
              {professionalInitials || "NN"}
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">{professionalName}</p>
              <p className="text-[10px] text-zinc-500">Profissional responsável</p>
            </div>
          </div>
          <p className="text-right text-[9px] leading-relaxed text-zinc-400">
            Documento confidencial<br />NeuroNex
          </p>
        </footer>
      </div>
    </article>
  );
};