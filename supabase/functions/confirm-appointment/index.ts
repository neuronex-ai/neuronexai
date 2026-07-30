import {
  appointmentAdminClient,
  appointmentTokenHash,
  publicRequestMetadata,
  resolveAppointmentInvitation,
} from "../_shared/appointment-lifecycle.ts";
import { getErrorMessage } from "../_shared/error-message.ts";

function frontendBaseUrl() {
  const configured = String(Deno.env.get("FRONTEND_URL") || "http://localhost:8080")
    .trim()
    .replace(/\/$/, "");
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configured)) {
    return configured;
  }
  return configured.startsWith("https://")
    ? configured
    : `https://${configured.replace(/^http:\/\//i, "")}`;
}

function redirect(baseUrl: string, outcome: "success" | "failure", params: Record<string, string> = {}) {
  const destination = new URL("/agenda", `${baseUrl}/`);
  destination.searchParams.set("confirmation", outcome);
  for (const [key, value] of Object.entries(params)) {
    destination.searchParams.set(key, value);
  }
  return Response.redirect(destination.toString(), 302);
}

Deno.serve(async (request) => {
  const baseUrl = frontendBaseUrl();
  try {
    const token = new URL(request.url).searchParams.get("token")?.trim();
    if (!token) {
      return redirect(baseUrl, "failure", { message: "Token de confirmação ausente." });
    }

    const db = appointmentAdminClient();
    const invitation = await resolveAppointmentInvitation(db, token);
    const result = await db.rpc("process_appointment_public_action", {
      p_token_hash: await appointmentTokenHash(token),
      p_action: "confirm",
      p_reason: null,
      p_requested_start_time: null,
      p_requested_end_time: null,
      p_metadata: {
        ...publicRequestMetadata(request),
        compatibility_endpoint: "confirm-appointment",
      },
    });
    if (result.error) throw result.error;

    return redirect(baseUrl, "success", {
      appointmentId: invitation.appointment.id,
      replay: result.data?.idempotentReplay ? "1" : "0",
    });
  } catch (error) {
    console.error("[confirm-appointment]", error);
    return redirect(baseUrl, "failure", {
      message: getErrorMessage(error, "Não foi possível confirmar a consulta."),
    });
  }
});
