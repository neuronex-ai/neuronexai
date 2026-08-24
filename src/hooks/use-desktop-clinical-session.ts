import { useAuth } from '@/components/auth/SessionContextProvider';
import type { JitsiRef } from '@/components/teleconsulta/JitsiMeet';
import { useAI } from '@/context/AIContext';
import { useCompleteAppointmentClinicalSession } from '@/hooks/use-complete-appointment-clinical-session';
import { useGenerateSessionProntuario } from '@/hooks/use-generate-session-prontuario';
import { useJitsiToken } from '@/hooks/use-jitsi-token';
import { useTeleconsultationInvite } from '@/hooks/use-teleconsultation-invite';
import type { MediaDeviceChoice } from '@/hooks/use-media-readiness';
import { usePatientById } from '@/hooks/use-patient-by-id';
import { useResilientSessionNotes } from '@/hooks/use-resilient-session-notes';
import { useSessionCapture } from '@/hooks/use-session-capture';
import { useUpdateAppointment } from '@/hooks/use-update-appointment';
import { supabase } from '@/integrations/supabase/client';
import {
  shouldOpenTeleconsultationTranscriptionReview,
  shouldStartTeleconsultationCapture,
} from '@/lib/teleconsultation-transcription';
import {
  getTeleconsultationTranscriptionDecision,
  persistTeleconsultationTranscriptionDecision,
  type TeleconsultationTranscriptionDecision,
} from '@/lib/teleconsultation-consent';
import type { AISummary, Appointment, SessionNote } from '@/types';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

export type DesktopSessionCompletionMode = 'idle' | 'generating' | 'saving';

const JITSI_APP_ID = 'vpaas-magic-cookie-dc267e44c7014498a3a128625367fc67';
type TranscriptionDecision = TeleconsultationTranscriptionDecision | null;

export const formatSessionElapsed = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
};

export const useDesktopClinicalSession = (
  activeAppointment: Appointment,
  patientName: string,
  onSessionEnd: () => void,
) => {
  const [showLobby, setShowLobby] = useState(true);
  const [hasJoined, setHasJoined] = useState(false);
  // The transcription choice belongs to the pre-join step. Reconfirm it each
  // time an online room is prepared so capture cannot start from stale data.
  const [showConsent, setShowConsent] = useState(() => activeAppointment.type === 'online');
  const [mediaSettings, setMediaSettings] = useState<MediaDeviceChoice | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTranscript, setReviewTranscript] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewSummaryNote, setReviewSummaryNote] = useState<SessionNote | null>(null);
  const [completionMode, setCompletionMode] = useState<DesktopSessionCompletionMode>('idle');
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [isSavingTranscriptionDecision, setIsSavingTranscriptionDecision] = useState(false);

  const jitsiRef = useRef<JitsiRef>(null);
  const joinedAtRef = useRef<number | null>(null);
  const reviewRequestedRef = useRef(false);
  const finishSessionInFlightRef = useRef<Promise<void> | null>(null);
  const transcriptionDecisionInFlightRef = useRef<{
    enabled: boolean;
    promise: Promise<TeleconsultationTranscriptionDecision>;
  } | null>(null);

  const { toggleFocusMode, isFocusMode } = useAI();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const therapistName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Terapeuta';
  const therapistAvatar = user?.user_metadata?.avatar_url || '';
  const patientId = activeAppointment.patient_id;
  const appointmentId = activeAppointment.id;
  const isOnlineSession = activeAppointment.type === 'online';
  const roomName = `${JITSI_APP_ID}/${appointmentId}`;
  const invite = useTeleconsultationInvite(
    appointmentId,
    activeAppointment.google_meet_link,
    isOnlineSession,
  );
  const effectiveMeetLink = invite.data?.meetLink || '';
  const [transcriptionDecision, setTranscriptionDecision] = useState<TranscriptionDecision>(() =>
    getTeleconsultationTranscriptionDecision(activeAppointment.metadata),
  );
  const [roomStatus, setRoomStatus] = useState<'waiting' | 'open' | 'closed'>(
    activeAppointment.metadata?.teleconsultationRoom?.status || 'waiting',
  );

  const { data: patient } = usePatientById(patientId || '');
  const {
    data: jitsiToken,
    error: jitsiError,
    isLoading: isLoadingToken,
  } = useJitsiToken(roomName, {
    enabled: isOnlineSession && Boolean(transcriptionDecision),
    decisionKey: transcriptionDecision
      ? `${transcriptionDecision.enabled}:${transcriptionDecision.decidedAt || 'current'}`
      : 'pending',
  });
  const { mutateAsync: updateAppointment, isPending: isUpdatingAppointment } = useUpdateAppointment();
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
    || isUpdatingAppointment
    || isCompletingClinicalSession
    || isGeneratingProntuario;
  const captureAvailable = isOnlineSession || speechSupported;
  const hasTranscriptionDecision = !isOnlineSession || Boolean(transcriptionDecision);
  const transcriptionEnabled = transcriptionDecision?.enabled === true;
  const canInvitePatient = isOnlineSession && hasTranscriptionDecision && roomStatus !== 'closed' && Boolean(effectiveMeetLink);

  const captureLabel = useMemo(() => {
    if (consentStatus === 'declined') return 'Sessão sem transcrição';
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

  const persistTranscriptionDecision = useCallback((enabled: boolean, notes?: string) => {
    if (!user?.id) return Promise.reject(new Error('Usuário não autenticado.'));

    const inFlight = transcriptionDecisionInFlightRef.current;
    if (inFlight) {
      if (inFlight.enabled === enabled) return inFlight.promise;
      return Promise.reject(new Error('A decisão de transcrição já está sendo registrada.'));
    }

    setIsSavingTranscriptionDecision(true);
    const promise = persistTeleconsultationTranscriptionDecision({
      appointmentId,
      professionalId: user.id,
      enabled,
      notes,
    }).then(({ decision }) => {
      setTranscriptionDecision(decision);
      void queryClient.invalidateQueries({ queryKey: ['appointmentsByDateRange'] });
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      return decision;
    }).finally(() => {
      if (transcriptionDecisionInFlightRef.current?.promise === promise) {
        transcriptionDecisionInFlightRef.current = null;
      }
      setIsSavingTranscriptionDecision(false);
    });

    transcriptionDecisionInFlightRef.current = { enabled, promise };
    return promise;
  }, [appointmentId, queryClient, user?.id]);

  const persistRoomStatus = useCallback(async (
    status: 'waiting' | 'open' | 'closed',
    reason?: string,
  ) => {
    if (!isOnlineSession) return;
    const now = new Date().toISOString();
    setRoomStatus(status);
    await updateAppointment({
      id: appointmentId,
      updates: {
        metadata: {
          teleconsultationRoom: {
            status,
            openedAt: status === 'open' ? now : activeAppointment.metadata?.teleconsultationRoom?.openedAt,
            lastHeartbeatAt: status === 'open' ? now : activeAppointment.metadata?.teleconsultationRoom?.lastHeartbeatAt,
            openedBy: status === 'open' ? user?.id : activeAppointment.metadata?.teleconsultationRoom?.openedBy,
            closedAt: status === 'closed' ? now : undefined,
            closedReason: status === 'closed' ? reason || 'therapist_left' : undefined,
          },
        },
      },
    });
  }, [activeAppointment.metadata?.teleconsultationRoom?.lastHeartbeatAt, activeAppointment.metadata?.teleconsultationRoom?.openedAt, activeAppointment.metadata?.teleconsultationRoom?.openedBy, appointmentId, isOnlineSession, updateAppointment, user?.id]);

  const openPatientInvite = useCallback(() => {
    if (!hasTranscriptionDecision) {
      setShowConsent(true);
      toast.info('Defina se a teleconsulta será transcrita antes de convidar o paciente.');
      return;
    }
    if (roomStatus === 'closed') {
      toast.error('Esta sala já foi encerrada.');
      return;
    }
    setShowInviteModal(true);
  }, [hasTranscriptionDecision, roomStatus]);

  const requestTranscriptionDecision = useCallback(() => {
    if (!isOnlineSession) return;
    setShowConsent(true);
  }, [isOnlineSession]);

  const dismissTranscriptionDecision = useCallback(() => {
    setShowConsent(false);
  }, []);

  useEffect(() => {
    const nextDecision = getTeleconsultationTranscriptionDecision(activeAppointment.metadata);
    // Always reset the decision when moving between appointments. Keeping the
    // previous session's state here could silently bypass the pre-join choice.
    setTranscriptionDecision(nextDecision);
    setRoomStatus(activeAppointment.metadata?.teleconsultationRoom?.status || 'waiting');
  }, [activeAppointment.id, activeAppointment.metadata]);

  useEffect(() => {
    if (!hasJoined) return;
    if (!joinedAtRef.current) joinedAtRef.current = Date.now();
    const timer = window.setInterval(() => {
      if (joinedAtRef.current) {
        setElapsedSeconds(Math.floor((Date.now() - joinedAtRef.current) / 1000));
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [hasJoined]);

  useEffect(() => {
    if (!isOnlineSession || !hasJoined || roomStatus !== 'open' || !user?.id) return;

    const writeHeartbeat = async () => {
      const now = new Date().toISOString();
      await supabase
        .from('appointments')
        .update({
          metadata: {
            ...(activeAppointment.metadata || {}),
            ...(transcriptionDecision ? { teleconsultationTranscription: transcriptionDecision } : {}),
            teleconsultationRoom: {
              ...(activeAppointment.metadata?.teleconsultationRoom || {}),
              status: 'open',
              openedAt: activeAppointment.metadata?.teleconsultationRoom?.openedAt || now,
              openedBy: activeAppointment.metadata?.teleconsultationRoom?.openedBy || user.id,
              lastHeartbeatAt: now,
            },
          },
        })
        .eq('id', appointmentId)
        .eq('user_id', user.id);
    };

    void writeHeartbeat();
    const interval = window.setInterval(() => void writeHeartbeat(), 15000);
    return () => window.clearInterval(interval);
  }, [activeAppointment.metadata, appointmentId, hasJoined, isOnlineSession, roomStatus, transcriptionDecision, user?.id]);

  useEffect(() => {
    // Opening an online lobby must not create or start a transcript. The
    // consent handlers below are the only entry point for that workflow.
    if (isOnlineSession || !hasJoined) return;
    void ensureTranscript().catch((error) => {
      toast.error(error instanceof Error ? error.message : 'Não foi possível preparar a transcrição.');
    });
    setShowConsent(consentStatus === 'pending');
  }, [consentStatus, ensureTranscript, hasJoined, isOnlineSession]);

  const handleJoinSession = useCallback((selection: MediaDeviceChoice) => {
    if (isOnlineSession && !hasTranscriptionDecision) {
      setShowConsent(true);
      toast.info('Defina se a teleconsulta será transcrita antes de abrir a sala.');
      return;
    }
    if (roomStatus === 'closed') {
      toast.error('Esta sala já foi encerrada.');
      return;
    }
    setMediaSettings(selection);
    setIsAudioEnabled(selection.audioEnabled);
    setIsVideoEnabled(selection.videoEnabled);
    setShowLobby(false);
    if (!isOnlineSession) setHasJoined(true);
  }, [hasTranscriptionDecision, isOnlineSession, roomStatus]);

  const handleConferenceJoined = useCallback(() => {
    setHasJoined(true);
    setShowLobby(false);
    if (isOnlineSession) {
      void persistRoomStatus('open').catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Não foi possível abrir a sala para o paciente.');
      });
    }
    if (shouldStartTeleconsultationCapture({ transcriptionEnabled, consentStatus, isCaptureEnabled })) {
      void startCapture().catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Não foi possível iniciar a transcrição.');
      });
    }
  }, [consentStatus, isCaptureEnabled, isOnlineSession, persistRoomStatus, startCapture, transcriptionEnabled]);

  const handleGrantConsent = useCallback(async (
    method: Parameters<typeof grantConsent>[0],
    notes?: string,
  ) => {
    try {
      await persistTranscriptionDecision(true, notes);
      setShowConsent(false);
      await grantConsent(method, notes);
      if (!isOnlineSession && !speechSupported) {
        toast.warning('Transcrição presencial indisponível. A sessão seguirá com anotações protegidas.');
        return;
      }
      if (hasJoined) {
        await startCapture();
        toast.success('Consentimento registrado e transcrição iniciada.');
      } else {
        toast.success('Decisão registrada. A transcrição começará ao entrar na sessão.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível iniciar a captura.');
    }
  }, [grantConsent, hasJoined, isOnlineSession, persistTranscriptionDecision, speechSupported, startCapture]);

  const handleDeclineConsent = useCallback(async (notes?: string) => {
    try {
      await persistTranscriptionDecision(false, notes);
      setShowConsent(false);
      await declineConsent(notes);
      toast.info('A sessão continuará sem transcrição.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível registrar a decisão.');
    }
  }, [declineConsent, persistTranscriptionDecision]);

  const handleToggleCapture = useCallback(async () => {
    if (!transcriptionEnabled || consentStatus !== 'granted') {
      setShowConsent(true);
      return;
    }
    if (!captureAvailable) {
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
  }, [captureAvailable, captureState, consentStatus, isCaptureEnabled, pauseCapture, record?.status, resumeCapture, startCapture, transcriptionEnabled]);

  const toggleAudio = useCallback(() => {
    jitsiRef.current?.toggleAudio();
    setIsAudioEnabled((current) => !current);
  }, []);

  const toggleVideo = useCallback(() => {
    jitsiRef.current?.toggleVideo();
    setIsVideoEnabled((current) => !current);
  }, []);

  const toggleScreenShare = useCallback(() => {
    jitsiRef.current?.toggleScreenShare();
    setIsScreenSharing((current) => !current);
  }, []);

  const finishSession = useCallback((
    draftPending: boolean,
    summaryNoteId?: string,
    sessionTranscriptId: string | null = transcriptId,
  ) => {
    if (finishSessionInFlightRef.current) return finishSessionInFlightRef.current;

    const operation = (async () => {
      await completeClinicalSession({
        draftPending,
        sessionSummaryNoteId: summaryNoteId ?? null,
        sessionTranscriptId,
      });

      const cleanup = [clearRecovery()];
      if (!draftPending || summaryNoteId) cleanup.push(notesDraft.clearDraft());
      await Promise.all(cleanup);
      if (isFocusMode) toggleFocusMode();
      setReviewOpen(false);
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
  }, [clearRecovery, completeClinicalSession, isFocusMode, notesDraft, onSessionEnd, resetClinicalSessionCompletionAttempt, toggleFocusMode, transcriptId]);

  const requestReview = useCallback(async () => {
    if (reviewRequestedRef.current) return;
    reviewRequestedRef.current = true;
    setCompletionError(null);
    setReviewSummaryNote(null);
    try {
      if (isOnlineSession) {
        await persistRoomStatus('closed', 'therapist_left');
      }

      const shouldOpenReview = shouldOpenTeleconsultationTranscriptionReview({
        isOnlineSession,
        transcriptionEnabled,
        consentStatus,
      });
      if (!shouldOpenReview) {
        await finishSession(false, undefined, null);
        if (isOnlineSession && hasJoined) jitsiRef.current?.executeCommand('hangup');
        toast.success('Sessão concluída sem transcrição.');
        return;
      }

      let finalTranscript = transcriptText;
      let finalTranscriptId = transcriptId;
      if (consentStatus === 'granted' && captureState !== 'completed') {
        const result = await finalizeCapture();
        finalTranscript = result.text;
        finalTranscriptId = result.transcriptId;
      }
      const finalNotes = notesDraft.notes;
      setReviewTranscript(finalTranscript);
      setReviewNotes(finalNotes);
      setReviewOpen(true);
      if (isOnlineSession && hasJoined) jitsiRef.current?.executeCommand('hangup');
      if (!patientId) {
        setCompletionError('Paciente não vinculado. Não foi possível gerar o resumo clínico.');
        return;
      }
      if (!hasNetwork) {
        setCompletionError('Reconecte-se para gerar o resumo clínico pendente.');
        return;
      }
      setCompletionMode('generating');
      await retrySync();
      if (finalTranscriptId) await markReviewed();
      const result = await generateProntuario({
        patientId: patientId!,
        appointmentId,
        notes: finalNotes,
        chatHistory: finalTranscript,
        reviewMode: 'pending',
        sourceTranscriptId: finalTranscriptId,
      });
      const summaryNote = result.sessionNote || null;
      setReviewSummaryNote(summaryNote);
      if (finalTranscriptId && summaryNote?.id) await linkSummaryNote(summaryNote.id);
      setCompletionMode('idle');
    } catch (error) {
      reviewRequestedRef.current = false;
      setCompletionMode('idle');
      const message = error instanceof Error ? error.message : 'Não foi possível preparar a revisão.';
      setCompletionError(message);
      toast.error(message);
    }
  }, [appointmentId, captureState, consentStatus, finalizeCapture, finishSession, generateProntuario, hasJoined, hasNetwork, isOnlineSession, linkSummaryNote, markReviewed, notesDraft.notes, patientId, persistRoomStatus, retrySync, transcriptionEnabled, transcriptId, transcriptText]);

  const confirmSummaryNote = useCallback(async (noteId: string, finalSummary?: AISummary) => {
    if (!user?.id) throw new Error('Usuário não autenticado.');
    const now = new Date().toISOString();
    const currentSummary = reviewSummaryNote?.ai_summary || null;
    const nextSummary = finalSummary || currentSummary;
    const originalSummary = reviewSummaryNote?.original_ai_summary || currentSummary;
    const originalTranscription = reviewSummaryNote?.original_transcription || reviewSummaryNote?.transcription || null;
    const summaryWasEdited = Boolean(
      finalSummary &&
      JSON.stringify(finalSummary) !== JSON.stringify(currentSummary)
    );
    const { data, error } = await supabase
      .from('session_notes')
      .update({
        ai_summary: nextSummary,
        original_ai_summary: originalSummary,
        original_transcription: originalTranscription,
        ai_summary_edited: Boolean(reviewSummaryNote?.ai_summary_edited || summaryWasEdited),
        ai_summary_edited_at: summaryWasEdited ? now : reviewSummaryNote?.ai_summary_edited_at || null,
        ai_summary_edited_by: summaryWasEdited ? user.id : reviewSummaryNote?.ai_summary_edited_by || null,
        ai_summary_edit_count: summaryWasEdited ? (reviewSummaryNote?.ai_summary_edit_count || 0) + 1 : reviewSummaryNote?.ai_summary_edit_count || 0,
        review_status: 'confirmed',
        confirmed_at: now,
        confirmed_by: user.id,
        locked_at: now,
      })
      .eq('id', noteId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    const note = data as SessionNote;
    setReviewSummaryNote(note);
    if (note.patient_id) {
      queryClient.invalidateQueries({ queryKey: ['sessionNotes', note.patient_id] });
      queryClient.invalidateQueries({ queryKey: ['pendingSessionReviews', note.patient_id] });
      queryClient.invalidateQueries({ queryKey: ['patientTimeline', note.patient_id] });
      queryClient.invalidateQueries({ queryKey: ['patientSessionSummary'] });
    }
    return note;
  }, [queryClient, reviewSummaryNote, user?.id]);

  const confirmGeneratedSummary = useCallback(async (finalSummary?: AISummary) => {
    if (!reviewSummaryNote?.id || !hasNetwork) return;
    setCompletionMode('saving');
    setCompletionError(null);
    try {
      const confirmedNote = await confirmSummaryNote(reviewSummaryNote.id, finalSummary);
      await finishSession(false, confirmedNote.id);
      toast.success('Sessão concluída e resumo confirmado.');
    } catch (error) {
      setCompletionError(error instanceof Error ? error.message : 'Não foi possível confirmar o resumo.');
    } finally {
      setCompletionMode('idle');
    }
  }, [confirmSummaryNote, finishSession, hasNetwork, reviewSummaryNote?.id]);

  const preserveGeneratedSummaryForLater = useCallback(async () => {
    if (!reviewSummaryNote?.id || !hasNetwork) return;
    setCompletionMode('saving');
    setCompletionError(null);
    try {
      await finishSession(true, reviewSummaryNote.id);
      toast.warning('Sessão concluída. O resumo ficou pendente por até 48h.');
    } catch (error) {
      setCompletionError(error instanceof Error ? error.message : 'Não foi possível salvar a pendência.');
    } finally {
      setCompletionMode('idle');
    }
  }, [finishSession, hasNetwork, reviewSummaryNote?.id]);

  return {
    user,
    patient,
    patientId,
    patientName,
    appointmentId,
    activeAppointment,
    therapistName,
    therapistAvatar,
    isOnlineSession,
    roomName,
    effectiveMeetLink,
    inviteLoading: invite.isLoading,
    inviteError: invite.error,
    jitsiToken,
    jitsiError,
    isLoadingToken,
    jitsiRef,
    reviewRequestedRef,
    showLobby,
    hasJoined,
    showConsent,
    isSavingTranscriptionDecision,
    transcriptionDecision,
    transcriptionEnabled,
    hasTranscriptionDecision,
    roomStatus,
    canInvitePatient,
    mediaSettings,
    isScreenSharing,
    isAudioEnabled,
    isVideoEnabled,
    isChatOpen,
    showInviteModal,
    elapsedSeconds,
    reviewOpen,
    reviewTranscript,
    reviewNotes,
    reviewSummaryNote,
    completionMode,
    completionError,
    isFocusMode,
    isProcessing,
    notesDraft,
    segments,
    captureState,
    syncState,
    hasNetwork,
    lastError,
    interimText,
    isCaptureEnabled,
    speechSupported,
    captureAvailable,
    captureLabel,
    syncLabel,
    appendJitsiSegment,
    retrySync,
    handleJoinSession,
    handleConferenceJoined,
    handleGrantConsent,
    handleDeclineConsent,
    handleToggleCapture,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    toggleFocusMode,
    requestReview,
    completeWithAi: confirmGeneratedSummary,
    completeWithoutAi: preserveGeneratedSummaryForLater,
    setHasJoined,
    setShowLobby,
    setIsAudioEnabled,
    setIsVideoEnabled,
    setIsChatOpen,
    openPatientInvite,
    requestTranscriptionDecision,
    dismissTranscriptionDecision,
    setShowInviteModal,
    setReviewTranscript,
    setReviewNotes,
  };
};
