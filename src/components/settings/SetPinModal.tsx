import { KeyRound } from "lucide-react";

import { AppModalShell, ModalHeroIcon } from "@/components/ui/app-modal-shell";
import { SetPinForm } from "./SetPinForm";

interface SetPinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const SetPinModal = ({ open, onOpenChange, onSuccess }: SetPinModalProps) => {
  return (
    <AppModalShell
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      eyebrow="Segurança financeira"
      title="PIN financeiro"
      description="Configure ou atualize o código de seis dígitos usado para proteger suas operações financeiras."
      heroIcon={<ModalHeroIcon icon={KeyRound} ariaLabel="PIN financeiro" />}
      bodyClassName="flex justify-center"
    >
      <SetPinForm onSuccess={() => { onSuccess(); onOpenChange(false); }} />
    </AppModalShell>
  );
};
