import { useCallback } from 'react';
import { useTheme } from '@/hooks/use-theme';
import { type ThemeTransitionOrigin } from '@/lib/theme-transition';

type ThemeMode = 'light' | 'dark';

/**
 * Hook for managing cinematic theme transitions
 * Creates a smooth "light ascending" or "light descending" effect
 */
export function useThemeTransition() {
    const {
        theme,
        transitionToTheme,
        isTransitioning,
        transitionDirection,
        transitionPhase,
    } = useTheme();
    const isLight = theme === 'light';

    const transitionTo = useCallback((targetTheme: ThemeMode, origin?: ThemeTransitionOrigin) => {
        transitionToTheme(targetTheme, origin);
    }, [transitionToTheme]);

    const toggleTheme = useCallback((origin?: ThemeTransitionOrigin) => {
        const targetTheme = isLight ? 'dark' : 'light';
        transitionTo(targetTheme, origin);
    }, [isLight, transitionTo]);

    return {
        isTransitioning,
        transitionDirection,
        transitionPhase,
        transitionTo,
        toggleTheme,
        isLight
    };
}
