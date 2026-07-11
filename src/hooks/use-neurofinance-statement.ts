import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/SessionContextProvider";
import type { PaymentMethod, Transaction } from "@/types";
import type { AccountMovement } from "@/lib/neurofinance-types";

export const useNeuroFinanceStatement = (startDate?: Date, endDate?: Date, enabled=true) => {
    const { user } = useAuth();
    const queryStart = format(startDate || subDays(new Date(), 30), "yyyy-MM-dd");
    const queryEnd = format(endDate || new Date(), "yyyy-MM-dd");

    return useQuery<Transaction[], Error>({
        queryKey: ["neurofinance-statement", user?.id, queryStart, queryEnd],
        queryFn: async () => {
            if (!user?.id) return [];

            const { data, error } = await supabase
                .from("neurofinance_overview_items_v")
                .select("*")
                .eq("user_id", user.id)
                .gte("occurred_at", `${queryStart}T00:00:00`)
                .lte("occurred_at", `${queryEnd}T23:59:59`)
                .order("occurred_at", { ascending: false });

            if (error) throw error;

            return ((data || []) as AccountMovement[]).map((item) => {
                const metadata = (item.metadata || {}) as Record<string, any>;
                const transactionMetadata = {
                    ...metadata,
                    overview_group: item.overview_group,
                    item_type: item.item_type,
                    payment_method: item.payment_method,
                };
                const receiptUrl = metadata.receipt_url || metadata.transaction_receipt_url || metadata.asaas_transaction_receipt_url;
                const invoiceUrl = metadata.invoice_url || metadata.checkout_url || metadata.asaas_invoice_url;
                const bankSlipUrl = metadata.bank_slip_url || metadata.asaas_bank_slip_url;

                return {
                    id: item.id,
                    user_id: user.id,
                    description: item.patient_name ? `${item.patient_name} · ${item.description}` : item.description,
                    amount: Number(item.amount || 0) / 100,
                    type: item.overview_group === "outflow" ? "expense" : "income",
                    category: item.item_type,
                    date: item.occurred_at,
                    appointment_id: null,
                    created_at: item.occurred_at,
                    payment_method: (
                        item.payment_method === "card"
                            ? "credit_card"
                            : item.payment_method === "debit"
                                ? "debit_card"
                                : item.payment_method
                    ) as PaymentMethod | undefined,
                    status: item.status === "paid" || item.status === "posted" ? "completed" : "pending",
                    external_reference: item.reference_id || undefined,
                    attachment_url: receiptUrl || invoiceUrl || bankSlipUrl || undefined,
                    origin: "gateway_auto",
                    patient_name: item.patient_name || undefined,
                    metadata: transactionMetadata,
                    receipt_url: receiptUrl || undefined,
                    invoice_url: invoiceUrl || undefined,
                    bank_slip_url: bankSlipUrl || undefined,
                } as Transaction;
            });
        },
        enabled: Boolean(user?.id)&&enabled,
        staleTime: 1000 * 60 * 5,
    });
};
