import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Loader2, Lock, ShieldCheck, Unlock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { AppModalShell, ModalHeroIcon } from "@/components/ui/app-modal-shell";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { cn } from "@/lib/utils";

interface PinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const PinModal = ({ open, onOpenChange, onSuccess }: PinModalProps) => {
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();
  const reduceMotion = Boolean(useReducedMotion());

  useEffect(() => {
    if (open) {
      setPin("");
      setError(false);
      setIsSuccess(false);
    }
  }, [open]);

  const handleVerify = async (value: string) => {
    if (value.length < 6) return;

    setIsLoading(true);
    setError(false);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("financial-pin", {
        body: { action: "verify", pin: value },
      });

      if (invokeError) throw invokeError;
      if (data?.error || !data?.isValid) throw new Error(data?.error || "PIN incorreto.");

      setIsSuccess(true);
      window.setTimeout(() => onSuccess(), reduceMotion ? 120 : 520);
    } catch (cause) {
      console.error("[PinModal] Falha na verificacao do PIN", cause);
      const message = String(cause instanceof Error ? cause.message : "").toLowerCase().includes("pin")
        ? "PIN incorreto. Confira os numeros e tente novamente."
        : getUserFacingErrorMessage(cause, "generic");
      toast.error(message, { position: "bottom-center" });
      setError(true);
      setPin("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    onOpenChange(false);
    navigate("/financeiro?view=conta-digital");
  };

  const heroState = isSuccess ? "success" : error ? "error" : isLoading ? "loading" : "neutral";
  const HeroIcon = isLoading ? Loader2 : isSuccess ? Unlock : Lock;

  return (
    <AppModalShell
      open={open}
      onOpenChange={(next) => { if (!isLoading) onOpenChange(next); }}
      preventClose={isLoading}
      size="sm"
      eyebrow="Confirmação protegida"
      title={isSuccess ? "Acesso permitido" : "Confirme seu PIN"}
      description={error ? "PIN incorreto. Tente novamente." : isSuccess ? "Acesso liberado com segurança." : "Digite seu código de seis dígitos para continuar."}
      heroIcon={<ModalHeroIcon icon={HeroIcon} state={heroState} tone="status" ariaLabel="Status do PIN financeiro" />}
      footer={
        <Button
          type="button"
          variant="ghost"
          disabled={isLoading}
          onClick={handleBack}
          className="h-12 w-full rounded-[18px] text-xs font-black uppercase tracking-[0.14em] text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      }
    >
      <div className="mx-auto flex w-full max-w-[23rem] flex-col items-center">
        <motion.div
          animate={error && !reduceMotion ? { x: [0, -12, 12, -8, 8, 0] } : { x: 0 }}
          transition={{ duration: 0.34 }}
          className="w-full"
        >
          <InputOTP
            maxLength={6}
            value={pin}
            onChange={(value) => {
              setPin(value);
              if (value.length === 6) void handleVerify(value);
            }}
            disabled={isLoading || isSuccess}
            autoFocus
            aria-label="PIN financeiro de seis dígitos"
            aria-invalid={error}
            containerClassName="justify-center"
          >
            <InputOTPGroup className="gap-2 sm:gap-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <InputOTPSlot
                  key={index}
                  index={index}
                  className={cn(
                    "h-13 w-10 rounded-2xl border border-border/70 bg-muted/45 text-xl font-black text-foreground shadow-inner transition-colors first:rounded-2xl first:border last:rounded-2xl sm:w-12",
                    error && "border-destructive/50 text-destructive",
                    isSuccess && "border-emerald-500/45 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
                  )}
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </motion.div>

        <div className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Proteção reforçada
        </div>
      </div>
    </AppModalShell>
  );
};
