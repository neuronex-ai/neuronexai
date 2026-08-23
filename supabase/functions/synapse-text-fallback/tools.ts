import { SYNAPSE_TEXT_CONFIRMATION_TOOLS } from "../_shared/synapse-tool-contract.ts";

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

export const SYNAPSE_INTERFACE_DESTINATIONS = [
  "dashboard.overview", "dashboard.agenda", "dashboard.finance", "dashboard.pending",
  "agenda.day", "agenda.week", "agenda.month", "agenda.new-appointment",
  "patients.directory", "patients.new",
  "patient.summary", "patient.sessions.history", "patient.sessions.pending", "patient.anamnesis",
  "patient.mood", "patient.goals", "patient.packages", "patient.finance", "patient.documents",
  "notes.notes", "notes.new", "notes.tasks", "notes.files.personal", "notes.files.patients",
  "notes.notion", "notes.neuroview", "notes.neuroflow", "notes.neuropulse",
  "finance.gestao-visao-geral", "finance.gestao-lancamentos", "finance.gestao-cobrancas",
  "finance.gestao-recebimentos", "finance.gestao-planejamento", "finance.conta-digital",
  "finance.pix-pagar", "finance.pix-transferir", "finance.pix-qrcode",
  "finance.pix-receber.recebidos", "finance.pix-receber.cobrancas", "finance.pix-chaves",
  "finance.pix-salarios", "finance.pix-limites", "finance.extrato.realizado",
  "finance.extrato.futuro", "finance.extrato.assinaturas", "finance.cobrancas-historia",
  "finance.cobrancas-simulador", "finance.cobrancas-config", "finance.cobrancas-chargebacks",
  "finance.pagamentos-boletos", "finance.pagamentos-agendados", "finance.pagamentos-agendar",
  "finance.pagamentos-grupos", "finance.antecipacoes-lista", "finance.antecipacoes-solicitar",
  "finance.antecipacoes-automatica", "finance.transferencias", "finance.contas-bancarias",
  "finance.fiscal-dados", "finance.fiscal-nova", "finance.fiscal-lista", "finance.tarifas",
  "finance.saude-conta", "finance.new-transaction", "finance.new-charge",
  "teleconsultation.overview", "teleconsultation.lobby", "teleconsultation.invite",
  "teleconsultation.transcript", "teleconsultation.notes", "teleconsultation.patient",
  "settings.profile", "settings.security", "settings.subscription", "settings.preferences",
  "settings.notifications", "settings.communication", "settings.neurofinance",
  "settings.integrations", "settings.fiscal", "settings.data-control",
  "neurozap.overview", "neurozap.connection", "synapse.chat", "global.search",
] as const;

const patientReference = {
  patient_name: { type: "string", description: "Nome humano informado pelo profissional. Prefira sempre este campo e nunca peça ID ao usuário." },
  patient_id: { type: "string", description: "Identificador exclusivamente interno, opcional. Nunca solicite ou exponha ao usuário." },
};

const appointmentReference = {
  appointment_id: { type: "string", description: "Identificador interno opcional, obtido pelo contexto ou por ferramentas. Nunca peça ID ao usuário." },
  appointment_date: { type: "string", description: "Data local da consulta em YYYY-MM-DD para localizar o agendamento." },
  appointment_time: { type: "string", description: "Horário local aproximado da consulta, como HH:mm, para desempatar agendamentos." },
};

const noteReference = {
  note_id: { type: "string", description: "Identificador interno opcional da nota. Nunca peça ao usuário." },
  note_title: { type: "string", description: "Título ou parte do título da nota." },
};

const moduleReference = {
  module_id: { type: "string", description: "Identificador interno opcional do módulo/pasta de notas. Nunca peça ao usuário." },
  module_name: { type: "string", description: "Nome do módulo/pasta de notas." },
};

const taskReference = {
  task_id: { type: "string", description: "Identificador interno opcional da tarefa. Nunca peça ao usuário." },
  task_title: { type: "string", description: "Título ou parte do título da tarefa." },
};

const fileReference = {
  file_id: { type: "string", description: "Identificador interno opcional do arquivo. Nunca peça ao usuário." },
  file_name: { type: "string", description: "Nome ou parte do nome do arquivo." },
};

export const AGENT_TOOLS = [
  fn("get_system_help", "Responde como o NeuroNex funciona, onde encontrar recursos e qual módulo usar. Use para perguntas sobre o próprio sistema.", objectSchema({ query: { type: "string" } }, ["query"])),
  fn("get_workspace_overview", "Obtém um panorama real do ambiente do profissional: pacientes, agenda, documentos, notas e situação financeira.", objectSchema({})),
  fn("list_patients", "Lista pacientes reais do profissional. Use para pacientes ativos, pendentes, quantidade ou visão geral.", objectSchema({ status: { type: "string", enum: ["active", "pending", "inactive", "all"] }, limit: { type: "integer", minimum: 1, maximum: 50 } })),
  fn("search_patients", "Busca pacientes reais por nome quando o pedido for localizar/listar pessoas ou quando houver ambiguidade. Ferramentas especializadas que recebem patient_name resolvem a pessoa internamente; não interrompa um pedido de NeuroView, NeuroFlow ou NeuroPulse apenas para pesquisar primeiro.", objectSchema({ query: { type: "string", minLength: 1 }, limit: { type: "integer", minimum: 1, maximum: 20 } }, ["query"])),
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

  fn("get_notes_desktop_overview", "Consulta a visão operacional da aba Notas Desktop, sem NeuroView/NeuroFlow/NeuroPulse: notas, módulos, tarefas, arquivos, Notion e status do Drive sem importar nada.", objectSchema({})),
  fn("search_personal_notes", "Busca notas pessoais por título, conteúdo, tags, módulo ou paciente vinculado.", objectSchema({ query: { type: "string" }, ...moduleReference, limit: { type: "integer", minimum: 1, maximum: 80 } })),
  fn("get_personal_note_details", "Obtém detalhes de uma nota pessoal por título ou ID interno.", objectSchema({ ...noteReference })),
  fn("list_recent_notes", "Lista notas pessoais recentes da aba Notas Desktop.", objectSchema({ limit: { type: "integer", minimum: 1, maximum: 80 } })),
  fn("list_notes_by_module", "Lista notas pessoais dentro de um módulo/pasta.", objectSchema({ ...moduleReference, limit: { type: "integer", minimum: 1, maximum: 80 } })),
  fn("list_uncategorized_notes", "Lista notas sem módulo/pasta.", objectSchema({ limit: { type: "integer", minimum: 1, maximum: 80 } })),
  fn("summarize_note", "Resume de forma determinística uma nota existente, sem alterar conteúdo.", objectSchema({ ...noteReference })),
  fn("extract_tasks_from_note", "Extrai sugestões de tarefas a partir do conteúdo de uma nota. Não cria tarefas sem confirmação.", objectSchema({ ...noteReference, category: { type: "string" } })),
  fn("list_note_modules", "Lista módulos/pastas de notas e a quantidade de notas em cada um.", objectSchema({})),
  fn("get_note_module_overview", "Mostra detalhes de um módulo/pasta e suas notas.", objectSchema({ ...moduleReference, limit: { type: "integer", minimum: 1, maximum: 80 } })),
  fn("get_tasks_overview", "Consulta resumo das tarefas da aba Notas Desktop: abertas, concluídas, vencidas, hoje, próximos 7 dias e categorias.", objectSchema({})),
  fn("list_tasks", "Lista tarefas/lembretes da aba Notas Desktop.", objectSchema({ status: { type: "string", enum: ["open", "completed", "all"] }, category: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 80 } })),
  fn("list_today_tasks", "Lista tarefas de hoje.", objectSchema({})),
  fn("list_overdue_tasks", "Lista tarefas vencidas e ainda não concluídas.", objectSchema({})),
  fn("search_tasks", "Busca tarefas por título e categoria.", objectSchema({ query: { type: "string" }, category: { type: "string" }, status: { type: "string", enum: ["open", "completed", "all"] }, limit: { type: "integer", minimum: 1, maximum: 80 } })),
  fn("get_task_details", "Obtém detalhes de uma tarefa por título ou ID interno.", objectSchema({ ...taskReference })),
  fn("get_files_overview", "Consulta resumo dos arquivos da aba Notas Desktop: pessoais, vinculados a pacientes e recentes. Não importa arquivos do Google Drive.", objectSchema({})),
  fn("search_personal_files", "Busca arquivos pessoais do NeuroDrive por nome. Não importa arquivos externos.", objectSchema({ query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 80 } })),
  fn("search_patient_files", "Busca arquivos vinculados a pacientes por paciente e/ou nome do arquivo.", objectSchema({ ...patientReference, query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 80 } })),
  fn("list_recent_files", "Lista arquivos recentes do NeuroDrive/Arquivos, pessoais e de pacientes.", objectSchema({ limit: { type: "integer", minimum: 1, maximum: 80 } })),
  fn("get_file_details", "Obtém detalhes de um arquivo por nome ou ID interno.", objectSchema({ ...fileReference })),
  fn("list_files_by_patient", "Lista arquivos vinculados a um paciente.", objectSchema({ ...patientReference, limit: { type: "integer", minimum: 1, maximum: 80 } })),
  fn("get_notion_connection_status", "Consulta se o Notion está conectado. Não edita blocos Notion e não importa Google Drive.", objectSchema({})),

  fn("get_financial_summary", "Consulta receitas, despesas, saldo gerencial e pendências reais em um período.", objectSchema({ start_date: { type: "string" }, end_date: { type: "string" } })),
  fn("list_financial_entries", "Lista lançamentos financeiros gerenciais reais.", objectSchema({ start_date: { type: "string" }, end_date: { type: "string" }, entry_type: { type: "string", enum: ["income", "expense", "all"] }, status: { type: "string" }, ...patientReference, limit: { type: "integer", minimum: 1, maximum: 50 } })),
  fn("list_personal_notes", "Lista notas reais do NeuroNotes pertencentes ao profissional. Preferir as ferramentas novas de Notes Desktop quando o pedido for sobre a aba Notas.", objectSchema({ query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 20 } })),
  fn("list_documents", "Lista documentos privados. Para documentos de uma pessoa, envie patient_name.", objectSchema({ ...patientReference, category: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 30 } })),
  fn("request_interface_action", "Solicita uma ação visual estruturada. Use para abrir áreas, fichas, modais e superfícies assistidas ou para mudar o foco, escopo e modo do NeuroView sem expor rotas/URLs internas.", objectSchema({
    action: { type: "string", enum: ["navigate", "open_patient", "open_patient_record", "open_daily_schedule", "scroll_to_appointment", "highlight_element", "open_modal", "open_teleconsultation_lobby", "open_patient_invite_modal", "filter_patients_directory", "open_notes_desktop", "switch_notes_view", "open_note", "filter_notes", "open_new_note", "open_note_module", "open_tasks_board", "open_files_manager", "open_notion_panel", "open_file_preview", "open_neuroview_reasoning", "open_neuroflow_generation", "open_neuropulse_diagram"] },
    target: { type: "string", enum: ["dashboard", "agenda", "patients", "finance", "notes", "teleconsultation", "synapse"] },
    destination: { type: "string", enum: SYNAPSE_INTERFACE_DESTINATIONS, description: "Destino profundo e seguro. Para abrir uma aba, subaba ou modal existente, use action=navigate e escolha o destino exato deste catálogo." },
    ...patientReference,
    ...noteReference,
    ...moduleReference,
    ...taskReference,
    ...fileReference,
    appointment_id: { type: "string", description: "Interno. Nunca peça ao usuário." },
    date: { type: "string" },
    query: { type: "string", description: "Texto de busca/filtro." },
    notes_view: { type: "string", enum: ["notes", "tasks", "files", "notion", "neuroview", "neuroflow", "neuropulse"] },
    neuroview_scope: { type: "string", enum: ["all", "patient", "subgraph"], description: "Escopo visual: grafo completo, grafo isolado do paciente ou subgrafo pelos IDs retornados anteriormente." },
    neuroview_mode: { type: "string", enum: ["2d", "3d"], description: "Modo de visualização do mesmo grafo selecionado." },
    neuroview_node_ids: { type: "array", items: { type: "string" }, maxItems: 80, description: "IDs internos exatos retornados pela análise. No 3D, uma nota reproduz seu hover; várias notas unem os caminhos; uma tag ressalta seu grupo relacionado. Nunca invente nem leia estes IDs em voz alta." },
    neuroview_focus_node_id: { type: "string", description: "ID interno exato que recebe o enquadramento da câmera sem desfazer o grupo ressaltado." },
    element: { type: "string", enum: [
      "next_appointment", "daily_schedule", "dashboard_agenda", "dashboard_pending", "dashboard_finance",
      "agenda_calendar", "agenda_appointments", "patient_header", "patient_summary", "patient_sessions",
      "patient_files", "patient_finance", "financial_balance", "finance_overview", "finance_entries",
      "finance_charges", "finance_workspace", "transcription_decision", "patient_invite", "patients_search",
      "patients_grid", "notes_search", "notes_editor", "notes_list", "notes_sidebar", "tasks_board",
      "files_manager", "notion_panel", "neuroview_graph", "neuroflow_canvas", "neuropulse_panel",
    ] },
    modal: { type: "string", enum: ["new_appointment", "new_patient", "new_transaction", "new_charge", "patient_details", "patient_invite", "new_note"] },
    reason: { type: "string" },
  }, ["action"])),

  fn("create_patient", "Prepara o cadastro de um paciente e exige confirmação separada.", objectSchema({ name: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, cpf: { type: "string" }, diagnosis: { type: "string" }, notes: { type: "string" }, birth_date: { type: "string" }, address: { type: "string" }, emergency_contact: { type: "string" } }, ["name"])),
  fn("update_patient", "Prepara alterações no cadastro. Envie patient_name; o servidor encontra a pessoa e exige confirmação.", objectSchema({ ...patientReference, name: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, diagnosis: { type: "string" }, notes: { type: "string" }, birth_date: { type: "string" }, address: { type: "string" }, emergency_contact: { type: "string" }, status: { type: "string", enum: ["active", "pending", "inactive"] } }, ["patient_name"])),
  fn("update_patient_basic_info", "Prepara atualização apenas de dados cadastrais básicos da aba Pacientes Desktop. Não altera prontuário.", objectSchema({ ...patientReference, name: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, cpf: { type: "string" }, birth_date: { type: "string" }, address: { type: "string" }, emergency_contact: { type: "string" }, status: { type: "string", enum: ["active", "pending", "inactive"] } }, ["patient_name"])),
  fn("inactivate_patient", "Prepara a inativação segura de um paciente na aba Pacientes Desktop. Prefira isto a excluir paciente por IA.", objectSchema({ ...patientReference, reason: { type: "string" } }, ["patient_name"])),
  fn("create_session_note", "Prepara uma anotação de prontuário. Envie patient_name e notes; nunca peça ID.", objectSchema({ ...patientReference, notes: { type: "string" }, appointment_id: { type: "string", description: "Interno e opcional." } }, ["patient_name", "notes"])),
  fn("create_appointment", "Prepara um plano imutável de agendamento simples ou de recorrência avançada na Agenda Desktop e exige confirmação separada. Suporta vários dias, término por quantidade/data ou sem fim e personalizações por sessão. Sempre consulte horários livres antes quando o profissional não indicar horário exato.", objectSchema({ ...patientReference, datetime: { type: "string", description: "Data/hora local de Brasília em ISO" }, duration_minutes: { type: "integer", minimum: 15, maximum: 240 }, appointment_type: { type: "string", enum: ["presencial", "online", "block"] }, frequency: { type: "string", enum: ["single", "weekly", "biweekly", "monthly"] }, recurrence_kind: { type: "string", enum: ["weekly", "monthly", "interval", "custom_dates", "range_distribution"] }, interval: { type: "integer", minimum: 1, maximum: 365 }, week_days: { type: "array", items: { type: "integer", minimum: 0, maximum: 6 } }, month_days: { type: "array", items: { type: "integer", minimum: 1, maximum: 31 } }, custom_dates: { type: "array", items: { type: "string" } }, termination_kind: { type: "string", enum: ["count", "until", "open"] }, occurrence_count: { type: "integer", minimum: 1, maximum: 500 }, until_date: { type: "string" }, distribution_until_date: { type: "string" }, missing_month_day: { type: "string", enum: ["last_business_day", "skip"] }, overrides: { type: "array", items: objectSchema({ occurrence_number: { type: "integer", minimum: 1, maximum: 500 }, date: { type: "string" }, start_time: { type: "string" }, duration_minutes: { type: "integer", minimum: 15, maximum: 240 }, modality: { type: "string", enum: ["presencial", "online"] }, location: { type: "string" }, reason: { type: "string" } }, ["occurrence_number"]) }, notes: { type: "string" }, location: { type: "string" }, package_id: { type: "string", description: "Vínculo interno opcional já resolvido." }, financial_mode: { type: "string", enum: ["none", "manual", "insurance", "neurofinance", "package"] }, value_per_session: { type: "number", minimum: 0 }, total: { type: "number", minimum: 0 }, charge_mode: { type: "string", enum: ["per_occurrence", "series"] }, create_charge: { type: "boolean" }, send_confirmation: { type: "boolean" }, communication_provider: { type: "string", enum: ["configured", "gmail", "neuronex"] }, reminder_policy: { type: "string" }, fiscal_automation_enabled: { type: "boolean" }, fiscal_trigger: { type: "string" } }, ["patient_name", "datetime"])),
  fn("reschedule_appointment", "Prepara o plano imutável de alteração profissional de uma consulta na Agenda Desktop e exige confirmação separada. Localize a consulta por paciente/data/horário ou contexto; nunca peça ID.", objectSchema({ ...patientReference, appointment_id: { type: "string", description: "Interno e opcional." }, current_date: { type: "string" }, current_time: { type: "string" }, new_datetime: { type: "string" }, new_duration_minutes: { type: "integer", minimum: 15, maximum: 240 }, appointment_type: { type: "string", enum: ["presencial", "online"] }, location: { type: "string" }, send_confirmation: { type: "boolean" } }, ["patient_name", "new_datetime"])),
  fn("cancel_appointment", "Prepara o cancelamento de uma consulta na Agenda Desktop e exige confirmação separada. Informe patient_name e, quando possível, data/horário ou use o contexto atual.", objectSchema({ ...patientReference, appointment_id: { type: "string", description: "Interno e opcional." }, appointment_date: { type: "string" }, appointment_time: { type: "string" }, reason: { type: "string" } }, ["patient_name"])),
  fn("set_teleconsultation_transcription_decision", "Prepara a decisão de transcrição da Teleconsulta Desktop e exige confirmação separada.", objectSchema({ ...appointmentReference, ...patientReference, enabled: { type: "boolean" }, notes: { type: "string" } }, ["enabled"])),
  fn("close_teleconsultation_room", "Prepara o fechamento seguro da sala de Teleconsulta Desktop e exige confirmação separada.", objectSchema({ ...appointmentReference, ...patientReference, reason: { type: "string" } })),

  fn("create_personal_note", "Prepara criação de nota pessoal na aba Notas Desktop e exige confirmação separada.", objectSchema({ title: { type: "string" }, content: { type: "string" }, tags: { type: "array", items: { type: "string" } }, ...moduleReference, ...patientReference, reference_date: { type: "string" } }, ["title"])),
  fn("update_personal_note", "Prepara atualização de uma nota pessoal existente e exige confirmação separada.", objectSchema({ ...noteReference, title: { type: "string" }, content: { type: "string" }, tags: { type: "array", items: { type: "string" } }, ...moduleReference, ...patientReference, reference_date: { type: "string" } })),
  fn("append_to_personal_note", "Prepara acréscimo de conteúdo ao final de uma nota existente e exige confirmação separada.", objectSchema({ ...noteReference, content: { type: "string" }, text: { type: "string" }, separator: { type: "string" } }, ["content"])),
  fn("rename_personal_note", "Prepara renomeação de nota pessoal e exige confirmação separada.", objectSchema({ ...noteReference, new_title: { type: "string" } }, ["new_title"])),
  fn("move_note_to_module", "Prepara mover uma nota para um módulo/pasta e exige confirmação separada.", objectSchema({ ...noteReference, ...moduleReference })),
  fn("tag_personal_note", "Prepara atualização de tags de uma nota e exige confirmação separada.", objectSchema({ ...noteReference, tags: { type: "array", items: { type: "string" } }, add_tags: { type: "array", items: { type: "string" } }, remove_tags: { type: "array", items: { type: "string" } } })),
  fn("delete_personal_note", "Prepara exclusão permanente de nota pessoal e exige confirmação explícita.", objectSchema({ ...noteReference })),
  fn("create_note_module", "Prepara criação de módulo/pasta de notas e exige confirmação separada.", objectSchema({ name: { type: "string" }, module_name: { type: "string" } })),
  fn("rename_note_module", "Prepara renomeação de módulo/pasta de notas e exige confirmação separada.", objectSchema({ ...moduleReference, new_name: { type: "string" } }, ["new_name"])),
  fn("delete_note_module", "Prepara exclusão de módulo/pasta e deixa suas notas sem módulo. Exige confirmação separada.", objectSchema({ ...moduleReference })),
  fn("create_task", "Prepara criação de tarefa/lembrete da aba Notas Desktop e exige confirmação separada.", objectSchema({ title: { type: "string" }, due_date: { type: "string" }, category: { type: "string" }, ...noteReference }, ["title"])),
  fn("update_task", "Prepara atualização de tarefa/lembrete e exige confirmação separada.", objectSchema({ ...taskReference, title: { type: "string" }, due_date: { type: "string" }, category: { type: "string" }, is_completed: { type: "boolean" }, ...noteReference })),
  fn("complete_task", "Prepara concluir uma tarefa e exige confirmação separada.", objectSchema({ ...taskReference })),
  fn("reopen_task", "Prepara reabrir uma tarefa e exige confirmação separada.", objectSchema({ ...taskReference })),
  fn("move_task_category", "Prepara mover tarefa para outra categoria e exige confirmação separada.", objectSchema({ ...taskReference, category: { type: "string" } }, ["category"])),
  fn("delete_task", "Prepara exclusão de tarefa/lembrete e exige confirmação separada.", objectSchema({ ...taskReference })),
  fn("link_file_to_patient", "Prepara vincular arquivo existente a paciente e exige confirmação separada. Não importa arquivo do Google Drive.", objectSchema({ ...fileReference, ...patientReference, category: { type: "string" } })),
  fn("unlink_file_from_patient", "Prepara remover vínculo de paciente de um arquivo e exige confirmação separada.", objectSchema({ ...fileReference })),
  fn("delete_file", "Prepara exclusão lógica de arquivo do NeuroDrive/Arquivos e exige confirmação separada. Não importa arquivo do Google Drive.", objectSchema({ ...fileReference })),

  fn("create_financial_entry", "Prepara um lançamento gerencial e exige confirmação. patient_name é opcional e será resolvido internamente.", objectSchema({ title: { type: "string" }, description: { type: "string" }, amount: { type: "number", exclusiveMinimum: 0 }, entry_type: { type: "string", enum: ["income", "expense"] }, ...patientReference, date: { type: "string" }, category: { type: "string" } }, ["title", "amount", "entry_type"])),
] as const;

export const MUTATING_TOOLS = new Set<string>(SYNAPSE_TEXT_CONFIRMATION_TOOLS);

export const SYSTEM_DATA_TOOLS = new Set([
  "get_system_help", "get_workspace_overview", "list_patients", "search_patients",
  "get_patient_details", "get_clinical_history", "get_patients_directory_overview",
  "search_patient_directory", "get_patient_card_summary", "list_patients_without_next_session",
  "list_pending_patients", "get_calendar", "get_agenda_daily_overview",
  "get_agenda_week_overview", "get_appointment_details", "find_available_slots",
  "get_teleconsultation_overview", "get_next_teleconsultation", "get_teleconsultation_session_status",
  "get_teleconsultation_readiness", "get_notes_desktop_overview", "search_personal_notes",
  "get_personal_note_details", "list_recent_notes", "list_notes_by_module", "list_uncategorized_notes",
  "summarize_note", "extract_tasks_from_note", "list_note_modules", "get_note_module_overview",
  "get_tasks_overview", "list_tasks", "list_today_tasks", "list_overdue_tasks", "search_tasks",
  "get_task_details", "get_files_overview", "search_personal_files", "search_patient_files",
  "list_recent_files", "get_file_details", "list_files_by_patient", "get_notion_connection_status",
  "get_financial_summary", "list_financial_entries", "list_personal_notes", "list_documents",
]);
