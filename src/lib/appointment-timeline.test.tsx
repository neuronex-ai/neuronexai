import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppointmentTimelinePanel } from "@/components/agenda/AppointmentTimelineDialog";
import {
  repairAppointmentTimelineItem,
  toSafeAppointmentTimeline,
  type AppointmentTimelineRecord,
} from "@/lib/appointment-timeline";

const technicalAudit = {
  id: "f6ec8146-fb24-4b96-b44f-7c2c04fbcaa5",
  appointment_id: "9d041059-eb01-4583-8dbc-7c81d2f3616d",
  actor_user_id: "1cc327cf-fb56-49e5-b06f-44b6a2a51690",
  metadata: {
    tokenId: "e3107ab5-8cb8-4d9b-ba50-e0250bbd829f",
    token: "raw-secret-token",
    ipAddress: "179.216.23.38",
    userAgent: "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/149.0.0.0",
  },
};

describe("appointment timeline safe DTO", () => {
  it("keeps audit identifiers, network data, tokens and raw metadata out of the DTO and UI", () => {
    const records = [
      {
        event_type: "invitation_opened",
        from_status: "reschedule_approved",
        to_status: "reschedule_approved",
        actor_type: "patient",
        action_origin: "public_appointment",
        created_at: "2026-07-15T07:18:18.353Z",
        ...technicalAudit,
      },
    ] as Array<AppointmentTimelineRecord & typeof technicalAudit>;

    const timeline = toSafeAppointmentTimeline(records, {
      patientName: "Nathalia Gasperi",
      psychologistName: "Jhonatan Ferreira",
    });
    const serialized = JSON.stringify(timeline);

    for (const sensitiveValue of [
      technicalAudit.id,
      technicalAudit.appointment_id,
      technicalAudit.actor_user_id,
      technicalAudit.metadata.tokenId,
      technicalAudit.metadata.token,
      technicalAudit.metadata.ipAddress,
      technicalAudit.metadata.userAgent,
    ]) {
      expect(serialized).not.toContain(sensitiveValue);
    }
    expect(serialized).not.toContain("metadata");

    const { container } = render(
      <AppointmentTimelinePanel events={timeline} isLoading={false} error={null} />,
    );

    expect(screen.getByText("Nathalia Gasperi · Link seguro do paciente")).toBeInTheDocument();
    expect(screen.getByText("O link seguro da consulta foi acessado.")).toBeInTheDocument();
    for (const sensitiveValue of [
      technicalAudit.id,
      technicalAudit.appointment_id,
      technicalAudit.actor_user_id,
      technicalAudit.metadata.tokenId,
      technicalAudit.metadata.token,
      technicalAudit.metadata.ipAddress,
      "Mozilla/5.0",
    ]) {
      expect(container).not.toHaveTextContent(sensitiveValue);
    }
    expect(container).not.toHaveTextContent("Auditoria e metadados");
    expect(container).not.toHaveTextContent("public_appointment");
  });

  it("humanizes professional and automatic actors and never falls back to internal names", () => {
    const timeline = toSafeAppointmentTimeline(
      [
        {
          event_type: "psychologist_approved_reschedule",
          from_status: "reschedule_requested",
          to_status: "reschedule_approved",
          actor_type: "psychologist",
          action_origin: "professional_app",
          created_at: "2026-07-15T07:17:28.000Z",
        },
        {
          event_type: "reschedule_approved_email_sent",
          from_status: null,
          to_status: null,
          actor_type: "edge_function",
          action_origin: "email_delivery",
          created_at: "2026-07-15T07:17:29.000Z",
        },
        {
          event_type: "unknown_database_event",
          from_status: "private_database_state",
          to_status: "another_private_state",
          actor_type: "provider",
          action_origin: "internal_table_name",
          created_at: "2026-07-15T07:17:30.000Z",
        },
      ],
      { psychologistName: "Jhonatan Ferreira" },
    );

    render(<AppointmentTimelinePanel events={timeline} isLoading={false} error={null} />);

    expect(screen.getByText("Jhonatan Ferreira · Painel da NeuroNex")).toBeInTheDocument();
    expect(screen.getByText("NeuroNex · Automação de e-mail")).toBeInTheDocument();
    expect(screen.getByText("Atualização do agendamento")).toBeInTheDocument();
    expect(screen.getByText("NeuroNex · NeuroNex")).toBeInTheDocument();
    expect(screen.queryByText(/private_database_state/)).not.toBeInTheDocument();
    expect(screen.queryByText(/internal_table_name/)).not.toBeInTheDocument();
  });

  it("loads the timeline through the safe RPC without selecting or streaming raw audit rows", () => {
    const hookSource = readFileSync(
      resolve(process.cwd(), "src/hooks/use-appointment-lifecycle.ts"),
      "utf8",
    );

    expect(hookSource).toContain('database.rpc("get_safe_appointment_timeline"');
    expect(hookSource).toContain("p_appointment_id: appointmentId");
    expect(hookSource).not.toContain('.from("appointment_events")');
    expect(hookSource).not.toContain('table: "appointment_events"');
    expect(hookSource).toContain('table: "appointments"');
  });

  it("repairs legacy Portuguese encoding in the safe timeline DTO", () => {
    const repaired = repairAppointmentTimelineItem({
      title: "Agendamento criado",
      actorName: "Jhonatan",
      channelName: "AutomaÃ§Ã£o da NeuroNex",
      occurredAt: "2026-07-15T19:00:00.000Z",
      statusChange: "SituaÃ§Ã£o atual: Criado",
      detail: "ConfirmaÃ§Ã£o necessÃ¡ria",
      visualKind: "default",
    });

    expect(repaired).toMatchObject({
      channelName: "Automação da NeuroNex",
      statusChange: "Situação atual: Criado",
      detail: "Confirmação necessária",
    });
    expect(JSON.stringify(repaired)).not.toMatch(/Ã|Â|�/u);
  });
});
