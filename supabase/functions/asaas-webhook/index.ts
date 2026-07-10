/**
 * asaas-webhook
 *
 * Canonical Asaas webhook endpoint. The actual handler lives in _shared so
 * compatibility endpoints can process events with the exact same logic.
 */

import { handleAsaasWebhookRequest } from "../_shared/asaas-webhook-handler.ts";

Deno.serve(handleAsaasWebhookRequest);
