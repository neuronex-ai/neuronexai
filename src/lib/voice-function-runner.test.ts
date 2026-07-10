import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { VoiceFunctionRunner } from "../../server/voice-agent-gateway/function-runner.js";

const toolResponse = (payload: Record<string, unknown>) => ({
  content: JSON.stringify(payload),
});

const tick = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

function createHarness(invokeTool = vi.fn(async () => toolResponse({ ok: true, spoken_summary: "Concluido." }))) {
  const deepgram: Array<Record<string, unknown>> = [];
  const client: Array<Record<string, unknown>> = [];
  const runner = new VoiceFunctionRunner({
    sendDeepgram: (payload: Record<string, unknown>) => deepgram.push(payload),
    sendClient: (payload: Record<string, unknown>) => client.push(payload),
    invokeTool,
  });

  return { runner, deepgram, client, invokeTool };
}

describe("VoiceFunctionRunner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("injects initial and slow progress feedback while a tool is running", async () => {
    let resolveTool: ((value: ReturnType<typeof toolResponse>) => void) | undefined;
    const { runner, deepgram, client } = createHarness(vi.fn(() => new Promise((resolve) => {
      resolveTool = resolve;
    })));

    const task = runner.handleFunctionCallRequest({
      functions: [{ id: "fn-1", name: "get_patient_overview", arguments: JSON.stringify({ patient_name: "Ana" }) }],
    });
    await tick();

    expect(deepgram[0]).toMatchObject({ type: "InjectAgentMessage", behavior: "queue" });
    expect(client.some((event) => event.type === "function_status" && event.status === "started")).toBe(true);

    await vi.advanceTimersByTimeAsync(5500);
    expect(deepgram.some((event) => event.type === "InjectAgentMessage" && String(event.message).includes("Ana"))).toBe(true);
    expect(deepgram.filter((event) => event.type === "InjectAgentMessage").every((event) => !("content" in event))).toBe(true);
    expect(client.some((event) => event.type === "function_status" && event.status === "progress")).toBe(true);

    resolveTool?.(toolResponse({ ok: true, spoken_summary: "Achei o resumo de Ana." }));
    await task;

    expect(deepgram.some((event) => event.type === "FunctionCallResponse" && event.name === "get_patient_overview")).toBe(true);
    expect(client.some((event) => event.type === "function_status" && event.status === "completed")).toBe(true);
  });

  it("retries a retryable tool response once", async () => {
    const invokeTool = vi
      .fn()
      .mockResolvedValueOnce(toolResponse({ ok: false, retryable: true, spoken_summary: "Timeout temporario." }))
      .mockResolvedValueOnce(toolResponse({ ok: true, spoken_summary: "Agora deu certo." }));
    const { runner, client } = createHarness(invokeTool);

    const task = runner.handleFunctionCallRequest({
      functions: [{ id: "fn-2", name: "list_appointments", arguments: "{}" }],
    });
    await tick();
    await vi.advanceTimersByTimeAsync(650);
    await task;

    expect(invokeTool).toHaveBeenCalledTimes(2);
    expect(client.some((event) => event.type === "function_status" && event.status === "retrying")).toBe(true);
  });

  it("retries once when a tool call times out", async () => {
    let attempts = 0;
    const invokeTool = vi.fn(({ signal }: { signal: AbortSignal }) => {
      attempts += 1;
      if (attempts === 1) {
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted by timeout")));
        });
      }
      return Promise.resolve(toolResponse({ ok: true, spoken_summary: "Consegui na segunda tentativa." }));
    });
    const { runner, client } = createHarness(invokeTool);

    const task = runner.handleFunctionCallRequest({
      functions: [{ id: "fn-timeout", name: "get_patient_system_snapshot", arguments: "{}" }],
    });
    await tick();
    await vi.advanceTimersByTimeAsync(18000);
    await vi.advanceTimersByTimeAsync(650);
    await task;

    expect(invokeTool).toHaveBeenCalledTimes(2);
    expect(client.some((event) => event.type === "function_status" && event.status === "retrying")).toBe(true);
    expect(client.some((event) => event.type === "function_status" && event.status === "completed")).toBe(true);
  });

  it("keeps a prepared sensitive action awaiting confirmation", async () => {
    const { runner, client } = createHarness(vi.fn(async () => toolResponse({
      ok: true,
      confirmation_required: true,
      spoken_summary: "Preparei o agendamento. Posso confirmar?",
    })));

    await runner.handleFunctionCallRequest({
      functions: [{ id: "fn-confirm", name: "create_appointment", arguments: "{}" }],
    });

    expect(client.some((event) => event.type === "function_status" && event.status === "confirmation_required")).toBe(true);
    expect(client.some((event) => event.type === "voice_state" && event.phase === "awaiting_confirmation")).toBe(true);
  });

  it("aborts an active function when the user asks to cancel", async () => {
    let capturedSignal: AbortSignal | undefined;
    const invokeTool = vi.fn(({ signal }: { signal: AbortSignal }) => {
      capturedSignal = signal;
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          const error = new Error("cancelled");
          error.name = "AbortError";
          reject(error);
        });
      });
    });
    const { runner, deepgram, client } = createHarness(invokeTool);

    const task = runner.handleFunctionCallRequest({
      functions: [{ id: "fn-3", name: "get_financial_summary", arguments: "{}" }],
    });
    await tick();
    runner.onUserStartedSpeaking();
    runner.onUserTranscript("cancela isso");
    await task;

    expect(capturedSignal?.aborted).toBe(true);
    expect(client.some((event) => event.type === "function_status" && event.status === "cancelling")).toBe(true);
    const response = deepgram.find((event) => event.type === "FunctionCallResponse");
    expect(JSON.parse(String(response?.content || "{}"))).toMatchObject({ ok: false, cancelled: true });
  });

  it("keeps the function alive when the user complements the request", async () => {
    let resolveTool: ((value: ReturnType<typeof toolResponse>) => void) | undefined;
    let capturedSignal: AbortSignal | undefined;
    const invokeTool = vi.fn(({ signal }: { signal: AbortSignal }) => {
      capturedSignal = signal;
      return new Promise((resolve) => {
        resolveTool = resolve;
      });
    });
    const { runner, client } = createHarness(invokeTool);

    const task = runner.handleFunctionCallRequest({
      functions: [{ id: "fn-4", name: "search_patients", arguments: "{}" }],
    });
    await tick();
    runner.onUserStartedSpeaking();
    runner.onUserTranscript("inclui tambem os pacientes de hoje");
    resolveTool?.(toolResponse({ ok: true, spoken_summary: "Inclui o complemento." }));
    await task;

    expect(capturedSignal?.aborted).toBe(false);
    expect(client.some((event) => event.type === "function_status" && event.status === "complement_received")).toBe(true);
  });

  it("runs multiple requested tools in sequence", async () => {
    const order: string[] = [];
    const invokeTool = vi.fn(async ({ name }: { name: string }) => {
      order.push(`start:${name}`);
      await Promise.resolve();
      order.push(`end:${name}`);
      return toolResponse({ ok: true, spoken_summary: `${name} pronto.` });
    });
    const { runner } = createHarness(invokeTool);

    await runner.handleFunctionCallRequest({
      functions: [
        { id: "fn-5", name: "first_tool", arguments: "{}" },
        { id: "fn-6", name: "second_tool", arguments: "{}" },
      ],
    });

    expect(order).toEqual(["start:first_tool", "end:first_tool", "start:second_tool", "end:second_tool"]);
  });
});
