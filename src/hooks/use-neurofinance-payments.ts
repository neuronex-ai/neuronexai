/**
 * use-NeuroFinance-payments.ts
 * 
 * Unified hook for creating and managing payments through NeuroFinance (Asaas).
 * Supports Pix, Card, and Boleto.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { toast } from 'sonner';
import {
    NB_PAYMENTS_READ_TABLE,
    NB_PAYMENTS_SAFE_SELECT,
    normalizeNbPaymentRow,
} from '@/lib/neurofinance-safe-selects';
import { toUserFacingError } from '@/lib/user-facing-error';

export interface NeuroFinancePayment {
    id: string;
    user_id: string;
    patient_id: string | null;
    appointment_id: string | null;
    payment_method_type: 'pix' | 'card' | 'boleto';
    status: 'draft' | 'pending' | 'processing' | 'paid' | 'failed' | 'refunded' | 'partially_refunded' | 'canceled' | 'expired' | 'disputed';
    gross_amount: number;
    platform_fee_amount: number;
    net_amount: number;
    description: string | null;
    pix_qr_code: string | null;
    pix_copy_paste: string | null;
    checkout_url: string | null;
    refund_amount: number;
    dispute_status: string | null;
    dispute_id: string | null;
    dispute_reason: string | null;
    dispute_amount: number;
    paid_at: string | null;
    expires_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreatePaymentParams {
    amount: number;        // in centavos
    description?: string;
    patient_id?: string;
    appointment_id?: string;
    payment_methods?: ('pix' | 'card' | 'boleto')[];
    customer_email?: string;
    customer_name?: string;
    expires_in_minutes?: number;
    financial_entry_id?: string | null;
}

export interface CreatePaymentResult {
    success: boolean;
    payment_id: string;
    checkout_url: string;
    gross_amount: number;
    platform_fee: number;
    net_amount: number;
    expires_at: string | null;
    pix_qr_code?: string | null;
    pix_copy_paste?: string | null;
    invoice_url?: string | null;
    bank_slip_url?: string | null;
    status?: string;
    amount?: number;
}

// ─── List Payments ────────────────────────────────
export const useNeuroFinancePayments = (
    statusFilter?: string[],
    limit = 50
) => {
    const { user } = useAuth();

    return useQuery<NeuroFinancePayment[], Error>({
        queryKey: ['NeuroFinance-payments', user?.id, statusFilter, limit],
        queryFn: async () => {
            if (!user?.id) throw new Error('Não autenticado');

            let query = (supabase as any)
                .from(NB_PAYMENTS_READ_TABLE)
                .select(NB_PAYMENTS_SAFE_SELECT)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (statusFilter && statusFilter.length > 0) {
                query = query.in('status', statusFilter);
            }

            const { data, error } = await query;
            if (error) throw error;
            return (data || []).map(normalizeNbPaymentRow) as NeuroFinancePayment[];
        },
        enabled: !!user?.id,
        staleTime: 1000 * 60,
    });
};

// ─── Create Payment ───────────────────────────────
export const useCreatePayment = () => {
    const queryClient = useQueryClient();

    return useMutation<CreatePaymentResult, Error, CreatePaymentParams>({
        mutationFn: async (params) => {
            const response = await supabase.functions.invoke('asaas-create-payment', {
                body: params,
            });

            if (response.error) throw new Error(response.error.message);
            if (response.data?.error) throw new Error(response.data.error);
            return response.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['NeuroFinance-payments'] });
            queryClient.invalidateQueries({ queryKey: ['neurofinance-overview'] });

            if (data.checkout_url) {
                toast.success('Cobrança criada com sucesso!');
            }
        },
        onError: (error) => {
            const friendlyError = toUserFacingError(error, 'payment');
            toast.error(friendlyError.title, { description: friendlyError.message });
        },
    });
};

// ─── Create Pix Charge (convenience wrapper) ──────
export const useCreatePixCharge = () => {
    const createPayment = useCreatePayment();

    return {
        ...createPayment,
        mutate: (params: Omit<CreatePaymentParams, 'payment_methods'>) => {
            createPayment.mutate({
                ...params,
                payment_methods: ['pix'],
            });
        },
        mutateAsync: (params: Omit<CreatePaymentParams, 'payment_methods'>) => {
            return createPayment.mutateAsync({
                ...params,
                payment_methods: ['pix'],
            });
        },
    };
};

// ─── Get Payment by ID ────────────────────────────
export const usePaymentDetail = (paymentId: string | null) => {
    return useQuery<NeuroFinancePayment | null, Error>({
        queryKey: ['NeuroFinance-payment', paymentId],
        queryFn: async () => {
            if (!paymentId) return null;

            const { data, error } = await (supabase as any)
                .from(NB_PAYMENTS_READ_TABLE)
                .select(NB_PAYMENTS_SAFE_SELECT)
                .eq('id', paymentId)
                .single();

            if (error) throw error;
            return normalizeNbPaymentRow(data) as NeuroFinancePayment;
        },
        enabled: !!paymentId,
        refetchInterval: (query) => {
            // Auto-refresh pending payments every 10s
            const status = query.state.data?.status;
            return status === 'pending' || status === 'processing' ? 10000 : false;
        },
    });
};

// ─── Recent PIX Charges ───────────────────────────
export const useRecentPixCharges = (limit = 20) => {
    const { user } = useAuth();

    return useQuery<NeuroFinancePayment[], Error>({
        queryKey: ['NeuroFinance-pix-charges', user?.id, limit],
        queryFn: async () => {
            if (!user?.id) throw new Error('Não autenticado');

            const { data, error } = await (supabase as any)
                .from(NB_PAYMENTS_READ_TABLE)
                .select(NB_PAYMENTS_SAFE_SELECT)
                .eq('user_id', user.id)
                .eq('payment_method_type', 'pix')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return (data || []).map(normalizeNbPaymentRow) as NeuroFinancePayment[];
        },
        enabled: !!user?.id,
        staleTime: 1000 * 30,
    });
};

// ─── Refund Payment ───────────────────────────────
export const useRefundPayment = () => {
    const queryClient = useQueryClient();

    return useMutation<{ success: boolean; refund_id: string; status: string }, Error, { paymentId: string; amount?: number }>({
        mutationFn: async ({ paymentId, amount }) => {
            const response = await supabase.functions.invoke('asaas-refund', {
                body: { payment_id: paymentId, amount },
            });

            if (response.error) throw new Error(response.error.message);
            if (response.data?.error) throw new Error(response.data.error);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['NeuroFinance-payments'] });
            queryClient.invalidateQueries({ queryKey: ['neurofinance-overview'] });
            queryClient.invalidateQueries({ queryKey: ['NeuroFinance-payment'] });
            toast.success('Reembolso solicitado com sucesso!');
        },
        onError: (error) => {
            const friendlyError = toUserFacingError(error, 'payment');
            toast.error(friendlyError.title, { description: friendlyError.message });
        },
    });
};
