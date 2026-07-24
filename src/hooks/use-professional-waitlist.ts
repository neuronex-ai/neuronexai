import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";
import { getProfessionalWaitlistErrorMessage } from "@/lib/professional-waitlist-errors";

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

export interface ProfessionalWaitlistSlotSuggestion {
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  source: "pending_offer" | "calculated";
  timezone: "America/Sao_Paulo";
}

export interface ProfessionalWaitlistStatusResult {
  success: true;
  entryId: string;
  status: ProfessionalWaitlistEntry["status"];
  message?: string;
}

export interface ProfessionalWaitlistOfferResult {
  success: boolean;
  offerId?: string;
  holdId?: string;
  token?: string;
  responsePath?: string | null;
  expiresAt?: string;
  idempotent?: boolean;
  alreadyOffered?: boolean;
  reofferRequired?: boolean;
}

const parseSlotSuggestion = (value: unknown): ProfessionalWaitlistSlotSuggestion | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const startsAt = String(record.startsAt || "");
  const endsAt = String(record.endsAt || "");
  const durationMinutes = Number(record.durationMinutes);
  const source = String(record.source || "");
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  if (
    Number.isNaN(start.getTime())
    || Number.isNaN(end.getTime())
    || end <= start
    || !Number.isFinite(durationMinutes)
    || durationMinutes < 15
    || (source !== "pending_offer" && source !== "calculated")
  ) {
    throw new Error("O servidor não retornou uma vaga válida.");
  }

  return {
    startsAt,
    endsAt,
    durationMinutes,
    source,
    timezone: "America/Sao_Paulo",
  };
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
        .in("status", ["active", "paused", "offered"])
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw new Error(getProfessionalWaitlistErrorMessage(error, "Não foi possível carregar a lista de espera."));
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
      if (error) throw new Error(getProfessionalWaitlistErrorMessage(error, "Não foi possível salvar na lista de espera."));
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
      if (error) throw new Error(getProfessionalWaitlistErrorMessage(error, "Não foi possível atualizar a lista de espera."));
      return data as ProfessionalWaitlistStatusResult;
    },
    onSuccess: invalidate,
  });

  const offerMutation = useMutation({
    mutationFn: async ({
      entryId,
      startsAt,
      endsAt,
      idempotencyKey,
    }: {
      entryId: string;
      startsAt: string;
      endsAt: string;
      idempotencyKey: string;
    }) => {
      const database = supabase;
      const { data, error } = await database.rpc("prepare_waitlist_offer", {
        p_entry_id: entryId,
        p_starts_at: startsAt,
        p_ends_at: endsAt,
        p_idempotency_key: idempotencyKey,
      });
      if (error) throw new Error(getProfessionalWaitlistErrorMessage(error, "Não foi possível reservar e oferecer o horário."));
      const result = data as ProfessionalWaitlistOfferResult | null;
      if (!result || typeof result !== "object") {
        throw new Error("Não foi possível confirmar a oferta da vaga agora.");
      }
      if (result.reofferRequired) {
        throw new Error("A oferta anterior já foi encerrada. Revise a vaga e ofereça novamente.");
      }
      if (!result.success || !result.offerId) {
        throw new Error("Não foi possível confirmar a oferta da vaga agora.");
      }
      return result;
    },
    onSuccess: invalidate,
  });

  const slotSuggestionMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const database = supabase;
      const { data, error } = await database.rpc("suggest_professional_waitlist_slot", {
        p_entry_id: entryId,
        p_search_days: 56,
      });
      if (error) {
        throw new Error(getProfessionalWaitlistErrorMessage(error, "Não foi possível calcular uma vaga compatível."));
      }
      return parseSlotSuggestion(data);
    },
  });

  return {
    ...query,
    saveEntry: saveMutation.mutateAsync,
    setEntryStatus: statusMutation.mutateAsync,
    prepareOffer: offerMutation.mutateAsync,
    suggestOfferSlot: slotSuggestionMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    isChangingStatus: statusMutation.isPending,
    isPreparingOffer: offerMutation.isPending,
    isSuggestingOffer: slotSuggestionMutation.isPending,
  };
}
