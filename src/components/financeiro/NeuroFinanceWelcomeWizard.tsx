"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Fingerprint, Landmark, Loader2, WalletCards } from "lucide-react";
import { toast } from "sonner";

import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { NeuroFinanceDestinationSetup } from "@/components/financeiro/NeuroFinanceDestinationSetup";
import { supabase } from "@/integrations/supabase/client";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { cn } from "@/lib/utils";

type Step = "success" | "pin" | "destination";

export function NeuroFinanceWelcomeWizard({
  open,
  pinAlreadyConfigured = false,
  onComplete,
}: {
  open: boolean;
  pinAlreadyConfigured?: boolean;
  onComplete: () => void | Promise<void>;
}) {
  const [step, setStep] = useState<Step>("success");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep("success");
    setPin("");
    setConfirmPin("");
    setSaving(false);
  }, [open]);

  if (!open) return null;

  const stepNumber = step === "success" ? 0 : step === "pin" ? 1 : 2;
  const pinsMatch = pin.length === 6 && confirmPin.length === 6 && pin === confirmPin;
  const pinMismatch = pin.length === 6 && confirmPin.length === 6 && pin !== confirmPin;
  const title = step === "success" ? "Sua conta NeuroFinance foi criada." : step === "pin" ? "Defina seu PIN de 6 dígitos." : "Escolha para onde deseja sacar.";
  const eyebrow = step === "success" ? "Conta criada" : step === "pin" ? "Segurança financeira" : "Dados de recebimento";
  const description = step === "success"
    ? "Recebemos seus dados com sucesso. A análise segue em andamento e você pode acompanhar cada etapa em NeuroFinance > Saúde da conta."
    : step === "pin"
      ? "Esse PIN será solicitado para saques, transferências e ações sensíveis. Depois, você poderá redefini-lo em Ajustes > NeuroFinance."
      : "Cadastre uma conta bancária, uma chave Pix pessoal ou ambas. Você poderá editar esses dados depois em Ajustes > Conta bancária.";

  const savePin = async () => {
    if (!pinsMatch || saving) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("financial-pin", { body: { action: "set", pin } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("PIN financeiro criado com sucesso.");
      setStep("destination");
    } catch (error: any) {
      if (String(error?.message || "").includes("PIN_AUTH_REQUIRED")) {
        toast.info("Você já possui um PIN financeiro configurado.");
        setStep("destination");
      } else {
        toast.error(getUserFacingErrorMessage(error, "save"));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[240] flex min-h-screen items-center justify-center overflow-hidden bg-zinc-50/96 px-5 py-7 text-zinc-950 backdrop-blur-[42px] dark:bg-[#020204]/96 dark:text-white">
      <div className="pointer-events-none absolute inset-0 premium-noise opacity-[0.035]" />
      <motion.div initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-[38px] border border-zinc-200/80 bg-white/78 shadow-[0_44px_120px_-60px_rgba(24,24,27,0.72)] backdrop-blur-3xl dark:border-white/[0.085] dark:bg-[#070708]/84 lg:grid-cols-[0.78fr_1.22fr]">
        <aside className="relative hidden min-h-[540px] border-r border-zinc-200/70 bg-zinc-950 p-8 text-white dark:border-white/[0.075] dark:bg-white dark:text-zinc-950 lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-white text-zinc-950 dark:bg-zinc-950 dark:text-white"><Landmark className="h-5 w-5" /></div><div><p className="text-[8px] font-black uppercase tracking-[0.32em] opacity-50">NeuroNex</p><h2 className="text-xs font-black uppercase tracking-[0.24em]">NeuroFinance</h2></div></div>
          <div className="space-y-6"><div className="inline-flex rounded-full border border-white/12 bg-white/8 px-3.5 py-1.5 text-[8px] font-black uppercase tracking-[0.22em] dark:border-zinc-950/10 dark:bg-zinc-950/[0.06]">Ambiente seguro</div><h3 className="max-w-xs text-4xl font-black leading-[0.94] tracking-[-0.06em]">Banking para sua clínica.</h3><p className="max-w-xs text-xs font-medium leading-relaxed opacity-60">Abertura concluída, análise em andamento e segurança para movimentações.</p></div>
          <div className="grid grid-cols-2 gap-3 text-[9px] font-bold uppercase tracking-[0.16em] opacity-58"><span>Pix</span><span>Saques</span><span>Transferências</span><span>Saúde da conta</span></div>
        </aside>

        <main className="relative min-h-[540px] p-6 md:p-8">
          <div className="mb-6 flex items-center gap-2">
            {["success", "pin", "destination"].map((item, index) => (
              <div key={item} className="flex items-center gap-2">
                <div className={cn("flex h-7 w-7 items-center justify-center rounded-full border text-[9px] font-black", stepNumber >= index ? "border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950" : "border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-white/10 dark:bg-white/[0.04]")}>{stepNumber > index ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}</div>
                {index < 2 ? <div className="h-px w-8 bg-zinc-200 dark:bg-white/10" /> : null}
              </div>
            ))}
          </div>

          <div className="flex min-h-[400px] flex-col justify-center">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-[22px] border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-white/[0.04]">
              {step === "success" ? <CheckCircle2 className="h-6 w-6" /> : step === "pin" ? <Fingerprint className="h-6 w-6" /> : <WalletCards className="h-6 w-6" />}
            </div>
            <p className="mb-3 text-[9px] font-black uppercase tracking-[0.32em] text-zinc-400">{eyebrow}</p>
            <h1 className="max-w-xl text-3xl font-black leading-[0.98] tracking-[-0.055em] md:text-5xl">{title}</h1>
            <p className="mt-5 max-w-xl text-xs font-medium leading-relaxed text-zinc-500 dark:text-zinc-400 md:text-sm">{description}</p>

            {step === "success" ? (
              <div className="mt-7 grid gap-3 sm:grid-cols-3">{["Acompanhe documentos em NeuroFinance > Saúde da conta", "Receba cobranças enquanto a análise avança", "Proteja transações com PIN financeiro"].map((item) => <div key={item} className="rounded-2xl border border-zinc-200/75 bg-zinc-50/80 p-3 text-[9px] font-bold uppercase leading-relaxed tracking-[0.12em] text-zinc-500 dark:border-white/10 dark:bg-white/[0.035]">{item}</div>)}</div>
            ) : step === "pin" ? (
              <div className="mt-8 space-y-6">
                <PinInput label="Novo PIN" value={pin} onChange={setPin} disabled={saving} />
                <PinInput label="Confirmar PIN" value={confirmPin} onChange={setConfirmPin} disabled={saving} error={pinMismatch} />
                {pinMismatch ? <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-rose-500">Os PINs não coincidem.</p> : null}
              </div>
            ) : <NeuroFinanceDestinationSetup onComplete={onComplete} />}
          </div>

          {step !== "destination" ? <div className="mt-6 flex justify-end border-t border-zinc-200/70 pt-4 dark:border-white/10"><button type="button" onClick={step === "success" ? () => setStep(pinAlreadyConfigured ? "destination" : "pin") : savePin} disabled={step === "pin" ? !pinsMatch || saving : false} className={cn("flex h-11 items-center gap-3 rounded-2xl px-5 text-[9px] font-black uppercase tracking-[0.22em]", step === "pin" && (!pinsMatch || saving) ? "bg-zinc-100 text-zinc-400 dark:bg-white/[0.05]" : "bg-zinc-950 text-white shadow-2xl dark:bg-white dark:text-zinc-950")}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{step === "success" ? pinAlreadyConfigured ? "Configurar recebimento" : "Definir PIN" : "Salvar PIN"}<ArrowRight className="h-4 w-4" /></button></div> : null}
        </main>
      </motion.div>
    </div>
  );
}

function PinInput({ label, value, onChange, disabled, error }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; error?: boolean }) {
  return <div className="space-y-3"><span className="text-[8px] font-black uppercase tracking-[0.22em] text-zinc-400">{label}</span><InputOTP maxLength={6} value={value} onChange={onChange} disabled={disabled}><InputOTPGroup className="gap-2">{Array.from({ length: 6 }).map((_, index) => <InputOTPSlot key={index} index={index} className={cn("h-11 w-10 rounded-2xl border-zinc-200 bg-zinc-50 text-lg font-black text-zinc-950 shadow-inner dark:border-white/10 dark:bg-white/[0.04] dark:text-white sm:h-12 sm:w-11", error && "border-rose-400 text-rose-500")} />)}</InputOTPGroup></InputOTP></div>;
}
