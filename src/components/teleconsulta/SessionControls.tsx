import {
  Copy,
  Eye,
  EyeOff,
  MessageSquare,
  Mic,
  MicOff,
  MonitorOff,
  MonitorUp,
  Pause,
  Phone,
  Play,
  Send,
  Video,
  VideoOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

interface SessionControlsProps {
  isFocusMode: boolean;
  onToggleFocus: () => void;
  isProcessing: boolean;
  onEndSession: () => void;
  isScreenSharing: boolean;
  onToggleScreenShare: () => void;
  isOnline: boolean;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  meetLink?: string;
  onToggleChat?: () => void;
  isChatOpen?: boolean;
  onOpenInvite?: () => void;
  isCaptureEnabled?: boolean;
  captureStatus?: string;
  captureDisabled?: boolean;
  onToggleCapture?: () => void;
}

export const SessionControls = ({
  isFocusMode,
  onToggleFocus,
  isProcessing,
  onEndSession,
  isScreenSharing,
  onToggleScreenShare,
  isOnline,
  isAudioEnabled,
  isVideoEnabled,
  onToggleAudio,
  onToggleVideo,
  meetLink,
  onToggleChat,
  isChatOpen = false,
  onOpenInvite,
  isCaptureEnabled = false,
  captureStatus = 'Transcrição',
  captureDisabled = false,
  onToggleCapture,
}: SessionControlsProps) => {
  const handleCopyLink = () => {
    if (meetLink) {
      void navigator.clipboard.writeText(meetLink);
      toast.success('Link copiado para a área de transferência');
    }
  };

  const ControlButton = ({
    icon: Icon,
    active,
    onClick,
    label,
    danger = false,
    secondary = false,
    disabled = false,
    className,
  }: any) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={cn(
            'group relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full transition-all duration-500 ease-apple',
            danger
              ? 'border border-rose-500/20 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20'
              : secondary
                ? 'border border-white/10 bg-white/5 text-zinc-600 hover:bg-white/10 hover:text-zinc-900 dark:border-transparent dark:bg-white/5 dark:text-zinc-400 dark:hover:text-white'
                : active
                  ? 'scale-110 bg-zinc-900 text-white shadow-[0_0_20px_rgba(0,0,0,0.1)] dark:bg-white dark:text-black dark:shadow-[0_0_20px_rgba(255,255,255,0.2)]'
                  : 'border border-white/10 bg-white/10 text-zinc-600 hover:border-white/20 hover:bg-white/20 dark:border-transparent dark:bg-black/30 dark:text-zinc-400 dark:hover:border-transparent dark:hover:bg-white/10',
            disabled && 'cursor-not-allowed opacity-40',
            className,
          )}
        >
          <Icon className={cn('h-5 w-5 transition-all duration-300', danger ? 'fill-current' : 'stroke-[2]', active && 'scale-90')} />
          {danger ? <div className="absolute inset-0 bg-rose-500/10 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" /> : null}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="rounded-full border border-white/20 bg-white/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-900 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/80 dark:text-zinc-100">
        {label}
      </TooltipContent>
    </Tooltip>
  );

  return (
    <div className="pointer-events-none mx-auto flex w-full max-w-5xl items-center justify-between px-6">
      <div
        className={cn(
          'flex items-center gap-3 transition-all duration-300',
          isChatOpen ? 'pointer-events-none -translate-x-5 opacity-0' : 'pointer-events-auto opacity-100',
        )}
      >
        {isOnline ? (
          <>
            <ControlButton icon={Copy} secondary onClick={handleCopyLink} label="Copiar link" />
            <ControlButton icon={MessageSquare} secondary onClick={onToggleChat} label="Chat" />
            <ControlButton icon={Send} secondary onClick={onOpenInvite} label="Enviar convite" />
          </>
        ) : null}
      </div>

      <div className="desktop-retina-frame pointer-events-auto flex items-center gap-4 rounded-[40px] border border-white/20 bg-white/60 px-8 py-4 backdrop-blur-[40px] transition-all duration-500 hover:border-white/30 dark:border-transparent dark:bg-[#080808]/88 dark:hover:border-transparent">
        {isOnline ? (
          <>
            <ControlButton
              icon={isAudioEnabled ? Mic : MicOff}
              active={!isAudioEnabled}
              onClick={onToggleAudio}
              label={isAudioEnabled ? 'Mutar' : 'Desmutar'}
            />
            <ControlButton
              icon={isVideoEnabled ? Video : VideoOff}
              active={!isVideoEnabled}
              onClick={onToggleVideo}
              label={isVideoEnabled ? 'Desligar vídeo' : 'Ligar vídeo'}
            />
            <ControlButton
              icon={isScreenSharing ? MonitorOff : MonitorUp}
              active={isScreenSharing}
              onClick={onToggleScreenShare}
              label={isScreenSharing ? 'Parar compartilhamento' : 'Compartilhar tela'}
            />
          </>
        ) : null}

        {onToggleCapture ? (
          <ControlButton
            icon={isCaptureEnabled ? Pause : Play}
            active={isCaptureEnabled}
            onClick={onToggleCapture}
            disabled={captureDisabled}
            label={isCaptureEnabled ? 'Pausar transcrição' : captureStatus}
          />
        ) : null}

        <ControlButton
          icon={isFocusMode ? EyeOff : Eye}
          active={isFocusMode}
          onClick={onToggleFocus}
          label={isFocusMode ? 'Sair do foco' : 'Modo foco'}
        />

        <ControlButton
          icon={Phone}
          danger
          disabled={isProcessing}
          onClick={onEndSession}
          label="Encerrar e revisar"
          className="ml-2 h-14 w-14"
        />
      </div>

      <div className="w-[144px]" />
    </div>
  );
};
