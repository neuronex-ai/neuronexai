import { Pill } from "lucide-react";
import { useState } from "react";
import { Patient } from "@/types";
import { MedicationUpdateForm } from "./MedicationUpdateForm";
import { ResponsiveModal } from "@/components/ui/ResponsiveModal";

interface MedicationUpdateModalProps {
    patient: Patient;
    children?: React.ReactNode;
}

export const MedicationUpdateModal = ({ patient, children }: MedicationUpdateModalProps) => {
    const [open, setOpen] = useState(false);

    return (
        <ResponsiveModal
            open={open}
            onOpenChange={setOpen}
            trigger={children}
            className="desktop-retina-modal border-border/55 bg-background/96 p-0 sm:max-w-[620px] overflow-hidden rounded-[32px]"
            drawerClassName="bg-background border-t border-border/10"
        >
            <div className="p-6 md:p-8">
                <div className="mb-7 flex flex-col items-center text-center">
                    <div className="finance-modal-icon flex h-12 w-12 items-center justify-center rounded-[17px] bg-muted/65 text-foreground">
                        <Pill className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                        <h2 className="mt-3 text-lg font-semibold tracking-tight text-foreground">Medicação em uso</h2>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Nome, dosagem e frequência informados no prontuário.</p>
                    </div>
                </div>
                <MedicationUpdateForm patient={patient} onSuccess={() => setOpen(false)} />
            </div>
        </ResponsiveModal>
    );
};
