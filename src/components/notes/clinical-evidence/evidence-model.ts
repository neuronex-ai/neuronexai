import type { Patient } from "@/types";
import type {
  AttentionReason,
  EvidenceIndexRow,
  EvidenceNode,
  EvidenceOverrideRow,
  EvidenceSource,
} from "./evidence-types";

const DAY_MS = 86_400_000;
const RECENCY_HALF_LIFE_DAYS = 30;
const RECURRENCE_WINDOW_DAYS = 90;
const MAX_RECURRENCES = 5;
const MAX_SOURCE_DIVERSITY = 4;

export const GRAVITY_WEIGHTS = {
  recency: 0.3,
  recurrence: 0.25,
  sourceDiversity: 0.2,
  actionability: 0.15,
  clinicianPriority: 0.1,
} as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const normalizeEvidenceTheme = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const displayTheme = (value: string) => value.trim().replace(/^#/, "") || "Contexto geral";

const validTimestamp = (value: string | null | undefined, fallback: number) => {
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : fallback;
};

type ThemeStats = {
  occurrences: number;
  sources: Set<EvidenceSource>;
};

export const buildEvidenceNodes = (
  rows: EvidenceIndexRow[],
  overrides: EvidenceOverrideRow[],
  now = Date.now(),
): EvidenceNode[] => {
  const overrideBySource = new Map(
    overrides.map((override) => [`${override.source_type}:${override.source_id}`, override]),
  );
  const themeStats = new Map<string, ThemeStats>();
  const recurrenceCutoff = now - RECURRENCE_WINDOW_DAYS * DAY_MS;

  rows.forEach((row) => {
    if (!row.reviewed) return;
    const override = overrideBySource.get(`${row.source_type}:${row.source_id}`);
    const themes = override?.theme_override ? [override.theme_override] : row.tags;
    const occurredAt = validTimestamp(row.occurred_at, now);
    if (occurredAt < recurrenceCutoff) return;
    themes.map(normalizeEvidenceTheme).filter(Boolean).forEach((theme) => {
      const key = `${row.patient_id || "unlinked"}:${theme}`;
      const stats = themeStats.get(key) || { occurrences: 0, sources: new Set<EvidenceSource>() };
      stats.occurrences += 1;
      stats.sources.add(row.source_type);
      themeStats.set(key, stats);
    });
  });

  return rows.map((row) => {
    const override = overrideBySource.get(`${row.source_type}:${row.source_id}`);
    const rawTheme = override?.theme_override || row.tags[0] || row.source_type;
    const normalizedTheme = normalizeEvidenceTheme(rawTheme) || row.source_type;
    const stats = themeStats.get(`${row.patient_id || "unlinked"}:${normalizedTheme}`);
    const eligible = row.reviewed;
    const occurredAt = validTimestamp(row.occurred_at, now);
    const ageDays = Math.max(0, (now - occurredAt) / DAY_MS);
    const recency = eligible ? Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS) : 0;
    const recurrence = eligible ? clamp01((stats?.occurrences || 0) / MAX_RECURRENCES) : 0;
    const sourceDiversity = eligible ? clamp01((stats?.sources.size || 0) / MAX_SOURCE_DIVERSITY) : 0;
    const actionability = eligible && row.is_actionable && !row.action_completed ? 1 : 0;
    const clinicianPriority = eligible ? clamp01((override?.priority || 0) / 100) : 0;
    const score = eligible
      ? clamp01(
          recency * GRAVITY_WEIGHTS.recency
          + recurrence * GRAVITY_WEIGHTS.recurrence
          + sourceDiversity * GRAVITY_WEIGHTS.sourceDiversity
          + actionability * GRAVITY_WEIGHTS.actionability
          + clinicianPriority * GRAVITY_WEIGHTS.clinicianPriority,
        )
      : 0;

    return {
      id: `${row.source_type}:${row.source_id}`,
      sourceId: row.source_id,
      sourceType: row.source_type,
      patientId: row.patient_id,
      title: row.title,
      occurredAt: row.occurred_at,
      updatedAt: row.updated_at,
      tags: row.tags,
      reviewed: row.reviewed,
      isActionable: row.is_actionable,
      actionDueAt: row.action_due_at,
      actionCompleted: row.action_completed,
      priority: override?.priority || 0,
      pinned: override?.is_pinned || false,
      hidden: override?.is_hidden || false,
      theme: displayTheme(override?.theme_override || row.tags[0] || row.source_type),
      metadata: row.metadata || {},
      gravity: {
        recency,
        recurrence,
        sourceDiversity,
        actionability,
        clinicianPriority,
        score,
        eligible,
      },
    };
  });
};

const riskScale = (patient: Patient) => {
  if (patient.risk_score_scale === 10 || patient.risk_score_scale === 100) return patient.risk_score_scale;
  return Number(patient.risk_score) > 10 ? 100 : 10;
};

export const buildAttentionReasons = (
  patient: Patient,
  evidence: EvidenceNode[],
  now = Date.now(),
): AttentionReason[] => {
  const reasons: AttentionReason[] = [];
  const patientEvidence = evidence.filter((item) => item.patientId === patient.id && !item.hidden);
  const score = Number(patient.risk_score);
  if (Number.isFinite(score) && score >= riskScale(patient) * 0.4) {
    reasons.push({
      type: "recorded-risk",
      label: "Risco registrado",
      detail: `Pontuação ${score} de ${riskScale(patient)}, conforme registro clínico existente.`,
      sourceIds: [],
    });
  }

  const overdue = patientEvidence.filter((item) => (
    item.isActionable
    && !item.actionCompleted
    && item.actionDueAt
    && validTimestamp(item.actionDueAt, now + 1) < now
  ));
  if (overdue.length) {
    reasons.push({
      type: "overdue-action",
      label: "Ações pendentes",
      detail: `${overdue.length} ${overdue.length === 1 ? "item vencido" : "itens vencidos"}.`,
      sourceIds: overdue.map((item) => item.id),
    });
  }

  const pendingReview = patientEvidence.filter((item) => (
    item.sourceType === "session_note" && !item.reviewed
  ));
  if (pendingReview.length) {
    reasons.push({
      type: "pending-review",
      label: "Revisão pendente",
      detail: `${pendingReview.length} ${pendingReview.length === 1 ? "registro de sessão aguarda" : "registros de sessão aguardam"} confirmação.`,
      sourceIds: pendingReview.map((item) => item.id),
    });
  }

  const mood = patientEvidence
    .filter((item) => item.sourceType === "mood" && now - validTimestamp(item.occurredAt, 0) <= 30 * DAY_MS)
    .sort((left, right) => validTimestamp(left.occurredAt, 0) - validTimestamp(right.occurredAt, 0));
  if (mood.length >= 3) {
    const first = Number(mood[0].metadata.moodScore);
    const last = Number(mood[mood.length - 1].metadata.moodScore);
    if (Number.isFinite(first) && Number.isFinite(last) && last <= first - 2) {
      reasons.push({
        type: "observed-mood-change",
        label: "Mudança observada no humor",
        detail: `Os registros passaram de ${first} para ${last} nos últimos 30 dias; isto é uma observação matemática, não uma inferência clínica.`,
        sourceIds: mood.map((item) => item.id),
      });
    }
  }

  return reasons;
};

export const getEvidenceSourceLabel = (source: EvidenceSource) => ({
  personal_note: "Nota",
  flow: "Fluxo",
  session_note: "Sessão",
  mood: "Humor",
  goal: "Meta",
  anamnesis: "Anamnese",
  appointment: "Agenda",
  reminder: "Lembrete",
}[source]);
