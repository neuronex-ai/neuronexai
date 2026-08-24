import { Button } from '@/components/ui/button';
import type { SessionTranscriptConsentMethod } from '@/hooks/use-jitsi-token';
import { CheckCircle2, Loader2, MicOff, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

interface TranscriptionConsentPanelProps {
  patientName: string;
  compact?: boolean;
  isPending?: boolean;
  onGrant: (method: SessionTranscriptConsentMethod, notes?: string) => Promise<void> | void;
  onDecline: (notes?: string) => Promise<void> | void;
}

export const TranscriptionConsentPanel = ({
  patientName,
  compact = false,
  isPending = false,
  onGrant,
  onDecline,
}: TranscriptionConsentPanelProps) => {
  const [submitting, setSubmitting] = useState<'grant' | 'decline' | null>(null);

  const submitGrant = async () => {
    setSubmitting('grant');
    try {
      await onGrant('digital', 'Transcrição autorizada pelo profissional no início da teleconsulta.');
    } finally {
      setSubmitting(null);
    }
  };

  const submitDecline = async () => {
    setSubmitting('decline');
    try {
      await onDecline('Profissional optou por conduzir a sessão sem transcrição.');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <section
      aria-labelledby="transcription-consent-title"
      className={
        compact
          ? 'rounded-[26px] border border-border/45 bg-card p-5 text-center shadow-xl dark:border-white/[0.055]'
          : 'p-8 text-center sm:p-10'
      }
    >
      <div className="teleconsultation-inset mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] text-foreground/70">
        <ShieldCheck className="h-6 w-6" />
      </div>

      <p className="mt-6 text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">
        Consentimento clínico
      </p>
      <h2 id="transcription-consent-title" className="mx-auto mt-2 max-w-lg text-2xl font-black tracking-[-0.045em] text-foreground sm:text-3xl">
        Transcrever teleconsulta?
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-sm font-medium leading-relaxed text-muted-foreground">
        Registre a decisão antes de capturar qualquer áudio. Se a transcrição for ativada, {patientName} será informado antes de entrar na sala.
      </p>

      <div className="mx-auto mt-8 grid max-w-xl gap-4 sm:grid-cols-2">
        <Button
          type="button"
          disabled={isPending || submitting !== null}
          onClick={submitDecline}
          variant="outline"
          className="teleconsultation-action h-[52px] rounded-2xl border-border/50 bg-transparent text-[10px] font-black uppercase tracking-[0.14em] dark:border-white/[0.055]"
        >
          {submitting === 'decline' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MicOff className="mr-2 h-4 w-4" />}
          Não transcrever
        </Button>
        <Button
          type="button"
          disabled={isPending || submitting !== null}
          onClick={submitGrant}
          className="teleconsultation-action h-[52px] rounded-2xl bg-foreground text-[10px] font-black uppercase tracking-[0.14em] text-background"
        >
          {submitting === 'grant' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
          Transcrever teleconsulta
        </Button>
      </div>

      <p className="mx-auto mt-6 max-w-lg text-[11px] font-semibold leading-relaxed text-muted-foreground/75">
        A sessão continua normalmente se a transcrição não for ativada.
      </p>
    </section>
  );
};
