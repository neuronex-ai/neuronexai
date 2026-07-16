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

  const professionalName = profile ? `${profile.first_name} ${profile.last_name}` : "Profissional responsável";

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children || (
            <Button variant="outline" size="sm" className="gap-2">
                <Printer className="h-4 w-4" /> Imprimir
            </Button>
        )}
      </DialogTrigger>
      <DialogContent className="finance-modal-surface flex h-[90vh] max-w-[900px] flex-col gap-0 overflow-hidden rounded-[32px] border border-border/55 bg-background/96 p-0 text-foreground shadow-2xl outline-none">
        
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border/45 bg-background/72 px-6 py-5 backdrop-blur-xl">
            <DialogTitle className="flex items-center gap-3 text-lg font-semibold tracking-tight text-foreground">
                <div className="grid h-10 w-10 place-items-center rounded-[14px] border border-border/45 bg-muted/70 text-muted-foreground shadow-sm">
                    <FileText className="h-5 w-5" aria-hidden="true" />
                </div>
                Extrato NeuroFinance
            </DialogTitle>
            
            <div className="mr-8 rounded-full border border-border/45 bg-muted/55 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Formato A4
            </div>
        </div>

        {/* Content (Scrollable) */}
        <div className="relative flex flex-1 justify-center overflow-y-auto bg-muted/55 p-8 dark:bg-black/35">
            <div className="pointer-events-none absolute inset-0 bg-[url('/noise.png')] opacity-[0.025] dark:opacity-[0.035]" />
            
            <div className="origin-top scale-[0.6] transform transition-transform duration-300 motion-reduce:transition-none sm:scale-[0.8]">
                <div ref={printRef} className="overflow-hidden rounded-sm shadow-[0_24px_70px_-24px_rgba(24,24,27,0.34)] dark:shadow-[0_28px_90px_-24px_rgba(0,0,0,0.82)]">
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
        <div className="relative z-20 flex shrink-0 justify-end border-t border-border/45 bg-background/78 px-6 py-5 backdrop-blur-xl">
            <Button onClick={handlePrint} className="h-11 gap-2 rounded-[14px] bg-foreground px-7 text-xs font-semibold uppercase tracking-[0.14em] text-background shadow-md transition-[background-color,transform] hover:bg-foreground/90 active:scale-[0.98] motion-reduce:transition-none">
                <Printer className="h-4 w-4" aria-hidden="true" /> Imprimir extrato
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
