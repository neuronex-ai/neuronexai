import { type ReactNode, useEffect, useState } from "react";
import { X, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Patient } from "@/types";
import { cn } from "@/lib/utils";
import { NewPatientForm } from "./NewPatientForm";

interface EditPatientModalProps {
  patient: Patient;
  children: ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const EditPatientModal = ({ patient, children, defaultOpen = false, onOpenChange }: EditPatientModalProps) => {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "left-0 top-0 z-[180] flex h-dvh max-h-dvh w-dvw max-w-none translate-x-0 translate-y-0 grid-cols-1 flex-col gap-0 overflow-hidden rounded-none border-0 bg-background p-0 shadow-none",
          "data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100",
        )}
      >
        <header className="shrink-0 border-b border-border bg-background/95 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-foreground">
              <UserCog className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-semibold leading-tight tracking-normal text-foreground sm:text-xl">
                Editar Prontuario
              </DialogTitle>
              <DialogDescription className="mt-1 truncate text-sm text-muted-foreground">
                {patient.name}
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-full border border-border bg-background text-foreground hover:bg-muted"
                aria-label="Fechar edicao de prontuario"
              >
                <X className="h-5 w-5" />
              </Button>
            </DialogClose>
          </div>
        </header>

        <NewPatientForm
          patient={patient}
          onCancel={() => handleOpenChange(false)}
          onSuccess={() => handleOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
};
