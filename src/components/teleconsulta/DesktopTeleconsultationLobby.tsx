"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, Loader2, LockKeyhole, Play, ShieldCheck } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import type { MediaDeviceChoice } from "@/hooks/use-media-readiness";
import type { Patient } from "@/types";
import { MediaReadinessPanel } from "./MediaReadinessPanel";
import { PreJoinActions } from "./PreJoinActions";

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
  roomStatus?: "waiting" | "open" | "closed";
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
  roomStatus = "waiting",
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
  const isRoomClosed = isOnline && roomStatus === "closed";
  const isJoinDisabled = !isReady || (isOnline && (isLoadingToken || isDecisionBlocked || isRoomClosed));

  return (
    <div className="relative z-10 h-full w-full overflow-y-auto bg-transparent px-4 pb-4 xl:px-5 xl:pb-5">
      <div className="mx-auto grid min-h-full max-w-7xl gap-4 xl:grid-cols-[1.35fr_0.65fr] xl:items-start">
        <section className="desktop-retina-panel rounded-[28px] border border-border/40 bg-card/75 p-4 xl:p-5">
          <MediaReadinessPanel
            variant="desktop"
            initialAudioEnabled
            initialVideoEnabled={isOnline}
            onReadinessChange={handleReadinessChange}
          />
        </section>

        <aside className="space-y-3 xl:sticky xl:top-0">
          <section className="rounded-[28px] bg-foreground p-5 text-background dark:bg-white dark:text-zinc-950">
            <p className="text-[9px] font-black uppercase tracking-[0.22em] opacity-45">
              {isOnline ? "Pré-entrada da teleconsulta" : "Preparação da sessão presencial"}
            </p>
            <h1 className="mt-3 text-3xl font-black leading-[0.95] tracking-[-0.05em] xl:text-4xl">{patientName}</h1>
            {appointmentStart ? (
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-background/10 bg-background/[0.07] px-4 py-3 text-sm font-semibold dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]">
                <CalendarClock className="h-4 w-4" />
                {format(new Date(appointmentStart), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
              </div>
            ) : null}
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-background/10 bg-background/[0.07] p-3 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-xs font-medium leading-relaxed opacity-70">
                {isOnline
                  ? "Defina a transcrição, revise os dispositivos e só então libere o convite da sala."
                  : "Confirme o consentimento antes de iniciar qualquer captura de áudio da sessão presencial."}
              </p>
            </div>
          </section>

          {isOnline ? (
            <section className="desktop-retina-panel rounded-[24px] border border-border/40 bg-card/75 p-4">
              <p className="mb-3 text-[8px] font-black uppercase tracking-[0.18em] text-muted-foreground">Enviar link ao paciente</p>
              <PreJoinActions
                appointmentId={appointmentId}
                patient={patient}
                meetLink={meetLink}
                therapistName={therapistName}
                disabled={!canInvitePatient}
                disabledReason={
                  !hasTranscriptionDecision
                    ? "Defina se a teleconsulta será transcrita antes de convidar."
                    : roomStatus === "closed"
                      ? "Esta sala já foi encerrada."
                      : undefined
                }
                onDisabledClick={onRequireTranscriptionDecision}
              />
            </section>
          ) : null}

          <Button
            type="button"
            disabled={isJoinDisabled}
            onClick={() => onJoin(selection)}
            className="h-14 w-full rounded-[20px] bg-foreground text-[10px] font-black uppercase tracking-[0.2em] text-background shadow-xl disabled:opacity-45"
          >
            {isOnline && isLoadingToken ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Preparando sala
              </>
            ) : (
              <>
                {isDecisionBlocked ? <LockKeyhole className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4 fill-current" />}
                {isDecisionBlocked ? "Definir transcrição" : isOnline ? "Entrar na sessão" : "Iniciar sessão presencial"}
              </>
            )}
          </Button>

          {isDecisionBlocked ? (
            <p className="text-center text-[8px] font-black uppercase tracking-[0.14em] text-muted-foreground/65">
              A decisão de transcrição é obrigatória antes de liberar o convite.
            </p>
          ) : isRoomClosed ? (
            <p className="text-center text-[8px] font-black uppercase tracking-[0.14em] text-rose-500/80">
              Esta sala já foi encerrada.
            </p>
          ) : !isReady ? (
            <p className="text-center text-[8px] font-black uppercase tracking-[0.14em] text-muted-foreground/55">
              Conclua o teste ou desligue o dispositivo indisponível.
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
};
