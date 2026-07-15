"use client";

import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import {
    ArrowLeft,
    ArrowRight,
    AudioLines,
    BrainCircuit,
    CalendarDays,
    Check,
    Clock3,
    FileText,
    LayoutDashboard,
    MessageSquareText,
    Mic2,
    Network,
    Pause,
    Play,
    Route,
    ShieldCheck,
    Sparkles,
    UsersRound,
    WalletCards,
    type LucideIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

const SCREENSHOT_ROOT = "/landing/screenshots/desktop";

type TourScene = {
    id: string;
    eyebrow: string;
    title: string;
    description: string;
    icon: LucideIcon;
    darkAsset: string;
    lightAsset?: string;
    secondaryDarkAsset?: string;
    secondaryLightAsset?: string;
    secondaryLabel?: string;
    points: string[];
    alt: string;
    duration: number;
    kind?: "voice";
};

const tourScenes: TourScene[] = [
    {
        id: "central",
        eyebrow: "Central da clínica",
        title: "O dia começa pelo que realmente pede atenção.",
        description: "Agenda, pacientes e pendências aparecem no mesmo panorama, com a próxima ação à vista.",
        icon: LayoutDashboard,
        darkAsset: `${SCREENSHOT_ROOT}/dark/01-dashboard-command-center-dark.webp`,
        points: ["Resumo do dia", "Próxima sessão", "Pendências visíveis"],
        alt: "Central da Clínica NeuroNex com atendimentos do dia, próxima ação e indicadores da rotina.",
        duration: 6_200,
    },
    {
        id: "agenda",
        eyebrow: "Agenda viva",
        title: "Horários deixam de ser compromissos isolados.",
        description: "Cada sessão pode carregar comunicação, contexto e próximos passos sem espalhar a rotina.",
        icon: CalendarDays,
        darkAsset: `${SCREENSHOT_ROOT}/dark/nova remessa/9-agenda-mensal-dark.webp`,
        lightAsset: `${SCREENSHOT_ROOT}/light/9-agenda-mensal-white.webp`,
        points: ["Dia, semana e mês", "Contexto da sessão", "Integrações no fluxo"],
        alt: "Agenda mensal da NeuroNex com compromissos e organização visual da rotina clínica.",
        duration: 6_200,
    },
    {
        id: "patients",
        eyebrow: "Pacientes e prontuário",
        title: "O histórico acompanha a pessoa, não a tela.",
        description: "Lista de pacientes, registros e evolução clínica ficam próximos o suficiente para preservar a continuidade.",
        icon: UsersRound,
        darkAsset: `${SCREENSHOT_ROOT}/dark/11-pacientes-lista-dark.webp`,
        secondaryDarkAsset: `${SCREENSHOT_ROOT}/dark/12-paciente-prontuario-historico-dark.webp`,
        secondaryLabel: "Prontuário em contexto",
        points: ["Pacientes ativos", "Histórico clínico", "Evolução organizada"],
        alt: "Área de pacientes da NeuroNex com uma prévia do histórico do prontuário.",
        duration: 6_500,
    },
    {
        id: "neurobox",
        eyebrow: "NeuroView e NeuroBox",
        title: "O contexto deixa de ficar preso em uma sequência de notas.",
        description: "Relações, padrões e ferramentas clínicas podem ser acessados pelo mesmo espaço de trabalho.",
        icon: Network,
        darkAsset: `${SCREENSHOT_ROOT}/dark/17-neuroview-3d-dark.webp`,
        lightAsset: `${SCREENSHOT_ROOT}/light/17-neuroview-3d-white.webp`,
        points: ["NeuroView", "NeuroFlow", "NeuroPulse", "NeuroScan"],
        alt: "NeuroView da NeuroNex exibindo conexões entre notas e pacientes no espaço NeuroBox.",
        duration: 6_600,
    },
    {
        id: "finance",
        eyebrow: "NeuroFinance e fiscal",
        title: "A rotina financeira encontra o que aconteceu na agenda.",
        description: "Saldo, recebimentos e emissão fiscal passam a fazer parte do mesmo encadeamento de trabalho.",
        icon: WalletCards,
        darkAsset: `${SCREENSHOT_ROOT}/dark/nova remessa/08-neurofinance-conta-saldo-dark.webp`,
        lightAsset: `${SCREENSHOT_ROOT}/light/Nova remessa/08-neurofinance-conta-saldo-white.webp`,
        secondaryDarkAsset: `${SCREENSHOT_ROOT}/dark/13-fiscal-dados-nfse-dark.webp`,
        secondaryLightAsset: `${SCREENSHOT_ROOT}/light/Nova remessa/13-fiscal-dados-nfse-white.webp`,
        secondaryLabel: "Fiscal no mesmo fluxo",
        points: ["Conta e saldo", "Cobranças", "Dados para NFS-e"],
        alt: "NeuroFinance da NeuroNex com saldo da conta e uma prévia da configuração fiscal.",
        duration: 6_500,
    },
    {
        id: "synapse-text",
        eyebrow: "Synapse por texto",
        title: "Você conversa com a própria prática.",
        description: "O Synapse recupera contexto, organiza a resposta e deixa claro o que pode acontecer depois.",
        icon: MessageSquareText,
        darkAsset: `${SCREENSHOT_ROOT}/dark/15-synapse-chat-dark.webp`,
        points: ["Contexto preservado", "Respostas explicáveis", "Próxima ação preparada"],
        alt: "Conversa por texto com o Synapse dentro do painel da NeuroNex.",
        duration: 6_800,
    },
    {
        id: "synapse-voice",
        eyebrow: "Synapse por voz",
        title: "Uma frase pode movimentar o painel inteiro.",
        description: "O comando é compreendido, a tela certa é aberta e o contexto aparece antes da próxima sessão.",
        icon: AudioLines,
        darkAsset: `${SCREENSHOT_ROOT}/dark/16-synapse-voz-dark.webp`,
        secondaryDarkAsset: `${SCREENSHOT_ROOT}/dark/17-neuroview-2d-visao-de-todas-conexoes-dark.webp`,
        points: ["Comando compreendido", "Navegação executada", "Controle preservado"],
        alt: "Demonstração do Synapse por voz abrindo o NeuroView e preparando o contexto de uma paciente.",
        duration: 11_500,
        kind: "voice",
    },
];

function resolveAsset(scene: TourScene, lightTheme: boolean) {
    return lightTheme && scene.lightAsset ? scene.lightAsset : scene.darkAsset;
}

function resolveSecondaryAsset(scene: TourScene, lightTheme: boolean) {
    if (lightTheme && scene.secondaryLightAsset) return scene.secondaryLightAsset;
    return scene.secondaryDarkAsset;
}

type ProductScreenshotProps = {
    scene: TourScene;
    lightTheme: boolean;
    eager: boolean;
    reduceMotion: boolean;
};

function ProductScreenshot({ scene, lightTheme, eager, reduceMotion }: ProductScreenshotProps) {
    const Icon = scene.icon;
    const secondaryAsset = resolveSecondaryAsset(scene, lightTheme);

    return (
        <div className="relative h-full w-full overflow-hidden bg-[#050505]">
            <motion.img
                src={resolveAsset(scene, lightTheme)}
                alt={scene.alt}
                loading={eager ? "eager" : "lazy"}
                fetchPriority={eager ? "high" : "auto"}
                decoding="async"
                initial={reduceMotion ? false : { opacity: 0, scale: 1.018 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: reduceMotion ? 0 : 0.85, ease: [0.22, 1, 0.36, 1] }}
                className="h-full w-full object-cover object-top"
            />

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/5 to-black/5" />
            <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />

            {secondaryAsset ? (
                <motion.figure
                    initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: reduceMotion ? 0 : 0.3, duration: reduceMotion ? 0 : 0.8, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute right-[2.4%] top-[9%] hidden w-[36%] overflow-hidden rounded-[1.15rem] border border-white/20 bg-black/80 p-1.5 shadow-[0_28px_90px_rgba(0,0,0,0.65)] backdrop-blur-xl md:block"
                >
                    <img
                        src={secondaryAsset}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        decoding="async"
                        className="aspect-video w-full rounded-[0.8rem] object-cover object-top"
                    />
                    <figcaption className="absolute bottom-3 left-3 rounded-full border border-white/15 bg-black/70 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/75 backdrop-blur-md">
                        {scene.secondaryLabel}
                    </figcaption>
                </motion.figure>
            ) : null}

            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 p-5 sm:p-7 lg:p-9">
                <div className="max-w-[46rem] text-white">
                    <div className="mb-2 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.22em] text-white/55 sm:text-[10px]">
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        {scene.eyebrow}
                    </div>
                    <h3 className="max-w-2xl text-xl font-semibold leading-tight tracking-[-0.035em] sm:text-2xl lg:text-[2rem]">
                        {scene.title}
                    </h3>
                    <p className="mt-2 hidden max-w-2xl text-sm leading-relaxed text-white/62 sm:block lg:text-base">
                        {scene.description}
                    </p>
                </div>

                <div className="hidden max-w-[22rem] flex-wrap justify-end gap-2 lg:flex" aria-label="Recursos mostrados nesta cena">
                    {scene.points.map((point) => (
                        <span key={point} className="rounded-full border border-white/14 bg-black/42 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white/68 backdrop-blur-lg">
                            {point}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}

type VoiceActionSceneProps = {
    scene: TourScene;
    lightTheme: boolean;
    paused: boolean;
    reduceMotion: boolean;
};

const voicePhaseDelays = [1_350, 1_650, 1_650, 1_850];

function VoiceActionScene({ scene, lightTheme, paused, reduceMotion }: VoiceActionSceneProps) {
    const [phase, setPhase] = useState(reduceMotion ? 4 : 0);
    const neuroViewAsset = resolveSecondaryAsset(scene, lightTheme) ?? scene.darkAsset;

    useEffect(() => {
        if (reduceMotion) {
            setPhase(4);
            return;
        }

        if (paused || phase >= 4) return;

        const timer = window.setTimeout(() => {
            setPhase((current) => Math.min(current + 1, 4));
        }, voicePhaseDelays[phase]);

        return () => window.clearTimeout(timer);
    }, [paused, phase, reduceMotion]);

    const phaseLabel = [
        "Ouvindo o pedido",
        "Pedido compreendido",
        "Abrindo o NeuroView",
        "Relacionando o contexto",
        "Ação concluída",
    ][phase];

    return (
        <div className="relative h-full w-full overflow-hidden bg-black">
            <AnimatePresence mode="sync" initial={false}>
                <motion.img
                    key={phase >= 2 ? "neuroview" : "voice"}
                    src={phase >= 2 ? neuroViewAsset : resolveAsset(scene, lightTheme)}
                    alt={scene.alt}
                    loading="lazy"
                    decoding="async"
                    initial={reduceMotion ? false : { opacity: 0, scale: phase >= 2 ? 1.05 : 1 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.8, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-0 h-full w-full object-cover object-top"
                />
            </AnimatePresence>

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/92 via-black/5 to-black/25" />
            <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />

            <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/15 bg-black/64 px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-white/72 shadow-2xl backdrop-blur-xl sm:left-6 sm:top-6">
                {phase === 0 ? <Mic2 className="h-3.5 w-3.5" aria-hidden="true" /> : phase === 4 ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
                {phaseLabel}
            </div>

            <AnimatePresence mode="wait" initial={false}>
                {phase <= 1 ? (
                    <motion.div
                        key="transcript"
                        initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -14, scale: 0.985 }}
                        transition={{ duration: reduceMotion ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute bottom-5 left-1/2 w-[min(92%,56rem)] -translate-x-1/2 rounded-[1.4rem] border border-white/15 bg-black/78 p-4 text-white shadow-[0_30px_100px_rgba(0,0,0,0.7)] backdrop-blur-2xl sm:bottom-7 sm:p-5"
                    >
                        <div className="mb-3 flex items-center gap-3">
                            <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-black">
                                <AudioLines className="h-4 w-4" aria-hidden="true" />
                                {phase === 0 && !reduceMotion ? <span className="absolute inset-0 animate-ping rounded-full border border-white/50" /> : null}
                            </span>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/42">Comando de voz</p>
                                <p className="mt-1 text-sm font-medium leading-snug sm:text-lg">
                                    “Synapse, mostre o NeuroView da paciente Mariana e destaque o que devo revisar antes da teleconsulta.”
                                </p>
                            </div>
                        </div>
                        {phase === 1 ? (
                            <div className="flex items-center gap-2 border-t border-white/10 pt-3 text-[10px] font-bold uppercase tracking-[0.15em] text-white/58">
                                <BrainCircuit className="h-3.5 w-3.5" aria-hidden="true" />
                                Paciente identificada · sessão localizada · autorização preservada
                            </div>
                        ) : null}
                    </motion.div>
                ) : (
                    <motion.div
                        key="neuroview-context"
                        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute inset-x-4 bottom-4 flex flex-col gap-3 sm:inset-x-6 sm:bottom-6 lg:flex-row lg:items-end lg:justify-between"
                    >
                        <div className="max-w-xl rounded-[1.3rem] border border-white/15 bg-black/78 p-4 text-white shadow-2xl backdrop-blur-2xl sm:p-5">
                            <div className="flex flex-wrap items-center gap-2 text-[9px] font-black uppercase tracking-[0.16em] text-white/55">
                                <Route className="h-3.5 w-3.5" aria-hidden="true" />
                                Notas <ArrowRight className="h-3 w-3" aria-hidden="true" /> NeuroView <ArrowRight className="h-3 w-3" aria-hidden="true" /> Mariana
                            </div>
                            <h3 className="mt-3 text-lg font-semibold tracking-[-0.025em] sm:text-xl">
                                {phase === 2 ? "Abrindo o grafo e localizando a paciente." : phase === 3 ? "Relações que merecem uma revisão agora." : "Contexto preparado antes da teleconsulta."}
                            </h3>

                            {phase >= 3 ? (
                                <div className="mt-3 grid gap-2 text-[10px] text-white/68 sm:grid-cols-3">
                                    {["Sono + rotina\n4 registros", "Trabalho + ansiedade\npadrão recorrente", "Rede de apoio\nmudança recente"].map((pattern) => {
                                        const [name, detail] = pattern.split("\n");
                                        return (
                                            <div key={name} className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2">
                                                <span className="block font-semibold text-white/90">{name}</span>
                                                <span>{detail}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : null}

                            {phase === 4 ? (
                                <div className="mt-3 flex items-start gap-2 border-t border-white/10 pt-3 text-xs leading-relaxed text-white/66">
                                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-white" aria-hidden="true" />
                                    A tela foi aberta e os pontos foram destacados. O psicólogo continua no controle das decisões.
                                </div>
                            ) : null}
                        </div>

                        <motion.div
                            animate={phase >= 3 && !reduceMotion ? { scale: [1, 1.025, 1] } : undefined}
                            transition={{ duration: 1.1, repeat: phase === 3 ? 1 : 0 }}
                            className="flex items-center gap-3 self-start rounded-[1.1rem] border border-white/15 bg-white px-4 py-3 text-black shadow-[0_20px_65px_rgba(0,0,0,0.45)] lg:self-auto"
                        >
                            <span className="grid h-9 w-9 place-items-center rounded-full bg-black text-white">
                                <Clock3 className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-black/45">Próxima sessão</p>
                                <p className="text-sm font-semibold">Teleconsulta em 10 min</p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export const HeroVisual = () => {
    const { resolvedTheme } = useTheme();
    const reduceMotion = useReducedMotion() ?? false;
    const lightTheme = resolvedTheme === "light";
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userPaused, setUserPaused] = useState(false);
    const [pointerPaused, setPointerPaused] = useState(false);
    const [focusPaused, setFocusPaused] = useState(false);
    const [documentHidden, setDocumentHidden] = useState(false);

    const currentScene = tourScenes[currentIndex];
    const autoplayPaused = reduceMotion || userPaused || pointerPaused || focusPaused || documentHidden;

    const selectScene = useCallback((index: number) => {
        setCurrentIndex((index + tourScenes.length) % tourScenes.length);
    }, []);

    const previousScene = useCallback(() => selectScene(currentIndex - 1), [currentIndex, selectScene]);
    const nextScene = useCallback(() => selectScene(currentIndex + 1), [currentIndex, selectScene]);

    useEffect(() => {
        const handleVisibilityChange = () => setDocumentHidden(document.visibilityState !== "visible");
        handleVisibilityChange();
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }, []);

    useEffect(() => {
        if (autoplayPaused) return;
        const timer = window.setTimeout(nextScene, currentScene.duration);
        return () => window.clearTimeout(timer);
    }, [autoplayPaused, currentScene.duration, nextScene]);

    const handleKeyboardNavigation = (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            previousScene();
        }
        if (event.key === "ArrowRight") {
            event.preventDefault();
            nextScene();
        }
    };

    const progress = useMemo(() => `${((currentIndex + 1) / tourScenes.length) * 100}%`, [currentIndex]);

    return (
        <MotionConfig reducedMotion="user">
            <section
                aria-roledescription="carrossel"
                aria-label="Conheça a NeuroNex por dentro"
                onMouseEnter={() => setPointerPaused(true)}
                onMouseLeave={() => setPointerPaused(false)}
                onFocusCapture={() => setFocusPaused(true)}
                onBlurCapture={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusPaused(false);
                }}
                onKeyDown={handleKeyboardNavigation}
                className="mx-auto w-[min(94vw,80rem)] outline-none"
            >
                <p className="sr-only" aria-live="polite" aria-atomic="true">
                    Cena {currentIndex + 1} de {tourScenes.length}: {currentScene.eyebrow}. {currentScene.title}
                </p>

                <div className="mb-4 flex items-end justify-between gap-5 px-1 sm:mb-5">
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground/55 sm:text-[10px]">
                            A NeuroNex por dentro
                        </p>
                        <p className="mt-1 max-w-xl text-sm font-medium text-foreground/66 sm:text-base">
                            Sete partes da rotina, trabalhando como uma só.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setUserPaused((paused) => !paused)}
                            disabled={reduceMotion}
                            aria-label={reduceMotion ? "Avanço automático desativado pela preferência de redução de movimento" : userPaused ? "Retomar apresentação automática" : "Pausar apresentação automática"}
                            className="grid h-10 w-10 place-items-center rounded-full border border-border/20 bg-background/75 text-foreground transition-colors hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-45"
                        >
                            {userPaused || reduceMotion ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
                        </button>
                        <button
                            type="button"
                            onClick={previousScene}
                            aria-label="Ver cena anterior"
                            className="grid h-10 w-10 place-items-center rounded-full border border-border/20 bg-background/75 text-foreground transition-colors hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            onClick={nextScene}
                            aria-label="Ver próxima cena"
                            className="grid h-10 w-10 place-items-center rounded-full border border-border/20 bg-background/75 text-foreground transition-colors hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                    </div>
                </div>

                <div
                    id="hero-product-tour-panel"
                    role="tabpanel"
                    aria-labelledby={`hero-product-tour-tab-${currentScene.id}`}
                    tabIndex={0}
                    className="relative overflow-hidden rounded-[1.35rem] border border-border/20 bg-black shadow-[0_35px_110px_-45px_rgba(0,0,0,0.78)] outline-none focus-visible:ring-2 focus-visible:ring-ring sm:rounded-[1.8rem]"
                >
                    <div className="relative aspect-[16/8.35] min-h-[22rem] max-h-[44rem] w-full">
                        <AnimatePresence initial={false} mode="wait">
                            <motion.div
                                key={currentScene.id}
                                initial={reduceMotion ? false : { opacity: 0, scale: 0.992 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.008 }}
                                transition={{ duration: reduceMotion ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
                                className="absolute inset-0"
                            >
                                {currentScene.kind === "voice" ? (
                                    <VoiceActionScene
                                        scene={currentScene}
                                        lightTheme={lightTheme}
                                        paused={autoplayPaused}
                                        reduceMotion={reduceMotion}
                                    />
                                ) : (
                                    <ProductScreenshot
                                        scene={currentScene}
                                        lightTheme={lightTheme}
                                        eager={currentIndex === 0}
                                        reduceMotion={reduceMotion}
                                    />
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    <div className="absolute inset-x-0 top-0 z-30 h-[2px] bg-white/[0.08]" aria-hidden="true">
                        <motion.div
                            className="h-full origin-left bg-white"
                            animate={{ width: progress }}
                            transition={{ duration: reduceMotion ? 0 : 0.65, ease: [0.22, 1, 0.36, 1] }}
                        />
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2 sm:flex sm:flex-wrap sm:justify-center" role="tablist" aria-label="Cenas da apresentação">
                    {tourScenes.map((scene, index) => {
                        const Icon = scene.icon;
                        const active = index === currentIndex;
                        return (
                            <button
                                key={scene.id}
                                id={`hero-product-tour-tab-${scene.id}`}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                aria-controls="hero-product-tour-panel"
                                aria-label={`Cena ${index + 1}: ${scene.eyebrow}`}
                                onClick={() => selectScene(index)}
                                className={cn(
                                    "group flex min-h-11 items-center justify-center gap-2 rounded-full border px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-w-0 sm:px-4",
                                    active
                                        ? "border-foreground bg-foreground text-background"
                                        : "border-border/20 bg-background/55 text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                                )}
                            >
                                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span className="hidden xl:inline">{scene.eyebrow}</span>
                                <span className="xl:hidden">{index + 1}</span>
                            </button>
                        );
                    })}
                </div>

                <p className="mt-3 text-center text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground/45">
                    {reduceMotion ? "Avanço manual · redução de movimento ativa" : autoplayPaused ? "Apresentação pausada" : "Avanço automático · passe o cursor ou use os controles para pausar"}
                </p>
            </section>
        </MotionConfig>
    );
};
