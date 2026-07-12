import { useEffect, useMemo, useState } from "react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Mail, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useFinancialPinStatus } from "@/hooks/use-financial-pin-status";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";

interface SetPinFormProps {
    onSuccess: () => void;
}

type Step = "current" | "create" | "confirm" | "reset-code" | "password-reset";

const PinSlots = ({
    value,
    onChange,
    disabled,
}: {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}) => (
    <InputOTP
        maxLength={6}
        value={value}
        onChange={onChange}
        autoFocus
        disabled={disabled}
        containerClassName="justify-center"
    >
        <InputOTPGroup className="gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
                <InputOTPSlot
                    key={i}
                    index={i}
                    className="h-12 w-10 rounded-xl border border-border/70 bg-muted/45 text-lg font-black text-foreground shadow-inner transition-colors first:rounded-xl first:border last:rounded-xl focus:border-ring focus:bg-background"
                />
            ))}
        </InputOTPGroup>
    </InputOTP>
);

export const SetPinForm = ({ onSuccess }: SetPinFormProps) => {
    const pinStatus = useFinancialPinStatus();
    const hasExistingPin = Boolean(pinStatus.data?.isConfigured);
    const [step, setStep] = useState<Step>("create");
    const [isInitialized, setIsInitialized] = useState(false);
    const [currentPin, setCurrentPin] = useState("");
    const [pin, setPin] = useState("");
    const [confirmPin, setConfirmPin] = useState("");
    const [resetCode, setResetCode] = useState("");
    const [accountPassword, setAccountPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [resetRequested, setResetRequested] = useState(false);

    useEffect(() => {
        if (pinStatus.isLoading || isInitialized) return;
        setStep(hasExistingPin ? "current" : "create");
        setIsInitialized(true);
    }, [hasExistingPin, isInitialized, pinStatus.isLoading]);

    const title = useMemo(() => {
        if (step === "password-reset") return "Confirme sua senha";
        if (step === "current") return "Confirme seu PIN atual";
        if (step === "reset-code") return "Código enviado por e-mail";
        if (step === "confirm") return "Confirme seu novo PIN";
        return hasExistingPin ? "Escolha um novo PIN" : "Criar PIN financeiro";
    }, [hasExistingPin, step]);

    const description = useMemo(() => {
        if (step === "password-reset") return "Usaremos sua senha de acesso apenas para autorizar a redefinição.";
        if (step === "current") return "Digite o PIN atual para confirmar a alteração.";
        if (step === "reset-code") return "Use o código recebido no e-mail da sua conta.";
        if (step === "confirm") return "Digite novamente para evitar erro de digitação.";
        return "Este PIN de 6 dígitos protege saques, Pix e ações financeiras.";
    }, [step]);

    const resetForm = () => {
        setCurrentPin("");
        setPin("");
        setConfirmPin("");
        setResetCode("");
        setAccountPassword("");
        setStep(hasExistingPin ? "current" : "create");
    };

    const requestResetCode = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke("financial-pin", {
                body: { action: "request_reset" },
            });
            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            setResetRequested(true);
            setStep("reset-code");
            toast.success("Enviamos um código para seu e-mail.");
        } catch (error) {
            toast.error(getUserFacingErrorMessage(error, "save"));
        } finally {
            setIsLoading(false);
        }
    };

    const savePin = async (finalPin: string) => {
        if (pin !== finalPin) {
            toast.error("Os PINs não coincidem.");
            setPin("");
            setConfirmPin("");
            setStep("create");
            return;
        }

        setIsLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke("financial-pin", {
                body: {
                    action: "set",
                    pin: finalPin,
                    current_pin: currentPin || undefined,
                    reset_code: resetCode || undefined,
                    account_password: accountPassword || undefined,
                },
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            toast.success("PIN financeiro atualizado.");
            onSuccess();
        } catch (error) {
            toast.error(getUserFacingErrorMessage(error, "save"));
            resetForm();
        } finally {
            setIsLoading(false);
        }
    };

    if (pinStatus.isLoading || !isInitialized) {
        return (
            <div className="flex min-h-48 w-full items-center justify-center" aria-label="Consultando situação do PIN">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="relative z-10 flex w-full max-w-[21rem] flex-col items-center space-y-8 text-center">
            <div className="animate-fade-in space-y-2 text-center">
                <h3 className="text-xl font-black tracking-tight text-foreground">{title}</h3>
                <p className="mx-auto max-w-[250px] text-xs font-medium leading-relaxed text-muted-foreground">{description}</p>
            </div>

            <div className="relative min-h-[56px]">
                {step === "current" && (
                    <PinSlots
                        value={currentPin}
                        disabled={isLoading}
                        onChange={(value) => {
                            setCurrentPin(value);
                            if (value.length === 6) setTimeout(() => setStep("create"), 220);
                        }}
                    />
                )}

                {step === "reset-code" && (
                    <PinSlots
                        value={resetCode}
                        disabled={isLoading}
                        onChange={(value) => {
                            setResetCode(value);
                            if (value.length === 6) setTimeout(() => setStep("create"), 220);
                        }}
                    />
                )}

                {step === "password-reset" && (
                    <div className="w-[280px] animate-in fade-in slide-in-from-right-8 duration-300 space-y-3">
                        <Input
                            type="password"
                            value={accountPassword}
                            onChange={(event) => setAccountPassword(event.target.value)}
                            placeholder="Senha da sua conta"
                            className="h-12 rounded-xl border-border/70 bg-muted/45 text-center text-sm font-bold text-foreground shadow-inner placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        <Button
                            type="button"
                            onClick={() => accountPassword.length >= 6 ? setStep("create") : toast.error("Digite sua senha para continuar.")}
                            className="h-10 w-full rounded-xl bg-foreground text-[10px] font-black uppercase tracking-[0.16em] text-background hover:bg-foreground/90"
                        >
                            Continuar
                        </Button>
                    </div>
                )}

                {step === "create" && (
                    <PinSlots
                        value={pin}
                        disabled={isLoading}
                        onChange={(value) => {
                            setPin(value);
                            if (value.length === 6) setTimeout(() => setStep("confirm"), 220);
                        }}
                    />
                )}

                {step === "confirm" && (
                    <div className="animate-in fade-in slide-in-from-right-8 duration-300">
                        <PinSlots
                            value={confirmPin}
                            disabled={isLoading}
                            onChange={(value) => {
                                setConfirmPin(value);
                                if (value.length === 6) savePin(value);
                            }}
                        />
                    </div>
                )}

                {isLoading && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-background/80 backdrop-blur-sm">
                        <Loader2 className="h-6 w-6 animate-spin text-foreground" />
                    </div>
                )}
            </div>

            <div className="flex gap-3">
                {["current", "reset-code", "create", "confirm"]
                    .filter((item) => item !== "current" || hasExistingPin)
                    .filter((item) => item !== "reset-code" || resetRequested)
                    .map((item) => (
                        <div
                            key={item}
                            className={cn(
                                "h-2 w-2 rounded-full transition-all duration-300",
                                step === item ? "scale-125 bg-foreground" : "bg-muted-foreground/25"
                            )}
                        />
                    ))}
            </div>

            {hasExistingPin && step !== "reset-code" && (
                <div className="flex flex-wrap justify-center gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={requestResetCode}
                        disabled={isLoading}
                        className="h-9 rounded-full px-4 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                        <Mail className="mr-2 h-3.5 w-3.5" />
                        Receber código
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setStep("password-reset")}
                        disabled={isLoading}
                        className="h-9 rounded-full px-4 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                        Redefinir com senha
                    </Button>
                </div>
            )}

            {(step === "create" || step === "confirm") && (currentPin || resetCode || accountPassword) && (
                <Button
                    type="button"
                    variant="ghost"
                    onClick={resetForm}
                    disabled={isLoading}
                    className="h-9 rounded-full px-4 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                    <RotateCcw className="mr-2 h-3.5 w-3.5" />
                    Reiniciar
                </Button>
            )}
        </div>
    );
};
