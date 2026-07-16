export type PublicAppointmentContext = {
  appointment: Record<string, any>;
  patient: Record<string, any> | null;
  professional: Record<string, any> | null;
  pendingRequest: Record<string, any> | null;
  policySnapshot: Record<string, any> | null;
};

export function professionalDisplayName(profile?: Record<string, any> | null) {
  return (
    profile?.full_name ||
    profile?.name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    "Seu psicólogo"
  );
}

function publicConsequenceMessage(value: unknown) {
  switch (String(value || "")) {
    case "consume_credit":
      return "Um cr\u00e9dito da sess\u00e3o poder\u00e1 ser analisado conforme a pol\u00edtica aceita.";
    case "keep_charge":
      return "Uma cobran\u00e7a prevista poder\u00e1 ser mantida conforme a pol\u00edtica aceita.";
    case "partial_fee":
      return "Uma taxa parcial poder\u00e1 ser analisada antes de qualquer lan\u00e7amento.";
    case "waive":
      return "N\u00e3o haver\u00e1 penalidade autom\u00e1tica.";
    default:
      return "Qualquer consequ\u00eancia financeira exigir\u00e1 an\u00e1lise; nada ser\u00e1 debitado silenciosamente.";
  }
}

function publicFlowState(value: unknown) {
  switch (String(value || "")) {
    case "confirmed":
      return "confirmed";
    case "cancelled":
      return "cancelled";
    case "reschedule_requested":
      return "waiting_for_professional";
    case "reschedule_approved":
      return "reschedule_accepted";
    case "reschedule_rejected":
      return "request_declined_actions_open";
    case "professional_response_overdue":
      return "professional_late_actions_open";
    case "in_progress":
    case "completed":
    case "closed":
      return "closed";
    default:
      return "awaiting_action";
  }
}

function dateInTimeZone(timeZone: string, value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addCalendarMonths(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + months, day, 12)).toISOString()
    .slice(0, 10);
}

/**
 * Explicit public allowlist. Technical audit fields remain available only on
 * the server and are never copied into this response.
 */
export function serializePublicAppointment(context: PublicAppointmentContext) {
  const appointment = context.appointment;
  const profile = context.professional;
  const isOnline = appointment.type === "online";
  const lifecycleStatus = String(appointment.lifecycle_status || "created");
  const terminal = ["cancelled", "in_progress", "completed", "closed"].includes(
    lifecycleStatus,
  );
  const waiting = lifecycleStatus === "reschedule_requested";
  const requestStatus = String(context.pendingRequest?.status || "");
  const reactionDueAtMs = new Date(
    context.pendingRequest?.reaction_due_at || "",
  ).getTime();
  const requestProtectionIsCurrent =
    Boolean(context.pendingRequest?.financial_right_protected) && (
      requestStatus === "pending" ||
      requestStatus === "expired_no_response" ||
      (
        requestStatus === "rejected" &&
        Number.isFinite(reactionDueAtMs) &&
        Date.now() <= reactionDueAtMs
      )
    );
  const protectedRight =
    appointment.patient_right_status === "financially_protected" ||
    appointment.patient_right_status === "reaction_window" ||
    requestProtectionIsCurrent;
  const lateMessage = publicConsequenceMessage(
    context.policySnapshot?.late_cancellation_consequence,
  );
  const now = Date.now();
  const cancellationCutoff = context.policySnapshot
    ?.free_cancellation_cutoff_at;
  const rescheduleCutoff = context.policySnapshot?.free_reschedule_cutoff_at;
  const cancellationCutoffMs = new Date(cancellationCutoff || "").getTime();
  const rescheduleCutoffMs = new Date(rescheduleCutoff || "").getTime();
  const withinCancellationWindow = Number.isFinite(cancellationCutoffMs) &&
    now <= cancellationCutoffMs;
  const withinRescheduleWindow = Number.isFinite(rescheduleCutoffMs) &&
    now <= rescheduleCutoffMs;
  const timeZone = String(
    context.policySnapshot?.timezone || "America/Sao_Paulo",
  );
  const calendarMinDate = dateInTimeZone(timeZone);
  const calendarMaxDate = addCalendarMonths(calendarMinDate, 6);

  return {
    revision: Number(appointment.confirmation_revision || 1),
    appointment: {
      start_time: appointment.start_time,
      end_time: appointment.end_time,
      type: appointment.type,
      flow_state: publicFlowState(appointment.lifecycle_status),
      location: isOnline ? "Teleconsulta NeuroNex" : appointment.location,
      patient_action_due_at: appointment.patient_action_due_at,
      financial_right_protected: protectedRight,
    },
    patient: {
      firstName: String(context.patient?.name || "Paciente").split(" ")[0],
    },
    professional: {
      name: professionalDisplayName(profile),
      clinic: profile?.clinic_name || "Consultório",
      avatarUrl: profile?.avatar_url || null,
    },
    rescheduleRequest: context.pendingRequest
      ? {
        originalStartTime: context.pendingRequest.original_start_time,
        originalEndTime: context.pendingRequest.original_end_time,
        requestedStartTime: context.pendingRequest.requested_start_time,
        requestedEndTime: context.pendingRequest.requested_end_time,
        reason: context.pendingRequest.reason,
        reviewReason: context.pendingRequest.review_reason,
        reviewedAt: context.pendingRequest.reviewed_at,
        createdAt: context.pendingRequest.created_at,
        requestedAt: context.pendingRequest.requested_at,
        withinFreeWindow: context.pendingRequest.within_free_window,
        professionalResponseDueAt:
          context.pendingRequest.professional_response_due_at,
        financialRightProtected: requestProtectionIsCurrent,
        reactionDueAt: requestStatus === "rejected" &&
            Number.isFinite(reactionDueAtMs) &&
            Date.now() <= reactionDueAtMs
          ? context.pendingRequest.reaction_due_at
          : null,
        expiredWithoutResponseAt:
          context.pendingRequest.expired_without_response_at,
        protectionMessage:
          requestProtectionIsCurrent && context.pendingRequest.protection_reason
            ? "Seus direitos financeiros est\u00e3o protegidos enquanto este caso \u00e9 analisado."
            : null,
      }
      : null,
    policy: context.policySnapshot
      ? {
        freeCancellationCutoffAt:
          context.policySnapshot.free_cancellation_cutoff_at,
        freeRescheduleCutoffAt:
          context.policySnapshot.free_reschedule_cutoff_at,
        minimumPatientReactionHours:
          context.policySnapshot.minimum_patient_reaction_hours,
        professionalResponseSlaHours:
          context.policySnapshot.professional_response_sla_hours,
        lateCancellationMessage: publicConsequenceMessage(
          context.policySnapshot.late_cancellation_consequence,
        ),
        noShowMessage: publicConsequenceMessage(
          context.policySnapshot.no_show_consequence,
        ),
        creditMessage:
          "Cr\u00e9ditos reservados s\u00e3o tratados separadamente de devolu\u00e7\u00e3o em dinheiro.",
        chargeMessage:
          "Cobran\u00e7as e pagamentos s\u00e3o avaliados individualmente antes de qualquer altera\u00e7\u00e3o.",
        fiscalMessage:
          "Documentos fiscais emitidos nunca s\u00e3o reescritos automaticamente.",
        timezone: timeZone,
        calendarMinDate,
        calendarMaxDate,
      }
      : null,
    actions: {
      confirm: {
        allowed: !terminal && !waiting,
        message:
          "Confirmar preserva o hor\u00e1rio oficial e n\u00e3o cria cobran\u00e7a ou consumo antecipado.",
      },
      cancel: {
        allowed: !terminal,
        deadline: appointment.patient_action_due_at ||
          context.policySnapshot?.free_cancellation_cutoff_at ||
          null,
        message: protectedRight
          ? "Seu direito est\u00e1 protegido; o cancelamento n\u00e3o receber\u00e1 penalidade financeira autom\u00e1tica."
          : withinCancellationWindow
          ? "At\u00e9 o prazo informado, o cancelamento n\u00e3o causa perda autom\u00e1tica de cr\u00e9dito."
          : `O prazo gratuito terminou. ${lateMessage}`,
      },
      reschedule: {
        allowed: !terminal && !waiting,
        deadline: appointment.patient_action_due_at ||
          context.policySnapshot?.free_reschedule_cutoff_at ||
          null,
        message: protectedRight
          ? "Seu direito est\u00e1 protegido enquanto voc\u00ea escolhe outra op\u00e7\u00e3o."
          : withinRescheduleWindow
          ? "O pedido dentro do prazo preserva seus direitos e o hor\u00e1rio atual at\u00e9 a resposta."
          : "O prazo gratuito terminou; o pedido ser\u00e1 analisado sem alterar o hor\u00e1rio atual.",
      },
    },
  };
}
