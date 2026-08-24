import type { Patient } from "@/types";
import type {
  AttentionReason,
  EvidenceIndexRow,
  EvidenceNode,
  EvidenceOverrideRow,
  EvidenceSource,
  PatientAttentionSummary,
} from "./evidence-types";

const DAY_MS = 86_400_000;
const RECENCY_HALF_LIFE_DAYS = 30;
const RECURRENCE_WINDOW_DAYS = 90;
const MAX_RECURRENCES = 5;
const MAX_SOURCE_DIVERSITY = 4;

export const DENSITY_WEIGHTS = {
  recurrence: 0.45,
  sourceDiversity: 0.35,
  relationSupport: 0.2,
} as const;

export const TENSION_WEIGHTS = {
  acceleration: 0.4,
  objectiveChange: 0.3,
  connectionStrength: 0.3,
} as const;

export const ATTENTION_WEIGHTS = {
  density: 0.3,
  tension: 0.25,
  recency: 0.2,
  actionability: 0.15,
  clinicianPriority: 0.1,
} as const;

// Compatibility alias for desktop extensions that imported the previous name.
export const GRAVITY_WEIGHTS = ATTENTION_WEIGHTS;

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
  reviewed: number;
  total: number;
  distinctDates: Set<string>;
  complete: number;
  recent14: number;
  previous14: number;
  recent30: number;
  previous30: number;
  moodRecent: number[];
  moodPrevious: number[];
};

const emptyThemeStats = (): ThemeStats => ({
  occurrences: 0,
  sources: new Set<EvidenceSource>(),
  reviewed: 0,
  total: 0,
  distinctDates: new Set<string>(),
  complete: 0,
  recent14: 0,
  previous14: 0,
  recent30: 0,
  previous30: 0,
  moodRecent: [],
  moodPrevious: [],
});

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const normalizedObjectiveChange = (recent: number[], previous: number[]) => {
  const recentMedian = median(recent);
  const previousMedian = median(previous);
  if (recentMedian === null || previousMedian === null || recent.length + previous.length < 3) return null;
  const maximum = Math.max(...recent, ...previous);
  const scaleSpan = maximum <= 5 ? 4 : maximum <= 10 ? 9 : 99;
  return clamp01(Math.abs(recentMedian - previousMedian) / scaleSpan);
};

const renormalizedTension = (
  acceleration: number,
  objectiveChange: number | null,
  connectionStrength: number,
) => {
  const parts: Array<[number, number]> = [
    [acceleration, TENSION_WEIGHTS.acceleration],
    [connectionStrength, TENSION_WEIGHTS.connectionStrength],
  ];
  if (objectiveChange !== null) parts.push([objectiveChange, TENSION_WEIGHTS.objectiveChange]);
  const availableWeight = parts.reduce((sum, [, weight]) => sum + weight, 0);
  return availableWeight
    ? clamp01(parts.reduce((sum, [value, weight]) => sum + value * weight, 0) / availableWeight)
    : 0;
};

const actionabilityScore = (row: EvidenceIndexRow, now: number) => {
  if (!row.is_actionable || row.action_completed) return 0;
  if (!row.action_due_at) return 0.5;
  const dueAt = validTimestamp(row.action_due_at, now + 8 * DAY_MS);
  if (dueAt < now) return 1;
  return dueAt <= now + 7 * DAY_MS ? 0.7 : 0.5;
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
    const override = overrideBySource.get(`${row.source_type}:${row.source_id}`);
    const themes = override?.theme_override ? [override.theme_override] : row.tags;
    const occurredAt = validTimestamp(row.occurred_at, now);
    const ageDays = Math.max(0, (now - occurredAt) / DAY_MS);
    themes.map(normalizeEvidenceTheme).filter(Boolean).forEach((theme) => {
      const key = `${row.patient_id || "unlinked"}:${theme}`;
      const stats = themeStats.get(key) || emptyThemeStats();
      stats.total += 1;
      if (row.reviewed) {
        stats.reviewed += 1;
        stats.distinctDates.add(new Date(occurredAt).toISOString().slice(0, 10));
        if (row.title.trim() && row.patient_id && occurredAt > 0) stats.complete += 1;
        if (occurredAt >= recurrenceCutoff) {
          stats.occurrences += 1;
          stats.sources.add(row.source_type);
        }
        if (ageDays <= 14) stats.recent14 += 1;
        else if (ageDays <= 28) stats.previous14 += 1;
        if (ageDays <= 30) stats.recent30 += 1;
        else if (ageDays <= 60) stats.previous30 += 1;
        if (row.source_type === "mood") {
          const moodScore = Number(row.metadata?.moodScore);
          if (Number.isFinite(moodScore)) {
            if (ageDays <= 7) stats.moodRecent.push(moodScore);
            else if (ageDays <= 14) stats.moodPrevious.push(moodScore);
          }
        }
      }
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
    const relationSupport = eligible ? (override?.theme_override ? 1 : row.tags.length ? 0.8 : 0) : 0;
    const density = eligible ? clamp01(
      recurrence * DENSITY_WEIGHTS.recurrence
      + sourceDiversity * DENSITY_WEIGHTS.sourceDiversity
      + relationSupport * DENSITY_WEIGHTS.relationSupport,
    ) : 0;
    const acceleration = eligible ? clamp01(Math.max(0, (stats?.recent14 || 0) - (stats?.previous14 || 0)) * 0.25) : 0;
    const connectionStrength = eligible ? clamp01(Math.max(0, (stats?.recent30 || 0) - (stats?.previous30 || 0)) * 0.25) : 0;
    const objectiveChange = eligible
      ? normalizedObjectiveChange(stats?.moodRecent || [], stats?.moodPrevious || [])
      : null;
    const tension = eligible ? renormalizedTension(acceleration, objectiveChange, connectionStrength) : 0;
    const actionability = eligible ? actionabilityScore(row, now) : 0;
    const clinicianPriority = eligible ? clamp01((override?.priority || 0) / 100) : 0;
    const reviewedProportion = stats?.total ? stats.reviewed / stats.total : 0;
    const dateCoverage = clamp01((stats?.distinctDates.size || 0) / 4);
    const completeness = stats?.reviewed ? stats.complete / stats.reviewed : 0;
    const objectiveAvailabilityPenalty = objectiveChange === null && row.source_type === "mood" ? 0.85 : 1;
    const confidence = eligible ? clamp01((
      reviewedProportion * 0.35
      + sourceDiversity * 0.25
      + dateCoverage * 0.25
      + completeness * 0.15
    ) * objectiveAvailabilityPenalty) : 0;
    const score = eligible
      ? clamp01(
          density * ATTENTION_WEIGHTS.density
          + tension * ATTENTION_WEIGHTS.tension
          + recency * ATTENTION_WEIGHTS.recency
          + actionability * ATTENTION_WEIGHTS.actionability
          + clinicianPriority * ATTENTION_WEIGHTS.clinicianPriority,
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
        formulaVersion: "neurovision-attention-v2",
        recency,
        recurrence,
        sourceDiversity,
        relationSupport,
        density,
        acceleration,
        objectiveChange,
        connectionStrength,
        tension,
        actionability,
        clinicianPriority,
        confidence,
        score,
        eligible,
      },
    };
  });
};

export const buildPatientAttentionSummary = (
  patientId: string,
  evidence: EvidenceNode[],
  now = Date.now(),
): PatientAttentionSummary => {
  const eligible = evidence.filter((item) => item.patientId === patientId && item.gravity.eligible && !item.hidden);
  const byTheme = new Map<string, EvidenceNode[]>();
  eligible.forEach((item) => byTheme.set(item.theme, [...(byTheme.get(item.theme) || []), item]));
  const themes = Array.from(byTheme.entries()).map(([theme, items]) => ({
    theme,
    score: Math.max(...items.map((item) => item.gravity.score)),
  })).sort((left, right) => right.score - left.score);
  const topThree = themes.slice(0, 3);
  const highestThemeScore = topThree[0]?.score || 0;
  const topThreeAverage = topThree.length
    ? topThree.reduce((sum, item) => sum + item.score, 0) / topThree.length
    : 0;
  const criticalPending = clamp01(eligible.filter((item) => (
    item.isActionable && !item.actionCompleted && item.actionDueAt
    && validTimestamp(item.actionDueAt, now + 1) < now
  )).length / 3);
  const confidence = eligible.length
    ? eligible.reduce((sum, item) => sum + item.gravity.confidence, 0) / eligible.length
    : 0;
  return {
    score: clamp01(highestThemeScore * 0.55 + topThreeAverage * 0.3 + criticalPending * 0.15),
    confidence,
    highestThemeScore,
    topThreeAverage,
    criticalPending,
    dominantTheme: topThree[0]?.theme || null,
    evidenceCount: eligible.length,
  };
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
  ai_summary: "Resumo revisado",
  mood: "Humor",
  goal: "Meta",
  anamnesis: "Anamnese",
  appointment: "Agenda",
  reminder: "Lembrete",
  finance: "Financeiro",
}[source]);
