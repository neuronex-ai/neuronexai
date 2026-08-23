"use client";

import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import html2canvas from "html2canvas";
import {
    Brain, Download, FileText, Fingerprint, Maximize2, Mic, MicOff, Network,
    RefreshCcw, Zap
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MermaidDiagram } from "./MermaidDiagram";

import { useCreateChatSession, useSendChatMessage } from "@/hooks/use-ai-chat";
import { usePatients } from "@/hooks/use-patients";
import { usePersonalNotes } from "@/hooks/use-personal-notes";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSynapseNotesAgentRun } from "@/hooks/use-synapse-notes-agent-run";
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

const neuroPulseIconButtonClass =
    "h-9 w-9 rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none";

const NeuralBackground = () => {
    return (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_72%_48%_at_48%_-8%,hsl(var(--foreground)/0.055)_0%,hsl(var(--foreground)/0.022)_36%,transparent_76%),radial-gradient(ellipse_44%_36%_at_88%_24%,hsl(var(--foreground)/0.014)_0%,transparent_78%)] dark:opacity-80" />
            <div className="absolute inset-0 bg-[linear-gradient(132deg,transparent_14%,hsl(var(--foreground)/0.012)_48%,transparent_78%)]" />
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
    const shouldReduceMotion = useReducedMotion();
    const { data: patients = [] } = usePatients();
    const { createNote } = usePersonalNotes();
    const { run: synapseRun, events, playedEvents, eventsLoaded } = useSynapseNotesAgentRun(synapseRunId);
    const progressiveReveal = useMemo(() => {
        if (!synapseRunId || shouldReduceMotion) return undefined;
        const complete = eventsLoaded && (
            events.length === 0 || playedEvents.some((event) => event.event_type === "complete")
        );
        return {
            nodeIds: playedEvents
                .filter((event) => event.event_type === "node_reveal")
                .map((event) => String(event.payload.nodeId || ""))
                .filter(Boolean),
            edgeCount: playedEvents.filter((event) => event.event_type === "edge_reveal").length,
            complete,
        };
    }, [events.length, eventsLoaded, playedEvents, shouldReduceMotion, synapseRunId]);

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

    useEffect(() => {
        window.requestAnimationFrame(() => {
            window.dispatchEvent(new CustomEvent("synapse:surface-ready", {
                detail: { target: "neuropulse-panel", runId: synapseRunId || null },
            }));
        });
    }, [synapseRunId]);

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
Use a abordagem ${LENSES.find(l => l.value === selectedLens)?.label} somente como lente de organização visual.
Organize o relato clínico em um diagrama explicável de causa e efeito usando a sintaxe Mermaid.
Separe claramente, nos próprios títulos dos nós:
- DADO INFORMADO: algo que aparece literalmente no relato
- PADRÃO POSSÍVEL: repetição ou relação sustentada pelo relato
- HIPÓTESE A REVISAR: leitura da abordagem que exige confirmação profissional
- PERGUNTA CLÍNICA: ponto que pode ser explorado pelo psicólogo
- ACOMPANHAMENTO: mudança ou ação objetiva que pode ser observada depois

REGRAS RÍGIDAS:
1. Retorne APENAS o código Mermaid. Não use blocos de código markdown (sem \`\`\`mermaid).
2. Use o formato graph TD ou flowchart TD.
3. Estilize os nós para serem visualmente agradáveis (borda arredondada, cores suaves se possível na sintaxe mermaid).
4. O diagrama deve ser complexo o suficiente para mostrar profundidade, mas legível.
5. Não diagnostique, não complete lacunas e não apresente hipótese como fato.
6. Preserve a linguagem do relato e deixe evidente o que precisa de revisão profissional.

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
        <div
          className={cn(
            "notes-lumen-canvas relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-transparent p-3 text-foreground sm:p-4 lg:p-5",
            isFullscreen ? "fixed inset-0 z-[100]" : ""
          )}
          data-synapse-target="neuropulse-panel"
          data-synapse-ready="true"
          data-synapse-run-id={synapseRunId || undefined}
          data-synapse-pulse-entry-id={synapsePulseEntryId || undefined}
        >
            <NeuralBackground />
            <header className="notes-toolbar-surface relative z-20 flex shrink-0 flex-col gap-3 rounded-[24px] border p-3.5 sm:p-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="desktop-retina-inset flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-border/45 bg-muted/30 text-muted-foreground">
                        <Fingerprint className="h-5 w-5" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Síntese clínica visual</p>
                        <h2 className="mt-0.5 text-lg font-black tracking-[-0.045em] text-foreground">NeuroPulse</h2>
                        <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Transforme relatos e transcrições em relações de causa e efeito.</p>
                    </div>
                </div>

                <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-2xl border border-border/40 bg-muted/20 p-1.5">
                    <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                        <SelectTrigger className="h-11 w-[170px] rounded-xl border-0 bg-transparent text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground shadow-none hover:text-foreground focus:ring-0 focus-visible:ring-2 focus-visible:ring-ring">
                            <SelectValue placeholder="Paciente" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-border/50 bg-popover p-2">
                            <SelectItem value="none" className="rounded-xl text-[10px] font-bold uppercase tracking-wider">
                                Sem paciente
                            </SelectItem>
                            {patients.map(patient => (
                                <SelectItem key={patient.id} value={patient.id} className="rounded-xl text-[10px] font-bold uppercase tracking-wider">
                                    {patient.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="h-6 w-px bg-border/50" />

                    <Select value={selectedLens} onValueChange={setSelectedLens}>
                        <SelectTrigger className="h-11 w-[195px] rounded-xl border-0 bg-transparent text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground shadow-none hover:text-foreground focus:ring-0 focus-visible:ring-2 focus-visible:ring-ring">
                            <SelectValue placeholder="Abordagem clínica" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-border/50 bg-popover p-2">
                            {LENSES.map(lens => (
                                <SelectItem key={lens.value} value={lens.value} className="rounded-xl text-[10px] font-bold uppercase tracking-wider">
                                    {lens.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button
                        onClick={handleGenerate}
                        disabled={isGenerating || !input.trim()}
                        className="desktop-retina-interactive h-11 rounded-xl px-5 text-[10px] font-black uppercase tracking-[0.14em]"
                    >
                        {isGenerating ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <><Zap className="mr-2 h-3.5 w-3.5" /><span>Analisar</span></>}
                    </Button>
                </div>
            </header>

            <div className="relative z-20 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/40 bg-card/45 px-4 py-2.5 text-[10px] text-muted-foreground backdrop-blur-xl">
                <span className="inline-flex items-center gap-2 font-semibold text-foreground/75"><Network className="h-3.5 w-3.5" /> NeuroVision detecta → NeuroPulse explica → NeuroFlow acompanha</span>
                <span>Hipóteses aparecem separadas dos fatos e sempre exigem revisão profissional.</span>
            </div>

            {/* Main Content Area */}
            <div className="desktop-content-scroll relative z-10 mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto xl:flex-row xl:overflow-hidden">
                {/* Left: Input Console */}
                {!isFullscreen && (
                    <motion.div
                        initial={shouldReduceMotion ? false : { opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                        className="flex min-h-[250px] w-full shrink-0 flex-col xl:w-[34%] xl:max-w-[460px]"
                    >
                        <div className={cn(
                            "notes-liquid-surface relative flex min-h-0 flex-1 flex-col rounded-[24px] border p-4 transition-[border-color,background-color,box-shadow]",
                            isListening
                                ? "border-foreground/[0.18] bg-muted/30 shadow-[0_20px_60px_-48px_hsl(var(--foreground)/0.55)]"
                                : "border-border/45 bg-card/60"
                        )}>
                            <div className="mb-4 flex items-center justify-between gap-4">
                                <span className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">Relato clínico ou transcrição</span>
                                <span className={cn("rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em]", isListening ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" : "border-border/45 bg-muted/30 text-muted-foreground")}>{isListening ? "Capturando" : "Pronto"}</span>
                            </div>

                            <textarea
                                aria-label="Relato clínico para gerar diagrama NeuroPulse"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Descreva a situação, cole uma transcrição ou use o microfone."
                                className="custom-scrollbar min-h-[140px] flex-1 resize-none rounded-2xl border border-border/35 bg-muted/[0.18] p-4 text-sm font-medium leading-7 text-foreground placeholder:text-muted-foreground/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />

                            <div className="mt-5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {isListening && (
                                        <div className="flex gap-1">
                                            {[...Array(3)].map((_, i) => (
                                                <motion.div
                                                    key={i}
                                                    animate={shouldReduceMotion ? { height: 8 } : { height: [4, 12, 4] }}
                                                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
                                                    className="w-0.5 bg-zinc-900/40 dark:bg-white/40 rounded-full"
                                                />
                                            ))}
                                        </div>
                                    )}
                                    <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                                        {isListening ? "Transcrição em andamento" : "Você também pode ditar o relato"}
                                    </span>
                                </div>

                                <Button
                                    size="icon"
                                    onClick={toggleListening}
                                    className={cn(
                                        "relative h-12 w-12 rounded-[18px] border shadow-sm transition-[background-color,border-color,color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                                        isListening
                                            ? "border-foreground bg-foreground text-background"
                                            : "border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                    aria-label={isListening ? "Parar captura de voz" : "Iniciar captura de voz"}
                                >
                                    {isListening && !shouldReduceMotion && (
                                        <motion.div
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1.5, opacity: 0 }}
                                            transition={{ duration: 1.5, repeat: Infinity }}
                                            className="absolute inset-0 rounded-[18px] bg-foreground/15"
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
                    className="notes-liquid-surface relative min-h-[300px] min-w-0 flex-1 overflow-hidden rounded-[25px] border bg-card/[0.62]"
                >
                    <AnimatePresence mode="wait">
                        {isGenerating ? (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="z-30 flex h-full w-full flex-col items-center justify-center space-y-7 bg-muted/[0.18] p-12"
                            >
                                <div className="relative">
                                    <motion.div
                                        animate={shouldReduceMotion ? { rotate: 0 } : { rotate: 360 }}
                                        transition={shouldReduceMotion ? { duration: 0 } : { duration: 4, repeat: Infinity, ease: "linear" }}
                                        className="h-24 w-24 rounded-full border-2 border-border/45 border-t-foreground/70"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Brain className="h-7 w-7 text-muted-foreground" />
                                    </div>
                                </div>
                                <div className="flex flex-col items-center gap-2">
                                    <h3 className="text-lg font-black tracking-tight text-foreground">Construindo a síntese</h3>
                                    <p className="text-sm text-muted-foreground">Organizando relações, contexto e hipóteses.</p>
                                </div>
                            </motion.div>
                        ) : diagramCode ? (
                            <motion.div
                                key="diagram"
                                initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.02 }}
                                transition={shouldReduceMotion ? { duration: 0 } : undefined}
                                className="h-full flex flex-col"
                            >
                                <div className="absolute top-6 right-6 z-20 flex gap-2">
                                    {savedNoteId && (
                                        <div className="hidden items-center rounded-xl border border-emerald-500/15 bg-emerald-500/10 px-3 text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400 md:flex">
                                            Nota criada
                                        </div>
                                    )}
                                    <div className="notes-toolbar-surface flex rounded-xl border border-border/45 bg-card/90 p-1 shadow-lg">
                                        <Button size="icon" variant="ghost" title="Regenerar" aria-label="Regenerar diagrama" className={neuroPulseIconButtonClass} onClick={handleGenerate} disabled={isGenerating}>
                                            <RefreshCcw className={cn("h-4 w-4", isGenerating && "animate-spin")} />
                                        </Button>
                                        <Button size="icon" variant="ghost" title="Copiar código" aria-label="Copiar código Mermaid" className={neuroPulseIconButtonClass} onClick={handleCopyCode}>
                                            <FileText className="h-4 w-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" title="Download PNG" aria-label="Baixar diagrama em PNG" className={neuroPulseIconButtonClass} onClick={handleExportPNG}>
                                            <Download className="h-4 w-4" />
                                        </Button>
                                        <div className="mx-1 h-6 w-px self-center bg-border/55" />
                                        <Button size="icon" variant="ghost" title="Tela Cheia" aria-label={isFullscreen ? "Sair da tela cheia" : "Entrar em tela cheia"} className={neuroPulseIconButtonClass} onClick={() => setIsFullscreen(!isFullscreen)}>
                                            <Maximize2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div ref={diagramRef} className="custom-scrollbar relative flex min-h-0 flex-1 overflow-hidden bg-transparent p-4 sm:p-6">
                                    <MermaidDiagram
                                        chart={diagramCode}
                                        className="min-h-0 flex-1"
                                        layoutKey={isFullscreen ? "fullscreen" : "panel"}
                                        progressiveReveal={progressiveReveal}
                                    />
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="empty"
                                initial={shouldReduceMotion ? false : { opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
                                className="flex h-full w-full flex-col items-center justify-center p-8 text-center sm:p-12"
                            >
                                <div className="desktop-retina-inset relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-[30px] border border-border/45 bg-muted/30 text-muted-foreground">
                                    <div aria-hidden className="absolute inset-0 bg-[linear-gradient(145deg,hsl(var(--foreground)/0.045),transparent_60%)]" />
                                    <Brain className="relative h-10 w-10" strokeWidth={1.25} />
                                </div>

                                <div className="relative mt-6 max-w-md space-y-3">
                                    <h3 className="text-2xl font-black tracking-[-0.04em] text-foreground">Sua síntese aparecerá aqui</h3>
                                    <p className="text-sm font-medium leading-relaxed text-muted-foreground">
                                        Escolha o paciente e a abordagem, informe o contexto clínico e selecione “Analisar”.
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>
        </div>
    );
};
