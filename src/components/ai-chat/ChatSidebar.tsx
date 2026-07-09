import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Search, MoreHorizontal, Eye, EyeOff, History, X } from "lucide-react";
import { format, isToday, isYesterday, subDays, isAfter } from "date-fns";
import { ChatSession } from "@/hooks/use-ai-chat";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import type { MouseEvent } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface ChatSidebarProps {
    sessions: ChatSession[] | undefined;
    currentSessionId: string | null;
    onSelectSession: (id: string) => void;
    onCreateSession: () => void;
    onDeleteSession: (e: MouseEvent, id: string) => void;
    onClose: () => void;
}

export const ChatSidebar = ({
    sessions,
    currentSessionId,
    onSelectSession,
    onCreateSession,
    onDeleteSession,
    onClose
}: ChatSidebarProps) => {
    const [filter, setFilter] = useState("");
    const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

    const toggleReveal = (e: MouseEvent, id: string) => {
        e.stopPropagation();
        setRevealedIds((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const filteredSessions = (sessions ?? []).filter(s =>
        s.title?.toLowerCase().includes(filter.toLowerCase())
    );

    const groupedSessions = filteredSessions.reduce((acc, session) => {
        const date = new Date(session.created_at);
        let key = "Antigos";

        if (isToday(date)) key = "Hoje";
        else if (isYesterday(date)) key = "Ontem";
        else if (isAfter(date, subDays(new Date(), 7))) key = "7 Dias";
        else if (isAfter(date, subDays(new Date(), 30))) key = "30 Dias";

        if (!acc[key]) acc[key] = [];
        acc[key].push(session);
        return acc;
    }, {} as Record<string, ChatSession[]>);

    const groupOrder = ["Hoje", "Ontem", "7 Dias", "30 Dias", "Antigos"];
    const hasVisibleSessions = groupOrder.some((label) => Boolean(groupedSessions[label]?.length));

    return (
        <div className="relative flex h-full flex-col overflow-hidden bg-transparent backdrop-blur-md">

            {/* Header Area */}
            <div className="p-5 space-y-4 shrink-0 relative z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-foreground">
                        <History className="h-4 w-4 text-muted-foreground" />
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] opacity-60">Histórico</span>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="h-8 w-8 rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Fechar histórico de conversas"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex gap-2">
                    <Button
                        onClick={onCreateSession}
                        className="h-9 flex-1 rounded-xl bg-primary text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-95 motion-reduce:active:scale-100"
                        aria-label="Criar nova conversa"
                    >
                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Nova Conversa
                    </Button>
                </div>

                <div className="relative group/search">
                    <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40 transition-colors group-focus-within/search:text-foreground" />
                    <Input
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder="Pesquisar histórico..."
                        className="h-10 rounded-[14px] border-border/40 bg-muted/35 pl-10 text-[11px] font-bold uppercase tracking-widest transition-all placeholder:text-muted-foreground/35 focus:border-border/70 focus:bg-muted/55 focus:ring-0 dark:border-white/[0.075]"
                        aria-label="Pesquisar no histórico de conversas"
                    />
                </div>
            </div>

            {/* Session List */}
            <ScrollArea className="flex-1 px-3 relative z-10">
                <div className="pb-20 space-y-6">
                    {hasVisibleSessions ? groupOrder.map(label => {
                        const list = groupedSessions[label];
                        if (!list || list.length === 0) return null;

                        return (
                            <div key={label} className="animate-fade-in px-1">
                                <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-3 px-2">
                                    {label}
                                </p>
                                <div className="space-y-1">
                                    {list.map(s => {
                                        const isRevealed = revealedIds.has(s.id);
                                        return (
                                            <div
                                                key={s.id}
                                                onClick={() => onSelectSession(s.id)}
                                                onKeyDown={(event) => {
                                                    if (event.target !== event.currentTarget) return;
                                                    if (event.key === "Enter" || event.key === " ") {
                                                        event.preventDefault();
                                                        onSelectSession(s.id);
                                                    }
                                                }}
                                                role="button"
                                                tabIndex={0}
                                                aria-current={currentSessionId === s.id ? "page" : undefined}
                                                aria-label={`Abrir conversa ${s.title || "Nova Conversa"}`}
                                                className={cn(
                                                    "group/item relative flex cursor-pointer flex-col rounded-xl border p-3 pr-10 transition-[border-color,background-color,box-shadow] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                    currentSessionId === s.id
                                                        ? "border-border/55 bg-background/86 shadow-sm dark:border-white/[0.075] dark:bg-white/[0.065]"
                                                        : "border-transparent hover:bg-muted/45"
                                                )}
                                            >
                                                {/* Header Line */}
                                                <div className="mb-1 flex items-center justify-between gap-2">
                                                    <span className={cn(
                                                        "truncate text-[12px] font-bold tracking-tight transition-all duration-300",
                                                        currentSessionId === s.id ? "text-foreground" : "text-muted-foreground group-hover/item:text-foreground/80"
                                                    )}>
                                                        {s.title || "Nova Conversa"}
                                                    </span>
                                                    <span className="shrink-0 whitespace-nowrap text-[9px] text-muted-foreground/60">
                                                        {format(new Date(s.updated_at), "HH:mm")}
                                                    </span>
                                                </div>

                                                {/* Snippet / Content Preview */}
                                                <div className="relative group/privacy">
                                                    <p className={cn(
                                                        "line-clamp-1 text-[10px] font-medium leading-relaxed text-muted-foreground/70 transition-all duration-300",
                                                        !isRevealed && "select-none blur-[3px] opacity-60 grayscale"
                                                    )}>
                                                        {/* Placeholder snippet simulating content since we don't have it in the DB yet */}
                                                        Discussão clínica confidencial...
                                                    </p>

                                                    {/* Privacy Toggle Overlay */}
                                                    {!isRevealed && (
                                                        <button
                                                            type="button"
                                                            className="absolute inset-0 z-10 flex items-center justify-center opacity-0 transition-opacity group-hover/privacy:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
                                                            onClick={(e) => toggleReveal(e, s.id)}
                                                            aria-label="Mostrar prévia da conversa"
                                                        >
                                                            <span className="rounded-full bg-muted/70 p-1 backdrop-blur-md">
                                                                <Eye className="h-3 w-3 text-foreground" />
                                                            </span>
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover/item:opacity-100 group-focus-within/item:opacity-100">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-5 w-5 rounded-md hover:bg-muted"
                                                                onClick={(e) => e.stopPropagation()}
                                                                aria-label="Mais ações da conversa"
                                                            >
                                                                <MoreHorizontal className="h-3 w-3" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="border-border/40 bg-popover/95 backdrop-blur-xl">
                                                            <DropdownMenuItem
                                                                className="cursor-pointer gap-2 text-xs focus:bg-muted"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleReveal(e, s.id);
                                                                }}
                                                            >
                                                                {isRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                                                {isRevealed ? "Ocultar Preview" : "Mostrar Preview"}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                className="h-10 cursor-pointer gap-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-muted-foreground transition-colors focus:bg-muted focus:text-foreground"
                                                                onClick={(e) => onDeleteSession(e, s.id)}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" /> Excluir
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    }) : (
                        <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/45 px-6 py-10 text-center dark:border-white/[0.075]">
                            <History className="h-7 w-7 text-muted-foreground/55" />
                            <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                                {filter ? "Nenhuma conversa encontrada" : "Historico vazio"}
                            </p>
                            <p className="mt-2 max-w-[14rem] text-xs leading-relaxed text-muted-foreground/70">
                                {filter ? "Ajuste a busca para localizar outra conversa." : "Crie uma conversa para iniciar o historico do Synapse."}
                            </p>
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Footer Gradient */}
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none z-20" />
        </div>
    );
};
