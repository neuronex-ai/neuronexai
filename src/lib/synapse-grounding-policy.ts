const SYSTEM_SCOPE = /\b(paciente|pacientes|consulta|consultas|agenda|agendamento|horário|horario|prontuário|prontuario|sessão|sessao|financeiro|saldo|receita|despesa|lançamento|lancamento|transação|transacao|nota|notas|documento|arquivo|medicação|medicacao|risco|cobrança|cobranca|fatura|neurofinance|neuroscan|teleconsulta|neuronotes|configuração|configuracao|integração|integracao|dashboard|synapse)\b/i;
const NEURO_SURFACE = /\b(neuroview|neuroflow|neuropulse|diagrama causal|causa e efeito|fluxograma|grafo clínico|grafo clinico)\b/i;
const OPERATION = /\b(crie|criar|gere|gerar|monte|montar|analise|analisar|abra|abrir|liste|listar|busque|buscar|consulte|consultar|agende|agendar|remarque|remarcar|cancele|cancelar|envie|enviar|registre|registrar|atualize|atualizar|emita|emitir|cobre|cobrar)\b/i;
const TOOL_OBJECT = /\b(lembrete|e-mail|email|mensagem|cobrança|cobranca|nfs-e|nfse|agendamento|registro|fluxo|diagrama)\b/i;

export const requiresCanonicalSynapseAgent = (message: string) =>
  NEURO_SURFACE.test(message) || SYSTEM_SCOPE.test(message) ||
  (OPERATION.test(message) && TOOL_OBJECT.test(message));

