import { supabase } from "@/integrations/supabase/client";
import { getSignedR2Upload } from "@/lib/r2-upload-signing";

export type DocumentCategory =
  | "general"
  | "patient_attachment"
  | "anamnesis_import"
  | "session_document"
  | "financial"
  | "other";

export interface DocumentFile {
  id: string;
  patient_id: string | null;
  category: DocumentCategory;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  status: "pending_upload" | "ready" | "failed" | "deleted";
  metadata: Record<string, unknown>;
  uploaded_at: string | null;
  created_at: string;
}

export interface UploadDocumentToR2Input {
  file: File;
  patientId?: string | null;
  category?: DocumentCategory;
  metadata?: Record<string, unknown>;
}

export interface DownloadR2DocumentInput {
  documentId: string;
  disposition?: "inline" | "attachment";
}

interface ConfirmUploadResponse {
  document: DocumentFile;
}

interface DownloadResponse {
  downloadUrl: string;
  expiresIn: number;
}

export const MAX_R2_DOCUMENT_BYTES = 20 * 1024 * 1024;

export const ALLOWED_R2_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/rtf",
  "text/plain",
  "text/csv",
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  pdf: "application/pdf",
  png: "image/png",
  rtf: "application/rtf",
  txt: "text/plain",
  webp: "image/webp",
};

export function inferAllowedR2MimeType(name: string, fallback?: string | null) {
  const normalizedFallback = String(fallback || "").trim();
  if (ALLOWED_R2_DOCUMENT_TYPES.has(normalizedFallback)) return normalizedFallback;
  const extension = name.split(".").pop()?.toLowerCase() || "";
  return MIME_BY_EXTENSION[extension] || normalizedFallback || "application/octet-stream";
}

export function withAllowedR2MimeType(file: File) {
  const mimeType = inferAllowedR2MimeType(file.name, file.type);
  if (mimeType === file.type) return file;
  return new File([file], file.name, { type: mimeType, lastModified: file.lastModified });
}

const throwFunctionError = (error: unknown, fallback: string): never => {
  if (error instanceof Error && error.message) throw error;
  throw new Error(fallback);
};

async function markR2UploadFailed(documentId: string, reason: string) {
  try {
    await supabase.functions.invoke("r2-create-upload-url", {
      body: { action: "mark-upload-failed", documentId, reason },
    });
  } catch (error) {
    console.warn("Nao foi possivel marcar upload R2 como falho.", error);
  }
}

export async function uploadDocumentToR2({
  file,
  patientId,
  category = "general",
  metadata = {},
}: UploadDocumentToR2Input): Promise<DocumentFile> {
  const safeFile = withAllowedR2MimeType(file);

  if (!ALLOWED_R2_DOCUMENT_TYPES.has(safeFile.type)) {
    throw new Error("Este tipo de arquivo ainda nao e permitido.");
  }
  if (safeFile.size <= 0 || safeFile.size > MAX_R2_DOCUMENT_BYTES) {
    throw new Error("O arquivo deve ter no maximo 20 MB.");
  }

  const signed = await getSignedR2Upload(safeFile, {
    patientId: patientId ?? null,
    category,
    metadata,
  });
  const prepared = signed.document as DocumentFile;

  const uploadResponse = await fetch(signed.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": safeFile.type },
    body: safeFile,
  });

  if (!uploadResponse.ok) {
    await markR2UploadFailed(prepared.id, "r2_put_failed");
    throw new Error("O armazenamento recusou o arquivo. Verifique a politica CORS do bucket R2.");
  }

  const { data: confirmed, error: confirmError } = await supabase.functions.invoke<ConfirmUploadResponse>(
    "r2-create-upload-url",
    { body: { action: "confirm-upload", documentId: prepared.id } },
  );

  if (confirmError || !confirmed?.document) {
    await markR2UploadFailed(prepared.id, "confirm_upload_failed");
    throwFunctionError(confirmError, "Nao foi possivel confirmar o upload.");
    throw new Error("Nao foi possivel confirmar o upload.");
  }

  return confirmed.document;
}

export async function getR2DocumentDownloadUrl({
  documentId,
  disposition = "inline",
}: DownloadR2DocumentInput) {
  const { data, error } = await supabase.functions.invoke<DownloadResponse>("r2-create-upload-url", {
    body: { action: "create-download-url", documentId, disposition },
  });

  if (error || !data?.downloadUrl) {
    throwFunctionError(error, "Nao foi possivel gerar o link seguro do documento.");
    throw new Error("Nao foi possivel gerar o link seguro do documento.");
  }

  return data.downloadUrl;
}

export async function deleteR2Document(documentId: string) {
  const { error } = await supabase.functions.invoke("r2-create-upload-url", {
    body: { action: "delete-document", documentId },
  });

  if (error) throwFunctionError(error, "Nao foi possivel excluir o documento.");
  return true;
}
