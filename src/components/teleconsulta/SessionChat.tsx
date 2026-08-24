import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { SessionChatMessage } from '@/types/chat';
import type { SupabaseClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, MessageSquare, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface SessionChatProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string;
  currentUserId: string;
  client?: SupabaseClient<any>;
}

export const SessionChat = ({
  isOpen,
  onClose,
  appointmentId,
  currentUserId,
  client = supabase,
}: SessionChatProps) => {
  const [messages, setMessages] = useState<SessionChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!appointmentId || !isOpen) return;
    let active = true;

    const fetchMessages = async () => {
      setIsLoading(true);
      const { data, error } = await client
        .from('session_chat_messages')
        .select('id, appointment_id, sender_id, sender_name, sender_role, content, created_at')
        .eq('appointment_id', appointmentId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!active) return;
      if (error) toast.error('Não foi possível carregar o chat da sessão.');
      else if (data) setMessages((data as SessionChatMessage[]).reverse());
      setIsLoading(false);
    };

    void fetchMessages();

    const channel = client
      .channel(`session-chat-${appointmentId}`)
      .on<SessionChatMessage>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'session_chat_messages',
          filter: `appointment_id=eq.${appointmentId}`,
        },
        (payload) => {
          setMessages((current) => {
            if (current.some((message) => message.id === payload.new.id)) return current;
            return [...current.slice(-99), payload.new];
          });
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') toast.error('O chat perdeu a sincronização em tempo real.');
      });

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [appointmentId, client, isOpen]);

  useEffect(() => {
    if (!isOpen || !scrollRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, isOpen]);

  const handleSendMessage = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const content = newMessage.trim();
    if (!content || isSending) return;

    setIsSending(true);
    const { error } = await client.rpc('send_session_chat_message', {
      p_appointment_id: appointmentId,
      p_content: content,
    });

    if (error) toast.error('Não foi possível enviar a mensagem.');
    else setNewMessage('');
    setIsSending(false);
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.button
            type="button"
            aria-label="Fechar chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="absolute inset-0 z-40 bg-black/55 lg:hidden"
          />
          <motion.aside
            initial={{ x: -18, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -18, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="teleconsultation-surface absolute bottom-28 left-5 top-24 z-50 flex w-[min(370px,calc(100%-2.5rem))] min-h-0 flex-col overflow-hidden rounded-[26px] sm:left-6"
            aria-label="Chat da sessão"
          >
            <header className="flex shrink-0 items-center justify-between border-b border-border/40 p-5 dark:border-white/[0.045]">
              <div className="flex items-center gap-3">
                <div className="teleconsultation-inset flex h-9 w-9 items-center justify-center rounded-[13px]">
                  <MessageSquare className="h-4 w-4" aria-hidden="true" />
                </div>
                <h3 className="text-sm font-black tracking-[-0.02em] text-foreground">Chat da sessão</h3>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-11 w-11 rounded-full" aria-label="Fechar chat">
                <X className="h-4 w-4" />
              </Button>
            </header>

            <div ref={scrollRef} className="teleconsultation-scroll min-h-0 flex-1 space-y-5 overflow-y-auto p-5" aria-live="polite">
              {isLoading ? (
                <div className="flex h-full items-center justify-center text-muted-foreground" role="status">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center space-y-2 text-center text-muted-foreground/55">
                  <MessageSquare className="h-8 w-8" aria-hidden="true" />
                  <p className="text-xs">Nenhuma mensagem ainda.</p>
                </div>
              ) : messages.map((message) => {
                const isMe = message.sender_id === currentUserId;
                return (
                  <article key={message.id} className={cn('teleconsultation-deferred-section flex max-w-[88%] flex-col', isMe ? 'ml-auto items-end' : 'mr-auto items-start')}>
                    <div className="mb-1.5 flex items-end gap-2">
                      {!isMe ? (
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="bg-muted text-[9px] text-muted-foreground">
                            {message.sender_name?.[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ) : null}
                      <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                        {isMe ? 'Você' : message.sender_name}
                      </span>
                    </div>
                    <div className={cn(
                      'break-words px-4 py-2.5 text-sm leading-relaxed',
                      isMe
                        ? 'rounded-[18px] rounded-tr-sm bg-foreground text-background'
                        : 'teleconsultation-inset rounded-[18px] rounded-tl-sm text-foreground/85',
                    )}>
                      {message.content}
                    </div>
                    <time className="mt-1 px-1 text-[9px] text-muted-foreground" dateTime={message.created_at}>
                      {format(new Date(message.created_at), 'HH:mm')}
                    </time>
                  </article>
                );
              })}
            </div>

            <footer className="shrink-0 border-t border-border/40 p-4 dark:border-white/[0.045]">
              <form onSubmit={(event) => void handleSendMessage(event)} className="teleconsultation-inset flex items-center gap-2 rounded-full p-1.5 pl-3 focus-within:ring-2 focus-within:ring-ring">
                <Input
                  value={newMessage}
                  onChange={(event) => setNewMessage(event.target.value)}
                  placeholder="Digite uma mensagem..."
                  className="h-9 flex-1 border-0 bg-transparent px-3 text-sm shadow-none focus-visible:ring-0"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!newMessage.trim() || isSending}
                  className="teleconsultation-action h-11 w-11 rounded-full bg-foreground text-background"
                  aria-label="Enviar mensagem"
                >
                  {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </Button>
              </form>
            </footer>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
};
