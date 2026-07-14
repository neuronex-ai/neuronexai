import { useCallback, useEffect, useRef, useState } from 'react';
import { Handle, Position, NodeResizer } from 'reactflow';
import { Mic, MicOff, Type, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export const TranscriptionNode = ({ id, data, selected }: any) => {
    const [isRecording, setIsRecording] = useState(false);
    const [transcript, setTranscript] = useState<string>(data.transcript || "");
    const recognitionRef = useRef<any>(null);
    const onUpdateNodeDataRef = useRef(data.onUpdateNodeData);

    useEffect(() => {
        onUpdateNodeDataRef.current = data.onUpdateNodeData;
    }, [data.onUpdateNodeData]);

    const updateData = useCallback((patch: Record<string, unknown>) => {
        const onUpdateNodeData = onUpdateNodeDataRef.current;
        if (typeof onUpdateNodeData === 'function') {
            onUpdateNodeData(id, patch);
        }
    }, [id]);

    useEffect(() => {
        if ('webkitSpeechRecognition' in window) {
            const recognition = new (window as any).webkitSpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'pt-BR';

            recognition.onresult = (event: any) => {
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    }
                }
                if (finalTranscript) {
                    setTranscript(prev => {
                        const updated = `${prev} ${finalTranscript}`.trim();
                        updateData({ transcript: updated });
                        return updated;
                    });
                }
            };

            recognition.onerror = (event: any) => {
                console.error('Speech recognition error', event.error);
                setIsRecording(false);
            };

            recognitionRef.current = recognition;
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, [updateData]);

    const toggleRecording = () => {
        if (isRecording) {
            recognitionRef.current?.stop();
            setIsRecording(false);
        } else {
            recognitionRef.current?.start();
            setIsRecording(true);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setTranscript(e.target.value);
        updateData({ transcript: e.target.value });
    };

    return (
        <div className={cn(
            "w-[340px] bg-[#0A0A0B]/95 backdrop-blur-3xl border rounded-[32px] shadow-2xl overflow-hidden group transition-all relative",
            selected ? "border-primary/40 shadow-[0_0_50px_-10px_rgba(255,255,255,0.1)]" : "border-white/10"
        )}>
            <NodeResizer
                minWidth={320}
                minHeight={200}
                isVisible={selected}
                lineClassName="border-primary/30"
                handleClassName="h-3 w-3 bg-white border-2 border-zinc-950 rounded-full"
            />

            {/* Enhanced Handles */}
            <Handle
                type="target"
                position={Position.Left}
                className="!w-4 !h-20 !-left-2 !bg-transparent !border-none !flex !items-center !justify-center group/h-left"
            >
                <div className="w-1 h-10 rounded-full bg-white/10 group-hover/h-left:bg-white transition-all duration-300" />
            </Handle>

            <Handle
                type="source"
                position={Position.Right}
                className="!w-4 !h-20 !-right-2 !bg-transparent !border-none !flex !items-center !justify-center group/h-right"
            >
                <div className="w-1 h-10 rounded-full bg-white/10 group-hover/h-right:bg-white transition-all duration-300" />
            </Handle>

            <Handle
                type="source"
                position={Position.Top}
                className="!w-20 !h-4 !-top-2 !bg-transparent !border-none !flex !items-center !justify-center group/h-top"
            >
                <div className="h-1 w-10 rounded-full bg-white/10 group-hover/h-top:bg-white transition-all duration-300" />
            </Handle>

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-20 !h-4 !-bottom-2 !bg-transparent !border-none !flex !items-center !justify-center group/h-bottom"
            >
                <div className="h-1 w-10 rounded-full bg-white/10 group-hover/h-bottom:bg-white transition-all duration-300" />
            </Handle>

            {/* Header */}
            <div className="bg-white/[0.03] p-5 border-b border-white/5 flex justify-between items-center drag-handle">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "p-2.5 rounded-xl border transition-all duration-500",
                        isRecording ? "bg-red-500/10 border-red-500/20 text-red-500" : "bg-white/5 border-white/10 text-zinc-400"
                    )}>
                        {isRecording ? <Radio size={18} className="animate-pulse" /> : <Type size={18} />}
                    </div>
                    <div>
                        <span className="block text-[11px] font-black uppercase tracking-[0.2em] text-white">Neural Transcribe</span>
                        <span className="block text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Real-time Recognition</span>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleRecording}
                    className={cn(
                        "h-10 w-10 rounded-2xl transition-all duration-500",
                        isRecording
                            ? "bg-red-500 text-white animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                            : "bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white"
                    )}
                >
                    {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                </Button>
            </div>

            {/* Editable Area */}
            <div className="p-0 relative min-h-[200px] flex-1 flex flex-col">
                <textarea
                    className="nodrag nowheel flex-1 w-full p-6 bg-transparent resize-none outline-none text-[13px] leading-relaxed text-zinc-300 font-medium placeholder:text-zinc-800 placeholder:italic custom-scrollbar tracking-tight"
                    placeholder={isRecording ? "Capturando fluxo neural..." : "Clique no microfone para converter voz em texto..."}
                    value={transcript}
                    onChange={handleChange}
                    onPointerDown={(event) => event.stopPropagation()}
                />

                <AnimatePresence>
                    {isRecording && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute bottom-6 right-6 flex items-end gap-1.5 h-6"
                        >
                            {[1, 2, 3, 4, 5].map((i) => (
                                <motion.span
                                    key={i}
                                    animate={{ height: [8, 20, 10, 24, 8][i - 1], opacity: [0.3, 1, 0.5, 1, 0.3][i - 1] }}
                                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
                                    className="w-1 bg-red-500 rounded-full"
                                />
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="px-6 py-4 bg-black/40 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">{transcript.length} Tokens</span>
                </div>
                {isRecording && (
                    <span className="text-[8px] font-black text-red-500 uppercase tracking-[0.2em] animate-pulse">Gravando...</span>
                )}
            </div>
        </div>
    );
};
