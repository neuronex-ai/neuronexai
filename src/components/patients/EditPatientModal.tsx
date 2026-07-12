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
          "desktop-retina-modal desktop-retina-form z-[180] flex h-dvh max-h-dvh w-dvw max-w-none grid-cols-1 flex-col gap-0 overflow-hidden rounded-none border-0 bg-background p-0",
          "sm:!h-[min(900px,calc(100dvh-2.5rem))] sm:!max-h-[calc(100dvh-2.5rem)] sm:!w-[min(1180px,calc(100vw-2.5rem))] sm:!max-w-[1180px] sm:!rounded-[34px] sm:!border",
          "data-[state=open]:zoom-in-[0.985] data-[state=closed]:zoom-out-[0.985]",
        )}
      >
        <header className="shrink-0 border-b border-border/60 bg-background/82 px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] backdrop-blur-2xl sm:px-7 sm:pt-4 lg:px-8">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="desktop-retina-inset flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted/40 text-foreground">
              <UserCog className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-semibold leading-tight tracking-normal text-foreground sm:text-xl">
                Editar prontuário
              </DialogTitle>
              <DialogDescription className="mt-1 truncate text-sm text-muted-foreground">
                Atualize os dados clínicos e de contato de {patient.name}.
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-full border border-border bg-background text-foreground hover:bg-muted"
                aria-label="Fechar edição do prontuário"
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
