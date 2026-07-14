import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getErrorMessage } from "../_shared/error-message.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-todoist-hmac-sha256",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const signature = req.headers.get("x-todoist-hmac-sha256");
        // In a real app, verify signature with TODOIST_CLIENT_SECRET here.

        const payload = await req.json();
        console.log("Todoist Webhook received:", payload);

        const { event_name, event_data } = payload;

        if (event_name === "item:completed") {
            console.log(`Task completed: ${event_data.content} (ID: ${event_data.id})`);
            // Logic to update local tasks would go here
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: getErrorMessage(error, "Invalid Todoist webhook request") }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
