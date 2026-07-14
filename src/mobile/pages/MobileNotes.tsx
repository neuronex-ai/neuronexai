"use client";

import { Input } from "@/components/ui/input";
import { usePersonalNotes } from "@/hooks/use-personal-notes";
import { PersonalNote } from "@/types";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Search, X } from "lucide-react";
import { useCallback, useState } from "react";
import { MobileLayout } from "../components/MobileLayout";
import { MobileNoteEditor } from "../components/notes/MobileNoteEditor";
import { MobileNotesListView } from "../components/notes/MobileNotesListView";

export const MobileNotes = () => {
    const { notes = [], createNote, updateNote, deleteNote } = usePersonalNotes();
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const selectedNote = (notes ?? []).find((note) => note.id === selectedNoteId);

    const handleUpdateNote = useCallback((id: string, updates: Partial<PersonalNote>) => {
        updateNote({ id, updates });
    }, [updateNote]);

    const handleDeleteNote = useCallback((id: string) => {
        deleteNote(id);
        setSelectedNoteId(null);
    }, [deleteNote]);

    const handleCreateNote = async () => {
        try {
            const newNote = await createNote({
                title: "Nova Nota",
                content: "",
                module_id: null,
                reference_date: new Date().toISOString(),
                tags: [],
                patient_id: null,
            });
            if (newNote) setSelectedNoteId(newNote.id);
        } catch (error) {
            console.error(error);
        }
    };

    const filteredNotes = (notes ?? []).filter((note) =>
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderHeader = () => (
        <div className="relative z-50 mb-3 w-full px-4">
            <div className="flex h-14 w-full items-center justify-between rounded-[20px] border border-white/10 bg-zinc-900/92 p-2 pl-4 shadow-[0_12px_36px_-24px_rgba(0,0,0,0.75)] backdrop-blur-xl">
                {isSearchOpen ? (
                    <motion.div
                        initial={{ opacity: 0, x: 6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.16 }}
                        className="flex w-full flex-1 items-center gap-2"
                    >
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                            <Input
                                autoFocus
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Buscar nota..."
                                className="h-9 rounded-xl border-transparent bg-white/5 pl-9 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-0"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setIsSearchOpen(false);
                                setSearchQuery("");
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 active:bg-white/10 active:text-white"
                            aria-label="Fechar busca"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </motion.div>
                ) : (
                    <>
                        <div className="flex h-full flex-col justify-center">
                            <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-zinc-500">Meus registros</span>
                            <h1 className="text-[15px] font-bold leading-tight tracking-tight text-zinc-100">Notas rápidas</h1>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setIsSearchOpen(true)}
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/5 bg-white/5 text-zinc-400 active:bg-white/10 active:text-white"
                                aria-label="Buscar notas"
                            >
                                <Search className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={handleCreateNote}
                                className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm active:opacity-80"
                                aria-label="Criar nota"
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    const editorOpen = Boolean(selectedNoteId && selectedNote);
    const noteForEditor = selectedNote;

    return (
        <MobileLayout className="bg-background" showNav={!editorOpen} showBottomNav={!editorOpen}>
            <div className="flex h-full min-h-0 flex-col">
                <AnimatePresence mode="wait" initial={false}>
                    {editorOpen && noteForEditor ? (
                        <motion.div
                            key="editor-edit"
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 8 }}
                            transition={{ duration: 0.18 }}
                            className="flex h-full min-h-0 flex-1 flex-col"
                        >
                            <MobileNoteEditor
                                note={noteForEditor}
                                onBack={() => setSelectedNoteId(null)}
                                onUpdate={handleUpdateNote}
                                onDelete={handleDeleteNote}
                            />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="list"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.16 }}
                            className="flex h-full min-h-0 flex-1 flex-col"
                        >
                            {renderHeader()}
                            <MobileNotesListView notes={filteredNotes} onNoteSelect={setSelectedNoteId} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </MobileLayout>
    );
};
