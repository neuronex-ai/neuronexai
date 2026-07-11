import { createContext, ReactNode, useCallback, useContext, useRef, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSynapseLiveVoice } from '@/hooks/use-synapse-live-voice';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import { getToolsForRoute, getQuickActionsForRoute, SynapseTool } from '@/lib/synapse-tool-catalog';

// ─── Types ────────────────────────────────────────────────────────────

export type SynapseShellState = 'closed' | 'pill' | 'compact';

export type SynapseExecState =
    | 'idle'
    | 'listening'
    | 'thinking'
    | 'executing'
    | 'success'
    | 'error';

export type SynapseActiveTab = 'chat' | 'timeline' | 'voice' | 'history' | 'agent';

export interface SynapseTimelineEntry {
    id: string;
    timestamp: Date;
    label: string;
    state: SynapseExecState;
    toolId?: string;
    detail?: string;
    actionPath?: string;
}

export interface ScanStatus {
    module: string;
    label: string;
    status: 'pending' | 'scanning' | 'completed';
}

interface SynapseContextType {
    // Shell visual state
    shellState: SynapseShellState;
    setShellState: (state: SynapseShellState) => void;
    toggleCompact: () => void;
    activeTab: SynapseActiveTab;
    setActiveTab: (tab: SynapseActiveTab) => void;

    // Execution state
    execState: SynapseExecState;
    setExecState: (state: SynapseExecState) => void;

    // Tool catalog
    availableTools: SynapseTool[];
    quickActions: (SynapseTool | { id: string; name: string; description: string; status: 'active'; category: 'clinical'; allowedRoutes: string[]; hiddenInProduction: boolean; riskLevel: 'low' })[];

    // Timeline
    timeline: SynapseTimelineEntry[];
    addTimelineEntry: (entry: Omit<SynapseTimelineEntry, 'id' | 'timestamp'>) => void;
    clearTimeline: () => void;

    // Chat session persistence
    activeSessionId: string | null;
    setActiveSessionId: (id: string | null) => void;
    inputDraft: string;
    setInputDraft: (text: string) => void;

    // Visibility
    isVisible: boolean;

    // Voice Integration
    voiceStatus: 'disconnected' | 'connecting' | 'connected' | 'disconnecting' | 'error';
    isVoiceSpeaking: boolean;
    voicePhase: string;
    isVoiceToolActive: boolean;
    voiceActivityLabel: string;
    voiceActivityMessage: string;
    getVoiceInputVolume: () => number;
    toggleVoiceMode: () => Promise<void>;
    isVoiceExpanded: boolean;
    setIsVoiceExpanded: (expanded: boolean) => void;

    // Daily Intelligence
    dailyActions: Record<string, { id: string; name: string; description: string }[]>;
    isIntelligenceLoading: boolean;
    scanProgress: ScanStatus[];
    syncDailyIntelligence: () => Promise<void>;
}

const SynapseContext = createContext<SynapseContextType | undefined>(undefined);

const VOICE_TOOL_LABELS: Record<string, string> = {
    navigate_system: 'Navegação',
    search_patients: 'Busca de paciente',
    list_patients: 'Lista de pacientes',
    get_patient_details: 'Prontuário',
    report_all_patients: 'Resumo de pacientes',
    search_clinical_history: 'Histórico clínico',
    generate_patient_insights: 'Insights clínicos',
    suggest_treatment_approach: 'Plano terapêutico',
    detect_risk_patterns: 'Análise de risco',
    get_calendar: 'Agenda',
    create_appointment: 'Novo agendamento',
    reschedule_appointment: 'Remarcação',
    cancel_appointment: 'Cancelamento',
    find_available_slots: 'Horários disponíveis',
    create_patient: 'Cadastro de paciente',
    update_patient_info: 'Atualização do paciente',
    add_patient_medication: 'Medicação',
    create_session_note: 'Nota clínica',
    send_whatsapp_message: 'WhatsApp',
    read_whatsapp_conversations: 'Conversas do WhatsApp',
    send_email: 'E-mail',
    draft_email: 'Rascunho de e-mail',
    get_financial_metrics: 'Resumo financeiro',
    list_transactions: 'Lançamentos financeiros',
    create_transaction: 'Lançamento financeiro',
    generate_financial_report: 'Relatório financeiro',
    send_payment_reminder: 'Lembrete de pagamento',
    draft_invoice: 'Cobrança',
    generate_document: 'Documento',
    draft_official_document: 'Documento oficial',
    search_medical_articles: 'Referências clínicas',
    search_cid10: 'CID-10',
    get_medication_info: 'Informações de medicação',
    get_latest_scientific_updates: 'Atualizações científicas',
    search_normative_docs: 'Normas profissionais',
};

const sanitizeTimelineText = (value?: string) => {
    if (!value) return value;
    let next = value;
    for (const [toolName, label] of Object.entries(VOICE_TOOL_LABELS)) {
        next = next.replace(new RegExp(toolName, 'gi'), label);
    }
    return next
        .replace(/[{}\[\]"]/g, '')
        .replace(/\b(?:payload|params|tool|endpoint|json|uuid|session_id|clientAction|function_call)\b/gi, '')
        .replace(/\b[a-z]+(?:_[a-z0-9]+){1,}\b/gi, 'ação')
        .replace(/\s+/g, ' ')
        .trim();
};

// ─── Provider ─────────────────────────────────────────────────────────

export const SynapseProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const location = useLocation();

    // Shell state
    const [shellState, setShellState] = useState<SynapseShellState>('pill');
    const [activeTab, setActiveTab] = useState<SynapseActiveTab>('chat');

    // Intelligence State
    const [dailyActions, setDailyActions] = useState<Record<string, { id: string; name: string; description: string }[]>>({});
    const [isIntelligenceLoading, setIsIntelligenceLoading] = useState(false);
    const [scanProgress, setScanProgress] = useState<ScanStatus[]>([
        { module: 'dashboard', label: 'Dashboard', status: 'pending' },
        { module: 'agenda', label: 'Agenda', status: 'pending' },
        { module: 'pacientes', label: 'Pacientes', status: 'pending' },
        { module: 'financeiro', label: 'Financeiro', status: 'pending' },
        { module: 'teleconsulta', label: 'Teleconsulta', status: 'pending' },
        { module: 'notas', label: 'Notas', status: 'pending' },
    ]);
    const hasSyncRunThisSession = useRef(false);

    // Execution state
    const [execState, setExecState] = useState<SynapseExecState>('idle');

    // Timeline
    const [timeline, setTimeline] = useState<SynapseTimelineEntry[]>([]);
    // Voice Modal State
    const [isVoiceExpanded, setIsVoiceExpanded] = useState(false);
    const timelineIdCounter = useRef(0);

    // Chat persistence across routes
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [inputDraft, setInputDraft] = useState('');

    const isMobile = useIsMobile();

    // Visibility
    const isVisible = !isMobile && !!user;

    // Derived: tools for current route
    const baseTools = getToolsForRoute(location.pathname);
    const staticQuickActions = getQuickActionsForRoute(location.pathname);
    
    // Merge static quick actions with daily intelligence
    const currentModule = location.pathname.split('/')[1] || 'dashboard';
    const currentDailyActions = dailyActions[currentModule] || [];
    
    const quickActions = [
        ...currentDailyActions.map(a => ({
            id: a.id,
            name: a.name,
            description: a.description,
            status: 'active' as const,
            category: 'clinical' as const,
            allowedRoutes: ['*'],
            hiddenInProduction: false,
            riskLevel: 'low' as const
        })),
        ...staticQuickActions
    ].slice(0, 6);

    const availableTools = baseTools;

    // ─── Intelligence Logic (Global Sync) ────────────────────────────────

    const syncDailyIntelligence = useCallback(async () => {
        if (!user || isIntelligenceLoading) return;
        
        const today = new Date().toISOString().split('T')[0];
        const globalSyncKey = `synapse_global_sync_${user.id}`;
        const lastSync = localStorage.getItem(globalSyncKey);
        
        if (lastSync === today) {
            // Restore from cache if possible
            const cachedActions = localStorage.getItem(`synapse_daily_actions_${user.id}`);
            if (cachedActions) {
                setDailyActions(JSON.parse(cachedActions));
                setScanProgress(prev => prev.map(p => ({ ...p, status: 'completed' })));
                return;
            }
        }

        console.log('[Synapse Intelligence] Iniciando varredura global diária...');
        setIsIntelligenceLoading(true);
        setExecState('thinking');

        try {
            const modules = ['dashboard', 'agenda', 'pacientes', 'financeiro', 'teleconsulta', 'notas'];
            const allSuggestions: Record<string, { id: string; name: string; description: string }[]> = {
                dashboard: [
                    { id: 'suggest_1', name: 'Revisar faturamento semanal', description: 'O faturamento está 15% acima da média.' },
                    { id: 'suggest_2', name: 'Notas pendentes de ontem', description: 'Você esqueceu de finalizar 2 notas.' }
                ],
                agenda: [
                    { id: 'suggest_3', name: 'Encaixar Carlos às 15h?', description: 'Houve um cancelamento e Carlos solicitou prioridade.' },
                    { id: 'suggest_4', name: 'Confirmar horários Online', description: '3 pacientes ainda não receberam o link da sessão.' }
                ],
                pacientes: [
                    { id: 'suggest_5', name: 'Enviar anamnese para Pedro', description: 'Novo paciente ainda não preencheu os dados.' },
                    { id: 'suggest_6', name: 'Ver histórico: João Silva', description: 'João apresentou piora nos sintomas relatados.' }
                ],
                financeiro: [
                    { id: 'suggest_7', name: 'Cobrar fatura: Pedro', description: 'A sessão de segunda ainda não foi faturada.' },
                    { id: 'suggest_8', name: 'Conciliar 5 recebimentos', description: 'Existem depósitos não identificados no extrato.' }
                ],
                teleconsulta: [
                    { id: 'suggest_9', name: 'Preparar roteiro: Ana', description: 'Sessão de hoje foca em exposição cognitiva.' },
                    { id: 'suggest_10', name: 'Verificar conexão de rede', description: 'A estabilidade da rede está oscilando.' }
                ],
                notas: [
                    { id: 'suggest_11', name: 'Transcrever áudio de ontem', description: 'Você gravou um insight importante pós-sessão.' },
                    { id: 'suggest_12', name: 'Revisar metas da semana', description: '3 pacientes atingiram marcos terapêuticos.' }
                ]
            };

            // Process each module with a visual delay
            for (const mod of modules) {
                setScanProgress(prev => prev.map(p => p.module === mod ? { ...p, status: 'scanning' } : p));
                await new Promise(resolve => setTimeout(resolve, 800)); // Simulating deep scan
                setScanProgress(prev => prev.map(p => p.module === mod ? { ...p, status: 'completed' } : p));
            }

            setDailyActions(allSuggestions);
            localStorage.setItem(globalSyncKey, today);
            localStorage.setItem(`synapse_daily_actions_${user.id}`, JSON.stringify(allSuggestions));
            setExecState('success');
            
        } catch (err) {
            console.error('[Synapse Intelligence] Erro ao sincronizar globalmente:', err);
            setExecState('error');
        } finally {
            setIsIntelligenceLoading(false);
            setTimeout(() => setExecState('idle'), 2000);
        }
    }, [user, isIntelligenceLoading]);

    useEffect(() => {
        if (user && !hasSyncRunThisSession.current) {
            hasSyncRunThisSession.current = true;
            syncDailyIntelligence();
        }
    }, [user, syncDailyIntelligence]);

    // ─────────────────────────────────────────────────────────────────────

    const toggleCompact = useCallback(() => {
        setShellState((prev) => (prev === 'compact' ? 'pill' : 'compact'));
    }, []);

    const addTimelineEntry = useCallback(
        (entry: Omit<SynapseTimelineEntry, 'id' | 'timestamp'>) => {
            const id = `tl-${++timelineIdCounter.current}`;
            const safeEntry = {
                ...entry,
                label: sanitizeTimelineText(entry.label) || 'Atividade do Synapse',
                detail: sanitizeTimelineText(entry.detail),
            };
            setTimeline((prev) => [
                ...prev.slice(-19), // keep last 20 entries
                { ...safeEntry, id, timestamp: new Date() },
            ]);
        },
        []
    );

    const clearTimeline = useCallback(() => setTimeline([]), []);

    // ─── Voice Integration (Deepgram Agent) ───────────────────────────────
    const synapseVoice = useSynapseLiveVoice({
        onConnect: () => {
            console.log('[Synapse Global Voice] Conectado ao Deepgram Agent');
            setExecState('listening');
        },
        onDisconnect: () => {
            console.log('[Synapse Global Voice] Desconectado do Deepgram Agent');
            setExecState('idle');
            if (activeTab === 'voice') setActiveTab('chat');
        },
        onError: (err) => {
            console.error('[Synapse Global Voice] Erro:', err);
            setExecState('error');
            // Auto-recover: switch back to chat after a short delay
            setTimeout(() => {
                setExecState('idle');
                if (activeTab === 'voice') setActiveTab('chat');
            }, 3000);
        },
    });

    useEffect(() => {
        if (activeTab !== 'voice') return;
        if (synapseVoice.status === 'error') {
            setExecState('error');
            return;
        }
        if (synapseVoice.isToolActive) {
            setExecState('executing');
            return;
        }
        if (synapseVoice.status === 'connecting') {
            setExecState('thinking');
            return;
        }
        if (synapseVoice.status === 'connected') {
            setExecState(synapseVoice.isSpeaking ? 'thinking' : 'listening');
            return;
        }
        setExecState('idle');
    }, [activeTab, synapseVoice.isSpeaking, synapseVoice.isToolActive, synapseVoice.status]);

    const toggleVoiceMode = useCallback(async () => {
        if (synapseVoice.status === 'connected') {
            await synapseVoice.endSession();
            setActiveTab('chat');
            setExecState('idle');
        } else {
            setActiveTab('voice');
            setExecState('thinking');
            try {
                console.log('[Synapse Global Voice] Iniciando sessão...');
                await synapseVoice.startSession();
            } catch (err) {
                console.error("[Synapse Global Voice] Falha ao iniciar:", err);
                setExecState('error');
                setTimeout(() => {
                    setActiveTab('chat');
                    setExecState('idle');
                }, 2500);
            }
        }
    }, [synapseVoice, setActiveTab, setExecState]);
    // ─────────────────────────────────────────────────────────────────────

    return (
        <SynapseContext.Provider
            value={{
                shellState,
                setShellState,
                toggleCompact,
                activeTab,
                setActiveTab,
                execState,
                setExecState,
                availableTools,
                quickActions,
                timeline,
                addTimelineEntry,
                clearTimeline,
                activeSessionId,
                setActiveSessionId,
                inputDraft,
                setInputDraft,
                isVisible,
                voiceStatus: synapseVoice.status,
                isVoiceSpeaking: synapseVoice.isSpeaking,
                voicePhase: String(synapseVoice.voicePhase || synapseVoice.status),
                isVoiceToolActive: synapseVoice.isToolActive,
                voiceActivityLabel: synapseVoice.activeToolLabel,
                voiceActivityMessage: synapseVoice.activeToolMessage,
                getVoiceInputVolume: synapseVoice.getInputVolume,
                toggleVoiceMode,
                isVoiceExpanded,
                setIsVoiceExpanded,
                dailyActions,
                isIntelligenceLoading,
                scanProgress,
                syncDailyIntelligence,
            }}
        >
            {children}
        </SynapseContext.Provider>
    );
};

// ─── Hook ─────────────────────────────────────────────────────────────

export const useSynapse = () => {
    const ctx = useContext(SynapseContext);
    if (!ctx) throw new Error('useSynapse must be used within SynapseProvider');
    return ctx;
};
