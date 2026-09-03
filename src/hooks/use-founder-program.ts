import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";

export type FounderProgramRole = "founder_member" | "development_collaborator";

export interface FounderProgramMember {
  user_id: string;
  cohort_key: string;
  badge_key: string;
  badge_label: string;
  program_role: FounderProgramRole;
  lifetime_plan_code: string | null;
  modal_eyebrow: string;
  modal_title: string;
  modal_body: string;
  modal_cta_label: string;
  announcement_version: number;
  acknowledged_version: number;
  active: boolean;
  granted_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
}

// The generated database types in this branch predate founder_program_members.
// Keep the compatibility cast isolated here until the next Supabase type refresh.
const founderClient = supabase as any;

const fetchFounderMembership = async (userId: string): Promise<FounderProgramMember | null> => {
  const { data, error } = await founderClient
    .from("founder_program_members")
    .select(
      "user_id,cohort_key,badge_key,badge_label,program_role,lifetime_plan_code,modal_eyebrow,modal_title,modal_body,modal_cta_label,announcement_version,acknowledged_version,active,granted_at,updated_at,metadata",
    )
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();

  if (error) throw error;
  return (data as FounderProgramMember | null) ?? null;
};

export const useFounderProgram = () => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const query = useQuery({
    queryKey: ["founder-program", userId],
    queryFn: () => fetchFounderMembership(userId!),
    enabled: Boolean(userId) && !isAuthLoading,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated");
      const { error } = await founderClient.rpc("acknowledge_founder_program_announcement");
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["founder-program", userId] });
    },
  });

  const member = query.data ?? null;
  const shouldShowAnnouncement = Boolean(
    member?.active && member.acknowledged_version < member.announcement_version,
  );

  return {
    member,
    isFounder: Boolean(member?.active),
    isDevelopmentCollaborator: member?.program_role === "development_collaborator",
    hasLifetimeProfessional: member?.lifetime_plan_code === "professional",
    shouldShowAnnouncement,
    isLoading: query.isLoading || isAuthLoading,
    acknowledgeAnnouncement: acknowledgeMutation.mutateAsync,
    isAcknowledging: acknowledgeMutation.isPending,
    refetch: query.refetch,
  };
};
