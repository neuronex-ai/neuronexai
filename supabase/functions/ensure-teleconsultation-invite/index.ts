import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  requireRequestEntitlement,
  subscriptionAccessErrorResponse,
} from "../_shared/subscription-access.ts";
import { ensureTeleconsultationInvite, isUuid } from "../_shared/teleconsultation-access.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    ...corsHeaders,
    "Content-Type": "application/json",
    "Cache-Control": "no-store, max-age=0",
  },
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user } = await requireRequestEntitlement(req, "telemedicine");
    const { appointmentId, action = "ensure" } = await req.json().catch(() => ({}));
    if (!isUuid(appointmentId)) return json({ error: "Agendamento inválido." }, 400);
    if (!["ensure", "rotate", "revoke"].includes(action)) {
      return json({ error: "Ação de convite inválida." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const { data: appointment, error } = await admin
      .from("appointments")
      .select("id,user_id,type,start_time,end_time,google_meet_link")
      .eq("id", appointmentId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!appointment) return json({ error: "Agendamento não encontrado." }, 404);

    if (action === "rotate" || action === "revoke") {
      const now = new Date().toISOString();
      const { error: revokeError } = await admin
        .from("teleconsultation_invites")
        .update({ revoked_at: now, updated_at: now })
        .eq("appointment_id", appointment.id)
        .is("revoked_at", null);
      if (revokeError) throw revokeError;

      const { error: participantError } = await admin
        .from("teleconsultation_participants")
        .update({ revoked_at: now, last_seen_at: now })
        .eq("appointment_id", appointment.id)
        .is("revoked_at", null);
      if (participantError) throw participantError;

      if (action === "revoke") {
        const { error: appointmentUpdateError } = await admin
          .from("appointments")
          .update({ google_meet_link: null, updated_at: now })
          .eq("id", appointment.id)
          .eq("user_id", user.id);
        if (appointmentUpdateError) throw appointmentUpdateError;
        return json({ revoked: true });
      }
    }

    return json(await ensureTeleconsultationInvite(admin, appointment));
  } catch (error) {
    const accessResponse = subscriptionAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    console.error("[ensure-teleconsultation-invite]", error);
    return json({ error: "Não foi possível preparar o convite da sala." }, 500);
  }
});
