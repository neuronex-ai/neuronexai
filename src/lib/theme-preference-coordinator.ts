import type { UserThemePreference } from "@/hooks/use-user-preferences";

type PendingPreference = {
  preference: UserThemePreference;
  userId: string;
};

let pendingPreference: PendingPreference | null = null;

export const beginThemePreferenceChange = (
  preference: UserThemePreference,
  userId: string | null | undefined,
) => {
  pendingPreference = userId ? { preference, userId } : null;
};

export const finishThemePreferenceChange = (
  preference?: UserThemePreference,
  userId?: string,
) => {
  if (
    !preference ||
    (
      pendingPreference?.preference === preference &&
      (!userId || pendingPreference.userId === userId)
    )
  ) {
    pendingPreference = null;
  }
};

export const shouldApplyPersistedTheme = (
  currentPreference: string | undefined,
  persistedPreference: UserThemePreference,
  userId: string,
) => {
  if (pendingPreference?.userId === userId) {
    if (pendingPreference.preference !== persistedPreference) return false;
    pendingPreference = null;
  }
  return currentPreference !== persistedPreference;
};

export const getPendingThemePreference = () => pendingPreference?.preference ?? null;
