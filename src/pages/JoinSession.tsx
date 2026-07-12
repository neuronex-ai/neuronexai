import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  Monitor,
  PhoneOff,
  ShieldCheck,
  Video,
  VideoOff,
} from 'lucide-react';
import { toast } from 'sonner';

import { JitsiMeet, type JitsiRef } from '@/components/teleconsulta/JitsiMeet';
import { SessionChat } from '@/components/teleconsulta/SessionChat';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DesktopLumenBackdrop } from '@/components/ui/DesktopLumenBackdrop';
import { Input } from '@/components/ui/input';
import { createTeleconsultationGuestClient } from '@/integrations/supabase/teleconsultation-guest-client';
import { cn } from '@/lib/utils';

type RoomStatus = 'waiting' | 'open' | 'closed';

interface SessionJoinInfo {
  transcriptionEnabled: boolean;
  noticeText: string | null;
  noticeVersion: string | null;
  decisionStatus: 'pending' | 'decided';
  roomStatus: RoomStatus;
  canJoin: boolean;
  waitMessage?: string | null;
}

interface RedeemResult {
  participant: {
    user_id: string;
    appointment_id: string;
    display_name: string;
  };
  appointmentId: string;
  joinInfo: SessionJoinInfo;
}

const JITSI_APP_ID = 'vpaas-magic-cookie-dc267e44c7014498a3a128625367fc67';
const SECURE_INVITE_PATTERN = /^[a-f0-9]{64}$/i;

const JoinSession = () => {
  const { inviteToken = '' } = useParams<{ inviteToken: string }>();
  const navigate = useNavigate();
  const guestClient = useMemo(() => createTeleconsultationGuestClient(), []);
  const jitsiRef = useRef<JitsiRef>(null);

  const [guestName, setGuestName] = useState('');
  const [joinInfo, setJoinInfo] = useState<SessionJoinInfo | null>(null);
  const [appointmentId, setAppointmentId] = useState('');
  const [guestUserId, setGuestUserId] = useState('');
  const [jitsiToken, setJitsiToken] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [isInSession, setIsInSession] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeAccepted, setNoticeAccepted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const hasSecureInvite = SECURE_INVITE_PATTERN.test(inviteToken);

  const loadJoinInfo = useCallback(async (silent = false) => {
    if (!hasSecureInvite) {
      setErrorMessage('Este link de teleconsulta não é mais válido. Solicite um novo convite ao seu psicólogo.');
      setIsLoading(false);
      return null;
    }

    if (!silent) setIsLoading(true);
    const { data, error } = await guestClient.functions.invoke<SessionJoinInfo>('get-session-join-info', {
      body: { inviteToken },
    });

    if (error || !data) {
      setJoinInfo(null);
      setErrorMessage('Este convite expirou, foi revogado ou não está mais disponível. Solicite um novo link.');
      setIsLoading(false);
      return null;
    }

    setErrorMessage('');
    setJoinInfo(data);
    if (!data.transcriptionEnabled) setNoticeAccepted(false);
    setIsLoading(false);
    return data;
  }, [guestClient, hasSecureInvite, inviteToken]);

  useEffect(() => {
    void loadJoinInfo();
    const interval = window.setInterval(() => void loadJoinInfo(true), 5_000);
    return () => window.clearInterval(interval);
  }, [loadJoinInfo]);

  useEffect(() => () => {
    void guestClient.removeAllChannels();
    void guestClient.auth.signOut({ scope: 'local' });
  }, [guestClient]);

  useEffect(() => {
    if (!isInSession || joinInfo?.roomStatus !== 'closed') return;
    toast.info('A teleconsulta foi encerrada pelo profissional.');
    jitsiRef.current?.executeCommand('hangup');
    setIsInSession(false);
    navigate('/');
  }, [isInSession, joinInfo?.roomStatus, navigate]);

  const handleJoin = async () => {
    const displayName = guestName.replace(/\s+/g, ' ').trim();
    if (!displayName) {
      toast.error('Informe seu nome para entrar.');
      return;
    }

    const latest = await loadJoinInfo(true);
    if (!latest?.canJoin) {
      toast.info(latest?.waitMessage || 'A sala ainda não foi liberada.');
      return;
    }
    if (latest.transcriptionEnabled && !noticeAccepted) {
      toast.error('Confirme que leu o aviso de transcrição antes de entrar.');
      return;
    }

    setIsJoining(true);
    setErrorMessage('');
    try {
      let { data: sessionData } = await guestClient.auth.getSession();
      if (!sessionData.session) {
        const { data, error } = await guestClient.auth.signInAnonymously();
        if (error || !data.session) throw new Error('Não foi possível criar sua sessão temporária.');
        sessionData = { session: data.session };
      }

      const { data: redeemed, error: redeemError } = await guestClient.functions.invoke<RedeemResult>(
        'redeem-teleconsultation-invite',
        { body: { inviteToken, displayName } },
      );
      if (redeemError || !redeemed?.appointmentId) {
        throw new Error('O convite não pôde ser validado. Solicite um novo link.');
      }

      const roomName = `${JITSI_APP_ID}/${redeemed.appointmentId}`;
      const { data: authorized, error: tokenError } = await guestClient.functions.invoke<{
        token: string;
        room: string;
        moderator: boolean;
      }>('generate-jitsi-token', {
        body: {
          appointmentId: redeemed.appointmentId,
          roomName,
          inviteToken,
        },
      });
      if (tokenError || !authorized?.token || authorized.moderator !== false) {
        throw new Error('Não foi possível autorizar sua entrada com segurança.');
      }

      setGuestUserId(sessionData.session?.user.id || redeemed.participant.user_id);
      setAppointmentId(redeemed.appointmentId);
      setJoinInfo(redeemed.joinInfo);
      setJitsiToken(authorized.token);
      setIsInSession(true);
      toast.success('Entrada autorizada.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível entrar na sala.';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeave = () => {
    jitsiRef.current?.executeCommand('hangup');
    setIsInSession(false);
    navigate('/');
  };

  if (isInSession && jitsiToken && appointmentId) {
    return (
      <main className="desktop-lumen-page relative h-[100dvh] min-h-0 w-full overflow-hidden bg-transparent text-foreground">
        <section className="absolute inset-3 overflow-hidden rounded-[30px] border border-border/45 bg-black shadow-[0_26px_80px_rgba(0,0,0,0.32)] dark:border-white/[0.055]">
          <JitsiMeet
            ref={jitsiRef}
            roomName={`${JITSI_APP_ID}/${appointmentId}`}
            jwt={jitsiToken}
            userName={guestName.trim()}
            subject="Teleconsulta NeuroNex"
            transcriptionEnabled={false}
            onMeetingEnd={handleLeave}
          />

          <div className="pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center px-4">
            <div className="teleconsultation-surface pointer-events-auto flex items-center gap-1.5 rounded-full p-2 shadow-2xl">
              <SessionControl
                label={isMuted ? 'Ativar microfone' : 'Desativar microfone'}
                active={isMuted}
                onClick={() => {
                  jitsiRef.current?.toggleAudio();
                  setIsMuted((current) => !current);
                }}
              >
                {isMuted ? <MicOff /> : <Mic />}
              </SessionControl>
              <SessionControl
                label={isVideoOff ? 'Ativar câmera' : 'Desativar câmera'}
                active={isVideoOff}
                onClick={() => {
                  jitsiRef.current?.toggleVideo();
                  setIsVideoOff((current) => !current);
                }}
              >
                {isVideoOff ? <VideoOff /> : <Video />}
              </SessionControl>
              <SessionControl
                label={isScreenSharing ? 'Parar compartilhamento' : 'Compartilhar tela'}
                active={isScreenSharing}
                onClick={() => {
                  jitsiRef.current?.toggleScreenShare();
                  setIsScreenSharing((current) => !current);
                }}
              >
                <Monitor />
              </SessionControl>
              <SessionControl label="Abrir chat" active={isChatOpen} onClick={() => setIsChatOpen((current) => !current)}>
                <MessageSquare />
              </SessionControl>
              <Button
                type="button"
                size="icon"
                variant="destructive"
                onClick={handleLeave}
                className="ml-2 h-12 w-12 rounded-full"
                aria-label="Sair da sessão"
              >
                <PhoneOff className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <SessionChat
            client={guestClient}
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            appointmentId={appointmentId}
            currentUserId={guestUserId}
          />
        </section>
      </main>
    );
  }

  const waitingForDecision = joinInfo?.decisionStatus === 'pending';
  const waitingForRoom = joinInfo?.decisionStatus === 'decided' && joinInfo.roomStatus === 'waiting';
  const roomClosed = joinInfo?.roomStatus === 'closed';
  const joinDisabled = !joinInfo?.canJoin || (joinInfo.transcriptionEnabled && !noticeAccepted);

  return (
    <main className="desktop-lumen-page relative flex min-h-[100dvh] items-center justify-center overflow-x-hidden bg-transparent px-4 py-8 text-foreground">
      <DesktopLumenBackdrop />
      <section className="teleconsultation-surface relative z-10 w-full max-w-[520px] overflow-hidden rounded-[34px] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.28)] sm:p-8">
        <header className="text-center">
          <div className="teleconsultation-inset mx-auto flex h-14 w-14 items-center justify-center rounded-[19px]">
            <Video className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="mt-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Teleconsulta segura</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.045em]">Entrar na sessão</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Informe seu nome e entre quando o profissional liberar a sala.
          </p>
        </header>

        <div className="mt-7 space-y-4">
          {isLoading ? (
            <StatusPanel tone="neutral" icon={<Loader2 className="animate-spin" />} title="Validando convite">
              Estamos preparando sua entrada com segurança.
            </StatusPanel>
          ) : null}

          {!isLoading && joinInfo ? (
            <StatusPanel
              tone={joinInfo.canJoin ? 'success' : roomClosed ? 'danger' : 'warning'}
              icon={joinInfo.canJoin ? <CheckCircle2 /> : <Clock3 />}
              title={roomClosed ? 'Sala encerrada' : joinInfo.canJoin ? 'Sala liberada' : 'Aguardando liberação'}
            >
              {joinInfo.canJoin
                ? 'Você já pode entrar.'
                : joinInfo.waitMessage || (waitingForDecision || waitingForRoom ? 'Aguarde um instante.' : 'A sala ainda não está disponível.')}
            </StatusPanel>
          ) : null}

          {errorMessage ? (
            <StatusPanel tone="danger" icon={<AlertCircle />} title="Convite indisponível">
              {errorMessage}
            </StatusPanel>
          ) : null}

          {joinInfo?.transcriptionEnabled ? (
            <div className="rounded-[22px] border border-amber-500/18 bg-amber-500/[0.075] p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-bold">Aviso de transcrição</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Esta sessão será transcrita para apoiar o registro clínico.
                  </p>
                </div>
              </div>
              <details className="group mt-3 border-t border-amber-500/12 pt-3">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-xs font-bold text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Como seus dados são tratados
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                </summary>
                <p className="pb-2 text-xs leading-relaxed text-muted-foreground">{joinInfo.noticeText}</p>
              </details>
              <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 rounded-[16px] bg-background/45 px-3 text-xs font-semibold">
                <Checkbox checked={noticeAccepted} onCheckedChange={(checked) => setNoticeAccepted(checked === true)} />
                Li e compreendi o aviso de transcrição.
              </label>
            </div>
          ) : null}

          <div className="space-y-3 pt-1">
            <label htmlFor="guest-name" className="sr-only">Seu nome completo</label>
            <Input
              id="guest-name"
              autoComplete="name"
              maxLength={120}
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !joinDisabled) void handleJoin();
              }}
              placeholder="Seu nome completo"
              className="teleconsultation-inset h-[52px] rounded-[17px] border-0 px-4 text-center shadow-none"
            />
            <Button
              type="button"
              onClick={() => void handleJoin()}
              disabled={!guestName.trim() || isJoining || isLoading || joinDisabled}
              className="teleconsultation-action h-[52px] w-full rounded-[17px] bg-foreground font-black uppercase tracking-[0.12em] text-background"
            >
              {isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Entrar na sala'}
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
};

interface SessionControlProps {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const SessionControl = ({ label, active, onClick, children }: SessionControlProps) => (
  <Button
    type="button"
    size="icon"
    variant="ghost"
    onClick={onClick}
    className={cn(
      'h-12 w-12 rounded-full border border-transparent text-foreground/75',
      active && 'border-foreground/10 bg-foreground text-background',
    )}
    aria-label={label}
    aria-pressed={active}
  >
    <span className="[&>svg]:h-5 [&>svg]:w-5">{children}</span>
  </Button>
);

interface StatusPanelProps {
  tone: 'neutral' | 'success' | 'warning' | 'danger';
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

const StatusPanel = ({ tone, icon, title, children }: StatusPanelProps) => (
  <div className={cn(
    'flex items-start gap-3 rounded-[20px] border p-4 text-sm',
    tone === 'neutral' && 'border-border/45 bg-foreground/[0.025]',
    tone === 'success' && 'border-emerald-500/18 bg-emerald-500/[0.075]',
    tone === 'warning' && 'border-amber-500/18 bg-amber-500/[0.075]',
    tone === 'danger' && 'border-rose-500/18 bg-rose-500/[0.075]',
  )}>
    <span className="mt-0.5 shrink-0 [&>svg]:h-5 [&>svg]:w-5" aria-hidden="true">{icon}</span>
    <div>
      <p className="font-bold">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{children}</p>
    </div>
  </div>
);

export default JoinSession;
