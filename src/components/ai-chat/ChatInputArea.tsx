import { useState, useRef, useEffect } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Plus,
    Mic,
    StopCircle,
    ArrowUp,
    Loader2,
    X,
    File as FileIcon,
    Image as ImageIcon,
    Sparkles
} from "lucide-react";
import { AudioWaveform } from "./AudioWaveform";
import { cn } from "@/lib/utils";
import { useAI } from "@/context/AIContext";
import { usePatientById } from "@/hooks/use-patient-by-id";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

interface ChatInputAreaProps {
    onSend: (text: string, attachments: File[]) => void;
    isListening: boolean;
    isSending: boolean;
    isUploading: boolean;
    onStartListening: () => void;
    onStopListening: () => void;
    transcript: string;
}

export const ChatInputArea = ({
    onSend,
    isListening,
    isSending,
    isUploading,
    onStartListening,
    onStopListening,
    transcript
}: ChatInputAreaProps) => {
    const { activePatientId } = useAI();
    const { data: activePatient } = usePatientById(activePatientId || '');
    const shouldReduceMotion = useReducedMotion();

    const [inputValue, setInputValue] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const [attachments, setAttachments] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (transcript) {
            setInputValue(transcript);
        }
    }, [transcript]);

    useEffect(() => {
        if (textareaRef.current) {
            // Adjust height based on content
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${Math.min(scrollHeight, 240)}px`;
        }
    }, [inputValue, isFocused]);

    const isComposerBusy = isSending || isUploading;
    const canSend = Boolean(inputValue.trim() || attachments.length > 0) && !isComposerBusy && !isListening;

    const handleSend = () => {
        if (!canSend) return;
        onSend(inputValue, attachments);
        setInputValue("");
        setAttachments([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            setAttachments(prev => [...prev, ...newFiles]);
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="w-full flex flex-col gap-3 group/input">

            {/* Attachments Bar */}
            <AnimatePresence>
                {attachments.length > 0 && (
                    <motion.div
                        initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        className="flex gap-2 overflow-x-auto px-2 pb-1"
                    >
                        {attachments.map((file, i) => (
                            <div key={`${file.name}-${file.size}-${file.lastModified}-${i}`} className="flex shrink-0 items-center gap-2 rounded-xl border border-border/40 bg-background/80 px-3 py-2 shadow-sm backdrop-blur-xl dark:border-white/[0.075] dark:bg-white/[0.055]">
                                {file.type.startsWith('image/') ? <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" /> : <FileIcon className="w-3.5 h-3.5 text-muted-foreground" />}
                                <span className="text-[11px] font-medium text-foreground/80 truncate max-w-[100px]">{file.name}</span>
                                <button
                                    type="button"
                                    onClick={() => removeAttachment(i)}
                                    className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    aria-label={`Remover anexo ${file.name}`}
                                >
                                    <X className="w-3 h-3 text-muted-foreground" />
                                </button>
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Input Capsule - Premium Refinement */}
            <motion.div
                animate={{
                    minHeight: isFocused ? "110px" : "72px",
                    paddingTop: isFocused ? "24px" : "18px",
                    paddingBottom: isFocused ? "24px" : "18px"
                }}
                transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
                className={cn(
                    "relative flex items-end gap-3 rounded-[30px] border px-4 transition-[border-color,box-shadow,background-color] duration-300 sm:gap-4 sm:rounded-[34px] sm:px-6",
                    "border-zinc-950/[0.105] bg-white/76 shadow-[0_22px_70px_-48px_rgba(24,24,27,0.34),inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-2xl",
                    "dark:border-white/[0.075] dark:bg-[#050507]/88 dark:shadow-[0_22px_72px_-44px_rgba(0,0,0,0.96),inset_0_1px_0_rgba(255,255,255,0.038)]",
                    "before:pointer-events-none before:absolute before:inset-0 before:rounded-[30px] before:bg-[linear-gradient(135deg,rgba(255,255,255,0.48),transparent_44%,rgba(24,24,27,0.035)),radial-gradient(circle_at_50%_0%,rgba(24,24,27,0.038),transparent_68%)] before:opacity-70 before:content-[''] sm:before:rounded-[34px] dark:before:bg-[linear-gradient(135deg,rgba(255,255,255,0.052),transparent_46%,rgba(0,0,0,0.26)),radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.06),transparent_68%)] dark:before:opacity-90",
                    isFocused && "border-zinc-950/[0.18] shadow-[0_28px_82px_-52px_rgba(24,24,27,0.46),0_0_0_1px_rgba(24,24,27,0.08),inset_0_1px_0_rgba(255,255,255,0.86)] dark:border-white/[0.14] dark:shadow-[0_28px_82px_-52px_rgba(0,0,0,0.98),0_0_0_1px_rgba(255,255,255,0.045),inset_0_1px_0_rgba(255,255,255,0.055)]",
                    isListening && "border-emerald-500/30 shadow-[0_28px_82px_-54px_rgba(16,185,129,0.26),0_0_0_1px_rgba(16,185,129,0.16),inset_0_1px_0_rgba(255,255,255,0.76)] dark:border-emerald-400/24 dark:shadow-[0_28px_82px_-54px_rgba(16,185,129,0.22),0_0_0_1px_rgba(16,185,129,0.12),inset_0_1px_0_rgba(255,255,255,0.045)]"
                )}
            >
                {/* Left controls */}
                <div className="flex items-center gap-1.5 h-10 pb-1">
                    <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileSelect} aria-label="Adicionar anexos ao Synapse" />
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-9 w-9 shrink-0 rounded-full text-muted-foreground transition-all hover:bg-muted hover:text-foreground hover:scale-105 active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
                        disabled={isComposerBusy || isListening}
                        aria-label="Adicionar anexo"
                    >
                        <Plus className="h-4.5 w-4.5" />
                    </Button>

                    <AnimatePresence>
                        {activePatient && !isListening && !isFocused && (
                            <motion.div
                                initial={shouldReduceMotion ? false : { opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: "auto" }}
                                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, width: 0 }}
                                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                                className="hidden items-center gap-2 overflow-hidden whitespace-nowrap rounded-full border border-border/45 bg-muted/45 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-foreground shadow-sm sm:flex"
                            >
                                <Sparkles className="h-3 w-3 text-muted-foreground" />
                                <span className="max-w-[90px] truncate">{activePatient.name.split(' ')[0]}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Text Input Area */}
                <div className="relative flex h-full min-w-0 flex-1 items-center">
                        <Textarea
                            ref={textareaRef}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            onKeyDown={handleKeyDown}
                            placeholder="Pergunte sobre pacientes, agenda ou financeiro..."
                            aria-label="Mensagem para o Synapse"
                            className={cn(
                                "max-h-[240px] w-full resize-none border-none bg-transparent p-0 px-2 text-[15px] font-medium leading-relaxed text-foreground shadow-none outline-none scrollbar-none transition-all duration-300",
                                "placeholder:text-zinc-500/58 focus:border-transparent focus:outline-none focus:ring-0 focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-0 dark:placeholder:text-white/32",
                                isFocused ? "min-h-[60px]" : "min-h-[24px]"
                            )}
                            rows={1}
                            disabled={isComposerBusy}
                        />
                    <AnimatePresence>
                        {isListening && (
                            <motion.div
                                initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                                className="pointer-events-none absolute -bottom-6 left-2 right-2 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-300"
                            >
                                <AudioWaveform isListening />
                                <span>Transcrevendo</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-2 h-10 pb-0.5 pr-1">
                    {!inputValue && attachments.length === 0 ? (
                        <Button
                            size="icon"
                            variant="ghost"
                            onClick={isListening ? onStopListening : onStartListening}
                            className={cn(
                                "relative h-11 w-11 overflow-hidden rounded-full transition-all duration-300 motion-reduce:transition-none",
                                isListening
                                    ? "bg-emerald-500 text-white shadow-[0_18px_46px_-24px_rgba(16,185,129,0.55)]"
                                    : "text-zinc-500 hover:bg-zinc-950/[0.055] hover:text-zinc-950 dark:text-white/52 dark:hover:bg-white/[0.075] dark:hover:text-white"
                            )}
                            aria-label={isListening ? "Parar transcrição de voz" : "Iniciar transcrição de voz"}
                            disabled={isComposerBusy}
                        >
                            {isListening ? (
                                <span className="relative z-10 flex items-center justify-center">
                                    <StopCircle className="h-5.5 w-5.5 fill-current" />
                                </span>
                            ) : (
                                <Mic className="h-5.5 w-5.5" />
                            )}
                        </Button>
                    ) : (
                        <Button
                            size="icon"
                            onClick={handleSend}
                            disabled={!canSend}
                            className="h-10 w-10 rounded-full border border-transparent bg-primary text-primary-foreground shadow-lg transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-45 motion-reduce:active:scale-100"
                            aria-label="Enviar mensagem"
                        >
                            {isSending || isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-5 w-5 stroke-[2.5]" />}
                        </Button>
                    )}
                </div>
            </motion.div>

            {/* Hint Text */}
            <AnimatePresence>
                {isFocused && (
                    <motion.div
                        initial={shouldReduceMotion ? false : { opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -5 }}
                        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                        className="flex justify-between px-4 text-[10px] text-muted-foreground font-medium tracking-tight"
                    >
                        <span>Model: <span className="text-muted-foreground/80">Synapse v1.0</span></span>
                        <span>
                            <kbd className="font-sans px-1 text-muted-foreground/80 bg-secondary/50 rounded border border-border/10 mx-1">Enter</kbd> para enviar
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
