import {
  asaasRequest,
  corsResponse,
  errorResponse,
  jsonResponse,
  supabaseAdmin,
} from "../_shared/asaas-client.ts";
import { paidPeriodEndPreservingTrial } from "../_shared/subscription-access.ts";

const PAID_CHECKOUT_STATUSES = new Set(["paid"]);
const PENDING_STATUSES = new Set(["created", "checkout_pending", "payment_pending", "pending", "updated"]);
const PAID_ASAAS_PAYMENT_STATUSES = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]);
const PENDING_ASAAS_PAYMENT_STATUSES = new Set(["PENDING", "AWAITING_RISK_ANALYSIS", "AUTHORIZED"]);

async function preserveCurrentAccess(checkout: any, metadata?: Record<string, unknown>) {
  const now = new Date().toISOString();

  const { data: current, error: currentError } = await supabaseAdmin
    .from("user_subscriptions")
    .select("id,plan,plan_code,status,access_state,metadata")
    .eq("user_id", checkout.user_id)
    .maybeSingle();
  if (currentError) throw currentError;

  let subscription = current;
  if (!subscription) {
    const { data, error } = await supabaseAdmin
      .from("user_subscriptions")
      .insert({
        user_id: checkout.user_id,
        plan: "Essential",
        plan_code: "essential",
        status: "active",
        access_state: "limited_access",
        metadata: {
          checkout_access_policy: "preserve_existing_until_payment_confirmation",
          ...(metadata || {}),
        },
        updated_at: now,
      })
      .select("id,plan,plan_code,status,access_state,metadata")
      .single();
    if (error) throw error;
    subscription = data;
  } else {
    const { error } = await supabaseAdmin
      .from("user_subscriptions")
      .update({
        metadata: {
          ...((subscription.metadata || {}) as Record<string, unknown>),
          checkout_access_policy: "preserve_existing_until_payment_confirmation",
          ...(metadata || {}),
        },
        updated_at: now,
      })
      .eq("user_id", checkout.user_id);
    if (error) throw error;
  }

  await supabaseAdmin.from("subscription_audit_logs").insert({
    user_id: checkout.user_id,
    subscription_record_id: subscription?.id || checkout.subscription_record_id || null,
    checkout_session_id: checkout.id,
    actor_type: "edge_function",
    action: "checkout_not_paid_access_preserved",
    from_status: current?.status || null,
    to_status: subscription?.status || "active",
    from_access_state: current?.access_state || null,
    to_access_state: subscription?.access_state || "limited_access",
    reason: "checkout_returned_without_payment_confirmation_access_unchanged",
    metadata: {
      external_reference: checkout.external_reference,
      paid_access_requires_webhook: true,
      ...(metadata || {}),
    },
  });
}

async function syncFromAsaasCheckout(checkout: any) {
  const checkoutId = String(checkout?.provider_checkout_id || "");
  if (!checkoutId) return { paid: false, pending: false, payment: null as any };

  const payments = await asaasRequest<any>(
    `/payments?checkoutSession=${encodeURIComponent(checkoutId)}&limit=10`,
    "GET",
  );
  const list = Array.isArray(payments?.data) ? payments.data : [];
  const paidPayment = list.find((payment: any) =>
    PAID_ASAAS_PAYMENT_STATUSES.has(String(payment?.status || "").toUpperCase())
  );
  const pendingPayment = list.find((payment: any) =>
    PENDING_ASAAS_PAYMENT_STATUSES.has(String(payment?.status || "").toUpperCase())
  );
  const payment = paidPayment || pendingPayment || list[0] || null;

  if (!payment) return { paid: false, pending: false, payment: null as any };

  const now = new Date().toISOString();
  const paymentStatus = String(payment.status || "").toUpperCase();
  const providerSubscriptionId = String(payment.subscription || checkout.provider_subscription_id || "");
  const periodEndBase = payment.dueDate ? new Date(`${payment.dueDate}T12:00:00Z`) : new Date();
  const providerPeriodEnd = new Date(periodEndBase.getTime());
  providerPeriodEnd.setUTCMonth(providerPeriodEnd.getUTCMonth() + 1);

  if (paidPayment) {
    const { data: currentSubscription, error: currentSubscriptionError } = await supabaseAdmin
      .from("user_subscriptions")
      .select("trial_ends_at")
      .eq("user_id", checkout.user_id)
      .maybeSingle();
    if (currentSubscriptionError) throw currentSubscriptionError;
    const currentPeriodEnd = paidPeriodEndPreservingTrial(
      providerPeriodEnd,
      currentSubscription?.trial_ends_at || checkout.metadata?.trial_ends_at || null,
    );

    await supabaseAdmin
      .from("subscription_checkout_sessions")
      .update({
        status: "paid",
        provider_payment_id: String(payment.id || ""),
        provider_subscription_id: providerSubscriptionId || null,
        paid_at: payment.paymentDate ? new Date(payment.paymentDate).toISOString() : now,
        metadata: {
          ...((checkout.metadata || {}) as Record<string, unknown>),
          verified_by: "verify-checkout-session",
          asaas_payment_status: paymentStatus,
        },
        updated_at: now,
      })
      .eq("id", checkout.id);

    const { data: subscription } = await supabaseAdmin
      .from("user_subscriptions")
      .update({
        plan: "Professional",
        plan_code: "professional",
        status: "active",
        access_state: "paid_access",
        asaas_subscription_id: providerSubscriptionId || null,
        asaas_checkout_id: checkout.provider_checkout_id || null,
        last_payment_id: String(payment.id || ""),
        last_payment_status: paymentStatus,
        last_payment_event_at: now,
        current_period_start: now,
        current_period_end: currentPeriodEnd.toISOString(),
        blocked_at: null,
        grace_period_ends_at: null,
        external_reference: checkout.external_reference,
        updated_at: now,
      })
      .eq("user_id", checkout.user_id)
      .select("id,status,access_state")
      .maybeSingle();

    await supabaseAdmin.from("subscription_audit_logs").insert({
      user_id: checkout.user_id,
      subscription_record_id: subscription?.id || checkout.subscription_record_id || null,
      checkout_session_id: checkout.id,
      actor_type: "edge_function",
      action: "payment_confirmed_by_server_sync",
      to_status: "active",
      to_access_state: "paid_access",
      reason: "verify_checkout_session_asaas_paid",
      metadata: {
        provider_payment_id: String(payment.id || ""),
        provider_subscription_id: providerSubscriptionId || null,
        asaas_payment_status: paymentStatus,
      },
    });

    return { paid: true, pending: false, payment };
  }

  if (pendingPayment) {
    await supabaseAdmin
      .from("subscription_checkout_sessions")
      .update({
        status: "payment_pending",
        provider_payment_id: String(payment.id || ""),
        provider_subscription_id: providerSubscriptionId || null,
        billing_type: payment.billingType || null,
        metadata: {
          ...((checkout.metadata || {}) as Record<string, unknown>),
          verified_by: "verify-checkout-session",
          asaas_payment_status: paymentStatus,
        },
        updated_at: now,
      })
      .eq("id", checkout.id);

    await supabaseAdmin
      .from("user_subscriptions")
      .update({
        asaas_subscription_id: providerSubscriptionId || null,
        last_payment_id: String(payment.id || ""),
        last_payment_status: paymentStatus,
        last_payment_event_at: now,
        updated_at: now,
      })
      .eq("user_id", checkout.user_id);

    return { paid: false, pending: true, payment };
  }

  return { paid: false, pending: false, payment };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  if (req.method !== "POST") {
    return errorResponse("Metodo nao permitido.", 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = String(body.session_id || body.external_reference || "").trim();

    if (!sessionId) {
      return errorResponse("Sessao de checkout nao informada.", 400);
    }

    const { data: checkout, error } = await supabaseAdmin
      .from("subscription_checkout_sessions")
      .select("*")
      .eq("external_reference", sessionId)
      .maybeSingle();

    if (error) throw error;
    if (!checkout) {
      return errorResponse("Sessao de checkout nao encontrada.", 404);
    }

    const asaasSync = await syncFromAsaasCheckout(checkout).catch((syncError) => {
      console.warn("verify-checkout-session:asaas-sync-error", syncError);
      return { paid: false, pending: false, payment: null as any };
    });

    const { data: refreshedCheckout, error: refreshedCheckoutError } = await supabaseAdmin
      .from("subscription_checkout_sessions")
      .select("status,provider_payment_id,provider_subscription_id,paid_at")
      .eq("id", checkout.id)
      .maybeSingle();

    if (refreshedCheckoutError) throw refreshedCheckoutError;

    const { data: subscription, error: subscriptionError } = await supabaseAdmin
      .from("user_subscriptions")
      .select("plan,status,access_state,asaas_subscription_id,current_period_end,last_payment_id,last_payment_status,last_payment_event_at")
      .eq("user_id", checkout.user_id)
      .maybeSingle();

    if (subscriptionError) throw subscriptionError;

    const checkoutStatus = String(refreshedCheckout?.status || checkout.status || "checkout_pending");
    const subscriptionStatus = String(subscription?.status || "inactive");
    const isPaid =
      asaasSync.paid ||
      PAID_CHECKOUT_STATUSES.has(checkoutStatus);
    const isPending = !isPaid && (asaasSync.pending || PENDING_STATUSES.has(checkoutStatus));

    if (!isPaid) {
      await preserveCurrentAccess(checkout, {
        checkout_status: checkoutStatus,
        asaas_sync_pending: asaasSync.pending,
      });
    }

    return jsonResponse({
      plan_name: checkout.plan === "Professional" ? "NeuroNex Professional" : checkout.plan,
      amount_total: checkout.amount_cents,
      subscription_id:
        subscription?.asaas_subscription_id ||
        checkout.provider_subscription_id ||
        checkout.provider_checkout_id ||
        checkout.external_reference,
      status: isPaid ? "paid" : isPending ? "pending" : checkoutStatus,
      checkout_status: checkoutStatus,
      subscription_status: subscriptionStatus,
      is_paid: isPaid,
      is_active: isPaid,
      payment_confirmation_source: asaasSync.paid ? "asaas_payment_lookup" : PAID_CHECKOUT_STATUSES.has(checkoutStatus) ? "checkout_session_paid" : null,
      message: isPaid
        ? "Pagamento confirmado."
        : isPending
          ? "Pagamento em processamento. A liberacao acontece apos confirmacao da Asaas."
          : "Checkout nao confirmado.",
    });
  } catch (error) {
    console.error("verify-checkout-session:error", error);
    return errorResponse("Nao foi possivel verificar o checkout.", 500);
  }
});
