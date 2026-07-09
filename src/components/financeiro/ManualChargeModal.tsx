"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, addMonths, format, setDate, startOfDay } from "date-fns";
import { AlertCircle, CalendarClock, Loader2, PackageCheck, Plus, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useActivePatientPackages } from "@/hooks/use-active-patient-packages";
import { useCreateFinancialEntry, type FinancialEntryPaymentMethod } from "@/hooks/use-financial-entries";
import { formatCentsAsBRL, usePatientInsuranceAgreements } from "@/hooks/use-patient-insurance-agreements";
import { usePatientRecordDetails } from "@/hooks/use-patient-record-details";
import { usePatients } from "@/hooks/use-patients";
import { cn } from "@/lib/utils";

interface ManualChargeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PAYMENT_METHODS: Array<{ id: FinancialEntryPaymentMethod; label: string }> = [
  { id: "manual", label: "A combinar" },
  { id: "pix", label: "Pix externo" },
  { id: "boleto", label: "Boleto externo" },
  { id: "card", label: "Cartao" },
  { id: "cash", label: "Dinheiro" },
  { id: "external_transfer", label: "Transferencia" },
  { id: "convenio", label: "Convenio" },
  { id: "other", label: "Outro" },
];

const PLAN_LABELS: Record<string, string> = {
  per_session: "Sessao avulsa",
  monthly: "Mensalidade",
  insurance: "Convenio",
  exempt: "Isento",
};

const currency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(value) ? value : 0);

const parseMoney = (value: string) => {
  const normalized = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const centsToAmount = (cents?: number | null) => Math.max(0, Number(cents || 0)) / 100;

const formatDateInput = (date: Date) => format(date, "yyyy-MM-dd");

const nextBillingDate = (billingDay?: number | null) => {
  if (!billingDay) return new Date();
  const today = startOfDay(new Date());
  const clampedDay = Math.min(28, Math.max(1, billingDay));
  const candidate = setDate(today, clampedDay);
  return candidate >= today ? candidate : setDate(addMonths(today, 1), clampedDay);
};

export function ManualChargeModal({ open, onOpenChange }: ManualChargeModalProps) {
  const { data: patients = [] } = usePatients();
  const { data: agreements = [] } = usePatientInsuranceAgreements();
  const [patientId, setPatientId] = useState("");
  const [description, setDescription] = useState("Cobrança manual");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(formatDateInput(new Date()));
  const [paymentMethod, setPaymentMethod] = useState<FinancialEntryPaymentMethod>("manual");
  const [packageId, setPackageId] = useState("");
  const [notes, setNotes] = useState("");
  const [overrideExempt, setOverrideExempt] = useState(false);

  const selectedPatient = patients.find((patient) => patient.id === patientId) || null;
  const recordDetails = usePatientRecordDetails(patientId || null);
  const activePackages = useActivePatientPackages(patientId || "");
  const createEntry = useCreateFinancialEntry();

  const financial = recordDetails.data?.financial || null;
  const responsible = recordDetails.data?.responsible || null;
  const activeAgreement = agreements.find((agreement) => agreement.id === financial?.insurance_agreement_id) || null;
  const selectedPackage = activePackages.data?.find((item) => item.id === packageId) || null;
  const planType = financial?.plan_type || "not_configured";
  const isExempt = planType === "exempt";

  const contextCards = useMemo(() => {
    const cards: Array<{ icon: typeof UserRound; label: string; value: string; tone?: "warning" | "success" }> = [];
    cards.push({
      icon: ShieldCheck,
      label: "Plano financeiro",
      value: PLAN_LABELS[planType] || "Sem configuração financeira",
      tone: planType === "exempt" ? "warning" : undefined,
    });

    if (financial?.session_value_cents) {
      cards.push({ icon: CalendarClock, label: "Valor da sessao", value: formatCentsAsBRL(financial.session_value_cents) });
    }
    if (financial?.monthly_value_cents) {
      cards.push({ icon: CalendarClock, label: "Mensalidade", value: formatCentsAsBRL(financial.monthly_value_cents) });
    }
    if (activeAgreement) {
      cards.push({
        icon: ShieldCheck,
        label: "Convenio",
        value: `${activeAgreement.name} - ${activeAgreement.expected_receipt_days} dia(s)`,
        tone: "success",
      });
    }
    if (activePackages.data?.length) {
      const remaining = activePackages.data.reduce((sum, item) => sum + Math.max(0, item.total_sessions - item.sessions_used), 0);
      cards.push({
        icon: PackageCheck,
        label: "Pacotes ativos",
        value: `${activePackages.data.length} pacote(s), ${remaining} sessão(ões) restantes`,
        tone: "success",
      });
    }
    if (responsible?.name) {
      cards.push({ icon: UserRound, label: "Responsavel financeiro", value: responsible.name });
    }
    return cards;
  }, [activeAgreement, activePackages.data, financial, planType, responsible]);

  useEffect(() => {
    if (!open) return;
    if (!patientId) {
      setDescription("Cobrança manual");
      setAmount("");
      setDueDate(formatDateInput(new Date()));
      setPaymentMethod("manual");
      setPackageId("");
      setOverrideExempt(false);
      return;
    }

    if (!financial) return;

    if (financial.plan_type === "per_session") {
      setDescription("Sessao avulsa");
      setAmount(financial.session_value_cents ? String(centsToAmount(financial.session_value_cents).toFixed(2)).replace(".", ",") : "");
      setPaymentMethod("manual");
      setDueDate(formatDateInput(new Date()));
    }

    if (financial.plan_type === "monthly") {
      setDescription("Mensalidade");
      setAmount(financial.monthly_value_cents ? String(centsToAmount(financial.monthly_value_cents).toFixed(2)).replace(".", ",") : "");
      setPaymentMethod("manual");
      setDueDate(formatDateInput(nextBillingDate(financial.billing_day)));
    }

    if (financial.plan_type === "insurance") {
      const expectedDays = activeAgreement?.expected_receipt_days ?? 30;
      const agreementAmount =
        activeAgreement?.repass_type === "currency"
          ? centsToAmount(activeAgreement.repass_value_cents)
          : centsToAmount(financial.session_value_cents);
      setDescription(activeAgreement ? `Repasse ${activeAgreement.name}` : "Repasse de convenio");
      setAmount(agreementAmount ? String(agreementAmount.toFixed(2)).replace(".", ",") : "");
      setPaymentMethod("convenio");
      setDueDate(formatDateInput(addDays(new Date(), expectedDays)));
    }

    if (financial.plan_type === "exempt") {
      setDescription("Cobrança manual com isenção configurada");
      setAmount("");
      setPaymentMethod("manual");
      setOverrideExempt(false);
    }
  }, [activeAgreement, financial, open, patientId]);

  useEffect(() => {
    if (!selectedPackage) return;
    const remaining = Math.max(0, selectedPackage.total_sessions - selectedPackage.sessions_used);
    const valuePerSession = selectedPackage.price && selectedPackage.total_sessions > 0
      ? Number(selectedPackage.price) / selectedPackage.total_sessions
      : 0;
    setDescription(`Sessao de pacote - ${selectedPackage.description || selectedPackage.name || "pacote"}`);
    if (valuePerSession > 0) setAmount(String(valuePerSession.toFixed(2)).replace(".", ","));
    setNotes((current) => current || `${remaining} sessão(ões) restantes no pacote selecionado.`);
  }, [selectedPackage]);

  const resetAndClose = () => {
    onOpenChange(false);
    setPatientId("");
    setDescription("Cobrança manual");
    setAmount("");
    setDueDate(formatDateInput(new Date()));
    setPaymentMethod("manual");
    setPackageId("");
    setNotes("");
    setOverrideExempt(false);
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error("Informe uma descrição para a cobrança.");
      return;
    }

    const parsedAmount = parseMoney(amount);
    if (parsedAmount <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }

    if (isExempt && !overrideExempt) {
      toast.error("Paciente isento. Confirme o override para criar a cobrança.");
      return;
    }

    try {
      await createEntry.mutateAsync({
        type: "income",
        title: description.trim(),
        description: description.trim(),
        amount: parsedAmount,
        dueDate: new Date(`${dueDate}T12:00:00`),
        competenceDate: new Date(`${dueDate}T12:00:00`),
        paidAt: null,
        status: "pending",
        paymentMethod,
        origin: selectedPackage ? "package" : paymentMethod === "convenio" ? "convenio" : "manual",
        patientId: patientId || null,
        metadata: {
          source: "manual_charge_modal",
          patient_financial_plan: financial?.plan_type || null,
          insurance_agreement_id: financial?.insurance_agreement_id || null,
          patient_package_id: selectedPackage?.id || null,
          notes: notes.trim() || null,
          exempt_override: isExempt ? overrideExempt : false,
        },
      });

      toast.success("Cobrança manual criada como pendente.");
      resetAndClose();
    } catch (error) {
      console.error("Falha ao criar cobrança manual:", error);
      toast.error("Não foi possível criar a cobrança manual.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto rounded-[28px] border-zinc-200 bg-white p-0 shadow-2xl dark:border-white/10 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-6 py-5 dark:border-white/10">
          <DialogTitle className="text-xl font-black tracking-tight text-zinc-950 dark:text-white">Nova cobrança manual</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Registro gerencial em aberto. Não gera cobrança bancária NeuroFinance nem movimentação em conta.
          </DialogDescription>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Paciente</Label>
              <Select value={patientId || "none"} onValueChange={(value) => setPatientId(value === "none" ? "" : value)}>
                <SelectTrigger className="h-12 rounded-[14px]">
                  <SelectValue placeholder="Selecione um paciente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem paciente vinculado</SelectItem>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input value={description} onChange={(event) => setDescription(event.target.value)} className="h-12 rounded-[14px]" />
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" className="h-12 rounded-[14px]" />
              </div>
              <div className="space-y-2">
                <Label>Vencimento</Label>
                <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="h-12 rounded-[14px]" />
              </div>
              <div className="space-y-2">
                <Label>Método previsto</Label>
                <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as FinancialEntryPaymentMethod)}>
                  <SelectTrigger className="h-12 rounded-[14px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method.id} value={method.id}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {activePackages.data?.length ? (
              <div className="space-y-2">
                <Label>Vincular pacote ativo</Label>
                <Select value={packageId || "none"} onValueChange={(value) => setPackageId(value === "none" ? "" : value)}>
                  <SelectTrigger className="h-12 rounded-[14px]">
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não vincular pacote</SelectItem>
                    {activePackages.data.map((item) => {
                      const remaining = Math.max(0, item.total_sessions - item.sessions_used);
                      const valuePerSession = item.price && item.total_sessions > 0 ? Number(item.price) / item.total_sessions : 0;
                      return (
                        <SelectItem key={item.id} value={item.id}>
                          {item.description || item.name || "Pacote"} - {remaining} restantes - {currency(valuePerSession)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {isExempt ? (
              <label className="flex items-start gap-3 rounded-[18px] border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100">
                <Checkbox checked={overrideExempt} onCheckedChange={(checked) => setOverrideExempt(Boolean(checked))} />
                <span>Este paciente está marcado como isento. Confirmo que quero criar uma cobrança manual mesmo assim.</span>
              </label>
            ) : null}

            <div className="space-y-2">
              <Label>Observacoes internas</Label>
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-24 rounded-[14px]" />
            </div>
          </div>

          <aside className="space-y-3">
            <div className="rounded-[22px] border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/[0.035]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
                  <UserRound className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-zinc-950 dark:text-white">{selectedPatient?.name || "Contexto do paciente"}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {recordDetails.isLoading || activePackages.isLoading ? "Carregando contexto..." : "Dados financeiros cadastrados"}
                  </p>
                </div>
              </div>
            </div>

            {contextCards.map((card) => (
              <div
                key={`${card.label}-${card.value}`}
                className={cn(
                  "rounded-[20px] border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.025]",
                  card.tone === "warning" && "border-amber-200 bg-amber-50 dark:border-amber-300/20 dark:bg-amber-300/10",
                  card.tone === "success" && "border-emerald-200 bg-emerald-50 dark:border-emerald-300/20 dark:bg-emerald-300/10",
                )}
              >
                <div className="flex items-start gap-3">
                  <card.icon className="mt-0.5 h-4 w-4 text-zinc-500 dark:text-zinc-300" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">{card.label}</p>
                    <p className="mt-1 text-sm font-bold text-zinc-900 dark:text-white">{card.value}</p>
                  </div>
                </div>
              </div>
            ))}

            {!patientId ? (
              <div className="rounded-[20px] border border-dashed border-zinc-200 p-4 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                Selecione um paciente para preencher defaults de convenio, pacote, mensalidade ou sessao avulsa.
              </div>
            ) : null}

            {isExempt ? (
              <div className="flex gap-3 rounded-[20px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p>Há uma isenção financeira ativa. O override fica registrado nos metadados da cobrança.</p>
              </div>
            ) : null}
          </aside>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-6 py-5 dark:border-white/10">
          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            Salva em financial_entries com status pendente.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={resetAndClose} className="rounded-[14px]">
              Cancelar
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={createEntry.isPending} className="rounded-[14px] bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
              {createEntry.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Criar cobrança
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
