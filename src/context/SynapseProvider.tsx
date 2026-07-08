import { createContext, ReactNode, useCallback, useContext, useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGeminiLive } from '@/hooks/use-gemini-live';
import { ALL_VOICE_TOOLS, executeVoiceTool } from '@/lib/voice-tools';
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

// ─── Provider ─────────────────────────────────────────────────────────

export const SynapseProvider = ({ children }: { children: ReactNode }) => {
    const { user, session } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

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
            setTimeline((prev) => [
                ...prev.slice(-19), // keep last 20 entries
                { ...entry, id, timestamp: new Date() },
            ]);
        },
        []
    );

    const clearTimeline = useCallback(() => setTimeline([]), []);

    // ─── Voice Integration (Gemini Live) ──────────────────────────────────
    const geminiLive = useGeminiLive({
        onConnect: () => {
            console.log('[Synapse Global Voice] Conectado ao Gemini Live');
            setExecState('listening');
        },
        onDisconnect: () => {
            console.log('[Synapse Global Voice] Desconectado do Gemini Live');
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
        if (geminiLive.status === 'error') {
            setExecState('error');
            return;
        }
        if (geminiLive.isToolActive) {
            setExecState('executing');
            return;
        }
        if (geminiLive.status === 'connecting') {
            setExecState('thinking');
            return;
        }
        if (geminiLive.status === 'connected') {
            setExecState(geminiLive.isSpeaking ? 'thinking' : 'listening');
            return;
        }
        setExecState('idle');
    }, [activeTab, geminiLive.isSpeaking, geminiLive.isToolActive, geminiLive.status]);

    const buildClientTools = useCallback(() => {
        const accessToken = session?.access_token;
        if (!accessToken) return {};

        const tools: Record<string, (params: unknown) => Promise<string>> = {};

        for (const toolName of ALL_VOICE_TOOLS) {
            tools[toolName] = async (params: unknown) => {
                const toolParams = params && typeof params === 'object' ? params as Record<string, unknown> : {};
                addTimelineEntry({
                    label: `🎙️ Voz: ${toolName}`,
                    state: 'thinking',
                    detail: JSON.stringify(toolParams).slice(0, 100),
                });
                const result = await executeVoiceTool(toolName, toolParams, accessToken, navigate);
                try {
                    const parsed = JSON.parse(result);
                    addTimelineEntry({
                        label: `✅ ${toolName} concluído`,
                        state: parsed.success ? 'success' : 'error',
                        detail: parsed.response?.slice(0, 120) || parsed.error || '',
                    });
                } catch {
                    addTimelineEntry({ label: `✅ ${toolName} concluído`, state: 'success' });
                }
                return result;
            };
        }
        return tools;
    }, [session?.access_token, navigate, addTimelineEntry]);

    const toggleVoiceMode = useCallback(async () => {
        if (geminiLive.status === 'connected') {
            await geminiLive.endSession();
            setActiveTab('chat');
            setExecState('idle');
        } else {
            setActiveTab('voice');
            setExecState('thinking');
            try {
                console.log('[Synapse Global Voice] Iniciando sessão...');
                const clientTools = buildClientTools();
                await geminiLive.startSession({ clientTools });
            } catch (err) {
                console.error("[Synapse Global Voice] Falha ao iniciar:", err);
                setExecState('error');
                setTimeout(() => {
                    setActiveTab('chat');
                    setExecState('idle');
                }, 2500);
            }
        }
    }, [geminiLive, buildClientTools, setActiveTab, setExecState]);
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
                voiceStatus: geminiLive.status,
                isVoiceSpeaking: geminiLive.isSpeaking,
                voicePhase: String(geminiLive.voicePhase || geminiLive.status),
                isVoiceToolActive: geminiLive.isToolActive,
                voiceActivityLabel: geminiLive.activeToolLabel,
                voiceActivityMessage: geminiLive.activeToolMessage,
                getVoiceInputVolume: geminiLive.getInputVolume,
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
