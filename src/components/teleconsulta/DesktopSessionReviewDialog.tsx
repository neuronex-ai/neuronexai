import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  Loader2,
  Pencil,
  Sparkles,
  WifiOff,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { AISummary, SessionNote } from '@/types';
import { cn } from '@/lib/utils';

type CompletionMode = 'idle' | 'generating' | 'saving';

interface DesktopSessionReviewDialogProps {
  open: boolean;
  patientName: string;
  transcript: string;
  notes: string;
  segmentsCount: number;
  hasNetwork: boolean;
  canGenerate: boolean;
  isProcessing: boolean;
  completionMode: CompletionMode;
  error?: string | null;
  summaryNote?: SessionNote | null;
  onGenerate: (summary?: AISummary) => void;
  onPreserve: () => void;
}

const sentimentOptions = [
  'Neutro',
  'Estável',
  'Positivo',
  'Ansioso',
  'Depressivo',
  'Negativo',
];

const formatSummaryList = (items?: string[]) => items?.filter(Boolean).slice(0, 5) ?? [];

const normalizeSummary = (summary?: AISummary | null): AISummary => ({
  sentiment: summary?.sentiment || 'Neutro',
  summary: summary?.summary || '',
  topics: summary?.topics || [],
  next_steps: summary?.next_steps || [],
  emotional_analysis: summary?.emotional_analysis,
});

export const DesktopSessionReviewDialog = ({
  open,
  patientName,
  transcript,
  notes,
  segmentsCount,
  hasNetwork,
  canGenerate,
  isProcessing,
  completionMode,
  error,
  summaryNote,
  onGenerate,
  onPreserve,
}: DesktopSessionReviewDialogProps) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState<AISummary>(() => normalizeSummary(summaryNote?.ai_summary));
  const summary = summaryNote?.ai_summary;
  const originalDraft = useMemo(() => normalizeSummary(summary), [summary]);

  useEffect(() => {
    if (!open) return;
    setDetailsOpen(false);
  }, [open]);

  useEffect(() => {
    setSummaryDraft(normalizeSummary(summary));
  }, [summary]);

  const topics = formatSummaryList(summaryDraft.topics);
  const nextSteps = formatSummaryList(summaryDraft.next_steps);
  const dueLabel = useMemo(() => {
    if (!summaryNote?.review_due_at) return '48h';
    return formatDistanceToNowStrict(new Date(summaryNote.review_due_at), {
      addSuffix: true,
      locale: ptBR,
    });
  }, [summaryNote?.review_due_at]);
  const isGenerating = completionMode === 'generating';
  const canFinish = Boolean(summaryNote?.id) && hasNetwork && !isProcessing;
  const isEdited = JSON.stringify(summaryDraft) !== JSON.stringify(originalDraft);

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        overlayClassName="teleconsultation-overlay !backdrop-blur-none"
        showCloseButton={false}
        className={cn(
          'teleconsultation-desktop teleconsultation-surface desktop-retina-form !grid !w-[min(960px,calc(100vw-2.5rem))] !max-w-[min(960px,calc(100vw-2.5rem))] !grid-cols-none !gap-0 !overflow-hidden !rounded-[30px] !p-0',
          '!max-h-[calc(100dvh-2.5rem)] sm:!max-h-[calc(100dvh-2.5rem)] sm:!overflow-hidden sm:!rounded-[30px] sm:!p-0',
        )}
      >
        <div className="flex max-h-[calc(100dvh-2.5rem)] min-h-0 flex-col">
          <DialogHeader className="shrink-0 border-b border-border/35 px-6 py-5 text-center dark:border-white/[0.045] sm:px-8 sm:py-6">
            <div className="teleconsultation-inset mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl text-foreground/70">
              <Sparkles className="h-5 w-5" />
            </div>
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">
              Revisão profissional obrigatória
            </p>
            <DialogTitle className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
              Revisar sessão com {patientName}
            </DialogTitle>
            <DialogDescription className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed">
              Revise agora ou mantenha o resumo pendente por até 48 horas. A versão original gerada pela NeuroNex AI permanece preservada.
            </DialogDescription>
          </DialogHeader>

          <div className="teleconsultation-scroll min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
            {isGenerating ? (
              <div className="teleconsultation-inset flex min-h-[260px] flex-col items-center justify-center rounded-[24px] p-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <h3 className="mt-5 text-lg font-black tracking-[-0.03em]">Gerando resumo pendente</h3>
                <p className="mt-2 max-w-md text-sm font-medium leading-relaxed text-muted-foreground">
                  A IA está organizando a transcrição e suas anotações em um rascunho clínico para revisão.
                </p>
              </div>
            ) : summary ? (
              <div className="space-y-5">
                <section className="teleconsultation-inset rounded-[24px] p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.15em] text-amber-600 dark:text-amber-300">
                        <Clock3 className="h-3.5 w-3.5" />
                        Pendente {dueLabel}
                      </span>
                      {isEdited ? (
                        <span className="ml-2 inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.15em] text-foreground/70">
                          <Pencil className="h-3.5 w-3.5" />
                          Editado
                        </span>
                      ) : null}
                    </div>

                    <div className="min-w-[250px] space-y-1 text-left">
                      <span className="text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                        Emoção predominante do paciente
                      </span>
                      <Select
                        value={summaryDraft.sentiment}
                        onValueChange={(value) => setSummaryDraft((current) => ({ ...current, sentiment: value }))}
                      >
                        <SelectTrigger className="h-10 rounded-2xl border-border/45 bg-background/75 text-xs font-bold dark:border-white/[0.055]">
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
                    </div>
                  </div>

                  <div className="mt-5">
                    <Textarea
                      value={summaryDraft.summary}
                      onChange={(event) => setSummaryDraft((current) => ({ ...current, summary: event.target.value }))}
                      className="min-h-[200px] resize-y rounded-[20px] border-border/40 bg-background/70 p-5 text-sm leading-7 text-foreground/90 dark:border-white/[0.055]"
                      placeholder="Resumo gerado pela IA"
                    />
                  </div>
                </section>

                {(topics.length > 0 || nextSteps.length > 0) ? (
                  <div className="grid gap-5 md:grid-cols-2">
                    {topics.length > 0 ? (
                      <section className="teleconsultation-inset rounded-[22px] p-5">
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">Temas abordados</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {topics.map((topic) => (
                            <span key={topic} className="rounded-full border border-border/45 bg-background/70 px-3 py-1.5 text-[11px] font-bold text-foreground/80 dark:border-white/[0.055]">
                              {topic}
                            </span>
                          ))}
                        </div>
                      </section>
                    ) : null}

                    {nextSteps.length > 0 ? (
                      <section className="teleconsultation-inset rounded-[22px] p-5">
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">Próximos focos</p>
                        <ul className="mt-3 space-y-2">
                          {nextSteps.map((step) => (
                            <li key={step} className="flex gap-2 text-xs font-semibold leading-relaxed text-foreground/80">
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/55" />
                              {step}
                            </li>
                          ))}
                        </ul>
                      </section>
                    ) : null}
                  </div>
                ) : null}

                <section className="teleconsultation-subsection rounded-[22px] p-5 text-center">
                  <p className="text-xs font-semibold leading-relaxed text-muted-foreground">
                    Após a confirmação, o resumo passa a integrar o prontuário/registro clínico e deixa de ser editável pela rotina comum. Se houver edição, a versão original gerada pela NeuroNex AI será preservada para auditoria e consulta discreta no histórico.
                  </p>
                </section>
              </div>
            ) : (
              <div className="teleconsultation-inset flex min-h-[260px] flex-col items-center justify-center rounded-[24px] p-8 text-center">
                <AlertTriangle className="h-8 w-8 text-amber-500" />
                <h3 className="mt-5 text-lg font-black tracking-[-0.03em]">Resumo ainda não disponível</h3>
                <p className="mt-2 max-w-md text-sm font-medium leading-relaxed text-muted-foreground">
                  A sessão só pode ser concluída depois que o resumo pendente for gerado e salvo.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setDetailsOpen((current) => !current)}
              className="teleconsultation-action mt-5 flex min-h-12 w-full items-center justify-between rounded-[18px] border border-border/40 bg-card/55 px-5 py-3 text-left text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground hover:bg-card dark:border-white/[0.055]"
            >
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Dados revisáveis da sessão
              </span>
              <ChevronDown className={cn('h-4 w-4 transition', detailsOpen && 'rotate-180')} />
            </button>

            {detailsOpen ? (
              <div className="mt-4 grid gap-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200 md:grid-cols-2">
                <div className="teleconsultation-inset rounded-[18px] p-5">
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                    Transcrição ({segmentsCount} trechos)
                  </p>
                  <pre className="mt-3 max-h-44 whitespace-pre-wrap overflow-auto text-xs leading-relaxed text-muted-foreground">
                    {transcript || 'Nenhuma transcrição capturada.'}
                  </pre>
                </div>
                <div className="teleconsultation-inset rounded-[18px] p-5">
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">Anotações</p>
                  <pre className="mt-3 max-h-44 whitespace-pre-wrap overflow-auto text-xs leading-relaxed text-muted-foreground">
                    {notes || 'Nenhuma anotação adicional.'}
                  </pre>
                </div>
              </div>
            ) : null}

            {!hasNetwork ? (
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-amber-500/10 px-4 py-3 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <WifiOff className="h-4 w-4 shrink-0" />
                Reconecte-se para concluir a sessão. O conteúdo permanece protegido localmente.
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 rounded-2xl bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-500">
                {error}
              </div>
            ) : null}
          </div>

          <div className="grid shrink-0 gap-4 border-t border-border/35 bg-background/95 p-5 dark:border-white/[0.045] sm:grid-cols-2 sm:px-8 sm:py-6">
            <Button
              type="button"
              variant="outline"
              disabled={!canFinish}
              onClick={onPreserve}
              className="teleconsultation-action h-[52px] rounded-2xl border-border/50 text-[10px] font-black uppercase tracking-[0.14em] dark:border-white/[0.055]"
            >
              {completionMode === 'saving' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Revisar depois
            </Button>
            <Button
              type="button"
              disabled={!canFinish || !canGenerate}
              onClick={() => onGenerate(summaryDraft)}
              className="teleconsultation-action h-[52px] rounded-2xl bg-foreground text-[10px] font-black uppercase tracking-[0.14em] text-background"
            >
              {completionMode === 'saving' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Confirmar agora
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
