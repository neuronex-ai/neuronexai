import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  appointmentAdminClient,
  appointmentCorsHeaders,
  appointmentErrorResponse,
  appointmentJson,
  AppointmentLifecycleError,
  appointmentTokenHash,
  publicRequestMetadata,
  resolveAppointmentInvitation,
} from "../_shared/appointment-lifecycle.ts";
import { serializePublicAppointment } from "../_shared/appointment-public-dto.ts";

type PublicAction = "confirm" | "cancel" | "reschedule";

function parseAction(value: unknown): PublicAction {
  const action = String(value || "") as PublicAction;
  if (!(["confirm", "cancel", "reschedule"] as string[]).includes(action)) {
    throw new AppointmentLifecycleError(
      "Ação de agendamento inválida.",
      400,
      "INVALID_ACTION",
    );
  }
  return action;
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

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: appointmentCorsHeaders });
  }
  if (request.method !== "POST") {
    return appointmentJson({ error: "Método não permitido." }, 405);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || "").trim();
    const action = parseAction(body.action);
    const reason = String(body.reason || "").trim();
    if (reason.length > 500) {
      throw new AppointmentLifecycleError(
        "O motivo deve ter no m\u00e1ximo 500 caracteres.",
        400,
        "REASON_TOO_LONG",
      );
    }
    await resolveAppointmentInvitation(appointmentAdminClient(), token);

    const db = appointmentAdminClient();
    const tokenHash = await appointmentTokenHash(token);
    const result = await db.rpc("process_appointment_public_action", {
      p_token_hash: tokenHash,
      p_action: action,
      p_reason: reason || null,
      p_requested_start_time: optionalIso(body.requestedStartTime),
      p_requested_end_time: optionalIso(body.requestedEndTime),
      p_metadata: publicRequestMetadata(request),
    });
    if (result.error) throw result.error;

    const refreshed = await resolveAppointmentInvitation(db, token);
    return appointmentJson({
      success: true,
      idempotentReplay: Boolean(result.data?.idempotentReplay),
      ...serializePublicAppointment(refreshed),
    });
  } catch (error) {
    console.error("[process-public-appointment]", error);
    return appointmentErrorResponse(error);
  }
});
