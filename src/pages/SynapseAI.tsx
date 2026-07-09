import { useRef, useEffect, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useSynapseChat } from '@/hooks/use-synapse-chat';
import { ChatMessageItem } from '@/components/ai-chat/ChatMessageItem';
import { 
    ArrowUp, 
    Loader2, 
    Sparkles, 
    Mic,
    ChevronLeft,
    Trash2,
    Plus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SynapseOrbAvatar } from '@/components/synapse/SynapseOrbAvatar';

export default function SynapseAI() {
    const { send, messages, isSending, sessionReady, clearSession } = useSynapseChat();
    const navigate = useNavigate();
    
    const [input, setInput] = useState('');
    const [isInputFocused, setIsInputFocused] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = () => {
        if (!input.trim() || !sessionReady) return;
        send(input.trim());
        setInput('');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isSending) handleSend();
        }
    };

    return (
        <div className="flex h-screen flex-col bg-background selection:bg-primary/20">
            {/* Header */}
            <header className="flex h-20 items-center justify-between border-b border-border/40 px-8 backdrop-blur-xl">
                <div className="flex items-center gap-5">
                    <button 
                        onClick={() => navigate(-1)}
                        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/40 bg-muted/35 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div className="flex items-center gap-4">
                        <SynapseOrbAvatar className="h-10 w-10" />
                        <div>
                            <h1 className="text-[15px] font-black uppercase tracking-[0.24em] text-foreground">
                                Synapse
                            </h1>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                Consultoria de Inteligência Clínica
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {messages.length > 0 && (
                        <button
                            onClick={clearSession}
                            className="flex h-11 items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 text-[10px] font-black uppercase tracking-widest text-red-600 transition-all hover:bg-red-500/10 dark:text-red-400"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            Limpar Histórico
                        </button>
                    )}
                    <button
                        onClick={clearSession}
                        className="flex h-11 items-center gap-2 rounded-2xl bg-primary px-5 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Nova Conversa
                    </button>
                </div>
            </header>

            {/* Chat Area */}
            <main 
                ref={scrollRef}
                className="flex-1 overflow-y-auto custom-scrollbar px-4 py-10 md:px-0"
            >
                <div className="mx-auto max-w-3xl space-y-10">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-[32px] border border-border/40 bg-muted/35 text-muted-foreground shadow-sm">
                                <Sparkles className="h-9 w-9" />
                            </div>
                            <h2 className="text-2xl font-black tracking-tight text-foreground md:text-3xl">
                                Como posso ajudar hoje?
                            </h2>
                            <p className="mt-3 max-w-md text-[15px] font-medium leading-relaxed text-muted-foreground">
                                Sou seu assistente de inteligência. Peça para analisar dados financeiros, resumir prontuários ou organizar sua agenda.
                            </p>
                            
                            <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {[
                                    "Resuma meu faturamento deste mês",
                                    "Quais pacientes não vêm há mais de 15 dias?",
                                    "Agende uma sessão para amanhã às 14h",
                                    "Crie um modelo de recibo de terapia"
                                ].map((suggestion) => (
                                    <button
                                        key={suggestion}
                                        onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}
                                        className="rounded-3xl border border-border/45 bg-muted/30 px-6 py-4 text-left text-[13px] font-bold text-muted-foreground transition-all hover:border-foreground/10 hover:bg-muted/60 hover:text-foreground"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8 pb-10">
                            {messages.map((msg) => (
                                <ChatMessageItem key={msg.id} message={msg} />
                            ))}
                            
                            {isSending && (
                                <div className="flex gap-4 px-8">
                                    <SynapseOrbAvatar className="h-9 w-9" />
                                    <div className="flex items-center gap-1.5 rounded-[28px] border border-border/40 bg-muted/20 px-6 py-4">
                                        {[0, 0.15, 0.3].map((delay) => (
                                            <motion.div
                                                key={delay}
                                                animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                                                transition={{ repeat: Infinity, duration: 0.8, delay }}
                                                className="h-1.5 w-1.5 rounded-full bg-foreground/50"
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {/* Input Area */}
            <footer className="border-t border-border/40 bg-background/80 p-8 backdrop-blur-xl">
                <div className="mx-auto max-w-3xl">
                    <motion.div
                        animate={{
                            y: isInputFocused ? -2 : 0,
                            boxShadow: isInputFocused 
                                ? '0 30px 80px -25px rgba(0,0,0,0.18)' 
                                : '0 10px 40px -30px rgba(0,0,0,0.1)'
                        }}
                        className={cn(
                            "relative flex items-end gap-4 rounded-[32px] border p-4 transition-all duration-300",
                            isInputFocused 
                                ? "border-foreground/20 bg-background dark:border-white/20" 
                                : "border-border/60 bg-muted/25"
                        )}
                    >
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onFocus={() => setIsInputFocused(true)}
                            onBlur={() => setIsInputFocused(false)}
                            onKeyDown={handleKeyDown}
                            placeholder="Descreva sua solicitação..."
                            rows={1}
                            className="max-h-48 min-h-[48px] flex-1 resize-none bg-transparent px-2 py-3 text-[16px] font-medium text-foreground outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 border-0 placeholder:text-muted-foreground/50 disabled:opacity-50"
                        />
                        
                        <div className="flex items-center gap-2 pb-1 pr-1">
                            <button
                                type="button"
                                className="flex h-12 w-12 items-center justify-center rounded-[20px] text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90"
                            >
                                <Mic className="h-5 w-5" />
                            </button>
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || isSending}
                                className={cn(
                                    "flex h-12 w-12 items-center justify-center rounded-[20px] transition-all duration-300 active:scale-95",
                                    input.trim() 
                                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                                        : "bg-muted/60 text-muted-foreground/40"
                                )}
                            >
                                {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
                            </button>
                        </div>
                    </motion.div>
                    <p className="mt-4 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">
                        Pressione Enter para enviar • Shift + Enter para nova linha
                    </p>
                </div>
            </footer>
        </div>
    );
}
