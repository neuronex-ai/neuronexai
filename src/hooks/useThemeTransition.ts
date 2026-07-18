import { useCallback, useSyncExternalStore } from 'react';
import { useTheme } from '@/hooks/use-theme';
import {
    getThemeTransitionServerSnapshot,
    getThemeTransitionSnapshot,
    subscribeToThemeTransition,
    type ThemeTransitionOrigin,
} from '@/lib/theme-transition';

type ThemeMode = 'light' | 'dark';

/**
 * Hook for managing cinematic theme transitions
 * Creates a smooth "light ascending" or "light descending" effect
 */
export function useThemeTransition() {
    const { theme, transitionToTheme } = useTheme();
    const transitionState = useSyncExternalStore(
        subscribeToThemeTransition,
        getThemeTransitionSnapshot,
        getThemeTransitionServerSnapshot,
    );
    const isLight = theme === 'light';

    const transitionTo = useCallback((targetTheme: ThemeMode, origin?: ThemeTransitionOrigin) => {
        transitionToTheme(targetTheme, origin);
    }, [transitionToTheme]);

    const toggleTheme = useCallback((origin?: ThemeTransitionOrigin) => {
        const targetTheme = isLight ? 'dark' : 'light';
        transitionTo(targetTheme, origin);
    }, [isLight, transitionTo]);

    return {
        isTransitioning: transitionState.isTransitioning,
        transitionDirection: transitionState.direction,
        transitionTo,
        toggleTheme,
        isLight
    };
}
