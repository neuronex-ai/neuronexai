"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePatientTimeline } from "@/hooks/use-patient-timeline";
import { getR2DocumentDownloadUrl } from "@/lib/r2-documents-client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    Angry, BrainCircuit, CheckCircle2, ChevronDown,
    ChevronUp, Download, Frown, Laugh, Loader2, Meh, Paperclip, Pencil, Smile, Target
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { PatientStatusIcon } from "@/components/patients/PatientStatusIcon";
import { SessionAppointmentSource } from "@/components/patients/SessionAppointmentSource";

interface PatientUnifiedTimelineProps {
    patientId: string;
}

const moodConfig: Record<number, { icon: any, color: string, label: string, bg: string, border: string }> = {
    1: { icon: Angry, color: "text-zinc-600 dark:text-zinc-400", label: "Muito difícil", bg: "", border: "" },
    2: { icon: Frown, color: "text-zinc-600 dark:text-zinc-400", label: "Difícil", bg: "", border: "" },
    3: { icon: Meh, color: "text-zinc-900 dark:text-zinc-100", label: "Neutro", bg: "", border: "" },
    4: { icon: Smile, color: "text-zinc-900 dark:text-zinc-100", label: "Bem", bg: "", border: "" },
    5: { icon: Laugh, color: "text-zinc-900 dark:text-zinc-100", label: "Muito bem", bg: "", border: "" },
};

const TimelineCard = ({ children, className, innerClassName }: { children: ReactNode; className?: string; innerClassName?: string }) => (
    <article className={cn("patient-record-card overflow-hidden rounded-[28px] border", className)}>
        <div className={cn("h-full w-full", innerClassName)}>{children}</div>
    </article>
);

const ExpandableText = ({ text, className, limit = 150 }: { text: string, className?: string, limit?: number }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!text) return null;

    const shouldTruncate = text.length > limit;

    return (
        <div className="relative">
            <p className={cn(className, !isExpanded && shouldTruncate ? "line-clamp-3" : "")}>
                {text}
            </p>
            {shouldTruncate && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(!isExpanded);
                    }}
                    className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-900 dark:text-zinc-100 hover:opacity-70 mt-3 transition-all"
                >
                    {isExpanded ? (
                        <>Recolher <ChevronUp className="h-3 w-3" /></>
                    ) : (
                        <>Ler mais <ChevronDown className="h-3 w-3" /></>
                    )}
                </button>
            )}
        </div>
    );
};

export const PatientUnifiedTimeline = ({ patientId }: PatientUnifiedTimelineProps) => {
    const [expandedOriginalNoteId, setExpandedOriginalNoteId] = useState<string | null>(null);
    const {
        data: timelinePages,
        isLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = usePatientTimeline(patientId);

    const timeline = useMemo(() => {
        const items = timelinePages?.pages.flatMap((page) => page.items) ?? [];
        return items.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [timelinePages]);

    const handleDownload = useCallback(async (documentId?: string) => {
        if (!documentId) {
            toast.error("Documento sem referencia segura.");
            return;
        }
        try {
            const url = await getR2DocumentDownloadUrl({ documentId, disposition: "inline" });
            window.open(url, "_blank", "noopener,noreferrer");
        } catch (error) {
            toast.error("Erro ao abrir arquivo.");
        }
    }, []);

    if (isLoading) {
        return (
            <div className="space-y-8 py-8 pl-9">
                {[1, 2].map((i) => (
                    <div key={i} className="relative">
                        <Skeleton className="h-4 w-32 bg-zinc-100 dark:bg-zinc-800 rounded mb-4" />
                        <Skeleton className="h-36 w-full rounded-3xl bg-muted" />
                    </div>
                ))}
            </div>
        );
    }

    if (!timeline || timeline.length === 0) {
        return (
            <TimelineCard className="border-dashed py-24 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">Linha do tempo vazia</p>
            </TimelineCard>
        );
    }

    return (
        <div className="relative space-y-8 pb-24 pl-9 pr-1 pt-3">
            {/* Fine Filament Timeline Line */}
            <div className="absolute bottom-8 left-[15px] top-0 z-0 w-px bg-gradient-to-b from-transparent via-zinc-950/12 to-transparent dark:via-zinc-700/55" />

            {timeline.map((item, index) => {
                const isLatest = index === 0;
                return (
                    <div
                        key={`${item.type}-${item.id}`}
                        className="relative"
                        style={{ contentVisibility: "auto", containIntrinsicSize: "220px" }}
                    >
                        {/* Status/Type Connector Dot */}
                        <div className={cn(
                            "absolute -left-[26px] top-5 z-10 h-3.5 w-3.5 rounded-full border-2 bg-background shadow-[0_0_0_4px_rgba(255,255,255,0.45)] transition-all duration-300 dark:shadow-[0_0_0_4px_rgba(9,9,11,0.8)] motion-reduce:transition-none",
                            isLatest
                                ? "scale-110 border-zinc-950 shadow-[0_0_0_5px_rgba(24,24,27,0.08)] dark:border-zinc-500 dark:shadow-[0_0_0_5px_rgba(39,39,42,0.34)]"
                                : "border-zinc-300 dark:border-zinc-700"
                        )} />

                        {/* Date Header Segment */}
                        <div className="mb-4 flex items-center gap-4 pl-1">
                            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                                {format(item.date, "dd 'de' MMMM", { locale: ptBR })}
                            </span>
                            {isLatest && (
                                <div className="h-px w-12 bg-gradient-to-r from-border to-transparent" />
                            )}
                        </div>

                        {/* Event Card Content */}
                        <div className="group relative">
                            {item.type === 'note' && (
                                <TimelineCard
                                    className="p-6"
                                    innerClassName="relative overflow-hidden"
                                >
                                    <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-foreground/8 to-transparent dark:via-zinc-800/65" />
                                    <div className="relative z-10 mb-6 flex items-center justify-between">
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-3">
                                                <div className="h-2 w-2 animate-pulse rounded-full bg-zinc-900 shadow-[0_0_10px_rgba(24,24,27,0.2)] dark:bg-zinc-300 dark:shadow-[0_0_8px_rgba(161,161,170,0.18)] motion-reduce:animate-none" />
                                                <h4 className="text-sm font-bold tracking-tight text-foreground">
                                                    Registro de sessão
                                                </h4>
                                            </div>
                                            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                                {format(item.date, "HH:mm")} <span className="w-1.5 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800" /> {item.data.ai_summary?.sentiment || "Estável"}
                                            </p>
                                            {item.data.ai_summary_edited ? (
                                                <PatientStatusIcon
                                                    icon={Pencil}
                                                    tone="blue"
                                                    label="Resumo gerado pela NeuroNex AI e editado pelo profissional; a versão original foi preservada."
                                                />
                                            ) : null}
                                            <SessionAppointmentSource appointmentId={item.data.appointment_id} compact />
                                        </div>
                                        <BrainCircuit className="h-5 w-5 text-muted-foreground/45" />
                                    </div>

                                    {item.data.ai_summary ? (
                                        <div className="relative z-10 space-y-5">
                                            <ExpandableText
                                                text={item.data.ai_summary.summary}
                                                className="text-sm md:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium"
                                            />
                                            <div className="flex flex-wrap gap-3 pt-4">
                                                {item.data.ai_summary.topics?.slice(0, 5).map((t: string, i: number) => (
                                                    <span key={i} className="rounded-xl border border-border/50 bg-muted/55 px-3.5 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground shadow-sm">
                                                        {t}
                                                    </span>
                                                ))}
                                            </div>
                                            {item.data.ai_summary_edited && item.data.original_ai_summary ? (
                                                <div className="pt-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedOriginalNoteId((current) => current === item.id ? null : item.id)}
                                                        className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline"
                                                    >
                                                        {expandedOriginalNoteId === item.id ? "Ocultar versão original da IA" : "Ver versão original da IA"}
                                                    </button>
                                                    {expandedOriginalNoteId === item.id ? (
                                                        <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs font-medium leading-relaxed text-muted-foreground">
                                                            <p className="mb-2 text-[9px] font-black uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">
                                                                Registro original preservado
                                                            </p>
                                                            <p className="whitespace-pre-wrap">
                                                                {item.data.original_ai_summary.summary || "Versão original sem texto principal."}
                                                            </p>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : (
                                        <div className="relative z-10">
                                            <ExpandableText
                                                text={item.data.notes}
                                                className="text-sm md:text-base text-zinc-600 dark:text-zinc-400 italic font-medium leading-relaxed"
                                            />
                                        </div>
                                    )}
                                </TimelineCard>
                            )}

                            {item.type === 'goal' && (
                                <TimelineCard
                                    className="group p-6"
                                    innerClassName="flex items-center gap-5"
                                >
                                    <div className={cn(
                                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-colors duration-300",
                                        item.data.is_completed
                                            ? "border-zinc-900 bg-zinc-900 text-zinc-100 shadow-xl dark:border-zinc-600 dark:bg-zinc-200 dark:text-zinc-950"
                                            : "border-border/50 bg-muted/55 text-muted-foreground"
                                    )}>
                                        {item.data.is_completed ? <CheckCircle2 className="h-5 w-5" /> : <Target className="h-5 w-5" />}
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.35em] font-black">
                                            {item.data.is_completed ? "Meta Alcançada" : "Evolução de Objetivo"}
                                        </span>
                                        <p className={cn("text-base font-bold tracking-tight",
                                            item.data.is_completed
                                                ? "text-zinc-400 dark:text-zinc-600 line-through decoration-zinc-300 dark:decoration-zinc-700"
                                                : "text-zinc-900 dark:text-white"
                                        )}>
                                            {item.data.description}
                                        </p>
                                    </div>
                                </TimelineCard>
                            )}

                            {item.type === 'mood' && (() => {
                                const mood = moodConfig[item.data.mood_score] || moodConfig[3];
                                const Icon = mood.icon;
                                return (
                                    <TimelineCard
                                        className={cn("group relative overflow-hidden p-6", mood.bg, mood.border)}
                                        innerClassName="flex items-center gap-5"
                                    >
                                        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-zinc-950/[0.025] blur-[90px] dark:bg-white/[0.035]" />
                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border/50 bg-muted/55 shadow-sm">
                                            <Icon className={cn("h-6 w-6", mood.color)} />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <span className="text-[11px] uppercase tracking-[0.4em] font-black text-zinc-400 dark:text-zinc-600">Bem-estar Diário</span>
                                            <p className="text-base font-bold tracking-tight text-foreground">{mood.label}</p>
                                            {item.data.notes && (
                                                <p className="mt-3 line-clamp-2 rounded-xl border border-border/45 bg-background/55 px-4 py-2 text-xs font-medium italic text-muted-foreground shadow-inner">
                                                    "{item.data.notes}"
                                                </p>
                                            )}
                                        </div>
                                    </TimelineCard>
                                );
                            })()}

                            {item.type === 'document' && (
                                <TimelineCard
                                    className="group p-6"
                                    innerClassName="flex items-center justify-between"
                                >
                                    <div className="flex min-w-0 flex-1 items-center gap-5">
                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border/50 bg-muted/55 text-foreground shadow-sm">
                                            <Paperclip className="h-5 w-5" />
                                        </div>
                                        <div className="flex flex-col gap-2 min-w-0">
                                            <span className="text-[11px] text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.4em] font-black">Anexo Clínico</span>
                                            <p className="truncate pr-6 text-base font-bold tracking-tight text-foreground">
                                                {item.data.name}
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-10 w-10 rounded-xl border border-border/50 bg-muted/55 text-muted-foreground transition-colors hover:bg-foreground hover:text-background"
                                        onClick={() => handleDownload(item.data.documentId)}
                                    >
                                        <Download className="h-4 w-4" />
                                    </Button>
                                </TimelineCard>
                            )}
                        </div>
                    </div>
                );
            })}

            {hasNextPage && (
                <div className="relative z-30 flex justify-center pt-2">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={isFetchingNextPage}
                        onClick={() => fetchNextPage()}
                        className="desktop-retina-interactive h-12 rounded-2xl border-border/50 bg-background/64 px-6 text-[10px] font-black uppercase tracking-[0.18em] text-foreground shadow-sm hover:bg-muted"
                    >
                        {isFetchingNextPage ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Carregando
                            </>
                        ) : (
                            <>
                                Mais registros
                                <ChevronDown className="ml-2 h-4 w-4" />
                            </>
                        )}
                    </Button>
                </div>
            )}

            {/* End of Line Artistic Fade */}
            <div className="pointer-events-none absolute bottom-0 left-[20px] z-20 h-64 w-[10px] bg-gradient-to-t from-background to-transparent" />
        </div>
    );
};
