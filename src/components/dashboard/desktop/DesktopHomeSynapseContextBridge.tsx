"use client";

import { addDays, endOfDay, format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEffect, useMemo } from "react";

import { useAI } from "@/context/AIContext";
import { useAppointmentsByDateRange } from "@/hooks/use-appointments-by-date-range";
import { useFinancialAccount } from "@/hooks/use-financial-account";
import { useNotifications } from "@/hooks/use-notifications";
import { usePendingPatientsCount } from "@/hooks/use-pending-patients-count";
import { getAppointmentDisplayTitle } from "@/lib/appointment-utils";
import type { Appointment } from "@/types";

import {
  buildAttentionQueue,
  getActiveAppointments,
  getNextScheduleItem,
  getTodayAppointments,
} from "./dashboard-command-center-model";

const appointmentLabel = (appointment: Appointment) =>
  getAppointmentDisplayTitle(appointment) || appointment.patient_name || "Compromisso";

export const DesktopHomeSynapseContextBridge = () => {
  const today = useMemo(() => new Date(), []);
  const { setSurfaceContextSummary } = useAI();
  const { data: upcomingRaw, isLoading: loadingAppointments } =
    useAppointmentsByDateRange(startOfDay(today), endOfDay(addDays(today, 7)));
  const { data: pendingPatientsRaw, isLoading: loadingPendingPatients } = usePendingPatientsCount();
  const { notifications, isLoading: loadingNotifications } = useNotifications({
    enableRealtime: false,
    syncBadge: false,
  });
  const { isConnected: financialConnected, isLoading: financialLoading } = useFinancialAccount();

  const pendingPatients = Number(pendingPatientsRaw || 0);
  const activeAppointments = useMemo(
    () => getActiveAppointments((upcomingRaw || []) as Appointment[]),
    [upcomingRaw],
  );
  const todayAppointments = useMemo(
    () => getTodayAppointments(activeAppointments, today),
    [activeAppointments, today],
  );
  const nextAppointment = useMemo(
    () => getNextScheduleItem(activeAppointments, new Date()),
    [activeAppointments],
  );
  const futureAppointments = useMemo(() => {
    const now = Date.now();
    return activeAppointments
      .filter((appointment) => appointment.id !== nextAppointment?.id)
      .filter((appointment) => new Date(appointment.end_time).getTime() > now)
      .slice(0, 2);
  }, [activeAppointments, nextAppointment?.id]);
  const attentionItems = useMemo(
    () => buildAttentionQueue({
      notifications,
      appointments: activeAppointments,
      pendingPatients,
      financialConnected,
      financialLoading,
      limit: 3,
    }),
    [activeAppointments, financialConnected, financialLoading, notifications, pendingPatients],
  );

  const summary = useMemo(() => {
    const loading = loadingAppointments || loadingNotifications || loadingPendingPatients;
    const next = nextAppointment
      ? `${appointmentLabel(nextAppointment)} às ${format(new Date(nextAppointment.start_time), "HH:mm")}`
      : "nenhum compromisso futuro carregado";
    const upcoming = futureAppointments.length
      ? futureAppointments
          .map((appointment) => `${appointmentLabel(appointment)} às ${format(new Date(appointment.start_time), "HH:mm")}`)
          .join("; ")
      : "nenhum outro horário futuro visível";
    const attention = attentionItems.length
      ? attentionItems.map((item) => `${item.label}: ${item.title} — ${item.description}`).join("; ")
      : "nenhuma pendência visível";
    const neuroFinanceState = financialLoading
      ? "carregando"
      : financialConnected
        ? "conta conectada"
        : "conta ainda não conectada";

    return [
      "# Home desktop — contexto vivo da superfície",
      `Data da Home: ${format(today, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.`,
      loading ? "Parte dos dados visuais ainda está carregando; não trate números incompletos como definitivos." : "Os dados abaixo correspondem ao estado atualmente carregado na Home.",
      `Sessões exibidas para hoje: ${todayAppointments.length}.`,
      `Próximo compromisso exibido: ${next}.`,
      `Próximos horários exibidos: ${upcoming}.`,
      `Fila visual de atenção: ${attention}.`,
      `Cadastros de pacientes com status pending: ${pendingPatients}.`,
      `Estado do NeuroFinance usado pela Home: ${neuroFinanceState}.`,
      "Ações que realmente existem na Home: conversar com o Synapse por texto; iniciar voz; usar sugestões rápidas; abrir criação de agendamento; abrir criação de paciente; abrir o próximo compromisso na Agenda; abrir os próximos horários na Agenda; abrir o destino real de cada item da fila de atenção.",
      "A Home não possui subpainéis próprios de Financeiro ou Pendências: quando um item aponta para essas áreas, a navegação leva à área real correspondente.",
      "Para qualquer criação ou alteração pedida ao Synapse, preserve a revisão/confirmação exigida pelo runtime antes de executar o efeito.",
    ].join("\n");
  }, [
    attentionItems,
    financialConnected,
    financialLoading,
    futureAppointments,
    loadingAppointments,
    loadingNotifications,
    loadingPendingPatients,
    nextAppointment,
    pendingPatients,
    today,
    todayAppointments.length,
  ]);

  useEffect(() => {
    setSurfaceContextSummary(summary);
    return () => setSurfaceContextSummary("");
  }, [setSurfaceContextSummary, summary]);

  return null;
};

export default DesktopHomeSynapseContextBridge;
