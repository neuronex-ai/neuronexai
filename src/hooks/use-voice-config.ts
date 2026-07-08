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
    model: 'gpt-4o-mini',
    voiceName: 'cartesia-sonic',
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

const isLegacyCascadeEnabled = () => import.meta.env.VITE_SYNAPSE_LEGACY_CASCADE_ENABLED === 'true';

export function useVoiceConfig() {
    const [config, setConfig] = useState<VoiceConfig>(() => {
        if (import.meta.env.VITE_SYNAPSE_VOICE_PROVIDER === 'legacy-cascade' && isLegacyCascadeEnabled()) {
            return LEGACY_CASCADE_CONFIG;
        }
        return DEFAULT_DEEPGRAM_CONFIG;
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async (): Promise<VoiceConfig> => {
        const forcedProvider = import.meta.env.VITE_SYNAPSE_VOICE_PROVIDER;
        if (forcedProvider === 'legacy-cascade') {
            if (isLegacyCascadeEnabled()) {
                setConfig(LEGACY_CASCADE_CONFIG);
                setError(null);
                return LEGACY_CASCADE_CONFIG;
            }
            console.warn('[Synapse Voice] legacy-cascade solicitado, mas isolado; usando deepgram-agent.');
        }

        setIsLoading(true);
        setError(null);
        try {
            const { data, error: invokeError } = await supabase.functions.invoke('synapse-voice-agent-session', {
                body: { includeSettings: false, context: { route: 'voice-config' } },
            });
            if (invokeError) throw invokeError;
            if (data?.error) throw new Error(String(data.error));

            const next: VoiceConfig = {
                token: null,
                expiresAt: String(data?.expiresAt || ''),
                newSessionExpiresAt: String(data?.expiresAt || ''),
                model: String(data?.model || 'gpt-4o-mini'),
                voiceName: String(data?.voiceName || 'cartesia-sonic'),
                provider: String(data?.provider || 'deepgram-agent'),
                gatewayUrl: typeof data?.gatewayUrl === 'string' ? data.gatewayUrl : import.meta.env.VITE_SYNAPSE_VOICE_GATEWAY_URL || null,
                sessionId: typeof data?.sessionId === 'string' ? data.sessionId : null,
                listenModel: typeof data?.listenModel === 'string' ? data.listenModel : undefined,
                ttsProvider: typeof data?.ttsProvider === 'string' ? data.ttsProvider : undefined,
                inputSampleRate: typeof data?.inputSampleRate === 'number' ? data.inputSampleRate : undefined,
                outputSampleRate: typeof data?.outputSampleRate === 'number' ? data.outputSampleRate : undefined,
            };
            setConfig(next);
            return next;
        } catch (caught) {
            const message = caught instanceof Error ? caught.message : 'Nao foi possivel preparar o agente de voz.';
            const gatewayFallback: VoiceConfig = {
                ...DEFAULT_DEEPGRAM_CONFIG,
                token: null,
                expiresAt: null,
                newSessionExpiresAt: null,
                model: 'gpt-4o-mini',
                voiceName: 'cartesia-sonic',
                provider: 'deepgram-agent',
                gatewayUrl: import.meta.env.VITE_SYNAPSE_VOICE_GATEWAY_URL || DEEPGRAM_GATEWAY_URL,
            };

            if (import.meta.env.DEV || import.meta.env.VITE_SYNAPSE_VOICE_GATEWAY_URL) {
                console.warn('[Synapse Voice] Config remota indisponivel; usando gateway local.', message);
                setError(null);
                setConfig(gatewayFallback);
                return gatewayFallback;
            }

            setError(message);
            setConfig(DEFAULT_DEEPGRAM_CONFIG);
            throw new Error(message);
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
