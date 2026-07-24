import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";
import {
  createCustomEventCategorySlug,
  DEFAULT_PROFESSIONAL_EVENT_CATEGORIES,
  eventCategoryErrorMessage,
  normalizeEventCategoryName,
  normalizedEventCategoryKey,
  type ProfessionalEventCategory,
} from "@/lib/professional-event-categories";

const eventCategoryQueryKey = (professionalId?: string) => [
  "professional-event-categories",
  professionalId,
];

const selectColumns =
  "id,professional_id,slug,name,is_default,is_archived,created_at,updated_at";

async function listAllEventCategories(professionalId: string) {
  const { data, error } = await supabase
    .from("professional_event_categories")
    .select(selectColumns)
    .eq("professional_id", professionalId)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data || []) as ProfessionalEventCategory[];
}

async function ensureDefaultEventCategories(professionalId: string) {
  const existing = await listAllEventCategories(professionalId);
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

  // Duas abas podem inicializar simultaneamente. A restrição única escolhe
  // uma delas; a outra apenas relê a coleção já criada.
  if (error && error.code !== "23505") throw error;
  return listAllEventCategories(professionalId);
}

export function useProfessionalEventCategories() {
  const { user } = useAuth();
  const professionalId = user?.id;
  const queryClient = useQueryClient();

  const query = useQuery<ProfessionalEventCategory[], Error>({
    queryKey: eventCategoryQueryKey(professionalId),
    enabled: Boolean(professionalId),
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      if (!professionalId) throw new Error("Sessão expirada. Entre novamente.");
      const categories = await ensureDefaultEventCategories(professionalId);
      return categories.filter((category) => !category.is_archived);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (rawName: string) => {
      if (!professionalId) throw new Error("Sessão expirada. Entre novamente.");
      const name = normalizeEventCategoryName(rawName);
      if (!name) throw new Error("Informe o nome da categoria.");
      if (name.length > 60) throw new Error("Use até 60 caracteres no nome da categoria.");

      const allCategories = await listAllEventCategories(professionalId);
      const existing = allCategories.find(
        (category) =>
          normalizedEventCategoryKey(category.name) ===
          normalizedEventCategoryKey(name),
      );

      if (existing) {
        if (!existing.is_archived) {
          throw { code: "23505" };
        }
        const { data, error } = await supabase
          .from("professional_event_categories")
          .update({ name, is_archived: false })
          .eq("id", existing.id)
          .eq("professional_id", professionalId)
          .select(selectColumns)
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
        .select(selectColumns)
        .single();
      if (error) throw error;
      return data as ProfessionalEventCategory;
    },
    onSuccess: (category) => {
      queryClient.setQueryData<ProfessionalEventCategory[]>(
        eventCategoryQueryKey(professionalId),
        (current = []) =>
          [...current.filter((item) => item.id !== category.id), category].sort(
            (left, right) =>
              Number(right.is_default) - Number(left.is_default) ||
              left.name.localeCompare(right.name, "pt-BR"),
          ),
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, rawName }: { id: string; rawName: string }) => {
      if (!professionalId) throw new Error("Sessão expirada. Entre novamente.");
      const name = normalizeEventCategoryName(rawName);
      if (!name) throw new Error("Informe o nome da categoria.");
      if (name.length > 60) throw new Error("Use até 60 caracteres no nome da categoria.");

      const { data, error } = await supabase
        .from("professional_event_categories")
        .update({ name })
        .eq("id", id)
        .eq("professional_id", professionalId)
        .eq("is_archived", false)
        .select(selectColumns)
        .single();
      if (error) throw error;
      return data as ProfessionalEventCategory;
    },
    onSuccess: (category) => {
      queryClient.setQueryData<ProfessionalEventCategory[]>(
        eventCategoryQueryKey(professionalId),
        (current = []) =>
          current
            .map((item) => (item.id === category.id ? category : item))
            .sort((left, right) =>
              left.name.localeCompare(right.name, "pt-BR"),
            ),
      );
    },
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
    onSuccess: ({ id }) => {
      queryClient.setQueryData<ProfessionalEventCategory[]>(
        eventCategoryQueryKey(professionalId),
        (current = []) => current.filter((category) => category.id !== id),
      );
    },
  });

  return {
    ...query,
    categories: query.data || [],
    createCategory: createMutation.mutateAsync,
    updateCategory: updateMutation.mutateAsync,
    archiveCategory: archiveMutation.mutateAsync,
    isMutating:
      createMutation.isPending ||
      updateMutation.isPending ||
      archiveMutation.isPending,
    mutationErrorMessage: (error: unknown) =>
      eventCategoryErrorMessage(error),
  };
}
