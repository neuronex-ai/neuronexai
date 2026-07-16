import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/SessionContextProvider";
import type { Transaction } from "@/types";
import type { AccountMovement } from "@/lib/neurofinance-types";
import {
    filterAccountMovementsByDateRange,
    mapAccountMovementToTransaction,
    neuroFinanceOverviewItemsQueryKey,
    parseAccountMovementRows,
} from "@/lib/neurofinance-statement-data";

const PAGE_SIZE = 1000;
const MAX_PAGES = 100;

async function fetchStatementItems(userId: string, queryStart: string, queryEnd: string) {
    const items: AccountMovement[] = [];
    const startAt = new Date(`${queryStart}T00:00:00`).toISOString();
    const endAt = new Date(`${queryEnd}T23:59:59.999`).toISOString();

    for (let page = 0; page < MAX_PAGES; page += 1) {
        const from = page * PAGE_SIZE;
        const { data, error } = await supabase
            .rpc("get_neurofinance_overview_items", {
                p_end_at: endAt,
                p_limit: PAGE_SIZE,
                p_offset: from,
                p_start_at: startAt,
            });

        if (error) throw error;
        const pageItems = parseAccountMovementRows(data || []);
        items.push(...pageItems);
        if (pageItems.length < PAGE_SIZE) break;
    }

    return items.map((item) => mapAccountMovementToTransaction(item, userId));
}

export const useNeuroFinanceStatement = (startDate?: Date, endDate?: Date, enabled = true) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const queryStart = format(startDate || subDays(new Date(), 30), "yyyy-MM-dd");
    const queryEnd = format(endDate || new Date(), "yyyy-MM-dd");
    const startIso = `${queryStart}T00:00:00`;
    const endIso = `${queryEnd}T23:59:59`;

    return useQuery<Transaction[], Error>({
        queryKey: ["neurofinance-statement", user?.id, queryStart, queryEnd],
        queryFn: async () => {
            if (!user?.id) return [];
            return fetchStatementItems(user.id, queryStart, queryEnd);
        },
        placeholderData: () => {
            if (!user?.id) return undefined;
            const cached = queryClient.getQueryData<AccountMovement[]>(
                neuroFinanceOverviewItemsQueryKey(user.id),
            );
            if (!cached) return undefined;
            return filterAccountMovementsByDateRange(cached, startIso, endIso)
                .map((item) => mapAccountMovementToTransaction(item, user.id));
        },
        enabled: Boolean(user?.id) && enabled,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
        refetchOnWindowFocus: false,
    });
};
