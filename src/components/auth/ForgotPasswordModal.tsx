import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { readSupabaseFunctionError } from "@/lib/read-supabase-function-error";
import { toast } from "sonner";
import { ArrowRight, Check, Loader2, Mail } from "lucide-react";

interface ForgotPasswordModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    redirectTo?: string;
    context?: "professional" | "patient";
    inviteToken?: string;
}

export const ForgotPasswordModal = ({
    open,
    onOpenChange,
    redirectTo,
    context = "professional",
    inviteToken,
}: ForgotPasswordModalProps) => {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!email.trim()) {
            toast.error("Digite seu e-mail.");
            return;
        }

        setIsLoading(true);

        try {
            const normalizedEmail = email.trim().toLowerCase();
            const result = context === "patient"
                ? await supabase.functions.invoke("patient-portal-auth", {
                    body: {
                        action: "reset_password",
                        email: normalizedEmail,
                        inviteToken: inviteToken || "",
                    },
                })
                : await supabase.auth.resetPasswordForEmail(normalizedEmail, {
                    redirectTo: redirectTo || `${window.location.origin}/reset-password`,
                });

            if (result.error) {
                throw new Error(await readSupabaseFunctionError(
                    result.error,
                    context === "patient"
                        ? "Não foi possível enviar o e-mail do Portal."
                        : "Não foi possível enviar o e-mail de recuperação.",
                ));
            }

            setIsSuccess(true);
            toast.success(context === "patient" ? "E-mail do Portal enviado." : "E-mail de recuperação enviado.");
        } catch (error) {
            console.error("Reset password error:", error);
            toast.error(error instanceof Error ? error.message : "Erro ao enviar e-mail. Verifique o endereço e tente novamente.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setEmail("");
        setIsSuccess(false);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-[24px] border border-border/50 bg-card/95 p-0 shadow-2xl backdrop-blur-xl sm:max-w-[420px]">
                <div className="relative space-y-6 p-6">
                    {!isSuccess ? (
                        <>
                            <DialogHeader className="items-center text-center">
                                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border/50 bg-foreground/10 shadow-lg">
                                    <Mail className="h-7 w-7 text-foreground" />
                                </div>
                                <DialogTitle className="text-xl font-bold text-foreground">
                                    Recuperar senha
                                </DialogTitle>
                                <DialogDescription className="text-muted-foreground">
                                    {context === "patient"
                                        ? "Digite o e-mail usado no convite para receber o link de redefinição e voltar ao Portal do Paciente."
                                        : "Digite seu e-mail e enviaremos um link para redefinir sua senha."}
                                </DialogDescription>
                            </DialogHeader>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="reset-email" className="text-foreground/80">E-mail</Label>
                                    <Input
                                        id="reset-email"
                                        type="email"
                                        value={email}
                                        onChange={(event) => setEmail(event.target.value)}
                                        placeholder="seu@email.com"
                                        className="h-12 rounded-xl border-border/50 bg-muted/50 text-foreground"
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isLoading}
                                    className="h-12 w-full rounded-xl font-bold uppercase tracking-wider"
                                >
                                    {isLoading ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <span className="flex items-center gap-2">
                                            {context === "patient" ? "Enviar link do Portal" : "Enviar link"} <ArrowRight className="h-4 w-4" />
                                        </span>
                                    )}
                                </Button>
                            </form>
                        </>
                    ) : (
                        <div className="space-y-4 py-6 text-center">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                                <Check className="h-8 w-8 text-emerald-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-foreground">
                                    E-mail enviado
                                </h3>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
                                </p>
                            </div>
                            <Button onClick={handleClose} variant="outline" className="mt-4 rounded-xl">
                                Fechar
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
