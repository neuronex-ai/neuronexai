import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/SessionContextProvider";
import type { Transaction } from "@/types";
import type { AccountMovement } from "@/lib/neurofinance-types";

export type BalanceDetailView = "total" | "andamento" | "futuro" | "saldo";

const VIEW_GROUP: Record<BalanceDetailView, AccountMovement["overview_group"] | null> = {
    total: "income",
    andamento: "outflow",
    futuro: "receivable",
    saldo: null,
};

function mapItem(item: AccountMovement, userId: string): Transaction {
    const paymentMethod = item.payment_method === "card"
        ? "credit_card"
        : item.payment_method === "debit"
            ? "debit_card"
            : item.payment_method;
    const metadata = {
        ...((item.metadata || {}) as Record<string, unknown>),
        overview_group: item.overview_group,
        item_type: item.item_type,
        payment_method: item.payment_method,
    };

    return {
        id: item.id,
        user_id: userId,
        description: item.patient_name
            ? `${item.patient_name} · ${item.description}`
            : item.description,
        amount: Number(item.amount || 0) / 100,
        type: item.overview_group === "outflow" ? "expense" : "income",
        category: item.item_type,
        date: item.occurred_at,
        appointment_id: null,
        created_at: item.occurred_at,
        payment_method: paymentMethod as Transaction["payment_method"],
        status: item.status === "paid" || item.status === "posted"
            ? "completed"
            : "pending",
        external_reference: item.reference_id || undefined,
        origin: "gateway_auto",
        patient_name: item.patient_name || undefined,
        metadata,
        patients: item.patient_name
            ? { name: item.patient_name, email: null }
            : null,
    };
}

export const useNeuroFinanceBalanceDetails = (view: BalanceDetailView,enabled=true) => {
    const { user } = useAuth();

    return useQuery<Transaction[], Error>({
        queryKey: ["neurofinance-overview-items", user?.id, view],
        queryFn: async () => {
            if (!user?.id) return [];

            let query = supabase
                .from("neurofinance_overview_items_v")
                .select("*")
                .eq("user_id", user.id)
                .order("occurred_at", { ascending: false })
                .limit(500);

            const group = VIEW_GROUP[view];
            if (group) query = query.eq("overview_group", group);

            const { data, error } = await query;
            if (error) throw error;
            return ((data || []) as AccountMovement[]).map((item) => mapItem(item, user.id));
        },
        enabled: Boolean(user?.id)&&enabled,
        staleTime: 1000 * 60 * 5,
    });
};
