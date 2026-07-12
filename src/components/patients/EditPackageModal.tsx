import { useState } from "react";
import { Edit } from "lucide-react";
import { PatientPackage } from "@/types";
import { EditPackageForm } from "./EditPackageForm";
import { ResponsiveModal } from "@/components/ui/ResponsiveModal";

interface EditPackageModalProps {
  pkg: PatientPackage;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const EditPackageModal = ({ pkg, children, open, onOpenChange }: EditPackageModalProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const modalOpen = open ?? internalOpen;
  const handleOpenChange = onOpenChange ?? setInternalOpen;

  const Header = () => (
    <div className="mb-6 space-y-2 text-center">
      <div className="flex items-center justify-center gap-2">
        <div className="desktop-retina-inset flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-muted/45 text-foreground">
          <Edit className="h-4 w-4" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Editar pacote</h2>
      </div>
      <p className="text-xs font-medium text-muted-foreground">
        {pkg.description}
      </p>
    </div>
  );

  return (
    <ResponsiveModal
      open={modalOpen}
      onOpenChange={handleOpenChange}
      trigger={children}
      className="desktop-retina-modal desktop-retina-form gap-0 overflow-hidden rounded-[30px] border border-border/70 bg-background/96 p-0 shadow-2xl sm:max-w-[520px]"
      drawerClassName="desktop-retina-form border-t border-border/70 bg-background"
    >
      <div className="p-6 md:p-8">
        <Header />
        <EditPackageForm pkg={pkg} onSuccess={() => handleOpenChange(false)} />
      </div>
    </ResponsiveModal>
  );
};