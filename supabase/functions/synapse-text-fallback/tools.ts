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
    description: "Nome humano informado pelo profissional. Prefira sempre este campo e nunca peça ID ao usuário.",
  },
  patient_id: {
    type: "string",
    description: "Identificador exclusivamente interno, opcional. Nunca solicite ou exponha ao usuário.",
  },
};

const appointmentReference = {
  appointment_id: {
    type: "string",
    description: "Identificador interno opcional, obtido pelo contexto ou por ferramentas. Nunca peça ID ao usuário.",
  },
  appointment_date: {
    type: "string",
    description: "Data local da consulta em YYYY-MM-DD para localizar o agendamento.",
  },
  appointment_time: {
    type: "string",
    description: "Horário local aproximado da consulta, como HH:mm, para desempatar agendamentos.",
  },
};

export const AGENT_TOOLS = [
  fn("get_system_help", "Responde como o NeuroNex funciona, onde encontrar recursos e qual módulo usar. Use para perguntas sobre o próprio sistema.", objectSchema({ query: { type: "string" } }, ["query"])),
  fn("get_workspace_overview", "Obtém um panorama real do ambiente do profissional: pacientes, agenda, documentos, notas e situação financeira.", objectSchema({})),
  fn("list_patients", "Lista pacientes reais do profissional. Use para pacientes ativos, pendentes, quantidade ou visão geral.", objectSchema({ status: { type: "string", enum: ["active", "pending", "inactive", "all"] }, limit: { type: "integer", minimum: 1, maximum: 50 } })),
  fn("search_patients", "Busca pacientes reais por nome. Sempre use antes de qualquer ação específica quando houver um nome humano.", objectSchema({ query: { type: "string", minLength: 1 }, limit: { type: "integer", minimum: 1, maximum: 20 } }, ["query"])),
  fn("get_patient_details", "Obtém o cadastro real de um paciente. Envie patient_name; o servidor resolve a pessoa internamente.", objectSchema({ ...patientReference })),
  fn("get_clinical_history", "Consulta o prontuário real de um paciente. Envie patient_name; nunca peça ID ao usuário.", objectSchema({ ...patientReference, keywords: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 10 } })),

  fn("get_patients_directory_overview", "Consulta a visão operacional da aba Pacientes Desktop: total, ativos, pendentes, inativos, sem próxima sessão e sem diagnóstico definido. Não consulta prontuário.", objectSchema({})),
  fn("search_patient_directory", "Busca pacientes na aba Pacientes Desktop por nome, e-mail, telefone ou status, retornando apenas dados cadastrais e de listagem, sem prontuário.", objectSchema({ query: { type: "string" }, status: { type: "string", enum: ["active", "pending", "inactive", "all"] }, limit: { type: "integer", minimum: 1, maximum: 50 } })),
  fn("get_patient_card_summary", "Obtém o resumo cadastral do card da aba Pacientes: nome, status, diagnóstico resumido, contato e próxima sessão. Não acessa prontuário.", objectSchema({ ...patientReference })),
  fn("list_patients_without_next_session", "Lista pacientes sem próxima sessão cadastrada na aba Pacientes Desktop.", objectSchema({ status: { type: "string", enum: ["active", "pending", "inactive", "all"] }, limit: { type: "integer", minimum: 1, maximum: 50 } })),
  fn("list_pending_patients", "Lista pacientes pendentes ou incompletos na aba Pacientes Desktop.", objectSchema({ limit: { type: "integer", minimum: 1, maximum: 50 } })),

  fn("get_calendar", "Consulta compromissos reais da Agenda Desktop em um período. Retorna consultas, bloqueios, status, próximo atendimento, grupos por dia e sinais de atenção.", objectSchema({ start_date: { type: "string", description: "Data ISO YYYY-MM-DD" }, end_date: { type: "string", description: "Data ISO YYYY-MM-DD" }, ...patientReference, include_cancelled: { type: "boolean" }, limit: { type: "integer", minimum: 1, maximum: 80 } }, ["start_date", "end_date"])),
  fn("get_agenda_daily_overview", "Consulta o resumo real de um dia específico da Agenda Desktop: atendimentos, bloqueios, horários livres, próximo foco e pendências do dia.", objectSchema({ date: { type: "string", description: "Data local em YYYY-MM-DD. Se ausente, use hoje." }, include_cancelled: { type: "boolean" } })),
  fn("get_agenda_week_overview", "Consulta uma visão semanal real da Agenda Desktop: ocupação por dia, consultas, bloqueios, cancelamentos, remarcações pendentes e próximos horários livres.", objectSchema({ start_date: { type: "string", description: "Data inicial em YYYY-MM-DD. Se ausente, use hoje." }, end_date: { type: "string", description: "Data final em YYYY-MM-DD. Se ausente, use 7 dias a partir do início." }, include_cancelled: { type: "boolean" } })),
  fn("get_appointment_details", "Obtém detalhes reais de uma consulta específica da Agenda Desktop por contexto, paciente, data ou horário. Nunca peça ID ao profissional.", objectSchema({ ...appointmentReference, ...patientReference })),
  fn("find_available_slots", "Calcula horários livres reais para a Agenda Desktop com base nos conflitos já cadastrados. Use antes de sugerir remarcação ou novo agendamento.", objectSchema({ start_date: { type: "string", description: "Data ISO YYYY-MM-DD" }, end_date: { type: "string", description: "Data ISO YYYY-MM-DD" }, duration_minutes: { type: "integer", minimum: 15, maximum: 240 }, preferred_period: { type: "string", enum: ["morning", "afternoon", "evening", "any"] }, limit: { type: "integer", minimum: 1, maximum: 30 } }, ["start_date"])),

  fn("get_teleconsultation_overview", "Consulta a visão da aba Teleconsulta Desktop: próximas sessões, teleconsultas online, salas abertas/encerradas, decisão de transcrição e convites pendentes.", objectSchema({ start_date: { type: "string" }, end_date: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 80 } })),
  fn("get_next_teleconsultation", "Consulta a próxima sessão da aba Teleconsulta Desktop, priorizando teleconsulta online, mas incluindo sessão presencial quando for o próximo atendimento clínico.", objectSchema({ modality: { type: "string", enum: ["online", "presencial", "any"] } })),
  fn("get_teleconsultation_session_status", "Consulta o estado de uma sessão na Teleconsulta Desktop por contexto, paciente, data ou horário: sala, link, transcrição, convite e resumo pendente.", objectSchema({ ...appointmentReference, ...patientReference })),
  fn("get_teleconsultation_readiness", "Mostra o que falta antes de iniciar uma teleconsulta: decisão de transcrição, sala, convite, paciente vinculado, e-mail e status da sessão.", objectSchema({ ...appointmentReference, ...patientReference })),

  fn("get_financial_summary", "Consulta receitas, despesas, saldo gerencial e pendências reais em um período.", objectSchema({ start_date: { type: "string" }, end_date: { type: "string" } })),
  fn("list_financial_entries", "Lista lançamentos financeiros gerenciais reais.", objectSchema({ start_date: { type: "string" }, end_date: { type: "string" }, entry_type: { type: "string", enum: ["income", "expense", "all"] }, status: { type: "string" }, ...patientReference, limit: { type: "integer", minimum: 1, maximum: 50 } })),
  fn("list_personal_notes", "Lista notas reais do NeuroNotes pertencentes ao profissional.", objectSchema({ query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 20 } })),
  fn("list_documents", "Lista documentos privados. Para documentos de uma pessoa, envie patient_name.", objectSchema({ ...patientReference, category: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 30 } })),
  fn("request_interface_action", "Solicita uma ação visual estruturada. Use para abrir abas, fichas, modais, lobby da teleconsulta ou destacar elementos sem expor rotas/URLs internas.", objectSchema({
    action: { type: "string", enum: ["navigate", "open_patient", "open_patient_record", "open_daily_schedule", "scroll_to_appointment", "highlight_element", "open_modal", "open_teleconsultation_lobby", "open_patient_invite_modal", "filter_patients_directory"] },
    target: { type: "string", enum: ["dashboard", "agenda", "patients", "finance", "notes", "teleconsultation", "synapse"] },
    ...patientReference,
    appointment_id: { type: "string", description: "Interno. Nunca peça ao usuário." },
    date: { type: "string" },
    query: { type: "string", description: "Texto de busca para filtrar a aba Pacientes." },
    element: { type: "string", enum: ["next_appointment", "daily_schedule", "patient_header", "financial_balance", "transcription_decision", "patient_invite", "patients_search", "patients_grid"] },
    modal: { type: "string", enum: ["new_appointment", "new_patient", "new_transaction", "patient_details", "patient_invite"] },
    reason: { type: "string" },
  }, ["action"])),

  fn("create_patient", "Prepara o cadastro de um paciente e exige confirmação separada.", objectSchema({ name: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, cpf: { type: "string" }, diagnosis: { type: "string" }, notes: { type: "string" }, birth_date: { type: "string" }, address: { type: "string" }, emergency_contact: { type: "string" } }, ["name"])),
  fn("update_patient", "Prepara alterações no cadastro. Envie patient_name; o servidor encontra a pessoa e exige confirmação.", objectSchema({ ...patientReference, name: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, diagnosis: { type: "string" }, notes: { type: "string" }, birth_date: { type: "string" }, address: { type: "string" }, emergency_contact: { type: "string" }, status: { type: "string", enum: ["active", "pending", "inactive"] } }, ["patient_name"])),
  fn("update_patient_basic_info", "Prepara atualização apenas de dados cadastrais básicos da aba Pacientes Desktop. Não altera prontuário.", objectSchema({ ...patientReference, name: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, cpf: { type: "string" }, birth_date: { type: "string" }, address: { type: "string" }, emergency_contact: { type: "string" }, status: { type: "string", enum: ["active", "pending", "inactive"] } }, ["patient_name"])),
  fn("inactivate_patient", "Prepara a inativação segura de um paciente na aba Pacientes Desktop. Prefira isto a excluir paciente por IA.", objectSchema({ ...patientReference, reason: { type: "string" } }, ["patient_name"])),
  fn("create_session_note", "Prepara uma anotação de prontuário. Envie patient_name e notes; nunca peça ID.", objectSchema({ ...patientReference, notes: { type: "string" }, appointment_id: { type: "string", description: "Interno e opcional." } }, ["patient_name", "notes"])),
  fn("create_appointment", "Prepara um novo agendamento da Agenda Desktop e exige confirmação separada. Sempre consulte horários livres antes quando o profissional não indicar horário exato.", objectSchema({ ...patientReference, datetime: { type: "string", description: "Data/hora local de Brasília em ISO" }, duration_minutes: { type: "integer", minimum: 15, maximum: 240 }, appointment_type: { type: "string", enum: ["presencial", "online", "block"] }, notes: { type: "string" }, location: { type: "string" }, price: { type: "number" } }, ["patient_name", "datetime"])),
  fn("reschedule_appointment", "Prepara a remarcação de uma consulta na Agenda Desktop e exige confirmação separada. Localize a consulta por paciente/data/horário ou contexto; nunca peça ID.", objectSchema({ ...patientReference, appointment_id: { type: "string", description: "Interno e opcional." }, current_date: { type: "string" }, current_time: { type: "string" }, new_datetime: { type: "string" }, new_duration_minutes: { type: "integer", minimum: 15, maximum: 240 } }, ["patient_name", "new_datetime"])),
  fn("cancel_appointment", "Prepara o cancelamento de uma consulta na Agenda Desktop e exige confirmação separada. Informe patient_name e, quando possível, data/horário ou use o contexto atual.", objectSchema({ ...patientReference, appointment_id: { type: "string", description: "Interno e opcional." }, appointment_date: { type: "string" }, appointment_time: { type: "string" }, reason: { type: "string" } }, ["patient_name"])),
  fn("set_teleconsultation_transcription_decision", "Prepara a decisão de transcrição da Teleconsulta Desktop e exige confirmação separada.", objectSchema({ ...appointmentReference, ...patientReference, enabled: { type: "boolean" }, notes: { type: "string" } }, ["enabled"])),
  fn("close_teleconsultation_room", "Prepara o fechamento seguro da sala de Teleconsulta Desktop e exige confirmação separada.", objectSchema({ ...appointmentReference, ...patientReference, reason: { type: "string" } })),
  fn("create_financial_entry", "Prepara um lançamento gerencial e exige confirmação. patient_name é opcional e será resolvido internamente.", objectSchema({ title: { type: "string" }, description: { type: "string" }, amount: { type: "number", exclusiveMinimum: 0 }, entry_type: { type: "string", enum: ["income", "expense"] }, ...patientReference, date: { type: "string" }, category: { type: "string" } }, ["title", "amount", "entry_type"])),
] as const;

export const MUTATING_TOOLS = new Set([
  "create_patient", "update_patient", "update_patient_basic_info", "inactivate_patient",
  "create_session_note", "create_appointment", "reschedule_appointment", "cancel_appointment",
  "set_teleconsultation_transcription_decision", "close_teleconsultation_room",
  "create_financial_entry",
]);

export const SYSTEM_DATA_TOOLS = new Set([
  "get_system_help", "get_workspace_overview", "list_patients", "search_patients",
  "get_patient_details", "get_clinical_history", "get_patients_directory_overview",
  "search_patient_directory", "get_patient_card_summary", "list_patients_without_next_session",
  "list_pending_patients", "get_calendar", "get_agenda_daily_overview",
  "get_agenda_week_overview", "get_appointment_details", "find_available_slots",
  "get_teleconsultation_overview", "get_next_teleconsultation", "get_teleconsultation_session_status",
  "get_teleconsultation_readiness", "get_financial_summary", "list_financial_entries",
  "list_personal_notes", "list_documents",
]);
