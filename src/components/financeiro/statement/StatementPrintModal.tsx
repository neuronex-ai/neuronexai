import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useProfile } from "@/hooks/use-profile";
import { Transaction } from "@/types";
import { FileText, Printer } from "lucide-react";
import { useRef } from "react";
import { FinancialStatementTemplate } from "./FinancialStatementTemplate";

interface StatementPrintModalProps {
  children?: React.ReactNode;
  transactions: Transaction[];
  dateRange: { from: Date | undefined; to: Date | undefined };
  summary: { income: number; expense: number; balance: number };
}

export const StatementPrintModal = ({ children, transactions, dateRange, summary }: StatementPrintModalProps) => {
  const { data: profile } = useProfile();
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    
    const printWindow = window.open('', '', 'height=900,width=1000');
    if (printWindow) {
        printWindow.document.write('<html><head><title>Extrato NeuroFinance</title>');
        printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
        printWindow.document.write('<style>@import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;900&display=swap"); body { font-family: "Inter", sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; }</style>');
        printWindow.document.write('</head><body class="bg-gray-100 flex justify-center p-0">');
        printWindow.document.write(content.innerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        
        setTimeout(() => {
            printWindow.print();
        }, 1000);
    }
  };

  const professionalName = profile ? `${profile.first_name} ${profile.last_name}` : "Profissional responsavel";

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children || (
            <Button variant="outline" size="sm" className="gap-2">
                <Printer className="h-4 w-4" /> Imprimir
            </Button>
        )}
      </DialogTrigger>
      <DialogContent className="finance-modal-surface max-w-[900px] bg-[#0A0A0B] border-white/10 shadow-2xl p-0 overflow-hidden rounded-[32px] h-[90vh] flex flex-col outline-none">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 bg-white/[0.02] shrink-0 flex items-center justify-between">
            <DialogTitle className="text-white flex items-center gap-3 text-lg font-bold">
                <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                    <FileText className="h-5 w-5 text-white/70" /> 
                </div>
                Extrato NeuroFinance
            </DialogTitle>
            
            <div className="text-[10px] bg-white/5 border border-white/10 px-3 py-1 rounded-full text-white/50 uppercase tracking-widest font-bold">
                Formato A4
            </div>
        </div>

        {/* Content (Scrollable) */}
        <div className="flex-1 bg-[#151518] p-8 overflow-y-auto flex justify-center relative">
            <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] pointer-events-none" />
            
            <div className="origin-top transform scale-[0.6] sm:scale-[0.8] transition-transform duration-500">
                <div ref={printRef} className="shadow-2xl">
                    <FinancialStatementTemplate 
                        transactions={transactions}
                        period={dateRange}
                        summary={summary}
                        professionalName={professionalName}
                    />
                </div>
            </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-white/10 bg-[#0A0A0B] flex justify-end shrink-0 relative z-20">
            <Button onClick={handlePrint} className="bg-white text-black hover:bg-white/90 gap-2 font-bold uppercase text-xs tracking-widest rounded-xl h-12 px-8 shadow-lg transition-transform active:scale-95">
                <Printer className="h-4 w-4" /> Imprimir extrato
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
