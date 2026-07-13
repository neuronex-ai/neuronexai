import { createContext, ReactNode, useCallback, useContext, useRef, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSynapseLiveVoice } from '@/hooks/use-synapse-live-voice';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import { getToolsForRoute, getQuickActionsForRoute, SynapseTool } from '@/lib/synapse-tool-catalog';
import {
    cancelSynapseInterfaceAction,
    type SynapseActionLifecycleEvent,
} from '@/lib/synapse-interface-actions';
import type { PcmAudioSignal } from '@/lib/pcm-audio-player';

// ─── Types ────────────────────────────────────────────────────────────

export type SynapseShellState = 'closed' | 'pill' | 'compact';

export type SynapseExecState =
    | 'idle'
    | 'listening'
    | 'thinking'
    | 'executing'
    | 'success'
    | 'error';

export type SynapseActiveTab = 'chat' | 'voice' | 'history' | 'timeline';

export interface SynapseTimelineEntry {
    id: string;
    timestamp: Date;
    label: string;
    state: SynapseExecState;
    toolId?: string;
    detail?: string;
    actionPath?: string;
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
    quickActions: SynapseTool[];

    // Timeline
    timeline: SynapseTimelineEntry[];
    addTimelineEntry: (entry: Omit<SynapseTimelineEntry, 'id' | 'timestamp'>) => void;
    clearTimeline: () => void;

    // Assisted interface action
    actionExperience: SynapseActionLifecycleEvent | null;
    setActionExperience: (event: SynapseActionLifecycleEvent | null) => void;
    cancelActionExperience: () => void;

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
    voiceActivityToolName: string;
    voiceActivityLabel: string;
    voiceActivityMessage: string;
    voiceActivityElapsedMs: number;
    getVoiceInputVolume: () => number;
    getVoiceInputSignal: () => PcmAudioSignal;
    getVoiceOutputSignal: () => PcmAudioSignal;
    toggleVoiceMode: () => Promise<void>;
    isVoiceExpanded: boolean;
    setIsVoiceExpanded: (expanded: boolean) => void;

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
    request_interface_action: 'Ação assistida',
    analyze_neuroview_patient_patterns: 'Análise NeuroView',
    create_neuroflow_from_patient_history: 'Criação NeuroFlow',
    create_neuropulse_cause_effect_diagram: 'Criação NeuroPulse',
};

const sanitizeTimelineText = (value?: string) => {
    if (!value) return value;
    let next = value;
    for (const [toolName, label] of Object.entries(VOICE_TOOL_LABELS)) {
        next = next.replace(new RegExp(toolName, 'gi'), label);
    }
    return next
        .replace(/[{}[\]"]/g, '')
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

    // Execution state
    const [execState, setExecState] = useState<SynapseExecState>('idle');

    // Timeline
    const [timeline, setTimeline] = useState<SynapseTimelineEntry[]>([]);
    const [actionExperience, setActionExperience] = useState<SynapseActionLifecycleEvent | null>(null);
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
    const quickActions = getQuickActionsForRoute(location.pathname).slice(0, 6);

    const availableTools = baseTools;

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

    const cancelActionExperience = useCallback(() => {
        cancelSynapseInterfaceAction();
        setActionExperience(null);
    }, []);

    useEffect(() => {
        if (!actionExperience || !['completed', 'error'].includes(actionExperience.phase)) return;
        const timeout = window.setTimeout(
            () => setActionExperience((current) => current?.id === actionExperience.id ? null : current),
            actionExperience.phase === 'completed' ? 4200 : 5200,
        );
        return () => window.clearTimeout(timeout);
    }, [actionExperience]);

    // ─── Voice Integration (Deepgram Agent) ───────────────────────────────
    const synapseVoice = useSynapseLiveVoice({
        onActionLifecycle: setActionExperience,
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
    }, [synapseVoice.isSpeaking, synapseVoice.isToolActive, synapseVoice.status]);

    const toggleVoiceMode = useCallback(async () => {
        if (synapseVoice.status === 'connected' || synapseVoice.status === 'connecting' || synapseVoice.status === 'disconnecting') {
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
                actionExperience,
                setActionExperience,
                cancelActionExperience,
                activeSessionId,
                setActiveSessionId,
                inputDraft,
                setInputDraft,
                isVisible,
                voiceStatus: synapseVoice.status,
                isVoiceSpeaking: synapseVoice.isSpeaking,
                voicePhase: String(synapseVoice.voicePhase || synapseVoice.status),
                isVoiceToolActive: synapseVoice.isToolActive,
                voiceActivityToolName: synapseVoice.activeTool?.name || '',
                voiceActivityLabel: synapseVoice.activeToolLabel,
                voiceActivityMessage: synapseVoice.activeToolMessage,
                voiceActivityElapsedMs: synapseVoice.activeToolElapsedMs,
                getVoiceInputVolume: synapseVoice.getInputVolume,
                getVoiceInputSignal: synapseVoice.getInputAudioSignal,
                getVoiceOutputSignal: synapseVoice.getOutputAudioSignal,
                toggleVoiceMode,
                isVoiceExpanded,
                setIsVoiceExpanded,
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
