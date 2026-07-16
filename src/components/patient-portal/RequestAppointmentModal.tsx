import { Button } from "@/components/ui/button";
import { CalendarPlus } from "lucide-react";
import type { ReactNode } from "react";

interface RequestAppointmentModalProps {
  children?: ReactNode;
}

/**
 * Compatibility shell for the retired direct-booking flow. New sessions remain
 * disabled until they can be prepared by the canonical appointment planner.
 */
export const RequestAppointmentModal = ({
  children,
}: RequestAppointmentModalProps) => (
  <Button
    type="button"
    variant="outline"
    disabled
    aria-describedby="patient-portal-new-session-disabled"
    className="gap-2 rounded-xl"
  >
    {children || (
      <>
        <CalendarPlus className="h-4 w-4" aria-hidden="true" />
        Nova sessão indisponível
      </>
    )}
    <span id="patient-portal-new-session-disabled" className="sr-only">
      Solicite uma nova sessão diretamente ao profissional por enquanto.
    </span>
  </Button>
);
