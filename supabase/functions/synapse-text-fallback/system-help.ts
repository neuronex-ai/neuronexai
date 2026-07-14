type HelpEntry = {
  title: string;
  keywords: string[];
  summary: string;
  capabilities: string[];
  guidance: string;
};

const CATALOG: HelpEntry[] = [
  {
    title: "Dashboard",
    keywords: ["dashboard", "início", "inicio", "resumo", "visão geral"],
    summary:
      "Centraliza os indicadores operacionais e os atalhos principais do consultório.",
    capabilities: [
      "revisar compromissos",
      "acompanhar indicadores",
      "abrir módulos",
    ],
    guidance: "Use como ponto inicial para revisar o dia.",
  },
  {
    title: "Agenda",
    keywords: [
      "agenda",
      "consulta",
      "agendamento",
      "horário",
      "disponibilidade",
    ],
    summary:
      "Gerencia consultas, bloqueios, disponibilidade, confirmações e mudanças de horário.",
    capabilities: [
      "agendar",
      "remarcar",
      "cancelar",
      "consultar horários livres",
    ],
    guidance:
      "O Synapse deve localizar o paciente pelo nome e nunca pedir identificadores internos.",
  },
  {
    title: "Pacientes e prontuário",
    keywords: ["paciente", "pacientes", "prontuário", "anamnese", "evolução"],
    summary:
      "Reúne cadastro, histórico clínico, sessões, documentos e acompanhamento.",
    capabilities: [
      "buscar pelo nome",
      "abrir cadastro",
      "consultar histórico",
      "registrar anotação",
    ],
    guidance:
      "Use o nome e o contexto humano; IDs são exclusivamente internos.",
  },
  {
    title: "Teleconsulta",
    keywords: ["teleconsulta", "vídeo", "video", "online", "chamada"],
    summary:
      "Permite conduzir sessões online vinculadas à agenda e ao paciente.",
    capabilities: ["abrir sala", "convidar paciente", "vincular sessão"],
    guidance:
      "A sessão deve estar associada ao paciente e ao compromisso corretos.",
  },
  {
    title: "NeuroNotes",
    keywords: ["neuronotes", "nota", "notas", "anotação"],
    summary:
      "Área de notas pessoais e operacionais do profissional, separada do prontuário.",
    capabilities: ["criar notas", "buscar conteúdo", "organizar referências"],
    guidance:
      "Registros clínicos pertencem ao prontuário; notas pessoais ficam no NeuroNotes.",
  },
  {
    title: "NeuroView",
    keywords: [
      "neuroview",
      "grafo",
      "conexões",
      "padrões",
      "visualização clínica",
    ],
    summary:
      "Visualiza conexões entre pacientes, notas e evidências para apoiar a leitura de padrões clínicos.",
    capabilities: [
      "analisar padrões por paciente",
      "destacar evidências",
      "abrir a leitura assistida",
    ],
    guidance:
      "Peça a análise pelo nome do paciente; o Synapse consulta os vínculos reais antes de responder.",
  },
  {
    title: "NeuroFlow",
    keywords: ["neuroflow", "fluxo", "mapa clínico", "hipóteses", "ciclos"],
    summary:
      "Organiza o histórico de um paciente em um mapa editável de hipóteses, ciclos e intervenções.",
    capabilities: [
      "criar um fluxo pelo histórico",
      "vincular evidências",
      "salvar e abrir o mapa",
    ],
    guidance:
      "A criação exige confirmação explícita antes de gravar o novo fluxo.",
  },
  {
    title: "NeuroPulse",
    keywords: [
      "neuropulse",
      "causa e efeito",
      "diagrama",
      "fluxograma",
      "síntese visual",
    ],
    summary:
      "Transforma um relato e o contexto clínico em um diagrama de causa e efeito vinculado ao paciente.",
    capabilities: [
      "escolher uma lente clínica",
      "gerar o diagrama",
      "salvar a síntese visual",
    ],
    guidance:
      "A criação exige confirmação e nunca substitui a validação profissional.",
  },
  {
    title: "Gestão Financeira",
    keywords: [
      "gestão financeira",
      "fluxo de caixa",
      "receita",
      "despesa",
      "inadimplência",
      "relatório",
    ],
    summary:
      "Controla receitas, despesas, fluxo de caixa, cobranças e relatórios gerenciais.",
    capabilities: [
      "registrar lançamentos",
      "acompanhar pendências",
      "consultar indicadores",
    ],
    guidance: "Pode funcionar independentemente da conta digital NeuroFinance.",
  },
  {
    title: "NeuroFinance",
    keywords: [
      "neurofinance",
      "pix",
      "boleto",
      "saldo",
      "conta digital",
      "saque",
      "transferência",
    ],
    summary:
      "Camada transacional com saldo real, Pix, boletos, pagamentos e transferências.",
    capabilities: [
      "consultar saldo",
      "receber",
      "pagar",
      "transferir",
      "emitir cobrança",
    ],
    guidance:
      "Operações reais exigem validações e confirmação antes da execução.",
  },
  {
    title: "Documentos e NeuroScan",
    keywords: ["documento", "arquivo", "neuroscan", "pdf", "upload"],
    summary:
      "Gerencia arquivos privados e processamento documental com vínculo opcional ao paciente.",
    capabilities: [
      "enviar arquivos",
      "listar documentos",
      "associar ao paciente",
      "processar conteúdo",
    ],
    guidance:
      "Conteúdo clínico só deve ser acessado quando necessário e autorizado.",
  },
  {
    title: "Synapse",
    keywords: ["synapse", "assistente", "ia", "agente", "voz", "chat"],
    summary:
      "Camada inteligente que consulta dados, executa tarefas e navega pela interface.",
    capabilities: [
      "consultar o sistema",
      "executar tarefas",
      "navegar",
      "responder por texto e voz",
    ],
    guidance:
      "O agente deve operar com nomes e contexto humano, sem expor detalhes técnicos.",
  },
  {
    title: "Configurações e integrações",
    keywords: [
      "configuração",
      "integração",
      "google",
      "whatsapp",
      "notion",
    ],
    summary:
      "Concentra preferências, segurança, notificações e integrações externas.",
    capabilities: [
      "conectar serviços",
      "ajustar preferências",
      "gerenciar notificações",
    ],
    guidance:
      "O Synapse deve orientar pela linguagem da interface, nunca por rotas técnicas.",
  },
];

const normalize = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function getSystemHelp(query: unknown) {
  const normalized = normalize(query);
  const ranked = CATALOG
    .map((entry) => {
      const haystack = normalize(
        [entry.title, ...entry.keywords, entry.summary].join(" "),
      );
      const score = entry.keywords.filter((keyword) =>
            normalized.includes(normalize(keyword))
          ).length * 10 +
        normalized.split(/\s+/).filter((token) =>
          token.length > 3 && haystack.includes(token)
        ).length;
      return { entry, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.entry);

  return { entries: ranked.length ? ranked : CATALOG.slice(0, 4) };
}

export function formatSystemHelp(result: ReturnType<typeof getSystemHelp>) {
  return result.entries.map((entry) =>
    [
      `**${entry.title}**`,
      entry.summary,
      "",
      "O que você pode fazer:",
      ...entry.capabilities.map((item) => `- ${item}`),
      "",
      `Orientação: ${entry.guidance}`,
    ].join("\n")
  ).join("\n\n");
}
