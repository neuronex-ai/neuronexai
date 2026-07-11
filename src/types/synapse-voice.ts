export type SynapseVoiceProvider = "deepgram-agent";

export type SynapseVoicePhase =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "tool_active"
  | "tool_retrying"
  | "tool_cancelling"
  | "awaiting_confirmation"
  | "reconnecting"
  | "error";

export type SynapseVoiceFunctionStatus =
  | "started"
  | "progress"
  | "retrying"
  | "confirmation_required"
  | "completed"
  | "failed"
  | "cancelled"
  | "cancelling"
  | "complement_received";

export interface SynapseVoiceToolState {
  id: string;
  name: string;
  label: string;
  message: string;
  status: SynapseVoiceFunctionStatus | string;
  startedAt: number;
  elapsedMs: number;
  confirmationRequired?: boolean;
}

export interface SynapseVoiceStartOverride {
  token?: string | null;
  model?: string;
  voiceName?: string;
  gatewayUrl?: string | null;
  provider?: string | null;
  sessionId?: string | null;
  conversationId?: string | null;
  voiceSessionId?: string | null;
  inputSampleRate?: number;
  outputSampleRate?: number;
  context?: Record<string, unknown>;
}

export interface SynapseVoiceConfig {
  token: string | null;
  expiresAt: string | null;
  newSessionExpiresAt: string | null;
  model: string;
  voiceName: string;
  provider: string;
  gatewayUrl: string | null;
  sessionId: string | null;
  conversationId: string | null;
  voiceSessionId: string | null;
  listenModel?: string;
  ttsProvider?: string;
  inputSampleRate?: number;
  outputSampleRate?: number;
  functionsCount?: number;
}
