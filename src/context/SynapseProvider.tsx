import { ReactNode, useCallback, useRef, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSynapseLiveVoice } from '@/hooks/use-synapse-live-voice';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import { routeSupportsDesktopSynapseShell } from '@/lib/synapse-surface';
import { getToolsForRoute, getQuickActionsForRoute } from '@/lib/synapse-tool-catalog';
import {
    cancelSynapseInterfaceAction,
    type SynapseActionLifecycleEvent,
} from '@/lib/synapse-interface-actions';
import {
    SynapseContext,
    type SynapseActiveTab,
    type SynapseExecState,
    type SynapseInlineTurn,
    type SynapseShellState,
    type SynapseTimelineEntry,
} from './SynapseContext';

export type {
    SynapseActiveTab,
    SynapseExecState,
    SynapseInlineTurn,
    SynapseShellState,
    SynapseTimelineEntry,
} from './SynapseContext';

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

export const SynapseProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const location = useLocation();

    const [shellState, setShellState] = useState<SynapseShellState>('pill');
    const [activeTab, setActiveTab] = useState<SynapseActiveTab>('chat');
    const [execState, setExecState] = useState<SynapseExecState>('idle');

    const [timeline, setTimeline] = useState<SynapseTimelineEntry[]>([]);
    const [actionExperience, setActionExperience] = useState<SynapseActionLifecycleEvent | null>(null);
    const [isVoiceExpanded, setIsVoiceExpanded] = useState(false);
    const timelineIdCounter = useRef(0);

    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [inputDraft, setInputDraft] = useState('');
    const [intentContextHint, setIntentContextHint] = useState('');
    const [inlineTurn, setInlineTurn] = useState<SynapseInlineTurn | null>(null);

    const isMobile = useIsMobile();

    const isVisible =
        !isMobile &&
        !!user &&
        routeSupportsDesktopSynapseShell(location.pathname);

    const baseTools = getToolsForRoute(location.pathname);
    const quickActions = getQuickActionsForRoute(location.pathname).slice(0, 6);
    const availableTools = baseTools;

    const toggleCompact = useCallback(() => {
        setShellState((prev) => (prev === 'compact' ? 'composer' : 'compact'));
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
                ...prev.slice(-19),
                { ...safeEntry, id, timestamp: new Date() },
            ]);
        },
        [],
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
                console.error('[Synapse Global Voice] Falha ao iniciar:', err);
                setExecState('error');
                setTimeout(() => {
                    setActiveTab('chat');
                    setExecState('idle');
                }, 2500);
            }
        }
    }, [synapseVoice]);

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
                intentContextHint,
                setIntentContextHint,
                inlineTurn,
                setInlineTurn,
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
