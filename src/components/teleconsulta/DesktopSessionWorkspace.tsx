import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { SessionNotesSyncState } from '@/hooks/use-resilient-session-notes';
import type {
  SessionTranscriptSegment,
  SessionTranscriptSyncState,
} from '@/hooks/use-jitsi-token';
import { cn } from '@/lib/utils';
import type { Patient } from '@/types';
import { useState, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  Cloud,
  CloudOff,
  FileText,
  Mic,
  NotebookPen,
  Pause,
  Pill,
  Play,
  RefreshCcw,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

interface DesktopSessionWorkspaceProps {
  patient?: Patient | null;
  patientName: string;
  segments: SessionTranscriptSegment[];
  interimText?: string;
  notes: string;
  onNotesChange: (value: string) => void;
  notesSyncState: SessionNotesSyncState;
  captureLabel: string;
  syncLabel: string;
  syncState: SessionTranscriptSyncState;
  isCaptureEnabled: boolean;
  captureAvailable: boolean;
  onToggleCapture: () => void;
  onRetrySync: () => void;
}

const WorkspaceCard = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <section
    className={cn(
      'desktop-retina-panel relative min-h-0 overflow-hidden rounded-[28px] border border-border/45 bg-card/82 backdrop-blur-2xl',
      className,
    )}
  >
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent dark:from-white/[0.025]" />
    <div className="relative h-full min-h-0">{children}</div>
  </section>
);

export const DesktopSessionWorkspace = ({
  patient,
  patientName,
  segments,
  interimText,
  notes,
  onNotesChange,
  notesSyncState,
  captureLabel,
  syncLabel,
  syncState,
  isCaptureEnabled,
  captureAvailable,
  onToggleCapture,
  onRetrySync,
}: DesktopSessionWorkspaceProps) => {
  const riskScore = patient?.risk_score || 0;
  const medications = patient?.medications || [];
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'transcript' | 'notes' | 'patient'>('transcript');

  return (
    <aside className="flex h-full min-h-0 flex-col gap-3">
      <nav className="desktop-retina-frame grid shrink-0 grid-cols-3 gap-1 rounded-[20px] border border-border/40 p-1.5" aria-label="Ferramentas da sessão">
        {[
          { id: 'transcript' as const, label: 'Transcrição', icon: FileText },
          { id: 'notes' as const, label: 'Notas', icon: NotebookPen },
          { id: 'patient' as const, label: 'Paciente', icon: UserRound },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveWorkspaceTab(tab.id)}
            aria-pressed={activeWorkspaceTab === tab.id}
            className={cn(
              'desktop-retina-interactive flex h-10 items-center justify-center gap-2 rounded-[14px] text-[8px] font-black uppercase tracking-[0.12em]',
              activeWorkspaceTab === tab.id
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-white/[0.045] hover:text-foreground',
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1">
        <WorkspaceCard className={cn('h-full', activeWorkspaceTab !== 'transcript' && 'hidden')}>
          <div className="flex h-full min-h-0 flex-col">
            <header className="flex items-start justify-between gap-3 border-b border-border/35 px-5 py-4 dark:border-white/10">
              <div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span className="text-[9px] font-black uppercase tracking-[0.18em]">Transcrição</span>
                </div>
                <p className="mt-2 text-xs font-semibold text-foreground">{captureLabel}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={onRetrySync}
                  className="h-9 w-9 rounded-xl"
                  aria-label="Sincronizar transcrição"
                >
                  <RefreshCcw className={cn('h-4 w-4', syncState === 'syncing' && 'animate-spin')} />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  disabled={!captureAvailable}
                  onClick={onToggleCapture}
                  className={cn(
                    'h-9 w-9 rounded-xl',
                    isCaptureEnabled && 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
                  )}
                  aria-label={isCaptureEnabled ? 'Pausar captura' : 'Iniciar ou retomar captura'}
                >
                  {isCaptureEnabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
              </div>
            </header>

            <div className="flex items-center gap-2 border-b border-border/25 px-5 py-2.5 text-[8px] font-black uppercase tracking-[0.13em] text-muted-foreground dark:border-white/5">
              {syncState === 'error' ? (
                <CloudOff className="h-3.5 w-3.5 text-rose-500" />
              ) : (
                <Cloud className="h-3.5 w-3.5" />
              )}
              {syncLabel}
              <span className="ml-auto">{segments.length} trechos</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {segments.length ? (
                <div className="space-y-3">
                  {segments.map((segment) => (
                    <article
                      key={segment.client_segment_id}
                      className="desktop-retina-inset rounded-[20px] border border-border/35 bg-background/62 p-4"
                    >
                      <p className="text-[8px] font-black uppercase tracking-[0.15em] text-muted-foreground">
                        {segment.speaker_label || 'Participante'}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-foreground/88">{segment.text}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="flex h-full min-h-40 flex-col items-center justify-center rounded-[22px] border border-dashed border-border/45 px-5 text-center dark:border-white/10">
                  <Mic className="h-6 w-6 text-muted-foreground/45" />
                  <p className="mt-3 text-xs font-semibold text-muted-foreground">Nenhum trecho capturado.</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/65">
                    A captura só começa após o consentimento ser registrado.
                  </p>
                </div>
              )}
              {interimText ? (
                <p className="mt-3 rounded-2xl bg-foreground/[0.035] px-4 py-3 text-xs italic text-muted-foreground">
                  {interimText}
                </p>
              ) : null}
            </div>
          </div>
        </WorkspaceCard>

        <WorkspaceCard className={cn('h-full', activeWorkspaceTab !== 'notes' && 'hidden')}>
          <div className="flex h-full min-h-0 flex-col">
            <header className="flex items-start justify-between gap-3 border-b border-border/35 px-5 py-4 dark:border-white/10">
              <div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <NotebookPen className="h-4 w-4" />
                  <span className="text-[9px] font-black uppercase tracking-[0.18em]">Anotações</span>
                </div>
                <p className="mt-2 text-xs font-semibold text-foreground">Rascunho clínico protegido</p>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-border/35 px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[0.12em] text-muted-foreground dark:border-white/10">
                <ShieldCheck className="h-3.5 w-3.5" />
                {notesSyncState === 'saving'
                  ? 'Salvando'
                  : notesSyncState === 'restoring'
                    ? 'Recuperando'
                    : notesSyncState === 'error'
                      ? 'Falha local'
                      : 'Protegido'}
              </div>
            </header>
            <div className="min-h-0 flex-1 p-4">
              <Textarea
                value={notes}
                onChange={(event) => onNotesChange(event.target.value)}
                placeholder="Registre hipóteses, observações, intervenções e próximos passos..."
                className="desktop-retina-inset h-full min-h-0 resize-none rounded-[22px] border-border/35 bg-background/58 p-4 text-sm leading-relaxed"
              />
            </div>
          </div>
        </WorkspaceCard>
      <WorkspaceCard className={cn('h-full', activeWorkspaceTab !== 'patient' && 'hidden')}>
        <div className="flex h-full min-h-0 flex-col overflow-y-auto px-5 py-4">
          <header className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-foreground text-background">
                <UserRound className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.17em] text-muted-foreground">Contexto do paciente</p>
                <h3 className="mt-1 text-base font-black tracking-[-0.03em]">{patientName}</h3>
              </div>
            </div>
            <div
              className={cn(
                'flex items-center gap-2 rounded-full px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.12em]',
                riskScore >= 70
                  ? 'bg-rose-500/10 text-rose-500'
                  : riskScore >= 40
                    ? 'bg-amber-500/10 text-amber-600'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
              )}
            >
              {riskScore >= 40 ? <AlertTriangle className="h-3.5 w-3.5" /> : <Activity className="h-3.5 w-3.5" />}
              Risco {riskScore || 'não informado'}
            </div>
          </header>

          <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 gap-3">
            <div className="desktop-retina-inset rounded-[20px] bg-background/58 p-4">
              <p className="text-[8px] font-black uppercase tracking-[0.14em] text-muted-foreground">Hipótese / diagnóstico</p>
              <p className="mt-2 line-clamp-4 text-xs font-semibold leading-relaxed text-foreground/85">
                {patient?.diagnosis || 'Nenhuma informação clínica resumida.'}
              </p>
            </div>
            <div className="desktop-retina-inset rounded-[20px] bg-background/58 p-4">
              <div className="flex items-center gap-2">
                <Pill className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[8px] font-black uppercase tracking-[0.14em] text-muted-foreground">Medicações</p>
              </div>
              <div className="mt-2 space-y-1.5">
                {medications.length ? medications.slice(0, 3).map((medication, index) => (
                  <p key={`${medication.name}-${index}`} className="text-xs font-semibold text-foreground/82">
                    {medication.name}{medication.dosage ? ` · ${medication.dosage}` : ''}
                  </p>
                )) : (
                  <p className="text-xs text-muted-foreground">Nenhuma medicação registrada.</p>
                )}
              </div>
            </div>
            <div className="desktop-retina-inset rounded-[20px] bg-background/58 p-4">
              <p className="text-[8px] font-black uppercase tracking-[0.14em] text-muted-foreground">Observações permanentes</p>
              <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-foreground/78">
                {patient?.notes || 'Sem observações permanentes cadastradas.'}
              </p>
            </div>
          </div>
        </div>
      </WorkspaceCard>
      </div>
    </aside>
  );
};
