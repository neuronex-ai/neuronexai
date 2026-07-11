const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const DEFAULT_DEEPGRAM_URL = "wss://agent.deepgram.com/v1/agent/converse";
const NVIDIA_VOICE_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_VOICE_MODEL = "nvidia/nemotron-3-nano-30b-a3b";
const SYNAPSE_VOICE_THINK_TEMPERATURE = 0.35;
const ELEVENLABS_MODEL_ID = "eleven_turbo_v2_5";
const ELEVENLABS_VOICE_ID = "cjVigY5qzO86Huf0OWal";
const ELEVENLABS_LANGUAGE_CODE = "pt";

const clean = (value: unknown, max = 5000) => String(value ?? "").trim().slice(0, max);
const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });

const parseJson = (value: unknown) => {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const parseArgs = (value: unknown): Record<string, unknown> => {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const isOpen = (socket: WebSocket | null) => socket?.readyState === WebSocket.OPEN;

function functionsUrl() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1`;
}

function anonKey() {
  return Deno.env.get("SUPABASE_ANON_KEY") || "";
}

function gatewaySecret() {
  return Deno.env.get("SYNAPSE_VOICE_GATEWAY_SECRET") || "";
}

function elevenLabsApiKey() {
  return Deno.env.get("ELEVENLABS_API_KEY") || Deno.env.get("ELEVEN_LABS_API_KEY") || "";
}

function nvidiaVoiceApiKey() {
  return Deno.env.get("NVIDIA_VOICE_API_KEY") || "";
}

function missingConfig() {
  return [
    !Deno.env.get("DEEPGRAM_API_KEY") ? "DEEPGRAM_API_KEY" : "",
    !nvidiaVoiceApiKey() ? "NVIDIA_VOICE_API_KEY" : "",
    !elevenLabsApiKey() ? "ELEVENLABS_API_KEY ou ELEVEN_LABS_API_KEY" : "",
    !Deno.env.get("SUPABASE_URL") ? "SUPABASE_URL" : "",
    !anonKey() ? "SUPABASE_ANON_KEY" : "",
    !gatewaySecret() ? "SYNAPSE_VOICE_GATEWAY_SECRET" : "",
  ].filter(Boolean);
}

function gatewayErrorType(error: unknown) {
  const text = clean(error instanceof Error ? error.message : error, 1200).toLowerCase();
  if (/sessao|token|auth|unauthorized|401|403|jwt|gateway nao autorizado/.test(text)) return "auth_error";
  if (/settings|config|api[_ -]?key|secret|supabase nao configurado|missing/.test(text)) return "config_error";
  if (/deepgram|eleven|nvidia|provider|websocket|socket|1005|failed_to_speak|failed_to_think/.test(text)) return "provider_error";
  if (/tool|ferramenta/.test(text)) return "tool_error";
  if (/network|fetch|timeout|econn|gateway|503|502|504/.test(text)) return "network_error";
  return "voice_error";
}

function providerEventMessage(event: Record<string, unknown>) {
  return clean(event.description || event.message || event.error || event.reason || "", 1000);
}

function sanitizeProviderEvent(event: Record<string, unknown>) {
  const message = providerEventMessage(event);
  return {
    type: clean(event.type, 80),
    code: clean(event.code || event.error_code || event.status, 120) || undefined,
    message,
    errorType: gatewayErrorType(message || event.type),
  };
}

function validateAgentSettings(settings: Record<string, unknown>) {
  const agent = settings.agent as Record<string, unknown> | undefined;
  if (!agent || typeof agent !== "object") {
    throw new Error("Settings de voz invalidos: agent ausente.");
  }

  const think = agent.think && typeof agent.think === "object"
    ? agent.think as Record<string, unknown>
    : {};
  agent.think = think;
  const thinkProvider = think.provider && typeof think.provider === "object"
    ? think.provider as Record<string, unknown>
    : {};
  think.provider = thinkProvider;
  thinkProvider.type = "open_ai";
  thinkProvider.model = NVIDIA_VOICE_MODEL;
  thinkProvider.temperature = SYNAPSE_VOICE_THINK_TEMPERATURE;
  const thinkEndpoint = think.endpoint && typeof think.endpoint === "object"
    ? think.endpoint as Record<string, unknown>
    : {};
  think.endpoint = thinkEndpoint;
  thinkEndpoint.url = NVIDIA_VOICE_CHAT_URL;
  thinkEndpoint.headers = {
    ...(thinkEndpoint.headers && typeof thinkEndpoint.headers === "object" ? thinkEndpoint.headers as Record<string, unknown> : {}),
    authorization: `Bearer ${nvidiaVoiceApiKey()}`,
  };
  if (!clean(thinkEndpoint.url, 500) || !nvidiaVoiceApiKey()) {
    throw new Error("Settings de voz incompletos: endpoint NVIDIA ou NVIDIA_VOICE_API_KEY ausente.");
  }

  const listen = agent?.listen as Record<string, unknown> | undefined;
  const listenProvider = listen?.provider as Record<string, unknown> | undefined;
  if (listenProvider && typeof listenProvider === "object") {
    const listenModel = clean(listenProvider.model, 120);
    const listenVersion = clean(listenProvider.version, 40);
    if (listenModel.startsWith("flux-") || listenVersion === "v2") {
      delete listenProvider.language;
      delete listenProvider.smart_format;
      if (listenModel === "flux-general-multi") {
        listenProvider.language_hints = ["pt"];
      } else {
        delete listenProvider.language_hints;
      }
    }
  }

  const speak = agent?.speak as Record<string, unknown> | undefined;
  if (!speak || typeof speak !== "object") {
    throw new Error("Settings de voz invalidos: agent.speak ausente.");
  }
  const speakProvider = speak?.provider as Record<string, unknown> | undefined;
  if (speakProvider?.type !== "eleven_labs") {
    throw new Error("Settings de voz invalidos: o Synapse usa somente ElevenLabs via Deepgram.");
  }
  speakProvider.model_id = ELEVENLABS_MODEL_ID;
  speakProvider.language_code = ELEVENLABS_LANGUAGE_CODE;
  const voiceId = clean(speakProvider.voice_id, 160) || ELEVENLABS_VOICE_ID;
  if ("voice_id" in speakProvider) {
    delete speakProvider.voice_id;
  }
  const endpoint = speak.endpoint && typeof speak.endpoint === "object" ? speak.endpoint as Record<string, unknown> : {};
  speak.endpoint = endpoint;
  endpoint.url = `wss://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/multi-stream-input`;
  endpoint.headers = {
    ...(endpoint.headers && typeof endpoint.headers === "object" ? endpoint.headers as Record<string, unknown> : {}),
    "xi-api-key": elevenLabsApiKey(),
  };
  const headers = endpoint.headers as Record<string, unknown>;
  const endpointUrl = clean(endpoint.url, 500);
  const apiKey = clean(headers["xi-api-key"], 8000);
  if (!endpointUrl || !apiKey) {
    throw new Error("Settings de voz incompletos: endpoint ElevenLabs ou ELEVENLABS_API_KEY ausente.");
  }
  return settings;
}

function conversationText(event: Record<string, unknown>) {
  const role = clean(event.role || event.speaker || (event.channel as Record<string, unknown> | undefined)?.role, 40);
  const content = clean(event.content || event.text || event.transcript || event.message, 20000);
  if (!content) return null;
  return { role, content };
}

const normalizeText = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const CANCEL_RE = /\b(cancela|cancelar|cancele|para|pare|interrompe|interrompa|deixa|deixa quieto|nao precisa|nao faca|nao faz|desiste|desisto|esquece|encerra)\b/i;
const COMPLEMENT_RE = /\b(tambem|inclui|incluir|adiciona|adicionar|aproveita|alem disso|e tambem|na verdade|corrigindo|complementa|so que|melhor|faz junto)\b/i;

const classifyInterruption = (text: unknown) => {
  const normalized = normalizeText(text);
  if (!normalized) return "unknown";
  if (CANCEL_RE.test(normalized)) return "cancel";
  if (COMPLEMENT_RE.test(normalized)) return "complement";
  return "new_turn";
};

const isUserRole = (value: unknown) => ["user", "human"].includes(normalizeText(value));
const isAssistantRole = (value: unknown) => ["assistant", "agent", "ai"].includes(normalizeText(value));

const SLOW_FUNCTION_MS = Number(Deno.env.get("SYNAPSE_VOICE_SLOW_FUNCTION_MS") || "5500");
const FOLLOWUP_FUNCTION_MS = Number(Deno.env.get("SYNAPSE_VOICE_FOLLOWUP_FUNCTION_MS") || "9000");
const MAX_PROGRESS_MESSAGES = Number(Deno.env.get("SYNAPSE_VOICE_MAX_PROGRESS_MESSAGES") || "2");
const MAX_TOOL_RETRIES = Number(Deno.env.get("SYNAPSE_VOICE_MAX_TOOL_RETRIES") || "1");
const TOOL_TIMEOUT_MS = Number(Deno.env.get("SYNAPSE_VOICE_TOOL_TIMEOUT_MS") || "18000");

const TOOL_LABELS: Record<string, string> = {
  confirm_pending_action: "confirmacao pendente",
  cancel_pending_action: "cancelamento pendente",
  navigate_system: "navegacao",
  search_patients: "busca de paciente",
  list_patients: "lista de pacientes",
  get_patient_details: "prontuario",
  report_all_patients: "resumo de pacientes",
  search_clinical_history: "historico clinico",
  generate_patient_insights: "insights clinicos",
  suggest_treatment_approach: "plano terapeutico",
  detect_risk_patterns: "analise de risco",
  get_calendar: "agenda",
  create_appointment: "novo agendamento",
  reschedule_appointment: "remarcacao",
  cancel_appointment: "cancelamento",
  find_available_slots: "horarios disponiveis",
  create_patient: "cadastro de paciente",
  update_patient_info: "atualizacao do paciente",
  add_patient_medication: "medicacao",
  create_session_note: "nota clinica",
  send_whatsapp_message: "mensagem",
  read_whatsapp_conversations: "conversas",
  send_email: "email",
  draft_email: "rascunho de email",
  get_financial_metrics: "resumo financeiro",
  list_transactions: "lancamentos financeiros",
  create_transaction: "lancamento financeiro",
  generate_financial_report: "relatorio financeiro",
  send_payment_reminder: "lembrete de pagamento",
  draft_invoice: "cobranca",
  generate_document: "documento",
  draft_official_document: "documento oficial",
  search_medical_articles: "referencias clinicas",
  search_cid10: "CID-10",
  get_medication_info: "informacoes de medicacao",
  get_latest_scientific_updates: "atualizacoes cientificas",
  search_normative_docs: "normas profissionais",
};

const safeJsonParse = (value: unknown): Record<string, unknown> => {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const titleizeTool = (value: unknown) => {
  const raw = clean(value, 160);
  const key = raw.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (TOOL_LABELS[key]) return TOOL_LABELS[key];
  if (/appointment|calendar|agenda/i.test(raw)) return "agenda";
  if (/patient|paciente|clinical|history|prontuario/i.test(raw)) return "paciente";
  if (/finance|invoice|payment|transaction|cobranca/i.test(raw)) return "financeiro";
  if (/document|note|nota/i.test(raw)) return "documento";
  if (/[_{}[\]"]/.test(raw)) return "acao do Synapse";
  return raw.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
};

const patientFromArgs = (args: Record<string, unknown>) =>
  clean(args.patient_name || args.patientName || args.patient || args.nome_paciente, 120);

const taskLabel = (name: string, args: Record<string, unknown> = {}) => {
  const patient = patientFromArgs(args);
  const label =
    clean(args.task_label || args.taskLabel || args.label || args.intent_label, 140) ||
    titleizeTool(name) ||
    "consulta";
  return patient ? `${label} de ${patient}` : label;
};

const initialMessage = (name: string, args: Record<string, unknown>) => {
  const patient = patientFromArgs(args);
  if (patient) return `Vou conferir as informacoes de ${patient} no sistema.`;
  return `Vou consultar ${taskLabel(name, args)} no sistema.`;
};

const progressMessage = (name: string, args: Record<string, unknown>, count: number) => {
  const patient = patientFromArgs(args);
  const base = taskLabel(name, args);
  if (patient) {
    return count === 0
      ? `Ainda estou buscando as informacoes de ${patient}, so mais um instante.`
      : `Continuo conferindo ${base}; ja volto com o resultado.`;
  }
  return count === 0
    ? `Ainda estou conferindo ${base}, so mais um instante.`
    : "Continuo trabalhando nisso; ja volto com o resultado.";
};

const retryMessage = (name: string, args: Record<string, unknown>) =>
  `A consulta oscilou por aqui. Vou tentar ${taskLabel(name, args)} mais uma vez.`;

const makeAbortError = (message = "Operacao cancelada.") => {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
};

const makeTimeoutError = (message = "A consulta demorou mais que o esperado.") => {
  const error = new Error(message);
  error.name = "TimeoutError";
  return error;
};

const wait = (ms: number, signal?: AbortSignal) => {
  if (!ms) return Promise.resolve();
  if (signal?.aborted) return Promise.reject(makeAbortError());
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(makeAbortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
};

const isTransientError = (value: unknown) => {
  const error = value as { name?: string; message?: string; error?: string };
  if (error?.name === "TimeoutError") return true;
  const text = clean(error?.message || error?.error || value, 1000).toLowerCase();
  return /timeout|timed out|temporari|temporary|network|socket|fetch|econn|5\d\d|rate limit|too many|indisponivel|instavel|oscila|gateway|service unavailable/.test(text);
};

const normalizeToolPayload = (name: string, result: Record<string, unknown>) => {
  const parsed = safeJsonParse(result?.content ?? result);
  const explicitOk = parsed.ok;
  const hasError = Boolean(parsed.error || result?.error);
  const ok = explicitOk === undefined ? !hasError : Boolean(explicitOk);
  const spoken =
    clean(parsed.spoken_summary, 1200) ||
    clean(parsed.message, 1200) ||
    clean(parsed.error || result?.error, 1200) ||
    (ok ? "Ferramenta concluida." : "Nao consegui concluir a ferramenta agora.");

  return {
    ok,
    tool: clean(parsed.tool || name, 120),
    spoken_summary: spoken,
    message: spoken,
    retryable: Boolean(parsed.retryable),
    needs_clarification: Boolean(parsed.needs_clarification),
    confirmation_required: Boolean(parsed.confirmation_required ?? parsed.confirmationRequired),
    cancelled: Boolean(parsed.cancelled),
    interrupted: Boolean(parsed.interrupted),
    data: parsed.data ?? null,
    error: ok ? null : clean(parsed.error || spoken, 1200),
    grounded: Boolean(parsed.grounded),
    recordCount: Number(parsed.recordCount || 0),
    structuredData: parsed.structuredData || null,
  };
};

const failurePayload = (name: string, error: unknown, aborted: boolean) => {
  const typed = error as { name?: string; message?: string };
  const message = aborted
    ? "A acao foi cancelada antes de concluir."
    : typed?.name === "TimeoutError"
      ? "Essa consulta demorou mais que o esperado e nao voltou com seguranca. Posso tentar de novo em seguida."
      : "Tentei consultar aqui, mas nao recebi um retorno confiavel. Posso tentar de novo?";
  return {
    ok: false,
    tool: name,
    cancelled: aborted,
    spoken_summary: message,
    message,
    retryable: !aborted && isTransientError(error),
    needs_clarification: false,
    confirmation_required: false,
    data: null,
    error: aborted ? null : message,
    internal_error: aborted ? null : clean(typed?.message || error, 1200),
  };
};

type VoiceTask = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  label: string;
  controller: AbortController;
  startedAt: number;
  progressCount: number;
  timers: ReturnType<typeof setTimeout>[];
  interrupted: boolean;
  status: string;
  message: string;
};

const clientTask = (task?: VoiceTask | null) => task
  ? {
      id: task.id,
      name: task.name,
      label: task.label,
      message: task.message || "",
      status: task.status,
      startedAt: task.startedAt,
      elapsedMs: Math.max(0, Date.now() - task.startedAt),
    }
  : null;

class EdgeVoiceFunctionRunner {
  private sendDeepgram: (payload: unknown) => void;
  private sendClient: (payload: unknown) => void;
  private invokeTool: (input: {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    signal?: AbortSignal;
  }) => Promise<Record<string, unknown>>;
  private tasks = new Map<string, VoiceTask>();
  private lastInterruptionAt = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(options: {
    sendDeepgram: (payload: unknown) => void;
    sendClient: (payload: unknown) => void;
    invokeTool: (input: {
      id: string;
      name: string;
      arguments: Record<string, unknown>;
      signal?: AbortSignal;
    }) => Promise<Record<string, unknown>>;
  }) {
    this.sendDeepgram = options.sendDeepgram;
    this.sendClient = options.sendClient;
    this.invokeTool = options.invokeTool;
  }

  injectAgentMessage(message: string, behavior = "queue") {
    const text = clean(message, 420);
    if (!text) return;
    this.sendDeepgram({ type: "InjectAgentMessage", message: text, behavior });
  }

  sendFunctionResponse(id: string, name: string, content: unknown, thoughtSignature = "") {
    const response: Record<string, unknown> = {
      type: "FunctionCallResponse",
      id,
      name,
      content: typeof content === "string" ? content : JSON.stringify(content),
    };
    if (thoughtSignature) response.thought_signature = thoughtSignature;
    this.sendDeepgram(response);
  }

  sendStatus(task: VoiceTask | null, status: string, extra: Record<string, unknown> = {}) {
    const message = clean(extra.message ?? task?.message, 800);
    if (task) {
      task.status = status;
      if (message) task.message = message;
    }
    this.sendClient({
      type: "function_status",
      status,
      id: task?.id,
      name: task?.name,
      label: task?.label,
      message,
      elapsedMs: task ? Math.max(0, Date.now() - task.startedAt) : undefined,
      ...extra,
    });
  }

  sendVoiceState(phase: string, task: VoiceTask | null = null, extra: Record<string, unknown> = {}) {
    this.sendClient({
      type: "voice_state",
      phase,
      activeTool: clientTask(task),
      activeTools: Array.from(this.tasks.values()).map(clientTask),
      ...extra,
    });
  }

  handleFunctionCallRequest(event: Record<string, unknown>) {
    const functions = Array.isArray(event.functions) ? event.functions : [];
    const runBatch = async () => {
      for (const fn of functions) await this.runFunction(fn as Record<string, unknown>);
    };

    const shouldPrioritizeNewTurn =
      this.tasks.size > 0 && Date.now() - this.lastInterruptionAt < 15_000;
    if (shouldPrioritizeNewTurn) {
      for (const task of this.tasks.values()) task.interrupted = true;
      return runBatch();
    }

    this.queue = this.queue.catch(() => undefined).then(runBatch);
    return this.queue;
  }

  async runFunction(fn: Record<string, unknown>) {
    if (fn.client_side === false) return;
    const id = clean(fn.id || crypto.randomUUID(), 120);
    const name = clean(fn.name, 120);
    const thoughtSignature = clean(fn.thought_signature, 4000);
    const args = safeJsonParse(fn.arguments);
    if (!name) return;

    const controller = new AbortController();
    const task: VoiceTask = {
      id,
      name,
      args,
      label: taskLabel(name, args),
      controller,
      startedAt: Date.now(),
      progressCount: 0,
      timers: [],
      interrupted: false,
      status: "started",
      message: "",
    };
    this.tasks.set(id, task);

    const firstMessage = initialMessage(name, args);
    task.message = firstMessage;
    this.sendStatus(task, "started", { message: firstMessage });
    this.sendVoiceState("tool_active", task);
    this.injectAgentMessage(firstMessage, "queue");
    this.scheduleProgress(task, SLOW_FUNCTION_MS);
    let keepAwaitingConfirmation = false;

    try {
      const { result, payload } = await this.invokeWithRetry(task);
      if (controller.signal.aborted) throw makeAbortError();

      if (result?.clientAction) this.sendClient({ type: "client_action", action: result.clientAction });
      if (task.interrupted && payload.ok) {
        payload.interrupted = true;
        payload.message = `Resultado anterior pronto: ${payload.message}`;
        payload.spoken_summary = payload.message;
      }

      this.sendFunctionResponse(id, name, payload, thoughtSignature);
      const completedStatus = payload.confirmation_required ? "confirmation_required" : "completed";
      keepAwaitingConfirmation = Boolean(payload.ok && payload.confirmation_required);
      this.sendStatus(task, payload.ok ? completedStatus : "failed", {
        message: payload.spoken_summary,
        error: payload.error || undefined,
        retryable: payload.retryable,
        needs_clarification: payload.needs_clarification,
        confirmation_required: payload.confirmation_required,
      });
      this.sendVoiceState(
        payload.ok ? (payload.confirmation_required ? "awaiting_confirmation" : "tool_completed") : "tool_failed",
        task,
        { message: payload.spoken_summary, confirmationRequired: payload.confirmation_required },
      );
    } catch (error) {
      const aborted = controller.signal.aborted || (error as { name?: string })?.name === "AbortError";
      const payload = failurePayload(name, error, aborted);
      this.sendFunctionResponse(id, name, payload, thoughtSignature);
      this.sendStatus(task, aborted ? "cancelled" : "failed", {
        message: payload.spoken_summary,
        error: payload.error || undefined,
        retryable: payload.retryable,
      });
      this.sendVoiceState(aborted ? "tool_cancelled" : "tool_failed", task, {
        message: payload.spoken_summary,
      });
    } finally {
      for (const timer of task.timers) clearTimeout(timer);
      this.tasks.delete(id);
      if (!keepAwaitingConfirmation) this.sendVoiceState(this.tasks.size ? "tool_active" : "thinking");
    }
  }

  scheduleProgress(task: VoiceTask, delay: number) {
    const timer = setTimeout(() => {
      if (!this.tasks.has(task.id) || task.controller.signal.aborted) return;
      if (task.interrupted) {
        this.scheduleProgress(task, FOLLOWUP_FUNCTION_MS);
        return;
      }

      const message = progressMessage(task.name, task.args, task.progressCount);
      task.progressCount += 1;
      this.injectAgentMessage(message, "queue");
      this.sendStatus(task, "progress", { message });
      this.sendVoiceState("tool_active", task);
      if (task.progressCount < MAX_PROGRESS_MESSAGES) this.scheduleProgress(task, FOLLOWUP_FUNCTION_MS);
    }, delay);
    task.timers.push(timer);
  }

  async invokeWithRetry(task: VoiceTask) {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= MAX_TOOL_RETRIES; attempt += 1) {
      if (attempt > 0) {
        const message = retryMessage(task.name, task.args);
        this.injectAgentMessage(message, "queue");
        this.sendStatus(task, "retrying", { message, attempt });
        this.sendVoiceState("tool_retrying", task);
        await wait(650, task.controller.signal);
      }

      try {
        const result = await this.invokeToolWithTimeout(task);
        const payload = normalizeToolPayload(task.name, result);
        const shouldRetry = !payload.ok && payload.retryable && attempt < MAX_TOOL_RETRIES;
        if (!shouldRetry) return { result, payload };
      } catch (error) {
        lastError = error;
        if (task.controller.signal.aborted || (error as { name?: string })?.name === "AbortError") throw error;
        if (!isTransientError(error) || attempt >= MAX_TOOL_RETRIES) throw error;
      }
    }
    throw lastError || new Error("Falha ao executar ferramenta de voz.");
  }

  async invokeToolWithTimeout(task: VoiceTask) {
    if (!TOOL_TIMEOUT_MS || TOOL_TIMEOUT_MS < 1000) {
      return this.invokeTool({
        id: task.id,
        name: task.name,
        arguments: task.args,
        signal: task.controller.signal,
      });
    }

    const attemptController = new AbortController();
    const onAbort = () => attemptController.abort(task.controller.signal.reason || "user_cancelled");
    task.controller.signal.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => attemptController.abort("tool_timeout"), TOOL_TIMEOUT_MS);

    try {
      return await this.invokeTool({
        id: task.id,
        name: task.name,
        arguments: task.args,
        signal: attemptController.signal,
      });
    } catch (error) {
      if (attemptController.signal.aborted && !task.controller.signal.aborted) throw makeTimeoutError();
      throw error;
    } finally {
      clearTimeout(timer);
      task.controller.signal.removeEventListener("abort", onAbort);
    }
  }

  onUserStartedSpeaking() {
    this.lastInterruptionAt = Date.now();
    for (const task of this.tasks.values()) task.interrupted = true;
    this.sendClient({ type: "barge_in" });
  }

  onUserTranscript(text: string) {
    if (!this.tasks.size || Date.now() - this.lastInterruptionAt > 12_000) return;
    const intent = classifyInterruption(text);
    if (intent === "cancel") {
      for (const task of this.tasks.values()) {
        task.controller.abort("user_cancelled");
        this.sendStatus(task, "cancelling", { message: "Cancelando a execucao em andamento." });
        this.sendVoiceState("tool_cancelling", task);
      }
      return;
    }
    if (intent === "complement") {
      for (const task of this.tasks.values()) {
        task.interrupted = false;
        this.sendStatus(task, "complement_received", {
          message: "Complemento recebido; mantendo a execucao ativa.",
        });
        this.sendVoiceState("tool_active", task);
      }
      return;
    }
    for (const task of this.tasks.values()) task.interrupted = false;
  }
}

class EdgeSynapseVoiceSession {
  private client: WebSocket;
  private deepgram: WebSocket | null = null;
  private authorization = "";
  private conversationId = "";
  private voiceSessionId = "";
  private settingsApplied = false;
  private firstAudioByteSeen = false;
  private startedAt = Date.now();
  private latencyMs: Record<string, number> = {};
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private runner: EdgeVoiceFunctionRunner;
  private persistQueue: Promise<void> = Promise.resolve();
  private persistenceDisabled = false;
  private closed = false;
  private lastProviderEvent: Record<string, unknown> | null = null;

  constructor(client: WebSocket) {
    this.client = client;
    this.runner = new EdgeVoiceFunctionRunner({
      sendDeepgram: (payload) => this.sendDeepgram(payload),
      sendClient: (payload) => this.sendClient(payload),
      invokeTool: (input) => this.invokeTool(input),
    });
  }

  sendClient(payload: unknown, binary = false) {
    if (!isOpen(this.client)) return;
    this.client.send(binary ? payload as ArrayBuffer : JSON.stringify(payload));
  }

  sendDeepgram(payload: unknown, binary = false) {
    const socket = this.deepgram;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(binary ? payload as ArrayBuffer : JSON.stringify(payload));
  }

  async start(payload: Record<string, unknown>) {
    const missing = missingConfig();
    if (missing.length) throw new Error(`Configuracao de voz ausente: ${missing.join(", ")}.`);

    this.authorization = clean(payload.authorization || payload.token, 4000);
    if (this.authorization && !this.authorization.startsWith("Bearer ")) {
      this.authorization = `Bearer ${this.authorization}`;
    }
    if (!this.authorization) throw new Error("Sessao ausente para iniciar voz.");

    const sessionConfig = await this.fetchSessionConfig(payload);
    const settings = sessionConfig.agentSettings;
    if (!settings) throw new Error("Settings Deepgram ausentes na resposta segura do Supabase.");
    validateAgentSettings(settings as Record<string, unknown>);

    this.conversationId = clean(sessionConfig.conversationId || sessionConfig.sessionId || payload.conversationId || payload.sessionId, 120);
    this.voiceSessionId = clean(sessionConfig.voiceSessionId || payload.voiceSessionId, 120);
    this.sendClient({
      type: "gateway_status",
      status: "connecting_deepgram",
      sessionId: this.conversationId,
      conversationId: this.conversationId,
      voiceSessionId: this.voiceSessionId,
      provider: "deepgram-agent",
      model: sessionConfig.model,
      voiceName: sessionConfig.voiceName,
      ttsProvider: sessionConfig.ttsProvider,
      functionsCount: sessionConfig.functionsCount,
      outputSampleRate: sessionConfig.outputSampleRate,
      elevenLabsEndpointConfigured: Boolean((settings as any)?.agent?.speak?.endpoint?.url),
    });

    this.connectDeepgram(clean(sessionConfig.deepgramUrl, 500) || DEFAULT_DEEPGRAM_URL, settings as Record<string, unknown>);
  }

  async fetchSessionConfig(payload: Record<string, unknown>) {
    const response = await fetch(`${functionsUrl()}/synapse-voice-agent-session`, {
      method: "POST",
      headers: {
        Authorization: this.authorization,
        apikey: anonKey(),
        "Content-Type": "application/json",
        "x-synapse-gateway-secret": gatewaySecret(),
      },
      body: JSON.stringify({
        includeSettings: true,
        conversationId: clean(payload.conversationId || payload.sessionId, 120),
        sessionId: clean(payload.sessionId || payload.conversationId, 120),
        voiceSessionId: clean(payload.voiceSessionId, 120),
        systemInstruction: clean(payload.systemInstruction, 1600),
        context: payload.context && typeof payload.context === "object" ? payload.context : {},
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.error) {
      throw new Error(data?.error || data?.message || `Falha ao criar sessao de voz (${response.status}).`);
    }
    return data;
  }

  connectDeepgram(url: string, settings: Record<string, unknown>) {
    const deepgramKey = Deno.env.get("DEEPGRAM_API_KEY") || "";
    const ws = new WebSocket(url, ["token", deepgramKey]);
    ws.binaryType = "arraybuffer";
    this.deepgram = ws;

    ws.onopen = () => {
      this.latencyMs.deepgram_ws_open_ms = Date.now() - this.startedAt;
      this.sendClient({ type: "gateway_status", status: "waiting_welcome" });
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        if (!this.firstAudioByteSeen) {
          this.firstAudioByteSeen = true;
          this.latencyMs.first_audio_byte_ms = Date.now() - this.startedAt;
        }
        this.sendClient(event.data, true);
        return;
      }

      const message = typeof event.data === "string" ? event.data : "";
      const parsed = parseJson(message);
      if (!parsed || typeof parsed !== "object") return;
      this.handleDeepgramEvent(parsed as Record<string, unknown>, settings);
    };

    ws.onerror = () => {
      this.sendClient({
        type: "gateway_error",
        errorType: "provider_error",
        error: "Falha no WebSocket da Deepgram.",
      });
    };

    ws.onclose = (event) => {
      if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
      const closeReason = clean(event.reason || this.lastProviderEvent?.message || "", 500);
      void this.updateVoiceSession(this.settingsApplied ? "ended" : "error", {
        closeCode: event.code,
        closeReason,
      });
      this.sendClient({
        type: "gateway_status",
        status: "deepgram_closed",
        code: event.code,
        reason: closeReason,
      });
      if (!this.settingsApplied) {
        this.sendClient({
          type: "gateway_error",
          errorType: "provider_error",
          error: closeReason || `Conexao de voz encerrada antes de ficar pronta (codigo ${event.code}).`,
        });
      }
      if (isOpen(this.client)) this.client.close(1000, "deepgram_closed");
    };
  }

  handleDeepgramEvent(event: Record<string, unknown>, settings: Record<string, unknown>) {
    this.sendClient({ type: "deepgram_event", event });

    switch (event.type) {
      case "Welcome":
        this.latencyMs.deepgram_welcome_ms = Date.now() - this.startedAt;
        this.sendDeepgram(settings);
        this.latencyMs.settings_sent_ms = Date.now() - this.startedAt;
        this.sendClient({ type: "gateway_status", status: "settings_sent" });
        break;
      case "SettingsApplied":
        this.settingsApplied = true;
        this.latencyMs.settings_applied_ms = Date.now() - this.startedAt;
        this.startKeepAlive();
        void this.updateVoiceSession("ready");
        this.sendClient({
          type: "gateway_status",
          status: "ready",
          sessionId: this.conversationId,
          conversationId: this.conversationId,
          voiceSessionId: this.voiceSessionId,
        });
        break;
      case "FunctionCallRequest":
        this.latencyMs.first_tool_request_ms ??= Date.now() - this.startedAt;
        void this.runner.handleFunctionCallRequest(event);
        break;
      case "UserStartedSpeaking":
      case "AgentAudioInterrupted":
        this.runner.onUserStartedSpeaking();
        break;
      case "ConversationText": {
        const text = conversationText(event);
        if (!text) break;
        if (isUserRole(text.role)) this.runner.onUserTranscript(text.content);
        if (isUserRole(text.role) || isAssistantRole(text.role)) {
          if (isUserRole(text.role)) this.latencyMs.first_transcript_ms ??= Date.now() - this.startedAt;
          void this.persistMessage(text.role, text.content, event);
        }
        break;
      }
      case "Error":
      case "Warning":
        this.lastProviderEvent = sanitizeProviderEvent(event);
        this.sendClient({
          type: event.type === "Error" ? "gateway_error" : "gateway_warning",
          errorType: this.lastProviderEvent.errorType,
          error: this.lastProviderEvent.message,
          providerEvent: this.lastProviderEvent,
        });
        if (event.type === "Error") {
          void this.updateVoiceSession("error", {
            closeReason: clean(this.lastProviderEvent.message, 500),
            metadata: {
              providerLastEvent: this.lastProviderEvent,
            },
          });
        }
        break;
      default:
        break;
    }
  }

  async invokeTool(input: {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    signal?: AbortSignal;
  }) {
    const response = await fetch(`${functionsUrl()}/synapse-voice-tool`, {
      method: "POST",
      headers: {
        Authorization: this.authorization,
        apikey: anonKey(),
        "Content-Type": "application/json",
        "x-synapse-gateway-secret": gatewaySecret(),
      },
      signal: input.signal,
      body: JSON.stringify({
        action: "execute_tool",
        callId: input.id,
        sessionId: this.conversationId,
        conversationId: this.conversationId,
        voiceSessionId: this.voiceSessionId,
        name: input.name,
        arguments: input.arguments,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.error) {
      throw new Error(data?.error || `Falha na ferramenta ${input.name} (${response.status}).`);
    }
    return data;
  }

  async updateVoiceSession(status: string, extra: Record<string, unknown> = {}) {
    if (!this.voiceSessionId || !this.conversationId) return;
    const extraMetadata = extra.metadata && typeof extra.metadata === "object" ? extra.metadata as Record<string, unknown> : {};
    const { metadata: _ignoredMetadata, ...rest } = extra;
    const metadata = {
      provider: "deepgram-agent",
      runtime: "supabase-edge",
      settingsApplied: this.settingsApplied,
      firstAudioByteSeen: this.firstAudioByteSeen,
      ...(this.lastProviderEvent ? { providerLastEvent: this.lastProviderEvent } : {}),
      ...extraMetadata,
    };
    try {
      await fetch(`${functionsUrl()}/synapse-voice-tool`, {
        method: "POST",
        headers: {
          Authorization: this.authorization,
          apikey: anonKey(),
          "Content-Type": "application/json",
          "x-synapse-gateway-secret": gatewaySecret(),
        },
        body: JSON.stringify({
          action: "update_voice_session",
          conversationId: this.conversationId,
          sessionId: this.conversationId,
          voiceSessionId: this.voiceSessionId,
          status,
          latencyMs: this.latencyMs,
          ...rest,
          metadata,
        }),
      });
    } catch (error) {
      console.warn("[synapse-voice-gateway] voice session update failed", error);
    }
  }

  async persistMessage(role: string, content: string, event: Record<string, unknown>) {
    const normalizedRole = isUserRole(role) ? "user" : isAssistantRole(role) ? "assistant" : "";
    const text = clean(content, 20000);
    if (!normalizedRole || !text || !this.conversationId || this.persistenceDisabled) return;

    this.persistQueue = this.persistQueue.catch(() => undefined).then(async () => {
      const response = await fetch(`${functionsUrl()}/synapse-voice-tool`, {
        method: "POST",
        headers: {
          Authorization: this.authorization,
          apikey: anonKey(),
          "Content-Type": "application/json",
          "x-synapse-gateway-secret": gatewaySecret(),
        },
        body: JSON.stringify({
          action: "persist_message",
          sessionId: this.conversationId,
          conversationId: this.conversationId,
          voiceSessionId: this.voiceSessionId,
          role: normalizedRole,
          content: text,
          origin: "deepgram_conversation_text",
          isFinal: true,
          confidence: typeof event.confidence === "number" ? event.confidence : undefined,
        }),
      });
      if (!response.ok) {
        if (response.status === 404) this.persistenceDisabled = true;
        const data = await response.json().catch(() => ({}));
        console.warn("[synapse-voice-gateway] persist failed", data?.error || response.status);
      }
    }).catch((error) => {
      console.warn("[synapse-voice-gateway] persist failed", error);
    });
  }

  injectUserMessage(message: unknown) {
    const text = clean(message, 2000);
    if (!text) return;
    this.sendDeepgram({ type: "InjectUserMessage", message: text });
  }

  startKeepAlive() {
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
    this.keepAliveTimer = setInterval(() => {
      this.sendDeepgram({ type: "KeepAlive" });
    }, 8000);
  }

  handleClientMessage(data: unknown) {
    if (data instanceof ArrayBuffer) {
      if (this.settingsApplied) this.sendDeepgram(data, true);
      return;
    }

    const payload = parseJson(typeof data === "string" ? data : "");
    if (!payload || typeof payload !== "object") return;

    if (payload.type === "start") {
      this.start(payload as Record<string, unknown>).catch((error) => {
        this.sendClient({
          type: "gateway_error",
          errorType: gatewayErrorType(error),
          error: clean(error instanceof Error ? error.message : "Nao foi possivel iniciar voz.", 1000),
        });
        this.close();
      });
      return;
    }

    if (payload.type === "inject_user_message") {
      this.injectUserMessage(payload.message);
      return;
    }

    if (payload.type === "update_speak" && payload.speak) {
      this.sendDeepgram({ type: "UpdateSpeak", speak: payload.speak });
      return;
    }

    if (payload.type === "update_think" && payload.think) {
      this.sendDeepgram({ type: "UpdateThink", think: payload.think });
      return;
    }

    if (payload.type === "stop") this.close();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
    void this.updateVoiceSession(this.settingsApplied ? "ended" : "cancelled", {
      closeReason: "client_closed",
    });
    if (isOpen(this.deepgram)) this.deepgram?.close(1000, "client_closed");
    if (isOpen(this.client)) this.client.close(1000, "session_closed");
  }
}

Deno.serve((request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const upgrade = request.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() !== "websocket") {
    return json({
      ok: true,
      service: "synapse-voice-gateway",
      runtime: "supabase-edge",
      voicePath: "deepgram-agent-nvidia-byo-elevenlabs",
      deepgramConfigured: Boolean(Deno.env.get("DEEPGRAM_API_KEY")),
      nvidiaVoiceConfigured: Boolean(nvidiaVoiceApiKey()),
      elevenLabsConfigured: Boolean(elevenLabsApiKey()),
      supabaseConfigured: Boolean(Deno.env.get("SUPABASE_URL") && anonKey()),
      gatewaySecretConfigured: Boolean(gatewaySecret()),
      missing: missingConfig(),
    });
  }

  const { socket, response } = Deno.upgradeWebSocket(request, { idleTimeout: 0 });
  socket.binaryType = "arraybuffer";
  const session = new EdgeSynapseVoiceSession(socket);

  let resolveClosed!: () => void;
  const closed = new Promise<void>((resolve) => {
    resolveClosed = resolve;
  });
  const edgeRuntime = (
    globalThis as typeof globalThis & {
      EdgeRuntime?: { waitUntil?: (promise: Promise<void>) => void };
    }
  ).EdgeRuntime;
  edgeRuntime?.waitUntil?.(closed);

  socket.onmessage = (event) => session.handleClientMessage(event.data);
  socket.onerror = () => session.close();
  socket.onclose = () => {
    session.close();
    resolveClosed();
  };

  return response;
});
