/**
 * use-NeuroFinance-pix.ts
 *
 * Provides PIX-specific payment operations via NeuroFinance API.
 * This is a convenience layer over the unified use-NeuroFinance-payments.
 *
 * Exports:
 *   - useNeuroFinancePix: Core PIX operations (create charge, list, etc.)
 *   - usePixCobList: Convenience hook to list PIX charges
 *   - usePixRecebidos: Convenience hook to list received PIX
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/SessionContextProvider";
import { toast } from "sonner";
import type { NeuroFinancePayment, CreatePaymentResult } from "./use-neurofinance-payments";
import {
    NB_PAYMENTS_READ_TABLE,
    NB_PAYMENTS_SAFE_SELECT,
    normalizeNbPaymentRow,
} from "@/lib/neurofinance-safe-selects";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { invokeNeurofinanceFunction } from "@/lib/neurofinance-edge";

// ─── Types ────────────────────────────────────────────────────────

export interface CreatePixChargeParams {
    /** Valor em reais (ex: 150.00) */
    valor: number;
    /** Expiração em minutos (default: 60) */
    expiracao?: number;
    /** Descrição para o pagador */
    descricao?: string;
    /** Dados do pagador */
    devedor?: {
        cpf?: string;
        cnpj?: string;
        nome: string;
    };
    /** Informações adicionais */
    infoAdicionais?: Array<{ nome: string; valor: string }>;
    /** Patient ID for linking */
    patientId?: string;
    /** Appointment ID for linking */
    appointmentId?: string;
}

export interface CreatePixCobVencimentoParams {
    valor: number;
    dataDeVencimento: string; // YYYY-MM-DD
    validadeAposVencimento?: number;
    descricao?: string;
    devedor: {
        cpf?: string;
        cnpj?: string;
        nome: string;
    };
    patientId?: string;
}

// Re-export for compatibility
export type PixCharge = NeuroFinancePayment;
export type PixRecebido = NeuroFinancePayment;

// ─── PIX Operations Hook ──────────────────────────────────────────

export function useNeuroFinancePix() {
    const queryClient = useQueryClient();

    // ─── Create PIX charge via NeuroFinance API ────────────────
    const createCharge = useMutation<CreatePaymentResult, Error, CreatePixChargeParams>({
        mutationFn: async (params) => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Não autenticado');

            // Convert from reais to centavos
            const amountCentavos = Math.round(params.valor * 100);

            const response = await supabase.functions.invoke('asaas-create-payment', {
                body: {
                    amount: amountCentavos,
                    description: params.descricao || 'Cobrança PIX NeuroFinance',
                    patient_id: params.patientId || null,
                    appointment_id: params.appointmentId || null,
                    payment_methods: ['pix'],
                    patient_name: params.devedor?.nome || undefined,
                    patient_cpf: params.devedor?.cpf || params.devedor?.cnpj || undefined,
                    expires_in_minutes: params.expiracao || 60,
                },
            });

            if (response.error) throw new Error(response.error.message);
            if (response.data?.error) throw new Error(response.data.error);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['NeuroFinance-payments'] });
            queryClient.invalidateQueries({ queryKey: ['neurofinance-overview'] });
            queryClient.invalidateQueries({ queryKey: ['NeuroFinance-pix-charges'] });
            toast.success('Cobrança PIX criada com sucesso!');
        },
        onError: (error) => {
            toast.error(getUserFacingErrorMessage(error, "payment"));
        },
    });

    // ─── Create PIX charge with due date ─────────────────────
    const createCobVencimento = useMutation<CreatePaymentResult, Error, CreatePixCobVencimentoParams>({
        mutationFn: async (params) => {
            const amountCentavos = Math.round(params.valor * 100);

            const response = await supabase.functions.invoke('asaas-create-payment', {
                body: {
                    amount: amountCentavos,
                    description: params.descricao || 'Cobrança PIX com vencimento',
                    patient_id: params.patientId || null,
                    payment_methods: ['pix', 'boleto'], // Boleto supports due dates natively
                    customer_name: params.devedor?.nome || undefined,
                    // Calculate minutes until due date
                    expires_in_minutes: Math.max(
                        60,
                        Math.floor((new Date(params.dataDeVencimento).getTime() - Date.now()) / 60000)
                    ),
                },
            });

            if (response.error) throw new Error(response.error.message);
            if (response.data?.error) throw new Error(response.data.error);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['NeuroFinance-payments'] });
            queryClient.invalidateQueries({ queryKey: ['neurofinance-overview'] });
            toast.success('Cobrança com vencimento criada!');
        },
        onError: (error) => {
            toast.error(getUserFacingErrorMessage(error, "payment"));
        },
    });

    // ─── List PIX charges ────────────────────────────────────
    const listCharges = async (): Promise<{ charges: NeuroFinancePayment[] }> => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Não autenticado');

        const { data, error } = await (supabase as any)
            .from(NB_PAYMENTS_READ_TABLE)
            .select(NB_PAYMENTS_SAFE_SELECT)
            .eq('user_id', session.user.id)
            .eq('payment_method_type', 'pix')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;
        return { charges: (data || []).map(normalizeNbPaymentRow) as NeuroFinancePayment[] };
    };

    // ─── Query a single charge ───────────────────────────────
    const queryCharge = async (paymentId: string): Promise<NeuroFinancePayment | null> => {
        const { data, error } = await (supabase as any)
            .from(NB_PAYMENTS_READ_TABLE)
            .select(NB_PAYMENTS_SAFE_SELECT)
            .eq('id', paymentId)
            .single();

        if (error) throw error;
        return normalizeNbPaymentRow(data) as NeuroFinancePayment;
    };

    return {
        // Cobranças imediatas
        createCharge,
        queryCharge,
        listCharges,

        // Cobranças com vencimento
        createCobVencimento,
    };
}

// ─── Convenience Hooks for Lists ──────────────────────────────────

export function usePixKeys() {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['NeuroFinance-pix-keys'],
        queryFn: async () => {
            const response = await supabase.functions.invoke('asaas-pix', {
                body: { action: 'list_keys' },
            });
            if (response.error) throw new Error(response.error.message);
            if (response.data?.error) throw new Error(response.data.error);
            return response.data?.keys || response.data?.data || [];
        },
        staleTime: 30_000,
    });

    const createKey = useMutation({
        mutationFn: async () => {
            const response = await supabase.functions.invoke('asaas-pix', {
                body: { action: 'create_key', consent: true },
            });
            if (response.error) throw new Error(response.error.message);
            if (response.data?.error) throw new Error(response.data.error);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['NeuroFinance-pix-keys'] });
            toast.success('Chave Pix aleatória criada.');
        },
        onError: (error: Error) => toast.error(getUserFacingErrorMessage(error, "save")),
    });

    const deleteKey = useMutation({
        mutationFn: async (id: string) => {
            const response = await supabase.functions.invoke('asaas-pix', {
                body: { action: 'delete_key', id },
            });
            if (response.error) throw new Error(response.error.message);
            if (response.data?.error) throw new Error(response.data.error);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['NeuroFinance-pix-keys'] });
            toast.success('Chave Pix removida.');
        },
        onError: (error: Error) => toast.error(getUserFacingErrorMessage(error, "delete")),
    });

    return { ...query, createKey, deleteKey };
}

/**
 * Hook to list PIX charges.
 */
export function usePixCobList() {
    const { user } = useAuth();

    return useQuery<{ charges: NeuroFinancePayment[] }, Error>({
        queryKey: ['NeuroFinance-pix-charges', user?.id],
        queryFn: async () => {
            if (!user?.id) throw new Error('Não autenticado');

            const { data, error } = await (supabase as any)
                .from(NB_PAYMENTS_READ_TABLE)
                .select(NB_PAYMENTS_SAFE_SELECT)
                .eq('user_id', user.id)
                .eq('payment_method_type', 'pix')
                .in('status', ['pending', 'processing', 'paid'])
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            return { charges: (data || []).map(normalizeNbPaymentRow) as NeuroFinancePayment[] };
        },
        enabled: !!user?.id,
        staleTime: 30_000,
    });
}

/**
 * Hook to list received PIX payments.
 */
export function usePixRecebidos() {
    const { user } = useAuth();

    return useQuery<{ payments: NeuroFinancePayment[] }, Error>({
        queryKey: ['NeuroFinance-pix-received', user?.id],
        queryFn: async () => {
            if (!user?.id) throw new Error('Não autenticado');

            const { data, error } = await (supabase as any)
                .from(NB_PAYMENTS_READ_TABLE)
                .select(NB_PAYMENTS_SAFE_SELECT)
                .eq('user_id', user.id)
                .eq('payment_method_type', 'pix')
                .eq('status', 'paid')
                .order('paid_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            return { payments: (data || []).map(normalizeNbPaymentRow) as NeuroFinancePayment[] };
        },
        enabled: !!user?.id,
        staleTime: 30_000,
    });
}
