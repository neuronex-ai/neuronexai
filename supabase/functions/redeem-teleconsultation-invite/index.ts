import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  buildSessionJoinInfo,
  cleanDisplayName,
  resolveTeleconsultationInvite,
} from "../_shared/teleconsultation-access.ts";

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
    const authorization = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    const user = authData.user;
    if (authError || !user) return json({ error: "Sessão de convidado inválida." }, 401);

    const isAnonymous = user.is_anonymous === true ||
      user.app_metadata?.provider === "anonymous" ||
      (Array.isArray(user.identities) && user.identities.length === 0);
    if (!isAnonymous) return json({ error: "Use uma sessão temporária para entrar na sala." }, 403);

    const body = await req.json().catch(() => ({}));
    const displayName = cleanDisplayName(body.displayName);
    if (!displayName) return json({ error: "Informe seu nome para entrar." }, 400);

    const admin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const resolved = await resolveTeleconsultationInvite(admin, body.inviteToken);
    if (!resolved) return json({ error: "Convite inválido, expirado ou revogado." }, 410);

    const { invite, appointment } = resolved;
    const now = new Date().toISOString();
    const { error: revokePreviousError } = await admin
      .from("teleconsultation_participants")
      .update({ revoked_at: now, last_seen_at: now })
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .neq("invite_id", invite.id);
    if (revokePreviousError) throw revokePreviousError;

    const { data: participant, error: participantError } = await admin
      .from("teleconsultation_participants")
      .upsert({
        appointment_id: appointment.id,
        invite_id: invite.id,
        user_id: user.id,
        display_name: displayName,
        expires_at: invite.expires_at,
        revoked_at: null,
        last_seen_at: now,
      }, { onConflict: "invite_id,user_id" })
      .select("id,user_id,appointment_id,display_name,expires_at")
      .single();
    if (participantError) throw participantError;

    await admin
      .from("teleconsultation_invites")
      .update({ last_used_at: now })
      .eq("id", invite.id);

    return json({
      participant,
      appointmentId: appointment.id,
      joinInfo: buildSessionJoinInfo(appointment),
    });
  } catch (error) {
    console.error("[redeem-teleconsultation-invite]", error);
    return json({ error: "Não foi possível validar sua entrada na sala." }, 500);
  }
});
