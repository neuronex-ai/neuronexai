import { useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useSynapse } from '@/context/SynapseProvider';
import { SynapsePill } from './SynapsePill';
import { SynapseCompactPanel } from './SynapseCompactPanel';

// ─── Z-Index Strategy ─────────────────────────────────────────────────
// Assistant chrome: z-index 90 (above page content, below alerts, sheets and dialogs).

export const SynapseGlobalShell = () => {
    const {
        actionExperience,
        cancelActionExperience,
        isVisible,
        setActiveTab,
        setShellState,
        shellState,
        toggleVoiceMode,
        voicePhase,
        voiceStatus,
    } = useSynapse();

    // ─── Keyboard Shortcut: Ctrl+J ─────────────────────────────────────
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.repeat) return;

            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'j') {
                e.preventDefault();
                setActiveTab('chat');
                if (shellState === 'compact') {
                    setShellState('pill');
                } else {
                    setShellState('compact');
                }
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'Space') {
                e.preventDefault();
                if (shellState === 'closed') setShellState('pill');
                void toggleVoiceMode();
                return;
            }

            if (e.key === 'Escape') {
                if (voicePhase === 'awaiting_confirmation') {
                    if (actionExperience) cancelActionExperience();
                    if (voiceStatus === 'connected' || voiceStatus === 'connecting') void toggleVoiceMode();
                    return;
                }
                if (voiceStatus === 'connected' || voiceStatus === 'connecting') {
                    void toggleVoiceMode();
                    return;
                }
                if (actionExperience) {
                    cancelActionExperience();
                    return;
                }
                if (shellState === 'compact') {
                    setShellState('pill');
                }
            }
        },
        [
            actionExperience,
            cancelActionExperience,
            setActiveTab,
            setShellState,
            shellState,
            toggleVoiceMode,
            voicePhase,
            voiceStatus,
        ]
    );

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // Don't render on mobile, unauthenticated, or non-Electron
    if (!isVisible) return null;

    const shell = (
        <>
            {/* The compact conversation sheet shares the same bottom-center spatial anchor as the persistent presence. */}
            <AnimatePresence initial={false}>
                {shellState === 'compact' ? <SynapseCompactPanel key="compact" /> : null}
            </AnimatePresence>

            {shellState !== 'closed' ? (
                <div
                    className="synapse-presence-layer fixed flex w-[min(464px,calc(100vw-24px))] -translate-x-1/2 flex-col items-center"
                    data-synapse-shell="true"
                    data-synapse-shell-placement="bottom-center"
                    style={{
                        left: '50%',
                        bottom: 'max(12px, env(safe-area-inset-bottom))',
                    }}
                >
                    <SynapsePill />
                </div>
            ) : null}
        </>
    );

    return typeof document === 'undefined' ? shell : createPortal(shell, document.body);
};
