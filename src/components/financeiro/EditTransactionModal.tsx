import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { FileSearch, PencilLine } from "lucide-react";
import { Transaction } from "@/types";
import { EditTransactionForm } from "./EditTransactionForm";
import { useIsMobile } from "@/hooks/use-mobile";
import TransactionDetailView from "./TransactionDetailView";
import { managementOriginOf } from "@/lib/financial-management-model";
import { cn } from "@/lib/utils";

interface EditTransactionModalProps {
  transaction: Transaction;
  children: React.ReactNode;
}

export const EditTransactionModal = ({ transaction, children }: EditTransactionModalProps) => {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const originLabel = managementOriginOf(transaction);
  const isEditable = originLabel === "Lançamento manual";

  const HeaderContent = () => (
    <div className="mb-6 flex flex-col items-center text-center">
      <span className="finance-modal-icon flex h-12 w-12 items-center justify-center rounded-[17px] bg-muted/65 text-foreground">
        {isEditable ? <PencilLine className="h-5 w-5" aria-hidden="true" /> : <FileSearch className="h-5 w-5" aria-hidden="true" />}
      </span>
      <h2 className="mt-3 text-lg font-semibold tracking-tight text-foreground">
        {isEditable ? "Editar lançamento" : "Detalhes da movimentação"}
      </h2>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
        {originLabel} · {transaction.description}
      </p>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          {children}
        </DrawerTrigger>
        <DrawerContent className="max-h-[90vh] border-t border-border/35 bg-background dark:border-zinc-800/80 dark:bg-[#0A0A0B]">
          <div className="p-6 overflow-y-auto">
            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-secondary dark:bg-white/10 mb-6" />
            <HeaderContent />
            {isEditable ? (
              <EditTransactionForm transaction={transaction} onSuccess={() => setOpen(false)} />
            ) : (
              <TransactionDetailView transaction={transaction} onBack={() => setOpen(false)} />
            )}
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
      <DialogContent className={cn(
        "finance-modal-surface desktop-retina-modal gap-0 overflow-hidden rounded-[30px] border border-border/55 bg-background/96 p-0 shadow-2xl",
        isEditable ? "sm:max-w-[560px]" : "sm:max-w-[760px]",
      )}>
        <DialogHeader className="sr-only">
          <DialogTitle>{isEditable ? "Editar lançamento" : "Detalhes da movimentação"}</DialogTitle>
          <DialogDescription>{originLabel}</DialogDescription>
        </DialogHeader>
        <div className="patient-record-scrollbar max-h-[min(780px,calc(100dvh-3rem))] overflow-y-auto p-6 sm:p-8">
          <HeaderContent />
          {isEditable ? (
            <EditTransactionForm transaction={transaction} onSuccess={() => setOpen(false)} />
          ) : (
            <TransactionDetailView transaction={transaction} onBack={() => setOpen(false)} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
