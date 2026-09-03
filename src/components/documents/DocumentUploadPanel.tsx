import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Eye, FileText, HardDrive, Loader2, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type DocumentCategory,
  type DocumentFile,
  useR2Documents,
} from "@/hooks/use-r2-documents";

interface DocumentUploadPanelProps {
  patientId?: string | null;
  category?: DocumentCategory;
  title?: string;
  description?: string;
  className?: string;
  onUploaded?: (documentId: string) => void;
}

const DOCUMENT_PAGE_SIZE = 8;

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

export function DocumentUploadPanel({
  patientId,
  category = "general",
  title = "Documentos",
  description = "PDF, imagens, Word ou texto. Ate 20 MB por arquivo.",
  className,
  onUploaded,
}: DocumentUploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const { documents, usage, upload, getDownloadUrl, remove } = useR2Documents(patientId);
  const totalBytes = usage.data?.totalBytes ?? 0;
  const quotaBytes = 250 * 1024 * 1024;
  const usagePercent = Math.min((totalBytes / quotaBytes) * 100, 100);
  const records = documents.data || [];
  const totalPages = Math.max(1, Math.ceil(records.length / DOCUMENT_PAGE_SIZE));
  const visibleDocuments = useMemo(
    () => records.slice((page - 1) * DOCUMENT_PAGE_SIZE, page * DOCUMENT_PAGE_SIZE),
    [page, records],
  );

  useEffect(() => {
    setPage(1);
  }, [patientId, category]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const handleFile = async (file?: File) => {
    if (!file) return;
    try {
      const document = await upload.mutateAsync({ file, patientId, category });
      setPage(1);
      toast.success("Documento enviado com seguranca.");
      onUploaded?.(document.id);
    } catch (error) {
      toast.error("Nao foi possivel enviar o documento.", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const openDocument = async (document: DocumentFile, disposition: "inline" | "attachment") => {
    try {
      const url = await getDownloadUrl.mutateAsync({ documentId: document.id, disposition });
      if (disposition === "attachment") {
        window.location.assign(url);
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error("Nao foi possivel abrir o documento.", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    }
  };

  const removeDocument = async (document: DocumentFile) => {
    const confirmed = window.confirm(`Excluir "${document.original_name}"?`);
    if (!confirmed) return;

    try {
      await remove.mutateAsync(document.id);
      toast.success("Documento removido.");
    } catch (error) {
      toast.error("Nao foi possivel remover o documento.", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    }
  };

  return (
    <section
      className={cn(
        "patient-record-panel overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white/80 shadow-sm backdrop-blur-xl dark:border-white/[0.08] dark:bg-zinc-950/70",
        className,
      )}
    >
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-black tracking-tight text-zinc-950 dark:text-white">
              {title}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              {description}
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            disabled={upload.isPending}
            onClick={() => inputRef.current?.click()}
            className="shrink-0 rounded-xl"
          >
            {upload.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="mr-2 h-4 w-4" />
            )}
            Enviar
          </Button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.rtf,.txt,.csv"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
        </div>

        <div className="desktop-retina-inset rounded-2xl border border-zinc-200/70 bg-zinc-50/80 p-4 dark:border-white/[0.06] dark:bg-white/[0.03]">
          <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-2">
              <HardDrive className="h-3.5 w-3.5" />
              NeuroDrive privado
            </span>
            <span>
              {formatBytes(totalBytes)} de {formatBytes(quotaBytes)}
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/[0.08]">
            <div
              className="h-full rounded-full bg-zinc-900 transition-[width] duration-300 dark:bg-white"
              style={{ width: `${Math.max(usagePercent, totalBytes > 0 ? 1 : 0)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-border/45 pb-3">
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground">
            {records.length} {records.length === 1 ? "arquivo" : "arquivos"}
          </p>
          {totalPages > 1 ? (
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Página {page} de {totalPages}</span>
          ) : null}
        </div>

        <div className="space-y-2">
          {documents.isLoading ? (
            <div className="flex min-h-24 items-center justify-center text-zinc-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : records.length ? (
            visibleDocuments.map((document) => {
              const isReady = document.status === "ready";
              const isBusy = getDownloadUrl.isPending || remove.isPending;

              return (
                <div
                  key={document.id}
                  className="desktop-retina-inset flex items-center gap-3 rounded-2xl border border-zinc-200/70 px-4 py-3 dark:border-white/[0.06]"
                  style={{ contentVisibility: "auto", containIntrinsicSize: "64px" }}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {document.original_name}
                    </p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                      {formatBytes(document.size_bytes)} - {isReady ? "Disponivel" : "Processando"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-xl"
                      disabled={!isReady || isBusy}
                      onClick={() => openDocument(document, "inline")}
                      title="Visualizar"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-xl"
                      disabled={!isReady || isBusy}
                      onClick={() => openDocument(document, "attachment")}
                      title="Baixar"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-xl text-zinc-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                      disabled={isBusy}
                      onClick={() => removeDocument(document)}
                      title="Excluir"
                    >
                      {remove.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex min-h-24 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 text-center dark:border-white/[0.08]">
              <FileText className="h-5 w-5 text-zinc-300 dark:text-zinc-600" />
              <p className="mt-2 text-xs text-zinc-400">Nenhum documento enviado.</p>
            </div>
          )}
        </div>

        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-border/45 pt-3">
            <Button type="button" variant="outline" className="h-10 rounded-xl px-4" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              <ChevronLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Anterior
            </Button>
            <Button type="button" variant="outline" className="h-10 rounded-xl px-4" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
              Próxima
              <ChevronRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}