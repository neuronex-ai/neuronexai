import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getErrorMessage } from "../_shared/error-message.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const errorParam = url.searchParams.get("error");

        if (errorParam) {
            throw new Error(`OAuth Error: ${errorParam}`);
        }
        if (!code || !state) {
            throw new Error("Missing code or state");
        }

        const decodedState = JSON.parse(atob(state));
        const userId = decodedState.userId;

        const clientId = Deno.env.get("MICROSOFT_CLIENT_ID");
        const clientSecret = Deno.env.get("MICROSOFT_CLIENT_SECRET");
        const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/microsoft-auth-callback`;

        // Exchange token
        const tokenParams = new URLSearchParams({
            client_id: clientId!,
            scope: "Tasks.ReadWrite User.Read offline_access",
            code: code,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
            client_secret: clientSecret!,
        });

        const tokenResponse = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: tokenParams.toString(),
        });

        if (!tokenResponse.ok) {
            const errText = await tokenResponse.text();
            console.error("Token Error:", errText);
            throw new Error(`Failed to exchange token: ${errText}`);
        }

        const { access_token, refresh_token, expires_in } = await tokenResponse.json();
        const expiresAt = new Date(Date.now() + expires_in * 1000);

        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const { error: insertError } = await supabaseClient
            .from("user_microsoft_tokens")
            .upsert({
                user_id: userId,
                access_token,
                refresh_token,
                expires_at: expiresAt.toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: "user_id" });

        if (insertError) throw insertError;

        const frontendUrl = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";
        return Response.redirect(`${frontendUrl}/ajustes?status=success&service=microsoft`);

    } catch (error) {
        const frontendUrl = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";
        console.error("Microsoft Auth Error:", error);
        const message = getErrorMessage(error, "Microsoft authentication failed");
        return Response.redirect(`${frontendUrl}/ajustes?status=error&service=microsoft&message=${encodeURIComponent(message)}`);
    }
});
