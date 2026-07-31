import {
  ASAAS_ENV,
  asaasRequest,
  createAsaasPayment,
  findOrCreateAsaasCustomer,
  getAsaasPixQrCode,
  getFinancialAccount,
  getFinancialAccountAsaasApiKey,
  supabaseAdmin,
} from "./asaas-client.ts";
import {
  estimatePaymentFee,
  normalizePaymentMethod,
  normalizePaymentState,
} from "./neurofinance-financial.ts";
import { ensureFinancialEntryForCharge } from "./financial-management.ts";
import {
  neurofinanceBillingType,
  neurofinanceChargeOperationId,
  requireNeurofinancePatientDocument,
} from "./neurofinance-charge-contract.ts";
import { requireEntitlementForUser } from "./subscription-access.ts";

export type NeurofinanceChargePayload = {
  patient_id?: string | null;
  appointment_id?: string | null;
  amount: number;
  payment_method?: string | null;
  payment_methods?: string[] | null;
  description?: string | null;
  due_date?: string | null;
  patient_name?: string | null;
  patient_cpf?: string | null;
  patient_email?: string | null;
  financial_entry_id?: string | null;
  operation_id?: string | null;
};

export async function createNeurofinanceChargeForUser(input: {
  userId: string;
  payload: NeurofinanceChargePayload;
  enforceEntitlement?: boolean;
}) {
  const accountUser = await supabaseAdmin.auth.admin.getUserById(input.userId);
  if (accountUser.error || !accountUser.data.user) {
    throw accountUser.error || new Error("Conta profissional não encontrada.");
  }
  if (input.enforceEntitlement !== false) {
    await requireEntitlementForUser(
      {
        id: accountUser.data.user.id,
        email: accountUser.data.user.email,
        user_metadata: accountUser.data.user.user_metadata,
      },
      "neurofinance",
    );
  }

  const payload = input.payload;
  const amount = Number(payload.amount);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Valor da cobrança inválido.");
  }
  const operationId = neurofinanceChargeOperationId(payload);

  const resolvedMethod = payload.payment_method || payload.payment_methods?.[0] ||
    "patient_decides";
  const financialAccount = await getFinancialAccount(input.userId);
  const subApiKey = await getFinancialAccountAsaasApiKey(financialAccount);
  if (!financialAccount || !subApiKey) {
    throw new Error("Conta financeira não configurada. Complete o onboarding primeiro.");
  }

  let patientData = {
    name: payload.patient_name || "Paciente",
    cpfCnpj: payload.patient_cpf || "",
    email: payload.patient_email || undefined,
  };
  if (payload.patient_id && (!payload.patient_name || !payload.patient_cpf)) {
    const patientResult = await supabaseAdmin
      .from("patients")
      .select("name,cpf,email")
      .eq("id", payload.patient_id)
      .eq("user_id", input.userId)
      .maybeSingle();
    if (patientResult.error) throw patientResult.error;
    if (patientResult.data) {
      patientData = {
        name: patientResult.data.name || patientData.name,
        cpfCnpj: patientResult.data.cpf || patientData.cpfCnpj,
        email: patientResult.data.email || patientData.email,
      };
    }
  }

  patientData.cpfCnpj = requireNeurofinancePatientDocument(patientData.cpfCnpj);

  const asaasCustomer = await findOrCreateAsaasCustomer(subApiKey, {
    name: patientData.name,
    cpfCnpj: patientData.cpfCnpj,
    email: patientData.email,
    externalReference: payload.patient_id || undefined,
  });
  const billingType = neurofinanceBillingType(resolvedMethod);
  const normalizedMethod = normalizePaymentMethod(billingType);
  const feeEstimate = await estimatePaymentFee(amount, normalizedMethod, 1);
  const initialState = normalizePaymentState({ status: "PENDING" }, "PAYMENT_CREATED");
  const today = new Date().toISOString().slice(0, 10);
  const dueDate = payload.due_date || today;
  const description = payload.description || "Cobrança NeuroFinance";

  const financialEntry = await ensureFinancialEntryForCharge({
    userId: input.userId,
    financialEntryId: payload.financial_entry_id || null,
    operationId,
    patientId: payload.patient_id || null,
    appointmentId: payload.appointment_id || null,
    amount,
    description,
    dueDate,
    paymentMethod: normalizedMethod,
  });
  const previousResult = await supabaseAdmin
    .from("nb_payments")
    .select("*")
    .eq("user_id", input.userId)
    .eq("financial_entry_id", financialEntry.id)
    .filter("metadata->>operation_id", "eq", operationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (previousResult.error) throw previousResult.error;
  if (previousResult.data) {
    const previous = previousResult.data;
    return {
      success: true,
      payment_id: previous.id,
      financial_entry_id: financialEntry.id,
      asaas_payment_id: previous.provider_payment_id,
      status: previous.normalized_status || previous.status,
      amount,
      checkout_url: previous.checkout_url,
      invoice_url: previous.checkout_url,
      bank_slip_url: previous.metadata?.asaas_bank_slip_url || null,
      pix_qr_code: previous.pix_qr_code,
      pix_copy_paste: previous.pix_copy_paste,
      expires_at: previous.expires_at,
      billing_type: previous.metadata?.billing_type || null,
      asaas_environment: ASAAS_ENV,
      idempotent_replay: true,
    };
  }

  const providerList = await asaasRequest<{ data?: any[] }>(
    `/payments?externalReference=${encodeURIComponent(operationId)}&limit=1`,
    "GET",
    undefined,
    subApiKey,
  );
  const asaasPayment = providerList.data?.[0] || await createAsaasPayment(subApiKey, {
    customer: asaasCustomer.id,
    billingType,
    value: amount / 100,
    dueDate,
    description,
    externalReference: operationId,
  });

  let pixQrCode: string | null = null;
  let pixCopyPaste: string | null = null;
  if (billingType === "PIX" && asaasPayment.id) {
    try {
      const qrData = await getAsaasPixQrCode(subApiKey, asaasPayment.id);
      pixQrCode = qrData.encodedImage;
      pixCopyPaste = qrData.payload;
    } catch (error) {
      console.error("[neurofinance-charge] QR code unavailable", error);
    }
  }

  const paymentInsert = await supabaseAdmin
    .from("nb_payments")
    .insert({
      user_id: input.userId,
      patient_id: payload.patient_id || null,
      appointment_id: payload.appointment_id || null,
      financial_entry_id: financialEntry.id,
      financial_account_id: financialAccount.id,
      provider: "asaas",
      provider_payment_id: asaasPayment.id,
      provider_status: String(asaasPayment.status || "PENDING").toUpperCase(),
      payment_method_type: normalizedMethod,
      status: initialState.legacyStatus,
      normalized_status: initialState.normalizedStatus,
      funds_status: initialState.fundsStatus,
      gross_amount: amount,
      platform_fee_amount: feeEstimate.estimatedFee || 0,
      estimated_fee_amount: feeEstimate.estimatedFee,
      actual_fee_amount: null,
      net_amount: feeEstimate.netAmount ?? amount,
      fee_rule_id: feeEstimate.feeRuleId,
      installments: 1,
      channel: "online",
      reconciliation_status: "estimated",
      currency: "brl",
      description,
      pix_qr_code: pixQrCode,
      pix_copy_paste: pixCopyPaste,
      checkout_url: asaasPayment.invoiceUrl,
      expires_at: dueDate,
      metadata: {
        financial_entry_id: financialEntry.id,
        operation_id: operationId,
        asaas_payment_id: asaasPayment.id,
        asaas_customer_id: asaasCustomer.id,
        asaas_invoice_url: asaasPayment.invoiceUrl,
        asaas_bank_slip_url: asaasPayment.bankSlipUrl || null,
        billing_type: billingType,
        source: "neurofinance",
      },
    })
    .select()
    .single();
  if (paymentInsert.error) {
    if (String(paymentInsert.error.code || "") === "23505") {
      const replay = await supabaseAdmin
        .from("nb_payments")
        .select("*")
        .eq("user_id", input.userId)
        .eq("financial_entry_id", financialEntry.id)
        .filter("metadata->>operation_id", "eq", operationId)
        .maybeSingle();
      if (replay.error) throw replay.error;
      if (replay.data) {
        return {
          success: true,
          payment_id: replay.data.id,
          financial_entry_id: financialEntry.id,
          asaas_payment_id: replay.data.provider_payment_id,
          status: replay.data.normalized_status || replay.data.status,
          amount,
          checkout_url: replay.data.checkout_url,
          invoice_url: replay.data.checkout_url,
          idempotent_replay: true,
        };
      }
    }
    throw paymentInsert.error;
  }

  const financialLink = await supabaseAdmin
    .from("financial_entries")
    .update({
      neurofinance_charge_id: paymentInsert.data.id,
      origin: "neurofinance",
      idempotency_key: financialEntry.idempotency_key ||
        `neurofinance:charge:${paymentInsert.data.id}`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", financialEntry.id)
    .eq("professional_id", input.userId);
  if (financialLink.error) throw financialLink.error;

  return {
    success: true,
    payment_id: paymentInsert.data.id,
    financial_entry_id: financialEntry.id,
    asaas_payment_id: asaasPayment.id,
    status: "pending",
    amount,
    checkout_url: asaasPayment.invoiceUrl,
    invoice_url: asaasPayment.invoiceUrl,
    bank_slip_url: asaasPayment.bankSlipUrl || null,
    pix_qr_code: pixQrCode,
    pix_copy_paste: pixCopyPaste,
    billing_type: billingType,
    asaas_environment: ASAAS_ENV,
  };
}
