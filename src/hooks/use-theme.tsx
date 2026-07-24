import { useUserPreferences, type UserThemePreference } from '@/hooks/use-user-preferences';
import {
  getThemeTransitionServerSnapshot,
  getThemeTransitionSnapshot,
  runThemeTransition,
  subscribeToThemeTransition,
  type ThemeTransitionOrigin,
} from '@/lib/theme-transition';
import {
  beginThemePreferenceChange,
  finishThemePreferenceChange,
  shouldApplyPersistedTheme,
} from '@/lib/theme-preference-coordinator';
import { useTheme as useNextTheme } from 'next-themes';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';

export function useTheme() {
  const { theme: currentPreference, setTheme: setNextTheme, resolvedTheme } = useNextTheme();
  const { preferences, updatePreferences } = useUserPreferences();
  const [mounted, setMounted] = useState(false);
  const transitionState = useSyncExternalStore(
    subscribeToThemeTransition,
    getThemeTransitionSnapshot,
    getThemeTransitionServerSnapshot,
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !preferences?.theme) return;
    if (shouldApplyPersistedTheme(currentPreference, preferences.theme, preferences.user_id)) {
      setNextTheme(preferences.theme);
    }
  }, [currentPreference, mounted, preferences?.theme, preferences?.user_id, setNextTheme]);

  const setTheme = useCallback((theme: UserThemePreference | string) => {
    const normalized: UserThemePreference = theme === 'light' || theme === 'dark' || theme === 'system'
      ? theme
      : 'system';

    beginThemePreferenceChange(normalized, preferences?.user_id);
    setNextTheme(normalized);
    if (preferences) {
      void updatePreferences({ theme: normalized }).catch((error) => {
        finishThemePreferenceChange(normalized, preferences.user_id);
        console.error('[Theme] Não foi possível persistir a preferência.', error);
      });
    }
  }, [preferences, setNextTheme, updatePreferences]);

  const transitionToTheme = useCallback((theme: UserThemePreference | string, origin?: ThemeTransitionOrigin) => {
    const normalized: UserThemePreference = theme === 'light' || theme === 'dark' || theme === 'system'
      ? theme
      : 'system';
    const visualTarget = normalized === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : normalized;

    runThemeTransition(visualTarget, () => {
      flushSync(() => setTheme(normalized));
    }, origin);
  }, [setTheme]);

  const toggleTheme = useCallback((origin?: ThemeTransitionOrigin) => {
    transitionToTheme(resolvedTheme === 'dark' ? 'light' : 'dark', origin);
  }, [resolvedTheme, transitionToTheme]);

  const safeTheme = mounted ? (resolvedTheme as 'dark' | 'light') : 'dark';

  return {
    theme: safeTheme,
    preferenceTheme: preferences?.theme || currentPreference || 'system',
    toggleTheme,
    setTheme,
    transitionToTheme,
    isTransitioning: transitionState.isTransitioning,
    transitionDirection: transitionState.direction,
    transitionPhase: transitionState.phase,
    mounted,
  };
}
