"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
    Activity, Bell, Calendar, LayoutDashboard, Search, TrendingUp, Users, Wallet, 
    Video, MessageSquare, FileText, Zap, MoreHorizontal, Mic,
    ArrowRight, Sparkles, Landmark, Send, QrCode,
    Play, ZoomIn, ZoomOut, Target, Maximize, Settings2, MoreVertical, Paperclip, Type, List, RotateCcw,
    UserPlus
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { VoiceSpiral } from "@/components/ai-chat/VoiceSpiral";
import { Logo } from "@/components/ui/Logo";

// --- WIDGET COMPONENTS ---

const FloatingWidget = ({ children, className, x, y, delay, depth = 1, mouseX, mouseY }: any) => {
    const moveX = useTransform(mouseX, [0, 1000], [depth * 10, depth * -10]);
    const moveY = useTransform(mouseY, [0, 650], [depth * 10, depth * -10]);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay, duration: 0.8, type: "spring", stiffness: 50, damping: 20 }}
            style={{ top: y, left: x, x: moveX, y: moveY }}
            className={cn(
                "absolute z-30 bg-white/95 dark:bg-[#121214]/95 border border-zinc-200 dark:border-white/10 rounded-2xl shadow-[0_20px_50px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8)] backdrop-blur-xl p-4 flex flex-col gap-3",
                "hover:border-zinc-300 dark:hover:border-white/20 transition-colors duration-300 group/widget font-sans",
                className
            )}
        >
            {children}
        </motion.div>
    );
};

// --- SCREEN MOCKS ---

const DashboardScreen = () => (
    <div className="space-y-6 h-full overflow-y-auto pr-2 custom-scrollbar font-sans">
        <div className="flex justify-between items-start mb-8 relative z-10">
            <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1 tracking-tight">Bom dia, Dr. Silva</h1>
                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-zinc-500 dark:text-white/40 text-[10px] font-bold uppercase tracking-widest">Sua clínica está operando normalmente • 8 sessões hoje</p>
                </div>
            </div>
            <div className="flex gap-2">
                <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-white/5 flex items-center justify-center border border-zinc-200 dark:border-white/10">
                    <Bell className="w-4 h-4 text-zinc-500" />
                </div>
            </div>
        </div>

        <div className="grid grid-cols-12 gap-4 mb-6">
            <div className="col-span-8 p-6 rounded-[24px] bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.05] shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full -mr-16 -mt-16" />
                <div className="relative z-10">
                    <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-4">Briefing Matinal</h3>
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-white/5 flex items-center justify-center">
                                <Users className="w-4 h-4 text-zinc-600 dark:text-white/60" />
                            </div>
                            <span className="text-xs text-zinc-600 dark:text-white/70">3 novos pacientes aguardando triagem</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-white/5 flex items-center justify-center">
                                <TrendingUp className="w-4 h-4 text-emerald-500" />
                            </div>
                            <span className="text-xs text-zinc-600 dark:text-white/70">Faturamento 12% acima da média semanal</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="col-span-4 p-6 rounded-[24px] bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent dark:from-black/5" />
                <div className="relative z-10 h-full flex flex-col justify-between">
                    <div>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">Próximo Paciente</h3>
                        <p className="text-lg font-bold leading-tight">Mariana Silva</p>
                        <p className="text-[10px] opacity-60 font-medium">14:00 • Teleconsulta</p>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                        <div className="px-3 py-1 rounded-full bg-white/20 dark:bg-black/10 text-[9px] font-bold uppercase tracking-wider">Entrar na Sala</div>
                        <ArrowRight className="w-3 h-3" />
                    </div>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-2xl bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.05] shadow-sm">
                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Pacientes Ativos</span>
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-zinc-900 dark:text-white">42</span>
                    <span className="text-[10px] text-emerald-500 font-bold">+3</span>
                </div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.05] shadow-sm">
                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Sessões Hoje</span>
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-zinc-900 dark:text-white">8</span>
                    <span className="text-[10px] text-zinc-400 font-bold">de 10</span>
                </div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.05] shadow-sm">
                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Taxa de Adesão</span>
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-zinc-900 dark:text-white">94%</span>
                    <Activity className="w-3 h-3 text-emerald-500" />
                </div>
            </div>
        </div>
    </div>
);

const AgendaScreen = () => (
    <div className="h-full flex gap-6 overflow-hidden font-sans">
        <div className="w-[200px] shrink-0 space-y-6">
            <div className="p-4 rounded-2xl bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.05] shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Novembro 2024</span>
                </div>
                <div className="grid grid-cols-7 gap-1 text-[8px] font-bold text-zinc-400 mb-2">
                    {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map(d => <div key={d} className="text-center">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: 30 }).map((_, i) => (
                        <div key={i} className={cn(
                            "aspect-square flex items-center justify-center rounded-md text-[9px] font-medium transition-colors",
                            i === 14 ? "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold" : "text-zinc-500 dark:text-white/40 hover:bg-zinc-100 dark:hover:bg-white/5"
                        )}>
                            {i + 1}
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <div className="flex-1 bg-white dark:bg-white/[0.01] border border-zinc-200 dark:border-white/[0.05] rounded-[32px] flex flex-col overflow-hidden shadow-xl">
            <div className="p-6 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">11 — 17 Nov</h2>
                </div>
            </div>
            <div className="flex-1 grid grid-cols-5 p-4 gap-4 overflow-y-auto custom-scrollbar">
                {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'].map((day, dIdx) => (
                    <div key={day} className="space-y-4">
                        <div className="text-center pb-2 border-b border-zinc-100 dark:border-white/5">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{day}</p>
                            <p className="text-sm font-bold text-zinc-900 dark:text-white">{11 + dIdx}</p>
                        </div>
                        <div className="space-y-3">
                            {[1, 2, 3].map((_, aIdx) => (
                                <div key={aIdx} className={cn(
                                    "p-3 rounded-2xl border transition-all",
                                    dIdx === 2 && aIdx === 1 
                                        ? "bg-zinc-900 dark:bg-white border-transparent text-white dark:text-zinc-950 shadow-lg" 
                                        : "bg-white dark:bg-white/[0.03] border-zinc-100 dark:border-white/5"
                                )}>
                                    <p className="text-[10px] font-bold truncate">Paciente #{100 + dIdx * 3 + aIdx}</p>
                                    <p className="text-[8px] opacity-40 uppercase tracking-widest font-black mt-1">{9 + aIdx * 2}:00</p>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

const TeleconsultaScreen = () => (
    <div className="h-full flex flex-col space-y-6 font-sans">
        <div className="grid grid-cols-4 gap-4">
            <div className="col-span-3 aspect-video rounded-[32px] bg-zinc-900 relative overflow-hidden group">
                <img src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=1200" className="w-full h-full object-cover opacity-60" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-6 left-6 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full border-2 border-white/20 overflow-hidden">
                        <img src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=100" />
                    </div>
                    <div>
                        <p className="text-white font-bold text-sm">Mariana Silva</p>
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] text-white/60 font-bold uppercase tracking-widest">Em Sessão • 42:12</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="aspect-video rounded-[32px] bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 flex items-center justify-center overflow-hidden">
                <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                        <Users className="w-5 h-5 text-primary" />
                    </div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Você</p>
                </div>
            </div>
        </div>
        <div className="flex-1 flex gap-4">
            <div className="flex-1 p-6 rounded-[32px] bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.05] shadow-sm flex flex-col">
                 <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">Notas Rápidas</h3>
                 <div className="flex-1 space-y-3">
                     <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-white/5 text-[11px] text-zinc-600 dark:text-white/60 leading-relaxed italic">
                        "Paciente relata melhora no sono após início do protocolo de higiene do sono..."
                     </div>
                 </div>
            </div>
            <div className="w-[300px] p-6 rounded-[32px] bg-zinc-950 text-white flex flex-col">
                 <h3 className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-4">Chat de Sessão</h3>
                 <div className="flex-1"></div>
                 <div className="flex items-center gap-2 bg-white/10 p-2 rounded-2xl">
                     <div className="flex-1 h-8 bg-transparent text-[11px] px-2 flex items-center text-white/60">Escreva aqui...</div>
                     <Send className="w-4 h-4 text-primary" />
                 </div>
            </div>
        </div>
    </div>
);

const PatientsScreen = () => (
    <div className="h-full flex flex-col space-y-6 font-sans">
        <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input className="w-full h-12 pl-12 pr-4 rounded-2xl bg-zinc-100 dark:bg-white/5 border-none text-sm placeholder:text-zinc-400 focus:ring-2 ring-primary/20" placeholder="Buscar pacientes..." />
            </div>
            <button className="h-12 px-6 rounded-2xl bg-primary text-white text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Novo Paciente
            </button>
        </div>
        <div className="grid grid-cols-1 gap-4 overflow-y-auto custom-scrollbar pr-2">
            {[
                { name: "Mariana Silva", status: "Ativo", email: "mariana.s@email.com", last: "Hoje", risk: "Baixo" },
                { name: "Carlos Eduardo", status: "Ativo", email: "cadu@email.com", last: "Ontem", risk: "Médio" },
                { name: "Ana Beatriz", status: "Ativo", email: "ana.b@email.com", last: "Há 3 dias", risk: "Baixo" },
                { name: "Rodrigo Melo", status: "Em espera", email: "rodrigo.m@email.com", last: "Há 1 semana", risk: "Alto" },
            ].map((p, i) => (
                <div key={i} className="p-5 rounded-[24px] bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.05] flex items-center justify-between group hover:border-primary/20 transition-all">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-white/5 flex items-center justify-center font-bold text-zinc-400">{p.name[0]}</div>
                        <div>
                            <p className="text-sm font-bold text-zinc-900 dark:text-white">{p.name}</p>
                            <p className="text-[10px] text-zinc-400">{p.email}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-8">
                        <div className="text-center">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Última</p>
                            <p className="text-[11px] font-bold">{p.last}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Risco</p>
                            <div className={cn(
                                "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest",
                                p.risk === 'Baixo' ? "bg-emerald-500/10 text-emerald-500" :
                                p.risk === 'Médio' ? "bg-amber-500/10 text-amber-500" : "bg-red-500/10 text-red-500"
                            )}>
                                {p.risk}
                            </div>
                        </div>
                        <MoreHorizontal className="w-4 h-4 text-zinc-300 group-hover:text-zinc-600 transition-colors" />
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const NeuroViewMock = () => {
    const nodes = [
        { id: 'dr', type: 'doctor', label: 'Dr. Silva', x: 0, y: 0, icon: Zap },
        { id: 'p1', type: 'patient', label: 'Mariana Silva', x: -180, y: -100, initials: 'MS', avatar: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=100' },
        { id: 'p2', type: 'patient', label: 'Carlos Eduardo', x: 180, y: -80, initials: 'CE' },
        { id: 'p3', type: 'patient', label: 'Ana Beatriz', x: 0, y: 160, initials: 'AB' },
        { id: 'n1', type: 'note', label: 'Sessão #04', x: -280, y: -40, content: 'Estresse laboral detectado' },
        { id: 'n2', type: 'note', label: 'Sessão #03', x: -250, y: -160, content: 'Melhora no sono' },
        { id: 'n3', type: 'note', label: 'Triagem', x: 260, y: -20, content: 'Ansiedade generalizada' },
        { id: 'n4', type: 'note', label: 'Relatório', x: 100, y: 240, content: 'Evolução positiva' },
    ];

    const edges = [
        { from: 'dr', to: 'p1' },
        { from: 'dr', to: 'p2' },
        { from: 'dr', to: 'p3' },
        { from: 'p1', to: 'n1' },
        { from: 'p1', to: 'n2' },
        { from: 'p2', to: 'n3' },
        { from: 'p3', to: 'n4' },
    ];

    return (
        <div className="relative w-full h-full bg-[#F5F5F7] dark:bg-[#020204] rounded-[32px] overflow-hidden flex flex-col font-sans">
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0)_0%,rgba(0,0,0,0.05)_100%)] dark:bg-[radial-gradient(ellipse_at_center,#1a1a1a_0%,#0d0d0d_40%,#000000_100%)]" />
            </div>

            <div className="absolute top-4 right-4 z-50 flex flex-col gap-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                    <div className="pl-10 pr-4 h-10 w-[240px] bg-white/80 dark:bg-black/60 backdrop-blur-xl border border-zinc-200 dark:border-white/10 rounded-xl flex items-center">
                        <span className="text-[11px] text-zinc-400">Buscar no grafo...</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {[Play, ZoomOut, ZoomIn, Target, Settings2, Maximize].map((Icon, i) => (
                        <div key={i} className="h-9 w-9 rounded-xl bg-white/80 dark:bg-black/60 backdrop-blur-xl border border-zinc-200 dark:border-white/10 flex items-center justify-center text-zinc-500 dark:text-white/70">
                            <Icon className="h-4 w-4" />
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                    {edges.map((edge, i) => {
                        const fromNode = nodes.find(n => n.id === edge.from)!;
                        const toNode = nodes.find(n => n.id === edge.to)!;
                        return (
                            <motion.line
                                key={i}
                                initial={{ pathLength: 0, opacity: 0 }}
                                animate={{ pathLength: 1, opacity: 1 }}
                                transition={{ delay: 0.5 + i * 0.1, duration: 1.5 }}
                                x1={`calc(50% + ${fromNode.x}px)`}
                                y1={`calc(50% + ${fromNode.y}px)`}
                                x2={`calc(50% + ${toNode.x}px)`}
                                y2={`calc(50% + ${toNode.y}px)`}
                                stroke="currentColor"
                                strokeWidth="1.5"
                                className="text-primary/30"
                            />
                        );
                    })}
                </svg>

                {nodes.map((node, i) => (
                    <motion.div
                        key={node.id}
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 + i * 0.1, type: "spring" }}
                        className="absolute z-20"
                        style={{ x: node.x, y: node.y }}
                    >
                        <div className="relative group/node flex flex-col items-center">
                            {node.type === 'doctor' ? (
                                <div className="w-14 h-14 rounded-full bg-primary shadow-[0_0_30px_rgba(var(--primary-rgb),0.4)] flex items-center justify-center text-white ring-4 ring-primary/20">
                                    <Zap className="w-6 h-6" />
                                </div>
                            ) : node.type === 'patient' ? (
                                <div className="w-10 h-10 rounded-full bg-white dark:bg-zinc-800 border-2 border-primary/40 shadow-xl overflow-hidden flex items-center justify-center">
                                    {node.avatar ? <img src={node.avatar} className="w-full h-full object-cover" /> : <span className="text-[10px] font-black text-zinc-500">{node.initials}</span>}
                                </div>
                            ) : (
                                <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 shadow-lg flex items-center justify-center text-zinc-400">
                                    <FileText className="w-4 h-4" />
                                </div>
                            )}
                            <div className="absolute -bottom-7 whitespace-nowrap px-2 py-0.5 rounded-md bg-white/90 dark:bg-black/90 text-[9px] font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400 border border-zinc-200/50 dark:border-white/5 opacity-0 group-hover/node:opacity-100 transition-opacity">
                                {node.label}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-6 py-3 rounded-full bg-white/90 dark:bg-black/80 backdrop-blur-2xl border border-zinc-200 dark:border-white/10 shadow-2xl z-20">
                {[Type, Paperclip, List, RotateCcw, MessageSquare, Sparkles].map((Icon, i) => (
                    <div key={i} className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer",
                        i === 5 ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-zinc-500 dark:text-white/40 hover:bg-zinc-100 dark:hover:bg-white/5"
                    )}>
                        <Icon className="w-5 h-5" />
                    </div>
                ))}
                <div className="w-px h-6 bg-zinc-200 dark:bg-white/10 mx-2" />
                <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
                    <MoreVertical className="w-5 h-5" />
                </div>
            </div>
        </div>
    );
};

const FinanceScreen = () => {
    return (
        <div className="h-full flex flex-col space-y-6 overflow-y-auto custom-scrollbar pr-2 font-sans">
            {/* Balance Card Monocromático */}
            <motion.div 
                whileHover={{ y: -5 }}
                className={cn(
                    "p-8 rounded-[32px] relative overflow-hidden group transition-all duration-500 shadow-2xl",
                    "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950",
                    "shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(255,255,255,0.05)]"
                )}
            >
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent dark:from-black/5 pointer-events-none" />
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 dark:bg-black/5 blur-[80px] rounded-full -mr-32 -mt-32 transition-transform duration-1000 group-hover:scale-125" />
                
                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-8">
                        <span className="text-xs font-black uppercase tracking-[0.3em] opacity-60">Saldo Disponível</span>
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 dark:bg-black/10 backdrop-blur-md">
                            <Zap className="w-4 h-4 text-primary" />
                        </div>
                    </div>
                    <div className="flex items-baseline gap-4 mb-8">
                        <span className="text-sm font-bold opacity-40">R$</span>
                        <motion.span 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-5xl font-black tracking-tighter"
                        >
                            18.240,42
                        </motion.span>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-1 px-4 py-3 rounded-2xl bg-white/10 dark:bg-black/5 border border-white/10 dark:border-black/10 backdrop-blur-md flex items-center justify-center gap-2 font-bold text-[10px] uppercase tracking-widest transition-all hover:bg-white/20 dark:hover:bg-black/10 cursor-pointer">
                            <Send className="w-3.5 h-3.5" /> Saque Pix
                        </div>
                        <div className="flex-1 px-4 py-3 rounded-2xl bg-primary text-white shadow-lg shadow-primary/20 flex items-center justify-center gap-2 font-bold text-[10px] uppercase tracking-widest transition-transform hover:scale-105 active:scale-95 cursor-pointer">
                            <QrCode className="w-3.5 h-3.5" /> Pagar
                        </div>
                    </div>
                </div>
            </motion.div>

            <div className="grid grid-cols-2 gap-6">
                <div className="p-6 rounded-[24px] bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.05] shadow-sm">
                    <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-6">Receitas p/ Mês</h3>
                    <div className="h-32 flex items-end justify-between gap-1">
                        {[40, 65, 45, 80, 55, 90, 75].map((h, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-2">
                                <div style={{ height: `${h}%` }} className={cn(
                                    "w-full rounded-t-lg transition-all duration-1000",
                                    i === 5 ? "bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]" : "bg-zinc-100 dark:bg-white/10"
                                )} />
                                <span className="text-[8px] font-black text-zinc-400">{['M', 'A', 'M', 'J', 'J', 'A', 'S'][i]}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="p-6 rounded-[24px] bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.05] shadow-sm">
                    <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">Transações Recentes</h3>
                    <div className="space-y-4">
                        {[
                            { label: "Sessão #142", val: "+ R$ 250,00", type: "in" },
                            { label: "Assinatura Zoom", val: "- R$ 85,90", type: "out" },
                            { label: "Repasse Profissional", val: "- R$ 420,00", type: "out" },
                            { label: "Sessão #141", val: "+ R$ 250,00", type: "in" },
                        ].map((t, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={cn("w-2 h-2 rounded-full", t.type === 'in' ? "bg-emerald-500" : "bg-zinc-400")} />
                                    <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">{t.label}</span>
                                </div>
                                <span className={cn("text-[10px] font-bold font-mono", t.type === 'in' ? "text-emerald-500" : "text-zinc-900 dark:text-white")}>{t.val}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const SynapseAIScreen = () => (
    <div className="h-full flex flex-col items-center justify-center space-y-10 relative overflow-hidden font-sans">
        <div className="relative z-10 w-64 h-64 flex items-center justify-center rounded-full group">
            <div className="absolute inset-0 rounded-full border border-primary/20 scale-110 group-hover:scale-125 transition-transform duration-1000" />
            <div className="absolute inset-0 rounded-full border border-primary/10 scale-125 group-hover:scale-150 transition-transform duration-1000 delay-75" />
            
            <VoiceSpiral 
                isListening={true} 
                className="w-full h-full scale-[1.1] opacity-100 dark:mix-blend-screen"
            />
        </div>

        <div className="text-center space-y-4 relative z-10">
            <motion.div 
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20"
            >
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Interface Clínica Inteligente</span>
            </motion.div>
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white uppercase tracking-[0.3em] italic leading-tight">A Voz do seu<br/>Conhecimento.</h2>
            <p className="text-[11px] text-zinc-400 font-medium max-w-xs mx-auto leading-relaxed">
                O Synapse é a interface inteligente entre você e o sistema. Vamos transformar sua prática agora?
            </p>
        </div>
    </div>
);

// --- MAIN COMPONENT ---

export const HeroVisual = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [currentScreen, setCurrentScreen] = useState(0);

    const screens = [
        <DashboardScreen />,
        <AgendaScreen />,
        <TeleconsultaScreen />,
        <PatientsScreen />,
        <NeuroViewMock />,
        <FinanceScreen />,
        <SynapseAIScreen />
    ];

    const menuItems = [
        { icon: LayoutDashboard, label: "Dashboard", id: 0 },
        { icon: Calendar, label: "Agenda", id: 1 },
        { icon: Video, label: "Teleconsulta", id: 2 },
        { icon: Users, label: "Pacientes", id: 3 },
        { icon: FileText, label: "Notas", id: 4 },
        { icon: Wallet, label: "NeuroFinance", id: 5 },
        { icon: Sparkles, label: "Synapse AI", id: 6 },
    ];

    const mouseX = useMotionValue(500);
    const mouseY = useMotionValue(325);
    const smoothMouseX = useSpring(mouseX, { stiffness: 100, damping: 30 });
    const smoothMouseY = useSpring(mouseY, { stiffness: 100, damping: 30 });

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        mouseX.set(e.clientX - rect.left);
        mouseY.set(e.clientY - rect.top);
    };

    // Ajuste do intervalo: a aba final do Synapse dura 2x (16s)
    useEffect(() => {
        const duration = currentScreen === screens.length - 1 ? 16000 : 8000;
        const interval = setInterval(() => {
            setCurrentScreen((prev) => (prev + 1) % screens.length);
        }, duration);
        return () => clearInterval(interval);
    }, [currentScreen, screens.length]);

    // Comentários contextuais do Synapse baseados na tela atual
    const synapseInsights = [
        {
            text: "Notei que 3 novos pacientes ainda não foram triados. Quer que eu agende?",
            action: "Agendar Triagens"
        },
        {
            text: "Você tem um buraco na quarta às 15h. Ofereço pro Carlos que pediu encaixe?",
            action: "Oferecer Horário"
        },
        {
            text: "Mariana parece mais ansiosa hoje. Quer um sumário comparativo das notas?",
            action: "Gerar Sumário"
        },
        {
            text: "O Rodrigo não aparece há 2 semanas. Mando um lembrete gentil por WhatsApp?",
            action: "Enviar Lembrete"
        },
        {
            text: "Ficou clara a relação da Mariana com o trabalho no grafo. Quer ver o mapa?",
            action: "Ver Mapa Mental"
        },
        {
            text: "Saldo de R$ 18k liberado. Programo o repasse automático pros parceiros?",
            action: "Programar Repasses"
        },
        {
            text: "Tô monitorando tudo. Quer que eu faça o briefing pros atendimentos de amanhã?",
            action: "Fazer Briefing Clínico"
        }
    ];

    return (
        <div className="w-full h-[700px] relative flex items-center justify-center z-10 overflow-visible mt-8 select-none perspective-[2000px] font-sans">
            <div className="relative w-[1100px] h-full flex items-center justify-center">

                <motion.div
                    ref={containerRef}
                    onMouseMove={handleMouseMove}
                    initial={{ rotateX: 2, y: 20, opacity: 0 }}
                    animate={{ rotateX: 0, y: 0, opacity: 1 }}
                    transition={{ duration: 1.2, type: "spring", stiffness: 30 }}
                    className="relative w-full aspect-[16/10] rounded-[40px] overflow-hidden shadow-[0_0_100px_-30px_rgba(0,0,0,0.1)] dark:shadow-[0_0_100px_-30px_rgba(255,255,255,0.05)] ring-1 ring-zinc-200 dark:ring-white/10 bg-white dark:bg-[#050507] group gpu-accelerated border-[10px] border-zinc-100 dark:border-[#0F0F12]"
                >
                    <div className="h-16 border-b border-zinc-200 dark:border-white/[0.06] flex items-center justify-between px-8 bg-white/95 dark:bg-[#0A0A0B]/95 backdrop-blur-md sticky top-0 z-30">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-primary/5 border border-primary/10">
                                <Logo className="w-4 h-4" />
                                <span className="text-[12px] font-black text-primary uppercase tracking-[0.2em]">NeuroNex AI</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-1 p-1 rounded-2xl bg-zinc-100/50 dark:bg-white/[0.03] border border-zinc-200/50 dark:border-white/[0.05]">
                            {menuItems.map((item, i) => {
                                const isActive = currentScreen === item.id;
                                return (
                                    <button 
                                        key={i} 
                                        onClick={() => setCurrentScreen(item.id)}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-500",
                                            isActive
                                                ? "bg-white dark:bg-white/[0.1] text-zinc-900 dark:text-white shadow-sm border border-zinc-200 dark:border-white/10"
                                                : "text-zinc-400 dark:text-white/30 hover:text-zinc-600 dark:hover:text-white/60"
                                        )}
                                    >
                                        <item.icon className={cn("w-3.5 h-3.5", isActive ? "text-primary" : "text-zinc-400")} />
                                        <AnimatePresence initial={false}>
                                            {isActive && (
                                                <motion.span
                                                    initial={{ width: 0, opacity: 0, x: -10 }}
                                                    animate={{ width: "auto", opacity: 1, x: 0 }}
                                                    exit={{ width: 0, opacity: 0, x: -10 }}
                                                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                                                    className="overflow-hidden whitespace-nowrap"
                                                >
                                                    {item.label}
                                                </motion.span>
                                            )}
                                        </AnimatePresence>
                                    </button>
                                );
                            })}
                        </div>
                        
                        <div className="flex items-center gap-6">
                            <Avatar className="w-7 h-7 border border-zinc-200 dark:border-white/10">
                                <AvatarFallback className="bg-zinc-100 dark:bg-zinc-800 text-[9px] text-zinc-600 dark:text-white font-black">DS</AvatarFallback>
                            </Avatar>
                            <div className="h-4 w-px bg-zinc-200 dark:bg-white/10" />
                            <div className="flex gap-2">
                                <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                                <div className="w-3 h-3 rounded-full bg-[#27C93F]" />
                                <div className="w-3 h-3 rounded-full bg-[#FF5F56]" />
                            </div>
                        </div>
                    </div>

                    <div className="h-[calc(100%-64px)] relative">
                        <div className="h-full p-10 bg-white dark:bg-[#050507] relative overflow-hidden">
                             <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentScreen}
                                    initial={{ opacity: 0, scale: 0.98, filter: "blur(10px)" }}
                                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                                    exit={{ opacity: 0, scale: 1.02, filter: "blur(10px)" }}
                                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                                    className="h-full relative z-10"
                                >
                                    {screens[currentScreen]}
                                </motion.div>
                             </AnimatePresence>
                        </div>
                    </div>
                </motion.div>

                {/* Widget: Receita Hoje */}
                <FloatingWidget x="82%" y="15%" delay={0.5} depth={3} mouseX={smoothMouseX} mouseY={smoothMouseY} className="w-[280px]">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center ring-1 ring-emerald-500/20">
                                <Landmark className="w-4 h-4 text-emerald-500" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Receita Hoje</span>
                        </div>
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-4xl font-black text-zinc-900 dark:text-white tracking-tighter">R$ 1.250</span>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">+18% vs ontem</span>
                        </div>
                    </div>
                </FloatingWidget>

                {/* Widget: Synapse Inteligente */}
                <FloatingWidget x="85%" y="65%" delay={0.8} depth={4} mouseX={smoothMouseX} mouseY={smoothMouseY} className="w-[340px] p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-2xl bg-zinc-950 dark:bg-white flex items-center justify-center shadow-xl">
                            <Sparkles className="w-5 h-5 text-white dark:text-zinc-950" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Synapse AI</span>
                                <div className="flex gap-1">
                                    <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                                    <div className="w-1 h-1 rounded-full bg-primary animate-pulse delay-75" />
                                    <div className="w-1 h-1 rounded-full bg-primary animate-pulse delay-150" />
                                </div>
                            </div>
                            <p className="text-[9px] font-bold text-primary uppercase tracking-widest">Analisando contexto...</p>
                        </div>
                    </div>

                    <div className="bg-zinc-50 dark:bg-white/[0.03] rounded-2xl p-4 border border-zinc-100 dark:border-white/[0.05] mb-4">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentScreen}
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                className="space-y-4"
                            >
                                <p className="text-[13px] text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
                                    {synapseInsights[currentScreen].text}
                                </p>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    <div className="flex items-center gap-3 bg-white dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-2.5">
                        <div className="flex-1 text-[11px] text-zinc-400 font-medium italic">Falar com Synapse...</div>
                        <div className="flex gap-2">
                            <Mic className="w-4 h-4 text-zinc-300" />
                            <Send className="w-4 h-4 text-primary" />
                        </div>
                    </div>
                </FloatingWidget>

                <FloatingWidget x="-80px" y="40%" delay={1.1} depth={2} mouseX={smoothMouseX} mouseY={smoothMouseY} className="w-[280px]">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Avatar className="h-11 w-11 border-2 border-primary/20 ring-4 ring-primary/5 shadow-2xl">
                                <AvatarImage src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=100" />
                                <AvatarFallback className="bg-zinc-100 dark:bg-zinc-900 text-xs text-zinc-700 dark:text-white">MS</AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-[#121214] rounded-full" />
                        </div>
                        <div>
                            <p className="text-[14px] font-black text-zinc-900 dark:text-white tracking-tight uppercase">Mariana Silva</p>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="flex gap-0.5">
                                    {[1, 2, 3, 4, 5].map(i => <div key={i} className={cn("w-1 h-3 rounded-full", i < 4 ? "bg-primary" : "bg-zinc-200 dark:bg-white/10")} />)}
                                </div>
                                <span className="text-[10px] text-zinc-400 dark:text-white/30 font-bold uppercase tracking-widest ml-2">Gravando</span>
                            </div>
                        </div>
                    </div>
                </FloatingWidget>
            </div>
        </div>
    );
};