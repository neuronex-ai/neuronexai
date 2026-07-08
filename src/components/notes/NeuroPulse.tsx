"use client";

import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { AnimatePresence, motion } from "framer-motion";
import html2canvas from "html2canvas";
import {
    Brain, Download, FileText, Fingerprint, Maximize2, Mic, MicOff,
    RefreshCcw, Zap
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MermaidDiagram } from "./MermaidDiagram";

import { useCreateChatSession, useSendChatMessage } from "@/hooks/use-ai-chat";
import { usePatients } from "@/hooks/use-patients";
import { usePersonalNotes } from "@/hooks/use-personal-notes";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSynapseNotesAgentRun } from "@/hooks/use-synapse-notes-agent-run";
import { SynapseAgentRunOverlay } from "./SynapseAgentRunOverlay";
import { normalizeNeuroPulseMermaid } from "@/lib/neuropulse-mermaid";

const LENSES = [
    { value: "psicanalise", label: "Psicanálise" },
    { value: "tcc", label: "TCC (Cognitivo-Comportamental)" },
    { value: "sistemica", label: "Sistêmica" },
    { value: "humanista", label: "Humanista" },
    { value: "gestalt", label: "Gestalt-Terapia" },
    { value: "junguiana", label: "Junguiana (Analítica)" },
    { value: "neuropsicologia", label: "Neuropsicologia" },
];

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

const NeuralBackground = () => {
    const { theme } = useTheme();
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            <div className={cn(
                "absolute top-1/4 left-1/4 w-[500px] h-[500px] blur-[120px] rounded-full animate-float-slow transition-colors duration-1000",
                theme === 'dark' ? "bg-white/[0.02]" : "bg-black/[0.05]"
            )} />
            <div className={cn(
                "absolute bottom-1/4 right-1/4 w-[600px] h-[600px] blur-[150px] rounded-full animate-float-slower transition-colors duration-1000",
                theme === 'dark' ? "bg-white/[0.01]" : "bg-black/[0.03]"
            )} />
            <div className={cn(
                "absolute inset-0 transition-colors duration-1000",
                theme === 'dark' ? "bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" : "bg-[radial-gradient(circle_at_center,transparent_0%,rgba(255,255,255,0.4)_100%)]"
            )} />
        </div>
    );
};


interface NeuroPulseProps {
    synapseRunId?: string | null;
    synapsePatientId?: string | null;
    synapsePulseEntryId?: string | null;
    synapseNoteId?: string | null;
    synapseMermaid?: string | null;
}

export const NeuroPulse = ({
    synapseRunId,
    synapsePatientId,
    synapsePulseEntryId,
    synapseNoteId,
    synapseMermaid,
}: NeuroPulseProps) => {
    const [input, setInput] = useState("");
    const [selectedLens, setSelectedLens] = useState("tcc");
    const [selectedPatientId, setSelectedPatientId] = useState("none");
    const [diagramCode, setDiagramCode] = useState<string | null>(null);
    const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const diagramRef = useRef<HTMLDivElement>(null);
    const { theme } = useTheme();
    const { data: patients = [] } = usePatients();
    const { createNote } = usePersonalNotes();
    const { run: synapseRun } = useSynapseNotesAgentRun(synapseRunId);

    // Hooks
    const { mutateAsync: createSession } = useCreateChatSession();
    const { mutateAsync: sendMessage } = useSendChatMessage();

    // Voice Recognition state
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = true;
                recognitionRef.current.interimResults = true;
                recognitionRef.current.lang = 'pt-BR';

                recognitionRef.current.onresult = (event: any) => {
                    let finalTranscript = '';
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) {
                            finalTranscript += event.results[i][0].transcript;
                        }
                    }

                    if (finalTranscript) {
                        setInput(prev => {
                            const trimmed = prev.trim();
                            return trimmed ? `${trimmed} ${finalTranscript}` : finalTranscript;
                        });
                    }
                };

                recognitionRef.current.onerror = (event: any) => {
                    console.error("Speech recognition error", event.error);
                    if (event.error !== 'no-speech') {
                        setIsListening(false);
                        toast.error("Erro no reconhecimento de voz.");
                    }
                };

                recognitionRef.current.onend = () => {
                    setIsListening(false);
                };
            }
        }

        return () => {
            if (recognitionRef.current) recognitionRef.current.stop();
        };
    }, []);

    useEffect(() => {
        const mermaid = synapseMermaid || (typeof synapseRun?.result?.mermaid === "string" ? synapseRun.result.mermaid : null);
        if (mermaid) setDiagramCode(mermaid);
        if (synapsePatientId) setSelectedPatientId(synapsePatientId);
        if (synapseNoteId || synapseRun?.note_id) setSavedNoteId(synapseNoteId || synapseRun?.note_id || null);
        const runIntent = typeof synapseRun?.intent === "string" ? synapseRun.intent : "";
        if (runIntent && !input.trim()) setInput(runIntent);
    }, [input, synapseMermaid, synapseNoteId, synapsePatientId, synapseRun]);

    const toggleListening = () => {
        if (!recognitionRef.current) {
            toast.error("Seu navegador não suporta reconhecimento de voz.");
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
        } else {
            try {
                recognitionRef.current.start();
                setIsListening(true);
            } catch (e) {
                console.error(e);
            }
        }
    };

    const handleGenerate = async () => {
        if (!input.trim()) {
            toast.error("Por favor, insira um relato ou inicie a gravação.");
            return;
        }

        setIsGenerating(true);
        setDiagramCode(null);
        setSavedNoteId(null);

        try {
            // 1. Create a temporary session for this analysis
            const session = await createSession("NeuroPulse Analysis - " + new Date().toLocaleString());
            const sessionId = session.id;

            // 2. Construct the prompt
            const prompt = `
Atue como um especialista em ${LENSES.find(l => l.value === selectedLens)?.label}. 
Analise o seguinte relato clínico e gere um diagrama de causa e efeito usando a sintaxe Mermaid. 
O diagrama deve identificar claramente:
- Gatilhos/Eventos
- Pensamentos/Cognições
- Emoções
- Comportamentos/Respostas
- Consequências

REGRAS RÍGIDAS:
1. Retorne APENAS o código Mermaid. Não use blocos de código markdown (sem \`\`\`mermaid).
2. Use o formato graph TD ou flowchart TD.
3. Estilize os nós para serem visualmente agradáveis (borda arredondada, cores suaves se possível na sintaxe mermaid).
4. O diagrama deve ser complexo o suficiente para mostrar profundidade, mas legível.

Relato:
"${input}"
            `;

            // 3. Send message
            const response = await sendMessage({
                message: prompt,
                sessionId: sessionId
            });

            // 4. Extract mermaid code
            let aiText = response.response;
            aiText = normalizeNeuroPulseMermaid({
                raw: aiText,
                input,
                lensLabel: LENSES.find(l => l.value === selectedLens)?.label || selectedLens,
            });

            // Extract the actual mermaid block, ignoring conversational text
            const mermaidMatch = aiText.match(/(?:```mermaid\s*)?((?:graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline)[\s\S]*?)(?:```|$)/i);
            
            if (mermaidMatch && mermaidMatch[1]) {
                aiText = mermaidMatch[1].trim();
            } else {
                // Cleanup typical markdown artifacts as fallback
                aiText = aiText.replace(/```mermaid/gi, '').replace(/```/g, '').trim();
                // Strip preceding conversational text
                const keywordMatch = aiText.match(/(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline)[\s\S]*/i);
                if (keywordMatch) {
                    aiText = keywordMatch[0];
                }
            }

            setDiagramCode(aiText);
            const patientId = selectedPatientId === "none" ? null : selectedPatientId;
            const lensLabel = LENSES.find(l => l.value === selectedLens)?.label || selectedLens;
            const title = `NeuroPulse - ${new Date().toLocaleDateString("pt-BR")}`;
            const createdNote = await createNote({
                title,
                content: [
                    `<p><strong>NeuroPulse</strong> - ${escapeHtml(lensLabel)}</p>`,
                    `<pre class="mermaid">${escapeHtml(aiText)}</pre>`,
                ].join(""),
                tags: ["NeuroPulse", "Mermaid"],
                patient_id: patientId,
                module_id: "neuropulse",
                reference_date: new Date().toISOString(),
            } as any);

            setSavedNoteId(createdNote.id);

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase.from("neuro_pulse_entries").insert({
                    user_id: user.id,
                    title,
                    data: {
                        note_id: createdNote.id,
                        patient_id: patientId,
                        lens: selectedLens,
                        lens_label: lensLabel,
                        input,
                        mermaid: aiText,
                    },
                });
            }

            toast.success("Diagrama NeuroPulse salvo como nota Mermaid.");

        } catch (error: any) {
            console.error("Erro ao gerar diagrama:", error);
            toast.error("Falha ao gerar o diagrama. Tente novamente.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopyCode = () => {
        if (diagramCode) {
            navigator.clipboard.writeText(diagramCode);
            toast.success("Código Mermaid copiado para a área de transferência!");
        }
    };

    const handleExportPNG = async () => {
        if (!diagramRef.current) return;

        try {
            const canvas = await html2canvas(diagramRef.current, {
                backgroundColor: theme === 'dark' ? '#050505' : '#ffffff',
                scale: 2,
                logging: false,
                useCORS: true
            });

            const link = document.createElement('a');
            link.download = `neuropulse-synthesis-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            toast.success("Diagrama exportado com sucesso!");
        } catch (error) {
            console.error("Export error:", error);
            toast.error("Erro ao exportar o diagrama.");
        }
    };

    return (
        <div className={cn(
            "h-full w-full flex flex-col relative overflow-hidden transition-all duration-700 ease-out-expo bg-transparent",
            isFullscreen ? "fixed inset-0 z-[100]" : ""
        )}>
            <NeuralBackground />
            <SynapseAgentRunOverlay run={synapseRun} title="Synapse / NeuroPulse" compact />
            {/* HUD Overlay / Floating Controls */}
            <div className="absolute top-8 left-8 right-8 z-50 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-6 pointer-events-auto">
                    <div className="relative group">
                        <div className="absolute inset-0 rounded-full bg-white/10 blur-[30px] opacity-0 transition-opacity duration-700 group-hover:opacity-100 [.light_&]:bg-zinc-900/5" />
                        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-black/40 shadow-2xl backdrop-blur-3xl transition-all duration-500 group-hover:border-white/20 [.light_&]:border-zinc-200 [.light_&]:bg-white/40 [.light_&]:group-hover:border-zinc-300">
                            <Fingerprint className="h-7 w-7 text-white/90 [.light_&]:text-zinc-900" strokeWidth={1.2} />
                            <motion.div
                                animate={{ opacity: [0.4, 1, 0.4] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] [.light_&]:bg-zinc-900 [.light_&]:shadow-[0_0_10px_rgba(0,0,0,0.2)]"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <h2 className="text-3xl font-black uppercase leading-none tracking-tighter text-white [.light_&]:text-zinc-900">NeuroPulse</h2>
                        <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">Sincronização Profunda</span>
                        </div>
                    </div>
                </div>

                <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/5 bg-black/40 p-1.5 shadow-2xl backdrop-blur-3xl [.light_&]:border-zinc-200 [.light_&]:bg-white/40 [.light_&]:shadow-xl">
                    <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                        <SelectTrigger className="w-[190px] h-10 bg-transparent border-none text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors focus:ring-0">
                            <SelectValue placeholder="Paciente" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-[#0a0a0b] border-zinc-100 dark:border-white/5 text-zinc-400">
                            <SelectItem value="none" className="text-[10px] uppercase tracking-widest focus:bg-white/5 focus:text-white">
                                Sem paciente
                            </SelectItem>
                            {patients.map(patient => (
                                <SelectItem key={patient.id} value={patient.id} className="text-[10px] uppercase tracking-widest focus:bg-white/5 focus:text-white">
                                    {patient.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="mx-1 h-6 w-px bg-white/5 [.light_&]:bg-zinc-200" />

                    <Select value={selectedLens} onValueChange={setSelectedLens}>
                        <SelectTrigger className="w-[200px] h-10 bg-transparent border-none text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors focus:ring-0">
                            <SelectValue placeholder="Ótica Analítica" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-[#0a0a0b] border-zinc-100 dark:border-white/5 text-zinc-400">
                            {LENSES.map(lens => (
                                <SelectItem key={lens.value} value={lens.value} className="text-[10px] uppercase tracking-widest focus:bg-white/5 focus:text-white pointer">
                                    {lens.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="mx-1 h-6 w-px bg-white/5 [.light_&]:bg-zinc-200" />

                    <Button
                        onClick={handleGenerate}
                        disabled={isGenerating || !input.trim()}
                        className={cn(
                            "h-10 px-6 rounded-xl border transition-all duration-500",
                            isGenerating
                                ? "cursor-not-allowed border-transparent bg-white/5 text-zinc-600 [.light_&]:bg-zinc-100 [.light_&]:text-zinc-400"
                                : "border-transparent bg-white text-black shadow-[0_20px_40px_-10px_rgba(255,255,255,0.2)] hover:scale-[1.02] hover:bg-zinc-200 active:scale-95 [.light_&]:bg-zinc-900 [.light_&]:text-white [.light_&]:shadow-lg [.light_&]:hover:bg-zinc-800",
                            "text-[10px] font-black uppercase tracking-[0.3em]"
                        )}
                    >
                        {isGenerating ? (
                            <RefreshCcw className="h-4 w-4 animate-spin text-zinc-600" />
                        ) : (
                            <div className="flex items-center gap-2">
                                <Zap className="h-3.5 w-3.5 fill-current" />
                                <span>Analisar</span>
                            </div>
                        )}
                    </Button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden pt-32 p-8 gap-8">
                {/* Left: Input Console */}
                {!isFullscreen && (
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="w-[38%] flex flex-col space-y-6"
                    >
                        <div className={cn(
                            "flex-1 bg-black/20 border transition-all duration-700 rounded-[32px] p-8 relative group backdrop-blur-xl ring-1 flex flex-col [.light_&]:bg-white/40",
                            isListening
                                ? "border-zinc-900/20 dark:border-white/20 ring-zinc-900/10 dark:ring-white/10 shadow-[0_0_50px_rgba(0,0,0,0.05)] dark:shadow-[0_0_50px_rgba(255,255,255,0.05)]"
                                : "border-zinc-200/50 dark:border-white/[0.03] ring-zinc-100/20 dark:ring-white/[0.02]"
                        )}>
                            <div className="flex items-center justify-between mb-6">
                                <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.4em]">Relato Clínico / Transcrição</span>
                                <div className="flex gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-200 dark:bg-white/10" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-200 dark:bg-white/10" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-200 dark:bg-white/10" />
                                </div>
                            </div>

                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Inicie a fala ou descreva o padrão aqui para processamento neural..."
                                className="flex-1 bg-transparent border-none resize-none focus:ring-0 text-md text-zinc-900 dark:text-zinc-200 leading-relaxed placeholder:text-zinc-300 dark:placeholder:text-zinc-800 font-medium custom-scrollbar selection:bg-zinc-900/10 dark:selection:bg-white/10"
                            />

                            <div className="mt-6 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {isListening && (
                                        <div className="flex gap-1">
                                            {[...Array(3)].map((_, i) => (
                                                <motion.div
                                                    key={i}
                                                    animate={{ height: [4, 12, 4] }}
                                                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
                                                    className="w-0.5 bg-zinc-900/40 dark:bg-white/40 rounded-full"
                                                />
                                            ))}
                                        </div>
                                    )}
                                    <span className={cn(
                                        "text-[9px] font-black uppercase tracking-widest transition-colors duration-500",
                                        isListening
                                            ? "text-zinc-900 dark:text-white"
                                            : "text-zinc-300 dark:text-zinc-700"
                                    )}>
                                        {isListening ? "Capturando Fluxo" : "Sistema Pronto"}
                                    </span>
                                </div>

                                <Button
                                    size="icon"
                                    onClick={toggleListening}
                                    className={cn(
                                        "h-16 w-16 rounded-[24px] shadow-2xl transition-all duration-700 border relative group",
                                        isListening
                                            ? "bg-zinc-900 dark:bg-white text-white dark:text-black border-zinc-900 dark:border-white"
                                            : "bg-white dark:bg-black/60 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/20 hover:text-zinc-900 dark:hover:text-white shadow-xl"
                                    )}
                                >
                                    {isListening && (
                                        <motion.div
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1.5, opacity: 0 }}
                                            transition={{ duration: 1.5, repeat: Infinity }}
                                            className="absolute inset-0 rounded-[24px] bg-zinc-900/20 dark:bg-white/20"
                                        />
                                    )}
                                    {isListening ? <MicOff className="h-6 w-6 relative z-10" /> : <Mic className="h-6 w-6 relative z-10" />}
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Right: Synthesis Visualization */}
                <motion.div
                    layout
                    className="flex-1 bg-white/60 dark:bg-black/40 border border-zinc-200 dark:border-white/[0.03] rounded-[40px] relative overflow-hidden backdrop-blur-3xl ring-1 ring-zinc-100 dark:ring-white/[0.02] shadow-2xl"
                >
                    <AnimatePresence mode="wait">
                        {isGenerating ? (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="h-full w-full flex flex-col items-center justify-center p-12 space-y-8 bg-white/40 dark:bg-black/40 backdrop-blur-3xl z-30"
                            >
                                <div className="relative">
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                        className="w-32 h-32 rounded-full border-2 border-zinc-200 dark:border-white/5 border-t-zinc-900 dark:border-t-white/40"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Brain className="h-8 w-8 text-zinc-300 dark:text-white/40 animate-pulse" />
                                    </div>
                                </div>
                                <div className="flex flex-col items-center gap-2">
                                    <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-[0.3em]">Sintetizando</h3>
                                    <div className="flex gap-2">
                                        {[...Array(3)].map((_, i) => (
                                            <motion.div
                                                key={i}
                                                animate={{ opacity: [0, 1, 0] }}
                                                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                                                className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-white/40"
                                            />
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        ) : diagramCode ? (
                            <motion.div
                                key="diagram"
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.02 }}
                                className="h-full flex flex-col"
                            >
                                <div className="absolute top-6 right-6 z-20 flex gap-2">
                                    {savedNoteId && (
                                        <div className="hidden items-center rounded-xl border border-emerald-500/15 bg-emerald-500/10 px-3 text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400 md:flex">
                                            Nota criada
                                        </div>
                                    )}
                                    {(synapseRunId || synapsePulseEntryId) && (
                                        <div className="hidden items-center rounded-xl border border-white/10 bg-white/10 px-3 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-300 [.light_&]:border-zinc-200 [.light_&]:bg-white/70 [.light_&]:text-zinc-700 md:flex">
                                            Synapse
                                        </div>
                                    )}
                                    <div className="flex p-1 bg-white/80 dark:bg-black/60 backdrop-blur-2xl border border-zinc-200 dark:border-white/5 rounded-xl shadow-2xl">
                                        <Button size="icon" variant="ghost" title="Regenerar" className="h-9 w-9 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white" onClick={handleGenerate} disabled={isGenerating}>
                                            <RefreshCcw className={cn("h-4 w-4", isGenerating && "animate-spin")} />
                                        </Button>
                                        <Button size="icon" variant="ghost" title="Copiar Código" className="h-9 w-9 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white" onClick={handleCopyCode}>
                                            <FileText className="h-4 w-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" title="Download PNG" className="h-9 w-9 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white" onClick={handleExportPNG}>
                                            <Download className="h-4 w-4" />
                                        </Button>
                                        <div className="w-px h-6 bg-zinc-200 dark:bg-white/10 mx-1 self-center" />
                                        <Button size="icon" variant="ghost" title="Tela Cheia" className="h-9 w-9 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white" onClick={() => setIsFullscreen(!isFullscreen)}>
                                            <Maximize2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div ref={diagramRef} className="flex-1 overflow-auto p-12 bg-transparent custom-scrollbar flex items-center justify-center min-h-0 relative">
                                    <div className="scale-110 transition-transform duration-1000 origin-center bg-transparent w-full h-full">
                                        <MermaidDiagram chart={diagramCode} />
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="empty"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="h-full w-full flex flex-col items-center justify-center p-12 space-y-8"
                            >
                                {/* Scan Visualizer */}
                                <div className="relative w-72 h-72 border border-white/[0.05] rounded-full flex items-center justify-center group/empty">
                                    {/* Outer Rotating Ring */}
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                                        className="absolute inset-0 border border-dashed border-white/[0.05] rounded-full"
                                    />

                                    {/* Scanner Line */}
                                    <motion.div
                                        animate={{
                                            top: ["0%", "100%", "0%"],
                                            opacity: [0.3, 1, 0.3]
                                        }}
                                        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                                        className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-zinc-900/40 dark:via-white/40 to-transparent z-10 shadow-[0_0_20px_rgba(0,0,0,0.1)] dark:shadow-[0_0_20px_rgba(255,255,255,0.4)]"
                                    />

                                    {/* Central Icon */}
                                    <div className="w-48 h-48 rounded-full bg-zinc-50 dark:bg-white/[0.02] border border-zinc-100 dark:border-white/[0.05] backdrop-blur-3xl flex items-center justify-center relative overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-br from-zinc-200/20 dark:from-white/[0.05] to-transparent" />
                                        <Brain className="h-16 w-16 text-zinc-200 dark:text-white/10 group-hover/empty:text-zinc-400 dark:group-hover/empty:text-white/20 transition-colors duration-1000" strokeWidth={0.8} />
                                    </div>

                                    {/* Technical HUD elements */}
                                    <div className="absolute -top-12 -left-12 flex flex-col space-y-1 opacity-40">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1 h-1 rounded-full bg-zinc-900 dark:bg-white" />
                                            <span className="text-[6px] font-black text-zinc-400 dark:text-white/60 tracking-[0.2em]">BUFFER: READY</span>
                                        </div>
                                        <div className="h-px w-8 bg-zinc-200 dark:bg-white/20" />
                                    </div>
                                    <div className="absolute -bottom-12 -right-12 flex flex-col items-end space-y-1 opacity-40">
                                        <div className="h-px w-8 bg-zinc-200 dark:bg-white/20" />
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1 h-1 rounded-full bg-zinc-900 dark:bg-white animate-pulse" />
                                        </div>
                                    </div>
                                </div>

                                <div className="text-center space-y-3 relative">
                                    <h3 className="text-4xl font-black tracking-tighter text-zinc-900 dark:text-white uppercase italic">Síntese Ativa</h3>
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="h-[1px] w-4 bg-zinc-200 dark:bg-zinc-800" />
                                        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-500 max-w-[240px] leading-relaxed text-center">
                                            Mapeamento Neural
                                        </p>
                                        <div className="h-[1px] w-4 bg-zinc-200 dark:bg-zinc-800" />
                                    </div>
                                </div>

                                <div className="flex gap-4 items-center">
                                    <div className="flex gap-1">
                                        {[...Array(3)].map((_, i) => (
                                            <motion.div
                                                key={i}
                                                animate={{ opacity: [0.2, 1, 0.2] }}
                                                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                                                className="h-1 w-4 bg-zinc-200 dark:bg-white/10 rounded-full"
                                            />
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>
        </div>
    );
};
