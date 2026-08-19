import { updateContextFromResult } from "./entity-context.ts";
import {
  normalizePatientName,
  resolvePatientByName,
  resolvePatientCandidates,
  scorePatientCandidate,
  type PatientCandidate,
} from "./patient-resolver.ts";
import { normalizeSynapseError } from "../_shared/synapse-errors.ts";

const equal = (actual: unknown, expected: unknown, label: string) => {
  if (actual !== expected) throw new Error(`${label}: esperado ${expected}, recebido ${actual}`);
};

const patients: PatientCandidate[] = [
  { id: "patient-nathalia", name: "Nathalia Gasperi", status: "active" },
  { id: "patient-carlos", name: "Carlos Mendes", status: "active" },
  { id: "patient-joao", name: "João Ferreira", status: "active" },
  { id: "patient-maria", name: "Maria Silva", status: "active" },
];

Deno.test("resolve primeiro nome com grafia fonética para o único cadastro plausível", () => {
  const resolution = resolvePatientCandidates("Natalia", patients);
  equal(resolution.status, "resolved", "status");
  if (resolution.status === "resolved") equal(resolution.patient.name, "Nathalia Gasperi", "paciente");
});

Deno.test("resolve nome sem acento e nome completo soletrado", () => {
  const joao = resolvePatientCandidates("Joao", patients);
  equal(joao.status, "resolved", "João sem acento");
  if (joao.status === "resolved") equal(joao.patient.name, "João Ferreira", "paciente João");

  const spelled = "ene a te aga a ele i a espaco ge a esse pe e erre i";
  equal(normalizePatientName(spelled), "nathalia gasperi", "normalização soletrada");
  const nathalia = resolvePatientCandidates(spelled, patients);
  equal(nathalia.status, "resolved", "nome soletrado");
  if (nathalia.status === "resolved") equal(nathalia.patient.name, "Nathalia Gasperi", "paciente soletrada");
});

Deno.test("remove expressão paciente, aceita prefixo e soletra dentro de uma frase", () => {
  const prefix = resolvePatientCandidates("paciente nath", patients);
  equal(prefix.status, "resolved", "prefixo com expressão");
  const phrase = "Synapse, vou soletrar para você: ene a te aga a ele i a espaço ge a esse pe e erre i";
  equal(normalizePatientName(phrase), "nathalia gasperi", "soletração embutida");
  equal(resolvePatientCandidates(phrase, patients).status, "resolved", "frase soletrada");
});

Deno.test("nome social participa do ranking", () => {
  const candidates = [{ id: "patient-social", name: "Ana Pereira", social_name: "Nathália Pereira" }];
  const result = resolvePatientCandidates("natalia", candidates);
  equal(result.status, "resolved", "nome social");
});

Deno.test("pede esclarecimento entre homônimas e usa o contexto durável para desempatar", () => {
  const homonyms = [
    ...patients,
    { id: "patient-nathalia-2", name: "Nathalia Souza", status: "active" },
  ];
  equal(resolvePatientCandidates("Nathalia", homonyms).status, "ambiguous", "homônimas");
  const preferred = resolvePatientCandidates("Natalia", homonyms, { preferredPatientId: "patient-nathalia" });
  equal(preferred.status, "resolved", "desempate contextual");
  if (preferred.status === "resolved") equal(preferred.patient.id, "patient-nathalia", "paciente contextual");

  const explicitOther = resolvePatientCandidates("Maria", homonyms, { preferredPatientId: "patient-nathalia" });
  equal(explicitOther.status, "resolved", "troca explícita de paciente");
  if (explicitOther.status === "resolved") equal(explicitOther.patient.id, "patient-maria", "nova paciente");
});

Deno.test("José ouvido para Josué produz candidato seguro ou uma única clarificação, nunca not_found", () => {
  const josue: PatientCandidate = { id: "patient-josue", name: "Josué Silveira", status: "active" };
  const score = scorePatientCandidate("José Silveira", josue);
  if (score < 65) throw new Error(`similaridade fonética insuficiente para José/Josué: ${score}`);
  const resolution = resolvePatientCandidates("José Silveira", [josue]);
  if (resolution.status === "not_found") throw new Error("José/Josué não pode virar patient_not_found com candidato plausível único.");
  if (resolution.status === "resolved") equal(resolution.patient.id, josue.id, "paciente fonético");
  if (resolution.status === "ambiguous") equal(resolution.candidates[0]?.id, josue.id, "candidato para clarificação");
});

Deno.test("uma busca com resultado único atualiza o paciente canônico da conversa", () => {
  const state = updateContextFromResult({}, "search_patients", { query: "Natalia" }, {
    data: { patients: [patients[0]] },
  });
  equal(state.activePatientId, "patient-nathalia", "id persistido");
  equal(state.activePatientName, "Nathalia Gasperi", "nome canônico persistido");
});

Deno.test("consulta somente colunas reais de patients e ordena por created_at", async () => {
  let selected = "";
  let ordered = "";
  const rows = [{ id: "patient-nathalia", name: "Nathalia Gasperi" }];
  const chain: any = {
    select(value: string) { selected = value; return this; },
    eq() { return this; },
    order(value: string) { ordered = value; return this; },
    limit() { return Promise.resolve({ data: rows, error: null }); },
  };
  const admin = { from: () => chain };
  const result = await resolvePatientByName(admin, "user-1", "Nathalia");
  equal(result.status, "resolved", "resultado");
  equal(selected.includes("updated_at"), false, "não consulta coluna inexistente");
  equal(ordered, "created_at", "ordenação válida");
});

Deno.test("normaliza erro PostgREST representado como objeto simples", () => {
  const normalized = normalizeSynapseError({ code: "42703", message: "column patients.updated_at does not exist" }, "resolver_query_failed");
  equal(normalized.code, "resolver_query_failed", "código operacional");
  equal(normalized.details.providerCode, "42703", "código PostgREST");
});