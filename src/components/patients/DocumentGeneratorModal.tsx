import { useAuth } from "@/components/auth/SessionContextProvider";
import { RichTextEditor } from "@/components/notes/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveModal } from "@/components/ui/ResponsiveModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { DocumentPDFData, downloadDocumentPDF, generateDocumentPDFBase64 } from "@/lib/pdf-generator";
import { Patient } from "@/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, FileText, Loader2, Printer, Send, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { StandardDocumentTemplate } from "./StandardDocumentTemplate";

interface DocumentGeneratorModalProps {
    patient: Patient;
    children: React.ReactNode;
}

const DEFAULT_CONTENT = `
    <p>Declaro para os devidos fins que o(a) paciente encontra-se em acompanhamento psicológico sob meus cuidados, com sessões semanais, visando a promoção de sua saúde mental e bem-estar.</p>
    <p>O tratamento iniciou-se em <strong>${new Date().toLocaleDateString('pt-BR')}</strong> e não há previsão de alta no momento.</p>
    <p>Coloco-me à disposição para quaisquer esclarecimentos necessários.</p>
`;

export const DocumentGeneratorModal = ({ patient, children }: DocumentGeneratorModalProps) => {
    const [open, setOpen] = useState(false);
    const isMobile = useIsMobile();
    const { data: profile } = useProfile();
    const { user: _user } = useAuth();
    const printRef = useRef<HTMLDivElement>(null);
    const [isSending, setIsSending] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

    const [docType, setDocType] = useState("Declaração");
    const [title, setTitle] = useState("DECLARAÇáO DE COMPARECIMENTO");
    const [content, setContent] = useState(DEFAULT_CONTENT);

    const professionalName = profile ? `${profile.first_name} ${profile.last_name}` : "Seu Nome";
    const registry = profile?.crp ? `CRP: ${profile.crp}` : "";
    const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

    const handleTypeChange = (val: string) => {
        setDocType(val);
        if (val === 'Atestado') {
            setTitle('ATESTADO PSICOLÓGICO');
            setContent(`<p>Atesto para os devidos fins que <strong>${patient.name}</strong> esteve sob meus cuidados...</p>`);
        } else {
            setTitle(val.toUpperCase());
            setContent(DEFAULT_CONTENT);
        }
    };

    const handlePrint = () => {
        const contentEl = printRef.current;
        if (!contentEl) return;

        const printWindow = window.open('', '', 'height=900,width=850');
        if (printWindow) {
            printWindow.document.write('<html><head><title>Imprimir Documento</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-100 flex justify-center p-0">');
            printWindow.document.write(contentEl.innerHTML);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            setTimeout(() => printWindow.print(), 1000);
        }
    };

    const getPDFData = (): DocumentPDFData => ({
        type: docType,
        title: title,
        content: content,
        patientName: patient.name,
        patientDoc: patient.payer_cpf || undefined,
        professionalName: professionalName,
        professionalRegistry: registry,
        date: today,
        clinicName: profile?.clinic_name || undefined
    });

    const handleDownloadPDF = async () => {
        setIsGeneratingPDF(true);
        try {
            await downloadDocumentPDF(getPDFData(), `${docType.toLowerCase()}_${patient.name.replace(/\s+/g, '_')}.pdf`);
            toast.success("PDF gerado com sucesso!");
        } catch (e) {
            toast.error("Erro ao gerar PDF.");
            console.error(e);
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    const handleSendEmail = async () => {
        if (!patient.email) {
            toast.error("Paciente não possui e-mail cadastrado.");
            return;
        }

        setIsSending(true);
        try {
            const pdfBase64 = await generateDocumentPDFBase64(getPDFData());

            const { error } = await supabase.functions.invoke('send-document-email', {
                body: {
                    to: patient.email,
                    subject: `${title} - ${patient.name}`,
                    htmlBody: content,
                    documentType: docType,
                    pdfAttachment: {
                        filename: `${docType.toLowerCase()}_${patient.name.replace(/\s+/g, '_')}.pdf`,
                        content: pdfBase64,
                        contentType: 'application/pdf'
                    }
                }
            });

            if (error) throw error;
            toast.success("Documento enviado por e-mail!");
        } catch (e: any) {
            toast.error(`Erro ao enviar: ${e.message}`);
            console.error(e);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <ResponsiveModal
            open={open}
            onOpenChange={setOpen}
            trigger={children}
            className="max-w-[1400px] h-[90vh] bg-card/95 border-border/20 p-0 overflow-hidden rounded-[24px] shadow-2xl outline-none [&>button]:hidden text-foreground"
            drawerClassName="bg-card border-t border-border/20 h-[95vh]"
        >
            <div className="flex flex-col lg:flex-row h-full overflow-hidden bg-background">
                <div className="w-full lg:w-[480px] flex flex-col border-b lg:border-b-0 lg:border-r border-border/10 bg-card relative z-20 shadow-2xl">
                    <div className="p-6 border-b border-border/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-glow">
                                <FileText className="h-4 w-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Editor</h3>
                                <p className="text-[10px] text-muted-foreground">Documentos Oficiais</p>
                            </div>
                        </div>
                        {isMobile && <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button>}
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Tipo de Documento</Label>
                            <Select onValueChange={handleTypeChange} value={docType}>
                                <SelectTrigger className="bg-secondary/20 border-border/10 h-11 rounded-xl text-foreground"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-card border-border/10">
                                    <SelectItem value="Declaração">Declaração</SelectItem>
                                    <SelectItem value="Atestado">Atestado</SelectItem>
                                    <SelectItem value="Laudo">Laudo</SelectItem>
                                    <SelectItem value="Encaminhamento">Encaminhamento</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Título</Label>
                            <Input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="bg-secondary/20 border-border/10 h-11 rounded-xl text-foreground font-bold"
                            />
                        </div>

                        <div className="space-y-2 flex-1 flex flex-col min-h-[300px]">
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Conteúdo</Label>
                            <div className="flex-1 border border-border/10 rounded-xl overflow-hidden bg-secondary/10">
                                <RichTextEditor
                                    content={content}
                                    onChange={setContent}
                                    className="prose-sm p-4 text-foreground/80 min-h-[200px]"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-6 border-t border-border/10 space-y-3 bg-card">
                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                onClick={handleDownloadPDF}
                                disabled={isGeneratingPDF}
                                className="bg-foreground text-background hover:bg-foreground/90 h-11 rounded-xl font-bold uppercase text-xs tracking-widest gap-2 shadow-lg transition-transform active:scale-95"
                            >
                                {isGeneratingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                Baixar PDF
                            </Button>
                            <Button
                                onClick={handlePrint}
                                variant="outline"
                                className="h-11 rounded-xl font-bold uppercase text-xs tracking-widest gap-2 border-border/10 hover:bg-secondary/20"
                            >
                                <Printer className="h-4 w-4" />
                                Imprimir
                            </Button>
                        </div>
                        <Button
                            onClick={handleSendEmail}
                            disabled={isSending || !patient.email}
                            variant="outline"
                            className="w-full h-11 rounded-xl font-bold uppercase text-xs tracking-widest gap-2 border-border/10 hover:bg-secondary/20"
                        >
                            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            Enviar por Email
                        </Button>
                    </div>
                </div>

                <div className="flex-1 bg-secondary/5 relative overflow-hidden flex flex-col items-center p-8 md:p-12">
                    <div className="absolute top-6 right-6 z-20 flex gap-4 items-center">
                        <div className="px-3 py-1.5 rounded-lg bg-card/60 border border-border/10 backdrop-blur-md text-[10px] font-bold uppercase tracking-widest text-muted-foreground shadow-xl pointer-events-none">
                            Visualização A4
                        </div>
                        {!isMobile && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setOpen(false)}
                                className="h-8 w-8 rounded-full bg-black/20 hover:bg-secondary/40 text-muted-foreground hover:text-foreground border border-border/10 transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>

                    <div className="w-full h-full overflow-y-auto custom-scrollbar flex justify-center items-start pt-4 pb-20">
                        <div className="origin-top transform transition-transform duration-500 scale-[0.6] sm:scale-[0.7] md:scale-[0.8] lg:scale-[0.85] xl:scale-[0.9]">
                            <div ref={printRef} className="shadow-[0_0_60px_-15px_rgba(0,0,0,0.2)]">
                                <StandardDocumentTemplate
                                    type={docType}
                                    title={title}
                                    content={content}
                                    patientName={patient.name}
                                    patientDoc={patient.payer_cpf || undefined}
                                    professionalName={professionalName}
                                    professionalRegistry={registry}
                                    date={today}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </ResponsiveModal>
    );
};
