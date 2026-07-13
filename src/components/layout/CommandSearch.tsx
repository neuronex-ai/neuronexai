"use client";

import * as React from "react";
import {
    Search,
    User,
    FileText,
    Calendar,
    Command,
    ArrowRight,
    Loader2,
    CheckSquare,
    Sparkles,
    StickyNote
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal, flushSync } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/SessionContextProvider";
import {
    searchSynapseWorkspace,
    type SynapseWorkspaceSearchResult,
} from "@/lib/synapse-workspace-search";

interface SearchResult {
    id: string;
    title: string;
    subtitle: string;
    type: 'patient' | 'note' | 'appointment' | 'ai' | 'reminder' | 'personal_note';
    url: string;
    date?: string;
}

const workspaceType: Record<SynapseWorkspaceSearchResult["entity_type"], SearchResult["type"]> = {
    patient: "patient",
    session_note: "note",
    appointment: "appointment",
    reminder: "reminder",
    personal_note: "personal_note",
    message: "ai",
};

const workspaceUrl = (result: SynapseWorkspaceSearchResult) => {
    switch (result.entity_type) {
        case "patient":
            return `/pacientes/${result.entity_id}`;
        case "session_note":
        case "personal_note":
            return `/notas?noteId=${result.entity_id}`;
        case "appointment":
            return `/agenda?appointmentId=${result.entity_id}`;
        case "reminder":
            return "/dashboard";
        case "message":
            return "/synapse-ai";
    }
};

const toCommandSearchResult = (result: SynapseWorkspaceSearchResult): SearchResult => ({
    id: result.entity_id,
    title: result.title,
    subtitle: result.subtitle || result.excerpt || "Resultado do Synapse",
    type: workspaceType[result.entity_type],
    url: workspaceUrl(result),
    date: result.occurred_at || undefined,
});

export const CommandSearch = ({ open, setOpen }: { open: boolean, setOpen: (open: boolean) => void }) => {
    const { user } = useAuth();
    const [query, setQuery] = React.useState("");
    const [results, setResults] = React.useState<SearchResult[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [activeIndex, setActiveIndex] = React.useState(0);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const previousOverflowRef = React.useRef<string | null>(null);
    const navigate = useNavigate();
    const location = useLocation();
    const previousLocationRef = React.useRef(`${location.pathname}${location.search}${location.hash}`);

    const restoreBodyOverflow = React.useCallback(() => {
        if (typeof document === "undefined") return;
        document.body.style.overflow = previousOverflowRef.current ?? "";
        previousOverflowRef.current = null;
    }, []);

    const resetSearchState = React.useCallback(() => {
        setQuery("");
        setResults([]);
        setActiveIndex(0);
        setLoading(false);
    }, []);

    const closeSearch = React.useCallback(() => {
        setOpen(false);
        resetSearchState();
        restoreBodyOverflow();
    }, [resetSearchState, restoreBodyOverflow, setOpen]);

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen(true);
            }
        };
        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, [setOpen]);

    React.useEffect(() => {
        if (open) {
            const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
            if (previousOverflowRef.current === null) {
                previousOverflowRef.current = document.body.style.overflow;
            }
            document.body.style.overflow = "hidden";
            return () => {
                window.clearTimeout(focusTimer);
                restoreBodyOverflow();
            };
        } else {
            resetSearchState();
            restoreBodyOverflow();
        }
    }, [open, resetSearchState, restoreBodyOverflow]);

    React.useEffect(() => {
        const currentLocation = `${location.pathname}${location.search}${location.hash}`;
        if (previousLocationRef.current !== currentLocation) {
            previousLocationRef.current = currentLocation;
            closeSearch();
        }
    }, [closeSearch, location.hash, location.pathname, location.search]);

    React.useEffect(() => {
        if (activeIndex >= results.length) setActiveIndex(0);
    }, [activeIndex, results.length]);

    React.useEffect(() => {
        if (query.length < 2) {
            setResults([]);
            return;
        }

        let cancelled = false;
        const delayDebounceFn = setTimeout(async () => {
            setLoading(true);
            try {
                if (!user?.id) {
                    setResults([]);
                    return;
                }

                const matches = await searchSynapseWorkspace(query, { limit: 24 });
                if (cancelled) return;

                const formattedResults: SearchResult[] = [];

                // 1. Ask Synapse AI Option (Always First if query exists)
                formattedResults.push({
                    id: 'ask-synapse',
                    title: `Perguntar sobre "${query}"`,
                    subtitle: 'Synapse AI Assistant',
                    type: 'ai',
                    url: `/synapse-ai?q=${encodeURIComponent(query)}`
                });

                matches.forEach((match) => formattedResults.push(toCommandSearchResult(match)));

                setResults(formattedResults);
            } catch (err) {
                console.error("Search error:", err);
                if (!cancelled) setResults([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 400);

        return () => {
            cancelled = true;
            clearTimeout(delayDebounceFn);
        };
    }, [query, user?.id]);

    const closeAndNavigate = (url: string) => {
        flushSync(() => {
            setOpen(false);
            resetSearchState();
        });
        restoreBodyOverflow();
        navigate(url);
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (results.length === 0) return;
            setActiveIndex((prev) => (prev + 1) % results.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (results.length === 0) return;
            setActiveIndex((prev) => (prev - 1 + results.length) % results.length);
        } else if (e.key === "Enter" && results[activeIndex]) {
            closeAndNavigate(results[activeIndex].url);
        } else if (e.key === "Escape") {
            closeSearch();
        }
    };

    const searchLayer = (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-[9998] flex items-start justify-center px-4 pt-[15vh] pointer-events-auto">
                    {/* Backdrop */}
                    <motion.div
                        data-synapse-target="global-search-dialog"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onMouseDown={closeSearch}
                        className="fixed inset-0 bg-background/70 backdrop-blur-md dark:bg-black/70"
                    />

                    {/* Command Container */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        className="relative z-[9999] flex w-full max-w-2xl flex-col overflow-hidden rounded-[34px] border border-border/75 bg-popover/96 text-popover-foreground shadow-[0_40px_100px_-38px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-[40px] dark:border-white/10 dark:bg-[#080809]/94 dark:shadow-[0_40px_110px_-34px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.04)]"
                        onKeyDown={onKeyDown}
                        onMouseDown={(event) => event.stopPropagation()}
                    >


                        {/* Search Input Area */}
                        <div className="relative z-10 flex items-center gap-4 border-b border-border/70 px-6 py-6 dark:border-white/10">
                            <Search className="w-5 h-5 text-muted-foreground/80" />
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Pressione ⌘K e busque qualquer informação..."
                                className="flex-1 border-none bg-transparent text-lg font-semibold text-foreground outline-none placeholder:text-muted-foreground/55 focus:ring-0"
                                autoFocus
                            />
                            <div className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted px-2.5 py-1.5 shadow-inner dark:border-white/10 dark:bg-white/[0.055]">
                                <Command className="w-3 h-3 text-muted-foreground" />
                                <span className="text-[10px] font-black text-muted-foreground">K</span>
                            </div>
                        </div>

                        {/* Results Area */}
                        <div className="max-h-[480px] overflow-y-auto custom-scrollbar p-2 relative z-10">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
                                    <Loader2 className="w-6 h-6 animate-spin text-foreground/45" strokeWidth={3} />
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Mapeando base de dados...</span>
                                </div>
                            ) : results.length > 0 ? (
                                <div className="space-y-1 p-1">
                                    {results.map((result, index) => (
                                        <motion.button
                                            key={result.id + index}
                                            layout
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            whileHover={{ scale: 1.005 }}
                                            whileTap={{ scale: 0.99 }}
                                            onMouseDown={(e) => {
                                                e.preventDefault(); // Prevent input blur
                                                e.stopPropagation();
                                                closeAndNavigate(result.url);
                                            }}
                                            onMouseEnter={() => setActiveIndex(index)}
                                            className={cn(
                                                "group relative flex w-full items-center justify-between overflow-hidden rounded-[20px] p-4 text-left transition-all duration-300",
                                                activeIndex === index
                                                    ? "translate-x-1 bg-foreground text-background shadow-[inset_0_1px_1px_rgba(255,255,255,0.18)]"
                                                    : "text-foreground hover:bg-muted/75"
                                            )}
                                        >
                                            <div className="flex items-center gap-4 relative z-10">
                                                <div className={cn(
                                                    "flex h-11 w-11 items-center justify-center rounded-2xl border transition-all duration-500 shadow-lg",
                                                    activeIndex === index
                                                        ? "scale-110 border-background/10 bg-background/12 text-background"
                                                        : "border-border/60 bg-muted text-muted-foreground"
                                                )}>
                                                    <TypeIcon type={result.type} active={activeIndex === index} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className={cn(
                                                        "text-[15px] font-bold transition-colors leading-tight",
                                                        activeIndex === index ? "text-background" : "text-foreground"
                                                    )}>
                                                        {result.title}
                                                    </span>
                                                    <span className={cn(
                                                        "text-[9px] uppercase tracking-[0.2em] font-black mt-1 transition-colors",
                                                        activeIndex === index ? "text-background/62" : "text-muted-foreground/72"
                                                    )}>
                                                        {result.subtitle}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className={cn(
                                                "flex items-center gap-2 transition-all duration-500",
                                                activeIndex === index ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
                                            )}>
                                                <span className="hidden text-[10px] font-black uppercase tracking-widest text-background/62 sm:block">Acessar</span>
                                                <ArrowRight className="w-4 h-4 text-background" />
                                            </div>
                                        </motion.button>
                                    ))}
                                </div>
                            ) : query.length >= 2 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                                    <div className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-border/65 bg-muted">
                                        <Search className="w-6 h-6 text-muted-foreground/55" strokeWidth={1.5} />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-bold text-foreground">Nenhum rastro encontrado</p>
                                        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest">Tente termos mais genéricos para "{query}"</p>
                                    </div>
                                    <button
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            closeAndNavigate(`/synapse-ai?q=${encodeURIComponent(query)}`);
                                        }}
                                        className="mt-4 rounded-full border border-primary/20 bg-primary/10 px-6 py-2 text-xs font-bold uppercase tracking-widest text-primary transition-all hover:bg-primary/15"
                                    >
                                        Perguntar ao Synapse AI
                                    </button>
                                </div>
                            ) : (
                                <div className="py-8 px-6 space-y-10">
                                    <div className="space-y-5">
                                        <div className="flex items-center gap-3">
                                            <div className="h-px flex-1 bg-border/70 dark:bg-white/10" />
                                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/70">Sugestões de Atividade</p>
                                            <div className="h-px flex-1 bg-border/70 dark:bg-white/10" />
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {[
                                                { label: 'Pacientes Ativos', icon: User },
                                                { label: 'Consultas Pendentes', icon: Calendar },
                                                { label: 'Histórico Synapse', icon: Sparkles },
                                                { label: 'Notas Recentes', icon: StickyNote }
                                            ].map(sugg => (
                                                <motion.button
                                                    key={sugg.label}
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        setQuery(sugg.label);
                                                    }}
                                                    className="group flex items-center gap-4 rounded-2xl border border-border/70 bg-card p-4 text-[13px] font-bold text-foreground transition-all hover:border-border hover:bg-muted"
                                                >
                                                    <sugg.icon className="h-4 w-4 text-muted-foreground/65 transition-colors group-hover:text-foreground" />
                                                    {sugg.label}
                                                </motion.button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between border-t border-border/70 pt-6 text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/65 select-none dark:border-white/10">
                                        <div className="flex items-center gap-6">
                                            <span className="flex items-center gap-2"><ArrowKey /> Navegar</span>
                                            <span className="flex items-center gap-2"><EnterKey /> Executar</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <motion.span
                                                animate={{ opacity: [1, 0.4, 1] }}
                                                transition={{ duration: 2, repeat: Infinity }}
                                                className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                                            />
                                            Omni-Search Ativo
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );

    if (typeof document === "undefined") return null;
    return createPortal(searchLayer, document.body);
};

const TypeIcon = ({ type, active }: { type: SearchResult['type'], active: boolean }) => {
    const size = 18;
    const props = { size, strokeWidth: active ? 2.5 : 1.5 };
    switch (type) {
        case 'patient': return <User {...props} />;
        case 'note': return <FileText {...props} />;
        case 'appointment': return <Calendar {...props} />;
        case 'ai': return <Sparkles {...props} />;
        case 'reminder': return <CheckSquare {...props} />;
        case 'personal_note': return <StickyNote {...props} />;
        default: return <FileText {...props} />;
    }
};

const ArrowKey = () => (
    <div className="flex gap-1">
        <div className="px-1.5 py-1 rounded bg-secondary/30 border border-border/20 text-[9px]">↑</div>
        <div className="px-1.5 py-1 rounded bg-secondary/30 border border-border/20 text-[9px]">↓</div>
    </div>
);

const EnterKey = () => (
    <div className="px-2 py-1 rounded bg-secondary/30 border border-border/20 text-[9px]">ENTER</div>
);
