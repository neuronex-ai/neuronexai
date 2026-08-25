"use client";

import { addDays, endOfDay, format, startOfDay } from "date-fns";
import type { ElementType, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Plus,
  ReceiptText,
  Stethoscope,
  Target,
  UserPlus,
  Users,
  Video,
  WalletCards,
} from "lucide-react";

import { NewAppointmentModal } from "@/components/agenda/NewAppointmentModal";
import { ManualChargeModal } from "@/components/financeiro/ManualChargeModal";
import { NewPatientModal } from "@/components/patients/NewPatientModal";
import { Button } from "@/components/ui/button";
import {
  DesktopActionTile,
  DesktopWorkspacePanel,
  DesktopWorkspaceShell,
} from "@/components/ui/desktop-workspace";
import { MagneticSegmentedControl } from "@/components/ui/magnetic-segmented-control";
import { ReflectionCarousel } from "@/components/ui/reflection-carousel";
import { useDailyRotationItem } from "@/components/ui/reflection-carousel-rotation";
import { StableTabViewport } from "@/components/ui/stable-tab-viewport";
import { useAppointmentsByDateRange } from "@/hooks/use-appointments-by-date-range";
import { useDashboardManagerialMetrics } from "@/hooks/use-dashboard-managerial-metrics";
import { useFinancialAccount } from "@/hooks/use-financial-account";
import { fromPlanningCents, useFinancialPlanning } from "@/hooks/use-financial-planning";
import { useNeuroFinanceBalance } from "@/hooks/use-neurofinance-balance";
import { useNotifications } from "@/hooks/use-notifications";
import { usePendingPatientsCount } from "@/hooks/use-pending-patients-count";
import { useProfile } from "@/hooks/use-profile";
import { getAppointmentKind } from "@/lib/appointment-metadata";
import { getAppointmentStatusMeta } from "@/lib/appointment-status";
import { getAppointmentDisplayTitle } from "@/lib/appointment-utils";
import { cn } from "@/lib/utils";
import type { Appointment } from "@/types";
import { DesktopDashboardMorningBriefing } from "./DesktopDashboardMorningBriefing";
import {
  buildAttentionQueue,
  getActiveAppointments,
  getNextScheduleItem,
  getTodayAppointments,
  isOnlineAppointment,
  paginateAttentionItems,
  type AttentionQueueCategory,
  type AttentionQueueItem,
} from "./dashboard-command-center-model";

type PendingFilter = "all" | AttentionQueueCategory;
type AgendaView = "today" | "week";
type FinancialView = "management" | "neurofinance";

type ManagerialDashboardMetrics = {
  income?: number | null;
  expense?: number | null;
  result?: number | null;
  receivable?: number | null;
  payable?: number | null;
};

const pendingFilters: Array<{ value: PendingFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "sessions", label: "Sessões" },
  { value: "appointments", label: "Agenda" },
  { value: "registrations", label: "Cadastros" },
  { value: "neurofinance", label: "NeuroFinance" },
  { value: "system", label: "Sistema" },
];

const AGENDA_VISIBLE_ITEMS = 4;
const PENDING_PAGE_SIZE = 4;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const professionalReflections = [
  "Cuidar bem também inclui respeitar o próprio ritmo.",
  "Presença clínica nasce de escuta, preparo e espaço para respirar.",
  "Nem todo avanço é ruidoso; alguns começam numa pergunta mais precisa.",
  "Organizar o cuidado devolve tempo para aquilo que só você pode oferecer.",
  "A consistência de hoje constrói a confiança terapêutica de amanhã.",
  "Clareza nos processos abre mais espaço para presença nas sessões.",
  "Acolher histórias exige técnica — e também gentileza consigo.",
  "O trabalho clínico ganha força quando o essencial permanece visível.",
  "Cada prontuário bem cuidado também protege uma história.",
  "Tecnologia útil é aquela que deixa o vínculo humano em primeiro plano.",
] as const;

const NeuroNexReflectionMark = () => (
  <span aria-hidden="true" className="mb-6 block h-12 w-12">
    <img
      src="/favicon-light.png"
      alt=""
      className="h-full w-full object-contain dark:hidden"
    />
    <img
      src="/favicon-dark.png"
      alt=""
      className="hidden h-full w-full object-contain dark:block"
    />
  </span>
);

const formatAppointmentTime = (appointment?: Appointment | null) =>
  appointment?.start_time ? format(new Date(appointment.start_time), "HH:mm") : "-";

const formatAppointmentDay = (appointment?: Appointment | null) =>
  appointment?.start_time ? format(new Date(appointment.start_time), "dd/MM") : "-";

const getFirstName = (profile?: { first_name?: string | null; full_name?: string | null; name?: string | null } | null) =>
  profile?.first_name || profile?.full_name?.split(" ")[0] || profile?.name?.split(" ")[0] || "Doutor";

const getAppointmentLabel = (appointment: Appointment) => {
  const kind = getAppointmentKind(appointment);
  if (kind === "block") return "Bloqueio";
  if (kind === "event") return "Evento";
  return isOnlineAppointment(appointment) ? "Online" : "Consultório";
};

const SectionHeader = ({
  eyebrow,
  title,
  action,
  inverted = false,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
  inverted?: boolean;
}) => (
  <div className="flex items-start justify-between gap-4">
    <div className="min-w-0">
      <p className={cn("text-[10px] font-black uppercase tracking-[0.16em]", inverted ? "text-background/55" : "text-muted-foreground")}>
        {eyebrow}
      </p>
      <h2 className={cn("mt-1 truncate text-lg font-bold tracking-[-0.03em]", inverted ? "text-background" : "text-foreground")}>{title}</h2>
    </div>
    {action}
  </div>
);

const AppointmentStatusPill = ({ appointment }: { appointment: Appointment }) => {
  const status = getAppointmentStatusMeta(appointment.status, appointment.notes);

  return (
    <span className={cn("rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em]", status.bgClass, status.borderClass, status.textClass)}>
      {status.label}
    </span>
  );
};

const AppointmentModePill = ({ appointment }: { appointment: Appointment }) => {
  const online = isOnlineAppointment(appointment);
  const Icon = online ? Video : Stethoscope;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/45 bg-background/45 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {getAppointmentLabel(appointment)}
    </span>
  );
};

const ActionSidebar = ({
  today,
  openManualCharge,
}: {
  today: Date;
  openManualCharge: () => void;
}) => (
  <DesktopWorkspacePanel className="dashboard-panel-surface p-2.5">
    <nav aria-label="Atalhos do dashboard" className="flex gap-1.5 overflow-x-auto xl:min-h-[264px] xl:flex-col xl:items-center xl:justify-start xl:overflow-visible">
      <NewAppointmentModal selectedDate={today}>
        <DesktopActionTile icon={Plus} label="Agendar" active />
      </NewAppointmentModal>
      <NewPatientModal>
        <DesktopActionTile icon={UserPlus} label="Paciente" />
      </NewPatientModal>
      <DesktopActionTile icon={ReceiptText} label="Cobrança" onClick={openManualCharge} />
    </nav>
  </DesktopWorkspacePanel>
);

const EmptyState = ({
  icon: Icon,
  title,
  description,
}: {
  icon: ElementType<{ className?: string }>;
  title: string;
  description: string;
}) => (
  <div className="flex min-h-[328px] flex-col items-center justify-center rounded-[24px] border border-dashed border-border/60 bg-muted/18 p-6 text-center">
    <Icon className="h-8 w-8 text-muted-foreground/45" />
    <h3 className="mt-4 text-base font-bold text-foreground">{title}</h3>
    <p className="mt-2 max-w-sm text-sm font-medium text-muted-foreground">{description}</p>
  </div>
);

const AppointmentRow = ({ appointment }: { appointment: Appointment }) => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate("/agenda", { state: { openAppointmentId: appointment.id } })}
      className="dashboard-retina-card dashboard-tactile group flex min-h-[76px] w-full items-center gap-3 rounded-[20px] p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-[16px] bg-foreground text-sm font-bold text-background tabular-nums">
        {formatAppointmentTime(appointment)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="min-w-0 truncate text-sm font-bold tracking-[-0.015em] text-foreground">
            {getAppointmentDisplayTitle(appointment) || appointment.patient_name || "Paciente"}
          </p>
          <AppointmentStatusPill appointment={appointment} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <AppointmentModePill appointment={appointment} />
          <span className="rounded-full border border-border/45 bg-background/45 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            {formatAppointmentDay(appointment)}
          </span>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/45 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
    </button>
  );
};

const AgendaListViewport = ({
  appointments,
  label,
}: {
  appointments: Appointment[];
  label: string;
}) => {
  const hasOverflow = appointments.length > AGENDA_VISIBLE_ITEMS;

  return (
    <div
      role="region"
      aria-label={`${label}: ${appointments.length} compromisso${appointments.length === 1 ? "" : "s"}`}
      tabIndex={hasOverflow ? 0 : undefined}
      className={cn(
        "h-[328px] space-y-2 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      {appointments.map((appointment) => (
        <AppointmentRow key={appointment.id} appointment={appointment} />
      ))}
    </div>
  );
};

const AgendaPanel = ({
  todayAppointments,
  weekAppointments,
  isLoading,
}: {
  todayAppointments: Appointment[];
  weekAppointments: Appointment[];
  isLoading: boolean;
}) => {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<AgendaView>("today");
  const appointments = activeView === "today" ? todayAppointments : weekAppointments;
  const loadingLabel =
    activeView === "today"
      ? "Carregando agenda de hoje"
      : "Carregando agenda dos próximos sete dias";
  const regionLabel =
    activeView === "today" ? "Agenda de hoje" : "Agenda dos próximos sete dias";

  return (
    <DesktopWorkspacePanel
      data-synapse-target="dashboard-agenda"
      className="dashboard-panel-surface flex h-full min-h-0 flex-col p-5 lg:p-6"
    >
      <SectionHeader
        eyebrow="Agenda"
        title="Fluxo clínico"
        action={
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <MagneticSegmentedControl
              id="dashboard-agenda-view"
              indicatorId="dashboard-agenda-indicator"
              value={activeView}
              onValueChange={setActiveView}
              ariaLabel="Período da agenda"
              options={[
                { value: "today", label: "Hoje" },
                { value: "week", label: "7 dias" },
              ]}
              className="h-12 min-h-12 shrink-0 rounded-[16px]"
              triggerClassName="h-11 min-h-11 rounded-[12px] px-3 py-0 text-xs"
            />
            <Button
              variant="outline"
              className="dashboard-tactile h-11 shrink-0 rounded-[14px] px-3 text-xs font-bold"
              onClick={() => navigate("/agenda")}
            >
              Abrir
            </Button>
          </div>
        }
      />

      <StableTabViewport
        id="dashboard-agenda-view"
        value={activeView}
        className="mt-5 h-[328px] shrink-0"
      >
        {isLoading ? (
          <div className="h-[328px] space-y-2 overflow-hidden" aria-label={loadingLabel}>
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-[76px] animate-pulse rounded-[20px] bg-muted/35 motion-reduce:animate-none"
              />
            ))}
          </div>
        ) : appointments.length ? (
          <AgendaListViewport appointments={appointments} label={regionLabel} />
        ) : activeView === "today" ? (
          <EmptyState
            icon={CalendarIcon}
            title="Dia livre"
            description="Nenhum atendimento marcado para hoje."
          />
        ) : (
          <EmptyState
            icon={CalendarIcon}
            title="Semana livre"
            description="Sem compromissos ativos nos próximos 7 dias."
          />
        )}
      </StableTabViewport>
    </DesktopWorkspacePanel>
  );
};
const FinanceMetricCard = ({
  label,
  value,
  accent = false,
  onClick,
}: {
  label: string;
  value: string;
  accent?: boolean;
  onClick?: () => void;
}) => {
  const interactive = Boolean(onClick);
  const cardClassName = cn(
    "group relative isolate flex h-full min-h-[144px] w-full overflow-hidden rounded-[24px] border p-4 text-left",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "motion-reduce:transition-none",
    interactive && "dashboard-tactile cursor-pointer hover:-translate-y-0.5 active:translate-y-px motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0",
    accent
      ? "border-foreground bg-foreground text-background shadow-[0_24px_54px_-40px_hsl(var(--foreground)/0.62)] dark:border-white dark:bg-white dark:text-zinc-950 dark:shadow-[0_24px_56px_-42px_rgba(0,0,0,0.96)]"
      : "dashboard-retina-card dashboard-finance-metric border-foreground/[0.09] text-foreground dark:border-white/[0.075] dark:bg-[linear-gradient(155deg,rgba(255,255,255,0.052),rgba(255,255,255,0.022))] dark:shadow-[0_24px_56px_-44px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.035)]",
  );
  const content = (
    <>
      <div
        className={cn(
          "pointer-events-none absolute inset-0 -z-10",
          accent
            ? "bg-[radial-gradient(circle_at_16%_0%,hsl(var(--background)/0.09),transparent_42%)] dark:bg-[radial-gradient(circle_at_16%_0%,rgba(9,9,11,0.06),transparent_42%)]"
            : "bg-[radial-gradient(circle_at_16%_0%,hsl(var(--foreground)/0.025),transparent_42%),linear-gradient(145deg,transparent_48%,hsl(var(--foreground)/0.012))] dark:bg-[radial-gradient(circle_at_16%_0%,rgba(255,255,255,0.018),transparent_42%),linear-gradient(145deg,transparent_48%,rgba(255,255,255,0.006))]",
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-5 top-0 h-px",
          accent ? "bg-background/[0.26] dark:bg-zinc-950/[0.12]" : "bg-foreground/[0.045] dark:bg-white/[0.045]",
        )}
      />
      <span className="relative z-10 flex h-full min-w-0 flex-1 flex-col justify-between gap-5">
        <span className="flex items-start justify-between gap-3">
          <span className={cn("text-[9px] font-black uppercase tracking-[0.16em]", accent ? "text-background/56 dark:text-zinc-950/55" : "text-muted-foreground")}>
            {label}
          </span>
          {interactive ? (
            <ArrowRight
              aria-hidden="true"
              className={cn(
                "h-4 w-4 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0",
                accent ? "text-background/52 dark:text-zinc-950/50" : "text-muted-foreground/45",
              )}
            />
          ) : null}
        </span>
        <span
          className={cn(
            "block max-w-full truncate text-[clamp(1.2rem,1.65vw,1.7rem)] font-black leading-none tracking-[-0.05em] tabular-nums",
            accent ? "text-background dark:text-zinc-950" : "text-foreground",
          )}
          title={value}
        >
          {value}
        </span>
      </span>
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`${label}: ${value}`}
        className={cardClassName}
      >
        {content}
      </button>
    );
  }

  return (
    <div role="group" aria-label={`${label}: ${value}`} className={cardClassName}>
      {content}
    </div>
  );
};

const FinanceWidgetSkeleton = () => (
  <div className="grid h-[328px] grid-cols-2 grid-rows-2 gap-3" aria-label="Carregando resumo financeiro">
    {[1, 2, 3, 4].map((item) => (
      <div key={item} className="min-h-[144px] animate-pulse rounded-[24px] bg-muted/35 motion-reduce:animate-none" />
    ))}
  </div>
);

const ManagementWidget = ({
  managerial,
  isLoading,
}: {
  managerial?: ManagerialDashboardMetrics | null;
  isLoading: boolean;
}) => {
  const navigate = useNavigate();
  const result = Number(managerial?.result || 0);
  const receivable = Number(managerial?.receivable || 0);
  const payable = Number(managerial?.payable || 0);

  if (isLoading) {
    return <FinanceWidgetSkeleton />;
  }

  return (
    <div className="grid h-[328px] grid-cols-2 grid-rows-2 gap-3">
      <FinanceMetricCard label="Resumo do mês" value={formatCurrency(result)} accent />
      <FinanceMetricCard label="A receber" value={formatCurrency(receivable)} />
      <FinanceMetricCard label="A pagar" value={formatCurrency(payable)} />
      <FinanceMetricCard label="Fluxo de caixa" value="Abrir" onClick={() => navigate("/financeiro?view=gestao-fluxo-caixa")} />
    </div>
  );
};

const NeuroFinanceWidget = ({
  financialConnected,
  financialLoading,
  balance,
  balanceLoading,
}: {
  financialConnected: boolean;
  financialLoading: boolean;
  balance: {
    balance: number;
    pending: number;
    totalReceived: number;
    paidOut: number;
  };
  balanceLoading: boolean;
}) => {
  const navigate = useNavigate();
  const loading = financialLoading || (financialConnected && balanceLoading);

  if (loading) {
    return <FinanceWidgetSkeleton />;
  }

  return (
    <div className="grid h-[328px] grid-cols-2 grid-rows-2 gap-3">
      <FinanceMetricCard label="Saldo" value={financialConnected ? formatCurrency(balance.balance) : "Ativar"} accent={financialConnected} onClick={() => navigate("/financeiro?view=conta-digital")} />
      <FinanceMetricCard label="Vai cair" value={formatCurrency(balance.pending)} onClick={() => navigate("/financeiro?view=extrato&subview=futuro")} />
      <FinanceMetricCard label="Quanto entrou" value={formatCurrency(balance.totalReceived)} onClick={() => navigate("/financeiro?view=extrato&subview=realizado")} />
      <FinanceMetricCard label="Quanto saiu" value={formatCurrency(balance.paidOut)} onClick={() => navigate("/financeiro?view=extrato&subview=andamento")} />
    </div>
  );
};

const FinancialGoalShortcut = ({
  managerial,
  isLoading,
}: {
  managerial?: ManagerialDashboardMetrics | null;
  isLoading: boolean;
}) => {
  const navigate = useNavigate();
  const planning = useFinancialPlanning(new Date());
  const goal = planning.goal ? fromPlanningCents(planning.goal.revenue_goal_cents) : 0;
  const income = Number(managerial?.income || 0);
  const progress = goal > 0 ? Math.min(100, Math.round((income / goal) * 100)) : 0;
  const hasGoal = goal > 0;
  const loading = isLoading || planning.isLoading;

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => navigate("/financeiro?view=gestao-planejamento")}
      aria-label={
        hasGoal
          ? `Abrir planejamento financeiro. Meta mensal ${formatCurrency(goal)}, ${progress}% atingida.`
          : "Abrir planejamento financeiro e definir meta mensal"
      }
      className="dashboard-tactile relative h-11 min-w-11 overflow-hidden rounded-[14px] px-3 text-xs font-bold"
    >
      <Target aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span className="ml-2 hidden whitespace-nowrap 2xl:inline">
        {loading ? "Atualizando" : hasGoal ? `${progress}% da meta` : "Definir meta"}
      </span>
      {hasGoal ? (
        <span
          aria-hidden="true"
          className="absolute inset-x-2 bottom-1 h-0.5 overflow-hidden rounded-full bg-foreground/10"
        >
          <span
            className="block h-full rounded-full bg-foreground/65 transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </span>
      ) : null}
    </Button>
  );
};
const FinancialOverviewPanel = ({
  financialConnected,
  financialLoading,
  managerial,
  balance,
  managerLoading,
  balanceLoading,
}: {
  financialConnected: boolean;
  financialLoading: boolean;
  managerial?: ManagerialDashboardMetrics | null;
  balance: {
    balance: number;
    pending: number;
    totalReceived: number;
    paidOut: number;
  };
  managerLoading: boolean;
  balanceLoading: boolean;
}) => {
  const [activeView, setActiveView] = useState<FinancialView>("management");

  return (
    <DesktopWorkspacePanel
      data-synapse-target="dashboard-finance"
      className="dashboard-panel-surface flex h-full min-h-0 flex-col p-5 lg:p-6"
    >
      <SectionHeader
        eyebrow="Financeiro"
        title="Resumo útil"
        action={
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <MagneticSegmentedControl
              id="dashboard-finance-view"
              indicatorId="dashboard-finance-indicator"
              value={activeView}
              onValueChange={setActiveView}
              ariaLabel="Origem do resumo financeiro"
              options={[
                { value: "management", label: "Gestão" },
                { value: "neurofinance", label: "NeuroFinance" },
              ]}
              className="h-12 min-h-12 shrink-0 rounded-[16px]"
              triggerClassName="h-11 min-h-11 rounded-[12px] px-3 py-0 text-xs"
            />
            <FinancialGoalShortcut managerial={managerial} isLoading={managerLoading} />
          </div>
        }
      />

      <StableTabViewport
        id="dashboard-finance-view"
        value={activeView}
        className="mt-5 h-[328px] shrink-0"
      >
        {activeView === "management" ? (
          <ManagementWidget managerial={managerial} isLoading={managerLoading} />
        ) : (
          <NeuroFinanceWidget
            financialConnected={financialConnected}
            financialLoading={financialLoading}
            balance={balance}
            balanceLoading={balanceLoading}
          />
        )}
      </StableTabViewport>
    </DesktopWorkspacePanel>
  );
};
const PendingIcon = ({ item }: { item: AttentionQueueItem }) => {
  if (item.category === "sessions") return <Users className="h-4 w-4" />;
  if (item.category === "appointments") return <CalendarIcon className="h-4 w-4" />;
  if (item.category === "registrations") return <UserPlus className="h-4 w-4" />;
  if (item.category === "neurofinance") return <WalletCards className="h-4 w-4" />;
  if (item.tone === "destructive") return <AlertCircle className="h-4 w-4" />;
  return <Bell className="h-4 w-4" />;
};

const PendingRows = ({ items }: { items: AttentionQueueItem[] }) => {
  const navigate = useNavigate();

  if (!items.length) {
    return (
      <div className="flex h-full min-h-[204px] flex-col items-center justify-center rounded-[26px] border border-dashed border-border/60 bg-muted/[0.18] p-6 text-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-500/70" />
        <h3 className="mt-4 text-base font-bold text-foreground">Tudo em dia</h3>
        <p className="mt-2 max-w-sm text-sm font-medium text-muted-foreground">Sem pendências acionáveis nesta categoria.</p>
      </div>
    );
  }

  return (
    <div className="grid content-start gap-2 md:grid-cols-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => navigate(item.actionUrl)}
          className={cn(
            "dashboard-retina-card dashboard-tactile group flex min-h-[98px] w-full items-start gap-3 rounded-[22px] p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            item.tone === "warning" && "border-amber-500/25 bg-amber-500/[0.06]",
            item.tone === "destructive" && "border-rose-500/25 bg-rose-500/[0.055]",
          )}
        >
          <span
            className={cn(
              "dashboard-soft-fill mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] text-muted-foreground",
              item.tone === "warning" && "border-amber-500/25 text-amber-600",
              item.tone === "destructive" && "border-rose-500/25 text-rose-600",
            )}
          >
            <PendingIcon item={item} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">{item.label}</span>
            <span className="mt-1 block truncate text-sm font-bold text-foreground">{item.title}</span>
            <span className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-muted-foreground">{item.description}</span>
          </span>
          <ArrowRight className="mt-3 h-4 w-4 shrink-0 text-muted-foreground/45 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
        </button>
      ))}
    </div>
  );
};

const PendingPage = ({
  id,
  items,
  isLoading,
}: {
  id: string;
  items: AttentionQueueItem[];
  isLoading: boolean;
}) => {
  const [requestedPage, setRequestedPage] = useState(0);
  const pagination = useMemo(
    () => paginateAttentionItems(items, requestedPage, PENDING_PAGE_SIZE),
    [items, requestedPage],
  );
  const contentId = `dashboard-pending-${id}`;
  const firstVisibleItem = pagination.totalItems ? pagination.pageIndex * pagination.pageSize + 1 : 0;
  const lastVisibleItem = Math.min(pagination.totalItems, firstVisibleItem + pagination.items.length - 1);

  useEffect(() => {
    if (requestedPage !== pagination.pageIndex) {
      setRequestedPage(pagination.pageIndex);
    }
  }, [pagination.pageIndex, requestedPage]);

  return (
    <div className="flex h-[276px] min-h-0 flex-col">
      <div
        id={contentId}
        role="region"
        aria-label="Itens pendentes desta categoria"
        tabIndex={pagination.items.length ? 0 : undefined}
        className="h-[212px] min-h-0 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {isLoading ? (
          <div className="grid content-start gap-2 md:grid-cols-2" aria-label="Carregando pendências">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-[98px] animate-pulse rounded-[20px] bg-muted/35 motion-reduce:animate-none" />
            ))}
          </div>
        ) : (
          <PendingRows items={pagination.items} />
        )}
      </div>

      <div className="mt-3 flex min-h-12 items-center justify-between gap-3 border-t border-border/45 pt-3 dark:border-white/[0.06]">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground" aria-live="polite">
          {pagination.totalItems ? `${firstVisibleItem}–${lastVisibleItem} de ${pagination.totalItems}` : "0 itens"}
        </p>
        <div className="flex items-center gap-2">
          <span className="min-w-16 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
            {pagination.pageIndex + 1} / {pagination.totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Página anterior"
            aria-controls={contentId}
            disabled={pagination.pageIndex === 0 || isLoading}
            onClick={() => setRequestedPage((current) => Math.max(0, current - 1))}
            className="dashboard-tactile h-9 w-9 rounded-[13px]"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Próxima página"
            aria-controls={contentId}
            disabled={pagination.pageIndex >= pagination.totalPages - 1 || isLoading}
            onClick={() => setRequestedPage((current) => Math.min(pagination.totalPages - 1, current + 1))}
            className="dashboard-tactile h-9 w-9 rounded-[13px]"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

const PendingWorkPanel = ({
  items,
  isLoading,
}: {
  items: AttentionQueueItem[];
  isLoading: boolean;
}) => {
  const [activeFilter, setActiveFilter] = useState<PendingFilter>("all");
  const itemsByFilter = useMemo<Record<PendingFilter, AttentionQueueItem[]>>(() => ({
    all: items,
    sessions: items.filter((item) => item.category === "sessions"),
    appointments: items.filter((item) => item.category === "appointments"),
    registrations: items.filter((item) => item.category === "registrations"),
    neurofinance: items.filter((item) => item.category === "neurofinance"),
    system: items.filter((item) => item.category === "system"),
  }), [items]);

  return (
    <DesktopWorkspacePanel
      data-synapse-target="dashboard-pending"
      className="dashboard-panel-surface p-5 lg:p-6"
    >
      <SectionHeader
        eyebrow="Pendências"
        title="Lista operacional"
        action={
          <div className="max-w-[72vw] overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <MagneticSegmentedControl
              id="dashboard-pending-view"
              indicatorId="dashboard-pending-indicator"
              value={activeFilter}
              onValueChange={setActiveFilter}
              ariaLabel="Filtrar pendências"
              options={pendingFilters.map((filter) => ({
                value: filter.value,
                label: (
                  <>
                    {filter.label}
                    <span className="rounded-full bg-muted/70 px-1.5 py-0.5 text-[9px] font-black text-muted-foreground">
                      {itemsByFilter[filter.value].length}
                    </span>
                  </>
                ),
              }))}
              className="h-12 min-h-12 min-w-max rounded-[18px]"
              triggerClassName="h-11 min-h-11 rounded-[14px] px-3 py-0 text-xs"
            />
          </div>
        }
      />

      <StableTabViewport
        id="dashboard-pending-view"
        value={activeFilter}
        className="mt-5 h-[276px]"
      >
        <PendingPage
          id={activeFilter}
          items={itemsByFilter[activeFilter]}
          isLoading={isLoading}
        />
      </StableTabViewport>
    </DesktopWorkspacePanel>
  );
};
export const DesktopDashboardCommandCenter = () => {
  const today = useMemo(() => new Date(), []);
  const { data: profile } = useProfile();
  const [manualChargeOpen, setManualChargeOpen] = useState(false);
  const professionalReflection = useDailyRotationItem(professionalReflections) || professionalReflections[0];
  const firstName = getFirstName(profile);

  const { data: allUpcomingAppointments, isLoading: loadingAppointments } = useAppointmentsByDateRange(startOfDay(today), endOfDay(addDays(today, 7)));
  const { data: pendingPatientsRaw } = usePendingPatientsCount();
  const { notifications, isLoading: notificationsLoading } = useNotifications({ enableRealtime: false, syncBadge: false });
  const { data: managerial, isLoading: managerLoading } = useDashboardManagerialMetrics();
  const { data: neuroBalance, isLoading: balanceLoading } = useNeuroFinanceBalance();
  const { isConnected: financialConnected, isLoading: financialLoading } = useFinancialAccount();

  const pendingPatients = Number(pendingPatientsRaw || 0);
  const activeAppointments = useMemo(() => getActiveAppointments((allUpcomingAppointments || []) as Appointment[]), [allUpcomingAppointments]);
  const todayAppointments = useMemo(() => getTodayAppointments(activeAppointments, today), [activeAppointments, today]);
  const nextAppointment = useMemo(() => getNextScheduleItem(activeAppointments, new Date()), [activeAppointments]);
  const followingAppointment = useMemo(() => {
    if (!nextAppointment) return undefined;
    const currentIndex = activeAppointments.findIndex((appointment) => appointment.id === nextAppointment.id);
    return currentIndex >= 0 ? activeAppointments[currentIndex + 1] : undefined;
  }, [activeAppointments, nextAppointment]);
  const attentionItems = useMemo(
    () =>
      buildAttentionQueue({
        notifications,
        appointments: activeAppointments,
        pendingPatients,
        financialConnected,
        financialLoading,
        limit: 24,
      }),
    [activeAppointments, financialConnected, financialLoading, notifications, pendingPatients],
  );

  return (
    <>
      <div className="desktop-lumen-page desktop-content-offset dashboard-desktop relative min-h-screen w-full bg-transparent pb-24 font-sans text-foreground selection:bg-primary/10 selection:text-primary">
        <main className="page-spacing relative z-10 flex w-full max-w-[2200px] flex-col gap-4 px-6 md:px-8 lg:px-12 xl:px-16">
        <DesktopWorkspaceShell className="dashboard-shell-surface">
          <div className="grid items-start gap-4 xl:grid-cols-[104px_minmax(0,1fr)]">
            <ActionSidebar today={today} openManualCharge={() => setManualChargeOpen(true)} />
            <DesktopDashboardMorningBriefing
              today={today}
              firstName={firstName}
              todayAppointments={todayAppointments}
              weekAppointmentsCount={activeAppointments.length}
              attentionItems={attentionItems}
              nextAppointment={nextAppointment}
              followingAppointment={followingAppointment}
              isLoading={loadingAppointments}
              financialConnected={financialConnected}
            />
          </div>

          <div className="dashboard-deferred-section mt-4 grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.02fr)_minmax(500px,0.98fr)]">
            <AgendaPanel todayAppointments={todayAppointments} weekAppointments={activeAppointments} isLoading={loadingAppointments} />
            <FinancialOverviewPanel
              financialConnected={financialConnected}
              financialLoading={financialLoading}
              managerial={managerial}
              balance={neuroBalance}
              managerLoading={managerLoading}
              balanceLoading={balanceLoading}
            />
          </div>

          <div
            id="dashboard-pendencias"
            tabIndex={-1}
            className="dashboard-deferred-section dashboard-deferred-section-pending mt-4 scroll-mt-24 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PendingWorkPanel items={attentionItems} isLoading={notificationsLoading} />
          </div>

          <div className="dashboard-deferred-section mt-4">
            <ReflectionCarousel
              ariaLabel="Reflexões para a prática clínica"
              leadingVisual={<NeuroNexReflectionMark />}
              slides={[
                {
                  eyebrow: "Reflexão do dia",
                  title: professionalReflection,
                  description: "Uma pausa breve para atravessar o trabalho clínico com mais clareza, presença e intenção.",
                },
                {
                  eyebrow: "Para quem cuida",
                  title: "Este ambiente foi construído com psicólogos, para psicólogos.",
                  description: `A NeuroNex existe para devolver tempo, clareza e presença a quem sustenta histórias todos os dias. Obrigado por construir esse futuro conosco, ${firstName}.`,
                },
              ]}
            />
          </div>
        </DesktopWorkspaceShell>
        </main>
      </div>
      <ManualChargeModal open={manualChargeOpen} onOpenChange={setManualChargeOpen} />
    </>
  );
};

export default DesktopDashboardCommandCenter;
