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
    patient: Patient | undefined | null;
    meetLink: string;
    therapistName: string;
}

export const InvitePatientModal = ({ isOpen, onClose, patient, meetLink, therapistName }: InvitePatientModalProps) => {
    const [copied, setCopied] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);

    const handleCopyLink = () => {
        navigator.clipboard.writeText(meetLink);
        setCopied(true);
        toast.success("Link copiado!");
        setTimeout(() => setCopied(false), 2000);
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

        window.open(url, '_blank');
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
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="desktop-retina-modal desktop-retina-form bg-white/60 dark:bg-[#0c0c0c]/96 backdrop-blur-[40px] border border-white/20 dark:border-white/10 rounded-[32px] sm:max-w-[480px] p-0 overflow-hidden gap-0">

                <div className="p-8 pb-6 border-b border-white/10 dark:border-white/5 bg-white/10 dark:bg-white/[0.02]">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight text-center">Enviar Convite</DialogTitle>
                        <DialogDescription className="text-center text-zinc-500 dark:text-zinc-400 font-light pt-2">
                            Escolha como deseja notificar <span className="text-zinc-900 dark:text-white font-medium">{patient?.name || 'o paciente'}</span> para entrar na sala.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <Button
                            onClick={handleWhatsApp}
                            variant="outline"
                            className="h-32 flex flex-col items-center justify-center gap-4 bg-white/20 dark:bg-black/20 border-white/20 dark:border-white/10 hover:bg-white/40 dark:hover:bg-white/10 hover:border-emerald-500/30 transition-all duration-500 ease-apple group rounded-[24px]"
                        >
                            <div className="w-12 h-12 rounded-[18px] bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-lg">
                                <Phone className="w-5 h-5 text-zinc-600 dark:text-zinc-400 group-hover:text-emerald-500 transition-colors" />
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 group-hover:text-emerald-500 transition-colors">WhatsApp</span>
                        </Button>

                        <Button
                            onClick={handleEmail}
                            disabled={isSendingEmail}
                            variant="outline"
                            className="h-32 flex flex-col items-center justify-center gap-4 bg-white/20 dark:bg-black/20 border-white/20 dark:border-white/10 hover:bg-white/40 dark:hover:bg-white/10 hover:border-blue-500/30 transition-all duration-500 ease-apple group rounded-[24px]"
                        >
                            <div className="w-12 h-12 rounded-[18px] bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-lg">
                                {isSendingEmail ? <Loader2 className="w-5 h-5 animate-spin text-zinc-500" /> : <Mail className="w-5 h-5 text-zinc-600 dark:text-zinc-400 group-hover:text-blue-500 transition-colors" />}
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 group-hover:text-blue-500 transition-colors">
                                {isSendingEmail ? "Enviando..." : "Gmail"}
                            </span>
                        </Button>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-white/10 dark:border-white/5" />
                        </div>
                        <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
                            <span className="bg-transparent px-3 text-zinc-400 dark:text-zinc-600">Link da Sala</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 p-1.5 pl-5 rounded-[20px] bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 group hover:border-black/10 dark:hover:border-white/10 transition-colors">
                        <div className="flex-1 overflow-hidden">
                            <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate font-mono select-all">
                                {meetLink}
                            </p>
                        </div>
                        <Button
                            size="sm"
                            onClick={handleCopyLink}
                            className={cn(
                                "h-9 px-5 rounded-[16px] font-bold text-[10px] uppercase tracking-wider transition-all duration-300 shadow-sm",
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
