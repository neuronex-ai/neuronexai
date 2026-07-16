import { describe, expect, it } from "vitest";

import { normalizePatientAppointmentHistoryPage } from "@/hooks/use-patient-complete-appointment-history";

describe("patient appointment history safe DTO", () => {
  it("keeps human context while discarding technical and sensitive audit fields", () => {
    const page = normalizePatientAppointmentHistoryPage({
      total: 1,
      hasMore: false,
      nextOffset: null,
      appointment_id: "appointment-secret-id",
      raw_metadata: { shouldNeverRender: true },
      items: [
        {
          occurredAt: "2026-07-15T18:00:00.000Z",
          endAt: "2026-07-15T18:50:00.000Z",
          modality: "Teleconsulta",
          confirmation: "Confirmado pelo paciente",
          lifecycle: "Confirmado",
          archived: true,
          archiveLabel: "Removido apenas da agenda",
          appointment_id: "nested-appointment-secret-id",
          patient_id: "patient-secret-id",
          professional_id: "professional-secret-id",
          metadata: { token: "raw-token-secret" },
          events: [
            {
              title: "Agendamento removido da agenda",
              actor_name: "Dra. Ana",
              channel_name: "Painel da NeuroNex",
              occurred_at: "2026-07-15T19:00:00.000Z",
              status_change: "Visível → Removido apenas da agenda",
              detail: "O histórico clínico e financeiro foi preservado.",
              visual_kind: "archive",
              event_id: "event-secret-id",
              actor_user_id: "actor-secret-id",
              token_id: "token-secret-id",
              token_hash: "token-hash-secret",
              ip_address: "192.0.2.25",
              user_agent: "Raw Browser/99.0",
              metadata: { private: "raw-json-secret" },
            },
          ],
        },
      ],
    });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      modality: "Teleconsulta",
      confirmation: "Confirmado pelo paciente",
      archived: true,
      archiveLabel: "Removido apenas da agenda",
    });
    expect(page.items[0]?.events[0]).toEqual({
      title: "Agendamento removido da agenda",
      actorName: "Dra. Ana",
      channelName: "Painel da NeuroNex",
      occurredAt: "2026-07-15T19:00:00.000Z",
      statusChange: "Visível → Removido apenas da agenda",
      detail: "O histórico clínico e financeiro foi preservado.",
      visualKind: "archive",
    });

    const renderedPayload = JSON.stringify(page);
    for (const sensitiveValue of [
      "appointment-secret-id",
      "nested-appointment-secret-id",
      "patient-secret-id",
      "professional-secret-id",
      "event-secret-id",
      "actor-secret-id",
      "token-secret-id",
      "token-hash-secret",
      "raw-token-secret",
      "192.0.2.25",
      "Raw Browser/99.0",
      "raw-json-secret",
    ]) {
      expect(renderedPayload).not.toContain(sensitiveValue);
    }
    expect(renderedPayload).not.toMatch(/appointment_id|patient_id|professional_id|event_id|actor_user_id|token|ip_address|user_agent|metadata/iu);
  });

  it("repairs legacy encoding before history text reaches the interface", () => {
    const page = normalizePatientAppointmentHistoryPage({
      items: [{
        modality: "Teleconsulta",
        confirmation: "ConfirmaÃ§Ã£o pendente",
        lifecycle: "SituaÃ§Ã£o atualizada",
        events: [{
          title: "CobranÃ§a cancelada",
          actor_name: "NeuroNex",
          channel_name: "AutomaÃ§Ã£o da NeuroNex",
          occurred_at: "2026-07-15T19:00:00.000Z",
          detail: "ConsequÃªncia sujeita a revisÃ£o",
          visual_kind: "financial",
        }],
      }],
    });

    expect(page.items[0]?.confirmation).toBe("Confirmação pendente");
    expect(page.items[0]?.lifecycle).toBe("Situação atualizada");
    expect(page.items[0]?.events[0]).toMatchObject({
      title: "Cobrança cancelada",
      channelName: "Automação da NeuroNex",
      detail: "Consequência sujeita a revisão",
    });
    expect(JSON.stringify(page)).not.toMatch(/Ã|Â|�/u);
  });
});
