import type { Patient } from "@/types";
import type { EvidenceNode } from "./evidence-types";
import {
  fonteDoNeuroTime,
  type NeuroTimeCampoTemporal,
  type NeuroTimeFiltros,
  type NeuroTimeHorizonteDeEvento,
  type NeuroTimeOrigemDeRisco,
  type NeuroTimePeriodo,
  type NeuroTimeResolucao,
  type NeuroTimeRiscoRegistrado,
  type NeuroTimeSingularidade,
} from "./neurotime-types";

const DAY_MS = 86_400_000;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const validTimestamp = (value: string | number | null | undefined, fallback: number) => {
  const timestamp = typeof value === "number" ? value : value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : fallback;
};

const readFiniteNumber = (value: unknown) => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

const riskScale = (value: number, explicitScale?: unknown): 10 | 100 => {
  const parsedScale = readFiniteNumber(explicitScale);
  if (parsedScale === 10 || parsedScale === 100) return parsedScale;
  return value > 10 ? 100 : 10;
};

const normalizeRecordedRisk = ({
  value,
  scale,
  origin,
  recordedAt,
  patientId,
}: {
  value: number;
  scale?: unknown;
  origin: NeuroTimeOrigemDeRisco;
  recordedAt: number;
  patientId: string;
}): NeuroTimeRiscoRegistrado => {
  const normalizedScale = riskScale(value, scale);
  const safeValue = Math.min(normalizedScale, Math.max(0, value));
  return {
    valor: safeValue,
    escala: normalizedScale,
    percentual: clamp01(safeValue / normalizedScale),
    origem: origin,
    registradoEm: recordedAt,
    patientId,
  };
};

const recordedRiskFromEvidence = (
  evidence: EvidenceNode,
  occurredAt: number,
): NeuroTimeRiscoRegistrado | null => {
  if (!evidence.patientId) return null;
  const metadata = evidence.metadata || {};
  const overrideValue = readFiniteNumber(metadata.manualRiskOverride ?? metadata.riskOverride ?? metadata.risk_override);
  if (overrideValue !== null) {
    return normalizeRecordedRisk({
      value: overrideValue,
      scale: metadata.manualRiskScale ?? metadata.riskScale ?? metadata.risk_scale,
      origin: "substituido-pelo-profissional",
      recordedAt: validTimestamp(metadata.riskRecordedAt as string | undefined, occurredAt),
      patientId: evidence.patientId,
    });
  }

  const recordedValue = readFiniteNumber(metadata.recordedRisk ?? metadata.riskScore ?? metadata.risk_score);
  if (recordedValue === null) return null;
  return normalizeRecordedRisk({
    value: recordedValue,
    scale: metadata.riskScale ?? metadata.risk_score_scale,
    origin: "registrado-pelo-profissional",
    recordedAt: validTimestamp(metadata.riskRecordedAt as string | undefined, occurredAt),
    patientId: evidence.patientId,
  });
};

const currentPatientRisk = (patient: Patient, now: number): NeuroTimeRiscoRegistrado | null => {
  const value = readFiniteNumber(patient.risk_score);
  if (value === null) return null;
  return normalizeRecordedRisk({
    value,
    scale: patient.risk_score_scale,
    origin: "registrado-pelo-profissional",
    recordedAt: now,
    patientId: patient.id,
  });
};

export const buildNeuroTimeHorizonteDeEventos = (
  evidence: EvidenceNode[],
  patients: Patient[],
  now = Date.now(),
): NeuroTimeHorizonteDeEvento[] => {
  const patientNames = new Map(patients.map((patient) => [patient.id, patient.name]));

  return evidence
    .filter((item) => item.patientId && !item.hidden && item.gravity.eligible)
    .map((item) => {
      const occurredAt = validTimestamp(item.occurredAt, validTimestamp(item.updatedAt, now));
      const dueAt = item.actionDueAt ? validTimestamp(item.actionDueAt, now + 1) : null;
      return {
        id: item.id,
        patientId: item.patientId as string,
        patientName: patientNames.get(item.patientId as string) || "Paciente",
        sourceId: item.sourceId,
        sourceType: item.sourceType,
        fonte: fonteDoNeuroTime(item.sourceType),
        title: item.title,
        theme: item.theme,
        tags: item.tags,
        occurredAt,
        updatedAt: validTimestamp(item.updatedAt, occurredAt),
        density: clamp01(item.gravity.density),
        attention: clamp01(item.gravity.score),
        recency: clamp01(item.gravity.recency),
        actionable: item.isActionable && !item.actionCompleted,
        overdue: Boolean(item.isActionable && !item.actionCompleted && dueAt !== null && dueAt < now),
        reviewed: item.reviewed,
        confidence: clamp01(item.gravity.confidence),
        recordedRisk: recordedRiskFromEvidence(item, occurredAt),
        evidence: item,
      } satisfies NeuroTimeHorizonteDeEvento;
    })
    .sort((left, right) => left.occurredAt - right.occurredAt);
};

const periodStart = (period: NeuroTimePeriodo, now: number) => {
  if (period === "90-dias") return now - 90 * DAY_MS;
  if (period === "6-meses") return now - 183 * DAY_MS;
  if (period === "1-ano") return now - 365 * DAY_MS;
  return null;
};

export const resolveNeuroTimeResolucao = (startAt: number, endAt: number): NeuroTimeResolucao => {
  const days = Math.max(1, (endAt - startAt) / DAY_MS);
  if (days <= 45) return "dia";
  if (days <= 183) return "semana";
  if (days <= 730) return "mes";
  return "trimestre";
};

const floorUtc = (timestamp: number, resolution: NeuroTimeResolucao) => {
  const date = new Date(timestamp);
  if (resolution === "dia") {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  }
  if (resolution === "semana") {
    const day = date.getUTCDay() || 7;
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day + 1);
  }
  if (resolution === "mes") {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  }
  const quarterMonth = Math.floor(date.getUTCMonth() / 3) * 3;
  return Date.UTC(date.getUTCFullYear(), quarterMonth, 1);
};

const advanceUtc = (timestamp: number, resolution: NeuroTimeResolucao) => {
  const date = new Date(timestamp);
  if (resolution === "dia") return timestamp + DAY_MS;
  if (resolution === "semana") return timestamp + 7 * DAY_MS;
  if (resolution === "mes") return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 3, 1);
};

const compactDate = (timestamp: number, resolution: NeuroTimeResolucao) => {
  const date = new Date(timestamp);
  if (resolution === "dia" || resolution === "semana") {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(date).replace(".", "");
  }
  if (resolution === "mes") {
    return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(date).replace(" de ", "/").replace(".", "");
  }
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${quarter}º tri/${String(date.getUTCFullYear()).slice(-2)}`;
};

const rangeLabel = (startAt: number, endAt: number, resolution: NeuroTimeResolucao) => {
  if (resolution === "mes") {
    return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(startAt));
  }
  if (resolution === "trimestre") return compactDate(startAt, resolution);
  const formatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" });
  return `${formatter.format(new Date(startAt)).replace(".", "")} a ${formatter.format(new Date(endAt - 1)).replace(".", "")}`;
};

const average = (values: number[]) => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : 0;

const resolveRecordedRisk = (
  events: NeuroTimeHorizonteDeEvento[],
  currentRisks: NeuroTimeRiscoRegistrado[],
) => {
  const byPatient = new Map<string, NeuroTimeRiscoRegistrado[]>();
  [...events.map((event) => event.recordedRisk).filter(Boolean) as NeuroTimeRiscoRegistrado[], ...currentRisks]
    .forEach((risk) => byPatient.set(risk.patientId, [...(byPatient.get(risk.patientId) || []), risk]));
  const effectiveByPatient = Array.from(byPatient.values()).map((risks) => {
    const manual = risks
      .filter((risk) => risk.origem === "substituido-pelo-profissional")
      .sort((left, right) => right.registradoEm - left.registradoEm);
    if (manual[0]) return manual[0];
    return risks.sort((left, right) => right.registradoEm - left.registradoEm)[0];
  });
  return effectiveByPatient.sort((left, right) => right.percentual - left.percentual)[0] || null;
};

const summarize = (events: NeuroTimeHorizonteDeEvento[], themes: string[]) => {
  if (!events.length) return "Sem registros neste intervalo.";
  const theme = themes[0];
  if (!theme) return `${events.length} ${events.length === 1 ? "registro compõe" : "registros compõem"} este período.`;
  if (events.length === 1) return `Um registro ligado a ${theme.toLocaleLowerCase("pt-BR")} marca este período.`;
  return `Período com maior presença de ${theme.toLocaleLowerCase("pt-BR")}.`;
};

const buildSingularity = ({
  startAt,
  endAt,
  resolution,
  events,
  currentRisks,
  now,
}: {
  startAt: number;
  endAt: number;
  resolution: NeuroTimeResolucao;
  events: NeuroTimeHorizonteDeEvento[];
  currentRisks: NeuroTimeRiscoRegistrado[];
  now: number;
}): NeuroTimeSingularidade => {
  const densities = events.map((event) => event.density).sort((a, b) => b - a);
  const attentions = events.map((event) => event.attention).sort((a, b) => b - a);
  const densest = densities[0] || 0;
  const highestAttention = attentions[0] || 0;
  const density = clamp01(densest * 0.55 + average(densities.slice(0, 5)) * 0.3 + Math.min(1, events.length / 8) * 0.15);
  const criticalPending = clamp01(events.filter((event) => event.overdue).length / 3);
  const attention = clamp01(highestAttention * 0.55 + average(attentions.slice(0, 3)) * 0.3 + criticalPending * 0.15);
  const ageDays = Math.max(0, now - Math.min(now, endAt)) / DAY_MS;
  const recency = events.length ? Math.max(0.22, Math.exp(-Math.LN2 * ageDays / 90)) : 0;
  const recordedRisk = resolveRecordedRisk(events, currentRisks);
  // Hue communicates automatic attention only. Density uses thickness and
  // recorded risk uses its own outline, preserving an explainable visual grammar.
  const thermalScore = attention;
  const themeCounts = new Map<string, number>();
  const sourceCounts = new Map<NeuroTimeHorizonteDeEvento["fonte"], number>();
  events.forEach((event) => {
    if (event.theme) themeCounts.set(event.theme, (themeCounts.get(event.theme) || 0) + 1);
    sourceCounts.set(event.fonte, (sourceCounts.get(event.fonte) || 0) + 1);
  });
  const dominantThemes = Array.from(themeCounts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "pt-BR"))
    .slice(0, 3)
    .map(([theme]) => theme);

  return {
    id: `${startAt}-${endAt}`,
    startAt,
    endAt,
    inicioNormalizado: 0,
    fimNormalizado: 0,
    centroNormalizado: 0,
    label: rangeLabel(startAt, endAt, resolution),
    compactLabel: compactDate(startAt, resolution),
    density,
    attention,
    recency,
    thermalScore,
    massaVisual: density,
    confianca: events.length ? average(events.map((event) => event.confidence)) : 0,
    recordedRisk,
    eventCount: events.length,
    patientCount: new Set(events.map((event) => event.patientId)).size,
    reviewedCount: events.filter((event) => event.reviewed).length,
    sourceCounts: Array.from(sourceCounts.entries())
      .map(([fonte, quantidade]) => ({ fonte, quantidade }))
      .sort((left, right) => right.quantidade - left.quantidade),
    dominantThemes,
    summary: summarize(events, dominantThemes),
    events,
  };
};

export const buildNeuroTimeCampoTemporal = ({
  events,
  patients,
  filters,
  now = Date.now(),
  bounds,
}: {
  events: NeuroTimeHorizonteDeEvento[];
  patients: Patient[];
  filters: NeuroTimeFiltros;
  now?: number;
  bounds?: { startAt: number; endAt: number };
}): NeuroTimeCampoTemporal => {
  const selectedPatientIds = new Set(filters.patientIds);
  const selectedSources = new Set(filters.sources);
  const requestedStart = periodStart(filters.period, now);
  const filteredEvents = events.filter((event) => (
    (!selectedPatientIds.size || selectedPatientIds.has(event.patientId))
    && (!selectedSources.size || selectedSources.has(event.fonte))
    && (requestedStart === null || event.occurredAt >= requestedStart)
    && event.occurredAt <= now
  ));

  const oldestEvent = filteredEvents.length
    ? Math.min(...filteredEvents.map((event) => event.occurredAt))
    : requestedStart ?? now - 30 * DAY_MS;
  const rawStart = bounds?.startAt ?? requestedStart ?? oldestEvent;
  const rawEnd = bounds?.endAt ?? now;
  const resolution = resolveNeuroTimeResolucao(rawStart, rawEnd);
  const startAt = bounds ? bounds.startAt : floorUtc(rawStart, resolution);
  const endAt = bounds ? bounds.endAt : advanceUtc(floorUtc(rawEnd, resolution), resolution);
  const selectedPatients = patients.filter((patient) => !selectedPatientIds.size || selectedPatientIds.has(patient.id));
  const currentRisks = selectedPatients
    .map((patient) => currentPatientRisk(patient, now))
    .filter(Boolean) as NeuroTimeRiscoRegistrado[];
  const singularities: NeuroTimeSingularidade[] = [];

  for (let cursor = startAt; cursor < endAt; cursor = advanceUtc(cursor, resolution)) {
    const next = advanceUtc(cursor, resolution);
    const bucketEvents = filteredEvents.filter((event) => event.occurredAt >= cursor && event.occurredAt < next);
    // A current patient risk has no historical timestamp in the present frontend.
    // It is therefore attached only to the latest interval and never backfilled.
    const risksAtCurrentEdge = next >= now && cursor <= now ? currentRisks : [];
    singularities.push(buildSingularity({
      startAt: cursor,
      endAt: next,
      resolution,
      events: bucketEvents,
      currentRisks: risksAtCurrentEdge,
      now,
    }));
  }

  const totalDuration = Math.max(1, endAt - startAt);
  singularities.forEach((singularity) => {
    singularity.inicioNormalizado = clamp01((singularity.startAt - startAt) / totalDuration);
    singularity.fimNormalizado = clamp01((singularity.endAt - startAt) / totalDuration);
    singularity.centroNormalizado = clamp01(((singularity.startAt + singularity.endAt) / 2 - startAt) / totalDuration);
  });

  return {
    versaoDoCampo: "neurotime-campo-v1",
    startAt,
    endAt,
    resolution,
    singularities,
    eventCount: filteredEvents.length,
    patientCount: new Set(filteredEvents.map((event) => event.patientId)).size,
    sourceCount: new Set(filteredEvents.map((event) => event.fonte)).size,
    latestActivityAt: filteredEvents.length ? Math.max(...filteredEvents.map((event) => event.occurredAt)) : null,
    hasRecordedRisk: singularities.some((singularity) => Boolean(singularity.recordedRisk)),
  };
};

export const neuroTimeTemperatureColor = (value: number, darkMode: boolean) => {
  const score = clamp01(value);
  const stops = darkMode
    ? ["#5143b8", "#4169c1", "#d7a927", "#dc6c2d", "#de4b4b"]
    : ["#5b4fc1", "#3570c9", "#c49000", "#d75c1f", "#cf3f46"];
  const scaled = score * (stops.length - 1);
  const lowerIndex = Math.floor(scaled);
  const upperIndex = Math.min(stops.length - 1, lowerIndex + 1);
  const mix = scaled - lowerIndex;
  const rgb = (hex: string) => [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
  const lower = rgb(stops[lowerIndex]);
  const upper = rgb(stops[upperIndex]);
  const channels = lower.map((channel, index) => Math.round(channel + (upper[index] - channel) * mix));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
};
