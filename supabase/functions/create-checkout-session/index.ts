import {
  asaasRequest,
  corsResponse,
  errorResponse,
  getAuthenticatedUser,
  jsonResponse,
  sanitizeDigits,
  supabaseAdmin,
} from "../_shared/asaas-client.ts";
import {
  CHECKOUT_EXPIRATION_MINUTES,
  PROFESSIONAL_AMOUNT_CENTS,
  PROFESSIONAL_PLAN_CODE,
  PROFESSIONAL_PLAN_NAME,
  asaasBillingTypesForCheckout,
  asaasCheckoutUrl,
  checkoutAccessSnapshot,
  checkoutNextDueDate,
  findOrCreateAsaasCustomer,
  getOpenCheckoutSession,
  getUserSubscription,
  normalizePlanCode,
  publicPlanName,
  subscriptionMetadata,
} from "../_shared/subscription-access.ts";

type CheckoutRequest = {
  planId?: string;
  name?: string;
  email?: string;
  cpfCnpj?: string;
  phone?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  postalCode?: string;
  city?: string;
  state?: string;
};

type AsaasCheckoutResponse = {
  id?: string;
  object?: string;
  status?: string;
  [key: string]: unknown;
};

const PROFESSIONAL_AMOUNT = PROFESSIONAL_AMOUNT_CENTS / 100;
const FALLBACK_PUBLIC_APP_URL = "https://neuronex.ai";

function isPublicHttpsUrl(value?: string | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      hostname !== "localhost" &&
      hostname !== "127.0.0.1" &&
      !hostname.endsWith(".local")
    );
  } catch {
    return false;
  }
}

const resolveAppUrl = (req: Request) => {
  const candidates = [
    Deno.env.get("ASAAS_CHECKOUT_CALLBACK_URL"),
    Deno.env.get("FRONTEND_URL"),
    Deno.env.get("PUBLIC_APP_URL"),
    Deno.env.get("APP_URL"),
    Deno.env.get("SITE_URL"),
    req.headers.get("origin"),
    FALLBACK_PUBLIC_APP_URL,
  ];

  const configured = candidates.find(isPublicHttpsUrl) || FALLBACK_PUBLIC_APP_URL;
  return configured.replace(/\/+$/, "");
};

async function getProfile(userId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("full_name,name,first_name,last_name,phone,professional_address")
    .eq("id", userId)
    .maybeSingle();
  return data as any;
}

async function getFinancialDocument(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("financial_accounts")
    .select("cpf_cnpj,mobile_phone,address_street,address_number,address_complement,address_neighborhood,address_city,address_state,address_postal_code")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("create-checkout-session:financial-account-lookup", error);
    return null;
  }

  return data as any;
}

async function assertCustomerAvailableForUser(customerId: string, userId: string) {
  const normalizedCustomerId = String(customerId || "").trim();
  if (!normalizedCustomerId) return;

  const { data, error } = await supabaseAdmin
    .from("user_subscriptions")
    .select("user_id")
    .eq("asaas_customer_id", normalizedCustomerId)
    .neq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  if (data?.user_id) {
    const err: any = new Error(
      "Este CPF/CNPJ já está vinculado a outra conta NeuroNex. Use os dados da conta correta ou fale com o suporte.",
    );
    err.status = 409;
    err.code = "customer_already_linked";
    throw err;
  }
}

function profileName(profile: any, fallbackEmail: string) {
  const joinedName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
  return String(profile?.full_name || profile?.name || joinedName || fallbackEmail || "Cliente NeuroNex").trim();
}

function hasValidCpfCnpj(value?: string | null) {
  const digits = sanitizeDigits(value);
  return Boolean(digits && !/^0+$/.test(digits) && [11, 14].includes(digits.length));
}

function hasValidBrazilianPhone(value?: string | null) {
  const digits = sanitizeDigits(value);
  const localDigits = digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
  return Boolean(localDigits && !/^0+$/.test(localDigits) && [10, 11].includes(localDigits.length));
}

function trimString(value?: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    const trimmed = trimString(value);
    if (trimmed) return trimmed;
  }
  return "";
}

function profileAddress(profile: any) {
  return profile?.professional_address && typeof profile.professional_address === "object"
    ? profile.professional_address
    : {};
}

function hasValidCustomerAddress(value: {
  address?: string | null;
  addressNumber?: string | null;
  province?: string | null;
  postalCode?: string | null;
}) {
  return (
    trimString(value.address).length >= 3 &&
    trimString(value.addressNumber).length >= 1 &&
    trimString(value.province).length >= 2 &&
    sanitizeDigits(value.postalCode).length === 8
  );
}

function assertCheckoutAllowed(subscription: any) {
  if (!subscription) return;

  if (
    subscription.status === "active" &&
    subscription.access_state === "paid_access" &&
    subscription.asaas_subscription_id
  ) {
    const err: any = new Error("Sua assinatura paga já está ativa.");
    err.status = 409;
    throw err;
  }

  // Active trials are intentionally allowed to buy without ending their access.
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  if (req.method !== "POST") {
    return errorResponse("Método não permitido.", 405);
  }

  let sessionId = "";

  try {
    const user = await getAuthenticatedUser(req);
    const body = (await req.json().catch(() => ({}))) as CheckoutRequest;
    const planCode = normalizePlanCode(body.planId);

    if (planCode !== PROFESSIONAL_PLAN_CODE) {
      return errorResponse("Plano inválido para checkout.", 400);
    }

    const subscription = await getUserSubscription(user.id);
    assertCheckoutAllowed(subscription);
    const preservedAccess = checkoutAccessSnapshot(subscription);
    const nextDueDate = checkoutNextDueDate(subscription);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + CHECKOUT_EXPIRATION_MINUTES * 60 * 1000);
    sessionId = crypto.randomUUID();
    const externalReference = `nnx_sub_${user.id}_${sessionId}`;
    const appUrl = resolveAppUrl(req);
    const successUrl = `${appUrl}/payment/callback?status=success&session_id=${encodeURIComponent(externalReference)}`;
    const cancelUrl = `${appUrl}/payment/callback?status=cancelled&session_id=${encodeURIComponent(externalReference)}`;
    const expiredUrl = `${appUrl}/payment/callback?status=expired&session_id=${encodeURIComponent(externalReference)}`;
    const profile = await getProfile(user.id);
    const financialAccount = await getFinancialDocument(user.id);
    const profileAddr = profileAddress(profile);
    const customerName = String(body.name || profileName(profile, user.email || "")).trim();
    const customerEmail = String(body.email || user.email || "").trim();
    const cpfCnpj = sanitizeDigits(body.cpfCnpj || financialAccount?.cpf_cnpj);
    const phone = sanitizeDigits(body.phone || profile?.phone || financialAccount?.mobile_phone);
    const address = pickString(
      body.address,
      financialAccount?.address_street,
      profileAddr.street,
      profileAddr.address,
    );
    const addressNumber = pickString(
      body.addressNumber,
      financialAccount?.address_number,
      profileAddr.number,
      profileAddr.addressNumber,
    );
    const complement = pickString(
      body.complement,
      financialAccount?.address_complement,
      profileAddr.complement,
    );
    const province = pickString(
      body.province,
      financialAccount?.address_neighborhood,
      profileAddr.neighborhood,
      profileAddr.province,
    );
    const postalCode = sanitizeDigits(
      body.postalCode ||
      financialAccount?.address_postal_code ||
      profileAddr.postalCode ||
      profileAddr.postal_code,
    );

    if (!hasValidCpfCnpj(cpfCnpj)) {
      const err: any = new Error("Informe um CPF ou CNPJ válido para iniciar o checkout.");
      err.status = 422;
      err.code = "customer_document_required";
      err.requires_document = true;
      throw err;
    }

    if (!hasValidBrazilianPhone(phone)) {
      const err: any = new Error("Informe um telefone com DDD para iniciar o checkout.");
      err.status = 422;
      err.code = "customer_phone_required";
      err.requires_phone = true;
      throw err;
    }

    if (!hasValidCustomerAddress({ address, addressNumber, province, postalCode })) {
      const err: any = new Error("Informe CEP, endereço, número e bairro para iniciar o checkout.");
      err.status = 422;
      err.code = "customer_address_required";
      err.requires_address = true;
      throw err;
    }

    const customerId = await findOrCreateAsaasCustomer({
      userId: user.id,
      existingCustomerId: subscription?.asaas_customer_id,
      name: customerName,
      email: customerEmail,
      cpfCnpj,
      phone,
      address,
      addressNumber,
      complement,
      province,
      postalCode,
    });

    if (!customerId) {
      const err: any = new Error("Não foi possível criar o cliente Asaas com o CPF/CNPJ informado.");
      err.status = 422;
      err.code = "customer_document_required";
      err.requires_document = true;
      throw err;
    }

    await assertCustomerAvailableForUser(customerId, user.id);

    const existingCheckout = await getOpenCheckoutSession(user.id, planCode);
    if (existingCheckout?.checkout_url) {
      await supabaseAdmin
        .from("user_subscriptions")
        .update({
          ...preservedAccess,
          asaas_customer_id: customerId,
          asaas_checkout_id: existingCheckout.provider_checkout_id || null,
          external_reference: existingCheckout.external_reference,
          blocked_at: null,
          metadata: {
            ...((subscription?.metadata || {}) as Record<string, unknown>),
            checkout_external_reference: existingCheckout.external_reference,
            checkout_session_id: existingCheckout.id,
            checkout_reused_at: new Date().toISOString(),
            checkout_access_policy: "preserve_existing_until_payment_confirmation",
            checkout_next_due_date: nextDueDate,
            checkout_trial_ends_at: subscription?.trial_ends_at || null,
            checkout_customer_address_present: true,
            checkout_customer_phone_present: true,
          },
          status_version: Number(subscription?.status_version || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      await supabaseAdmin.from("subscription_audit_logs").insert({
        user_id: user.id,
        subscription_record_id: subscription?.id || null,
        checkout_session_id: existingCheckout.id,
        actor_type: "edge_function",
        action: "checkout_reused",
        from_status: subscription?.status || null,
        to_status: preservedAccess.status,
        from_access_state: subscription?.access_state || null,
        to_access_state: preservedAccess.access_state,
        reason: "user_resumed_open_checkout_access_preserved",
        metadata: {
          external_reference: existingCheckout.external_reference,
          provider_checkout_id: existingCheckout.provider_checkout_id,
          paid_access_requires_webhook: true,
        },
      });

      return jsonResponse({
        url: existingCheckout.checkout_url,
        session_id: existingCheckout.external_reference,
        provider_checkout_id: existingCheckout.provider_checkout_id,
        provider: "asaas",
        plan: publicPlanName(planCode),
        plan_code: planCode,
        amount_total: existingCheckout.amount_cents,
        currency: existingCheckout.currency,
        reused: true,
      });
    }

    const pendingPayload = {
      id: sessionId,
      user_id: user.id,
      subscription_record_id: subscription?.id || null,
      plan: PROFESSIONAL_PLAN_NAME,
      plan_code: planCode,
      provider: "asaas",
      external_reference: externalReference,
      amount_cents: PROFESSIONAL_AMOUNT_CENTS,
      currency: "BRL",
      status: "checkout_pending",
      expires_at: expiresAt.toISOString(),
      metadata: subscriptionMetadata({
        source: "create-checkout-session",
        previous_status: subscription?.status || null,
        previous_access_state: subscription?.access_state || null,
        preserved_status: preservedAccess.status,
        preserved_access_state: preservedAccess.access_state,
        trial_ends_at: subscription?.trial_ends_at || null,
        next_due_date: nextDueDate,
        has_customer_id: Boolean(customerId),
        has_customer_phone: Boolean(phone),
        has_customer_address: true,
      }),
      updated_at: now.toISOString(),
    };

    const { error: insertError } = await supabaseAdmin
      .from("subscription_checkout_sessions")
      .insert(pendingPayload);

    if (insertError) {
      if (insertError.code === "23505") {
        const racedCheckout = await getOpenCheckoutSession(user.id, planCode);
        if (racedCheckout?.checkout_url) {
          return jsonResponse({
            url: racedCheckout.checkout_url,
            session_id: racedCheckout.external_reference,
            provider_checkout_id: racedCheckout.provider_checkout_id,
            provider: "asaas",
            plan: publicPlanName(planCode),
            plan_code: planCode,
            amount_total: racedCheckout.amount_cents,
            currency: racedCheckout.currency,
            reused: true,
          });
        }
      }
      throw insertError;
    }

    const checkoutPayload: Record<string, unknown> = {
      billingTypes: asaasBillingTypesForCheckout(),
      chargeTypes: ["RECURRENT"],
      minutesToExpire: CHECKOUT_EXPIRATION_MINUTES,
      externalReference,
      callback: {
        cancelUrl,
        expiredUrl,
        successUrl,
      },
      items: [
        {
          name: "NeuroNex Professional",
          description: "Plano Professional NeuroNex AI - assinatura mensal",
          quantity: 1,
          value: PROFESSIONAL_AMOUNT,
        },
      ],
      subscription: {
        cycle: "MONTHLY",
        nextDueDate,
      },
    };

    checkoutPayload.customer = customerId;

    const checkout = await asaasRequest<AsaasCheckoutResponse>("/checkouts", "POST", checkoutPayload);
    const checkoutId = String(checkout.id || "");

    if (!checkoutId) {
      throw new Error("Asaas não retornou o identificador do checkout.");
    }

    const checkoutUrl = asaasCheckoutUrl(checkoutId);
    const { error: updateError } = await supabaseAdmin
      .from("subscription_checkout_sessions")
      .update({
        provider_checkout_id: checkoutId,
        checkout_url: checkoutUrl,
        status: "created",
        metadata: subscriptionMetadata({
          source: "create-checkout-session",
          asaas_checkout: checkout,
          preserved_status: preservedAccess.status,
          preserved_access_state: preservedAccess.access_state,
          trial_ends_at: subscription?.trial_ends_at || null,
          next_due_date: nextDueDate,
          has_customer_id: Boolean(customerId),
          has_customer_phone: Boolean(phone),
          has_customer_address: true,
        }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (updateError) throw updateError;

    const { error: subscriptionUpdateError } = await supabaseAdmin
      .from("user_subscriptions")
      .upsert(
        {
          user_id: user.id,
          ...preservedAccess,
          asaas_customer_id: customerId,
          asaas_checkout_id: checkoutId,
          external_reference: externalReference,
          blocked_at: null,
          metadata: {
            ...((subscription?.metadata || {}) as Record<string, unknown>),
            checkout_external_reference: externalReference,
            checkout_session_id: sessionId,
            checkout_started_at: new Date().toISOString(),
            checkout_access_policy: "preserve_existing_until_payment_confirmation",
            checkout_next_due_date: nextDueDate,
            checkout_trial_ends_at: subscription?.trial_ends_at || null,
            checkout_customer_phone_present: Boolean(phone),
            checkout_customer_address_present: true,
          },
          status_version: Number(subscription?.status_version || 0) + 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (subscriptionUpdateError) throw subscriptionUpdateError;

    await supabaseAdmin.from("subscription_audit_logs").insert({
      user_id: user.id,
      subscription_record_id: subscription?.id || null,
      checkout_session_id: sessionId,
      actor_type: "edge_function",
      action: "checkout_created",
      from_status: subscription?.status || null,
      to_status: preservedAccess.status,
      from_access_state: subscription?.access_state || null,
      to_access_state: preservedAccess.access_state,
      reason: "user_started_checkout_access_preserved",
      metadata: {
        external_reference: externalReference,
        provider_checkout_id: checkoutId,
        paid_access_requires_webhook: true,
      },
    });

    return jsonResponse({
      url: checkoutUrl,
      session_id: externalReference,
      provider_checkout_id: checkoutId,
      provider: "asaas",
      plan: PROFESSIONAL_PLAN_NAME,
      plan_code: planCode,
      amount_total: PROFESSIONAL_AMOUNT_CENTS,
      currency: "BRL",
      billing_types: asaasBillingTypesForCheckout(),
      boleto_available_in_checkout: false,
    });
  } catch (error) {
    console.error("create-checkout-session:error", error);

    if (sessionId) {
      await supabaseAdmin
        .from("subscription_checkout_sessions")
        .update({
          status: "failed",
          error_message: String((error as { message?: string })?.message || error),
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
    }

    const status = Number((error as { status?: number })?.status || 500);
    return errorResponse(
      String((error as { message?: string })?.message || "Não foi possível iniciar o checkout Asaas."),
      status,
      {
        code: (error as any)?.code,
        requires_document: Boolean((error as any)?.requires_document),
        requires_phone: Boolean((error as any)?.requires_phone),
        requires_address: Boolean((error as any)?.requires_address),
        trial_ends_at: (error as any)?.trial_ends_at,
      },
    );
  }
});
