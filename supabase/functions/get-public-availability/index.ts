import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { calculatePatientAppointmentAvailability } from "../_shared/appointment-availability.ts";
import {
  appointmentAdminClient,
  appointmentCorsHeaders,
  appointmentErrorResponse,
  appointmentJson,
  resolveAppointmentInvitation,
} from "../_shared/appointment-lifecycle.ts";

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: appointmentCorsHeaders });
  }
  if (request.method !== "POST") {
    return appointmentJson({ error: "Método não permitido." }, 405);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const db = appointmentAdminClient();
    const context = await resolveAppointmentInvitation(
      db,
      String(body.token || "").trim(),
    );
    return appointmentJson(
      await calculatePatientAppointmentAvailability(db, context, body.date),
    );
  } catch (error) {
    console.error("[get-public-availability]", error);
    return appointmentErrorResponse(error);
  }
});
