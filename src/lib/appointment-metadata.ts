import { differenceInMinutes } from "date-fns";
import type { Appointment } from "@/types";
import { parseAppointmentEventDetails } from "./appointment-utils";

export type AppointmentKind = "session" | "event" | "block";
export type AppointmentOrigin = "neuronex" | "google";
export type AppointmentSyncStatus = "synced" | "pending" | "failed" | "imported";

export interface AppointmentMetadata {
  kind?: AppointmentKind;
  sessionType?: "first_visit" | "follow_up" | "emergency" | "block" | string;
  modality?: "presencial" | "online" | string;
  durationMinutes?: number;
  financial?: {
    usePackage?: boolean;
    packageId?: string | null;
    transactionId?: string | null;
    transactionAmount?: number | null;
    transactionMethod?: string | null;
    installments?: number | null;
    neurofinanceChargeRequested?: boolean;
  };
  recurrence?: {
    enabled?: boolean;
    frequency?: "weekly" | "biweekly" | "monthly" | string;
    count?: number;
  };
  eventTitle?: string;
  eventCategory?: string;
  eventCategoryLabel?: string;
  eventLocation?: string;
  eventNotes?: string;
  origin?: AppointmentOrigin;
  syncStatus?: AppointmentSyncStatus;
  lastSyncedAt?: string;
  googleUpdatedAt?: string;
  localUpdatedAt?: string;
  sessionTranscriptId?: string | null;
  sessionSummaryNoteId?: string | null;
  sessionDraftPending?: boolean;
  sessionDraftNotes?: string | null;
  sessionCompletedAt?: string | null;
  teleconsultationTranscription?: {
    enabled: boolean;
    decidedAt?: string;
    decidedBy?: string;
    noticeVersion?: string;
  };
  teleconsultationRoom?: {
    status?: "waiting" | "open" | "closed";
    openedAt?: string;
    lastHeartbeatAt?: string;
    closedAt?: string;
    closedReason?: string;
    openedBy?: string;
  };
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  first_visit: "Primeira Consulta",
  follow_up: "Acompanhamento",
  emergency: "Encaixe",
};

const EVENT_CATEGORY_LABELS: Record<string, string> = {
  reuniao: "Reunião",
  supervisao: "Supervisão",
  particular: "Particular",
  bloqueio: "Bloqueio de Agenda",
  formacao: "Formação / Curso",
  administrativo: "Administrativo",
  outro: "Outro",
};

export const getEventCategoryLabel = (category?: string | null) =>
  category ? EVENT_CATEGORY_LABELS[category] || category : "Compromisso";

export const getSessionTypeLabel = (type?: string | null) =>
  type ? SESSION_TYPE_LABELS[type] || type : "Acompanhamento";

export const getAppointmentMetadata = (
  appointment: Pick<Appointment, "metadata" | "notes" | "type" | "patient_id" | "start_time" | "end_time" | "location">
): AppointmentMetadata => {
  const raw = appointment.metadata && typeof appointment.metadata === "object"
    ? appointment.metadata
    : {};
  const eventDetails = parseAppointmentEventDetails(appointment.notes);
  const isPatientAppointment = !!appointment.patient_id && appointment.type !== "block";
  const kind: AppointmentKind =
    raw.kind ||
    (isPatientAppointment ? "session" : eventDetails ? "event" : appointment.type === "block" ? "block" : "session");

  const metadata: AppointmentMetadata = {
    ...raw,
    kind,
    durationMinutes:
      raw.durationMinutes ||
      differenceInMinutes(new Date(appointment.end_time), new Date(appointment.start_time)),
  };

  if (kind === "session") {
    metadata.modality = raw.modality || appointment.type;
    metadata.sessionType =
      raw.sessionType ||
      (appointment.notes?.toLowerCase().includes("primeira") ? "first_visit" : "follow_up");
  }

  if (kind === "event" || kind === "block") {
    metadata.eventTitle = raw.eventTitle || eventDetails?.title || firstVisibleNotesLine(appointment.notes) || "Compromisso";
    metadata.eventCategory = raw.eventCategory || eventDetails?.category || "outro";
    metadata.eventCategoryLabel =
      raw.eventCategoryLabel ||
      (eventDetails as any)?.categoryLabel ||
      getEventCategoryLabel(metadata.eventCategory);
    metadata.eventLocation = raw.eventLocation || eventDetails?.location || appointment.location || "";
    metadata.eventNotes = raw.eventNotes || getEditableAppointmentNotes(appointment);
  }

  return metadata;
};

export const getAppointmentKind = (
  appointment: Pick<Appointment, "metadata" | "notes" | "type" | "patient_id" | "start_time" | "end_time" | "location">
) => getAppointmentMetadata(appointment).kind || "session";

export const firstVisibleNotesLine = (notes?: string | null) =>
  notes
    ?.split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("[EVENT]")) || "";

export const getEditableAppointmentNotes = (
  appointment: Pick<Appointment, "metadata" | "notes" | "type" | "patient_id" | "start_time" | "end_time" | "location">
) => {
  const metadata = appointment.metadata || {};
  if (metadata.eventNotes) return metadata.eventNotes;

  const eventDetails = parseAppointmentEventDetails(appointment.notes);
  if (!eventDetails || !appointment.notes) return appointment.notes || "";

  return appointment.notes
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("[EVENT]") && line !== eventDetails.title)
    .join("\n");
};

export const buildEventMetadata = (input: {
  title: string;
  category?: string;
  categoryLabel?: string;
  location?: string | null;
  notes?: string | null;
  origin?: AppointmentOrigin;
  syncStatus?: AppointmentSyncStatus;
}): AppointmentMetadata => ({
  kind: "event",
  eventTitle: input.title.trim() || "Compromisso",
  eventCategory: input.category || "outro",
  eventCategoryLabel: input.categoryLabel || getEventCategoryLabel(input.category),
  eventLocation: input.location || "",
  eventNotes: input.notes || "",
  origin: input.origin || "neuronex",
  syncStatus: input.syncStatus || "pending",
});

export const buildSessionMetadata = (input: {
  sessionType?: string;
  modality?: string;
  durationMinutes?: number;
  notes?: string | null;
  origin?: AppointmentOrigin;
  syncStatus?: AppointmentSyncStatus;
  financial?: AppointmentMetadata["financial"];
}): AppointmentMetadata => ({
  kind: "session",
  sessionType: input.sessionType || "follow_up",
  modality: input.modality || "presencial",
  durationMinutes: input.durationMinutes,
  eventNotes: input.notes || "",
  origin: input.origin || "neuronex",
  syncStatus: input.syncStatus || "pending",
  financial: input.financial,
});

export const buildEventNotes = (metadata: AppointmentMetadata) => {
  const title = metadata.eventTitle || "Compromisso";
  const compact = {
    title,
    category: metadata.eventCategory || "outro",
    categoryLabel: metadata.eventCategoryLabel || getEventCategoryLabel(metadata.eventCategory),
    location: metadata.eventLocation || "",
  };

  return [title, `[EVENT]${JSON.stringify(compact)}`, metadata.eventNotes?.trim() || null]
    .filter(Boolean)
    .join("\n");
};
