import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  requireEntitlementForUser,
  subscriptionAccessErrorResponse,
} from "../_shared/subscription-access.ts";
import {
  consumeSynapseQuota,
  synapseQuotaErrorResponse,
} from "../_shared/synapse-quota.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.1-8b-instant";
const DEFAULT_FALLBACK_MODEL = "llama-3.3-70b-versatile";

const jsonResponse = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const compact = (value: unknown, max = 900) => {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  const clean = text.replace(/```json\s+synapse_widget[\s\S]*?```/gi, "[widget]").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}...` : clean;
};

const buildUserAddressingInstruction = (profile: any, userName: string) => {
  switch (profile?.gender_identity) {
    case "female":
      return `Tratamento do usuário: use linguagem natural no feminino quando se referir a ${userName}.`;
    case "male":
      return `Tratamento do usuário: use linguagem natural no masculino quando se referir a ${userName}.`;
    case "non_binary":
    case "prefer_not_to_say":
      return `Tratamento do usuário: prefira chamar por ${userName} e evite marcar gênero quando não for necessário.`;
    default:
      return `Tratamento do usuário: prefira chamar por ${userName} e mantenha linguagem neutra quando possível.`;
  }
};

const tools = [
  {
    type: "function",
    function: {
      name: "list_patients",
      description: "Lista pacientes recentes do profissional.",
      parameters: { type: "object", properties: { limit: { type: "number" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "search_patients",
      description: "Busca pacientes por nome.",
      parameters: {
        type: "object",
        properties: { name_query: { type: "string" } },
        required: ["name_query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_patient_details",
      description: "Retorna dados clínicos essenciais de um paciente específico.",
      parameters: {
        type: "object",
        properties: { patientId: { type: "string" } },
        required: ["patientId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_clinical_history",
      description: "Busca notas e resumos clínicos recentes de um paciente.",
      parameters: {
        type: "object",
        properties: {
          patientId: { type: "string" },
          keywords: { type: "string" },
          limit: { type: "number" },
        },
        required: ["patientId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_calendar",
      description: "Consulta compromissos em um período.",
      parameters: {
        type: "object",
        properties: {
          startDate: { type: "string", description: "YYYY-MM-DD" },
          endDate: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["startDate", "endDate"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_available_slots",
      description: "Encontra horários livres na agenda.",
      parameters: {
        type: "object",
        properties: {
          startDate: { type: "string" },
          endDate: { type: "string" },
          duration: { type: "number" },
          preferredTime: { type: "string", enum: ["morning", "afternoon", "evening"] },
        },
        required: ["startDate"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_appointment",
      description: "Cria uma consulta. Só execute após confirmação explícita do usuário.",
      parameters: {
        type: "object",
        properties: {
          patientId: { type: "string" },
          datetime: { type: "string" },
          duration: { type: "number" },
          type: { type: "string", enum: ["presencial", "online", "block"] },
          notes: { type: "string" },
          confirmed: { type: "boolean" },
        },
        required: ["datetime", "confirmed"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reschedule_appointment",
      description: "Remarca uma consulta. Só execute após confirmação explícita do usuário.",
      parameters: {
        type: "object",
        properties: {
          appointmentId: { type: "string" },
          newDatetime: { type: "string" },
          newDuration: { type: "number" },
          confirmed: { type: "boolean" },
        },
        required: ["appointmentId", "newDatetime", "confirmed"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_appointment",
      description: "Cancela uma consulta. Só execute após confirmação explícita do usuário.",
      parameters: {
        type: "object",
        properties: {
          appointmentId: { type: "string" },
          reason: { type: "string" },
          confirmed: { type: "boolean" },
        },
        required: ["appointmentId", "confirmed"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_financial_metrics",
      description: "Consulta resumo financeiro do mês atual.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_transactions",
      description: "Lista lançamentos financeiros recentes.",
      parameters: { type: "object", properties: { limit: { type: "number" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "create_transaction",
      description: "Registra receita ou despesa. Só execute após confirmação explícita do usuário.",
      parameters: {
        type: "object",
        properties: {
          description: { type: "string" },
          amount: { type: "number" },
          type: { type: "string", enum: ["income", "expense"] },
          category: { type: "string" },
          patientId: { type: "string" },
          date: { type: "string" },
          confirmed: { type: "boolean" },
        },
        required: ["description", "amount", "type", "confirmed"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_session_note",
      description: "Registra anotação clínica para um paciente. Só execute após confirmação explícita do usuário.",
      parameters: {
        type: "object",
        properties: {
          patientId: { type: "string" },
          notes: { type: "string" },
          appointmentId: { type: "string" },
          confirmed: { type: "boolean" },
        },
        required: ["patientId", "notes", "confirmed"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "navigate_system",
      description: "Prepara navegação para uma tela do sistema.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" }, reason: { type: "string" } },
        required: ["path"],
      },
    },
  },
];

const toBrazilIso = (value: string) => {
  const withTime = value.includes("T") ? value : `${value}T00:00:00`;
  const normalized = /Z$|[+-]\d{2}:\d{2}$|[+-]\d{4}$/.test(withTime) ? withTime : `${withTime}-03:00`;
  return new Date(normalized).toISOString();
};

async function executeTool(name: string, args: any, ctx: any) {
  const { db, userId } = ctx;
  let structuredData: any = null;

  switch (name) {
    case "list_patients": {
      const { data, error } = await db.from("patients")
        .select("id,name,diagnosis,status,risk_score,birth_date")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(Math.min(Number(args.limit || 10), 20));
      if (error) throw error;
      structuredData = data?.length ? { type: "patient_list_widget", data: { patients: data } } : null;
      return { result: { patients: data || [] }, structuredData };
    }

    case "search_patients": {
      const q = String(args.name_query || "").trim().replace(/[,%()]/g, "");
      const { data, error } = await db.from("patients")
        .select("id,name,diagnosis,status,risk_score,birth_date")
        .eq("user_id", userId)
        .ilike("name", `%${q}%`)
        .limit(10);
      if (error) throw error;
      structuredData = data?.length === 1
        ? { type: "patient_card", data: data[0] }
        : data?.length ? { type: "patient_list_widget", data: { patients: data } } : null;
      return { result: { found: data || [] }, structuredData };
    }

    case "get_patient_details": {
      const { data, error } = await db.from("patients")
        .select("id,name,diagnosis,status,risk_score,birth_date,medications,notes")
        .eq("id", args.patientId)
        .eq("user_id", userId)
        .single();
      if (error) throw error;
      structuredData = { type: "patient_card", data };
      return { result: { patient: data }, structuredData };
    }

    case "search_clinical_history": {
      let query = db.from("session_notes")
        .select("notes,ai_summary,created_at,appointment_id")
        .eq("patient_id", args.patientId)
        .order("created_at", { ascending: false })
        .limit(Math.min(Number(args.limit || 5), 10));
      if (args.keywords) query = query.ilike("notes", `%${String(args.keywords).replace(/[,%()]/g, "")}%`);
      const { data, error } = await query;
      if (error) throw error;
      const safe = (data || []).map((item: any) => ({
        date: item.created_at,
        summary: item.ai_summary?.summary || compact(item.notes, 500),
      }));
      structuredData = safe.length ? { type: "clinical_history_widget", data: { notes: data } } : null;
      return { result: { notes: safe }, structuredData };
    }

    case "get_calendar": {
      const start = toBrazilIso(`${args.startDate}T00:00:00`);
      const end = toBrazilIso(`${args.endDate}T23:59:59`);
      const { data, error } = await db.from("appointments")
        .select("id,start_time,end_time,type,status,notes,patient_id,patient:patient_id(name)")
        .eq("user_id", userId)
        .gte("start_time", start)
        .lte("start_time", end)
        .order("start_time");
      if (error) throw error;
      const fmt = (iso: string) => new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short",
      }).format(new Date(iso));
      const appointments = (data || []).map((a: any) => ({
        id: a.id,
        patient_name: a.patient?.name || "Bloqueio",
        start: fmt(a.start_time),
        end: fmt(a.end_time),
        type: a.type,
        status: a.status,
        notes: a.notes,
      }));
      structuredData = appointments.length ? { type: "calendar_widget", data: { title: "Agenda", appointments } } : null;
      return { result: { appointments }, structuredData };
    }

    case "find_available_slots": {
      const duration = Number(args.duration || 50);
      const startDate = String(args.startDate);
      const endDate = String(args.endDate || args.startDate);
      const { data: appointments, error } = await db.from("appointments")
        .select("start_time,end_time")
        .eq("user_id", userId)
        .neq("status", "cancelled")
        .gte("start_time", toBrazilIso(`${startDate}T00:00:00`))
        .lte("start_time", toBrazilIso(`${endDate}T23:59:59`));
      if (error) throw error;
      const slots: any[] = [];
      const cursor = new Date(`${startDate}T00:00:00-03:00`);
      const end = new Date(`${endDate}T23:59:59-03:00`);
      while (cursor <= end && slots.length < 10) {
        const day = cursor.getDay();
        const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(cursor);
        if (day !== 0 && day !== 6) {
          for (let hour = 8; hour < 20 && slots.length < 10; hour += 1) {
            if (hour === 12) continue;
            if (args.preferredTime === "morning" && hour >= 12) continue;
            if (args.preferredTime === "afternoon" && (hour < 12 || hour >= 18)) continue;
            if (args.preferredTime === "evening" && hour < 18) continue;
            for (const minute of [0, 30]) {
              const start = new Date(`${dateStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-03:00`);
              const finish = new Date(start.getTime() + duration * 60000);
              if (start < new Date()) continue;
              const conflict = (appointments || []).some((a: any) => start < new Date(a.end_time) && finish > new Date(a.start_time));
              if (!conflict) slots.push({ date: dateStr, time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`, datetime: start.toISOString() });
              if (slots.length >= 10) break;
            }
          }
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      structuredData = slots.length ? { type: "available_slots_list", data: { slots } } : null;
      return { result: { available_slots: slots }, structuredData };
    }

    case "create_appointment": {
      if (!args.confirmed) return { result: { confirmation_required: true, message: "Confirme os dados antes de agendar." }, structuredData: null };
      const start = toBrazilIso(args.datetime);
      const end = new Date(new Date(start).getTime() + Number(args.duration || 50) * 60000).toISOString();
      const { data, error } = await db.from("appointments").insert({
        user_id: userId,
        patient_id: args.patientId || null,
        start_time: start,
        end_time: end,
        type: args.type || "presencial",
        notes: args.notes || null,
        status: "confirmed",
      }).select("id,start_time,end_time,type,status,patient:patient_id(name)").single();
      if (error) throw error;
      structuredData = { type: "appointment_card", data };
      return { result: { success: true, appointment: data }, structuredData };
    }

    case "reschedule_appointment": {
      if (!args.confirmed) return { result: { confirmation_required: true, message: "Confirme a remarcação." }, structuredData: null };
      const { data: current, error: fetchError } = await db.from("appointments")
        .select("id,start_time,end_time,patient:patient_id(name)")
        .eq("id", args.appointmentId)
        .eq("user_id", userId)
        .single();
      if (fetchError) throw fetchError;
      const duration = Number(args.newDuration || ((new Date(current.end_time).getTime() - new Date(current.start_time).getTime()) / 60000));
      const start = toBrazilIso(args.newDatetime);
      const end = new Date(new Date(start).getTime() + duration * 60000).toISOString();
      const { error } = await db.from("appointments").update({ start_time: start, end_time: end, status: "confirmed" })
        .eq("id", args.appointmentId).eq("user_id", userId);
      if (error) throw error;
      structuredData = { type: "appointment_rescheduled", data: { appointmentId: args.appointmentId, newDatetime: start, patientName: current.patient?.name } };
      return { result: { success: true, newDatetime: start }, structuredData };
    }

    case "cancel_appointment": {
      if (!args.confirmed) return { result: { confirmation_required: true, message: "Confirme o cancelamento." }, structuredData: null };
      const { data: current, error: fetchError } = await db.from("appointments")
        .select("id,start_time,notes,patient:patient_id(name)")
        .eq("id", args.appointmentId)
        .eq("user_id", userId)
        .single();
      if (fetchError) throw fetchError;
      const notes = `${current.notes || ""}${current.notes ? "\n" : ""}[Cancelado: ${args.reason || "Sem motivo informado"}]`;
      const { error } = await db.from("appointments").update({ status: "cancelled", notes })
        .eq("id", args.appointmentId).eq("user_id", userId);
      if (error) throw error;
      structuredData = { type: "appointment_cancelled", data: { appointmentId: args.appointmentId, patientName: current.patient?.name, originalTime: current.start_time } };
      return { result: { success: true }, structuredData };
    }

    case "get_financial_metrics": {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
      const { data, error } = await db.rpc("get_financial_metrics", { p_user_id: userId, p_start_date: start, p_end_date: end });
      if (error) throw error;
      structuredData = { type: "financial_summary_widget", data: { metrics: data } };
      return { result: { metrics: data }, structuredData };
    }

    case "list_transactions": {
      const { data, error } = await db.from("financial_entries")
        .select("id,title,description,amount,type,status,due_date,paid_at,metadata")
        .eq("professional_id", userId)
        .order("created_at", { ascending: false })
        .limit(Math.min(Number(args.limit || 10), 20));
      if (error) throw error;
      structuredData = { type: "interactive_table", data: { title: "Últimos lançamentos", transactions: data || [] } };
      return { result: { transactions: data || [] }, structuredData };
    }

    case "create_transaction": {
      if (!args.confirmed) return { result: { confirmation_required: true, message: "Confirme o lançamento financeiro." }, structuredData: null };
      const date = args.date || new Date().toISOString().slice(0, 10);
      const { data, error } = await db.from("financial_entries").insert({
        professional_id: userId,
        title: args.description,
        description: args.description,
        amount: Math.abs(Number(args.amount)),
        type: args.type,
        patient_id: args.patientId || null,
        due_date: date,
        competence_date: date,
        paid_at: `${date}T12:00:00.000Z`,
        status: "paid",
        payment_method: "manual",
        origin: "manual",
        metadata: { category: args.category || "Outros", source: "synapse_voice" },
      }).select("id,title,amount,type,status,due_date").single();
      if (error) throw error;
      structuredData = { type: "transaction_created", data: { transaction: data } };
      return { result: { success: true, transaction: data }, structuredData };
    }

    case "create_session_note": {
      if (!args.confirmed) return { result: { confirmation_required: true, message: "Confirme antes de registrar a anotação." }, structuredData: null };
      const { data: patient, error: patientError } = await db.from("patients").select("name").eq("id", args.patientId).eq("user_id", userId).single();
      if (patientError) throw patientError;
      const { data, error } = await db.from("session_notes").insert({
        user_id: userId,
        patient_id: args.patientId,
        appointment_id: args.appointmentId || null,
        notes: args.notes,
      }).select("id,created_at").single();
      if (error) throw error;
      structuredData = { type: "session_note_created", data: { patientName: patient.name, notes: args.notes, noteId: data.id } };
      return { result: { success: true, patientName: patient.name }, structuredData };
    }

    case "navigate_system": {
      structuredData = { type: "navigation_action", data: { path: args.path, reason: args.reason } };
      return { result: { success: true, navigatedTo: args.path }, structuredData };
    }

    default:
      return { result: { error: `Ferramenta não suportada: ${name}` }, structuredData: null };
  }
}

async function callGroq(apiKey: string, model: string, messages: any[]) {
  return fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.25,
      max_completion_tokens: 900,
    }),
  });
}

async function completeWithFallback(apiKey: string, messages: any[]) {
  const primary = Deno.env.get("GROQ_CHAT_MODEL") || DEFAULT_MODEL;
  const fallback = Deno.env.get("GROQ_FALLBACK_MODEL") || DEFAULT_FALLBACK_MODEL;
  let model = primary;
  let response = await callGroq(apiKey, primary, messages);
  if (!response.ok && fallback !== primary) {
    console.warn("[synapse-voice-turn] primary model failed", response.status);
    model = fallback;
    response = await callGroq(apiKey, fallback, messages);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || `Groq HTTP ${response.status}`);
  return { payload, model };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Token ausente" }, 401);

    const groqKey = Deno.env.get("GROQ_API_KEY");
    if (!groqKey) return jsonResponse({ error: "GROQ_API_KEY não configurada" }, 503);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const db = createClient(supabaseUrl, serviceRole);

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return jsonResponse({ error: "Token inválido" }, 401);
    const user = authData.user;

    const payload = await req.json().catch(() => ({}));
    const message = typeof payload.message === "string" ? payload.message.trim() : "";
    if (!message) return jsonResponse({ error: "Mensagem ausente" }, 400);
    if (message.length > 12000) return jsonResponse({ error: "Mensagem excede o limite" }, 413);

    let sessionId = payload.sessionId || payload.session_id || null;
    if (sessionId) {
      const { data: session } = await db.from("chat_sessions").select("id").eq("id", sessionId).eq("user_id", user.id).maybeSingle();
      if (!session) return jsonResponse({ error: "Sessão não encontrada" }, 404);
    } else {
      const { data: created, error } = await db.from("chat_sessions").insert({ user_id: user.id, title: "Conversa por voz" }).select("id").single();
      if (error || !created) throw error || new Error("Falha ao criar sessão");
      sessionId = created.id;
    }

    await requireEntitlementForUser(
      {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
      },
      "ai_copilot",
    );
    await consumeSynapseQuota(db, user.id, 15);

    const { data: profile } = await db.from("profiles").select("first_name,gender_identity,ai_preferences").eq("id", user.id).maybeSingle();
    const { data: history } = await db.from("messages")
      .select("content,role")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    const { data: recent } = await db.from("messages")
      .select("content,role,created_at,session_id")
      .eq("user_id", user.id)
      .neq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(8);

    await db.from("messages").insert({ user_id: user.id, session_id: sessionId, role: "user", content: message });

    let now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const userName = profile?.first_name || "Profissional";
    const addressingInstruction = buildUserAddressingInstruction(profile, userName);
    now = `${now}. ${addressingInstruction}`;
    const memory = (recent || []).reverse().map((row: any) => `- (${row.role}) ${compact(row.content, 420)}`).join("\n");
    const system = `Você é o Synapse, assistente de voz da plataforma NeuroNex para profissionais de saúde mental.\n
Responda sempre em português brasileiro, de forma natural, segura e concisa, preferindo uma a três frases.\n
Use ferramentas silenciosamente quando precisar consultar ou alterar dados reais. Nunca invente resultados.\n
Nunca leia UUIDs, códigos internos, JSON, URLs ou detalhes de infraestrutura em voz alta.\n
Para agendamentos, cancelamentos, remarcações, anotações clínicas e operações financeiras, peça confirmação explícita antes de executar. Só envie confirmed=true se o usuário confirmou claramente.\n
Preserve privacidade: não exponha CPF, telefone, e-mail ou identificadores técnicos.\n
Data/hora atual: ${now}. Usuário: ${profile?.first_name || "Profissional"}.\n
Memória recente entre canais:\n${memory || "Sem memória adicional."}`;

    const messages: any[] = [
      { role: "system", content: system },
      ...(history || []).reverse().map((row: any) => ({ role: row.role === "assistant" ? "assistant" : "user", content: compact(row.content) })),
      { role: "user", content: message },
    ];

    let finalResponse = "";
    let finalClientAction: any = null;
    let selectedModel = Deno.env.get("GROQ_CHAT_MODEL") || DEFAULT_MODEL;

    for (let step = 0; step < 5; step += 1) {
      const { payload: completion, model } = await completeWithFallback(groqKey, messages);
      selectedModel = model;
      const assistant = completion?.choices?.[0]?.message;
      if (!assistant) throw new Error("Resposta inválida da IA");
      const calls = Array.isArray(assistant.tool_calls) ? assistant.tool_calls : [];
      if (!calls.length) {
        finalResponse = typeof assistant.content === "string" ? assistant.content.trim() : "";
        break;
      }

      messages.push({ role: "assistant", content: assistant.content || null, tool_calls: calls });
      for (const call of calls) {
        const name = call?.function?.name;
        let args = {};
        try { args = JSON.parse(call?.function?.arguments || "{}"); } catch { args = {}; }
        const { result, structuredData } = await executeTool(name, args, { db, userId: user.id, sessionId });
        if (structuredData) finalClientAction = structuredData;
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name,
          content: compact(result, 3500),
        });
      }
    }

    if (!finalResponse && finalClientAction) finalResponse = "Ação preparada. Confira o resultado na tela.";
    if (!finalResponse) finalResponse = "Não consegui concluir agora. Pode repetir de outra forma?";

    await db.from("messages").insert({ user_id: user.id, session_id: sessionId, role: "assistant", content: finalResponse });
    await db.from("chat_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sessionId).eq("user_id", user.id);

    return jsonResponse({
      response: finalResponse,
      clientAction: finalClientAction,
      session_id: sessionId,
      provider: "groq",
      model: selectedModel,
    });
  } catch (error) {
    const quotaResponse = synapseQuotaErrorResponse(error, corsHeaders);
    if (quotaResponse) return quotaResponse;

    const accessResponse = subscriptionAccessErrorResponse(error);
    if (accessResponse) return accessResponse;

    const message = error instanceof Error ? error.message : "Erro interno";
    console.error("[synapse-voice-turn]", message);
    return jsonResponse({ error: message }, 500);
  }
});
