import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface VoiceConfig {
    token: string | null;
    expiresAt: string | null;
    newSessionExpiresAt: string | null;
    model: string;
    voiceName: string;
    provider: string;
    gatewayUrl: string | null;
    sessionId: string | null;
    listenModel?: string;
    ttsProvider?: string;
    inputSampleRate?: number;
    outputSampleRate?: number;
}

const DEEPGRAM_GATEWAY_URL = 'ws://localhost:8789/v1/synapse/voice';
const DEFAULT_DEEPGRAM_CONFIG: VoiceConfig = {
    token: null,
    expiresAt: null,
    newSessionExpiresAt: null,
    model: 'nemotron-3-nano-30B-A3B',
    voiceName: 'UgBBYS2sOqTuMpoF3BR0',
    provider: 'deepgram-agent',
    gatewayUrl: import.meta.env.VITE_SYNAPSE_VOICE_GATEWAY_URL || null,
    sessionId: null,
};

const LEGACY_CASCADE_CONFIG: VoiceConfig = {
    token: 'local-cascade',
    expiresAt: 'local',
    newSessionExpiresAt: 'local',
    model: 'groq-cascade',
    voiceName: 'device-pt-BR',
    provider: 'legacy-cascade',
    gatewayUrl: null as string | null,
    sessionId: null as string | null,
};

const isLocalGatewayUrl = (value: string) =>
    /^wss?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?(?:\/|$)/i.test(value);

const resolveGatewayUrl = (remoteGatewayUrl: unknown) => {
    if (import.meta.env.DEV && import.meta.env.VITE_SYNAPSE_VOICE_GATEWAY_URL) {
        return import.meta.env.VITE_SYNAPSE_VOICE_GATEWAY_URL;
    }
    const configured = import.meta.env.VITE_SYNAPSE_VOICE_GATEWAY_URL || null;
    const remote = typeof remoteGatewayUrl === 'string' ? remoteGatewayUrl.trim() : '';
    const candidate = configured || remote || null;
    if (!candidate) return null;
    if (!import.meta.env.DEV && isLocalGatewayUrl(candidate)) return null;
    return candidate;
};

export function useVoiceConfig() {
    const [config, setConfig] = useState<VoiceConfig>(() => {
        if (import.meta.env.VITE_SYNAPSE_VOICE_PROVIDER === 'legacy-cascade') {
            return LEGACY_CASCADE_CONFIG;
        }
        return DEFAULT_DEEPGRAM_CONFIG;
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async (): Promise<VoiceConfig> => {
        const forcedProvider = import.meta.env.VITE_SYNAPSE_VOICE_PROVIDER;
        if (forcedProvider === 'legacy-cascade') {
            setConfig(LEGACY_CASCADE_CONFIG);
            setError(null);
            return LEGACY_CASCADE_CONFIG;
        }

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

            if (provider === 'deepgram-agent' && !gatewayUrl) {
                const fallback = { ...LEGACY_CASCADE_CONFIG, sessionId };
                console.warn('[Synapse Voice] Gateway remoto ausente; usando conversa por voz alternativa.');
                setConfig(fallback);
                return fallback;
            }

            const next: VoiceConfig = {
                token: null,
                expiresAt: String(data?.expiresAt || ''),
                newSessionExpiresAt: String(data?.expiresAt || ''),
                model: String(data?.model || 'nemotron-3-nano-30B-A3B'),
                voiceName: String(data?.voiceName || 'UgBBYS2sOqTuMpoF3BR0'),
                provider,
                gatewayUrl,
                sessionId,
                listenModel: typeof data?.listenModel === 'string' ? data.listenModel : undefined,
                ttsProvider: typeof data?.ttsProvider === 'string' ? data.ttsProvider : undefined,
                inputSampleRate: typeof data?.inputSampleRate === 'number' ? data.inputSampleRate : undefined,
                outputSampleRate: typeof data?.outputSampleRate === 'number' ? data.outputSampleRate : undefined,
            };
            setConfig(next);
            return next;
        } catch (caught) {
            const message = caught instanceof Error ? caught.message : 'Nao foi possivel preparar o agente de voz.';
            const gatewayUrl = resolveGatewayUrl(import.meta.env.VITE_SYNAPSE_VOICE_GATEWAY_URL || DEEPGRAM_GATEWAY_URL);

            if (gatewayUrl) {
                const gatewayFallback: VoiceConfig = {
                    ...DEFAULT_DEEPGRAM_CONFIG,
                    gatewayUrl,
                };
                console.warn('[Synapse Voice] Config remota indisponivel; usando gateway configurado.', message);
                setError(null);
                setConfig(gatewayFallback);
                return gatewayFallback;
            }

            console.warn('[Synapse Voice] Config remota indisponivel; usando conversa por voz alternativa.', message);
            setError(null);
            setConfig(LEGACY_CASCADE_CONFIG);
            return LEGACY_CASCADE_CONFIG;
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
        listenModel: config.listenModel,
        ttsProvider: config.ttsProvider,
        isLoading,
        error,
        refresh,
    };
}
