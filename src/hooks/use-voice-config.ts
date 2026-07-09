import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { SynapseVoiceConfig } from '@/types/synapse-voice';

const DEEPGRAM_GATEWAY_URL = 'ws://localhost:8789/v1/synapse/voice';
const DEFAULT_DEEPGRAM_CONFIG: SynapseVoiceConfig = {
    token: null,
    expiresAt: null,
    newSessionExpiresAt: null,
    model: 'nemotron-3-nano-30B-A3B',
    voiceName: 'UgBBYS2sOqTuMpoF3BR0',
    provider: 'deepgram-agent',
    gatewayUrl: import.meta.env.VITE_SYNAPSE_VOICE_GATEWAY_URL || null,
    sessionId: null,
    conversationId: null,
    voiceSessionId: null,
};

const isLocalGatewayUrl = (value: string) =>
    /^wss?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?(?:\/|$)/i.test(value);

const isLocalBrowserRuntime = () => {
    if (typeof window === 'undefined') return import.meta.env.DEV;
    if (import.meta.env.DEV) return true;
    return /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(window.location.hostname);
};

const localBrowserGatewayUrl = () => {
    if (typeof window === 'undefined') return DEEPGRAM_GATEWAY_URL;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/v1/synapse/voice`;
};

const isSecureGatewayUrl = (value: string) => /^wss:\/\//i.test(value);

const resolveGatewayUrl = (remoteGatewayUrl: unknown) => {
    const configured = import.meta.env.VITE_SYNAPSE_VOICE_GATEWAY_URL || null;
    const remote = typeof remoteGatewayUrl === 'string' ? remoteGatewayUrl.trim() : '';
    const localRuntime = isLocalBrowserRuntime();
    const candidate = localRuntime
        ? configured && !isLocalGatewayUrl(configured)
            ? configured
            : localBrowserGatewayUrl()
        : configured || remote || null;
    if (!candidate) {
        throw new Error('Gateway publico de voz nao configurado.');
    }
    if (localRuntime) return candidate;
    if (isLocalGatewayUrl(candidate)) {
        throw new Error('Gateway local de voz nao pode ser usado em producao.');
    }
    if (!isSecureGatewayUrl(candidate)) {
        throw new Error('Gateway de voz em producao precisa usar WSS.');
    }
    return candidate;
};

export function useVoiceConfig() {
    const [config, setConfig] = useState<SynapseVoiceConfig>(DEFAULT_DEEPGRAM_CONFIG);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async (): Promise<SynapseVoiceConfig> => {
        setIsLoading(true);
        setError(null);
        try {
            const { data, error: invokeError } = await supabase.functions.invoke('synapse-voice-agent-session', {
                body: { includeSettings: false, context: { route: 'voice-config' } },
            });
            if (invokeError) throw invokeError;
            if (data?.error) throw new Error(String(data.error));

            const gatewayUrl = resolveGatewayUrl(data?.gatewayUrl);
            const provider = String(data?.provider || 'deepgram-agent');
            const sessionId = typeof data?.sessionId === 'string' ? data.sessionId : null;
            const conversationId = typeof data?.conversationId === 'string' ? data.conversationId : sessionId;
            const voiceSessionId = typeof data?.voiceSessionId === 'string' ? data.voiceSessionId : null;

            if (provider !== 'deepgram-agent') {
                throw new Error('Config de voz invalida para o Synapse.');
            }

            const next: SynapseVoiceConfig = {
                token: null,
                expiresAt: String(data?.expiresAt || ''),
                newSessionExpiresAt: String(data?.expiresAt || ''),
                model: String(data?.model || 'nemotron-3-nano-30B-A3B'),
                voiceName: String(data?.voiceName || 'UgBBYS2sOqTuMpoF3BR0'),
                provider,
                gatewayUrl,
                sessionId,
                conversationId,
                voiceSessionId,
                listenModel: typeof data?.listenModel === 'string' ? data.listenModel : undefined,
                ttsProvider: typeof data?.ttsProvider === 'string' ? data.ttsProvider : undefined,
                inputSampleRate: typeof data?.inputSampleRate === 'number' ? data.inputSampleRate : undefined,
                outputSampleRate: typeof data?.outputSampleRate === 'number' ? data.outputSampleRate : undefined,
                functionsCount: typeof data?.functionsCount === 'number' ? data.functionsCount : undefined,
            };
            setConfig(next);
            return next;
        } catch (caught) {
            const message = caught instanceof Error ? caught.message : 'Nao foi possivel preparar o agente de voz.';
            if (isLocalBrowserRuntime()) {
                const gatewayFallback: SynapseVoiceConfig = {
                    ...DEFAULT_DEEPGRAM_CONFIG,
                    gatewayUrl: resolveGatewayUrl(import.meta.env.VITE_SYNAPSE_VOICE_GATEWAY_URL || localBrowserGatewayUrl()),
                };
                console.warn('[Synapse Voice] Config remota indisponivel; usando gateway local Deepgram Agent.', message);
                setError(null);
                setConfig(gatewayFallback);
                return gatewayFallback;
            }

            const userMessage = 'Nao consegui preparar a voz do Synapse. Verifique o gateway de voz em producao.';
            console.warn('[Synapse Voice] Config remota indisponivel.', message);
            setError(userMessage);
            throw new Error(userMessage);
        } finally {
            setIsLoading(false);
        }
    }, []);

    return {
        token: config.token,
        expiresAt: config.expiresAt,
        newSessionExpiresAt: config.newSessionExpiresAt,
        model: config.model,
        voiceName: config.voiceName,
        provider: config.provider,
        gatewayUrl: config.gatewayUrl,
        sessionId: config.sessionId,
        conversationId: config.conversationId,
        voiceSessionId: config.voiceSessionId,
        listenModel: config.listenModel,
        ttsProvider: config.ttsProvider,
        functionsCount: config.functionsCount,
        isLoading,
        error,
        refresh,
    };
}
