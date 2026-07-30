import { isCancelledAppointmentStatus } from "@/lib/appointment-status";
import type { Appointment } from "@/types";

const NON_DRAGGABLE_LIFECYCLE_STATUSES = new Set([
  "cancellation_requested",
  "cancelled",
  "reschedule_requested",
  "awaiting_reconfirmation",
  "in_progress",
  "completed",
  "closed",
]);

export const isAppointmentDraggable = (appointment: Appointment, now = new Date()) => {
  if (isCancelledAppointmentStatus(appointment.status, appointment.notes)) return false;
  if (NON_DRAGGABLE_LIFECYCLE_STATUSES.has(appointment.lifecycle_status || "")) return false;
  if (["attended", "absent", "completed", "no_show"].includes(appointment.status || "")) return false;
  return new Date(appointment.start_time).getTime() > now.getTime();
};

