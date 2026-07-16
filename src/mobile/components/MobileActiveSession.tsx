import { useAuth } from '@/components/auth/SessionContextProvider';
import { JitsiMeet, type JitsiRef } from '@/components/teleconsulta/JitsiMeet';
import { TranscriptionConsentPanel } from '@/components/teleconsulta/TranscriptionConsentPanel';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCompleteAppointmentClinicalSession } from '@/hooks/use-complete-appointment-clinical-session';
import { useGenerateSessionProntuario } from '@/hooks/use-generate-session-prontuario';
import { useJitsiToken } from '@/hooks/use-jitsi-token';
import { useTeleconsultationInvite } from '@/hooks/use-teleconsultation-invite';
import type { MediaDeviceChoice } from '@/hooks/use-media-readiness';
import { usePatientById } from '@/hooks/use-patient-by-id';
import { useResilientSessionNotes } from '@/hooks/use-resilient-session-notes';
import { useSessionCapture } from '@/hooks/use-session-capture';
import { cn, getInitials } from '@/lib/utils';
import type { Appointment } from '@/types';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  CloudOff,
  FileText,
  Loader2,
  Mic,
  MicOff,
  NotebookPen,
  Pause,
  Phone,
  Play,
  RefreshCcw,
  Sparkles,
  Video,
  VideoOff,
  WifiOff,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { MobileTeleconsultationLobby } from './MobileTeleconsultationLobby';

interface MobileActiveSessionProps {
  activeAppointment: Appointment;
  onSessionEnd: () => void;
}

type SessionView = 'session' | 'transcript' | 'notes' | 'review';
type CompletionMode = 'idle' | 'generating' | 'saving';

const JITSI_APP_ID = 'vpaas-magic-cookie-dc267e44c7014498a3a128625367fc67';

const formatElapsed = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
};

export const MobileActiveSession = ({ activeAppointment, onSessionEnd }: MobileActiveSessionProps) => {
  const [view, setView] = useState<SessionView>('session');
  const [showLobby, setShowLobby] = useState(true);
  const [showConsent, setShowConsent] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [mediaSettings, setMediaSettings] = useState<MediaDeviceChoice | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [completionMode, setCompletionMode] = useState<CompletionMode>('idle');
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  const jitsiRef = useRef<JitsiRef>(null);
  const joinedAtRef = useRef<number | null>(null);
  const reviewRequestedRef = useRef(false);
  const finishSessionInFlightRef = useRef<Promise<void> | null>(null);

  const { user } = useAuth();
  const therapistName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Terapeuta';
  const patientId = activeAppointment.patient_id;
  const patientName = activeAppointment.patient_name || 'Paciente';
  const appointmentId = activeAppointment.id;
  const isOnlineSession = activeAppointment.type === 'online';
  const invite = useTeleconsultationInvite(
    appointmentId,
    activeAppointment.google_meet_link,
    isOnlineSession,
  );
  const meetLink = invite.data?.meetLink || '';
  const roomName = `${JITSI_APP_ID}/${appointmentId}`;

  const { data: patient } = usePatientById(patientId || '');
  const { data: jitsiToken, error: jitsiError, isLoading: isLoadingToken } = useJitsiToken(roomName, {
    enabled: isOnlineSession,
  });
  const {
    completeClinicalSession,
    isCompletingClinicalSession,
    resetClinicalSessionCompletionAttempt,
  } = useCompleteAppointmentClinicalSession(appointmentId, patientId);
  const { mutateAsync: generateProntuario, isPending: isGeneratingProntuario } = useGenerateSessionProntuario();
  const notesDraft = useResilientSessionNotes(appointmentId);
  const capture = useSessionCapture({
    appointmentId,
    patientId,
    modality: isOnlineSession ? 'online' : 'in_person',
    therapistName,
  });

  const {
    transcriptId,
    transcriptText,
    segments,
    record,
    captureState,
    syncState,
    pendingCount,
    consentStatus,
    isOnline: hasNetwork,
    lastError,
    interimText,
    isCaptureEnabled,
    speechSupported,
    speechError,
    ensureTranscript,
    grantConsent,
    declineConsent,
    startCapture,
    pauseCapture,
    resumeCapture,
    appendJitsiSegment,
    finalizeCapture,
    retrySync,
    markReviewed,
    linkSummaryNote,
    clearRecovery,
  } = capture;

  const isProcessing = completionMode !== 'idle'
    || isCompletingClinicalSession
    || isGeneratingProntuario;
  const captureLabel = useMemo(() => {
    if (consentStatus === 'declined') return 'Sem transcrição';
    if (consentStatus === 'revoked') return 'Consentimento revogado';
    if (consentStatus === 'pending') return 'Consentimento pendente';
    if (captureState === 'finalizing') return 'Finalizando captura';
    if (captureState === 'completed') return 'Transcrição concluída';
    if (captureState === 'paused') return 'Captura pausada';
    if (isCaptureEnabled) return 'Transcrevendo';
    return 'Captura pronta';
  }, [captureState, consentStatus, isCaptureEnabled]);

  const syncLabel = useMemo(() => {
    if (!hasNetwork || syncState === 'offline') return 'Offline protegido';
    if (syncState === 'syncing') return 'Sincronizando';
    if (syncState === 'error') return 'Falha de sincronização';
    if (pendingCount > 0 || syncState === 'pending') return `${pendingCount || 1} pendente`;
    if (syncState === 'synced') return 'Sincronizado';
    return 'Recuperação ativa';
  }, [hasNetwork, pendingCount, syncState]);

  useEffect(() => {
    if (!hasJoined) return;
    if (!joinedAtRef.current) joinedAtRef.current = Date.now();
    const timer = window.setInterval(() => {
      if (joinedAtRef.current) setElapsedSeconds(Math.floor((Date.now() - joinedAtRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [hasJoined]);

  useEffect(() => {
    if (!hasJoined) return;
    void ensureTranscript().catch((error) => {
      toast.error(error instanceof Error ? error.message : 'Não foi possível preparar a transcrição.');
    });
    setShowConsent(consentStatus === 'pending');
  }, [consentStatus, ensureTranscript, hasJoined]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setIsKeyboardOpen(window.innerHeight - viewport.height > 160);
    update();
    viewport.addEventListener('resize', update);
    return () => viewport.removeEventListener('resize', update);
  }, []);

  const handleJoin = useCallback((selection: MediaDeviceChoice) => {
    setMediaSettings(selection);
    setIsAudioEnabled(selection.audioEnabled);
    setIsVideoEnabled(selection.videoEnabled);
    setShowLobby(false);
    if (!isOnlineSession) setHasJoined(true);
  }, [isOnlineSession]);

  const handleGrantConsent = useCallback(async (
    method: Parameters<typeof grantConsent>[0],
    notes?: string,
  ) => {
    try {
      await grantConsent(method, notes);
      if (!isOnlineSession && !speechSupported) {
        setShowConsent(false);
        toast.warning('Transcrição local indisponível. A sessão seguirá com anotações protegidas.');
        return;
      }
      await startCapture();
      setShowConsent(false);
      toast.success('Consentimento registrado e captura iniciada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível iniciar a captura.');
    }
  }, [grantConsent, isOnlineSession, speechSupported, startCapture]);

  const handleDeclineConsent = useCallback(async (notes?: string) => {
    try {
      await declineConsent(notes);
      setShowConsent(false);
      toast.info('A sessão continuará sem transcrição.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível registrar a decisão.');
    }
  }, [declineConsent]);

  const handleToggleCapture = useCallback(async () => {
    if (consentStatus !== 'granted') {
      setShowConsent(true);
      return;
    }
    if (!isOnlineSession && !speechSupported) {
      toast.error('Transcrição presencial indisponível neste navegador.');
      return;
    }
    try {
      if (isCaptureEnabled) await pauseCapture();
      else if (captureState === 'paused' || record?.status === 'recording') await resumeCapture();
      else await startCapture();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível alterar a captura.');
    }
  }, [captureState, consentStatus, isCaptureEnabled, isOnlineSession, pauseCapture, record?.status, resumeCapture, speechSupported, startCapture]);

  const requestReview = useCallback(async () => {
    if (reviewRequestedRef.current) return;
    reviewRequestedRef.current = true;
    setCompletionError(null);
    try {
      if (consentStatus === 'granted' && captureState !== 'completed') await finalizeCapture();
      setReviewConfirmed(false);
      setView('review');
      if (isOnlineSession && hasJoined) jitsiRef.current?.executeCommand('hangup');
    } catch (error) {
      reviewRequestedRef.current = false;
      const message = error instanceof Error ? error.message : 'Não foi possível preparar a revisão.';
      setCompletionError(message);
      toast.error(message);
    }
  }, [captureState, consentStatus, finalizeCapture, hasJoined, isOnlineSession]);

  const finishSession = useCallback((draftPending: boolean, summaryNoteId?: string) => {
    if (finishSessionInFlightRef.current) return finishSessionInFlightRef.current;

    const operation = (async () => {
      await completeClinicalSession({
        draftPending,
        sessionSummaryNoteId: summaryNoteId ?? null,
        sessionTranscriptId: transcriptId ?? null,
      });

      const cleanup = [clearRecovery()];
      // Without a persisted summary note, the local draft remains available
      // for the promised later review instead of being copied to appointment metadata.
      if (!draftPending || summaryNoteId) cleanup.push(notesDraft.clearDraft());
      await Promise.all(cleanup);
      onSessionEnd();
      resetClinicalSessionCompletionAttempt();
    })();

    finishSessionInFlightRef.current = operation;
    void operation.then(
      () => {
        if (finishSessionInFlightRef.current === operation) {
          finishSessionInFlightRef.current = null;
        }
      },
      () => {
        if (finishSessionInFlightRef.current === operation) {
          finishSessionInFlightRef.current = null;
        }
      },
    );
    return operation;
  }, [clearRecovery, completeClinicalSession, notesDraft, onSessionEnd, resetClinicalSessionCompletionAttempt, transcriptId]);

  const completeWithAi = useCallback(async () => {
    if (!reviewConfirmed || !patientId) return;
    if (!hasNetwork) {
      setCompletionError('Reconecte-se para gerar e salvar o rascunho clínico.');
      return;
    }
    setCompletionMode('generating');
    setCompletionError(null);
    try {
      await retrySync();
      if (transcriptId) await markReviewed();
      const result = await generateProntuario({
        patientId,
        appointmentId,
        notes: notesDraft.notes,
        chatHistory: transcriptText,
      });
      const summaryNoteId = result.sessionNote?.id;
      if (transcriptId && summaryNoteId) await linkSummaryNote(summaryNoteId);
      await finishSession(false, summaryNoteId);
      toast.success('Sessão concluída e rascunho clínico gerado.');
    } catch (error) {
      setCompletionError(error instanceof Error ? error.message : 'Não foi possível concluir a sessão.');
    } finally {
      setCompletionMode('idle');
    }
  }, [appointmentId, finishSession, generateProntuario, hasNetwork, linkSummaryNote, markReviewed, notesDraft.notes, patientId, retrySync, reviewConfirmed, transcriptId, transcriptText]);

  const completeWithoutAi = useCallback(async () => {
    if (!reviewConfirmed) return;
    if (!hasNetwork) {
      setCompletionError('Reconecte-se para salvar a conclusão da sessão.');
      return;
    }
    setCompletionMode('saving');
    setCompletionError(null);
    try {
      await retrySync();
      if (transcriptId) await markReviewed();
      await finishSession(true);
      toast.warning('Sessão concluída e rascunho preservado para depois.');
    } catch (error) {
      setCompletionError(error instanceof Error ? error.message : 'Não foi possível salvar a conclusão.');
    } finally {
      setCompletionMode('idle');
    }
  }, [finishSession, hasNetwork, markReviewed, retrySync, reviewConfirmed, transcriptId]);

  if (showLobby) {
    return (
      <MobileTeleconsultationLobby
        patientName={patientName}
        patient={patient}
        appointmentId={appointmentId}
        appointmentStart={activeAppointment.start_time}
        meetLink={meetLink}
        therapistName={therapistName}
        isOnline={isOnlineSession}
        isLoadingToken={isOnlineSession && isLoadingToken}
        onJoin={handleJoin}
        onBack={onSessionEnd}
      />
    );
  }

  const renderSession = () => (
    <div className="relative h-full overflow-hidden">
      {isOnlineSession ? (
        jitsiToken ? (
          <JitsiMeet
            ref={jitsiRef}
            roomName={roomName}
            jwt={jitsiToken}
            userName={therapistName}
            userEmail={user?.email}
            userAvatarUrl={user?.user_metadata?.avatar_url}
            subject={patientName}
            mediaSettings={mediaSettings}
            onMeetingEnd={() => {
              if (!reviewRequestedRef.current) void requestReview();
            }}
            onTranscriptUpdate={appendJitsiSegment}
            onMuteStatusChanged={({ audio, video }) => {
              setIsAudioEnabled(!audio);
              setIsVideoEnabled(!video);
            }}
            onConferenceJoined={() => {
              setHasJoined(true);
              setShowLobby(false);
            }}
          />
        ) : jitsiError ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center text-rose-500">
            <AlertCircle className="h-10 w-10" />
            <p className="text-sm font-semibold">{jitsiError.message}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>Recarregar</Button>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <Loader2 className="h-9 w-9 animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Conectando com segurança</p>
          </div>
        )
      ) : (
        <div className="flex h-full flex-col items-center justify-center px-7 text-center">
          <div className={cn(
            'flex h-28 w-28 items-center justify-center rounded-[38px] border shadow-2xl',
            isCaptureEnabled
              ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-500'
              : 'border-border/45 bg-card text-muted-foreground dark:border-white/10',
          )}>
            {isCaptureEnabled ? <Mic className="h-11 w-11" /> : <NotebookPen className="h-11 w-11" />}
          </div>
          <h2 className="mt-7 text-2xl font-black tracking-[-0.04em]">{captureLabel}</h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {!speechSupported
              ? 'Reconhecimento de fala indisponível neste navegador. Use as anotações protegidas.'
              : isCaptureEnabled
                ? 'O áudio está sendo convertido em texto e sincronizado incrementalmente.'
                : 'A sessão segue ativa. A captura só acontece com consentimento registrado.'}
          </p>
          {interimText ? <p className="mt-5 rounded-2xl bg-card px-4 py-3 text-xs italic text-muted-foreground">{interimText}</p> : null}
        </div>
      )}
    </div>
  );

  const renderTranscript = () => (
    <section className="h-full overflow-y-auto px-5 pb-28 pt-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">Registro incremental</p>
          <h2 className="mt-1 text-xl font-black tracking-[-0.04em]">Transcrição</h2>
        </div>
        <Button variant="outline" size="sm" onClick={() => void retrySync()} className="rounded-xl">
          <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Sincronizar
        </Button>
      </div>
      {segments.length ? (
        <div className="mt-5 space-y-3">
          {segments.map((segment) => (
            <article key={segment.client_segment_id} className="rounded-[22px] border border-border/40 bg-card/80 p-4 dark:border-white/10">
              <p className="text-[9px] font-black uppercase tracking-[0.13em] text-muted-foreground">{segment.speaker_label || 'Participante'}</p>
              <p className="mt-2 text-sm leading-relaxed text-foreground/90">{segment.text}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-[28px] border border-dashed border-border/50 p-8 text-center text-sm text-muted-foreground dark:border-white/10">
          Nenhum trecho capturado nesta sessão.
        </div>
      )}
    </section>
  );

  const renderNotes = () => (
    <section className="flex h-full flex-col px-5 pb-24 pt-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">Rascunho protegido</p>
          <h2 className="mt-1 text-xl font-black tracking-[-0.04em]">Anotações clínicas</h2>
        </div>
        <span className="rounded-full border border-border/40 px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.12em] text-muted-foreground dark:border-white/10">
          {notesDraft.syncState === 'saving' ? 'Salvando' : notesDraft.syncState === 'error' ? 'Falha local' : 'Protegido'}
        </span>
      </div>
      <Textarea
        value={notesDraft.notes}
        onChange={(event) => notesDraft.setNotes(event.target.value)}
        placeholder="Registre hipóteses, observações e próximos passos..."
        className="mt-5 min-h-0 flex-1 resize-none rounded-[26px] border-border/45 bg-card/70 p-5 text-base leading-relaxed dark:border-white/10"
      />
    </section>
  );

  const renderReview = () => (
    <section className="h-full overflow-y-auto px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-6">
      <div className="rounded-[30px] border border-border/45 bg-card/85 p-5 shadow-xl dark:border-white/10">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">Revisão profissional</p>
            <h2 className="mt-1 text-xl font-black tracking-[-0.04em]">Concluir sessão</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Revise o conteúdo antes de gerar qualquer rascunho clínico.</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-background/70 p-4">
            <p className="text-[8px] font-black uppercase tracking-[0.14em] text-muted-foreground">Transcrição</p>
            <p className="mt-2 text-lg font-black">{segments.length} trechos</p>
          </div>
          <div className="rounded-2xl bg-background/70 p-4">
            <p className="text-[8px] font-black uppercase tracking-[0.14em] text-muted-foreground">Anotações</p>
            <p className="mt-2 text-lg font-black">{notesDraft.notes.trim().length} caracteres</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setReviewConfirmed((value) => !value)}
          className={cn(
            'mt-5 flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition',
            reviewConfirmed
              ? 'border-emerald-500/30 bg-emerald-500/10'
              : 'border-border/45 bg-background/60 dark:border-white/10',
          )}
        >
          <CheckCircle2 className={cn('mt-0.5 h-5 w-5 shrink-0', reviewConfirmed ? 'text-emerald-500' : 'text-muted-foreground')} />
          <span className="text-xs font-semibold leading-relaxed">Confirmo que revisei a transcrição e as anotações antes da geração do rascunho.</span>
        </button>
        {completionError ? <p className="mt-4 rounded-2xl bg-rose-500/10 p-3 text-xs text-rose-500">{completionError}</p> : null}
        {!hasNetwork ? <p className="mt-4 rounded-2xl bg-amber-500/10 p-3 text-xs text-amber-600">Reconecte-se para concluir. O conteúdo continua protegido localmente.</p> : null}
        <Button
          disabled={!reviewConfirmed || isProcessing || !hasNetwork}
          onClick={() => void completeWithAi()}
          className="mt-5 h-14 w-full rounded-2xl bg-foreground text-[9px] font-black uppercase tracking-[0.16em] text-background"
        >
          {completionMode === 'generating' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Gerar rascunho e concluir
        </Button>
        <Button
          variant="ghost"
          disabled={!reviewConfirmed || isProcessing || !hasNetwork}
          onClick={() => void completeWithoutAi()}
          className="mt-2 h-11 w-full rounded-2xl text-[8px] font-black uppercase tracking-[0.14em]"
        >
          {completionMode === 'saving' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Concluir e preservar para depois
        </Button>
      </div>
    </section>
  );

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-background">
      <header className="relative z-40 flex items-center gap-3 border-b border-border/40 bg-background/90 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-2xl dark:border-white/10">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/45 bg-card text-xs font-black dark:border-white/10">
          {getInitials(patientName)}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-black tracking-[-0.02em]">{patientName}</h1>
          <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground">{formatElapsed(elapsedSeconds)} · {captureLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => void retrySync()}
          className={cn(
            'flex h-10 items-center gap-2 rounded-2xl border px-3 text-[8px] font-black uppercase tracking-[0.1em]',
            syncState === 'error'
              ? 'border-rose-500/20 bg-rose-500/10 text-rose-500'
              : !hasNetwork
                ? 'border-amber-500/20 bg-amber-500/10 text-amber-600'
                : 'border-border/45 bg-card text-muted-foreground dark:border-white/10',
          )}
        >
          {syncState === 'syncing' ? <Loader2 className="h-4 w-4 animate-spin" /> : !hasNetwork ? <WifiOff className="h-4 w-4" /> : syncState === 'error' ? <CloudOff className="h-4 w-4" /> : <Cloud className="h-4 w-4" />}
          <span className="hidden min-[390px]:inline">{syncLabel}</span>
        </button>
      </header>

      <main className="relative min-h-0 flex-1 overflow-hidden">
        <div className={cn('absolute inset-0', view === 'session' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0')}>
          {renderSession()}
        </div>
        <AnimatePresence mode="wait">
          {view !== 'session' ? (
            <motion.div
              key={view}
              className="absolute inset-0 bg-background"
              initial={{ opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 28 }}
            >
              {view === 'transcript' ? renderTranscript() : view === 'notes' ? renderNotes() : renderReview()}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      {view !== 'review' && !isKeyboardOpen ? (
        <footer className="relative z-50 border-t border-border/45 bg-background/92 px-4 pb-[calc(0.7rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-2xl dark:border-white/10">
          <div className="grid grid-cols-3 gap-2 rounded-[22px] border border-border/40 bg-card/70 p-1.5 dark:border-white/10">
            {([
              ['session', 'Sessão', isOnlineSession ? Video : NotebookPen],
              ['transcript', 'Transcrição', FileText],
              ['notes', 'Anotações', NotebookPen],
            ] as const).map(([target, label, Icon]) => (
              <button
                key={target}
                type="button"
                onClick={() => setView(target)}
                className={cn(
                  'flex h-10 items-center justify-center gap-2 rounded-2xl text-[8px] font-black uppercase tracking-[0.1em]',
                  view === target ? 'bg-foreground text-background' : 'text-muted-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {isOnlineSession ? (
                <>
                  <Button size="icon" variant="secondary" onClick={() => jitsiRef.current?.toggleAudio()} className={cn('h-11 w-11 rounded-2xl', !isAudioEnabled && 'bg-rose-500/10 text-rose-500')}>
                    {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                  </Button>
                  <Button size="icon" variant="secondary" onClick={() => jitsiRef.current?.toggleVideo()} className={cn('h-11 w-11 rounded-2xl', !isVideoEnabled && 'bg-rose-500/10 text-rose-500')}>
                    {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                  </Button>
                </>
              ) : (
                <span className="truncate text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground">{captureLabel}</span>
              )}
            </div>
            <Button size="icon" disabled={isProcessing} onClick={() => void requestReview()} className="h-14 w-14 rounded-[24px] bg-rose-500 text-white shadow-xl hover:bg-rose-600">
              <Phone className="h-6 w-6 fill-current" />
            </Button>
            <Button size="icon" variant="secondary" onClick={() => void handleToggleCapture()} className={cn('h-11 w-11 rounded-2xl', isCaptureEnabled && 'bg-emerald-500/10 text-emerald-500')}>
              {isCaptureEnabled ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>
          </div>
        </footer>
      ) : null}

      <AnimatePresence>
        {showConsent && hasJoined && view !== 'review' ? (
          <motion.div className="fixed inset-0 z-[180] flex items-end bg-black/55 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="w-full" initial={{ y: 36, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 36, opacity: 0 }}>
              <TranscriptionConsentPanel
                compact
                patientName={patientName}
                isPending={captureState === 'restoring' || captureState === 'finalizing'}
                onGrant={handleGrantConsent}
                onDecline={handleDeclineConsent}
              />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {lastError || speechError ? (
        <div className="pointer-events-none fixed bottom-[calc(7.5rem+env(safe-area-inset-bottom))] left-4 right-4 z-[170] rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-500 backdrop-blur-xl">
          {lastError || `Falha no reconhecimento de fala: ${speechError}`}
        </div>
      ) : null}
    </div>
  );
};
