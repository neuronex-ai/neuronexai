export interface ProfessionalEventCategory {
  id: string;
  professional_id: string;
  slug: string;
  name: string;
  is_default: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_PROFESSIONAL_EVENT_CATEGORIES = [
  { slug: "reuniao", name: "Reunião" },
  { slug: "supervisao", name: "Supervisão" },
  { slug: "particular", name: "Particular" },
  { slug: "bloqueio", name: "Bloqueio de agenda" },
  { slug: "formacao", name: "Formação / curso" },
  { slug: "administrativo", name: "Administrativo" },
  { slug: "outro", name: "Outro" },
] as const;

export const normalizeEventCategoryName = (name: string) =>
  name.trim().replace(/\s+/g, " ");

export const normalizedEventCategoryKey = (name: string) =>
  normalizeEventCategoryName(name).toLocaleLowerCase("pt-BR");

export const createCustomEventCategorySlug = () =>
  `custom-${crypto.randomUUID()}`;

export const getEventCategoryErrorMessage = (
  error: unknown,
  fallback = "Não foi possível salvar a categoria. Tente novamente.",
) => {
  if (error && typeof error === "object") {
    const value = error as { code?: unknown; message?: unknown };
    if (value.code === "23505") {
      return "Já existe uma categoria com esse nome.";
    }
    if (value.code === "23514" || value.code === "22001") {
      return "Use um nome entre 1 e 60 caracteres.";
    }
    if (value.code === "42501") {
      return "Sua sessão não permite alterar categorias. Entre novamente.";
    }
    if (value.code === "42P01") {
      return "As categorias ainda estão sendo preparadas. Atualize a página em instantes.";
    }
  }

  return fallback;
};
