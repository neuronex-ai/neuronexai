import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarSearch, Loader2 } from "lucide-react";

import { AppointmentDetailModal } from "@/components/agenda/AppointmentDetailModal";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Appointment } from "@/types";

const useSessionAppointment = (appointmentId?: string | null) =>
  useQuery({
    queryKey: ["session-appointment-source", appointmentId],
    enabled: Boolean(appointmentId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", appointmentId!)
        .maybeSingle();
      if (error) throw error;
      return (data || null) as Appointment | null;
    },
    staleTime: 30_000,
  });

export function SessionAppointmentSource({
  appointmentId,
  compact = false,
}: {
  appointmentId?: string | null;
  compact?: boolean;
}) {
  const appointment = useSessionAppointment(appointmentId);

  if (!appointmentId) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground/70">
        <CalendarSearch className="h-3.5 w-3.5" aria-hidden="true" />
        Registro anterior sem agendamento vinculado
      </span>
    );
  }

  if (appointment.isLoading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground" aria-live="polite">
        <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        Localizando agendamento
      </span>
    );
  }

  if (!appointment.data) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground/70">
        <CalendarSearch className="h-3.5 w-3.5" aria-hidden="true" />
        Agendamento histórico indisponível
      </span>
    );
  }

  const label = format(new Date(appointment.data.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  return (
    <AppointmentDetailModal appointment={appointment.data}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 rounded-xl bg-muted/45 px-3 text-[10px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={`Abrir detalhes do agendamento de ${label}`}
      >
        <CalendarSearch className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
        {compact ? "Ver agendamento" : `Origem: ${label}`}
      </Button>
    </AppointmentDetailModal>
  );
}
