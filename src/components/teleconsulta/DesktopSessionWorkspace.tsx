import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { SessionNotesSyncState } from '@/hooks/use-resilient-session-notes';
import type {
  SessionTranscriptSegment,
  SessionTranscriptSyncState,
} from '@/hooks/use-jitsi-token';
import { cn } from '@/lib/utils';
import type { Patient } from '@/types';
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
import { useState } from 'react';

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

type WorkspaceTab = 'transcript' | 'notes' | 'patient';

const workspaceTabs = [
  { id: 'transcript' as const, label: 'Transcrição', icon: FileText },
  { id: 'notes' as const, label: 'Notas', icon: NotebookPen },
  { id: 'patient' as const, label: 'Paciente', icon: UserRound },
];

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
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('transcript');
  const riskScore = patient?.risk_score || 0;
  const medications = patient?.medications || [];

  return (
    <aside className="flex h-full min-h-0 min-w-0 flex-col gap-3" aria-label="Ferramentas clínicas da sessão">
      <nav className="teleconsultation-surface grid shrink-0 grid-cols-3 gap-1 rounded-[19px] p-1.5" aria-label="Seções da sessão" role="tablist">
        {workspaceTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            onClick={() => setActiveTab(tab.id)}
            aria-selected={activeTab === tab.id}
            className={cn(
              'teleconsultation-action flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-[13px] px-2 text-[8px] font-black uppercase tracking-[0.1em] outline-none focus-visible:ring-2 focus-visible:ring-ring',
              activeTab === tab.id
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground',
            )}
          >
            <tab.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{tab.label}</span>
          </button>
        ))}
      </nav>

      <section className="teleconsultation-surface min-h-0 flex-1 overflow-hidden rounded-[27px]" role="tabpanel">
        {activeTab === 'transcript' ? (
          <div className="flex h-full min-h-0 flex-col">
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border/40 px-5 py-4 dark:border-white/[0.045]">
              <div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  <span className="text-[9px] font-black uppercase tracking-[0.17em]">Transcrição</span>
                </div>
                <p className="mt-2 text-xs font-semibold text-foreground">{captureLabel}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={onRetrySync}
                  className="h-11 w-11 rounded-[13px]"
                  aria-label="Sincronizar transcrição"
                >
                  <RefreshCcw className={cn('h-4 w-4', syncState === 'syncing' && 'animate-spin motion-reduce:animate-none')} />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  disabled={!captureAvailable}
                  onClick={onToggleCapture}
                  className={cn(
                    'h-11 w-11 rounded-[13px] border-0',
                    isCaptureEnabled && 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
                  )}
                  aria-label={isCaptureEnabled ? 'Pausar captura' : 'Iniciar ou retomar captura'}
                >
                  {isCaptureEnabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
              </div>
            </header>

            <div className="flex shrink-0 items-center gap-2 border-b border-border/30 px-5 py-2.5 text-[8px] font-black uppercase tracking-[0.12em] text-muted-foreground dark:border-white/[0.035]">
              {syncState === 'error' ? <CloudOff className="h-3.5 w-3.5 text-rose-500" /> : <Cloud className="h-3.5 w-3.5" />}
              {syncLabel}
              <span className="ml-auto">{segments.length} trechos</span>
            </div>

            <div className="teleconsultation-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {segments.length ? (
                <div className="space-y-2.5">
                  {segments.map((segment) => (
                    <article
                      key={segment.client_segment_id}
                      className="teleconsultation-inset teleconsultation-deferred-section rounded-[18px] p-3.5"
                    >
                      <p className="text-[8px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                        {segment.speaker_label || 'Participante'}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-foreground/85">{segment.text}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="flex h-full min-h-44 flex-col items-center justify-center rounded-[21px] border border-dashed border-border/50 px-5 text-center dark:border-white/[0.055]">
                  <Mic className="h-6 w-6 text-muted-foreground/40" aria-hidden="true" />
                  <p className="mt-3 text-xs font-semibold text-muted-foreground">Nenhum trecho capturado.</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/65">
                    A captura começa após o consentimento ser registrado.
                  </p>
                </div>
              )}
              {interimText ? (
                <p className="mt-3 rounded-[18px] bg-foreground/[0.04] px-4 py-3 text-xs italic text-muted-foreground">
                  {interimText}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {activeTab === 'notes' ? (
          <div className="flex h-full min-h-0 flex-col">
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border/40 px-5 py-4 dark:border-white/[0.045]">
              <div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <NotebookPen className="h-4 w-4" aria-hidden="true" />
                  <span className="text-[9px] font-black uppercase tracking-[0.17em]">Anotações</span>
                </div>
                <p className="mt-2 text-xs font-semibold text-foreground">Rascunho clínico protegido</p>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-foreground/[0.045] px-3 py-2 text-[8px] font-black uppercase tracking-[0.11em] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
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
                className="teleconsultation-inset h-full min-h-0 resize-none rounded-[20px] border-0 p-4 text-sm leading-relaxed shadow-none focus-visible:ring-1"
              />
            </div>
          </div>
        ) : null}

        {activeTab === 'patient' ? (
          <div className="teleconsultation-scroll h-full min-h-0 overflow-y-auto px-5 py-4">
            <header className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="teleconsultation-inset flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]">
                  <UserRound className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-[8px] font-black uppercase tracking-[0.16em] text-muted-foreground">Contexto do paciente</p>
                  <h3 className="mt-1 truncate text-base font-black tracking-[-0.03em]">{patientName}</h3>
                </div>
              </div>
              <div
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[8px] font-black uppercase tracking-[0.1em]',
                  riskScore >= 70
                    ? 'bg-rose-500/10 text-rose-500'
                    : riskScore >= 40
                      ? 'bg-amber-500/10 text-amber-600'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                )}
              >
                {riskScore >= 40 ? <AlertTriangle className="h-3.5 w-3.5" /> : <Activity className="h-3.5 w-3.5" />}
                {riskScore ? `Risco ${riskScore}` : 'Risco não informado'}
              </div>
            </header>

            <div className="mt-4 space-y-3">
              <div className="teleconsultation-inset rounded-[19px] p-4">
                <p className="text-[8px] font-black uppercase tracking-[0.14em] text-muted-foreground">Hipótese / diagnóstico</p>
                <p className="mt-2 text-xs font-semibold leading-relaxed text-foreground/85">
                  {patient?.diagnosis || 'Nenhuma informação clínica resumida.'}
                </p>
              </div>
              <div className="teleconsultation-inset rounded-[19px] p-4">
                <div className="flex items-center gap-2">
                  <Pill className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  <p className="text-[8px] font-black uppercase tracking-[0.14em] text-muted-foreground">Medicações</p>
                </div>
                <div className="mt-2 space-y-1.5">
                  {medications.length ? medications.slice(0, 5).map((medication, index) => (
                    <p key={`${medication.name}-${index}`} className="text-xs font-semibold text-foreground/82">
                      {medication.name}{medication.dosage ? ` · ${medication.dosage}` : ''}
                    </p>
                  )) : <p className="text-xs text-muted-foreground">Nenhuma medicação registrada.</p>}
                </div>
              </div>
              <div className="teleconsultation-inset rounded-[19px] p-4">
                <p className="text-[8px] font-black uppercase tracking-[0.14em] text-muted-foreground">Observações permanentes</p>
                <p className="mt-2 text-xs leading-relaxed text-foreground/78">
                  {patient?.notes || 'Sem observações permanentes cadastradas.'}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </aside>
  );
};
