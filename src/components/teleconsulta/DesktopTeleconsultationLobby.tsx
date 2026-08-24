"use client";

import { Button } from '@/components/ui/button';
import type { MediaDeviceChoice } from '@/hooks/use-media-readiness';
import type { Patient } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarClock,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  Play,
  ShieldCheck,
  Video,
} from 'lucide-react';
import { useCallback, useState } from 'react';

import { MediaReadinessPanel } from './MediaReadinessPanel';
import { PreJoinActions } from './PreJoinActions';

interface DesktopTeleconsultationLobbyProps {
  patientName: string;
  patient?: Patient | null;
  appointmentId: string;
  appointmentStart?: string;
  meetLink: string;
  therapistName: string;
  isOnline: boolean;
  isLoadingToken: boolean;
  canInvitePatient?: boolean;
  hasTranscriptionDecision?: boolean;
  roomStatus?: 'waiting' | 'open' | 'closed';
  onRequireTranscriptionDecision?: () => void;
  onJoin: (selection: MediaDeviceChoice) => void;
}

export const DesktopTeleconsultationLobby = ({
  patientName,
  patient,
  appointmentId,
  appointmentStart,
  meetLink,
  therapistName,
  isOnline,
  isLoadingToken,
  canInvitePatient = true,
  hasTranscriptionDecision = true,
  roomStatus = 'waiting',
  onRequireTranscriptionDecision,
  onJoin,
}: DesktopTeleconsultationLobbyProps) => {
  const [isReady, setIsReady] = useState(false);
  const [selection, setSelection] = useState<MediaDeviceChoice>({
    audioEnabled: true,
    videoEnabled: isOnline,
  });

  const handleReadinessChange = useCallback((ready: boolean, nextSelection: MediaDeviceChoice) => {
    setIsReady(ready);
    setSelection(nextSelection);
  }, []);

  const isDecisionBlocked = isOnline && !hasTranscriptionDecision;
  const isRoomClosed = isOnline && roomStatus === 'closed';
  const isJoinDisabled = !isDecisionBlocked && (!isReady || (isOnline && (isLoadingToken || isRoomClosed)));

  const handlePrimaryAction = () => {
    if (isDecisionBlocked) {
      onRequireTranscriptionDecision?.();
      return;
    }
    onJoin(selection);
  };

  return (
    <div className="teleconsultation-scroll relative z-10 h-full min-h-0 w-full touch-pan-y overflow-y-auto overscroll-contain bg-transparent px-5 pb-7 pt-2 md:px-7 md:pb-8 md:pt-3 xl:px-8">
      <div className="mx-auto min-h-full w-full max-w-[1560px] space-y-5 pb-4">
        <header className="teleconsultation-surface flex flex-col gap-5 rounded-[30px] px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
          <div className="flex min-w-0 items-center gap-[18px]">
            <div className="teleconsultation-inset flex h-12 w-12 shrink-0 items-center justify-center rounded-[17px] text-foreground/75">
              <Video className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                {isOnline ? 'Pré-entrada da teleconsulta' : 'Preparação da sessão presencial'}
              </p>
              <h1 className="mt-1 truncate text-2xl font-black tracking-[-0.045em] text-foreground sm:text-3xl">
                Sessão com {patientName}
              </h1>
            </div>
          </div>
          {appointmentStart ? (
            <div className="teleconsultation-inset inline-flex min-h-11 items-center gap-2.5 rounded-[16px] px-4 text-xs font-bold text-foreground">
              <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              {format(new Date(appointmentStart), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
            </div>
          ) : null}
        </header>

        <div className="grid min-h-0 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.55fr)] xl:items-start xl:gap-6">
          <section className="teleconsultation-surface rounded-[32px] p-5 sm:p-6" aria-label="Teste de dispositivos">
            <MediaReadinessPanel
              variant="desktop"
              initialAudioEnabled
              initialVideoEnabled={isOnline}
              onReadinessChange={handleReadinessChange}
            />
          </section>

          <aside className="space-y-4 xl:sticky xl:top-0">
            <section className="teleconsultation-surface rounded-[30px] p-6 sm:p-7">
              <div className="flex items-start gap-4">
                <div className="teleconsultation-inset flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] text-muted-foreground">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">Privacidade clínica</p>
                  <h2 className="mt-2 text-lg font-black tracking-[-0.03em] text-foreground">Antes de abrir a sala</h2>
                  <p className="mt-2 text-xs font-medium leading-relaxed text-muted-foreground">
                    {isOnline
                      ? 'Defina a transcrição e revise câmera, microfone e saída de áudio. O convite só será liberado depois dessa decisão.'
                      : 'Confirme o consentimento antes de iniciar qualquer captura de áudio da sessão presencial.'}
                  </p>
                </div>
              </div>

              {isOnline ? (
                <div className="teleconsultation-inset mt-5 flex items-center gap-3 rounded-[18px] px-4 py-3.5">
                  {hasTranscriptionDecision ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-foreground/70" aria-hidden="true" />
                  ) : (
                    <LockKeyhole className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                  )}
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.13em] text-foreground">
                      {hasTranscriptionDecision ? 'Decisão registrada' : 'Decisão pendente'}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {hasTranscriptionDecision ? 'A sala pode ser liberada.' : 'Escolha se deseja transcrever a consulta.'}
                    </p>
                  </div>
                </div>
              ) : null}
            </section>

            {isOnline ? (
              <section className="teleconsultation-surface rounded-[28px] p-5 sm:p-6">
                <p className="mb-4 text-[9px] font-black uppercase tracking-[0.17em] text-muted-foreground">Enviar link ao paciente</p>
                <PreJoinActions
                  variant="desktop"
                  appointmentId={appointmentId}
                  patient={patient}
                  meetLink={meetLink}
                  therapistName={therapistName}
                  disabled={!canInvitePatient}
                  disabledReason={
                    !hasTranscriptionDecision
                      ? 'Defina se a teleconsulta será transcrita antes de convidar.'
                      : roomStatus === 'closed'
                        ? 'Esta sala já foi encerrada.'
                        : undefined
                  }
                  onDisabledClick={onRequireTranscriptionDecision}
                />
              </section>
            ) : null}

            <div className="space-y-3 px-1.5">
              <Button
                type="button"
                disabled={isJoinDisabled}
                onClick={handlePrimaryAction}
                className="teleconsultation-action h-14 w-full rounded-[19px] bg-foreground text-[10px] font-black uppercase tracking-[0.18em] text-background shadow-none disabled:opacity-45"
              >
                {isOnline && isLoadingToken && !isDecisionBlocked ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Preparando sala
                  </>
                ) : (
                  <>
                    {isDecisionBlocked ? (
                      <LockKeyhole className="mr-2 h-4 w-4" />
                    ) : (
                      <Play className="mr-2 h-4 w-4 fill-current" />
                    )}
                    {isDecisionBlocked ? 'Definir transcrição' : isOnline ? 'Entrar na sessão' : 'Iniciar sessão presencial'}
                  </>
                )}
              </Button>

              <p className="px-4 text-center text-[9px] font-bold leading-relaxed text-muted-foreground/70">
                {isRoomClosed
                  ? 'Esta sala já foi encerrada.'
                  : isDecisionBlocked
                    ? 'A decisão de transcrição é obrigatória antes de liberar a sala.'
                    : !isReady
                      ? 'Conclua o teste dos dispositivos para continuar.'
                      : 'Dispositivos prontos. Você pode entrar quando quiser.'}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
