import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Activity,
  CalendarClock,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  Flag,
  PackageCheck,
  ShieldAlert,
  ShieldCheck,
  Smile,
  type LucideIcon,
} from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { usePatientRecordSummary } from "@/hooks/use-patient-record-summary";
import { cn } from "@/lib/utils";
import type { Patient } from "@/types";
import { PatientCompleteAppointmentHistory } from "@/components/patients/PatientCompleteAppointmentHistory";
import { PatientStatusIcon } from "@/components/patients/PatientStatusIcon";

interface PatientRecordSummaryTabProps {
  patient: Patient;
  patientId: string;
  onNavigate: (tab: string, sessionView?: "history" | "pending") => void;
}

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

const moodLabels: Record<number, string> = {
  1: "Muito difícil",
  2: "Difícil",
  3: "Neutro",
  4: "Bem",
  5: "Muito bem",
};

export function PatientRecordSummaryTab({ patient, patientId, onNavigate }: PatientRecordSummaryTabProps) {
  const summary = usePatientRecordSummary(patientId);

  if (summary.isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true" aria-label="Carregando resumo do paciente">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-36 rounded-[24px]" />
        ))}
      </div>
    );
  }

  if (summary.isError || !summary.data) {
    return (
      <div className="patient-record-card flex min-h-64 flex-col items-center justify-center rounded-[28px] border border-dashed p-8 text-center">
        <Activity className="mb-4 h-7 w-7 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-semibold text-foreground">Não foi possível montar o resumo agora.</p>
        <p className="mt-1 text-xs text-muted-foreground">As demais áreas do prontuário continuam disponíveis.</p>
        <Button
          type="button"
          variant="outline"
          className="mt-5 min-h-11 rounded-xl px-5"
          onClick={() => void summary.refetch()}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  const data = summary.data;
  const riskState = data.riskScore >= 8
    ? { label: "Atenção clínica prioritária", tone: "red" as const, icon: ShieldAlert }
    : data.riskScore >= 4
      ? { label: "Ponto de atenção informado", tone: "amber" as const, icon: ShieldAlert }
      : { label: "Sem alerta informado", tone: "green" as const, icon: ShieldCheck };
  const nextSessionLabel = data.nextSession?.start_time
    ? format(new Date(data.nextSession.start_time), "dd MMM, HH:mm", { locale: ptBR })
    : "Sem agendamento";
  const lastSessionLabel = data.lastSession?.start_time
    ? format(new Date(data.lastSession.start_time), "dd MMM yyyy", { locale: ptBR })
    : "Ainda sem sessão";
  const packageLabel = data.activePackage
    ? `${Math.max(0, data.activePackage.total_sessions - data.activePackage.sessions_used - data.activePackage.sessions_reserved)} de ${data.activePackage.total_sessions} disponíveis`
    : "Nenhum plano ativo";
  const moodLabel = data.latestMood ? moodLabels[data.latestMood.mood_score] || `Nível ${data.latestMood.mood_score}` : "Sem registro";

  const cards: Array<{
    label: string;
    value: string;
    detail: string;
    icon: LucideIcon;
    onClick: () => void;
    tone?: "warning";
  }> = [
    {
      label: "Sessões concluídas",
      value: String(data.completedSessions),
      detail: `Última: ${lastSessionLabel}`,
      icon: ClipboardCheck,
      onClick: () => onNavigate("sessions", "history"),
    },
    {
      label: "Próxima sessão",
      value: nextSessionLabel,
      detail: data.nextSession ? "Abrir histórico clínico" : "Agenda disponível",
      icon: CalendarClock,
      onClick: () => onNavigate("sessions", "history"),
    },
    {
      label: "Revisões pendentes",
      value: String(data.pendingReviews),
      detail: data.pendingReviews ? "Requer sua atenção" : "Tudo revisado",
      icon: ShieldAlert,
      tone: data.pendingReviews ? "warning" : undefined,
      onClick: () => onNavigate("sessions", "pending"),
    },
    {
      label: "Arquivos clínicos",
      value: String(data.documents),
      detail: "No cofre do paciente",
      icon: FileText,
      onClick: () => onNavigate("documents"),
    },
    {
      label: "Metas ativas",
      value: String(data.activeGoals),
      detail: data.activeGoals ? "Em acompanhamento" : "Nenhuma meta aberta",
      icon: Flag,
      onClick: () => onNavigate("goals"),
    },
    {
      label: "Plano terapêutico",
      value: data.activePackage?.description || "Sem plano",
      detail: packageLabel,
      icon: PackageCheck,
      onClick: () => onNavigate("packages"),
    },
    {
      label: "A receber",
      value: currency.format(data.openBalance),
      detail: "Lançamentos em aberto",
      icon: CircleDollarSign,
      onClick: () => onNavigate("finance"),
    },
    {
      label: "Humor recente",
      value: moodLabel,
      detail: data.latestMood?.created_at
        ? format(new Date(data.latestMood.created_at), "dd 'de' MMMM", { locale: ptBR })
        : "Aguardando o primeiro registro",
      icon: Smile,
      onClick: () => onNavigate("mood"),
    },
  ];

  return (
    <div className="space-y-4 pb-6">
      <section className="patient-record-panel relative overflow-hidden rounded-[30px] border p-6 md:p-7">
        <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-foreground/12 to-transparent" />
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Visão clínica</p>
        <div className="mt-2 flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
          <div>
            <h2 className="text-2xl font-black tracking-[-0.04em] text-foreground">Resumo de {patient.name.split(" ")[0]}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Próximos passos, registros e pontos de atenção reunidos em uma única leitura.
            </p>
          </div>
          <PatientStatusIcon
            icon={riskState.icon}
            label={riskState.label}
            tone={riskState.tone}
            className="h-9 w-9 rounded-[13px]"
          />
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={card.onClick}
            className={cn(
              "patient-record-card desktop-retina-interactive group min-h-36 rounded-[24px] border p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              card.tone === "warning" && "border-amber-500/18",
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <span className={cn(
                "clinical-inset-surface flex h-10 w-10 items-center justify-center rounded-[15px] border text-muted-foreground",
                card.tone === "warning" && "border-amber-500/18 bg-amber-500/8 text-amber-500",
              )}>
                <card.icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/45 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transition-none" aria-hidden="true" />
            </div>
            <p className="mt-5 text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground">{card.label}</p>
            <p className="mt-1 truncate text-lg font-black tracking-[-0.035em] text-foreground" title={card.value}>{card.value}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground" title={card.detail}>{card.detail}</p>
          </button>
        ))}
      </div>

      <PatientCompleteAppointmentHistory patientId={patientId} />
    </div>
  );
}
