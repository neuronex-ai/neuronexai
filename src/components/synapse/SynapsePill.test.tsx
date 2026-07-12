import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SynapsePill } from './SynapsePill';

const mocks = vi.hoisted(() => ({
    setActiveTab: vi.fn(),
    setShellState: vi.fn(),
    toggleVoiceMode: vi.fn().mockResolvedValue(undefined),
    context: {} as Record<string, unknown>,
}));

vi.mock('@/context/SynapseProvider', () => ({
    useSynapse: () => mocks.context,
}));

describe('Synapse adaptive presence', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.context = {
            actionExperience: null,
            activeTab: 'chat',
            execState: 'idle',
            getVoiceInputVolume: () => 0,
            isVoiceSpeaking: false,
            isVoiceToolActive: false,
            setActiveTab: mocks.setActiveTab,
            setShellState: mocks.setShellState,
            shellState: 'pill',
            toggleVoiceMode: mocks.toggleVoiceMode,
            voiceActivityLabel: '',
            voiceActivityMessage: '',
            voicePhase: 'idle',
            voiceStatus: 'disconnected',
        };
    });

    it('offers voice and text from one bottom dock', () => {
        render(<SynapsePill />);

        expect(screen.getByRole('toolbar', { name: 'Presença Synapse' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Iniciar conversa por voz' }));
        expect(mocks.toggleVoiceMode).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole('button', { name: 'Abrir conversa por texto' }));
        expect(mocks.setActiveTab).toHaveBeenCalledWith('chat');
        expect(mocks.setShellState).toHaveBeenCalledWith('compact');
    });

    it('collapses to the larger listening orb while voice is active', () => {
        mocks.context = {
            ...mocks.context,
            execState: 'listening',
            voicePhase: 'listening',
            voiceStatus: 'connected',
        };
        render(<SynapsePill />);

        expect(screen.getByRole('button', { name: 'Encerrar conversa por voz' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.queryByRole('button', { name: /conversa por texto/i })).not.toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('Ouvindo');
    });

    it('exposes action progress and a textual state', () => {
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

        expect(screen.getByRole('status')).toHaveTextContent('Abrindo NeuroView');
        expect(screen.getByRole('progressbar', { name: 'Progresso do Synapse' })).toHaveAttribute('aria-valuenow', '48');
    });
});
