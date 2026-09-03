"use client";

import { useCallback, useMemo, useState } from "react";
import {
    Calendar as CalendarIcon,
    GripVertical,
    MoreVertical,
    Pencil,
    Plus,
    Search,
    Sparkles,
    Trash2,
} from "lucide-react";
import {
    CollisionDetection,
    DndContext,
    DragCancelEvent,
    DragEndEvent,
    DragOverEvent,
    DragOverlay,
    DragStartEvent,
    KeyboardSensor,
    MeasuringStrategy,
    PointerSensor,
    TouchSensor,
    closestCenter,
    pointerWithin,
    rectIntersection,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    SortableContext,
    arrayMove,
    horizontalListSortingStrategy,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Reminder } from "@/types";
import { TaskCard } from "./TaskCard";
import { TaskSidebar } from "./TaskSidebar";

interface Task {
    id: string;
    title: string;
    due_date: string;
    is_completed: boolean;
    category?: Reminder["category"] | string;
}

interface TaskBoardProps {
    tasks: Task[];
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    onToggle: (id: string, status: boolean) => void;
    onDelete: (id: string) => void;
    onCreate: (title: string, date: Date, category: Reminder["category"]) => void;
    onUpdateCategory?: (id: string, category: Reminder["category"]) => void;
    onUpdate?: (id: string, updates: Partial<Reminder>) => void;
    isListCollapsed?: boolean;
    onToggleListCollapsed: () => void;
}

type ViewType = "list" | "grid" | "kanban";
type ActiveType = "task" | "column" | null;

const DEFAULT_CATEGORIES = ["Geral", "Clínico", "Financeiro", "Pessoal", "Urgente"];

export const TaskBoard = ({
    tasks,
    searchQuery,
    setSearchQuery,
    onToggle,
    onDelete,
    onCreate,
    onUpdateCategory,
    onUpdate,
    isListCollapsed = false,
    onToggleListCollapsed,
}: TaskBoardProps) => {
    const [view, setView] = useState<ViewType>("kanban");
    const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeType, setActiveType] = useState<ActiveType>(null);
    const [overCategory, setOverCategory] = useState<string | null>(null);

    const [newTitle, setNewTitle] = useState("");
    const [newDate, setNewDate] = useState<Date | undefined>(new Date());
    const [newCategory, setNewCategory] = useState<Reminder["category"]>("Geral");

    const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
    const [columnDialogMode, setColumnDialogMode] = useState<"add" | "rename" | null>(null);
    const [columnName, setColumnName] = useState("");
    const [columnToRename, setColumnToRename] = useState<string | null>(null);
    const [columnToDelete, setColumnToDelete] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 6 },
        }),
        useSensor(TouchSensor, {
            activationConstraint: { delay: 200, tolerance: 5 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const resolveColumnId = useCallback((id: string, data?: Record<string, any> | null): string | null => {
        const dataCategory = data?.category;
        if (typeof dataCategory === "string" && categories.includes(dataCategory)) return dataCategory;
        if (categories.includes(id)) return id;
        const task = tasks.find((item) => item.id === id);
        return typeof task?.category === "string" ? task.category : null;
    }, [categories, tasks]);

    const collisionDetection: CollisionDetection = useCallback((args) => {
        if (activeType === "column") {
            const columnContainers = args.droppableContainers.filter((container) => {
                const dataType = container.data.current?.type;
                return dataType === "column" || categories.includes(String(container.id));
            });
            return closestCenter({ ...args, droppableContainers: columnContainers });
        }

        const pointerCollisions = pointerWithin(args);
        return pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
    }, [activeType, categories]);

    const resetDragState = useCallback(() => {
        setActiveId(null);
        setActiveType(null);
        setOverCategory(null);
    }, []);

    const handleDragStart = (event: DragStartEvent) => {
        const type = event.active.data.current?.type;
        setActiveId(String(event.active.id));
        setActiveType(type === "column" ? "column" : "task");
    };

    const handleDragOver = (event: DragOverEvent) => {
        if (activeType === "column" || !event.over) {
            setOverCategory(null);
            return;
        }
        setOverCategory(
            resolveColumnId(String(event.over.id), event.over.data.current as Record<string, any> | undefined)
        );
    };

    const handleDragCancel = (_event: DragCancelEvent) => {
        resetDragState();
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        const finishedType = activeType;
        resetDragState();

        if (!over) return;

        if (finishedType === "column") {
            const activeColumnId = String(active.id);
            const overColumnId = resolveColumnId(
                String(over.id),
                over.data.current as Record<string, any> | undefined
            );
            if (!overColumnId) return;

            const oldIndex = categories.indexOf(activeColumnId);
            const newIndex = categories.indexOf(overColumnId);
            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                setCategories((current) => arrayMove(current, oldIndex, newIndex));
            }
            return;
        }

        const taskId = String(active.id);
        const task = tasks.find((item) => item.id === taskId);
        const destination = resolveColumnId(
            String(over.id),
            over.data.current as Record<string, any> | undefined
        );

        if (!task || !destination || task.category === destination) return;

        // Persist only once, after a definitive drop. Crossing cards/columns while
        // dragging is intentionally visual-only, matching the Agenda interaction.
        onUpdateCategory?.(taskId, destination as Reminder["category"]);
    };

    const filteredTasks = useMemo(() => {
        const normalizedSearch = searchQuery.trim().toLocaleLowerCase("pt-BR");
        return tasks
            .filter((task) => {
                const matchesSearch = !normalizedSearch
                    || task.title.toLocaleLowerCase("pt-BR").includes(normalizedSearch);
                const matchesFilter = filter === "all"
                    ? true
                    : filter === "pending"
                        ? !task.is_completed
                        : task.is_completed;
                return matchesSearch && matchesFilter;
            })
            .sort((left, right) => new Date(left.due_date).getTime() - new Date(right.due_date).getTime());
    }, [filter, searchQuery, tasks]);

    const activeTask = useMemo(
        () => activeType === "task" ? tasks.find((task) => task.id === activeId) : undefined,
        [activeId, activeType, tasks]
    );

    const handleCreate = () => {
        if (!newTitle.trim()) {
            toast.error("O título é obrigatório.");
            return;
        }
        onCreate(newTitle.trim(), newDate || new Date(), newCategory);
        setNewTitle("");
        setNewDate(new Date());
        setIsCreateOpen(false);
    };

    const handleAddColumn = () => {
        setColumnName("");
        setColumnToRename(null);
        setColumnDialogMode("add");
    };

    const handleRenameColumn = (oldName: string) => {
        setColumnName(oldName);
        setColumnToRename(oldName);
        setColumnDialogMode("rename");
    };

    const handleSaveColumn = () => {
        const normalizedName = columnName.trim();
        if (!normalizedName) {
            toast.error("Digite um nome para a coluna.");
            return;
        }
        if (categories.some((category) => category !== columnToRename && category.toLowerCase() === normalizedName.toLowerCase())) {
            toast.error("Já existe uma coluna com esse nome.");
            return;
        }

        if (columnDialogMode === "rename" && columnToRename) {
            if (normalizedName !== columnToRename) {
                setCategories((current) => current.map((category) => category === columnToRename ? normalizedName : category));
                tasks
                    .filter((task) => task.category === columnToRename)
                    .forEach((task) => onUpdateCategory?.(task.id, normalizedName as Reminder["category"]));
            }
        } else {
            setCategories((current) => [...current, normalizedName]);
        }

        setColumnDialogMode(null);
        setColumnToRename(null);
        setColumnName("");
    };

    const confirmDeleteColumn = () => {
        if (!columnToDelete) return;
        tasks
            .filter((task) => task.category === columnToDelete)
            .forEach((task) => onUpdateCategory?.(task.id, "Geral"));
        setCategories((current) => current.filter((category) => category !== columnToDelete));
        setColumnToDelete(null);
    };

    const KanbanColumn = ({ category }: { category: string }) => {
        const columnTasks = filteredTasks.filter((task) => (task.category || "Geral") === category);
        const {
            setNodeRef,
            attributes,
            listeners,
            transform,
            transition,
            isDragging,
        } = useSortable({
            id: category,
            data: { type: "column", category },
        });
        const style = {
            transform: CSS.Translate.toString(transform),
            transition: transition || "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)",
            width: 320,
            flexShrink: 0,
        } as const;
        const isTarget = overCategory === category;

        if (isDragging) {
            return (
                <div
                    ref={setNodeRef}
                    style={style}
                    className="self-stretch rounded-[30px] border border-dashed border-zinc-200/65 bg-zinc-100/15 opacity-30 dark:border-white/[0.06] dark:bg-white/[0.008]"
                />
            );
        }

        return (
            <div
                ref={setNodeRef}
                style={style}
                className={cn(
                    "group/column relative flex self-stretch flex-col rounded-[30px] p-2 transition-[background-color,box-shadow] duration-150",
                    isTarget && "bg-zinc-50/65 ring-1 ring-zinc-200/70 dark:bg-white/[0.018] dark:ring-white/[0.08]"
                )}
            >
                <div className={cn(
                    "mb-3 flex shrink-0 items-center justify-between rounded-[22px] border border-zinc-200/55 bg-white/75 px-4 py-3.5 shadow-sm transition-colors dark:border-white/[0.07] dark:bg-white/[0.025] dark:shadow-none",
                    isTarget && "border-zinc-300 bg-white dark:border-white/[0.12] dark:bg-white/[0.045]"
                )}>
                    <div className="flex min-w-0 items-center gap-2.5">
                        <button
                            type="button"
                            {...listeners}
                            {...attributes}
                            className="-ml-1 flex h-8 w-7 touch-none cursor-grab items-center justify-center rounded-lg text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-600 active:cursor-grabbing dark:text-zinc-700 dark:hover:bg-white/[0.06] dark:hover:text-zinc-300"
                            aria-label={`Arrastar coluna ${category}`}
                        >
                            <GripVertical className="h-4 w-4" />
                        </button>
                        <span className={cn("h-2 w-2 shrink-0 rounded-full", isTarget ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-300 dark:bg-zinc-700")} />
                        <h3 className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{category}</h3>
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-bold text-zinc-500 dark:bg-black/35 dark:text-zinc-500">{columnTasks.length}</span>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                className="rounded-lg p-1.5 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-100 group-hover/column:opacity-100 dark:text-zinc-600 dark:hover:bg-white/[0.06]"
                            >
                                <MoreVertical className="h-4 w-4" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[210px] rounded-[20px] border-zinc-200 bg-white/95 p-1.5 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0A0A0A]/95">
                            <DropdownMenuItem
                                onClick={() => {
                                    setNewCategory(category as Reminder["category"]);
                                    setIsCreateOpen(true);
                                }}
                                className="cursor-pointer gap-3 rounded-xl py-2.5 text-xs font-semibold"
                            >
                                <Plus className="h-4 w-4" /> Nova tarefa
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleRenameColumn(category)} className="cursor-pointer gap-3 rounded-xl py-2.5 text-xs font-semibold">
                                <Pencil className="h-4 w-4" /> Renomear
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer gap-3 rounded-xl py-2.5 text-xs font-semibold">
                                <Sparkles className="h-4 w-4" /> Otimizar com I.A.
                            </DropdownMenuItem>
                            {category !== "Geral" && (
                                <DropdownMenuItem
                                    onClick={() => setColumnToDelete(category)}
                                    className="cursor-pointer gap-3 rounded-xl py-2.5 text-xs font-semibold text-red-500 focus:bg-red-50 focus:text-red-600 dark:focus:bg-red-500/10"
                                >
                                    <Trash2 className="h-4 w-4" /> Excluir coluna
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <SortableContext id={category} items={columnTasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
                    <div className="custom-scrollbar flex flex-1 flex-col gap-2.5 overflow-x-hidden overflow-y-auto px-1 pb-8" style={{ minHeight: 130 }}>
                        {columnTasks.map((task) => (
                            <TaskCard
                                key={task.id}
                                task={task}
                                onToggle={onToggle}
                                onDelete={onDelete}
                                onUpdate={onUpdate}
                                isKanban
                                categories={categories}
                            />
                        ))}
                        {columnTasks.length === 0 && (
                            <div className={cn(
                                "flex min-h-[132px] flex-1 items-center justify-center rounded-[24px] border border-dashed text-[9px] font-black uppercase tracking-[0.24em] transition-colors",
                                isTarget
                                    ? "border-zinc-300 bg-white/60 text-zinc-500 dark:border-white/[0.13] dark:bg-white/[0.025] dark:text-zinc-400"
                                    : "border-zinc-200/45 text-zinc-300 dark:border-white/[0.035] dark:text-zinc-700"
                            )}>
                                Solte aqui
                            </div>
                        )}
                    </div>
                </SortableContext>
            </div>
        );
    };

    return (
        <div className="relative flex h-full min-h-0 w-full min-w-0 overflow-hidden bg-transparent font-sans">
            <motion.div
                initial={false}
                animate={{ width: isListCollapsed ? 52 : 248 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="shrink-0 overflow-hidden"
            >
                <TaskSidebar
                    view={view}
                    setView={setView}
                    filter={filter}
                    setFilter={setFilter}
                    isListCollapsed={isListCollapsed}
                    onToggleCollapsed={onToggleListCollapsed}
                />
            </motion.div>

            <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <header className="flex shrink-0 items-center justify-between gap-7 px-7 pb-5 pt-7">
                    <div className="flex flex-1 items-center gap-8">
                        <div>
                            <h2 className="text-3xl font-black tracking-tighter text-white [.light_&]:text-zinc-900">Ações</h2>
                            <span className="mt-1.5 block text-[9px] font-bold uppercase tracking-[0.24em] text-zinc-500">{filteredTasks.length} registros</span>
                        </div>
                        <div className="group relative max-w-xl flex-1">
                            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 transition-colors group-focus-within:text-zinc-200 [.light_&]:group-focus-within:text-zinc-700" />
                            <Input
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Buscar ações..."
                                className="h-11 rounded-2xl border-white/[0.06] bg-white/[0.025] pl-11 text-sm text-white shadow-none focus-visible:ring-0 [.light_&]:border-zinc-200/70 [.light_&]:bg-white [.light_&]:text-zinc-900"
                            />
                        </div>
                    </div>

                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="h-11 w-11 rounded-2xl bg-white p-0 text-black shadow-sm hover:bg-zinc-100 [.light_&]:bg-zinc-900 [.light_&]:text-white [.light_&]:hover:bg-zinc-800">
                                <Plus className="h-5 w-5" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-[26px] border border-white/[0.08] bg-[#0A0A0A] p-7 shadow-2xl sm:max-w-[460px] [.light_&]:border-zinc-200/70 [.light_&]:bg-white">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-black tracking-tight text-white [.light_&]:text-zinc-900">Nova tarefa</DialogTitle>
                            </DialogHeader>
                            <div className="mt-6 space-y-5">
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">Título</Label>
                                    <Input
                                        value={newTitle}
                                        onChange={(event) => setNewTitle(event.target.value)}
                                        onKeyDown={(event) => event.key === "Enter" && handleCreate()}
                                        placeholder="Defina a próxima ação..."
                                        className="h-11 rounded-xl border-white/[0.07] bg-white/[0.035] text-white focus-visible:ring-0 [.light_&]:border-zinc-200 [.light_&]:bg-zinc-50 [.light_&]:text-zinc-900"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">Prazo</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="h-11 w-full justify-start rounded-xl border-white/[0.07] bg-white/[0.035] text-xs text-white hover:bg-white/[0.06] [.light_&]:border-zinc-200 [.light_&]:bg-zinc-50 [.light_&]:text-zinc-900">
                                                    <CalendarIcon className="mr-2 h-4 w-4 text-zinc-500" />
                                                    {newDate ? format(newDate, "dd/MM/yyyy") : "Escolher"}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent align="start" className="w-auto rounded-[20px] border-white/10 bg-zinc-950 p-2 [.light_&]:border-zinc-200 [.light_&]:bg-white">
                                                <Calendar mode="single" selected={newDate} onSelect={setNewDate} />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">Contexto</Label>
                                        <Select value={newCategory} onValueChange={(value) => setNewCategory(value as Reminder["category"])}>
                                            <SelectTrigger className="h-11 rounded-xl border-white/[0.07] bg-white/[0.035] text-xs [.light_&]:border-zinc-200 [.light_&]:bg-zinc-50">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-[18px] border-white/10 bg-zinc-950 [.light_&]:border-zinc-200 [.light_&]:bg-white">
                                                {categories.map((category) => (
                                                    <SelectItem key={category} value={category}>{category}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                            <DialogFooter className="mt-7">
                                <Button onClick={handleCreate} className="h-11 w-full rounded-xl bg-white text-sm font-bold text-black hover:bg-zinc-200 [.light_&]:bg-zinc-900 [.light_&]:text-white [.light_&]:hover:bg-black">
                                    Criar tarefa
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </header>

                <div className="relative min-h-0 flex-1 px-4 pb-4">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={collisionDetection}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragCancel={handleDragCancel}
                        onDragEnd={handleDragEnd}
                        measuring={{ droppable: { strategy: MeasuringStrategy.WhileDragging } }}
                    >
                        {filteredTasks.length === 0 ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                <h3 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">Nenhuma ação</h3>
                                <p className="mt-2 text-xs font-medium text-zinc-400 dark:text-zinc-600">Crie sua primeira tarefa para começar.</p>
                            </div>
                        ) : view === "kanban" ? (
                            <div className="custom-scrollbar absolute inset-0 overflow-auto overscroll-contain">
                                <div className="flex h-full min-w-max items-stretch gap-4 px-6 pb-6 pt-2">
                                    <SortableContext items={categories} strategy={horizontalListSortingStrategy}>
                                        {categories.map((category) => <KanbanColumn key={category} category={category} />)}
                                    </SortableContext>
                                    <button
                                        type="button"
                                        onClick={handleAddColumn}
                                        className="group flex w-[300px] shrink-0 flex-col items-center justify-center gap-3 rounded-[28px] border border-dashed border-zinc-200/50 text-zinc-400 transition-colors hover:bg-zinc-100/50 hover:text-zinc-600 dark:border-white/[0.04] dark:text-zinc-700 dark:hover:bg-white/[0.018] dark:hover:text-zinc-400"
                                    >
                                        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-current/15"><Plus className="h-5 w-5" /></span>
                                        <span className="text-[9px] font-bold uppercase tracking-[0.22em]">Nova coluna</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="custom-scrollbar absolute inset-0 overflow-y-auto overflow-x-hidden px-6 pb-14 pt-2 overscroll-contain">
                                <SortableContext items={filteredTasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
                                    <div className={cn(
                                        "grid gap-3",
                                        view === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "mx-auto max-w-5xl grid-cols-1"
                                    )}>
                                        {filteredTasks.map((task) => (
                                            <TaskCard
                                                key={task.id}
                                                task={task}
                                                onToggle={onToggle}
                                                onDelete={onDelete}
                                                onUpdate={onUpdate}
                                                categories={categories}
                                            />
                                        ))}
                                    </div>
                                </SortableContext>
                            </div>
                        )}

                        <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
                            {activeId && activeType === "task" && activeTask ? (
                                <div className="w-[300px] cursor-grabbing">
                                    <TaskCard task={activeTask} isKanban={view === "kanban"} isOverlay />
                                </div>
                            ) : activeId && activeType === "column" ? (
                                <div className="w-[320px] cursor-grabbing rounded-[28px] border border-zinc-300/60 bg-white/95 p-3 shadow-2xl dark:border-white/[0.12] dark:bg-[#171717]">
                                    <div className="flex items-center gap-3 rounded-[20px] border border-zinc-200/50 px-4 py-3 dark:border-white/[0.07]">
                                        <GripVertical className="h-4 w-4 text-zinc-400" />
                                        <span className="h-2 w-2 rounded-full bg-zinc-900 dark:bg-zinc-100" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">{activeId}</span>
                                    </div>
                                </div>
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                </div>
            </div>

            <Dialog
                open={columnDialogMode !== null}
                onOpenChange={(nextOpen) => {
                    if (!nextOpen) {
                        setColumnDialogMode(null);
                        setColumnToRename(null);
                        setColumnName("");
                    }
                }}
            >
                <DialogContent className="max-w-md rounded-[26px] border-white/[0.08] bg-zinc-950/95 p-0 text-white shadow-2xl backdrop-blur-3xl [.light_&]:border-zinc-200/80 [.light_&]:bg-white/95 [.light_&]:text-zinc-950">
                    <div className="p-6">
                        <DialogHeader className="space-y-2 text-left">
                            <DialogTitle className="text-xl font-black tracking-tight">
                                {columnDialogMode === "rename" ? "Renomear coluna" : "Nova coluna"}
                            </DialogTitle>
                            <p className="text-sm leading-relaxed text-zinc-400 [.light_&]:text-zinc-600">Use um nome curto para manter o quadro fácil de percorrer.</p>
                        </DialogHeader>
                        <Input
                            value={columnName}
                            onChange={(event) => setColumnName(event.target.value)}
                            onKeyDown={(event) => event.key === "Enter" && handleSaveColumn()}
                            autoFocus
                            placeholder="Ex.: Retornos"
                            className="mt-6 h-12 rounded-xl border-white/[0.08] bg-white/[0.045] text-white placeholder:text-zinc-600 [.light_&]:border-zinc-200 [.light_&]:bg-zinc-50 [.light_&]:text-zinc-950"
                        />
                        <DialogFooter className="mt-7 gap-2">
                            <Button variant="outline" onClick={() => setColumnDialogMode(null)} className="h-11 rounded-xl border-white/[0.08] bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white [.light_&]:border-zinc-200 [.light_&]:bg-white [.light_&]:text-zinc-700">
                                Cancelar
                            </Button>
                            <Button onClick={handleSaveColumn} className="h-11 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 [.light_&]:bg-zinc-950 [.light_&]:text-white">
                                {columnDialogMode === "rename" ? "Salvar nome" : "Criar coluna"}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!columnToDelete} onOpenChange={(nextOpen) => !nextOpen && setColumnToDelete(null)}>
                <AlertDialogContent className="max-w-md rounded-[26px] border-white/[0.08] bg-zinc-950/95 p-0 text-white shadow-2xl backdrop-blur-3xl [.light_&]:border-zinc-200/80 [.light_&]:bg-white/95 [.light_&]:text-zinc-950">
                    <div className="p-6">
                        <AlertDialogHeader className="space-y-3">
                            <AlertDialogTitle className="text-xl font-black tracking-tight">Excluir esta coluna?</AlertDialogTitle>
                            <AlertDialogDescription className="text-sm leading-relaxed text-zinc-400 [.light_&]:text-zinc-600">
                                {columnToDelete && tasks.some((task) => task.category === columnToDelete)
                                    ? "As tarefas desta coluna serão movidas para Geral."
                                    : "A coluna será removida do quadro."}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-7 gap-2">
                            <AlertDialogCancel className="h-11 rounded-xl border-white/[0.08] bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white [.light_&]:border-zinc-200 [.light_&]:bg-white [.light_&]:text-zinc-700">Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDeleteColumn} className="h-11 rounded-xl bg-red-500 text-white hover:bg-red-600">Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                    </div>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
