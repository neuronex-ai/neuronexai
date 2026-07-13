import { classifyInterruption } from "./intent.js";

const SLOW_FUNCTION_MS = Number(process.env.SYNAPSE_VOICE_SLOW_FUNCTION_MS || "5500");
const FOLLOWUP_FUNCTION_MS = Number(process.env.SYNAPSE_VOICE_FOLLOWUP_FUNCTION_MS || "9000");
const MAX_PROGRESS_MESSAGES = Number(process.env.SYNAPSE_VOICE_MAX_PROGRESS_MESSAGES || "2");
const MAX_TOOL_RETRIES = Number(process.env.SYNAPSE_VOICE_MAX_TOOL_RETRIES || "1");
const TOOL_TIMEOUT_MS = Number(process.env.SYNAPSE_VOICE_TOOL_TIMEOUT_MS || "18000");
const CLIENT_ACTION_ACK_TIMEOUT_MS = Number(
  process.env.SYNAPSE_VOICE_CLIENT_ACTION_ACK_TIMEOUT_MS || "20000",
);

const clean = (value, max = 5000) => String(value ?? "").trim().slice(0, max);

const TOOL_LABELS = {
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
  analyze_neuroview_patient_patterns: "análise no NeuroView",
  create_neuroflow_from_patient_history: "criação no NeuroFlow",
  create_neuropulse_cause_effect_diagram: "diagrama no NeuroPulse",
};

function safeJsonParse(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function titleize(value) {
  const raw = clean(value, 160);
  const key = raw.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (TOOL_LABELS[key]) return TOOL_LABELS[key];
  if (/appointment|calendar|agenda/i.test(raw)) return "agenda";
  if (/patient|paciente|clinical|history|prontuario/i.test(raw)) return "paciente";
  if (/finance|invoice|payment|transaction|cobranca/i.test(raw)) return "financeiro";
  if (/document|note|nota/i.test(raw)) return "documento";
  if (/[_{}[\]"]/.test(raw)) return "acao do Synapse";
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function patientFromArgs(args) {
  return clean(args.patient_name || args.patientName || args.patient || args.nome_paciente, 120);
}

function taskLabel(name, args = {}) {
  const delegatedName = name === "execute_synapse_tool"
    ? clean(args.tool_name || args.toolName, 120)
    : name;
  const delegatedArgs = name === "execute_synapse_tool"
    ? safeJsonParse(args.arguments || args.args || args.arguments_json)
    : args;
  const patient = patientFromArgs(delegatedArgs);
  const label =
    clean(delegatedArgs.task_label || delegatedArgs.taskLabel || delegatedArgs.label || delegatedArgs.intent_label, 140) ||
    titleize(delegatedName) ||
    "consulta";
  return patient ? `${label} de ${patient}` : label;
}

function initialStatusMessage(name, args) {
  return `Consultando ${taskLabel(name, args)}.`;
}

function progressStatusMessage(name, args) {
  return `${taskLabel(name, args)} em andamento.`;
}

function retryStatusMessage(name, args) {
  return `Tentando novamente: ${taskLabel(name, args)}.`;
}

function makeAbortError(message = "Operacao cancelada.") {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function makeTimeoutError(message = "A consulta demorou mais que o esperado.") {
  const error = new Error(message);
  error.name = "TimeoutError";
  return error;
}

function wait(ms, signal) {
  if (!ms) return Promise.resolve();
  if (signal?.aborted) return Promise.reject(makeAbortError());

  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(makeAbortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function isTransientError(value) {
  if (value?.name === "TimeoutError") return true;
  const text = clean(value?.message || value?.error || value, 1000).toLowerCase();
  if (!text) return false;
  return /timeout|timed out|temporari|temporary|network|socket|fetch|econn|5\d\d|rate limit|too many|indisponivel|instavel|oscila|gateway|service unavailable/.test(text);
}

function normalizePayload(name, result) {
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
    data: parsed.data ?? null,
    error: ok ? null : clean(parsed.error || spoken, 1200),
    grounded: Boolean(parsed.grounded),
    recordCount: Number(parsed.recordCount || 0),
    structuredData: parsed.structuredData || null,
  };
}

function humanFailureMessage(error, aborted) {
  if (aborted) return "A acao foi cancelada antes de concluir.";
  if (error?.name === "TimeoutError") {
    return "Essa consulta demorou mais que o esperado e nao voltou com seguranca. Posso tentar de novo em seguida.";
  }
  return "Tentei consultar aqui, mas nao recebi um retorno confiavel. Posso tentar de novo?";
}

function failurePayload(name, error, aborted) {
  const message = humanFailureMessage(error, aborted);
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
    internal_error: aborted ? null : clean(error?.message || error, 1200),
  };
}

function applyClientActionResult(name, payload, result) {
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
    duration_ms: Number.isFinite(Number(result?.durationMs))
      ? Math.max(0, Math.round(Number(result.durationMs)))
      : undefined,
  };

  if (success) return { ...payload, client_action: clientAction };

  if (name === "request_interface_action") {
    return {
      ...payload,
      ok: false,
      spoken_summary: message,
      message,
      retryable: false,
      needs_clarification: false,
      error: message,
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
}

function clientTask(task) {
  if (!task) return null;
  return {
    id: task.id,
    name: task.name,
    label: task.label,
    message: task.message || "",
    status: task.status,
    startedAt: task.startedAt,
    elapsedMs: Math.max(0, Date.now() - task.startedAt),
  };
}

export class VoiceFunctionRunner {
  constructor({ sendDeepgram, sendClient, invokeTool }) {
    this.sendDeepgram = sendDeepgram;
    this.sendClient = sendClient;
    this.invokeTool = invokeTool;
    this.tasks = new Map();
    this.handledCallIds = new Set();
    this.pendingClientActions = new Map();
    this.lastInterruptionAt = 0;
    this.queue = Promise.resolve();
  }

  handleClientActionResult(event) {
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

  awaitClientAction(task, action) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
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
      const timeoutMs = Number.isFinite(CLIENT_ACTION_ACK_TIMEOUT_MS)
        ? Math.max(1000, CLIENT_ACTION_ACK_TIMEOUT_MS)
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

  claimCall(id, name, args) {
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

  sendFunctionResponse(id, name, content, thoughtSignature = "") {
    const response = {
      type: "FunctionCallResponse",
      id,
      name,
      content: typeof content === "string" ? content : JSON.stringify(content),
    };
    if (thoughtSignature) response.thought_signature = thoughtSignature;
    this.sendDeepgram(response);
  }

  sendStatus(task, status, extra = {}) {
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

  sendVoiceState(phase, task = null, extra = {}) {
    const activeTool = clientTask(task);
    this.sendClient({
      type: "voice_state",
      phase,
      activeTool,
      activeTools: Array.from(this.tasks.values()).map(clientTask),
      ...extra,
    });
  }

  handleFunctionCallRequest(event) {
    const functions = Array.isArray(event?.functions) ? event.functions : [];
    const runBatch = async () => {
      for (const fn of functions) {
        await this.runFunction(fn);
      }
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

  async runFunction(fn) {
    if (fn?.client_side === false) return;
    const id = clean(fn?.id || crypto.randomUUID(), 120);
    const name = clean(fn?.name, 120);
    const thoughtSignature = clean(fn?.thought_signature, 4000);
    const args = safeJsonParse(fn?.arguments);
    if (!name) return;
    if (!this.claimCall(id, name, args)) return;

    const controller = new AbortController();
    const task = {
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
      const { result, payload } = await this.invokeWithRetry(task);
      if (controller.signal.aborted) throw makeAbortError();

      if (result?.clientAction) {
        const clientActionResult = await this.awaitClientAction(task, result.clientAction);
        if (controller.signal.aborted) throw makeAbortError();
        Object.assign(payload, applyClientActionResult(name, payload, clientActionResult));
      }

      if (task.interrupted && payload.ok) {
        payload.interrupted = true;
      }

      this.sendFunctionResponse(id, name, payload, thoughtSignature);
      const completedStatus = payload.confirmation_required ? "confirmation_required" : "completed";
      keepAwaitingConfirmation = payload.ok && payload.confirmation_required;
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
        {
          message: payload.spoken_summary,
          confirmationRequired: payload.confirmation_required,
        },
      );
    } catch (error) {
      const aborted = controller.signal.aborted || error?.name === "AbortError";
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
      if (!keepAwaitingConfirmation) {
        this.sendVoiceState(this.tasks.size ? "tool_active" : "thinking");
      }
    }
  }

  scheduleProgress(task, delay) {
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

      if (task.progressCount < MAX_PROGRESS_MESSAGES) {
        this.scheduleProgress(task, FOLLOWUP_FUNCTION_MS);
      }
    }, delay);
    task.timers.push(timer);
  }

  async invokeWithRetry(task) {
    let lastError = null;

    for (let attempt = 0; attempt <= MAX_TOOL_RETRIES; attempt += 1) {
      if (attempt > 0) {
        const message = retryStatusMessage(task.name, task.args);
        this.sendStatus(task, "retrying", { message, attempt });
        this.sendVoiceState("tool_retrying", task);
        await wait(650, task.controller.signal);
      }

      try {
        const result = await this.invokeToolWithTimeout(task);
        const payload = normalizePayload(task.name, result);
        const shouldRetry = !payload.ok && payload.retryable && attempt < MAX_TOOL_RETRIES;
        if (!shouldRetry) return { result, payload };
      } catch (error) {
        lastError = error;
        if (task.controller.signal.aborted || error?.name === "AbortError") throw error;
        if (!isTransientError(error) || attempt >= MAX_TOOL_RETRIES) throw error;
      }
    }

    throw lastError || new Error("Falha ao executar ferramenta de voz.");
  }

  async invokeToolWithTimeout(task) {
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
      if (attemptController.signal.aborted && !task.controller.signal.aborted) {
        throw makeTimeoutError();
      }
      throw error;
    } finally {
      clearTimeout(timer);
      task.controller.signal.removeEventListener("abort", onAbort);
    }
  }

  onUserStartedSpeaking() {
    this.lastInterruptionAt = Date.now();
    for (const task of this.tasks.values()) {
      task.interrupted = true;
    }
    this.sendClient({ type: "barge_in" });
  }

  onUserTranscript(text) {
    if (!this.tasks.size) return;
    if (Date.now() - this.lastInterruptionAt > 12_000) return;

    const intent = classifyInterruption(text);
    if (intent === "cancel") {
      for (const task of this.tasks.values()) {
        task.controller.abort("user_cancelled");
        this.sendStatus(task, "cancelling", {
          message: "Cancelando a execucao em andamento.",
        });
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

export const __private__ = {
  normalizePayload,
  progressStatusMessage,
  taskLabel,
  isTransientError,
};
