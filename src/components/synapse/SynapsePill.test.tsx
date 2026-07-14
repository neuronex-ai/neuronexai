import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SynapsePill } from './SynapsePill';

const mocks = vi.hoisted(() => ({
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
        mocks.context = {
            actionExperience: null,
            execState: 'idle',
            getVoiceInputSignal: () => ({ rms: 0, low: 0, mid: 0, high: 0 }),
            getVoiceOutputSignal: () => ({ rms: 0, low: 0, mid: 0, high: 0 }),
            isVoiceSpeaking: false,
            isVoiceToolActive: false,
            toggleVoiceMode: mocks.toggleVoiceMode,
            voiceActivityLabel: '',
            voicePhase: 'idle',
            voiceStatus: 'disconnected',
        };
    });

    it('renders only the voice orb as the persistent control', () => {
        render(<SynapsePill />);

        fireEvent.click(screen.getByRole('button', { name: 'Iniciar conversa por voz' }));
        expect(mocks.toggleVoiceMode).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('liquid-orb')).toBeInTheDocument();
        expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /conversa por texto/i })).not.toBeInTheDocument();
    });

    it('uses the same orb click to end a continuous voice session', () => {
        mocks.context = {
            ...mocks.context,
            execState: 'listening',
            voicePhase: 'listening',
            voiceStatus: 'connected',
        };
        render(<SynapsePill />);

        const orb = screen.getByRole('button', { name: 'Encerrar conversa por voz' });
        expect(orb).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(orb);
        expect(mocks.toggleVoiceMode).toHaveBeenCalledTimes(1);
    });

    it('shows action feedback as one compact sentence without icons or progress bars', () => {
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
        render(<SynapsePill />);

        expect(document.querySelector('.synapse-presence-status')).toHaveTextContent('Conectando a análise ao mapa clínico');
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        expect(document.querySelector('.synapse-presence-status svg')).not.toBeInTheDocument();
    });
});
