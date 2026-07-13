import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import { VoiceFunctionRunner } from "../../server/voice-agent-gateway/function-runner.js";
import { normalizeVoiceText } from "../../server/voice-agent-gateway/speech-normalizer.js";

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

  it("keeps start and progress feedback non-verbal while a tool is running", async () => {
    let resolveTool: ((value: ReturnType<typeof toolResponse>) => void) | undefined;
    const { runner, deepgram, client } = createHarness(vi.fn(() => new Promise((resolve) => {
      resolveTool = resolve;
    })));

    const task = runner.handleFunctionCallRequest({
      functions: [{ id: "fn-1", name: "get_patient_overview", arguments: JSON.stringify({ patient_name: "Ana" }) }],
    });
    await tick();

    expect(deepgram).toEqual([]);
    expect(client.some((event) => event.type === "function_status" && event.status === "started")).toBe(true);

    await vi.advanceTimersByTimeAsync(5500);
    expect(deepgram).toEqual([]);
    expect(client.some((event) => event.type === "function_status" && event.status === "progress")).toBe(true);

    resolveTool?.(toolResponse({ ok: true, spoken_summary: "Achei o resumo de Ana." }));
    await task;

    expect(deepgram).toHaveLength(1);
    expect(deepgram[0]).toMatchObject({ type: "FunctionCallResponse", name: "get_patient_overview" });
    expect(client.some((event) => event.type === "function_status" && event.status === "completed")).toBe(true);
  });

  it("retries a retryable tool response once", async () => {
    const invokeTool = vi
      .fn()
      .mockResolvedValueOnce(toolResponse({ ok: false, retryable: true, spoken_summary: "Timeout temporario." }))
      .mockResolvedValueOnce(toolResponse({ ok: true, spoken_summary: "Agora deu certo." }));
    const { runner, deepgram, client } = createHarness(invokeTool);

    const task = runner.handleFunctionCallRequest({
      functions: [{ id: "fn-2", name: "list_appointments", arguments: "{}" }],
    });
    await tick();
    await vi.advanceTimersByTimeAsync(650);
    await task;

    expect(invokeTool).toHaveBeenCalledTimes(2);
    expect(deepgram.some((event) => event.type === "InjectAgentMessage")).toBe(false);
    expect(deepgram.filter((event) => event.type === "FunctionCallResponse")).toHaveLength(1);
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
    const { runner, deepgram, client } = createHarness(vi.fn(async () => toolResponse({
      ok: true,
      confirmation_required: true,
      spoken_summary: "Preparei o agendamento. Posso confirmar?",
    })));

    await runner.handleFunctionCallRequest({
      functions: [{ id: "fn-confirm", name: "create_appointment", arguments: "{}" }],
    });

    expect(client.some((event) => event.type === "function_status" && event.status === "confirmation_required")).toBe(true);
    expect(client.some((event) => event.type === "voice_state" && event.phase === "awaiting_confirmation")).toBe(true);
    expect(deepgram.filter((event) => event.type === "FunctionCallResponse")).toHaveLength(1);
    const response = deepgram.find((event) => event.type === "FunctionCallResponse");
    expect(JSON.parse(String(response?.content || "{}"))).toMatchObject({
      confirmation_required: true,
      spoken_summary: "Preparei o agendamento. Posso confirmar?",
    });
  });

  it("deduplicates repeated function call ids without repeating execution or response", async () => {
    const invokeTool = vi.fn(async () => toolResponse({ ok: true, spoken_summary: "Resumo pronto." }));
    const { runner, deepgram, client } = createHarness(invokeTool);
    const request = {
      functions: [{ id: "fn-duplicate", name: "get_patient_overview", arguments: "{}" }],
    };

    await runner.handleFunctionCallRequest(request);
    await runner.handleFunctionCallRequest(request);

    expect(invokeTool).toHaveBeenCalledTimes(1);
    expect(deepgram.filter((event) => event.type === "FunctionCallResponse")).toHaveLength(1);
    expect(client.some((event) => event.type === "function_status" && event.status === "duplicate_ignored")).toBe(true);
  });

  it("keeps Node and Edge gateways free of injected agent filler speech", () => {
    const nodeSource = readFileSync("server/voice-agent-gateway/function-runner.js", "utf8");
    const edgeSource = readFileSync("supabase/functions/synapse-voice-gateway/index.ts", "utf8");
    const promptSource = readFileSync("supabase/functions/_shared/synapse-voice-prompt.ts", "utf8");

    expect(nodeSource).not.toContain("InjectAgentMessage");
    expect(edgeSource).not.toContain("InjectAgentMessage");
    expect(nodeSource).toContain('status: "duplicate_ignored"');
    expect(edgeSource).toContain('status: "duplicate_ignored"');
    expect(promptSource).toContain("Ao chamar uma função, permaneça em silêncio enquanto ela executa.");
    expect(promptSource).toContain("Depois de receber FunctionCallResponse, dê uma única resposta natural");
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

  it("normalizes technical voice text before speech", () => {
    const text = normalizeVoiceText(
      "Nao ha acao pendente. create_appointment para 2026-07-07T11:30:00-03:00 com valor R$ 150,00.",
    );

    expect(text).toContain("não há ação pendente");
    expect(text).toContain("novo agendamento");
    expect(text).toContain("sete de julho, às onze e trinta da manhã");
    expect(text).toContain("cento e cinquenta reais");
    expect(text).not.toContain("create_appointment");
    expect(text).not.toContain("T11:30");
  });
});
