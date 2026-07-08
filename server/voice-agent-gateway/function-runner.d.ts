export class VoiceFunctionRunner {
  constructor(options: {
    sendDeepgram: (payload: Record<string, unknown>) => void;
    sendClient: (payload: Record<string, unknown>) => void;
    invokeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  });
  handleFunctionCallRequest(payload: { functions: Array<{ id: string; name: string; arguments: string }> }): Promise<void>;
  onUserStartedSpeaking(): void;
  onUserTranscript(transcript: string): void;
}
