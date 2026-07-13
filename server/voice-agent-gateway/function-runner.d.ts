export class VoiceFunctionRunner {
  constructor(options: {
    sendDeepgram: (payload: Record<string, unknown>) => void;
    sendClient: (payload: Record<string, unknown>) => void;
    invokeTool: (input: {
      id: string;
      name: string;
      arguments: Record<string, unknown>;
      signal?: AbortSignal;
    }) => Promise<Record<string, unknown>>;
  });
  handleFunctionCallRequest(payload: {
    functions: Array<{
      id: string;
      name: string;
      arguments: string;
      client_side?: boolean;
      thought_signature?: string;
    }>;
  }): Promise<void>;
  handleClientActionResult(payload: {
    type?: string;
    id?: string;
    callId?: string;
    call_id?: string;
    success?: boolean;
    message?: string;
    cancelled?: boolean;
    durationMs?: number;
    duration_ms?: number;
  }): boolean;
  onUserStartedSpeaking(): void;
  onUserTranscript(transcript: string): void;
}
