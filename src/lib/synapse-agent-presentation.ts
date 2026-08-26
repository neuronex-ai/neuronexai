export type SynapseAgentIntegration = 'gmail' | 'google_calendar';

export type SynapseAgentToolCategory =
  | 'search'
  | 'patient'
  | 'calendar'
  | 'mail'
  | 'finance'
  | 'document'
  | 'interface'
  | 'neuro'
  | 'generic';

const TOOL_LABELS: Record<string, string> = {
  search_workspace: 'Pesquisar informações no NeuroNex',
  get_workspace_overview: 'Consultar visão geral do consultório',
  get_dashboard_daily_briefing: 'Consultar resumo do dia',
  get_dashboard_schedule: 'Consultar agenda do painel',
  get_dashboard_next_appointment: 'Consultar próximo atendimento',
  get_dashboard_attention_queue: 'Verificar pendências importantes',
  get_dashboard_financial_overview: 'Consultar resumo financeiro',
  list_patients: 'Consultar pacientes',
  search_patients: 'Buscar paciente',
  search_patient_directory: 'Buscar paciente',
  get_patient_details: 'Consultar cadastro do paciente',
  get_patient_card_summary: 'Consultar resumo do paciente',
  get_clinical_history: 'Consultar prontuário',
  get_patient_system_snapshot: 'Consolidar contexto do paciente',
  get_patient_payment_status: 'Consultar situação financeira do paciente',
  get_patient_timeline: 'Montar linha do tempo do paciente',
  get_calendar: 'Consultar agenda clínica',
  get_agenda_daily_overview: 'Consultar agenda do dia',
  get_agenda_week_overview: 'Consultar agenda da semana',
  get_appointment_details: 'Consultar detalhes do atendimento',
  find_available_slots: 'Verificar horários disponíveis',
  create_appointment: 'Preparar novo agendamento',
  reschedule_appointment: 'Preparar remarcação',
  cancel_appointment: 'Preparar cancelamento',
  send_appointment_reminder: 'Preparar comunicação do atendimento',
  send_patient_email: 'Preparar e-mail pelo Gmail',
  send_email: 'Enviar e-mail',
  draft_email: 'Preparar rascunho de e-mail',
  create_patient: 'Preparar cadastro de paciente',
  update_patient: 'Preparar atualização do paciente',
  update_patient_basic_info: 'Preparar atualização cadastral',
  inactivate_patient: 'Preparar inativação do paciente',
  create_session_note: 'Preparar registro de prontuário',
  create_personal_note: 'Preparar nova nota',
  update_personal_note: 'Preparar atualização da nota',
  append_to_personal_note: 'Preparar complemento da nota',
  create_task: 'Preparar nova tarefa',
  update_task: 'Preparar atualização da tarefa',
  complete_task: 'Preparar conclusão da tarefa',
  create_financial_entry: 'Preparar lançamento financeiro',
  get_neurofinance_status: 'Consultar status do NeuroFinance',
  get_neurofinance_overview: 'Consultar NeuroFinance',
  list_neurofinance_charges: 'Consultar cobranças',
  get_neurofinance_charge: 'Consultar cobrança',
  create_neurofinance_charge: 'Preparar cobrança pelo NeuroFinance',
  list_fiscal_invoices: 'Consultar notas fiscais',
  get_fiscal_invoice: 'Consultar nota fiscal',
  create_fiscal_invoice: 'Preparar emissão de NFS-e',
  analyze_neuroview_patient_patterns: 'Analisar padrões no NeuroView',
  create_neuroflow_from_patient_history: 'Criar NeuroFlow',
  create_neuropulse_cause_effect_diagram: 'Criar diagrama no NeuroPulse',
  request_interface_action: 'Preparar ação na interface',
};

export const normalizeSynapseToolName = (value?: string) =>
  String(value || '').trim().toLowerCase();

export const humanizeSynapseTool = (toolName?: string) => {
  const normalized = normalizeSynapseToolName(toolName);
  if (!normalized) return 'Executar ação do Synapse';
  if (TOOL_LABELS[normalized]) return TOOL_LABELS[normalized];

  const label = normalized
    .replace(/^get_/, 'Consultar ')
    .replace(/^list_/, 'Listar ')
    .replace(/^search_/, 'Buscar ')
    .replace(/^create_/, 'Criar ')
    .replace(/^update_/, 'Atualizar ')
    .replace(/^send_/, 'Enviar ')
    .replace(/^open_/, 'Abrir ')
    .replace(/^analyze_/, 'Analisar ')
    .replace(/^generate_/, 'Gerar ')
    .replace(/_/g, ' ')
    .trim();

  return label ? label.charAt(0).toUpperCase() + label.slice(1) : 'Executar ação do Synapse';
};

export const integrationForSynapseTool = (
  toolName?: string,
): SynapseAgentIntegration | undefined => {
  const tool = normalizeSynapseToolName(toolName);

  if (
    tool === 'send_patient_email' ||
    tool === 'send_email' ||
    tool === 'draft_email' ||
    tool.includes('gmail')
  ) {
    return 'gmail';
  }

  if (
    tool === 'create_appointment' ||
    tool === 'reschedule_appointment' ||
    tool === 'cancel_appointment' ||
    tool.includes('google_calendar') ||
    tool.includes('calendar_event')
  ) {
    return 'google_calendar';
  }

  return undefined;
};

export const categoryForSynapseTool = (toolName?: string): SynapseAgentToolCategory => {
  const tool = normalizeSynapseToolName(toolName);
  if (!tool) return 'generic';
  if (/patient|paciente|clinical_history|prontuario/.test(tool)) return 'patient';
  if (/calendar|agenda|appointment|slot/.test(tool)) return 'calendar';
  if (/mail|email|gmail/.test(tool)) return 'mail';
  if (/finance|invoice|charge|payment|transaction|cobranca/.test(tool)) return 'finance';
  if (/document|note|history|file|prontuario/.test(tool)) return 'document';
  if (/neuroview|neuroflow|neuropulse|neurotime/.test(tool)) return 'neuro';
  if (/interface|navigate|open_|highlight/.test(tool)) return 'interface';
  if (/search|find|list|get_/.test(tool)) return 'search';
  return 'generic';
};

export const formatSynapseElapsed = (elapsedMs?: number) => {
  if (!Number.isFinite(elapsedMs) || !elapsedMs || elapsedMs < 0) return '';
  if (elapsedMs < 1000) return `${Math.max(1, Math.round(elapsedMs))} ms`;
  if (elapsedMs < 60_000) {
    const seconds = elapsedMs / 1000;
    return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)} s`.replace('.', ',');
  }
  const minutes = Math.floor(elapsedMs / 60_000);
  const seconds = Math.round((elapsedMs % 60_000) / 1000);
  return seconds ? `${minutes} min ${seconds} s` : `${minutes} min`;
};
