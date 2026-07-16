import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";
import { normalizeBoletoInput } from "@/lib/boleto";
import { EdgeFunctionInvocationError, invokeEdgeFunction } from "@/lib/invoke-edge-function";
import { toUserFacingError } from "@/lib/user-facing-error";

export interface BillConsultation {
  id: string;
  status: string;
  value: number;
  fee: number;
  dueDate?: string | null;
  scheduleDate?: string | null;
  beneficiaryName?: string | null;
  beneficiaryDocument?: string | null;
  bankCode?: string | null;
  bankName?: string | null;
  minimumScheduleDate?: string | null;
  availableBalance?: number | null;
  requiredBalance: number;
  balanceShortfall: number;
  canPayNow: boolean;
  canSchedule: boolean;
  recommendedMode?: BillPaymentMode | null;
  defaultScheduleDate?: string | null;
  paymentMode?: BillPaymentMode | null;
  expiresAt: string;
}

export type BillPaymentMode = "now" | "scheduled";

export interface BillPaymentRecord {
  id: string;
  identification_field?: string | null;
  barcode?: string | null;
  provider_bill_id?: string | null;
  external_reference: string;
  status: string;
  provider_status?: string | null;
  payment_mode?: BillPaymentMode | null;
  amount: number;
  fee_amount?: number;
  due_date?: string | null;
  scheduled_date?: string | null;
  payment_date?: string | null;
  beneficiary_name?: string | null;
  beneficiary_document?: string | null;
  bank_name?: string | null;
  bank_code?: string | null;
  receipt_url?: string | null;
  can_be_cancelled?: boolean | null;
  available_balance_at_review?: number | null;
  balance_source?: string | null;
  provider_payload?: Record<string, unknown>;
  error_message?: string | null;
  authorized_at?: string | null;
  submitted_at?: string | null;
  paid_at?: string | null;
  updated_at?: string;
  created_at: string;
}

export interface BillExecutionResponse {
  success: boolean;
  record: Pick<BillPaymentRecord, "id" | "status" | "amount" | "payment_mode" | "scheduled_date" | "receipt_url">;
  status: string;
  receiptUrl?: string | null;
  idempotent?: boolean;
}

function boletoPayload(input: string) {
  const normalized = normalizeBoletoInput(input);
  if (!normalized.isValid) {
    throw new Error("Informe uma linha digitável ou código de barras válido.");
  }
  return normalized.kind === "barcode"
    ? { barCode: normalized.digits }
    : { identificationField: normalized.digits };
}

async function invokeBillPaymentAction<T>(body: Record<string, unknown>): Promise<T> {
  return invokeEdgeFunction<T>("asaas-bill-payment", body);
}

export async function fetchBillConsultation(params: { input: string }) {
  return invokeBillPaymentAction<{ success: boolean; consultation: BillConsultation }>({
    action: "consult",
    ...boletoPayload(params.input),
  });
}

export async function authorizeBillPayment(params: {
  consultationId: string;
  pin: string;
  paymentMode: BillPaymentMode;
  scheduleDate?: string | null;
}) {
  return invokeBillPaymentAction<{ success: boolean; consultation: BillConsultation }>({
    action: "authorize",
    consultationId: params.consultationId,
    pin: params.pin,
    paymentMode: params.paymentMode,
    scheduleDate: params.scheduleDate,
  });
}

export async function executeBillPayment(consultationId: string) {
  return invokeBillPaymentAction<BillExecutionResponse>({
    action: "execute",
    consultationId,
  });
}

export async function downloadBillReceipt(record: BillPaymentRecord) {
  if (!record.receipt_url) {
    throw new Error("O comprovante deste boleto ainda não está disponível.");
  }

  const anchor = window.document.createElement("a");
  anchor.href = record.receipt_url;
  anchor.download = `comprovante-boleto-${record.id}.pdf`;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function useNeurofinanceBillPayments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: ["neurofinance-bill-payments", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("neurofinance_bill_payments")
        .select("*")
        .eq("user_id", user!.id)
        .not("provider_bill_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as BillPaymentRecord[];
    },
  });

  const consult = useMutation({
    mutationFn: fetchBillConsultation,
    onError: (error: Error) => {
      if (error instanceof EdgeFunctionInvocationError && error.code === "BILL_REVIEW_REQUIRED") {
        toast.info("O saldo mudou. Revise novamente a forma de pagamento antes de confirmar.");
        return;
      }
      const friendlyError = toUserFacingError(error, "payment");
      toast.error(friendlyError.title, { description: friendlyError.message });
    },
  });

  const authorize = useMutation({
    mutationFn: authorizeBillPayment,
  });

  const execute = useMutation({
    mutationFn: executeBillPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["neurofinance-bill-payments"] });
      queryClient.invalidateQueries({ queryKey: ["neurofinance-overview"] });
      queryClient.invalidateQueries({ queryKey: ["neurofinance-overview-items"] });
      queryClient.invalidateQueries({ queryKey: ["neurofinance-statement"] });
    },
    onError: (error: Error) => {
      const friendlyError = toUserFacingError(error, "payment");
      toast.error(friendlyError.title, { description: friendlyError.message });
    },
  });

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`neurofinance-bill-payments-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "neurofinance_bill_payments",
          filter: `user_id=eq.${user.id}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ["neurofinance-bill-payments", user.id] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user?.id]);

  return { list, consult, authorize, execute };
}
