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
  { slug: "bloqueio", name: "Bloqueio de Agenda" },
  { slug: "formacao", name: "Formação / Curso" },
  { slug: "administrativo", name: "Administrativo" },
  { slug: "outro", name: "Outro" },
] as const;

export const normalizeEventCategoryName = (name: string) =>
  name.trim().replace(/\s+/g, " ");

export const normalizedEventCategoryKey = (name: string) =>
  normalizeEventCategoryName(name).toLocaleLowerCase("pt-BR");

export const createCustomEventCategorySlug = () =>
  `custom-${crypto.randomUUID()}`;

export const eventCategoryErrorMessage = (
  error: unknown,
  fallback = "Não foi possível salvar a categoria. Tente novamente.",
) => {
  if (error && typeof error === "object") {
    const value = error as { code?: unknown; message?: unknown };
    if (value.code === "23505") {
      return "Já existe uma categoria com esse nome.";
    }
    if (value.code === "42501") {
      return "Sua sessão não permite alterar estas categorias. Entre novamente.";
    }
  }
  return fallback;
};
