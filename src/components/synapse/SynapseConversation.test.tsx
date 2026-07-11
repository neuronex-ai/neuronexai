import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Message } from '@/types';

import { SynapseComposer, SynapseConversation } from './SynapseConversation';

vi.mock('./SynapseWidgetRenderer', () => ({
    SynapseWidgetRenderer: () => <div data-testid="synapse-widget" />,
}));

const messages: Message[] = [
    {
        id: 'user-1',
        role: 'user',
        content: 'Como está minha agenda?',
        created_at: '2026-07-11T10:30:00.000Z',
        user_id: 'user',
    },
    {
        id: 'assistant-1',
        role: 'assistant',
        content: '**Hoje** você tem três atendimentos.',
        created_at: '2026-07-11T10:30:04.000Z',
        user_id: 'assistant',
    },
];

describe('SynapseConversation', () => {
    beforeEach(() => {
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: vi.fn().mockResolvedValue(undefined) },
        });
    });

    it('renders the premium empty state and applies a suggested prompt', async () => {
        const user = userEvent.setup();
        const onQuickAction = vi.fn();

        render(
            <SynapseConversation
                messages={[]}
                isSending={false}
                quickActions={[{ id: 'agenda', name: 'Mostrar agenda de hoje' }]}
                shouldReduceMotion
                onQuickAction={onQuickAction}
            />,
        );

        expect(screen.getByRole('heading', { name: 'Como posso ajudar?' })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Mostrar agenda de hoje' }));
        expect(onQuickAction).toHaveBeenCalledWith('Mostrar agenda de hoje');
    });

    it('renders both roles, exposes the activity state and copies assistant content', async () => {
        render(
            <SynapseConversation
                messages={messages}
                isSending
                quickActions={[]}
                shouldReduceMotion
                onQuickAction={() => undefined}
            />,
        );

        expect(screen.getByRole('log', { name: 'Conversa com o Synapse' })).toBeInTheDocument();
        expect(screen.getByText('Como está minha agenda?')).toBeInTheDocument();
        expect(screen.getByText('Hoje')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('Processando solicitação');

        fireEvent.click(screen.getByRole('button', { name: 'Copiar mensagem' }));
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('**Hoje** você tem três atendimentos.');
    });
});

describe('SynapseComposer', () => {
    it('sends with Enter, preserves Shift+Enter and toggles dictation', async () => {
        const user = userEvent.setup();
        const onSend = vi.fn();
        const onToggleListening = vi.fn();

        render(
            <SynapseComposer
                value="Olá, Synapse"
                isSending={false}
                isListening={false}
                sessionReady
                shouldReduceMotion
                onChange={() => undefined}
                onSend={onSend}
                onToggleListening={onToggleListening}
            />,
        );

        const textarea = screen.getByRole('textbox', { name: 'Mensagem para o Synapse' });
        fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
        expect(onSend).not.toHaveBeenCalled();

        fireEvent.keyDown(textarea, { key: 'Enter' });
        expect(onSend).toHaveBeenCalledTimes(1);

        await user.click(screen.getByRole('button', { name: 'Iniciar ditado' }));
        expect(onToggleListening).toHaveBeenCalledTimes(1);
    });

    it('caps automatic growth at five visual lines and disables empty submission', () => {
        const props = {
            isSending: false,
            isListening: false,
            sessionReady: true,
            shouldReduceMotion: true,
            onChange: vi.fn(),
            onSend: vi.fn(),
            onToggleListening: vi.fn(),
        };
        const { rerender } = render(<SynapseComposer value="" {...props} />);
        const textarea = screen.getByRole('textbox', { name: 'Mensagem para o Synapse' });

        expect(screen.getByRole('button', { name: 'Enviar mensagem' })).toBeDisabled();
        Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 180 });
        rerender(<SynapseComposer value={'Linha longa '.repeat(20)} {...props} />);

        expect(textarea).toHaveStyle({ height: '116px', overflowY: 'auto' });
    });
});
