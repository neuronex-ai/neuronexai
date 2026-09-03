"use client";

import { Badge } from "@/components/ui/badge";
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
import { Calendar } from "@/components/ui/calendar";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "@/components/ui/command";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@/components/ui/popover";
import { usePatients } from "@/hooks/use-patients";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";
import {
    Calendar as CalendarIcon, CalendarDays,
    Check,
    ChevronDown, Clock, FileText as FileTextIcon, Mail, Maximize2, MessageCircle as MessageCircleIcon, Minimize2, MoreVertical, Plus, Save, Share2, Tag, Trash2, User, X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { RichTextEditor } from "./RichTextEditor";

interface NoteEditorProps {
  note: any;
  onUpdate: (id: string, updates: any) => Promise<unknown> | void;
  onDelete: (id: string) => void;
  isFocusMode: boolean;
  onToggleFocus: () => void;
  linkableNotes?: { id: string; title?: string | null; content?: string | null }[];
}

const getDisplayTag = (tag: string) =>
  tag.trim().toLowerCase() === "notion" ? "Notion" : tag;

export const NoteEditor = ({
  note,
  onUpdate,
  onDelete,
  isFocusMode,
  onToggleFocus,
  linkableNotes = []
}: NoteEditorProps) => {
  const [title, setTitle] = useState(note.title || "");
  const [content, setContent] = useState(note.content || "");
  const [saveStatus, setSaveStatus] = useState<'saved' | 'pending' | 'saving' | 'error'>('saved');
  const [newTag, setNewTag] = useState("");
  const [showToolbar, setShowToolbar] = useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const toolbarTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestDraftRef = useRef({ title: note.title || "", content: note.content || "" });
  const lastSavedDraftRef = useRef({ title: note.title || "", content: note.content || "" });
  const saveInFlightRef = useRef<Promise<void> | null>(null);
  const saveQueuedRef = useRef(false);
  const flushSaveRef = useRef<() => Promise<void>>(async () => undefined);

  const { data: patients } = usePatients();

  useEffect(() => {
    const nextDraft = { title: note.title || "", content: note.content || "" };
    setTitle(nextDraft.title);
    setContent(nextDraft.content);
    latestDraftRef.current = nextDraft;
    lastSavedDraftRef.current = nextDraft;
    setSaveStatus('saved');
    // Draft replacement is intentionally keyed to note identity. Live title
    // and content reconciliation is handled by the effect immediately below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  const draftsMatch = useCallback((
    first: { title: string; content: string },
    second: { title: string; content: string },
  ) => first.title === second.title && first.content === second.content, []);

  useEffect(() => {
    const serverDraft = { title: note.title || "", content: note.content || "" };
    const localDraft = latestDraftRef.current;
    const lastSavedDraft = lastSavedDraftRef.current;
    const localIsClean = draftsMatch(localDraft, lastSavedDraft);

    if (draftsMatch(serverDraft, localDraft)) {
      lastSavedDraftRef.current = serverDraft;
      if (saveStatus !== 'saving') setSaveStatus('saved');
      return;
    }

    if (localIsClean) {
      setTitle(serverDraft.title);
      setContent(serverDraft.content);
      latestDraftRef.current = serverDraft;
      lastSavedDraftRef.current = serverDraft;
    }
  }, [draftsMatch, note.title, note.content, saveStatus]);

  const flushSave = useCallback(async () => {
    if (saveInFlightRef.current) {
      saveQueuedRef.current = true;
      await saveInFlightRef.current;
      return;
    }

    const draftToSave = { ...latestDraftRef.current };
    if (draftsMatch(draftToSave, lastSavedDraftRef.current)) {
      setSaveStatus('saved');
      return;
    }

    setSaveStatus('saving');
    const request = Promise.resolve(onUpdate(note.id, draftToSave))
      .then(() => {
        lastSavedDraftRef.current = draftToSave;
        setSaveStatus(draftsMatch(latestDraftRef.current, draftToSave) ? 'saved' : 'pending');
      })
      .catch(() => {
        setSaveStatus('error');
      })
      .finally(() => {
        saveInFlightRef.current = null;
        const shouldContinue = saveQueuedRef.current
          || !draftsMatch(latestDraftRef.current, lastSavedDraftRef.current);
        saveQueuedRef.current = false;
        if (shouldContinue) void flushSaveRef.current();
      });

    saveInFlightRef.current = request;
    await request;
  }, [draftsMatch, note.id, onUpdate]);

  useEffect(() => {
    flushSaveRef.current = flushSave;
  }, [flushSave]);

  const updateDraft = useCallback((updates: Partial<{ title: string; content: string }>) => {
    const nextDraft = { ...latestDraftRef.current, ...updates };
    latestDraftRef.current = nextDraft;
    if (updates.title !== undefined) setTitle(updates.title);
    const nextStatus = draftsMatch(nextDraft, lastSavedDraftRef.current) ? 'saved' : 'pending';
    setSaveStatus(nextStatus);

    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    if (nextStatus === 'pending') {
      autosaveTimeoutRef.current = setTimeout(() => {
        void flushSaveRef.current();
      }, 900);
    }
  }, [draftsMatch]);

  const handleMetadataUpdate = useCallback(async (updates: any) => {
    setSaveStatus('saving');
    try {
      await Promise.resolve(onUpdate(note.id, updates));
      setSaveStatus(draftsMatch(latestDraftRef.current, lastSavedDraftRef.current) ? 'saved' : 'pending');
    } catch {
      setSaveStatus('error');
    }
  }, [draftsMatch, note.id, onUpdate]);

  // Zen Mode Toolbar Visibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFocusMode) {
        onToggleFocus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    if (!isFocusMode) {
      setShowToolbar(true);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }

    const handleMouseMove = () => {
      setShowToolbar(true);
      if (toolbarTimeoutRef.current) clearTimeout(toolbarTimeoutRef.current);
      toolbarTimeoutRef.current = setTimeout(() => {
        setShowToolbar(false);
      }, 3000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    handleMouseMove();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (toolbarTimeoutRef.current) clearTimeout(toolbarTimeoutRef.current);
    };
  }, [isFocusMode, onToggleFocus]);

  // Save on Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        void flushSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flushSave]);

  useEffect(() => () => {
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    void flushSaveRef.current();
  }, []);

  const selectedPatient = useMemo(() =>
    patients?.find(p => p.id === note.patient_id),
    [patients, note.patient_id]
  );

  const handleAddTag = () => {
    if (!newTag.trim()) return;
    const tags = note.tags || [];
    if (!tags.includes(newTag.trim())) {
      void handleMetadataUpdate({ tags: [...tags, newTag.trim()] });
    }
    setNewTag("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const tags = note.tags || [];
    void handleMetadataUpdate({ tags: tags.filter((t: string) => t !== tagToRemove) });
  };

  const getPlainTextContent = useCallback(() => {
    return latestDraftRef.current.content.replace(/<[^>]*>/g, '').trim();
  }, []);

  const handleShareGoogleDocs = useCallback(async () => {
    const plainText = getPlainTextContent();
    const loadingToast = toast.loading("Preparando documento no Google Docs...");

    try {
      const { data, error } = await supabase.functions.invoke('google-suite-action', {
        body: {
          action: 'create_doc',
          title: title || 'Nota Clínica - NeuroNex',
          content: plainText
        }
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
        toast.success("Documento criado com sucesso!", { id: loadingToast });
      } else {
        throw new Error("Não foi possível gerar a URL do documento.");
      }
    } catch (err: any) {
      console.error('Erro ao exportar para Google Docs:', err);
      toast.error("Erro ao exportar", {
        id: loadingToast,
        description: err.message === "Google account not connected"
          ? "Sua conta Google não está conectada. Conecte-a nas configurações."
          : "Certifique-se de que sua conta Google está conectada."
      });
    }
  }, [title, getPlainTextContent]);

  const handleShareWhatsApp = useCallback(() => {
    const plainText = `*${title}*\n\n${getPlainTextContent()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(plainText)}`, '_blank');
    toast.success("Abrindo WhatsApp...");
  }, [title, getPlainTextContent]);

  const handleShareGmail = useCallback(() => {
    const plainText = getPlainTextContent();
    const subject = encodeURIComponent(title || 'Nota Clínica - NeuroNex');
    const body = encodeURIComponent(plainText);
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`, '_blank');
    toast.success("Abrindo Gmail...");
  }, [title, getPlainTextContent]);

  const handleCopyToClipboard = useCallback(() => {
    const text = `${title}\n\n${getPlainTextContent()}`;
    navigator.clipboard.writeText(text);
    toast.success("Conteúdo copiado!");
  }, [title, getPlainTextContent]);

  return (
    <div className={cn(
      "flex min-h-0 flex-col h-full w-full bg-transparent font-sans relative transition-[background-color,opacity] duration-300",
      isFocusMode ? "notes-focus-surface fixed inset-0 z-[60] overflow-hidden" : ""
    )}>
      {/* Editor Toolbar */}
      <AnimatePresence>
        {showToolbar && (
          <motion.div
            initial={false}
            animate={isFocusMode ? { opacity: 1, y: 0, x: "-50%" } : { opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={cn(
              "notes-toolbar-surface h-[52px] px-4 md:px-6 flex items-center justify-between z-50 transition-[border-radius,box-shadow,background-color] duration-300 backdrop-blur-3xl",
              isFocusMode
                ? "fixed left-1/2 top-8 h-[52px] w-[90%] max-w-4xl rounded-2xl border"
                : "sticky top-0 border-b"
            )}
          >
            <div className="flex items-center gap-2 md:gap-4">
              {/* Patient Selector */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "group h-9 gap-2 rounded-xl border px-3 shadow-none backdrop-blur-xl transition-[background-color,border-color,color,box-shadow] duration-200",
                      selectedPatient
                        ? "border-zinc-200/80 bg-zinc-100/80 text-zinc-900 hover:bg-zinc-100 dark:border-white/[0.09] dark:bg-white/[0.055] dark:text-zinc-100 dark:hover:bg-white/[0.075]"
                        : "border-zinc-200/70 bg-white/65 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-100/75 hover:text-zinc-900 dark:border-white/[0.075] dark:bg-white/[0.028] dark:text-zinc-400 dark:hover:border-white/[0.12] dark:hover:bg-white/[0.055] dark:hover:text-zinc-100"
                    )}
                  >
                    <User className="h-3.5 w-3.5 shrink-0 opacity-75" />
                    <span className="max-w-[132px] truncate text-xs font-semibold tracking-tight">
                      {selectedPatient ? selectedPatient.name : "Vincular"}
                    </span>
                    <ChevronDown className="h-3 w-3 shrink-0 opacity-45 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[336px] overflow-hidden rounded-[22px] border border-zinc-200/75 bg-white/96 p-2 text-zinc-950 shadow-[0_28px_72px_-34px_rgba(0,0,0,0.38)] backdrop-blur-3xl dark:border-white/[0.085] dark:bg-[#0b0b0c]/96 dark:text-zinc-100 dark:shadow-[0_32px_80px_-38px_rgba(0,0,0,0.9)]"
                  align="start"
                  sideOffset={8}
                >
                  <Command className="bg-transparent text-inherit [&_[cmdk-input-wrapper]]:mx-1 [&_[cmdk-input-wrapper]]:mb-1.5 [&_[cmdk-input-wrapper]]:rounded-xl [&_[cmdk-input-wrapper]]:border [&_[cmdk-input-wrapper]]:border-zinc-200/75 [&_[cmdk-input-wrapper]]:bg-zinc-50/85 [&_[cmdk-input-wrapper]]:px-3 [&_[cmdk-input-wrapper]]:shadow-none dark:[&_[cmdk-input-wrapper]]:border-white/[0.07] dark:[&_[cmdk-input-wrapper]]:bg-white/[0.035]">
                    <CommandInput
                      placeholder="Buscar paciente..."
                      className="h-10 border-none text-sm text-zinc-900 placeholder:text-zinc-400 focus:ring-0 dark:text-zinc-100 dark:placeholder:text-zinc-600"
                    />
                    <CommandList className="custom-scrollbar max-h-[292px] p-1">
                      <CommandEmpty className="py-8 text-center text-xs text-zinc-400 dark:text-zinc-600">Nenhum paciente encontrado.</CommandEmpty>
                      <CommandGroup className="p-0">
                        {patients?.map((patient) => (
                          <CommandItem
                            key={patient.id}
                            onSelect={() => void handleMetadataUpdate({ patient_id: patient.id })}
                            className="mx-0.5 flex min-h-11 cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-zinc-700 transition-colors aria-selected:bg-zinc-100 aria-selected:text-zinc-950 dark:text-zinc-300 dark:aria-selected:bg-white/[0.06] dark:aria-selected:text-white"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-200/80 bg-zinc-100 text-[10px] font-bold text-zinc-600 dark:border-white/[0.07] dark:bg-white/[0.055] dark:text-zinc-300">
                                {patient.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="truncate text-sm font-semibold tracking-tight">{patient.name}</span>
                            </div>
                            {note.patient_id === patient.id && (
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-950">
                                <Check className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </CommandItem>
                        ))}
                        {note.patient_id && (
                          <CommandItem
                            onSelect={() => void handleMetadataUpdate({ patient_id: null })}
                            className="mx-0.5 mt-1.5 flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border-t border-zinc-200/70 px-3 py-2.5 text-zinc-400 aria-selected:bg-red-50 aria-selected:text-red-600 dark:border-white/[0.06] dark:text-zinc-600 dark:aria-selected:bg-red-500/10 dark:aria-selected:text-red-400"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span className="text-xs font-semibold">Desvincular paciente</span>
                          </CommandItem>
                        )}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Date/Time Selector */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-3 rounded-xl bg-background/45 border border-border/45 text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-all duration-200 gap-2"
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span className="text-xs font-semibold tracking-tight">
                      {note.reference_date ? format(new Date(note.reference_date), "dd/MM/yyyy", { locale: ptBR }) : "Data"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="notes-liquid-surface w-auto p-4 backdrop-blur-3xl rounded-2xl shadow-xl" align="start">
                  <div className="space-y-4">
                    <Calendar
                      mode="single"
                      selected={note.reference_date ? new Date(note.reference_date) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const newDate = note.reference_date ? new Date(note.reference_date) : new Date();
                          newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                          void handleMetadataUpdate({ reference_date: newDate.toISOString() });
                        }
                      }}
                      className="rounded-xl border border-border/60 bg-background/70 shadow-sm text-foreground"
                    />
                    <div className="flex items-center gap-3 px-2 pt-2 border-t border-zinc-200 dark:border-white/10">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <Input
                        type="time"
                        value={note.reference_date ? format(new Date(note.reference_date), "HH:mm") : "00:00"}
                        onChange={(e) => {
                          const [hours, minutes] = e.target.value.split(':');
                          const newDate = note.reference_date ? new Date(note.reference_date) : new Date();
                          newDate.setHours(parseInt(hours), parseInt(minutes));
                          void handleMetadataUpdate({ reference_date: newDate.toISOString() });
                        }}
                        className="h-8 w-full bg-background/60 border-border/50 rounded-lg text-xs text-foreground"
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {(saveStatus === 'saving' || saveStatus === 'saved' || saveStatus === 'error') && (
                <div className="flex items-center gap-2 px-3 h-7 rounded-full border border-border/45 bg-background/35 transition-all duration-300">
                  <div className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    saveStatus === 'saving' && "animate-pulse bg-primary",
                    saveStatus === 'saved' && "bg-emerald-400",
                    saveStatus === 'error' && "bg-red-400",
                  )} />
                  <span className="text-[8px] font-black uppercase tracking-[0.18em] leading-none text-muted-foreground">
                    {saveStatus === 'saving' ? 'Salvando' : saveStatus === 'error' ? 'Não foi salvo' : 'Salvo'}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleFocus}
                className={cn(
                  "h-9 w-9 rounded-lg transition-all duration-200",
                  isFocusMode
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                )}
                title={isFocusMode ? "Sair do modo foco" : "Modo foco"}
              >
                {isFocusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all"
                    title="Compartilhar"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="notes-liquid-surface w-64 p-2 backdrop-blur-3xl rounded-2xl shadow-2xl">
                  <DropdownMenuLabel className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] px-3 py-2">Exportar Nota Para</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={handleShareGoogleDocs}
                    className="rounded-xl cursor-pointer text-foreground/82 text-xs font-semibold py-3 px-3 gap-3 hover:bg-muted/65 transition-all"
                  >
                    <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10"><FileTextIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" /></div>
                    Google Docs
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleShareWhatsApp}
                    className="rounded-xl cursor-pointer text-foreground/82 text-xs font-semibold py-3 px-3 gap-3 hover:bg-muted/65 transition-all"
                  >
                    <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10"><MessageCircleIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /></div>
                    WhatsApp
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleShareGmail}
                    className="rounded-xl cursor-pointer text-foreground/82 text-xs font-semibold py-3 px-3 gap-3 hover:bg-muted/65 transition-all"
                  >
                    <div className="p-1.5 rounded-lg bg-red-50 dark:bg-red-500/10"><Mail className="h-4 w-4 text-red-600 dark:text-red-400" /></div>
                    Gmail
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border/60 my-1" />
                  <DropdownMenuItem
                    onClick={handleCopyToClipboard}
                    className="rounded-xl cursor-pointer text-muted-foreground text-xs font-semibold py-3 px-3 gap-3 hover:bg-muted/65 hover:text-foreground transition-all"
                  >
                    <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-white/5"><Share2 className="h-4 w-4" /></div>
                    Copiar Texto
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="notes-liquid-surface w-56 p-1.5 backdrop-blur-3xl rounded-2xl shadow-xl">
                  <DropdownMenuLabel className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider px-2 py-1.5">Tags</DropdownMenuLabel>
                  <div className="px-2 pb-2 space-y-2">
                    <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto custom-scrollbar">
                      {note.tags?.map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="bg-muted/75 hover:bg-muted text-[10px] py-0.5 px-1.5 gap-1 border-transparent rounded-md text-foreground/80 font-medium">
                          {getDisplayTag(tag)}
                          <X className="h-2.5 w-2.5 cursor-pointer opacity-50 hover:opacity-100" onClick={() => handleRemoveTag(tag)} />
                        </Badge>
                      ))}
                      {(!note.tags || note.tags.length === 0) && (
                        <span className="text-[10px] text-muted-foreground italic">Sem tags</span>
                      )}
                    </div>
                    <div className="flex gap-1.5 pt-1">
                      <Input
                        placeholder="Nova tag..."
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                        className="h-7 bg-background/55 border-border/45 text-xs rounded shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 text-foreground"
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7 rounded hover:bg-muted/70" onClick={handleAddTag}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <DropdownMenuSeparator className="bg-border/60 my-1" />
                  <DropdownMenuItem
                    className="rounded-lg px-2 py-2 text-xs font-medium gap-2 text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                    onClick={() => setIsDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" /> Excluir Nota
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                onClick={() => void flushSave()}
                size="sm"
                className="ml-2 h-9 px-4 rounded-lg font-semibold text-xs shadow-sm active:scale-95 transition-all gap-2 bg-foreground text-background hover:bg-foreground/90"
              >
                <Save className="h-3.5 w-3.5" />
                Salvar
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editor Content Area */}
      <div className={cn(
        "notes-scroll-surface relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain bg-transparent custom-scrollbar [scrollbar-gutter:stable]",
        isFocusMode ? "pt-40 pb-60" : ""
      )}>
        <div className={cn(
          "mx-auto max-w-[840px] space-y-8 px-7 py-10 md:px-12",
          isFocusMode ? "max-w-[1200px] py-40" : ""
        )}>
          {/* Header Metadata */}
          <div className={cn(
            "space-y-5 animate-in fade-in slide-in-from-top-4 duration-700",
            isFocusMode ? "mb-32" : "mb-7"
          )}>
            {/* Title Input */}
            <motion.input
              initial={false}
              animate={isFocusMode ? { scale: 1.05, y: -20 } : { scale: 1, y: 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 100 }}
              value={title}
              onChange={(e) => updateDraft({ title: e.target.value })}
              onBlur={() => void flushSave()}
              placeholder="Nota sem título"
              className={cn(
                "w-full bg-transparent border-none focus:ring-0 font-black tracking-tighter text-foreground placeholder:text-muted-foreground/45 focus:outline-none py-2 selection:bg-primary/25 selection:text-foreground leading-[1.1] transition-all dark:selection:bg-primary/35",
                isFocusMode ? "text-6xl md:text-8xl text-center" : "text-3xl md:text-4xl",
                !title && "animate-shimmer"
              )}
            />

            <div className={cn(
              "flex flex-wrap items-center gap-4 text-muted-foreground text-[10px] font-black uppercase tracking-[0.24em]",
              isFocusMode ? "justify-center" : ""
            )}>
              <div className="flex items-center gap-2 rounded-full border border-border/45 bg-background/35 px-3 py-1.5 hover:text-foreground transition-colors cursor-default group">
                <CalendarIcon className="h-3.5 w-3.5 group-hover:text-primary transition-colors" />
                <span>{format(new Date(note.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-border/45 bg-background/35 px-3 py-1.5 hover:text-foreground transition-colors cursor-default group">
                <Clock className="h-3.5 w-3.5 group-hover:text-primary transition-colors" />
                <span>{format(new Date(note.updated_at), "HH:mm")}</span>
              </div>

              {note.tags && note.tags.length > 0 && (
                <>
                  <div className="flex items-center gap-2">
                    {note.tags.map((tag: string) => (
                      <span key={tag} className="flex items-center gap-2 rounded-full border border-primary/18 bg-primary/8 px-3 py-1.5 text-primary transition-colors cursor-default">
                        <Tag className="h-3 w-3" />
                        {getDisplayTag(tag)}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          {/* Rich Text Editor */}
          <div className="relative min-h-[480px] pb-28 animate-in fade-in duration-500 delay-100">
            <div className="pointer-events-none absolute -inset-x-4 -top-4 h-32 rounded-[32px] bg-gradient-to-b from-primary/[0.035] to-transparent opacity-80" />
            <RichTextEditor
              content={content}
              onChange={(html) => updateDraft({ content: html })}
              placeholder="Comece a escrever... Digite '/' para comandos."
              className="prose-lg focus:outline-none max-w-none text-foreground leading-relaxed font-sans"
              editable={true}
              patients={patients?.map(p => ({ id: p.id, name: p.name }))}
              linkableNotes={linkableNotes.filter((item) => item.id !== note.id)}
              isFocusMode={isFocusMode}
            />
          </div>
        </div>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md rounded-[26px] border-white/[0.08] bg-zinc-950/95 p-0 text-white shadow-[0_36px_100px_-32px_rgba(0,0,0,0.9)] backdrop-blur-3xl [.light_&]:border-zinc-200/80 [.light_&]:bg-white/95 [.light_&]:text-zinc-950">
          <div className="p-6">
            <AlertDialogHeader className="space-y-3">
              <AlertDialogTitle className="text-xl font-black tracking-tight">Excluir esta nota?</AlertDialogTitle>
              <AlertDialogDescription className="text-sm leading-relaxed text-zinc-400 [.light_&]:text-zinc-600">
                Esta ação é permanente e a nota não poderá ser recuperada depois.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-7 gap-2">
              <AlertDialogCancel className="h-11 rounded-xl border-white/[0.08] bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white [.light_&]:border-zinc-200 [.light_&]:bg-white [.light_&]:text-zinc-700 [.light_&]:hover:bg-zinc-100">
                Manter nota
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(note.id)}
                className="h-11 rounded-xl bg-red-500 text-white hover:bg-red-600"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.1); border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        
        @keyframes float-slow {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(5% , 5%) scale(1.1); }
          100% { transform: translate(0, 0) scale(1); }
        }
        
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        
        .animate-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
          background-size: 200% 100%;
          animation: shimmer 3s infinite;
        }

        .animate-float-slow {
          animation: float-slow 20s ease-in-out infinite;
        }
        
        .animate-float-slower {
          animation: float-slow 30s ease-in-out infinite reverse;
        }
      `}</style>
    </div>
  );
};
