import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Copy, CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Patient } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface InvitePatientModalProps {
    isOpen: boolean;
    onClose: () => void;
    appointmentId: string;
    patient: Patient | undefined | null;
    meetLink: string;
    therapistName: string;
}

export const InvitePatientModal = ({ isOpen, onClose, appointmentId, patient, meetLink, therapistName }: InvitePatientModalProps) => {
    const [copied, setCopied] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(meetLink);
            setCopied(true);
            toast.success("Link copiado.");
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error("Não foi possível copiar o link.");
        }
    };

    const handleWhatsApp = () => {
        if (!patient?.phone) {
            toast.error("Telefone do paciente não cadastrado.");
            return;
        }

        const digits = patient.phone.replace(/\D/g, '');
        const phone = digits.startsWith('55') ? digits : `55${digits}`;
        const message = `Olá, ${patient.name}. Sua teleconsulta já vai começar. Acesse pelo link: ${meetLink}`;
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

        window.open(url, '_blank', 'noopener,noreferrer');
        onClose();
    };

    const handleEmail = async () => {
        if (!patient?.email) {
            toast.error("E-mail do paciente não cadastrado.");
            return;
        }

        setIsSendingEmail(true);
        try {
            const { error } = await supabase.functions.invoke('send-google-invite', {
                body: {
                    appointmentId,
                    patientEmail: patient.email,
                    patientName: patient.name,
                    meetLink,
                    therapistName,
                }
            });

            if (error) throw error;

            toast.success("Convite enviado via Gmail!");
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Erro ao enviar e-mail. Verifique a conexão com o Google.");
        } finally {
            setIsSendingEmail(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent
                overlayClassName="teleconsultation-overlay !backdrop-blur-none"
                className="teleconsultation-surface desktop-retina-form !w-[min(540px,calc(100vw-2rem))] !max-w-[min(540px,calc(100vw-2rem))] gap-0 overflow-hidden rounded-[30px] p-0"
            >

                <div className="border-b border-border/40 px-6 pb-5 pt-7 dark:border-white/[0.045] sm:px-7">
                    <DialogHeader className="pr-0 text-center">
                        <DialogTitle className="text-center text-2xl font-black tracking-[-0.04em] text-foreground">Enviar convite</DialogTitle>
                        <DialogDescription className="mx-auto max-w-[420px] pt-2 text-center font-medium leading-relaxed text-muted-foreground">
                            Escolha como deseja notificar <span className="text-zinc-900 dark:text-white font-medium">{patient?.name || 'o paciente'}</span> para entrar na sala.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="space-y-5 p-6 sm:p-7">
                    <div className="grid grid-cols-2 gap-4">
                        <Button
                            onClick={handleWhatsApp}
                            variant="outline"
                            className="teleconsultation-inset teleconsultation-action group flex h-28 flex-col items-center justify-center gap-3 rounded-[22px] hover:border-emerald-500/25"
                        >
                            <div className="flex h-12 w-12 items-center justify-center rounded-[17px] bg-foreground/[0.05]">
                                <Phone className="w-5 h-5 text-zinc-600 dark:text-zinc-400 group-hover:text-emerald-500 transition-colors" />
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 group-hover:text-emerald-500 transition-colors">WhatsApp</span>
                        </Button>

                        <Button
                            onClick={handleEmail}
                            disabled={isSendingEmail}
                            variant="outline"
                            className="teleconsultation-inset teleconsultation-action group flex h-28 flex-col items-center justify-center gap-3 rounded-[22px] hover:border-sky-500/25"
                        >
                            <div className="flex h-12 w-12 items-center justify-center rounded-[17px] bg-foreground/[0.05]">
                                {isSendingEmail ? <Loader2 className="w-5 h-5 animate-spin text-zinc-500" /> : <Mail className="w-5 h-5 text-zinc-600 dark:text-zinc-400 group-hover:text-blue-500 transition-colors" />}
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 group-hover:text-blue-500 transition-colors">
                                {isSendingEmail ? "Enviando..." : "Gmail"}
                            </span>
                        </Button>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-border/45 dark:border-white/[0.045]" />
                        </div>
                        <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
                            <span className="bg-transparent px-3 text-zinc-400 dark:text-zinc-600">Link da Sala</span>
                        </div>
                    </div>

                    <div className="teleconsultation-inset flex min-w-0 items-center gap-2 rounded-[18px] p-1.5 pl-4">
                        <div className="min-w-0 flex-1 overflow-hidden">
                            <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate font-mono select-all">
                                {meetLink}
                            </p>
                        </div>
                        <Button
                            size="sm"
                            onClick={() => void handleCopyLink()}
                            className={cn(
                                "teleconsultation-action h-11 rounded-[14px] px-5 text-[10px] font-bold uppercase tracking-wider shadow-none",
                                copied ? "bg-emerald-500 text-white hover:bg-emerald-600" : "bg-white/80 dark:bg-white/10 text-zinc-800 dark:text-white hover:bg-white hover:text-black dark:hover:bg-white/20"
                            )}
                        >
                            {copied ? <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Copiado</span> : <span className="flex items-center gap-1.5"><Copy className="w-3.5 h-3.5" /> Copiar</span>}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
