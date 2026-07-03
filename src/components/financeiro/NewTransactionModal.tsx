"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { CreditCard, Wallet, X } from "lucide-react";
import { NewTransactionForm } from "./NewTransactionForm";
import { useIsMobile } from "@/hooks/use-mobile";

interface NewTransactionModalProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
  defaultType?: "income" | "expense";
}

export const NewTransactionModal = ({ children, open, onOpenChange, showTrigger = true, defaultType = "income" }: NewTransactionModalProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isMobile = useIsMobile();
  const modalOpen = open ?? internalOpen;
  const handleOpenChange = onOpenChange ?? setInternalOpen;

  const triggerButton = showTrigger ? children || (
    <Button
      size="sm"
      variant="outline"
      className="gap-2 bg-card hover:bg-accent text-foreground border-border hover:border-border/80 h-9 px-4 rounded-full transition-all hover:scale-105 shadow-sm active:scale-95"
    >
      <CreditCard className="h-4 w-4" />
      <span className="hidden sm:inline font-bold text-xs uppercase tracking-wider">Nova Transação</span>
    </Button>
  ) : undefined;

  const HeaderContent = () => (
    <div className="text-center space-y-4 mb-8">
      <div className="flex items-center justify-center">
        <div className="p-5 rounded-[24px] bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-2xl ring-1 ring-white/10 group-hover:rotate-12 transition-transform duration-700">
          <Wallet className="h-7 w-7" />
        </div>
      </div>
      <div className="space-y-1">
        <h2 className="text-2xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter">Fluxo de Caixa</h2>
        <p className="text-[9px] text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.4em] font-black">Protocolo de Registro Financeiro</p>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={modalOpen} onOpenChange={handleOpenChange}>
        {triggerButton && <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>}
        <DrawerContent className="bg-white dark:bg-[#080809] border-t border-zinc-200 dark:border-white/10 max-h-[90vh] rounded-t-[40px]">
          <div className="p-10 overflow-y-auto">
            <div className="mx-auto w-16 h-1.5 flex-shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800 mb-10" />
            <HeaderContent />
            <NewTransactionForm defaultType={defaultType} onSuccess={() => handleOpenChange(false)} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={modalOpen} onOpenChange={handleOpenChange}>
      {triggerButton && <DialogTrigger asChild>{triggerButton}</DialogTrigger>}
      <DialogContent showCloseButton={false} className="sm:max-w-[500px] border-zinc-200 dark:border-white/10 bg-white dark:bg-[#080809] backdrop-blur-3xl shadow-[0_48px_96px_-24px_rgba(0,0,0,0.5)] p-0 overflow-hidden rounded-[48px] outline-none ring-1 ring-black/5 dark:ring-white/5">
        <DialogClose className="absolute right-8 top-8 rounded-2xl p-3 bg-zinc-50 dark:bg-white/5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-white/10 transition-all z-50 shadow-sm focus:outline-none focus:ring-0">
          <X className="h-4 w-4" />
        </DialogClose>
        
        <div className="p-12">
            <HeaderContent />
            <NewTransactionForm defaultType={defaultType} onSuccess={() => handleOpenChange(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
