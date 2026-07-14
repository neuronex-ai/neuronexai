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
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            {
                global: {
                    headers: { Authorization: req.headers.get("Authorization")! },
                },
            }
        );

        const {
            data: { user },
            error,
        } = await supabaseClient.auth.getUser();

        if (error || !user) throw new Error("No user found");

        const clientId = Deno.env.get("MICROSOFT_CLIENT_ID");
        const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/microsoft-auth-callback`;
        const state = btoa(JSON.stringify({ userId: user.id }));
        const scopes = encodeURIComponent("Tasks.ReadWrite User.Read offline_access");

        const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=query&scope=${scopes}&state=${state}`;

        return new Response(JSON.stringify({ url: authUrl }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: getErrorMessage(error, "Microsoft authentication failed") }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
