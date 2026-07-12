"use client";

import { Button } from "@/components/ui/button";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";
import {
    emptyNeuroFlowWorkflow,
    parseStoredNeuroFlowWorkflow,
    serializeNeuroFlowWorkflow
} from "@/lib/neuroflow-workflow";
import { repairMojibake, repairTextEncodingDeep } from "@/lib/text-encoding";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, useReducedMotion } from "framer-motion";
import {
    ArrowUpRight, Brain, Clock, Copy, Edit2, Loader2, MoreVertical, Plus, Search, Tag, Trash2, User
} from "lucide-react";
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export interface NeuroFlow {
    id: string;
    title: string;
    description: string | null;
    updated_at: string;
    created_at: string;
    tags: string[];
    is_template: boolean;
    patient_id?: string | null;
    workflow?: any;
}

interface NeuroFlowVaultProps {
    onOpenFlow: (flowId: string) => void;
}

export const NeuroFlowVault = ({ onOpenFlow }: NeuroFlowVaultProps) => {
    const { user } = useAuth();
    const [flows, setFlows] = useState<NeuroFlow[]>([]);
    const [patients, setPatients] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isCreatingFlow, setIsCreatingFlow] = useState(false);
    const shouldReduceMotion = useReducedMotion();

    // Edit states
    const [editingFlow, setEditingFlow] = useState<NeuroFlow | null>(null);
    const [newTitle, setNewTitle] = useState("");
    const [selectedPatient, setSelectedPatient] = useState<string>("none");
    const [flowPendingDeletion, setFlowPendingDeletion] = useState<NeuroFlow | null>(null);

    const normalizeFlow = useCallback((flow: NeuroFlow): NeuroFlow => ({
        ...flow,
        title: repairMojibake(flow.title || "Fluxo sem título"),
        description: flow.description ? repairMojibake(flow.description) : null,
        tags: Array.isArray(flow.tags) ? flow.tags.map(repairMojibake) : [],
        workflow: repairTextEncodingDeep(flow.workflow),
    }), []);

    const fetchPatients = useCallback(async () => {
        if (!user?.id) {
            setPatients([]);
            return;
        }

        const { data, error } = await supabase
            .from('patients')
            .select('id, name')
            .eq('user_id', user.id)
            .order('name');

        if (error) {
            console.error("[NeuroFlowVault] Error fetching patients:", error);
            return;
        }
        setPatients(data || []);
    }, [user?.id]);

    const fetchFlows = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
        if (!user?.id) {
            setFlows([]);
            setIsLoading(false);
            return;
        }

        if (!silent) setIsLoading(true);
        const { data, error } = await supabase
            .from('neuro_flows')
            .select('id,title,description,updated_at,created_at,tags,is_template,patient_id,workflow')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
            .limit(250);

        if (error) {
            toast.error("Não deu pra carregar seus fluxos agora.");
        } else {
            setFlows((data || []).map((flow) => normalizeFlow(flow as NeuroFlow)));
        }
        setIsLoading(false);
    }, [normalizeFlow, user?.id]);

    useEffect(() => {
        if (!user?.id) return;
        void fetchFlows();
        void fetchPatients();
        let refreshTimer: number | null = null;
        const channel = supabase
            .channel(`public:neuro_flows_${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'neuro_flows', filter: `user_id=eq.${user.id}` }, () => {
                if (refreshTimer) window.clearTimeout(refreshTimer);
                refreshTimer = window.setTimeout(() => void fetchFlows({ silent: true }), 180);
            })
            .subscribe();

        return () => {
            if (refreshTimer) window.clearTimeout(refreshTimer);
            void supabase.removeChannel(channel);
        };
    }, [fetchFlows, fetchPatients, user?.id]);

    const handleCreateFlow = async () => {
        if (isCreatingFlow) return;
        if (!user) return;

        setIsCreatingFlow(true);
        try {
            const title = `Novo Fluxo de Pensamento`;
            const rootNodeId = crypto.randomUUID();
            const workflow = serializeNeuroFlowWorkflow({
                nodes: [{
                    id: rootNodeId,
                    type: 'root',
                    position: { x: 0, y: 0 },
                    data: {
                        label: 'Início da Sessão',
                        description: 'Ponto de partida.',
                        content: 'Objetivo do fluxo, contexto clínico e primeira hipótese.',
                        blockKind: 'root',
                    }
                }],
                edges: [],
                viewport: { x: 0, y: 0, zoom: 1 },
                metadata: { title, ownerScope: 'none' },
            });

            const { data: flowData, error: flowError } = await supabase
                .from('neuro_flows')
                .insert({
                    user_id: user.id,
                    title,
                    description: 'Começando um novo mapeamento...',
                    tags: ['Recente'],
                    is_template: false,
                    workflow,
                    workflow_schema_version: workflow.schema,
                })
                .select()
                .single();

            if (flowError) throw flowError;

            onOpenFlow(flowData.id);
            toast.success("Tudo pronto! Seu novo fluxo foi criado.");
        } catch (error) {
            console.error("[NeuroFlowVault] Create flow error:", error);
            toast.error("Houve um probleminha ao criar o fluxo.");
        } finally {
            setIsCreatingFlow(false);
        }
    };

    const handleDuplicateFlow = async (flow: NeuroFlow) => {
        try {
            if (!user) return;

            const sourceWorkflow = parseStoredNeuroFlowWorkflow(flow.workflow) || emptyNeuroFlowWorkflow({
                title: flow.title,
                patientId: flow.patient_id,
                ownerScope: flow.patient_id ? 'patient' : 'none',
            });
            const nodeIdMap = new Map<string, string>();
            const clonedNodes = sourceWorkflow.nodes.map((node) => {
                const newNodeId = crypto.randomUUID();
                nodeIdMap.set(node.id, newNodeId);
                return {
                    id: newNodeId,
                    type: node.type || 'item',
                    position: { ...node.position, x: node.position.x + 48, y: node.position.y + 48 },
                    data: { ...(node.data || {}) },
                };
            });
            const clonedEdges = sourceWorkflow.edges
                .map((edge) => {
                    const source = nodeIdMap.get(edge.source);
                    const target = nodeIdMap.get(edge.target);
                    if (!source || !target) return null;
                    return {
                        id: `edge-${crypto.randomUUID()}`,
                        source,
                        target,
                        sourceHandle: edge.sourceHandle || undefined,
                        targetHandle: edge.targetHandle || undefined,
                        type: edge.type || 'neural',
                        label: edge.label || undefined,
                        animated: edge.animated ?? true,
                        data: edge.data || {},
                    };
                })
                .filter(Boolean) as any[];
            const clonedWorkflow = serializeNeuroFlowWorkflow({
                nodes: clonedNodes,
                edges: clonedEdges,
                viewport: sourceWorkflow.viewport,
                metadata: {
                    ...sourceWorkflow.metadata,
                    title: `${flow.title} (Cópia)`,
                    patientId: flow.patient_id,
                    ownerScope: flow.patient_id ? 'patient' : 'none',
                },
            });

            const { error: flowError } = await supabase
                .from('neuro_flows')
                .insert({
                    user_id: user.id,
                    title: `${flow.title} (Cópia)`,
                    description: flow.description,
                    tags: flow.tags,
                    is_template: false,
                    patient_id: flow.patient_id,
                    workflow: clonedWorkflow,
                    workflow_schema_version: clonedWorkflow.schema,
                })
                .select()
                .single();

            if (flowError) throw flowError;

            toast.success("Fluxo duplicado com sucesso!");
            void fetchFlows({ silent: true });
        } catch (error) {
            toast.error("Falha ao duplicar o fluxo.");
        }
    };

    const handleUpdateFlow = async () => {
        if (!editingFlow || !user?.id) return;

        try {
            const safeTitle = repairMojibake(newTitle.trim()) || "Fluxo sem título";
            const nextPatientId = selectedPatient === "none" ? null : selectedPatient;
            const existingWorkflow = parseStoredNeuroFlowWorkflow(editingFlow.workflow) || emptyNeuroFlowWorkflow({
                title: editingFlow.title,
                patientId: editingFlow.patient_id,
                ownerScope: editingFlow.patient_id ? 'patient' : 'none',
            });
            const nextWorkflow = repairTextEncodingDeep({
                ...existingWorkflow,
                metadata: {
                    ...existingWorkflow.metadata,
                    title: safeTitle,
                    patientId: nextPatientId,
                    ownerScope: nextPatientId ? 'patient' : 'none',
                    updatedAt: new Date().toISOString(),
                },
            });

            const { error } = await supabase
                .from('neuro_flows')
                .update({
                    title: safeTitle,
                    patient_id: nextPatientId,
                    workflow: nextWorkflow,
                    updated_at: new Date().toISOString()
                })
                .eq('id', editingFlow.id)
                .eq('user_id', user.id);

            if (error) throw error;

            toast.success("Fluxo atualizado.");
            setEditingFlow(null);
            void fetchFlows({ silent: true });
        } catch (error) {
            console.error("[NeuroFlowVault] Update error:", error);
            toast.error("Não foi possível salvar as alterações.");
        }
    };

    const handleDeleteFlow = async (id: string) => {
        if (!user?.id) return;
        const previousFlows = [...flows];
        setFlows(prev => prev.filter(f => f.id !== id));

        const { error } = await supabase
            .from('neuro_flows')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) {
            setFlows(previousFlows);
            toast.error("Não conseguimos apagar esse fluxo.");
        } else {
            toast.success("Fluxo removido com sucesso.");
        }
        setFlowPendingDeletion(null);
    };

    const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLocaleLowerCase("pt-BR"));
    const filteredFlows = useMemo(() => flows.filter((flow) =>
        flow.title.toLocaleLowerCase("pt-BR").includes(deferredSearchQuery) ||
        (flow.tags || []).some((tag) => tag.toLocaleLowerCase("pt-BR").includes(deferredSearchQuery))
    ), [deferredSearchQuery, flows]);
    const patientNames = useMemo(
        () => new Map(patients.map((patient) => [patient.id, repairMojibake(patient.name)])),
        [patients],
    );

    return (
        <div className="notes-lumen-canvas relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-transparent p-3 text-foreground selection:bg-primary/15 sm:p-4 lg:p-5">
            <header className="notes-toolbar-surface relative z-10 flex shrink-0 flex-col gap-3 rounded-[24px] border p-3.5 sm:p-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Mapeamento clínico</p>
                    <h1 className="mt-0.5 text-xl font-black tracking-[-0.045em] text-foreground">NeuroFlow</h1>
                    <p className="mt-1 max-w-xl text-[11px] font-medium leading-relaxed text-muted-foreground">
                        Organize hipóteses, relações clínicas e materiais em mapas conectados.
                    </p>
                </div>

                <div className="flex w-full flex-col gap-3 sm:flex-row xl:max-w-3xl">
                    <label className="relative min-w-0 flex-1" htmlFor="neuroflow-search">
                        <span className="sr-only">Pesquisar mapeamentos</span>
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            id="neuroflow-search"
                            placeholder="Buscar por título ou marcador"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            className="desktop-retina-inset h-10 rounded-[14px] border-border/45 bg-muted/30 pl-11 pr-4 text-sm shadow-none"
                        />
                    </label>
                    <Button
                        onClick={handleCreateFlow}
                        disabled={isCreatingFlow}
                        className="desktop-retina-interactive h-10 shrink-0 rounded-[14px] px-5 text-[10px] font-black uppercase tracking-[0.14em]"
                    >
                        {isCreatingFlow ? <Loader2 size={17} className="mr-2 animate-spin" /> : <Plus size={17} className="mr-2" />}
                        {isCreatingFlow ? "Criando" : "Novo mapeamento"}
                    </Button>
                </div>
            </header>

            <div className="notes-scroll-surface desktop-content-scroll relative z-10 mt-3 min-h-0 flex-1 overflow-y-auto pr-2 [contain:layout_paint]">
                {isLoading ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-label="Carregando mapeamentos">
                        {[1, 2, 3, 4].map((i) => (
                            <Skeleton key={i} className="min-h-[226px] rounded-[24px] border border-border/35 bg-muted/25" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 pb-12 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        <motion.button
                            whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                            whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
                            onClick={handleCreateFlow}
                            disabled={isCreatingFlow}
                            className="notes-liquid-surface group relative flex min-h-[226px] flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed p-5 text-center transition-[border-color,background-color] hover:border-border hover:bg-muted/30"
                        >
                            <div className="desktop-retina-inset flex h-14 w-14 items-center justify-center rounded-[20px] border border-border/45 bg-muted/35 text-muted-foreground transition-colors group-hover:text-foreground">
                                {isCreatingFlow ? <Loader2 size={26} className="animate-spin" /> : <Brain size={26} strokeWidth={1.7} />}
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-base font-black tracking-tight text-foreground">Começar um novo mapa</h2>
                                <p className="text-xs font-medium text-muted-foreground">Abra um canvas clínico em branco.</p>
                            </div>
                        </motion.button>

                        {filteredFlows.map((flow, idx) => (
                            <FlowCard
                                key={flow.id}
                                flow={flow}
                                idx={idx}
                                patientName={flow.patient_id ? patientNames.get(flow.patient_id) : undefined}
                                onClick={() => onOpenFlow(flow.id)}
                                onDelete={() => setFlowPendingDeletion(flow)}
                                onDuplicate={() => void handleDuplicateFlow(flow)}
                                onRename={() => {
                                    setEditingFlow(flow);
                                    setNewTitle(flow.title);
                                    setSelectedPatient(flow.patient_id || "none");
                                }}
                                shouldReduceMotion={Boolean(shouldReduceMotion)}
                            />
                        ))}

                        {filteredFlows.length === 0 && searchQuery ? (
                            <div className="notes-liquid-surface col-span-full flex min-h-[220px] flex-col items-center justify-center rounded-[28px] border border-dashed border-border/45 px-6 text-center">
                                <Search className="h-6 w-6 text-muted-foreground" />
                                <h2 className="mt-4 text-base font-black text-foreground">Nenhum mapa encontrado</h2>
                                <p className="mt-2 text-sm text-muted-foreground">Tente outro título ou marcador.</p>
                            </div>
                        ) : null}
                    </div>
                )}
            </div>

            <Dialog open={!!editingFlow} onOpenChange={(open) => !open && setEditingFlow(null)}>
                <DialogContent className="desktop-retina-modal desktop-retina-form overflow-hidden rounded-[30px] border border-border/50 bg-background/95 p-0 sm:max-w-md">
                    <DialogHeader className="border-b border-border/40 px-6 py-5 text-left">
                        <DialogTitle className="text-xl font-black tracking-tight">Configurar mapeamento</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6 px-6 py-6">
                        <div className="space-y-3">
                            <label htmlFor="neuroflow-title" className="px-1 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Título</label>
                            <Input
                                id="neuroflow-title"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                className="h-12 rounded-2xl border-border/45 bg-muted/30 text-sm font-bold"
                                placeholder="Ex: Análise Fenomenológica #1"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="px-1 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Paciente vinculado</label>
                            <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                                <SelectTrigger className="h-12 rounded-2xl border-border/45 bg-muted/30 text-sm font-medium">
                                    <SelectValue placeholder="Selecione um paciente" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-border/50 bg-popover p-2">
                                    <SelectItem value="none" className="rounded-xl p-3 text-[10px] font-bold uppercase text-muted-foreground">Nenhum vínculo</SelectItem>
                                    {patients.map(p => (
                                        <SelectItem key={p.id} value={p.id} className="rounded-xl p-3 text-xs font-semibold">{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter className="gap-3 border-t border-border/40 px-6 py-5">
                        <Button variant="ghost" onClick={() => setEditingFlow(null)} className="h-11 rounded-2xl px-5 font-bold">Cancelar</Button>
                        <Button onClick={handleUpdateFlow} disabled={!newTitle.trim()} className="h-11 rounded-2xl px-6 font-bold">Salvar alterações</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={Boolean(flowPendingDeletion)} onOpenChange={(open) => !open && setFlowPendingDeletion(null)}>
                <AlertDialogContent className="desktop-retina-modal rounded-[28px] border border-border/50 bg-background/96 sm:max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir este mapeamento?</AlertDialogTitle>
                        <AlertDialogDescription className="leading-relaxed">
                            “{flowPendingDeletion?.title}” e suas conexões serão removidos. Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-2xl">Manter mapeamento</AlertDialogCancel>
                        <AlertDialogAction
                            className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => flowPendingDeletion && void handleDeleteFlow(flowPendingDeletion.id)}
                        >
                            Excluir mapeamento
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

const FlowCard = memo(function FlowCard({ flow, idx, onClick, onDelete, onRename, onDuplicate, patientName, shouldReduceMotion }: {
    flow: NeuroFlow,
    idx: number,
    onClick: () => void,
    onDelete: () => void,
    onRename: () => void,
    onDuplicate: () => void,
    patientName?: string,
    shouldReduceMotion: boolean,
}) {
    return (
        <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: shouldReduceMotion ? 0 : Math.min(idx * 0.025, 0.18), duration: shouldReduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
            onClick={onClick}
            onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onClick();
            }}
            role="button"
            tabIndex={0}
            aria-label={`Abrir mapeamento ${flow.title}`}
            style={{ contain: "layout style" }}
            className="notes-liquid-surface desktop-retina-interactive group relative flex min-h-[226px] cursor-pointer flex-col overflow-hidden rounded-[24px] border p-4 outline-none transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-border/75 hover:bg-muted/25 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:hover:translate-y-0"
        >
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,hsl(var(--foreground)/0.035),transparent_46%,hsl(var(--foreground)/0.012))]" />

            <div className="relative z-20 flex items-start justify-between">
                <div className="desktop-retina-inset flex h-10 w-10 items-center justify-center rounded-2xl border border-border/45 bg-muted/30 text-muted-foreground transition-colors group-hover:text-foreground">
                    <ArrowUpRight size={17} strokeWidth={2.3} />
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" aria-label={`Opções de ${flow.title}`} className="h-10 w-10 rounded-2xl text-muted-foreground hover:bg-muted hover:text-foreground">
                            <MoreVertical size={16} aria-hidden />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="notes-liquid-surface w-60 rounded-2xl border border-border/50 bg-popover p-2 shadow-2xl">
                        <DropdownMenuItem
                            className="flex cursor-pointer gap-3 rounded-xl p-3 text-xs font-bold"
                            onClick={(e) => { e.stopPropagation(); onRename(); }}
                        >
                            <Edit2 size={14} className="text-muted-foreground" /> Configurar e vincular
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="flex cursor-pointer gap-3 rounded-xl p-3 text-xs font-bold"
                            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
                        >
                            <Copy size={14} className="text-muted-foreground" /> Duplicar mapeamento
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="my-2" />
                        <DropdownMenuItem
                            className="flex cursor-pointer gap-3 rounded-xl p-3 text-xs font-bold text-destructive focus:text-destructive"
                            onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        >
                            <Trash2 size={14} /> Excluir mapeamento
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="relative flex flex-1 items-center justify-center py-3">
                <div className="desktop-retina-inset flex h-14 w-14 items-center justify-center rounded-[20px] border border-border/40 bg-muted/20 text-muted-foreground/35 transition-colors group-hover:text-muted-foreground/60">
                    <Brain size={26} strokeWidth={1.1} />
                </div>
            </div>

            <div className="relative z-20 space-y-4">
                <div className="space-y-3">
                    <h3 className="line-clamp-2 text-lg font-black leading-tight tracking-[-0.03em] text-foreground">
                        {flow.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                            <Clock size={11} />
                            <span className="text-[9px] font-bold uppercase tracking-[0.08em]">
                                {formatDistanceToNow(new Date(flow.updated_at), { addSuffix: true, locale: ptBR })}
                            </span>
                        </div>

                        {patientName && (
                            <div className="flex items-center gap-1.5 rounded-full border border-border/45 bg-muted/35 px-2.5 py-1">
                                <User size={10} />
                                <span className="max-w-[150px] truncate text-[9px] font-black uppercase tracking-[0.08em]">{patientName}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-between border-t border-border/40 pt-4">
                    <div className="flex min-w-0 gap-1.5">
                        {flow.tags && flow.tags.length > 0 ? (
                            flow.tags.slice(0, 2).map(tag => (
                                <div key={tag} className="flex max-w-[100px] items-center gap-1 rounded-lg border border-border/40 bg-muted/30 px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-muted-foreground">
                                    <Tag size={8} /> <span className="truncate">{tag}</span>
                                </div>
                            ))
                        ) : (
                            <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60">Sem marcadores</div>
                        )}
                    </div>

                    {flow.is_template && (
                        <div className="rounded-md bg-foreground px-2 py-1 text-[7px] font-black uppercase tracking-widest text-background">
                            Modelo
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
});
