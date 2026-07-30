import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ensureTeleconsultationInvite } from "../_shared/teleconsultation-access.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function refreshAccessToken(supabaseService: any, userId: string, refreshToken: string) {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });

  if (!tokenResponse.ok) return null;
  const tokens = await tokenResponse.json();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await supabaseService
    .from("user_google_tokens")
    .update({ access_token: tokens.access_token, expires_at: expiresAt.toISOString() })
    .eq("user_id", userId);

  return tokens.access_token;
}

const frontendUrl = () => Deno.env.get("FRONTEND_URL") || "https://neuronexai.com.br";
const metadataOf = (appointment: any) => appointment?.metadata || {};

const titleOf = (appointment: any) => {
  const metadata = metadataOf(appointment);
  if (metadata.kind === "event") return metadata.eventTitle || appointment.notes?.split("\n")?.[0] || "Compromisso";
  return `Consulta: ${appointment.patient?.name || appointment.patient_name || "Paciente"}`;
};

const teleconsultationLinkOf = (appointment: any) => {
  if (appointment?.type !== "online") return null;
  return typeof appointment.google_meet_link === "string" &&
      /\/join\/[a-f0-9]{64}$/i.test(appointment.google_meet_link)
    ? appointment.google_meet_link
    : null;
};

const descriptionOf = (appointment: any) => {
  const metadata = metadataOf(appointment);
  if (metadata.kind === "event") {
    return [
      `Categoria: ${metadata.eventCategoryLabel || metadata.eventCategory || "Compromisso"}`,
      `Notas: ${metadata.eventNotes || appointment.notes || "Nenhuma"}`,
      "",
      "---",
      "Compromisso sincronizado pelo NeuroNex.",
    ].join("\n");
  }

  const teleconsultationLink = teleconsultationLinkOf(appointment);
  return [
    `Tipo: ${appointment.type === "online" ? "Teleconsulta (Online)" : "Presencial"}`,
    `Sessao: ${metadata.sessionType || "follow_up"}`,
    teleconsultationLink ? `Link da teleconsulta NeuroNex: ${teleconsultationLink}` : null,
    `Notas: ${appointment.notes || "Nenhuma"}`,
    "",
    "---",
    "Evento sincronizado pelo NeuroNex.",
  ].filter(Boolean).join("\n");
};

const patchFromAppointment = (appointment: any) => {
  const metadata = metadataOf(appointment);
  const patch: any = {
    summary: titleOf(appointment),
    description: descriptionOf(appointment),
    start: { dateTime: appointment.start_time, timeZone: "America/Sao_Paulo" },
    end: { dateTime: appointment.end_time, timeZone: "America/Sao_Paulo" },
  };

  const teleconsultationLink = teleconsultationLinkOf(appointment);
  const location = metadata.kind === "event"
    ? metadata.eventLocation || appointment.location
    : teleconsultationLink || appointment.location;
  if (location) patch.location = location;

  return patch;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseService = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: userError } = await supabaseService.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, googleEventId, appointmentData } = await req.json();
    if (!googleEventId) {
      return new Response(JSON.stringify({ message: "No Google Event ID provided, skipping sync." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tokenData } = await supabaseService
      .from("user_google_tokens")
      .select("*")
      .eq("user_id", user.id)
      .single();
    if (!tokenData) {
      return new Response(JSON.stringify({ error: "Google not connected" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let accessToken = tokenData.access_token;
    if (new Date(tokenData.expires_at) < new Date(Date.now() + 60000)) {
      accessToken = await refreshAccessToken(supabaseService, user.id, tokenData.refresh_token);
    }
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Google authorization expired" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(googleEventId)}`;
    let response: Response | undefined;

    if (action === "delete") {
      response = await fetch(`${baseUrl}?sendUpdates=all`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } else if (action === "update" && appointmentData) {
      let safeAppointmentData = appointmentData;
      if (appointmentData.type === "online" && appointmentData.id) {
        const { data: storedAppointment, error: appointmentError } = await supabaseService
          .from("appointments")
          .select("id,user_id,type,start_time,end_time,google_meet_link,metadata,notes,location,patient_id")
          .eq("id", appointmentData.id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (appointmentError) throw appointmentError;
        if (!storedAppointment) throw new Error("Appointment not found");
        const invite = await ensureTeleconsultationInvite(supabaseService, storedAppointment);
        safeAppointmentData = { ...appointmentData, google_meet_link: invite.meetLink };
      }
      response = await fetch(`${baseUrl}?sendUpdates=all`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patchFromAppointment(safeAppointmentData)),
      });
    } else {
      return new Response(JSON.stringify({ error: "Unsupported Google Calendar action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (response && !response.ok && response.status !== 410) {
      const errText = await response.text();
      console.error("Google Calendar API Error:", errText);
      return new Response(JSON.stringify({ error: "Failed to sync with Google", details: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
