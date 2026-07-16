import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ClipboardPaste, Landmark, Loader2, LockKeyhole, QrCode, ReceiptText, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";

import { SecureOperationPinDialog } from "@/components/financeiro/secure/SecureOperationPinDialog";
import { SecureOperationProcessing } from "@/components/financeiro/secure/SecureOperationProcessing";
import { SecureOperationSuccess } from "@/components/financeiro/secure/SecureOperationSuccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type PixPaymentConsultation,
  type PixPaymentExecution,
  useNeurofinancePixPayment,
} from "@/hooks/use-neurofinance-pix-payment";
import { formatMoneyInput, moneyInputToNumber } from "@/lib/financial-input";
import { cn, formatCurrency } from "@/lib/utils";

type PixStep = "input" | "review" | "processing" | "success";

function moneyInput(value: number) {
  return value > 0 ? value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
}

function maskDocument(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11) return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
  if (digits.length === 14) return `**.${digits.slice(2, 5)}.${digits.slice(5, 8)}/****-${digits.slice(-2)}`;
  return value || "Não informado";
}

function humanizePixType(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["dynamic", "dynamic_qr", "cob", "cobv"].includes(normalized)) return "QR Code com cobrança";
  if (["static", "static_qr"].includes(normalized)) return "QR Code simples";
  return "Código Pix";
}

export function PixPagarCopiaCola() {
  const reduceMotion = Boolean(useReducedMotion());
  const [step, setStep] = useState<PixStep>("input");
  const [pixCode, setPixCode] = useState("");
  const [value, setValue] = useState("");
  const [consultation, setConsultation] = useState<PixPaymentConsultation | null>(null);
  const [execution, setExecution] = useState<PixPaymentExecution | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const { consult, authorize, execute, receipt } = useNeurofinancePixPayment();

  const selectedValue = useMemo(
    () => consultation?.canChangeValue ? moneyInputToNumber(value) : Number(consultation?.amount || 0),
    [consultation, value],
  );
  const canConfirm = Boolean(
    consultation &&
    selectedValue > 0 &&
    (consultation.availableBalance == null || consultation.availableBalance >= selectedValue),
  );

  const reset = () => {
    setStep("input");
    setPixCode("");
    setValue("");
    setConsultation(null);
    setExecution(null);
    setPinOpen(false);
    setPinError(null);
    consult.reset();
    authorize.reset();
    execute.reset();
  };

  const handlePaste = async () => {
    try {
      setPixCode(await navigator.clipboard.readText());
      toast.success("Código Pix colado.");
    } catch {
      toast.error("Não foi possível acessar a área de transferência.");
    }
  };

  const handleConsult = async () => {
    if (!pixCode.trim()) return toast.error("Cole o código Pix Copia e Cola.");
    try {
      const response = await consult.mutateAsync({ payload: pixCode.trim() });
      setConsultation(response.consultation);
      setValue(moneyInput(response.consultation.amount));
      setStep("review");
    } catch {
      // The hook shows the provider validation message.
    }
  };

  const handlePinConfirm = async (pin: string) => {
    if (!consultation) return;
    setPinError(null);
    let authorized = false;
    try {
      const authorization = await authorize.mutateAsync({ requestId: consultation.id, pin, value: selectedValue });
      authorized = true;
      setConsultation(authorization.consultation);
      setPinOpen(false);
      setStep("processing");
      const result = await execute.mutateAsync(consultation.id);
      setExecution(result);
      setStep("success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível autorizar este Pix.";
      if (!authorized) {
        setPinError(message);
        return;
      }
      setStep("review");
    }
  };

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {step === "input" && (
          <motion.div key="input" initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -8 }} className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
            <section className="rounded-[30px] border border-border/65 bg-card/80 p-6 text-card-foreground shadow-[0_30px_90px_-68px_hsl(var(--foreground)/0.55)] backdrop-blur-3xl">
              <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">Etapa 1 de 2</p>
              <h3 className="mt-2 text-lg font-black text-foreground">Consulte o Pix antes de pagar</h3>
              <p className="mt-1 text-sm text-muted-foreground">O pagamento só será enviado depois da revisão e do seu PIN.</p>
              <div className="relative mt-6">
                <textarea
                  value={pixCode}
                  onChange={(event) => setPixCode(event.target.value)}
                  placeholder="00020126580014br.gov.bcb.pix..."
                  aria-label="Código Pix Copia e Cola"
                  className="h-44 w-full resize-none rounded-[22px] border border-border/70 bg-background/58 p-5 font-mono text-sm text-foreground outline-none transition-[border-color,box-shadow,background-color] focus:border-ring focus:ring-4 focus:ring-ring/10 motion-reduce:transition-none"
                />
                <Button type="button" onClick={handlePaste} size="sm" className="absolute right-3 top-3 rounded-full">
                  <ClipboardPaste className="mr-2 h-4 w-4" /> Colar
                </Button>
              </div>
              <Button type="button" onClick={handleConsult} disabled={!pixCode.trim() || consult.isPending} className="mt-4 h-13 w-full rounded-[18px] bg-foreground text-[10px] font-black uppercase tracking-widest text-background hover:bg-foreground/90">
                {consult.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ReceiptText className="mr-2 h-4 w-4" />}
                Consultar dados do Pix
              </Button>
            </section>
            <aside className="rounded-[30px] border border-border/65 bg-card/68 p-6 text-card-foreground backdrop-blur-3xl">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">Pagamento protegido</p>
              <div className="mt-6 space-y-3">
                {[
                  { icon: QrCode, title: "Leitura do código", text: "Conferimos recebedor, instituição, valor e validade antes de continuar." },
                  { icon: LockKeyhole, title: "Confirmação por PIN", text: "O Pix só será enviado depois da sua confirmação." },
                  { icon: ShieldCheck, title: "Dados preservados", text: "O envio usa exatamente o código e o valor que você revisou." },
                ].map((item, index) => (
                  <div key={item.title} className="flex gap-4 rounded-[20px] border border-border/55 bg-background/45 p-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-foreground/[0.06] text-foreground"><item.icon className="h-4 w-4" /></div>
                    <div><p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">0{index + 1}</p><p className="mt-1 text-xs font-black text-foreground">{item.title}</p><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{item.text}</p></div>
                  </div>
                ))}
              </div>
            </aside>
          </motion.div>
        )}

        {step === "review" && consultation && (
          <motion.section key="review" initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -8 }} className="mx-auto max-w-4xl overflow-hidden rounded-[34px] border border-border/65 bg-card/82 text-card-foreground shadow-[0_36px_110px_-72px_hsl(var(--foreground)/0.62)] backdrop-blur-3xl">
            <div className="border-b border-border/55 p-7">
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-emerald-600 dark:text-emerald-400">Pix localizado</p>
              <h3 className="mt-2 text-xl font-black">Confira antes de pagar</h3>
              <p className="mt-1 text-xs text-muted-foreground">Confira os dados abaixo. Depois do PIN, o destino e o valor não poderão ser alterados.</p>
            </div>
            <div className="p-7">
              <div className="rounded-[26px] bg-foreground p-6 text-background shadow-[0_28px_70px_-44px_hsl(var(--foreground)/0.72)]">
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-background/55">Valor total</p>
                {consultation.canChangeValue ? (
                  <div className="relative mt-3">
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 text-3xl font-light text-background/55">R$</span>
                    <Input value={value} onChange={(event) => setValue(formatMoneyInput(event.target.value))} inputMode="decimal" aria-label="Valor do Pix" placeholder="0,00" className="h-16 border-0 bg-transparent pl-12 text-5xl font-black tracking-[-0.05em] text-background shadow-none placeholder:text-background/40 focus-visible:ring-0" />
                    <p className="mt-2 text-xs text-background/60">O recebedor permite definir o valor deste Pix.</p>
                  </div>
                ) : <p className="mt-3 text-5xl font-black tracking-[-0.05em]">{formatCurrency(consultation.amount)}</p>}
              </div>
              <div className="mt-6 grid gap-3 md:grid-cols-3">
                {[
                  { icon: UserRound, label: "Recebedor", value: consultation.receiverName || "Não informado", detail: maskDocument(consultation.receiverDocument) },
                  { icon: Landmark, label: "Instituição", value: consultation.institutionName || "Instituição Pix", detail: "Instituição confirmada" },
                  { icon: QrCode, label: "Tipo do Pix", value: humanizePixType(consultation.qrType), detail: consultation.description || "Pagamento instantâneo" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-4 rounded-[22px] border border-border/60 bg-background/50 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-foreground/[0.06] text-foreground"><item.icon className="h-4 w-4" /></div>
                    <div className="min-w-0"><p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">{item.label}</p><p className="mt-1 truncate text-sm font-black text-foreground">{item.value}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{item.detail}</p></div>
                  </div>
                ))}
              </div>
              <div role="status" className={cn("mt-6 rounded-[18px] border px-4 py-3 text-xs font-medium", canConfirm ? "border-border/60 bg-background/45 text-muted-foreground" : "border-destructive/20 bg-destructive/[0.06] text-destructive")}>
                Saldo disponível: {consultation.availableBalance == null ? "não informado" : formatCurrency(consultation.availableBalance)}. O Pix só será enviado após a confirmação com seu PIN.
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-[0.75fr_1.25fr]">
                <Button variant="ghost" onClick={() => { setStep("input"); setConsultation(null); }} className="h-13 rounded-[18px] text-[10px] font-black uppercase tracking-widest">Corrigir código</Button>
                <Button disabled={!canConfirm} onClick={() => { setPinError(null); setPinOpen(true); }} className="h-13 rounded-[18px] bg-foreground text-[10px] font-black uppercase tracking-widest text-background hover:bg-foreground/90">Confirmar pagamento</Button>
              </div>
            </div>
          </motion.section>
        )}

        {step === "processing" && <motion.div key="processing" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }}><SecureOperationProcessing /></motion.div>}

        {step === "success" && consultation && execution && (
          <motion.div key="success" initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
            <SecureOperationSuccess
              title={execution.status === "paid" ? "Pix confirmado" : "Pix enviado com segurança"}
              description={execution.status === "paid" ? "A instituição confirmou o pagamento Pix." : "A solicitação foi recebida e acompanha a confirmação bancária."}
              amount={consultation.amount}
              recipient={consultation.receiverName || consultation.destinationSummary}
              status={execution.status}
              receiptUrl={execution.receiptUrl}
              newActionLabel="Pagar outro Pix"
              onNewAction={reset}
              onRefreshReceipt={async () => (await receipt.mutateAsync(consultation.id)).receiptUrl}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {consultation && (
        <SecureOperationPinDialog
          open={pinOpen}
          onOpenChange={(open) => { setPinOpen(open); if (!open) setPinError(null); }}
          onConfirm={handlePinConfirm}
          recipient={consultation.receiverName}
          value={selectedValue}
          isLoading={authorize.isPending}
          errorMessage={pinError}
        />
      )}
    </div>
  );
}
