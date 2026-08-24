import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
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

interface ControlButtonProps {
  icon: LucideIcon;
  active?: boolean;
  onClick?: () => void;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  className?: string;
}

const ControlButton = ({
  icon: Icon,
  active,
  onClick,
  label,
  danger = false,
  disabled = false,
  className,
}: ControlButtonProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={danger || active === undefined ? undefined : active}
        className={cn(
          'teleconsultation-action relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-transparent outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
          danger
            ? 'bg-rose-500/14 text-rose-500 hover:bg-rose-500/22'
            : active
              ? 'bg-foreground text-background shadow-[0_12px_28px_-18px_rgba(0,0,0,0.55)]'
              : 'bg-foreground/[0.055] text-muted-foreground hover:bg-foreground/[0.1] hover:text-foreground dark:bg-white/[0.045] dark:hover:bg-white/[0.085]',
          disabled && 'cursor-not-allowed opacity-35',
          className,
        )}
      >
        <Icon className={cn('h-[18px] w-[18px]', danger && 'fill-current')} aria-hidden="true" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" className="rounded-xl border-border/50 bg-popover px-3 py-2 text-[10px] font-bold text-popover-foreground shadow-lg dark:border-white/[0.055]">
      {label}
    </TooltipContent>
  </Tooltip>
);

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
  const handleCopyLink = async () => {
    if (!meetLink) return;
    try {
      await navigator.clipboard.writeText(meetLink);
      toast.success('Link copiado para a área de transferência.');
    } catch {
      toast.error('Não foi possível copiar o link.');
    }
  };

  return (
    <div className="pointer-events-none mx-auto flex w-full items-center justify-center px-5 sm:px-6">
      <div className="teleconsultation-control-dock pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 rounded-[28px] p-2.5">
        {isOnline ? (
          <>
            <ControlButton icon={Copy} onClick={() => void handleCopyLink()} label="Copiar link da sala" />
            <ControlButton icon={MessageSquare} active={isChatOpen} onClick={onToggleChat} label={isChatOpen ? 'Fechar chat' : 'Abrir chat'} />
            <ControlButton icon={Send} onClick={onOpenInvite} label="Enviar convite" />
            <span className="mx-1.5 h-7 w-px bg-border/60 dark:bg-white/[0.055]" aria-hidden="true" />
            <ControlButton
              icon={isAudioEnabled ? Mic : MicOff}
              active={!isAudioEnabled}
              onClick={onToggleAudio}
              label={isAudioEnabled ? 'Desligar microfone' : 'Ligar microfone'}
            />
            <ControlButton
              icon={isVideoEnabled ? Video : VideoOff}
              active={!isVideoEnabled}
              onClick={onToggleVideo}
              label={isVideoEnabled ? 'Desligar câmera' : 'Ligar câmera'}
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
          label={isFocusMode ? 'Sair do modo foco' : 'Ativar modo foco'}
        />
        <ControlButton
          icon={Phone}
          danger
          disabled={isProcessing}
          onClick={onEndSession}
          label="Encerrar e revisar sessão"
          className="ml-1.5 h-12 w-12"
        />
      </div>
    </div>
  );
};
