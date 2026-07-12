import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error("Google Token Refresh Error:", errorText);
    throw new Error("Failed to refresh Google access token.");
  }

  const tokens = await tokenResponse.json();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await supabaseService
    .from("user_google_tokens")
    .update({ access_token: tokens.access_token, expires_at: expiresAt.toISOString() })
    .eq("user_id", userId);

  return tokens.access_token;
}

const getMetadata = (appointment: any) => appointment?.metadata || {};
const isSession = (appointment: any) => getMetadata(appointment).kind !== "event" && appointment.patient_id;
const isOnline = (appointment: any) => appointment.type === "online" || getMetadata(appointment).modality === "online";

const buildEventBody = (appointment: any, patient: any, userEmail?: string, profileAddress?: string) => {
  const metadata = getMetadata(appointment);
  const session = isSession(appointment);
  const teleconsultationLink = session && isOnline(appointment) &&
      typeof appointment.google_meet_link === "string" &&
      /\/join\/[a-f0-9]{64}$/i.test(appointment.google_meet_link)
    ? appointment.google_meet_link
    : null;
  const title = session
    ? `Consulta: ${patient?.name || appointment.patient_name || "Paciente"}`
    : metadata.eventTitle || appointment.notes?.split("\n")?.[0] || "Compromisso";

  const location = session
    ? isOnline(appointment)
      ? teleconsultationLink || appointment.location || "Teleconsulta NeuroNex"
      : appointment.location || profileAddress || undefined
    : metadata.eventLocation || appointment.location || undefined;

  const description = session
    ? [
        `Tipo: ${isOnline(appointment) ? "Teleconsulta (Online)" : "Presencial"}`,
        `Sessão: ${metadata.sessionType || "follow_up"}`,
        ...(teleconsultationLink ? [`Link da teleconsulta NeuroNex: ${teleconsultationLink}`] : []),
        `Notas: ${appointment.notes || "Nenhuma"}`,
        "",
        `Paciente: ${patient?.name || "N/A"}`,
        `Email: ${patient?.email || "N/A"}`,
        `Telefone: ${patient?.phone || "N/A"}`,
        "",
        "---",
        "Evento sincronizado pelo NeuroNex.",
      ].join("\n")
    : [
        `Categoria: ${metadata.eventCategoryLabel || metadata.eventCategory || "Compromisso"}`,
        `Notas: ${metadata.eventNotes || appointment.notes || "Nenhuma"}`,
        "",
        "---",
        "Compromisso sincronizado pelo NeuroNex.",
      ].join("\n");

  const body: any = {
    summary: title,
    description,
    start: { dateTime: appointment.start_time, timeZone: "America/Sao_Paulo" },
    end: { dateTime: appointment.end_time, timeZone: "America/Sao_Paulo" },
    attendees: [
      ...(userEmail ? [{ email: userEmail }] : []),
      ...(session && patient?.email ? [{ email: patient.email }] : []),
    ],
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 24 * 60 },
        { method: "popup", minutes: 30 },
      ],
    },
    sendUpdates: session ? "all" : "none",
  };

  if (location) body.location = location;

  return body;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseService = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { appointment, patient } = await req.json();
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: { user }, error: userError } = await supabaseService.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: tokenData } = await supabaseService
      .from("user_google_tokens")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!tokenData) {
      return new Response(JSON.stringify({ error: "Google tokens not found for user" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let accessToken = tokenData.access_token;
    if (new Date(tokenData.expires_at) < new Date(Date.now() + 60000)) {
      accessToken = await refreshAccessToken(supabaseService, user.id, tokenData.refresh_token);
    }

    const { data: profileData } = await supabaseService
      .from("profiles")
      .select("address")
      .eq("id", user.id)
      .single();

    const calendarResponse = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Goog-Request-Reason": "Creating appointment from NeuroNex",
      },
      body: JSON.stringify(buildEventBody(appointment, patient, user.email, profileData?.address)),
    });

    if (!calendarResponse.ok) {
      const errorText = await calendarResponse.text();
      console.error("Google Calendar API Error:", errorText);
      return new Response(JSON.stringify({ error: "Failed to create calendar event", details: errorText }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const eventData = await calendarResponse.json();

    return new Response(JSON.stringify({
      message: "Event created successfully",
      googleEventId: eventData.id,
      googleMeetLink: eventData.hangoutLink,
      googleUpdatedAt: eventData.updated,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    console.error("Unhandled error in google-calendar-sync:", e);
    return new Response(JSON.stringify({ error: "Internal server error", details: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
