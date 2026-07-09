import { supabase } from "@/integrations/supabase/client";

type GroundedSource = "patients" | "appointments" | "transactions" | "financial_metrics";

export interface GroundedSynapseResult {
  response: string;
  source: GroundedSource;
  count: number;
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const currency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

const dateTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const dateOnly = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
};

const isCreateIntent = (text: string) =>
  /\b(novo|nova|criar|cadastrar|adicionar|registrar|agendar)\b/.test(text);

export const isCompositeSystemQuery = (normalized: string) => {
  const hasPatientContext = /\b(paciente|pacientes|sobre|dele|dela|do|da|esse|essa)\b/.test(normalized);
  const wantsFullSummary = /\b(resuma|resumo|panorama|tudo|geral|sabemos|situacao geral|historico completo)\b/.test(normalized);
  const wantsTimeline = /\b(linha do tempo|cronologia|historico completo|ultimos acontecimentos|ultimos eventos)\b/.test(normalized);
  const domains = [
    /\b(prontuario|historico|evolucao|sessao|sessoes|diagnostico|risco)\b/.test(normalized),
    /\b(agenda|consulta|consultas|agendamento|horario|ultima consulta|proxima consulta)\b/.test(normalized),
    /\b(financeiro|pagamento|pago|paga|pendente|atrasado|cobranca|cobrancas|neurofinance|receita|lancamento)\b/.test(normalized),
    /\b(documento|documentos|arquivo|arquivos|nota|notas)\b/.test(normalized),
  ].filter(Boolean).length;

  return Boolean(hasPatientContext && (wantsFullSummary || wantsTimeline || domains >= 2));
};

const quotedSearch = (message: string) => {
  const match = message.match(/["']([^"']{2,80})["']/);
  return match?.[1]?.trim() || null;
};

const afterKeyword = (text: string, keyword: string) => {
  const index = text.indexOf(keyword);
  if (index === -1) return "";
  return text.slice(index + keyword.length).replace(/\b(paciente|por|nome|chamado|chamada)\b/g, "").trim();
};

const resolvePatientQuery = async (message: string, normalized: string, userId: string) => {
  if (!normalized.includes("paciente") || isCreateIntent(normalized)) return null;

  const isList =
    normalized.includes("listar pacientes") ||
    normalized.includes("lista de pacientes") ||
    normalized.includes("pacientes cadastrados") ||
    normalized.includes("todos os pacientes") ||
    normalized === "pacientes" ||
    normalized === "listar paciente";

  const isSearch =
    normalized.includes("buscar paciente") ||
    normalized.includes("procurar paciente") ||
    normalized.includes("encontrar paciente");

  if (!isList && !isSearch) return null;

  const rawTerm = quotedSearch(message) || afterKeyword(normalized, "buscar paciente") || afterKeyword(normalized, "procurar paciente");
  const term = rawTerm && rawTerm.length > 1 ? rawTerm : "";

  let query = supabase
    .from("patients")
    .select("id,name,email,phone,status,diagnosis,next_session,last_session,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (term) query = query.ilike("name", `%${term}%`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const patients = data || [];
  if (patients.length === 0) {
    return {
      response: term
        ? `Consultei o sistema agora e nao encontrei pacientes com "${term}".`
        : "Consultei o sistema agora e nao encontrei pacientes cadastrados.",
      source: "patients" as const,
      count: 0,
    };
  }

  const rows = patients
    .map((patient, index) => {
      const details = [
        patient.status ? `status: ${patient.status}` : null,
        patient.diagnosis ? `diagnostico: ${patient.diagnosis}` : null,
        patient.next_session ? `proxima sessao: ${dateTime(patient.next_session)}` : null,
      ].filter(Boolean);
      return `${index + 1}. ${patient.name}${details.length ? ` - ${details.join(" | ")}` : ""}`;
    })
    .join("\n");

  return {
    response: `Consultei o sistema agora.\n\nPacientes${term ? ` encontrados para "${term}"` : " cadastrados"} (${patients.length}):\n${rows}\n\nFonte: tabela patients.`,
    source: "patients" as const,
    count: patients.length,
  };
};

const resolveAppointmentQuery = async (normalized: string, userId: string) => {
  const isAgendaQuery =
    normalized.includes("ver agenda") ||
    normalized.includes("agenda do dia") ||
    normalized.includes("listar agenda") ||
    normalized.includes("listar agendamentos") ||
    normalized.includes("consultas de hoje") ||
    normalized.includes("proximas consultas");

  if (!isAgendaQuery || isCreateIntent(normalized)) return null;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 14);

  const { data, error } = await supabase
    .from("appointments")
    .select("id,start_time,end_time,type,status,location,notes,patient_name,patients(name)")
    .eq("user_id", userId)
    .gte("start_time", start.toISOString())
    .lte("start_time", end.toISOString())
    .order("start_time", { ascending: true })
    .limit(15);

  if (error) throw new Error(error.message);

  const appointments = data || [];
  if (appointments.length === 0) {
    return {
      response: "Consultei o sistema agora e nao encontrei agendamentos nos proximos 14 dias.",
      source: "appointments" as const,
      count: 0,
    };
  }

  const rows = appointments
    .map((appointment: any, index) => {
      const patientName = appointment.patient_name || appointment.patients?.name || "Compromisso";
      return `${index + 1}. ${dateTime(appointment.start_time)} - ${patientName} (${appointment.status || appointment.type})`;
    })
    .join("\n");

  return {
    response: `Consultei o sistema agora.\n\nProximos agendamentos (${appointments.length}):\n${rows}\n\nFonte: tabela appointments.`,
    source: "appointments" as const,
    count: appointments.length,
  };
};

const resolveTransactionQuery = async (normalized: string, userId: string) => {
  const isList =
    normalized.includes("listar transacoes") ||
    normalized.includes("listar transacao") ||
    normalized.includes("listar lancamentos") ||
    normalized.includes("movimentacoes financeiras");

  const isMetrics =
    normalized.includes("metricas financeiras") ||
    normalized.includes("resumo financeiro") ||
    normalized.includes("kpis financeiros");

  if ((!isList && !isMetrics) || isCreateIntent(normalized)) return null;

  const { data: entries, error: entriesError } = await supabase
    .from("financial_entries")
    .select("id,type,title,description,amount,due_date,competence_date,paid_at,status,patients(name)")
    .eq("professional_id", userId)
    .order("due_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);

  if (entriesError) throw new Error(entriesError.message);

  const rows = (entries || []).map((entry: any) => ({
    id: entry.id,
    type: entry.type,
    description: entry.description || entry.title,
    amount: Number(entry.amount || 0),
    date: entry.paid_at || entry.competence_date || entry.due_date,
    status: entry.status,
    patient_name: entry.patients?.name,
  }));

  if (rows.length === 0) {
    return {
      response: "Consultei o sistema agora e nao encontrei lancamentos financeiros.",
      source: isMetrics ? ("financial_metrics" as const) : ("transactions" as const),
      count: 0,
    };
  }

  return formatTransactions(rows, isMetrics);
};

const formatTransactions = (rows: any[], metricsOnly: boolean): GroundedSynapseResult => {
  const income = rows.filter((row) => row.type === "income").reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const expense = rows.filter((row) => row.type === "expense").reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const balance = income - expense;

  if (metricsOnly) {
    return {
      response: `Consultei o sistema agora.\n\nResumo financeiro dos ultimos lancamentos consultados:\nReceitas: ${currency(income)}\nDespesas: ${currency(expense)}\nSaldo: ${currency(balance)}\n\nFonte: financial_entries.`,
      source: "financial_metrics",
      count: rows.length,
    };
  }

  const list = rows
    .slice(0, 12)
    .map((row, index) => {
      const signal = row.type === "expense" ? "-" : "+";
      const patient = row.patient_name ? ` | ${row.patient_name}` : "";
      return `${index + 1}. ${dateOnly(row.date)} - ${signal}${currency(Number(row.amount || 0))} - ${row.description || "Lancamento"}${patient}`;
    })
    .join("\n");

  return {
    response: `Consultei o sistema agora.\n\nLancamentos financeiros (${rows.length} consultados):\n${list}\n\nResumo: receitas ${currency(income)}, despesas ${currency(expense)}, saldo ${currency(balance)}.\nFonte: financial_entries.`,
    source: "transactions",
    count: rows.length,
  };
};

export async function resolveGroundedSynapseQuery(message: string, userId: string): Promise<GroundedSynapseResult | null> {
  const normalized = normalize(message);
  if (!normalized || !userId) return null;
  if (isCompositeSystemQuery(normalized)) return null;

  try {
    return (
      (await resolvePatientQuery(message, normalized, userId)) ||
      (await resolveAppointmentQuery(normalized, userId)) ||
      (await resolveTransactionQuery(normalized, userId))
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return {
      response: `Tentei consultar o sistema agora, mas a consulta falhou: ${message}. Nao vou inventar dados.`,
      source: "patients",
      count: 0,
    };
  }
}
