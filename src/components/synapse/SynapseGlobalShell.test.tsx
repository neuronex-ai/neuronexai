import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SynapseGlobalShell } from './SynapseGlobalShell';

const mocks = vi.hoisted(() => ({
    setShellState: vi.fn(),
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

vi.mock('./SynapseCompactPanel', () => ({
    SynapseCompactPanel: () => <div data-testid="compact-panel" />,
}));

vi.mock('@/components/appointments/AppointmentPlanReviewDialog', () => ({
    AppointmentPlanReviewDialog: () => null,
}));

describe('SynapseGlobalShell desktop experience', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.context = {
            actionExperience: null,
            activeTab: 'chat',
            cancelActionExperience: mocks.cancelActionExperience,
            isVisible: true,
            setActiveTab: vi.fn(),
            setShellState: mocks.setShellState,
            shellState: 'pill',
            toggleVoiceMode: mocks.toggleVoiceMode,
            voicePhase: 'idle',
            voiceStatus: 'disconnected',
        };
    });

    it('places the normal text and voice launcher at the bottom right', () => {
        render(<SynapseGlobalShell />);

        expect(screen.getByTestId('synapse-pill-launcher')).toBeInTheDocument();
        expect(screen.queryByTestId('compact-panel')).not.toBeInTheDocument();
        expect(document.querySelector('[data-synapse-shell="true"]')).toHaveAttribute(
            'data-synapse-shell-placement',
            'bottom-right',
        );
    });

    it('replaces the launcher with the existing compact text panel', () => {
        mocks.context = {
            ...mocks.context,
            shellState: 'compact',
        };
        render(<SynapseGlobalShell />);

        expect(screen.getByTestId('compact-panel')).toBeInTheDocument();
        expect(screen.queryByTestId('synapse-pill-launcher')).not.toBeInTheDocument();
    });

    it('toggles voice with Ctrl+Shift+Space', () => {
        render(<SynapseGlobalShell />);

        fireEvent.keyDown(document, { key: ' ', code: 'Space', ctrlKey: true, shiftKey: true });

        expect(mocks.setShellState).toHaveBeenCalledWith('pill');
        expect(mocks.toggleVoiceMode).toHaveBeenCalledTimes(1);
    });

    it('hides the launcher and panel while voice uses the centered presence', () => {
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
        expect(screen.queryByTestId('compact-panel')).not.toBeInTheDocument();
        expect(document.querySelector('[data-synapse-shell="true"]')).toHaveAttribute(
            'data-synapse-shell-placement',
            'bottom-center',
        );
    });

    it('ends voice with Escape and restores the launcher state', () => {
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

    it('renders nothing when the provider marks the surface as unsupported', () => {
        mocks.context = {
            ...mocks.context,
            isVisible: false,
        };
        render(<SynapseGlobalShell />);

        expect(screen.queryByTestId('synapse-pill-launcher')).not.toBeInTheDocument();
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
