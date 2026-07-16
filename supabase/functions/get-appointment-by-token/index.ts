import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  appointmentAdminClient,
  appointmentCorsHeaders,
  appointmentErrorResponse,
  appointmentJson,
  publicRequestMetadata,
  resolveAppointmentInvitation,
} from "../_shared/appointment-lifecycle.ts";
import { serializePublicAppointment } from "../_shared/appointment-public-dto.ts";

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: appointmentCorsHeaders });
  }
  if (request.method !== "POST") {
    return appointmentJson({ error: "Método não permitido." }, 405);
  }

  try {
    const { token } = await request.json().catch(() => ({}));
    const db = appointmentAdminClient();
    let context = await resolveAppointmentInvitation(db, String(token || ""));

    if (!context.tokenRow.opened_at) {
      const opened = await db.rpc("mark_appointment_invitation_opened", {
        p_token_hash: context.tokenHash,
        p_metadata: publicRequestMetadata(request),
      });
      if (opened.error) throw opened.error;
      context = await resolveAppointmentInvitation(db, String(token || ""));
    }

    return appointmentJson(serializePublicAppointment(context));
  } catch (error) {
    console.error("[get-appointment-by-token]", error);
    return appointmentErrorResponse(error);
  }
});
