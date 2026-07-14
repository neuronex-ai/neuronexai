import { ChevronLeft, MoreHorizontal, Share2, Trash2, Check } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PersonalNote } from "@/types";
import { RichTextEditor } from "@/components/notes/RichTextEditor";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { usePatients } from "@/hooks/use-patients";

interface MobileNoteEditorProps {
    note: PersonalNote;
    onBack: () => void;
    onUpdate: (id: string, updates: Partial<PersonalNote>) => void;
    onDelete: (id: string) => void;
}

export const MobileNoteEditor = ({ note, onBack, onUpdate, onDelete }: MobileNoteEditorProps) => {
    const [title, setTitle] = useState(note.title);
    const [content, setContent] = useState(note.content || "");
    const [isSaving, setIsSaving] = useState(false);
    const [hasSaved, setHasSaved] = useState(false);
    const activeNoteIdRef = useRef(note.id);

    // Fetch patients for mentions in editor
    const { data: patients } = usePatients();

    // Auto-save debounced
    useEffect(() => {
        if (title === note.title && content === note.content) return;

        setIsSaving(true);
        setHasSaved(false);

        const timer = setTimeout(() => {
            onUpdate(note.id, { title, content });
            setIsSaving(false);
            setHasSaved(true);
            setTimeout(() => setHasSaved(false), 2000);
        }, 1000);

        return () => clearTimeout(timer);
    }, [content, note.content, note.id, note.title, onUpdate, title]);

    // Sync initial state if note prop changes
    useEffect(() => {
        if (activeNoteIdRef.current === note.id) return;

        activeNoteIdRef.current = note.id;
        setTitle(note.title);
        setContent(note.content || "");
    }, [note.content, note.id, note.title]);

    return (
        <div className="flex flex-col h-full bg-background text-foreground overflow-hidden relative z-50">
            {/* Header */}
            <header className="px-4 pt-safe-top pt-4 pb-3 bg-background/90 backdrop-blur-2xl sticky top-0 z-20 border-b border-border/10">
                <div className="flex items-center justify-between">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1 text-white/70 font-medium text-sm px-2 py-2 -ml-2 rounded-xl active:bg-white/[0.05] transition-colors hover:text-white"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span>Voltar</span>
                    </button>

                    <div className="flex items-center gap-2">
                        {/* Save Status */}
                        <div className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-wider transition-all",
                            isSaving && "text-white/50",
                            hasSaved && "text-emerald-400/80 bg-emerald-500/10",
                            !isSaving && !hasSaved && "text-white/20"
                        )}>
                            {isSaving ? (
                                <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                                    Salvando
                                </>
                            ) : hasSaved ? (
                                <>
                                    <Check className="w-3 h-3" />
                                    Salvo
                                </>
                            ) : null}
                        </div>

                        {/* Options Menu */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="w-10 h-10 flex items-center justify-center rounded-xl text-white/50 hover:bg-white/[0.05] active:scale-95 transition-all">
                                    <MoreHorizontal className="w-5 h-5" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-[#0A0A0A] border-white/[0.06] text-white w-48 rounded-xl shadow-2xl">
                                <DropdownMenuItem className="text-sm cursor-pointer hover:bg-white/[0.03] focus:bg-white/[0.03] gap-3">
                                    <Share2 className="h-4 w-4 text-white/50" />
                                    Compartilhar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-white/[0.04]" />
                                <DropdownMenuItem
                                    className="text-sm cursor-pointer text-rose-400 focus:text-rose-300 focus:bg-rose-500/10 hover:bg-rose-500/10 gap-3"
                                    onClick={() => {
                                        onDelete(note.id);
                                        onBack();
                                    }}
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Apagar Nota
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </header>

            {/* Editor Area */}
            <div className="flex-1 overflow-y-auto px-5 pb-[100px] custom-scrollbar">
                {/* Date */}
                <div className="py-5 text-center">
                    <span className="text-[11px] text-white/25 font-medium uppercase tracking-wider">
                        {format(new Date(note.updated_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                    </span>
                </div>

                {/* Title Input */}
                <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-transparent border-none text-2xl font-bold text-white placeholder:text-white/25 focus:outline-none mb-5"
                    placeholder="Título da nota"
                />

                {/* Rich Text Editor */}
                <div className="min-h-[60vh] text-base leading-relaxed text-white/90">
                    <RichTextEditor
                        content={content}
                        onChange={setContent}
                        className="prose-invert min-h-[50vh] focus:outline-none text-[16px] leading-relaxed max-w-none"
                        patients={patients?.map(p => ({ id: p.id, name: p.name }))}
                    />
                </div>
            </div>

            {/* Bottom Bar - Only visible in Editor mode to dismiss/save explicitly if needed, but we rely on auto-save and back button */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/90 backdrop-blur-2xl border-t border-border/10 flex justify-end items-center z-20 safe-area-bottom">
                <button
                    onClick={onBack}
                    className="px-5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.06] text-white font-medium text-sm active:scale-95 transition-all"
                >
                    Concluído
                </button>
            </div>
        </div>
    );
};
