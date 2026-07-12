import { Button } from '@/components/ui/button';
import type { MediaDeviceChoice } from '@/hooks/use-media-readiness';
import { cn } from '@/lib/utils';
import type { User } from '@supabase/supabase-js';
import {
  AlertCircle,
  Cloud,
  CloudOff,
  Loader2,
  Mic,
  NotebookPen,
  WifiOff,
} from 'lucide-react';
import type { RefObject } from 'react';
import { JitsiMeet, type JitsiRef } from './JitsiMeet';
import { RiskAlert } from './RiskAlert';
import { SessionChat } from './SessionChat';
import { SessionControls } from './SessionControls';

interface DesktopSessionStageProps {
  user: User | null;
  patientName: string;
  appointmentId: string;
  patientRiskScore: number;
  therapistName: string;
  therapistAvatar: string;
  isOnlineSession: boolean;
  roomName: string;
  effectiveMeetLink: string;
  jitsiToken?: string;
  jitsiError?: Error | null;
  mediaSettings: MediaDeviceChoice | null;
  jitsiRef: RefObject<JitsiRef>;
  reviewRequestedRef: RefObject<boolean>;
  hasJoined: boolean;
  elapsedLabel: string;
  captureLabel: string;
  syncLabel: string;
  syncState: string;
  hasNetwork: boolean;
  isCaptureEnabled: boolean;
  transcriptionEnabled: boolean;
  captureAvailable: boolean;
  speechSupported: boolean;
  interimText?: string;
  isFocusMode: boolean;
  isProcessing: boolean;
  isScreenSharing: boolean;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isChatOpen: boolean;
  onConferenceJoined: () => void;
  onMeetingEnd: () => void;
  onTranscriptUpdate: (entry: { participant: { name: string }; text: string }) => void;
  onMuteStatusChanged: (status: { audio: boolean; video: boolean }) => void;
  onRetrySync: () => void;
  onToggleFocus: () => void;
  onRequestReview: () => void;
  onToggleScreenShare: () => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleChat: () => void;
  onOpenInvite: () => void;
  onToggleCapture: () => void;
  onCloseChat: () => void;
}

export const DesktopSessionStage = ({
  user,
  patientName,
  appointmentId,
  patientRiskScore,
  therapistName,
  therapistAvatar,
  isOnlineSession,
  roomName,
  effectiveMeetLink,
  jitsiToken,
  jitsiError,
  mediaSettings,
  jitsiRef,
  reviewRequestedRef,
  hasJoined,
  elapsedLabel,
  captureLabel,
  syncLabel,
  syncState,
  hasNetwork,
  isCaptureEnabled,
  transcriptionEnabled,
  captureAvailable,
  speechSupported,
  interimText,
  isFocusMode,
  isProcessing,
  isScreenSharing,
  isAudioEnabled,
  isVideoEnabled,
  isChatOpen,
  onConferenceJoined,
  onMeetingEnd,
  onTranscriptUpdate,
  onMuteStatusChanged,
  onRetrySync,
  onToggleFocus,
  onRequestReview,
  onToggleScreenShare,
  onToggleAudio,
  onToggleVideo,
  onToggleChat,
  onOpenInvite,
  onToggleCapture,
  onCloseChat,
}: DesktopSessionStageProps) => {
  const renderStage = () => {
    if (!isOnlineSession) {
      return (
        <div className="relative flex h-full flex-col items-center justify-center overflow-hidden px-8 text-center">
          <div className="pointer-events-none absolute inset-x-[18%] top-0 h-1/2 bg-gradient-to-b from-white/[0.035] to-transparent" />
          <div className="relative z-10 flex flex-col items-center">
            <div
              className={cn(
                'flex h-32 w-32 items-center justify-center rounded-[38px] border transition-colors duration-300 motion-reduce:transition-none',
                isCaptureEnabled
                  ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-500'
                  : 'border-white/[0.055] bg-white/[0.035] text-white/45',
              )}
            >
              {isCaptureEnabled ? <Mic className="h-14 w-14" /> : <NotebookPen className="h-14 w-14" />}
            </div>
            <p className="mt-7 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Sessão presencial</p>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.055em]">{captureLabel}</h2>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">
              {speechSupported
                ? 'Transcrição, anotações e contexto clínico permanecem disponíveis sem esconder o atendimento.'
                : 'O navegador não oferece reconhecimento de fala. As anotações continuam protegidas e recuperáveis.'}
            </p>
            {interimText ? (
              <p className="mt-5 max-w-xl rounded-2xl bg-white/[0.045] px-5 py-3 text-xs italic text-white/55">{interimText}</p>
            ) : null}
          </div>
        </div>
      );
    }

    if (jitsiError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center text-rose-400">
          <AlertCircle className="h-10 w-10" />
          <p className="font-bold">{jitsiError.message}</p>
          <Button variant="outline" onClick={() => window.location.reload()} className="border-rose-500/20 text-rose-500">Recarregar</Button>
        </div>
      );
    }

    if (!jitsiToken) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 text-white/70">
          <Loader2 className="h-9 w-9 animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Conectando com segurança</p>
        </div>
      );
    }

    return (
      <JitsiMeet
        ref={jitsiRef}
        roomName={roomName}
        jwt={jitsiToken}
        userName={therapistName}
        userEmail={user?.email}
        userAvatarUrl={therapistAvatar}
        subject={patientName || 'Consulta'}
        mediaSettings={mediaSettings}
        transcriptionEnabled={transcriptionEnabled}
        onMeetingEnd={() => {
          if (!reviewRequestedRef.current) onMeetingEnd();
        }}
        onTranscriptUpdate={onTranscriptUpdate}
        onMuteStatusChanged={onMuteStatusChanged}
        onConferenceJoined={onConferenceJoined}
      />
    );
  };

  return (
    <section className="teleconsultation-stage relative h-full min-h-0 overflow-hidden rounded-[30px]">
      {renderStage()}
      <RiskAlert riskScore={patientRiskScore} />

      <div className="pointer-events-none absolute left-5 top-5 z-30 flex items-center gap-2">
        <div className="rounded-full border border-white/[0.07] bg-black/72 px-3.5 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-white">
          {elapsedLabel}
        </div>
        <div
          className={cn(
            'flex items-center gap-2 rounded-full border px-3.5 py-2 text-[9px] font-black uppercase tracking-[0.14em]',
            isCaptureEnabled
              ? 'border-emerald-400/25 bg-emerald-500/16 text-emerald-200'
              : 'border-white/[0.07] bg-black/72 text-white/65',
          )}
        >
          <span className={cn('h-2 w-2 rounded-full', isCaptureEnabled ? 'animate-pulse bg-emerald-400 motion-reduce:animate-none' : 'bg-white/35')} />
          {captureLabel}
        </div>
      </div>

      <button
        type="button"
        onClick={onRetrySync}
        aria-label={`Estado de sincronização: ${syncLabel}. Tentar novamente`}
        className={cn(
          'teleconsultation-action absolute right-5 top-5 z-30 flex h-11 items-center gap-2 rounded-full border px-4 text-[9px] font-black uppercase tracking-[0.12em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/55',
          syncState === 'error'
            ? 'border-rose-400/25 bg-rose-500/16 text-rose-200'
            : !hasNetwork
              ? 'border-amber-400/25 bg-amber-500/16 text-amber-100'
              : 'border-white/[0.07] bg-black/72 text-white/65',
        )}
      >
        {syncState === 'syncing' ? <Loader2 className="h-4 w-4 animate-spin" /> : !hasNetwork ? <WifiOff className="h-4 w-4" /> : syncState === 'error' ? <CloudOff className="h-4 w-4" /> : <Cloud className="h-4 w-4" />}
        {syncLabel}
      </button>

      {hasJoined ? (
        <div className="pointer-events-none absolute bottom-5 left-0 right-0 z-40">
          <SessionControls
            isFocusMode={isFocusMode}
            onToggleFocus={onToggleFocus}
            isProcessing={isProcessing}
            onEndSession={onRequestReview}
            isScreenSharing={isScreenSharing}
            onToggleScreenShare={onToggleScreenShare}
            isOnline={isOnlineSession}
            isAudioEnabled={isAudioEnabled}
            isVideoEnabled={isVideoEnabled}
            onToggleAudio={onToggleAudio}
            onToggleVideo={onToggleVideo}
            meetLink={effectiveMeetLink}
            onToggleChat={onToggleChat}
            isChatOpen={isChatOpen}
            onOpenInvite={onOpenInvite}
            isCaptureEnabled={isCaptureEnabled}
            captureStatus={captureLabel}
            captureDisabled={!captureAvailable}
            onToggleCapture={onToggleCapture}
          />
        </div>
      ) : null}

      {hasJoined && isOnlineSession && user ? (
        <SessionChat
          isOpen={isChatOpen}
          onClose={onCloseChat}
          appointmentId={appointmentId}
          currentUserId={user.id}
        />
      ) : null}
    </section>
  );
};
