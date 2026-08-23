export type TourPlacement = "auto" | "top" | "bottom" | "left" | "right";

export type TourStep = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  hint?: string;
  expectedRoute?: string;
  targetSelector?: string;
  layout?: "modal" | "spotlight";
  placement?: TourPlacement;
};

export const DESKTOP_TOUR_STEPS: TourStep[] = [
  {
    id: "desktop-welcome",
    eyebrow: "Visão desktop",
    title: "Sua central completa de operação.",
    description:
      "No computador, a NeuroNex reúne visão ampla da clínica, navegação rápida, produtividade por teclado e módulos completos em um único espaço.",
    hint: "Use as setas do teclado para avançar ou voltar.",
    layout: "modal",
  },
  {
    id: "desktop-dashboard",
    eyebrow: "Central da clínica",
    title: "Comece o dia pelo Painel.",
    description:
      "O dashboard consolida agenda, pacientes que precisam de atenção, próxima sessão, fila de trabalho e o pulso financeiro da clínica.",
    expectedRoute: "/dashboard",
    targetSelector: "#nav-dashboard",
    placement: "bottom",
  },
  {
    id: "desktop-agenda",
    eyebrow: "Planejamento amplo",
    title: "Agenda com espaço para enxergar a semana.",
    description:
      "No desktop você consegue revisar horários, abrir compromissos e organizar a rotina com mais contexto visual antes de entrar em uma sessão.",
    expectedRoute: "/agenda",
    targetSelector: "#nav-agenda",
    placement: "bottom",
  },
  {
    id: "desktop-teleconsulta",
    eyebrow: "Atendimento online",
    title: "Teleconsulta em um módulo dedicado.",
    description:
      "Acesse a sala virtual, organize o atendimento e mantenha os recursos da sessão próximos da agenda e do prontuário.",
    expectedRoute: "/teleconsulta",
    targetSelector: "#nav-teleconsulta",
    placement: "bottom",
  },
  {
    id: "desktop-patients",
    eyebrow: "Contexto clínico",
    title: "Pacientes, histórico e documentos.",
    description:
      "Use a área de pacientes para acessar prontuários, sessões, documentos, pendências e toda a continuidade clínica em uma visão mais completa.",
    expectedRoute: "/pacientes",
    targetSelector: "#nav-pacientes",
    placement: "bottom",
  },
  {
    id: "desktop-notes",
    eyebrow: "Trabalho profundo",
    title: "Notas e NeuroVision ganham espaço no desktop.",
    description:
      "A tela maior favorece escrita clínica, revisão de conteúdo, análise sistêmica e uso dos recursos de IA sem comprimir o contexto principal.",
    expectedRoute: "/notas",
    targetSelector: "#nav-notas",
    placement: "bottom",
  },
  {
    id: "desktop-finance",
    eyebrow: "Gestão financeira",
    title: "Financeiro e NeuroFinance em camadas claras.",
    description:
      "Acompanhe a gestão da clínica e, quando fizer sentido, acesse operações bancárias, cobranças, Pix, boletos e extrato dentro do módulo financeiro.",
    expectedRoute: "/financeiro",
    targetSelector: "#nav-financeiro",
    placement: "bottom",
  },
  {
    id: "desktop-search",
    eyebrow: "Produtividade",
    title: "Encontre tudo sem abandonar a tela.",
    description:
      "A busca global localiza pacientes, sessões e notas. No desktop, use também Ctrl + K para abrir a busca de qualquer módulo.",
    targetSelector: "#global-search",
    placement: "bottom",
    hint: "Atalho: Ctrl + K",
  },
  {
    id: "desktop-notifications",
    eyebrow: "Acompanhamento",
    title: "Notificações permanecem ao alcance.",
    description:
      "Confira agendamentos, pagamentos, alertas e lembretes sem perder a tela de trabalho que está aberta.",
    targetSelector: "#notifications-trigger",
    placement: "bottom",
  },
  {
    id: "desktop-finish",
    eyebrow: "Tudo pronto",
    title: "Seu ambiente desktop está preparado.",
    description:
      "Você já conhece os principais caminhos. Explore os módulos com calma e reinicie este tour em Ajustes sempre que precisar.",
    layout: "modal",
  },
];

export const MOBILE_TOUR_STEPS: TourStep[] = [
  {
    id: "mobile-welcome",
    eyebrow: "Experiência mobile-first",
    title: "Sua clínica cabe na rotina do celular.",
    description:
      "No mobile, a NeuroNex prioriza ações rápidas, leitura com uma mão, navegação inferior, painéis deslizantes e acesso imediato ao Synapse.",
    hint: "Você também pode deslizar o card para avançar ou voltar.",
    layout: "modal",
  },
  {
    id: "mobile-dashboard",
    eyebrow: "Resumo imediato",
    title: "O Painel mostra o que importa agora.",
    description:
      "Veja a próxima sessão, atendimentos do dia, pacientes que precisam de atenção e o estado financeiro em uma leitura vertical e compacta.",
    expectedRoute: "/dashboard",
    targetSelector: ".nn-mobile-shell main",
    placement: "top",
  },
  {
    id: "mobile-new-appointment",
    eyebrow: "Ação com o polegar",
    title: "Crie um agendamento sem percorrer menus.",
    description:
      "O botão de ação rápida abre a criação de consulta em uma interface adaptada à tela pequena.",
    expectedRoute: "/dashboard",
    targetSelector: "button[aria-label='Novo agendamento']",
    placement: "bottom",
  },
  {
    id: "mobile-agenda-nav",
    eyebrow: "Navegação inferior",
    title: "A Agenda fica sempre próxima.",
    description:
      "Use a barra inferior para alternar entre as tarefas mais frequentes sem esticar a mão até o topo da tela.",
    targetSelector: "nav a[href='/agenda']",
    placement: "top",
  },
  {
    id: "mobile-agenda-page",
    eyebrow: "Transição de tela",
    title: "Cada módulo abre em uma tela focada.",
    description:
      "No mobile, a NeuroNex reduz distrações: você entra na Agenda, realiza a ação e retorna pelo fluxo de navegação sem perder o contexto.",
    expectedRoute: "/agenda",
    targetSelector: "[data-mobile-page-header='true']",
    placement: "bottom",
  },
  {
    id: "mobile-synapse",
    eyebrow: "Assistente central",
    title: "Synapse está no centro da navegação.",
    description:
      "Abra conversa por texto ou voz rapidamente. O posicionamento central foi pensado para acesso recorrente com uma mão.",
    targetSelector: "a[aria-label='Abrir Synapse']",
    placement: "top",
  },
  {
    id: "mobile-notifications",
    eyebrow: "Bottom sheet",
    title: "Alertas abrem sem substituir toda a tela.",
    description:
      "As notificações aparecem em um painel inferior deslizante, mantendo a sensação de contexto e facilitando o fechamento com gesto.",
    targetSelector: "button[aria-label='Abrir notificações']",
    placement: "bottom",
  },
  {
    id: "mobile-finance",
    eyebrow: "Acesso recorrente",
    title: "Financeiro também fica na barra principal.",
    description:
      "Acompanhe gestão, cobranças e conta financeira com um caminho curto, adequado para conferências rápidas durante o dia.",
    targetSelector: "nav a[href='/financeiro']",
    placement: "top",
  },
  {
    id: "mobile-menu",
    eyebrow: "Mais recursos",
    title: "O Menu concentra os módulos complementares.",
    description:
      "Pacientes, Teleconsulta, Notas, Integrações e Ajustes continuam disponíveis sem sobrecarregar a navegação inferior.",
    targetSelector: "button[aria-label='Abrir menu']",
    placement: "top",
  },
  {
    id: "mobile-finish",
    eyebrow: "Pronto para usar",
    title: "Seu fluxo mobile está apresentado.",
    description:
      "A experiência foi organizada para decisões rápidas, uso com uma mão e continuidade entre agenda, pacientes, financeiro e Synapse.",
    layout: "modal",
  },
];

// Compatibilidade temporária com imports antigos.
export const TOUR_STEPS = DESKTOP_TOUR_STEPS;
