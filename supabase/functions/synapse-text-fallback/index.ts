import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  requireEntitlementForUser,
  subscriptionAccessErrorResponse,
} from "../_shared/subscription-access.ts";
import {
  consumeSynapseQuota,
  synapseQuotaErrorResponse,
} from "../_shared/synapse-quota.ts";
import {
  resolveSynapseRequestIdentity,
  synapseRequestAuthErrorResponse,
} from "../_shared/synapse-request-auth.ts";
import { AGENT_TOOLS_V3 } from "./tools-v3.ts";
import {
  executeAgentToolV3,
  executeConfirmedMutationV3,
  type AgentToolContextV3,
} from "./executor-v3.ts";
import { cancelPendingAppointmentPlan } from "./executor.ts";
import {
  formatContextForPrompt,
  loadConversationContext,
  saveConversationContext,
  updateContextFromResult,
  type SynapseConversationState,
} from "./entity-context.ts";
import { invokeSynapseModel } from "./provider.ts";
import { resolveExplicitNeuroIntent } from "./neuro-intent-router.ts";
import {
  deterministicNeuroReadResponse,
  sanitizeSynapseResponse,
  sanitizeSynapseResponseWithWidget,
} from "./response-sanitizer.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type,accept,x-synapse-progress",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
});

type ProgressEvent = {
  stage: string;
  label: string;
  detail?: string;
  toolName?: string;
  recordsFound?: number;
  generatedAt?: string;
};

type ProgressReporter = (event: ProgressEvent) => void;

const STREAM_HEADERS = {
  ...CORS,
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "Connection": "keep-alive",
  "X-Accel-Buffering": "no",
};

const wantsProgressStream = (request: Request) =>
  request.headers.get("Accept")?.includes("text/event-stream") ||
  request.headers.get("X-Synapse-Progress") === "stream";

const sseBlock = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

const progressText = (value: unknown, max = 120) =>
  String(value ?? "")
    .replace(UUID_PATTERN, "")
    .replace(/[{}[\]"]/g, " ")
    .replace(/\b(?:payload|params|tool|endpoint|json|uuid|session_id|clientAction|function_call)\b/gi, "")
    .replace(/\b[a-z]+(?:_[a-z0-9]+){1,}\b/gi, "ação")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const patientFromArgs = (args: Record<string, unknown>) =>
  progressText(args.patient_name || args.patientName || args.patient || args.name_query || args.query, 80);

const toolProgressCopy = (name: string, args: Record<string, unknown>, phase: "started" | "finished", recordsFound?: number): ProgressEvent => {
  const patient = patientFromArgs(args);
  const suffix = typeof recordsFound === "number" ? `${recordsFound} registro${recordsFound === 1 ? "" : "s"} encontrado${recordsFound === 1 ? "" : "s"}` : undefined;
  const patientDetail = patient ? `Paciente: ${patient}` : undefined;

  if (phase === "finished") {
    return {
      stage: "tool_finished",
      toolName: name,
      label: suffix ? `Consulta concluída: ${suffix}` : "Consulta concluída",
      detail: patientDetail,
      recordsFound,
    };
  }

  if (/patient|pacient|prontuario|clinical|history/i.test(name)) {
    return {
      stage: "tool_started",
      toolName: name,
      label: patient ? `Buscando dados de ${patient}` : "Consultando pacientes no sistema",
      detail: "Conferindo cadastro e contexto clínico",
    };
  }
  if (/agenda|calendar|appointment|slot|teleconsultation/i.test(name)) {
    return {
      stage: "tool_started",
      toolName: name,
      label: "Consultando agenda clínica",
      detail: patientDetail || "Verificando horários e atendimentos",
    };
  }
  if (/finance|financial|payment|charge|invoice|transaction|nfse/i.test(name)) {
    return {
      stage: "tool_started",
      toolName: name,
      label: "Conferindo dados financeiros",
      detail: patientDetail || "Verificando lançamentos, cobranças e status",
    };
  }
  if (/note|document|file|task|notion|neuroview|neuroflow|neuropulse/i.test(name)) {
    return {
      stage: "tool_started",
      toolName: name,
      label: "Consultando NeuroDrive",
      detail: patientDetail || "Organizando notas, arquivos e tarefas",
    };
  }
  if (/interface|navigate|open|highlight/i.test(name)) {
    return {
      stage: "tool_started",
      toolName: name,
      label: "Preparando ação visual",
      detail: "Atualizando o painel do Synapse",
    };
  }
  return {
    stage: "tool_started",
    toolName: name,
    label: "Consultando o sistema",
    detail: patientDetail || "Executando ferramenta do Synapse",
  };
};

const CONFIRM = /^\s*(confirmo|sim[,! ]*confirmo|pode executar|pode fazer|autorizo|confirmado|pode prosseguir|prosseguir)\s*[.!]?\s*$/i;
const CANCEL = /^\s*(cancelar|cancele|não confirmo|nao confirmo|desistir|desisto)\s*[.!]?\s*$/i;
const SYSTEM_DATA = /\b(paciente|pacientes|consulta|consultas|agenda|agendamento|horário|horario|prontuário|prontuario|sessão|sessao|financeiro|neurofinance|saldo|receita|despesa|lançamento|lancamento|transação|transacao|nota fiscal|nfs-e|nfse|nota|notas|documento|arquivo|medicação|medicacao|risco|cobrança|cobranca|fatura|pagamento|email|e-mail|lembrete)\b/i;
const MUTATION_INTENT = /\b(crie|criar|cadastre|cadastrar|agende|agendar|remarque|remarcar|cancele|cancelar|envie|enviar|registre|registrar|atualize|atualizar|emita|emitir|cobre|cobrar)\b/i;
const NEURO_NOTES_AGENT_INTENT = /\b(neuroview|neuroflow|neuropulse|fluxograma|diagrama|mermaid|causa e efeito|grafo de notas|padrao|padroes|padrão|padrões)\b/i;
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

type MessageRow = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: unknown;
  created_at: string;
};
type PendingAction = {
  kind: "synapse_pending_action";
  actionId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  summary: string;
  status: "pending" | "executing" | "executed" | "cancelled" | "failed";
  createdAt: string;
  expiresAt: string;
  errorMessage?: string;
  updatedAt?: string;
};
type PendingReference = { row: MessageRow; action: PendingAction; attachments: any[] };

const arrayValue = (value: unknown) => Array.isArray(value) ? value : value && typeof value === "object" ? [value] : [];
const cleanHistory = (value: unknown, max = 2600) => String(value || "")
  .replace(/```json\s+synapse_widget[\s\S]*?```/gi, "[componente visual do Synapse]")
  .replace(UUID_PATTERN, "[identificador interno]")
  .slice(0, max);
const appendWidget = (text: string, structured?: any) => structured
  ? `${text}\n\n\`\`\`json synapse_widget\n${JSON.stringify({ __actionType: structured.type, data: structured.data || structured.payload || {} }, null, 2)}\n\`\`\``
  : text;
const safeUserText = (value: unknown) => sanitizeSynapseResponse(String(value || "").replace(UUID_PATTERN, ""));

function findPending(rows: MessageRow[]): PendingReference | null {
  for (const row of rows) {
    if (row.role !== "assistant") continue;
    const attachments = arrayValue(row.attachments);
    const action = attachments.find((item: any) =>
      item?.kind === "synapse_pending_action" &&
      item?.status === "pending" &&
      new Date(item.expiresAt).getTime() > Date.now()
    );
    if (action) return { row, action, attachments };
  }
  return null;
}

async function updatePending(admin: any, pending: PendingReference, status: PendingAction["status"], errorMessage?: string) {
  const attachments = pending.attachments.map((item: any) =>
    item?.kind === "synapse_pending_action" && item?.actionId === pending.action.actionId
      ? { ...item, status, updatedAt: new Date().toISOString(), ...(errorMessage ? { errorMessage } : {}) }
      : item
  );
  await admin.from("messages").update({ attachments }).eq("id", pending.row.id);
}

type MessageProvenance = {
  source_channel: "panel" | "voice" | "whatsapp";
  source_event_id?: string | null;
  actor_kind: "professional" | "patient" | "synapse" | "system" | "tool";
  idempotency_key?: string | null;
  metadata?: Record<string, unknown>;
};

async function insertMessageWithProvenance(
  admin: any,
  basePayload: Record<string, unknown>,
  provenance: MessageProvenance,
) {
  const { error } = await admin.from("messages").insert({ ...basePayload, ...provenance });
  if (!error) return true;
  if (error.code === "23505") return false;

  // Edge Functions may be deployed before an additive migration is applied.
  // Keep the existing conversation working until the new columns are present.
  if (["42703", "PGRST204"].includes(String(error.code || ""))) {
    const { error: compatibilityError } = await admin.from("messages").insert(basePayload);
    if (!compatibilityError) return true;
    if (compatibilityError.code === "23505") return false;
    throw compatibilityError;
  }

  throw error;
}

async function saveUserMessage(
  admin: any,
  userId: string,
  sessionId: string,
  message: string,
  existingRows: MessageRow[],
  attachments: unknown[],
  provenance: MessageProvenance,
) {
  const latestUser = existingRows.find((row) => row.role === "user");
  if (latestUser?.content === message && Date.now() - new Date(latestUser.created_at).getTime() < 120_000) return;
  await insertMessageWithProvenance(admin, {
    user_id: userId,
    session_id: sessionId,
    role: "user",
    content: message,
    attachments: attachments.length ? attachments : null,
  }, provenance);
}

async function saveAssistantMessage(
  admin: any,
  userId: string,
  sessionId: string,
  content: string,
  attachments: unknown[],
  provenance: MessageProvenance,
) {
  const safeContent = sanitizeSynapseResponseWithWidget(content);
  await insertMessageWithProvenance(admin, {
    user_id: userId,
    session_id: sessionId,
    role: "assistant",
    content: safeContent,
    attachments: attachments.length ? attachments : null,
  }, provenance);
  await admin.from("chat_sessions").update({ updated_at: new Date().toISOString() })
    .eq("id", sessionId).eq("user_id", userId);
}

function groundingRequired(message: string, context: any) {
  if (NEURO_NOTES_AGENT_INTENT.test(message)) return true;
  if (SYSTEM_DATA.test(message) || MUTATION_INTENT.test(message)) return true;
  const route = String(context?.currentContext || context?.route || "").toLowerCase();
  return /(pacient|agenda|finance|nota|document|prontu)/.test(route) &&
    /\b(meu|minha|meus|minhas|tenho|quantos|qual|quais|liste|mostre|consulte|faça|faca)\b/i.test(message);
}

const normalizeIntent = (value: string) =>
  value.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function buildPlannerHint(message: string) {
  const text = normalizeIntent(message);
  if (!text) return "";
  const hasPatientContext = /\b(paciente|pacientes|sobre|dele|dela|do|da|esse|essa)\b/.test(text);
  const wantsSummary = /\b(resuma|resumo|panorama|tudo|geral|sabemos|situacao geral|historico completo)\b/.test(text);
  const wantsTimeline = /\b(linha do tempo|cronologia|historico completo|ultimos acontecimentos|ultimos eventos)\b/.test(text);
  const domains = [
    /\b(prontuario|historico|evolucao|sessao|sessoes|diagnostico|risco)\b/.test(text),
    /\b(agenda|consulta|consultas|agendamento|horario|ultima consulta|proxima consulta)\b/.test(text),
    /\b(financeiro|pagamento|pago|paga|pendente|atrasado|cobranca|cobrancas|neurofinance|receita|lancamento)\b/.test(text),
    /\b(documento|documentos|arquivo|arquivos|nota|notas)\b/.test(text),
  ].filter(Boolean).length;

  if (wantsTimeline && hasPatientContext) {
    return "Pedido composto detectado: use get_patient_timeline para montar uma linha do tempo consolidada do paciente antes de responder.";
  }
  if ((wantsSummary && hasPatientContext) || domains >= 2) {
    return "Pedido composto detectado: use get_patient_system_snapshot quando a pergunta pedir resumo/panorama ou combinar prontuario, agenda, financeiro e documentos de um paciente.";
  }
  if (hasPatientContext && /\b(pagamento|pago|paga|pendente|atrasado|cobranca|cobrancas|neurofinance|inadimplente)\b/.test(text)) {
    return "Pedido financeiro por paciente detectado: use get_patient_payment_status antes de responder.";
  }
  return "";
}

function buildSystemPrompt(context: any, state: SynapseConversationState, memorySummary: string, pending?: PendingAction | null, plannerHint = "") {
  const now = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date());
  const route = String(context?.currentContext || context?.route || "Synapse");

  return [
    "Você é o Synapse, agente operacional central da plataforma NeuroNex para psicólogos.",
    "Responda em português brasileiro natural, direto, profissional e sem jargão desnecessário.",
    `Data e hora de Brasília: ${now}. Tela atual: ${route}.`,
    "Você possui ferramentas reais para pacientes, prontuários, agenda, comunicações, gestão financeira, NeuroFinance e NFS-e.",
    "Para qualquer pergunta sobre dados do sistema, use ferramentas. O histórico da conversa não prova o estado atual do banco.",
    "Nunca invente nomes, horários, valores, saldos, pagamentos, notas fiscais, diagnósticos ou resultados de ações.",
    "Nunca peça IDs, UUIDs ou códigos internos. Quando o profissional citar um nome, resolva a pessoa silenciosamente pelo cadastro e pelo contexto.",
    "Aceite primeiro nome, acentos ausentes, grafias foneticamente próximas e nomes soletrados. Envie patient_name como foi entendido; o resolvedor do servidor escolhe uma correspondência única e só pede esclarecimento quando duas pessoas continuarem plausíveis.",
    "Use search_workspace para fragmentos de nome, assuntos ou informações amplas ainda sem entidade canônica; ela pesquisa o ambiente inteiro e retorna correspondências pontuadas sem substituir a confirmação em ambiguidades reais.",
    "Se houver uma única pessoa ou consulta plausível, prossiga. Só peça esclarecimento quando houver ambiguidade humana real, mostrando nomes ou datas, nunca IDs.",
    "Mantenha referências conversacionais: depois de localizar um paciente, expressões como 'ele', 'ela', 'esse paciente', 'a consulta dele' e 'mande para ela' se referem ao contexto durável, salvo indicação contrária.",
    "Para abrir qualquer aba, subaba ou modal já existente, use request_interface_action com action=navigate e o destination exato do catálogo da ferramenta. Use patient_name nos destinos patient.* e localize a consulta antes dos destinos teleconsultation.*. Nunca componha URLs por conta própria.",
    "Ações que alteram dados, enviam mensagens, criam cobranças ou emitem NFS-e exigem uma confirmação separada. Prepare a ação e aguarde 'Confirmo'.",
    "Para agenda, você pode consultar horários, localizar vagas, criar, remarcar, cancelar e enviar lembretes por e-mail.",
    "Para NeuroFinance, diferencie gestão manual de dinheiro real. Consulte primeiro o status da conta. Se ela não existir ou estiver pendente, explique o estágio correto e não invente saldo.",
    "Para NFS-e, consulte dados reais. Uma solicitação de emissão não significa autorização municipal; descreva como solicitada, agendada ou em processamento até haver confirmação.",
    "Para NeuroView, NeuroFlow e NeuroPulse dentro da Notas Desktop, use as ferramentas especializadas: analise padrões no NeuroView, gere fluxos pelo histórico no NeuroFlow e crie diagramas causa-efeito no NeuroPulse. Não responda esses pedidos apenas com texto solto.",
    "Depois de uma análise no NeuroView, use request_interface_action com open_neuroview_reasoning para continuar na mesma superfície. Em 3D, patient ressalta o paciente e suas notas como hover; neuroview_node_ids pode conter uma nota, várias notas ou uma tag; all mantém o panorama ressaltado e subgraph isola o grupo.",
    "Use neuroview_focus_node_id apenas com um ID recebido de ferramenta para mover a câmera sem desfazer o grupo. Nunca invente nem revele IDs; faça a mudança visual no ponto correspondente da explicação e preserve o contexto entre ações sucessivas.",
    "Nunca exponha rotas, URLs internas, JSON, SQL, nomes de tabelas, provedores de infraestrutura ou identificadores internos.",
    "Não narre ferramentas nem raciocínio interno. Execute silenciosamente e entregue apenas o resultado útil.",
    `CONTEXTO DURÁVEL:\n${formatContextForPrompt(state)}`,
    plannerHint ? `PLANO OPERACIONAL INTERNO:\n${plannerHint}` : "",
    memorySummary ? `RESUMO ANTERIOR DA CONVERSA:\n${memorySummary}` : "",
    context?.summary ? `CONTEXTO VISUAL INFORMADO PELO APLICATIVO:\n${cleanHistory(context.summary, 1200)}` : "",
    pending ? `AÇÃO AGUARDANDO CONFIRMAÇÃO: ${pending.summary}` : "",
  ].filter(Boolean).join("\n\n");
}

async function seedContextFromFrontend(admin: any, userId: string, state: SynapseConversationState, context: any) {
  const patientId = String(context?.activePatientId || context?.patientId || "").trim();
  if (!patientId) return state;
  const { data } = await admin.from("patients").select("id,name").eq("id", patientId).eq("user_id", userId).maybeSingle();
  if (!data) return state;
  return { ...state, activePatientId: data.id, activePatientName: data.name, updatedAt: new Date().toISOString() };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return reply({ error: "Método não permitido." }, 405);

  const streamMode = wantsProgressStream(request);
  const encoder = new TextEncoder();
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
  const emitSse = (event: string, data: unknown) => {
    streamController?.enqueue(encoder.encode(sseBlock(event, data)));
  };
  const progress: ProgressReporter = (event) => {
    if (!streamMode) return;
    emitSse("progress", { ...event, generatedAt: new Date().toISOString() });
  };

  const run = async () => {
  try {
    const authorization = request.headers.get("Authorization") || "";
    const body = await request.json();
    const message = String(body.message || "").trim();
    const sessionId = String(body.sessionId || body.session_id || "").trim();
    const context = body.context || {};
    const inputAttachments = Array.isArray(body.attachments) ? body.attachments : [];
    if (!message || !sessionId) return reply({ error: "Mensagem ou conversa ausente." }, 400);
    progress({
      stage: "validation",
      label: "Validando conversa",
      detail: "Conferindo sessão, permissões e contexto",
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const identity = await resolveSynapseRequestIdentity({
      request,
      body,
      userClient,
      admin,
      expectedInternalSecret: Deno.env.get("SYNAPSE_INTERNAL_SECRET") || "",
    });
    const user = identity.user;
    await requireEntitlementForUser(
      {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
      },
      "ai_copilot",
    );
    const { data: session, error: sessionError } = await admin
      .from("chat_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (sessionError || !session) return reply({ error: "Conversa não encontrada." }, 404);

    const sourceRequestId = String(
      body.requestId ||
      body.request_id ||
      (body.source && typeof body.source === "object"
        ? (body.source as Record<string, unknown>).source_message_id
        : "") ||
      crypto.randomUUID(),
    ).trim();
    await consumeSynapseQuota(admin, user.id, `synapse-text:${sessionId}:${sourceRequestId}`);
    progress({
      stage: "authorization",
      label: "Acesso confirmado",
      detail: "Quota e plano do Synapse validados",
    });

    const { data: historyData, error: historyError } = await admin
      .from("messages")
      .select("id,role,content,attachments,created_at")
      .eq("user_id", user.id)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (historyError) throw historyError;
    const rows = (historyData || []) as MessageRow[];
    const pending = findPending(rows);
    const requestedPlanConfirmation = body.appointmentPlanConfirmation && typeof body.appointmentPlanConfirmation === "object"
      ? body.appointmentPlanConfirmation as Record<string, unknown>
      : null;
    if (requestedPlanConfirmation) {
      const pendingArguments = pending?.action.arguments || {};
      const requestedPlanId = String(requestedPlanConfirmation.planId || "");
      const requestedPlanVersion = Number(requestedPlanConfirmation.planVersion);
      const requestedPlanHash = String(requestedPlanConfirmation.planHash || "").toLowerCase();
      if (
        !pending ||
        String(pendingArguments.plan_id || "") !== requestedPlanId ||
        Number(pendingArguments.plan_version) !== requestedPlanVersion ||
        String(pendingArguments.plan_hash || "").toLowerCase() !== requestedPlanHash
      ) {
        return reply({ error: "O plano não pertence a esta conversa ou não é mais a versão pendente." }, 409);
      }
    }
    const loadedContext = await loadConversationContext(admin, user.id, sessionId);
    let conversationState = await seedContextFromFrontend(admin, user.id, loadedContext.state, context);
    const source = body.source && typeof body.source === "object"
      ? body.source as Record<string, unknown>
      : {};
    const sourceEventId = String(source.source_message_id || "").trim() || null;
    const conversationKind = String(context?.conversationKind || source.conversation_kind || "");
    const provenanceMetadata = {
      message_type: String(source.message_type || "text"),
      conversation_kind: conversationKind || null,
    };
    const userProvenance: MessageProvenance = {
      source_channel: identity.channel,
      source_event_id: sourceEventId,
      actor_kind: identity.channel === "whatsapp" && conversationKind === "patient"
        ? "patient"
        : "professional",
      idempotency_key: sourceEventId ? `synapse:${sessionId}:${sourceEventId}:user` : null,
      metadata: provenanceMetadata,
    };
    const assistantProvenance: MessageProvenance = {
      source_channel: identity.channel,
      source_event_id: sourceEventId ? `synapse:${sourceEventId}:assistant` : null,
      actor_kind: "synapse",
      idempotency_key: sourceEventId ? `synapse:${sessionId}:${sourceEventId}:assistant` : null,
      metadata: provenanceMetadata,
    };
    progress({
      stage: "context",
      label: "Carregando memória da conversa",
      detail: pending ? "Há uma ação aguardando confirmação" : "Lendo histórico recente e contexto durável",
    });

    await saveUserMessage(admin, user.id, sessionId, message, rows, inputAttachments, userProvenance);
    progress({
      stage: "message_saved",
      label: "Solicitação registrada",
      detail: "Preparando o raciocínio operacional",
    });

    const toolContext: AgentToolContextV3 = {
      admin,
      userId: user.id,
      sessionId,
      authorization,
      requestOrigin: request.headers.get("origin") || context?.origin || null,
      userClient: identity.userClient || undefined,
      channel: identity.channel,
      correlationId: sourceRequestId,
    };

    if (pending && CANCEL.test(message)) {
      progress({
        stage: "pending_cancel",
        label: "Cancelando ação pendente",
        detail: progressText(pending.action.summary, 160) || "Nenhuma alteração será realizada",
      });
      await cancelPendingAppointmentPlan(pending.action, toolContext);
      await updatePending(admin, pending, "cancelled");
      const response = "A ação pendente foi cancelada. Nenhuma alteração foi realizada.";
      await saveAssistantMessage(admin, user.id, sessionId, response, [{
        kind: "synapse_grounding",
        provider: "system",
        grounded: true,
        toolsUsed: [],
        generatedAt: new Date().toISOString(),
      }], assistantProvenance);
      return reply({ response, clientAction: null, session_id: sessionId, provider: "system", grounded: true });
    }

    if (pending && CONFIRM.test(message)) {
      progress({
        stage: "pending_confirm",
        label: "Executando ação confirmada",
        detail: progressText(pending.action.summary, 160),
      });
      await updatePending(admin, pending, "executing");
      const executionContext = requestedPlanConfirmation
        ? { ...toolContext, channel: "professional_app" as any }
        : toolContext;
      const result = await executeConfirmedMutationV3(pending.action, executionContext);
      await updatePending(admin, pending, result.ok ? "executed" : "failed", result.error);
      conversationState = updateContextFromResult(conversationState, pending.action.toolName, pending.action.arguments, result);
      await saveConversationContext(admin, user.id, sessionId, conversationState);
      const response = appendWidget(
        safeUserText(
          result.ok
            ? (result.message || "Ação concluída.")
            : `Não consegui executar: ${result.error || "erro desconhecido"}.`,
        ),
        result.structuredData,
      );
      await saveAssistantMessage(admin, user.id, sessionId, response, [{
        kind: "synapse_grounding",
        provider: "system",
        grounded: result.grounded,
        toolsUsed: [pending.action.toolName],
        recordsFound: result.recordCount || 0,
        generatedAt: new Date().toISOString(),
      }], assistantProvenance);
      return reply({
        response,
        clientAction: result.clientAction || null,
        session_id: sessionId,
        provider: "system",
        model: "confirmed_action_executor",
        grounded: result.grounded,
        toolsUsed: [pending.action.toolName],
        recordsFound: result.recordCount || 0,
      });
    }

    if (!pending && CONFIRM.test(message)) {
      progress({
        stage: "pending_missing",
        label: "Verificando confirmação",
        detail: "Nenhuma ação pendente foi encontrada",
      });
      const response = "Não há nenhuma ação pendente para confirmar.";
      await saveAssistantMessage(admin, user.id, sessionId, response, [], assistantProvenance);
      return reply({ response, clientAction: null, session_id: sessionId, provider: "system", grounded: true });
    }

    const chronological = [...rows].reverse();
    const plannerHint = buildPlannerHint(message);
    const explicitNeuroIntent = resolveExplicitNeuroIntent(message);
    const systemPrompt = buildSystemPrompt(context, conversationState, loadedContext.memorySummary, pending?.action || null, plannerHint);
    const modelMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...chronological.slice(-24).map((row) => ({
        role: row.role === "assistant" ? "assistant" : row.role === "system" ? "system" : "user",
        content: cleanHistory(row.content),
      })),
      { role: "user", content: message },
    ];

    const mustGround = groundingRequired(message, context) || Boolean(plannerHint);
    const records: Array<{ name: string; result: any }> = [];
    let finalText = "";
    let structured: any = null;
    let clientAction: any = null;
    let pendingAction: PendingAction | null = null;
    let selectedProvider = "nvidia";
    let selectedModel = Deno.env.get("NVIDIA_SYNAPSE_MODEL") || "nvidia/nemotron-3-ultra-550b-a55b";

    outer: for (let step = 0; step < 7; step += 1) {
      progress({
        stage: step === 0 ? "planning" : "reasoning",
        label: step === 0 ? "Interpretando solicitação" : "Combinando resultados consultados",
        detail: mustGround ? "Selecionando consultas reais do sistema" : "Preparando resposta com o contexto disponível",
      });
      const forcedCall = step === 0 && explicitNeuroIntent
        ? {
          id: `synapse-neuro-${crypto.randomUUID()}`,
          type: "function",
          function: {
            name: explicitNeuroIntent.toolName,
            arguments: JSON.stringify(explicitNeuroIntent.arguments),
          },
        }
        : null;
      const modelResult = forcedCall ? null : await invokeSynapseModel({
          messages: modelMessages,
          tools: AGENT_TOOLS_V3,
          toolChoice: step === 0 && mustGround ? "required" : "auto",
          temperature: 0.12,
          maxTokens: 2400,
        });
      if (modelResult) {
        selectedProvider = modelResult.provider;
        selectedModel = modelResult.model;
      }
      const assistant = forcedCall
        ? { content: null, tool_calls: [forcedCall] }
        : modelResult?.data?.choices?.[0]?.message;
      if (!assistant) throw new Error("Resposta inválida do agente.");
      const calls = Array.isArray(assistant.tool_calls) ? assistant.tool_calls : [];

      if (!calls.length) {
        finalText = String(assistant.content || assistant.reasoning_content || "").trim();
        break;
      }

      progress({
        stage: "tools_selected",
        label: calls.length === 1 ? "Consulta selecionada" : `${calls.length} consultas selecionadas`,
        detail: calls.length === 1
          ? "Preparando consulta real do sistema"
          : "Preparando consultas reais em sequencia",
      });

      modelMessages.push({
        role: "assistant",
        content: assistant.content || null,
        tool_calls: calls,
      });

      for (const call of calls) {
        const name = String(call?.function?.name || "");
        let args: Record<string, any> = {};
        try {
          args = JSON.parse(call?.function?.arguments || "{}");
        } catch {
          args = {};
        }
        progress(toolProgressCopy(name, args, "started"));
        const execution = await executeAgentToolV3(
          name,
          args,
          { ...toolContext, toolCallId: String(call.id || "").trim().slice(0, 120) || null },
          conversationState,
        );
        progress(toolProgressCopy(name, args, "finished", Number(execution.result.recordCount || 0)));
        conversationState = execution.state;
        records.push({ name, result: execution.result });
        if (execution.result.structuredData) structured = execution.result.structuredData;
        if (execution.result.clientAction) clientAction = execution.result.clientAction;
        if (execution.result.pendingAction) pendingAction = execution.result.pendingAction as PendingAction;
        const deterministicRead = forcedCall
          ? deterministicNeuroReadResponse(name, execution.result)
          : null;
        if (deterministicRead) {
          finalText = deterministicRead;
          break outer;
        }
        modelMessages.push({
          role: "tool",
          tool_call_id: call.id,
          name,
          content: JSON.stringify(execution.result.ok
            ? (execution.result.data || { success: true })
            : { error: execution.result.error, details: execution.result.data || null }),
        });
        if (pendingAction) break outer;
      }
    }

    await saveConversationContext(admin, user.id, sessionId, conversationState);

    if (pendingAction) {
      progress({
        stage: "confirmation_required",
        label: "Confirmação necessária",
        detail: progressText(pendingAction.summary, 180),
      });
      const response = appendWidget(
        `Antes de executar, preciso da sua confirmação:\n\n**${pendingAction.summary}**\n\nResponda **“Confirmo”** para prosseguir ou **“Cancelar”** para desistir.`,
        { type: "confirmation_required", data: { actionId: pendingAction.actionId, summary: pendingAction.summary } },
      );
      await saveAssistantMessage(admin, user.id, sessionId, response, [
        pendingAction,
        {
          kind: "synapse_grounding",
          provider: selectedProvider,
          model: selectedModel,
          grounded: false,
          toolsUsed: records.map((item) => item.name),
          generatedAt: new Date().toISOString(),
        },
      ], assistantProvenance);
      return reply({
        response,
        clientAction: null,
        session_id: sessionId,
        provider: selectedProvider,
        model: selectedModel,
        fallback: selectedProvider !== "nvidia",
        grounded: false,
        confirmationRequired: true,
        toolsUsed: records.map((item) => item.name),
      });
    }

    const groundedSuccess = records.some((item) => item.result.ok && item.result.grounded);
    const groundedFailure = [...records].reverse().find((item) => !item.result.ok && item.result.grounded);
    let response = safeUserText(finalText);

    if (!response && groundedFailure) {
      response = safeUserText(groundedFailure.result.error || "Não consegui concluir a consulta.");
    }
    if (!response && groundedSuccess) response = "Consulta concluída com os dados disponíveis no NeuroNex.";
    if (!response && clientAction) response = clientAction.data?.reason || "A ação foi preparada na interface.";
    if (!response && mustGround) response = "Não consegui obter dados confirmados do sistema agora. Não vou estimar nem inventar uma resposta.";
    if (!response) response = "Não consegui concluir a resposta agora.";
    if (structured && structured.type !== "confirmation_required") response = appendWidget(response, structured);

    const isGrounded = groundedSuccess || Boolean(clientAction);
    const toolsUsed = records.map((item) => item.name);
    const recordsFound = records.reduce((total, item) => total + Number(item.result.recordCount || 0), 0);
    progress({
      stage: "finalizing",
      label: "Preparando resposta final",
      detail: toolsUsed.length
        ? `${toolsUsed.length} consulta${toolsUsed.length === 1 ? "" : "s"} consolidada${toolsUsed.length === 1 ? "" : "s"}`
        : "Finalizando texto do Synapse",
      recordsFound,
    });
    await saveAssistantMessage(admin, user.id, sessionId, response, [{
      kind: "synapse_grounding",
      provider: selectedProvider,
      model: selectedModel,
      grounded: isGrounded,
      toolsUsed,
      recordsFound,
      generatedAt: new Date().toISOString(),
    }], assistantProvenance);

    return reply({
      response,
      clientAction,
      session_id: sessionId,
      provider: selectedProvider,
      model: selectedModel,
      fallback: selectedProvider !== "nvidia",
      grounded: isGrounded,
      toolsUsed,
      recordsFound,
    });
  } catch (error) {
    const authResponse = synapseRequestAuthErrorResponse(error, CORS);
    if (authResponse) return authResponse;

    const quotaResponse = synapseQuotaErrorResponse(error, CORS);
    if (quotaResponse) return quotaResponse;

    const accessResponse = subscriptionAccessErrorResponse(error);
    if (accessResponse) return accessResponse;

    console.error("[synapse-text-agent]", error);
    return reply({
      error: safeUserText(error instanceof Error ? error.message : "Falha no agente Synapse."),
    }, 500);
  }
  };

  if (!streamMode) return run();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
      progress({
        stage: "received",
        label: "Preparando solicitação",
        detail: "Iniciando processamento em tempo real",
      });

      run()
        .then(async (response) => {
          const raw = await response.text();
          let payload: any = null;
          try {
            payload = JSON.parse(raw);
          } catch {
            payload = { error: raw || "Resposta inválida do Synapse." };
          }

          if (response.status >= 400 || payload?.error) {
            emitSse("error", {
              error: payload?.error || "Falha ao processar a solicitação.",
              status: response.status,
            });
            return;
          }

          emitSse("final", payload);
        })
        .catch((error) => {
          console.error("[synapse-text-agent:stream]", error);
          emitSse("error", {
            error: error instanceof Error ? error.message : "Falha no agente Synapse.",
          });
        })
        .finally(() => {
          streamController = null;
          controller.close();
        });
    },
    cancel() {
      streamController = null;
    },
  });

  return new Response(stream, { headers: STREAM_HEADERS });
});
