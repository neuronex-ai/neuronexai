import {
  AGENT_TOOLS as BASE_TOOLS,
  MUTATING_TOOLS as BASE_MUTATING_TOOLS,
  SYSTEM_DATA_TOOLS as BASE_SYSTEM_DATA_TOOLS,
} from "./tools.ts";

type JsonSchema = Record<string, unknown>;

const objectSchema = (
  properties: Record<string, JsonSchema>,
  required: string[] = [],
): JsonSchema => ({
  type: "object",
  properties,
  ...(required.length ? { required } : {}),
  additionalProperties: false,
});

const fn = (name: string, description: string, parameters: JsonSchema) => ({
  type: "function",
  function: { name, description, parameters },
});

const patientReference = {
  patient_name: {
    type: "string",
    description: "Nome humano do paciente. Nunca peça ID ao profissional.",
  },
  patient_id: {
    type: "string",
    description: "Identificador interno opcional, obtido apenas por ferramentas ou pelo contexto da conversa.",
  },
};

const appointmentReference = {
  appointment_id: {
    type: "string",
    description: "Identificador interno opcional. Nunca peça ao profissional.",
  },
  appointment_date: {
    type: "string",
    description: "Data da consulta em YYYY-MM-DD, usada para desempatar.",
  },
  appointment_time: {
    type: "string",
    description: "Horário local aproximado, usado para desempatar.",
  },
};

const dashboardPeriod = {
  start_date: { type: "string", description: "Data inicial em YYYY-MM-DD. Se ausente, use hoje." },
  end_date: { type: "string", description: "Data final em YYYY-MM-DD. Se ausente, use hoje ou os próximos 7 dias conforme o pedido." },
};

const EXTRA_TOOLS = [
  fn(
    "search_workspace",
    "Pesquisa de forma unificada pacientes, prontuários, agenda, lembretes, notas e histórico do Synapse. Use quando o pedido citar parcialmente uma pessoa ou informação e ainda não houver entidade canônica confirmada.",
    objectSchema({
      query: { type: "string", description: "Nome parcial, termo, assunto ou trecho informado pelo profissional." },
      entity_types: {
        type: "array",
        items: { type: "string", enum: ["patient", "session_note", "appointment", "reminder", "personal_note", "message"] },
        maxItems: 6,
      },
      limit: { type: "integer", minimum: 1, maximum: 50 },
    }, ["query"]),
  ),
  fn(
    "get_dashboard_daily_briefing",
    "Consulta um briefing real do Dashboard Desktop: próximo atendimento, agenda de hoje, semana, pendências e resumo financeiro útil. Use para pedidos como 'resuma meu dia', 'o que tenho hoje' ou 'como está meu dashboard'.",
    objectSchema({}),
  ),
  fn(
    "get_dashboard_schedule",
    "Consulta agenda real para o Dashboard Desktop, com foco em hoje ou na semana. Use quando o profissional perguntar sobre consultas do dia, semana, próximos atendimentos ou horários no painel.",
    objectSchema({ ...dashboardPeriod, limit: { type: "integer", minimum: 1, maximum: 50 } }),
  ),
  fn(
    "get_dashboard_next_appointment",
    "Consulta o próximo atendimento real do profissional para orientar ações rápidas do Dashboard Desktop.",
    objectSchema({}),
  ),
  fn(
    "get_dashboard_attention_queue",
    "Consulta a fila de atenção do Dashboard Desktop: consultas sem registro de presença, pacientes pendentes, pendências de revisão e alertas relevantes do NeuroFinance.",
    objectSchema({ limit: { type: "integer", minimum: 1, maximum: 30 } }),
  ),
  fn(
    "get_dashboard_financial_overview",
    "Consulta o resumo financeiro útil do Dashboard Desktop combinando Gestão Financeira, NeuroFinance e Planejamento do mês atual.",
    objectSchema({}),
  ),
  fn(
    "get_neurofinance_status",
    "Consulta a situação real da conta NeuroFinance do profissional. Use antes de falar sobre saldo, cobranças ou disponibilidade de recursos bancários.",
    objectSchema({}),
  ),
  fn(
    "get_neurofinance_overview",
    "Consulta saldo disponível, valores a liberar, volume recebido, tarifas e saídas reais do NeuroFinance. Se não houver conta, retorna o estágio correto de ativação.",
    objectSchema({}),
  ),
  fn(
    "list_neurofinance_charges",
    "Lista cobranças reais do NeuroFinance. Pode filtrar por paciente e status; IDs são apenas internos.",
    objectSchema({
      ...patientReference,
      status: {
        type: "string",
        enum: ["all", "pending", "paid", "overdue", "cancelled", "refunded", "processing"],
      },
      limit: { type: "integer", minimum: 1, maximum: 50 },
    }),
  ),
  fn(
    "get_neurofinance_charge",
    "Obtém os detalhes reais da cobrança mais relevante ou de uma cobrança previamente selecionada. Use paciente/data quando necessário; nunca peça ID ao profissional.",
    objectSchema({
      charge_id: { type: "string", description: "Identificador interno opcional." },
      ...patientReference,
      status: { type: "string" },
    }),
  ),
  fn(
    "get_patient_system_snapshot",
    "Consulta um panorama consolidado real de um paciente: cadastro, prontuario, agenda, pagamentos gerenciais e NeuroFinance. Use para pedidos como resumir tudo que sabemos sobre uma pessoa.",
    objectSchema({
      ...patientReference,
      history_limit: { type: "integer", minimum: 1, maximum: 10 },
      appointments_limit: { type: "integer", minimum: 1, maximum: 30 },
      financial_limit: { type: "integer", minimum: 1, maximum: 30 },
      include_documents: { type: "boolean" },
    }),
  ),
  fn(
    "get_patient_payment_status",
    "Consulta a situacao financeira real de um paciente combinando lancamentos gerenciais e cobrancas NeuroFinance.",
    objectSchema({
      ...patientReference,
      status: {
        type: "string",
        enum: ["all", "pending", "paid", "overdue", "cancelled", "refunded", "processing"],
      },
      limit: { type: "integer", minimum: 1, maximum: 50 },
    }),
  ),
  fn(
    "get_patient_timeline",
    "Monta uma linha do tempo real de um paciente combinando prontuario, consultas, pagamentos e documentos.",
    objectSchema({
      ...patientReference,
      start_date: { type: "string", description: "Data ISO YYYY-MM-DD" },
      end_date: { type: "string", description: "Data ISO YYYY-MM-DD" },
      limit: { type: "integer", minimum: 1, maximum: 50 },
    }),
  ),
  fn(
    "analyze_neuroview_patient_patterns",
    "Execute diretamente com patient_name quando o pedido citar NeuroView, grafo de notas, padrões, curiosidades ou conexões de um paciente. A função resolve a pessoa, analisa dados reais e retorna a ação visual que abre o NeuroView com o subgrafo e os IDs exatos para continuar o raciocínio.",
    objectSchema({
      ...patientReference,
      focus: { type: "string", description: "Foco opcional da analise." },
    }),
  ),
  fn(
    "create_neuroflow_from_patient_history",
    "Cria um NeuroFlow completo vinculado ao paciente a partir do historico real do sistema: notas, prontuario, fluxos, NeuroPulse e registros clinicos. Use somente quando o profissional pedir explicitamente criacao ou geracao de NeuroFlow.",
    objectSchema({
      ...patientReference,
      objective: { type: "string", description: "Objetivo do fluxo ou processo a modelar." },
    }),
  ),
  fn(
    "create_neuropulse_cause_effect_diagram",
    "Cria e salva um fluxograma Mermaid de causa e efeito no NeuroPulse, usando o paciente, historico do sistema e a conversa atual. Use somente quando o profissional pedir explicitamente NeuroPulse, fluxograma, diagrama causal ou causa e efeito.",
    objectSchema({
      ...patientReference,
      prompt: { type: "string", description: "Relato, foco ou instrucao do profissional." },
      lens: { type: "string", enum: ["psicanalise", "tcc", "sistemica", "humanista", "gestalt", "junguiana", "neuropsicologia"] },
    }),
  ),
  fn(
    "create_neurofinance_charge",
    "Prepara uma cobrança real pelo NeuroFinance e exige confirmação separada. Resolva o paciente pelo nome e informe valor, vencimento e meio de pagamento.",
    objectSchema({
      ...patientReference,
      amount: { type: "number", exclusiveMinimum: 0 },
      due_date: { type: "string", description: "Data de vencimento em YYYY-MM-DD." },
      payment_method: { type: "string", enum: ["pix", "boleto", "card", "undefined"] },
      description: { type: "string" },
      appointment_id: { type: "string", description: "Identificador interno opcional da consulta vinculada." },
    }, ["patient_name", "amount", "due_date", "payment_method"]),
  ),
  fn(
    "list_fiscal_invoices",
    "Lista NFS-e reais do profissional diretamente pela integração fiscal do NeuroFinance. Pode filtrar por paciente e status.",
    objectSchema({
      ...patientReference,
      status: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 100 },
    }),
  ),
  fn(
    "get_fiscal_invoice",
    "Obtém uma NFS-e específica ou a última nota fiscal associada ao paciente/contexto atual. Nunca peça ID ao profissional.",
    objectSchema({
      invoice_id: { type: "string", description: "Identificador interno opcional da NFS-e." },
      ...patientReference,
    }),
  ),
  fn(
    "create_fiscal_invoice",
    "Prepara a emissão de uma NFS-e e exige confirmação separada. Pode vincular a uma cobrança existente ou emitir para um paciente usando a configuração fiscal já salva.",
    objectSchema({
      ...patientReference,
      charge_id: { type: "string", description: "Identificador interno opcional da cobrança local." },
      payment_id: { type: "string", description: "Identificador interno opcional do pagamento Asaas, obtido por ferramenta." },
      amount: { type: "number", exclusiveMinimum: 0 },
      description: { type: "string" },
      effective_date: { type: "string", description: "Data da prestação em YYYY-MM-DD." },
      observations: { type: "string" },
    }, ["patient_name", "amount", "description"]),
  ),
  fn(
    "send_appointment_reminder",
    "Prepara o envio de e-mail de lembrete, cancelamento ou reagendamento usando a consulta e o e-mail reais do paciente. Exige confirmação separada.",
    objectSchema({
      ...patientReference,
      ...appointmentReference,
      action: { type: "string", enum: ["reminder", "reschedule", "cancel"] },
      cancellation_reason: { type: "string" },
    }, ["patient_name", "action"]),
  ),
  fn(
    "send_patient_email",
    "Prepara um e-mail personalizado para um paciente usando o Gmail conectado pelo profissional. Exige confirmação separada.",
    objectSchema({
      ...patientReference,
      subject: { type: "string" },
      body: { type: "string", description: "Corpo do e-mail em texto simples ou HTML seguro." },
    }, ["patient_name", "subject", "body"]),
  ),
] as const;

export const AGENT_TOOLS_V3 = [...BASE_TOOLS, ...EXTRA_TOOLS] as const;

export const MUTATING_TOOLS_V3 = new Set([
  ...BASE_MUTATING_TOOLS,
  "create_neurofinance_charge",
  "create_fiscal_invoice",
  "send_appointment_reminder",
  "send_patient_email",
]);

export const SYSTEM_DATA_TOOLS_V3 = new Set([
  ...BASE_SYSTEM_DATA_TOOLS,
  "search_workspace",
  "get_dashboard_daily_briefing",
  "get_dashboard_schedule",
  "get_dashboard_next_appointment",
  "get_dashboard_attention_queue",
  "get_dashboard_financial_overview",
  "get_neurofinance_status",
  "get_neurofinance_overview",
  "list_neurofinance_charges",
  "get_neurofinance_charge",
  "get_patient_system_snapshot",
  "get_patient_payment_status",
  "get_patient_timeline",
  "analyze_neuroview_patient_patterns",
  "create_neuroflow_from_patient_history",
  "create_neuropulse_cause_effect_diagram",
  "list_fiscal_invoices",
  "get_fiscal_invoice",
]);
