"use client";

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";
import {
    Search, FileText, Hash,
    Zap, Brain, Target, BookOpen, Clock,
    Plus, ChevronRight, FolderOpen,
    User, Users, ChevronDown, Loader2,
    Smile, TableProperties, Stethoscope, Mic,
    Link2, Sparkles, Shield, AlertTriangle,
    GitBranch, Route, Split, Repeat2, PauseCircle,
    Network, Activity, HeartPulse, Eye, Sigma
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { usePatientsList } from '@/hooks/use-patients-list';
import { PremiumFileIcon } from '@/components/ui/PremiumFileIcons';
import { cn } from '@/lib/utils';
import { getR2DocumentDownloadUrl } from '@/lib/r2-documents-client';

export type NodeType =
    | 'start' | 'root' | 'free-note' | 'linked-note' | 'patient' | 'diagnostic' | 'evidence'
    | 'trigger' | 'thought' | 'emotion' | 'behavior' | 'body-sensation'
    | 'belief' | 'schema' | 'cognitive-distortion' | 'defense-mechanism'
    | 'resource' | 'risk' | 'intervention' | 'task' | 'timeline'
    | 'router' | 'condition' | 'loop' | 'stop' | 'neuropulse' | 'mermaid'
    | 'neuroview-patient' | 'document' | 'transcription' | 'table'
    | 'category' | 'action' | 'item' | 'logic' | 'quote' | 'anamnesis' | 'somatic' | 'mood' | 'bridge';

interface SegundoCerebroProps {
    isOpen: boolean;
    onClose: () => void;
    onAddNode?: (type: NodeType, data?: any) => void;
}

interface FileItem {
    name: string;
    id: string;
    documentId: string;
    created_at: string;
    size: number;
    path: string;
    mimetype?: string;
    signedUrl?: string;
    storageProvider: 'r2';
}

const nodeCategories: Array<{ id: NodeType; label: string; description: string; icon: any; color: string; bg: string }> = [
    { id: 'free-note', label: 'Nota Livre', description: 'Texto editável dentro do fluxo.', icon: FileText, color: 'text-zinc-300', bg: 'bg-zinc-400/10' },
    { id: 'linked-note', label: 'Nota Vinculada', description: 'Referência para uma nota existente.', icon: Link2, color: 'text-cyan-300', bg: 'bg-cyan-400/10' },
    { id: 'patient', label: 'Paciente', description: 'Âncora clínica do mapeamento.', icon: User, color: 'text-sky-300', bg: 'bg-sky-400/10' },
    { id: 'diagnostic', label: 'Hipótese Diagnóstica', description: 'Busca CID-10 BR e evidências.', icon: Stethoscope, color: 'text-red-400', bg: 'bg-red-500/10' },
    { id: 'evidence', label: 'Evidência Clínica', description: 'Dado que sustenta ou questiona uma hipótese.', icon: Sigma, color: 'text-amber-300', bg: 'bg-amber-400/10' },
    { id: 'trigger', label: 'Gatilho', description: 'Evento que inicia o ciclo.', icon: Zap, color: 'text-orange-300', bg: 'bg-orange-400/10' },
    { id: 'thought', label: 'Pensamento', description: 'Cognição, interpretação ou narrativa.', icon: Brain, color: 'text-violet-300', bg: 'bg-violet-400/10' },
    { id: 'emotion', label: 'Emoção', description: 'Afeto principal e intensidade.', icon: HeartPulse, color: 'text-pink-300', bg: 'bg-pink-400/10' },
    { id: 'behavior', label: 'Comportamento', description: 'Resposta observável ou padrão de ação.', icon: Activity, color: 'text-emerald-300', bg: 'bg-emerald-400/10' },
    { id: 'body-sensation', label: 'Sensação Corporal', description: 'Marcador somático do processo.', icon: Smile, color: 'text-rose-300', bg: 'bg-rose-400/10' },
    { id: 'belief', label: 'Crença', description: 'Regra interna ou convicção central.', icon: Hash, color: 'text-indigo-300', bg: 'bg-indigo-400/10' },
    { id: 'schema', label: 'Esquema', description: 'Padrão recorrente de organização psíquica.', icon: Network, color: 'text-blue-300', bg: 'bg-blue-400/10' },
    { id: 'cognitive-distortion', label: 'Distorção Cognitiva', description: 'Viés de interpretação ou inferência.', icon: Split, color: 'text-purple-300', bg: 'bg-purple-400/10' },
    { id: 'defense-mechanism', label: 'Mecanismo de Defesa', description: 'Proteção psíquica ou resposta defensiva.', icon: Shield, color: 'text-teal-300', bg: 'bg-teal-400/10' },
    { id: 'resource', label: 'Recurso / Proteção', description: 'Fator protetivo, habilidade ou suporte.', icon: Sparkles, color: 'text-lime-300', bg: 'bg-lime-400/10' },
    { id: 'risk', label: 'Risco / Alerta', description: 'Ponto de atenção clínica.', icon: AlertTriangle, color: 'text-red-300', bg: 'bg-red-400/10' },
    { id: 'intervention', label: 'Intervenção', description: 'Ação terapêutica planejada.', icon: Target, color: 'text-green-300', bg: 'bg-green-400/10' },
    { id: 'task', label: 'Tarefa Clínica', description: 'Combinado, exercício ou próximo passo.', icon: Target, color: 'text-emerald-300', bg: 'bg-emerald-400/10' },
    { id: 'timeline', label: 'Linha do Tempo', description: 'Espinha temporal do caso.', icon: Clock, color: 'text-cyan-300', bg: 'bg-cyan-400/10' },
    { id: 'router', label: 'Roteador', description: 'Distribui caminhos possíveis.', icon: Route, color: 'text-slate-300', bg: 'bg-slate-400/10' },
    { id: 'condition', label: 'Condição', description: 'Se isso acontecer, siga por este caminho.', icon: GitBranch, color: 'text-yellow-300', bg: 'bg-yellow-400/10' },
    { id: 'loop', label: 'Loop', description: 'Ciclo recorrente de manutenção.', icon: Repeat2, color: 'text-fuchsia-300', bg: 'bg-fuchsia-400/10' },
    { id: 'stop', label: 'Pausa / Stop', description: 'Interrupção, defesa ou dissociação.', icon: PauseCircle, color: 'text-zinc-300', bg: 'bg-zinc-400/10' },
    { id: 'neuropulse', label: 'NeuroPulse', description: 'Síntese ou diagrama gerado.', icon: Activity, color: 'text-primary', bg: 'bg-primary/10' },
    { id: 'mermaid', label: 'Mermaid', description: 'Diagrama renderizável no fluxo.', icon: Network, color: 'text-blue-300', bg: 'bg-blue-400/10' },
    { id: 'neuroview-patient', label: 'NeuroView do Paciente', description: 'Embed do grafo filtrado por paciente.', icon: Eye, color: 'text-white', bg: 'bg-white/10' },
    { id: 'document', label: 'Arquivo', description: 'PDF, imagem ou documento conectado.', icon: BookOpen, color: 'text-zinc-400', bg: 'bg-zinc-500/10' },
    { id: 'transcription', label: 'Transcrição', description: 'Registro de fala editável.', icon: Mic, color: 'text-yellow-300', bg: 'bg-yellow-400/10' },
    { id: 'table', label: 'Tabela de Observações', description: 'Linhas e colunas editáveis.', icon: TableProperties, color: 'text-indigo-300', bg: 'bg-indigo-400/10' },
];

type NodeBlueprintField = {
    key: string;
    label: string;
    value: string;
    placeholder?: string;
};

type NodeBlueprint = {
    content?: string;
    fields?: NodeBlueprintField[];
    checklist?: string[];
    clinicalIntent?: string;
};

const nodeBlueprints: Partial<Record<NodeType, NodeBlueprint>> = {
    root: {
        content: 'Objetivo do fluxo, contexto clinico e primeira hipotese.',
        fields: [
            { key: 'objective', label: 'Objetivo', value: '', placeholder: 'O que este fluxo precisa esclarecer?' },
            { key: 'context', label: 'Contexto', value: '', placeholder: 'Paciente, sessao, evento ou recorte.' },
        ],
    },
    'free-note': {
        content: 'Sintese livre, observacoes e proximos passos.',
        fields: [
            { key: 'summary', label: 'Sintese', value: '', placeholder: 'Ideia principal da nota.' },
            { key: 'next_step', label: 'Proximo passo', value: '', placeholder: 'O que revisar, perguntar ou fazer.' },
        ],
        checklist: ['Pode gerar nota em Registros', 'Pode virar evidencia ou intervencao'],
    },
    'linked-note': {
        fields: [
            { key: 'reason', label: 'Motivo do vinculo', value: '', placeholder: 'Por que esta nota importa para o fluxo?' },
        ],
    },
    patient: {
        fields: [
            { key: 'case_focus', label: 'Foco do caso', value: '', placeholder: 'Que parte do caso este fluxo representa?' },
            { key: 'care_context', label: 'Contexto de cuidado', value: '', placeholder: 'Individual, familia, avaliacao, acompanhamento.' },
        ],
    },
    diagnostic: {
        content: 'Hipotese clinica em investigacao. Registrar CID, grau de confianca e evidencias.',
        fields: [
            { key: 'cid', label: 'CID-10', value: '', placeholder: 'Ex: F41.1' },
            { key: 'confidence', label: 'Confianca', value: '', placeholder: 'Baixa, media ou alta.' },
            { key: 'differential', label: 'Diferenciais', value: '', placeholder: 'Hipoteses a comparar.' },
        ],
    },
    evidence: {
        content: 'Dado observado que sustenta, enfraquece ou contextualiza uma hipotese.',
        fields: [
            { key: 'source', label: 'Fonte', value: '', placeholder: 'Sessao, relato, escala, documento.' },
            { key: 'polarity', label: 'Polaridade', value: '', placeholder: 'Sustenta, enfraquece ou neutra.' },
            { key: 'strength', label: 'Forca', value: '', placeholder: '0-5' },
        ],
    },
    trigger: {
        fields: [
            { key: 'event', label: 'Evento', value: '', placeholder: 'O que dispara o ciclo?' },
            { key: 'context', label: 'Contexto', value: '', placeholder: 'Onde, quando, com quem?' },
        ],
    },
    thought: {
        fields: [
            { key: 'automatic_thought', label: 'Pensamento automatico', value: '', placeholder: 'Frase interna provavel.' },
            { key: 'interpretation', label: 'Interpretacao', value: '', placeholder: 'Sentido atribuido ao evento.' },
        ],
    },
    emotion: {
        fields: [
            { key: 'emotion', label: 'Emocao', value: '', placeholder: 'Raiva, medo, culpa, tristeza...' },
            { key: 'intensity', label: 'Intensidade', value: '', placeholder: '0-10' },
        ],
    },
    behavior: {
        fields: [
            { key: 'response', label: 'Resposta', value: '', placeholder: 'Acao observavel ou evitacao.' },
            { key: 'consequence', label: 'Consequencia', value: '', placeholder: 'O que mantem ou muda o ciclo?' },
        ],
    },
    'body-sensation': {
        fields: [
            { key: 'location', label: 'Local', value: '', placeholder: 'Peito, garganta, estomago...' },
            { key: 'signal', label: 'Sinal', value: '', placeholder: 'Tensao, dormencia, calor, dor...' },
        ],
    },
    belief: {
        fields: [
            { key: 'core_belief', label: 'Crenca central', value: '', placeholder: 'Eu sou..., os outros sao..., o mundo e...' },
            { key: 'rule', label: 'Regra', value: '', placeholder: 'Se..., entao...' },
        ],
    },
    schema: {
        fields: [
            { key: 'pattern', label: 'Padrao', value: '', placeholder: 'Tema recorrente do caso.' },
            { key: 'origin', label: 'Origem provavel', value: '', placeholder: 'Historia, aprendizagem ou contexto.' },
        ],
    },
    'cognitive-distortion': {
        fields: [
            { key: 'distortion', label: 'Distorcao', value: '', placeholder: 'Catastrofizacao, leitura mental...' },
            { key: 'alternative', label: 'Alternativa', value: '', placeholder: 'Formulacao mais flexivel.' },
        ],
    },
    'defense-mechanism': {
        fields: [
            { key: 'defense', label: 'Defesa', value: '', placeholder: 'Intelectualizacao, negacao, isolamento...' },
            { key: 'protects_from', label: 'Protege de', value: '', placeholder: 'Afeto, memoria ou conflito evitado.' },
        ],
    },
    resource: {
        fields: [
            { key: 'resource', label: 'Recurso', value: '', placeholder: 'Rede, habilidade, valor, pratica.' },
            { key: 'access_plan', label: 'Como acessar', value: '', placeholder: 'Acao concreta para mobilizar.' },
        ],
    },
    risk: {
        fields: [
            { key: 'risk', label: 'Risco', value: '', placeholder: 'O que exige atencao?' },
            { key: 'safety_plan', label: 'Plano de seguranca', value: '', placeholder: 'Conduta, contato, combinado.' },
        ],
    },
    intervention: {
        fields: [
            { key: 'intervention', label: 'Intervencao', value: '', placeholder: 'Tecnica, conversa, psicoeducacao.' },
            { key: 'target', label: 'Alvo', value: '', placeholder: 'Que no do fluxo ela modifica?' },
        ],
    },
    task: {
        fields: [
            { key: 'task', label: 'Combinado', value: '', placeholder: 'Exercicio ou tarefa entre sessoes.' },
            { key: 'review_date', label: 'Revisao', value: '', placeholder: 'Quando revisar?' },
        ],
    },
    timeline: {
        content: 'Evento 1 -> Evento 2 -> Evento 3',
        fields: [
            { key: 'period', label: 'Periodo', value: '', placeholder: 'Infancia, adolescencia, mes atual...' },
            { key: 'anchor_event', label: 'Evento ancora', value: '', placeholder: 'Marco temporal principal.' },
        ],
    },
    router: {
        fields: [
            { key: 'routes', label: 'Rotas', value: '', placeholder: 'Caminhos possiveis a partir daqui.' },
            { key: 'criterion', label: 'Criterio', value: '', placeholder: 'O que decide o caminho?' },
        ],
    },
    condition: {
        fields: [
            { key: 'if', label: 'Se', value: '', placeholder: 'Condicao clinica ou comportamental.' },
            { key: 'then', label: 'Entao', value: '', placeholder: 'Proximo passo do fluxo.' },
        ],
    },
    loop: {
        fields: [
            { key: 'loop_pattern', label: 'Ciclo', value: '', placeholder: 'Como o padrao se repete?' },
            { key: 'exit_signal', label: 'Sinal de saida', value: '', placeholder: 'O que interrompe o ciclo?' },
        ],
    },
    stop: {
        fields: [
            { key: 'stop_type', label: 'Tipo', value: '', placeholder: 'Pausa, defesa, dissociacao, limite.' },
            { key: 'grounding', label: 'Aterramento', value: '', placeholder: 'Conduta para retomar presenca.' },
        ],
    },
    neuropulse: {
        fields: [
            { key: 'pulse_source', label: 'Origem', value: '', placeholder: 'NeuroPulse vinculado.' },
            { key: 'clinical_use', label: 'Uso no fluxo', value: '', placeholder: 'Como a sintese informa o caso?' },
        ],
    },
    mermaid: {
        content: 'graph TD\n  A[Hipotese] --> B[Evidencia]\n  B --> C[Intervencao]',
        fields: [
            { key: 'diagram_goal', label: 'Objetivo', value: '', placeholder: 'O que este diagrama deve explicar?' },
        ],
    },
    'neuroview-patient': {
        fields: [
            { key: 'filter', label: 'Filtro', value: '', placeholder: 'Notas, arquivos ou artefatos do paciente.' },
        ],
    },
    transcription: {
        fields: [
            { key: 'speaker', label: 'Fonte', value: '', placeholder: 'Paciente, familiar, sessao, audio.' },
            { key: 'clinical_marker', label: 'Marcador clinico', value: '', placeholder: 'Tema ou trecho relevante.' },
        ],
    },
    table: {
        fields: [
            { key: 'columns', label: 'Colunas', value: 'Observacao | Evidencia | Conduta', placeholder: 'Estrutura da tabela.' },
            { key: 'use_case', label: 'Uso', value: '', placeholder: 'Comparacao, rastreio, acompanhamento.' },
        ],
    },
};

const cloneBlueprint = (type: NodeType) => {
    const blueprint = nodeBlueprints[type];
    if (!blueprint) return {};

    return {
        ...blueprint,
        fields: blueprint.fields?.map((field) => ({ ...field })),
        checklist: blueprint.checklist ? [...blueprint.checklist] : undefined,
    };
};

const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

export const SegundoCerebro = ({ isOpen, onClose, onAddNode }: SegundoCerebroProps) => {
    const { user } = useAuth();
    const userId = user?.id;
    const [searchTerm, setSearchTerm] = useState('');
    const [myNotes, setMyNotes] = useState<any[]>([]);
    const [isLoadingNotes, setIsLoadingNotes] = useState(false);

    // Files state
    const [personalFiles, setPersonalFiles] = useState<FileItem[]>([]);
    const [patientFilesMap, setPatientFilesMap] = useState<Record<string, FileItem[]>>({});
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);
    const [expandedPatient, setExpandedPatient] = useState<string | null>(null);
    const [filesSubTab, setFilesSubTab] = useState<'personal' | 'patients'>('personal');

    const { data: patients } = usePatientsList();

    useEffect(() => {
        if (isOpen) {
            fetchMyNotes();
            fetchFiles();
        }
    }, [isOpen]);

    const fetchMyNotes = async () => {
        setIsLoadingNotes(true);
        try {
            const { data, error } = await supabase
                .from('personal_notes')
                .select('id, title, content, created_at, tags')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setMyNotes(data || []);
        } catch (error) {
            console.error("Erro ao buscar notas:", error);
        } finally {
            setIsLoadingNotes(false);
        }
    };

    const fetchFiles = async () => {
        if (!userId) return;
        setIsLoadingFiles(true);
        try {
            const mapDocument = async (item: any): Promise<FileItem> => ({
                name: item.original_name,
                id: item.id,
                documentId: item.id,
                created_at: item.created_at,
                size: item.size_bytes || 0,
                path: `r2:${item.id}`,
                mimetype: item.mime_type,
                signedUrl: await getR2DocumentDownloadUrl({ documentId: item.id, disposition: 'inline' }).catch(() => ''),
                storageProvider: 'r2',
            });

            const personalResult = await supabase
                .from('document_files')
                .select('id,patient_id,original_name,mime_type,size_bytes,created_at,metadata')
                .is('patient_id', null)
                .eq('status', 'ready')
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .limit(200);

            if (!personalResult.error && personalResult.data) {
                const personalRows = personalResult.data.filter((item: any) => {
                    const source = String(item.metadata?.source || '');
                    return source !== 'ai_chat' && source !== 'external_invoice';
                });
                setPersonalFiles(await Promise.all(personalRows.map(mapDocument)));
            }

            if (patients && patients.length > 0) {
                const patientIds = patients.map((patient) => patient.id);
                const patientResult = await supabase
                    .from('document_files')
                    .select('id,patient_id,original_name,mime_type,size_bytes,created_at')
                    .in('patient_id', patientIds)
                    .eq('status', 'ready')
                    .is('deleted_at', null)
                    .order('created_at', { ascending: false })
                    .limit(500);

                const result: Record<string, FileItem[]> = {};
                if (!patientResult.error && patientResult.data) {
                    const files = await Promise.all(patientResult.data.map(mapDocument));
                    files.forEach((file: any) => {
                        const patientId = String(patientResult.data.find((row: any) => row.id === file.id)?.patient_id || '');
                        if (!patientId) return;
                        result[patientId] = [...(result[patientId] || []), file];
                    });
                }
                setPatientFilesMap(result);
            }
        } catch (err) {
            console.error("Erro ao buscar arquivos:", err);
        } finally {
            setIsLoadingFiles(false);
        }
    };

    const onDragStart = (event: any, nodeType: NodeType, data?: any) => {
        if (!event.dataTransfer) return;
        event.dataTransfer.setData('application/reactflow/type', nodeType);
        if (data) {
            event.dataTransfer.setData('application/reactflow/data', JSON.stringify(data));
        }
        event.dataTransfer.effectAllowed = 'move';
    };

    const handleQuickAdd = (type: NodeType, data?: any) => {
        if (onAddNode) {
            const category = nodeCategories.find((item) => item.id === type);
            const baseData = {
                label: category?.label || 'Novo Bloco',
                description: category?.description,
                blockKind: type,
                ...cloneBlueprint(type),
            };
            onAddNode(type, data ? { ...baseData, ...data } : baseData);
            onClose();
        }
    };

    const getFilePublicUrl = (path: string) => {
        const allFiles = [...personalFiles, ...Object.values(patientFilesMap).flat()];
        return allFiles.find((file) => file.path === path)?.signedUrl || '';
    };

    const getCleanFileName = (name: string) => {
        return name.replace(/^\d+_/, '');
    };

    const filteredCategories = nodeCategories.filter(c =>
        c.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredNotes = myNotes.filter(n =>
        (n.title || 'Sem título').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredPersonalFiles = personalFiles.filter(f =>
        getCleanFileName(f.name).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const patientsWithFiles = patients?.filter(p => patientFilesMap[p.id]) || [];
    const filteredPatients = patientsWithFiles.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl h-[85vh] bg-[#0A0A0B]/90 border border-white/5 backdrop-blur-3xl p-0 overflow-hidden flex flex-col rounded-[40px] shadow-2xl">
                {/* Premium Texture Overlay */}
                <div className="absolute inset-0 notes-retina-texture opacity-[0.18] pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />

                <div className="flex-1 flex flex-col overflow-hidden relative">
                    <ScrollArea className="flex-1 h-full">
                        <DialogHeader className="px-10 pt-10 pb-4 relative z-10">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="h-10 w-10 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center shadow-2xl">
                                    <Brain className="h-5 w-5 text-white" />
                                </div>
                                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-[0.3em] border-white/10 text-zinc-500 bg-white/[0.02] py-1">Biblioteca de Blocos</Badge>
                            </div>
                            <DialogTitle className="text-4xl font-black text-white tracking-tighter leading-tight">NeuroFlow Studio</DialogTitle>
                            <DialogDescription className="text-zinc-500 font-bold text-[13px] tracking-tight">Clique em um bloco para adicioná-lo ao centro do canvas.</DialogDescription>
                        </DialogHeader>

                        <div className="px-10 mb-8 relative z-10">
                            <div className="relative group">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-700 group-focus-within:text-primary transition-all duration-500" />
                                <Input
                                    placeholder="Pesquisar componentes, notas ou arquivos..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="bg-white/[0.02] border-white/5 h-14 pl-14 rounded-[22px] text-white placeholder:text-zinc-800 focus:ring-2 focus:ring-primary/20 focus:bg-white/[0.04] transition-all duration-500 text-sm font-medium shadow-inner"
                                />
                            </div>
                        </div>

                        <Tabs defaultValue="components" className="flex-1 flex flex-col relative z-10">
                            <div className="px-10 mb-6 sticky top-0 bg-[#0A0A0B]/80 backdrop-blur-md py-2 z-50">
                                <TabsList className="bg-white/[0.02] border border-white/5 h-11 p-1 rounded-2xl gap-1">
                                    <TabsTrigger value="components" className="flex-1 data-[state=active]:bg-white/[0.05] data-[state=active]:text-white text-zinc-500 font-black text-[9px] uppercase tracking-[0.2em] rounded-xl transition-all duration-500 py-2">Blocos</TabsTrigger>
                                    <TabsTrigger value="notes" className="flex-1 data-[state=active]:bg-white/[0.05] data-[state=active]:text-white text-zinc-500 font-black text-[9px] uppercase tracking-[0.2em] rounded-xl transition-all duration-500 py-2">Minhas Notas</TabsTrigger>
                                    <TabsTrigger value="files" className="flex-1 data-[state=active]:bg-white/[0.05] data-[state=active]:text-white text-zinc-500 font-black text-[9px] uppercase tracking-[0.2em] rounded-xl transition-all duration-500 py-2">Arquivos</TabsTrigger>
                                </TabsList>
                            </div>

                            <div className="px-10 pt-2 pb-10">
                                <TabsContent value="components" className="m-0 focus-visible:outline-none">
                                    <div className="grid grid-cols-1 gap-5 pb-8 md:grid-cols-2">
                                        {filteredCategories.map((cat) => (
                                            <motion.button
                                                type="button"
                                                key={cat.id}
                                                whileHover={{ scale: 1.015, y: -2 }}
                                                whileTap={{ scale: 0.98 }}
                                                draggable
                                                onDragStart={(e) => onDragStart(e, cat.id as NodeType)}
                                                onClick={() => handleQuickAdd(cat.id as NodeType)}
                                                className="group relative flex min-h-[252px] cursor-pointer flex-col overflow-hidden rounded-[30px] border border-white/[0.075] bg-[#080809]/95 p-7 text-left shadow-[0_28px_80px_-60px_rgba(255,255,255,0.34)] transition-all duration-300 hover:border-white/[0.14] hover:bg-[#0c0c0d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 [.light_&]:border-zinc-200 [.light_&]:bg-white [.light_&]:shadow-[0_28px_80px_-58px_rgba(24,24,27,0.34)] [.light_&]:hover:border-zinc-300"
                                            >
                                                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_52%_10%,rgba(255,255,255,0.065),transparent_38%),linear-gradient(145deg,rgba(255,255,255,0.026),transparent_48%)] opacity-90 [.light_&]:bg-[radial-gradient(circle_at_52%_10%,rgba(24,24,27,0.055),transparent_38%),linear-gradient(145deg,rgba(24,24,27,0.018),transparent_48%)]" />
                                                <div className="pointer-events-none absolute inset-px rounded-[29px] ring-1 ring-inset ring-white/[0.035] [.light_&]:ring-zinc-950/[0.04]" />

                                                <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-[24px] bg-white text-zinc-950 shadow-[0_18px_36px_-24px_rgba(255,255,255,0.65)] transition-transform duration-300 group-hover:scale-[1.03] [.light_&]:bg-zinc-950 [.light_&]:text-white [.light_&]:shadow-[0_18px_36px_-24px_rgba(24,24,27,0.55)]">
                                                    <cat.icon className="h-7 w-7" strokeWidth={2.15} />
                                                </div>

                                                <div className="relative z-10 mt-7 space-y-4">
                                                    <h4 className="max-w-[12rem] text-[24px] font-black leading-[1.05] tracking-tight text-white [.light_&]:text-zinc-950">{cat.label}</h4>
                                                    <p className="max-w-[18rem] text-[13px] font-semibold leading-relaxed text-zinc-400 [.light_&]:text-zinc-500">{cat.description}</p>
                                                </div>

                                                <div className="relative z-10 mt-auto flex items-center justify-between border-t border-white/[0.06] pt-5 [.light_&]:border-zinc-200">
                                                    <span className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-400 [.light_&]:text-zinc-500">Inserir bloco</span>
                                                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.07] text-white transition-all duration-300 group-hover:bg-white group-hover:text-zinc-950 [.light_&]:bg-zinc-100 [.light_&]:text-zinc-950 [.light_&]:group-hover:bg-zinc-950 [.light_&]:group-hover:text-white">
                                                        <ChevronRight size={20} strokeWidth={2.4} />
                                                    </span>
                                                </div>
                                            </motion.button>
                                        ))}
                                    </div>
                                </TabsContent>

                                {/* ─── NOTES TAB ─── */}
                                <TabsContent value="notes" className="m-0 focus-visible:outline-none">
                                    {isLoadingNotes ? (
                                        <div className="flex items-center justify-center h-40">
                                            <Loader2 className="h-5 w-5 text-primary animate-spin mr-3" />
                                            <span className="text-xs text-zinc-600 font-bold uppercase tracking-widest">Carregando Notas...</span>
                                        </div>
                                    ) : filteredNotes.length > 0 ? (
                                        <div className="grid grid-cols-1 gap-2.5 pb-8">
                                            {filteredNotes.map((note) => (
                                                <motion.div
                                                    key={note.id}
                                                    whileHover={{ x: 6, backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)' }}
                                                    whileTap={{ scale: 0.99 }}
                                                    draggable
                                                    onDragStart={(e) => onDragStart(e, 'item', {
                                                        label: note.title || 'Sem título',
                                                        sourceNoteId: note.id,
                                                        content: note.content || '',
                                                    })}
                                                    onClick={() => handleQuickAdd('item', {
                                                        label: note.title || 'Sem título',
                                                        sourceNoteId: note.id,
                                                        content: note.content || '',
                                                    })}
                                                    className="p-5 rounded-[24px] bg-white/[0.01] border border-white/5 cursor-pointer group flex items-center justify-between transition-all duration-300"
                                                >
                                                    <div className="flex items-center gap-5">
                                                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/10 group-hover:bg-primary/20 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6">
                                                            <FileText className="h-6 w-6 text-primary" strokeWidth={1.5} />
                                                        </div>
                                                        <div>
                                                            <h4 className="text-[14px] font-black text-white leading-tight group-hover:text-primary transition-colors">{note.title || 'Sem título'}</h4>
                                                            <div className="flex items-center gap-3 mt-1.5">
                                                                <span className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">Criada em {new Date(note.created_at).toLocaleDateString()}</span>
                                                                {note.tags?.slice(0, 2).map((t: string) => (
                                                                    <span key={t} className="text-[9px] text-primary/40 font-black uppercase tracking-widest bg-primary/5 px-2 py-0.5 rounded-lg border border-primary/10">#{t}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary/20 transition-all duration-500 opacity-0 group-hover:opacity-100 shadow-xl group-hover:shadow-primary/10">
                                                            <Plus size={16} className="text-primary" strokeWidth={3} />
                                                        </div>
                                                        <ChevronRight size={16} className="text-zinc-800 group-hover:text-zinc-500 transition-colors" />
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-[32px]">
                                            <p className="text-zinc-700 font-black uppercase text-[10px] tracking-widest">Nenhuma nota encontrada</p>
                                        </div>
                                    )}
                                </TabsContent>

                                {/* ─── FILES TAB ─── */}
                                <TabsContent value="files" className="m-0 focus-visible:outline-none">
                                    {/* Sub-tabs for personal vs patient files */}
                                    <div className="flex items-center gap-2 mb-6">
                                        <button
                                            onClick={() => setFilesSubTab('personal')}
                                            className={cn(
                                                "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all border",
                                                filesSubTab === 'personal' ? "bg-white/10 text-white border-white/20 shadow-lg" : "text-zinc-600 hover:text-white hover:bg-white/5 border-transparent"
                                            )}
                                        >
                                            <User size={12} /> Meus Arquivos
                                        </button>
                                        <button
                                            onClick={() => setFilesSubTab('patients')}
                                            className={cn(
                                                "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all border",
                                                filesSubTab === 'patients' ? "bg-white/10 text-white border-white/20 shadow-lg" : "text-zinc-600 hover:text-white hover:bg-white/5 border-transparent"
                                            )}
                                        >
                                            <Users size={12} /> Pacientes
                                        </button>
                                    </div>

                                    {isLoadingFiles ? (
                                        <div className="flex items-center justify-center h-40">
                                            <Loader2 className="h-5 w-5 animate-spin text-primary mr-3" />
                                            <span className="text-xs text-zinc-600 font-bold uppercase tracking-widest">Carregando Arquivos...</span>
                                        </div>
                                    ) : filesSubTab === 'personal' ? (
                                        // ─── Personal Files ───
                                        filteredPersonalFiles.length > 0 ? (
                                            <div className="grid grid-cols-1 gap-2.5 pb-8">
                                                {filteredPersonalFiles.map((file) => {
                                                    const cleanName = getCleanFileName(file.name);
                                                    const fileUrl = getFilePublicUrl(file.path);
                                                    const fileData = {
                                                        label: cleanName,
                                                        fileName: cleanName,
                                                        filePath: file.path,
                                                        fileUrl: fileUrl,
                                                        fileMimetype: file.mimetype || '',
                                                        fileSize: file.size,
                                                        fileSource: 'personal',
                                                    };
                                                    return (
                                                        <motion.div
                                                            key={file.id}
                                                            whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)' }}
                                                            draggable
                                                            onDragStart={(e) => onDragStart(e, 'document', fileData)}
                                                            onClick={() => handleQuickAdd('document', fileData)}
                                                            className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 cursor-pointer group flex items-center justify-between transition-all"
                                                        >
                                                            <div className="flex items-center gap-4">
                                                                <div className="h-10 w-10 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center shadow-lg">
                                                                    <PremiumFileIcon filename={cleanName} className="w-5 h-6" />
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-[13px] font-bold text-white truncate max-w-[300px] leading-tight">{cleanName}</h4>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <span className="text-[8px] text-zinc-600 font-black uppercase tracking-wider">{formatFileSize(file.size)}</span>
                                                                        <span className="text-[8px] text-zinc-800">•</span>
                                                                        <span className="text-[8px] text-zinc-600 font-black uppercase tracking-wider">Pessoal</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="outline" className="text-[8px] font-black border-white/5 text-zinc-600 uppercase tracking-widest bg-white/[0.02]">Importar</Badge>
                                                                <ChevronRight size={14} className="text-zinc-800 group-hover:text-zinc-500" />
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-[32px]">
                                                <FolderOpen className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
                                                <p className="text-zinc-700 font-black uppercase text-[10px] tracking-widest">Nenhum arquivo pessoal encontrado</p>
                                            </div>
                                        )
                                    ) : (
                                        // ─── Patient Files ───
                                        filteredPatients.length > 0 ? (
                                            <div className="space-y-2.5 pb-8">
                                                {filteredPatients.map((patient) => (
                                                    <div key={patient.id} className="space-y-1.5">
                                                        <button
                                                            onClick={() => setExpandedPatient(expandedPatient === patient.id ? null : patient.id)}
                                                            className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10 transition-all group"
                                                        >
                                                            <div className="flex items-center gap-4">
                                                                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/5">
                                                                    <User className="h-5 w-5 text-primary" />
                                                                </div>
                                                                <div className="text-left">
                                                                    <p className="text-sm font-bold text-white leading-tight">{patient.name}</p>
                                                                    <p className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.1em]">
                                                                        {patientFilesMap[patient.id]?.length || 0} arquivo(s)
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <ChevronDown className={cn(
                                                                "h-4 w-4 text-zinc-600 transition-transform duration-300",
                                                                expandedPatient === patient.id && "rotate-180"
                                                            )} />
                                                        </button>

                                                        <AnimatePresence>
                                                            {expandedPatient === patient.id && (
                                                                <motion.div
                                                                    initial={{ height: 0, opacity: 0 }}
                                                                    animate={{ height: "auto", opacity: 1 }}
                                                                    exit={{ height: 0, opacity: 0 }}
                                                                    transition={{ duration: 0.2 }}
                                                                    className="overflow-hidden pl-4 space-y-2"
                                                                >
                                                                    {patientFilesMap[patient.id]?.map((file) => {
                                                                        const cleanName = getCleanFileName(file.name);
                                                                        const fileUrl = getFilePublicUrl(file.path);
                                                                        const fileData = {
                                                                            label: cleanName,
                                                                            fileName: cleanName,
                                                                            filePath: file.path,
                                                                            fileUrl: fileUrl,
                                                                            fileMimetype: file.mimetype || '',
                                                                            fileSize: file.size,
                                                                            fileSource: 'patient',
                                                                            patientId: patient.id,
                                                                            patientName: patient.name,
                                                                        };
                                                                        return (
                                                                            <motion.div
                                                                                key={file.id}
                                                                                whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)' }}
                                                                                draggable
                                                                                onDragStart={(e) => onDragStart(e, 'document', fileData)}
                                                                                onClick={() => handleQuickAdd('document', fileData)}
                                                                                className="p-3.5 rounded-xl bg-white/[0.01] border border-white/5 cursor-pointer group flex items-center justify-between transition-all"
                                                                            >
                                                                                <div className="flex items-center gap-3">
                                                                                    <div className="h-9 w-9 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center shadow-md">
                                                                                        <PremiumFileIcon filename={cleanName} className="w-4 h-5" />
                                                                                    </div>
                                                                                    <div>
                                                                                        <h4 className="text-[12px] font-bold text-white truncate max-w-[250px] leading-tight">{cleanName}</h4>
                                                                                        <div className="flex items-center gap-2 mt-0.5">
                                                                                            <span className="text-[8px] text-zinc-600 font-black uppercase">{formatFileSize(file.size)}</span>
                                                                                            <span className="text-[8px] text-primary/40 font-black uppercase">Prontuário</span>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                                <Plus size={12} className="text-zinc-800 group-hover:text-primary transition-colors mr-2" />
                                                                            </motion.div>
                                                                        );
                                                                    })}
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-[32px]">
                                                <Users className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
                                                <p className="text-zinc-700 font-black uppercase text-[10px] tracking-widest">Nenhum arquivo de paciente</p>
                                            </div>
                                        )
                                    )}
                                </TabsContent>
                            </div>
                        </Tabs>
                    </ScrollArea>
                </div>

                {/* Footer Quick Tip */}
                <div className="px-10 py-4 border-t border-white/5 bg-white/[0.02] flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                        <span className="text-[8px] text-zinc-500 font-black uppercase tracking-[0.1em]">Dica: clique para inserir; arraste somente quando quiser escolher a posição exata.</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-white transition-colors"
                    >
                        Fechar Mapeador
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
