import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SynapseGlobalShell } from './SynapseGlobalShell';

const mocks = vi.hoisted(() => ({
    setActiveTab: vi.fn(),
    setShellState: vi.fn(),
    toggleVoiceMode: vi.fn().mockResolvedValue(undefined),
    cancelActionExperience: vi.fn(),
    context: {} as Record<string, unknown>,
}));

vi.mock('@/context/SynapseProvider', () => ({
    useSynapse: () => mocks.context,
}));

vi.mock('./SynapsePill', () => ({
    SynapsePill: () => <div data-testid="presence-dock" />,
}));

vi.mock('./SynapseCompactPanel', () => ({
    SynapseCompactPanel: () => <div data-testid="compact-panel" />,
}));

describe('SynapseGlobalShell shortcuts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.context = {
            actionExperience: null,
            cancelActionExperience: mocks.cancelActionExperience,
            isVisible: true,
            setActiveTab: mocks.setActiveTab,
            setShellState: mocks.setShellState,
            shellState: 'pill',
            toggleVoiceMode: mocks.toggleVoiceMode,
            voicePhase: 'idle',
            voiceStatus: 'disconnected',
        };
    });

    it('opens the textual panel with Ctrl+J', () => {
        render(<SynapseGlobalShell />);

        fireEvent.keyDown(document, { key: 'j', code: 'KeyJ', ctrlKey: true });

        expect(mocks.setActiveTab).toHaveBeenCalledWith('chat');
        expect(mocks.setShellState).toHaveBeenCalledWith('compact');
    });

    it('toggles voice with Ctrl+Shift+Space without opening a second panel', () => {
        render(<SynapseGlobalShell />);

        fireEvent.keyDown(document, { key: ' ', code: 'Space', ctrlKey: true, shiftKey: true });

        expect(mocks.toggleVoiceMode).toHaveBeenCalledTimes(1);
        expect(mocks.setActiveTab).not.toHaveBeenCalled();
        expect(screen.getByTestId('presence-dock')).toBeInTheDocument();
    });

    it('ends an active voice session before collapsing the textual panel', () => {
        mocks.context = {
            ...mocks.context,
            shellState: 'compact',
            voicePhase: 'listening',
            voiceStatus: 'connected',
        };
        render(<SynapseGlobalShell />);

        fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

        expect(mocks.toggleVoiceMode).toHaveBeenCalledTimes(1);
        expect(mocks.setShellState).not.toHaveBeenCalledWith('pill');
    });
});
