"use client";

import { lazy, Suspense, useState, useMemo, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion, type Transition } from "framer-motion";

import { usePersonalNotes } from "@/hooks/use-personal-notes";
import { useReminders } from "@/hooks/use-reminders";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
    SYNAPSE_PAGE_ACTION_EVENT,
    type SynapseInterfaceAction,
    type SynapseNeuroViewDirective,
    type SynapseNotesView,
} from "@/lib/synapse-interface-actions";

// Sub-components
import { NotesSidebar } from "@/components/notes/NotesSidebar";
import { NotesListPanel } from "@/components/notes/NotesListPanel";

import { useIsMobile } from "@/hooks/use-mobile";
import { useSynapseNotesAgentRun } from "@/hooks/use-synapse-notes-agent-run";
import { clearSynapseNotesNavigationState } from "@/lib/synapse-navigation";

const TaskBoard = lazy(() =>
    import("@/components/notes/TaskBoard").then((module) => ({ default: module.TaskBoard }))
);
const NeuroVision = lazy(() =>
    import("@/components/notes/NeuroView").then((module) => ({ default: module.NeuroVision }))
);
const NeuroFlow = lazy(() =>
    import("@/components/notes/NeuroFlow").then((module) => ({ default: module.NeuroFlow }))
);
const NeuroFlowVault = lazy(() =>
    import("@/components/notes/NeuroFlowVault").then((module) => ({ default: module.NeuroFlowVault }))
);
const NeuroPulse = lazy(() =>
    import("@/components/notes/NeuroPulse").then((module) => ({ default: module.NeuroPulse }))
);
const FilesManager = lazy(() =>
    import("@/components/notes/FilesManager").then((module) => ({ default: module.FilesManager }))
);
const NotionPagesPanel = lazy(() =>
    import("@/components/notes/NotionPagesPanel").then((module) => ({ default: module.NotionPagesPanel }))
);
const MobileNotes = lazy(() =>
    import("@/mobile/pages/MobileNotes").then((module) => ({ default: module.MobileNotes }))
);

const NoteEditor = lazy(() =>
    import("@/components/notes/NoteEditor").then((module) => ({ default: module.NoteEditor }))
);

const NOTES_LAYOUT_STORAGE_KEY = "neuronex:notes-layout";
type NotesViewMode = "notes" | "tasks" | "neuroview" | "neuroflow" | "neuropulse" | "files" | "notion";
const SYNAPSE_SUPPORTED_NOTES_VIEWS = new Set<SynapseNotesView>(["notes", "tasks", "files", "notion", "neuroview", "neuroflow", "neuropulse"]);

const loadLayoutPreference = () => {
    try {
        const stored = window.localStorage.getItem(NOTES_LAYOUT_STORAGE_KEY);
        if (!stored) return { sidebarCollapsed: false, listCollapsed: false };
        const parsed = JSON.parse(stored);
        return {
            sidebarCollapsed: Boolean(parsed.sidebarCollapsed),
            listCollapsed: Boolean(parsed.listCollapsed),
        };
    } catch {
        return { sidebarCollapsed: false, listCollapsed: false };
    }
};

const NoteEditorSkeleton = () => (
    <div className="flex h-full flex-col animate-pulse">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.05] px-7 [.light_&]:border-zinc-200/60">
            <div className="h-8 w-40 rounded-xl bg-white/[0.04] [.light_&]:bg-zinc-100" />
            <div className="flex gap-2">
                <div className="h-8 w-8 rounded-xl bg-white/[0.04] [.light_&]:bg-zinc-100" />
                <div className="h-8 w-20 rounded-xl bg-white/[0.04] [.light_&]:bg-zinc-100" />
            </div>
        </div>
        <div className="mx-auto w-full max-w-[820px] flex-1 space-y-7 px-12 py-12">
            <div className="h-12 w-2/3 rounded-2xl bg-white/[0.045] [.light_&]:bg-zinc-100" />
            <div className="h-px bg-white/[0.05] [.light_&]:bg-zinc-200" />
            <div className="space-y-4">
                <div className="h-4 w-full rounded bg-white/[0.035] [.light_&]:bg-zinc-100" />
                <div className="h-4 w-11/12 rounded bg-white/[0.035] [.light_&]:bg-zinc-100" />
                <div className="h-4 w-4/5 rounded bg-white/[0.035] [.light_&]:bg-zinc-100" />
            </div>
        </div>
    </div>
);

export default function Notes() {
    const isMobile = useIsMobile();
    const shouldReduceMotion = useReducedMotion();
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const noteIdParam = searchParams.get("noteId");

    const [viewMode, setViewMode] = useState<NotesViewMode>("notes");
    const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedNotionPageId, setSelectedNotionPageId] = useState<string | null>(null);
    const [synapseFilesTab, setSynapseFilesTab] = useState<"personal" | "patients">("personal");

    const initialLayout = useMemo(loadLayoutPreference, []);
    const [isListCollapsed, setIsListCollapsed] = useState(initialLayout.listCollapsed);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(initialLayout.sidebarCollapsed);

    const [isFocusMode, setIsFocusMode] = useState(false);
    const handleToggleFocus = useCallback(() => setIsFocusMode((current) => !current), []);
    const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
    const [synapseRunId, setSynapseRunId] = useState<string | null>(null);
    const [synapsePatientId, setSynapsePatientId] = useState<string | null>(null);
    const [synapsePulseEntryId, setSynapsePulseEntryId] = useState<string | null>(null);
    const [synapseNoteId, setSynapseNoteId] = useState<string | null>(null);
    const [synapseMermaid, setSynapseMermaid] = useState<string | null>(null);
    const [synapseTrace, setSynapseTrace] = useState<unknown>(null);
    const [synapseNeuroViewDirective, setSynapseNeuroViewDirective] = useState<SynapseNeuroViewDirective | null>(null);
    const { run: synapseRun } = useSynapseNotesAgentRun(synapseRunId);

    useEffect(() => {
        if (!synapseRun) return;

        if (synapseRun.patient_id) setSynapsePatientId(synapseRun.patient_id);
        if (synapseRun.trace) setSynapseTrace(synapseRun.trace);

        if (synapseRun.product === "neuroflow") {
            setViewMode("neuroflow");
            if (synapseRun.target_flow_id) setSelectedFlowId(synapseRun.target_flow_id);
            return;
        }

        if (synapseRun.product === "neuropulse") {
            setViewMode("neuropulse");
            if (synapseRun.pulse_entry_id) setSynapsePulseEntryId(synapseRun.pulse_entry_id);
            if (synapseRun.note_id) setSynapseNoteId(synapseRun.note_id);
            const mermaid = typeof synapseRun.result?.mermaid === "string" ? synapseRun.result.mermaid : null;
            if (mermaid) setSynapseMermaid(mermaid);
            return;
        }

        if (synapseRun.product === "neuroview") {
            setViewMode("neuroview");
            setSynapseNeuroViewDirective((current) => {
                if (current) return current;
                const nodeIds = (synapseRun.trace?.nodes || [])
                    .map((node) => node.id)
                    .filter((id): id is string => typeof id === "string" && id.length > 0);
                return {
                    scope: nodeIds.length ? "subgraph" : synapseRun.patient_id ? "patient" : "all",
                    mode: "2d",
                    nodeIds: nodeIds.length ? nodeIds : undefined,
                };
            });
        }
    }, [synapseRun]);

    const {
        notes,
        createNote,
        updateNote,
        updateNoteAsync,
        deleteNote,
        isLoading: isLoadingNotes,
        isCreatingNote,
    } = usePersonalNotes();

    const {
        reminders,
        toggleReminder,
        deleteReminder,
        createReminder,
        updateReminderCategory,
        updateReminder,
    } = useReminders();

    const createNoteFromSynapseOrClick = useCallback(async (moduleId?: string | null) => {
        if (isCreatingNote) return null;
        try {
            const newNote = await createNote({
                title: "Nova Nota",
                content: "",
                module_id: moduleId ?? selectedModuleId,
                reference_date: new Date().toISOString(),
                tags: [],
                patient_id: null,
            });
            if (newNote) {
                setSelectedNoteId(newNote.id);
                setViewMode("notes");
                if (isListCollapsed) setIsListCollapsed(false);
            }
            return newNote;
        } catch (error) {
            console.error(error);
            return null;
        }
    }, [createNote, isCreatingNote, isListCollapsed, selectedModuleId]);

    const handleCreateNote = useCallback(async () => {
        await createNoteFromSynapseOrClick();
    }, [createNoteFromSynapseOrClick]);

    const applySynapseNotesAction = useCallback((action: Partial<SynapseInterfaceAction>) => {
        const notesView = action.notesView && SYNAPSE_SUPPORTED_NOTES_VIEWS.has(action.notesView) ? action.notesView : undefined;
        const actionName = action.action;

        if (actionName === "open_tasks_board") setViewMode("tasks");
        else if (actionName === "open_files_manager" || actionName === "open_file_preview") setViewMode("files");
        else if (actionName === "open_notion_panel") setViewMode("notion");
        else if (actionName === "open_neuroview_reasoning") setViewMode("neuroview");
        else if (actionName === "open_neuroflow_generation") setViewMode("neuroflow");
        else if (actionName === "open_neuropulse_diagram") setViewMode("neuropulse");
        else if (notesView) setViewMode(notesView);
        else if (["open_notes_desktop", "open_note", "filter_notes", "open_new_note", "open_note_module"].includes(String(actionName))) setViewMode("notes");

        if (action.runId) setSynapseRunId(action.runId);
        if (action.patientId) setSynapsePatientId(action.patientId);
        if (action.pulseEntryId) setSynapsePulseEntryId(action.pulseEntryId);
        if (action.noteId) setSynapseNoteId(action.noteId);
        if (typeof action.mermaid === "string") setSynapseMermaid(action.mermaid);
        if (action.trace) setSynapseTrace(action.trace);
        if (actionName === "open_neuroview_reasoning") {
            const trace = action.trace && typeof action.trace === "object"
                ? action.trace as { nodes?: Array<{ id?: unknown }> }
                : null;
            const traceNodeIds = (trace?.nodes || [])
                .map((node) => node.id)
                .filter((id): id is string => typeof id === "string" && id.length > 0);

            setSynapseNeuroViewDirective((current) => {
                const fallbackScope = traceNodeIds.length
                    ? "subgraph"
                    : action.patientId
                        ? "patient"
                        : current?.scope || "all";
                const scope = action.neuroViewScope || fallbackScope;
                const scopeChanged = Boolean(action.neuroViewScope && action.neuroViewScope !== current?.scope);
                const nodeIds = action.neuroViewNodeIds
                    || (traceNodeIds.length ? traceNodeIds : undefined)
                    || (scopeChanged ? undefined : current?.nodeIds);
                return {
                    scope,
                    mode: action.neuroViewMode,
                    nodeIds,
                    focusNodeId: action.neuroViewFocusNodeId
                        || (scopeChanged ? undefined : current?.focusNodeId),
                };
            });
        }
        if (action.flowId) {
            setSelectedFlowId(action.flowId);
            setViewMode("neuroflow");
        }

        if (action.filesTab) setSynapseFilesTab(action.filesTab);

        if (typeof action.query === "string") {
            setSearchQuery(action.query);
            if (isListCollapsed) setIsListCollapsed(false);
        }

        if (action.moduleId) {
            setSelectedModuleId(action.moduleId);
            setViewMode("notes");
            if (isSidebarCollapsed) setIsSidebarCollapsed(false);
        }

        if (action.noteId && actionName !== "open_neuropulse_diagram") {
            setSelectedNoteId(action.noteId);
            setViewMode("notes");
            if (isListCollapsed) setIsListCollapsed(false);
        }

        if (actionName === "open_new_note") {
            void createNoteFromSynapseOrClick(action.moduleId || null);
        }
    }, [createNoteFromSynapseOrClick, isListCollapsed, isSidebarCollapsed]);

    useEffect(() => {
        if (noteIdParam && notes) {
            const targetNote = notes.find((note) => note.id === noteIdParam);
            if (targetNote) {
                setSelectedNoteId(noteIdParam);
                setViewMode("notes");
            }
        }
    }, [noteIdParam, notes]);

    useEffect(() => {
        const state = (location.state || {}) as Record<string, any>;
        if (!state.synapseAction && !state.synapseNotesView && !state.synapseNoteId && !state.synapseQuery && !state.synapseModuleId && !state.synapseRunId && !state.synapseFlowId && !state.synapseMermaid) return;
        applySynapseNotesAction({
            action: state.synapseAction,
            notesView: state.synapseNotesView,
            query: state.synapseQuery,
            noteId: state.synapseNoteId,
            moduleId: state.synapseModuleId,
            taskId: state.synapseTaskId,
            fileId: state.synapseFileId,
            flowId: state.synapseFlowId,
            runId: state.synapseRunId,
            patientId: state.synapsePatientId,
            pulseEntryId: state.synapsePulseEntryId,
            mermaid: state.synapseMermaid,
            trace: state.synapseTrace,
            neuroViewScope: state.synapseNeuroViewScope,
            neuroViewMode: state.synapseNeuroViewMode,
            neuroViewNodeIds: state.synapseNeuroViewNodeIds,
            neuroViewFocusNodeId: state.synapseNeuroViewFocusNodeId,
            filesTab: state.synapseFilesTab,
            destination: state.synapseDestination,
        });
        clearSynapseNotesNavigationState(navigate, location.pathname, location.search);
    }, [applySynapseNotesAction, location.pathname, location.search, location.state, navigate]);

    useEffect(() => {
        const handleSynapseAction = (event: Event) => {
            const action = (event as CustomEvent<SynapseInterfaceAction>).detail;
            if (!action) return;
            if (!["open_notes_desktop", "switch_notes_view", "open_note", "filter_notes", "open_new_note", "open_note_module", "open_tasks_board", "open_files_manager", "open_notion_panel", "open_file_preview", "open_neuroview_reasoning", "open_neuroflow_generation", "open_neuropulse_diagram"].includes(action.action)) return;
            applySynapseNotesAction(action);
        };
        window.addEventListener(SYNAPSE_PAGE_ACTION_EVENT, handleSynapseAction);
        return () => window.removeEventListener(SYNAPSE_PAGE_ACTION_EVENT, handleSynapseAction);
    }, [applySynapseNotesAction]);

    useEffect(() => {
        const handleNeuroFlowNavigate = (event: Event) => {
            const { flowId } = (event as CustomEvent<{ flowId?: string }>).detail ?? {};
            if (flowId) {
                setSelectedFlowId(flowId);
                setViewMode("neuroflow");
            }
        };
        window.addEventListener("neuroflow:navigate", handleNeuroFlowNavigate);
        return () => window.removeEventListener("neuroflow:navigate", handleNeuroFlowNavigate);
    }, []);

    useEffect(() => {
        window.localStorage.setItem(
            NOTES_LAYOUT_STORAGE_KEY,
            JSON.stringify({ sidebarCollapsed: isSidebarCollapsed, listCollapsed: isListCollapsed })
        );
    }, [isListCollapsed, isSidebarCollapsed]);

    const filteredNotes = useMemo(() => {
        if (!notes) return [];
        return notes.filter((note) => {
            const matchesModule = selectedModuleId ? note.module_id === selectedModuleId : true;
            const matchesSearch =
                note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (note.tags || []).some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesModule && matchesSearch;
        });
    }, [notes, selectedModuleId, searchQuery]);

    if (isMobile) {
        return (
            <Suspense fallback={<NoteEditorSkeleton />}>
                <MobileNotes />
            </Suspense>
        );
    }

    const activeNote = notes?.find((note) => note.id === selectedNoteId);

    const renderMainContent = () => {
        const contentTransition: Transition = {
            duration: shouldReduceMotion ? 0 : 0.4,
            ease: [0.23, 1, 0.32, 1],
        };
        const motionProps = {
            initial: { opacity: 0, y: 10 },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: -10 },
            transition: contentTransition,
        };

        switch (viewMode) {
            case "files":
                return (
                    <motion.div {...motionProps} className="flex-1 h-full min-h-0 min-w-0" data-synapse-target="files-manager">
                        <FilesManager initialTab={synapseFilesTab} />
                    </motion.div>
                );
            case "notion":
                return (
                    <motion.div {...motionProps} className="relative z-30 flex-1 h-full min-h-0 min-w-0" data-synapse-target="notion-panel">
                        <NotionPagesPanel
                            selectedPageId={selectedNotionPageId}
                            onSelectNotionPage={setSelectedNotionPageId}
                            onImportedNote={(noteId) => {
                                setSelectedNoteId(noteId);
                                setViewMode("notes");
                                if (isListCollapsed) setIsListCollapsed(false);
                            }}
                        />
                    </motion.div>
                );
            case "tasks":
                return (
                    <motion.div {...motionProps} className="flex-1 overflow-hidden" style={{ minHeight: 0, minWidth: 0, height: "100%" }} data-synapse-target="tasks-board">
                        <TaskBoard
                            tasks={reminders || []}
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            onToggle={(id, status) => toggleReminder({ id, is_completed: status })}
                            onDelete={deleteReminder}
                            onCreate={(title, date, category) => createReminder({ title, due_date: date.toISOString(), is_completed: false, category })}
                            onUpdateCategory={(id, category) => updateReminderCategory({ id, category })}
                            onUpdate={(id, updates) => updateReminder({ id, updates })}
                            isListCollapsed={isListCollapsed}
                            onToggleListCollapsed={() => setIsListCollapsed((current) => !current)}
                        />
                    </motion.div>
                );
            case "neuroview":
                return (
                    <motion.div {...motionProps} className="relative flex-1 h-full min-h-0 min-w-0 overflow-hidden" data-synapse-target="neuroview-graph" data-synapse-product="neuroview" data-synapse-run-id={synapseRunId || undefined}>
                        <NeuroVision synapseRunId={synapseRunId} synapsePatientId={synapsePatientId} synapseTrace={synapseTrace} synapseDirective={synapseNeuroViewDirective} />
                    </motion.div>
                );
            case "neuroflow":
                return (
                    <motion.div {...motionProps} className="relative flex-1 h-full min-h-0 min-w-0 overflow-hidden" data-synapse-target="neuroflow-canvas" data-synapse-ready={selectedFlowId ? undefined : "true"} data-synapse-product="neuroflow" data-synapse-run-id={synapseRunId || undefined}>
                        {selectedFlowId ? <NeuroFlow flowId={selectedFlowId} synapseRunId={synapseRunId} onBack={() => setSelectedFlowId(null)} /> : <NeuroFlowVault onOpenFlow={setSelectedFlowId} />}
                    </motion.div>
                );
            case "neuropulse":
                return (
                    <motion.div {...motionProps} className="relative flex-1 h-full min-h-0 min-w-0" data-synapse-target="neuropulse-panel" data-synapse-product="neuropulse" data-synapse-run-id={synapseRunId || undefined}>
                        <NeuroPulse synapseRunId={synapseRunId} synapsePatientId={synapsePatientId} synapsePulseEntryId={synapsePulseEntryId} synapseNoteId={synapseNoteId} synapseMermaid={synapseMermaid} />
                    </motion.div>
                );
            default:
                return (
                    <div className="flex-1 flex h-full min-h-0 min-w-0 overflow-hidden relative bg-transparent">
                        {!isFocusMode && (
                            <motion.div initial={false} animate={{ width: isListCollapsed ? 52 : 330 }} transition={{ duration: shouldReduceMotion ? 0 : undefined, type: "spring", stiffness: 320, damping: 34, mass: 0.78 }} className="notes-retina-rail relative z-20 flex shrink-0 flex-col overflow-hidden border-r" data-synapse-target="notes-list">
                                <div className={cn("h-full relative z-10", isListCollapsed ? "w-[52px]" : "w-[330px]")}> 
                                    <NotesListPanel
                                        searchQuery={searchQuery}
                                        setSearchQuery={setSearchQuery}
                                        items={filteredNotes}
                                        selectedId={selectedNoteId}
                                        onSelect={setSelectedNoteId}
                                        onCreate={handleCreateNote}
                                        onDeleteNote={(id) => {
                                            deleteNote(id);
                                            if (selectedNoteId === id) setSelectedNoteId(null);
                                        }}
                                        isLoading={isLoadingNotes}
                                        isCollapsed={isListCollapsed}
                                        onToggleCollapsed={() => setIsListCollapsed((current) => !current)}
                                        isCreatingNote={isCreatingNote}
                                    />
                                </div>
                            </motion.div>
                        )}

                        <div className="flex-1 min-w-0 min-h-0 bg-transparent relative flex flex-col group/editor" data-synapse-target="notes-editor">
                            <AnimatePresence mode="wait">
                                {activeNote ? (
                                    <motion.div key={activeNote.id} {...motionProps} className="flex-1 flex flex-col h-full min-h-0 relative z-10 bg-transparent">
                                        <Suspense fallback={<NoteEditorSkeleton />}>
                                            <NoteEditor
                                                note={activeNote}
                                                onUpdate={(id, updates) => updateNoteAsync({ id, updates })}
                                                onDelete={(id) => {
                                                    deleteNote(id);
                                                    setSelectedNoteId(null);
                                                }}
                                                isFocusMode={isFocusMode}
                                                onToggleFocus={handleToggleFocus}
                                                linkableNotes={(notes || []).map((note) => ({ id: note.id, title: note.title, content: note.content }))}
                                            />
                                        </Suspense>
                                    </motion.div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full min-h-0 text-center relative z-10 p-12 space-y-12 animate-in fade-in duration-1000 bg-transparent">
                                        <div className="relative group/gate">
                                            <div className="relative z-10 flex h-40 w-40 items-center justify-center overflow-hidden rounded-[64px] border border-white/[0.05] bg-black/40 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.22)] backdrop-blur-3xl group/icon [.light_&]:border-zinc-200/50 [.light_&]:bg-white/40 [.light_&]:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)]">
                                                <div className="absolute inset-0 notes-retina-texture opacity-[0.4] pointer-events-none [.light_&]:opacity-[0.26]" />
                                                <img src="/favicon-dark.png" alt="NeuroNex" className="h-16 w-16 dark:hidden transition-all duration-1000 group-hover/gate:scale-110" />
                                                <img src="/favicon-light.png" alt="NeuroNex" className="h-16 w-16 hidden dark:block transition-all duration-1000 group-hover/gate:scale-110" />
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <h3 className="text-6xl font-black tracking-tighter text-zinc-100 leading-none [.light_&]:text-zinc-900">NeuroDrive</h3>
                                            <p className="mx-auto max-w-xs text-[10px] font-black uppercase tracking-[0.6em] text-zinc-500 leading-relaxed">Sinfonia de dados para mentes complexas.</p>
                                        </div>
                                        <Button onClick={handleCreateNote} className="h-16 rounded-[24px] bg-zinc-100 px-12 text-[11px] font-black uppercase tracking-[0.3em] text-black shadow-[0_30px_60px_-15px_rgba(255,255,255,0.05)] transition-all hover:opacity-90 active:scale-95 group/btn [.light_&]:bg-zinc-900 [.light_&]:text-white [.light_&]:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)]">
                                            <Plus className="h-4 w-4 mr-3 stroke-[3]" />
                                            Nova Nota
                                        </Button>
                                    </div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="notes-lumen-canvas relative z-0 flex h-screen min-h-0 w-full flex-col overflow-hidden bg-transparent font-sans text-foreground selection:bg-primary/20">
            <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-[2200px] flex-1 items-stretch px-5 pb-5 pt-28">
                <div className="relative z-10 flex h-full min-h-0 min-w-0 flex-1 overflow-hidden rounded-[34px] border border-border/45 bg-card/42 shadow-[0_22px_90px_-76px_hsl(var(--foreground)/0.7)] ring-1 ring-foreground/[0.025] backdrop-blur-sm dark:border-white/[0.04] dark:bg-white/[0.02] dark:ring-white/[0.035]">
                    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: shouldReduceMotion ? 0 : 1, ease: [0.16, 1, 0.3, 1] }} className="group/main-window pointer-events-auto relative flex h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-transparent shadow-none">
                        {!isFocusMode && (
                            <motion.div initial={false} animate={{ width: isSidebarCollapsed ? 66 : 226 }} transition={{ duration: shouldReduceMotion ? 0 : undefined, type: "spring", stiffness: 320, damping: 34, mass: 0.78 }} className="notes-retina-rail relative z-20 hidden shrink-0 overflow-hidden border-r lg:flex" data-synapse-target="notes-sidebar">
                                <div className={cn("h-full relative z-10", isSidebarCollapsed ? "w-[66px]" : "w-[226px]")}> 
                                    <NotesSidebar
                                        viewMode={viewMode}
                                        setViewMode={setViewMode}
                                        selectedModuleId={selectedModuleId}
                                        onSelectModule={setSelectedModuleId}
                                        onMoveNoteToModule={(id, modId) => updateNote({ id, updates: { module_id: modId } })}
                                        onCreateNote={handleCreateNote}
                                        isCollapsed={isSidebarCollapsed}
                                        onToggleCollapsed={() => setIsSidebarCollapsed((current) => !current)}
                                        isCreatingNote={isCreatingNote}
                                    />
                                </div>
                            </motion.div>
                        )}
                        <div className="relative z-30 flex min-h-0 min-w-0 flex-1 overflow-hidden bg-transparent">
                            <Suspense fallback={<NoteEditorSkeleton />}>
                                <AnimatePresence mode="wait">{renderMainContent()}</AnimatePresence>
                            </Suspense>
                        </div>
                    </motion.div>
                </div>
            </div>
            <style>{`
                .notes-scroll-surface {
                    scroll-behavior: auto !important;
                    overscroll-behavior: contain;
                    contain: layout paint;
                    transform: translateZ(0);
                    backface-visibility: hidden;
                }
            `}</style>
        </div>
    );
}
