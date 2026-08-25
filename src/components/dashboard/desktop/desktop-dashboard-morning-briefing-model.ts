import { getAppointmentKind } from "@/lib/appointment-metadata";
import { getAppointmentDetailStatusLabel } from "@/lib/appointment-detail-presentation";
import type { Appointment } from "@/types";

import type { AttentionQueueItem } from "./dashboard-command-center-model";

export type DailyBriefingCounts = {
  total: number;
  pending: number;
  confirmed: number;
  online: number;
};

export type DailyBriefingContext = {
  before: string;
  actionLabel: string;
  after: string;
  actionPath: string;
};

const pluralize = (count: number, singular: string, plural: string) =>
  count === 1 ? singular : plural;

export const getDailyBriefingCounts = (
  appointments: Appointment[],
): DailyBriefingCounts => {
  const sessions = appointments.filter(
    (appointment) => getAppointmentKind(appointment) === "session",
  );
  const pending = sessions.filter(
    (appointment) => getAppointmentDetailStatusLabel(appointment) === "Pendente",
  ).length;

  return {
    total: sessions.length,
    pending,
    confirmed: Math.max(0, sessions.length - pending),
    online: sessions.filter((appointment) => appointment.type === "online").length,
  };
};

export const buildDailyBriefingContext = ({
  counts,
  attentionItems,
  financialConnected,
}: {
  counts: DailyBriefingCounts;
  attentionItems: AttentionQueueItem[];
  financialConnected: boolean;
}): DailyBriefingContext => {
  const neurofinanceItems = attentionItems.filter(
    (item) => item.category === "neurofinance",
  ).length;

  if (!financialConnected) {
    return {
      before: "A gestão manual continua disponível; ",
      actionLabel: "o NeuroFinance ainda não está ativo",
      after: ".",
      actionPath: "/financeiro/neurofinance",
    };
  }

  if (neurofinanceItems > 0) {
    return {
      before: "Também há ",
      actionLabel: `${neurofinanceItems} ${pluralize(neurofinanceItems, "pendência", "pendências")} no NeuroFinance`,
      after: " pedindo atenção.",
      actionPath: "/financeiro/neurofinance?view=cobrancas-historia",
    };
  }

  if (counts.pending > 0) {
    return {
      before: "O foco mais útil agora é acompanhar ",
      actionLabel: `${counts.pending} ${pluralize(counts.pending, "confirmação", "confirmações")}`,
      after: " antes do primeiro atendimento.",
      actionPath: "/agenda",
    };
  }

  if (attentionItems.length > 0) {
    return {
      before: "Além da agenda, existem ",
      actionLabel: `${attentionItems.length} ${pluralize(attentionItems.length, "ponto", "pontos")} para revisar`,
      after: " no seu painel.",
      actionPath: "#dashboard-pendencias",
    };
  }

  if (counts.total === 0) {
    return {
      before: "A agenda está livre e abre espaço para ",
      actionLabel: "planejar a semana",
      after: ".",
      actionPath: "/agenda",
    };
  }

  return {
    before: "Seu dia está organizado, sem pendências críticas; você pode ",
    actionLabel: "revisar a agenda completa",
    after: ".",
    actionPath: "/agenda",
  };
};

