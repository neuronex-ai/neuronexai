import {
  assertNoLegacyElevenLabsMultiLanguageCode,
  normalizeLegacyElevenLabsMultilingualSettings,
  SYNAPSE_ELEVENLABS_LANGUAGE,
  SYNAPSE_ELEVENLABS_MODEL_ID,
} from "../_shared/synapse-voice-settings.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const DEFAULT_DEEPGRAM_URL = "wss://agent.deepgram.com/v1/agent/converse";
const MANAGED_THINK_MODELS = new Set([
  "open_ai:gpt-5.4-mini",
  "google:gemini-3.5-flash",
  "anthropic:claude-haiku-4-5",
]);
const MAX_VOICE_FUNCTIONS = 16;

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

const envFlag = (name: string, fallback = false) => {
  const value = clean(Deno.env.get(name), 40).toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value);
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

function missingConfig() {
  return [
    !Deno.env.get("DEEPGRAM_API_KEY") ? "DEEPGRAM_API_KEY" : "",
    !Deno.env.get("SUPABASE_URL") ? "SUPABASE_URL" : "",
    !anonKey() ? "SUPABASE_ANON_KEY" : "",
    !gatewaySecret() ? "SYNAPSE_VOICE_GATEWAY_SECRET" : "",
  ].filter(Boolean);
}

function gatewayErrorType(error: unknown) {
  const text = clean(error instanceof Error ? error.message : error, 1200).toLowerCase();
  if (/sessao|token|auth|unauthorized|401|403|jwt|gateway nao autorizado/.test(text)) return "auth_error";
  if (/settings|config|api[_ -]?key|secret|supabase nao configurado|missing/.test(text)) return "config_error";
  if (/deepgram|eleven|openai|nvidia|provider|websocket|socket|1005|failed_to_speak|failed_to_think/.test(text)) return "provider_error";
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

  const flags = settings.flags && typeof settings.flags === "object"
    ? settings.flags as Record<string, unknown>
    : {};
  settings.flags = flags;
  flags.history = envFlag("SYNAPSE_VOICE_HISTORY", true);

  const thinkChain = Array.isArray(agent.think) ? agent.think : [agent.think];
  if (!thinkChain.length || thinkChain.some((item) => !item || typeof item !== "object")) {
    throw new Error("Settings de voz inválidos: agent.think ausente.");
  }
  for (const [index, rawThink] of thinkChain.entries()) {
    const think = rawThink as Record<string, unknown>;
    const thinkProvider = think.provider as Record<string, unknown> | undefined;
    if (!thinkProvider || typeof thinkProvider !== "object") {
      throw new Error("Settings de voz inválidos: provedor de raciocínio ausente.");
    }
    const providerKey = `${clean(thinkProvider.type, 40)}:${clean(thinkProvider.model, 120)}`;
    if (!MANAGED_THINK_MODELS.has(providerKey) || think.endpoint) {
      throw new Error("Settings de voz inválidos: apenas LLMs gerenciados aprovados são permitidos.");
    }
    if (index === 0 && !clean(think.prompt, 8000)) {
      throw new Error("Settings de voz inválidos: prompt primário ausente.");
    }
    if (index === 0 && !Array.isArray(think.functions)) {
      throw new Error("Settings de voz inválidos: ferramentas do modelo primário ausentes.");
    }
    if (Array.isArray(think.functions) && think.functions.length > MAX_VOICE_FUNCTIONS) {
      throw new Error("Settings de voz inválidos: conjunto de ferramentas excede o núcleo permitido.");
    }
  }
  agent.think = thinkChain;

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

  const speakChain = Array.isArray(agent.speak) ? agent.speak : [agent.speak];
  if (speakChain.length !== 2 || speakChain.some((item) => !item || typeof item !== "object")) {
    throw new Error("Settings de voz inválidos: cadeia Azure/ElevenLabs ausente.");
  }

  normalizeLegacyElevenLabsMultilingualSettings(settings);
  assertNoLegacyElevenLabsMultiLanguageCode(settings);

  const elevenSpeak = speakChain[0] as Record<string, unknown>;
  const fallbackSpeak = speakChain[1] as Record<string, unknown>;
  const elevenProvider = elevenSpeak.provider as Record<string, unknown> | undefined;
  const elevenEndpoint = elevenSpeak.endpoint as Record<string, unknown> | undefined;
  const elevenHeaders = elevenEndpoint?.headers as Record<string, unknown> | undefined;
  const elevenModelId = clean(elevenProvider?.model_id, 120).toLowerCase();
  const elevenLanguage = clean(elevenProvider?.language, 40).toLowerCase();

  const fallbackProvider = fallbackSpeak.provider as Record<string, unknown> | undefined;
  const fallbackEndpoint = fallbackSpeak.endpoint as Record<string, unknown> | undefined;
  const fallbackHeaders = fallbackEndpoint?.headers as Record<string, unknown> | undefined;
  if (
    elevenProvider?.type !== "eleven_labs" ||
    elevenModelId !== SYNAPSE_ELEVENLABS_MODEL_ID ||
    elevenLanguage !== SYNAPSE_ELEVENLABS_LANGUAGE ||
    !clean(elevenEndpoint?.url, 1000).includes("api.elevenlabs.io/v1/text-to-speech/") ||
    !clean(elevenHeaders?.["xi-api-key"], 8000)
  ) {
    throw new Error("Settings de voz inválidos: ElevenLabs multilíngue principal ausente.");
  }
  if (
    fallbackProvider?.type !== "open_ai" ||
    !clean(fallbackEndpoint?.url, 1000).includes("/functions/v1/synapse-voice-azure-tts") ||
    !clean(fallbackHeaders?.["x-synapse-tts-secret"], 8000)
  ) {
    throw new Error("Settings de voz inválidos: fallback Azure Speech incompleto.");
  }
  agent.speak = speakChain;
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
const CLIENT_ACTION_ACK_TIMEOUT_MS = Number(
  Deno.env.get("SYNAPSE_VOICE_CLIENT_ACTION_ACK_TIMEOUT_MS") || "20000",
);
const CONFIRMATION_CHALLENGE_ACK_TIMEOUT_MS = Number(
  Deno.env.get("SYNAPSE_VOICE_CONFIRMATION_CHALLENGE_TIMEOUT_MS") || "60000",
);

const OPAQUE_CONFIRMATION_TOOLS = new Set([
  "manage_action_group",
  "create_neurofinance_charge",
  "create_fiscal_invoice",
]);

const TOOL_LABELS: Record<string, string> = {
  confirm_pending_action: "confirmacao pendente",
  cancel_pending_action: "cancelamento pendente",
  prepare_action_group: "preparacao de acoes",
  execute_action_group: "execucao de acoes",
  manage_action_group: "revisao protegida",
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
  analyze_neuroview_patient_patterns: "análise no NeuroView",
  create_neuroflow_from_patient_history: "criação no NeuroFlow",
  create_neuropulse_cause_effect_diagram: "diagrama no NeuroPulse",
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

const functionCallShape = (fn: Record<string, unknown>) => {
  const rawArguments = typeof fn.arguments === "string"
    ? fn.arguments
    : fn.arguments && typeof fn.arguments === "object"
      ? JSON.stringify(fn.arguments)
      : "";
  let parsed: Record<string, unknown> = {};
  let parseSuccess = true;
  try {
    parsed = rawArguments ? safeJsonParse(rawArguments) : {};
    if (rawArguments && !Object.keys(parsed).length && rawArguments.trim() !== "{}") parseSuccess = false;
  } catch {
    parseSuccess = false;
  }
  const rawSteps = Array.isArray(parsed.steps) ? parsed.steps.slice(0, 12) : [];
  return {
    callId: clean(fn.id, 120) || null,
    functionName: clean(fn.name, 120) || null,
    argumentJsonLength: rawArguments.length,
    parseSuccess,
    stepCount: rawSteps.length,
    steps: rawSteps.map((rawValue, index) => {
      const step = rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)
        ? rawValue as Record<string, unknown>
        : {};
      const args = step.arguments && typeof step.arguments === "object" && !Array.isArray(step.arguments)
        ? step.arguments as Record<string, unknown>
        : {};
      return {
        index: index + 1,
        actionKind: clean(step.action_kind || step.actionKind, 120) || null,
        toolName: clean(step.tool_name || step.toolName, 120) || null,
        stepKeys: Object.keys(step).sort().slice(0, 40),
        argumentKeys: Object.keys(args).sort().slice(0, 80),
      };
    }),
  };
};

const delegatedTool = (name: string, args: Record<string, unknown> = {}) => {
  if (name !== "execute_synapse_tool") return { name, args };
  return {
    name: clean(args.tool_name || args.toolName, 120),
    args: safeJsonParse(args.arguments || args.args || args.arguments_json),
  };
};

const needsOpaqueConfirmation = (toolName: string, args: Record<string, unknown> = {}) => {
  if (OPAQUE_CONFIRMATION_TOOLS.has(toolName)) return true;
  if (toolName !== "create_appointment") return false;
  const financial = args.financial && typeof args.financial === "object"
    ? args.financial as Record<string, unknown>
    : {};
  const financialMode = clean(args.financial_mode || financial.mode, 40).toLowerCase();
  const occurrenceCount = Number(args.occurrence_count || 1);
  return financialMode === "neurofinance"
    || financialMode === "package"
    || args.create_charge === true
    || Number.isFinite(occurrenceCount) && occurrenceCount >= 6;
};

const money = (value: unknown) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount);
};

type ReviewSegment = Record<string, unknown>;
type ReviewAction = {
  id: string;
  area: string;
  segments: ReviewSegment[];
};

const pendingActionReview = (
  name: string,
  args: Record<string, unknown> = {},
  payload: Record<string, unknown> = {},
) => {
  const delegated = delegatedTool(name, args);
  const toolName = clean(payload.tool || delegated.name, 120);
  const toolArgs = delegated.args;
  const reviewId = crypto.randomUUID();
  const editable = (
    fieldId: string,
    label: string,
    value: unknown,
    extra: Record<string, unknown> = {},
  ) => ({
    type: "editable",
    fieldId,
    label,
    value: clean(value, Number(extra.maxLength) || 4000),
    ...extra,
  });
  let actions: ReviewAction[] = [];

  if (toolName === "send_patient_email") {
    actions = [
      {
        id: "email-subject",
        area: "E-mail",
        segments: [
          { type: "text", text: "Assunto: " },
          editable("subject", "título", toolArgs.subject, { maxLength: 180 }),
        ],
      },
      {
        id: "email-body",
        area: "E-mail",
        segments: [
          { type: "text", text: "Mensagem: " },
          editable("body", "corpo do e-mail", toolArgs.body, { maxLength: 4000 }),
        ],
      },
    ];
  } else if (toolName === "create_neurofinance_charge") {
    const rawPaymentMethod = clean(toolArgs.payment_method, 40).toLowerCase();
    const paymentMethod = ["pix", "boleto", "card", "undefined"].includes(rawPaymentMethod)
      ? rawPaymentMethod
      : "undefined";
    actions = [
      {
        id: "neurofinance-charge",
        area: "NeuroFinance",
        segments: [
          { type: "text", text: "Cobrança de " },
          editable("amount", "valor", money(toolArgs.amount), { inputMode: "decimal", maxLength: 24 }),
          { type: "text", text: " via " },
          {
            type: "select",
            fieldId: "payment_method",
            label: "meio de pagamento",
            value: paymentMethod,
            options: [
              { value: "pix", label: "Pix" },
              { value: "boleto", label: "Boleto" },
              { value: "card", label: "Cartão" },
              { value: "undefined", label: "A definir" },
            ],
          },
          { type: "text", text: "." },
        ],
      },
      {
        id: "neurofinance-due-date",
        area: "Vencimento",
        segments: [
          { type: "text", text: "Vence em " },
          editable("due_date", "data de vencimento", toolArgs.due_date, { maxLength: 20 }),
          { type: "text", text: "." },
        ],
      },
    ];
  } else if (toolName === "create_fiscal_invoice") {
    actions = [{
      id: "fiscal-document",
      area: "Fiscal",
      segments: [
        { type: "text", text: "Documento de " },
        editable("amount", "valor", money(toolArgs.amount), { inputMode: "decimal", maxLength: 24 }),
        { type: "text", text: " por " },
        editable("description", "descrição", toolArgs.description, { maxLength: 180 }),
        { type: "text", text: "." },
      ],
    }];
  }

  if (!actions.length) return null;
  return {
    type: "synapse_action_review",
    data: { reviewId, toolName, actions },
  };
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
  const delegatedName = name === "execute_synapse_tool"
    ? clean(args.tool_name || args.toolName, 120)
    : name;
  const delegatedArgs = name === "execute_synapse_tool"
    ? safeJsonParse(args.arguments || args.args || args.arguments_json)
    : args;
  const patient = patientFromArgs(delegatedArgs);
  const label =
    clean(
      delegatedArgs.task_label || delegatedArgs.taskLabel || delegatedArgs.label || delegatedArgs.intent_label,
      140,
    ) ||
    titleizeTool(delegatedName) ||
    "consulta";
  return patient ? `${label} de ${patient}` : label;
};

const initialStatusMessage = (name: string, args: Record<string, unknown>) =>
  `Consultando ${taskLabel(name, args)}.`;

const progressStatusMessage = (name: string, args: Record<string, unknown>) =>
  `${taskLabel(name, args)} em andamento.`;

const retryStatusMessage = (name: string, args: Record<string, unknown>) =>
  `Tentando novamente: ${taskLabel(name, args)}.`;

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

const normalizeToolPayload = (name: string, result: Record<string, unknown>): Record<string, any> => {
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
    error_code: ok ? null : clean(parsed.error_code || parsed.errorCode, 80) || "tool_failed",
    failed_step_index: parsed.failed_step_index ?? parsed.failedStepIndex ?? null,
    blocked_steps: Array.isArray(parsed.blocked_steps)
      ? parsed.blocked_steps.slice(0, 12)
      : Array.isArray(parsed.blockedSteps)
        ? parsed.blockedSteps.slice(0, 12)
        : [],
    grounded: Boolean(parsed.grounded),
    recordCount: Number(parsed.recordCount || 0),
    structuredData: parsed.structuredData || result?.structuredData || null,
    primary_committed: Boolean(parsed.primary_committed ?? parsed.primaryCommitted),
    primaryCommitted: Boolean(parsed.primary_committed ?? parsed.primaryCommitted),
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.slice(0, 20) : [],
    effectStatus: parsed.effectStatus && typeof parsed.effectStatus === "object"
      ? parsed.effectStatus
      : {},
  };
};

const failurePayload = (name: string, error: unknown, aborted: boolean) => {
  const typed = error as { name?: string; message?: string };
  const transient = !aborted && isTransientError(error);
  const message = aborted
    ? "A acao foi cancelada antes de concluir."
    : typed?.name === "TimeoutError"
      ? "A consulta demorou mais que o esperado. Nenhuma ação adicional foi executada."
      : transient
        ? "Falha técnica temporária ao executar esta etapa. Nenhuma ação adicional foi executada."
        : "Falha técnica ao executar esta etapa. Nenhuma ação adicional foi executada.";
  return {
    ok: false,
    tool: name,
    cancelled: aborted,
    spoken_summary: message,
    message,
    retryable: transient,
    needs_clarification: false,
    confirmation_required: false,
    data: null,
    error: aborted ? null : message,
    error_code: aborted ? "cancelled" : transient ? "transient_runtime_failure" : "runtime_failure",
    internal_error: aborted ? null : clean(typed?.message || error, 1200),
  };
};

const applyClientActionResult = (
  name: string,
  payload: Record<string, any>,
  result: Record<string, unknown>,
) => {
  const success = result?.success === true;
  const message = clean(
    result?.message ||
      (success
        ? "A interface confirmou a acao solicitada."
        : "A acao foi processada, mas a interface nao conseguiu concluir a etapa visual."),
    800,
  );
  const clientAction = {
    success,
    message,
    cancelled: Boolean(result?.cancelled),
    timed_out: Boolean(result?.timed_out),
    error_code: success ? null : (result?.timed_out === true ? "client_action_timeout" : "client_action_failed"),
    duration_ms: Number.isFinite(Number(result?.durationMs))
      ? Math.max(0, Math.round(Number(result.durationMs)))
      : undefined,
  };

  if (success) return { ...payload, client_action: clientAction };

  if (name === "request_interface_action" || payload.tool === "manage_action_group") {
    return {
      ...payload,
      ok: false,
      spoken_summary: message,
      message,
      retryable: result?.timed_out === true,
      needs_clarification: false,
      error: message,
      error_code: result?.timed_out === true ? "client_action_timeout" : "client_action_failed",
      client_action: clientAction,
    };
  }

  const warnings = Array.isArray(payload?.warnings)
    ? [...payload.warnings, message]
    : [message];
  return {
    ...payload,
    warning: message,
    warnings,
    client_action: clientAction,
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

type PendingConfirmation = {
  toolName: string;
  opaque: boolean;
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

export class EdgeVoiceFunctionRunner {
  private sendDeepgram: (payload: unknown) => void;
  private sendClient: (payload: unknown) => void;
  private invokeTool: (input: {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    signal?: AbortSignal;
  }) => Promise<Record<string, unknown>>;
  private tasks = new Map<string, VoiceTask>();
  private handledCallIds = new Set<string>();
  private pendingClientActions = new Map<
    string,
    { finish: (result: Record<string, unknown>) => void }
  >();
  private pendingConfirmation: PendingConfirmation | null = null;
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

  handleClientActionResult(event: Record<string, unknown>) {
    const id = clean(event?.id || event?.callId || event?.call_id, 120);
    if (!id) return false;
    const pending = this.pendingClientActions.get(id);
    if (!pending) return false;
    pending.finish({
      success: event?.success === true,
      message: clean(event?.message, 800),
      cancelled: Boolean(event?.cancelled),
      timed_out: false,
      durationMs: event?.durationMs ?? event?.duration_ms,
    });
    return true;
  }

  setPendingConfirmation(toolName: string, opaque: boolean) {
    this.pendingConfirmation = {
      toolName: clean(toolName, 120) || "execute_action_group",
      opaque,
    };
  }

  awaitClientAction(
    task: VoiceTask,
    action: unknown,
    requestedTimeoutMs = CLIENT_ACTION_ACK_TIMEOUT_MS,
  ) {
    return new Promise<Record<string, unknown>>((resolve) => {
      let settled = false;
      const finish = (result: Record<string, unknown>) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        task.controller.signal.removeEventListener("abort", onAbort);
        if (this.pendingClientActions.get(task.id)?.finish === finish) {
          this.pendingClientActions.delete(task.id);
        }
        resolve(result);
      };
      const onAbort = () => finish({
        success: false,
        cancelled: true,
        message: "A acao visual foi cancelada antes de concluir.",
      });
      const timeoutMs = Number.isFinite(requestedTimeoutMs)
        ? Math.max(1000, requestedTimeoutMs)
        : 20000;
      const timer = setTimeout(() => finish({
        success: false,
        timed_out: true,
        message: "A interface nao confirmou a acao visual a tempo.",
      }), timeoutMs);

      this.pendingClientActions.set(task.id, { finish });
      task.controller.signal.addEventListener("abort", onAbort, { once: true });
      this.sendClient({
        type: "client_action",
        id: task.id,
        callId: task.id,
        name: task.name,
        action,
      });
    });
  }

  claimCall(id: string, name: string, args: Record<string, unknown>) {
    if (this.handledCallIds.has(id)) {
      this.sendClient({
        type: "function_status",
        status: "duplicate_ignored",
        id,
        name,
        label: taskLabel(name, args),
        message: "Solicitacao duplicada ignorada.",
      });
      return false;
    }

    this.handledCallIds.add(id);
    if (this.handledCallIds.size > 256) {
      const oldest = this.handledCallIds.values().next().value;
      if (oldest) this.handledCallIds.delete(oldest);
    }
    return true;
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
    const rawShape = functionCallShape(fn);
    console.info("[synapse-voice-gateway] FunctionCallRequest shape", rawShape);
    const id = clean(fn.id || crypto.randomUUID(), 120);
    const name = clean(fn.name, 120);
    const thoughtSignature = clean(fn.thought_signature, 4000);
    const args = safeJsonParse(fn.arguments);
    if (!name) return;
    if (!this.claimCall(id, name, args)) return;

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

    const firstMessage = initialStatusMessage(name, args);
    task.message = firstMessage;
    this.sendStatus(task, "started", { message: firstMessage });
    this.sendVoiceState("tool_active", task);
    this.scheduleProgress(task, SLOW_FUNCTION_MS);
    let keepAwaitingConfirmation = false;

    try {
      if (name === "confirm_pending_action" && this.pendingConfirmation?.opaque) {
        this.sendDeepgram({
          type: "InjectAgentMessage",
          message: "Repita o número no centro da sua tela.",
        });
        const challengeResult = await this.awaitClientAction(task, {
          type: "synapse_confirmation_challenge",
          data: { challengeId: crypto.randomUUID() },
        }, CONFIRMATION_CHALLENGE_ACK_TIMEOUT_MS);
        if (controller.signal.aborted) throw makeAbortError();
        if (!challengeResult.success) {
          const message = challengeResult.cancelled
            ? "A confirmação foi cancelada. A ação continua pendente."
            : "O número não foi confirmado. A ação continua pendente.";
          const payload = {
            ok: false,
            tool: name,
            spoken_summary: message,
            message,
            retryable: false,
            needs_clarification: false,
            confirmation_required: true,
            cancelled: Boolean(challengeResult.cancelled),
            data: null,
            error: message,
          };
          this.sendFunctionResponse(id, name, payload, thoughtSignature);
          this.sendStatus(task, challengeResult.cancelled ? "cancelled" : "failed", {
            message,
            confirmation_required: true,
          });
          this.sendVoiceState("awaiting_confirmation", task, {
            message,
            confirmationRequired: true,
          });
          keepAwaitingConfirmation = true;
          return;
        }
      }

      const { result, payload } = await this.invokeWithRetry(task);
      if (controller.signal.aborted) throw makeAbortError();

      if (result?.clientAction) {
        const clientActionResult = await this.awaitClientAction(task, result.clientAction);
        if (controller.signal.aborted) throw makeAbortError();
        Object.assign(payload, applyClientActionResult(name, payload, clientActionResult));
      }
      if (task.interrupted && payload.ok) payload.interrupted = true;

      if (payload.ok && payload.confirmation_required) {
        const delegated = delegatedTool(name, args);
        const confirmedToolName = clean(payload.tool || delegated.name, 120);
        this.pendingConfirmation = {
          toolName: confirmedToolName,
          opaque: needsOpaqueConfirmation(confirmedToolName, delegated.args),
        };
        if (!result?.clientAction) {
          const reviewAction = pendingActionReview(name, args, payload);
          if (reviewAction) {
            payload.review = {
              step_count: reviewAction.data.actions.length,
              areas: reviewAction.data.actions.map((action) => action.area),
            };
            this.sendClient({ type: "review_action", action: reviewAction });
          }
        }
      } else if (payload.ok && ["confirm_pending_action", "cancel_pending_action"].includes(name)) {
        this.pendingConfirmation = null;
        this.sendClient({
          type: "review_action",
          action: { type: "synapse_action_review_dismiss" },
        });
      }

      this.sendFunctionResponse(id, name, payload, thoughtSignature);
      const completedStatus = payload.confirmation_required ? "confirmation_required" : "completed";
      keepAwaitingConfirmation = Boolean(payload.ok && payload.confirmation_required);
      this.sendStatus(task, payload.ok ? completedStatus : "failed", {
        message: payload.spoken_summary,
        error: payload.error || undefined,
        error_code: payload.error_code || undefined,
        retryable: payload.retryable,
        needs_clarification: payload.needs_clarification,
        confirmation_required: payload.confirmation_required,
      });
      this.sendVoiceState(
        payload.ok ? (payload.confirmation_required ? "awaiting_confirmation" : "tool_completed") : "tool_failed",
        task,
        {
          message: payload.spoken_summary,
          errorCode: payload.error_code || null,
          confirmationRequired: payload.confirmation_required,
        },
      );
    } catch (error) {
      const aborted = controller.signal.aborted || (error as { name?: string })?.name === "AbortError";
      const payload = failurePayload(name, error, aborted);
      this.sendFunctionResponse(id, name, payload, thoughtSignature);
      this.sendStatus(task, aborted ? "cancelled" : "failed", {
        message: payload.spoken_summary,
        error: payload.error || undefined,
        error_code: payload.error_code || undefined,
        retryable: payload.retryable,
      });
      this.sendVoiceState(aborted ? "tool_cancelled" : "tool_failed", task, {
        message: payload.spoken_summary,
        errorCode: payload.error_code || null,
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

      const message = progressStatusMessage(task.name, task.args);
      task.progressCount += 1;
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
        const message = retryStatusMessage(task.name, task.args);
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
  private lastUserTranscript = "";
  private lastUserTranscriptAt = 0;
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
      azureTtsAdapterConfigured: Boolean(
        Array.isArray((settings as any)?.agent?.speak) &&
          (settings as any).agent.speak.some((item: any) =>
            item?.provider?.type === "open_ai" &&
            String(item?.endpoint?.url || "").includes("/functions/v1/synapse-voice-azure-tts")
          )
      ),
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
        systemInstruction: clean(payload.systemInstruction, 600),
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
      void this.persistQueue.finally(() =>
        this.updateVoiceSession(this.settingsApplied ? "ended" : "error", {
          closeCode: event.code,
          closeReason,
        })
      );
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
        if (isUserRole(text.role)) {
          this.lastUserTranscript = text.content;
          this.lastUserTranscriptAt = Date.now();
          this.runner.onUserTranscript(text.content);
        }
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
        utterance: Date.now() - this.lastUserTranscriptAt <= 30_000
          ? this.lastUserTranscript
          : undefined,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.error) {
      throw new Error(data?.error || `Falha na ferramenta ${input.name} (${response.status}).`);
    }
    return data;
  }

  async editActionGroup(payload: Record<string, unknown>) {
    const reviewId = clean(payload.reviewId || payload.review_id, 160);
    const stepId = clean(payload.stepId || payload.step_id, 160);
    const fieldId = clean(payload.fieldId || payload.field_id, 120);
    const resultBase = { reviewId, stepId, fieldId };
    if (!this.settingsApplied || !this.conversationId || !reviewId || !stepId || !fieldId) {
      this.sendClient({
        type: "action_group_edit_result",
        ...resultBase,
        success: false,
        message: "A revisão não está pronta para ser atualizada.",
      });
      return;
    }

    try {
      const response = await fetch(`${functionsUrl()}/synapse-voice-tool`, {
        method: "POST",
        headers: {
          Authorization: this.authorization,
          apikey: anonKey(),
          "Content-Type": "application/json",
          "x-synapse-gateway-secret": gatewaySecret(),
        },
        body: JSON.stringify({
          action: "edit_action_group",
          requestId: clean(payload.requestId || payload.request_id, 120),
          conversationId: this.conversationId,
          sessionId: this.conversationId,
          voiceSessionId: this.voiceSessionId,
          planId: clean(payload.planId || payload.plan_id, 160),
          planVersion: Number(payload.planVersion || payload.plan_version),
          planHash: clean(payload.planHash || payload.plan_hash, 64),
          stepId,
          fieldId,
          value: payload.value,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.error || data?.ok !== true) {
        throw new Error(data?.error || data?.message || `Não consegui atualizar a revisão (${response.status}).`);
      }

      const reviewAction = data?.clientAction && typeof data.clientAction === "object"
        ? data.clientAction as Record<string, any>
        : null;
      const confirmationPolicy = clean(reviewAction?.data?.confirmationPolicy, 20);
      if (confirmationPolicy) {
        this.runner.setPendingConfirmation("execute_action_group", confirmationPolicy === "opaque");
      }

      this.sendClient({
        type: "action_group_edit_result",
        ...resultBase,
        success: true,
        message: clean(data?.message, 500) || "Revisão atualizada.",
      });
      if (reviewAction) this.sendClient({ type: "review_action", action: reviewAction });
    } catch (error) {
      this.sendClient({
        type: "action_group_edit_result",
        ...resultBase,
        success: false,
        message: clean(error instanceof Error ? error.message : error, 500) || "Não consegui atualizar este campo.",
      });
    }
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
    if (!text || !this.settingsApplied) return;
    this.sendDeepgram({ type: "InjectUserMessage", content: text });
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

    if (payload.type === "action_group_edit_request") {
      void this.editActionGroup(payload as Record<string, unknown>);
      return;
    }

    if (payload.type === "client_action_result") {
      this.runner.handleClientActionResult(payload as Record<string, unknown>);
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
    void this.persistQueue.finally(() =>
      this.updateVoiceSession(this.settingsApplied ? "ended" : "cancelled", {
        closeReason: "client_closed",
      })
    );
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
      voicePath: "deepgram-managed-gpt54mini-elevenlabs-pt-br-azure-speech-fallback",
      thinkPrimary: "open_ai/gpt-5.4-mini",
      thinkFallback: "google/gemini-3.5-flash",
      thinkLastResort: "anthropic/claude-haiku-4-5",
      speakPrimary: "deepgram-managed-elevenlabs-pt-br",
      speakFallback: "azure-speech",
      elevenLanguageMode: SYNAPSE_ELEVENLABS_LANGUAGE,
      deepgramConfigured: Boolean(Deno.env.get("DEEPGRAM_API_KEY")),
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
