/**
 * Creates an idempotent NeuroFinance charge for the authenticated professional.
 * The provider operation is shared with the post-commit appointment worker.
 */

import {
  corsResponse,
  errorResponse,
  getAuthenticatedUser,
  jsonResponse,
} from "../_shared/asaas-client.ts";
import { createNeurofinanceChargeForUser } from "../_shared/neurofinance-charge.ts";
import { subscriptionAccessErrorResponse } from "../_shared/subscription-access.ts";

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return corsResponse();
  if (request.method !== "POST") return errorResponse("Método não permitido.", 405);

  try {
    const user = await getAuthenticatedUser(request);
    const body = await request.json();
    const result = await createNeurofinanceChargeForUser({
      userId: user.id,
      payload: {
        patient_id: body.patient_id || null,
        appointment_id: body.appointment_id || null,
        amount: Number(body.amount),
        payment_method: body.payment_method || null,
        payment_methods: Array.isArray(body.payment_methods) ? body.payment_methods : null,
        description: body.description || null,
        due_date: body.due_date || null,
        patient_name: body.patient_name || null,
        patient_cpf: body.patient_cpf || null,
        patient_email: body.patient_email || null,
        financial_entry_id: body.financial_entry_id || null,
        operation_id: body.operation_id || null,
      },
    });
    return jsonResponse(result);
  } catch (error: any) {
    const accessResponse = subscriptionAccessErrorResponse(error);
    if (accessResponse) return accessResponse;
    if (error?.code === "PATIENT_DOCUMENT_REQUIRED") {
      return errorResponse(
        "Complete o CPF do paciente para gerar a cobrança NeuroFinance.",
        422,
        { code: "PATIENT_DOCUMENT_REQUIRED" },
      );
    }
    console.error("[asaas-create-payment]", error);
    return errorResponse(
      "Não foi possível criar a cobrança agora. Confira os dados e tente novamente.",
      Number(error?.status || 500),
      { code: "PAYMENT_CREATE_UNAVAILABLE" },
    );
  }
});
