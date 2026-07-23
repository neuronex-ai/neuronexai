import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";

export interface ProfessionalWaitlistWindow {
  id?: string;
  weekday: number | null;
  specific_date: string | null;
  start_time: string;
  end_time: string;
}

export interface ProfessionalWaitlistEntry {
  id: string;
  patient_id: string;
  status: "active" | "paused" | "offered" | "scheduled" | "expired" | "removed";
  priority: number;
  valid_from: string;
  valid_until: string | null;
  minimum_duration_minutes: number;
  preferred_duration_minutes: number;
  modality: "presencial" | "online" | null;
  location: string | null;
  offer_automatically: boolean;
  offer_count: number;
  last_offered_at: string | null;
  created_at: string;
  patients: { id: string; name: string } | null;
  professional_waitlist_windows: ProfessionalWaitlistWindow[];
  professional_waitlist_offers: Array<{
    id: string;
    status: "pending" | "accepted" | "declined" | "expired" | "superseded";
    offered_start_time: string;
    offered_end_time: string;
    expires_at: string;
  }>;
}

export interface ProfessionalWaitlistInput {
  id?: string;
  patient_id: string;
  priority: number;
  valid_from: string;
  valid_until?: string | null;
  minimum_duration_minutes: number;
  preferred_duration_minutes: number;
  modality?: "presencial" | "online" | null;
  location?: string | null;
  offer_automatically: boolean;
  windows: Array<Omit<ProfessionalWaitlistWindow, "id">>;
  rules_snapshot?: Record<string, unknown>;
}

const errorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return fallback;
};

export function useProfessionalWaitlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["professional-waitlist", user?.id] });

  const query = useQuery({
    queryKey: ["professional-waitlist", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const database = supabase;
      const { data, error } = await database
        .from("professional_waitlist_entries")
        .select("id,patient_id,status,priority,valid_from,valid_until,minimum_duration_minutes,preferred_duration_minutes,modality,location,offer_automatically,offer_count,last_offered_at,created_at,patients(id,name),professional_waitlist_windows(id,weekday,specific_date,start_time,end_time),professional_waitlist_offers(id,status,offered_start_time,offered_end_time,expires_at)")
        .neq("status", "removed")
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw new Error(errorMessage(error, "Não foi possível carregar a lista de espera."));
      return (data || []).map((row) => ({
        ...row,
        patients: Array.isArray(row.patients) ? row.patients[0] || null : row.patients,
      })) as ProfessionalWaitlistEntry[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (input: ProfessionalWaitlistInput) => {
      const database = supabase;
      const { data, error } = await database.rpc("upsert_professional_waitlist_entry", { p_input: input });
      if (error) throw new Error(errorMessage(error, "Não foi possível salvar na lista de espera."));
      return data as { success: true; entryId: string; status: string };
    },
    onSuccess: invalidate,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ entryId, status }: { entryId: string; status: "active" | "paused" | "removed" }) => {
      const database = supabase;
      const { data, error } = await database.rpc("set_professional_waitlist_entry_status", {
        p_entry_id: entryId,
        p_status: status,
      });
      if (error) throw new Error(errorMessage(error, "Não foi possível atualizar a lista de espera."));
      return data;
    },
    onSuccess: invalidate,
  });

  const offerMutation = useMutation({
    mutationFn: async ({ entryId, startsAt, endsAt }: { entryId: string; startsAt: string; endsAt: string }) => {
      const database = supabase;
      const { data, error } = await database.rpc("prepare_waitlist_offer", {
        p_entry_id: entryId,
        p_starts_at: startsAt,
        p_ends_at: endsAt,
        p_idempotency_key: `waitlist-${entryId}-${startsAt}`,
      });
      if (error) throw new Error(errorMessage(error, "Não foi possível reservar e ofertar o horário."));
      return data as {
        success: true;
        offerId: string;
        token: string;
        responsePath: string;
        expiresAt: string;
      };
    },
    onSuccess: invalidate,
  });

  return {
    ...query,
    saveEntry: saveMutation.mutateAsync,
    setEntryStatus: statusMutation.mutateAsync,
    prepareOffer: offerMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    isChangingStatus: statusMutation.isPending,
    isPreparingOffer: offerMutation.isPending,
  };
}
