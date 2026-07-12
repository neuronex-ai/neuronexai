import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  buildSessionJoinInfo,
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
    const { inviteToken } = await req.json().catch(() => ({}));
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const resolved = await resolveTeleconsultationInvite(admin, inviteToken);
    if (!resolved) return json({ error: "Convite inválido, expirado ou revogado." }, 410);

    return json(buildSessionJoinInfo(resolved.appointment));
  } catch (error) {
    console.error("[get-session-join-info]", error);
    return json({ error: "Não foi possível carregar os dados de entrada." }, 500);
  }
});
