import { useEffect, useState } from "react";
import { Loader2, LockKeyhole, ShieldCheck } from "lucide-react";

import { AppModalShell, ModalHeroIcon } from "@/components/ui/app-modal-shell";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { cn, formatCurrency } from "@/lib/utils";

interface SecureOperationPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (pin: string) => Promise<void>;
  recipient?: string | null;
  value?: number;
  actionLabel?: string;
  isLoading: boolean;
  errorMessage?: string | null;
}

export function SecureOperationPinDialog({
  open,
  onOpenChange,
  onConfirm,
  recipient,
  value,
  actionLabel = "o pagamento",
  isLoading,
  errorMessage,
}: SecureOperationPinDialogProps) {
  const [pin, setPin] = useState("");
  const valueFragment = typeof value === "number" ? ` de ${formatCurrency(value)}` : "";
  const recipientFragment = recipient ? ` para ${recipient}` : "";

  useEffect(() => {
    if (open || errorMessage) setPin("");
  }, [open, errorMessage]);

  return (
    <AppModalShell
      open={open}
      onOpenChange={(nextOpen) => !isLoading && onOpenChange(nextOpen)}
      preventClose={isLoading}
      size="sm"
      eyebrow="Confirmação protegida"
      title="Confirme com seu PIN"
      description={`Digite seu PIN de 6 dígitos para confirmar ${actionLabel}${valueFragment}${recipientFragment}.`}
      heroIcon={<ModalHeroIcon icon={isLoading ? Loader2 : LockKeyhole} state={isLoading ? "loading" : errorMessage ? "error" : "neutral"} tone="status" ariaLabel="Confirmação por PIN" />}
      footer={
        <div className="grid gap-3 sm:grid-cols-[1fr_1.15fr]">
          <Button
            type="button"
            variant="ghost"
            disabled={isLoading}
            onClick={() => onOpenChange(false)}
            className="h-12 rounded-[17px] text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Voltar
          </Button>
          <Button
            type="button"
            disabled={isLoading || pin.length !== 6}
            onClick={() => onConfirm(pin)}
            className="h-12 rounded-[17px] bg-foreground text-[10px] font-black uppercase tracking-widest text-background hover:bg-foreground/90"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : "Confirmar"}
          </Button>
        </div>
      }
    >
      <div className="mx-auto flex w-full max-w-[23rem] flex-col items-center">
        <div className={cn("flex w-full justify-center rounded-[22px] border bg-muted/35 px-2 py-5 transition-colors sm:px-4", errorMessage ? "border-destructive/35" : "border-border/60")}>
          <InputOTP maxLength={6} value={pin} onChange={setPin} disabled={isLoading} autoFocus aria-label="PIN financeiro de seis dígitos" aria-invalid={Boolean(errorMessage)} containerClassName="justify-center">
            <InputOTPGroup className="gap-1.5 sm:gap-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <InputOTPSlot
                  key={index}
                  index={index}
                  className={cn(
                    "h-11 w-9 rounded-[12px] border border-border/70 bg-background text-lg font-black text-foreground first:rounded-[12px] first:border last:rounded-[12px] sm:h-12 sm:w-10",
                    errorMessage && "border-destructive/35 text-destructive",
                  )}
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <div className="mt-3 min-h-5 text-center">
          {errorMessage ? (
            <p role="alert" className="text-[10px] font-bold text-destructive">{errorMessage}</p>
          ) : (
            <p className="flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              <ShieldCheck className="h-3 w-3" />
              Ambiente protegido
            </p>
          )}
        </div>
      </div>
    </AppModalShell>
  );
}
