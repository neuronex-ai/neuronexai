import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

import {
  AppointmentLifecycleError,
  appointmentAdminClient,
  appointmentCorsHeaders,
  appointmentErrorResponse,
  appointmentJson,
  requireProfessional,
} from "../_shared/appointment-lifecycle.ts";
import { parsePackageLifecycleRequest } from "./contract.ts";

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: appointmentCorsHeaders });
  if (request.method !== "POST") return appointmentJson({ error: "Método não permitido." }, 405);

  const database = appointmentAdminClient();

  try {
    const user = await requireProfessional(request, database);
    let input;
    try {
      input = parsePackageLifecycleRequest(await request.json());
    } catch (error) {
      throw new AppointmentLifecycleError(
        error instanceof Error ? error.message : "Requisição inválida.",
        400,
        "INVALID_PACKAGE_LIFECYCLE_REQUEST",
      );
    }

    const rpcName = input.mode === "preview"
      ? "preview_package_lifecycle_change_internal"
      : "execute_package_lifecycle_change_internal";
    const progressArgs = {
      p_actor_id: user.id,
      p_source_package_id: input.sourcePackageId,
      p_scope: input.scope,
      p_anchor_appointment_id: input.anchorAppointmentId,
    };
    const { data: progressData, error: progressError } = await database.rpc(
      "validate_package_lifecycle_progress_internal",
      progressArgs,
    );
    if (progressError) {
      throw new AppointmentLifecycleError(
        progressError.message || "Não foi possível validar as sessões em andamento.",
        400,
        "PACKAGE_PROGRESS_VALIDATION_FAILED",
      );
    }

    const progressValidation = progressData as {
      hasInProgress?: boolean;
      hardBlocks?: string[];
    } | null;
    if (input.mode === "execute" && progressValidation?.hasInProgress) {
      throw new AppointmentLifecycleError(
        progressValidation.hardBlocks?.[0] ||
          "Uma sessão do escopo já está em andamento e exige revisão separada.",
        409,
        "PACKAGE_OCCURRENCE_IN_PROGRESS",
      );
    }

    const rpcArgs = input.mode === "preview"
      ? {
        p_actor_id: user.id,
        p_source_package_id: input.sourcePackageId,
        p_target_package_id: input.targetPackageId,
        p_operation_type: input.operationType,
        p_scope: input.scope,
        p_anchor_appointment_id: input.anchorAppointmentId,
        p_financial_strategy: input.financialStrategy,
      }
      : {
        p_actor_id: user.id,
        p_source_package_id: input.sourcePackageId,
        p_target_package_id: input.targetPackageId,
        p_operation_type: input.operationType,
        p_scope: input.scope,
        p_anchor_appointment_id: input.anchorAppointmentId,
        p_financial_strategy: input.financialStrategy,
        p_reason: input.reason,
        p_idempotency_key: input.idempotencyKey,
        p_expected_appointment_ids: input.expectedAppointmentIds,
        p_action_origin: "professional_app",
      };

    const { data, error } = await database.rpc(rpcName, rpcArgs);
    if (error) {
      const retryable = error.code === "40001";
      throw new AppointmentLifecycleError(
        error.message || "Não foi possível atualizar o pacote.",
        retryable ? 409 : 400,
        retryable ? "PACKAGE_STATE_CHANGED" : "PACKAGE_LIFECYCLE_FAILED",
      );
    }

    if (input.mode === "preview" && progressValidation?.hasInProgress) {
      const preview = (data ?? {}) as Record<string, unknown>;
      const currentBlocks = Array.isArray(preview.hardBlocks)
        ? preview.hardBlocks.filter((item): item is string => typeof item === "string")
        : [];
      return appointmentJson({
        ...preview,
        hardBlocks: [...currentBlocks, ...(progressValidation.hardBlocks ?? [])],
        canExecute: false,
      });
    }

    return appointmentJson(data);
  } catch (error) {
    console.error("[manage-package-lifecycle]", error);
    return appointmentErrorResponse(error);
  }
});
