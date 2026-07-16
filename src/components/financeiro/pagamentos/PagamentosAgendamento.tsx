import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  FileUp,
  Landmark,
  Loader2,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { BillPaymentPinDialog } from "@/components/financeiro/pagamentos/BillPaymentPinDialog";
import { BillPaymentProcessing } from "@/components/financeiro/pagamentos/BillPaymentProcessing";
import { BillPaymentReviewCard } from "@/components/financeiro/pagamentos/BillPaymentReviewCard";
import { BillPaymentSuccess } from "@/components/financeiro/pagamentos/BillPaymentSuccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBoletoReader } from "@/hooks/use-boleto-reader";
import {
  type BillConsultation,
  type BillExecutionResponse,
  type BillPaymentMode,
  type BillPaymentRecord,
  useNeurofinanceBillPayments,
} from "@/hooks/use-neurofinance-bill-payments";
import { formatBoletoValue, normalizeBoletoInput } from "@/lib/boleto";
import { cn, formatCurrency } from "@/lib/utils";
import { EdgeFunctionInvocationError } from "@/lib/invoke-edge-function";

type BillStep = "input" | "review" | "processing" | "success";

function billStatusLabel(value?: string | null) {
  const status = String(value || "").toLowerCase();
  if (["paid", "completed", "processed"].includes(status)) return "Pago";
  if (["scheduled"].includes(status)) return "Agendado";
  if (["processing", "submitting", "submission_unknown"].includes(status)) return "Em processamento";
  if (["cancelled", "canceled", "refunded"].includes(status)) return "Cancelado";
  if (["failed", "error"].includes(status)) return "Não concluído";
  return "Em acompanhamento";
}

export function PagamentosAgendamento() {
  const shouldReduceMotion = useReducedMotion();
  const [step, setStep] = useState<BillStep>("input");
  const [input, setInput] = useState("");
  const [dragging, setDragging] = useState(false);
  const [consultation, setConsultation] = useState<BillConsultation | null>(null);
  const [execution, setExecution] = useState<BillExecutionResponse | null>(null);
  const [decision, setDecision] = useState<{
    paymentMode: BillPaymentMode;
    scheduleDate?: string | null;
  } | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const { readFile, isReading } = useBoletoReader();
  const { consult, authorize, execute, list } = useNeurofinanceBillPayments();
  const normalized = useMemo(() => normalizeBoletoInput(input), [input]);

  const resetFlow = () => {
    setStep("input");
    setInput("");
    setConsultation(null);
    setExecution(null);
    setDecision(null);
    setPinOpen(false);
    setPinError(null);
    consult.reset();
    authorize.reset();
    execute.reset();
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    const value = await readFile(file);
    if (!value) {
      toast.info("Não encontramos a numeração automaticamente. Você pode digitar a linha do boleto.");
      return;
    }
    setInput(value);
    toast.success("Numeração encontrada. Agora consulte os dados do boleto.");
  };

  const handleConsult = async () => {
    if (!normalized.isValid) {
      toast.error("Informe uma linha digitável ou código de barras válido.");
      return;
    }

    try {
      const response = await consult.mutateAsync({ input });
      setConsultation(response.consultation);
      setStep("review");
    } catch {
      // The hook presents the server's friendly validation message.
    }
  };

  const handlePinConfirm = async (pin: string) => {
    if (!consultation || !decision) return;
    setPinError(null);
    let wasAuthorized = false;

    try {
      await authorize.mutateAsync({
        consultationId: consultation.id,
        pin,
        paymentMode: decision.paymentMode,
        scheduleDate: decision.scheduleDate,
      });
      wasAuthorized = true;
      setPinOpen(false);
      setStep("processing");

      const result = await execute.mutateAsync(consultation.id);

      setExecution(result);
      setStep("success");
      toast.success(
        result.record.payment_mode === "scheduled" || result.status === "scheduled"
          ? "Pagamento agendado com sucesso."
          : result.status === "paid"
            ? "Pagamento confirmado."
            : "Pagamento enviado para processamento.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível autorizar o pagamento.";
      if (!wasAuthorized) {
        setPinError(message);
        return;
      }

      if (error instanceof EdgeFunctionInvocationError && error.code === "BILL_REVIEW_REQUIRED") {
        try {
          const refreshed = await consult.mutateAsync({ input });
          setConsultation(refreshed.consultation);
          setExecution(null);
          setDecision(null);
          setStep("review");
          return;
        } catch {
          // The consultation hook already provides safe feedback.
        }
      }

      setStep("input");
      setConsultation(null);
      setExecution(null);
      setDecision(null);
    }
  };

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
            {step === "input" && (
              <motion.div
                key="input"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
                className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]"
              >
                <section className="rounded-[28px] border border-zinc-200/70 bg-white/72 p-6 shadow-[0_24px_70px_-55px_rgba(0,0,0,0.35)] backdrop-blur-3xl dark:border-white/[0.08] dark:bg-[#0b0b0d]/76">
                  <div className="mb-6">
                    <p className="text-[9px] font-black uppercase tracking-[0.24em] text-zinc-400">Etapa 1 de 2</p>
                    <h3 className="mt-2 text-lg font-black text-zinc-950 dark:text-white">Consulte o boleto antes de pagar</h3>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      Arraste o arquivo, anexe um PDF/imagem ou digite a linha do boleto.
                    </p>
                  </div>

                  <label
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragging(false);
                      handleFile(event.dataTransfer.files?.[0]);
                    }}
                    className={cn(
                      "flex min-h-[170px] cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed p-8 text-center transition-all",
                      dragging
                        ? "border-zinc-950 bg-zinc-950/[0.03] dark:border-white dark:bg-white/[0.06]"
                        : "border-zinc-300 bg-zinc-50/70 hover:bg-zinc-100/70 dark:border-white/12 dark:bg-white/[0.025] dark:hover:bg-white/[0.045]",
                    )}
                  >
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(event) => handleFile(event.target.files?.[0])}
                    />
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[18px] bg-white text-zinc-950 shadow-sm dark:bg-white/[0.08] dark:text-white">
                      {isReading ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileUp className="h-6 w-6" />}
                    </div>
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">
                      {isReading ? "Lendo arquivo..." : "Adicionar ou arrastar boleto"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Imagem nítida ou PDF com a linha digitável.</p>
                  </label>

                  <div className="mt-5 space-y-3">
                    <Input
                      value={formatBoletoValue(input)}
                      onChange={(event) => setInput(event.target.value)}
                      placeholder="Digite aqui a linha digitável"
                      className="h-13 rounded-[18px] border-zinc-200 bg-white/80 px-5 text-sm dark:border-white/10 dark:bg-white/[0.04]"
                    />
                    <Button
                      type="button"
                      onClick={handleConsult}
                      disabled={!normalized.isValid || consult.isPending}
                      className="h-12 w-full rounded-[16px] bg-zinc-950 text-[10px] font-black uppercase tracking-[0.16em] text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950"
                    >
                      {consult.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ReceiptText className="mr-2 h-4 w-4" />}
                      Consultar e escolher pagamento
                    </Button>
                  </div>
                </section>

                <aside className="rounded-[28px] border border-zinc-200/70 bg-white/72 p-6 shadow-sm backdrop-blur-3xl dark:border-white/[0.08] dark:bg-white/[0.035]">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Pagamento protegido</p>
                  <div className="mt-6 space-y-3">
                    {[
                      { icon: Landmark, title: "Consulta bancária", text: "Conferimos beneficiário, instituição, valor e vencimento." },
                      { icon: LockKeyhole, title: "Confirmação por PIN", text: "O boleto só será enviado após sua assinatura digital." },
                      { icon: ShieldCheck, title: "Dados congelados", text: "A efetivação usa exatamente os dados que você revisou." },
                    ].map((item, index) => (
                      <div key={item.title} className="flex gap-4 rounded-[20px] border border-zinc-200/60 bg-zinc-50/65 p-4 dark:border-white/[0.06] dark:bg-black/20">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-white text-zinc-700 shadow-sm dark:bg-white/[0.06] dark:text-zinc-200">
                          <item.icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[8px] font-black uppercase tracking-[0.18em] text-zinc-400">0{index + 1}</p>
                          <p className="mt-1 text-xs font-black text-zinc-950 dark:text-white">{item.title}</p>
                          <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">{item.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </aside>
              </motion.div>
            )}

            {step === "review" && consultation && (
              <motion.div key="review" initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}>
                <BillPaymentReviewCard
                  consultation={consultation}
                  onBack={() => {
                    setStep("input");
                    setConsultation(null);
                    setDecision(null);
                  }}
                  onConfirm={(nextDecision) => {
                    setDecision(nextDecision);
                    setPinError(null);
                    setPinOpen(true);
                  }}
                />
              </motion.div>
            )}

            {step === "processing" && (
              <motion.div key="processing" initial={shouldReduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={shouldReduceMotion ? undefined : { opacity: 0 }}>
                <BillPaymentProcessing />
              </motion.div>
            )}

            {step === "success" && consultation && execution && (
              <motion.div key="success" initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
                <BillPaymentSuccess consultation={consultation} execution={execution} onNewPayment={resetFlow} />
              </motion.div>
            )}
      </AnimatePresence>

      {consultation && (
        <BillPaymentPinDialog
          open={pinOpen}
          onOpenChange={(open) => {
            setPinOpen(open);
            if (!open) setPinError(null);
          }}
          onConfirm={handlePinConfirm}
          beneficiaryName={consultation.beneficiaryName}
          value={consultation.value}
          paymentMode={decision?.paymentMode}
          isLoading={authorize.isPending}
          errorMessage={pinError}
        />
      )}

      {step !== "processing" && list.data?.length ? (
        <div className="rounded-[24px] border border-zinc-200/70 bg-white/50 p-5 dark:border-white/10 dark:bg-white/[0.025]">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Últimos boletos</p>
          <div className="space-y-2">
            {list.data.slice(0, 4).map((item: BillPaymentRecord) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between gap-4 rounded-[18px] bg-white/75 px-4 py-3 text-sm dark:bg-white/[0.04]"
              >
                <div className="min-w-0">
                  <span className="block truncate font-bold text-zinc-900 dark:text-white">{item.beneficiary_name || "Boleto registrado"}</span>
                  <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                    {formatCurrency(Number(item.amount || 0) / 100)}
                  </span>
                </div>
                <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-[8px] font-black uppercase tracking-wider text-zinc-500 dark:bg-white/5">
                  {billStatusLabel(item.status)}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
