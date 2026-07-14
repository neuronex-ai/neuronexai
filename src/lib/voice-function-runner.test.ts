import { beforeEach, afterEach, describe, expect, it, vi, type Mock } from "vitest";
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

function createHarness(invokeTool: Mock = vi.fn(async () => toolResponse({ ok: true, spoken_summary: "Concluido." }))) {
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

  it("waits for the browser ACK before answering a pure interface action", async () => {
    const { runner, deepgram, client } = createHarness(vi.fn(async () => ({
      ...toolResponse({ ok: true, spoken_summary: "Abrindo a agenda." }),
      clientAction: { type: "interface_action", data: { action: "navigate", destination: "agenda.day" } },
    })));

    const task = runner.handleFunctionCallRequest({
      functions: [{ id: "fn-client-action", name: "request_interface_action", arguments: "{}" }],
    });
    for (let index = 0; index < 4; index += 1) await tick();

    expect(client.some((event) =>
      event.type === "client_action" && event.callId === "fn-client-action"
    )).toBe(true);
    expect(deepgram).toEqual([]);

    expect(runner.handleClientActionResult({
      type: "client_action_result",
      callId: "fn-client-action",
      success: false,
      message: "A agenda abriu, mas o painel diario nao ficou disponivel.",
      durationMs: 4200,
    })).toBe(true);
    await task;

    const response = deepgram.find((event) => event.type === "FunctionCallResponse");
    expect(JSON.parse(String(response?.content || "{}"))).toMatchObject({
      ok: false,
      error: "A agenda abriu, mas o painel diario nao ficou disponivel.",
      client_action: {
        success: false,
        duration_ms: 4200,
      },
    });
  });

  it("preserves a completed mutation and adds a warning when only its visual follow-up fails", async () => {
    const { runner, deepgram, client } = createHarness(vi.fn(async () => ({
      ...toolResponse({ ok: true, spoken_summary: "Agendamento criado com sucesso." }),
      clientAction: { type: "interface_action", data: { action: "scroll_to_appointment" } },
    })));

    const task = runner.handleFunctionCallRequest({
      functions: [{ id: "fn-mutation-action", name: "confirm_pending_action", arguments: "{}" }],
    });
    for (let index = 0; index < 4; index += 1) await tick();
    expect(client.some((event) =>
      event.type === "client_action" && event.callId === "fn-mutation-action"
    )).toBe(true);
    runner.handleClientActionResult({
      id: "fn-mutation-action",
      success: false,
      message: "O agendamento foi salvo, mas nao consegui destaca-lo na agenda.",
    });
    await task;

    const response = deepgram.find((event) => event.type === "FunctionCallResponse");
    expect(JSON.parse(String(response?.content || "{}"))).toMatchObject({
      ok: true,
      spoken_summary: "Agendamento criado com sucesso.",
      warning: "O agendamento foi salvo, mas nao consegui destaca-lo na agenda.",
      client_action: { success: false },
    });
  });

  it("turns a missing browser ACK into a bounded interface failure", async () => {
    const { runner, deepgram } = createHarness(vi.fn(async () => ({
      ...toolResponse({ ok: true, spoken_summary: "Abrindo pacientes." }),
      clientAction: { type: "interface_action", data: { action: "navigate", destination: "patients.directory" } },
    })));

    const task = runner.handleFunctionCallRequest({
      functions: [{ id: "fn-client-timeout", name: "request_interface_action", arguments: "{}" }],
    });
    await tick();
    await vi.advanceTimersByTimeAsync(20000);
    await task;

    const response = deepgram.find((event) => event.type === "FunctionCallResponse");
    expect(JSON.parse(String(response?.content || "{}"))).toMatchObject({
      ok: false,
      client_action: { success: false, timed_out: true },
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
    expect(promptSource).toContain("Depois de receber FunctionCallResponse, dê uma resposta natural");
  });

  it("keeps the managed GPT-5.4 Mini contract aligned across voice gateways", () => {
    const sessionSource = readFileSync("supabase/functions/synapse-voice-agent-session/index.ts", "utf8");
    const edgeGatewaySource = readFileSync("supabase/functions/synapse-voice-gateway/index.ts", "utf8");
    const nodeGatewaySource = readFileSync("server/voice-agent-gateway/index.js", "utf8");

    expect(sessionSource).toContain('const PRIMARY_THINK_MODEL = "gpt-5.4-mini"');
    expect(sessionSource).toContain('const FALLBACK_THINK_MODEL = "gemini-3.5-flash"');
    expect(sessionSource).toContain('const LAST_RESORT_THINK_MODEL = "claude-haiku-4-5"');
    expect(sessionSource).not.toContain("reasoning_mode:");
    expect(sessionSource).toContain("stripUnsupportedSchemaKeywords");
    expect(sessionSource).toContain('envFlag("SYNAPSE_VOICE_HISTORY", true)');
    expect(edgeGatewaySource).toContain('"open_ai:gpt-5.4-mini"');
    expect(edgeGatewaySource).toContain('thinkPrimary: "open_ai/gpt-5.4-mini"');
    expect(edgeGatewaySource).toContain('"google:gemini-3.5-flash"');
    expect(edgeGatewaySource).toContain('"anthropic:claude-haiku-4-5"');
    expect(nodeGatewaySource).toContain('"open_ai:gpt-5.4-mini"');
    expect(`${sessionSource}\n${edgeGatewaySource}\n${nodeGatewaySource}`).not.toContain("gpt-4.1-mini");
  });

  it("keeps the full safe ecosystem reachable through the bounded voice dispatcher", () => {
    const promptSource = readFileSync("supabase/functions/_shared/synapse-voice-prompt.ts", "utf8");
    const toolsetSource = readFileSync("supabase/functions/_shared/synapse-voice-toolset.ts", "utf8");
    const voiceToolSource = readFileSync("supabase/functions/synapse-voice-tool/index.ts", "utf8");

    expect(promptSource).toContain("use execute_synapse_tool");
    expect(toolsetSource).toContain('SYNAPSE_VOICE_DISPATCH_TOOL_NAME = "execute_synapse_tool"');
    expect(toolsetSource).toContain("buildDispatchTool(delegatedTools)");
    expect(voiceToolSource).toContain("unwrapVoiceToolCall");
    expect(voiceToolSource).toContain("validateVoiceToolCall(name)");
  });

  it("directs product-specific patient requests to the specialized tool without stopping at search", () => {
    const promptSource = readFileSync("supabase/functions/_shared/synapse-voice-prompt.ts", "utf8");
    const toolsSource = readFileSync("supabase/functions/synapse-text-fallback/tools.ts", "utf8");
    const toolsV3Source = readFileSync("supabase/functions/synapse-text-fallback/tools-v3.ts", "utf8");

    expect(promptSource).toContain("chame diretamente a ferramenta especializada com patient_name");
    expect(promptSource).toContain("não pesquise o paciente antes e não pare depois de apenas localizá-lo");
    expect(toolsSource).toContain("não interrompa um pedido de NeuroView, NeuroFlow ou NeuroPulse apenas para pesquisar primeiro");
    expect(toolsSource).not.toContain("Sempre use antes de qualquer ação específica");
    expect(toolsV3Source).toContain("A função resolve a pessoa, analisa dados reais e retorna a ação visual");
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
