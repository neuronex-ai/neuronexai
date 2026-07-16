import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, KeyRound, Landmark, Loader2, LockKeyhole, ShieldCheck, UserRound, Wallet } from "lucide-react";
import { toast } from "sonner";

import { SecureOperationPinDialog } from "@/components/financeiro/secure/SecureOperationPinDialog";
import { SecureOperationProcessing } from "@/components/financeiro/secure/SecureOperationProcessing";
import { SecureOperationSuccess } from "@/components/financeiro/secure/SecureOperationSuccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { type PayoutConsultation, type PayoutExecution, usePayoutDestinations, useSecurePayout } from "@/hooks/use-neurofinance-payouts";
import { formatDocumentInput, formatMoneyInput, formatPixKeyInput, moneyInputToCents, normalizePixKeyInput, type PixKeyInputType } from "@/lib/financial-input";
import { cn, formatCurrency } from "@/lib/utils";

type TransferStep = "setup" | "review" | "processing" | "success";
type KeyType = Exclude<PixKeyInputType, "auto">;
const keyTypes: Array<{ id: KeyType; label: string }> = [
  { id: "cpf", label: "CPF" },
  { id: "cnpj", label: "CNPJ" },
  { id: "email", label: "E-mail" },
  { id: "telefone", label: "Telefone" },
  { id: "evp", label: "Aleatória" },
];

export function PixTransferir() {
  const shouldReduceMotion = Boolean(useReducedMotion());
  const { consult, authorize, execute, receipt } = useSecurePayout();
  const { data: savedDestinations } = usePayoutDestinations("transfer");
  const [step, setStep] = useState<TransferStep>("setup");
  const [keyType, setKeyType] = useState<KeyType>("cpf");
  const [pixKey, setPixKey] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [consultation, setConsultation] = useState<PayoutConsultation | null>(null);
  const [execution, setExecution] = useState<PayoutExecution | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [saveRecipient, setSaveRecipient] = useState(false);
  const amountInCents = moneyInputToCents(amount);
  const destination = consultation?.destination || {};

  const reset = () => {
    setStep("setup"); setPixKey(""); setAmount(""); setDescription(""); setConsultation(null); setExecution(null); setPinOpen(false); setPinError(null); setSelectedRecipientId(null); setSaveRecipient(false);
    consult.reset(); authorize.reset(); execute.reset();
  };

  const handleConsult = async () => {
    const normalizedKey = normalizePixKeyInput(pixKey, keyType);
    if ((!normalizedKey && !selectedRecipientId) || amountInCents <= 0) return toast.error("Confira a chave Pix e o valor da transferência.");
    try {
      const response = await consult.mutateAsync({
        purpose: "transfer",
        amount: amountInCents,
        description: description.trim() || undefined,
        destination: selectedRecipientId
          ? { type: "saved_pix", recipient_id: selectedRecipientId }
          : { type: "pix_key", pix_key: normalizedKey, summary: normalizedKey },
      });
      setConsultation(response.consultation); setStep("review");
    } catch { /* mensagem apresentada pelo hook */ }
  };

  const handlePinConfirm = async (pin: string) => {
    if (!consultation) return;
    setPinError(null);
    let authorized = false;
    try {
      const authorization = await authorize.mutateAsync({ requestId: consultation.id, pin, saveRecipient });
      authorized = true; setConsultation(authorization.consultation); setPinOpen(false); setStep("processing");
      const result = await execute.mutateAsync(consultation.id);
      setExecution(result); setStep("success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível autorizar esta transferência.";
      if (!authorized) return setPinError(message);
      setStep("review");
    }
  };

  return (
    <div className="mx-auto max-w-4xl py-1 sm:py-4">
      <AnimatePresence mode="wait">
        {step === "setup" && (
          <motion.div key="setup" initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={shouldReduceMotion ? undefined : { opacity: 0, y: -10 }} className="mx-auto max-w-2xl space-y-5 sm:space-y-7">
            <section className="rounded-[26px] border border-zinc-200/70 bg-white/70 p-5 dark:border-white/[0.08] dark:bg-white/[0.025] sm:rounded-[30px] sm:p-7">
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-400">Transferência protegida</p>
              <h3 className="mt-2 text-xl font-black sm:text-2xl">Consulte o destino antes de transferir</h3>
              <p className="mt-2 text-sm text-zinc-500">Confirmaremos titular, documento e instituição na rede Pix antes de solicitar seu PIN.</p>
              {savedDestinations?.pix.length ? (
                <div className="mt-6 space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Destinatários salvos</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {savedDestinations.pix.map((recipient) => (
                      <button
                        key={recipient.id}
                        type="button"
                        aria-pressed={selectedRecipientId === recipient.id}
                        onClick={() => {
                          setSelectedRecipientId((current) => current === recipient.id ? null : recipient.id);
                          setPixKey("");
                        }}
                        className={cn(
                          "rounded-[16px] border px-4 py-3 text-left transition-colors",
                          selectedRecipientId === recipient.id
                            ? "border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950"
                            : "border-zinc-200/70 bg-white/60 text-zinc-700 hover:bg-white dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-zinc-200 dark:hover:bg-white/[0.06]",
                        )}
                      >
                        <span className="block truncate text-xs font-black">{recipient.label}</span>
                        <span className="mt-1 block truncate text-[10px] opacity-65">{recipient.maskedKey} · {recipient.bankName || "Rede Pix"}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mt-6 grid grid-cols-2 gap-2 sm:mt-7 sm:grid-cols-5">
                {keyTypes.map((item) => <button key={item.id} type="button" aria-pressed={keyType === item.id && !selectedRecipientId} onClick={() => { setKeyType(item.id); setPixKey(""); setSelectedRecipientId(null); }} className={cn("h-11 rounded-xl text-[9px] font-black uppercase tracking-wider transition", keyType === item.id && !selectedRecipientId ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950" : "bg-zinc-100 text-zinc-500 dark:bg-white/5")}>{item.label}</button>)}
              </div>
              <div className="relative mt-4"><KeyRound className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" /><Input value={pixKey} onChange={(event) => { setPixKey(formatPixKeyInput(event.target.value, keyType)); setSelectedRecipientId(null); }} placeholder={selectedRecipientId ? "Destinatário salvo selecionado" : "Chave Pix do destinatário"} disabled={Boolean(selectedRecipientId)} className="h-14 rounded-[20px] pl-11 text-sm font-bold dark:border-white/10 dark:bg-white/[0.035]" /></div>
              <div className="relative mt-4"><span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl font-light text-zinc-400">R$</span><Input inputMode="decimal" value={amount} onChange={(event) => setAmount(formatMoneyInput(event.target.value))} placeholder="0,00" className="h-16 rounded-[20px] pl-14 text-3xl font-black dark:border-white/10 dark:bg-white/[0.035]" /></div>
              <Input value={description} maxLength={140} onChange={(event) => setDescription(event.target.value)} placeholder="Descrição opcional" className="mt-4 h-13 rounded-[18px] dark:border-white/10 dark:bg-white/[0.035]" />
              <Button onClick={handleConsult} disabled={(!pixKey && !selectedRecipientId) || amountInCents <= 0 || consult.isPending} className="mt-6 h-14 w-full rounded-[20px] bg-zinc-950 text-[10px] font-black uppercase tracking-[0.18em] text-white dark:bg-white dark:text-zinc-950 sm:h-15 sm:rounded-[22px]">
                {consult.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Consultar e revisar <ArrowRight className="ml-2 h-4 w-4" /></>}
              </Button>
            </section>
          </motion.div>
        )}

        {step === "review" && consultation && (
          <motion.section key="review" initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }} className="finance-panel overflow-hidden rounded-[28px] border border-zinc-200/70 bg-white/75 dark:border-black/75 dark:bg-[#09090b]/80 sm:rounded-[32px]">
            <div className="border-b border-zinc-100 p-5 dark:border-white/5 sm:p-7"><p className="text-[9px] font-black uppercase tracking-[0.25em] text-emerald-600 dark:text-emerald-400">Destino Pix validado</p><h3 className="mt-2 text-xl font-black">Confira antes de transferir</h3><p className="mt-1 text-xs text-zinc-500">A NeuroFinance confirmou os dados do destinatário na rede Pix.</p></div>
            <div className="p-5 sm:p-7">
              <div className="finance-kpi rounded-[24px] bg-white p-5 text-zinc-950 sm:rounded-[26px] sm:p-6"><p className="text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-500">Valor da transferência:</p><p className="mt-3 text-3xl font-black tracking-[-0.05em] sm:text-5xl">{formatCurrency(consultation.amount)}</p></div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">{[
                { icon: UserRound, label: "Titular", value: String(destination.holder_name || "Não informado"), detail: formatDocumentInput(String(destination.holder_document || "")) || "Documento não informado" },
                { icon: Landmark, label: "Instituição", value: String(destination.bank_name || "Instituição Pix"), detail: "Dados confirmados na rede Pix" },
                { icon: Wallet, label: "Saldo confirmado", value: consultation.availableBalance == null ? "Indisponível" : formatCurrency(consultation.availableBalance), detail: "Consultado nesta revisão" },
              ].map((item) => <div key={item.label} className="flex items-center gap-4 rounded-[22px] border border-zinc-200/70 bg-zinc-50/70 p-4 dark:border-white/[0.07] dark:bg-white/[0.025]"><div className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-white dark:bg-white/[0.06]"><item.icon className="h-4 w-4" /></div><div className="min-w-0"><p className="text-[8px] font-black uppercase tracking-widest text-zinc-400">{item.label}</p><p className="mt-1 truncate text-sm font-black">{item.value}</p><p className="mt-0.5 text-[10px] text-zinc-500">{item.detail}</p></div></div>)}</div>
              <div className="finance-inset mt-5 flex items-center gap-2 rounded-[18px] border border-border/55 bg-muted/35 px-4 py-3 text-[10px] font-bold text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0 text-foreground" /> A transferência só será enviada depois da confirmação com seu PIN financeiro.</div>
              {!selectedRecipientId ? (
                <label className="mt-4 flex cursor-pointer items-center justify-between gap-4 rounded-[18px] border border-zinc-200/70 bg-zinc-50/70 px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.025]">
                  <span><span className="block text-xs font-black">Salvar este destinatário</span><span className="mt-1 block text-[10px] text-zinc-500">Será salvo após o envio ser aceito e poderá ser reutilizado em próximas transferências.</span></span>
                  <Switch checked={saveRecipient} onCheckedChange={setSaveRecipient} aria-label="Salvar destinatário Pix" />
                </label>
              ) : null}
              <div className="mt-6 grid gap-3 sm:grid-cols-[0.75fr_1.25fr]"><Button variant="ghost" onClick={() => { setStep("setup"); setConsultation(null); }} className="h-13 rounded-[18px] text-[10px] font-black uppercase tracking-widest">Corrigir dados</Button><Button onClick={() => { setPinError(null); setPinOpen(true); }} className="h-13 rounded-[18px] bg-zinc-950 text-[10px] font-black uppercase tracking-widest text-white dark:bg-white dark:text-zinc-950"><LockKeyhole className="mr-2 h-4 w-4" /> Confirmar transferência</Button></div>
            </div>
          </motion.section>
        )}

        {step === "processing" && <motion.div key="processing" initial={shouldReduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }}><SecureOperationProcessing /></motion.div>}
        {step === "success" && consultation && execution && <motion.div key="success" initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}><SecureOperationSuccess title={execution.status === "paid" ? "Transferência confirmada" : "Transferência enviada com segurança"} description={execution.status === "paid" ? "A instituição confirmou a transferência Pix." : "A solicitação acompanha a confirmação bancária."} amount={consultation.amount} recipient={consultation.destinationSummary} status={execution.status} receiptUrl={execution.receiptUrl} newActionLabel="Fazer outra transferência" onNewAction={reset} onRefreshReceipt={async () => (await receipt.mutateAsync(consultation.id)).receiptUrl} /></motion.div>}
      </AnimatePresence>

      {consultation && <SecureOperationPinDialog open={pinOpen} onOpenChange={(open) => { setPinOpen(open); if (!open) setPinError(null); }} onConfirm={handlePinConfirm} recipient={consultation.destinationSummary} value={consultation.amount} actionLabel="a transferência" isLoading={authorize.isPending} errorMessage={pinError} />}
    </div>
  );
}
