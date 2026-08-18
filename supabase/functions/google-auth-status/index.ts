import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type IntegrationHealth = "not_connected" | "scope_missing" | "token_expired" | "configured" | "reconnect_required";

const clean = (value: unknown, max = 1000) => String(value ?? "").trim().slice(0, max);
const json = (payload: Record<string, unknown>, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
});

const scopesFrom = (value: unknown) => new Set(
  clean(value, 6000).split(/\s+/).map((scope) => scope.trim()).filter(Boolean),
);

const hasAnyScope = (scopes: Set<string>, candidates: string[]) =>
  candidates.some((candidate) => scopes.has(candidate));

function capability(scopePresent: boolean, tokenUsable: boolean, reconnectRequired: boolean) {
  let health: IntegrationHealth;
  if (!scopePresent) health = "scope_missing";
  else if (reconnectRequired) health = "reconnect_required";
  else if (!tokenUsable) health = "token_expired";
  else health = "configured";
  return {
    configured: scopePresent && tokenUsable && !reconnectRequired,
    scopePresent,
    health,
  };
}

async function refreshGoogleAccessToken(input: {
  refreshToken: string;
  userId: string;
  supabase: any;
}) {
  const clientId = clean(Deno.env.get("GOOGLE_CLIENT_ID"), 1000);
  const clientSecret = clean(Deno.env.get("GOOGLE_CLIENT_SECRET"), 1000);
  if (!clientId || !clientSecret || !input.refreshToken) {
    return { ok: false as const, reconnectRequired: false, reason: "refresh_unavailable" };
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: input.refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const googleError = clean(body?.error, 120).toLowerCase();
    return {
      ok: false as const,
      reconnectRequired: ["invalid_grant", "invalid_client", "unauthorized_client"].includes(googleError),
      reason: googleError || `http_${response.status}`,
    };
  }

  const accessToken = clean(body?.access_token, 8000);
  const expiresIn = Math.max(60, Number(body?.expires_in) || 3600);
  if (!accessToken) return { ok: false as const, reconnectRequired: false, reason: "missing_access_token" };

  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const { error } = await input.supabase
    .from("user_google_tokens")
    .update({
      access_token: accessToken,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", input.userId);
  if (error) throw error;

  return { ok: true as const, accessToken, expiresAt };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") return json({ connected: false, error: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase environment variables");

    const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ connected: false, error: "auth_required" }, 401);

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return json({ connected: false, error: "auth_failed" }, 401);

    const { data: tokenData, error: tokenError } = await supabase
      .from("user_google_tokens")
      .select("access_token,refresh_token,expires_at,scope,updated_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (tokenError) throw tokenError;

    if (!tokenData) {
      return json({
        connected: false,
        calendar: { configured: false, scopePresent: false, health: "not_connected" },
        gmail: { configured: false, scopePresent: false, health: "not_connected" },
        reconnectRequired: false,
      });
    }

    const scopes = scopesFrom(tokenData.scope);
    const calendarScope = hasAnyScope(scopes, [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
    ]);
    const gmailScope = hasAnyScope(scopes, [
      "https://www.googleapis.com/auth/gmail.send",
      "https://mail.google.com/",
    ]);

    let accessToken = clean(tokenData.access_token, 8000);
    let expiresAt = tokenData.expires_at ? String(tokenData.expires_at) : null;
    let reconnectRequired = false;
    let refreshAttempted = false;
    const expiresSoon = !expiresAt || new Date(expiresAt).getTime() <= Date.now() + 60_000;

    if (expiresSoon && tokenData.refresh_token) {
      refreshAttempted = true;
      const refreshed = await refreshGoogleAccessToken({
        refreshToken: clean(tokenData.refresh_token, 8000),
        userId: user.id,
        supabase,
      });
      if (refreshed.ok) {
        accessToken = refreshed.accessToken;
        expiresAt = refreshed.expiresAt;
      } else {
        reconnectRequired = refreshed.reconnectRequired;
      }
    }

    let tokenUsable = Boolean(accessToken && expiresAt && new Date(expiresAt).getTime() > Date.now());
    let email: string | null = null;

    if (tokenUsable && !reconnectRequired) {
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v1/userinfo?alt=json", {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(() => null);

      if (userInfoRes?.ok) {
        const userInfo = await userInfoRes.json().catch(() => ({}));
        email = clean(userInfo?.email, 320) || null;
      } else if (userInfoRes?.status === 401 && tokenData.refresh_token && !refreshAttempted) {
        refreshAttempted = true;
        const refreshed = await refreshGoogleAccessToken({
          refreshToken: clean(tokenData.refresh_token, 8000),
          userId: user.id,
          supabase,
        });
        if (refreshed.ok) {
          accessToken = refreshed.accessToken;
          expiresAt = refreshed.expiresAt;
          tokenUsable = true;
        } else {
          reconnectRequired = refreshed.reconnectRequired;
          tokenUsable = false;
        }
      } else if (userInfoRes?.status === 401 || userInfoRes?.status === 403) {
        tokenUsable = false;
      }
    }

    const calendar = capability(calendarScope, tokenUsable, reconnectRequired);
    const gmail = capability(gmailScope, tokenUsable, reconnectRequired);

    return json({
      connected: calendar.configured || gmail.configured,
      email,
      calendar,
      gmail,
      expiresAt,
      tokenUpdatedAt: tokenData.updated_at || null,
      refreshAttempted,
      reconnectRequired,
    });
  } catch (error) {
    console.error("google-auth-status:error", error instanceof Error ? error.message : error);
    return json({ connected: false, error: "google_status_unavailable" }, 500);
  }
});
