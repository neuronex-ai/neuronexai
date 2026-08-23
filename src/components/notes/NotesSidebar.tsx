"use client";

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
import { Button } from "@/components/ui/button";
import { NotionIcon } from "@/components/icons/NotionIcon";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useNoteModules } from "@/hooks/use-note-modules";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Fingerprint,
  Folder,
  FolderOpen,
  FolderPlus,
  ListTodo,
  Plus,
  Share2,
  StickyNote,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type NotesViewMode = 'notes' | 'tasks' | 'notion' | 'neuroview' | 'neuroflow' | 'neuropulse' | 'files';

interface NotesSidebarProps {
  viewMode: NotesViewMode;
  setViewMode: (mode: NotesViewMode) => void;
  selectedModuleId: string | null;
  onSelectModule: (id: string | null) => void;
  onMoveNoteToModule?: (noteId: string, moduleId: string) => void;
  onCreateNote?: () => void;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  isCreatingNote?: boolean;
}

const mainItems = [
  { id: 'notes', label: 'Notas', icon: StickyNote, mode: 'notes' as const },
  { id: 'tasks', label: 'Tarefas', icon: ListTodo, mode: 'tasks' as const },
  { id: 'notion', label: 'Notion', icon: NotionIcon, mode: 'notion' as const },
  { id: 'files', label: 'Drive', icon: FolderOpen, mode: 'files' as const },
];

const intelligenceItems = [
  { id: 'neuroview', label: 'NeuroVision', icon: Share2, mode: 'neuroview' as const },
  { id: 'neuroflow', label: 'NeuroFlow', icon: Share2, mode: 'neuroflow' as const },
  { id: 'neuropulse', label: 'NeuroPulse', icon: Fingerprint, mode: 'neuropulse' as const },
];

export const NotesSidebar = ({
  viewMode,
  setViewMode,
  selectedModuleId,
  onSelectModule,
  onMoveNoteToModule,
  onCreateNote,
  isCollapsed,
  onToggleCollapsed,
  isCreatingNote = false,
}: NotesSidebarProps) => {
  const { modules, createModule, deleteModule } = useNoteModules();
  const [dragOverModuleId, setDragOverModuleId] = useState<string | null>(null);
  const [moduleName, setModuleName] = useState("");
  const [isModuleDialogOpen, setIsModuleDialogOpen] = useState(false);
  const [moduleToDelete, setModuleToDelete] = useState<{ id: string; name: string } | null>(null);

  const handleCreateModule = () => {
    const name = moduleName.trim();
    if (!name) return;
    createModule(name);
    setModuleName("");
    setIsModuleDialogOpen(false);
  };

  const handleDrop = (event: React.DragEvent, moduleId: string) => {
    event.preventDefault();
    const noteId = event.dataTransfer.getData("noteId");
    if (noteId && onMoveNoteToModule) {
      onMoveNoteToModule(noteId, moduleId);
      toast.success("Nota movida com sucesso.");
    }
    setDragOverModuleId(null);
  };

  const selectView = (mode: NotesViewMode) => {
    setViewMode(mode);
    onSelectModule(null);
  };

  const renderItem = (item: typeof mainItems[number] | typeof intelligenceItems[number]) => {
    const isActive = viewMode === item.mode && !selectedModuleId;
    const Icon = item.icon;

    return (
      <button
        key={item.id}
        onClick={() => selectView(item.mode)}
        className={cn(
          "group relative flex h-10 w-full items-center rounded-xl transition-all duration-300",
          isCollapsed ? "justify-center px-0" : "justify-between px-3",
          isActive
            ? "bg-white text-zinc-950 shadow-[0_12px_30px_-20px_rgba(255,255,255,0.65)] [.light_&]:bg-zinc-950 [.light_&]:text-white [.light_&]:shadow-[0_12px_30px_-20px_rgba(0,0,0,0.35)]"
            : "text-zinc-500 hover:bg-white/[0.055] hover:text-zinc-100 [.light_&]:text-zinc-500 [.light_&]:hover:bg-zinc-950/[0.045] [.light_&]:hover:text-zinc-950"
        )}
        title={isCollapsed ? item.label : undefined}
      >
        <span className={cn("relative z-10 flex items-center", isCollapsed ? "justify-center" : "gap-3")}>
          <Icon className="h-4 w-4 shrink-0" strokeWidth={isActive ? 2.3 : 1.6} />
          {!isCollapsed && (
            <span className="whitespace-nowrap text-[9px] font-black uppercase tracking-[0.19em]">
              {item.label}
            </span>
          )}
        </span>
        {isActive && isCollapsed && (
          <motion.span
            layoutId="notes-rail-active"
            className="absolute -left-2 h-5 w-0.5 rounded-full bg-white [.light_&]:bg-zinc-950"
          />
        )}
      </button>
    );
  };

  return (
    <>
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-transparent font-sans">
        <div className={cn(
          "relative z-10 flex shrink-0 items-center border-b border-white/[0.05]",
          isCollapsed ? "h-16 justify-center px-2" : "h-20 justify-between px-5",
          "[.light_&]:border-zinc-200/60",
        )}>
          {!isCollapsed && (
            <div className="flex min-w-0 items-center">
              <div className="min-w-0">
                <p className="truncate text-[9px] font-black uppercase tracking-[0.38em] text-zinc-300 [.light_&]:text-zinc-700">NeuroDrive</p>
                <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.18em] text-zinc-600 [.light_&]:text-zinc-400">Notas e conexões</p>
              </div>
            </div>
          )}
          <button
            onClick={onToggleCollapsed}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.035] text-zinc-400 transition-all hover:bg-white/[0.08] hover:text-white active:scale-95 [.light_&]:border-zinc-200/70 [.light_&]:bg-white/75 [.light_&]:text-zinc-500 [.light_&]:hover:bg-zinc-100 [.light_&]:hover:text-zinc-950"
            title={isCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <div className={cn(
          "relative z-10 flex-1 overflow-y-auto custom-scrollbar",
          isCollapsed ? "space-y-5 px-2 py-4" : "space-y-7 px-3 py-5",
        )}>
          <button
            onClick={onCreateNote}
            disabled={isCreatingNote}
            className={cn(
              "flex items-center bg-white text-zinc-950 shadow-[0_16px_36px_-24px_rgba(255,255,255,0.7)] transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [.light_&]:bg-zinc-950 [.light_&]:text-white [.light_&]:shadow-[0_16px_36px_-24px_rgba(0,0,0,0.4)]",
              isCollapsed ? "h-11 w-full justify-center rounded-xl" : "h-11 w-full gap-3 rounded-2xl px-4",
            )}
            title={isCollapsed ? "Nova nota" : undefined}
          >
            <Plus className={cn("h-4 w-4 shrink-0", isCreatingNote && "animate-pulse")} strokeWidth={2.5} />
            {!isCollapsed && (
              <>
                <span className="text-[9px] font-black uppercase tracking-[0.2em]">
                  {isCreatingNote ? "Criando" : "Nova nota"}
                </span>
                <span className="ml-auto text-base font-light opacity-40">+</span>
              </>
            )}
          </button>

          <div className="space-y-1">
            {!isCollapsed && <p className="mb-2 px-3 text-[7.5px] font-black uppercase tracking-[0.34em] text-zinc-600 [.light_&]:text-zinc-400">Sincronia</p>}
            {mainItems.map(renderItem)}
          </div>

          <div className="space-y-1">
            <div className={cn("mb-2 flex items-center", isCollapsed ? "justify-center" : "justify-between px-3")}>
              {!isCollapsed && <p className="text-[7.5px] font-black uppercase tracking-[0.34em] text-zinc-600 [.light_&]:text-zinc-400">Módulos</p>}
              <button
                onClick={() => setIsModuleDialogOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-600 transition-all hover:bg-white/[0.06] hover:text-white [.light_&]:text-zinc-400 [.light_&]:hover:bg-zinc-100 [.light_&]:hover:text-zinc-950"
                title="Criar pasta"
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
            </div>

            <AnimatePresence initial={false}>
              {modules?.map((module) => {
                const isActive = selectedModuleId === module.id;
                const isDragOver = dragOverModuleId === module.id;
                return (
                  <motion.div
                    layout
                    key={module.id}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragOverModuleId(module.id);
                    }}
                    onDragLeave={() => setDragOverModuleId(null)}
                    onDrop={(event) => handleDrop(event, module.id)}
                    className={cn(
                      "group relative flex h-10 items-center rounded-xl border transition-all",
                      isCollapsed ? "justify-center px-0" : "px-3",
                      isActive
                        ? "border-white/10 bg-white/[0.08] text-white [.light_&]:border-zinc-300 [.light_&]:bg-zinc-100 [.light_&]:text-zinc-950"
                        : isDragOver
                          ? "border-white/20 bg-white/[0.1] text-white [.light_&]:border-zinc-400 [.light_&]:bg-zinc-100 [.light_&]:text-zinc-950"
                          : "border-transparent text-zinc-500 hover:bg-white/[0.045] hover:text-zinc-200 [.light_&]:hover:bg-zinc-950/[0.045] [.light_&]:hover:text-zinc-950"
                    )}
                  >
                    <button
                      onClick={() => {
                        onSelectModule(module.id);
                        setViewMode('notes');
                      }}
                      className={cn("flex h-full min-w-0 flex-1 items-center", isCollapsed ? "justify-center" : "gap-3")}
                      title={isCollapsed ? module.name : undefined}
                    >
                      <Folder className="h-3.5 w-3.5 shrink-0" strokeWidth={isActive ? 2.3 : 1.5} />
                      {!isCollapsed && <span className="truncate text-[9px] font-bold uppercase tracking-tight">{module.name}</span>}
                    </button>
                    {!isCollapsed && (
                      <button
                        onClick={() => setModuleToDelete({ id: module.id, name: module.name })}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-600 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                        title="Excluir pasta"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          <div className="space-y-1">
            {!isCollapsed && <p className="mb-2 px-3 text-[7.5px] font-black uppercase tracking-[0.34em] text-zinc-600 [.light_&]:text-zinc-400">Inteligência</p>}
            {intelligenceItems.map(renderItem)}
          </div>
        </div>
      </div>

      <Dialog open={isModuleDialogOpen} onOpenChange={setIsModuleDialogOpen}>
        <DialogContent className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#101012]/95 p-0 text-white shadow-[0_36px_100px_-36px_rgba(0,0,0,0.9)] backdrop-blur-3xl [.light_&]:border-zinc-200/80 [.light_&]:bg-white/95 [.light_&]:text-zinc-950">
          <DialogHeader className="border-b border-white/[0.06] px-7 py-6 text-left [.light_&]:border-zinc-200/70">
            <DialogTitle className="text-xl font-black tracking-tight">Nova pasta</DialogTitle>
            <DialogDescription className="text-sm text-zinc-400 [.light_&]:text-zinc-500">Organize suas notas em um contexto fácil de encontrar.</DialogDescription>
          </DialogHeader>
          <div className="px-7 py-5">
            <Input
              autoFocus
              value={moduleName}
              onChange={(event) => setModuleName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleCreateModule();
              }}
              placeholder="Nome da pasta"
              className="h-12 rounded-2xl border-white/[0.08] bg-white/[0.04] text-white focus-visible:ring-white/20 [.light_&]:border-zinc-200 [.light_&]:bg-zinc-50 [.light_&]:text-zinc-950"
            />
          </div>
          <DialogFooter className="gap-2 px-7 pb-7 sm:space-x-0">
            <Button variant="ghost" onClick={() => setIsModuleDialogOpen(false)} className="h-11 rounded-xl px-5 text-zinc-400">Cancelar</Button>
            <Button onClick={handleCreateModule} disabled={!moduleName.trim()} className="h-11 rounded-xl bg-white px-6 text-zinc-950 hover:bg-zinc-200 [.light_&]:bg-zinc-950 [.light_&]:text-white">Criar pasta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!moduleToDelete} onOpenChange={(open) => !open && setModuleToDelete(null)}>
        <AlertDialogContent className="rounded-[28px] border border-white/[0.08] bg-[#101012]/95 text-white shadow-2xl backdrop-blur-3xl [.light_&]:border-zinc-200/80 [.light_&]:bg-white [.light_&]:text-zinc-950">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{moduleToDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>As notas continuam salvas, mas deixam de pertencer a esta pasta.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl border-white/10 bg-transparent [.light_&]:border-zinc-200">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (moduleToDelete) deleteModule(moduleToDelete.id);
                setModuleToDelete(null);
              }}
              className="rounded-xl bg-red-500 text-white hover:bg-red-600"
            >
              Excluir pasta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
