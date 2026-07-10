/**
 * asaas-notifications-webhook
 *
 * Compatibility endpoint for the Asaas "NOTIFICATIONS" webhook.
 * It validates the same asaas-access-token used by asaas-webhook, then forwards
 * the event to the canonical Asaas webhook handler.
 */

import {
    corsHeaders,
    corsResponse,
    errorResponse,
    validateAsaasWebhookToken,
} from "../_shared/asaas-client.ts";

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return corsResponse();

    if (req.method !== "POST") {
        return errorResponse("Method not allowed", 405);
    }

    if (!validateAsaasWebhookToken(req)) {
        console.error("[asaas-notifications-webhook] Invalid webhook token");
        return errorResponse("Unauthorized", 401);
    }

    const body = await req.text();
    const token = req.headers.get("asaas-access-token") || "";
    const targetUrl = new URL("/functions/v1/asaas-webhook", req.url).toString();

    const upstream = await fetch(targetUrl, {
        method: "POST",
        headers: {
            "content-type": req.headers.get("content-type") || "application/json",
            "asaas-access-token": token,
        },
        body,
    });

    const responseBody = await upstream.text();
    const contentType = upstream.headers.get("content-type") || "application/json";

    return new Response(responseBody, {
        status: upstream.status,
        headers: {
            ...corsHeaders,
            "content-type": contentType,
        },
    });
});
