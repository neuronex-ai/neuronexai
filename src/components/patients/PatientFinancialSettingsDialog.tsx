"use client";

import { useEffect, useMemo, useState } from "react";
import { Settings2, Trash2, WalletCards } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/SessionContextProvider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePatientInsuranceAgreements, formatCentsAsBRL, parseMoneyToCents } from "@/hooks/use-patient-insurance-agreements";
import { usePatientRecordDetails } from "@/hooks/use-patient-record-details";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";

interface PatientFinancialSettingsDialogProps {
  patientId: string;
}

type FinancialPlan = "per_session" | "monthly" | "insurance" | "exempt";

const planOptions: Array<{ value: FinancialPlan; label: string }> = [
  { value: "per_session", label: "Por sessão" },
  { value: "monthly", label: "Por mês (mensalista)" },
  { value: "insurance", label: "Convênio" },
  { value: "exempt", label: "Isento" },
];

const centsToInput = (value?: number | null) =>
  ((value || 0) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const moneyInput = (value: string) => {
  const digits = value.replace(/\D/g, "");
  const cents = Number(digits || "0");
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export function PatientFinancialSettingsDialog({ patientId }: PatientFinancialSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [plan, setPlan] = useState<FinancialPlan>("per_session");
  const [sessionValue, setSessionValue] = useState("0,00");
  const [monthlyValue, setMonthlyValue] = useState("0,00");
  const [billingDay, setBillingDay] = useState("");
  const [insuranceAgreementId, setInsuranceAgreementId] = useState("");
  const [insuranceCardNumber, setInsuranceCardNumber] = useState("");
  const [insuranceExpiresAt, setInsuranceExpiresAt] = useState("");

  const { user } = useAuth();
  const { data: details, isLoading, refetch } = usePatientRecordDetails(patientId);
  const agreements = usePatientInsuranceAgreements();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const settings = details?.financial;

  const professionalName = settings?.professional_name
    || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ")
    || "Profissional";

  useEffect(() => {
    if (!open || isLoading) return;
    const current = details?.financial;
    setPlan((current?.plan_type as FinancialPlan) || "per_session");
    setSessionValue(centsToInput(current?.session_value_cents));
    setMonthlyValue(centsToInput(current?.monthly_value_cents));
    setBillingDay(current?.billing_day ? String(current.billing_day) : "");
    setInsuranceAgreementId(current?.insurance_agreement_id || "");
    setInsuranceCardNumber(current?.insurance_card_number || "");
    setInsuranceExpiresAt(current?.insurance_card_expires_at || "");
  }, [details?.financial, isLoading, open]);

  const selectedAgreement = useMemo(
    () => (agreements.data || []).find((agreement) => agreement.id === insuranceAgreementId) || null,
    [agreements.data, insuranceAgreementId],
  );

  const insuranceSessionCents = parseMoneyToCents(sessionValue);
  const calculatedRepassCents = selectedAgreement
    ? selectedAgreement.repass_type === "currency"
      ? selectedAgreement.repass_value_cents || 0
      : Math.round(insuranceSessionCents * ((selectedAgreement.repass_percentage || 0) / 100))
    : 0;

  const invalidateFinancialContext = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["patient-record-details"] }),
      queryClient.invalidateQueries({ queryKey: ["patient-financial-resolution"] }),
      queryClient.invalidateQueries({ queryKey: ["patientTransactions"] }),
      queryClient.invalidateQueries({ queryKey: ["financialEntries"] }),
    ]);
  };

  const handleSave = async () => {
    if (!user?.id) {
      toast.error("Sessão expirada. Entre novamente para salvar.");
      return;
    }

    const normalizedBillingDay = Number(billingDay);
    if (plan === "monthly" && (!Number.isInteger(normalizedBillingDay) || normalizedBillingDay < 1 || normalizedBillingDay > 31)) {
      toast.error("Informe um dia de vencimento entre 1 e 31.");
      return;
    }
    if (plan === "insurance" && !insuranceAgreementId) {
      toast.error("Selecione o convênio desta configuração.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("patient_financial_settings")
        .upsert({
          user_id: user.id,
          patient_id: patientId,
          professional_name: professionalName,
          plan_type: plan,
          session_value_cents: plan === "per_session" || plan === "insurance" ? parseMoneyToCents(sessionValue) : 0,
          monthly_value_cents: plan === "monthly" ? parseMoneyToCents(monthlyValue) : null,
          billing_day: plan === "monthly" ? normalizedBillingDay : null,
          insurance_agreement_id: plan === "insurance" ? insuranceAgreementId : null,
          insurance_card_number: plan === "insurance" ? insuranceCardNumber.trim() || null : null,
          insurance_card_expires_at: plan === "insurance" ? insuranceExpiresAt || null : null,
        }, { onConflict: "patient_id" });

      if (error) throw error;
      await invalidateFinancialContext();
      await refetch();
      toast.success("Configuração financeira atualizada.");
      setOpen(false);
    } catch (error) {
      console.error("[PatientFinancialSettingsDialog] save failed", error);
      toast.error("Não foi possível salvar a configuração financeira.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user?.id) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("patient_financial_settings")
        .delete()
        .eq("patient_id", patientId)
        .eq("user_id", user.id);

      if (error) throw error;
      await invalidateFinancialContext();
      await refetch();
      toast.success("Configuração financeira removida. O histórico financeiro foi preservado.");
      setConfirmDeleteOpen(false);
      setOpen(false);
    } catch (error) {
      console.error("[PatientFinancialSettingsDialog] delete failed", error);
      toast.error("Não foi possível remover a configuração financeira.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="patient-financial-settings-trigger desktop-retina-interactive h-11 w-11 rounded-[14px] border-border/45"
            aria-label="Configuração financeira do paciente"
            title="Configuração financeira"
          >
            <Settings2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DialogTrigger>
        <DialogContent className="patient-financial-settings-dialog desktop-retina-modal max-h-[min(760px,calc(100dvh-2rem))] overflow-hidden rounded-[30px] border-border/50 p-0 sm:max-w-[720px]">
          <DialogHeader className="border-b border-border/45 px-6 pb-5 pt-6">
            <div className="flex items-start gap-3">
              <span className="desktop-retina-inset flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] border border-border/45 text-muted-foreground">
                <WalletCards className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <DialogTitle className="text-xl font-black tracking-[-0.03em]">Configuração financeira</DialogTitle>
                <DialogDescription className="mt-1.5 leading-relaxed">
                  Consulte ou altere as regras usadas como padrão financeiro deste paciente.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="patient-record-scrollbar min-h-0 overflow-y-auto overscroll-contain px-6 py-5 [scrollbar-gutter:stable]">
            {isLoading ? (
              <div className="flex min-h-56 items-center justify-center text-sm text-muted-foreground">Carregando configuração...</div>
            ) : (
              <div className="space-y-5">
                <section className="patient-record-panel rounded-[22px] border p-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">Profissional</p>
                  <p className="mt-1.5 text-sm font-bold text-foreground">{professionalName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {settings ? "Configuração persistida para este paciente." : "Ainda não existe configuração persistida; salvar cria a primeira."}
                  </p>
                </section>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="patient-financial-plan">Plano financeiro</Label>
                    <Select value={plan} onValueChange={(value) => setPlan(value as FinancialPlan)}>
                      <SelectTrigger id="patient-financial-plan" className="h-11 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {planOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {plan === "per_session" ? (
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="patient-session-value">Valor da sessão</Label>
                      <Input id="patient-session-value" inputMode="decimal" value={sessionValue} onChange={(event) => setSessionValue(moneyInput(event.target.value))} className="h-11 rounded-xl" />
                    </div>
                  ) : null}

                  {plan === "monthly" ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="patient-monthly-value">Valor da mensalidade</Label>
                        <Input id="patient-monthly-value" inputMode="decimal" value={monthlyValue} onChange={(event) => setMonthlyValue(moneyInput(event.target.value))} className="h-11 rounded-xl" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="patient-billing-day">Dia de vencimento</Label>
                        <Input id="patient-billing-day" inputMode="numeric" min={1} max={31} value={billingDay} onChange={(event) => setBillingDay(event.target.value.replace(/\D/g, "").slice(0, 2))} className="h-11 rounded-xl" />
                      </div>
                    </>
                  ) : null}

                  {plan === "insurance" ? (
                    <>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="patient-insurance">Convênio</Label>
                        <Select value={insuranceAgreementId || "__none"} onValueChange={(value) => setInsuranceAgreementId(value === "__none" ? "" : value)}>
                          <SelectTrigger id="patient-insurance" className="h-11 rounded-xl">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">Selecione</SelectItem>
                            {(agreements.data || []).map((agreement) => <SelectItem key={agreement.id} value={agreement.id}>{agreement.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="patient-insurance-value">Valor da sessão (sem convênio)</Label>
                        <Input id="patient-insurance-value" inputMode="decimal" value={sessionValue} onChange={(event) => setSessionValue(moneyInput(event.target.value))} className="h-11 rounded-xl" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="patient-repass-value">Valor calculado do repasse</Label>
                        <Input id="patient-repass-value" disabled value={formatCentsAsBRL(calculatedRepassCents)} className="h-11 rounded-xl disabled:opacity-100" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="patient-insurance-card">Número da carteirinha</Label>
                        <Input id="patient-insurance-card" value={insuranceCardNumber} onChange={(event) => setInsuranceCardNumber(event.target.value)} className="h-11 rounded-xl" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="patient-insurance-expiry">Data de expiração</Label>
                        <Input id="patient-insurance-expiry" type="date" value={insuranceExpiresAt} onChange={(event) => setInsuranceExpiresAt(event.target.value)} className="h-11 rounded-xl" />
                      </div>
                    </>
                  ) : null}

                  {plan === "exempt" ? (
                    <div className="patient-record-panel rounded-[18px] border border-dashed p-4 text-sm text-muted-foreground sm:col-span-2">
                      O paciente ficará sem valor padrão de sessão ou mensalidade. Movimentações já registradas não serão alteradas.
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-row items-center justify-between gap-3 border-t border-border/45 px-6 py-4 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              disabled={!settings || deleting || saving}
              onClick={() => setConfirmDeleteOpen(true)}
              className="min-h-11 rounded-xl px-4 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Excluir configuração
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="min-h-11 rounded-xl px-5">Cancelar</Button>
              <Button type="button" disabled={saving || isLoading} onClick={() => void handleSave()} className="min-h-11 rounded-xl px-6">
                {saving ? "Salvando..." : "Salvar configuração"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent className="max-w-md rounded-[26px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir configuração financeira?</AlertDialogTitle>
            <AlertDialogDescription>
              Apenas a regra financeira padrão deste paciente será removida. Cobranças, transações, NFS-e e histórico já existentes serão preservados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={() => void handleDelete()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Excluindo..." : "Excluir configuração"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
