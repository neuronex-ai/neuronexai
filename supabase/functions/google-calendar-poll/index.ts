import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function refreshAccessToken(
  supabaseService: any,
  userId: string,
  refreshToken: string,
) {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!.trim(),
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!.trim(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });

  if (!tokenResponse.ok) return null;
  const tokens = await tokenResponse.json();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await supabaseService
    .from("user_google_tokens")
    .update({
      access_token: tokens.access_token,
      expires_at: expiresAt.toISOString(),
    })
    .eq("user_id", userId);

  return tokens.access_token;
}

const normalizeGoogleDescription = (description?: string) =>
  (description || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();

const eventMetadata = (event: any) => ({
  kind: "event",
  eventTitle: event.summary || "Compromisso",
  eventCategory: "google",
  eventCategoryLabel: "Google Agenda",
  eventLocation: event.location || "",
  eventNotes: normalizeGoogleDescription(event.description),
  origin: "google",
  syncStatus: "imported",
  lastSyncedAt: new Date().toISOString(),
  googleUpdatedAt: event.updated || null,
});

const eventNotes = (event: any) => {
  const metadata = eventMetadata(event);
  const compact = {
    title: metadata.eventTitle,
    category: metadata.eventCategory,
    categoryLabel: metadata.eventCategoryLabel,
    location: metadata.eventLocation,
  };
  return [
    metadata.eventTitle,
    `[EVENT]${JSON.stringify(compact)}`,
    metadata.eventNotes || null,
  ]
    .filter(Boolean)
    .join("\n");
};

const localChangedAfterLastSync = (appointment: any) => {
  const metadata = appointment.metadata || {};
  const localUpdatedAt = metadata.localUpdatedAt || appointment.updated_at;
  const lastSyncedAt = metadata.lastSyncedAt;
  if (!localUpdatedAt || !lastSyncedAt) return false;
  return new Date(localUpdatedAt).getTime() >
    new Date(lastSyncedAt).getTime() + 1000;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({
        error: "Server configuration error: Missing environment variables",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth header");
    const { data: { user }, error: userError } = await supabaseService.auth
      .getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) throw new Error("Invalid token");

    const { data: tokenData } = await supabaseService
      .from("user_google_tokens")
      .select("*")
      .eq("user_id", user.id)
      .single();
    if (!tokenData) throw new Error("Google not connected");

    let accessToken = tokenData.access_token;
    if (new Date(tokenData.expires_at) < new Date(Date.now() + 60000)) {
      accessToken = await refreshAccessToken(
        supabaseService,
        user.id,
        tokenData.refresh_token,
      );
    }

    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString();
    const calendarUrl =
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&showDeleted=true`;

    const calRes = await fetch(calendarUrl, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });
    if (!calRes.ok) throw new Error("Failed to fetch Google Calendar");

    const calData = await calRes.json();
    const googleEvents = calData.items || [];
    let processedCount = 0;

    for (const event of googleEvents) {
      if (!event.id) continue;

      const { data: existing } = await supabaseService
        .from("appointments")
        .select(
          "id, user_id, patient_id, start_time, end_time, status, lifecycle_status, type, notes, location, metadata, audit_metadata, updated_at",
        )
        .eq("google_event_id", event.id)
        .maybeSingle();

      const isCancelledGoogle = event.status === "cancelled";

      if (existing) {
        if (localChangedAfterLastSync(existing)) continue;

        const metadata = {
          ...(existing.metadata || {}),
          ...eventMetadata(event),
          syncStatus: "synced",
        };
        const updatePayload: any = { metadata };
        let patientMaterialChange = false;

        if (isCancelledGoogle) {
          if (existing.patient_id) {
            updatePayload.patient_right_status = "financially_protected";
            updatePayload.financial_outcome = "protected";
            updatePayload.financial_protection_reason =
              "google_calendar_cancellation_requires_review";
            updatePayload.outcome_review_required = true;
            updatePayload.change_responsibility = "professional";
            patientMaterialChange = true;
          } else {
            updatePayload.status = "cancelled_by_professional";
          }
        } else if (event.start?.dateTime && event.end?.dateTime) {
          const dbStart = new Date(existing.start_time).getTime();
          const dbEnd = new Date(existing.end_time).getTime();
          const googleStart = new Date(event.start.dateTime).getTime();
          const googleEnd = new Date(event.end.dateTime).getTime();

          if (Math.abs(dbStart - googleStart) > 1000) {
            updatePayload.start_time = event.start.dateTime;
            patientMaterialChange = Boolean(existing.patient_id);
          }
          if (Math.abs(dbEnd - googleEnd) > 1000) {
            updatePayload.end_time = event.end.dateTime;
            patientMaterialChange = Boolean(existing.patient_id);
          }

          if (
            (existing.metadata || {}).kind === "event" ||
            existing.type === "block"
          ) {
            updatePayload.notes = eventNotes(event);
            updatePayload.location = event.location || null;
          } else if ((event.location || null) !== (existing.location || null)) {
            updatePayload.location = event.location || null;
            patientMaterialChange = true;
          }
        }

        if (patientMaterialChange) {
          updatePayload.updated_by = user.id;
          updatePayload.action_origin = "google_calendar";
          updatePayload.last_actor_type = "psychologist";
          updatePayload.audit_metadata = {
            source: "google_calendar_poll",
            googleEventId: event.id,
            googleUpdatedAt: event.updated || null,
            cancellationDetected: isCancelledGoogle,
          };
        }

        if (Object.keys(updatePayload).length > 1 || updatePayload.metadata) {
          updatePayload.audit_metadata = {
            ...(existing.audit_metadata || {}),
            ...(updatePayload.audit_metadata || {}),
            source: "google_calendar_poll",
            googleEventId: event.id,
            googleUpdatedAt: event.updated || null,
            googleMutationMarker: event.updated || `${event.id}:${event.status || "confirmed"}`,
          };
          const { error: updateError } = await supabaseService
            .from("appointments")
            .update(updatePayload)
            .eq("id", existing.id)
            .eq("user_id", user.id);
          if (updateError) throw updateError;
          processedCount++;
        }
      } else if (
        !isCancelledGoogle && event.start?.dateTime && event.end?.dateTime
      ) {
        const metadata = eventMetadata(event);
        await supabaseService.from("appointments").insert({
          user_id: user.id,
          start_time: event.start.dateTime,
          end_time: event.end.dateTime,
          type: "block",
          notes: eventNotes(event),
          location: event.location || null,
          status: "unscored",
          metadata,
          google_event_id: event.id,
          patient_id: null,
        });
        processedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        imported: processedCount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
