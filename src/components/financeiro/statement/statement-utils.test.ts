import { describe, expect, it } from "vitest";

import type { Patient, Transaction } from "@/types";
import {
    emptyDetailedStatementFilters,
    filterDetailedStatementTransactions,
    getStatementPaymentMethod,
    getStatementOrigin,
    groupStatementTransactionsByDate,
    isPixReceivedStatementPreset,
    isStatementFeeTransaction,
    sortStatementTransactions,
    togglePixReceivedStatementPreset,
} from "./statement-utils";

const transaction = (overrides: Partial<Transaction> = {}): Transaction => ({
    id: overrides.id || crypto.randomUUID(),
    user_id: "user-1",
    description: "Movimentação",
    amount: 100,
    type: "income",
    category: "payment",
    date: "2026-06-09T12:00:00-03:00",
    appointment_id: null,
    created_at: "2026-06-09T12:00:00-03:00",
    status: "completed",
    ...overrides,
});

const patients: Patient[] = [
    {
        id: "patient-1",
        user_id: "user-1",
        name: "Ana Souza",
        email: null,
        phone: null,
        status: "active",
        last_session: null,
        next_session: null,
        diagnosis: null,
        notes: null,
        created_at: "2026-01-01",
    },
    {
        id: "patient-2",
        user_id: "user-1",
        name: "Bruno Lima",
        email: null,
        phone: null,
        status: "active",
        last_session: null,
        next_session: null,
        diagnosis: null,
        notes: null,
        created_at: "2026-01-01",
    },
];

describe("statement-utils", () => {
    it("ordena do mais recente ao mais antigo e também inverte a ordem", () => {
        const oldTransaction = transaction({ id: "old", date: "2026-06-07T10:00:00-03:00" });
        const recentTransaction = transaction({ id: "recent", date: "2026-06-09T10:00:00-03:00" });

        expect(sortStatementTransactions([oldTransaction, recentTransaction], "desc").map((item) => item.id))
            .toEqual(["recent", "old"]);
        expect(sortStatementTransactions([oldTransaction, recentTransaction], "asc").map((item) => item.id))
            .toEqual(["old", "recent"]);
    });

    it("agrupa Hoje, Ontem e os demais dias na ordem selecionada", () => {
        const now = new Date("2026-06-09T16:00:00-03:00");
        const groups = groupStatementTransactionsByDate([
            transaction({ id: "today", date: "2026-06-09T10:00:00-03:00" }),
            transaction({ id: "yesterday", date: "2026-06-08T10:00:00-03:00" }),
            transaction({ id: "older", date: "2026-06-01T10:00:00-03:00" }),
        ], "desc", now);

        expect(groups.map((group) => group.label)).toEqual(["Hoje", "Ontem", "01 de junho"]);
    });

    it("classifica NeuroFinance, Manual e Agenda", () => {
        expect(getStatementOrigin(transaction({ origin: "gateway_auto" }))).toBe("neurofinance");
        expect(getStatementOrigin(transaction({ origin: "manual" }))).toBe("manual");
        expect(getStatementOrigin(transaction({
            origin: "manual",
            appointment_id: "appointment-1",
            metadata: { financial_entry_origin: "appointment" },
        }))).toBe("agenda");
    });

    it("mantém Agenda somente quando houve dinheiro real", () => {
        const paidAgenda = transaction({
            id: "paid-agenda",
            appointment_id: "appointment-1",
            status: "completed",
            metadata: { financial_entry_origin: "appointment" },
        });
        const pendingAgenda = transaction({
            id: "pending-agenda",
            appointment_id: "appointment-2",
            status: "pending",
            metadata: { financial_entry_origin: "appointment" },
        });

        const result = filterDetailedStatementTransactions(
            [paidAgenda, pendingAgenda],
            emptyDetailedStatementFilters(),
            patients,
        );

        expect(result.map((item) => item.id)).toEqual(["paid-agenda"]);
    });

    it("filtra método, origem, paciente, destinatário, Pix e taxas", () => {
        const pixTransferFee = transaction({
            id: "pix-fee",
            type: "expense",
            category: "transfer_fee",
            description: "Tarifa Pix para Clínica Horizonte",
            payment_method: "pix",
            origin: "gateway_auto",
            patient_name: "Ana Souza",
            metadata: {
                item_type: "transfer_fee",
                operation_type: "PIX",
                destination_summary: "Clínica Horizonte",
            },
        });
        const boletoIncome = transaction({
            id: "boleto",
            payment_method: "boleto",
            patient_id: "patient-2",
            patients: { name: "Bruno Lima", email: null },
        });

        const filters = {
            ...emptyDetailedStatementFilters(),
            type: "expense" as const,
            paymentMethods: ["pix"] as const,
            origins: ["neurofinance"] as const,
            patientIds: ["patient-1"],
            recipientQuery: "Horizonte",
            feesOnly: true,
            transferMethods: ["pix"] as const,
        };

        expect(isStatementFeeTransaction(pixTransferFee)).toBe(true);
        expect(filterDetailedStatementTransactions([pixTransferFee, boletoIncome], {
            ...filters,
            paymentMethods: [...filters.paymentMethods],
            origins: [...filters.origins],
            transferMethods: [...filters.transferMethods],
        }, patients).map((item) => item.id)).toEqual(["pix-fee"]);
    });

    it("respeita data inicial e final", () => {
        const inside = transaction({ id: "inside", date: "2026-05-15T10:00:00-03:00" });
        const outside = transaction({ id: "outside", date: "2026-04-15T10:00:00-03:00" });
        const filters = {
            ...emptyDetailedStatementFilters(),
            startDate: "2026-05-01",
            endDate: "2026-05-31",
        };

        expect(filterDetailedStatementTransactions([inside, outside], filters, patients).map((item) => item.id))
            .toEqual(["inside"]);
    });

    it("oferece Pix recebidos como filtro do extrato, sem incluir saídas Pix", () => {
        const receivedPix = transaction({
            id: "pix-received",
            type: "income",
            payment_method: undefined,
            metadata: { provider_type: "PIX_TRANSACTION_CREDIT" },
        });
        const sentPix = transaction({
            id: "pix-sent",
            type: "expense",
            payment_method: "pix",
        });
        const boleto = transaction({
            id: "boleto-received",
            type: "income",
            payment_method: "boleto",
        });
        const filters = togglePixReceivedStatementPreset(emptyDetailedStatementFilters());

        expect(isPixReceivedStatementPreset(filters)).toBe(true);
        expect(getStatementPaymentMethod(receivedPix)).toBe("pix");
        expect(filterDetailedStatementTransactions([receivedPix, sentPix, boleto], filters))
            .toEqual([receivedPix]);
        expect(togglePixReceivedStatementPreset(filters)).toMatchObject({
            type: "all",
            paymentMethods: [],
        });
    });
});
