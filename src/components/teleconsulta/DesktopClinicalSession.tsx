import { useEffect, useRef } from 'react';
import { useDesktopClinicalSession, formatSessionElapsed } from '@/hooks/use-desktop-clinical-session';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Appointment } from '@/types';
import { DesktopSessionReviewDialog } from './DesktopSessionReviewDialog';
import { DesktopSessionStage } from './DesktopSessionStage';
import { DesktopSessionWorkspace } from './DesktopSessionWorkspace';
import { DesktopTeleconsultationLobby } from './DesktopTeleconsultationLobby';
import { InvitePatientModal } from './InvitePatientModal';
import { TranscriptionConsentPanel } from './TranscriptionConsentPanel';

interface DesktopClinicalSessionProps {
  activeAppointment: Appointment;
  patientName: string;
  onSessionEnd: () => void;
  openInviteOnMount?: boolean;
  initialWorkspaceTab?: 'transcript' | 'notes' | 'patient';
}

export const DesktopClinicalSession = ({ activeAppointment, patientName, onSessionEnd, openInviteOnMount = false, initialWorkspaceTab = 'transcript' }: DesktopClinicalSessionProps) => {
  const session = useDesktopClinicalSession(activeAppointment, patientName, onSessionEnd);
  const inviteRequestedRef = useRef(false);
  const {
    hasTranscriptionDecision,
    openPatientInvite,
    requestTranscriptionDecision,
    dismissTranscriptionDecision,
  } = session;

  useEffect(() => {
    if (!openInviteOnMount || inviteRequestedRef.current) return;

    if (!hasTranscriptionDecision) {
      requestTranscriptionDecision();
      return;
    }

    inviteRequestedRef.current = true;
    openPatientInvite();
  }, [hasTranscriptionDecision, openInviteOnMount, openPatientInvite, requestTranscriptionDecision]);

  const consentDialog =
    session.showConsent && !session.reviewOpen ? (
      <Dialog open={session.showConsent} onOpenChange={(open) => {
        if (!open) dismissTranscriptionDecision();
      }}>
        <DialogContent
          showCloseButton={false}
          overlayClassName='teleconsultation-overlay !z-[260] !backdrop-blur-none'
          contentContainerClassName='!z-[261]'
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            dismissTranscriptionDecision();
          }}
          onPointerDownOutside={(event) => event.preventDefault()}
          data-synapse-target='transcription-decision'
          aria-label='Decisão de transcrição'
        className='teleconsultation-desktop teleconsultation-surface !w-[min(680px,calc(100vw-2.5rem))] !max-w-[min(680px,calc(100vw-2.5rem))] !gap-0 !overflow-hidden !rounded-[30px] !p-0'
        >
          <DialogTitle className='sr-only'>Decisão de transcrição</DialogTitle>
          <DialogDescription className='sr-only'>
            Escolha se esta teleconsulta poderá ser transcrita antes de entrar na sala.
          </DialogDescription>
          <TranscriptionConsentPanel
            patientName={patientName}
            isPending={session.isSavingTranscriptionDecision || session.captureState === 'restoring' || session.captureState === 'finalizing'}
            onGrant={session.handleGrantConsent}
            onDecline={session.handleDeclineConsent}
          />
        </DialogContent>
      </Dialog>
    ) : null;

  if (session.showLobby) {
    return (
      <>
        <div className='desktop-lumen-page teleconsultation-shell teleconsultation-desktop fixed inset-x-0 top-[var(--desktop-navbar-clearance)] z-[100] h-[calc(100dvh-var(--desktop-navbar-clearance))] min-h-0 overflow-hidden bg-transparent'>
          <div className='relative z-10 h-full min-h-0 overflow-hidden'>
            <DesktopTeleconsultationLobby
              patientName={patientName}
              patient={session.patient}
              appointmentId={session.appointmentId}
              appointmentStart={activeAppointment.start_time}
              meetLink={session.effectiveMeetLink}
              therapistName={session.therapistName}
              isOnline={session.isOnlineSession}
              isLoadingToken={session.isOnlineSession && session.isLoadingToken}
              canInvitePatient={session.canInvitePatient}
              hasTranscriptionDecision={session.hasTranscriptionDecision}
              roomStatus={session.roomStatus}
              onRequireTranscriptionDecision={session.requestTranscriptionDecision}
              onJoin={session.handleJoinSession}
            />
          </div>
        </div>
        {consentDialog}
      </>
    );
  }

  return (
    <>
      <div className='desktop-lumen-page teleconsultation-shell teleconsultation-desktop fixed inset-x-0 top-[var(--desktop-navbar-clearance)] z-[100] h-[calc(100dvh-var(--desktop-navbar-clearance))] min-h-0 overflow-hidden bg-transparent'>
        <div
          className={cn(
            'relative z-10 grid h-full min-h-0 grid-rows-[minmax(0,1fr)] items-stretch gap-4 px-4 pb-4 pt-2 sm:px-5 sm:pb-5 sm:pt-3 xl:gap-5 xl:px-6 xl:pb-6',
            session.isFocusMode
              ? 'grid-cols-1'
              : 'grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(280px,36vh)] lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_348px] 2xl:grid-cols-[minmax(0,1fr)_376px]',
          )}
        >
          <DesktopSessionStage
            user={session.user}
            patientName={patientName}
            appointmentId={session.appointmentId}
            patientRiskScore={session.patient?.risk_score || 0}
            therapistName={session.therapistName}
            therapistAvatar={session.therapistAvatar}
            isOnlineSession={session.isOnlineSession}
            roomName={session.roomName}
            effectiveMeetLink={session.effectiveMeetLink}
            jitsiToken={session.jitsiToken}
            jitsiError={session.jitsiError}
            mediaSettings={session.mediaSettings}
            jitsiRef={session.jitsiRef}
            reviewRequestedRef={session.reviewRequestedRef}
            hasJoined={session.hasJoined}
            elapsedLabel={formatSessionElapsed(session.elapsedSeconds)}
            captureLabel={session.captureLabel}
            syncLabel={session.syncLabel}
            syncState={session.syncState}
            hasNetwork={session.hasNetwork}
            isCaptureEnabled={session.isCaptureEnabled}
            transcriptionEnabled={session.transcriptionEnabled}
            captureAvailable={session.captureAvailable}
            speechSupported={session.speechSupported}
            interimText={session.interimText}
            isFocusMode={session.isFocusMode}
            isProcessing={session.isProcessing}
            isScreenSharing={session.isScreenSharing}
            isAudioEnabled={session.isAudioEnabled}
            isVideoEnabled={session.isVideoEnabled}
            isChatOpen={session.isChatOpen}
            onConferenceJoined={session.handleConferenceJoined}
            onMeetingEnd={() => void session.requestReview()}
            onTranscriptUpdate={session.appendJitsiSegment}
            onMuteStatusChanged={({ audio, video }) => {
              session.setIsAudioEnabled(!audio);
              session.setIsVideoEnabled(!video);
            }}
            onRetrySync={() => void session.retrySync()}
            onToggleFocus={session.toggleFocusMode}
            onRequestReview={() => void session.requestReview()}
            onToggleScreenShare={session.toggleScreenShare}
            onToggleAudio={session.toggleAudio}
            onToggleVideo={session.toggleVideo}
            onToggleChat={() => session.setIsChatOpen((current) => !current)}
            onOpenInvite={session.openPatientInvite}
            onToggleCapture={() => void session.handleToggleCapture()}
            onCloseChat={() => session.setIsChatOpen(false)}
          />

          {!session.isFocusMode ? (
            <DesktopSessionWorkspace
              initialTab={initialWorkspaceTab}
              patient={session.patient}
              patientName={patientName}
              segments={session.segments}
              interimText={session.interimText}
              notes={session.notesDraft.notes}
              onNotesChange={session.notesDraft.setNotes}
              notesSyncState={session.notesDraft.syncState}
              captureLabel={session.captureLabel}
              syncLabel={session.syncLabel}
              syncState={session.syncState}
              isCaptureEnabled={session.isCaptureEnabled}
              captureAvailable={session.captureAvailable}
              onToggleCapture={() => void session.handleToggleCapture()}
              onRetrySync={() => void session.retrySync()}
            />
          ) : null}
        </div>
      </div>

      <div data-synapse-target='patient-invite'>
        <InvitePatientModal
          isOpen={session.showInviteModal}
          onClose={() => session.setShowInviteModal(false)}
          appointmentId={session.appointmentId}
          patient={session.patient}
          meetLink={session.effectiveMeetLink}
          therapistName={session.therapistName}
        />
      </div>

      {session.hasJoined ? consentDialog : null}

      <DesktopSessionReviewDialog
        open={session.reviewOpen}
        patientName={patientName}
        transcript={session.reviewTranscript}
        notes={session.reviewNotes}
        segmentsCount={session.segments.length}
        hasNetwork={session.hasNetwork}
        canGenerate={Boolean(session.patientId)}
        isProcessing={session.isProcessing}
        completionMode={session.completionMode}
        error={session.completionError || session.lastError}
        summaryNote={session.reviewSummaryNote}
        onGenerate={(summary) => void session.completeWithAi(summary)}
        onPreserve={() => void session.completeWithoutAi()}
      />
    </>
  );
};
