export type SynapseCommandExample = {
  title: string;
  modules: string[];
  command: string;
  guardrail: string;
  status: "Disponível" | "Beta" | "Em evolução";
};

export type WorkflowMoment = {
  time: string;
  title: string;
  manualFlow: string;
  neuroNexFlow: string;
};

export type TimeGainEstimate = {
  period: "Por dia" | "Por semana" | "Por mês";
  estimate: string;
  effects: string[];
};

export const SYNAPSE_CHANNEL_DISCLOSURE =
  "O Synapse já aceita texto e voz dentro da NeuroNex. No WhatsApp Business, conexão e sincronização do NeuroZap estão em Beta; inbox, contexto avançado e ações entre módulos são liberados somente após validação. Nenhuma mensagem, registro clínico ou movimentação financeira é executada sem as confirmações exigidas pelo fluxo.";

export const SYNAPSE_COMMAND_EXAMPLES: SynapseCommandExample[] = [
  {
    title: "Evolução clínica e plano terapêutico",
    modules: ["Prontuário", "Plano terapêutico"],
    status: "Disponível",
    command:
      "Synapse, prepare a evolução do Pedro Henrique dizendo que trabalhamos exposição, que a ansiedade chegou ao nível 7 e que ele concluiu a técnica. Mantenha o plano terapêutico e deixe tudo para minha revisão antes de salvar.",
    guardrail:
      "Prepara um rascunho clínico; autoria, revisão e salvamento continuam com o psicólogo.",
  },
  {
    title: "Insight clínico e lembrete",
    modules: ["Prontuário", "Lembretes"],
    status: "Em evolução",
    command:
      "O paciente de agora trouxe insights sobre o luto do pai. Estruture um rascunho de evolução pela lente TCC e prepare um lembrete para eu retomar esse ponto na próxima sessão.",
    guardrail:
      "O texto e o lembrete ficam pendentes até a revisão e a confirmação do profissional.",
  },
  {
    title: "Pós-sessão conectado",
    modules: ["Prontuário", "Financeiro", "Comunicação"],
    status: "Em evolução",
    command:
      "Synapse, prepare a evolução da Paula sobre a reestruturação cognitiva, o lançamento financeiro da sessão e uma mensagem de recibo. Agrupe as ações para eu revisar e confirmar cada etapa.",
    guardrail:
      "Registro, baixa e comunicação preservam confirmações separadas; o canal do NeuroZap permanece sujeito ao Beta.",
  },
  {
    title: "Resumo rápido em trânsito",
    modules: ["Prontuário", "Tarefas"],
    status: "Disponível",
    command:
      "Estou chegando ao consultório. Resuma os pontos autorizados da última sessão do Roberto e as tarefas combinadas, sem alterar o prontuário.",
    guardrail:
      "É uma consulta: recupera contexto autorizado sem modificar dados.",
  },
  {
    title: "Remarcação por imprevisto",
    modules: ["Agenda", "Comunicação"],
    status: "Beta",
    command:
      "Não vou conseguir atender o Juliano hoje às 14h. Encontre meus horários livres na quinta à tarde e prepare uma mensagem com as opções, sem remarcar ou enviar antes da minha confirmação.",
    guardrail:
      "Busca horários e prepara a comunicação; a agenda e a mensagem só mudam após confirmação.",
  },
  {
    title: "Inadimplência amigável e conferência",
    modules: ["Financeiro", "Cobranças", "Comunicação"],
    status: "Beta",
    command:
      "Mostre as cobranças vencidas desta semana, confira os recebimentos disponíveis e prepare uma mensagem cordial apenas para quem continuar pendente. Mostre divergências antes de eu confirmar qualquer baixa ou envio.",
    guardrail:
      "Não presume inadimplência, não baixa valores e não envia cobranças sem revisão.",
  },
  {
    title: "Resumo financeiro semanal",
    modules: ["Agenda", "Gestão Financeira", "NeuroFinance"],
    status: "Disponível",
    command:
      "Resuma a semana com sessões realizadas, receitas registradas, despesas, valores recebidos e pendências. Separe o que veio da gestão do que veio da conta e destaque o que precisa da minha atenção.",
    guardrail:
      "Consulta fontes autorizadas e diferencia registros de gestão de movimentações reais da conta.",
  },
  {
    title: "Documento para o paciente",
    modules: ["Documentos", "Prontuário", "Comunicação"],
    status: "Em evolução",
    command:
      "Prepare o atestado solicitado pela Camila com o modelo que eu selecionei e os dados autorizados. Deixe o PDF para minha revisão e assinatura e só prepare o envio depois da aprovação.",
    guardrail:
      "Documentos psicológicos exigem revisão, responsabilidade profissional e confirmação antes do compartilhamento.",
  },
  {
    title: "Triagem e anamnese inicial",
    modules: ["Pacientes", "Anamnese", "Agenda"],
    status: "Em evolução",
    command:
      "Prepare o cadastro inicial do novo paciente, selecione a anamnese adequada e organize um link de preenchimento. Não infira diagnóstico e deixe o convite pendente para minha revisão.",
    guardrail:
      "Organiza a coleta inicial sem transformar triagem em diagnóstico ou enviar dados sem autorização.",
  },
  {
    title: "Confirmações antes da sessão",
    modules: ["Agenda", "Políticas", "Comunicação"],
    status: "Beta",
    command:
      "Liste as sessões de amanhã que ainda não foram confirmadas, aplique a política correta a cada caso e prepare lembretes objetivos. Quero revisar os destinatários e os textos antes do envio.",
    guardrail:
      "A confirmação respeita política, finalidade, destinatário e o estágio Beta do canal de WhatsApp.",
  },
];

export const ILLUSTRATIVE_WORKFLOW: WorkflowMoment[] = [
  {
    time: "08:00",
    title: "Início do dia",
    manualFlow:
      "Lucas abre agenda, comunicação e financeiro separadamente para descobrir cancelamentos, confirmações e cobranças pendentes.",
    neuroNexFlow:
      "Pergunta ao Synapse o que merece atenção. A IA consulta o contexto autorizado, reúne as pendências e propõe próximos passos para confirmação.",
  },
  {
    time: "09:00",
    title: "Pós-sessão da Mariana",
    manualFlow:
      "Escreve ou pede um texto, copia o conteúdo, abre o prontuário, salva, troca de área e cria o lançamento e a cobrança.",
    neuroNexFlow:
      "Dita uma única intenção. O Synapse prepara evolução, lançamento e cobrança como ações identificadas; Lucas revisa e confirma cada efeito sensível.",
  },
  {
    time: "14:00",
    title: "Cobrança pendente",
    manualFlow:
      "Confere a lista financeira, procura o contato e adapta uma mensagem em outro canal.",
    neuroNexFlow:
      "Pede as pendências da semana. O Synapse confere os dados disponíveis e prepara mensagens cordiais; o envio pelo NeuroZap depende de disponibilidade e confirmação.",
  },
  {
    time: "18:00",
    title: "Fechamento do dia",
    manualFlow:
      "Compara agenda, registros e extratos para montar uma visão do caixa e localizar divergências.",
    neuroNexFlow:
      "Solicita um resumo. O Synapse cruza os registros autorizados disponíveis, separa gestão de movimentação real e aponta divergências para decisão humana.",
  },
];

export const TIME_GAIN_ESTIMATES: TimeGainEstimate[] = [
  {
    period: "Por dia",
    estimate: "cenário: 35 a 50 minutos",
    effects: [
      "Premissa hipotética para simular uma rotina — não um resultado atribuído ao produto.",
      "Substitua pelo tempo que você observar em tarefas repetitivas no seu próprio dia.",
    ],
  },
  {
    period: "Por semana",
    estimate: "cenário: aprox. 3 a 4 horas",
    effects: [
      "Projeção matemática da premissa diária por cinco dias.",
      "Não representa benchmark, média de clientes ou promessa de economia.",
    ],
  },
  {
    period: "Por mês",
    estimate: "cenário: aprox. 12 a 16 horas",
    effects: [
      "Projeção matemática para quatro semanas; equivale a até dois dias de oito horas no cenário.",
      "Seriam até 16 janelas potenciais de uma hora; ocupação e faturamento não são garantidos.",
    ],
  },
];

export const TIME_GAIN_DISCLOSURE =
  "Cenário hipotético para planejamento — não é economia medida, expectativa típica nem garantia da NeuroNex. A conta usa 35 a 50 minutos por dia como uma entrada de simulação, multiplicada por cinco dias e quatro semanas. Substitua essa premissa pelo tempo observado na sua rotina; o resultado real varia conforme volume, configuração, confirmações e recursos disponíveis.";
