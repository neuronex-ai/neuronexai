import { supabase } from "@/integrations/supabase/client";

export type SynapseWorkspaceEntityType =
  | "patient"
  | "session_note"
  | "appointment"
  | "reminder"
  | "personal_note"
  | "message";

export interface SynapseWorkspaceSearchResult {
  entity_type: SynapseWorkspaceEntityType;
  entity_id: string;
  patient_id: string | null;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  occurred_at: string | null;
  score: number;
  match_reason: string;
}

type WorkspaceSearchRpc = (
  name: "search_synapse_workspace",
  params: {
    p_query: string;
    p_entity_types: SynapseWorkspaceEntityType[] | null;
    p_limit: number;
  },
) => Promise<{
  data: SynapseWorkspaceSearchResult[] | null;
  error: { message?: string } | null;
}>;

const workspaceSearchRpc = (supabase as unknown as { rpc: WorkspaceSearchRpc }).rpc.bind(supabase);

export async function searchSynapseWorkspace(
  query: string,
  options: {
    entityTypes?: SynapseWorkspaceEntityType[];
    limit?: number;
  } = {},
) {
  const normalizedQuery = query.trim().slice(0, 240);
  if (normalizedQuery.length < 2) return [];

  const { data, error } = await workspaceSearchRpc("search_synapse_workspace", {
    p_query: normalizedQuery,
    p_entity_types: options.entityTypes?.length ? options.entityTypes : null,
    p_limit: Math.max(1, Math.min(options.limit ?? 20, 50)),
  });

  if (error) throw new Error(error.message || "Não foi possível pesquisar o ambiente.");
  return Array.isArray(data) ? data : [];
}
