import { assertEquals, assertFalse } from "jsr:@std/assert@1";

import {
  type PublicAppointmentContext,
  serializePublicAppointment,
} from "./appointment-public-dto.ts";

const internalValues = {
  appointmentId: "9d041059-eb01-4583-8dbc-7c81d2f3616d",
  patientId: "79bcba41-4cb8-4e59-a911-f9f76f87ef45",
  professionalId: "33b5799d-171b-4750-84a7-782f0edfc146",
  requestId: "e6ac9afd-1c5c-4bb0-af11-ff9a39e95766",
  tokenId: "e3107ab5-8cb8-4d9b-ba50-e0250bbd329f",
  tokenHash: "raw-token-hash-must-stay-server-side",
  rawToken: "raw-bearer-token-must-stay-server-side",
  ipAddress: "179.216.23.38",
  userAgent: "Mozilla/5.0 Internal Browser Signature",
};

function invitationContext(
  lifecycleStatus: "reschedule_rejected" | "professional_response_overdue",
): PublicAppointmentContext & {
  tokenHash: string;
  tokenRow: Record<string, unknown>;
} {
  return {
    tokenHash: internalValues.tokenHash,
    tokenRow: {
      id: internalValues.tokenId,
      token: internalValues.rawToken,
      metadata: {
        ipAddress: internalValues.ipAddress,
        userAgent: internalValues.userAgent,
      },
    },
    appointment: {
      id: internalValues.appointmentId,
      user_id: internalValues.professionalId,
      patient_id: internalValues.patientId,
      start_time: "2099-07-16T10:00:00.000Z",
      end_time: "2099-07-16T10:50:00.000Z",
      type: "presencial",
      lifecycle_status: lifecycleStatus,
      location: "Consultorio 2",
      patient_action_due_at: "2099-07-16T09:00:00.000Z",
      patient_right_status: "financially_protected",
      metadata: { sourceTable: "appointments" },
    },
    patient: {
      id: internalValues.patientId,
      name: "Paciente Exemplo",
      email: "paciente-secreto@example.test",
    },
    professional: {
      id: internalValues.professionalId,
      full_name: "Dra. Profissional Exemplo",
      clinic_name: "Clinica Exemplo",
      address: "Endereco privado do profissional",
    },
    pendingRequest: {
      id: internalValues.requestId,
      appointment_id: internalValues.appointmentId,
      status: lifecycleStatus === "reschedule_rejected"
        ? "rejected"
        : "expired_no_response",
      original_start_time: "2099-07-16T09:00:00.000Z",
      original_end_time: "2099-07-16T09:50:00.000Z",
      requested_start_time: "2099-07-18T10:00:00.000Z",
      requested_end_time: "2099-07-18T10:50:00.000Z",
      reason: "Preciso de outro horario",
      review_reason: "Consulte o retorno seguro",
      reviewed_at: "2099-07-15T12:00:00.000Z",
      created_at: "2099-07-15T11:00:00.000Z",
      requested_at: "2099-07-15T11:00:00.000Z",
      within_free_window: true,
      professional_response_due_at: "2099-07-15T12:00:00.000Z",
      financial_right_protected: true,
      reaction_due_at: "2099-07-16T08:00:00.000Z",
      protection_reason: "professional_response_sla_expired",
      expired_without_response_at:
        lifecycleStatus === "professional_response_overdue"
          ? "2099-07-15T12:01:00.000Z"
          : null,
      metadata: {
        tokenId: internalValues.tokenId,
        ipAddress: internalValues.ipAddress,
        userAgent: internalValues.userAgent,
      },
    },
    policySnapshot: {
      id: "6bb01917-572f-4f6e-bb24-23db57cbfd19",
      free_cancellation_cutoff_at: "2099-07-15T10:00:00.000Z",
      free_reschedule_cutoff_at: "2099-07-15T11:00:00.000Z",
      minimum_patient_reaction_hours: 4,
      professional_response_sla_hours: 8,
      late_cancellation_consequence: "manual_review",
      no_show_consequence: "manual_review",
      timezone: "Pacific/Auckland",
      metadata: { sourceTable: "appointment_policy_snapshots" },
    },
  };
}

function assertSafePublicDto(payload: unknown) {
  const serialized = JSON.stringify(payload);
  for (
    const forbidden of [
      ...Object.values(internalValues),
      "paciente-secreto@example.test",
      "appointment_policy_snapshots",
      "reschedule_rejected",
      "professional_response_overdue",
      '"status":"rejected"',
      '"status":"expired_no_response"',
    ]
  ) {
    assertFalse(
      serialized.includes(forbidden),
      `Public DTO exposed ${forbidden}`,
    );
  }
  assertFalse(
    /"(?:id|appointmentId|patientId|professionalId|requestId|tokenId|metadata)"\s*:/u
      .test(serialized),
    "Public DTO exposed a technical key",
  );
}

Deno.test("secure appointment DTO omits identities, tokens, metadata and internal enums", () => {
  const payload = serializePublicAppointment(
    invitationContext("reschedule_rejected"),
  );

  assertSafePublicDto(payload);
  assertEquals(payload.appointment.flow_state, "request_declined_actions_open");
  assertEquals(payload.patient.firstName, "Paciente");
  assertEquals(payload.professional.name, "Dra. Profissional Exemplo");
});

Deno.test("rejected and overdue reviews reopen all non-terminal patient actions", () => {
  for (
    const lifecycleStatus of [
      "reschedule_rejected",
      "professional_response_overdue",
    ] as const
  ) {
    const payload = serializePublicAppointment(
      invitationContext(lifecycleStatus),
    );
    assertSafePublicDto(payload);
    assertEquals(payload.actions.confirm.allowed, true);
    assertEquals(payload.actions.cancel.allowed, true);
    assertEquals(payload.actions.reschedule.allowed, true);
  }
});

Deno.test("secure DTO calculates its calendar boundary in the snapshot timezone", () => {
  const payload = serializePublicAppointment(
    invitationContext("reschedule_rejected"),
  );
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Auckland",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value;

  assertEquals(payload.policy?.timezone, "Pacific/Auckland");
  assertEquals(
    payload.policy?.calendarMinDate,
    `${part("year")}-${part("month")}-${part("day")}`,
  );
});
