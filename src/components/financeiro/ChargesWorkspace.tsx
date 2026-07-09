"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
  WalletCards,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { AdvancedFilterPopover as SharedAdvancedFilterPopover } from "@/components/financeiro/AdvancedFilterPopover";
import { ManualChargeModal } from "@/components/financeiro/ManualChargeModal";
import { NewInvoiceModal } from "@/components/financeiro/NewInvoiceModal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  type ChargeRow,
  type ChargeScope,
  type ChargeStatusFilter,
  type ChargeTypeFilter,
  useChargesPage,
} from "@/hooks/use-charges-page";
import { useUpdateFinancialEntry } from "@/hooks/use-financial-entries";
import { useInvoiceActions } from "@/hooks/use-invoices";
import { usePatients } from "@/hooks/use-patients";
import { cn, formatCurrency } from "@/lib/utils";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";

interface ChargesWorkspaceProps {
  scope: ChargeScope;
  initialStatusFilters?: ChargeStatusFilter[];
  title?: string;
}

const statusCopy: Record<ChargeStatusFilter, { label: string; tone: string; icon: typeof Clock }> = {
  planned: { label: "Planejada", tone: "text-sky-700 bg-sky-500/10 border-sky-500/20", icon: Calendar },
  pending: { label: "Pendente", tone: "text-amber-700 bg-amber-500/10 border-amber-500/20", icon: Clock },
  overdue: { label: "Vencida", tone: "text-red-700 bg-red-500/10 border-red-500/20", icon: XCircle },
  paid: { label: "Recebida", tone: "text-emerald-700 bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2 },
  cancelled: { label: "Cancelada", tone: "text-zinc-600 bg-zinc-500/10 border-zinc-500/20", icon: XCircle },
};

const sourceLabels: Record<string, string> = {
  neurofinance: "NeuroFinance",
  manual: "Manual",
  appointment: "Agenda",
  package: "Pacote",
  convenio: "Convenio",
};

const filterStatusOptions: { id: ChargeStatusFilter; label: string }[] = [
  { id: "planned", label: "Planejada" },
  { id: "pending", label: "Pendente" },
  { id: "overdue", label: "Vencida" },
  { id: "paid", label: "Recebida" },
  { id: "cancelled", label: "Cancelada" },
];

const managementTypeOptions: { id: ChargeTypeFilter; label: string }[] = [
  { id: "manual", label: "Manual" },
  { id: "appointment", label: "Agenda" },
  { id: "package", label: "Pacote" },
  { id: "insurance", label: "Convenio" },
  { id: "subscription", label: "Mensalidade" },
];

const neurofinanceTypeOptions: { id: ChargeTypeFilter; label: string }[] = [
  { id: "single", label: "Avulsas" },
  { id: "subscription", label: "Assinaturas" },
  { id: "installment", label: "Parceladas" },
];

const dateLabel = (value?: string | null) => {
  if (!value) return "Sem data";
  try {
    return format(parseISO(value), "dd/MM/yyyy");
  } catch {
    return value;
  }
};

const getPaymentLink = (row: ChargeRow) => row.links.paymentUrl || row.links.pdfUrl || null;

export function ChargesWorkspace({ scope, initialStatusFilters = [], title }: ChargesWorkspaceProps) {
  const { data: patients = [] } = usePatients();
  const invoiceActions = useInvoiceActions();
  const updateEntry = useUpdateFinancialEntry();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [searchQuery, setSearchQuery] = useState("");
  const [dueStart, setDueStart] = useState("");
  const [dueEnd, setDueEnd] = useState("");
  const [receivedStart, setReceivedStart] = useState("");
  const [receivedEnd, setReceivedEnd] = useState("");
  const [statusFilters, setStatusFilters] = useState<ChargeStatusFilter[]>(initialStatusFilters);
  const [typeFilters, setTypeFilters] = useState<ChargeTypeFilter[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedCharge, setSelectedCharge] = useState<ChargeRow | null>(null);
  const [manualModalOpen, setManualModalOpen] = useState(false);

  const { data, isLoading, isFetching } = useChargesPage({
    scope,
    page,
    pageSize,
    search: searchQuery,
    status: statusFilters,
    type: typeFilters,
    dueStart,
    dueEnd,
    receivedStart,
    receivedEnd,
  });

  const charges = data?.charges || [];
  const total = data?.total || 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const totalAmount = charges.reduce((sum, charge) => sum + Number(charge.amount || 0), 0);
  const activeFilters =
    statusFilters.length + typeFilters.length + Number(!!dueStart) + Number(!!dueEnd) + Number(!!receivedStart) + Number(!!receivedEnd);
  const allVisibleSelected = charges.length > 0 && charges.every((charge) => selectedIds.includes(charge.id));
  const typeOptions = scope === "management" ? managementTypeOptions : neurofinanceTypeOptions;
  const selectedRows = useMemo(() => charges.filter((charge) => selectedIds.includes(charge.id)), [charges, selectedIds]);

  const patientName = (row: ChargeRow) =>
    row.patientName || patients.find((patient) => patient.id === row.patientId)?.name || (row.patientId ? "Paciente" : "Não informado");

  const toggleStatus = (id: ChargeStatusFilter) => {
    setPage(1);
    setStatusFilters((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const toggleType = (id: ChargeTypeFilter) => {
    setPage(1);
    setTypeFilters((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const clearFilters = () => {
    setDueStart("");
    setDueEnd("");
    setReceivedStart("");
    setReceivedEnd("");
    setStatusFilters([]);
    setTypeFilters([]);
    setPage(1);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !charges.some((charge) => charge.id === id)));
      return;
    }

    setSelectedIds((current) => Array.from(new Set([...current, ...charges.map((charge) => charge.id)])));
  };

  const updateManagementStatus = async (row: ChargeRow, status: ChargeStatusFilter) => {
    if (!row.financialEntryId) return;
    try {
      await updateEntry.mutateAsync({
        id: row.financialEntryId,
        status,
        paidAt: status === "paid" ? new Date() : null,
        cancelledAt: status === "cancelled" ? new Date() : null,
        cancelledReason: status === "cancelled" ? "manual_charge_cancelled" : null,
      });
      toast.success("Cobrança atualizada.");
    } catch (error) {
      console.error("Falha ao atualizar cobrança:", error);
      toast.error("Não foi possível atualizar a cobrança.");
    }
  };

  const runNeurofinanceAction = async (row: ChargeRow, action: "sync" | "cancel") => {
    if (!row.neurofinancePaymentId) return;
    try {
      await invoiceActions.runAction.mutateAsync({ id: row.neurofinancePaymentId, action });
      toast.success(action === "sync" ? "Cobrança sincronizada." : "Cobrança cancelada.");
    } catch (error) {
      toast.error(getUserFacingErrorMessage(error, action === "sync" ? "load" : "delete"));
    }
  };

  const runBatchAction = async (action: "sync" | "copy" | "paid" | "pending" | "cancel") => {
    if (!selectedRows.length) {
      toast.info("Selecione pelo menos uma cobrança.");
      return;
    }

    if (action === "copy") {
      const links = selectedRows.map(getPaymentLink).filter(Boolean);
      if (!links.length) {
        toast.info("As cobranças selecionadas não possuem links.");
        return;
      }
      await navigator.clipboard.writeText(links.join("\n"));
      toast.success("Links copiados.");
      return;
    }

    if (scope === "management") {
      const nextStatus: ChargeStatusFilter = action === "paid" ? "paid" : action === "pending" ? "pending" : "cancelled";
      for (const row of selectedRows) {
        if (row.financialEntryId) await updateManagementStatus(row, nextStatus);
      }
      setSelectedIds([]);
      return;
    }

    for (const row of selectedRows) {
      if (action === "sync" || action === "cancel") await runNeurofinanceAction(row, action);
    }
    setSelectedIds([]);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-32">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-300 dark:text-zinc-700" />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Buscando cobranças...</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="relative overflow-hidden rounded-[28px] border border-zinc-200/70 bg-white/82 p-5 shadow-[0_18px_54px_-46px_rgba(24,24,27,0.65)] dark:border-white/[0.08] dark:bg-white/[0.025]">
        <div className="relative z-10 space-y-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="relative min-w-[280px] max-w-xl flex-1">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  type="search"
                  aria-label="Buscar cobranças"
                  placeholder={scope === "management" ? "Buscar por paciente, descrição ou método" : "Buscar por descrição ou número"}
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setPage(1);
                  }}
                  className="h-12 w-full rounded-[14px] border border-zinc-200 bg-white pl-11 pr-4 text-sm font-medium text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-white/10 dark:bg-white/[0.035] dark:text-white dark:focus:border-white/20"
                />
              </div>

              <AdvancedFilters
                activeFilters={activeFilters}
                dueStart={dueStart}
                dueEnd={dueEnd}
                receivedStart={receivedStart}
                receivedEnd={receivedEnd}
                statusFilters={statusFilters}
                typeFilters={typeFilters}
                typeOptions={typeOptions}
                setDueStart={setDueStart}
                setDueEnd={setDueEnd}
                setReceivedStart={setReceivedStart}
                setReceivedEnd={setReceivedEnd}
                toggleStatus={toggleStatus}
                toggleType={toggleType}
                clearFilters={clearFilters}
              />
            </div>

            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-12 rounded-[14px] border-zinc-200 bg-white/70 px-5 text-[10px] font-black uppercase tracking-[0.16em] dark:border-white/10 dark:bg-white/[0.035]"
                  >
                    <MoreVertical className="mr-2 h-4 w-4" />
                    Acoes
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 rounded-[20px] border-zinc-200 bg-white/95 p-2 shadow-2xl dark:border-white/10 dark:bg-zinc-950/95">
                  {scope === "management" ? (
                    <>
                      <BatchButton onClick={() => runBatchAction("paid")} icon={CheckCircle2}>Marcar como pagas</BatchButton>
                      <BatchButton onClick={() => runBatchAction("pending")} icon={Clock}>Voltar para pendente</BatchButton>
                      <BatchButton onClick={() => runBatchAction("cancel")} icon={Trash2} danger>Cancelar selecionadas</BatchButton>
                    </>
                  ) : (
                    <>
                      <BatchButton onClick={() => runBatchAction("sync")} icon={RefreshCw}>Sincronizar selecionadas</BatchButton>
                      <BatchButton onClick={() => runBatchAction("copy")} icon={Copy}>Copiar links</BatchButton>
                      <BatchButton onClick={() => runBatchAction("cancel")} icon={Trash2} danger>Cancelar pendentes</BatchButton>
                    </>
                  )}
                </PopoverContent>
              </Popover>

              {scope === "management" ? (
                <>
                  <Button
                    onClick={() => setManualModalOpen(true)}
                    className="h-12 rounded-[14px] bg-zinc-950 px-6 text-[10px] font-black uppercase tracking-[0.16em] text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Nova cobrança
                  </Button>
                  <ManualChargeModal open={manualModalOpen} onOpenChange={setManualModalOpen} />
                </>
              ) : (
                <NewInvoiceModal>
                  <Button className="h-12 rounded-[14px] bg-zinc-950 px-6 text-[10px] font-black uppercase tracking-[0.16em] text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100">
                    <Plus className="mr-2 h-4 w-4" />
                    Nova cobrança
                  </Button>
                </NewInvoiceModal>
              )}
            </div>
          </div>

          {initialStatusFilters.includes("overdue") && statusFilters.includes("overdue") ? (
            <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100">
              Exibindo cobranças vencidas dentro de Cobranças.
            </div>
          ) : null}

          <div className="overflow-hidden rounded-[20px] border border-zinc-200/75 bg-white/70 dark:border-white/[0.08] dark:bg-white/[0.018]">
            <div className="grid grid-cols-[42px_minmax(190px,1.1fr)_120px_minmax(180px,1.2fr)_150px_145px_150px] gap-4 border-b border-zinc-200/70 px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400 dark:border-white/[0.08]">
              <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAllVisible} aria-label="Selecionar cobranças visíveis" />
              <span>Paciente</span>
              <span>Valor</span>
              <span>Descricao</span>
              <span>Status</span>
              <span>Vencimento</span>
              <span className="text-right">Acoes</span>
            </div>

            <div className="divide-y divide-zinc-200/60 dark:divide-white/[0.06]">
              {charges.length === 0 ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center px-6 text-center">
                  <WalletCards className="mb-4 h-9 w-9 text-zinc-300 dark:text-zinc-700" />
                  <p className="text-sm font-black uppercase tracking-tight text-zinc-900 dark:text-white">Nenhuma cobrança encontrada</p>
                  <p className="mt-2 max-w-sm text-xs font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
                    Ajuste os filtros ou crie uma nova cobrança para controle gerencial.
                  </p>
                </div>
              ) : (
                charges.map((charge) => (
                  <ChargeRowItem
                    key={charge.id}
                    charge={charge}
                    patientName={patientName(charge)}
                    selected={selectedIds.includes(charge.id)}
                    onToggleSelected={() => toggleSelected(charge.id)}
                    onOpen={() => setSelectedCharge(charge)}
                    onCopyLink={async () => {
                      const link = getPaymentLink(charge);
                      if (!link) return toast.info("Esta cobrança não possui link.");
                      await navigator.clipboard.writeText(link);
                      toast.success("Link copiado.");
                    }}
                    onSync={() => runNeurofinanceAction(charge, "sync")}
                    onCancel={() => scope === "management" ? updateManagementStatus(charge, "cancelled") : runNeurofinanceAction(charge, "cancel")}
                    onMarkPaid={() => updateManagementStatus(charge, "paid")}
                    onMarkPending={() => updateManagementStatus(charge, "pending")}
                    isWorking={invoiceActions.runAction.isPending || updateEntry.isPending}
                  />
                ))
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 px-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {charges.length} cobrança{charges.length === 1 ? "" : "s"} nesta página, somando {formatCurrency(totalAmount)}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-zinc-400">{isFetching ? "Atualizando..." : `${total} cobrança${total === 1 ? "" : "s"} no total`}</span>
              <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} className="h-9 rounded-full">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-[10px] font-black uppercase tracking-widest">{page}/{pageCount}</span>
              <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount} className="h-9 rounded-full">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <ChargeDetailDialog
          charge={selectedCharge}
          title={title}
          patientName={selectedCharge ? patientName(selectedCharge) : ""}
          onOpenChange={(open) => !open && setSelectedCharge(null)}
          onCopyLink={async (row) => {
            const link = getPaymentLink(row);
            if (!link) return toast.info("Esta cobrança não possui link.");
            await navigator.clipboard.writeText(link);
            toast.success("Link copiado.");
          }}
          onMarkPaid={(row) => updateManagementStatus(row, "paid")}
          onMarkPending={(row) => updateManagementStatus(row, "pending")}
          onCancel={(row) => (scope === "management" ? updateManagementStatus(row, "cancelled") : runNeurofinanceAction(row, "cancel"))}
          isWorking={invoiceActions.runAction.isPending || updateEntry.isPending}
        />
      </div>
    </TooltipProvider>
  );
}

function ChargeRowItem({
  charge,
  patientName,
  selected,
  onToggleSelected,
  onOpen,
  onCopyLink,
  onSync,
  onCancel,
  onMarkPaid,
  onMarkPending,
  isWorking,
}: {
  charge: ChargeRow;
  patientName: string;
  selected: boolean;
  onToggleSelected: () => void;
  onOpen: () => void;
  onCopyLink: () => void;
  onSync: () => void;
  onCancel: () => void;
  onMarkPaid: () => void;
  onMarkPending: () => void;
  isWorking: boolean;
}) {
  const status = statusCopy[charge.status] || statusCopy.pending;
  const StatusIcon = status.icon;

  return (
    <div className="grid grid-cols-[42px_minmax(190px,1.1fr)_120px_minmax(180px,1.2fr)_150px_145px_150px] items-center gap-4 px-5 py-4 text-sm transition-colors hover:bg-zinc-50/80 dark:hover:bg-white/[0.035]">
      <Checkbox checked={selected} onCheckedChange={onToggleSelected} aria-label={`Selecionar ${charge.description}`} />
      <button type="button" onClick={onOpen} className="min-w-0 text-left">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-white/[0.055] dark:text-zinc-300">
            <UserRound className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-black text-zinc-950 dark:text-white">{patientName}</p>
            <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">
              {sourceLabels[charge.source] || sourceLabels[charge.origin] || charge.source}
            </p>
          </div>
        </div>
      </button>
      <p className="font-black tabular-nums text-zinc-950 dark:text-white">{formatCurrency(charge.amount)}</p>
      <button type="button" onClick={onOpen} className="min-w-0 text-left">
        <p className="truncate font-bold text-zinc-900 dark:text-white">{charge.description}</p>
        <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">{charge.paymentMethod || "Método não informado"}</p>
      </button>
      <span className={cn("inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em]", status.tone)}>
        <StatusIcon className="h-3.5 w-3.5" />
        {status.label}
      </span>
      <p className="text-xs font-bold text-zinc-500 dark:text-zinc-300">{dateLabel(charge.dueDate)}</p>
      <div className="flex justify-end gap-1.5">
        {charge.scope === "management" ? (
          <>
            <IconButton label="Marcar como paga" onClick={onMarkPaid} disabled={isWorking || charge.status === "paid"} icon={CheckCircle2} />
            <IconButton label="Voltar para pendente" onClick={onMarkPending} disabled={isWorking || charge.status === "pending"} icon={Clock} />
            <IconButton label="Cancelar" onClick={onCancel} disabled={isWorking || charge.status === "cancelled"} icon={Trash2} danger />
          </>
        ) : (
          <>
            <IconButton label="Sincronizar" onClick={onSync} disabled={isWorking} icon={RefreshCw} />
            <IconButton label="Copiar link" onClick={onCopyLink} disabled={!getPaymentLink(charge)} icon={Copy} />
            <IconButton label="Cancelar" onClick={onCancel} disabled={isWorking || !["pending", "overdue"].includes(charge.status)} icon={Trash2} danger />
          </>
        )}
        <IconButton label="Detalhes" onClick={onOpen} icon={ExternalLink} />
      </div>
    </div>
  );
}

function IconButton({ label, icon: Icon, onClick, disabled, danger }: { label: string; icon: typeof Search; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className={cn("h-9 w-9 rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-white/[0.06] dark:hover:text-white", danger && "hover:text-red-600")}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function BatchButton({ children, icon: Icon, onClick, danger }: { children: React.ReactNode; icon: typeof Search; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left text-xs font-bold text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/[0.06]",
        danger && "text-red-600 dark:text-red-300",
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function AdvancedFilters({
  activeFilters,
  dueStart,
  dueEnd,
  receivedStart,
  receivedEnd,
  statusFilters,
  typeFilters,
  typeOptions,
  setDueStart,
  setDueEnd,
  setReceivedStart,
  setReceivedEnd,
  toggleStatus,
  toggleType,
  clearFilters,
}: {
  activeFilters: number;
  dueStart: string;
  dueEnd: string;
  receivedStart: string;
  receivedEnd: string;
  statusFilters: ChargeStatusFilter[];
  typeFilters: ChargeTypeFilter[];
  typeOptions: { id: ChargeTypeFilter; label: string }[];
  setDueStart: (value: string) => void;
  setDueEnd: (value: string) => void;
  setReceivedStart: (value: string) => void;
  setReceivedEnd: (value: string) => void;
  toggleStatus: (id: ChargeStatusFilter) => void;
  toggleType: (id: ChargeTypeFilter) => void;
  clearFilters: () => void;
}) {
  return (
    <SharedAdvancedFilterPopover activeFilters={activeFilters} onClear={clearFilters}>
      <div className="grid gap-8 p-7 lg:grid-cols-[1.1fr_1fr_1.35fr]">
        <div className="space-y-5">
          <FilterDateGroup title="Periodo de vencimento" start={dueStart} end={dueEnd} onStart={setDueStart} onEnd={setDueEnd} />
          <FilterDateGroup title="Periodo de recebimento" start={receivedStart} end={receivedEnd} onStart={setReceivedStart} onEnd={setReceivedEnd} />
        </div>
        <FilterCheckGroup title="Tipos de cobrança" options={typeOptions} selected={typeFilters} onToggle={toggleType} />
        <FilterCheckGroup title="Situação das cobranças" options={filterStatusOptions} selected={statusFilters} onToggle={toggleStatus} twoColumns />
      </div>
    </SharedAdvancedFilterPopover>
  );
}

function FilterDateGroup({ title, start, end, onStart, onEnd }: { title: string; start: string; end: string; onStart: (value: string) => void; onEnd: (value: string) => void }) {
  return (
    <div>
      <p className="mb-3 text-sm font-black tracking-tight text-zinc-900 dark:text-white">{title}</p>
      <div className="flex items-center gap-3">
        <DateInput value={start} onChange={onStart} />
        <span className="text-xs font-semibold text-zinc-400">ate</span>
        <DateInput value={end} onChange={onEnd} />
      </div>
    </div>
  );
}

function DateInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="relative">
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-[150px] rounded-[12px] border border-zinc-200 bg-white px-3 pr-9 text-xs font-bold text-zinc-700 outline-none dark:border-white/10 dark:bg-white/[0.035] dark:text-white"
      />
      <Calendar className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
    </div>
  );
}

function FilterCheckGroup<T extends string>({
  title,
  options,
  selected,
  onToggle,
  twoColumns = false,
}: {
  title: string;
  options: { id: T; label: string }[];
  selected: T[];
  onToggle: (id: T) => void;
  twoColumns?: boolean;
}) {
  return (
    <div>
      <p className="mb-4 text-sm font-black tracking-tight text-zinc-900 dark:text-white">{title}</p>
      <div className={cn("grid gap-3", twoColumns ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
        {options.map((option) => (
          <label key={option.id} className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
            <Checkbox checked={selected.includes(option.id)} onCheckedChange={() => onToggle(option.id)} />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function ChargeDetailDialog({
  charge,
  patientName,
  onOpenChange,
  onCopyLink,
  onMarkPaid,
  onMarkPending,
  onCancel,
  isWorking,
}: {
  charge: ChargeRow | null;
  title?: string;
  patientName: string;
  onOpenChange: (open: boolean) => void;
  onCopyLink: (charge: ChargeRow) => void;
  onMarkPaid: (charge: ChargeRow) => void;
  onMarkPending: (charge: ChargeRow) => void;
  onCancel: (charge: ChargeRow) => void;
  isWorking: boolean;
}) {
  const status = charge ? statusCopy[charge.status] : statusCopy.pending;
  const StatusIcon = status.icon;

  return (
    <Dialog open={Boolean(charge)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-[28px] border-zinc-200 bg-white p-0 shadow-2xl dark:border-white/10 dark:bg-zinc-950">
        {charge ? (
          <>
            <div className="border-b border-zinc-200 px-6 py-5 dark:border-white/10">
              <DialogTitle className="text-xl font-black tracking-tight text-zinc-950 dark:text-white">{charge.description}</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {charge.scope === "management" ? "Cobrança gerencial" : "Cobrança bancária NeuroFinance"}
              </DialogDescription>
            </div>
            <div className="space-y-4 p-6">
              <div className="grid gap-3 md:grid-cols-2">
                <Detail label="Paciente" value={patientName} />
                <Detail label="Valor" value={formatCurrency(charge.amount)} />
                <Detail label="Origem" value={sourceLabels[charge.source] || sourceLabels[charge.origin] || charge.source} />
                <Detail label="Método" value={charge.paymentMethod || "Não informado"} />
                <Detail label="Vencimento" value={dateLabel(charge.dueDate)} />
                <Detail label="Recebimento" value={dateLabel(charge.paidAt)} />
              </div>
              <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em]", status.tone)}>
                <StatusIcon className="h-3.5 w-3.5" />
                {status.label}
              </span>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-200 px-6 py-5 dark:border-white/10">
              {charge.scope === "management" ? (
                <>
                  <Button variant="outline" onClick={() => onMarkPending(charge)} disabled={isWorking || charge.status === "pending"} className="rounded-[14px]">
                    <Clock className="mr-2 h-4 w-4" />
                    Pendente
                  </Button>
                  <Button onClick={() => onMarkPaid(charge)} disabled={isWorking || charge.status === "paid"} className="rounded-[14px] bg-emerald-600 text-white hover:bg-emerald-700">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Marcar paga
                  </Button>
                  <Button variant="outline" onClick={() => onCancel(charge)} disabled={isWorking || charge.status === "cancelled"} className="rounded-[14px] text-red-600 hover:text-red-700">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => onCopyLink(charge)} disabled={!getPaymentLink(charge)} className="rounded-[14px]">
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar link
                  </Button>
                  <Button variant="outline" onClick={() => onCancel(charge)} disabled={isWorking || !["pending", "overdue"].includes(charge.status)} className="rounded-[14px] text-red-600 hover:text-red-700">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Cancelar
                  </Button>
                </>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/[0.035]">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">{label}</p>
      <p className="mt-2 text-sm font-bold text-zinc-950 dark:text-white">{value}</p>
    </div>
  );
}
