import { useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useSynapse } from '@/context/SynapseProvider';
import { SynapsePill } from './SynapsePill';
import { SynapseCompactPanel } from './SynapseCompactPanel';
import { SynapseActionOrchestrator } from './SynapseActionOrchestrator';

// ─── Z-Index Strategy ─────────────────────────────────────────────────
// Pill:          z-index 9990 (above page content, below modals)
// Compact Panel: z-index 9991
// This ensures the shell is always accessible but doesn't block
// system modals (toasts, dialogs) when in Pill/Compact state.

export const SynapseGlobalShell = () => {
    const { isVisible, shellState, setShellState, actionExperience, cancelActionExperience } = useSynapse();

    // ─── Keyboard Shortcut: Ctrl+J ─────────────────────────────────────
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
                e.preventDefault();
                if (shellState === 'pill') {
                    setShellState('compact');
                } else if (shellState === 'compact') {
                    setShellState('pill');
                }
            }

            // Escape to close
            if (e.key === 'Escape') {
                if (actionExperience) cancelActionExperience();
                if (shellState === 'compact') {
                    setShellState('pill');
                }
            }
        },
        [actionExperience, cancelActionExperience, shellState, setShellState]
    );

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // Don't render on mobile, unauthenticated, or non-Electron
    if (!isVisible) return null;

    return (
        <>
            {/* Fixed container for Pill + Compact (bottom-right) */}
            <div
                className="fixed flex flex-col items-end gap-3"
                data-synapse-shell="true"
                style={{
                    zIndex: 9990,
                    right: 'max(12px, env(safe-area-inset-right))',
                    bottom: 'max(12px, env(safe-area-inset-bottom))',
                }}
            >
                <SynapseActionOrchestrator />
                <AnimatePresence initial={false} mode="sync">
                    {shellState === 'compact' ? (
                        <SynapseCompactPanel key="compact" />
                    ) : (
                        <SynapsePill key="pill" />
                    )}
                </AnimatePresence>
            </div>
        </>
    );
};
