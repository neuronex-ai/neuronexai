import { type ReactNode, useState } from "react";
import { X, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { NewPatientForm } from "./NewPatientForm";
import { cn } from "@/lib/utils";
import type { Patient } from "@/types";

interface NewPatientModalProps {
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCreated?: (patient?: Patient) => void;
  showTrigger?: boolean;
}

export const NewPatientModal = ({
  children,
  open,
  onOpenChange,
  onCreated,
  showTrigger = true,
}: NewPatientModalProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const modalOpen = open ?? internalOpen;
  const handleOpenChange = onOpenChange ?? setInternalOpen;

  const triggerButton = showTrigger
    ? children || (
        <Button
          size="sm"
          className="h-10 gap-2 rounded-full bg-foreground px-4 font-semibold text-background shadow-none transition-colors hover:bg-foreground/90 active:scale-[0.98]"
        >
          <UserPlus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo Paciente</span>
        </Button>
      )
    : null;

  return (
    <Dialog open={modalOpen} onOpenChange={handleOpenChange}>
      {triggerButton ? <DialogTrigger asChild>{triggerButton}</DialogTrigger> : null}
      <DialogContent
        data-synapse-target="new-patient-modal"
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
              <UserPlus className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-semibold leading-tight tracking-normal text-foreground sm:text-xl">
                Novo prontuário
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                Cadastre os dados essenciais e complemente o prontuário quando precisar.
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-full border border-border bg-background text-foreground hover:bg-muted"
                aria-label="Fechar cadastro de paciente"
              >
                <X className="h-5 w-5" />
              </Button>
            </DialogClose>
          </div>
        </header>

        <NewPatientForm
          onCancel={() => handleOpenChange(false)}
          onSuccess={(patient) => {
            onCreated?.(patient);
            handleOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
};
