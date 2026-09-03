"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
    CheckCircle2, Clock, FileText, GripVertical
} from "lucide-react";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Reminder } from "@/types";
import { TaskDetailModal } from "./TaskDetailModal";

interface TaskCardProps {
    task: any;
    onToggle?: (id: string, status: boolean) => void;
    onDelete?: (id: string) => void;
    onUpdate?: (id: string, updates: Partial<Reminder>) => void;
    isKanban?: boolean;
    isOverlay?: boolean;
    categories?: string[];
}

export const TaskCard = ({ task, onToggle, onDelete, onUpdate, isKanban = false, isOverlay = false, categories }: TaskCardProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: task.id, disabled: isOverlay });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition: transition || "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)",
    };

    const isOverdue = !task.is_completed && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
    const due = new Date(task.due_date);

    const cardContent = (
        <div
            className={cn(
                "group relative rounded-[28px] border transition-[background-color,border-color,box-shadow,transform,opacity] duration-200",
                "border-zinc-200/55 bg-white/88 shadow-[0_8px_20px_-10px_rgba(0,0,0,0.08)] dark:border-white/[0.07] dark:bg-white/[0.03] dark:shadow-none",
                !isOverlay && !task.isGhost && "hover:border-zinc-300 hover:bg-white hover:shadow-[0_18px_38px_-24px_rgba(0,0,0,0.2)] dark:hover:border-white/[0.11] dark:hover:bg-white/[0.045]",
                isOverlay && [
                    "border-zinc-300 bg-white shadow-[0_24px_54px_-28px_rgba(0,0,0,0.34)]",
                    "dark:border-white/[0.12] dark:bg-[#171717] dark:shadow-[0_28px_64px_-34px_rgba(0,0,0,0.92)]"
                ],
                task.isGhost && "border-dashed border-zinc-200 bg-transparent opacity-25 shadow-none grayscale dark:border-white/[0.06]",
                task.is_completed && "border-zinc-200/35 bg-zinc-50/55 opacity-55 grayscale-[0.35] dark:border-white/[0.04] dark:bg-white/[0.012]",
                isKanban ? "px-5 py-5" : "px-5 py-4"
            )}
        >
            {!task.isGhost && (
                <div className={cn(
                    "absolute right-5 top-5",
                    task.is_completed ? "opacity-30" : "opacity-100"
                )}>
                    <div className={cn(
                        "h-2 w-2 rounded-full transition-colors duration-200",
                        task.is_completed ? "bg-zinc-300 dark:bg-zinc-800" :
                            isOverdue ? "bg-red-500" :
                                isToday(due) ? "bg-zinc-900 dark:bg-zinc-200" :
                                    "bg-zinc-400 dark:bg-zinc-700"
                    )} />
                </div>
            )}

            <div className="relative z-10 flex items-start gap-3.5">
                {!task.isGhost && !isOverlay ? (
                    <button
                        type="button"
                        {...listeners}
                        {...attributes}
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                        }}
                        className="mt-0.5 flex h-9 w-7 shrink-0 touch-none cursor-grab items-center justify-center rounded-xl text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-600 active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:text-zinc-700 dark:hover:bg-white/[0.06] dark:hover:text-zinc-300"
                        aria-label={`Arrastar tarefa: ${task.title}`}
                        title="Arrastar tarefa"
                    >
                        <GripVertical className="h-4 w-4" aria-hidden="true" />
                    </button>
                ) : null}

                <div className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border transition-colors duration-200",
                    task.is_completed
                        ? "border-zinc-200/50 bg-zinc-100 text-zinc-400 dark:border-white/[0.05] dark:bg-zinc-900/50"
                        : "border-zinc-200/60 bg-white text-zinc-900 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.035] dark:text-zinc-100"
                )}>
                    {task.is_completed
                        ? <CheckCircle2 className="h-[18px] w-[18px]" />
                        : <FileText className="h-[18px] w-[18px]" />
                    }
                </div>

                <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                    <h4 className={cn(
                        "line-clamp-2 pr-3 text-[15px] font-bold leading-snug tracking-tight transition-colors duration-200",
                        task.is_completed
                            ? "text-zinc-400 line-through decoration-zinc-300/40 dark:text-zinc-600"
                            : "text-zinc-900 dark:text-zinc-100"
                    )}>
                        {task.title}
                    </h4>

                    <div className="flex items-center gap-2.5">
                        <div className={cn(
                            "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em]",
                            isOverdue ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400" :
                                isToday(due) ? "bg-zinc-100 text-zinc-900 dark:bg-white/[0.07] dark:text-zinc-200" :
                                    "bg-zinc-50 text-zinc-400 dark:bg-black/25 dark:text-zinc-500"
                        )}>
                            <Clock className="h-3 w-3 shrink-0" />
                            <span>
                                {isToday(due) ? "Hoje" : isTomorrow(due) ? "Amanhã" : format(due, "dd MMM", { locale: ptBR })}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    if (isOverlay) return cardContent;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "relative outline-none",
                isDragging ? "pointer-events-none opacity-25" : "opacity-100"
            )}
        >
            <TaskDetailModal
                task={task}
                onToggle={onToggle}
                onDelete={onDelete}
                onUpdate={onUpdate}
                categories={categories}
            >
                <div className="w-full cursor-pointer focus:outline-none">
                    {cardContent}
                </div>
            </TaskDetailModal>
        </div>
    );
};