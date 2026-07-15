import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Brain, Cloud, Database, Globe, Share2, TrendingUp, Users, Wallet, Wifi, Zap } from "lucide-react";

const Scene3D = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <div className={cn("relative w-full h-full flex items-center justify-center perspective-[1200px] overflow-visible gpu-accelerated", className)}>
        {children}
    </div>
);

export const DashboardVisual = () => (
    <Scene3D>
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-[480px] aspect-[16/10] bg-card/60 backdrop-blur-[30px] border border-border/30 rounded-2xl shadow-premium overflow-hidden flex flex-col group"
        >
            <div className="premium-noise opacity-[0.03] dark:opacity-[0.05]" />
            <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.02] to-transparent pointer-events-none" />
            <div className="h-10 border-b border-border/20 flex items-center px-5 gap-4 bg-foreground/[0.01]">
                <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-foreground/20" />
                    <div className="w-2 h-2 rounded-full bg-foreground/10" />
                    <div className="w-2 h-2 rounded-full bg-foreground/5" />
                </div>
                <div className="text-[10px] font-black tracking-widest text-foreground/40 uppercase ml-4">Painel de Controle</div>
                <div className="h-1.5 w-16 bg-foreground/5 rounded-full ml-auto" />
            </div>
            <div className="p-6 grid grid-cols-6 grid-rows-2 gap-4 h-full relative z-10">
                <div className="col-span-4 row-span-2 bg-foreground/[0.01] rounded-xl border border-border/20 p-5 flex flex-col relative overflow-hidden">
                    <div className="flex justify-between items-start mb-6">
                        <div className="space-y-1">
                            <div className="text-[10px] font-black uppercase tracking-widest text-foreground/30">Visão Geral</div>
                            <div className="text-xl font-bold tracking-tighter">Fluxo de Sessões</div>
                        </div>
                        <div className="px-2 py-0.5 rounded-md bg-foreground/5 border border-border/20 text-[8px] text-foreground font-black flex items-center gap-1 uppercase tracking-widest">
                            <TrendingUp className="w-3 h-3" /> +14.2%
                        </div>
                    </div>
                    <div className="mt-auto flex items-end justify-between gap-2 h-24">
                        {[35, 55, 45, 70, 60, 90, 75].map((h, i) => (
                            <motion.div
                                key={i}
                                initial={{ height: 0 }}
                                whileInView={{ height: `${h}%` }}
                                transition={{ duration: 1, delay: i * 0.05, type: "spring", stiffness: 100 }}
                                className="w-full bg-foreground/10 dark:bg-white/10 rounded-t-sm relative group/bar"
                            >
                                <div className="absolute inset-x-0 top-0 h-1 bg-foreground/20 opacity-0 group-hover/bar:opacity-100 transition-opacity" />
                            </motion.div>
                        ))}
                    </div>
                </div>
                <div className="col-span-2 bg-foreground/[0.01] rounded-xl border border-border/20 p-5 flex flex-col justify-between">
                    <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center border border-border/20">
                        <Users className="w-4 h-4 text-foreground/40" />
                    </div>
                    <div className="space-y-1">
                        <div className="text-[8px] font-black uppercase tracking-widest text-foreground/30">Pacientes</div>
                        <div className="text-lg font-bold tracking-tighter">124</div>
                    </div>
                </div>
                <div className="col-span-2 bg-foreground/[0.01] rounded-xl border border-border/20 p-5 flex flex-col justify-between">
                    <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center border border-border/20">
                        <Wallet className="w-4 h-4 text-foreground/40" />
                    </div>
                    <div className="space-y-1">
                        <div className="text-[8px] font-black uppercase tracking-widest text-foreground/30">Receita</div>
                        <div className="text-lg font-bold tracking-tighter">R$ 14k</div>
                    </div>
                </div>
            </div>
        </motion.div>
    </Scene3D>
);

export const NeuroFinanceCardVisual = ({ performanceMode = false }: { performanceMode?: boolean }) => (
    <Scene3D>
        <div className="relative w-[360px] h-[220px] flex items-center justify-center">
            <div className="relative w-full h-full flex items-center justify-center group">
                <motion.div
                    className="relative z-10 w-[360px] h-[220px] rounded-[32px] p-8 flex flex-col justify-between overflow-hidden shadow-premium border border-white/10 will-change-transform"
                    initial={{ y: 20, opacity: 0, rotateX: 0, rotateY: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    whileHover={!performanceMode ? { 
                        rotateX: 5, 
                        rotateY: -5,
                        scale: 1.02,
                        transition: { duration: 0.2, ease: "easeOut" }
                    } : {
                        scale: 1.01,
                        transition: { duration: 0.2, ease: "easeOut" }
                    }}
                    transition={{ duration: 0.8, type: "spring", bounce: 0.3 }}
                >
                    <div className="absolute inset-0 bg-zinc-900 dark:bg-white">
                        <div className="premium-noise opacity-[0.1] dark:opacity-[0.05]" />
                        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.1] via-transparent to-black/30" />
                    </div>
                    <div className="relative z-20 h-full flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2"><span className="text-[12px] font-black tracking-[0.3em] text-white dark:text-zinc-900">NEURONEX</span></div>
                            <Wifi className="w-5 h-5 rotate-90 text-white/20 dark:text-zinc-900/20" />
                        </div>
                        <div className="flex gap-3 text-[18px] tracking-[0.25em] text-white/40 dark:text-zinc-900/40 font-mono"><span>•••• •••• ••••</span><span className="text-white dark:text-zinc-900 font-bold">8829</span></div>
                        <div className="flex justify-between items-end">
                            <p className="text-[9px] font-black tracking-[0.2em] uppercase text-white/60 dark:text-zinc-900/60">Sua Conta Financeira</p>
                            <div className="flex gap-2">
                                <div className="w-7 h-7 rounded-full bg-white/10 dark:bg-zinc-900/10 border border-white/20 dark:border-zinc-900/20" />
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    </Scene3D>
);

/** @deprecated Use NeuroFinanceCardVisual instead */
export const NeuroBankCardVisual = NeuroFinanceCardVisual;

export const AIBrainVisual = () => (
    <Scene3D>
        <div className="relative w-full h-full flex items-center justify-center">
            <div className="relative w-56 h-56 flex items-center justify-center">
                {[0, 45, 90, 135].map((deg, i) => (
                    <motion.div
                        key={i}
                        className="absolute inset-0 rounded-full border border-foreground/5 dark:border-white/5"
                        style={{ rotate: deg }}
                        animate={{ rotate: [deg, deg + 360], scale: [1, 1.05, 1] }}
                        transition={{ duration: 12 + i * 2, repeat: Infinity, ease: "linear" }}
                    />
                ))}
                <motion.div
                    className="relative z-10 w-20 h-20 rounded-full bg-card/40 border border-border/30 backdrop-blur-xl flex items-center justify-center shadow-premium overflow-hidden"
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                    <div className="premium-noise opacity-[0.05]" />
                    <div className="pulsing-gradient-surface opacity-20" />
                    <Brain className="relative z-10 w-8 h-8 text-foreground/60" />
                </motion.div>
            </div>
        </div>
    </Scene3D>
);

export const ConnectivityOrbVisual = () => (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden gpu-accelerated">
        <div className="relative z-30 flex items-center justify-center">
            <motion.div
                className="w-32 h-32 bg-foreground text-background dark:bg-white dark:text-black shadow-premium rounded-[2.5rem] flex items-center justify-center"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            >
                <Zap className="w-8 h-8 fill-current" />
            </motion.div>
        </div>
        {[
            { icon: Globe, x: 140, y: -80 },
            { icon: Database, x: -160, y: 70 },
            { icon: Cloud, x: -120, y: -100 },
            { icon: Share2, x: 170, y: 90 }
        ].map((item, i) => (
            <motion.div
                key={i}
                className="absolute z-40"
                initial={{ opacity: 0, scale: 0.5, x: 0, y: 0 }}
                whileInView={{ opacity: 1, scale: 1, x: item.x, y: item.y }}
                transition={{ duration: 1, delay: i * 0.1, type: "spring" }}
            >
                <div className="w-10 h-10 bg-card border border-border/30 rounded-xl flex items-center justify-center shadow-lg">
                    <item.icon className="w-4 h-4 text-muted-foreground/60" />
                </div>
            </motion.div>
        ))}
    </div>
);

export const PatientsVisual = () => (
    <Scene3D>
        <div className="relative w-[340px] h-[400px] flex justify-center pt-10">
            {[0, 1, 2].map((i) => (
                <motion.div
                    key={i}
                    className="absolute top-0 w-full h-[160px] bg-card border border-border/30 rounded-[28px] p-5 shadow-premium flex gap-4 backdrop-blur-md overflow-hidden"
                    style={{
                        y: i * 70,
                        scale: 1 - i * 0.05,
                        opacity: 1 - i * 0.3
                    }}
                    initial={{ y: 100, opacity: 0 }}
                    whileInView={{ y: i * 70, opacity: 1 - i * 0.3 }}
                    transition={{ duration: 0.8, delay: i * 0.1 }}
                >
                    <div className="premium-noise opacity-[0.03]" />
                    <div className="pulsing-gradient-surface opacity-10" />
                    <div className="relative z-10 w-10 h-10 border border-border/20 shadow-sm rounded-full bg-foreground/5 text-foreground/60 font-black flex items-center justify-center text-xs">
                        {["JS", "MA", "RT"][i]}
                    </div>
                    <div className="flex-1 space-y-2 pt-1">
                        <div className="h-2 w-24 bg-foreground/10 rounded-full" />
                        <div className="h-1.5 w-full bg-foreground/5 rounded-full" />
                    </div>
                </motion.div>
            ))}
        </div>
    </Scene3D>
);

export const NeuroSystemsVisual = () => {
    // Mock Data for the Graph Animation - Expanded with 5 more nodes
    const nodes = [
        { id: 1, x: 50, y: 50, type: "patient", label: "Maria F.", size: 80 }, // Centered, slightly larger
        { id: 2, x: 20, y: 30, type: "insight", label: "Ansiedade", size: 40 },
        { id: 3, x: 80, y: 30, type: "insight", label: "TCC", size: 30 },
        { id: 4, x: 20, y: 70, type: "note", size: 15 },
        { id: 5, x: 80, y: 70, type: "note", size: 20 },
        { id: 6, x: 50, y: 15, type: "note", size: 12 },
        { id: 7, x: 35, y: 85, type: "insight", label: "Sono", size: 35 },
        // New Nodes
        { id: 8, x: 10, y: 50, type: "note", size: 12 },
        { id: 9, x: 90, y: 50, type: "note", size: 14 },
        { id: 10, x: 65, y: 85, type: "insight", label: "Humor", size: 25 },
        { id: 11, x: 30, y: 15, type: "note", size: 10 },
        { id: 12, x: 70, y: 15, type: "note", size: 10 },
    ];

    const links = [
        { source: 1, target: 2 },
        { source: 1, target: 3 },
        { source: 1, target: 4 },
        { source: 1, target: 5 },
        { source: 1, target: 6 },
        { source: 1, target: 7 },
        { source: 2, target: 6 },
        { source: 4, target: 7 },
        // New Links
        { source: 2, target: 8 },
        { source: 4, target: 8 },
        { source: 3, target: 9 },
        { source: 5, target: 9 },
        { source: 7, target: 10 },
        { source: 5, target: 10 },
        { source: 2, target: 11 },
        { source: 6, target: 11 },
        { source: 3, target: 12 },
        { source: 6, target: 12 },
    ];

    return (
        <Scene3D>
            <div className="relative w-full h-full flex items-center justify-center overflow-visible">
                {/* Graph Container - Increased size ~30% */}
                <div className="relative w-[440px] h-[440px]">

                    {/* Connections (SVG Layer) */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible">
                        {links.map((link, i) => {
                            const source = nodes.find(n => n.id === link.source)!;
                            const target = nodes.find(n => n.id === link.target)!;

                            // Convert % coordinates to pixel offsets for SVG (approximate based on container size)
                            const x1 = `${source.x}%`;
                            const y1 = `${source.y}%`;
                            const x2 = `${target.x}%`;
                            const y2 = `${target.y}%`;

                            return (
                                <g key={i}>
                                    <motion.line
                                        x1={x1} y1={y1} x2={x2} y2={y2}
                                        stroke="currentColor"
                                        strokeWidth="1"
                                        className="text-foreground/20 dark:text-white/20"
                                        initial={{ pathLength: 0, opacity: 0 }}
                                        whileInView={{ pathLength: 1, opacity: 1 }}
                                        transition={{ duration: 1.5, delay: i * 0.1 }}
                                    />
                                    {/* Animated particle on the line */}
                                    <motion.circle
                                        r="2"
                                        fill="currentColor"
                                        className="text-primary dark:text-white"
                                    >
                                        <animateMotion
                                            fill="freeze"
                                            dur={`${3 + i}s`}
                                            repeatCount="indefinite"
                                            path={`M${source.x * 4.4},${source.y * 4.4} L${target.x * 4.4},${target.y * 4.4}`}
                                        // Scaled to 440px container multiplier approx.
                                        // Note: SVG path coords are absolute. 
                                        // A better way is to use direct calc if possible, or percent-based animation which is harder in framer.
                                        // Let's rely on CSS/Framer animation or simplify to just pulsing lines.
                                        />
                                    </motion.circle>
                                </g>
                            );
                        })}
                    </svg>

                    {/* Nodes (Div Layer) */}
                    {nodes.map((node, i) => (
                        <motion.div
                            key={node.id}
                            className={cn(
                                "absolute flex items-center justify-center rounded-full border shadow-premium backdrop-blur-md",
                                node.type === "patient"
                                    ? "bg-foreground text-background border-4 border-background/20 z-20 shadow-[0_0_40px_rgba(255,255,255,0.15)]"
                                    : "bg-white dark:bg-zinc-200 text-zinc-900 z-10 shadow-[0_0_15px_rgba(255,255,255,0.4)] border border-white/40"
                            )}
                            style={{
                                width: node.size,
                                height: node.size,
                                left: `${node.x}%`,
                                top: `${node.y}%`,
                                marginLeft: -node.size / 2,
                                marginTop: -node.size / 2,
                            }}
                            initial={{ scale: 0, opacity: 0 }}
                            whileInView={{ scale: 1, opacity: 1 }}
                            viewport={{ once: true }}
                            transition={{
                                type: "spring",
                                stiffness: 260,
                                damping: 20,
                                delay: 0.2 + i * 0.1
                            }}
                            animate={{
                                y: [0, -5, 0],
                                x: [0, 3, 0],
                                transition: {
                                    duration: 4,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                }
                            }}
                        >
                            {/* Inner Glow Pulse */}
                            <div className="absolute inset-0 rounded-full bg-current opacity-10 animate-pulse" />

                            {/* Label or Icon */}
                            {node.label ? (
                                <span className={cn(
                                    "px-2 whitespace-nowrap",
                                    node.type === "patient" ? "text-[10px] sm:text-xs" : "text-[8px] font-medium"
                                )}>
                                    {node.type === "patient" ? (
                                        <div className="flex flex-col items-center leading-none gap-0.5">
                                            <span className="opacity-60 text-[8px] uppercase tracking-wider">Paciente</span>
                                            <span>{node.label}</span>
                                        </div>
                                    ) : (
                                        node.label
                                    )}
                                </span>
                            ) : (
                                <div className="w-1.5 h-1.5 rounded-full bg-foreground/40" />
                            )}

                            {/* Connecting Lines Glow (Pseudo) */}
                            {node.type === "patient" && (
                                <div className="absolute -inset-4 border border-foreground/5 rounded-full animate-ping opacity-20 [animation-duration:3000ms]" />
                            )}
                        </motion.div>
                    ))}


                </div>
            </div>
        </Scene3D>
    );
};
