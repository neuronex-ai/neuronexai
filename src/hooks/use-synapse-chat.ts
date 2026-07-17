import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useSynapse } from '@/context/SynapseContext';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { useAI } from '@/context/AIContext';
import {
    useCreateChatSession,
    useSessionMessages,
    useDeleteChatSession,
    type SynapseProgressEvent,
} from '@/hooks/use-ai-chat';
import { useSendChatMessage } from '@/hooks/use-ai-chat-resilient';
import { Message } from '@/types';
import {
    executeSynapseInterfaceAction,
    isCurrentCancelledSynapseAction,
    normalizeSynapseClientAction,
    type SynapseInterfaceAction,
} from '@/lib/synapse-interface-actions';
import { sanitizeSynapseDisplayText } from '@/lib/synapse-humanize';
import {
    parseAppointmentPlanReviewAction,
    requestAppointmentPlanReview,
} from '@/lib/appointment-plan-review';

// ─── Synapse Chat Hook ────────────────────────────────────────────────
// Text and voice share sessions, memory, tools and the same structured
// interface-action executor. Only their presentation differs.

const conversationTitleFromPrompt = (prompt: string) => {
    const title = prompt
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/[*_~`>#()]|\[|\]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[.!?;:,]+$/g, '')
        .slice(0, 72)
        .trim();
    return title || 'Conversa com o Synapse';
};

const INTERFACE_TARGET_LABELS: Record<string, string> = {
    dashboard: 'Dashboard',
    agenda: 'Agenda',
    patients: 'Pacientes',
    finance: 'Financeiro',
    notes: 'Notas',
    teleconsultation: 'Teleconsulta',
    synapse: 'Synapse AI',
};

const describeInterfaceAction = (action: SynapseInterfaceAction) => {
    const query = sanitizeSynapseDisplayText(action.query, '').slice(0, 64);
    const target = action.target ? INTERFACE_TARGET_LABELS[action.target] : null;

    switch (action.action) {
        case 'filter_patients_directory':
            return query ? `Filtrando pacientes por "${query}"` : 'Filtrando pacientes no sistema';
        case 'open_patient':
            return 'Abrindo ficha do paciente';
        case 'open_patient_record':
            return 'Abrindo prontuário do paciente';
        case 'open_daily_schedule':
            return 'Abrindo agenda clínica';
        case 'scroll_to_appointment':
            return 'Localizando atendimento na agenda';
        case 'open_modal':
            return 'Preparando janela de ação';
        case 'highlight_element':
            return 'Destacando informação na tela';
        case 'open_notes_desktop':
        case 'switch_notes_view':
        case 'filter_notes':
        case 'open_note':
        case 'open_new_note':
        case 'open_note_module':
        case 'open_tasks_board':
        case 'open_files_manager':
        case 'open_notion_panel':
        case 'open_file_preview':
        case 'open_neuroview_reasoning':
        case 'open_neuroflow_generation':
        case 'open_neuropulse_diagram':
            return query ? `Organizando notas por "${query}"` : 'Abrindo NeuroDrive';
        case 'open_teleconsultation_lobby':
            return 'Abrindo teleconsulta';
        case 'open_patient_invite_modal':
            return 'Preparando convite do paciente';
        case 'navigate':
        default:
            return target ? `Abrindo ${target}` : 'Atualizando a interface';
    }
};

export const useSynapseChat = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const {
        activeSessionId,
        setActiveSessionId,
        setExecState,
        addTimelineEntry,
        setActionExperience,
    } = useSynapse();
    const { currentContext, contextSummary, activePatientId } = useAI();

    const createSession = useCreateChatSession();
    const sendMessage = useSendChatMessage();
    const { data: messages, isLoading: messagesLoading } = useSessionMessages(activeSessionId);
    const [progressEvent, setProgressEvent] = useState<SynapseProgressEvent | null>(null);

    const lastPatientIdRef = useRef<string | null>(null);
    const activeLifecycleIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (activePatientId) lastPatientIdRef.current = activePatientId;
    }, [activePatientId]);

    const send = useCallback(
        (message: string) => {
            const cleanMessage = message.trim();
            if (!user || !cleanMessage) return;

            setExecState('thinking');
            setProgressEvent({
                stage: 'received',
                label: 'Preparando solicitação',
                detail: 'Enviando contexto ao Synapse',
            });
            addTimelineEntry({
                label: cleanMessage,
                state: 'thinking',
                detail: `Contexto: ${currentContext}`,
            });

            const dispatch = async () => {
                let sessionId = activeSessionId;
                if (!sessionId) {
                    const newSession = await createSession.mutateAsync(conversationTitleFromPrompt(cleanMessage));
                    sessionId = newSession.id;
                    setActiveSessionId(sessionId);
                }
                if (!sessionId) throw new Error('Não foi possível iniciar a conversa.');

                sendMessage.mutate(
                {
                    message: cleanMessage,
                    sessionId,
                    context: {
                        route: currentContext,
                        summary: contextSummary,
                        patientId: activePatientId || lastPatientIdRef.current,
                        channel: 'text',
                        source: 'synapse-shell',
                    },
                    streamProgress: true,
                    onProgress: setProgressEvent,
                },
                {
                    onSuccess: async (data) => {
                        const appointmentPlan = parseAppointmentPlanReviewAction(data?.clientAction);
                        if (appointmentPlan) {
                            requestAppointmentPlanReview(appointmentPlan);
                            setExecState('success');
                            addTimelineEntry({
                                label: 'Plano de agendamento pronto para revisão',
                                state: 'success',
                                detail: 'A confirmação será feita com os dados atualizados do servidor.',
                            });
                            window.setTimeout(() => setExecState('idle'), 2200);
                            setProgressEvent(null);
                            return;
                        }
                        const action = normalizeSynapseClientAction(data?.clientAction);

                        if (action) {
                            const actionLabel = describeInterfaceAction(action);
                            setExecState('executing');
                            addTimelineEntry({
                                label: actionLabel,
                                state: 'executing',
                                toolId: action.action,
                                detail: sanitizeSynapseDisplayText(action.reason, 'Aplicando a solicitação no painel.'),
                            });

                            const result = await executeSynapseInterfaceAction(action, {
                                navigate,
                                channel: 'text',
                                onLifecycle: (event) => {
                                    activeLifecycleIdRef.current = event.id;
                                    setActionExperience(event);
                                },
                            });

                            if (isCurrentCancelledSynapseAction(result, activeLifecycleIdRef.current)) {
                                activeLifecycleIdRef.current = null;
                                setActionExperience(null);
                            }

                            setExecState(result.success ? 'success' : result.cancelled ? 'idle' : 'error');
                            addTimelineEntry({
                                label: result.success
                                    ? 'Ação de interface concluída'
                                    : result.cancelled
                                      ? 'Ação cancelada'
                                      : 'Não foi possível concluir a ação',
                                state: result.success ? 'success' : result.cancelled ? 'idle' : 'error',
                                toolId: action.action,
                                detail: result.message,
                            });
                        } else {
                            setExecState('success');
                            addTimelineEntry({
                                label: data?.response?.slice(0, 80) || 'Resposta recebida',
                                state: 'success',
                            });
                        }

                        window.setTimeout(() => setExecState('idle'), 2200);
                        setProgressEvent(null);
                    },
                    onError: (error) => {
                        setExecState('error');
                        setProgressEvent(null);
                        addTimelineEntry({
                            label: error.message || 'Erro ao processar',
                            state: 'error',
                        });
                        window.setTimeout(() => setExecState('idle'), 3000);
                    },
                },
                );
            };

            void dispatch().catch(() => {
                setExecState('error');
                setProgressEvent(null);
                addTimelineEntry({
                    label: 'Não foi possível iniciar a conversa',
                    state: 'error',
                });
                toast.error('Não foi possível iniciar a conversa.');
                window.setTimeout(() => setExecState('idle'), 3000);
            });
        },
        [
            user,
            activeSessionId,
            currentContext,
            contextSummary,
            activePatientId,
            setExecState,
            addTimelineEntry,
            sendMessage,
            navigate,
            setActionExperience,
            createSession,
            setActiveSessionId,
        ],
    );

    const deleteSession = useDeleteChatSession();

    const clearSession = useCallback(() => {
        if (!activeSessionId) return;
        deleteSession.mutate(activeSessionId, {
            onSuccess: () => setActiveSessionId(null),
        });
    }, [activeSessionId, deleteSession, setActiveSessionId]);

    const startNewSession = useCallback(async () => {
        if (createSession.isPending || sendMessage.isPending) return false;
        setActiveSessionId(null);
        setProgressEvent(null);
        setExecState('idle');
        return true;
    }, [createSession.isPending, sendMessage.isPending, setActiveSessionId, setExecState]);

    return {
        send,
        clearSession,
        startNewSession,
        messages: (messages || []) as Message[],
        isSending: sendMessage.isPending || createSession.isPending,
        isStartingSession: createSession.isPending,
        progressEvent,
        messagesLoading,
        sessionReady: Boolean(user),
    };
};
