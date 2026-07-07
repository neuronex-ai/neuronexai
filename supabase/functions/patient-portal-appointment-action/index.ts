import {
  corsResponse,
  errorResponse,
  jsonResponse,
  supabaseAdmin,
} from "../_shared/asaas-client.ts";
import { requireActivePatientPortal } from "../_shared/patient-portal.ts";

type PortalAppointmentAction = "confirm" | "reschedule" | "cancel";

function clean(value: unknown) {
  return String(value || "").trim();
}

function normalizeAction(value: unknown): PortalAppointmentAction {
  const action = clean(value) as PortalAppointmentAction;
  if (!["confirm", "reschedule", "cancel"].includes(action)) throw new Error("Ação de agendamento inválida.");
  return action;
}

function validateFutureRange(newStartTime: unknown, newEndTime: unknown) {
  const start = new Date(clean(newStartTime));
  const end = new Date(clean(newEndTime));
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    throw new Error("Informe o novo início e fim do agendamento.");
  }
  if (start.getTime() <= Date.now()) throw new Error("Escolha um horário futuro.");
  if (end.getTime() <= start.getTime()) throw new Error("Horário final inválido.");
  if (end.getTime() - start.getTime() > 4 * 60 * 60 * 1000) throw new Error("Duração de consulta inválida.");
  return { start, end };
}

function formatAppointmentDate(value: unknown) {
  const date = new Date(String(value || ""));
  if (!Number.isFinite(date.getTime())) return "o horário agendado";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date).replace(",", " às");
}

async function loadAppointment(context: any, appointmentId: string) {
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select("id,user_id,patient_id,start_time,end_time,type,status,location,google_meet_link,notes,metadata,token,patient:patient_id(name)")
    .eq("id", appointmentId)
    .eq("patient_id", context.patient.id)
    .eq("user_id", context.professional.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Agendamento não encontrado no seu portal.");
  return data;
}

async function checkConflicts(appointment: any, start: Date, end: Date) {
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select("id")
    .eq("user_id", appointment.user_id)
    .neq("id", appointment.id)
    .not("status", "in", "(cancelled,canceled,cancelled_by_patient,cancelled_by_professional)")
    .lt("start_time", end.toISOString())
    .gt("end_time", start.toISOString())
    .limit(1);

  if (error) throw error;
  if (data && data.length > 0) throw new Error("O horário selecionado conflita com outro agendamento. Escolha outro horário.");
}

async function emitAppointmentNotification(appointment: any, event: "confirmed" | "cancelled" | "rescheduled") {
  const patientName = appointment.patient?.name || "um paciente";
  const formattedDate = formatAppointmentDate(appointment.start_time);

  let title = "Agendamento confirmado pelo paciente";
  let message = `A presença de ${patientName} foi confirmada para ${formattedDate}.`;
  let severity = "success";
  let priority = "normal";
  let requiresAction = false;

  if (event === "rescheduled") {
    title = "Reagendamento solicitado pelo paciente";
    message = `${patientName} solicitou reagendar a consulta para ${formattedDate}.`;
    severity = "warning";
    priority = "high";
    requiresAction = true;
  }

  if (event === "cancelled") {
    title = "Agendamento cancelado pelo paciente";
    message = `A consulta de ${patientName} foi cancelada pelo Portal do Paciente.`;
    severity = "warning";
    priority = "high";
    requiresAction = true;
  }

  const eventMinute = String(appointment.start_time || "").slice(0, 16);
  const eventId = `appointment:${appointment.id}:portal:${event}:${event === "rescheduled" ? eventMinute : "state"}`;

  const { error } = await supabaseAdmin.rpc("emit_user_notification", {
    p_user_id: appointment.user_id,
    p_event_id: eventId,
    p_type: `appointment_${event}`,
    p_category: "agenda",
    p_severity: severity,
    p_title: title,
    p_message: message,
    p_action_url: `/agenda?appointmentId=${appointment.id}`,
    p_priority: priority,
    p_data: {
      sourceModule: "patient_portal",
      eventSource: "patient_portal_appointment_action",
      appointmentId: appointment.id,
      patientId: appointment.patient_id,
      event,
      requiresAction,
      deadlineAt: appointment.start_time || null,
    },
    p_payload: {},
    p_organization_id: null,
  });

  if (error) console.error("[patient-portal-appointment-action] notification failed", error);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();
  if (req.method !== "POST") return errorResponse("Método não permitido.", 405);

  try {
    const { context, response } = await requireActivePatientPortal(req);
    if (response) return response;

    const body = await req.json().catch(() => ({}));
    const appointmentId = clean(body.appointmentId);
    if (!appointmentId) return errorResponse("Agendamento inválido.", 400);

    const action = normalizeAction(body.action);
    const appointment = await loadAppointment(context, appointmentId);

    let updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    let event: "confirmed" | "cancelled" | "rescheduled";

    if (action === "confirm") {
      updates = { ...updates, status: "confirmed" };
      event = "confirmed";
    } else if (action === "cancel") {
      updates = {
        ...updates,
        status: "cancelled_by_patient",
        notes: appointment.notes
          ? `${appointment.notes}\n[Cancelado pelo paciente via Portal do Paciente]`
          : "[Cancelado pelo paciente via Portal do Paciente]",
        metadata: {
          ...(appointment.metadata || {}),
          publicAppointmentAction: "cancelled_by_patient",
          publicAppointmentActionAt: new Date().toISOString(),
          origin: appointment.metadata?.origin || "patient_portal",
          syncStatus: "cancelled_by_patient",
        },
      };
      event = "cancelled";
    } else {
      const { start, end } = validateFutureRange(body.newStartTime, body.newEndTime);
      await checkConflicts(appointment, start, end);
      updates = {
        ...updates,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: "pending",
        metadata: {
          ...(appointment.metadata || {}),
          publicAppointmentAction: "rescheduled_by_patient",
          publicAppointmentActionAt: new Date().toISOString(),
          requestedStartTime: start.toISOString(),
          requestedEndTime: end.toISOString(),
          origin: appointment.metadata?.origin || "patient_portal",
          syncStatus: "pending_professional_review",
        },
      };
      event = "rescheduled";
    }

    const { data: updated, error } = await supabaseAdmin
      .from("appointments")
      .update(updates)
      .eq("id", appointment.id)
      .select("id,start_time,end_time,type,status,location,google_meet_link,created_at,updated_at,metadata,notes")
      .single();

    if (error) throw error;
    await emitAppointmentNotification({ ...appointment, ...updated }, event);

    return jsonResponse({ success: true, event, appointment: updated });
  } catch (error) {
    console.error("[patient-portal-appointment-action]", error);
    return errorResponse(error instanceof Error ? error.message : "Não foi possível processar o agendamento.", 400);
  }
});
