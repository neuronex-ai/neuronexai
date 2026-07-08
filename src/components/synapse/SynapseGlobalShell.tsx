import { useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useSynapse } from '@/context/SynapseProvider';
import { SynapsePill } from './SynapsePill';
import { SynapseCompactPanel } from './SynapseCompactPanel';

// ─── Z-Index Strategy ─────────────────────────────────────────────────
// Pill:          z-index 9990 (above page content, below modals)
// Compact Panel: z-index 9991
// This ensures the shell is always accessible but doesn't block
// system modals (toasts, dialogs) when in Pill/Compact state.

export const SynapseGlobalShell = () => {
    const { isVisible, shellState, setShellState } = useSynapse();

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
                if (shellState === 'compact') {
                    setShellState('pill');
                }
            }
        },
        [shellState, setShellState]
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
                className="fixed bottom-6 right-6 flex flex-col items-end gap-3"
                style={{ zIndex: 9990 }}
            >
                <AnimatePresence initial={false}>
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
