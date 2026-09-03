"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
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

export const TaskCard = ({
    task,
    onToggle,
    onDelete,
    onUpdate,
    isKanban = false,
    isOverlay = false,
    categories,
}: TaskCardProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: task.id,
        disabled: isOverlay,
        data: {
            type: "task",
            category: task.category || "Geral",
        },
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition: transition || "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)",
    };

    const due = new Date(task.due_date);
    const isOverdue = !task.is_completed && isPast(due) && !isToday(due);
    const dateLabel = isToday(due)
        ? "Hoje"
        : isTomorrow(due)
            ? "Amanhã"
            : format(due, "dd MMM", { locale: ptBR });

    const statusDotClass = task.is_completed
        ? "bg-emerald-500"
        : isOverdue
            ? "bg-red-500"
            : "bg-amber-400";

    const cardContent = (
        <div
            className={cn(
                "group relative rounded-[24px] border transition-[background-color,border-color,box-shadow,transform,opacity] duration-200",
                "border-zinc-200/55 bg-white/88 shadow-[0_8px_22px_-16px_rgba(0,0,0,0.16)] dark:border-white/[0.07] dark:bg-white/[0.028] dark:shadow-none",
                !isOverlay && !task.isGhost && "hover:border-zinc-300/80 hover:bg-white hover:shadow-[0_18px_36px_-28px_rgba(0,0,0,0.28)] dark:hover:border-white/[0.11] dark:hover:bg-white/[0.045]",
                isOverlay && "border-zinc-300 bg-white shadow-[0_26px_56px_-28px_rgba(0,0,0,0.38)] dark:border-white/[0.12] dark:bg-[#171717] dark:shadow-[0_28px_64px_-34px_rgba(0,0,0,0.92)]",
                task.isGhost && "border-dashed border-zinc-200 bg-transparent opacity-25 shadow-none dark:border-white/[0.06]",
                task.is_completed && "border-zinc-200/35 bg-zinc-50/55 dark:border-white/[0.04] dark:bg-white/[0.014]",
                isKanban ? "px-4 py-4" : "px-5 py-4"
            )}
        >
            <div className="relative z-10 flex items-start gap-2.5">
                {!task.isGhost && !isOverlay ? (
                    <button
                        type="button"
                        {...listeners}
                        {...attributes}
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                        }}
                        className="-ml-1 mt-0.5 flex h-8 w-6 shrink-0 touch-none cursor-grab items-center justify-center rounded-lg text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-600 active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:text-zinc-700 dark:hover:bg-white/[0.06] dark:hover:text-zinc-300"
                        aria-label={`Arrastar tarefa: ${task.title}`}
                        title="Arrastar tarefa"
                    >
                        <GripVertical className="h-4 w-4" aria-hidden="true" />
                    </button>
                ) : null}

                <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-start gap-2.5">
                        {!task.isGhost && (
                            <span
                                className={cn("mt-[6px] h-2 w-2 shrink-0 rounded-full", statusDotClass)}
                                aria-hidden="true"
                            />
                        )}
                        <h4
                            className={cn(
                                "line-clamp-2 min-w-0 flex-1 text-[14px] font-bold leading-[1.35] tracking-tight transition-colors duration-200",
                                task.is_completed
                                    ? "text-zinc-400 line-through decoration-zinc-300/45 dark:text-zinc-600"
                                    : "text-zinc-900 dark:text-zinc-100"
                            )}
                        >
                            {task.title}
                        </h4>
                    </div>

                    {!task.isGhost && (
                        <div className="mt-2 pl-[18px]">
                            <span
                                className={cn(
                                    "text-[9px] font-semibold uppercase tracking-[0.13em]",
                                    task.is_completed
                                        ? "text-emerald-600/65 dark:text-emerald-400/55"
                                        : isOverdue
                                            ? "text-red-600/70 dark:text-red-400/65"
                                            : "text-zinc-400 dark:text-zinc-600"
                                )}
                            >
                                {dateLabel}
                            </span>
                        </div>
                    )}
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
                isDragging ? "pointer-events-none opacity-20" : "opacity-100"
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
