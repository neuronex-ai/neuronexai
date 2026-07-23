import type { UserThemePreference } from "@/hooks/use-user-preferences";

let pendingPreference: UserThemePreference | null = null;

export const beginThemePreferenceChange = (
  preference: UserThemePreference,
  persistsPreference: boolean,
) => {
  pendingPreference = persistsPreference ? preference : null;
};

export const finishThemePreferenceChange = (preference?: UserThemePreference) => {
  if (!preference || pendingPreference === preference) pendingPreference = null;
};

export const shouldApplyPersistedTheme = (
  currentPreference: string | undefined,
  persistedPreference: UserThemePreference,
) => {
  if (pendingPreference && pendingPreference !== persistedPreference) return false;
  if (pendingPreference === persistedPreference) pendingPreference = null;
  return currentPreference !== persistedPreference;
};

export const getPendingThemePreference = () => pendingPreference;
