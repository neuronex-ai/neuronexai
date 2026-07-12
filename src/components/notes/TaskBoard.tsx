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
    CollisionDetection,
    defaultDropAnimationSideEffects
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
import { AnimatePresence, motion } from "framer-motion";
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
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
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
        if (categories.includes(active.id as string)) {
            setActiveType('column');
        } else {
            setActiveType('task');
        }
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over || activeType === 'column') {
            setOverCategory(null);
            return;
        }
        const overId = over.id as string;
        const resolvedColumn = resolveColumnId(overId);
        setOverCategory(resolvedColumn);

        // Fluid transition: update category only if different
        const activeTaskId = active.id as string;
        const activeTask = tasks.find(t => t.id === activeTaskId);
        if (activeTask && resolvedColumn && activeTask.category !== resolvedColumn) {
            // Optimized update: we use a requestAnimationFrame or just let the state handle it
            // but we ensure the visual transition is smooth via Framer Motion layout prop
            onUpdateCategory?.(activeTaskId, resolvedColumn as any);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        const oldActiveType = activeType;

        // Reset states with a slight delay for smoother completion animation
        setActiveId(null);
        setActiveType(null);
        setOverCategory(null);

        if (!over) return;

        if (oldActiveType === 'column') {
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
            transition: transition || "transform 500ms cubic-bezier(0.2, 0, 0, 1)"
        };
        const isTarget = overCategory === category;

        if (isDragging) {
            return (
                <div
                    ref={setNodeRef}
                    style={{ ...style, width: 310, flexShrink: 0 }}
                    className="rounded-[32px] border-2 border-dashed border-zinc-200/60 dark:border-white/5 bg-zinc-100/10 dark:bg-white/[0.005] self-stretch opacity-20"
                />
            );
        }

        return (
            <div
                ref={setNodeRef}
                style={{ ...style, width: 320, flexShrink: 0 }}
                className={cn(
                    "flex flex-col rounded-[32px] p-2 self-stretch transition-all duration-700 [transition-timing-function:cubic-bezier(0.2,0,0,1)] relative group/column",
                    isTarget
                        ? "bg-white/40 dark:bg-white/[0.02] ring-1 ring-zinc-200/50 dark:ring-white/10"
                        : "bg-transparent hover:bg-zinc-50/20 dark:hover:bg-white/[0.005]"
                )}
            >
                <div className={cn(
                    "flex items-center justify-between mb-4 px-5 py-4 bg-white/60 dark:bg-white/[0.03] backdrop-blur-md border border-zinc-200/50 dark:border-white/[0.08] rounded-[24px] group transition-all duration-700 shrink-0 shadow-sm",
                    isTarget
                        ? "bg-white dark:bg-zinc-900/40 border-zinc-300 dark:border-white/20 shadow-[0_12px_24px_-8px_rgba(0,0,0,0.06)]"
                        : "hover:bg-white/80 dark:hover:bg-white/[0.05]"
                )}>
                    <div className="flex items-center gap-3">
                        <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing p-1.5 -ml-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-300 dark:text-zinc-700 transition-all duration-500">
                            <GripVertical className="h-4 w-4" />
                        </div>
                        <div className={cn("h-2 w-2 rounded-full transition-all duration-700 shadow-sm", isTarget ? "bg-zinc-900 dark:bg-white scale-125" : "bg-zinc-200 dark:bg-zinc-800")} />
                        <h3 className={cn("text-[11px] font-black uppercase tracking-[0.2em] transition-colors duration-700", isTarget ? "text-zinc-900 dark:text-white" : "text-zinc-400 dark:text-zinc-500")}>{category}</h3>
                        <span className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 bg-zinc-100/80 dark:bg-white/[0.06] px-2.5 py-0.5 rounded-full backdrop-blur-sm border border-black/5 dark:border-white/5">{columnTasks.length}</span>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-400 dark:text-zinc-600 transition-all opacity-0 group-hover:opacity-100">
                                <MoreVertical className="h-4 w-4" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-[24px] bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-xl border-zinc-200 dark:border-white/10 min-w-[220px] p-2 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.25)]">
                            <DropdownMenuItem onClick={() => { setNewCategory(category as any); setIsCreateOpen(true); }} className="text-[11px] font-bold uppercase tracking-wider gap-3 py-3 rounded-xl cursor-pointer focus:bg-zinc-100 dark:focus:bg-white/10 transition-all"><Plus className="h-4 w-4" /> Nova Ação</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleRenameColumn(category)} className="text-[11px] font-bold uppercase tracking-wider gap-3 py-3 rounded-xl cursor-pointer focus:bg-zinc-100 dark:focus:bg-white/10 transition-all"><Pencil className="h-4 w-4" /> Renomear</DropdownMenuItem>
                            <DropdownMenuItem className="text-[11px] font-bold uppercase tracking-wider gap-3 py-3 rounded-xl cursor-pointer focus:bg-zinc-100 dark:focus:bg-white/10 transition-all"><Sparkles className="h-4 w-4" /> Otimizar com I.A.</DropdownMenuItem>
                            {category !== 'Geral' && (
                                <DropdownMenuItem onClick={() => handleDeleteColumn(category)} className="text-[11px] font-bold uppercase tracking-wider gap-3 py-3 rounded-xl text-red-500 hover:text-red-600 cursor-pointer focus:bg-red-50 dark:focus:bg-red-500/10 transition-all"><Trash2 className="h-4 w-4" /> Excluir Coluna</DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <SortableContext id={category} items={columnTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    <div className="flex-1 flex flex-col gap-3 px-1 pb-10 overflow-y-auto overflow-x-hidden custom-scrollbar transition-all duration-700" style={{ minHeight: 120 }}>
                        <AnimatePresence mode="popLayout" initial={false}>
                            {columnTasks.map(task => (
                                <motion.div
                                    key={task.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 400,
                                        damping: 30,
                                        mass: 1,
                                        layout: { duration: 0.4, ease: [0.2, 0, 0, 1] }
                                    }}
                                    className="relative"
                                >
                                    <TaskCard task={task} onToggle={onToggle} onDelete={onDelete} onUpdate={onUpdate} isKanban categories={categories} />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        {columnTasks.length === 0 && (
                            <div className={cn(
                                "py-16 rounded-[28px] border-2 border-dashed transition-all duration-700 flex flex-col items-center justify-center bg-transparent",
                                isTarget ? "border-zinc-300 dark:border-white/20 bg-white/5 dark:bg-white/[0.01]" : "border-zinc-200/30 dark:border-white/[0.02] opacity-20"
                            )}>
                                <div className={cn(
                                    "w-12 h-12 rounded-2xl border border-zinc-200 dark:border-white/10 flex items-center justify-center mb-4 transition-all duration-700 shadow-sm",
                                    isTarget ? "border-zinc-400 dark:border-white/30 bg-white dark:bg-white/10 scale-110" : "scale-100"
                                )}>
                                    <Plus className={cn("h-6 w-6 transition-all duration-700", isTarget ? "text-zinc-900 dark:text-zinc-100 rotate-90" : "text-zinc-400")} />
                                </div>
                                <span className={cn("text-[10px] font-black uppercase tracking-[0.4em] transition-all duration-700", isTarget ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400")}>Vazio</span>
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
                transition={{ type: "spring", stiffness: 340, damping: 36 }}
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
                <header className="px-7 pt-7 pb-5 flex items-center justify-between gap-7 shrink-0">
                    <div className="flex items-center gap-8 flex-1">
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                            <h2 className="text-3xl font-black tracking-tighter text-white [.light_&]:text-zinc-900">Ações</h2>
                            <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.3em]">{filteredTasks.length} registros</span>
                            </div>
                        </motion.div>
                        <div className="relative group flex-1 max-w-xl">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 dark:text-zinc-600 transition-colors group-focus-within:text-zinc-900 dark:group-focus-within:text-white" />
                            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar ações..." className="h-12 rounded-2xl border-white/[0.06] bg-white/[0.03] pl-12 text-sm font-medium text-white shadow-sm outline-none ring-0 transition-all focus:border-white/15 focus:shadow-md focus-visible:ring-0 [.light_&]:border-zinc-200/60 [.light_&]:bg-white [.light_&]:text-zinc-900 [.light_&]:focus:border-zinc-300" />
                        </div>
                    </div>
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild><Button className="h-12 w-12 rounded-2xl bg-white text-black shadow-sm transition-all duration-300 hover:scale-105 hover:bg-zinc-100 active:scale-95 [.light_&]:bg-zinc-900 [.light_&]:text-white [.light_&]:hover:bg-zinc-800"><Plus className="h-5 w-5 stroke-[2.5]" /></Button></DialogTrigger>
                        <DialogContent className="sm:max-w-[480px] rounded-[28px] border border-white/[0.08] bg-[#0A0A0A] p-8 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.45)] [.light_&]:border-zinc-200/60 [.light_&]:bg-white [.light_&]:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.2)]">
                            <DialogHeader className="mb-8"><DialogTitle className="text-2xl font-black text-white tracking-tight [.light_&]:text-zinc-900">Nova Ação</DialogTitle></DialogHeader>
                            <div className="space-y-6">
                                <div className="space-y-2.5">
                                    <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Descrição</Label>
                                    <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Defina a próxima ação..." className="h-12 rounded-2xl border-white/[0.06] bg-white/[0.03] text-base font-medium [.light_&]:border-zinc-200/60 [.light_&]:bg-zinc-50" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2.5">
                                        <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-600">Prazo</Label>
                                        <Popover>
                                            <PopoverTrigger asChild><Button variant="outline" className="w-full h-12 rounded-2xl justify-start bg-zinc-50 dark:bg-white/[0.03] border-zinc-200/60 dark:border-white/[0.06] text-zinc-900 dark:text-white font-medium text-sm"><CalendarIcon className="mr-2.5 h-4 w-4 text-zinc-400" /> {newDate ? format(newDate, "dd/MM/yyyy") : "Escolher"}</Button></PopoverTrigger>
                                            <PopoverContent className="p-0 bg-white dark:bg-zinc-950 rounded-2xl border-zinc-200 dark:border-white/10" align="start"><Calendar mode="single" selected={newDate} onSelect={setNewDate} className="p-3" /></PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-2.5">
                                        <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-600">Contexto</Label>
                                        <Select value={newCategory} onValueChange={(val) => setNewCategory(val as any)}>
                                            <SelectTrigger className="h-12 rounded-2xl bg-zinc-50 dark:bg-white/[0.03] border-zinc-200/60 dark:border-white/[0.06] font-medium text-sm"><SelectValue /></SelectTrigger>
                                            <SelectContent className="rounded-2xl bg-white dark:bg-zinc-950 border-zinc-200 dark:border-white/10">{categories.map(cat => <SelectItem key={cat} value={cat} className="font-medium py-2.5">{cat}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                            <DialogFooter className="mt-8"><Button onClick={handleCreate} className="h-12 w-full rounded-2xl bg-white text-sm font-bold text-black shadow-sm transition-all hover:bg-zinc-200 [.light_&]:bg-zinc-900 [.light_&]:text-white [.light_&]:hover:bg-black">Criar Ação</Button></DialogFooter>
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
                        measuring={{ droppable: { strategy: MeasuringStrategy.Always, frequency: 1 } }}
                    >
                        {filteredTasks.length === 0 ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                <h3 className="font-black text-3xl text-zinc-900 dark:text-white mb-3 tracking-tight">Nenhuma ação</h3>
                                <p className="text-zinc-400 dark:text-zinc-600 text-xs font-medium">Crie sua primeira ação para começar.</p>
                            </div>
                        ) : view === 'kanban' ? (
                            <div style={{ position: 'absolute', inset: 0, overflowX: 'auto', overflowY: 'auto' }}>
                                <div style={{ display: 'flex', gap: 16, padding: '8px 24px 24px 24px', minWidth: 'max-content', height: '100%', alignItems: 'stretch' }}>
                                    <SortableContext items={categories} strategy={horizontalListSortingStrategy}>
                                        {categories.map(cat => <KanbanColumn key={cat} category={cat} />)}
                                    </SortableContext>
                                    <button onClick={handleAddColumn} style={{ width: 310, flexShrink: 0 }} className="border-2 border-dashed border-zinc-200/50 dark:border-white/5 rounded-[28px] flex flex-col items-center justify-center gap-4 hover:bg-zinc-100/50 dark:hover:bg-white/[0.02] transition-all duration-500 group">
                                        <div className="w-12 h-12 rounded-2xl bg-zinc-100/50 dark:bg-white/[0.03] border border-zinc-200/50 dark:border-white/[0.06] flex items-center justify-center group-hover:scale-105 group-hover:bg-white dark:group-hover:bg-white/10 transition-all duration-500"><Plus className="h-6 w-6 text-zinc-300 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors duration-500" /></div>
                                        <span className="block text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-all duration-500">Nova coluna</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden', padding: '8px 24px 60px 24px' }}>
                                <SortableContext items={filteredTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                                    <div className={cn("grid gap-3", view === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1 max-w-5xl mx-auto")}>
                                        <AnimatePresence mode="popLayout">{filteredTasks.map(task => <TaskCard key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} onUpdate={onUpdate} categories={categories} />)}</AnimatePresence>
                                    </div>
                                </SortableContext>
                            </div>
                        )}
                        <DragOverlay
                            dropAnimation={{
                                duration: 500,
                                easing: 'cubic-bezier(0.2, 0, 0, 1)',
                                sideEffects: defaultDropAnimationSideEffects({
                                    styles: {
                                        active: { opacity: '0.4', filter: 'blur(4px)' }
                                    }
                                })
                            }}
                        >
                            {activeId && activeType === 'task' && activeTask ? (
                                <div className="z-[100] cursor-grabbing">
                                    <motion.div
                                        initial={{ scale: 1, rotate: 0 }}
                                        animate={{ scale: 1.05, rotate: -1 }}
                                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                        className="relative shadow-[0_40px_80px_-20px_rgba(0,0,0,0.3)] dark:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.7)] rounded-[28px] ring-1 ring-black/5 dark:ring-white/20"
                                    >
                                        <TaskCard task={activeTask} isKanban={view === 'kanban'} isOverlay />
                                    </motion.div>
                                </div>
                            ) : activeId && activeType === 'column' ? (
                                <div className="z-[100] cursor-grabbing">
                                    <div className="w-[320px] rounded-[32px] border-2 border-zinc-300/60 dark:border-white/20 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.25)] dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)]" style={{ height: 'auto', minHeight: 180 }}>
                                        <div className="flex items-center gap-3 px-5 py-4 m-3 bg-white/60 dark:bg-white/[0.05] border border-zinc-200/40 dark:border-white/[0.06] rounded-[24px]">
                                            <GripVertical className="h-4 w-4 text-zinc-400" />
                                            <div className="h-2 w-2 rounded-full bg-zinc-900 dark:bg-white" />
                                            <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-900 dark:text-white">{activeId}</h3>
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
