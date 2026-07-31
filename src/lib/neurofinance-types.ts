export type NormalizedPaymentStatus =
  | "pending"
  | "processing"
  | "confirmed"
  | "paid"
  | "overdue"
  | "canceled"
  | "failed"
  | "refunded"
  | "chargeback";

export type FundsStatus =
  | "pending"
  | "confirmed"
  | "available"
  | "overdue"
  | "canceled"
  | "failed"
  | "refunded"
  | "chargeback";

export interface FinancialOverviewSnapshot {
  financial_account_id: string;
  user_id: string;
  available_balance: number;
  gross_received: number;
  pending_receivables: number;
  total_outflow: number;
  fees_total: number;
  calculated_available_balance: number;
  reconciliation_difference: number;
  currency: string;
  source: string;
  provider_as_of: string | null;
  last_reconciled_at: string | null;
  last_sync_error: string | null;
  is_stale: boolean;
  metadata: Record<string, unknown>;
  updated_at: string;
}

export interface AccountMovement {
  id: string;
  overview_group: "income" | "receivable" | "outflow";
  item_type: string;
  description: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string | null;
  occurred_at: string;
  patient_name: string | null;
  receipt_url: string | null;
  invoice_url: string | null;
  bank_slip_url: string | null;
}

export interface TariffRule {
  id: string;
  code: string;
  category: string;
  operation: string;
  payment_method: string | null;
  channel: string;
  installment_min: number | null;
  installment_max: number | null;
  percent_rate: number | null;
  fixed_fee_cents: number | null;
  free_monthly_quota: number | null;
  settlement_delay_days: number | null;
  settlement_business_days: boolean;
  display_name: string;
  description: string | null;
  price_label: string | null;
  settlement_label: string | null;
  effective_from: string;
  effective_to: string | null;
  display_order: number;
  metadata: Record<string, unknown>;
}

export type UserFacingErrorCode =
  | "NETWORK_UNAVAILABLE"
  | "SESSION_EXPIRED"
  | "SECURITY_VERIFICATION_REQUIRED"
  | "PATIENT_DOCUMENT_REQUIRED"
  | "PERMISSION_DENIED"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "SERVICE_UNAVAILABLE"
  | "UNKNOWN_ERROR";

export interface UserFacingError {
  code: UserFacingErrorCode;
  title: string;
  message: string;
  retryable: boolean;
  supportReference: string;
}
