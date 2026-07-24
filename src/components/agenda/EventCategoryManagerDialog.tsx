import { useEffect, useId, useState } from "react";
import { Check, Loader2, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfessionalEventCategories } from "@/hooks/use-professional-event-categories";

interface EventCategoryManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSlug?: string;
  onSelect: (slug: string) => void;
  onArchived: (slug: string) => void;
}

export function EventCategoryManagerDialog({
  open,
  onOpenChange,
  selectedSlug,
  onSelect,
  onArchived,
}: EventCategoryManagerDialogProps) {
  const addInputId = useId();
  const {
    categories,
    isLoading,
    isError,
    createCategory,
    updateCategory,
    archiveCategory,
    isMutating,
    getErrorMessage,
  } = useProfessionalEventCategories({ enabled: open });
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [confirmingArchiveId, setConfirmingArchiveId] = useState<string | null>(null);

  useEffect(() => {
    if (open) return;
    setNewName("");
    setEditingId(null);
    setEditingName("");
    setConfirmingArchiveId(null);
  }, [open]);

  const selectAndClose = (slug: string) => {
    onSelect(slug);
    onOpenChange(false);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const category = await createCategory(newName);
      setNewName("");
      toast.success("Categoria adicionada e selecionada.");
      selectAndClose(category.slug);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      await updateCategory({ id, rawName: editingName });
      setEditingId(null);
      setEditingName("");
      toast.success("Categoria atualizada.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleArchive = async (id: string) => {
    try {
      const category = await archiveCategory(id);
      if (selectedSlug === category.slug) onArchived(category.slug);
      setConfirmingArchiveId(null);
      if (editingId === id) {
        setEditingId(null);
        setEditingName("");
      }
      toast.success("Categoria removida. Eventos anteriores mantêm o nome salvo.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="agenda-modal-surface w-[calc(100vw-1rem)] max-w-[520px] gap-0 overflow-hidden rounded-[28px] border p-0"
        aria-busy={isMutating}
      >
        <DialogHeader className="border-b border-border/55 px-5 pb-4 pt-5 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="synapse-chat-glass flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] border">
              <Tags className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle>Categorias de evento</DialogTitle>
              <DialogDescription className="mt-1">
                Adicione, renomeie ou remova as categorias usadas nos seus compromissos.
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="notification-liquid-control h-11 w-11 shrink-0 rounded-full"
              aria-label="Fechar categorias de evento"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </DialogHeader>

        <div className="max-h-[min(34rem,calc(100dvh-11rem))] space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <form onSubmit={handleCreate} className="space-y-2">
            <Label
              htmlFor={addInputId}
              className="ml-1 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
            >
              Nova categoria
            </Label>
            <div className="grid grid-cols-[minmax(0,1fr)_3rem] gap-2">
              <Input
                id={addInputId}
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                maxLength={60}
                placeholder="Ex.: Produção de conteúdo"
                className="agenda-field h-12 rounded-2xl px-4 font-medium"
                disabled={isMutating}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!newName.trim() || isMutating}
                className="agenda-primary-action h-12 w-12 rounded-2xl"
                aria-label="Adicionar categoria"
              >
                {isMutating ? (
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <Plus className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </div>
          </form>

          <section aria-labelledby="event-category-list-heading">
            <h3
              id="event-category-list-heading"
              className="mb-2 ml-1 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
            >
              Suas categorias
            </h3>

            {isLoading ? (
              <div className="agenda-liquid-card flex min-h-24 items-center justify-center gap-2 rounded-[20px] border text-sm text-muted-foreground" role="status">
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                Carregando categorias…
              </div>
            ) : null}

            {isError ? (
              <p className="rounded-[18px] border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
                Não foi possível carregar as categorias agora. Feche esta janela e tente novamente.
              </p>
            ) : null}

            {!isLoading && !isError ? (
              <ul className="space-y-2">
                {categories.map((category) => {
                  const isEditing = editingId === category.id;
                  const isConfirmingArchive = confirmingArchiveId === category.id;

                  return (
                    <li key={category.id} className="agenda-liquid-card rounded-[18px] border p-2.5">
                      {isConfirmingArchive ? (
                        <div className="flex min-h-11 items-center justify-between gap-3 px-1">
                          <p className="min-w-0 text-xs leading-relaxed text-muted-foreground">
                            Remover <strong className="text-foreground">{category.name}</strong>?
                          </p>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmingArchiveId(null)}
                              className="notification-liquid-control h-11 rounded-full px-3"
                              disabled={isMutating}
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => handleArchive(category.id)}
                              className="h-11 rounded-full px-3"
                              disabled={isMutating}
                            >
                              Remover
                            </Button>
                          </div>
                        </div>
                      ) : isEditing ? (
                        <div className="grid grid-cols-[minmax(0,1fr)_2.75rem_2.75rem] gap-1.5">
                          <Input
                            value={editingName}
                            onChange={(event) => setEditingName(event.target.value)}
                            maxLength={60}
                            className="agenda-field h-11 rounded-[14px] px-3 font-semibold"
                            aria-label={`Novo nome de ${category.name}`}
                            autoFocus
                            disabled={isMutating}
                            onKeyDown={(event) => {
                              if (event.key === "Escape") {
                                setEditingId(null);
                                setEditingName("");
                              }
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void handleUpdate(category.id);
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => void handleUpdate(category.id)}
                            disabled={!editingName.trim() || isMutating}
                            className="notification-liquid-control h-11 w-11 rounded-full"
                            aria-label={`Salvar alterações em ${category.name}`}
                          >
                            <Check className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingId(null);
                              setEditingName("");
                            }}
                            disabled={isMutating}
                            className="notification-liquid-control h-11 w-11 rounded-full"
                            aria-label={`Cancelar edição de ${category.name}`}
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex min-h-11 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => selectAndClose(category.slug)}
                            className="agenda-tactile min-h-11 min-w-0 flex-1 rounded-[14px] px-3 text-left text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-pressed={selectedSlug === category.slug}
                          >
                            {category.name}
                            {selectedSlug === category.slug ? (
                              <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                                Selecionada
                              </span>
                            ) : null}
                          </button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingId(category.id);
                              setEditingName(category.name);
                            }}
                            disabled={isMutating}
                            className="notification-liquid-control h-11 w-11 rounded-full"
                            aria-label={`Editar categoria ${category.name}`}
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setConfirmingArchiveId(category.id)}
                            disabled={isMutating}
                            className="notification-liquid-control h-11 w-11 rounded-full text-muted-foreground hover:text-destructive"
                            aria-label={`Remover categoria ${category.name}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
