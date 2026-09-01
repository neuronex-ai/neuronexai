import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const errorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const source = error as Record<string, unknown>;
    return [source.message, source.details, source.hint, source.code]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join(" — ") || "unknown_database_error";
  }
  return String(error || "unknown_error");
};

async function refreshAccessToken(
  supabaseService: any,
  userId: string,
  refreshToken: string,
) {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")?.trim();
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")?.trim();

  if (!clientId || !clientSecret || !refreshToken) {
    return { ok: false as const, reconnectRequired: false, reason: "refresh_unavailable" };
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  const tokens = await tokenResponse.json().catch(() => ({}));

  if (!tokenResponse.ok) {
    const reason = String(tokens?.error || `http_${tokenResponse.status}`).trim();
    return {
      ok: false as const,
      reconnectRequired: ["invalid_grant", "invalid_client", "unauthorized_client"].includes(reason),
      reason,
    };
  }

  const accessToken = String(tokens?.access_token || "").trim();
  if (!accessToken) {
    return { ok: false as const, reconnectRequired: false, reason: "missing_access_token" };
  }

  const expiresAt = new Date(Date.now() + Math.max(60, Number(tokens?.expires_in) || 3600) * 1000);
  const { error } = await supabaseService
    .from("user_google_tokens")
    .update({
      access_token: accessToken,
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) throw error;

  return { ok: true as const, accessToken };
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
    return json({ error: "Server configuration error: Missing environment variables" }, 500);
  }

  const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "auth_required" }, 401);

    const { data: { user }, error: userError } = await supabaseService.auth
      .getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) return json({ error: "auth_failed" }, 401);

    const { data: tokenData, error: tokenError } = await supabaseService
      .from("user_google_tokens")
      .select("access_token,refresh_token,expires_at,scope")
      .eq("user_id", user.id)
      .maybeSingle();
    if (tokenError) throw tokenError;

    if (!tokenData) {
      return json({ success: false, skipped: true, reason: "google_not_connected", imported: 0, processed: 0 });
    }

    let accessToken = String(tokenData.access_token || "").trim();
    let refreshAttempted = false;

    if (!accessToken || !tokenData.expires_at || new Date(tokenData.expires_at).getTime() <= Date.now() + 60_000) {
      refreshAttempted = true;
      const refreshed = await refreshAccessToken(
        supabaseService,
        user.id,
        String(tokenData.refresh_token || ""),
      );
      if (!refreshed.ok) {
        return json({
          success: false,
          skipped: true,
          reason: refreshed.reconnectRequired ? "google_reconnect_required" : "google_token_refresh_failed",
          imported: 0,
          processed: 0,
        });
      }
      accessToken = refreshed.accessToken;
    }

    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const calendarUrl =
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&showDeleted=true`;

    const fetchCalendar = (token: string) => fetch(calendarUrl, {
      headers: { "Authorization": `Bearer ${token}` },
    }).catch(() => null);

    let calRes = await fetchCalendar(accessToken);

    if (calRes?.status === 401 && tokenData.refresh_token && !refreshAttempted) {
      refreshAttempted = true;
      const refreshed = await refreshAccessToken(
        supabaseService,
        user.id,
        String(tokenData.refresh_token),
      );
      if (refreshed.ok) {
        accessToken = refreshed.accessToken;
        calRes = await fetchCalendar(accessToken);
      } else if (refreshed.reconnectRequired) {
        return json({ success: false, skipped: true, reason: "google_reconnect_required", imported: 0, processed: 0 });
      }
    }

    if (!calRes) {
      return json({
        success: false,
        skipped: true,
        reason: "google_calendar_temporarily_unavailable",
        retryAfterSeconds: 300,
        imported: 0,
        processed: 0,
      });
    }

    if (!calRes.ok) {
      const googleStatus = calRes.status;
      const reason = googleStatus === 401
        ? "google_reconnect_required"
        : googleStatus === 403
        ? "google_calendar_permission_unavailable"
        : "google_calendar_temporarily_unavailable";

      console.warn("google-calendar-poll:calendar-unavailable", { status: googleStatus, reason });
      return json({
        success: false,
        skipped: true,
        reason,
        googleStatus,
        retryAfterSeconds: googleStatus === 429 || googleStatus >= 500 ? 300 : 900,
        imported: 0,
        processed: 0,
      });
    }

    const calData = await calRes.json();
    const googleEvents = Array.isArray(calData.items) ? calData.items : [];
    let processedCount = 0;
    let locallyProtectedCount = 0;
    let failedCount = 0;
    const failedEvents: Array<{ googleEventId: string; reason: string }> = [];

    for (const event of googleEvents) {
      if (!event.id) continue;

      try {
        const { data: existing, error: existingError } = await supabaseService
          .from("appointments")
          .select(
            "id, user_id, patient_id, start_time, end_time, status, lifecycle_status, type, notes, location, metadata, audit_metadata, updated_at",
          )
          .eq("user_id", user.id)
          .eq("google_event_id", event.id)
          .maybeSingle();
        if (existingError) throw existingError;

        const isCancelledGoogle = event.status === "cancelled";

        if (existing) {
          if (localChangedAfterLastSync(existing)) {
            locallyProtectedCount++;
            continue;
          }

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
        } else if (
          !isCancelledGoogle && event.start?.dateTime && event.end?.dateTime
        ) {
          const metadata = eventMetadata(event);
          const { error: insertError } = await supabaseService.from("appointments").insert({
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
          if (insertError) throw insertError;
          processedCount++;
        }
      } catch (eventError) {
        failedCount++;
        const reason = errorMessage(eventError).slice(0, 600);
        if (failedEvents.length < 20) {
          failedEvents.push({ googleEventId: String(event.id), reason });
        }
        console.warn("google-calendar-poll:event-skipped", {
          googleEventId: String(event.id),
          status: String(event.status || "unknown"),
          reason,
        });
      }
    }

    const partial = failedCount > 0;
    return json({
      success: !partial,
      partial,
      reason: partial ? "google_calendar_partial_sync" : undefined,
      processed: processedCount,
      imported: processedCount,
      locallyProtected: locallyProtectedCount,
      failed: failedCount,
      failedEvents,
    });
  } catch (e: any) {
    console.error("google-calendar-poll:error", errorMessage(e));
    return json({ error: "google_calendar_poll_failed" }, 500);
  }
});
