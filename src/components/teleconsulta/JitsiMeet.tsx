import type { MediaDeviceChoice } from '@/hooks/use-media-readiness';
import { forwardRef, memo, useEffect, useImperativeHandle, useRef } from 'react';

interface JitsiMeetProps {
  roomName: string;
  jwt?: string;
  userName: string;
  userEmail?: string;
  userAvatarUrl?: string;
  subject?: string;
  mediaSettings?: MediaDeviceChoice | null;
  transcriptionEnabled?: boolean;
  onMeetingEnd: () => void;
  onTranscriptUpdate?: (entry: { participant: { name: string }; text: string }) => void;
  onMuteStatusChanged?: (status: { audio: boolean; video: boolean }) => void;
  onConferenceJoined?: () => void;
}

export interface JitsiRef {
  toggleAudio: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => void;
  executeCommand: (command: string, ...args: any[]) => void;
}

const JitsiMeetComponent = forwardRef<JitsiRef, JitsiMeetProps>(({
  roomName,
  jwt,
  userName,
  userEmail,
  userAvatarUrl,
  subject,
  mediaSettings,
  transcriptionEnabled = false,
  onMeetingEnd,
  onTranscriptUpdate,
  onMuteStatusChanged,
  onConferenceJoined,
}, ref) => {
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const callbacksRef = useRef({
    onMeetingEnd,
    onTranscriptUpdate: transcriptionEnabled ? onTranscriptUpdate : undefined,
    onMuteStatusChanged,
    onConferenceJoined,
  });
  const muteStateRef = useRef({
    audio: mediaSettings ? !mediaSettings.audioEnabled : false,
    video: mediaSettings ? !mediaSettings.videoEnabled : false,
  });

  useEffect(() => {
    callbacksRef.current = {
      onMeetingEnd,
      onTranscriptUpdate: transcriptionEnabled ? onTranscriptUpdate : undefined,
      onMuteStatusChanged,
      onConferenceJoined,
    };
  }, [onConferenceJoined, onMeetingEnd, onMuteStatusChanged, onTranscriptUpdate, transcriptionEnabled]);

  useImperativeHandle(ref, () => ({
    toggleAudio: () => apiRef.current?.executeCommand('toggleAudio'),
    toggleVideo: () => apiRef.current?.executeCommand('toggleVideo'),
    toggleScreenShare: () => apiRef.current?.executeCommand('toggleShareScreen'),
    executeCommand: (command: string, ...args: any[]) => apiRef.current?.executeCommand(command, ...args),
  }));

  useEffect(() => {
    let disposed = false;
    let injectedScript: HTMLScriptElement | null = null;

    if (!window.JitsiMeetExternalAPI) {
      const script = document.createElement('script');
      script.src = 'https://8x8.vc/vpaas-magic-cookie-dc267e44c7014498a3a128625367fc67/external_api.js';
      script.async = true;
      script.onload = initJitsi;
      document.body.appendChild(script);
      injectedScript = script;
    } else {
      initJitsi();
    }

    function initJitsi() {
      if (disposed || !jitsiContainerRef.current || apiRef.current) return;

      const domain = '8x8.vc';
      const options = {
        roomName,
        width: '100%',
        height: '100%',
        parentNode: jitsiContainerRef.current,
        jwt,
        lang: 'pt-BR',
        userInfo: {
          displayName: userName,
          email: userEmail,
          avatarUrl: userAvatarUrl,
        },
        configOverwrite: {
          prejoinPageEnabled: false,
          prejoinConfig: {
            enabled: false,
          },
          startWithAudioMuted: muteStateRef.current.audio,
          startWithVideoMuted: muteStateRef.current.video,
          requireDisplayName: false,
          skipMeetingPrejoin: true,
          disableDeepLinking: true,
          disableChat: true,
          disableInviteFunctions: true,
          enableWelcomePage: false,
          enableClosePage: false,
          toolbarButtons: [],
          mainToolbarButtons: [],
          buttonsWithNotifyClick: [],
          toolbarConfig: {
            alwaysVisible: false,
            autoHideWhileChatIsOpen: true,
            timeout: 1,
          },
          notifications: [],
          disable1On1Mode: true,
          disableProfile: true,
          transcribingEnabled: transcriptionEnabled,
          transcription: {
            enabled: transcriptionEnabled,
          },
          startWithSubtitles: false,
          hideConferenceTimer: true,
          hideConferenceSubject: false,
          subject: subject || 'Teleconsulta NeuroNex',
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: [],
          TOOLBAR_ALWAYS_VISIBLE: false,
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          SHOW_BRAND_WATERMARK: false,
          SHOW_POWERED_BY: false,
          DEFAULT_BACKGROUND: '#050505',
          DISABLE_VIDEO_BACKGROUND: true,
          filmStripOnly: false,
          VERTICAL_FILMSTRIP: true,
          HIDE_INVITE_MORE_HEADER: true,
          recentListEnabled: false,
          launchInWebOptionEnabled: false,
        },
      };

      const api = new window.JitsiMeetExternalAPI(domain, options);
      apiRef.current = api;

      const suppressNativeControls = () => {
        try {
          api.executeCommand('overwriteConfig', {
            toolbarButtons: [],
            mainToolbarButtons: [],
            toolbarConfig: { alwaysVisible: false, timeout: 1 },
          });
        } catch {
          // Older Jitsi deployments already receive the same values through
          // configOverwrite and can safely ignore this runtime reinforcement.
        }
      };

      suppressNativeControls();
      const iframe = typeof api.getIFrame === 'function' ? api.getIFrame() : null;
      if (iframe) {
        iframe.title = `Sala de teleconsulta com ${subject || 'paciente'}`;
        iframe.referrerPolicy = 'no-referrer';
        iframe.style.backgroundColor = '#050505';
      }

      if (subject) {
        window.setTimeout(() => {
          api.executeCommand('subject', subject);
        }, 1000);
      }

      api.addEventListeners({
        readyToClose: () => callbacksRef.current.onMeetingEnd(),
        videoConferenceJoined: async () => {
          suppressNativeControls();
          try {
            if (mediaSettings?.audioInputId && api.setAudioInputDevice) {
              await api.setAudioInputDevice(mediaSettings.audioInputLabel || '', mediaSettings.audioInputId);
            }
            if (mediaSettings?.audioOutputId && api.setAudioOutputDevice) {
              await api.setAudioOutputDevice(mediaSettings.audioOutputLabel || '', mediaSettings.audioOutputId);
            }
            if (mediaSettings?.videoInputId && api.setVideoInputDevice) {
              await api.setVideoInputDevice(mediaSettings.videoInputLabel || '', mediaSettings.videoInputId);
            }
          } catch (deviceError) {
            console.warn('[JitsiMeet] Não foi possível aplicar todos os dispositivos do pré-join.', deviceError);
          }
          callbacksRef.current.onConferenceJoined?.();
        },
        transcriptionChunkReceived: (data: any) => {
          const participantName = data.participantName || 'Participante';
          const transcriptText = data.transcript?.map((item: any) => item.text).join(' ') || '';
          if (transcriptText) {
            callbacksRef.current.onTranscriptUpdate?.({
              participant: { name: participantName },
              text: transcriptText,
            });
          }
        },
        audioMuteStatusChanged: (data: any) => {
          muteStateRef.current.audio = Boolean(data.muted);
          callbacksRef.current.onMuteStatusChanged?.({ ...muteStateRef.current });
        },
        videoMuteStatusChanged: (data: any) => {
          muteStateRef.current.video = Boolean(data.muted);
          callbacksRef.current.onMuteStatusChanged?.({ ...muteStateRef.current });
        },
      });
    }

    return () => {
      disposed = true;
      if (injectedScript) injectedScript.onload = null;
      if (apiRef.current) {
        apiRef.current.dispose();
        apiRef.current = null;
      }
    };
    // The embedded meeting is intentionally initialized once for this mounted session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={jitsiContainerRef}
      className="h-full min-h-0 w-full overflow-hidden bg-[#050505] [&>iframe]:!h-full [&>iframe]:!min-h-0 [&>iframe]:!border-0"
      style={{ pointerEvents: 'auto' }}
    />
  );
});

export const JitsiMeet = memo(JitsiMeetComponent);
