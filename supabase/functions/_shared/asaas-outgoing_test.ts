import {
    detectPixKeyType,
    normalizePixQrConsultation,
    outgoingResponse,
    validatePixQrConsultation,
} from "./asaas-outgoing.ts";

Deno.test("normalizes a payable variable Pix QR consultation", () => {
    const normalized = normalizePixQrConsultation({
        payload: "000201",
        canBePaid: true,
        canBePaidWithDifferentValue: true,
        receiver: {
            name: "Clinica Exemplo",
            cpfCnpj: "**.000.000/0001-**",
            ispbName: "Banco Exemplo",
        },
    });

    if (validatePixQrConsultation(normalized).length !== 0) {
        throw new Error("Expected a valid variable Pix consultation");
    }
});

Deno.test("requires a fixed value when the Pix QR cannot change value", () => {
    const normalized = normalizePixQrConsultation({
        payload: "000201",
        canBePaid: true,
        receiver: { name: "Pessoa", cpfCnpj: "***.000.000-**", ispb: "123" },
    });

    if (!validatePixQrConsultation(normalized).includes("value")) {
        throw new Error("Expected value to be required");
    }
});

Deno.test("detects supported Pix key types", () => {
    if (detectPixKeyType("nome@exemplo.com") !== "EMAIL") throw new Error("email");
    if (detectPixKeyType("123.456.789-01") !== "CPF") throw new Error("cpf");
    if (detectPixKeyType("12.345.678/0001-01") !== "CNPJ") throw new Error("cnpj");
    if (detectPixKeyType("b6295ee1-f054-47d1-9e90-ee57b74f60d9") !== "EVP") throw new Error("evp");
});

Deno.test("outgoing responses omit raw Pix keys and provider lookup payloads", () => {
    const response = outgoingResponse({
        id: "request-1",
        kind: "pix_transfer",
        amount: 1000,
        provider_operation_id: "provider-operation-secret",
        provider_status: "PROVIDER_INTERNAL_STATUS",
        payout_id: "internal-payout-id",
        destination_payload: {
            type: "pix_key",
            pix_key: "sensitive@example.com",
            holder_name: "Pessoa Exemplo",
            holder_document: "12345678901",
            bank_name: "Banco Exemplo",
            provider_lookup: { raw: "sensitive" },
        },
    });

    const serialized = JSON.stringify(response);
    if (serialized.includes("sensitive@example.com")) throw new Error("raw key leaked");
    if (serialized.includes("provider_lookup")) throw new Error("provider payload leaked");
    if (serialized.includes("12345678901")) throw new Error("document leaked");
    if (serialized.includes("provider-operation-secret")) throw new Error("provider operation leaked");
    if (serialized.includes("PROVIDER_INTERNAL_STATUS")) throw new Error("provider status leaked");
    if (serialized.includes("internal-payout-id")) throw new Error("internal payout id leaked");
});
