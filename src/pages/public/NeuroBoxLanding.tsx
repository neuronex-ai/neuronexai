import { PublicPageShell } from "@/components/public/PublicPageShell";
import {
  getPublicPage,
  type PublicPageDefinition,
  type PublicSection,
} from "@/content/public-content";

const neuroTimeSection: PublicSection = {
  title: "NeuroTime",
  text: "Organiza registros do acompanhamento em um horizonte de eventos e campo temporal, permitindo percorrer períodos, fontes e pacientes sem transformar a visualização em diagnóstico automático.",
  bullets: [
    "Horizonte de eventos",
    "Filtros por período, fonte e paciente",
    "Prontuário, NeuroFlow, resumos, humor, agenda, financeiro e lembretes",
    "Risco exibido somente quando já registrado ou substituído pelo profissional",
  ],
};

const NeuroBoxLanding = () => {
  const sourcePage = getPublicPage("/neurobox");
  if (!sourcePage) return null;

  const sections = sourcePage.sections.flatMap((section) => {
    if (section.title !== "NeuroView") return [section];

    return [
      {
        ...section,
        title: "NeuroVision",
        text: "Mapeia notas, sintomas, eventos e hipóteses em grafos 2D ou 3D, com busca, foco, escopos e análise de conexões.",
      },
      neuroTimeSection,
    ];
  });

  const page: PublicPageDefinition = {
    ...sourcePage,
    modifiedAt: "2026-09-01",
    keywords: [
      ...sourcePage.keywords.map((keyword) => keyword.replace("NeuroView", "NeuroVision")),
      "NeuroTime linha do tempo clínica para psicólogos",
    ],
    sections,
    faq: sourcePage.faq.map((item) =>
      item.question.includes("NeuroView")
        ? {
            ...item,
            question: item.question.replace("NeuroView", "NeuroVision"),
            answer: item.answer.replace("Ele organiza", "O NeuroVision organiza"),
          }
        : item,
    ),
    imageAlt: sourcePage.imageAlt.replace("NeuroView", "NeuroVision"),
  };

  return <PublicPageShell page={page} />;
};

export default NeuroBoxLanding;
