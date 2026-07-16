import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, KeyRound, Landmark, Loader2, LockKeyhole, ShieldCheck, UserRound, Wallet } from "lucide-react";
import { toast } from "sonner";

import { SecureOperationPinDialog } from "@/components/financeiro/secure/SecureOperationPinDialog";
import { SecureOperationProcessing } from "@/components/financeiro/secure/SecureOperationProcessing";
import { SecureOperationSuccess } from "@/components/financeiro/secure/SecureOperationSuccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNeuroFinanceBalance } from "@/hooks/use-neurofinance-balance";
import { type PayoutConsultation, type PayoutExecution, type RequestPayoutParams, usePayoutDestinations, useSecurePayout } from "@/hooks/use-neurofinance-payouts";
import { formatMoneyInput, moneyInputToCents } from "@/lib/financial-input";
import { cn, formatCurrency } from "@/lib/utils";

type DestinationMode = "saved_bank" | "saved_pix";
type PayoutStep = "setup" | "review" | "processing" | "success";

function maskDocument(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11) return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
  if (digits.length === 14) return `**.${digits.slice(2, 5)}.${digits.slice(5, 8)}/****-${digits.slice(-2)}`;
  return value || "Não informado";
}

export const BankTransferView = () => {
  const shouldReduceMotion = Boolean(useReducedMotion());
  const { data: balanceData } = useNeuroFinanceBalance();
  const { consult, authorize, execute, receipt } = useSecurePayout();
  const { data: payoutDestinations, isLoading: isLoadingDestinations } = usePayoutDestinations("payout");
  const [step, setStep] = useState<PayoutStep>("setup");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<DestinationMode>("saved_bank");
  const [consultation, setConsultation] = useState<PayoutConsultation | null>(null);
  const [execution, setExecution] = useState<PayoutExecution | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const balance = balanceData?.balance || 0;
  const savedBankDestination = useMemo<RequestPayoutParams["destination"] | null>(() =>
    payoutDestinations?.bank
      ? { type: "saved_bank", summary: payoutDestinations.bank.summary }
      : null, [payoutDestinations?.bank]);
  const firstSavedPix = payoutDestinations?.pix[0] || null;
  const savedPixDestination = useMemo<RequestPayoutParams["destination"] | null>(() =>
    firstSavedPix
      ? { type: "saved_pix", recipient_id: firstSavedPix.id, summary: firstSavedPix.summary }
      : null, [firstSavedPix]);
  const amountInCents = moneyInputToCents(amount);
  const selectedDestination: RequestPayoutParams["destination"] | null = mode === "saved_bank" ? savedBankDestination : savedPixDestination;
  const canContinue = amountInCents > 0 && Boolean(selectedDestination);

  useEffect(() => {
    if (isLoadingDestinations) return;
    if (savedBankDestination) setMode("saved_bank");
    else if (savedPixDestination) setMode("saved_pix");
  }, [isLoadingDestinations, savedBankDestination, savedPixDestination]);

  const reset = () => { setStep("setup"); setAmount(""); setConsultation(null); setExecution(null); setPinOpen(false); setPinError(null); consult.reset(); authorize.reset(); execute.reset(); };

  const handleConsult = async () => {
    if (!selectedDestination || amountInCents <= 0) return toast.error("Confira o valor e o destino do saque.");
    try { const response = await consult.mutateAsync({ amount: amountInCents, destination: selectedDestination }); setConsultation(response.consultation); setStep("review"); } catch { /* hook handles errors */ }
  };

  const handlePinConfirm = async (pin: string) => {
    if (!consultation) return;
    setPinError(null);
    let authorized = false;
    try {
      const authorization = await authorize.mutateAsync({ requestId: consultation.id, pin });
      authorized = true;
      setConsultation(authorization.consultation);
      setPinOpen(false);
      setStep("processing");
      const result = await execute.mutateAsync(consultation.id);
      setExecution(result);
      setStep("success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível autorizar o saque.";
      if (!authorized) { setPinError(message); return; }
      setStep("review");
    }
  };

  const destination = consultation?.destination || {};

  return (
    <div className="mx-auto max-w-4xl py-4">
      <AnimatePresence mode="wait">
        {step === "setup" && (
          <motion.div key="setup" initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={shouldReduceMotion ? undefined : { opacity: 0, y: -10 }} className="mx-auto max-w-xl space-y-8">
            <div className="space-y-2 text-center"><h3 className="text-2xl font-black uppercase tracking-tight">Sacar fundos</h3><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Saldo exibido: {formatCurrency(balance)} · Confirmaremos novamente na revisão</p></div>
            <div className="space-y-6">
              <div className="space-y-3"><Label className="ml-1 text-[10px] font-black uppercase tracking-widest">Quanto deseja sacar?</Label><div className="relative"><span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-light text-zinc-300">R$</span><Input inputMode="decimal" value={amount} onChange={(event) => setAmount(formatMoneyInput(event.target.value))} className="h-20 rounded-[24px] border-zinc-200 bg-zinc-50 pl-16 pr-6 text-4xl font-black dark:border-white/10 dark:bg-white/[0.02]" placeholder="0,00" /></div></div>
              <div className="grid grid-cols-2 gap-2 rounded-[24px] border border-zinc-200/70 bg-white/60 p-1.5 dark:border-white/10 dark:bg-white/[0.02]">
                {[{ id: "saved_bank" as const, label: "Conta cadastrada", icon: Landmark, disabled: !savedBankDestination }, { id: "saved_pix" as const, label: "Pix cadastrado", icon: KeyRound, disabled: !savedPixDestination }].map((item) => <button key={item.id} type="button" aria-pressed={mode === item.id} disabled={item.disabled} onClick={() => setMode(item.id)} className={cn("flex h-12 items-center justify-center gap-2 rounded-[18px] text-[9px] font-black uppercase tracking-[0.12em] transition-all disabled:opacity-35", mode === item.id ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/[0.06]")}><item.icon className="h-4 w-4" /> {item.label}</button>)}
              </div>
              {mode === "saved_bank" ? savedBankDestination ? <DestinationCard icon={Landmark} title={payoutDestinations?.bank?.holderName || "Conta cadastrada"} detail={`${payoutDestinations?.bank?.bankName || "Banco"} · Ag ${payoutDestinations?.bank?.agency || "—"} · final ${payoutDestinations?.bank?.accountLast4 || "—"}`} /> : <Warning text="Cadastre uma conta bancária em Conta e saldo para selecioná-la aqui." /> : savedPixDestination ? <DestinationCard icon={KeyRound} title={firstSavedPix?.label || "Pix cadastrado"} detail={`${firstSavedPix?.maskedKey || "Chave protegida"} · ${firstSavedPix?.bankName || "Rede Pix"}`} /> : <Warning text="Cadastre uma chave Pix de saque em Conta e saldo para selecioná-la aqui." />}
            </div>
            <Button onClick={handleConsult} disabled={!canContinue || consult.isPending} className="h-16 w-full rounded-[24px] bg-zinc-900 text-[10px] font-black uppercase tracking-[0.2em] text-white dark:bg-white dark:text-black">{consult.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Consultar e revisar <ArrowRight className="ml-2 h-4 w-4" /></>}</Button>
          </motion.div>
        )}

        {step === "review" && consultation && <motion.section key="review" initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }} className="finance-panel overflow-hidden rounded-[32px] border border-zinc-200/70 bg-white/75 dark:border-black/75 dark:bg-[#09090b]/80"><div className="border-b border-zinc-100 p-7 dark:border-black/70"><p className="text-[9px] font-black uppercase tracking-[0.25em] text-emerald-600 dark:text-emerald-400">Destino validado</p><h3 className="mt-2 text-xl font-black">Confira antes de sacar</h3><p className="mt-1 text-xs text-zinc-500">{consultation.kind === "payout_pix" ? "A chave foi consultada antes do envio." : "Os dados abaixo são da conta bancária cadastrada no NeuroFinance."}</p></div><div className="p-7"><div className="finance-kpi rounded-[26px] bg-white p-6 text-zinc-950"><p className="text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-500">Valor do saque:</p><p className="mt-3 text-5xl font-black tracking-[-0.05em]">{formatCurrency(consultation.amount)}</p></div><div className="mt-6 grid gap-3 md:grid-cols-3">{[{ icon: UserRound, label: "Titular", value: String(destination.holder_name || "Não informado"), detail: maskDocument(String(destination.holder_document || "")) }, { icon: Landmark, label: "Instituição", value: String(destination.bank_name || "Banco cadastrado"), detail: consultation.kind === "payout_pix" ? "Chave Pix validada" : "Conta cadastrada pelo titular" }, { icon: Wallet, label: "Saldo confirmado", value: consultation.availableBalance == null ? "Indisponível" : formatCurrency(consultation.availableBalance), detail: "Consultado ao abrir esta revisão" }].map((item) => <div key={item.label} className="finance-inset flex items-center gap-4 rounded-[22px] border border-zinc-200/70 bg-zinc-50/70 p-4 dark:border-black/70 dark:bg-black/[0.24]"><div className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-white dark:bg-zinc-900"><item.icon className="h-4 w-4" /></div><div className="min-w-0"><p className="text-[8px] font-black uppercase tracking-widest text-zinc-400">{item.label}</p><p className="mt-1 truncate text-sm font-black">{item.value}</p><p className="mt-0.5 text-[10px] text-zinc-500">{item.detail}</p></div></div>)}</div><div className="finance-inset mt-5 flex items-center gap-2 rounded-[18px] border border-border/55 bg-muted/35 px-4 py-3 text-[10px] font-bold text-muted-foreground"><ShieldCheck className="h-4 w-4 text-foreground" /> O saque só será enviado depois da confirmação com seu PIN financeiro.</div><div className="mt-6 grid gap-3 sm:grid-cols-[0.75fr_1.25fr]"><Button variant="ghost" onClick={() => { setStep("setup"); setConsultation(null); }} className="h-13 rounded-[18px] text-[10px] font-black uppercase tracking-widest">Corrigir dados</Button><Button onClick={() => { setPinError(null); setPinOpen(true); }} className="h-13 rounded-[18px] bg-zinc-950 text-[10px] font-black uppercase tracking-widest text-white dark:bg-white dark:text-zinc-950"><LockKeyhole className="mr-2 h-4 w-4" /> Confirmar saque</Button></div></div></motion.section>}
        {step === "processing" && <motion.div key="processing" initial={shouldReduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }}><SecureOperationProcessing /></motion.div>}
        {step === "success" && consultation && execution && <motion.div key="success" initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}><SecureOperationSuccess title={execution.status === "paid" ? "Saque confirmado" : "Saque enviado com segurança"} description={execution.status === "paid" ? "A instituição confirmou a transferência." : "A solicitação acompanha a confirmação bancária."} amount={consultation.amount} recipient={consultation.destinationSummary} status={execution.status} receiptUrl={execution.receiptUrl} newActionLabel="Fazer outro saque" onNewAction={reset} onRefreshReceipt={async () => (await receipt.mutateAsync(consultation.id)).receiptUrl} /></motion.div>}
      </AnimatePresence>
      {consultation && <SecureOperationPinDialog open={pinOpen} onOpenChange={(open) => { setPinOpen(open); if (!open) setPinError(null); }} onConfirm={handlePinConfirm} recipient={consultation.destinationSummary} value={consultation.amount} actionLabel="o saque" isLoading={authorize.isPending} errorMessage={pinError} />}
    </div>
  );
};

function DestinationCard({ icon: Icon, title, detail }: { icon: any; title: string; detail: string }) { return <div className="flex w-full items-center justify-between rounded-2xl bg-zinc-950 p-4 text-left text-white dark:bg-white dark:text-black"><div className="flex min-w-0 items-center gap-4"><Icon className="h-5 w-5 shrink-0" /><div className="min-w-0"><p className="truncate text-[11px] font-black uppercase">{title}</p><p className="truncate text-[9px] opacity-65">{detail}</p></div></div><Check className="h-4 w-4" /></div>; }
function Warning({ text }: { text: string }) { return <div className="finance-inset rounded-2xl border border-border/60 bg-muted/35 p-4 text-center text-xs font-semibold text-muted-foreground">{text}</div>; }
