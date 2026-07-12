import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SignJWT, importPKCS8 } from "https://deno.land/x/jose@v4.14.4/index.ts";
import {
  requireRequestEntitlement,
  subscriptionAccessErrorResponse,
} from "../_shared/subscription-access.ts";
import {
  buildSessionJoinInfo,
  isUuid,
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

const roomIdFrom = (body: Record<string, any>) => {
  const explicit = String(body.appointmentId || "");
  if (isUuid(explicit)) return explicit;
  const roomName = String(body.roomName || "");
  const candidate = roomName.split("/").filter(Boolean).at(-1) || "";
  return isUuid(candidate) ? candidate : null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const appId = Deno.env.get("JITSI_APP_ID");
    const privateKeyValue = Deno.env.get("JITSI_PRIVATE_KEY");
    const configuredKeyId = Deno.env.get("JITSI_KEY_ID");
    if (!appId || !privateKeyValue || !configuredKeyId) {
      return json({ error: "Configuração da sala indisponível." }, 503);
    }

    const body = await req.json().catch(() => ({}));
    const appointmentId = roomIdFrom(body);
    if (!appointmentId) return json({ error: "Sala inválida." }, 400);

    const authorization = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    const authUser = authData.user;
    if (authError || !authUser) return json({ error: "Sessão inválida." }, 401);

    const admin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const isAnonymous = authUser.is_anonymous === true ||
      authUser.app_metadata?.provider === "anonymous" ||
      (Array.isArray(authUser.identities) && authUser.identities.length === 0);

    let appointment: Record<string, any> | null = null;
    let displayName = "Participante";
    let email = "";
    let avatar = "";
    let moderator = false;
    let inviteExpiresAt: string | null = null;

    if (isAnonymous) {
      const resolved = await resolveTeleconsultationInvite(admin, body.inviteToken);
      if (!resolved || resolved.appointment.id !== appointmentId) {
        return json({ error: "Convite inválido, expirado ou revogado." }, 410);
      }

      const { data: participant, error: participantError } = await admin
        .from("teleconsultation_participants")
        .select("display_name,expires_at")
        .eq("appointment_id", appointmentId)
        .eq("invite_id", resolved.invite.id)
        .eq("user_id", authUser.id)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (participantError) throw participantError;
      if (!participant) return json({ error: "Entrada do participante não validada." }, 403);

      const joinInfo = buildSessionJoinInfo(resolved.appointment);
      if (!joinInfo.canJoin) return json({ error: joinInfo.waitMessage || "A sala ainda não foi liberada." }, 409);

      appointment = resolved.appointment;
      displayName = participant.display_name;
      inviteExpiresAt = participant.expires_at;
    } else {
      const entitlement = await requireRequestEntitlement(req, "telemedicine");
      const { data, error } = await admin
        .from("appointments")
        .select("id,user_id,type,status,metadata")
        .eq("id", appointmentId)
        .eq("user_id", entitlement.user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data || data.type !== "online") return json({ error: "Sala não encontrada." }, 404);

      appointment = data;
      displayName = entitlement.user.user_metadata?.full_name ||
        entitlement.user.user_metadata?.first_name ||
        entitlement.user.email?.split("@")[0] ||
        "Profissional";
      email = entitlement.user.email || "";
      avatar = entitlement.user.user_metadata?.avatar_url || "";
      moderator = true;
    }

    const decision = appointment?.metadata?.teleconsultationTranscription;
    const transcriptionEnabled = decision?.enabled === true;
    const now = Math.floor(Date.now() / 1000);
    const inviteExpiry = inviteExpiresAt
      ? Math.floor(new Date(inviteExpiresAt).getTime() / 1000)
      : now + 2 * 60 * 60;
    const expiresAt = Math.max(now + 60, Math.min(now + 2 * 60 * 60, inviteExpiry));
    const privateKey = await importPKCS8(privateKeyValue.replace(/\\n/g, "\n"), "RS256");
    const keyId = configuredKeyId.includes("/")
      ? configuredKeyId
      : `${appId}/${configuredKeyId}`;

    const payload = {
      context: {
        user: {
          id: authUser.id,
          name: displayName,
          email,
          avatar,
          moderator,
        },
        features: moderator
          ? {
            recording: true,
            transcription: transcriptionEnabled,
            livestreaming: false,
            "screen-sharing": true,
            "outbound-call": false,
            "sip-outbound-call": false,
          }
          : {
            recording: false,
            transcription: false,
            livestreaming: false,
            "screen-sharing": true,
            "outbound-call": false,
            "sip-outbound-call": false,
          },
      },
      room: appointmentId,
    };

    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: keyId })
      .setIssuedAt(now)
      .setIssuer("chat")
      .setAudience("jitsi")
      .setSubject(appId)
      .setExpirationTime(expiresAt)
      .setNotBefore(now - 10)
      .sign(privateKey);

    return json({ token, room: appointmentId, moderator, expiresAt });
  } catch (error) {
    const accessResponse = subscriptionAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    console.error("[generate-jitsi-token]", error);
    return json({ error: "Não foi possível autorizar a entrada na sala." }, 500);
  }
});
