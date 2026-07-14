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
    SynapsePill: () => <div data-testid="voice-orb" />,
}));

describe('SynapseGlobalShell voice-only presence', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.context = {
            actionExperience: null,
            cancelActionExperience: mocks.cancelActionExperience,
            isVisible: true,
            setShellState: mocks.setShellState,
            shellState: 'pill',
            toggleVoiceMode: mocks.toggleVoiceMode,
            voicePhase: 'idle',
            voiceStatus: 'disconnected',
        };
    });

    it('keeps the text chat shortcut disabled while the chat is hidden', () => {
        render(<SynapseGlobalShell />);

        fireEvent.keyDown(document, { key: 'j', code: 'KeyJ', ctrlKey: true });

        expect(mocks.setShellState).not.toHaveBeenCalled();
        expect(screen.getByTestId('voice-orb')).toBeInTheDocument();
        expect(screen.queryByTestId('compact-panel')).not.toBeInTheDocument();
    });

    it('toggles voice with Ctrl+Shift+Space', () => {
        render(<SynapseGlobalShell />);

        fireEvent.keyDown(document, { key: ' ', code: 'Space', ctrlKey: true, shiftKey: true });

        expect(mocks.toggleVoiceMode).toHaveBeenCalledTimes(1);
    });

    it('ends the active voice session with Escape', () => {
        mocks.context = {
            ...mocks.context,
            voicePhase: 'listening',
            voiceStatus: 'connected',
        };
        render(<SynapseGlobalShell />);

        fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
        expect(mocks.toggleVoiceMode).toHaveBeenCalledTimes(1);
    });

    it('docks the existing voice presence at the edge while an assisted surface stays active', async () => {
        mocks.context = {
            ...mocks.context,
            actionExperience: {
                id: 'action-1',
                phase: 'focusing',
                action: 'open_neuroview_reasoning',
                label: 'NeuroView',
                message: 'Destacando o subgrafo',
                product: 'neuroview',
            },
            voicePhase: 'speaking',
            voiceStatus: 'connected',
        };
        render(<SynapseGlobalShell />);

        await waitFor(() => expect(document.querySelector('[data-synapse-shell="true"]')).toHaveAttribute(
            'data-synapse-shell-placement',
            'bottom-right',
        ));
    });
});
