import { assertEquals } from "jsr:@std/assert@1";

import {
    normalizeAsaasBillSimulation,
    validateNormalizedBillSimulation,
} from "./asaas-bill.ts";

Deno.test("normalizes the nested bankSlipInfo returned by Asaas", () => {
    const bill = normalizeAsaasBillSimulation({
        fee: 0,
        minimumScheduleDate: "2026-06-09",
        bankSlipInfo: {
            bank: "461",
            value: 200,
            dueDate: "2026-06-09",
            originalValue: 200,
            beneficiaryName: "NEURONEX AI",
            beneficiaryCpfCnpj: "65.610.762/0001-55",
            identificationField: "46191110000000000004250768519014814720000020000",
        },
    });

    assertEquals(bill, {
        identificationField: "46191110000000000004250768519014814720000020000",
        value: 200,
        fee: 0,
        dueDate: "2026-06-09",
        minimumScheduleDate: "2026-06-09",
        beneficiaryName: "NEURONEX AI",
        beneficiaryDocument: "65610762000155",
        bankCode: "461",
        bankName: null,
    });
    assertEquals(validateNormalizedBillSimulation(bill), []);
});

Deno.test("rejects a simulation that cannot identify the real recipient", () => {
    const bill = normalizeAsaasBillSimulation({
        bankSlipInfo: {
            value: 200,
            dueDate: "2026-06-09",
            beneficiaryName: "NEURONEX AI",
            identificationField: "46191110000000000004250768519014814720000020000",
        },
    });

    assertEquals(validateNormalizedBillSimulation(bill), [
        "documento do beneficiario",
        "instituição bancária",
    ]);
});
