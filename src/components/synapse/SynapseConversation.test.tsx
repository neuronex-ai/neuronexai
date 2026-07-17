import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Message } from '@/types';

import { SynapseComposer, SynapseConversation } from './SynapseConversation';

vi.mock('./SynapseWidgetRenderer', () => ({
    SynapseWidgetRenderer: () => <div data-testid='synapse-widget' />,
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
        const { container } = render(<SynapseConversation messages={messages} isSending quickActions={[]} shouldReduceMotion onQuickAction={() => undefined} />);

        expect(screen.getByRole('log', { name: 'Conversa com o Synapse' })).toBeInTheDocument();
        expect(screen.getByText('Como está minha agenda?')).toBeInTheDocument();
        expect(screen.getByText('Hoje')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('Processando solicitação');
        expect(screen.getByText('Analisando')).toBeInTheDocument();
        expect(container.querySelector('.synapse-desktop-thinking')).toHaveAttribute('data-reduced-motion', 'true');

        fireEvent.click(screen.getByRole('button', { name: 'Copiar mensagem' }));
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('**Hoje** você tem três atendimentos.');
    });

    it('uses a continuously staggered processing signal when motion is enabled', () => {
        const { container } = render(
            <SynapseConversation
                messages={messages}
                isSending
                activityMode='responding'
                quickActions={[]}
                shouldReduceMotion={false}
                onQuickAction={() => undefined}
            />,
        );

        const indicator = container.querySelector('.synapse-desktop-thinking');
        const bars = [...container.querySelectorAll<HTMLElement>('.synapse-thinking-signal-bar')];
        expect(indicator).toHaveAttribute('data-activity', 'responding');
        expect(indicator).not.toHaveAttribute('data-reduced-motion');
        expect(bars).toHaveLength(3);
        expect(bars.map((bar) => bar.style.animationDelay)).toEqual(['0ms', '-120ms', '-240ms']);
    });

    it('does not expose internal tool identifiers from historical assistant messages', () => {
        render(
            <SynapseConversation
                messages={[{
                    ...messages[1],
                    id: 'assistant-technical',
                    content: 'Posso registrar uma nota de sessao (create_session_note) para voce.',
                }]}
                isSending={false}
                quickActions={[]}
                shouldReduceMotion
                onQuickAction={() => undefined}
            />,
        );

        expect(screen.queryByText(/create_session_note/i)).not.toBeInTheDocument();
        expect(screen.getByText(/Posso registrar uma nota de sessao para voce/i)).toBeInTheDocument();
    });

    it('preserves GFM structure and renders multiple Synapse widgets', () => {
        render(
            <SynapseConversation
                messages={[{
                    ...messages[1],
                    id: 'assistant-markdown',
                    content: [
                        '## Próximos passos',
                        '',
                        '- [x] Revisar agenda',
                        '- [ ] Confirmar paciente',
                        '',
                        '| Horário | Paciente |',
                        '| --- | --- |',
                        '| 14:00 | Ana |',
                        '',
                        '```json',
                        '{"__actionType":"get_calendar","data":{"appointments":[]}}',
                        '```',
                        '',
                        '```widget',
                        '{"type":"list_patients","data":{"patients":[]}}',
                        '```',
                    ].join('\n'),
                }]}
                isSending={false}
                quickActions={[]}
                shouldReduceMotion
                onQuickAction={() => undefined}
            />,
        );

        expect(screen.getByRole('heading', { name: 'Próximos passos' })).toBeInTheDocument();
        expect(screen.getByRole('table').closest('.synapse-markdown-table-scroll')).toBeInTheDocument();
        expect(screen.getAllByRole('checkbox')).toHaveLength(2);
        expect(screen.getAllByTestId('synapse-widget')).toHaveLength(2);
    });
});

describe('SynapseComposer', () => {
    it('sends with Enter, preserves Shift+Enter and toggles dictation', async () => {
        const user = userEvent.setup();
        const onSend = vi.fn();
        const onToggleListening = vi.fn();

        render(
            <SynapseComposer
                value='Olá, Synapse'
                isSending={false}
                isListening={false}
                sessionReady
                shouldReduceMotion
                onChange={() => undefined}
                onSend={onSend}
                onToggleListening={onToggleListening}
            />,
        );

        const textarea = screen.getByRole('textbox', {
            name: 'Mensagem para o Synapse',
        });
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
        const { rerender } = render(<SynapseComposer value='' {...props} />);
        const textarea = screen.getByRole('textbox', {
            name: 'Mensagem para o Synapse',
        });

        expect(screen.getByRole('button', { name: 'Enviar mensagem' })).toBeDisabled();
        Object.defineProperty(textarea, 'scrollHeight', {
            configurable: true,
            value: 180,
        });
        rerender(<SynapseComposer value={'Linha longa '.repeat(20)} {...props} />);

        expect(textarea).toHaveStyle({ height: '104px', overflowY: 'auto' });
    });
});
