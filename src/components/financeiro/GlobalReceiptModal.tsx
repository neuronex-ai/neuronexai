import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/hooks/use-profile";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CreditCard, DollarSign, FileText, Printer, User } from "lucide-react";
import { useRef, useState } from "react";
import { BrandInvoiceTemplate } from "./BrandInvoiceTemplate";
import { formatDocumentInput, formatMoneyInput, moneyInputToNumber } from "@/lib/financial-input";

interface GlobalReceiptModalProps {
    children?: React.ReactNode;
}

export const GlobalReceiptModal = ({ children }: GlobalReceiptModalProps) => {
    const { data: profile } = useProfile();
    const printRef = useRef<HTMLDivElement>(null);

    // Form State
    const [name, setName] = useState("");
    const [cpf, setCpf] = useState("");
    const [amount, setAmount] = useState("");
    const [service, setService] = useState("Sessão de Psicoterapia");

    const handlePrint = () => {
        const content = printRef.current;
        if (!content) return;

        const printWindow = window.open('', '', 'height=800,width=900');
        if (printWindow) {
            printWindow.document.write('<html><head><title>Recibo</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-100 flex justify-center p-8">');
            printWindow.document.write(content.innerHTML);
            printWindow.document.write('</body></html>');
            printWindow.document.close();

            setTimeout(() => {
                printWindow.print();
            }, 1000);
        }
    };

    const professionalName = profile ? `${profile.first_name} ${profile.last_name}` : "Psicólogo Responsável";
    const professionalRegistry = profile?.crp ? `CRP: ${profile.crp}` : "";
    const locationCity = profile?.address ? profile.address.split('-').pop()?.trim() : "São Paulo, SP";
    const numericAmount = moneyInputToNumber(amount);
    const dateStr = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

    // Botão Padrão se não for passado children
    const TriggerButton = children || (
        <Button variant="outline" size="sm" className="gap-2 border-white/10 bg-white/5 hover:bg-white/10 text-white h-9 px-4 rounded-full">
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Recibo Avulso</span>
        </Button>
    );

    return (
        <Dialog>
            <DialogTrigger asChild>
                {TriggerButton}
            </DialogTrigger>
            <DialogContent className="finance-modal-surface sm:max-w-[1100px] bg-[#0A0A0B] border-white/10 shadow-2xl p-0 overflow-hidden rounded-[24px] flex flex-col md:flex-row h-[90vh] md:h-[85vh] outline-none">

                {/* Left: Form */}
                <div className="w-full md:w-[360px] p-8 border-b md:border-b-0 md:border-r border-white/10 bg-white/[0.02] flex flex-col gap-6 shrink-0 overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-white flex items-center gap-3 text-lg font-bold tracking-tight">
                            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                                <Printer className="h-5 w-5" />
                            </div>
                            Gerador de Recibo
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-5 mt-2">
                        <div className="space-y-2">
                            <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider ml-1">Paciente</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Nome completo" value={name} onChange={e => setName(e.target.value)} className="pl-9 bg-black/20 border-white/10 h-11 rounded-xl focus-visible:ring-primary/20 text-white" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider ml-1">CPF (Opcional)</label>
                            <div className="relative">
                                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="000.000.000-00" value={cpf} onChange={e => setCpf(formatDocumentInput(e.target.value))} className="pl-9 bg-black/20 border-white/10 h-11 rounded-xl focus-visible:ring-primary/20 text-white" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider ml-1">Valor</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input inputMode="decimal" placeholder="0,00" value={amount} onChange={e => setAmount(formatMoneyInput(e.target.value))} className="pl-9 bg-black/20 border-white/10 h-11 rounded-xl focus-visible:ring-primary/20 text-white font-bold" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider ml-1">Descrição</label>
                            <div className="relative">
                                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Serviço prestado" value={service} onChange={e => setService(e.target.value)} className="pl-9 bg-black/20 border-white/10 h-11 rounded-xl focus-visible:ring-primary/20 text-white" />
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto pt-4 space-y-3">
                        <Button onClick={handlePrint} className="w-full bg-white text-black hover:bg-white/90 shadow-glow gap-2 h-12 rounded-xl font-bold uppercase text-xs tracking-widest transition-transform active:scale-95" disabled={!name || !amount}>
                            <Printer className="h-4 w-4" /> Imprimir Recibo
                        </Button>
                    </div>
                </div>

                {/* Right: Preview */}
                <div className="flex-1 p-8 bg-[#151518] overflow-y-auto flex justify-center items-start relative">
                    <div className="absolute top-6 right-6 z-20">
                        <div className="bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest text-white/50 shadow-xl">
                            Visualização A4
                        </div>
                    </div>

                    <div ref={printRef} className="w-full max-w-[700px] transform scale-[0.6] sm:scale-[0.75] md:scale-[0.85] lg:scale-[0.9] origin-top transition-transform duration-300 shadow-2xl mt-4">
                        <BrandInvoiceTemplate
                            logoUrl="/logo-invoice.png"
                            professionalName={professionalName}
                            professionalRegistry={professionalRegistry}
                            patientName={name || "Nome do Paciente"}
                            patientDoc={cpf}
                            amountFormatted={formatCurrency(numericAmount)}
                            description={service}
                            date={dateStr}
                            location={locationCity}
                        />
                    </div>
                </div>

            </DialogContent>
        </Dialog>
    );
};
