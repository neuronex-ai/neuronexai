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
        <div className="desktop-retina-panel relative flex h-full flex-col items-center justify-center overflow-hidden bg-white/45 px-10 text-center backdrop-blur-[60px] dark:bg-[#121212]/88">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.045] blur-[140px]" />
          <div className="relative z-10 flex flex-col items-center">
            <div
              className={cn(
                'flex h-36 w-36 items-center justify-center rounded-[42px] border shadow-2xl transition',
                isCaptureEnabled
                  ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-500'
                  : 'border-border/45 bg-card/70 text-muted-foreground dark:border-white/10',
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
              <p className="mt-5 max-w-xl rounded-2xl bg-card/65 px-5 py-3 text-xs italic text-muted-foreground">{interimText}</p>
            ) : null}
          </div>
        </div>
      );
    }

    if (jitsiError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 bg-card px-8 text-center text-rose-500">
          <AlertCircle className="h-10 w-10" />
          <p className="font-bold">{jitsiError.message}</p>
          <Button variant="outline" onClick={() => window.location.reload()} className="border-rose-500/20 text-rose-500">Recarregar</Button>
        </div>
      );
    }

    if (!jitsiToken) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 bg-card">
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
    <section className="desktop-retina-frame relative min-h-0 overflow-hidden rounded-[34px] border border-border/45 bg-black dark:border-white/10">
      {renderStage()}
      <RiskAlert riskScore={patientRiskScore} />

      <div className="pointer-events-none absolute left-5 top-5 z-30 flex items-center gap-2">
        <div className="rounded-full border border-white/12 bg-black/48 px-4 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-white backdrop-blur-xl">
          {elapsedLabel}
        </div>
        <div
          className={cn(
            'flex items-center gap-2 rounded-full border px-4 py-2 text-[9px] font-black uppercase tracking-[0.14em] backdrop-blur-xl',
            isCaptureEnabled
              ? 'border-emerald-400/25 bg-emerald-500/16 text-emerald-200'
              : 'border-white/12 bg-black/48 text-white/70',
          )}
        >
          <span className={cn('h-2 w-2 rounded-full', isCaptureEnabled ? 'animate-pulse bg-emerald-400' : 'bg-white/35')} />
          {captureLabel}
        </div>
      </div>

      <button
        type="button"
        onClick={onRetrySync}
        className={cn(
          'absolute right-5 top-5 z-30 flex h-10 items-center gap-2 rounded-full border px-4 text-[9px] font-black uppercase tracking-[0.12em] backdrop-blur-xl',
          syncState === 'error'
            ? 'border-rose-400/25 bg-rose-500/16 text-rose-200'
            : !hasNetwork
              ? 'border-amber-400/25 bg-amber-500/16 text-amber-100'
              : 'border-white/12 bg-black/48 text-white/70',
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
          currentUserName={therapistName}
        />
      ) : null}
    </section>
  );
};
