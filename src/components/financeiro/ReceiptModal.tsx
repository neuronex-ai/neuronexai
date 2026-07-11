import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, FileCheck, Mail, Loader2, ShieldCheck } from "lucide-react";
import { Transaction } from "@/types";
import { useProfile } from "@/hooks/use-profile";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";
import { useRef, useState } from "react";
import { BrandInvoiceTemplate } from "./BrandInvoiceTemplate";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { generateReceiptPDFBase64, ReceiptPDFData } from "@/lib/pdf-generator";

interface ReceiptModalProps {
    transaction: Transaction;
    children: React.ReactNode;
    patientEmail?: string;
}

export const ReceiptModal = ({ transaction, children, patientEmail }: ReceiptModalProps) => {
    const { data: profile } = useProfile();
    const printRef = useRef<HTMLDivElement>(null);
    const [isSending, setIsSending] = useState(false);
    const metadata=(transaction.metadata||{})as Record<string,unknown>;const isNeuroFinance=Boolean(transaction.origin==="gateway_auto"||metadata.neurofinance_charge_id||metadata.neurofinance_transaction_id||metadata.asaas_payment_id);const documentBrand=isNeuroFinance?"NeuroFinance":"NeuroNex";

    const handlePrint = () => {
        if(!canIssueReceipt){toast.error("Complete seu nome profissional e CRP no perfil antes de emitir o recibo.");return;}
        const content = printRef.current;
        if (!content) return;

        const printWindow = window.open('', '', 'height=800,width=900');
        if (printWindow) {
            printWindow.document.write('<html><head><title>Recibo</title>');
            printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
            printWindow.document.write('<style>@import url("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;600;700&display=swap"); body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }</style>');
            printWindow.document.write('</head><body class="bg-gray-100 flex justify-center items-center min-h-screen p-8">');
            printWindow.document.write(content.innerHTML);
            printWindow.document.write('</body></html>');
            printWindow.document.close();

            setTimeout(() => {
                printWindow.print();
            }, 1000);
        }
    };

    const handleSendEmail = async () => {
        if(!canIssueReceipt){toast.error("Complete seu nome profissional e CRP no perfil antes de emitir o recibo.");return;}
        if (!patientEmail) {
            toast.error("Email do paciente não disponível para envio.");
            return;
        }

        setIsSending(true);
        try {
            const receiptData: ReceiptPDFData = {
                professionalName,
                professionalRegistry,
                patientName,
                amountFormatted: formatCurrency(transaction.amount),
                description: transaction.description,
                date: dateStr,
                location: locationCity
            };

            const pdfBase64 = await generateReceiptPDFBase64(receiptData);

            const { error } = await supabase.functions.invoke('send-document-email', {
                body: {
                    to: patientEmail,
                    subject: `Recibo ${documentBrand} - ${patientName}`,
                    htmlBody: `
                    <div style="font-family: sans-serif; color: #333;">
                        <h2>Olá, ${patientName}.</h2>
                        <p>Segue em anexo o seu recibo ${documentBrand} referente à ${transaction.description}.</p>
                        <p><strong>Valor:</strong> ${formatCurrency(transaction.amount)}</p>
                        <p><strong>Data:</strong> ${dateStr}</p>
                        <br/>
                        <p>Atenciosamente,<br/>${professionalName}</p>
                    </div>
                `,
                    documentType: `Recibo ${documentBrand}`,
                    pdfAttachment: {
                        filename: `recibo_${patientName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`,
                        content: pdfBase64,
                        contentType: 'application/pdf'
                    }
                }
            });

            if (error) throw error;
            toast.success("Recibo enviado com sucesso!");
        } catch (error: any) {
            console.error("Erro ao enviar recibo:", error);
            toast.error("Erro ao enviar recibo. Tente novamente.");
        } finally {
            setIsSending(false);
        }
    };

    const professionalName = [profile?.first_name,profile?.last_name].filter(Boolean).join(" ").trim()||profile?.full_name?.trim()||profile?.name?.trim()||"";
    const professionalRegistry = profile?.crp?.trim() ? `CRP: ${profile.crp.trim()}` : "";
    const canIssueReceipt=Boolean(professionalName&&professionalRegistry);
    const dateStr = format(new Date(transaction.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const locationCity = profile?.address?.trim()||"Local não informado";
    const patientName = (transaction as any).patient_name || (transaction as any).patients?.name || transaction.description.replace('Sessão - ', '') || "Paciente";

    return (
        <Dialog>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="finance-modal-surface max-w-[1000px] bg-background dark:bg-[#020204] border-border/10 dark:border-white/10 shadow-2xl p-0 overflow-hidden rounded-[32px] outline-none">
                <div className="flex flex-col h-[90vh]">

                    {/* Header */}
                    <div className="h-16 border-b border-border/10 dark:border-white/5 bg-card dark:bg-[#0A0A0B] flex items-center justify-between px-8 shrink-0">
                        <div className="flex items-center gap-2 text-foreground dark:text-white">
                            <FileCheck className="h-5 w-5 text-primary" />
                            <span className="font-bold text-sm tracking-wide">Recibo {documentBrand}</span>
                        </div>
                        <div className="flex gap-2">
                            <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground md:flex dark:border-white/10 dark:bg-white/[0.035]">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                White-label
                            </div>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleSendEmail}
                                disabled={isSending||!canIssueReceipt}
                                className="h-9 rounded-full hover:bg-secondary/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground dark:hover:text-white transition-all text-xs font-bold uppercase tracking-wider"
                            >
                                {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5 mr-2" />}
                                Enviar
                            </Button>
                            <Button
                                size="sm"
                                onClick={handlePrint}
                                disabled={!canIssueReceipt}
                                className="h-9 px-6 rounded-full bg-foreground text-background hover:bg-foreground/90 dark:bg-white dark:text-black dark:hover:bg-white/90 font-bold text-xs uppercase tracking-widest shadow-lg"
                            >
                                <Printer className="h-3.5 w-3.5 mr-2" /> Imprimir
                            </Button>
                        </div>
                    </div>

                    {/* Preview Area (Desk Surface) */}
                    <div className="flex-1 bg-secondary/5 dark:bg-[#050505] relative overflow-hidden flex items-center justify-center p-8 md:p-12">
                        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] pointer-events-none" />
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/5 blur-[120px] pointer-events-none" />

                        {/* Scrollable Paper Container */}
                        <div className="w-full h-full overflow-y-auto custom-scrollbar flex justify-center items-start">
                            <div ref={printRef} className="w-full max-w-[700px] shadow-[0_0_50px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_0_50px_-10px_rgba(0,0,0,0.5)] origin-top transform transition-transform duration-300">
                                <BrandInvoiceTemplate
                                    logoUrl="/logo-invoice.png"
                                    professionalName={professionalName}
                                    professionalRegistry={professionalRegistry}
                                    patientName={patientName}
                                    amountFormatted={formatCurrency(transaction.amount)}
                                    description={transaction.description}
                                    date={dateStr}
                                    location={locationCity}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
