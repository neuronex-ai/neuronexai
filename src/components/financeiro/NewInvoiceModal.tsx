"use client";

import React, { useCallback, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Barcode,
  CalendarDays,
  Check,
  CircleHelp,
  Copy,
  CreditCard,
  Info,
  Loader2,
  Mail,
  QrCode,
  Share2,
  User as UserIcon,
  X,
} from "lucide-react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ResponsiveModal } from "@/components/ui/ResponsiveModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useGenerateInvoice } from "@/hooks/use-generate-invoice";
import { useNeurofinanceSimulator, type SimulatorMethod } from "@/hooks/use-neurofinance-simulator";
import { usePatients } from "@/hooks/use-patients";
import { useFinancialAccount } from "@/hooks/use-financial-account";
import { useSubscription } from "@/context/SubscriptionContext";
import { cn } from "@/lib/utils";
import { toUserFacingError } from "@/lib/user-facing-error";
import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

const NewInvoiceSchema = z.object({
  patientId: z.string().min(1, { message: "Selecione um paciente." }),
  amount: z.coerce.number().positive({ message: "O valor deve ser maior que zero." }),
  description: z.string().min(3, { message: "Descrição curta obrigatória." }),
  dueDate: z.string().min(1, { message: "Defina o vencimento da cobrança." }),
  paymentMethods: z.array(z.string()).min(1, "Selecione pelo menos um método."),
});

type NewInvoiceFormValues = z.infer<typeof NewInvoiceSchema>;

const QUICK_AMOUNTS = [150, 200, 250, 300];
const PATIENT_DECIDES_METHODS = ["pix", "card", "boleto"];

export const NewInvoiceModal = React.memo(({ children }: { children?: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "confirmation" | "success">("form");
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [boletoUrl, setBoletoUrl] = useState<string | null>(null);
  const [pixData, setPixData] = useState<{ qrCode?: string; copyPaste?: string } | undefined>();
  const [expiresAt, setExpiresAt] = useState<string | undefined>();
  const operationIdRef=useRef(crypto.randomUUID());

  const { data: patients } = usePatients();
  const { mutate: generateInvoice, isPending: isCreating } = useGenerateInvoice();
  const { simulate } = useNeurofinanceSimulator();
  const {
    account: financialAccount,
    isApproved: isFinancialAccountApproved,
    isLoading: isLoadingFinancialAccount,
  } = useFinancialAccount();
  const {
    canAccess,
    isLoading: isLoadingSubscription,
  } = useSubscription();
  const hasNeurofinanceEntitlement = canAccess("advanced_finance");
  const canGenerateCharge =
    hasNeurofinanceEntitlement
    && isFinancialAccountApproved
    && financialAccount?.charges_enabled !== false;
  const navigate = useNavigate();
  const [showPatientTooltip, setShowPatientTooltip] = useState(false);

  const form = useForm<NewInvoiceFormValues>({
    resolver: zodResolver(NewInvoiceSchema),
    defaultValues: {
      description: "Sessão de Psicoterapia",
      amount: undefined as unknown as number,
      dueDate: format(new Date(), "yyyy-MM-dd"),
      paymentMethods: PATIENT_DECIDES_METHODS,
    },
    mode: "onChange",
  });

  const watchedAmount = form.watch("amount");
  const watchedPaymentMethods = form.watch("paymentMethods");
  const feeSummaries = watchedPaymentMethods.map((method) => ({
    method,
    label: method === "pix" ? "Pix" : method === "card" ? "Cartão à vista" : "Boleto",
    ...simulate({
      amount: Math.round(Number(watchedAmount || 0) * 100),
      method: method as SimulatorMethod,
      installments: 1,
    }),
  }));

  const reset = useCallback(() => {
    operationIdRef.current=crypto.randomUUID();
    setStep("form");
    form.reset();
    setPaymentUrl(null);
    setBoletoUrl(null);
    setPixData(undefined);
    setExpiresAt(undefined);
  }, [form]);

  const handleOpenChange = useCallback((value: boolean) => {
    setOpen(value);
    if (!value) setTimeout(reset, 300);
  }, [reset]);

  const issueInvoice = useCallback((values: NewInvoiceFormValues) => {
    if (!canGenerateCharge) {
      toast.error("Sua conta e seu plano precisam estar ativos para gerar cobranças NeuroFinance.");
      return;
    }

    const paymentMethodType = values.paymentMethods;
    let billingType = "UNDEFINED";

    if (values.paymentMethods.length === 1) {
      const billingTypeMap: Record<string, string> = {
        pix: "PIX",
        card: "CREDIT_CARD",
        boleto: "BOLETO",
      };
      billingType = billingTypeMap[values.paymentMethods[0]] || "UNDEFINED";
    }

    generateInvoice(
      {
        patientId: values.patientId,
        amount: values.amount,
        description: values.description,
        dueDate: new Date(`${values.dueDate}T12:00:00`),
        billingType,
        paymentMethodType,
        operationId:operationIdRef.current,
      },
      {
        onSuccess: (data) => {
          setPaymentUrl(data.paymentUrl || null);
          setBoletoUrl(data.boletoUrl || null);
          setPixData(data.pixQrCode ? { qrCode: data.pixQrCode, copyPaste: data.pixCopyPaste } : undefined);
          setExpiresAt(data.expiresAt);
          setStep("success");
        },
        onError: (err) => {
          console.error("Erro ao gerar fatura:", err);
          const friendlyError = toUserFacingError(err, "payment");
          toast.error(friendlyError.title, { description: friendlyError.message });
        },
      }
    );
  }, [canGenerateCharge, generateInvoice]);

  const onSubmit = useCallback(() => {
    setStep("confirmation");
  }, []);

  const handleCopy = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado.`);
  }, []);

  const handleShare = useCallback(() => {
    const values = form.getValues();
    const patient = patients?.find((p) => p.id === values.patientId);

    if (!patient?.phone || !paymentUrl) {
      toast.error("Dados incompletos para compartilhamento.");
      return;
    }

    const phone = patient.phone.replace(/\D/g, "");
    const amountStr = Number(values.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const msg = `Olá ${patient.name.split(" ")[0]}! Segue o link para o pagamento da sua sessão (${amountStr}):\n${paymentUrl}`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  }, [patients, paymentUrl, form]);

  const handleEmailShare = useCallback(() => {
    const values = form.getValues();
    const patient = patients?.find((p) => p.id === values.patientId);

    if (!patient?.email || !paymentUrl) {
      toast.error("Dados incompletos para envio por e-mail.");
      return;
    }

    const amountStr = Number(values.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const msg = `Olá ${patient.name.split(" ")[0]}! Segue o link para o pagamento da sua sessão (${amountStr}):\n${paymentUrl}`;
    window.location.href = `mailto:${patient.email}?subject=${encodeURIComponent("Cobrança NeuroFinance")}&body=${encodeURIComponent(msg)}`;
  }, [patients, paymentUrl, form]);

  const renderConfirmation = () => {
    const values = form.getValues();
    const patient = patients?.find((item) => item.id === values.patientId);
    const currency = (value: number) =>
      (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    return (
      <div className="flex h-full max-h-[inherit] flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-8 pb-6 pt-8 dark:border-white/5">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-zinc-100">Confirmar cobrança</h2>
            <p className="mt-1 text-xs font-medium text-zinc-500">Revise os dados e o valor líquido de cada método.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => handleOpenChange(false)} className="h-10 w-10 rounded-full hover:bg-zinc-100 dark:hover:bg-white/5">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto bg-zinc-50/30 px-8 py-8 dark:bg-transparent">
          <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
            <div className="grid gap-5 sm:grid-cols-2">
              <SummaryItem label="Paciente" value={patient?.name || "Paciente selecionado"} />
              <SummaryItem label="Vencimento" value={new Date(`${values.dueDate}T12:00:00`).toLocaleDateString("pt-BR")} />
              <SummaryItem label="Descrição" value={values.description} />
              <SummaryItem
                label="Valor da cobrança"
                value={Number(values.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              />
            </div>
          </div>

          <div>
            <p className="mb-3 ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Taxas estimadas por método</p>
            <div className="space-y-3">
              {feeSummaries.map((summary) => (
                <div key={summary.method} className="rounded-[24px] border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-black text-zinc-900 dark:text-white">{summary.label}</p>
                      <p className="mt-1 text-[10px] font-bold text-zinc-400">
                        {summary.rule?.price_label || "Condição confirmada no processamento"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Taxa descontada</p>
                      <p className="mt-1 text-sm font-black text-rose-600 dark:text-rose-400">
                        {summary.feeAmount == null ? "A confirmar" : `- ${currency(summary.feeAmount)}`}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-4 text-xs dark:border-white/5">
                    <span className="font-bold text-zinc-500">Valor líquido previsto</span>
                    <strong className="text-emerald-600 dark:text-emerald-400">
                      {summary.netAmount == null ? "A confirmar" : currency(summary.netAmount)}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.06] px-5 py-4 text-xs font-medium leading-relaxed text-amber-800 dark:text-amber-300">
            As tarifas são estimativas das condições atuais da conta e são descontadas somente quando o paciente paga.
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-zinc-100 bg-white p-8 dark:border-white/5 dark:bg-black/20">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep("form")}
            className="h-14 gap-2 rounded-[20px] px-6 text-[10px] font-black uppercase tracking-widest text-zinc-500"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <Button
            type="button"
            onClick={() => issueInvoice(values)}
            disabled={isCreating}
            className="h-14 gap-3 rounded-[20px] bg-zinc-900 px-10 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-2xl transition-all hover:opacity-90 active:scale-95 dark:bg-white dark:text-black"
          >
            {isCreating ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Emitir cobrança <ArrowRight className="h-4 w-4" /></>}
          </Button>
        </div>
      </div>
    );
  };

  const renderSuccess = () => (
    <div className="flex h-full max-h-[inherit] flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-8 pb-6 pt-8 dark:border-white/5">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-zinc-100">Cobrança gerada</h2>
          <p className="mt-1 text-xs font-medium text-zinc-500">Pronta para enviar ao paciente.</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => handleOpenChange(false)} className="h-10 w-10 rounded-full hover:bg-zinc-100 dark:hover:bg-white/5">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="custom-scrollbar flex-1 space-y-8 overflow-y-auto bg-zinc-50/30 px-8 py-8 dark:bg-transparent">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] border border-zinc-200 bg-white shadow-[0_22px_70px_-42px_rgba(0,0,0,0.55)] dark:border-white/10 dark:bg-white/[0.055]">
            <Check className="h-10 w-10 text-zinc-950 dark:text-white" strokeWidth={2.5} />
          </div>
          <p className="text-4xl font-black tracking-tighter text-zinc-900 dark:text-white">
            {Number(form.getValues("amount") || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
          {expiresAt && (
            <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 opacity-60">
              Vencimento em {new Date(expiresAt).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>

        {pixData?.qrCode && (
          <div className="flex flex-col items-center gap-6 rounded-[32px] border border-zinc-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2 self-start">
              <QrCode className="h-4 w-4 text-zinc-500 dark:text-zinc-300" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">QR Code Pix</span>
            </div>
            <div className="rounded-3xl border border-zinc-100 bg-white p-5 shadow-2xl">
              <img
                src={pixData.qrCode.startsWith("data:") ? pixData.qrCode : `data:image/png;base64,${pixData.qrCode}`}
                alt="PIX QR Code"
                className="h-48 w-48 object-contain"
              />
            </div>
            {pixData.copyPaste && (
              <button
                onClick={() => handleCopy(pixData.copyPaste!, "Código Pix")}
                className="flex w-full items-center gap-4 rounded-2xl bg-zinc-100 px-6 py-5 transition-all hover:bg-zinc-200 active:scale-[0.98] dark:bg-white/5 dark:hover:bg-white/10"
              >
                <div className="flex-1 overflow-hidden text-left">
                  <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-zinc-400">Copia e cola</p>
                  <code className="block truncate font-mono text-[11px] text-zinc-900 dark:text-zinc-100">{pixData.copyPaste}</code>
                </div>
                <Copy className="h-4 w-4 text-zinc-400" />
              </button>
            )}
          </div>
        )}

        {(paymentUrl || boletoUrl) && (
          <div className="space-y-5 rounded-[32px] border border-zinc-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.02]">
            {paymentUrl && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-zinc-500 dark:text-zinc-300" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Link de pagamento</span>
                </div>
                <div className="flex gap-3">
                  <div className="flex h-14 flex-1 items-center overflow-hidden rounded-2xl bg-zinc-100 px-5 dark:bg-white/5">
                    <span className="truncate font-mono text-[11px] text-zinc-600 dark:text-zinc-400">{paymentUrl}</span>
                  </div>
                  <Button size="icon" variant="outline" onClick={() => handleCopy(paymentUrl, "Link")} className="h-14 w-14 shrink-0 rounded-2xl border-zinc-200 dark:border-white/10">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {boletoUrl && (
              <div className="border-t border-zinc-100 pt-5 dark:border-white/5">
                <Button
                  variant="outline"
                  onClick={() => window.open(boletoUrl, "_blank")}
                  className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border-zinc-200 bg-zinc-100 text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 dark:border-white/10 dark:bg-white/5"
                >
                  <Barcode className="h-4 w-4" />
                  Visualizar boleto
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 gap-3 border-t border-zinc-100 bg-white p-8 dark:border-white/5 dark:bg-black/20">
        <Button onClick={handleShare} className="h-16 flex-1 gap-3 rounded-[20px] bg-zinc-900 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-2xl transition-all hover:opacity-90 active:scale-95 dark:bg-white dark:text-black">
          <Share2 className="h-4 w-4" />
          WhatsApp
        </Button>
        <Button onClick={handleEmailShare} variant="outline" className="h-16 flex-1 gap-3 rounded-[20px] border-zinc-200 text-[10px] font-black uppercase tracking-[0.2em] dark:border-white/10">
          <Mail className="h-4 w-4" />
          Gmail
        </Button>
        <Button variant="ghost" onClick={() => handleOpenChange(false)} className="h-16 rounded-[20px] px-8 text-[10px] font-black uppercase tracking-widest text-zinc-500">
          Fechar
        </Button>
      </div>
    </div>
  );

  const renderForm = () => (
    <div className="flex h-full max-h-[inherit] flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-8 pb-6 pt-8 dark:border-white/5">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-zinc-100">Nova cobrança</h2>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 w-10 rounded-full bg-zinc-900 dark:bg-white" />
            <div className="h-1.5 w-6 rounded-full bg-zinc-200 dark:bg-white/10" />
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => handleOpenChange(false)} className="h-10 w-10 rounded-full hover:bg-zinc-100 dark:hover:bg-white/5">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto bg-zinc-50/30 px-8 py-8 dark:bg-transparent">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
            {!canGenerateCharge && (
              <div className="flex items-center gap-4 rounded-3xl border border-amber-500/20 bg-amber-500/5 p-5">
                <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
                <p className="text-xs font-bold leading-relaxed text-amber-600 dark:text-amber-400">
                  {isLoadingSubscription || isLoadingFinancialAccount
                    ? "Verificando seu plano e sua conta NeuroFinance..."
                    : !hasNeurofinanceEntitlement
                      ? "Cobranças NeuroFinance estão disponíveis nos planos Professional e Enterprise."
                      : "Conclua a ativação da conta NeuroFinance para emitir cobranças reais."}
                </p>
              </div>
            )}

            <div className="space-y-6">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem className="space-y-4">
                    <FormLabel className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Valor da sessão (R$)</FormLabel>
                    <FormControl>
                      <div className="group relative">
                        <span className="absolute left-7 top-1/2 -translate-y-1/2 text-xl font-black text-zinc-300 dark:text-zinc-600">R$</span>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0,00"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(event) => field.onChange(event.target.value === "" ? undefined : Number(event.target.value))}
                          className="h-20 rounded-[28px] border-zinc-200 bg-white pl-16 text-4xl font-black text-zinc-900 shadow-sm transition-all focus:border-zinc-400 focus:ring-0 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-white/20"
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-[10px] font-bold text-red-500" />
                  </FormItem>
                )}
              />

              <div className="flex flex-wrap items-center gap-2 px-1">
                {QUICK_AMOUNTS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => form.setValue("amount", value, { shouldValidate: true })}
                    className={cn(
                      "rounded-full border px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95",
                      Number(watchedAmount) === value
                        ? "border-transparent bg-zinc-900 text-white shadow-xl dark:bg-white dark:text-black"
                        : "border-zinc-100 bg-white text-zinc-400 hover:border-zinc-300 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20"
                    )}
                  >
                    R$ {value}
                  </button>
                ))}
              </div>

              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="space-y-4">
                    <FormLabel className="ml-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Vencimento da cobrança
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        min={format(new Date(), "yyyy-MM-dd")}
                        {...field}
                        className="h-16 rounded-[24px] border-zinc-200 bg-white px-7 text-sm font-bold text-zinc-900 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                      />
                    </FormControl>
                    <FormMessage className="text-[10px] font-bold text-red-500" />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-8">
              <FormField
                control={form.control}
                name="patientId"
                render={({ field }) => (
                  <FormItem className="space-y-4">
                    <FormLabel className="ml-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                      Paciente
                      <div className="relative inline-block">
                        <button
                          type="button"
                          onMouseEnter={() => setShowPatientTooltip(true)}
                          onMouseLeave={() => setShowPatientTooltip(false)}
                          onClick={(e) => { e.preventDefault(); setShowPatientTooltip(!showPatientTooltip); }}
                          className="inline-flex items-center justify-center rounded-full p-0.5 text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-200"
                          aria-label="Informações sobre vínculo de paciente"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                        <AnimatePresence>
                          {showPatientTooltip && (
                            <motion.div
                              initial={{ opacity: 0, y: 6, scale: 0.96 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 4, scale: 0.97 }}
                              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                              className="absolute left-1/2 top-[calc(100%+8px)] z-[300] w-80 -translate-x-1/2 rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-zinc-900"
                            >
                              <p className="text-[11px] font-semibold leading-relaxed text-zinc-600 normal-case tracking-normal dark:text-zinc-300">
                                Só é possível vincular pelo NeuroFinance quando o paciente cadastrado tem seu CPF registrado no sistema.
                              </p>
                              <p className="mt-2 text-[11px] font-semibold leading-relaxed text-zinc-600 normal-case tracking-normal dark:text-zinc-300">
                                Envio por e-mail e WhatsApp também requerem essas informações cadastradas no prontuário do paciente.
                              </p>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleOpenChange(false);
                                  navigate("/pacientes");
                                }}
                                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-700 transition-all hover:bg-zinc-200 active:scale-95 dark:bg-white/10 dark:text-zinc-200 dark:hover:bg-white/15"
                              >
                                <UserIcon className="h-3.5 w-3.5" />
                                Ir para Pacientes
                              </button>
                              <div className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-zinc-200 bg-white dark:border-white/10 dark:bg-zinc-900" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-16 rounded-[24px] border-zinc-200 bg-white px-7 text-sm font-bold text-zinc-900 shadow-sm focus:ring-0 dark:border-white/10 dark:bg-white/5 dark:text-white">
                          <div className="flex items-center gap-3">
                            <UserIcon className="h-4 w-4 text-zinc-400" />
                            <SelectValue placeholder="Selecione o paciente..." />
                          </div>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-2xl border-zinc-100 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-950">
                        {patients?.map((patient) => (
                          <SelectItem key={patient.id} value={patient.id} className="cursor-pointer px-5 py-4 text-sm font-bold text-zinc-900 focus:bg-zinc-50 dark:text-zinc-100 dark:focus:bg-white/5">
                            {patient.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="space-y-4">
                    <FormLabel className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Descrição</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Ex: Sessão de Psicoterapia"
                        className="h-16 rounded-[24px] border-zinc-200 bg-white px-7 text-sm font-bold text-zinc-900 placeholder:text-zinc-300 dark:border-white/10 dark:bg-white/5 dark:text-white"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="paymentMethods"
                render={({ field }) => {
                  const patientDecides =
                    field.value.length === PATIENT_DECIDES_METHODS.length
                    && PATIENT_DECIDES_METHODS.every((method) => field.value.includes(method));

                  return (
                    <FormItem className="space-y-4">
                      <FormLabel className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Métodos de pagamento</FormLabel>
                      <FormControl>
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                          <button
                            type="button"
                            aria-pressed={patientDecides}
                            onClick={() => field.onChange(PATIENT_DECIDES_METHODS)}
                            className={cn(
                              "flex h-28 flex-col items-center justify-center gap-3 rounded-[28px] border-2 bg-white text-zinc-400 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/35 dark:bg-white/5",
                              patientDecides
                                ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                                : "border-zinc-100 dark:border-white/5",
                            )}
                          >
                            <CircleHelp className="h-6 w-6" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Paciente decide</span>
                          </button>
                          <ToggleGroup
                            type="multiple"
                            value={field.value}
                            onValueChange={(value) => field.onChange(value.length > 0 ? value : field.value)}
                            className="contents"
                          >
                            {[
                              { value: "pix", label: "Pix", icon: QrCode },
                              { value: "card", label: "Cartão", icon: CreditCard },
                              { value: "boleto", label: "Boleto", icon: Barcode },
                            ].map((method) => (
                              <ToggleGroupItem
                                key={method.value}
                                value={method.value}
                                className="flex h-28 flex-col gap-3 rounded-[28px] border-2 border-zinc-100 bg-white text-zinc-400 transition-all data-[state=on]:border-zinc-900 data-[state=on]:text-zinc-900 dark:border-white/5 dark:bg-white/5 dark:data-[state=on]:border-white dark:data-[state=on]:text-white"
                              >
                                <method.icon className="h-6 w-6" />
                                <span className="text-[9px] font-black uppercase tracking-widest">{method.label}</span>
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                        </div>
                      </FormControl>
                    </FormItem>
                  );
                }}
              />
            </div>
          </form>
        </Form>
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-zinc-100 bg-white p-8 dark:border-white/5 dark:bg-black/20">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total a cobrar</span>
          <span className="text-xl font-black text-zinc-900 dark:text-white">
            {watchedAmount ? Number(watchedAmount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00"}
          </span>
        </div>
        <Button
          type="button"
          onClick={form.handleSubmit(onSubmit)}
          disabled={!canGenerateCharge || isLoadingSubscription || isLoadingFinancialAccount}
          className="h-16 gap-3 rounded-[20px] bg-zinc-900 px-12 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-2xl transition-all hover:opacity-90 active:scale-95 dark:bg-white dark:text-black"
        >
          Revisar cobrança <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={handleOpenChange}
      trigger={children || <Button className="h-12 rounded-full bg-zinc-900 px-8 text-[10px] font-black uppercase tracking-widest text-white dark:bg-white dark:text-black">Gerar cobrança</Button>}
      className="flex h-[90vh] flex-col overflow-hidden rounded-[40px] border border-zinc-200 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(246,246,247,0.94))] p-0 shadow-[0_42px_140px_-52px_rgba(0,0,0,0.58)] dark:border-white/10 dark:bg-[linear-gradient(145deg,rgba(10,10,11,0.98),rgba(18,18,20,0.94))] sm:max-w-[650px]"
    >
      <div className="flex h-full flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 14, scale: 0.985, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, scale: 0.985, filter: "blur(8px)" }}
            transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
            className="h-full"
          >
            {step === "success" ? renderSuccess() : step === "confirmation" ? renderConfirmation() : renderForm()}
          </motion.div>
        </AnimatePresence>
      </div>
    </ResponsiveModal>
  );
});

NewInvoiceModal.displayName = "NewInvoiceModal";

const SummaryItem = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400">{label}</p>
    <p className="mt-2 text-sm font-black text-zinc-900 dark:text-white">{value}</p>
  </div>
);
