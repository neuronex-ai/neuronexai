"use client";

import { Button } from "@/components/ui/button";
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
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import {
    emptyNeuroFlowWorkflow,
    parseStoredNeuroFlowWorkflow,
    serializeNeuroFlowWorkflow
} from "@/lib/neuroflow-workflow";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";
import {
    ArrowUpRight, Brain, Clock, Copy, Edit2, Loader2, MoreVertical, Plus, Search, Tag, Trash2, User
} from "lucide-react";
import { useEffect, useState } from "react";
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
    const [flows, setFlows] = useState<NeuroFlow[]>([]);
    const [patients, setPatients] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isCreatingFlow, setIsCreatingFlow] = useState(false);
    const { theme } = useTheme();

    // Edit states
    const [editingFlow, setEditingFlow] = useState<NeuroFlow | null>(null);
    const [newTitle, setNewTitle] = useState("");
    const [selectedPatient, setSelectedPatient] = useState<string>("none");

    useEffect(() => {
        fetchFlows();
        fetchPatients();
        const channelId = Math.random().toString(36).substring(7);
        const channel = supabase
            .channel(`public:neuro_flows_${channelId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'neuro_flows' }, () => {
                fetchFlows();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchPatients = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Filtrando apenas pacientes do psicólogo atual
        const { data, error } = await supabase
            .from('patients')
            .select('id, name')
            .eq('user_id', user.id)
            .order('name');

        if (error) {
            console.error("[NeuroFlowVault] Error fetching patients:", error);
            return;
        }
        if (data) setPatients(data);
    };

    const fetchFlows = async () => {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setIsLoading(false);
            return;
        }

        const { data, error } = await supabase
            .from('neuro_flows')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });

        if (error) {
            toast.error("Não deu pra carregar seus fluxos agora.");
        }

        if (data) setFlows(data as NeuroFlow[]);
        setIsLoading(false);
    };

    const handleCreateFlow = async () => {
        if (isCreatingFlow) return;
        const { data: { user } } = await supabase.auth.getUser();
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
            const { data: { user } } = await supabase.auth.getUser();
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
            fetchFlows();
        } catch (error) {
            toast.error("Falha ao duplicar o fluxo.");
        }
    };

    const handleUpdateFlow = async () => {
        if (!editingFlow) return;

        try {
            const nextPatientId = selectedPatient === "none" ? null : selectedPatient;
            const existingWorkflow = parseStoredNeuroFlowWorkflow(editingFlow.workflow) || emptyNeuroFlowWorkflow({
                title: editingFlow.title,
                patientId: editingFlow.patient_id,
                ownerScope: editingFlow.patient_id ? 'patient' : 'none',
            });
            const nextWorkflow = {
                ...existingWorkflow,
                metadata: {
                    ...existingWorkflow.metadata,
                    title: newTitle,
                    patientId: nextPatientId,
                    ownerScope: nextPatientId ? 'patient' : 'none',
                    updatedAt: new Date().toISOString(),
                },
            };

            const { error } = await supabase
                .from('neuro_flows')
                .update({
                    title: newTitle,
                    patient_id: nextPatientId,
                    workflow: nextWorkflow,
                    updated_at: new Date().toISOString()
                })
                .eq('id', editingFlow.id);

            if (error) throw error;

            toast.success("Fluxo atualizado.");
            setEditingFlow(null);
            fetchFlows();
        } catch (error) {
            console.error("[NeuroFlowVault] Update error:", error);
            toast.error("Não foi possível salvar as alterações.");
        }
    };

    const handleDeleteFlow = async (id: string) => {
        const previousFlows = [...flows];
        setFlows(prev => prev.filter(f => f.id !== id));

        const { error } = await supabase.from('neuro_flows').delete().eq('id', id);

        if (error) {
            setFlows(previousFlows);
            toast.error("Não conseguimos apagar esse fluxo.");
        } else {
            toast.success("Fluxo removido com sucesso.");
        }
    };

    const filteredFlows = flows.filter(f =>
        f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.tags || []).some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="relative flex h-full w-full flex-col overflow-hidden bg-transparent px-7 py-8 text-white selection:bg-white selection:text-black transition-colors duration-500 lg:px-10 [.light_&]:text-zinc-900 [.light_&]:selection:bg-zinc-900 [.light_&]:selection:text-white">
            <div className="absolute top-[-5%] left-[-5%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-16 z-10">
                <div className="shrink-0 space-y-2">
                    <h1 className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-3xl font-black uppercase leading-none tracking-tight text-transparent lg:text-4xl [.light_&]:bg-zinc-900">NeuroFlow Studio</h1>
                    <div className="flex items-center gap-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-300 [.light_&]:text-zinc-500">Mapeamentos clínicos, hipóteses e artefatos conectados.</p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 w-full max-w-4xl">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45 [.light_&]:text-zinc-700" />
                            <Input
                            placeholder="Pesquisar fluxos, pacientes ou tags..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-14 w-full rounded-[22px] border-white/5 bg-white/[0.03] pl-11 text-sm text-white placeholder:text-white/28 backdrop-blur-md transition-all focus-visible:ring-1 focus-visible:ring-primary/20 [.light_&]:border-zinc-200 [.light_&]:bg-zinc-100 [.light_&]:text-zinc-900 [.light_&]:placeholder:text-zinc-400"
                        />
                    </div>

                    <Button
                        onClick={handleCreateFlow}
                        disabled={isCreatingFlow}
                        className="h-14 w-full rounded-[22px] bg-white px-10 text-[11px] font-black uppercase tracking-tight text-black shadow-[0_10px_30px_rgba(255,255,255,0.1)] transition-all hover:bg-zinc-200 md:w-auto [.light_&]:bg-zinc-900 [.light_&]:text-white [.light_&]:shadow-[0_10px_30px_rgba(0,0,0,0.1)] [.light_&]:hover:bg-zinc-800"
                    >
                        {isCreatingFlow ? <Loader2 size={18} className="mr-2 animate-spin" strokeWidth={3} /> : <Plus size={18} className="mr-2" strokeWidth={3} />}
                        {isCreatingFlow ? "Criando" : "Novo Studio"}
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 z-10 scrollbar-hide">
                {isLoading ? (
                    <div className="grid gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {[1, 2, 3, 4].map((i) => (
                            <Skeleton key={i} className="aspect-[4/5] rounded-[48px] bg-white/[0.01] [.light_&]:bg-zinc-100" />
                        ))}
                    </div>
                ) : (
                    <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-20">
                        <motion.button
                            whileHover={{ scale: 1.02, borderColor: theme === 'dark' ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleCreateFlow}
                            disabled={isCreatingFlow}
                            className="group relative flex aspect-[4/5] flex-col items-center justify-center gap-5 rounded-[28px] border border-dashed border-white/[0.07] bg-transparent p-7 text-center transition-all hover:bg-white/[0.02] [.light_&]:border-zinc-200 [.light_&]:hover:bg-zinc-50"
                        >
                            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/5 bg-white/[0.02] shadow-2xl transition-all duration-700 group-hover:bg-white group-hover:text-black [.light_&]:border-zinc-200 [.light_&]:bg-zinc-100 [.light_&]:group-hover:bg-zinc-900 [.light_&]:group-hover:text-white">
                                {isCreatingFlow ? <Loader2 size={32} className="animate-spin" strokeWidth={1.8} /> : <Brain size={32} strokeWidth={1.5} />}
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-sm font-black uppercase tracking-tighter text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">Novo Mapeamento</h3>
                                <p className="text-[8px] text-zinc-300 dark:text-zinc-800 font-black uppercase tracking-[0.2em]">Canvas Clínico</p>
                            </div>
                        </motion.button>

                        <AnimatePresence>
                            {filteredFlows.map((flow, idx) => (
                                <FlowCard
                                    key={flow.id}
                                    flow={flow}
                                    idx={idx}
                                    patientName={patients.find(p => p.id === flow.patient_id)?.name}
                                    onClick={() => onOpenFlow(flow.id)}
                                    onDelete={() => handleDeleteFlow(flow.id)}
                                    onDuplicate={() => handleDuplicateFlow(flow)}
                                    onRename={() => {
                                        setEditingFlow(flow);
                                        setNewTitle(flow.title);
                                        setSelectedPatient(flow.patient_id || "none");
                                    }}
                                    theme={theme}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            <Dialog open={!!editingFlow} onOpenChange={(open) => !open && setEditingFlow(null)}>
                <DialogContent className="bg-white dark:bg-[#0A0A0B]/95 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white rounded-[40px] p-10 max-w-md shadow-2xl backdrop-blur-[40px] ring-1 ring-zinc-200/50 dark:ring-white/10">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Configurar Mapeamento</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-8 py-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-600 px-1">Título</label>
                            <Input
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                className="bg-zinc-50 dark:bg-white/5 border-zinc-100 dark:border-white/5 rounded-2xl h-14 text-sm font-bold focus-visible:ring-primary/40"
                                placeholder="Ex: Análise Fenomenológica #1"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-600 px-1">Paciente Vinculado</label>
                            <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                                <SelectTrigger className="bg-zinc-50 dark:bg-white/5 border-zinc-100 dark:border-white/5 rounded-2xl h-14 text-sm font-medium">
                                    <SelectValue placeholder="Selecione um paciente" />
                                </SelectTrigger>
                                <SelectContent className="bg-white dark:bg-zinc-900/95 backdrop-blur-xl border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white rounded-2xl p-2">
                                    <SelectItem value="none" className="rounded-xl p-3 text-zinc-400 dark:text-zinc-500 font-bold uppercase text-[10px]">Nenhum vínculo</SelectItem>
                                    {patients.map(p => (
                                        <SelectItem key={p.id} value={p.id} className="rounded-xl p-3 text-xs font-semibold">{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter className="gap-3">
                        <Button variant="ghost" onClick={() => setEditingFlow(null)} className="rounded-2xl h-14 font-bold uppercase tracking-tight text-[10px] flex-1 hover:bg-zinc-100 dark:hover:bg-white/5">Cancelar</Button>
                        <Button onClick={handleUpdateFlow} className="bg-zinc-900 dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-2xl h-14 flex-[2] font-black uppercase tracking-tight text-[10px] shadow-xl">Salvar Configurações</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

const FlowCard = ({ flow, idx, onClick, onDelete, onRename, onDuplicate, patientName, theme: _theme }: {
    flow: NeuroFlow,
    idx: number,
    onClick: () => void,
    onDelete: () => void,
    onRename: () => void,
    onDuplicate: () => void,
    patientName?: string,
    theme?: string
}) => {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: idx * 0.05, duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
            onClick={onClick}
            className="group relative flex aspect-[4/5] cursor-pointer flex-col overflow-hidden rounded-[28px] border border-white/[0.06] bg-white/[0.018] p-7 transition-all duration-500 hover:border-white/10 hover:bg-white/[0.035] [.light_&]:border-zinc-200/70 [.light_&]:bg-white/65 [.light_&]:hover:border-zinc-300 [.light_&]:hover:bg-white"
        >
            {/* Top Action Layer */}
            <div className="flex justify-between items-start z-20 relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/5 bg-white/[0.03] text-zinc-700 transition-all duration-700 group-hover:scale-110 group-hover:text-white [.light_&]:border-zinc-200 [.light_&]:bg-zinc-100 [.light_&]:text-zinc-400 [.light_&]:group-hover:text-zinc-900">
                    <ArrowUpRight size={18} strokeWidth={2.5} />
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-400 dark:text-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-all backdrop-blur-md">
                            <MoreVertical size={16} />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64 bg-white dark:bg-[#0A0A0B]/95 backdrop-blur-3xl border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white rounded-3xl p-3 shadow-2xl ring-1 ring-zinc-200/50 dark:ring-white/5">
                        <DropdownMenuItem
                            className="text-[10px] font-black uppercase p-3 rounded-2xl hover:bg-zinc-100 dark:hover:bg-white/5 cursor-pointer flex gap-3 transition-colors text-zinc-900 dark:text-white"
                            onClick={(e) => { e.stopPropagation(); onRename(); }}
                        >
                            <Edit2 size={14} className="text-zinc-400 dark:text-zinc-500" /> Configurar & Vincular
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="text-[10px] font-black uppercase p-3 rounded-2xl hover:bg-zinc-100 dark:hover:bg-white/5 cursor-pointer flex gap-3 transition-colors text-zinc-900 dark:text-white"
                            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
                        >
                            <Copy size={14} className="text-zinc-400 dark:text-zinc-500" /> Duplicar Fluxo
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-zinc-100 dark:bg-white/5 my-2" />
                        <DropdownMenuItem
                            className="text-[10px] font-black uppercase p-3 text-red-500 hover:bg-red-500/5 rounded-2xl cursor-pointer flex gap-3 transition-colors"
                            onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        >
                            <Trash2 size={14} /> Eliminar
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="flex-1 flex items-center justify-center relative">
                <div className="absolute inset-0 bg-primary/5 blur-[80px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                <Brain size={64} strokeWidth={0.5} className="text-zinc-900/5 dark:text-white/5 group-hover:text-zinc-900/10 dark:group-hover:text-white/10 transition-all duration-700 scale-90 group-hover:scale-100" />
            </div>

            {/* Premium Content Layout */}
            <div className="z-20 relative space-y-6">
                <div className="space-y-3">
                    <h3 className="text-2xl font-black text-zinc-900 dark:text-white tracking-[-0.03em] leading-tight line-clamp-2">
                        {flow.title}
                    </h3>

                    {/* Metadata Row: Patient & Time */}
                    <div className="flex items-center flex-wrap gap-x-4 gap-y-2 opacity-40 group-hover:opacity-80 transition-opacity duration-500">
                        <div className="flex items-center gap-1.5">
                            <Clock size={10} className="text-zinc-400" />
                            <span className="text-[9px] font-bold font-mono uppercase tracking-tighter">
                                {formatDistanceToNow(new Date(flow.updated_at), { addSuffix: true, locale: ptBR })}
                            </span>
                        </div>

                        {patientName && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/10">
                                <User size={10} className="text-primary" strokeWidth={3} />
                                <span className="text-[9px] font-black uppercase tracking-tighter text-primary">{patientName}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Tag Bar - Discreet & Technical */}
                <div className="pt-6 border-t border-zinc-200 dark:border-white/5 flex items-center justify-between">
                    <div className="flex gap-1.5">
                        {flow.tags && flow.tags.length > 0 ? (
                            flow.tags.slice(0, 2).map(tag => (
                                <div key={tag} className="flex items-center gap-1 text-[8px] font-black text-zinc-400 dark:text-zinc-700 uppercase tracking-widest bg-zinc-100 dark:bg-white/[0.02] px-2 py-1 rounded-lg border border-zinc-100 dark:border-white/5">
                                    <Tag size={8} /> {tag}
                                </div>
                            ))
                        ) : (
                            <div className="text-[8px] font-black text-zinc-300 dark:text-zinc-800 uppercase tracking-widest">Sem Tags</div>
                        )}
                    </div>

                    {flow.is_template && (
                        <div className="px-2 py-1 bg-zinc-900 dark:bg-white text-white dark:text-black text-[7px] font-black uppercase tracking-widest rounded-md">
                            Template
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};
