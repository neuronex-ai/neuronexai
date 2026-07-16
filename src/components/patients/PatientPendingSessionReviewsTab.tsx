import { useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNowStrict, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  Pencil,
  Save,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useConfirmSessionReview,
  usePendingSessionReviews,
  useUpdatePendingSessionReview,
} from "@/hooks/use-session-notes";
import { cn } from "@/lib/utils";
import type { AISummary, SessionNote } from "@/types";
import { PatientStatusIcon } from "@/components/patients/PatientStatusIcon";
import { SessionAppointmentSource } from "@/components/patients/SessionAppointmentSource";

interface PatientPendingSessionReviewsTabProps {
  patientId: string;
}

const sentimentOptions = [
  "Neutro",
  "Estável",
  "Positivo",
  "Ansioso",
  "Depressivo",
  "Negativo",
];

const normalizeSummary = (note: SessionNote): AISummary => ({
  sentiment: note.ai_summary?.sentiment || "Neutro",
  summary: note.ai_summary?.summary || note.notes || "",
  topics: note.ai_summary?.topics || [],
  next_steps: note.ai_summary?.next_steps || [],
  emotional_analysis: note.ai_summary?.emotional_analysis,
});

const PendingReviewCard = ({ note, patientId }: { note: SessionNote; patientId: string }) => {
  const confirmReview = useConfirmSessionReview(patientId);
  const updateReview = useUpdatePendingSessionReview(patientId);
  const initialSummary = useMemo(() => normalizeSummary(note), [note]);
  const [isEditing, setIsEditing] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [draft, setDraft] = useState<AISummary>(initialSummary);

  useEffect(() => {
    setDraft(initialSummary);
  }, [initialSummary]);

  const dueAt = note.review_due_at ? new Date(note.review_due_at) : null;
  const expired = dueAt ? isPast(dueAt) : false;
  const dueLabel = dueAt
    ? formatDistanceToNowStrict(dueAt, { addSuffix: true, locale: ptBR })
    : "em até 48h";
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(initialSummary);
  const isBusy = confirmReview.isPending || updateReview.isPending;

  const handleCancelEdit = () => {
    setDraft(initialSummary);
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    updateReview.mutate(
      { note, summary: draft },
      { onSuccess: () => setIsEditing(false) },
    );
  };

  return (
    <article className="patient-record-card space-y-5 rounded-[28px] border p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.15em]",
                expired
                  ? "border-rose-500/20 bg-rose-500/10 text-rose-500"
                  : "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300",
              )}
            >
              {expired ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
              {expired ? "Prazo vencido" : `Pendente ${dueLabel}`}
            </span>
            <span className="rounded-full border border-border/45 bg-background/70 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground dark:border-zinc-800">
              {format(new Date(note.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
            {note.ai_summary_edited ? (
              <PatientStatusIcon
                icon={Pencil}
                tone="blue"
                label="Este resumo gerado pela NeuroNex AI foi editado pelo profissional; a versão original foi preservada."
              />
            ) : null}
          </div>
          <div className="mt-3">
            <SessionAppointmentSource appointmentId={note.appointment_id} />
          </div>
          <h3 className="mt-4 text-xl font-black tracking-[-0.035em] text-foreground">
            Resumo de sessão aguardando confirmação
          </h3>
          {expired ? (
            <p className="mt-2 max-w-2xl text-xs font-semibold leading-relaxed text-muted-foreground">
              O prazo de revisão terminou. Este resumo não pode mais ser editado e será confirmado automaticamente pelo sistema.
            </p>
          ) : (
            <p className="mt-2 max-w-2xl text-xs font-semibold leading-relaxed text-muted-foreground">
              Você pode editar este resumo até o fim da janela de 48h. A versão original gerada pela NeuroNex AI será preservada.
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
          {isEditing ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={isBusy}
                onClick={handleCancelEdit}
                className="h-11 rounded-2xl border-border/50 px-4 text-[10px] font-black uppercase tracking-[0.14em] dark:border-zinc-800"
              >
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={isBusy || expired || !hasChanges}
                onClick={handleSaveEdit}
                className="h-11 rounded-2xl bg-foreground px-4 text-[10px] font-black uppercase tracking-[0.14em] text-background"
              >
                {updateReview.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar edição
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={isBusy || expired}
              onClick={() => setIsEditing(true)}
              className="h-11 rounded-2xl border-border/50 px-4 text-[10px] font-black uppercase tracking-[0.14em] dark:border-zinc-800"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Button>
          )}
          <Button
            type="button"
            disabled={isBusy}
            onClick={() => confirmReview.mutate(note.id)}
            className="h-11 rounded-2xl bg-foreground px-5 text-[10px] font-black uppercase tracking-[0.14em] text-background"
          >
            {confirmReview.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Confirmar resumo
          </Button>
        </div>
      </div>

      <div className="rounded-[22px] border border-border/40 bg-background/60 p-4 dark:border-zinc-800">
        <div className="mb-4 max-w-sm space-y-1">
          <span className="text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">
            Emoção predominante do paciente
          </span>
          {isEditing ? (
            <Select
              value={draft.sentiment}
              disabled={expired || updateReview.isPending}
              onValueChange={(value) => setDraft((current) => ({ ...current, sentiment: value }))}
            >
              <SelectTrigger className="h-10 rounded-2xl border-border/45 bg-background/75 text-xs font-bold dark:border-zinc-800">
                <SelectValue placeholder="Selecionar emoção" />
              </SelectTrigger>
              <SelectContent>
                {sentimentOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="inline-flex rounded-full border border-border/45 bg-background/75 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-foreground dark:border-zinc-800">
              {draft.sentiment || "Neutro"}
            </span>
          )}
        </div>

        {isEditing ? (
          <Textarea
            value={draft.summary}
            disabled={expired || updateReview.isPending}
            onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))}
            className="min-h-[220px] resize-y rounded-[20px] border-border/40 bg-background/70 text-sm leading-7 text-foreground/90 dark:border-zinc-800"
            placeholder="Resumo gerado pela IA"
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/85">
            {draft.summary || "Resumo pendente sem texto principal."}
          </p>
        )}
      </div>

      {draft.topics?.length ? (
        <div className="flex flex-wrap gap-2">
          {draft.topics.slice(0, 5).map((topic) => (
            <span
              key={topic}
              className="rounded-full border border-border/45 bg-background/70 px-3 py-1.5 text-[10px] font-bold text-muted-foreground dark:border-zinc-800"
            >
              {topic}
            </span>
          ))}
        </div>
      ) : null}

      {note.ai_summary_edited && note.original_ai_summary ? (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowOriginal((current) => !current)}
            className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline"
          >
            {showOriginal ? "Ocultar versão original da IA" : "Ver versão original da IA"}
          </button>
          {showOriginal ? (
            <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs font-medium leading-relaxed text-muted-foreground">
              <p className="mb-2 text-[9px] font-black uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">
                Registro original preservado
              </p>
              <p className="whitespace-pre-wrap">
                {note.original_ai_summary.summary || "Versão original sem texto principal."}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
};

export const PatientPendingSessionReviewsTab = ({ patientId }: PatientPendingSessionReviewsTabProps) => {
  const { data: pendingReviews, isLoading } = usePendingSessionReviews(patientId);

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!pendingReviews?.length) {
    return (
      <div className="patient-record-card rounded-[30px] border border-dashed py-20 text-center">
        <FileText className="mx-auto mb-4 h-8 w-8 text-muted-foreground/45" />
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
          Nenhuma revisão pendente
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {pendingReviews.map((note) => (
        <PendingReviewCard key={note.id} note={note} patientId={patientId} />
      ))}
    </div>
  );
};
