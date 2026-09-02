import { useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useSynapse } from '@/context/SynapseContext';
import { SynapseCompactPanel } from './SynapseCompactPanel';
import { SynapsePill } from './SynapsePill';
import { SynapseQuickComposer } from './SynapseQuickComposer';
import { SynapseTextAgentPlanBridge } from './SynapseTextAgentPlanBridge';
import { SynapseActivityToolGroupBridge } from './SynapseActivityToolGroupBridge';
import { AppointmentPlanReviewDialog } from '@/components/appointments/AppointmentPlanReviewDialog';
import { useReducedMotionPreference } from '@/hooks/use-reduced-motion-preference';
import '@/styles/synapse-workspace.css';

// ─── Z-Index Strategy ─────────────────────────────────────────────────
// Assistant chrome: z-index 90 (above page content, below alerts, sheets and dialogs).

export const SynapseGlobalShell = () => {
    const {
        activeSessionId,
        activeTab,
        actionExperience,
        cancelActionExperience,
        isVisible,
        setActiveTab,
        setIntentContextHint,
        setShellState,
        shellState,
        toggleVoiceMode,
        voicePhase,
        voiceStatus,
    } = useSynapse();
    const shouldReduceMotion = useReducedMotionPreference();
    const isVoiceConnectionActive =
        voiceStatus === 'connected' ||
        voiceStatus === 'connecting' ||
        voiceStatus === 'disconnecting';
    const isVoiceExperienceActive = activeTab === 'voice' || isVoiceConnectionActive;
    const wasVoiceExperienceActive = useRef(isVoiceExperienceActive);
    const wasVisible = useRef(isVisible);

    useEffect(() => {
        const shellJustBecameHidden = wasVisible.current && !isVisible;
        wasVisible.current = isVisible;
        if (!shellJustBecameHidden) return;

        setIntentContextHint('');
        setShellState('pill');
        setActiveTab('chat');
        if (voiceStatus === 'connected' || voiceStatus === 'connecting') {
            void toggleVoiceMode();
        }
    }, [isVisible, setActiveTab, setIntentContextHint, setShellState, toggleVoiceMode, voiceStatus]);

    useEffect(() => {
        const voiceJustEnded = wasVoiceExperienceActive.current && !isVoiceExperienceActive;
        wasVoiceExperienceActive.current = isVoiceExperienceActive;

        // Voice and text are one continuous conversation. When voice ends, return
        // to the lightweight composer instead of dropping the professional back
        // to the passive launcher.
        if (voiceJustEnded && shellState !== 'closed') {
            setActiveTab('chat');
            setShellState('composer');
        }
    }, [isVoiceExperienceActive, setActiveTab, setShellState, shellState]);

    useEffect(() => {
        if (typeof document === 'undefined') return undefined;

        const shouldUseSidecar =
            isVisible &&
            !isVoiceExperienceActive &&
            shellState === 'compact';

        document.body.classList.toggle('synapse-workspace-open', shouldUseSidecar);
        return () => document.body.classList.remove('synapse-workspace-open');
    }, [isVisible, isVoiceExperienceActive, shellState]);

    // ─── Keyboard shortcuts ───────────────────────────────────────────
    // Cmd/Ctrl + K: quick composer
    // Ctrl/Cmd + Shift + Space: continuous voice
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.repeat) return;

            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setActiveTab('chat');
                setShellState('composer');
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'Space') {
                e.preventDefault();
                setIntentContextHint('');
                setShellState('pill');
                void toggleVoiceMode();
                return;
            }

            if (e.key === 'Escape') {
                if (isVoiceExperienceActive) {
                    setActiveTab('chat');
                    if (voicePhase === 'awaiting_confirmation' && actionExperience) {
                        cancelActionExperience();
                    }
                    if (voiceStatus === 'connected' || voiceStatus === 'connecting') {
                        void toggleVoiceMode();
                    }
                    return;
                }
                if (voicePhase === 'awaiting_confirmation') {
                    if (actionExperience) cancelActionExperience();
                    return;
                }
                if (actionExperience) {
                    cancelActionExperience();
                    return;
                }
                if (shellState === 'compact') {
                    setShellState('composer');
                    return;
                }
                if (shellState === 'composer') {
                    setShellState('pill');
                }
            }
        },
        [
            actionExperience,
            cancelActionExperience,
            isVoiceExperienceActive,
            setActiveTab,
            setIntentContextHint,
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

    // The provider hides the shell on unsupported or unauthenticated surfaces.
    if (!isVisible) return null;

    const textAgentPlanEnabled =
        !isVoiceExperienceActive &&
        shellState === 'compact' &&
        activeTab === 'chat';

    const shell = (
        <>
            <AnimatePresence initial={false} mode="sync">
                {isVoiceExperienceActive ? (
                    <motion.div
                        key="synapse-voice-presence"
                        className="synapse-presence-layer fixed left-1/2 flex w-[min(320px,calc(100vw-32px))] -translate-x-1/2 flex-col items-center"
                        data-synapse-shell="true"
                        data-synapse-shell-placement="bottom-center"
                        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.97 }}
                        transition={shouldReduceMotion
                            ? { duration: 0 }
                            : { type: 'spring', stiffness: 360, damping: 38, mass: 0.78 }}
                        style={{
                            bottom: 'max(16px, env(safe-area-inset-bottom))',
                        }}
                    >
                        <SynapsePill mode="voice-presence" />
                    </motion.div>
                ) : shellState === 'compact' ? (
                    <SynapseCompactPanel key="synapse-compact-panel" />
                ) : shellState === 'composer' ? (
                    <motion.div
                        key="synapse-quick-composer"
                        className="synapse-presence-layer fixed"
                        data-synapse-shell="true"
                        data-synapse-shell-placement="bottom-right"
                        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.985 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.99 }}
                        transition={shouldReduceMotion
                            ? { duration: 0 }
                            : { type: 'spring', stiffness: 390, damping: 38, mass: 0.76 }}
                        style={{
                            right: 'max(16px, env(safe-area-inset-right))',
                            bottom: 'max(16px, env(safe-area-inset-bottom))',
                        }}
                    >
                        <SynapseQuickComposer />
                    </motion.div>
                ) : shellState === 'pill' ? (
                    <motion.div
                        key="synapse-launcher"
                        className="synapse-presence-layer fixed"
                        data-synapse-shell="true"
                        data-synapse-shell-placement="bottom-right"
                        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
                        transition={shouldReduceMotion
                            ? { duration: 0 }
                            : { type: 'spring', stiffness: 390, damping: 36, mass: 0.74 }}
                        style={{
                            right: 'max(16px, env(safe-area-inset-right))',
                            bottom: 'max(16px, env(safe-area-inset-bottom))',
                        }}
                    >
                        <SynapsePill mode="launcher" />
                    </motion.div>
                ) : null}
            </AnimatePresence>
            <SynapseTextAgentPlanBridge
                sessionId={activeSessionId}
                enabled={textAgentPlanEnabled}
            />
            <SynapseActivityToolGroupBridge />
            <AppointmentPlanReviewDialog />
        </>
    );

    return typeof document === 'undefined' ? shell : createPortal(shell, document.body);
};
