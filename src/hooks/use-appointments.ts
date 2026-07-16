import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Appointment } from "@/types";
import { getAppointmentDisplayTitle } from "@/lib/appointment-utils";
import { isCancelledAppointmentStatus } from "@/lib/appointment-status";
import { useAuth } from "@/components/auth/SessionContextProvider";

interface UseAppointmentsProps {
  startDate?: Date;
  endDate?: Date;
  patientId?: string;
  includeCancelled?: boolean;
}

export const useAppointments = ({ startDate, endDate, patientId, includeCancelled = false }: UseAppointmentsProps = {}) => {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ["appointments", userId, startDate?.toISOString(), endDate?.toISOString(), patientId, includeCancelled],
    queryFn: async () => {
      if (!userId) return [];

      let query = supabase
        .from("appointments")
        .select(`
          *,
          patients (
            name
          )
        `)
        .eq("user_id", userId)
        .eq("visibility_status", "visible")
        .is("archived_at", null);

      query = query.order("start_time", { ascending: true });

      if (startDate) {
        query = query.gte("start_time", startDate.toISOString());
      }

      if (endDate) {
        query = query.lte("start_time", endDate.toISOString());
      }

      if (patientId) {
        query = query.eq("patient_id", patientId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data.map((app: any) => {
        const appointment = {
          ...app,
          patient_name: app.patients?.name,
        } as Appointment;

        return {
          ...appointment,
          patient_name: getAppointmentDisplayTitle(appointment),
        };
      }).filter((app: Appointment) => includeCancelled || !isCancelledAppointmentStatus(app.status, app.notes)) as Appointment[];
    },
    enabled: !!userId,
  });
};
