import {
  ILLUSTRATIVE_WORKFLOW,
  TIME_GAIN_DISCLOSURE,
  TIME_GAIN_ESTIMATES,
} from "./public-positioning.ts";

export const COMPARISON_REVIEWED_AT = "2026-07";
export const COMPARISON_MODIFIED_AT = "2026-07-26";

export type ComparisonSlug =
  | "neuronex-vs-psicomanager"
  | "neuronex-vs-psicogest"
  | "neuronex-vs-corpora"
  | "neuronex-vs-sintropia"
  | "neuronex-vs-psipront"
  | "neuronex-vs-terabase"
  | "neuronex-vs-psinexus";

export type ComparisonFaq = {
  question: string;
  answer: string;
};

export type ComparisonLink = {
  label: string;
  href: string;
  description: string;
};

export type ComparisonRow = {
  topic: string;
  competitorPerspective: string;
  neuroNexPerspective: string;
  relatedHref?: string;
};

export type ComparisonDefinition = {
  slug: ComparisonSlug;
  route: `/comparar/${ComparisonSlug}`;
  competitor: string;
  seoTitle: string;
  description: string;
  keywords: string[];
  heroText: string;
  competitorAdvantage: string;
  competitorBestUse: string;
  neuroNexAdvantage: string;
  neuroNexBestUse: string;
  competitorStrengths: string[];
  competitorRecognition: string;
  neuroNexDifference: string;
  comparisonRows: ComparisonRow[];
  chooseCompetitorIf: string[];
  chooseNeuroNexIf: string[];
  faq: ComparisonFaq[];
  related: ComparisonLink[];
  reviewedAt: typeof COMPARISON_REVIEWED_AT;
};

export const COMPARISON_INDEX_META = {
  route: "/comparar",
  seoTitle: "Compare sistemas para psicólogos | NeuroNex",
  description:
    "Compare o foco de sistemas para psicólogos e entenda qual proposta combina melhor com sua agenda, prontuário, financeiro, comunicação e rotina clínica.",
  keywords: [
    "comparar sistemas para psicólogos",
    "sistema para psicólogos",
    "agenda e prontuário para psicólogos",
    "gestão de consultório de psicologia",
  ],
  reviewedAt: COMPARISON_REVIEWED_AT,
} as const;

const sharedRelated: ComparisonLink[] = [
  {
    label: "Conhecer a NeuroNex",
    href: "/produto",
    description: "Veja como as partes do consultório trabalham juntas.",
  },
  {
    label: "Agenda conectada",
    href: "/agenda-para-psicologos",
    description: "Entenda como a agenda participa do restante da rotina.",
  },
  {
    label: "Prontuário para psicólogos",
    href: "/prontuario-para-psicologos",
    description: "Conheça a proposta de registro clínico da NeuroNex.",
  },
  {
    label: "Teleconsulta conectada",
    href: "/teleconsulta-para-psicologos",
    description: "Veja como o atendimento continua nas etapas seguintes.",
  },
  {
    label: "IA com controle humano",
    href: "/synapse",
    description: "Veja como o Synapse prepara ações e pede sua confirmação.",
  },
  {
    label: "Financeiro conectado",
    href: "/neurofinance",
    description: "Conheça a continuidade entre atendimento e financeiro.",
  },
  {
    label: "Segurança e ética",
    href: "/seguranca-e-etica",
    description: "Leia sobre contexto autorizado, controle e proteção.",
  },
  {
    label: "Conteúdo no NeuroX",
    href: "/blog",
    description: "Aprofunde decisões sobre clínica, operação, IA e dinheiro.",
  },
];

export const COMPARISONS: ComparisonDefinition[] = [
  {
    slug: "neuronex-vs-psicomanager",
    route: "/comparar/neuronex-vs-psicomanager",
    competitor: "PsicoManager",
    seoTitle: "NeuroNex vs PsicoManager: qual sistema escolher?",
    description:
      "Compare NeuroNex e PsicoManager. Veja o foco de cada sistema, suas principais vantagens e qual proposta combina melhor com sua rotina clínica.",
    keywords: [
      "NeuroNex vs PsicoManager",
      "alternativa ao PsicoManager",
      "sistema para psicólogos",
      "gestão de clínica de psicologia",
    ],
    heroText:
      "Os dois sistemas ajudam psicólogos a organizar a rotina, mas seguem propostas diferentes. Veja qual combina melhor com o tipo de operação que você procura.",
    competitorAdvantage:
      "Plataforma consolidada, com gestão ampla para profissionais e clínicas.",
    competitorBestUse:
      "Uma estrutura tradicional que reúne agenda, prontuário, financeiro, aplicativo do paciente e recursos de IA.",
    neuroNexAdvantage:
      "Agenda, atendimento, paciente, documentos, cobranças, financeiro e IA participam do mesmo fluxo.",
    neuroNexBestUse:
      "Consultórios que querem conectar a rotina clínica e administrativa, com decisões sensíveis mantidas sob controle humano.",
    competitorStrengths: [
      "Plataforma consolidada",
      "Gestão ampla",
      "Agenda",
      "Prontuário",
      "Financeiro",
      "Aplicativo do paciente",
      "Recursos de IA",
      "Suporte para profissionais e clínicas",
    ],
    competitorRecognition:
      "O PsicoManager é uma plataforma consolidada para organizar a gestão de profissionais e clínicas. Sua proposta reúne áreas importantes da rotina em uma estrutura tradicional de gestão.",
    neuroNexDifference:
      "A NeuroNex segue uma proposta diferente. Em vez de apresentar agenda, prontuário, paciente, documentos e financeiro apenas como áreas da mesma plataforma, ela foi projetada para manter a continuidade entre essas etapas. A IA trabalha com contexto autorizado, prepara ações e pede confirmação antes de mudanças sensíveis.",
    comparisonRows: [
      {
        topic: "Gestão da rotina",
        competitorPerspective:
          "Gestão ampla e consolidada para profissionais e clínicas.",
        neuroNexPerspective:
          "Uma operação conectada para a rotina clínica e administrativa do consultório.",
        relatedHref: "/produto",
      },
      {
        topic: "Agenda e atendimento",
        competitorPerspective:
          "A agenda faz parte da estrutura de gestão oferecida pela plataforma.",
        neuroNexPerspective:
          "A agenda inicia um fluxo que continua na confirmação, no atendimento e nas etapas seguintes.",
        relatedHref: "/agenda-para-psicologos",
      },
      {
        topic: "Prontuário",
        competitorPerspective:
          "O prontuário está entre os recursos centrais da plataforma.",
        neuroNexPerspective:
          "O registro clínico participa da continuidade com atendimento, paciente e documentos.",
        relatedHref: "/prontuario-para-psicologos",
      },
      {
        topic: "Paciente",
        competitorPerspective:
          "A proposta inclui um aplicativo do paciente.",
        neuroNexPerspective:
          "O paciente continua sua relação com o consultório pelo portal e pelos fluxos autorizados.",
        relatedHref: "/portal-do-paciente",
      },
      {
        topic: "Financeiro",
        competitorPerspective:
          "O financeiro integra a gestão ampla oferecida pelo sistema.",
        neuroNexPerspective:
          "Cobrança, recebimento e acompanhamento financeiro permanecem ligados ao atendimento.",
        relatedHref: "/neurofinance",
      },
      {
        topic: "Inteligência artificial",
        competitorPerspective:
          "A plataforma apresenta recursos de IA entre suas capacidades.",
        neuroNexPerspective:
          "A proposta do Synapse distingue consulta, rascunho, ação pendente e execução confirmada, sempre com contexto autorizado.",
        relatedHref: "/synapse",
      },
    ],
    chooseCompetitorIf: [
      "Você procura uma plataforma consolidada.",
      "Prefere uma estrutura tradicional de gestão para profissionais ou clínicas.",
      "Quer reunir agenda, prontuário, financeiro, aplicativo do paciente e recursos de IA.",
    ],
    chooseNeuroNexIf: [
      "Você procura uma operação em que atendimento, paciente, documentos, financeiro e IA compartilham o mesmo fluxo.",
      "Quer reduzir a troca de contexto entre diferentes partes da rotina.",
      "Prefere que ações sensíveis preparadas pela IA dependam de confirmação humana.",
    ],
    faq: [
      {
        question: "Qual é melhor para psicólogos autônomos?",
        answer:
          "Depende da rotina que você quer montar. O PsicoManager faz sentido para quem procura uma plataforma consolidada com estrutura tradicional de gestão. A NeuroNex faz mais sentido quando a prioridade é manter atendimento, paciente, documentos, financeiro e IA no mesmo fluxo.",
      },
      {
        question: "Qual possui inteligência artificial?",
        answer:
          "As informações consideradas nesta comparação indicam recursos de IA no PsicoManager. Na NeuroNex, a proposta do Synapse distingue consulta, rascunho, ação pendente e execução confirmada; decisões clínicas continuam humanas.",
      },
      {
        question: "Qual ajuda mais na agenda?",
        answer:
          "Os dois tratam a agenda como parte da rotina. A escolha depende do uso: o PsicoManager a inclui em sua gestão ampla; a NeuroNex enfatiza a continuidade da agenda com confirmação, atendimento e etapas posteriores.",
      },
      {
        question: "Qual conecta prontuário e financeiro?",
        answer:
          "Os dois apresentam prontuário e financeiro em suas propostas. Esta comparação não mede tecnicamente o nível de integração do PsicoManager. A proposta da NeuroNex é manter o contexto clínico e o fluxo financeiro ligados à mesma operação.",
      },
      {
        question: "Vale a pena trocar de sistema?",
        answer:
          "A troca faz sentido quando o sistema atual aumenta o retrabalho ou não acompanha a forma como você opera. Compare também suporte, adaptação da equipe, preservação dos registros e recursos realmente disponíveis antes de decidir.",
      },
      {
        question: "A NeuroNex importa dados de outro sistema?",
        answer:
          "Esta comparação não promete importação automática. Antes de trocar, fale com a equipe da NeuroNex para avaliar os dados que precisam ser preservados e as opções disponíveis para o seu caso.",
      },
    ],
    related: sharedRelated,
    reviewedAt: COMPARISON_REVIEWED_AT,
  },
  {
    slug: "neuronex-vs-psicogest",
    route: "/comparar/neuronex-vs-psicogest",
    competitor: "PsicoGest",
    seoTitle: "NeuroNex vs PsicoGest: comparação para psicólogos",
    description:
      "Compare NeuroNex e PsicoGest em agenda, prontuário, teleatendimento, documentos, financeiro, IA, planos e continuidade da operação clínica.",
    keywords: [
      "NeuroNex vs PsicoGest",
      "alternativa ao PsicoGest",
      "PsicoGest para psicólogos",
      "sistema com IA para psicólogos",
    ],
    heroText:
      "A PsicoGest apresenta gestão clínica organizada por planos. A NeuroNex propõe um sistema operacional que conecta produtos, contexto e IA governada. Compare o fluxo, não só a lista de recursos.",
    competitorAdvantage:
      "Planos graduais com agenda, prontuário, teleatendimento, financeiro, documentos e recursos adicionais conforme a contratação.",
    competitorBestUse:
      "Profissionais ou clínicas que procuram uma base tradicional de gestão e querem ampliar a cobertura por nível de plano.",
    neuroNexAdvantage:
      "Agenda, paciente, atendimento, prontuário, documentos, financeiro e Synapse participam de uma operação conectada.",
    neuroNexBestUse:
      "Profissionais que querem reduzir passagens manuais entre módulos e manter ações sensíveis sob revisão e confirmação.",
    competitorStrengths: [
      "Planos graduais",
      "Prontuário eletrônico",
      "Agenda",
      "Teleatendimento",
      "Financeiro e documentos",
      "Recursos de IA conforme o plano",
    ],
    competitorRecognition:
      "A PsicoGest apresenta uma plataforma clínica com entrada por planos e reúne recursos tradicionais importantes, como agenda, prontuário, teleatendimento, financeiro e documentos. A cobertura exata deve ser confirmada no nível contratado.",
    neuroNexDifference:
      "A NeuroNex organiza essas áreas como partes de um sistema operacional. O Synapse consulta contexto autorizado e prepara ações entre domínios; registros, comunicações e dinheiro continuam sujeitos às confirmações aplicáveis.",
    comparisonRows: [
      {
        topic: "Modelo de produto",
        competitorPerspective:
          "A cobertura cresce por planos, com recursos clínicos e administrativos conforme a contratação.",
        neuroNexPerspective:
          "Os módulos são apresentados como produtos de uma mesma operação conectada.",
        relatedHref: "/produto",
      },
      {
        topic: "Agenda e atendimento",
        competitorPerspective:
          "Agenda, lembretes, comunicação e teleatendimento aparecem na proposta consultada.",
        neuroNexPerspective:
          "Agenda e teleconsulta preservam o vínculo com paciente, revisão, prontuário e etapas posteriores.",
        relatedHref: "/teleconsulta-para-psicologos",
      },
      {
        topic: "Prontuário e documentos",
        competitorPerspective:
          "Prontuário eletrônico, documentos e upload compõem a base clínica apresentada.",
        neuroNexPerspective:
          "Histórico, notas, documentos, anexos e NeuroBox permanecem ligados ao paciente e à autoria profissional.",
        relatedHref: "/prontuario-para-psicologos",
      },
      {
        topic: "Inteligência artificial",
        competitorPerspective:
          "Rascunho de laudo, resumo clínico e outros recursos podem variar por plano.",
        neuroNexPerspective:
          "O Synapse distingue consulta, rascunho, ação pendente e execução confirmada.",
        relatedHref: "/synapse",
      },
      {
        topic: "Financeiro",
        competitorPerspective:
          "Recibos, dados para NFS-e, relatórios e recursos financeiros variam por plano.",
        neuroNexPerspective:
          "Gestão gerencial e NeuroFinance têm papéis separados, com movimentações reais sujeitas à elegibilidade e confirmação.",
        relatedHref: "/neurofinance",
      },
      {
        topic: "Forma de avaliar",
        competitorPerspective:
          "É importante confirmar cobertura, limites e preço do plano adequado ao cenário.",
        neuroNexPerspective:
          "É importante confirmar o status público de cada fluxo e as ferramentas que a operação conectada substitui.",
        relatedHref: "/download",
      },
    ],
    chooseCompetitorIf: [
      "Você prefere uma plataforma clínica tradicional organizada por planos graduais.",
      "Teleatendimento, prontuário, agenda e documentos cobrem a sua prioridade principal.",
      "A cobertura e os limites do plano escolhido combinam com seu orçamento e rotina.",
    ],
    chooseNeuroNexIf: [
      "Você quer tratar agenda, paciente, prontuário, documentos e financeiro como uma operação contínua.",
      "Precisa de IA que consulte contexto e prepare ações com estados e confirmações visíveis.",
      "Quer diferenciar gestão financeira de movimentação real em uma infraestrutura elegível.",
    ],
    faq: [
      {
        question: "A PsicoGest tem inteligência artificial?",
        answer:
          "As informações consideradas nesta comparação listam rascunho de laudo, resumo clínico e outros recursos que podem variar por plano. Confirme a cobertura atual diretamente com a PsicoGest.",
      },
      {
        question: "Qual tem teleconsulta?",
        answer:
          "As duas propostas apresentam teleatendimento ou teleconsulta. Compare estabilidade, consentimento, convite do paciente, revisão e comportamento em falhas.",
      },
      {
        question: "Qual conecta prontuário e financeiro?",
        answer:
          "As duas apresentam recursos clínicos e financeiros. Esta página não mede tecnicamente o nível de integração da PsicoGest. Na NeuroNex, a continuidade entre paciente, atendimento, cobrança e financeiro é parte da proposta central.",
      },
      {
        question: "A NeuroNex é mais cara?",
        answer:
          "O valor do plano Professional é superior ao preço inicial citado no material consultado da PsicoGest; a NeuroNex também apresenta um plano Essential gratuito. Compare cobertura, limites e custo das ferramentas externas que continuam necessárias.",
      },
      {
        question: "Vale a pena trocar de sistema?",
        answer:
          "A troca merece avaliação quando passagens manuais, contexto perdido ou ferramentas paralelas pesam mais que a adaptação. Teste o fluxo completo e confirme exportação, suporte e preservação do histórico.",
      },
      {
        question: "A NeuroNex importa dados da PsicoGest?",
        answer:
          "Esta comparação não promete importação automática. Converse com a equipe da NeuroNex para avaliar quais dados precisam ser preservados e as opções disponíveis.",
      },
    ],
    related: sharedRelated,
    reviewedAt: COMPARISON_REVIEWED_AT,
  },
  {
    slug: "neuronex-vs-corpora",
    route: "/comparar/neuronex-vs-corpora",
    competitor: "Corpora",
    seoTitle: "NeuroNex vs Corpora: compare os sistemas para psicólogos",
    description:
      "Compare NeuroNex e Corpora: entrada, agenda, prontuário, cobranças, IA para documentação e a forma como cada proposta organiza a clínica.",
    keywords: [
      "NeuroNex vs Corpora",
      "alternativa ao Corpora",
      "sistema gratuito para psicólogos",
      "agenda e prontuário para psicólogos",
    ],
    heroText:
      "Corpora e NeuroNex ajudam a organizar o consultório, mas partem de prioridades diferentes. Compare a entrada simples com uma operação projetada para manter as áreas conectadas.",
    competitorAdvantage:
      "Entrada simples, plano gratuito e organização rápida da rotina.",
    competitorBestUse:
      "Quem quer começar por agenda, página de agendamento, prontuário, cobranças e financeiro com uma experiência simples.",
    neuroNexAdvantage:
      "As tarefas não terminam em módulos separados: agenda, atendimento, paciente, documentos e financeiro continuam no mesmo fluxo.",
    neuroNexBestUse:
      "Quem quer conectar a operação inteira do consultório e manter a IA sob decisão profissional.",
    competitorStrengths: [
      "Entrada simples",
      "Plano gratuito",
      "Agenda",
      "Página de agendamento",
      "Prontuário",
      "Financeiro",
      "WhatsApp",
      "Cobranças",
      "Inteligência artificial para documentação",
    ],
    competitorRecognition:
      "O Corpora favorece uma entrada simples na gestão do consultório. Reúne agenda, página de agendamento, prontuário, financeiro, WhatsApp, cobranças e inteligência artificial para documentação, além de oferecer plano gratuito.",
    neuroNexDifference:
      "A NeuroNex não se limita a organizar tarefas separadas. Sua proposta é conectar toda a operação da clínica, para que agenda, atendimento, paciente, documentação, cobrança e financeiro mantenham continuidade. A IA prepara e organiza, mas o profissional continua no controle.",
    comparisonRows: [
      {
        topic: "Começo de uso",
        competitorPerspective:
          "Entrada simples e plano gratuito para organizar rapidamente tarefas essenciais.",
        neuroNexPerspective:
          "Entrada em um sistema operacional que conecta a rotina clínica e administrativa.",
        relatedHref: "/download",
      },
      {
        topic: "Agenda",
        competitorPerspective:
          "Agenda e página de agendamento estão entre os pontos centrais da proposta.",
        neuroNexPerspective:
          "A agenda se conecta à confirmação, ao atendimento e às etapas posteriores da operação.",
        relatedHref: "/agenda-para-psicologos",
      },
      {
        topic: "Prontuário e documentação",
        competitorPerspective:
          "Prontuário e IA para documentação ajudam a organizar os registros.",
        neuroNexPerspective:
          "Documentação e prontuário usam contexto autorizado e permanecem ligados ao paciente e ao atendimento.",
        relatedHref: "/prontuario-para-psicologos",
      },
      {
        topic: "Cobranças e financeiro",
        competitorPerspective:
          "Cobranças e financeiro fazem parte do conjunto de recursos.",
        neuroNexPerspective:
          "A cobrança fica vinculada ao atendimento e o recebimento continua no acompanhamento financeiro.",
        relatedHref: "/neurofinance",
      },
      {
        topic: "Comunicação",
        competitorPerspective:
          "WhatsApp aparece como parte da organização da rotina.",
        neuroNexPerspective:
          "A conexão do NeuroZap está em Beta; inbox, contexto avançado e vínculo com o Synapse seguem em evolução.",
        relatedHref: "/neurozap-para-psicologos",
      },
      {
        topic: "Inteligência artificial",
        competitorPerspective:
          "A IA tem foco informado na documentação.",
        neuroNexPerspective:
          "O Synapse consulta e prepara ações em diferentes etapas, com confirmação para mudanças sensíveis.",
        relatedHref: "/synapse",
      },
    ],
    chooseCompetitorIf: [
      "Você quer organizar agenda, prontuário e cobranças rapidamente.",
      "Valoriza uma experiência simples para começar.",
      "Um plano gratuito é importante na sua escolha inicial.",
    ],
    chooseNeuroNexIf: [
      "Você não quer apenas organizar tarefas separadas, mas conectar toda a operação da clínica.",
      "Quer continuidade entre atendimento, paciente, documentos, cobrança e financeiro.",
      "Prefere IA com contexto autorizado e confirmação humana para ações sensíveis.",
    ],
    faq: [
      {
        question: "Qual é melhor para psicólogos autônomos?",
        answer:
          "O Corpora pode fazer sentido para quem prioriza uma entrada simples e rápida. A NeuroNex tende a combinar melhor com quem quer organizar desde cedo uma operação conectada entre clínica, paciente, documentos, cobrança, financeiro e IA.",
      },
      {
        question: "Qual possui inteligência artificial?",
        answer:
          "O Corpora apresenta inteligência artificial para documentação. Na NeuroNex, o Synapse consulta contexto autorizado, prepara ações e pede confirmação antes de executar mudanças sensíveis.",
      },
      {
        question: "Qual ajuda mais na agenda?",
        answer:
          "O Corpora destaca agenda e página de agendamento em uma experiência simples. A NeuroNex enfatiza o que acontece depois: confirmação, atendimento, documentação, cobrança e acompanhamento continuam conectados.",
      },
      {
        question: "Qual conecta prontuário e financeiro?",
        answer:
          "O Corpora inclui prontuário e financeiro. Esta página não afirma um nível específico de integração entre eles. A NeuroNex foi projetada para manter essas áreas dentro da continuidade da mesma operação.",
      },
      {
        question: "Vale a pena trocar de sistema?",
        answer:
          "Considere trocar se a simplicidade atual já não acompanha o número de etapas da sua rotina ou se a separação entre ferramentas gera retrabalho. Antes, confira adaptação, suporte, preservação de dados e recursos disponíveis.",
      },
      {
        question: "A NeuroNex importa dados de outro sistema?",
        answer:
          "Esta comparação não promete importação automática. Fale com a equipe da NeuroNex para avaliar os dados que precisam ser preservados e as opções disponíveis para o seu caso.",
      },
    ],
    related: sharedRelated,
    reviewedAt: COMPARISON_REVIEWED_AT,
  },
  {
    slug: "neuronex-vs-sintropia",
    route: "/comparar/neuronex-vs-sintropia",
    competitor: "Sintropia",
    seoTitle: "NeuroNex vs Sintropia: comparação para psicólogos",
    description:
      "Entenda as diferenças entre NeuroNex e Sintropia: experiência clínica, notas assistidas, organização das sessões e conexão com a operação do consultório.",
    keywords: [
      "NeuroNex vs Sintropia",
      "alternativa ao Sintropia",
      "notas clínicas assistidas",
      "sistema para psicólogos",
    ],
    heroText:
      "Os dois sistemas apoiam a rotina clínica, mas organizam essa ajuda de maneiras diferentes. Compare uma experiência acolhedora para sessões com uma operação conectada de ponta a ponta.",
    competitorAdvantage:
      "Experiência clínica acolhedora, com organização de sessões, Smart Notes, LUMA e revisão humana.",
    competitorBestUse:
      "Psicólogos que valorizam uma experiência clínica simples e notas assistidas.",
    neuroNexAdvantage:
      "O contexto clínico continua conectado ao paciente, aos documentos, ao financeiro e às demais etapas do consultório.",
    neuroNexBestUse:
      "Profissionais que querem unir a experiência do atendimento à operação clínica e administrativa.",
    competitorStrengths: [
      "Experiência clínica acolhedora",
      "Agenda",
      "Prontuário",
      "Financeiro",
      "Smart Notes",
      "LUMA",
      "Organização de sessões",
      "Revisão humana",
    ],
    competitorRecognition:
      "O Sintropia valoriza uma experiência clínica acolhedora e simples. Agenda, prontuário, financeiro, Smart Notes, LUMA, organização de sessões e revisão humana compõem a proposta considerada nesta comparação.",
    neuroNexDifference:
      "A NeuroNex amplia a continuidade para além da sessão. O contexto autorizado pode acompanhar o atendimento até o paciente, os documentos, as cobranças e o financeiro, sem transferir a decisão clínica para a inteligência artificial.",
    comparisonRows: [
      {
        topic: "Experiência clínica",
        competitorPerspective:
          "A proposta enfatiza uma experiência acolhedora e simples para a prática clínica.",
        neuroNexPerspective:
          "A experiência clínica faz parte de uma operação que também conecta paciente, documentos e financeiro.",
        relatedHref: "/produto",
      },
      {
        topic: "Sessões",
        competitorPerspective:
          "A organização das sessões é um dos focos apresentados.",
        neuroNexPerspective:
          "O atendimento mantém continuidade com agenda, registro, cobrança e acompanhamento.",
        relatedHref: "/teleconsulta-para-psicologos",
      },
      {
        topic: "Notas e prontuário",
        competitorPerspective:
          "Smart Notes, prontuário e revisão humana apoiam a documentação clínica.",
        neuroNexPerspective:
          "Prontuário e documentos permanecem conectados ao contexto autorizado do paciente e do atendimento.",
        relatedHref: "/prontuario-para-psicologos",
      },
      {
        topic: "Financeiro",
        competitorPerspective:
          "O financeiro aparece entre as áreas oferecidas pelo sistema.",
        neuroNexPerspective:
          "Cobrança e recebimento continuam vinculados ao fluxo do atendimento.",
        relatedHref: "/neurofinance",
      },
      {
        topic: "Assistência e controle",
        competitorPerspective:
          "LUMA, Smart Notes e revisão humana formam parte da experiência assistida.",
        neuroNexPerspective:
          "A proposta do Synapse distingue consulta, rascunho, ação pendente e execução confirmada.",
        relatedHref: "/synapse",
      },
      {
        topic: "Continuidade",
        competitorPerspective:
          "O foco apresentado está na experiência clínica e na organização das sessões.",
        neuroNexPerspective:
          "A continuidade alcança as demais áreas da operação do consultório.",
        relatedHref: "/produto",
      },
    ],
    chooseCompetitorIf: [
      "Você valoriza uma experiência clínica simples e acolhedora.",
      "Notas assistidas e organização das sessões estão no centro da sua escolha.",
      "Smart Notes, LUMA e revisão humana combinam com sua forma de trabalhar.",
    ],
    chooseNeuroNexIf: [
      "Você quer conectar o contexto clínico às demais áreas, como paciente, documentos e financeiro.",
      "Procura continuidade entre o que acontece antes, durante e depois do atendimento.",
      "Quer assistência de IA sem abrir mão da decisão clínica humana.",
    ],
    faq: [
      {
        question: "Qual é melhor para psicólogos autônomos?",
        answer:
          "O Sintropia faz sentido para quem prioriza uma experiência clínica simples, notas assistidas e organização das sessões. A NeuroNex faz mais sentido quando essas etapas também precisam continuar conectadas ao paciente, aos documentos, às cobranças e ao financeiro.",
      },
      {
        question: "Qual possui inteligência artificial?",
        answer:
          "As informações consideradas destacam Smart Notes e LUMA no Sintropia. Na NeuroNex, o Synapse usa contexto autorizado para consultar e preparar ações, mantendo decisões clínicas com o psicólogo e exigindo confirmação em ações sensíveis.",
      },
      {
        question: "Qual ajuda mais na agenda?",
        answer:
          "O Sintropia inclui agenda e organização das sessões. A NeuroNex conecta a agenda ao atendimento e às etapas clínicas e administrativas que vêm depois. A melhor escolha depende de onde está o maior atrito da sua rotina.",
      },
      {
        question: "Qual conecta prontuário e financeiro?",
        answer:
          "O Sintropia apresenta prontuário e financeiro. Esta comparação não atribui um nível específico de integração entre eles. A NeuroNex assume essa continuidade como parte central de sua proposta.",
      },
      {
        question: "Vale a pena trocar de sistema?",
        answer:
          "Trocar pode ajudar quando a experiência de sessão funciona, mas as etapas anteriores e posteriores continuam dispersas. Avalie também adaptação, suporte, preservação de registros e disponibilidade real dos recursos.",
      },
      {
        question: "A NeuroNex importa dados de outro sistema?",
        answer:
          "Esta página não promete importação automática. Converse com a equipe da NeuroNex para avaliar quais dados precisam ser preservados e quais opções existem para o seu cenário.",
      },
    ],
    related: sharedRelated,
    reviewedAt: COMPARISON_REVIEWED_AT,
  },
  {
    slug: "neuronex-vs-psipront",
    route: "/comparar/neuronex-vs-psipront",
    competitor: "Psipront",
    seoTitle: "NeuroNex vs Psipront: qual combina com sua rotina?",
    description:
      "Compare NeuroNex e Psipront em proposta, rotina clínica, prontuário, agenda, financeiro, Receita Saúde, transcrição e integração da operação.",
    keywords: [
      "NeuroNex vs Psipront",
      "alternativa ao Psipront",
      "sistema acessível para psicólogos",
      "prontuário com inteligência artificial",
    ],
    heroText:
      "Psipront e NeuroNex atendem prioridades diferentes. Veja quando recursos essenciais e preço acessível fazem mais sentido e quando vale buscar uma operação mais ampla e conectada.",
    competitorAdvantage:
      "Recursos essenciais da rotina com preço acessível e inteligência artificial.",
    competitorBestUse:
      "Quem prioriza prontuário, agenda, financeiro, Receita Saúde e transcrição com menor barreira de custo.",
    neuroNexAdvantage:
      "Uma estrutura mais ampla, com conexão entre várias áreas da clínica e controle profissional sobre a IA.",
    neuroNexBestUse:
      "Quem avalia valor pela operação integrada, e não apenas por uma função isolada ou pelo menor preço.",
    competitorStrengths: [
      "Preço acessível",
      "Prontuário",
      "Agenda",
      "Financeiro",
      "Receita Saúde",
      "Transcrição",
    ],
    competitorRecognition:
      "O Psipront concentra recursos essenciais da rotina com preço acessível. Prontuário, agenda, financeiro, Receita Saúde e transcrição formam a proposta considerada nesta página.",
    neuroNexDifference:
      "A NeuroNex propõe uma estrutura mais ampla, em que as áreas da clínica compartilham contexto e continuidade. O valor está em conectar atendimento, paciente, documentos, cobrança, financeiro e IA, sem prometer economia por números que dependem de cada consultório.",
    comparisonRows: [
      {
        topic: "Critério de entrada",
        competitorPerspective:
          "Preço acessível e recursos essenciais são pontos centrais da proposta.",
        neuroNexPerspective:
          "O valor é apresentado pela conexão entre várias ferramentas e etapas da operação.",
        relatedHref: "/download",
      },
      {
        topic: "Agenda",
        competitorPerspective:
          "A agenda faz parte do conjunto essencial para a rotina.",
        neuroNexPerspective:
          "A agenda continua na confirmação, no atendimento e nos fluxos ligados ao paciente.",
        relatedHref: "/agenda-para-psicologos",
      },
      {
        topic: "Prontuário",
        competitorPerspective:
          "O prontuário está no centro dos recursos oferecidos.",
        neuroNexPerspective:
          "O prontuário participa de uma operação conectada com atendimento, documentos e paciente.",
        relatedHref: "/prontuario-para-psicologos",
      },
      {
        topic: "Financeiro e fiscal",
        competitorPerspective:
          "Financeiro e Receita Saúde fazem parte da proposta.",
        neuroNexPerspective:
          "Cobrança, recebimento e acompanhamento financeiro permanecem ligados ao atendimento.",
        relatedHref: "/neurofinance",
      },
      {
        topic: "Transcrição e IA",
        competitorPerspective:
          "Transcrição e inteligência artificial apoiam a rotina essencial.",
        neuroNexPerspective:
          "A IA usa contexto autorizado, prepara ações e pede confirmação antes de mudanças sensíveis.",
        relatedHref: "/synapse",
      },
      {
        topic: "Amplitude da operação",
        competitorPerspective:
          "O foco está nos recursos essenciais com custo mais acessível.",
        neuroNexPerspective:
          "O foco está na automação e integração entre várias áreas do consultório.",
        relatedHref: "/produto",
      },
    ],
    chooseCompetitorIf: [
      "Você quer os recursos essenciais da rotina por um custo mais acessível.",
      "Prontuário, agenda, financeiro, Receita Saúde e transcrição atendem sua prioridade atual.",
      "O preço de entrada pesa mais do que a amplitude da operação.",
    ],
    chooseNeuroNexIf: [
      "Você procura uma estrutura mais ampla, com automação e integração entre várias áreas da clínica.",
      "Quer avaliar o valor pela possibilidade de conectar ferramentas e reduzir trocas de contexto.",
      "Prefere IA com contexto autorizado, limites claros e confirmação humana.",
    ],
    faq: [
      {
        question: "Qual é melhor para psicólogos autônomos?",
        answer:
          "O Psipront pode combinar com quem prioriza preço acessível e recursos essenciais. A NeuroNex faz mais sentido para o profissional autônomo que quer estruturar uma operação mais ampla e conectada entre clínica, paciente, documentos e financeiro.",
      },
      {
        question: "Qual possui inteligência artificial?",
        answer:
          "O Psipront apresenta inteligência artificial e transcrição. Na NeuroNex, o Synapse consulta contexto autorizado, prepara ações e exige confirmação antes de executar mudanças sensíveis.",
      },
      {
        question: "Qual ajuda mais na agenda?",
        answer:
          "Os dois incluem a agenda em suas propostas. O Psipront a oferece entre os recursos essenciais; a NeuroNex destaca a continuidade entre agenda, atendimento, documentação e financeiro.",
      },
      {
        question: "Qual conecta prontuário e financeiro?",
        answer:
          "O Psipront apresenta prontuário e financeiro. Esta página não mede o nível de integração entre eles. Na NeuroNex, conectar essas áreas à mesma operação é parte da proposta principal.",
      },
      {
        question: "Vale a pena trocar de sistema?",
        answer:
          "Depende do que limita sua rotina hoje. Se os recursos essenciais bastam, a troca pode não ser necessária. Se você mantém outras ferramentas para paciente, documentos, comunicação ou operação, vale comparar o custo e o trabalho do conjunto sem presumir uma economia fixa.",
      },
      {
        question: "A NeuroNex importa dados de outro sistema?",
        answer:
          "Esta comparação não confirma importação automática. Fale com a equipe da NeuroNex para avaliar os dados que você precisa preservar e as opções disponíveis para o seu caso.",
      },
    ],
    related: sharedRelated,
    reviewedAt: COMPARISON_REVIEWED_AT,
  },
  {
    slug: "neuronex-vs-terabase",
    route: "/comparar/neuronex-vs-terabase",
    competitor: "Terabase",
    seoTitle: "NeuroNex vs Terabase: comparação para psicólogos",
    description:
      "Compare NeuroNex e Terabase: fluxo da sessão ao prontuário e financeiro, transcrição, rascunhos por IA e continuidade da operação do consultório.",
    keywords: [
      "NeuroNex vs Terabase",
      "alternativa ao Terabase",
      "sessão prontuário financeiro",
      "sistema para psicólogos com IA",
    ],
    heroText:
      "As duas propostas valorizam continuidade. A diferença está no alcance: um fluxo direto da sessão ao prontuário e ao financeiro ou a conexão de toda a operação do consultório.",
    competitorAdvantage:
      "Fluxo simples da sessão ao prontuário e ao financeiro, com transcrição e rascunhos por IA.",
    competitorBestUse:
      "Quem quer uma jornada direta entre atendimento, documentação e financeiro.",
    neuroNexAdvantage:
      "A continuidade alcança agenda, paciente, documentos, cobranças e IA; a conexão de comunicação permanece em Beta.",
    neuroNexBestUse:
      "Quem quer levar a conexão entre sessão, prontuário e financeiro para toda a operação do consultório.",
    competitorStrengths: [
      "Fluxo simples da sessão ao prontuário e ao financeiro",
      "Transcrição",
      "Rascunhos por IA",
      "Experiência direta",
    ],
    competitorRecognition:
      "O Terabase apresenta uma experiência direta entre sessão, prontuário e financeiro. Transcrição e rascunhos por IA apoiam esse caminho sem desviar do fluxo principal.",
    neuroNexDifference:
      "A NeuroNex parte da mesma importância da continuidade, mas amplia seu alcance. Agenda, paciente, atendimento, documentos, cobranças, financeiro e IA participam da mesma operação; a conexão de comunicação permanece em Beta. Ações sensíveis respeitam contexto autorizado e confirmação humana.",
    comparisonRows: [
      {
        topic: "Fluxo principal",
        competitorPerspective:
          "Uma jornada simples e direta da sessão ao prontuário e ao financeiro.",
        neuroNexPerspective:
          "Uma operação que começa antes da sessão e continua depois do recebimento.",
        relatedHref: "/produto",
      },
      {
        topic: "Atendimento",
        competitorPerspective:
          "A sessão é o ponto de partida do fluxo apresentado.",
        neuroNexPerspective:
          "O atendimento se liga à agenda, ao paciente, à documentação e ao financeiro.",
        relatedHref: "/teleconsulta-para-psicologos",
      },
      {
        topic: "Prontuário",
        competitorPerspective:
          "O prontuário dá continuidade direta ao que aconteceu na sessão.",
        neuroNexPerspective:
          "O prontuário se mantém conectado ao contexto autorizado do paciente e às outras áreas.",
        relatedHref: "/prontuario-para-psicologos",
      },
      {
        topic: "Financeiro",
        competitorPerspective:
          "O financeiro fecha o fluxo direto iniciado na sessão.",
        neuroNexPerspective:
          "Cobrança, recebimento e acompanhamento financeiro fazem parte da operação conectada.",
        relatedHref: "/neurofinance",
      },
      {
        topic: "Inteligência artificial",
        competitorPerspective:
          "Transcrição e rascunhos por IA apoiam a documentação.",
        neuroNexPerspective:
          "A IA consulta, prepara e organiza diferentes etapas, com confirmação para ações sensíveis.",
        relatedHref: "/synapse",
      },
      {
        topic: "Alcance da continuidade",
        competitorPerspective:
          "O foco informado vai da sessão ao prontuário e ao financeiro.",
        neuroNexPerspective:
          "O fluxo também inclui agenda, paciente, documentos e cobranças; a conexão de comunicação está em Beta.",
        relatedHref: "/produto",
      },
    ],
    chooseCompetitorIf: [
      "Você quer uma jornada simples entre atendimento, documentação e financeiro.",
      "Prefere uma experiência direta, centrada no fluxo da sessão.",
      "Transcrição e rascunhos por IA atendem sua principal necessidade.",
    ],
    chooseNeuroNexIf: [
      "Você quer expandir essa continuidade para toda a operação do consultório.",
      "Agenda, paciente, documentos e cobranças também precisam participar do fluxo.",
      "Você quer IA assistiva com contexto autorizado e confirmação humana.",
    ],
    faq: [
      {
        question: "Qual é melhor para psicólogos autônomos?",
        answer:
          "O Terabase pode atender bem quem busca um caminho direto da sessão ao prontuário e ao financeiro. A NeuroNex faz mais sentido quando o profissional também quer conectar agenda, paciente, documentos, cobranças e IA, acompanhando o status público de cada recurso.",
      },
      {
        question: "Qual possui inteligência artificial?",
        answer:
          "O Terabase apresenta rascunhos por IA e transcrição. Na NeuroNex, a proposta do Synapse é consultar contexto autorizado, preparar ações e distinguir rascunho, ação pendente e execução confirmada.",
      },
      {
        question: "Qual ajuda mais na agenda?",
        answer:
          "As informações usadas nesta comparação não atribuem à agenda um foco específico no Terabase. Na NeuroNex, a agenda é uma das entradas da operação e continua ligada às etapas posteriores.",
      },
      {
        question: "Qual conecta prontuário e financeiro?",
        answer:
          "O Terabase destaca justamente um fluxo simples da sessão ao prontuário e ao financeiro. A diferença da NeuroNex está em estender essa continuidade às demais áreas do consultório.",
      },
      {
        question: "Vale a pena trocar de sistema?",
        answer:
          "Se o fluxo direto já cobre sua necessidade, talvez não. A troca merece avaliação quando outras etapas — agenda, paciente, documentos, cobranças ou comunicação — continuam separadas e geram trabalho adicional.",
      },
      {
        question: "A NeuroNex importa dados de outro sistema?",
        answer:
          "Esta comparação não promete importação automática. Converse com a equipe da NeuroNex para avaliar quais dados precisam ser preservados e quais opções estão disponíveis para o seu cenário.",
      },
    ],
    related: sharedRelated,
    reviewedAt: COMPARISON_REVIEWED_AT,
  },
  {
    slug: "neuronex-vs-psinexus",
    route: "/comparar/neuronex-vs-psinexus",
    competitor: "PSINexus",
    seoTitle: "NeuroNex vs PSINexus: gestão clínica ou CRM?",
    description:
      "Compare NeuroNex e PSINexus: WhatsApp, CRM, triagem, agendamento automático, transcrição, operação de equipe e integração clínica do consultório.",
    keywords: [
      "NeuroNex vs PSINexus",
      "alternativa ao PSINexus",
      "CRM para psicólogos",
      "WhatsApp para clínicas",
    ],
    heroText:
      "As propostas partem de centros diferentes: captação, WhatsApp e CRM de um lado; integração profunda da operação clínica, do paciente, dos documentos e do financeiro do outro.",
    competitorAdvantage:
      "WhatsApp, CRM, triagem de leads, agendamento automático, transcrição e operação multiprofissional.",
    competitorBestUse:
      "Clínicas cuja prioridade é captar, triar e organizar pacientes e equipes a partir da comunicação comercial.",
    neuroNexAdvantage:
      "Integração profunda da operação clínica com paciente, documentos, financeiro e IA.",
    neuroNexBestUse:
      "Consultórios que colocam a continuidade clínica e administrativa no centro da escolha.",
    competitorStrengths: [
      "WhatsApp",
      "CRM",
      "Triagem de leads",
      "Agendamento automático",
      "Transcrição",
      "Operação multiprofissional",
    ],
    competitorRecognition:
      "O PSINexus concentra sua proposta em WhatsApp, CRM, triagem de leads, agendamento automático, transcrição e operação multiprofissional. Esse foco pode ser valioso para clínicas que organizam captação e equipe a partir da comunicação.",
    neuroNexDifference:
      "A NeuroNex coloca a operação clínica no centro. Paciente, atendimento, documentos, cobranças, financeiro e IA compartilham continuidade, enquanto ações sensíveis permanecem sujeitas à confirmação do profissional.",
    comparisonRows: [
      {
        topic: "Foco da operação",
        competitorPerspective:
          "Captação, CRM, WhatsApp e organização de equipe orientam a proposta.",
        neuroNexPerspective:
          "A integração da rotina clínica e administrativa orienta a proposta.",
        relatedHref: "/produto",
      },
      {
        topic: "Entrada de pacientes",
        competitorPerspective:
          "Triagem de leads e agendamento automático apoiam a entrada de pacientes.",
        neuroNexPerspective:
          "A agenda inicia uma continuidade que acompanha paciente, atendimento e etapas posteriores.",
        relatedHref: "/agenda-para-psicologos",
      },
      {
        topic: "Comunicação",
        competitorPerspective:
          "O WhatsApp é um dos pilares da experiência apresentada.",
        neuroNexPerspective:
          "A conexão e a sincronização do NeuroZap estão em Beta; recursos avançados de contexto seguem em evolução.",
        relatedHref: "/neurozap-para-psicologos",
      },
      {
        topic: "Atendimento e documentos",
        competitorPerspective:
          "A transcrição aparece entre os recursos destacados.",
        neuroNexPerspective:
          "Atendimento, prontuário e documentos participam do mesmo fluxo clínico.",
        relatedHref: "/prontuario-para-psicologos",
      },
      {
        topic: "Financeiro",
        competitorPerspective:
          "Os dados considerados aqui destacam CRM, comunicação e operação de equipe como focos principais.",
        neuroNexPerspective:
          "Cobrança, recebimento e acompanhamento financeiro continuam ligados ao atendimento.",
        relatedHref: "/neurofinance",
      },
      {
        topic: "Inteligência e controle",
        competitorPerspective:
          "A transcrição apoia o registro dentro da proposta apresentada.",
        neuroNexPerspective:
          "O Synapse consulta contexto autorizado e pede confirmação antes de ações sensíveis.",
        relatedHref: "/synapse",
      },
    ],
    chooseCompetitorIf: [
      "Sua prioridade é captação de pacientes, WhatsApp e CRM.",
      "Triagem de leads e agendamento automático são centrais na sua operação.",
      "Você precisa organizar uma equipe multiprofissional a partir desse fluxo.",
    ],
    chooseNeuroNexIf: [
      "Sua prioridade é integrar profundamente a operação clínica, o paciente, os documentos, o financeiro e a IA.",
      "Você quer continuidade depois que o paciente já entrou na clínica.",
      "Ações sensíveis assistidas por IA devem continuar sob confirmação humana.",
    ],
    faq: [
      {
        question: "Qual é melhor para psicólogos autônomos?",
        answer:
          "O PSINexus faz mais sentido quando captação, WhatsApp e CRM são a prioridade, inclusive em operação de equipe. A NeuroNex tende a combinar melhor com quem coloca a continuidade clínica e administrativa no centro.",
      },
      {
        question: "Qual possui inteligência artificial?",
        answer:
          "As informações consideradas nesta comparação destacam transcrição no PSINexus, sem atribuir outras capacidades de IA. Na NeuroNex, o Synapse trabalha com contexto autorizado e confirmação humana para ações sensíveis.",
      },
      {
        question: "Qual ajuda mais na agenda?",
        answer:
          "O PSINexus destaca agendamento automático ligado à triagem e ao CRM. Na NeuroNex, a agenda se conecta à confirmação, ao atendimento, ao paciente e às etapas clínicas e financeiras posteriores.",
      },
      {
        question: "Qual conecta prontuário e financeiro?",
        answer:
          "Os dados fornecidos para esta comparação não descrevem esse vínculo no PSINexus, por isso não afirmamos presença nem ausência. Na NeuroNex, prontuário, atendimento, cobrança e financeiro fazem parte da mesma proposta operacional.",
      },
      {
        question: "Vale a pena trocar de sistema?",
        answer:
          "A resposta depende de onde está o maior atrito. Se captação e CRM são prioridade, o foco do PSINexus pode combinar melhor. Se o trabalho se fragmenta depois que o paciente entra, vale conhecer a proposta conectada da NeuroNex.",
      },
      {
        question: "A NeuroNex importa dados de outro sistema?",
        answer:
          "Esta comparação não confirma importação automática. Antes de trocar, converse com a equipe da NeuroNex sobre os dados que precisam ser preservados e as opções disponíveis.",
      },
    ],
    related: sharedRelated,
    reviewedAt: COMPARISON_REVIEWED_AT,
  },
];

export const COMPARISON_GUIDE = [
  {
    label: "Quer agenda e operação simples",
    choice: "Corpora",
    href: "/comparar/neuronex-vs-corpora",
  },
  {
    label: "Quer gestão consolidada",
    choice: "PsicoManager",
    href: "/comparar/neuronex-vs-psicomanager",
  },
  {
    label: "Quer gestão por planos graduais",
    choice: "PsicoGest",
    href: "/comparar/neuronex-vs-psicogest",
  },
  {
    label: "Quer notas clínicas assistidas",
    choice: "Sintropia",
    href: "/comparar/neuronex-vs-sintropia",
  },
  {
    label: "Quer preço acessível",
    choice: "Psipront",
    href: "/comparar/neuronex-vs-psipront",
  },
  {
    label: "Quer um fluxo clínico direto",
    choice: "Terabase",
    href: "/comparar/neuronex-vs-terabase",
  },
  {
    label: "Quer CRM e WhatsApp",
    choice: "PSINexus",
    href: "/comparar/neuronex-vs-psinexus",
  },
  {
    label: "Quer integrar toda a operação",
    choice: "NeuroNex",
    href: "/produto",
  },
] as const;

const comparisonImage =
  "/images/prints-sistema/DESKTOP/ESCURO/1. DASHBOARD/dashboard--visao-geral--primeira-dobra-clinica-financeiro--escuro--pagina--001.png";

export const COMPARISON_INDEX_ENTRY = {
  route: COMPARISON_INDEX_META.route,
  file: "comparar.html",
  kind: "comparison",
  status: "Disponível",
  modifiedAt: COMPARISON_MODIFIED_AT,
  title: COMPARISON_INDEX_META.seoTitle,
  description: COMPARISON_INDEX_META.description,
  keywords: COMPARISON_INDEX_META.keywords,
  eyebrow: "Comparações para psicólogos",
  heading: "Compare sistemas para psicólogos",
  lead:
    "Agenda, prontuário, financeiro, WhatsApp e inteligência artificial aparecem em diferentes plataformas. Entenda o foco de cada uma antes de escolher.",
  highlights: [
    "Comparações de proposta e foco",
    "Reconhecimento dos pontos fortes de cada sistema",
    "Informações públicas verificadas em julho de 2026",
  ],
  sections: [
    {
      title: "Compare propostas, não uma tabela de sim e não",
      text: "Cada sistema resolve bem determinadas partes da clínica. A NeuroNex foi projetada para fazer essas partes trabalharem juntas.",
    },
    {
      title: "Comece pela prioridade da sua rotina",
      text: "Os guias abaixo ajudam a identificar qual foco combina melhor com o que você procura agora.",
      bullets: COMPARISON_GUIDE.map(
        ({ label, choice }) => `${label}: ${choice}`,
      ),
    },
  ],
  faq: [],
  image: comparisonImage,
  imageAlt:
    "Painel da NeuroNex usado como referência na comparação de sistemas para psicólogos",
  related: [
    {
      label: "Conhecer a operação completa",
      href: "/produto",
    },
    {
      label: "Entender a IA com controle humano",
      href: "/synapse",
    },
    {
      label: "Ler conteúdos educativos no NeuroX",
      href: "/blog",
    },
  ],
  reviewedAt: COMPARISON_REVIEWED_AT,
} as const;

export const COMPARISON_PUBLIC_ENTRIES = COMPARISONS.map((comparison) => ({
  ...comparison,
  file: `comparar/${comparison.slug}.html`,
  kind: "comparison" as const,
  status: "Disponível" as const,
  modifiedAt: COMPARISON_MODIFIED_AT,
  title: comparison.seoTitle,
  eyebrow: "Comparação para psicólogos",
  heading: `NeuroNex vs ${comparison.competitor}`,
  lead: comparison.heroText,
  highlights: [
    comparison.competitorAdvantage,
    comparison.neuroNexAdvantage,
    "Informações públicas verificadas em julho de 2026",
  ],
  sections: [
    {
      title: `O que ${comparison.competitor} faz bem`,
      text: comparison.competitorRecognition,
      bullets: comparison.competitorStrengths,
    },
    {
      title: "A proposta da NeuroNex",
      text: comparison.neuroNexDifference,
    },
    {
      title: "Terça-feira do Dr. Lucas: cenário ilustrativo",
      text: `Este cenário compara um fluxo manual ou de IA textual com a operação agêntica governada da NeuroNex. Ele não descreve nem mede o funcionamento do ${comparison.competitor}.`,
      bullets: ILLUSTRATIVE_WORKFLOW.map(
        ({ time, title, manualFlow, neuroNexFlow }) =>
          `${time} — ${title}. Fluxo manual ou IA textual: ${manualFlow} NeuroNex: ${neuroNexFlow}`,
      ),
    },
    {
      title: "Estimativa ilustrativa de ganho de tempo",
      text: TIME_GAIN_DISCLOSURE,
      bullets: TIME_GAIN_ESTIMATES.map(
        ({ period, estimate, effects }) =>
          `${period}: ${estimate}. ${effects.join(" ")}`,
      ),
    },
    {
      title: `Escolha ${comparison.competitor} se...`,
      text: comparison.competitorBestUse,
      bullets: comparison.chooseCompetitorIf,
    },
    {
      title: "Escolha a NeuroNex se...",
      text: comparison.neuroNexBestUse,
      bullets: comparison.chooseNeuroNexIf,
    },
  ],
  image: comparisonImage,
  imageAlt: `Painel da NeuroNex na comparação com ${comparison.competitor}`,
}));

export const COMPARISON_PUBLIC_PAGES = [
  COMPARISON_INDEX_ENTRY,
  ...COMPARISON_PUBLIC_ENTRIES,
];

export function getComparisonBySlug(slug: string | undefined) {
  return COMPARISONS.find((comparison) => comparison.slug === slug);
}

export function getComparisonByRoute(route: string) {
  const normalizedRoute = route.length > 1 ? route.replace(/\/+$/u, "") : route;
  return COMPARISONS.find((comparison) => comparison.route === normalizedRoute);
}
