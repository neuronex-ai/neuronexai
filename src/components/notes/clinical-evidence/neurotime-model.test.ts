import { describe, expect, it } from "vitest";

import type { Patient } from "@/types";
import type { EvidenceNode, EvidenceSource } from "./evidence-types";
import {
  buildNeuroTimeCampoTemporal,
  buildNeuroTimeHorizonteDeEventos,
  resolveNeuroTimeResolucao,
} from "./neurotime-model";
import type { NeuroTimeFiltros } from "./neurotime-types";

const NOW = Date.UTC(2026, 7, 23, 12);

const patient = (overrides: Partial<Patient> = {}): Patient => ({
  id: "patient-1",
  user_id: "professional-1",
  name: "Paciente exemplo",
  email: null,
  phone: null,
  status: "active",
  last_session: null,
  next_session: null,
  diagnosis: null,
  notes: null,
  created_at: "2025-01-01T00:00:00.000Z",
  ...overrides,
});

const evidence = ({
  id,
  occurredAt,
  sourceType = "personal_note",
  density = 0.6,
  attention = 0.5,
  eligible = true,
  metadata = {},
  patientId = "patient-1",
}: {
  id: string;
  occurredAt: string;
  sourceType?: EvidenceSource;
  density?: number;
  attention?: number;
  eligible?: boolean;
  metadata?: EvidenceNode["metadata"];
  patientId?: string;
}): EvidenceNode => ({
  id: `${sourceType}:${id}`,
  sourceId: id,
  sourceType,
  patientId,
  title: `Registro ${id}`,
  occurredAt,
  updatedAt: occurredAt,
  tags: ["Ansiedade"],
  reviewed: eligible,
  isActionable: false,
  actionDueAt: null,
  actionCompleted: false,
  priority: 0,
  pinned: false,
  hidden: false,
  theme: "Ansiedade",
  metadata,
  gravity: {
    formulaVersion: "neurovision-attention-v2",
    recency: 0.7,
    recurrence: 0.5,
    sourceDiversity: 0.5,
    relationSupport: 0.4,
    density,
    acceleration: 0.2,
    objectiveChange: null,
    connectionStrength: 0.4,
    tension: 0.3,
    actionability: 0,
    clinicianPriority: 0,
    confidence: 0.8,
    score: attention,
    eligible,
  },
});

const filters = (overrides: Partial<NeuroTimeFiltros> = {}): NeuroTimeFiltros => ({
  patientIds: [],
  sources: [],
  period: "1-ano",
  ...overrides,
});

describe("NeuroTime — campo temporal explicável", () => {
  it("ordena o horizonte do mais antigo para o mais recente e ignora conteúdo inelegível", () => {
    const events = buildNeuroTimeHorizonteDeEventos([
      evidence({ id: "new", occurredAt: "2026-08-20T00:00:00.000Z" }),
      evidence({ id: "unreviewed", occurredAt: "2026-07-10T00:00:00.000Z", eligible: false }),
      evidence({ id: "old", occurredAt: "2026-03-03T00:00:00.000Z" }),
    ], [patient()], NOW);

    expect(events.map((event) => event.sourceId)).toEqual(["old", "new"]);
  });

  it("agrega densidade sem converter atenção em risco", () => {
    const events = buildNeuroTimeHorizonteDeEventos([
      evidence({ id: "a", occurredAt: "2026-08-03T00:00:00.000Z", density: 1, attention: 1 }),
      evidence({ id: "b", occurredAt: "2026-08-05T00:00:00.000Z", density: 0.5, attention: 0.6 }),
    ], [patient()], NOW);
    const field = buildNeuroTimeCampoTemporal({ events, patients: [patient()], filters: filters({ period: "90-dias" }), now: NOW });
    const active = field.singularities.find((item) => item.eventCount > 0);

    expect(active?.density).toBeCloseTo(0.55 + 0.225 + 0.0375, 4);
    expect(active?.attention).toBeGreaterThan(0.7);
    expect(field.hasRecordedRisk).toBe(false);
    expect(field.singularities.every((item) => item.recordedRisk === null)).toBe(true);
  });

  it("mantém o risco atual somente na borda do presente", () => {
    const events = buildNeuroTimeHorizonteDeEventos([
      evidence({ id: "history", occurredAt: "2026-02-10T00:00:00.000Z" }),
    ], [patient({ risk_score: 6, risk_score_scale: 10 })], NOW);
    const field = buildNeuroTimeCampoTemporal({
      events,
      patients: [patient({ risk_score: 6, risk_score_scale: 10 })],
      filters: filters(),
      now: NOW,
    });

    const withRisk = field.singularities.filter((item) => item.recordedRisk);
    expect(withRisk).toHaveLength(1);
    expect(withRisk[0]).toBe(field.singularities[field.singularities.length - 1]);
    expect(withRisk[0].recordedRisk?.percentual).toBe(0.6);
  });

  it("preserva risco registrado no presente mesmo quando não há outros eventos", () => {
    const field = buildNeuroTimeCampoTemporal({
      events: [],
      patients: [patient({ risk_score: 4, risk_score_scale: 10 })],
      filters: filters({ period: "90-dias" }),
      now: NOW,
    });

    expect(field.eventCount).toBe(0);
    expect(field.hasRecordedRisk).toBe(true);
    expect(field.singularities[field.singularities.length - 1]?.recordedRisk?.valor).toBe(4);
  });

  it("faz o valor substituído pelo psicólogo prevalecer exatamente sobre outro risco registrado", () => {
    const events = buildNeuroTimeHorizonteDeEventos([
      evidence({
        id: "manual-risk",
        occurredAt: "2026-08-20T00:00:00.000Z",
        metadata: { manualRiskOverride: 4, manualRiskScale: 10, riskRecordedAt: "2026-08-20T00:00:00.000Z" },
      }),
    ], [patient({ risk_score: 90, risk_score_scale: 100 })], NOW);
    const field = buildNeuroTimeCampoTemporal({
      events,
      patients: [patient({ risk_score: 90, risk_score_scale: 100 })],
      filters: filters({ period: "90-dias" }),
      now: NOW,
    });
    const current = field.singularities[field.singularities.length - 1];

    expect(current.recordedRisk?.origem).toBe("substituido-pelo-profissional");
    expect(current.recordedRisk?.valor).toBe(4);
    expect(current.recordedRisk?.escala).toBe(10);
  });

  it("filtra por paciente e fonte sem criar dados ausentes", () => {
    const patients = [patient(), patient({ id: "patient-2", name: "Outra pessoa" })];
    const events = buildNeuroTimeHorizonteDeEventos([
      evidence({ id: "note", occurredAt: "2026-08-01T00:00:00.000Z" }),
      evidence({ id: "mood", occurredAt: "2026-08-02T00:00:00.000Z", sourceType: "mood", patientId: "patient-2" }),
    ], patients, NOW);
    const field = buildNeuroTimeCampoTemporal({
      events,
      patients,
      filters: filters({ patientIds: ["patient-2"], sources: ["humor"], period: "90-dias" }),
      now: NOW,
    });

    expect(field.eventCount).toBe(1);
    expect(field.patientCount).toBe(1);
    expect(field.sourceCount).toBe(1);
    expect(field.singularities.flatMap((item) => item.events).map((item) => item.sourceId)).toEqual(["mood"]);
  });

  it("escolhe resolução semântica e limita a quantidade de segmentos mesmo com muitos registros", () => {
    expect(resolveNeuroTimeResolucao(NOW - 30 * 86_400_000, NOW)).toBe("dia");
    expect(resolveNeuroTimeResolucao(NOW - 120 * 86_400_000, NOW)).toBe("semana");
    expect(resolveNeuroTimeResolucao(NOW - 365 * 86_400_000, NOW)).toBe("mes");
    expect(resolveNeuroTimeResolucao(NOW - 900 * 86_400_000, NOW)).toBe("trimestre");

    const many = Array.from({ length: 5_000 }, (_, index) => evidence({
      id: `e-${index}`,
      occurredAt: new Date(NOW - (index % 360) * 86_400_000).toISOString(),
    }));
    const events = buildNeuroTimeHorizonteDeEventos(many, [patient()], NOW);
    const field = buildNeuroTimeCampoTemporal({ events, patients: [patient()], filters: filters(), now: NOW });
    expect(field.eventCount).toBe(5_000);
    expect(field.singularities.length).toBeLessThanOrEqual(14);
  });

  it("mantém rótulos mensais estáveis nas fronteiras UTC", () => {
    const events = buildNeuroTimeHorizonteDeEventos([
      evidence({ id: "august", occurredAt: "2026-08-01T00:00:00.000Z" }),
    ], [patient()], NOW);
    const field = buildNeuroTimeCampoTemporal({ events, patients: [patient()], filters: filters(), now: NOW });
    const august = field.singularities.find((item) => item.events.some((event) => event.sourceId === "august"));

    expect(august?.label).toBe("agosto de 2026");
    expect(august?.compactLabel).toBe("ago/26");
  });
});
