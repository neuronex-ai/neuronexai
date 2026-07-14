/**
 * asaas-checkout-branding
 *
 * Applies the NeuroNex / NeuroFinance premium monochrome identity to the
 * Asaas invoice/payment checkout shown to the payer.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  getAuthenticatedUser,
  getFinancialAccountAsaasApiKey,
} from "../_shared/asaas-client.ts";

type AsaasEnvironment = "production" | "sandbox";

type BrandingRequestBody = {
  logoBackgroundColor?: string;
  infoBackgroundColor?: string;
  fontColor?: string;
  enabled?: boolean;
  logoUrl?: string;
  logoBase64?: string;
  logoFileName?: string;
  logoMimeType?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400, extra?: Record<string, unknown>) {
  return jsonResponse({ error: message, ...(extra || {}) }, status);
}

function normalizeAsaasEnvironment(value?: string | null): AsaasEnvironment {
  const normalized = (value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (["production", "prod", "producao", "live"].includes(normalized)) return "production";
  return "sandbox";
}

function getAsaasBaseUrl() {
  const env = normalizeAsaasEnvironment(
    Deno.env.get("ASAAS_ENVIROMENT") ||
      Deno.env.get("ASAAS_ENVIRONMENT") ||
      Deno.env.get("ASAAS_ENV") ||
      "sandbox"
  );
  const configuredUrl = Deno.env.get("ASAAS_API_URL")?.trim().replace(/\/+$/, "") || "";
  const defaultUrl = env === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";

  if (env === "production" && configuredUrl.includes("api-sandbox.")) return defaultUrl;
  if (env === "sandbox" && configuredUrl.includes("api.asaas.com")) return defaultUrl;
  return configuredUrl || defaultUrl;
}

function onlyHexColor(value: unknown, fallback: string) {
  const raw = String(value || fallback).trim();
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : fallback;
}

function cleanBase64(value: string) {
  return value.replace(/^data:[^;]+;base64,/, "").replace(/\s/g, "");
}

function base64ToBlob(base64: string, mimeType: string) {
  const binary = atob(cleanBase64(base64));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

async function appendLogoIfAvailable(form: FormData, body: BrandingRequestBody) {
  const logoBase64 = body.logoBase64?.trim();
  const logoUrl = body.logoUrl?.trim() || Deno.env.get("ASAAS_CHECKOUT_LOGO_URL")?.trim();
  const logoMimeType = body.logoMimeType || "image/png";
  const logoFileName = body.logoFileName || "neuronex-logo.png";

  if (logoBase64) {
    form.append("logoFile", base64ToBlob(logoBase64, logoMimeType), logoFileName);
    return true;
  }

  if (!logoUrl) return false;

  const logoResponse = await fetch(logoUrl);
  if (!logoResponse.ok) throw new Error("Não foi possível baixar o logo para personalização da fatura.");

  const contentType = logoResponse.headers.get("content-type") || logoMimeType;
  const blob = await logoResponse.blob();
  form.append("logoFile", new Blob([blob], { type: contentType }), logoFileName);
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Método não suportado.", 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() || "";
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase service role não configurado.");

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const user = await getAuthenticatedUser(req);
    const body = (await req.json().catch(() => ({}))) as BrandingRequestBody;

    const { data: financialAccount, error: accountError } = await supabaseAdmin
      .from("financial_accounts")
      .select("id, user_id, asaas_account_id, metadata")
      .eq("user_id", user.id)
      .maybeSingle();

    if (accountError) throw accountError;
    if (!financialAccount) return errorResponse("Conta financeira Asaas não configurada.", 403);

    const apiKey = await getFinancialAccountAsaasApiKey(financialAccount);
    if (!apiKey) return errorResponse("Conta financeira Asaas não configurada.", 403);

    const logoBackgroundColor = onlyHexColor(body.logoBackgroundColor, "#FFFFFF");
    const infoBackgroundColor = onlyHexColor(body.infoBackgroundColor, "#0A0A0C");
    const fontColor = onlyHexColor(body.fontColor, "#FFFFFF");
    const enabled = body.enabled ?? true;

    const form = new FormData();
    form.append("logoBackgroundColor", logoBackgroundColor);
    form.append("infoBackgroundColor", infoBackgroundColor);
    form.append("fontColor", fontColor);
    form.append("enabled", String(enabled));

    const logoAttached = await appendLogoIfAvailable(form, body);

    const asaasResponse = await fetch(`${getAsaasBaseUrl()}/myAccount/paymentCheckoutConfig/`, {
      method: "POST",
      headers: {
        access_token: apiKey,
        "User-Agent": Deno.env.get("ASAAS_USER_AGENT")?.trim() || "NeuroNex/1.0",
      },
      body: form,
    });

    const asaasPayload = await asaasResponse.json().catch(() => ({}));
    if (!asaasResponse.ok) {
      const message =
        asaasPayload?.errors?.[0]?.description ||
        asaasPayload?.message ||
        `Asaas API error (${asaasResponse.status})`;
      return errorResponse(message, asaasResponse.status, { provider_response: asaasPayload });
    }

    await supabaseAdmin
      .from("financial_accounts")
      .update({
        metadata: {
          ...(financialAccount?.metadata || {}),
          checkout_branding: {
            provider: "asaas",
            logo_background_color: logoBackgroundColor,
            info_background_color: infoBackgroundColor,
            font_color: fontColor,
            enabled,
            logo_attached: logoAttached,
            applied_at: new Date().toISOString(),
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", financialAccount.id);

    return jsonResponse({
      success: true,
      branding: {
        logoBackgroundColor,
        infoBackgroundColor,
        fontColor,
        enabled,
        logoAttached,
      },
      provider_response: asaasPayload,
    });
  } catch (error: any) {
    console.error("asaas-checkout-branding error:", error);
    return errorResponse(error?.message || "Internal error", error?.status || 500);
  }
});
