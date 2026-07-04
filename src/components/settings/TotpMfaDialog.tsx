import { useEffect, useRef, useState } from 'react';
import { motion, type MotionProps, useReducedMotion } from 'framer-motion';
import { Clipboard, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { AppModalShell, ModalHeroIcon } from '@/components/ui/app-modal-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useIsMobile } from '@/hooks/use-mobile';
import { enrollTotpFactor, getVerifiedTotpFactor, removeTotpFactor, verifyTotpCode } from '@/hooks/use-totp-mfa';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  mode: 'enroll' | 'challenge' | 'disable';
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
};

export const TotpMfaDialog = ({ open, mode, onOpenChange, onSuccess, onCancel }: Props) => {
  const isMobile = useIsMobile();
  const shouldReduceMotion = Boolean(useReducedMotion());
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pendingEnrollment = useRef<string | null>(null);
  const completed = useRef(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setFactorId('');
    setQrCode('');
    setSecret('');
    setCode('');
    setError('');
    setLoading(true);
    pendingEnrollment.current = null;
    completed.current = false;

    const prepare = async () => {
      if (mode === 'enroll') {
        const factor = await enrollTotpFactor();
        if (!active) return;
        pendingEnrollment.current = factor.id;
        setFactorId(factor.id);
        setQrCode(factor.totp.qr_code);
        setSecret(factor.totp.secret);
        return;
      }

      const factor = await getVerifiedTotpFactor();
      if (!factor) throw new Error('Nenhum autenticador ativo foi encontrado.');
      if (active) setFactorId(factor.id);
    };

    void prepare()
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Falha ao preparar a verificacao.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [mode, open]);

  const cleanupPendingEnrollment = async () => {
    if (pendingEnrollment.current && !completed.current) {
      await removeTotpFactor(pendingEnrollment.current).catch(() => undefined);
      pendingEnrollment.current = null;
    }
  };

  const close = async () => {
    await cleanupPendingEnrollment();
    onOpenChange(false);
    await onCancel?.();
  };

  const verify = async () => {
    if (!factorId || !/^\d{6}$/.test(code)) {
      setError('Digite os seis numeros exibidos no aplicativo autenticador.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await verifyTotpCode(factorId, code);
      if (mode === 'disable') await removeTotpFactor(factorId);
      completed.current = true;
      pendingEnrollment.current = null;
      toast.success(mode === 'enroll'
        ? 'Google Authenticator conectado.'
        : mode === 'disable'
          ? 'Autenticacao desativada.'
          : 'Identidade verificada.');
      await onSuccess();
      onOpenChange(false);
    } catch {
      setCode('');
      setError('Codigo invalido ou expirado. Aguarde o proximo codigo e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const copySecret = async () => {
    await navigator.clipboard.writeText(secret);
    toast.success('Chave manual copiada.');
  };

  const title = mode === 'enroll'
    ? 'Conectar Google Authenticator'
    : mode === 'disable'
      ? 'Confirmar desativacao'
      : 'Inserir token do Google Authenticator';
  const eyebrow = mode === 'enroll'
    ? 'Autenticador'
    : mode === 'disable'
      ? 'Seguranca da conta'
      : 'Autenticacao exigida';
  const description = mode === 'enroll'
    ? 'Escaneie o QR Code no Google Authenticator e confirme o primeiro codigo para concluir a conexao.'
    : mode === 'disable'
      ? 'Informe o codigo atual do aplicativo para desativar a verificacao em duas etapas com seguranca.'
      : 'Informe o codigo atual do Google Authenticator para continuar com uma sessao protegida.';
  const actionLabel = mode === 'enroll'
    ? 'Conectar e verificar'
    : mode === 'disable'
      ? 'Desativar'
      : 'Verificar token';
  const Icon = mode === 'challenge' ? KeyRound : ShieldCheck;

  const qrMotion: MotionProps = shouldReduceMotion
    ? {}
    : {
      initial: { opacity: 0, y: 12, scale: 0.96 },
      animate: {
        opacity: 1,
        y: 0,
        scale: 1,
        boxShadow: [
          '0 18px 48px -34px rgba(0,0,0,0.5)',
          '0 26px 72px -38px rgba(0,0,0,0.24)',
          '0 18px 48px -34px rgba(0,0,0,0.5)',
        ],
      },
      transition: {
        opacity: { duration: 0.18 },
        y: { type: 'spring' as const, stiffness: 260, damping: 24 },
        scale: { type: 'spring' as const, stiffness: 260, damping: 24 },
        boxShadow: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' as const },
      },
    };

  const footer = (
    <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-[1fr_1.25fr]')}>
      <Button
        type="button"
        variant="ghost"
        onClick={() => void close()}
        disabled={loading}
        className="h-12 rounded-[18px] text-xs font-black uppercase tracking-[0.14em] text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {mode === 'challenge' ? 'Sair da conta' : 'Cancelar'}
      </Button>
      <Button
        onClick={() => void verify()}
        disabled={loading || code.length !== 6}
        className="h-12 rounded-[18px] bg-foreground text-xs font-black uppercase tracking-[0.14em] text-background shadow-xl shadow-black/10 hover:bg-foreground/90 disabled:opacity-45"
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : actionLabel}
      </Button>
    </div>
  );

  return (
    <AppModalShell
      open={open}
      onOpenChange={(next) => { if (!next) void close(); else onOpenChange(true); }}
      preventClose={mode === 'challenge' || loading}
      size="md"
      eyebrow={eyebrow}
      title={title}
      description={description}
      heroIcon={<ModalHeroIcon icon={Icon} state={loading ? 'loading' : error ? 'error' : 'neutral'} tone={error ? 'status' : 'neutral'} ariaLabel={eyebrow} />}
      footer={footer}
      bodyClassName="flex flex-col items-center"
    >
      <div className="mx-auto flex w-full max-w-[25rem] flex-col items-center text-center">
        {loading && !factorId ? (
          <div className="flex w-full items-center justify-center rounded-[22px] border border-border/55 bg-muted/35 py-8">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : null}

        {qrCode ? (
          <div className="w-full space-y-3">
            <motion.div
              {...qrMotion}
              className="mx-auto w-fit rounded-[26px] border border-border bg-white p-3 shadow-2xl dark:border-white/10"
            >
              <div className="rounded-[18px] border border-zinc-100 bg-white p-3">
                <img src={qrCode} alt="QR Code para autenticador" className={cn(isMobile ? 'h-44 w-44' : 'h-48 w-48')} />
              </div>
            </motion.div>
            <button
              type="button"
              onClick={() => void copySecret()}
              className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Clipboard className="h-3.5 w-3.5" /> Copiar chave manual
            </button>
          </div>
        ) : null}

        {factorId ? (
          <div className="mt-5 w-full space-y-2">
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(event) => { if (event.key === 'Enter') void verify(); }}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="000000"
              aria-label="Codigo de seis digitos"
              aria-invalid={Boolean(error)}
              className="h-16 rounded-[20px] border-border/70 bg-muted/45 text-center text-2xl font-black tracking-[0.32em] text-foreground shadow-inner placeholder:text-muted-foreground/35 focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-center text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
              6 digitos
            </p>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="mt-4 w-full rounded-2xl border border-destructive/15 bg-destructive/10 px-4 py-3 text-xs font-semibold leading-relaxed text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </AppModalShell>
  );
};
