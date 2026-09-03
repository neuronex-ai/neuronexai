"use client";

import { useEffect, useMemo, useState } from "react";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    Calendar as CalendarIcon,
    Check,
    Pencil,
    RotateCcw,
    Save,
    Tag,
    Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveModal } from "@/components/ui/ResponsiveModal";
import { cn } from "@/lib/utils";
import { Reminder } from "@/types";

interface TaskDetailModalProps {
    children: React.ReactNode;
    task: any;
    onToggle?: (id: string, status: boolean) => void;
    onDelete?: (id: string) => void;
    onUpdate?: (id: string, updates: Partial<Reminder>) => void;
    categories?: string[];
}

export const TaskDetailModal = ({
    children,
    task,
    onToggle,
    onDelete,
    onUpdate,
    categories = ["Geral", "Clínico", "Financeiro", "Pessoal", "Urgente"],
}: TaskDetailModalProps) => {
    const [open, setOpen] = useState(false);
    const [editedTitle, setEditedTitle] = useState(task.title || "");
    const [editedDate, setEditedDate] = useState<Date>(new Date(task.due_date));
    const [editedCategory, setEditedCategory] = useState(task.category || "Geral");
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        if (!open) return;
        setEditedTitle(task.title || "");
        setEditedDate(new Date(task.due_date));
        setEditedCategory(task.category || "Geral");
        setIsEditingTitle(false);
        setConfirmDelete(false);
    }, [open, task.id, task.title, task.due_date, task.category]);

    const due = new Date(task.due_date);
    const isOverdue = !task.is_completed && isPast(due) && !isToday(due);

    const status = useMemo(() => {
        if (task.is_completed) {
            return {
                label: "Concluída",
                dot: "bg-emerald-500",
                text: "text-emerald-700 dark:text-emerald-400",
                surface: "bg-emerald-50/80 border-emerald-200/70 dark:bg-emerald-500/[0.07] dark:border-emerald-500/15",
            };
        }
        if (isOverdue) {
            return {
                label: "Atrasada",
                dot: "bg-red-500",
                text: "text-red-700 dark:text-red-400",
                surface: "bg-red-50/80 border-red-200/70 dark:bg-red-500/[0.07] dark:border-red-500/15",
            };
        }
        return {
            label: "Pendente",
            dot: "bg-amber-400",
            text: "text-amber-700 dark:text-amber-300",
            surface: "bg-amber-50/75 border-amber-200/70 dark:bg-amber-400/[0.06] dark:border-amber-400/15",
        };
    }, [isOverdue, task.is_completed]);

    const isDirty = useMemo(() => {
        const originalDate = new Date(task.due_date).getTime();
        return editedTitle.trim() !== String(task.title || "").trim()
            || editedDate.getTime() !== originalDate
            || editedCategory !== (task.category || "Geral");
    }, [editedCategory, editedDate, editedTitle, task.category, task.due_date, task.title]);

    const handleSave = () => {
        const cleanTitle = editedTitle.trim();
        if (!cleanTitle) return;
        onUpdate?.(task.id, {
            title: cleanTitle,
            due_date: editedDate.toISOString(),
            category: editedCategory as Reminder["category"],
        });
        setIsEditingTitle(false);
    };

    const handleToggle = () => {
        onToggle?.(task.id, !task.is_completed);
    };

    const handleDelete = () => {
        onDelete?.(task.id);
        setOpen(false);
    };

    return (
        <ResponsiveModal
            open={open}
            onOpenChange={setOpen}
            trigger={children}
            className="sm:max-w-[540px] overflow-hidden rounded-[30px] border border-zinc-200/70 bg-white/98 p-0 text-zinc-950 shadow-[0_34px_90px_-38px_rgba(0,0,0,0.42)] ring-1 ring-black/[0.025] backdrop-blur-3xl dark:border-white/[0.08] dark:bg-[#090909]/98 dark:text-white dark:shadow-[0_38px_96px_-40px_rgba(0,0,0,0.9)] dark:ring-white/[0.025]"
        >
            <div className="relative max-h-[78vh] overflow-y-auto p-6 custom-scrollbar sm:p-7">
                <div className="pointer-events-none absolute inset-0 notes-retina-texture opacity-[0.12] dark:opacity-[0.16]" />

                <div className="relative z-10 space-y-6">
                    <header className="flex items-start justify-between gap-4 pr-8">
                        <div className="min-w-0 flex-1">
                            <div className="mb-3 flex items-center gap-2.5">
                                <span className={cn("h-2 w-2 shrink-0 rounded-full", status.dot)} />
                                <span className={cn("text-[9px] font-black uppercase tracking-[0.18em]", status.text)}>
                                    {status.label}
                                </span>
                                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-600">
                                    {format(due, "dd MMM yyyy", { locale: ptBR })}
                                </span>
                            </div>

                            <div className="flex items-start gap-2">
                                {isEditingTitle ? (
                                    <Input
                                        autoFocus
                                        value={editedTitle}
                                        onChange={(event) => setEditedTitle(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") handleSave();
                                            if (event.key === "Escape") {
                                                setEditedTitle(task.title || "");
                                                setIsEditingTitle(false);
                                            }
                                        }}
                                        className="h-11 rounded-xl border-zinc-200/80 bg-zinc-50 text-lg font-bold tracking-tight shadow-none focus-visible:ring-1 focus-visible:ring-zinc-300 dark:border-white/[0.08] dark:bg-white/[0.035] dark:focus-visible:ring-white/15"
                                    />
                                ) : (
                                    <h3 className={cn(
                                        "min-w-0 flex-1 text-[22px] font-black leading-tight tracking-[-0.035em]",
                                        task.is_completed && "text-zinc-400 line-through decoration-zinc-300/50 dark:text-zinc-600"
                                    )}>
                                        {task.title}
                                    </h3>
                                )}

                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setIsEditingTitle((current) => !current)}
                                    className="h-9 w-9 shrink-0 rounded-xl text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-600 dark:hover:bg-white/[0.06] dark:hover:text-white"
                                    aria-label="Editar título"
                                >
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </header>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    className="group flex min-h-[76px] items-center gap-3 rounded-[20px] border border-zinc-200/65 bg-zinc-50/65 px-4 text-left transition-colors hover:bg-zinc-100/80 dark:border-white/[0.065] dark:bg-white/[0.025] dark:hover:bg-white/[0.045]"
                                >
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200/60 bg-white text-zinc-500 shadow-sm dark:border-white/[0.07] dark:bg-black/30 dark:text-zinc-400 dark:shadow-none">
                                        <CalendarIcon className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="block text-[8px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-600">Prazo</span>
                                        <span className="mt-1 block text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
                                            {format(editedDate, "dd 'de' MMM", { locale: ptBR })}
                                        </span>
                                    </div>
                                </button>
                            </PopoverTrigger>
                            <PopoverContent
                                align="start"
                                className="w-auto rounded-[22px] border-zinc-200/80 bg-white p-2 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.32)] dark:border-white/10 dark:bg-zinc-950"
                            >
                                <Calendar mode="single" selected={editedDate} onSelect={(date) => date && setEditedDate(date)} />
                            </PopoverContent>
                        </Popover>

                        <Select value={editedCategory} onValueChange={setEditedCategory}>
                            <SelectTrigger className="min-h-[76px] rounded-[20px] border-zinc-200/65 bg-zinc-50/65 px-4 shadow-none transition-colors hover:bg-zinc-100/80 focus:ring-0 dark:border-white/[0.065] dark:bg-white/[0.025] dark:hover:bg-white/[0.045]">
                                <div className="flex items-center gap-3 text-left">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200/60 bg-white text-zinc-500 shadow-sm dark:border-white/[0.07] dark:bg-black/30 dark:text-zinc-400 dark:shadow-none">
                                        <Tag className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="block text-[8px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-600">Contexto</span>
                                        <SelectValue />
                                    </div>
                                </div>
                            </SelectTrigger>
                            <SelectContent className="rounded-[20px] border-zinc-200 bg-white p-1.5 dark:border-white/10 dark:bg-zinc-950">
                                {categories.map((category) => (
                                    <SelectItem key={category} value={category} className="rounded-xl py-2.5 text-sm font-semibold">
                                        {category}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <button
                        type="button"
                        onClick={handleToggle}
                        className={cn(
                            "flex w-full items-center justify-between rounded-[18px] border px-4 py-3.5 text-left transition-colors",
                            status.surface
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <span className={cn("h-2 w-2 rounded-full", status.dot)} />
                            <div>
                                <span className="block text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Status</span>
                                <span className={cn("mt-0.5 block text-[12px] font-bold", status.text)}>{status.label}</span>
                            </div>
                        </div>
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/70 text-zinc-700 shadow-sm dark:bg-black/25 dark:text-zinc-200 dark:shadow-none">
                            {task.is_completed ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                        </span>
                    </button>

                    {confirmDelete ? (
                        <div className="rounded-[20px] border border-red-200/70 bg-red-50/70 p-4 dark:border-red-500/15 dark:bg-red-500/[0.055]">
                            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Excluir esta tarefa?</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-500">Esta ação não poderá ser desfeita.</p>
                            <div className="mt-4 flex gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setConfirmDelete(false)}
                                    className="h-9 flex-1 rounded-xl text-xs font-semibold"
                                >
                                    Manter
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleDelete}
                                    className="h-9 flex-1 rounded-xl bg-red-600 text-xs font-bold text-white hover:bg-red-700"
                                >
                                    Excluir
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <footer className="flex items-center justify-between gap-3 border-t border-zinc-200/55 pt-4 dark:border-white/[0.06]">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmDelete(true)}
                                className="h-10 rounded-xl px-3 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:text-zinc-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                            </Button>

                            <div className="flex items-center gap-2">
                                {isDirty && (
                                    <Button
                                        type="button"
                                        onClick={handleSave}
                                        disabled={!editedTitle.trim()}
                                        className="h-10 rounded-xl bg-zinc-900 px-4 text-xs font-bold text-white hover:bg-black dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                                    >
                                        <Save className="mr-2 h-4 w-4" />
                                        Salvar
                                    </Button>
                                )}
                                <Button
                                    type="button"
                                    onClick={handleToggle}
                                    className={cn(
                                        "h-10 rounded-xl px-4 text-xs font-bold",
                                        task.is_completed
                                            ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-white/[0.06] dark:text-zinc-300 dark:hover:bg-white/[0.1]"
                                            : "bg-zinc-900 text-white hover:bg-black dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                                    )}
                                >
                                    {task.is_completed ? <RotateCcw className="mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}
                                    {task.is_completed ? "Reabrir" : "Concluir"}
                                </Button>
                            </div>
                        </footer>
                    )}
                </div>
            </div>
        </ResponsiveModal>
    );
};
