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
import { NotionIcon } from "@/components/icons/NotionIcon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock, FileText, ListFilter, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

interface NotesListPanelProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  items: any[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDeleteNote: (id: string) => void;
  isLoading?: boolean;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  isCreatingNote?: boolean;
}

const toPlainText = (content = "") =>
  content
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const NOTES_PAGE_SIZE = 40;
const hasNotionOrigin = (tags?: string[]) => (tags || []).some((tag) => tag.trim().toLowerCase() === "notion");

export const NotesListPanel = ({
  searchQuery,
  setSearchQuery,
  items,
  selectedId,
  onSelect,
  onCreate,
  onDeleteNote,
  isLoading,
  isCollapsed,
  onToggleCollapsed,
  isCreatingNote = false,
}: NotesListPanelProps) => {
  const [noteToDelete, setNoteToDelete] = useState<{ id: string; title: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const excerptCacheRef = useRef(new Map<string, { content: string; excerpt: string }>());

  const preparedItems = useMemo(() => {
    const activeIds = new Set(items.map((item) => item.id));
    excerptCacheRef.current.forEach((_, id) => {
      if (!activeIds.has(id)) excerptCacheRef.current.delete(id);
    });

    return items.map((item) => {
      const content = item.content || "";
      const cached = excerptCacheRef.current.get(item.id);
      if (cached && cached.content === content) return { ...item, excerpt: cached.excerpt };
      const excerpt = toPlainText(content).slice(0, 120);
      excerptCacheRef.current.set(item.id, { content, excerpt });
      return { ...item, excerpt };
    });
  }, [items]);

  const totalPages = Math.max(1, Math.ceil(preparedItems.length / NOTES_PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * NOTES_PAGE_SIZE;
  const pageEnd = Math.min(pageStart + NOTES_PAGE_SIZE, preparedItems.length);
  const paginatedItems = preparedItems.slice(pageStart, pageEnd);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, items.length]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const handleDragStart = (event: React.DragEvent, noteId: string) => {
    event.dataTransfer.setData("noteId", noteId);
    event.dataTransfer.effectAllowed = "move";
  };

  if (isCollapsed) {
    return (
      <div className="relative flex h-full w-full flex-col items-center bg-transparent py-4">
        <button
          onClick={onToggleCollapsed}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.04] text-zinc-400 transition-all hover:bg-white/[0.09] hover:text-white active:scale-95 [.light_&]:border-zinc-200/70 [.light_&]:bg-white [.light_&]:text-zinc-500 [.light_&]:hover:bg-zinc-100 [.light_&]:hover:text-zinc-950"
          title="Expandir lista de notas"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="mt-6 flex flex-col items-center gap-2 text-zinc-600 [.light_&]:text-zinc-400">
          <ListFilter className="h-4 w-4" />
          <span className="text-[8px] font-black tabular-nums">{items.length}</span>
        </div>
        <button
          onClick={onCreate}
          disabled={isCreatingNote}
          className="mt-auto flex h-9 w-9 items-center justify-center rounded-xl bg-white text-zinc-950 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 [.light_&]:bg-zinc-950 [.light_&]:text-white"
          title="Nova nota"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="relative flex h-full w-full flex-col bg-transparent font-sans">
        <div className="relative z-10 shrink-0 space-y-5 border-b border-white/[0.045] px-5 pb-5 pt-6 [.light_&]:border-zinc-200/60">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-2xl font-black leading-none tracking-tight text-zinc-100 [.light_&]:text-zinc-950">Notas</h2>
              <p className="mt-2 text-[8px] font-black uppercase tracking-[0.25em] text-zinc-600 [.light_&]:text-zinc-400">
                {items.length} {items.length === 1 ? "registro" : "registros"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onCreate}
                disabled={isCreatingNote}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-zinc-950 shadow-[0_15px_30px_-18px_rgba(255,255,255,0.45)] transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-95 disabled:opacity-50 [.light_&]:bg-zinc-950 [.light_&]:text-white [.light_&]:shadow-[0_15px_30px_-18px_rgba(0,0,0,0.35)]"
                title="Nova nota"
              >
                <Plus className={cn("h-4 w-4", isCreatingNote && "animate-pulse")} strokeWidth={2.5} />
              </button>
              <button
                onClick={onToggleCollapsed}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.035] text-zinc-400 transition-all hover:bg-white/[0.08] hover:text-white active:scale-95 [.light_&]:border-zinc-200/70 [.light_&]:bg-white [.light_&]:text-zinc-500 [.light_&]:hover:bg-zinc-100 [.light_&]:hover:text-zinc-950"
                title="Recolher lista"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="group/search relative" data-synapse-target="notes-search">
            <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600 transition-colors group-focus-within/search:text-zinc-300 [.light_&]:text-zinc-400 [.light_&]:group-focus-within/search:text-zinc-800" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar notas..."
              className="h-11 rounded-xl border-white/[0.055] bg-white/[0.03] pl-10 text-xs font-semibold text-zinc-200 placeholder:text-zinc-600 focus-visible:border-white/15 focus-visible:ring-0 [.light_&]:border-zinc-200/70 [.light_&]:bg-white/80 [.light_&]:text-zinc-900 [.light_&]:placeholder:text-zinc-400 [.light_&]:focus-visible:border-zinc-300"
            />
          </div>
        </div>

        <div className="notes-scroll-surface relative z-10 min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-3 pb-4 pt-3 custom-scrollbar [scrollbar-gutter:stable]" data-synapse-target="notes-list">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="h-24 animate-pulse rounded-2xl border border-white/[0.04] bg-white/[0.025] [.light_&]:border-zinc-200/60 [.light_&]:bg-zinc-100/70" />
              ))}
            </div>
          ) : preparedItems.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.05] bg-white/[0.025] text-zinc-700 [.light_&]:border-zinc-200/60 [.light_&]:bg-zinc-100 [.light_&]:text-zinc-400">
                <Sparkles className="h-5 w-5" strokeWidth={1.4} />
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-400 [.light_&]:text-zinc-600">Nenhuma nota encontrada</p>
                <p className="mt-1 text-[10px] text-zinc-600 [.light_&]:text-zinc-400">Crie uma nota ou ajuste sua busca.</p>
              </div>
            </div>
          ) : (
            <>
              {paginatedItems.map((item) => {
                const isActive = selectedId === item.id;
                const isNotionNote = hasNotionOrigin(item.tags);
                return (
                  <div
                    key={item.id}
                    data-synapse-note-id={item.id}
                    draggable
                    onDragStart={(event) => handleDragStart(event as unknown as React.DragEvent, item.id)}
                    onClick={() => onSelect(item.id)}
                    className={cn(
                      "group relative cursor-pointer overflow-hidden rounded-2xl border p-4 transition-colors duration-200 [content-visibility:auto] [contain-intrinsic-size:108px]",
                      isActive
                        ? "border-white/10 bg-white text-zinc-950 shadow-[0_18px_42px_-26px_rgba(255,255,255,0.5)] [.light_&]:border-zinc-950 [.light_&]:bg-zinc-950 [.light_&]:text-white [.light_&]:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.45)]"
                        : "border-white/[0.045] bg-white/[0.018] text-zinc-300 hover:border-white/[0.09] hover:bg-white/[0.045] [.light_&]:border-zinc-200/60 [.light_&]:bg-white/55 [.light_&]:text-zinc-700 [.light_&]:hover:border-zinc-300 [.light_&]:hover:bg-white"
                    )}
                  >
                    {isActive && <FileText className="pointer-events-none absolute -right-2 -top-2 h-14 w-14 opacity-[0.035]" strokeWidth={1} />}
                    <div className="relative z-10">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="line-clamp-1 text-[13px] font-black leading-tight tracking-tight">{item.title || "Nota sem título"}</h3>
                        {isNotionNote && (
                          <span className={cn("inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2 text-[8px] font-black uppercase tracking-[0.14em]", isActive ? "border-black/10 bg-black/[0.04] text-zinc-700 [.light_&]:border-white/10 [.light_&]:bg-white/10 [.light_&]:text-zinc-200" : "border-white/[0.055] bg-white/[0.035] text-zinc-400 [.light_&]:border-zinc-200/70 [.light_&]:bg-white [.light_&]:text-zinc-600")}>
                            <NotionIcon className="h-3 w-3" />
                            Notion
                          </span>
                        )}
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            setNoteToDelete({ id: item.id, title: item.title || "Nota sem título" });
                          }}
                          className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg opacity-0 transition-all group-hover:opacity-100", isActive ? "text-zinc-500 hover:bg-black/5 hover:text-red-500 [.light_&]:text-zinc-400 [.light_&]:hover:bg-white/10 [.light_&]:hover:text-red-300" : "text-zinc-600 hover:bg-white/[0.06] hover:text-red-400 [.light_&]:text-zinc-400 [.light_&]:hover:bg-red-50 [.light_&]:hover:text-red-500")}
                          title="Excluir nota"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {item.excerpt && <p className={cn("mt-2 line-clamp-2 text-[11px] leading-relaxed", isActive ? "text-zinc-600 [.light_&]:text-zinc-300" : "text-zinc-500 [.light_&]:text-zinc-500")}>{item.excerpt}</p>}
                      <div className={cn("mt-3 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.12em]", isActive ? "text-zinc-500 [.light_&]:text-zinc-400" : "text-zinc-600 [.light_&]:text-zinc-400")}>
                        <Clock className="h-3 w-3" />
                        <span>{item.updated_at ? format(new Date(item.updated_at), "dd MMM", { locale: ptBR }) : "Sem data"}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-1 py-3 text-[10px] font-bold text-zinc-500 [.light_&]:text-zinc-500">
                  <button disabled={safeCurrentPage <= 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} className="rounded-lg px-2 py-1 hover:bg-white/[0.05] disabled:opacity-30 [.light_&]:hover:bg-zinc-100">Anterior</button>
                  <span>{safeCurrentPage} / {totalPages}</span>
                  <button disabled={safeCurrentPage >= totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} className="rounded-lg px-2 py-1 hover:bg-white/[0.05] disabled:opacity-30 [.light_&]:hover:bg-zinc-100">Próxima</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <AlertDialog open={!!noteToDelete} onOpenChange={(open) => !open && setNoteToDelete(null)}>
        <AlertDialogContent className="rounded-[28px] border border-white/[0.08] bg-[#101012]/95 text-white shadow-2xl backdrop-blur-2xl [.light_&]:border-zinc-200 [.light_&]:bg-white [.light_&]:text-zinc-950">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir nota?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 [.light_&]:text-zinc-600">
              Esta ação não pode ser desfeita. A nota “{noteToDelete?.title}” será removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (noteToDelete) onDeleteNote(noteToDelete.id); setNoteToDelete(null); }} className="bg-red-500 text-white hover:bg-red-600">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
