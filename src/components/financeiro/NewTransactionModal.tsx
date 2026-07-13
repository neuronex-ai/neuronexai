"use client";

import { useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { NewTransactionForm } from "./NewTransactionForm";

interface NewTransactionModalProps {
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
  defaultType?: "income" | "expense";
}

export const NewTransactionModal = ({
  children,
  open,
  onOpenChange,
  showTrigger = true,
  defaultType = "income",
}: NewTransactionModalProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const mobile = useIsMobile();
  const value = open ?? internalOpen;
  const setValue = onOpenChange ?? setInternalOpen;
  const trigger = showTrigger
    ? children || (
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Novo lançamento
        </Button>
      )
    : undefined;

  if (mobile) {
    return (
      <Drawer open={value} onOpenChange={setValue}>
        {trigger ? <DrawerTrigger asChild>{trigger}</DrawerTrigger> : null}
        <DrawerContent className="finance-modal-surface max-h-[92vh]">
          <div className="overflow-y-auto">
            <div className="finance-separator border-b px-6 py-5">
              <DrawerTitle>Novo lançamento</DrawerTitle>
              <DrawerDescription>Registre uma movimentação paga ou em aberto.</DrawerDescription>
            </div>
            <div className="p-6">
              <NewTransactionForm defaultType={defaultType} onSuccess={() => setValue(false)} />
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={value} onOpenChange={setValue}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        data-synapse-target="new-transaction-modal"
        showCloseButton={false}
        className="finance-modal-surface max-w-xl overflow-hidden rounded-[28px] p-0"
      >
        <DialogClose
          className="absolute right-4 top-4 z-20 rounded-full p-2 transition-colors hover:bg-foreground/[0.06]"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </DialogClose>
        <div className="finance-separator border-b px-7 py-6">
          <DialogTitle>Novo lançamento</DialogTitle>
          <DialogDescription>Registre uma movimentação paga ou em aberto.</DialogDescription>
        </div>
        <div className="p-7">
          <NewTransactionForm defaultType={defaultType} onSuccess={() => setValue(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
