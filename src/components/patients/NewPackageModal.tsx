import { useState } from "react";
import { PackagePlus } from "lucide-react";
import { NewPackageForm } from "./NewPackageForm";
import { ResponsiveModal } from "@/components/ui/ResponsiveModal";

interface NewPackageModalProps {
  patientId: string;
  children?: React.ReactNode;
}

export const NewPackageModal = ({ patientId, children }: NewPackageModalProps) => {
  const [open, setOpen] = useState(false);

  const Header = () => (
    <div className="mb-6 space-y-2 text-center">
      <div className="mx-auto mb-6 h-1.5 w-12 flex-shrink-0 rounded-full bg-foreground/10 sm:hidden" />
      <div className="flex items-center justify-center gap-2">
        <div className="rounded-full border border-border/55 bg-muted/45 p-2">
          <PackagePlus className="h-5 w-5 text-foreground" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Novo plano</h2>
      </div>
      <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
        Organize um conjunto de sessões para este paciente.
      </p>
    </div>
  );

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={setOpen}
      trigger={children}
      className="desktop-retina-modal desktop-retina-form gap-0 overflow-hidden rounded-[30px] border border-border/65 bg-background/96 p-0 shadow-2xl sm:max-w-[480px]"
      drawerClassName="bg-background border-t border-border/60"
    >
      <div className="p-6 md:p-8">
        <Header />
        <NewPackageForm patientId={patientId} onSuccess={() => setOpen(false)} />
      </div>
    </ResponsiveModal>
  );
};
