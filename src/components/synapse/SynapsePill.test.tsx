import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SynapsePill } from './SynapsePill';

const mocks = vi.hoisted(() => ({
    setActiveTab: vi.fn(),
    setIntentContextHint: vi.fn(),
    setShellState: vi.fn(),
    toggleVoiceMode: vi.fn().mockResolvedValue(undefined),
    context: {} as Record<string, unknown>,
}));

vi.mock('@/context/SynapseContext', () => ({
    useSynapse: () => mocks.context,
}));

vi.mock('./SynapseLiquidOrb', () => ({
    SynapseLiquidOrb: () => <span data-testid="liquid-orb" />,
}));

describe('Synapse voice presence', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.documentElement.classList.remove('reduce-motion');
        mocks.context = {
            actionExperience: null,
            execState: 'idle',
            getVoiceInputSignal: () => ({ rms: 0, low: 0, mid: 0, high: 0 }),
            getVoiceOutputSignal: () => ({ rms: 0, low: 0, mid: 0, high: 0 }),
            isVoiceSpeaking: false,
            isVoiceToolActive: false,
            setActiveTab: mocks.setActiveTab,
            setIntentContextHint: mocks.setIntentContextHint,
            setShellState: mocks.setShellState,
            toggleVoiceMode: mocks.toggleVoiceMode,
            voiceActivityLabel: '',
            voicePhase: 'idle',
            voiceStatus: 'disconnected',
        };
    });

    afterEach(() => {
        document.documentElement.classList.remove('reduce-motion');
    });

    it('offers lightweight text and voice entry points in the persistent launcher', () => {
        render(<SynapsePill />);

        const launcher = screen.getByRole('toolbar', { name: 'Conversar com o Synapse' });
        expect(launcher).toBeInTheDocument();
        expect(launcher).toHaveAttribute('data-theme-adaptive', 'true');
        expect(launcher).toHaveAttribute('data-magnetic-motion', 'enabled');

        const textAction = screen.getByRole('button', { name: 'Abrir compositor do Synapse' });
        const voiceAction = screen.getByRole('button', { name: 'Iniciar conversa por voz com o Synapse' });
        expect(textAction).toHaveAttribute('aria-controls', 'synapse-quick-composer');
        expect(textAction).toHaveAttribute('data-synapse-action', 'text');
        expect(voiceAction).toHaveAttribute('aria-pressed', 'false');
        expect(voiceAction).toHaveAttribute('data-synapse-action', 'voice');

        fireEvent.click(textAction);
        expect(mocks.setIntentContextHint).toHaveBeenCalledWith('');
        expect(mocks.setActiveTab).toHaveBeenCalledWith('chat');
        expect(mocks.setShellState).toHaveBeenCalledWith('composer');

        fireEvent.click(voiceAction);
        expect(mocks.setShellState).toHaveBeenCalledWith('pill');
        expect(mocks.toggleVoiceMode).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId('liquid-orb')).not.toBeInTheDocument();
    });

    it('disables launcher magnetism for the internal reduced-motion preference', () => {
        document.documentElement.classList.add('reduce-motion');

        render(<SynapsePill />);

        expect(screen.getByRole('toolbar', { name: 'Conversar com o Synapse' })).toHaveAttribute(
            'data-magnetic-motion',
            'reduced',
        );
    });

    it('uses the centered voice presence to end a continuous voice session', () => {
        mocks.context = {
            ...mocks.context,
            execState: 'listening',
            voicePhase: 'listening',
            voiceStatus: 'connected',
        };
        render(<SynapsePill mode="voice-presence" />);

        const orb = screen.getByRole('button', { name: 'Encerrar conversa por voz' });
        expect(orb).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(orb);
        expect(mocks.toggleVoiceMode).toHaveBeenCalledTimes(1);
    });

    it('shows action feedback as one compact sentence without progress chrome', () => {
        mocks.context = {
            ...mocks.context,
            actionExperience: {
                id: 'action-1',
                phase: 'navigating',
                label: 'Abrindo NeuroView',
                message: 'Conectando a análise ao mapa clínico',
            },
            execState: 'executing',
        };
        const { rerender } = render(<SynapsePill mode="voice-presence" />);

        const status = document.querySelector('.synapse-presence-status');
        expect(status).toHaveTextContent('Conectando a análise ao mapa clínico');
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        expect(document.querySelector('.synapse-presence-status svg')).not.toBeInTheDocument();

        mocks.context = {
            ...mocks.context,
            actionExperience: {
                id: 'action-2',
                phase: 'navigating',
                label: 'Abrindo NeuroView',
                message: 'Abrindo NeuroView',
            },
        };
        rerender(<SynapsePill mode="voice-presence" />);
        expect(document.querySelector('.synapse-presence-status')).toBe(status);
    });
});
