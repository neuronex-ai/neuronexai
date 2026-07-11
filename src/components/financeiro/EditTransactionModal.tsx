import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { Edit, DollarSign } from "lucide-react";
import { Transaction } from "@/types";
import { EditTransactionForm } from "./EditTransactionForm";
import { useIsMobile } from "@/hooks/use-mobile";

interface EditTransactionModalProps {
  transaction: Transaction;
  children: React.ReactNode;
}

export const EditTransactionModal = ({ transaction, children }: EditTransactionModalProps) => {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const HeaderContent = () => (
    <div className="space-y-2 text-center mb-6">
      <div className="flex items-center justify-center gap-2">
        <DollarSign className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold tracking-tight text-foreground dark:text-white">Editar Transação</h2>
      </div>
      <p className="text-xs text-muted-foreground uppercase tracking-widest">
        {transaction.description}
      </p>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          {children}
        </DrawerTrigger>
        <DrawerContent className="bg-background dark:bg-[#0A0A0B] border-t border-border/10 dark:border-white/10 max-h-[90vh]">
          <div className="p-6 overflow-y-auto">
            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-secondary dark:bg-white/10 mb-6" />
            <HeaderContent />
            <EditTransactionForm transaction={transaction} onSuccess={() => setOpen(false)} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="finance-modal-surface sm:max-w-[480px] p-0 border border-border/10 dark:border-white/10 bg-card dark:bg-[#0A0A0B] shadow-2xl gap-0 overflow-hidden">
        <DialogHeader className="finance-separator p-6 border-b border-border/10 dark:border-white/5 bg-secondary/5 dark:bg-white/[0.02]">
          <DialogTitle className="text-xl font-semibold text-foreground dark:text-white flex items-center gap-2">
            <Edit className="h-5 w-5 text-primary" />
            Editar Transação
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Atualize os detalhes da transação financeira.
          </DialogDescription>
        </DialogHeader>
        <div className="p-6">
          <EditTransactionForm transaction={transaction} onSuccess={() => setOpen(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
