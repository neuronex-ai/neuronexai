import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  AppointmentLifecycleError,
  appointmentAdminClient,
  appointmentCorsHeaders,
  appointmentErrorResponse,
  appointmentJson,
  appointmentTokenHash,
  publicRequestMetadata,
  resolveAppointmentInvitation,
  serializePublicAppointment,
} from "../_shared/appointment-lifecycle.ts";

type PublicAction = "confirm" | "cancel" | "reschedule";

function parseAction(value: unknown): PublicAction {
  const action = String(value || "") as PublicAction;
  if (!(["confirm", "cancel", "reschedule"] as string[]).includes(action)) {
    throw new AppointmentLifecycleError("Acao de agendamento invalida.", 400, "INVALID_ACTION");
  }
  return action;
}

function optionalIso(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) {
    throw new AppointmentLifecycleError("Data ou horario invalido.", 400, "INVALID_DATE");
  }
  return date.toISOString();
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: appointmentCorsHeaders });
  if (request.method !== "POST") return appointmentJson({ error: "Metodo nao permitido." }, 405);

  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || "").trim();
    const action = parseAction(body.action);
    await resolveAppointmentInvitation(appointmentAdminClient(), token);

    const db = appointmentAdminClient();
    const tokenHash = await appointmentTokenHash(token);
    const result = await db.rpc("process_appointment_public_action", {
      p_token_hash: tokenHash,
      p_action: action,
      p_reason: String(body.reason || "").trim() || null,
      p_requested_start_time: optionalIso(body.requestedStartTime),
      p_requested_end_time: optionalIso(body.requestedEndTime),
      p_metadata: publicRequestMetadata(request),
    });
    if (result.error) throw result.error;

    const refreshed = await resolveAppointmentInvitation(db, token);
    return appointmentJson({
      success: true,
      event: result.data?.event || action,
      idempotentReplay: Boolean(result.data?.idempotentReplay),
      ...serializePublicAppointment(refreshed),
    });
  } catch (error) {
    console.error("[process-public-appointment]", error);
    return appointmentErrorResponse(error);
  }
});
