import { updateContextFromResult } from "./entity-context.ts";
import {
  normalizePatientName,
  resolvePatientCandidates,
  type PatientCandidate,
} from "./patient-resolver.ts";

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

Deno.test("uma busca com resultado único atualiza o paciente canônico da conversa", () => {
  const state = updateContextFromResult({}, "search_patients", { query: "Natalia" }, {
    data: { patients: [patients[0]] },
  });
  equal(state.activePatientId, "patient-nathalia", "id persistido");
  equal(state.activePatientName, "Nathalia Gasperi", "nome canônico persistido");
});
