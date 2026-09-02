import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SynapseGlobalShell } from './SynapseGlobalShell';

const mocks = vi.hoisted(() => ({
    setShellState: vi.fn(),
    setIntentContextHint: vi.fn(),
    toggleVoiceMode: vi.fn().mockResolvedValue(undefined),
    cancelActionExperience: vi.fn(),
    context: {} as Record<string, unknown>,
}));

vi.mock('@/context/SynapseContext', () => ({
    useSynapse: () => mocks.context,
}));

vi.mock('./SynapsePill', () => ({
    SynapsePill: ({ mode }: { mode: string }) => <div data-testid={`synapse-pill-${mode}`} />,
}));

vi.mock('./SynapseQuickComposer', () => ({
    SynapseQuickComposer: () => <div data-testid="quick-composer" />,
}));

vi.mock('./SynapseCompactPanel', () => ({
    SynapseCompactPanel: () => <div data-testid="compact-panel" />,
}));

vi.mock('@/components/appointments/AppointmentPlanReviewDialog', () => ({
    AppointmentPlanReviewDialog: () => null,
}));

vi.mock('./SynapseTextAgentPlanBridge', () => ({
    SynapseTextAgentPlanBridge: () => null,
}));

vi.mock('./SynapseActivityToolGroupBridge', () => ({
    SynapseActivityToolGroupBridge: () => null,
}));

describe('SynapseGlobalShell desktop experience', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.classList.remove('synapse-workspace-open');
        mocks.context = {
            actionExperience: null,
            activeSessionId: null,
            activeTab: 'chat',
            cancelActionExperience: mocks.cancelActionExperience,
            isVisible: true,
            setActiveTab: vi.fn(),
            setIntentContextHint: mocks.setIntentContextHint,
            setShellState: mocks.setShellState,
            shellState: 'pill',
            toggleVoiceMode: mocks.toggleVoiceMode,
            voicePhase: 'idle',
            voiceStatus: 'disconnected',
        };
    });

    it('places the passive launcher at the bottom right', () => {
        render(<SynapseGlobalShell />);

        expect(screen.getByTestId('synapse-pill-launcher')).toBeInTheDocument();
        expect(screen.queryByTestId('quick-composer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('compact-panel')).not.toBeInTheDocument();
        expect(document.querySelector('[data-synapse-shell="true"]')).toHaveAttribute(
            'data-synapse-shell-placement',
            'bottom-right',
        );
    });

    it('renders the quick composer as the intermediate shell state', () => {
        mocks.context = {
            ...mocks.context,
            shellState: 'composer',
        };
        render(<SynapseGlobalShell />);

        expect(screen.getByTestId('quick-composer')).toBeInTheDocument();
        expect(screen.queryByTestId('compact-panel')).not.toBeInTheDocument();
        expect(screen.queryByTestId('synapse-pill-launcher')).not.toBeInTheDocument();
    });

    it('uses the compact panel only for the full workspace state', () => {
        mocks.context = {
            ...mocks.context,
            shellState: 'compact',
        };
        render(<SynapseGlobalShell />);

        expect(screen.getByTestId('compact-panel')).toBeInTheDocument();
        expect(screen.queryByTestId('quick-composer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('synapse-pill-launcher')).not.toBeInTheDocument();
        expect(document.body).toHaveClass('synapse-workspace-open');
    });

    it('opens the quick composer with Ctrl+K', () => {
        render(<SynapseGlobalShell />);

        fireEvent.keyDown(document, { key: 'k', code: 'KeyK', ctrlKey: true });

        expect(mocks.context.setActiveTab).toHaveBeenCalledWith('chat');
        expect(mocks.setShellState).toHaveBeenCalledWith('composer');
    });

    it('toggles voice with Ctrl+Shift+Space', () => {
        render(<SynapseGlobalShell />);

        fireEvent.keyDown(document, { key: ' ', code: 'Space', ctrlKey: true, shiftKey: true });

        expect(mocks.setIntentContextHint).toHaveBeenCalledWith('');
        expect(mocks.setShellState).toHaveBeenCalledWith('pill');
        expect(mocks.toggleVoiceMode).toHaveBeenCalledTimes(1);
    });

    it('hides launcher, composer and workspace while voice uses centered presence', () => {
        mocks.context = {
            ...mocks.context,
            activeTab: 'voice',
            shellState: 'compact',
            voicePhase: 'listening',
            voiceStatus: 'connected',
        };
        render(<SynapseGlobalShell />);

        expect(screen.getByTestId('synapse-pill-voice-presence')).toBeInTheDocument();
        expect(screen.queryByTestId('synapse-pill-launcher')).not.toBeInTheDocument();
        expect(screen.queryByTestId('quick-composer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('compact-panel')).not.toBeInTheDocument();
        expect(document.querySelector('[data-synapse-shell="true"]')).toHaveAttribute(
            'data-synapse-shell-placement',
            'bottom-center',
        );
        expect(document.body).not.toHaveClass('synapse-workspace-open');
    });

    it('ends voice with Escape and lets teardown restore the conversation flow', () => {
        const setActiveTab = vi.fn();
        mocks.context = {
            ...mocks.context,
            activeTab: 'voice',
            setActiveTab,
            voicePhase: 'listening',
            voiceStatus: 'connected',
        };
        render(<SynapseGlobalShell />);

        fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

        expect(mocks.setShellState).toHaveBeenCalledWith('pill');
        expect(setActiveTab).toHaveBeenCalledWith('chat');
        expect(mocks.toggleVoiceMode).toHaveBeenCalledTimes(1);
    });

    it('steps backward from workspace to composer and then launcher with Escape', () => {
        mocks.context = { ...mocks.context, shellState: 'compact' };
        const { rerender } = render(<SynapseGlobalShell />);

        fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
        expect(mocks.setShellState).toHaveBeenCalledWith('composer');

        vi.clearAllMocks();
        mocks.context = { ...mocks.context, shellState: 'composer' };
        rerender(<SynapseGlobalShell />);
        fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
        expect(mocks.setShellState).toHaveBeenCalledWith('pill');
    });

    it('renders nothing when the provider marks the surface as unsupported', () => {
        mocks.context = {
            ...mocks.context,
            isVisible: false,
        };
        render(<SynapseGlobalShell />);

        expect(screen.queryByTestId('synapse-pill-launcher')).not.toBeInTheDocument();
        expect(screen.queryByTestId('quick-composer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('compact-panel')).not.toBeInTheDocument();
    });

    it('ends an active voice session when navigation leaves the supported desktop surface', async () => {
        const setActiveTab = vi.fn();
        mocks.context = {
            ...mocks.context,
            activeTab: 'voice',
            setActiveTab,
            voicePhase: 'listening',
            voiceStatus: 'connected',
        };
        const { rerender } = render(<SynapseGlobalShell />);

        mocks.context = {
            ...mocks.context,
            isVisible: false,
        };
        rerender(<SynapseGlobalShell />);

        await waitFor(() => expect(mocks.toggleVoiceMode).toHaveBeenCalledTimes(1));
        expect(mocks.setShellState).toHaveBeenCalledWith('pill');
        expect(setActiveTab).toHaveBeenCalledWith('chat');
    });
});
