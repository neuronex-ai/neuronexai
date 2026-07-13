"use client";

import React, { useState, useEffect, useRef } from "react";
import { SynapseLiquidOrb } from "../components/synapse/SynapseLiquidOrb";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Activity, Play, RefreshCw, Sun, Moon, Check, Zap } from "lucide-react";

interface Node {
    id: string;
    label: string;
    type: "trigger" | "analysis" | "action" | "diagnosis";
    status: "pending" | "lighting" | "active";
    details: string;
}

const INITIAL_NODES: Node[] = [
    { id: "1", label: "Gatilho: Saturação Emocional", type: "trigger", status: "pending", details: "Identificação de picos de estresse agudo na fala do paciente" },
    { id: "2", label: "Análise Cognitiva", type: "analysis", status: "pending", details: "Varredura léxica e detecção de padrões de evitação" },
    { id: "3", label: "NeuroPulse Sync", type: "action", status: "pending", details: "Disparo automático de técnica de re-ancoragem respiratória" },
    { id: "4", label: "Feedback Biométrico", type: "diagnosis", status: "pending", details: "Estabilização da frequência cardíaca e modulação tonal" },
];

export default function Index() {
    const [state, setState] = useState<string>("idle");
    const [statusText, setStatusText] = useState<string>("Synapse está ouvindo... Fale quando estiver pronto.");
    const [theme, setTheme] = useState<"dark" | "light">("dark");
    const [nodes, setNodes] = useState<Node[]>(INITIAL_NODES);
    const [activeNodeIndex, setActiveNodeIndex] = useState<number>(-1);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    
    // Simulate real-time volume input for Siri-like response
    const [volume, setVolume] = useState<number>(0.15);
    const volumeRef = useRef<number>(0.15);
    
    useEffect(() => {
        const interval = setInterval(() => {
            let base = 0.05;
            if (state === "speaking") {
                base = 0.4 + Math.sin(Date.now() * 0.01) * 0.35;
            } else if (state === "listening") {
                base = 0.12 + Math.cos(Date.now() * 0.005) * 0.1;
            } else if (state === "thinking" || state === "executing") {
                base = 0.25 + Math.sin(Date.now() * 0.02) * 0.15;
            } else {
                base = 0.04 + Math.sin(Date.now() * 0.001) * 0.02; // very subtle breathing when idle
            }
            const finalVol = Math.max(0, Math.min(1, base));
            setVolume(finalVol);
            volumeRef.current = finalVol;
        }, 80);
        return () => clearInterval(interval);
    }, [state]);

    const getInputVolume = () => volumeRef.current;

    const toggleTheme = () => {
        const next = theme === "dark" ? "light" : "dark";
        setTheme(next);
        if (next === "dark") {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
    };

    // Immersive sequential creation & lighting animation simulation
    const runImmersiveNeuroFlowSimulation = async () => {
        if (isGenerating) return;
        setIsGenerating(true);
        setNodes(INITIAL_NODES.map(n => ({ ...n, status: "pending" })));
        setActiveNodeIndex(-1);

        // Step 1: Synapse is thinking & calling clean function (no robotic text repetitions)
        setState("thinking");
        setStatusText("Analisando padrões ocultos da narrativa verbal...");
        await new Promise(r => setTimeout(r, 2200));

        // Step 2: Executing function
        setState("executing");
        setStatusText("Estruturando o NeuroFlow de forma dinâmica...");
        await new Promise(r => setTimeout(r, 1800));

        // Step 3: Progressive building node-by-node
        for (let i = 0; i < INITIAL_NODES.length; i++) {
            setActiveNodeIndex(i);
            
            // Synapse lights up the node elegantly (lighting up state)
            setNodes(prev => prev.map((node, idx) => {
                if (idx === i) return { ...node, status: "lighting" };
                return node;
            }));
            setState("speaking");
            setStatusText(`Integrando e ativando: ${INITIAL_NODES[i].label}...`);
            
            // Settle / active transition
            await new Promise(r => setTimeout(r, 1600));
            setNodes(prev => prev.map((node, idx) => {
                if (idx === i) return { ...node, status: "active" };
                return node;
            }));
        }

        // Complete response
        setState("completed");
        setStatusText("NeuroFlow integrado perfeitamente ao seu ecossistema.");
        await new Promise(r => setTimeout(r, 3000));
        setState("idle");
        setStatusText("Synapse conectado e pronto.");
        setIsGenerating(false);
    };

    const triggerManualInteraction = (interaction: string) => {
        if (interaction === "escutar") {
            setState("listening");
            setStatusText("Ouvindo com sensibilidade biométrica avançada...");
        } else if (interaction === "pensar") {
            setState("thinking");
            setStatusText("Processando conexões neurais em segundo plano...");
        } else if (interaction === "falar") {
            setState("speaking");
            setStatusText("Sintonizando resposta terapêutica personalizada...");
        } else if (interaction === "erro") {
            setState("error");
            setStatusText("Refinando calibração do sinal de voz...");
        }
    };

    return (
        <div className={`min-h-screen w-full transition-colors duration-1000 ${theme === "dark" ? "bg-zinc-950 text-white" : "bg-slate-50 text-zinc-900"} overflow-hidden relative font-sans`}>
            {/* Background Atmosphere Lights */}
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-[140px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] rounded-full bg-violet-500/10 blur-[160px] pointer-events-none" />

            {/* Top Premium Minimalist Bar */}
            <header className="absolute top-0 left-0 w-full z-40 p-6 flex justify-between items-center max-w-7xl mx-auto right-0">
                <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-sm font-semibold tracking-wider uppercase opacity-80">Synapse Live AI</span>
                </div>
                
                <div className="flex items-center gap-4">
                    <button 
                        onClick={toggleTheme}
                        className={`p-2.5 rounded-full border transition-all duration-300 hover:scale-105 ${
                            theme === "dark" 
                            ? "bg-white/5 border-white/10 hover:bg-white/10 text-amber-200" 
                            : "bg-black/5 border-black/10 hover:bg-black/10 text-slate-800"
                        }`}
                        title="Alternar Tema"
                    >
                        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                </div>
            </header>

            {/* Main Interactive Stage */}
            <main className="container mx-auto max-w-6xl px-6 pt-24 pb-96 min-h-screen flex flex-col justify-between relative z-10">
                
                {/* Intro & Simulation Workspace */}
                <div className="w-full max-w-3xl mx-auto space-y-8 flex-1 flex flex-col justify-center">
                    <div className="text-center space-y-3">
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 via-zinc-300 to-zinc-500 dark:from-white dark:via-zinc-200 dark:to-zinc-500">
                            NeuroFlow Progressivo
                        </h1>
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm md:text-base max-w-lg mx-auto">
                            Observe a inteligência viva desenhar e iluminar conexões neurais em tempo real, sem interrupções robóticas.
                        </p>
                    </div>

                    {/* Quick Control Console for Testing */}
                    <div className="flex flex-wrap items-center justify-center gap-3 bg-white/5 dark:bg-zinc-900/40 p-3 rounded-2xl border border-zinc-200/10 backdrop-blur-md max-w-xl mx-auto">
                        <button
                            onClick={runImmersiveNeuroFlowSimulation}
                            disabled={isGenerating}
                            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-zinc-800 to-zinc-700 dark:from-white dark:to-zinc-200 text-zinc-950 hover:opacity-95 transition-all rounded-xl font-bold text-sm disabled:opacity-50 hover:scale-[1.02] shadow-lg shadow-black/10"
                        >
                            <Play size={15} fill="currentColor" />
                            Iniciar NeuroFlow
                        </button>
                        
                        <div className="h-6 w-[1px] bg-zinc-700/40" />

                        <button 
                            onClick={() => triggerManualInteraction("escutar")}
                            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 transition"
                        >
                            Escutar
                        </button>
                        <button 
                            onClick={() => triggerManualInteraction("pensar")}
                            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 transition"
                        >
                            Pensar
                        </button>
                        <button 
                            onClick={() => triggerManualInteraction("falar")}
                            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 transition"
                        >
                            Falar
                        </button>
                        <button 
                            onClick={() => triggerManualInteraction("erro")}
                            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 transition"
                        >
                            Calibração
                        </button>
                    </div>

                    {/* Interactive Animated Flow Diagram */}
                    <div className="relative min-h-[340px] flex flex-col justify-center items-center">
                        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                            <AnimatePresence>
                                {nodes.map((node, index) => {
                                    const isCurrent = activeNodeIndex === index;
                                    return (
                                        <motion.div
                                            key={node.id}
                                            initial={{ opacity: 0, y: 30, scale: 0.92 }}
                                            animate={{ 
                                                opacity: node.status !== "pending" ? 1 : 0.4, 
                                                y: 0, 
                                                scale: 1,
                                                borderColor: node.status === "lighting" 
                                                    ? "rgba(255, 255, 255, 0.7)" 
                                                    : node.status === "active" 
                                                    ? "rgba(255, 255, 255, 0.2)" 
                                                    : "rgba(255, 255, 255, 0.04)"
                                            }}
                                            transition={{ type: "spring", stiffness: 100, damping: 15 }}
                                            className={`relative p-5 rounded-2xl border backdrop-blur-xl transition-all duration-500 overflow-hidden ${
                                                node.status === "lighting"
                                                ? "bg-white/10 dark:bg-white/10 shadow-[0_0_30px_rgba(255,255,255,0.15)] scale-[1.03]"
                                                : node.status === "active"
                                                ? "bg-white/5 dark:bg-zinc-900/30"
                                                : "bg-transparent opacity-25"
                                            }`}
                                        >
                                            {/* Glow Light Wave background effect (Neural pulse feeling) */}
                                            {node.status === "lighting" && (
                                                <motion.div 
                                                    className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-transparent pointer-events-none"
                                                    animate={{ x: ["-100%", "100%"] }}
                                                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                                />
                                            )}

                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className={`text-[10px] uppercase tracking-widest font-extrabold ${
                                                        node.status === "lighting" ? "text-emerald-400" : "text-zinc-500"
                                                    }`}>
                                                        {node.type}
                                                    </span>
                                                    <h3 className="text-lg font-bold mt-1 tracking-tight text-zinc-100 dark:text-white">
                                                        {node.label}
                                                    </h3>
                                                </div>
                                                
                                                <div className="flex items-center gap-2">
                                                    {node.status === "lighting" && (
                                                        <span className="flex h-2.5 w-2.5 relative">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                                                        </span>
                                                    )}
                                                    {node.status === "active" && (
                                                        <div className="p-1 rounded-full bg-zinc-800 border border-zinc-700">
                                                            <Check size={12} className="text-zinc-100" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                                                {node.details}
                                            </p>

                                            {/* Connective Micro Synaptic Path */}
                                            {index < nodes.length - 1 && (
                                                <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 h-4 w-[2px] bg-gradient-to-b from-white/20 to-transparent hidden md:block" />
                                            )}
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* Bottom Voice Orb Section: Compact Status Bubble + Glowing Plasma Orb ONLY */}
                <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-6 z-30 pointer-events-auto">
                    
                    {/* Compact Glass Liquid Status Banner above the orb */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={statusText}
                            initial={{ opacity: 0, y: 15, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -15, scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 120, damping: 14 }}
                            className="bg-white/10 dark:bg-zinc-900/40 border border-white/10 dark:border-zinc-800/60 backdrop-blur-2xl px-5 py-2.5 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.3)] max-w-sm text-center"
                        >
                            <p className="text-xs font-medium tracking-wide text-zinc-200 dark:text-zinc-100 whitespace-nowrap overflow-hidden text-ellipsis">
                                {statusText}
                            </p>
                        </motion.div>
                    </AnimatePresence>

                    {/* The Synapse Interactive Voice Orb */}
                    <div className="relative group">
                        <SynapseLiquidOrb 
                            state={state} 
                            getInputVolume={getInputVolume} 
                        />
                    </div>
                </div>

            </main>
        </div>
    );
}