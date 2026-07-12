"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Fingerprint, Landmark, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { cn } from "@/lib/utils";

interface NeuroFinancePostOnboardingWizardProps {
  open: boolean;
  pinAlreadyConfigured?: boolean;
  onComplete: () => void;
}

type WizardStep = "success" | "pin";

export function NeuroFinancePostOnboardingWizard({
  open,
  pinAlreadyConfigured = false,
  onComplete,
}: NeuroFinancePostOnboardingWizardProps) {
  const [step, setStep] = useState<WizardStep>("success");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isSavingPin, setIsSavingPin] = useState(false);

  useEffect(() => {
    if (open) {
      setStep("success");
      setPin("");
      setConfirmPin("");
      setIsSavingPin(false);
    }
  }, [open]);

  const pinsMatch = pin.length === 6 && confirmPin.length === 6 && pin === confirmPin;
  const pinMismatch = pin.length === 6 && confirmPin.length === 6 && pin !== confirmPin;

  const stepMeta = useMemo(() => {
    if (step === "success") {
      return {
        eyebrow: "Conta criada",
        title: "Sua conta NeuroFinance foi criada.",
        description:
          "Recebemos seus dados com sucesso. A análise documental segue em andamento e você pode acompanhar cada etapa em NeuroFinance > Saúde da conta.",
      };
    }

    return {
      eyebrow: "Segurança financeira",
      title: "Defina seu PIN de 6 dígitos.",
      description:
        "Esse PIN será solicitado para saques, transferências e operações sensíveis. Depois, você poderá redefini-lo em Ajustes > NeuroFinance.",
    };
  }, [step]);

  if (!open) return null;

  const handleNextFromSuccess = () => {
    if (pinAlreadyConfigured) {
      onComplete();
      return;
    }
    setStep("pin");
  };

  const handleSetPin = async () => {
    if (!pinsMatch || isSavingPin) return;

    setIsSavingPin(true);
    try {
      const { data, error } = await supabase.functions.invoke("financial-pin", {
        body: { action: "set", pin },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("PIN financeiro criado com sucesso.");
      onComplete();
    } catch (error: any) {
      const message = String(error?.message || "");
      if (message.includes("PIN_AUTH_REQUIRED")) {
        toast.info("Você já possui um PIN financeiro configurado.");
        onComplete();
        return;
      }
      toast.error(getUserFacingErrorMessage(error, "save"));
    } finally {
      setIsSavingPin(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[240] flex min-h-screen items-center justify-center overflow-hidden bg-zinc-50/96 px-6 py-10 font-sans text-zinc-950 backdrop-blur-[42px] dark:bg-[#020204]/96 dark:text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-12%] top-[-18%] h-[720px] w-[920px] rounded-full bg-zinc-950/[0.035] blur-[210px] dark:bg-white/[0.035]" />
        <div className="absolute bottom-[-18%] right-[-12%] h-[620px] w-[760px] rounded-full bg-zinc-950/[0.025] blur-[180px] dark:bg-white/[0.025]" />
        <div className="premium-noise absolute inset-0 opacity-[0.018] dark:opacity-[0.045]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 grid w-full max-w-6xl overflow-hidden rounded-[44px] border border-zinc-200/80 bg-white/78 shadow-[0_44px_120px_-60px_rgba(24,24,27,0.72),inset_0_1px_0_rgba(255,255,255,0.92)] ring-1 ring-white/50 backdrop-blur-3xl dark:border-white/[0.085] dark:bg-[#070708]/84 dark:shadow-[0_54px_140px_-64px_rgba(0,0,0,0.98),inset_0_1px_0_rgba(255,255,255,0.055)] dark:ring-white/[0.035] lg:grid-cols-[0.82fr_1.18fr]"
      >
        <div className="relative hidden min-h-[640px] overflow-hidden border-r border-zinc-200/70 bg-zinc-950 text-white dark:border-white/[0.075] dark:bg-white dark:text-zinc-950 lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.14),transparent_32%),radial-gradient(circle_at_70%_82%,rgba(255,255,255,0.075),transparent_34%)] dark:bg-[radial-gradient(circle_at_18%_18%,rgba(0,0,0,0.09),transparent_34%),radial-gradient(circle_at_72%_82%,rgba(0,0,0,0.07),transparent_38%)]" />
          <div className="relative z-10 flex h-full flex-col justify-between p-10">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-white text-zinc-950 shadow-2xl dark:bg-zinc-950 dark:text-white">
                <Landmark className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.32em] opacity-50">NeuroNex</p>
                <h2 className="text-sm font-black uppercase tracking-[0.24em]">NeuroFinance</h2>
              </div>
            </div>

            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-[9px] font-black uppercase tracking-[0.22em] dark:border-zinc-950/10 dark:bg-zinc-950/[0.06]">
                <ShieldCheck className="h-3.5 w-3.5" />
                Ambiente seguro
              </div>
              <h3 className="max-w-sm text-5xl font-black leading-[0.92] tracking-[-0.06em]">
                Banking premium para sua clínica.
              </h3>
              <p className="max-w-sm text-sm font-medium leading-relaxed opacity-56">
                Abertura concluída, análise em andamento e uma camada extra de segurança para movimentações reais.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[10px] font-bold uppercase tracking-[0.16em] opacity-58">
              <span>Pix</span>
              <span>Saques</span>
              <span>Transferências</span>
              <span>Saúde da conta</span>
            </div>
          </div>
        </div>

        <div className="relative min-h-[640px] p-7 md:p-10">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {["success", "pin"].map((item, index) => {
                const isActive = step === item;
                const isDone = step === "pin" && item === "success";
                return (
                  <div key={item} className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full border text-[10px] font-black transition-all",
                        isActive || isDone
                          ? "border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950"
                          : "border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-600"
                      )}
                    >
                      {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                    </div>
                    {index === 0 ? <div className="h-px w-10 bg-zinc-200 dark:bg-white/10" /> : null}
                  </div>
                );
              })}
            </div>
            <span className="rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-[8px] font-black uppercase tracking-[0.22em] text-zinc-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-500">
              Pós-onboarding
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 18, filter: "blur(8px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: -18, filter: "blur(8px)" }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex min-h-[490px] flex-col justify-center"
            >
              <div className="mb-7 flex h-16 w-16 items-center justify-center rounded-[24px] border border-zinc-200 bg-zinc-50 text-zinc-950 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-white">
                {step === "success" ? <CheckCircle2 className="h-7 w-7" /> : <Fingerprint className="h-7 w-7" />}
              </div>

              <p className="mb-4 text-[10px] font-black uppercase tracking-[0.32em] text-zinc-400 dark:text-zinc-600">
                {stepMeta.eyebrow}
              </p>
              <h1 className="max-w-2xl text-4xl font-black leading-[0.98] tracking-[-0.055em] text-zinc-950 dark:text-white md:text-6xl">
                {stepMeta.title}
              </h1>
              <p className="mt-6 max-w-2xl text-sm font-medium leading-relaxed text-zinc-500 dark:text-zinc-400 md:text-base">
                {stepMeta.description}
              </p>

              {step === "success" ? (
                <div className="mt-9 grid gap-3 sm:grid-cols-3">
                  {[
                    "Acompanhe documentos em NeuroFinance > Saúde da conta",
                    "Receba cobranças enquanto a análise avança",
                    "Proteja transações com PIN financeiro",
                  ].map((item) => (
                    <div key={item} className="rounded-2xl border border-zinc-200/75 bg-zinc-50/80 p-4 text-[10px] font-bold uppercase leading-relaxed tracking-[0.12em] text-zinc-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-zinc-500">
                      {item}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-10 space-y-7">
                  <div className="space-y-3">
                    <span className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400">Novo PIN</span>
                    <InputOTP maxLength={6} value={pin} onChange={setPin} disabled={isSavingPin}>
                      <InputOTPGroup className="gap-2.5">
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTPSlot
                            key={index}
                            index={index}
                            className="h-13 w-11 rounded-2xl border-zinc-200 bg-zinc-50 text-xl font-black text-zinc-950 shadow-inner data-[active=true]:scale-105 data-[active=true]:border-zinc-950 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:data-[active=true]:border-white sm:h-14 sm:w-12"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  <div className="space-y-3">
                    <span className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400">Confirmar PIN</span>
                    <InputOTP maxLength={6} value={confirmPin} onChange={setConfirmPin} disabled={isSavingPin}>
                      <InputOTPGroup className="gap-2.5">
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTPSlot
                            key={index}
                            index={index}
                            className={cn(
                              "h-13 w-11 rounded-2xl border-zinc-200 bg-zinc-50 text-xl font-black text-zinc-950 shadow-inner data-[active=true]:scale-105 data-[active=true]:border-zinc-950 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:data-[active=true]:border-white sm:h-14 sm:w-12",
                              pinMismatch && "border-rose-400 text-rose-500 dark:border-rose-400 dark:text-rose-300"
                            )}
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                    {pinMismatch ? (
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-rose-500 dark:text-rose-300">
                        Os PINs não coincidem.
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex justify-end gap-3 border-t border-zinc-200/70 pt-5 dark:border-white/10">
            {step === "pin" ? (
              <button
                type="button"
                onClick={() => setStep("success")}
                disabled={isSavingPin}
                className="h-12 rounded-2xl px-5 text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-950 disabled:opacity-40 dark:hover:bg-white/[0.06] dark:hover:text-white"
              >
                Voltar
              </button>
            ) : null}

            <button
              type="button"
              onClick={step === "success" ? handleNextFromSuccess : handleSetPin}
              disabled={step === "pin" ? !pinsMatch || isSavingPin : false}
              className={cn(
                "flex h-12 items-center gap-3 rounded-2xl px-6 text-[10px] font-black uppercase tracking-[0.22em] transition-all active:scale-[0.98]",
                step === "pin" && (!pinsMatch || isSavingPin)
                  ? "bg-zinc-100 text-zinc-400 dark:bg-white/[0.05] dark:text-zinc-600"
                  : "bg-zinc-950 text-white shadow-2xl hover:opacity-90 dark:bg-white dark:text-zinc-950"
              )}
            >
              {isSavingPin ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {step === "success" ? (pinAlreadyConfigured ? "Acessar NeuroFinance" : "Definir PIN") : "Salvar PIN"}
              {!isSavingPin ? <ArrowRight className="h-4 w-4" /> : null}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
