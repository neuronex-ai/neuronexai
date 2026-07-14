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

        if (!code || !state) throw new Error("Missing code or state");

        const { userId } = JSON.parse(atob(state));

        const clientId = Deno.env.get("NOTION_CLIENT_ID");
        const clientSecret = Deno.env.get("NOTION_CLIENT_SECRET");
        const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/notion-auth-callback`;

        // Exchange code for access token
        const tokenResponse = await fetch("https://api.notion.com/v1/oauth/token", {
            method: "POST",
            headers: {
                Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                grant_type: "authorization_code",
                code: code,
                redirect_uri: redirectUri,
            }),
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error("Token exchange failed:", errorText);
            throw new Error(`Failed to exchange code: ${errorText}`);
        }

        const { access_token, workspace_id, bot_id } = await tokenResponse.json();

        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const { error: insertError } = await supabaseClient
            .from("user_notion_tokens")
            .upsert({
                user_id: userId,
                access_token,
                workspace_id,
                bot_id,
                updated_at: new Date().toISOString()
            }, { onConflict: "user_id" });

        if (insertError) throw insertError;

        // Redirect to frontend
        const frontendUrl = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";
        return Response.redirect(`${frontendUrl}/ajustes?status=success&service=notion`);

    } catch (error) {
        const frontendUrl = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";
        console.error("Notion Auth Error:", error);
        const message = getErrorMessage(error, "Notion authentication failed");
        return Response.redirect(`${frontendUrl}/ajustes?status=error&service=notion&message=${encodeURIComponent(message)}`);
    }
});
