import { useCallback, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { NeuroNexLoadingLoop } from "@/components/ui/neuronex-loading-loop";
import { usePersonalNotes } from "@/hooks/use-personal-notes";
import {
  buildIntentFromSearchParams,
  consumePendingPwaIntent,
  listQueuedPwaIntents,
  markQueuedPwaIntentAttempt,
  queuePwaIntent,
  removeQueuedPwaIntent,
  requestPwaIntentSync,
  type PendingPwaIntent,
} from "@/lib/pwa-integrations";

export default function PwaIntent() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const handledRef = useRef(false);
  const { createNote, isCreatingNote } = usePersonalNotes();

  const createIntentNote = useCallback(async (intent: PendingPwaIntent) => {
    return createNote({
      title: intent.title || "Nova Nota",
      content: intent.content,
      module_id: null,
      reference_date: new Date().toISOString(),
      tags: ["pwa", intent.source],
      patient_id: null,
    });
  }, [createNote]);

  const shouldQueueIntent = (error: unknown) => {
    if (!navigator.onLine) return true;
    const message = error instanceof Error ? error.message : String(error || "");
    return /fetch|network|offline|internet|conex/i.test(message);
  };

  const flushQueuedIntents = useCallback(async () => {
    const queued = await listQueuedPwaIntents();
    let lastNoteId: string | null = null;

    for (const record of queued) {
      try {
        const note = await createIntentNote(record);
        await removeQueuedPwaIntent(record.id);
        if (note?.id) lastNoteId = note.id;
      } catch (error) {
        await markQueuedPwaIntentAttempt(record, error);
        if (!navigator.onLine) break;
      }
    }

    return lastNoteId;
  }, [createIntentNote]);

  const processIntent = useCallback(async () => {
    if (handledRef.current || isCreatingNote) return;
    handledRef.current = true;

    const flushedNoteId = await flushQueuedIntents();
    const pendingIntent = consumePendingPwaIntent();
    const queryIntent = buildIntentFromSearchParams(searchParams);
    const intent: PendingPwaIntent | null = pendingIntent ?? queryIntent;

    // File launches may arrive through LaunchQueue moments after the route renders.
    if (!intent && searchParams.get("mode") === "file") {
      handledRef.current = false;
      return;
    }

    if (!intent) {
      if (flushedNoteId) {
        navigate(`/notas?noteId=${encodeURIComponent(flushedNoteId)}`, { replace: true });
        return;
      }
      navigate("/notas", { replace: true });
      return;
    }

    try {
      const newNote = await createIntentNote(intent);

      if (newNote?.id) {
        navigate(`/notas?noteId=${encodeURIComponent(newNote.id)}`, { replace: true });
        return;
      }

      navigate("/notas", { replace: true });
    } catch (error) {
      console.error("[NeuroNex PWA] Failed to create note from native integration.", error);
      if (shouldQueueIntent(error)) {
        await queuePwaIntent(intent);
        await requestPwaIntentSync();
        navigate("/notas?queued=1", { replace: true });
        return;
      }
      handledRef.current = false;
      navigate("/notas", { replace: true });
    }
  }, [createIntentNote, flushQueuedIntents, isCreatingNote, navigate, searchParams]);

  useEffect(() => {
    void processIntent();

    const handleReady = () => {
      void processIntent();
    };

    window.addEventListener("neuronex:pwa-intent-ready", handleReady);
    window.addEventListener("neuronex:pwa-flush-request", handleReady);
    window.addEventListener("online", handleReady);
    return () => {
      window.removeEventListener("neuronex:pwa-intent-ready", handleReady);
      window.removeEventListener("neuronex:pwa-flush-request", handleReady);
      window.removeEventListener("online", handleReady);
    };
  }, [processIntent]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-4 text-center">
        <NeuroNexLoadingLoop surface="inline" size={96} label="Preparando sua nota" />
        <div>
          <h1 className="text-xl font-semibold">Preparando sua nota</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            O NeuroNex AI esta organizando o conteudo recebido pelo Windows.
          </p>
        </div>
      </div>
    </main>
  );
}