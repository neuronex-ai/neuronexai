import {
  PROFESSIONAL_PLAN_PERIOD,
  PROFESSIONAL_PLAN_PRICE,
  PROFESSIONAL_TRIAL_DAYS,
} from "@/lib/subscription-plans";

export const PUBLIC_PLAN_CARDS = [
  {
    name: "Essential",
    eyebrow: "Gratuito",
    price: "R$ 0",
    period: "/mês",
    description:
      "Para organizar a prática com os recursos essenciais e manter até cinco pacientes ativos.",
    cta: "Criar conta grátis",
    href: "/create-account?plan=essential",
    featured: false,
    features: [
      "Até 5 pacientes e 5 vínculos ativos no Portal",
      "5 teleconsultas e 150 minutos por mês",
      "30 ações de texto e 5 minutos de voz no Synapse",
      "Agenda, prontuário e financeiro manual",
      "NeuroDrive com 100 arquivos e 250 MB",
    ],
  },
  {
    name: "Profissional",
    eyebrow: `${PROFESSIONAL_TRIAL_DAYS} dias grátis`,
    price: PROFESSIONAL_PLAN_PRICE,
    period: PROFESSIONAL_PLAN_PERIOD,
    description:
      "Para operar com maior escala, inteligência contextual, NeuroFinance e comunicação conectada.",
    cta: "Testar grátis",
    href: "/create-account?plan=professional",
    featured: true,
    features: [
      "Até 250 pacientes e 250 vínculos ativos no Portal",
      "Até 80 teleconsultas e 300 minutos de transcrição por mês",
      "500 ações de texto e 60 minutos de voz no Synapse",
      "NeuroView, NeuroFlow, NeuroPulse e NeuroScan",
      "NeuroFinance e módulo fiscal",
      "Um número no NeuroZap",
    ],
  },
] as const;

export type PublicPlanName = (typeof PUBLIC_PLAN_CARDS)[number]["name"];

export const PUBLIC_PLAN_COMPARISON = [
  ["Pacientes ativos", "5", "250"],
  ["Vínculos ativos no Portal", "5", "250"],
  ["Synapse por texto", "30 ações/mês", "500 ações/mês"],
  ["Synapse por voz", "5 minutos/mês", "60 minutos/mês"],
  ["Teleconsultas", "5 sessões e 150 min/mês", "Até 80 sessões e 20 pacientes distintos/mês"],
  ["Transcrição de teleconsulta", "—", "300 minutos/mês"],
  ["NeuroDrive", "100 arquivos e 250 MB", "2.000 arquivos e 5 GB"],
  ["NeuroBox", "—", "NeuroView, NeuroFlow, NeuroPulse e NeuroScan"],
  ["Financeiro manual", "Incluído", "Incluído"],
  ["NeuroFinance", "—", "Incluído, sujeito à aprovação da conta"],
  ["Módulo fiscal", "—", "Incluído; taxas externas separadas"],
  ["Synapse no WhatsApp", "—", "Acesso conforme disponibilidade"],
  ["NeuroZap", "—", "Um número de WhatsApp Business em Beta"],
  ["Mensagens de utilidade", "—", "250 mensagens/mês"],
  ["Suporte", "Padrão", "Prioritário"],
] as const;
