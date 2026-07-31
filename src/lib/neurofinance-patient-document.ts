export const PATIENT_DOCUMENT_REQUIRED_CODE = "PATIENT_DOCUMENT_REQUIRED";

type PatientDocumentSource = {
  id?: string | null;
  cpf?: string | null;
};

export const normalizePatientDocument = (value?: string | null) =>
  String(value || "").replace(/\D/g, "");

export const hasNeurofinancePatientDocument = (
  patient?: PatientDocumentSource | null,
) => {
  const document = normalizePatientDocument(patient?.cpf);
  return document.length === 11 && !/^0+$/.test(document);
};

export const patientRegistrationPath = (
  patient?: PatientDocumentSource | null,
) => patient?.id ? `/pacientes/${patient.id}` : "/pacientes";

