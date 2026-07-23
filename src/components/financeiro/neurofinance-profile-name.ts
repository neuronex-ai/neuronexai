import type { Profile } from "@/types";

type ProfileName = Pick<Profile, "first_name" | "last_name" | "full_name" | "name">;

export const getNeuroFinanceProfessionalName = (
  profile?: ProfileName | null,
  fallbackName?: string | null,
) => {
  const firstAndLastName = [profile?.first_name, profile?.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  return (
    firstAndLastName ||
    profile?.full_name?.trim() ||
    profile?.name?.trim() ||
    fallbackName?.trim() ||
    "Profissional NeuroNex"
  );
};
