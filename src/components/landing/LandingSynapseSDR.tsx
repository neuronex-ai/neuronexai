import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Send, X, Sparkles, RotateCcw } from "lucide-react";
import { VoiceSpiral } from "@/components/ai-chat/VoiceSpiral";
import { SDRMessage, useLandingSynapse } from "@/hooks/use-landing-synapse";
import { WaitlistModal } from "./WaitlistModal";

// --- Typing Indicator ---
const TypingIndicator = () => (
  <div className="flex items-center gap-1 px-4 py-2">
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
        className="w-1.5 h-1.5 rounded-full bg-primary"
      />
    ))}
  </div>
);

// --- Message Bubble ---
const MessageBubble = ({ message }: { message: SDRMessage }) => {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-zinc-950 dark:bg-white flex items-center justify-center mr-2 mt-1 shrink-0 shadow-lg">
          <Sparkles className="w-3.5 h-3.5 text-white dark:text-zinc-950" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed font-medium shadow-sm",
          isUser
            ? "bg-primary text-white rounded-br-md"
            : "bg-zinc-100 dark:bg-white/[0.06] text-zinc-800 dark:text-zinc-200 border border-zinc-200/50 dark:border-white/[0.08] rounded-bl-md"
        )}
      >
        {message.content}
      </div>
    </motion.div>
  );
};

// --- Exported Component ---
interface LandingSynapseSDRProps {
  sdr: ReturnType<typeof useLandingSynapse>;
}

export const LandingSynapseSDR = ({ sdr }: LandingSynapseSDRProps) => {
  const {
    messages,
    isLoading,
    isOpen,
    shouldOpenWaitlist,
    closeChat,
    sendMessage,
    resetChat,
    consumeWaitlistTrigger,
  } = sdr;

  const [inputValue, setInputValue] = useState("");
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Handle waitlist trigger
  useEffect(() => {
    if (shouldOpenWaitlist) {
      setTimeout(() => {
        setWaitlistOpen(true);
        consumeWaitlistTrigger();
      }, 1000);
    }
  }, [shouldOpenWaitlist, consumeWaitlistTrigger]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputValue.trim()) return;
      sendMessage(inputValue);
      setInputValue("");
    },
    [inputValue, sendMessage]
  );

  return (
    <>
      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "fixed bottom-6 right-6 z-[9999]",
              "w-[400px] h-[600px] max-h-[85vh]",
              "rounded-[28px] overflow-hidden",
              "bg-white dark:bg-[#0A0A0C]",
              "border border-zinc-200 dark:border-white/10",
              "shadow-[0_25px_80px_-15px_rgba(0,0,0,0.25)] dark:shadow-[0_25px_80px_-15px_rgba(0,0,0,0.7)]",
              "flex flex-col"
            )}
          >
            {/* Header */}
            <div className="relative shrink-0">
              {/* Spiral Background */}
              <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none">
                <div className="absolute -top-10 -right-10 w-40 h-40">
                  <VoiceSpiral
                    isListening={true}
                    totalDots={200}
                    dotRadius={1}
                    className="w-full h-full opacity-50"
                  />
                </div>
              </div>

              <div className="relative z-10 px-5 pt-5 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-zinc-950 dark:bg-white flex items-center justify-center shadow-xl">
                    <Sparkles className="w-5 h-5 text-white dark:text-zinc-950" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-black uppercase tracking-[0.15em] text-zinc-900 dark:text-white">
                      Synapse
                    </h3>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                        Online
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={resetChat}
                    className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-white/5 flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-white/60 transition-colors hover:bg-zinc-200 dark:hover:bg-white/10"
                    title="Reiniciar conversa"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={closeChat}
                    className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-white/5 flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-white/60 transition-colors hover:bg-zinc-200 dark:hover:bg-white/10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Separator */}
              <div className="h-px bg-gradient-to-r from-transparent via-zinc-200 dark:via-white/10 to-transparent" />
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 custom-scrollbar">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isLoading && (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-zinc-950 dark:bg-white flex items-center justify-center shrink-0 shadow-lg">
                    <Sparkles className="w-3.5 h-3.5 text-white dark:text-zinc-950" />
                  </div>
                  <div className="rounded-2xl rounded-bl-md bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200/50 dark:border-white/[0.08] px-3 py-2">
                    <TypingIndicator />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.02]">
              <div className="relative flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 h-12 px-4 rounded-2xl bg-white dark:bg-white/[0.05] border border-zinc-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isLoading}
                  className="w-12 h-12 rounded-2xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-transform shadow-lg"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <WaitlistModal open={waitlistOpen} onOpenChange={setWaitlistOpen} />
    </>
  );
};
