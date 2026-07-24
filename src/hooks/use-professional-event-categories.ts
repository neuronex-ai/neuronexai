import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";
import {
  createCustomEventCategorySlug,
  getEventCategoryErrorMessage,
  normalizeEventCategoryName,
  normalizedEventCategoryKey,
  DEFAULT_PROFESSIONAL_EVENT_CATEGORIES,
  type ProfessionalEventCategory,
} from "@/lib/professional-event-categories";

const categoryQueryKey = (professionalId?: string) => [
  "professional-event-categories",
  professionalId,
];

const categoryColumns =
  "id,professional_id,slug,name,is_default,is_archived,created_at,updated_at";

const byDisplayOrder = (
  left: ProfessionalEventCategory,
  right: ProfessionalEventCategory,
) =>
  Number(right.is_default) - Number(left.is_default) ||
  left.name.localeCompare(right.name, "pt-BR");

async function listCategories(professionalId: string) {
  const { data, error } = await supabase
    .from("professional_event_categories")
    .select(categoryColumns)
    .eq("professional_id", professionalId)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data || []) as ProfessionalEventCategory[];
}

async function ensureDefaultCategories(professionalId: string) {
  const existing = await listCategories(professionalId);
  if (existing.length) return existing;

  const { error } = await supabase
    .from("professional_event_categories")
    .insert(
      DEFAULT_PROFESSIONAL_EVENT_CATEGORIES.map((category) => ({
        professional_id: professionalId,
        slug: category.slug,
        name: category.name,
        is_default: true,
      })),
    );

  // Duas janelas podem inicializar a coleção ao mesmo tempo. A restrição
  // única preserva uma única coleção e a segunda janela apenas a relê.
  if (error && error.code !== "23505") throw error;
  return listCategories(professionalId);
}

export function useProfessionalEventCategories({ enabled = true } = {}) {
  const { user } = useAuth();
  const professionalId = user?.id;
  const queryClient = useQueryClient();

  const query = useQuery<ProfessionalEventCategory[], Error>({
    queryKey: categoryQueryKey(professionalId),
    enabled: Boolean(enabled && professionalId),
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      if (!professionalId) throw new Error("Sessão expirada. Entre novamente.");
      const categories = await ensureDefaultCategories(professionalId);
      return categories.filter((category) => !category.is_archived);
    },
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: categoryQueryKey(professionalId) });

  const createMutation = useMutation({
    mutationFn: async (rawName: string) => {
      if (!professionalId) throw new Error("Sessão expirada. Entre novamente.");
      const name = normalizeEventCategoryName(rawName);
      if (!name) throw new Error("Informe o nome da categoria.");
      if (name.length > 60) {
        throw { code: "22001" };
      }

      const existing = (await listCategories(professionalId)).find(
        (category) =>
          normalizedEventCategoryKey(category.name) ===
          normalizedEventCategoryKey(name),
      );

      if (existing) {
        if (!existing.is_archived) throw { code: "23505" };
        const { data, error } = await supabase
          .from("professional_event_categories")
          .update({ name, is_archived: false })
          .eq("id", existing.id)
          .eq("professional_id", professionalId)
          .select(categoryColumns)
          .single();
        if (error) throw error;
        return data as ProfessionalEventCategory;
      }

      const { data, error } = await supabase
        .from("professional_event_categories")
        .insert({
          professional_id: professionalId,
          slug: createCustomEventCategorySlug(),
          name,
          is_default: false,
        })
        .select(categoryColumns)
        .single();
      if (error) throw error;
      return data as ProfessionalEventCategory;
    },
    onSuccess: refresh,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, rawName }: { id: string; rawName: string }) => {
      if (!professionalId) throw new Error("Sessão expirada. Entre novamente.");
      const name = normalizeEventCategoryName(rawName);
      if (!name) throw new Error("Informe o nome da categoria.");
      if (name.length > 60) throw { code: "22001" };

      const { data, error } = await supabase
        .from("professional_event_categories")
        .update({ name })
        .eq("id", id)
        .eq("professional_id", professionalId)
        .eq("is_archived", false)
        .select(categoryColumns)
        .single();
      if (error) throw error;
      return data as ProfessionalEventCategory;
    },
    onSuccess: refresh,
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!professionalId) throw new Error("Sessão expirada. Entre novamente.");
      const { data, error } = await supabase
        .from("professional_event_categories")
        .update({ is_archived: true })
        .eq("id", id)
        .eq("professional_id", professionalId)
        .eq("is_archived", false)
        .select("id,slug")
        .single();
      if (error) throw error;
      return data as Pick<ProfessionalEventCategory, "id" | "slug">;
    },
    onSuccess: refresh,
  });

  return {
    ...query,
    categories: (query.data || []).slice().sort(byDisplayOrder),
    createCategory: createMutation.mutateAsync,
    updateCategory: updateMutation.mutateAsync,
    archiveCategory: archiveMutation.mutateAsync,
    isMutating:
      createMutation.isPending ||
      updateMutation.isPending ||
      archiveMutation.isPending,
    getErrorMessage: getEventCategoryErrorMessage,
  };
}
