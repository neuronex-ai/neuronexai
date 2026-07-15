import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";

interface Input {
  packageId: string;
  patientId: string;
  appointmentId: string;
  idempotencyKey?: string;
  reason?: string;
}

interface Result {
  consumed: boolean;
  usageId: string;
  bindingId: string;
  packageId: string;
  sessionsUsed: number;
  sessionsReserved: number;
  remainingSessions: number;
  idempotentReplay: boolean;
}

export const useUsePackageSession = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: Input) => {
      if (!user?.id) throw new Error("Usuário não autenticado.");
      if (!input.appointmentId) {
        throw new Error("Selecione o agendamento que possui a reserva deste pacote.");
      }
      const { data, error } = await supabase.rpc("consume_patient_package_session", {
        p_package_id: input.packageId,
        p_patient_id: input.patientId,
        p_appointment_id: input.appointmentId,
        p_idempotency_key: input.idempotencyKey || `package-consume:${input.appointmentId}`,
        p_reason: input.reason || "Sessão realizada",
      });
      if (error) throw new Error(error.message);
      return data as Result;
    },
    onSuccess: (result, input) => {
      if (!result.idempotentReplay) toast.success("Sessão consumida da reserva do agendamento.");
      void queryClient.invalidateQueries({ queryKey: ["patientPackages", input.patientId] });
      void queryClient.invalidateQueries({ queryKey: ["activePatientPackages", input.patientId] });
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
};
