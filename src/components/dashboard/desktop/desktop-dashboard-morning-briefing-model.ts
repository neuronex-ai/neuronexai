import { getAppointmentKind } from "@/lib/appointment-metadata";
import { getAppointmentDetailStatusLabel } from "@/lib/appointment-detail-presentation";
import type { Appointment } from "@/types";

export type DailyBriefingCounts = {
  total: number;
  pending: number;
  confirmed: number;
  online: number;
};

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
