import { calculatePatientAppointmentAvailability } from "../_shared/appointment-availability.ts";
import {
  appointmentCorsHeaders,
  appointmentErrorResponse,
  appointmentJson,
  AppointmentLifecycleError,
  publicRequestMetadata,
  resolveAppointmentContextById,
} from "../_shared/appointment-lifecycle.ts";
import { serializePublicAppointment } from "../_shared/appointment-public-dto.ts";
import { supabaseAdmin } from "../_shared/asaas-client.ts";
import { requireActivePatientPortal } from "../_shared/patient-portal.ts";

type PortalAction =
  | "state"
  | "availability"
  | "confirm"
  | "cancel"
  | "reschedule";

function parseAction(value: unknown): PortalAction {
  const action = String(value || "state") as PortalAction;
  if (
    !["state", "availability", "confirm", "cancel", "reschedule"].includes(
      action,
    )
  ) {
    throw new AppointmentLifecycleError(
      "Ação de agendamento inválida.",
      400,
      "INVALID_ACTION",
    );
  }
  return action;
}

function requiredAppointmentId(value: unknown) {
  const appointmentId = String(value || "").trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(appointmentId)
  ) {
    throw new AppointmentLifecycleError(
      "Agendamento inválido.",
      400,
      "INVALID_APPOINTMENT",
    );
  }
  return appointmentId;
}

function expectedRevision(value: unknown) {
  const revision = Number(value);
  if (!Number.isInteger(revision) || revision < 1) {
    throw new AppointmentLifecycleError(
      "Atualize os dados do agendamento e tente novamente.",
      409,
      "REVISION_REQUIRED",
    );
  }
  return revision;
}

function optionalIso(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) {
    throw new AppointmentLifecycleError(
      "Data ou horário inválido.",
      400,
      "INVALID_DATE",
    );
  }
  return date.toISOString();
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: appointmentCorsHeaders });
  }
  if (request.method !== "POST") {
    return appointmentJson({ error: "Método não permitido." }, 405);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = parseAction(body.action);
    const appointmentId = requiredAppointmentId(body.appointmentId);
    const { user, context: portal, response } =
      await requireActivePatientPortal(request);
    if (response) return response;

    const context = await resolveAppointmentContextById(
      supabaseAdmin,
      appointmentId,
      {
        patientId: portal.patient!.id,
        professionalId: portal.professional!.id,
      },
    );

    if (action === "state") {
      return appointmentJson(serializePublicAppointment(context));
    }
    if (action === "availability") {
      return appointmentJson(
        await calculatePatientAppointmentAvailability(
          supabaseAdmin,
          context,
          body.date,
        ),
      );
    }

    const reason = String(body.reason || "").trim();
    if (reason.length > 500) {
      throw new AppointmentLifecycleError(
        "O motivo deve ter no máximo 500 caracteres.",
        400,
        "REASON_TOO_LONG",
      );
    }

    const result = await supabaseAdmin.rpc(
      "process_patient_portal_appointment_action_internal",
      {
        p_patient_user_id: user.id,
        p_appointment_id: appointmentId,
        p_expected_revision: expectedRevision(body.expectedRevision),
        p_action: action,
        p_reason: reason || null,
        p_requested_start_time: optionalIso(body.requestedStartTime),
        p_requested_end_time: optionalIso(body.requestedEndTime),
        p_metadata: publicRequestMetadata(request),
      },
    );
    if (result.error) {
      if (result.error.code === "40001") {
        throw new AppointmentLifecycleError(
          "Este agendamento mudou em outra aba. Atualize os dados e tente novamente.",
          409,
          "STALE_APPOINTMENT",
        );
      }
      throw result.error;
    }

    const refreshed = await resolveAppointmentContextById(
      supabaseAdmin,
      appointmentId,
      {
        patientId: portal.patient!.id,
        professionalId: portal.professional!.id,
      },
    );
    return appointmentJson({
      success: true,
      idempotentReplay: Boolean(result.data?.idempotentReplay),
      ...serializePublicAppointment(refreshed),
    });
  } catch (error) {
    console.error("[patient-portal-appointment-action]", error);
    return appointmentErrorResponse(error);
  }
});
