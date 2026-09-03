"use client";

import { useState, useMemo, useCallback } from "react";
import {
    Search, Plus, Sparkles, Pencil, Trash2,
    Calendar as CalendarIcon, MoreVertical, GripVertical
} from "lucide-react";
import {
    DndContext,
    DragOverlay,
    closestCorners,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
    DragOverEvent,
    MeasuringStrategy,
    CollisionDetection
} from "@dnd-kit/core";
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    horizontalListSortingStrategy,
    useSortable,
    arrayMove
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Reminder } from "@/types";
import { TaskSidebar } from "./TaskSidebar";
import { TaskCard } from "./TaskCard";

interface Task {
    id: string;
    title: string;
    due_date: string;
    is_completed: boolean;
    category?: Reminder['category'];
}

interface TaskBoardProps {
    tasks: Task[];
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    onToggle: (id: string, status: boolean) => void;
    onDelete: (id: string) => void;
    onCreate: (title: string, date: Date, category: Reminder['category']) => void;
    onUpdateCategory?: (id: string, category: Reminder['category']) => void;
    onUpdate?: (id: string, updates: Partial<Reminder>) => void;
    isListCollapsed?: boolean;
    onToggleListCollapsed: () => void;
}

type ViewType = 'list' | 'grid' | 'kanban';

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
    const [view, setView] = useState<ViewType>('kanban');
    const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeType, setActiveType] = useState<'task' | 'column' | null>(null);
    const [overCategory, setOverCategory] = useState<string | null>(null);

    const [newTitle, setNewTitle] = useState("");
    const [newDate, setNewDate] = useState<Date | undefined>(new Date());
    const [newCategory, setNewCategory] = useState<Reminder['category']>("Geral");
    const [columnDialogMode, setColumnDialogMode] = useState<'add' | 'rename' | null>(null);
    const [columnName, setColumnName] = useState("");
    const [columnToRename, setColumnToRename] = useState<string | null>(null);
    const [columnToDelete, setColumnToDelete] = useState<string | null>(null);

    const [categories, setCategories] = useState<string[]>(["Geral", "Clínico", "Financeiro", "Pessoal", "Urgente"]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const resolveColumnId = useCallback((id: string): string | null => {
        if (categories.includes(id)) return id;
        const task = tasks.find(t => t.id === id);
        return task?.category || null;
    }, [categories, tasks]);

    const customCollisionDetection: CollisionDetection = useCallback((args) => {
        if (activeType === 'column') {
            const columnRects = args.droppableContainers.filter(
                container => categories.includes(container.id as string)
            );
            return closestCenter({
                ...args,
                droppableContainers: columnRects,
            });
        }
        return closestCorners(args);
    }, [activeType, categories]);

    const handleCreate = () => {
        if (!newTitle.trim()) {
            toast.error("O título é obrigatório.");
            return;
        }
        onCreate(newTitle, newDate || new Date(), newCategory as any);
        setNewTitle("");
        setNewDate(new Date());
        setIsCreateOpen(false);
    };

    const handleAddColumn = () => {
        setColumnName("");
        setColumnToRename(null);
        setColumnDialogMode('add');
    };

    const handleRenameColumn = (oldName: string) => {
        setColumnName(oldName);
        setColumnToRename(oldName);
        setColumnDialogMode('rename');
    };

    const handleDeleteColumn = (name: string) => {
        setColumnToDelete(name);
    };

    const handleSaveColumn = () => {
        const normalizedName = columnName.trim();
        if (!normalizedName) {
            toast.error("Digite um nome para a coluna.");
            return;
        }
        if (categories.some(category => category !== columnToRename && category.toLowerCase() === normalizedName.toLowerCase())) {
            toast.error("Já existe uma coluna com esse nome.");
            return;
        }

        if (columnDialogMode === 'rename' && columnToRename) {
            if (normalizedName !== columnToRename) {
                setCategories(categories.map(category => category === columnToRename ? normalizedName : category));
                tasks
                    .filter(task => task.category === columnToRename)
                    .forEach(task => onUpdateCategory?.(task.id, normalizedName as any));
                toast.success(`Coluna renomeada para "${normalizedName}".`);
            }
        } else {
            setCategories([...categories, normalizedName]);
            toast.success(`Coluna "${normalizedName}" adicionada.`);
        }

        setColumnDialogMode(null);
        setColumnToRename(null);
        setColumnName("");
    };

    const confirmDeleteColumn = () => {
        if (!columnToDelete) return;
        const name = columnToDelete;
        const tasksInColumn = tasks.filter(t => t.category === name);
        tasksInColumn.forEach(t => onUpdateCategory?.(t.id, "Geral" as any));
        setCategories(categories.filter(c => c !== name));
        setColumnToDelete(null);
        toast.success(`Coluna "${name}" excluída.`);
    };

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id as string);
        setActiveType(categories.includes(active.id as string) ? 'column' : 'task');
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { over } = event;
        if (!over || activeType === 'column') {
            setOverCategory(null);
            return;
        }

        // Drag-over is visual only. Persisting here used to issue mutations on
        // every crossed card/column and caused visible re-renders while moving.
        setOverCategory(resolveColumnId(over.id as string));
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        const finishedType = activeType;

        setActiveId(null);
        setActiveType(null);
        setOverCategory(null);

        if (!over) return;

        if (finishedType === 'column') {
            const activeColumnId = active.id as string;
            let overColumnId = over.id as string;
            if (!categories.includes(overColumnId)) {
                const resolved = resolveColumnId(overColumnId);
                if (resolved) overColumnId = resolved;
            }
            const oldIndex = categories.indexOf(activeColumnId);
            const newIndex = categories.indexOf(overColumnId);
            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                setCategories(arrayMove(categories, oldIndex, newIndex));
                toast.success("Ordem das colunas atualizada");
            }
            return;
        }

        if (finishedType === 'task') {
            const taskId = active.id as string;
            const task = tasks.find(item => item.id === taskId);
            const destination = resolveColumnId(over.id as string);
            if (task && destination && task.category !== destination) {
                // One write, only after the user has actually completed the drop.
                onUpdateCategory?.(taskId, destination as Reminder['category']);
            }
        }
    };

    const filteredTasks = useMemo(() => {
        return tasks.filter(t => {
            const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesFilter = filter === 'all' ? true : filter === 'pending' ? !t.is_completed : t.is_completed;
            return matchesSearch && matchesFilter;
        }).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    }, [tasks, searchQuery, filter]);

    const activeTask = useMemo(() => activeType === 'task' ? tasks.find(t => t.id === activeId) : null, [activeId, activeType, tasks]);

    const KanbanColumn = ({ category }: { category: string }) => {
        const columnTasks = filteredTasks.filter(t => t.category === category);
        const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: category, data: { type: 'column' } });
        const style = {
            transform: CSS.Translate.toString(transform),
            transition: transition || "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)"
        };
        const isTarget = overCategory === category;

        if (isDragging) {
            return (
                <div
                    ref={setNodeRef}
                    style={{ ...style, width: 310, flexShrink: 0 }}
                    className="self-stretch rounded-[32px] border border-dashed border-zinc-200/60 bg-zinc-100/10 opacity-25 dark:border-white/[0.05] dark:bg-white/[0.005]"
                />
            );
        }

        return (
            <div
                ref={setNodeRef}
                style={{ ...style, width: 320, flexShrink: 0 }}
                className={cn(
                    "group/column relative flex self-stretch flex-col rounded-[32px] p-2 transition-[background-color,border-color] duration-200",
                    isTarget
                        ? "bg-zinc-50/55 ring-1 ring-zinc-200/60 dark:bg-white/[0.018] dark:ring-white/[0.07]"
                        : "bg-transparent"
                )}
            >
                <div className={cn(
                    "mb-4 flex shrink-0 items-center justify-between rounded-[24px] border border-zinc-200/55 bg-white/72 px-5 py-4 shadow-sm transition-[background-color,border-color] duration-200 dark:border-white/[0.07] dark:bg-white/[0.025]",
                    isTarget
                        ? "border-zinc-300 bg-white dark:border-white/[0.11] dark:bg-white/[0.045]"
                        : "hover:bg-white dark:hover:bg-white/[0.04]"
                )}>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            {...listeners}
                            {...attributes}
                            className="-ml-1.5 flex h-9 w-8 touch-none cursor-grab items-center justify-center rounded-xl text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-600 active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:text-zinc-700 dark:hover:bg-white/[0.06] dark:hover:text-zinc-300"
                            aria-label={`Arrastar coluna ${category}`}
                        >
                            <GripVertical className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <div className={cn("h-2 w-2 rounded-full", isTarget ? "bg-zinc-900 dark:bg-zinc-200" : "bg-zinc-200 dark:bg-zinc-800")} />
                        <h3 className={cn("text-[11px] font-black uppercase tracking-[0.2em]", isTarget ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500")}>{category}</h3>
                        <span className="rounded-full border border-black/[0.05] bg-zinc-100/80 px-2.5 py-0.5 text-[10px] font-black text-zinc-500 dark:border-black/70 dark:bg-black/35 dark:text-zinc-400">{columnTasks.length}</span>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button type="button" className="rounded-xl p-1.5 text-zinc-400 opacity-0 transition-[opacity,color,background-color] hover:bg-zinc-100 group-hover/column:opacity-100 dark:text-zinc-600 dark:hover:bg-white/[0.06]">
                                <MoreVertical className="h-4 w-4" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[220px] rounded-[24px] border-zinc-200 bg-white/95 p-2 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.25)] backdrop-blur-xl dark:border-white/10 dark:bg-[#0A0A0A]/95">
                            <DropdownMenuItem onClick={() => { setNewCategory(category as any); setIsCreateOpen(true); }} className="cursor-pointer gap-3 rounded-xl py-3 text-[11px] font-bold uppercase tracking-wider transition-all focus:bg-zinc-100 dark:focus:bg-white/10"><Plus className="h-4 w-4" /> Nova Ação</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleRenameColumn(category)} className="cursor-pointer gap-3 rounded-xl py-3 text-[11px] font-bold uppercase tracking-wider transition-all focus:bg-zinc-100 dark:focus:bg-white/10"><Pencil className="h-4 w-4" /> Renomear</DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer gap-3 rounded-xl py-3 text-[11px] font-bold uppercase tracking-wider transition-all focus:bg-zinc-100 dark:focus:bg-white/10"><Sparkles className="h-4 w-4" /> Otimizar com I.A.</DropdownMenuItem>
                            {category !== 'Geral' && (
                                <DropdownMenuItem onClick={() => handleDeleteColumn(category)} className="cursor-pointer gap-3 rounded-xl py-3 text-[11px] font-bold uppercase tracking-wider text-red-500 transition-all hover:text-red-600 focus:bg-red-50 dark:focus:bg-red-500/10"><Trash2 className="h-4 w-4" /> Excluir Coluna</DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <SortableContext id={category} items={columnTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    <div className="custom-scrollbar flex flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto px-1 pb-10" style={{ minHeight: 120 }}>
                        {columnTasks.map(task => (
                            <TaskCard key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} onUpdate={onUpdate} isKanban categories={categories} />
                        ))}
                        {columnTasks.length === 0 && (
                            <div className={cn(
                                "flex flex-col items-center justify-center rounded-[28px] border border-dashed py-16 transition-[border-color,background-color,opacity] duration-200",
                                isTarget ? "border-zinc-300 bg-white/5 dark:border-white/[0.12] dark:bg-white/[0.01]" : "border-zinc-200/30 opacity-25 dark:border-white/[0.025]"
                            )}>
                                <div className={cn(
                                    "mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200 shadow-sm transition-colors duration-200 dark:border-white/[0.06]",
                                    isTarget ? "bg-white dark:bg-white/[0.06]" : "bg-transparent"
                                )}>
                                    <Plus className={cn("h-6 w-6", isTarget ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400")} />
                                </div>
                                <span className={cn("text-[10px] font-black uppercase tracking-[0.35em]", isTarget ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400")}>Vazio</span>
                            </div>
                        )}
                    </div>
                </SortableContext>
            </div>
        );
    };

    return (
        <div
            className="relative bg-transparent font-sans selection:bg-white selection:text-black [.light_&]:selection:bg-zinc-900 [.light_&]:selection:text-white"
            style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden', minHeight: 0, minWidth: 0 }}
        >
            <motion.div
                initial={false}
                animate={{ width: isListCollapsed ? 52 : 248 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                style={{ flexShrink: 0, overflow: 'hidden' }}
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

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden', position: 'relative', zIndex: 10 }}>
                <header className="flex shrink-0 items-center justify-between gap-7 px-7 pb-5 pt-7">
                    <div className="flex flex-1 items-center gap-8">
                        <div>
                            <h2 className="text-3xl font-black tracking-tighter text-white [.light_&]:text-zinc-900">Ações</h2>
                            <div className="mt-1.5 flex items-center gap-3">
                                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-600">{filteredTasks.length} registros</span>
                            </div>
                        </div>
                        <div className="group relative max-w-xl flex-1">
                            <Search className="absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-zinc-900 dark:text-zinc-600 dark:group-focus-within:text-white" />
                            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar ações..." className="h-12 rounded-2xl border-white/[0.06] bg-white/[0.03] pl-12 text-sm font-medium text-white shadow-sm outline-none ring-0 transition-colors focus:border-white/15 focus-visible:ring-0 [.light_&]:border-zinc-200/60 [.light_&]:bg-white [.light_&]:text-zinc-900 [.light_&]:focus:border-zinc-300" />
                        </div>
                    </div>
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild><Button className="h-12 w-12 rounded-2xl bg-white text-black shadow-sm transition-transform duration-200 hover:scale-[1.03] hover:bg-zinc-100 active:scale-[0.98] [.light_&]:bg-zinc-900 [.light_&]:text-white [.light_&]:hover:bg-zinc-800"><Plus className="h-5 w-5 stroke-[2.5]" /></Button></DialogTrigger>
                        <DialogContent className="rounded-[28px] border border-white/[0.08] bg-[#0A0A0A] p-8 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.45)] sm:max-w-[480px] [.light_&]:border-zinc-200/60 [.light_&]:bg-white [.light_&]:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.2)]">
                            <DialogHeader className="mb-8"><DialogTitle className="text-2xl font-black tracking-tight text-white [.light_&]:text-zinc-900">Nova Ação</DialogTitle></DialogHeader>
                            <div className="space-y-6">
                                <div className="space-y-2.5">
                                    <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Descrição</Label>
                                    <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Defina a próxima ação..." className="h-12 rounded-2xl border-white/[0.06] bg-white/[0.03] text-base font-medium [.light_&]:border-zinc-200/60 [.light_&]:bg-zinc-50" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2.5">
                                        <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-600">Prazo</Label>
                                        <Popover>
                                            <PopoverTrigger asChild><Button variant="outline" className="h-12 w-full justify-start rounded-2xl border-zinc-200/60 bg-zinc-50 text-sm font-medium text-zinc-900 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-white"><CalendarIcon className="mr-2.5 h-4 w-4 text-zinc-400" /> {newDate ? format(newDate, "dd/MM/yyyy") : "Escolher"}</Button></PopoverTrigger>
                                            <PopoverContent className="rounded-2xl border-zinc-200 bg-white p-0 dark:border-white/10 dark:bg-zinc-950" align="start"><Calendar mode="single" selected={newDate} onSelect={setNewDate} className="p-3" /></PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-2.5">
                                        <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-600">Contexto</Label>
                                        <Select value={newCategory} onValueChange={(val) => setNewCategory(val as any)}>
                                            <SelectTrigger className="h-12 rounded-2xl border-zinc-200/60 bg-zinc-50 text-sm font-medium dark:border-white/[0.06] dark:bg-white/[0.03]"><SelectValue /></SelectTrigger>
                                            <SelectContent className="rounded-2xl border-zinc-200 bg-white dark:border-white/10 dark:bg-zinc-950">{categories.map(cat => <SelectItem key={cat} value={cat} className="py-2.5 font-medium">{cat}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                            <DialogFooter className="mt-8"><Button onClick={handleCreate} className="h-12 w-full rounded-2xl bg-white text-sm font-bold text-black shadow-sm transition-colors hover:bg-zinc-200 [.light_&]:bg-zinc-900 [.light_&]:text-white [.light_&]:hover:bg-black">Criar Ação</Button></DialogFooter>
                        </DialogContent>
                    </Dialog>
                </header>

                <div style={{ flex: 1, position: 'relative', minHeight: 0 }} className="px-4 pb-4 pt-0">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={customCollisionDetection}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}
                        measuring={{ droppable: { strategy: MeasuringStrategy.WhileDragging } }}
                    >
                        {filteredTasks.length === 0 ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                <h3 className="mb-3 text-3xl font-black tracking-tight text-zinc-900 dark:text-white">Nenhuma ação</h3>
                                <p className="text-xs font-medium text-zinc-400 dark:text-zinc-600">Crie sua primeira ação para começar.</p>
                            </div>
                        ) : view === 'kanban' ? (
                            <div className="custom-scrollbar" style={{ position: 'absolute', inset: 0, overflowX: 'auto', overflowY: 'auto', overscrollBehavior: 'contain' }}>
                                <div style={{ display: 'flex', gap: 16, padding: '8px 24px 24px 24px', minWidth: 'max-content', height: '100%', alignItems: 'stretch' }}>
                                    <SortableContext items={categories} strategy={horizontalListSortingStrategy}>
                                        {categories.map(cat => <KanbanColumn key={cat} category={cat} />)}
                                    </SortableContext>
                                    <button onClick={handleAddColumn} style={{ width: 310, flexShrink: 0 }} className="group flex flex-col items-center justify-center gap-4 rounded-[28px] border border-dashed border-zinc-200/50 transition-colors duration-200 hover:bg-zinc-100/50 dark:border-white/[0.04] dark:hover:bg-white/[0.018]">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200/50 bg-zinc-100/50 transition-colors group-hover:bg-white dark:border-white/[0.05] dark:bg-white/[0.025] dark:group-hover:bg-white/[0.06]"><Plus className="h-6 w-6 text-zinc-300 transition-colors group-hover:text-zinc-600 dark:group-hover:text-zinc-300" /></div>
                                        <span className="block text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400 transition-colors group-hover:text-zinc-600 dark:group-hover:text-zinc-300">Nova coluna</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="custom-scrollbar" style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden', padding: '8px 24px 60px 24px', overscrollBehavior: 'contain' }}>
                                <SortableContext items={filteredTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                                    <div className={cn("grid gap-3", view === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "mx-auto max-w-5xl grid-cols-1")}>
                                        {filteredTasks.map(task => <TaskCard key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} onUpdate={onUpdate} categories={categories} />)}
                                    </div>
                                </SortableContext>
                            </div>
                        )}
                        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}>
                            {activeId && activeType === 'task' && activeTask ? (
                                <div className="z-[100] cursor-grabbing rounded-[28px] shadow-[0_24px_54px_-28px_rgba(0,0,0,0.4)] dark:shadow-[0_28px_64px_-34px_rgba(0,0,0,0.9)]">
                                    <TaskCard task={activeTask} isKanban={view === 'kanban'} isOverlay />
                                </div>
                            ) : activeId && activeType === 'column' ? (
                                <div className="z-[100] cursor-grabbing">
                                    <div className="w-[320px] rounded-[32px] border border-zinc-300/60 bg-white/92 shadow-[0_24px_54px_-28px_rgba(0,0,0,0.35)] dark:border-white/[0.12] dark:bg-[#171717] dark:shadow-[0_28px_64px_-34px_rgba(0,0,0,0.9)]" style={{ height: 'auto', minHeight: 180 }}>
                                        <div className="m-3 flex items-center gap-3 rounded-[24px] border border-zinc-200/40 bg-white/60 px-5 py-4 dark:border-white/[0.06] dark:bg-black/25">
                                            <GripVertical className="h-4 w-4 text-zinc-400" />
                                            <div className="h-2 w-2 rounded-full bg-zinc-900 dark:bg-zinc-200" />
                                            <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-900 dark:text-zinc-100">{activeId}</h3>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                </div>
            </div>

            <Dialog
                open={columnDialogMode !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setColumnDialogMode(null);
                        setColumnToRename(null);
                        setColumnName("");
                    }
                }}
            >
                <DialogContent className="max-w-md rounded-[26px] border-white/[0.08] bg-zinc-950/95 p-0 text-white shadow-[0_36px_100px_-32px_rgba(0,0,0,0.9)] backdrop-blur-3xl [.light_&]:border-zinc-200/80 [.light_&]:bg-white/95 [.light_&]:text-zinc-950">
                    <div className="p-6">
                        <DialogHeader className="space-y-2 text-left">
                            <DialogTitle className="text-xl font-black tracking-tight">
                                {columnDialogMode === 'rename' ? 'Renomear coluna' : 'Nova coluna'}
                            </DialogTitle>
                            <p className="text-sm leading-relaxed text-zinc-400 [.light_&]:text-zinc-600">
                                Use um nome curto para manter o quadro fácil de percorrer.
                            </p>
                        </DialogHeader>
                        <Input
                            value={columnName}
                            onChange={(event) => setColumnName(event.target.value)}
                            onKeyDown={(event) => event.key === 'Enter' && handleSaveColumn()}
                            autoFocus
                            placeholder="Ex.: Retornos"
                            className="mt-6 h-12 rounded-xl border-white/[0.08] bg-white/[0.045] text-white placeholder:text-zinc-600 [.light_&]:border-zinc-200 [.light_&]:bg-zinc-50 [.light_&]:text-zinc-950"
                        />
                        <DialogFooter className="mt-7 gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setColumnDialogMode(null)}
                                className="h-11 rounded-xl border-white/[0.08] bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white [.light_&]:border-zinc-200 [.light_&]:bg-white [.light_&]:text-zinc-700 [.light_&]:hover:bg-zinc-100"
                            >
                                Cancelar
                            </Button>
                            <Button onClick={handleSaveColumn} className="h-11 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 [.light_&]:bg-zinc-950 [.light_&]:text-white [.light_&]:hover:bg-zinc-800">
                                {columnDialogMode === 'rename' ? 'Salvar nome' : 'Criar coluna'}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!columnToDelete} onOpenChange={(open) => !open && setColumnToDelete(null)}>
                <AlertDialogContent className="max-w-md rounded-[26px] border-white/[0.08] bg-zinc-950/95 p-0 text-white shadow-[0_36px_100px_-32px_rgba(0,0,0,0.9)] backdrop-blur-3xl [.light_&]:border-zinc-200/80 [.light_&]:bg-white/95 [.light_&]:text-zinc-950">
                    <div className="p-6">
                        <AlertDialogHeader className="space-y-3">
                            <AlertDialogTitle className="text-xl font-black tracking-tight">Excluir esta coluna?</AlertDialogTitle>
                            <AlertDialogDescription className="text-sm leading-relaxed text-zinc-400 [.light_&]:text-zinc-600">
                                {columnToDelete && tasks.some(task => task.category === columnToDelete)
                                    ? 'As tarefas desta coluna serão movidas para Geral.'
                                    : 'A coluna será removida do quadro.'}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-7 gap-2">
                            <AlertDialogCancel className="h-11 rounded-xl border-white/[0.08] bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white [.light_&]:border-zinc-200 [.light_&]:bg-white [.light_&]:text-zinc-700 [.light_&]:hover:bg-zinc-100">
                                Cancelar
                            </AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDeleteColumn} className="h-11 rounded-xl bg-red-500 text-white hover:bg-red-600">
                                Excluir
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </div>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};