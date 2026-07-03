import { supabase } from "@/integrations/supabase/client";
import {
  FINANCIAL_ACCOUNT_SAFE_SELECT,
  FINANCIAL_ACCOUNTS_READ_TABLE,
  normalizeFinancialAccountRow,
} from "@/lib/neurofinance-safe-selects";
import { normalizeBoletoInput } from "@/lib/boleto";

export type NeuroFinanceAccountState = {
  id: string;
  status: string;
  charges_enabled: boolean | null;
  payouts_enabled: boolean | null;
  details_submitted: boolean | null;
  requirements: Record<string, unknown> | null;
  last_sync_error: string | null;
  bank_name: string | null;
  bank_account_last4: string | null;
};

export type NeuroFinanceTransaction = {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category?: string | null;
  date: string;
  created_at?: string;
  status?: string | null;
  payment_method?: string | null;
};

export type NeuroFinanceBalanceDetails = {
  balance: { current: number; available: number; pending: number };
  summary: {
    available_balance: number;
    pending_balance: number;
    gross_volume: number;
    fees_total: number;
    net_volume: number;
    paid_out_balance: number;
  };
  transactions: NeuroFinanceTransaction[];
  total_transactions: number;
};

export type BillConsultation = {
  id: string;
  status: string;
  value: number;
  fee: number;
  dueDate: string | null;
  scheduleDate: string | null;
  beneficiaryName: string | null;
  beneficiaryDocument: string | null;
  bankCode: string | null;
  bankName: string | null;
  expiresAt: string | null;
  minimumScheduleDate: string | null;
  availableBalance: number | null;
  requiredBalance: number;
  balanceShortfall: number;
  canPayNow: boolean;
  canSchedule: boolean;
  recommendedMode: "now" | "scheduled" | null;
  defaultScheduleDate: string | null;
  paymentMode: "now" | "scheduled" | null;
};

export type PixPaymentConsultation = {
  id: string;
  status: string;
  amount: number;
  fee: number;
  availableBalance: number | null;
  destinationSummary: string | null;
  receiverName: string | null;
  receiverDocument: string | null;
  institutionName: string | null;
  description: string | null;
  pixKey: string | null;
  dueDate: string | null;
  expirationDate: string | null;
  canChangeValue: boolean;
  canPayNow: boolean;
  receiptUrl?: string | null;
};

export type PayoutConsultation = {
  id: string;
  kind: "pix_transfer" | "payout_pix" | "payout_bank";
  status: string;
  amount: number;
  fee: number;
  availableBalance: number | null;
  destinationSummary: string | null;
  destination: Record<string, unknown>;
  expiresAt: string | null;
  receiptUrl?: string | null;
};

export type OperationResult = {
  success: boolean;
  status?: string;
  receiptUrl?: string | null;
  autoScheduled?: boolean;
  bill?: Record<string, unknown>;
  request?: Record<string, unknown>;
  transfer?: Record<string, unknown>;
  payment?: Record<string, unknown>;
};

export type ChargeResult = {
  success: boolean;
  payment_id: string;
  amount: number;
  checkout_url: string | null;
  invoice_url: string | null;
  bank_slip_url: string | null;
  pix_qr_code: string | null;
  pix_copy_paste: string | null;
  billing_type: string;
};

async function extractFunctionError(error: unknown, fallback?: string) {
  if (!error) return fallback || "";

  const context = (error as { context?: unknown }).context;
  if (context && typeof Response !== "undefined" && context instanceof Response) {
    try {
      const payload = await context.clone().json() as Record<string, unknown>;
      const message = payload.error || payload.message || payload.details;
      if (message) return String(message);
    } catch {
      try {
        const text = await context.clone().text();
        if (text && !/Edge Function/i.test(text)) return text;
      } catch {
        // Keep the fallback below.
      }
    }
  }

  const message = error instanceof Error ? error.message : String(error || "");
  if (/Edge Function/i.test(message) && fallback) return fallback;
  return message || fallback || "";
}

async function invoke<T>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, { body });
  const explicitSuccess =
    data && typeof data === "object" && (data as { success?: unknown }).success === true;
  const responseError =
    data && typeof data === "object" && "error" in data
      ? String((data as { error?: unknown }).error || "")
      : "";

  if (error || (responseError && !explicitSuccess)) {
    const message = await extractFunctionError(error, responseError);
    throw new Error(message || "Nao foi possivel concluir a operacao.");
    throw new Error(
      responseError || error?.message || "Não foi possível concluir a operação.",
    );
  }

  return data as T;
}

export async function getNeuroFinanceAccountState() {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error("Sessão expirada. Entre novamente.");

  const { data, error } = await (supabase as any)
    .from(FINANCIAL_ACCOUNTS_READ_TABLE)
    .select(FINANCIAL_ACCOUNT_SAFE_SELECT)
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return normalizeFinancialAccountRow(data) as NeuroFinanceAccountState | null;
}

export const getNeuroFinanceBalanceDetails = () =>
  invoke<NeuroFinanceBalanceDetails>("asaas-balance-details", { view: "all" });

export const createNeuroFinanceCharge = (payload: {
  patient_id?: string;
  amount: number;
  payment_method: "pix" | "boleto" | "card" | "undefined";
  description: string;
  due_date: string;
  patient_name?: string;
  patient_cpf?: string;
  patient_email?: string;
}) => invoke<ChargeResult>("asaas-create-payment", payload);

export const consultBillPayment = (input: string) => {
  const normalized = normalizeBoletoInput(input);
  if (!normalized.isValid) {
    throw new Error("Informe uma linha digitavel ou codigo de barras valido.");
  }

  return invoke<{ success: true; consultation: BillConsultation }>(
    "asaas-bill-payment",
    {
      action: "consult",
      ...(normalized.kind === "barcode"
        ? { barCode: normalized.digits }
        : { identificationField: normalized.digits }),
    },
  );
};

export const authorizeBillPayment = (payload: {
  consultationId: string;
  paymentMode: "now" | "scheduled";
  scheduleDate?: string;
  pin: string;
}) =>
  invoke<{ success: true; consultation: BillConsultation }>(
    "asaas-bill-payment",
    { action: "authorize", ...payload },
  );

export const executeBillPayment = (consultationId: string) =>
  invoke<OperationResult>("asaas-bill-payment", {
    action: "execute",
    consultationId,
  });

export const consultPixPayment = (payload: string) =>
  invoke<{ success: true; consultation: PixPaymentConsultation }>(
    "asaas-pix-payment",
    { action: "consult", payload },
  );

export const authorizePixPayment = (payload: {
  requestId: string;
  pin: string;
  value?: number;
}) =>
  invoke<{ success: true; consultation: PixPaymentConsultation }>(
    "asaas-pix-payment",
    { action: "authorize", ...payload },
  );

export const executePixPayment = (requestId: string) =>
  invoke<OperationResult>("asaas-pix-payment", {
    action: "execute",
    requestId,
  });

export const consultPayout = (payload: {
  amount: number;
  purpose: "transfer" | "payout";
  destination:
    | { type: "pix_key"; pix_key: string }
    | { type: "saved_bank" };
}) =>
  invoke<{ success: true; consultation: PayoutConsultation }>("asaas-payout", {
    action: "consult",
    ...payload,
  });

export const authorizePayout = (requestId: string, pin: string) =>
  invoke<{ success: true; consultation: PayoutConsultation }>("asaas-payout", {
    action: "authorize",
    requestId,
    pin,
  });

export const executePayout = (requestId: string) =>
  invoke<OperationResult>("asaas-payout", { action: "execute", requestId });
