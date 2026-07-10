/**
 * asaas-notifications-webhook
 *
 * Compatibility endpoint for the Asaas "NOTIFICATIONS" webhook. It reuses the
 * canonical Asaas webhook handler so both Asaas endpoints share auth,
 * idempotency, persistence, and event routing.
 */

import { handleAsaasWebhookRequest } from "../_shared/asaas-webhook-handler.ts";

Deno.serve(handleAsaasWebhookRequest);
