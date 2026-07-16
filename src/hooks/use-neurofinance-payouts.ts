import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/SessionContextProvider";
import { toast } from "sonner";
import {
    NB_PAYOUTS_READ_TABLE,
    NB_PAYOUTS_SAFE_SELECT,
    normalizeNbPayoutRow,
} from "@/lib/neurofinance-safe-selects";
import { toUserFacingError } from "@/lib/user-facing-error";
import { invokeEdgeFunction } from "@/lib/invoke-edge-function";

export interface NeuroFinancePayout {
    id: string;
    user_id: string;
    amount: number;
    currency: string;
    status: "pending" | "in_transit" | "paid" | "failed" | "canceled";
    destination_type: string;
    destination_summary: string | null;
    receipt_url?: string | null;
    requested_at: string;
    processed_at: string | null;
    completed_at?: string | null;
    created_at: string;
    updated_at: string;
}

export interface RequestPayoutParams {
    amount?: number;
    description?: string;
    purpose?: "payout" | "transfer";
    destination?: {
        type: "saved_bank" | "saved_pix" | "manual_bank" | "pix_key";
        recipient_id?: string;
        pix_key?: string;
        bank_code?: string;
        bank_name?: string;
        agency?: string;
        account?: string;
        account_digit?: string;
        account_type?: "CONTA_CORRENTE" | "CONTA_POUPANCA";
        holder_name?: string;
        holder_document?: string;
        summary?: string;
    };
}

export interface PayoutDestination extends Record<string, unknown> {
    type?: "saved_bank" | "saved_pix" | "pix_key";
    pix_key?: string;
    pix_key_type?: string;
    bank_code?: string;
    bank_name?: string;
    agency?: string;
    account?: string;
    account_digit?: string;
    account_type?: string;
    holder_name?: string;
    holder_document?: string;
    summary?: string;
    validation_source?: string;
}

export interface SavedPayoutDestinations {
    bank: {
        type: "saved_bank";
        label: string;
        summary: string;
        holderName?: string | null;
        bankName?: string | null;
        agency?: string | null;
        accountLast4?: string | null;
    } | null;
    pix: Array<{
        id: string;
        label: string;
        keyType: string;
        maskedKey: string;
        summary: string;
        holderName?: string | null;
        holderDocument?: string | null;
        bankName?: string | null;
    }>;
}

export interface PayoutConsultation {
    id: string;
    kind: "pix_transfer" | "payout_pix" | "payout_bank";
    status: string;
    amount: number;
    fee: number;
    availableBalance: number | null;
    destinationSummary: string;
    destination: PayoutDestination;
    destinationType: "saved_bank" | "pix_key";
    expiresAt: string;
    receiptUrl?: string | null;
}

export interface PayoutExecution {
    success: boolean;
    request: PayoutConsultation;
    status?: string;
    receiptUrl?: string | null;
    idempotent?: boolean;
}

export const useNeuroFinancePayouts = (limit = 30) => {
    const { user } = useAuth();

    return useQuery<NeuroFinancePayout[], Error>({
        queryKey: ["NeuroFinance-payouts", user?.id, limit],
        queryFn: async () => {
            if (!user?.id) throw new Error("Você precisa entrar novamente para continuar.");

            const { data, error } = await (supabase as any)
                .from(NB_PAYOUTS_READ_TABLE)
                .select(NB_PAYOUTS_SAFE_SELECT)
                .eq("user_id", user.id)
                .neq("operation_type", "pix_qr_payment")
                .neq("operation_type", "pix_transfer")
                .order("created_at", { ascending: false })
                .limit(limit);

            if (error) throw error;
            return (data || []).map(normalizeNbPayoutRow) as NeuroFinancePayout[];
        },
        enabled: Boolean(user?.id),
        staleTime: 1000 * 60,
    });
};

export const useSecurePayout = () => {
    const queryClient = useQueryClient();

    const consult = useMutation({
        mutationFn: (params: RequestPayoutParams) =>
            invokeEdgeFunction<{ success: boolean; consultation: PayoutConsultation }>("asaas-payout", {
                action: "consult",
                ...params,
            }),
        onError: (error: Error) => {
            const friendlyError = toUserFacingError(error, "transfer");
            toast.error(friendlyError.title, { description: friendlyError.message });
        },
    });

    const authorize = useMutation({
        mutationFn: ({ requestId, pin, saveRecipient = false }: { requestId: string; pin: string; saveRecipient?: boolean }) =>
            invokeEdgeFunction<{ success: boolean; consultation: PayoutConsultation }>("asaas-payout", {
                action: "authorize",
                requestId,
                pin,
                saveRecipient,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["neurofinance-payout-destinations"] });
        },
    });

    const execute = useMutation({
        mutationFn: (requestId: string) =>
            invokeEdgeFunction<PayoutExecution>("asaas-payout", { action: "execute", requestId }),
        onSuccess: (data: PayoutExecution) => {
            queryClient.invalidateQueries({ queryKey: ["NeuroFinance-payouts"] });
            queryClient.invalidateQueries({ queryKey: ["neurofinance-overview"] });
            queryClient.invalidateQueries({ queryKey: ["neurofinance-statement"] });
            const label = data.request.kind === "pix_transfer" ? "Transferência" : "Saque";
            toast.success(`${label} de R$ ${data.request.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} solicitado.`);
        },
        onError: (error) => {
            const friendlyError = toUserFacingError(error, "transfer");
            toast.error(friendlyError.title, { description: friendlyError.message });
        },
    });

    const receipt = useMutation({
        mutationFn: (requestId: string) =>
            invokeEdgeFunction<{ success: boolean; receiptUrl: string; status: string }>("asaas-payout", {
                action: "receipt",
                requestId,
            }),
    });

    return { consult, authorize, execute, receipt };
};

export const usePayoutDestinations = (purpose: "payout" | "transfer") => {
    const { user } = useAuth();
    return useQuery<SavedPayoutDestinations, Error>({
        queryKey: ["neurofinance-payout-destinations", user?.id, purpose],
        enabled: Boolean(user?.id),
        staleTime: 5 * 60 * 1000,
        queryFn: async () => {
            const response = await invokeEdgeFunction<{
                success: boolean;
                destinations: SavedPayoutDestinations;
            }>("asaas-payout", { action: "list_destinations", purpose });
            return response.destinations;
        },
    });
};
