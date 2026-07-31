import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns";

export type RecurrenceRuleKind =
  | "weekly"
  | "monthly"
  | "interval"
  | "custom_dates"
  | "range_distribution";

export type RecurrenceTermination =
  | { kind: "count"; count: number }
  | { kind: "until"; untilDate: string }
  | { kind: "open"; horizonDays?: number };

export interface AdvancedRecurrenceRule {
  kind: RecurrenceRuleKind;
  interval?: number;
  weekDays?: number[];
  monthDays?: number[];
  customDates?: string[];
  termination: RecurrenceTermination;
  missingMonthDay?: "last_business_day";
}

export interface OccurrenceOverride {
  occurrenceNumber: number;
  date?: string;
  startTime?: string;
  durationMinutes?: number;
  modality?: "presencial" | "online";
  location?: string | null;
  reason?: string;
  source?: "professional" | "synapse" | "availability_change";
}

export interface GeneratedAgendaOccurrence {
  occurrenceNumber: number;
  originalOccurrenceNumber?: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: "standard" | "adjusted" | "customized";
  changedFields: string[];
  adjustmentReason: string | null;
  overrideReason: string | null;
}

export interface GenerateAgendaOccurrencesInput {
  firstStartTime: Date;
  durationMinutes: number;
  rule: AdvancedRecurrenceRule;
  overrides?: OccurrenceOverride[];
  excludedOccurrenceNumbers?: number[];
  workingWeekDays?: number[];
  blockedDates?: string[];
  now?: Date;
}

export interface SmartFitCandidate {
  startTime: string;
  durationMinutes: number;
  modality?: "presencial" | "online";
  location?: string | null;
}

export interface AgendaRecurrenceDraft {
  kind: RecurrenceRuleKind;
  interval: number;
  weekDays: number[];
  monthDays: number[];
  customDates: string[];
  terminationKind: "count" | "until" | "open";
  count: number;
  untilDate: string;
  distributeUntilDate: string;
  customizeOccurrences: boolean;
  overrides: OccurrenceOverride[];
  excludedOccurrenceNumbers: number[];
}

const MAX_FINITE_OCCURRENCES = 500;
const DEFAULT_OPEN_HORIZON_DAYS = 90;

const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const atOriginalTime = (date: Date, original: Date) => {
  const next = new Date(date);
  next.setHours(original.getHours(), original.getMinutes(), 0, 0);
  return next;
};

const atTime = (date: Date, time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
};

const dateKey = (date: Date) => format(date, "yyyy-MM-dd");

const normalizePositiveInteger = (value: number | undefined, fallback: number) => {
  if (!Number.isInteger(value) || Number(value) < 1) return fallback;
  return Number(value);
};

const terminationLimit = (rule: AdvancedRecurrenceRule, firstStartTime: Date, now: Date) => {
  if (rule.termination.kind === "count") {
    return {
      count: Math.min(Math.max(rule.termination.count, 1), MAX_FINITE_OCCURRENCES),
      until: null as Date | null,
    };
  }

  if (rule.termination.kind === "until") {
    const until = new Date(`${rule.termination.untilDate}T23:59:59.999`);
    if (Number.isNaN(until.getTime()) || until < firstStartTime) {
      throw new Error("A data final precisa ser igual ou posterior à primeira sessão.");
    }
    return { count: MAX_FINITE_OCCURRENCES, until };
  }

  const horizon = Math.min(
    normalizePositiveInteger(rule.termination.horizonDays, DEFAULT_OPEN_HORIZON_DAYS),
    DEFAULT_OPEN_HORIZON_DAYS,
  );
  const base = firstStartTime > now ? firstStartTime : now;
  return { count: MAX_FINITE_OCCURRENCES, until: addDays(base, horizon) };
};

const isAllowedBusinessDate = (
  date: Date,
  workingWeekDays: Set<number>,
  blockedDates: Set<string>,
) => workingWeekDays.has(date.getDay()) && !blockedDates.has(dateKey(date));

const adjustToLastBusinessDay = (
  date: Date,
  month: number,
  workingWeekDays: Set<number>,
  blockedDates: Set<string>,
) => {
  const adjusted = new Date(date);
  while (
    adjusted.getMonth() === month
    && !isAllowedBusinessDate(adjusted, workingWeekDays, blockedDates)
  ) {
    adjusted.setDate(adjusted.getDate() - 1);
  }
  return adjusted.getMonth() === month ? adjusted : null;
};

const buildMonthlyCandidates = (
  firstStartTime: Date,
  rule: AdvancedRecurrenceRule,
  limit: ReturnType<typeof terminationLimit>,
  workingWeekDays: Set<number>,
  blockedDates: Set<string>,
) => {
  const monthDays = [...new Set(rule.monthDays?.length ? rule.monthDays : [firstStartTime.getDate()])]
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 31)
    .sort((left, right) => left - right);
  const interval = normalizePositiveInteger(rule.interval, 1);
  const candidates: Array<{ date: Date; adjustmentReason: string | null }> = [];

  for (let monthOffset = 0; candidates.length < limit.count; monthOffset += interval) {
    const monthStart = new Date(firstStartTime);
    monthStart.setDate(1);
    monthStart.setMonth(monthStart.getMonth() + monthOffset);
    const targetMonth = monthStart.getMonth();
    const targetYear = monthStart.getFullYear();
    const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();

    for (const requestedDay of monthDays) {
      const clamped = Math.min(requestedDay, lastDay);
      let candidate = atOriginalTime(new Date(targetYear, targetMonth, clamped), firstStartTime);
      let adjustmentReason: string | null = requestedDay > lastDay
        ? "Dia inexistente ajustado para o último dia útil do mês."
        : null;

      if (rule.missingMonthDay === "last_business_day" && (
        requestedDay > lastDay
        || !isAllowedBusinessDate(candidate, workingWeekDays, blockedDates)
      )) {
        const adjusted = adjustToLastBusinessDay(
          candidate,
          targetMonth,
          workingWeekDays,
          blockedDates,
        );
        if (!adjusted) continue;
        if (dateKey(adjusted) !== dateKey(candidate)) {
          adjustmentReason = adjustmentReason
            || "Data ajustada para o último dia útil permitido do mês.";
        }
        candidate = atOriginalTime(adjusted, firstStartTime);
      }

      if (candidate < firstStartTime) continue;
      if (limit.until && candidate > limit.until) return candidates;
      candidates.push({ date: candidate, adjustmentReason });
      if (candidates.length >= limit.count) return candidates;
    }

    if (limit.until && monthStart > limit.until) break;
    if (monthOffset > 2400) break;
  }

  return candidates;
};

const buildDailyCandidates = (
  firstStartTime: Date,
  rule: AdvancedRecurrenceRule,
  limit: ReturnType<typeof terminationLimit>,
) => {
  const interval = normalizePositiveInteger(rule.interval, 1);
  const weekDays = new Set(
    (rule.weekDays?.length ? rule.weekDays : [firstStartTime.getDay()])
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
  );
  const candidates: Array<{ date: Date; adjustmentReason: string | null }> = [];

  for (let offset = 0; candidates.length < limit.count; offset += 1) {
    const candidate = atOriginalTime(addDays(firstStartTime, offset), firstStartTime);
    if (limit.until && candidate > limit.until) break;

    const eligible = rule.kind === "interval"
      ? offset % interval === 0
      : weekDays.has(candidate.getDay()) && Math.floor(offset / 7) % interval === 0;

    if (eligible) candidates.push({ date: candidate, adjustmentReason: null });
    if (offset > 36600) break;
  }

  return candidates;
};

const buildCustomDateCandidates = (
  firstStartTime: Date,
  rule: AdvancedRecurrenceRule,
  limit: ReturnType<typeof terminationLimit>,
) => [...new Set(rule.customDates || [])]
  .map((value) => atOriginalTime(new Date(`${value}T12:00:00`), firstStartTime))
  .filter((date) => !Number.isNaN(date.getTime()) && date >= firstStartTime)
  .filter((date) => !limit.until || date <= limit.until)
  .sort((left, right) => left.getTime() - right.getTime())
  .slice(0, limit.count)
  .map((date) => ({ date, adjustmentReason: null as string | null }));

const buildDistributedCandidates = (
  firstStartTime: Date,
  rule: AdvancedRecurrenceRule,
  limit: ReturnType<typeof terminationLimit>,
) => {
  if (rule.termination.kind !== "count" || !rule.customDates?.[0]) {
    throw new Error("A distribuição em intervalo exige quantidade e data final.");
  }

  const until = new Date(`${rule.customDates[0]}T23:59:59.999`);
  if (Number.isNaN(until.getTime()) || until < firstStartTime) {
    throw new Error("A data final precisa ser igual ou posterior à primeira sessão.");
  }

  const count = limit.count;
  if (count === 1) return [{ date: firstStartTime, adjustmentReason: null }];
  const totalDays = differenceInCalendarDays(until, firstStartTime);
  if (totalDays < count - 1) {
    throw new Error("O intervalo não comporta a quantidade de sessões sem repetir datas.");
  }

  return Array.from({ length: count }, (_, index) => {
    const offset = Math.round((totalDays * index) / (count - 1));
    return {
      date: atOriginalTime(addDays(firstStartTime, offset), firstStartTime),
      adjustmentReason: index > 0 && index < count - 1
        ? "Data distribuída proporcionalmente dentro do intervalo."
        : null,
    };
  });
};

export function generateAgendaOccurrences({
  firstStartTime,
  durationMinutes,
  rule,
  overrides = [],
  excludedOccurrenceNumbers = [],
  workingWeekDays = [1, 2, 3, 4, 5],
  blockedDates = [],
  now = new Date(),
}: GenerateAgendaOccurrencesInput): GeneratedAgendaOccurrence[] {
  if (Number.isNaN(firstStartTime.getTime())) throw new Error("A primeira sessão é inválida.");
  if (!Number.isInteger(durationMinutes) || durationMinutes < 15) {
    throw new Error("A duração mínima da sessão é de 15 minutos.");
  }

  const limit = terminationLimit(rule, firstStartTime, now);
  const allowedDays = new Set(workingWeekDays);
  const blocked = new Set(blockedDates);
  const candidates = rule.kind === "monthly"
    ? buildMonthlyCandidates(firstStartTime, rule, limit, allowedDays, blocked)
    : rule.kind === "custom_dates"
      ? buildCustomDateCandidates(firstStartTime, rule, limit)
      : rule.kind === "range_distribution"
        ? buildDistributedCandidates(firstStartTime, rule, limit)
        : buildDailyCandidates(firstStartTime, rule, limit);

  const overridesByOccurrence = new Map(
    overrides.map((override) => [override.occurrenceNumber, override]),
  );

  const generated: GeneratedAgendaOccurrence[] = candidates.map(({ date, adjustmentReason }, index) => {
    const occurrenceNumber = index + 1;
    const override = overridesByOccurrence.get(occurrenceNumber);
    const changedFields: string[] = [];
    let start = new Date(date);
    let nextDuration = durationMinutes;

    if (override?.date) {
      const nextDate = new Date(`${override.date}T12:00:00`);
      if (!Number.isNaN(nextDate.getTime())) {
        start = atOriginalTime(nextDate, start);
        changedFields.push("date");
      }
    }
    if (override?.startTime && validTime(override.startTime)) {
      start = atTime(start, override.startTime);
      changedFields.push("startTime");
    }
    if (override?.durationMinutes && override.durationMinutes >= 15) {
      nextDuration = override.durationMinutes;
      changedFields.push("durationMinutes");
    }
    if (override?.modality) changedFields.push("modality");
    if (override && "location" in override) changedFields.push("location");

    return {
      occurrenceNumber,
      startTime: start.toISOString(),
      endTime: new Date(start.getTime() + nextDuration * 60_000).toISOString(),
      durationMinutes: nextDuration,
      status: changedFields.length
        ? "customized"
        : adjustmentReason
          ? "adjusted"
          : "standard",
      changedFields,
      adjustmentReason,
      overrideReason: override?.reason || null,
    };
  });

  const excluded = new Set(
    excludedOccurrenceNumbers.filter(
      (occurrenceNumber) => Number.isInteger(occurrenceNumber) && occurrenceNumber > 0,
    ),
  );

  return generated
    .filter((occurrence) => !excluded.has(occurrence.occurrenceNumber))
    .map((occurrence, index) => ({
      ...occurrence,
      originalOccurrenceNumber: occurrence.occurrenceNumber,
      occurrenceNumber: index + 1,
    }));
}

export function rankSmartFitCandidates(
  original: SmartFitCandidate,
  candidates: SmartFitCandidate[],
) {
  const originalStart = new Date(original.startTime);
  return [...candidates].sort((left, right) => {
    const compare = (candidate: SmartFitCandidate) => [
      candidate.durationMinutes === original.durationMinutes ? 0 : 1,
      dateKey(new Date(candidate.startTime)) === dateKey(originalStart) ? 0 : 1,
      new Date(candidate.startTime).getDay() === originalStart.getDay() ? 0 : 1,
      Math.abs(new Date(candidate.startTime).getTime() - originalStart.getTime()),
      candidate.modality === original.modality ? 0 : 1,
      candidate.location === original.location ? 0 : 1,
      new Date(candidate.startTime).getTime(),
    ];
    const leftScore = compare(left);
    const rightScore = compare(right);
    for (let index = 0; index < leftScore.length; index += 1) {
      if (leftScore[index] !== rightScore[index]) {
        return Number(leftScore[index]) - Number(rightScore[index]);
      }
    }
    return 0;
  });
}

export const recurrenceRuleSummary = (rule: AdvancedRecurrenceRule) => {
  if (rule.kind === "monthly") return `Mensal · dias ${(rule.monthDays || []).join(", ")}`;
  if (rule.kind === "weekly") return `Semanal · ${(rule.weekDays || []).length || 1} dia(s)`;
  if (rule.kind === "interval") return `A cada ${normalizePositiveInteger(rule.interval, 1)} dia(s)`;
  if (rule.kind === "custom_dates") return `${rule.customDates?.length || 0} datas específicas`;
  return "Distribuída no intervalo";
};

export const createAgendaRecurrenceDraft = (date = new Date()): AgendaRecurrenceDraft => ({
  kind: "weekly",
  interval: 1,
  weekDays: [date.getDay()],
  monthDays: [date.getDate()],
  customDates: [],
  terminationKind: "count",
  count: 4,
  untilDate: "",
  distributeUntilDate: "",
  customizeOccurrences: false,
  overrides: [],
  excludedOccurrenceNumbers: [],
});

export function agendaRecurrenceDraftToRule(
  draft: AgendaRecurrenceDraft,
): AdvancedRecurrenceRule {
  const termination: RecurrenceTermination = draft.terminationKind === "count"
    ? { kind: "count", count: Math.max(2, draft.count) }
    : draft.terminationKind === "until"
      ? { kind: "until", untilDate: draft.untilDate }
      : { kind: "open", horizonDays: 90 };

  return {
    kind: draft.kind,
    interval: Math.max(1, draft.interval),
    weekDays: draft.kind === "weekly" ? draft.weekDays : undefined,
    monthDays: draft.kind === "monthly" ? draft.monthDays : undefined,
    customDates: draft.kind === "range_distribution"
      ? [draft.distributeUntilDate]
      : draft.kind === "custom_dates"
        ? draft.customDates
        : undefined,
    termination,
    missingMonthDay: "last_business_day",
  };
}

export function agendaRuleToRecurrenceDraft(
  rule: AdvancedRecurrenceRule,
  fallbackDate = new Date(),
): AgendaRecurrenceDraft {
  const fallback = createAgendaRecurrenceDraft(fallbackDate);
  return {
    ...fallback,
    kind: rule.kind,
    interval: Math.max(1, rule.interval || 1),
    weekDays: rule.weekDays?.length ? [...rule.weekDays] : fallback.weekDays,
    monthDays: rule.monthDays?.length ? [...rule.monthDays] : fallback.monthDays,
    customDates: rule.kind === "range_distribution" ? [] : [...(rule.customDates || [])],
    terminationKind: rule.termination.kind,
    count: rule.termination.kind === "count" ? Math.max(2, rule.termination.count) : fallback.count,
    untilDate: rule.termination.kind === "until" ? rule.termination.untilDate : "",
    distributeUntilDate: rule.kind === "range_distribution" ? rule.customDates?.[0] || "" : "",
    customizeOccurrences: false,
    overrides: [],
    excludedOccurrenceNumbers: [],
  };
}

export const localDateFromIso = (value: string) => startOfDay(new Date(value));
