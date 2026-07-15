"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Star, Sparkles, Send, ShieldCheck } from "lucide-react";

interface WaitlistModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const WaitlistModal = ({ open, onOpenChange }: WaitlistModalProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        crp: "",
        email: "",
        whatsapp: ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { error } = await supabase
                .from("waitlist")
                .insert([
                    {
                        name: formData.name,
                        crp: formData.crp || null,
                        email: formData.email,
                        whatsapp: formData.whatsapp || null,
                        source: window.location.pathname === "/auth" ? "auth_page" : "landing_page"
                    }
                ]);

            if (error) {
                if (error.code === "23505") {
                    toast.error("Este e-mail já está na nossa lista de espera!");
                } else {
                    throw error;
                }
            } else {
                setIsSuccess(true);
                toast.success("Inscrição realizada com sucesso!");
            }
        } catch (error) {
            console.error("Waitlist error:", error);
            toast.error("Ocorreu um erro ao processar sua inscrição. Tente novamente.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-background border-none shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]">
                {/* Premium Background Elements */}
                <div className="absolute inset-0 premium-noise opacity-[0.03] pointer-events-none" />
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-foreground/20 to-transparent" />

                {!isSuccess ? (
                    <div className="relative p-8 md:p-10">
                        <DialogHeader className="mb-8 space-y-4">
                            <div className="flex justify-center mb-2">
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-foreground/[0.03] border border-foreground/10"
                                >
                                    <Star className="w-3.5 h-3.5 text-foreground/40 fill-foreground/40" />
                                    <span className="text-[10px] uppercase tracking-[0.2em] font-black text-foreground/40">
                                        Acesso Antecipado
                                    </span>
                                </motion.div>
                            </div>
                            <DialogTitle className="text-3xl md:text-4xl font-bold text-center tracking-tight leading-tight">
                                Entre para a <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-b from-foreground via-foreground/80 to-foreground/40">
                                    Vanguarda Clínica.
                                </span>
                            </DialogTitle>
                            <DialogDescription className="text-center text-muted-foreground/60 text-base font-medium">
                                Seja um dos primeiros a experimentar o futuro da neuropsicologia digital e garanta benefícios exclusivos de fundação.
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold ml-1">Nome Completo</Label>
                                <Input
                                    id="name"
                                    required
                                    placeholder="Dr(a). Nome Sobrenome"
                                    className="h-12 bg-foreground/[0.02] border-foreground/10 focus:border-foreground/20 transition-all rounded-xl placeholder:text-muted-foreground/30"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="crp" className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold ml-1">CRP (Opcional)</Label>
                                    <Input
                                        id="crp"
                                        placeholder="00/00000"
                                        className="h-12 bg-foreground/[0.02] border-foreground/10 focus:border-foreground/20 transition-all rounded-xl placeholder:text-muted-foreground/30"
                                        value={formData.crp}
                                        onChange={(e) => setFormData({ ...formData, crp: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="whatsapp" className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold ml-1">WhatsApp</Label>
                                    <Input
                                        id="whatsapp"
                                        placeholder="(00) 00000-0000"
                                        className="h-12 bg-foreground/[0.02] border-foreground/10 focus:border-foreground/20 transition-all rounded-xl placeholder:text-muted-foreground/30"
                                        value={formData.whatsapp}
                                        onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold ml-1">E-mail Profissional</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    required
                                    placeholder="seu@email.com"
                                    className="h-12 bg-foreground/[0.02] border-foreground/10 focus:border-foreground/20 transition-all rounded-xl placeholder:text-muted-foreground/30"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>

                            <div className="pt-4">
                                <Button
                                    disabled={isLoading}
                                    className="w-full h-14 bg-foreground text-background hover:bg-foreground/90 rounded-2xl font-black text-sm uppercase tracking-[0.15em] transition-all group shadow-xl"
                                >
                                    {isLoading ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-background/20 border-t-background rounded-full animate-spin" />
                                            <span>Processando...</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <span>Solicitar Convite</span>
                                            <Send className="w-4 h-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                                        </div>
                                    )}
                                </Button>
                            </div>

                            <div className="flex items-center justify-center gap-4 py-4 opacity-40">
                                <div className="flex items-center gap-1.5 grayscale">
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    <span className="text-[9px] font-bold uppercase tracking-widest">LGPD Compliant</span>
                                </div>
                                <div className="w-[1px] h-3 bg-foreground/20" />
                                <div className="flex items-center gap-1.5 grayscale">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span className="text-[9px] font-bold uppercase tracking-widest">Premium Access</span>
                                </div>
                            </div>
                        </form>
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-10 text-center flex flex-col items-center justify-center min-h-[400px]"
                    >
                        <div className="relative mb-8">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", damping: 15, stiffness: 200, delay: 0.2 }}
                                className="w-24 h-24 rounded-full bg-foreground flex items-center justify-center shadow-2xl relative z-10"
                            >
                                <CheckCircle2 className="w-10 h-10 text-background" />
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1.5 }}
                                transition={{ duration: 1, repeat: Infinity, repeatType: "reverse" }}
                                className="absolute inset-0 bg-foreground/10 rounded-full blur-2xl"
                            />
                        </div>

                        <div className="mb-10">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-foreground/[0.03] border border-foreground/10 mb-4">
                                <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                                <span className="text-[10px] uppercase tracking-[0.2em] font-black text-foreground">
                                    Selo Primeiros Parceiros
                                </span>
                            </div>
                            <h2 className="text-3xl font-bold mb-4 tracking-tight">Você está na fila!</h2>
                            <p className="text-muted-foreground/70 font-medium max-w-sm mx-auto">
                                Verifique seu e-mail em breve. Você receberá seu convite exclusivo e detalhes sobre o badge de <strong>Membro Fundador</strong>.
                            </p>
                        </div>

                        <Button
                            onClick={() => onOpenChange(false)}
                            variant="outline"
                            className="h-12 px-8 rounded-full border-foreground/10 hover:bg-foreground/[0.02] text-[10px] uppercase tracking-widest font-black"
                        >
                            Fechar Portal
                        </Button>
                    </motion.div>
                )}
            </DialogContent>
        </Dialog>
    );
};
