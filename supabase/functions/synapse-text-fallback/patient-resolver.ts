import { SynapseOperationalError } from "../_shared/synapse-errors.ts";

export interface PatientCandidate {
  id: string;
  name: string;
  social_name?: string | null;
  status?: string | null;
  diagnosis?: string | null;
  last_session?: string | null;
  next_session?: string | null;
  email?: string | null;
  phone?: string | null;
  cpf?: string | null;
}

export type PatientResolution =
  | { status: "resolved"; patient: PatientCandidate; candidates: PatientCandidate[] }
  | { status: "ambiguous"; candidates: PatientCandidate[] }
  | { status: "not_found"; candidates: PatientCandidate[] };

const baseNormalize = (value: unknown) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const LETTER_WORDS: Record<string, string> = {
  a: "a", be: "b", b: "b", ce: "c", c: "c", de: "d", d: "d", e: "e",
  efe: "f", f: "f", ge: "g", g: "g", aga: "h", h: "h", i: "i", jota: "j",
  j: "j", ca: "k", ka: "k", k: "k", ele: "l", l: "l", eme: "m", m: "m",
  ene: "n", n: "n", o: "o", pe: "p", p: "p", que: "q", q: "q", erre: "r",
  r: "r", esse: "s", s: "s", te: "t", t: "t", u: "u", ve: "v", v: "v",
  dablio: "w", w: "w", xis: "x", x: "x", ipsilon: "y", y: "y", ze: "z", z: "z",
};

const SPELL_BOUNDARIES = new Set(["espaco", "space"]);

const extractSpelledName = (value: unknown) => {
  const tokens = baseNormalize(value).split(" ").filter(Boolean);
  let best: string[] = [];
  let segments: string[] = [];
  let current = "";
  let letterCount = 0;

  const finishRun = () => {
    if (current) segments.push(current);
    if (letterCount >= 4 && segments.join("").length > best.join("").length) {
      best = [...segments];
    }
    segments = [];
    current = "";
    letterCount = 0;
  };

  for (const token of tokens) {
    if (SPELL_BOUNDARIES.has(token)) {
      if (current) segments.push(current);
      current = "";
      continue;
    }
    const letter = LETTER_WORDS[token];
    if (!letter) {
      finishRun();
      continue;
    }
    current += letter;
    letterCount += 1;
  }
  finishRun();
  return best.length ? best.join(" ") : "";
};

const normalizeSpelledName = (value: unknown) => {
  const normalized = baseNormalize(value);
  const embeddedSpelling = extractSpelledName(value);
  if (embeddedSpelling) return embeddedSpelling;
  const tokens = normalized.split(" ").filter(Boolean);
  const letterCount = tokens.filter((token) => LETTER_WORDS[token]).length;
  const meaningfulCount = tokens.filter((token) => !SPELL_BOUNDARIES.has(token)).length;
  if (letterCount < 4 || letterCount / Math.max(meaningfulCount, 1) < 0.8) return normalized;

  const segments: string[] = [];
  let current = "";
  for (const token of tokens) {
    if (SPELL_BOUNDARIES.has(token)) {
      if (current) segments.push(current);
      current = "";
      continue;
    }
    const letter = LETTER_WORDS[token];
    if (!letter) return normalized;
    current += letter;
  }
  if (current) segments.push(current);
  return segments.join(" ");
};

export const normalizePatientName = (value: unknown) => normalizeSpelledName(value)
  .replace(/^(?:(?:a|o)\s+)?paciente\s+/, "")
  .replace(/^nome\s+(?:da|do)\s+paciente\s+/, "")
  .replace(/\s+por\s+favor$/, "")
  .trim();

const phonetic = (value: string) => value
  .replace(/th/g, "t")
  .replace(/ph/g, "f")
  .replace(/y/g, "i")
  .replace(/w/g, "v")
  .replace(/h/g, "")
  .replace(/ck/g, "k")
  .replace(/qu/g, "k");

const compact = (value: string) => value.replace(/\s+/g, "");

const editDistance = (left: string, right: string) => {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i++) matrix[i][0] = i;
  for (let j = 0; j < cols; j++) matrix[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[left.length][right.length];
};

const similarity = (left: string, right: string) => {
  if (!left || !right) return 0;
  const distance = editDistance(left, right);
  return 1 - distance / Math.max(left.length, right.length, 1);
};

const tokenSimilarity = (queryToken: string, targetToken: string) => {
  if (queryToken === targetToken) return 1;
  if (phonetic(queryToken) === phonetic(targetToken)) return 0.98;
  if (queryToken.length >= 3 && targetToken.length >= 3 && (
    targetToken.startsWith(queryToken) || queryToken.startsWith(targetToken)
  )) return 0.94;
  return Math.max(similarity(queryToken, targetToken), similarity(phonetic(queryToken), phonetic(targetToken)));
};

const scoreNormalizedPatientName = (query: string, target: string) => {
  if (!query || !target) return 0;
  if (target === query) return 100;
  if (compact(target) === compact(query)) return 100;

  const queryPhonetic = phonetic(query);
  const targetPhonetic = phonetic(target);
  if (compact(targetPhonetic) === compact(queryPhonetic)) return 98;
  if (target.startsWith(`${query} `) || query.startsWith(`${target} `)) return 96;
  if (targetPhonetic.startsWith(`${queryPhonetic} `) || queryPhonetic.startsWith(`${targetPhonetic} `)) return 94;
  if (target.includes(query) || query.includes(target)) return 91;

  const queryTokens = query.split(" ").filter(Boolean);
  const targetTokens = target.split(" ").filter(Boolean);
  const tokenScores = queryTokens.map((queryToken) =>
    Math.max(...targetTokens.map((targetToken) => tokenSimilarity(queryToken, targetToken))),
  );
  const weakestToken = Math.min(...tokenScores);
  const averageToken = tokenScores.reduce((sum, score) => sum + score, 0) / Math.max(tokenScores.length, 1);
  if (weakestToken >= 0.92) return Math.round(82 + averageToken * 12);
  if (weakestToken >= 0.78) return Math.round(averageToken * 100);
  return Math.round(Math.max(similarity(query, target), similarity(queryPhonetic, targetPhonetic)) * 82);
};

export const scorePatientCandidate = (queryValue: unknown, candidate: PatientCandidate) => {
  const query = normalizePatientName(queryValue);
  const targets = [candidate.name, candidate.social_name]
    .map(normalizePatientName)
    .filter(Boolean);
  return Math.max(0, ...targets.map((target) => scoreNormalizedPatientName(query, target)));
};

export interface RankedPatientCandidate {
  patient: PatientCandidate;
  score: number;
}

export const rankPatientCandidates = (
  patientName: unknown,
  candidates: PatientCandidate[],
): RankedPatientCandidate[] => candidates
  .map((patient) => ({ patient, score: scorePatientCandidate(patientName, patient) }))
  .filter((item) => item.score >= 55)
  .sort((left, right) => right.score - left.score || left.patient.name.localeCompare(right.patient.name, "pt-BR"));

export function resolvePatientCandidates(
  patientName: unknown,
  candidates: PatientCandidate[],
  options: { preferredPatientId?: string | null } = {},
): PatientResolution {
  const ranked = rankPatientCandidates(patientName, candidates);
  if (!ranked.length || ranked[0].score < 65) return { status: "not_found", candidates: [] };

  const best = ranked[0];
  const second = ranked[1];
  const preferred = options.preferredPatientId
    ? ranked.find((item) => item.patient.id === options.preferredPatientId)
    : undefined;
  if (preferred && preferred.score >= 86 && best.score - preferred.score <= 5) {
    return {
      status: "resolved",
      patient: preferred.patient,
      candidates: ranked.slice(0, 5).map((item) => item.patient),
    };
  }

  const margin = second ? best.score - second.score : Number.POSITIVE_INFINITY;
  if ((best.score >= 94 && margin >= 7) || (best.score >= 88 && margin >= 10)) {
    return {
      status: "resolved",
      patient: best.patient,
      candidates: ranked.slice(0, 5).map((item) => item.patient),
    };
  }

  const plausible = ranked.filter((item) => item.score >= Math.max(78, best.score - 7));
  if (plausible.length === 1 && best.score >= 88) {
    return { status: "resolved", patient: best.patient, candidates: [best.patient] };
  }
  return { status: "ambiguous", candidates: plausible.slice(0, 5).map((item) => item.patient) };
}

export async function resolvePatientByName(
  admin: any,
  userId: string,
  patientName: unknown,
  options: {
    preferredPatientId?: string | null;
    searchClient?: any;
  } = {},
): Promise<PatientResolution> {
  const query = normalizePatientName(patientName);
  if (!query) return { status: "not_found", candidates: [] };

  let candidateIds: string[] | null = null;
  if (options.searchClient) {
    const { data: searchRows, error: searchError } = await options.searchClient.rpc(
      "search_synapse_workspace",
      {
        p_query: query,
        p_entity_types: ["patient"],
        p_limit: 20,
      },
    );
    if (searchError) {
      throw new SynapseOperationalError(
        "resolver_query_failed",
        "Não consegui consultar o diretório de pacientes com segurança.",
        { providerCode: searchError.code || undefined },
      );
    }
    candidateIds = Array.from(new Set(
      (searchRows || [])
        .map((row: any) => String(row?.entity_id || "").trim())
        .filter(Boolean),
    ));
    if (!candidateIds.length) return { status: "not_found", candidates: [] };
  }

  let patientQuery = admin
    .from("patients")
    .select("id,name,social_name,status,diagnosis,last_session,next_session,email,phone,cpf")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (candidateIds) patientQuery = patientQuery.in("id", candidateIds);

  const { data, error } = await patientQuery;

  if (error) {
    throw new SynapseOperationalError(
      "resolver_query_failed",
      "Não consegui consultar o diretório de pacientes com segurança.",
      { providerCode: error.code || undefined },
    );
  }

  return resolvePatientCandidates(query, (data || []) as PatientCandidate[], options);
}

export function formatPatientAmbiguity(candidates: PatientCandidate[]) {
  const options = candidates.map((patient, index) => {
    const details = [
      patient.status ? `status ${patient.status}` : null,
      patient.diagnosis || null,
      patient.next_session ? `próxima consulta ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(patient.next_session))}` : null,
    ].filter(Boolean);
    return `${index + 1}. ${patient.name}${details.length ? ` — ${details.join("; ")}` : ""}`;
  });

  return `Encontrei mais de um paciente possível. Qual deles você quis dizer?\n\n${options.join("\n")}`;
}
