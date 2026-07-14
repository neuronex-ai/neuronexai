import { ForgotPasswordModal } from '@/components/auth/ForgotPasswordModal';
import { TotpMfaDialog } from '@/components/settings/TotpMfaDialog';
import { AppModalShell, ModalHeroIcon } from '@/components/ui/app-modal-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAccountAssurance } from '@/hooks/use-account-security';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/integrations/supabase/client';
import type { PatientPortalContext } from '@/hooks/use-patient-portal';
import { isPatientAccount } from '@/lib/auth-account-role';
import {
  disableBiometricSignIn,
  enableBiometricSignIn,
  getBiometricPreferenceForUser,
  getBiometricStatus,
  getStoredBiometricAccount,
  isBiometricStatusUsable,
  restoreBiometricSession,
  type BiometricStatus,
  type StoredBiometricAccount,
} from '@/lib/native-mobile-security';
import {
  clearPatientPortalInviteToken,
  readPatientPortalInviteToken,
} from '@/lib/patient-portal-flow';
import { readSupabaseFunctionError } from '@/lib/read-supabase-function-error';
import { cn } from '@/lib/utils';
import type { Session } from '@supabase/supabase-js';
import { ArrowRight, Eye, EyeOff, Fingerprint, Loader2, ShieldCheck, Stethoscope, UserRound } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

type BiometricPromptDialogProps = {
  open: boolean;
  isMobile: boolean;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onSkip: () => void | Promise<void>;
  onEnable: () => void | Promise<void>;
};

const BiometricPromptDialog = ({
  open,
  isMobile,
  loading,
  onOpenChange,
  onSkip,
  onEnable,
}: BiometricPromptDialogProps) => {
  return (
    <AppModalShell
      open={open}
      onOpenChange={onOpenChange}
      preventClose={loading}
      size="sm"
      eyebrow="Seguranca do dispositivo"
      title="Entrar com biometria?"
      description="Ative neste aparelho para desbloquear o app com digital, rosto ou senha do dispositivo. Se falhar, o login normal continua disponivel."
      heroIcon={<ModalHeroIcon icon={Fingerprint} state={loading ? "loading" : "neutral"} animation="fingerprint" ariaLabel="Biometria do dispositivo" />}
      footer={
        <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-[1fr_1fr]')}>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => void onSkip()}
            className="h-12 rounded-[18px] border-border/70 bg-transparent px-5 text-xs font-black text-foreground hover:bg-muted/70"
          >
            Agora nao
          </Button>
          <Button
            type="button"
            disabled={loading}
            onClick={() => void onEnable()}
            className="h-12 rounded-[18px] bg-foreground px-5 text-xs font-black text-background shadow-xl shadow-black/10 hover:bg-foreground/90 dark:shadow-black/35"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {loading ? 'Ativando' : 'Ativar'}
          </Button>
        </div>
      }
    >
      <div className="hidden">
        <div
          className={cn(
            'relative overflow-hidden px-5 py-6',
            isMobile ? 'pb-[calc(1.5rem+env(safe-area-inset-bottom))]' : 'sm:p-7',
          )}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/20 to-transparent dark:via-white/25" />

          <div className="flex items-start gap-4 text-left">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] border border-black/10 bg-black/[0.035] text-zinc-950 shadow-sm dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
            >
              <Fingerprint className="h-6 w-6" />
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Segurança do dispositivo</p>
              <h2 className="mt-2 text-2xl font-black leading-[1.02] tracking-normal text-foreground">
                Entrar com biometria?
              </h2>
            </div>
          </div>

          <p className="mt-4 text-sm font-medium leading-relaxed text-zinc-600 dark:text-zinc-300">
            Ative neste aparelho para desbloquear o app com digital, rosto ou senha do dispositivo. Se falhar, o login normal continua disponível.
          </p>

          <div className={cn('mt-6 flex gap-3', isMobile ? 'flex-col' : 'justify-end')}>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => void onSkip()}
              className={cn(
                'h-12 rounded-[18px] border-black/10 bg-transparent px-5 text-xs font-black text-foreground hover:bg-muted/70 dark:border-white/12',
                isMobile && 'w-full',
              )}
            >
              Agora não
            </Button>
            <Button
              type="button"
              disabled={loading}
              onClick={() => void onEnable()}
              className={cn(
                'h-12 rounded-[18px] bg-foreground px-5 text-xs font-black text-background shadow-xl shadow-black/10 hover:bg-foreground/90 dark:shadow-black/35',
                isMobile && 'w-full',
              )}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Ativar
            </Button>
          </div>
        </div>
      </div>
    </AppModalShell>
  );
};

const AuthPageV2 = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  const roleParam = new URLSearchParams(location.search).get('role');
  const role = roleParam || 'pro';
  const showRoleChoice = !roleParam;
  const [email, setEmail] = useState(localStorage.getItem('neuronex_remembered_email') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(localStorage.getItem('neuronex_remember_me') === 'true');
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus | null>(null);
  const [biometricAccount, setBiometricAccount] = useState<StoredBiometricAccount | null>(null);
  const [biometricPromptOpen, setBiometricPromptOpen] = useState(false);
  const [autoBiometricAttempted, setAutoBiometricAttempted] = useState(false);
  const [pendingBiometricSession, setPendingBiometricSession] = useState<Session | null>(null);
  const [mfaOpen, setMfaOpen] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const redirectPatientSession = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke<PatientPortalContext>('patient-portal-current', {
      body: { action: 'current' },
    });
    if (error) {
      throw new Error(await readSupabaseFunctionError(error, 'Nao foi possivel carregar o Portal do Paciente.'));
    }

    readPatientPortalInviteToken();
    if (data?.status === 'active') {
      clearPatientPortalInviteToken();
      navigate('/portal', { replace: true });
      return;
    }

    if (data?.status === 'needs_activation') {
      navigate('/portal/ativar', { replace: true });
      return;
    }

    navigate('/portal', { replace: true });
  }, [navigate]);

  const redirect = useCallback(async (sessionOverride?: Session | null) => {
    const currentSession = sessionOverride ?? (await supabase.auth.getSession()).data.session;
    const user = currentSession?.user;
    if (!user) return;
    if (isPatientAccount(user)) return redirectPatientSession();

    const profile = await supabase.from('profiles').select('setup_completed').eq('id', user.id).maybeSingle();
    if (role === 'patient') toast.error('Esta conta pertence ao acesso profissional.');
    navigate(profile.data?.setup_completed ? '/dashboard' : '/initial-settings', { replace: true });
  }, [navigate, redirectPatientSession, role]);

  const refreshBiometricState = useCallback(async () => {
    const [status, account] = await Promise.all([
      getBiometricStatus(),
      Promise.resolve(getStoredBiometricAccount()),
    ]);
    setBiometricStatus(status);
    setBiometricAccount(account);
  }, []);

  const shouldOfferBiometric = useCallback(async (session: Session | null) => {
    if (!session?.user || role === 'patient' || isPatientAccount(session.user)) return false;
    const status = await getBiometricStatus();
    const account = getStoredBiometricAccount();
    const preference = getBiometricPreferenceForUser(session.user.id);
    if (!isBiometricStatusUsable(status)) return false;
    if (account?.userId === session.user.id) return false;
    if (preference !== 'unset') return false;
    setPendingBiometricSession(session);
    setBiometricPromptOpen(true);
    return true;
  }, [role]);

  const finishAuthenticatedSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (await shouldOfferBiometric(session)) return;
    await redirect();
  }, [redirect, shouldOfferBiometric]);

  const evaluateSession = useCallback(async () => {
    const session = await supabase.auth.getSession();
    if (!session.data.session) return;
    if (isPatientAccount(session.data.session.user)) {
      await redirect(session.data.session);
      return;
    }
    const assurance = await getAccountAssurance();
    if (assurance.error) throw assurance.error;
    if (assurance.data.nextLevel === 'aal2' && assurance.data.currentLevel !== 'aal2') setMfaOpen(true);
    else await finishAuthenticatedSession();
  }, [finishAuthenticatedSession, redirect]);

  useEffect(() => {
    void refreshBiometricState().catch(() => undefined);
    void evaluateSession().catch(() => undefined);
  }, [evaluateSession, refreshBiometricState]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email || !password) return toast.error('Preencha e-mail e senha.');
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const result = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

      if (result.error) throw result.error;

      if (remember) {
        localStorage.setItem('neuronex_remember_me', 'true');
        localStorage.setItem('neuronex_remembered_email', normalizedEmail);
      } else {
        localStorage.removeItem('neuronex_remember_me');
        localStorage.removeItem('neuronex_remembered_email');
      }

      await evaluateSession();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  };

  const unlockWithBiometrics = useCallback(async () => {
    setBiometricLoading(true);
    try {
      const restored = await restoreBiometricSession();
      const { error } = await supabase.auth.setSession({
        access_token: restored.session.access_token,
        refresh_token: restored.session.refresh_token,
      });
      if (error) throw error;
      toast.success('Sessão desbloqueada com biometria.');
      await evaluateSession();
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : 'Use e-mail e senha para entrar neste dispositivo.',
      );
    } finally {
      setBiometricLoading(false);
    }
  }, [evaluateSession]);

  const enableBiometrics = async () => {
    if (!pendingBiometricSession?.user) return;
    setBiometricLoading(true);
    try {
      await enableBiometricSignIn({
        userId: pendingBiometricSession.user.id,
        email: pendingBiometricSession.user.email,
        session: pendingBiometricSession,
      });
      await refreshBiometricState();
      setBiometricPromptOpen(false);
      setPendingBiometricSession(null);
      toast.success('Entrar com biometria ativado neste aparelho.');
      await redirect();
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível ativar biometria agora.',
      );
    } finally {
      setBiometricLoading(false);
    }
  };

  const skipBiometrics = async () => {
    if (pendingBiometricSession?.user?.id) {
      await disableBiometricSignIn(pendingBiometricSession.user.id).catch(() => undefined);
      await refreshBiometricState().catch(() => undefined);
    }
    setBiometricPromptOpen(false);
    setPendingBiometricSession(null);
    await redirect();
  };

  const cancelMfa = async () => {
    setMfaOpen(false);
    await supabase.auth.signOut();
  };

  const canUseBiometrics =
    role !== 'patient' &&
    isBiometricStatusUsable(biometricStatus) &&
    biometricAccount;

  useEffect(() => {
    if (!canUseBiometrics || autoBiometricAttempted || biometricLoading || loading) return;
    setAutoBiometricAttempted(true);
    void unlockWithBiometrics();
  }, [autoBiometricAttempted, biometricLoading, canUseBiometrics, loading, unlockWithBiometrics]);

  const isDarkTheme = theme === 'dark';
  const authShellClass = isDarkTheme ? 'bg-[#020202] text-white' : 'bg-[#f8f8f6] text-[#171514]';
  const authFrameClass = isDarkTheme
    ? 'border-black/80 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.14),transparent_30%),linear-gradient(145deg,#020202_0%,#141414_48%,#030303_100%)] shadow-[0_28px_82px_-48px_rgba(255,255,255,0.2)]'
    : 'border-black/[0.055] bg-[#f8f8f6] shadow-[0_28px_82px_-50px_rgba(0,0,0,0.42)]';
  const authPanelClass = isDarkTheme
    ? 'bg-[linear-gradient(160deg,#ffffff_0%,#f4f3ef_48%,#e7e6e0_100%)] text-[#171514]'
    : 'bg-[linear-gradient(160deg,#292626_0%,#201e1e_48%,#171515_100%)] text-white';
  const authInputClass = cn(
    'h-[3.25rem] rounded-[4px] border-x-0 border-t-0 bg-transparent px-3 text-sm font-semibold shadow-none backdrop-blur-0 transition-colors duration-200',
    'focus-visible:ring-0 focus-visible:ring-offset-0',
    isDarkTheme
      ? 'border-black/10 text-[#171514] placeholder:text-[#98a0ad] hover:bg-zinc-100/70 focus-visible:border-black/20 focus-visible:bg-zinc-200/80 selection:bg-white selection:text-black'
      : 'border-white/40 text-white placeholder:text-white/60 hover:bg-black/10 focus-visible:border-white/60 focus-visible:bg-black/25 selection:bg-white selection:text-[#171514]',
  );
  const authPrimaryButtonClass = isDarkTheme
    ? 'bg-[#201e1e] text-white shadow-[0_12px_24px_-18px_rgba(0,0,0,0.78)] hover:bg-black'
    : 'bg-[#fff1f4] text-[#171514] shadow-[0_12px_26px_-20px_rgba(255,255,255,0.72)] hover:bg-white';
  const authSecondaryButtonClass = isDarkTheme
    ? 'border-black/10 bg-black/[0.035] text-[#171514] hover:bg-zinc-200/80'
    : 'border-white/15 bg-white/[0.035] text-white hover:bg-white/[0.075]';
  const logoSrc = isDarkTheme ? '/favicon-light.png' : '/favicon-dark.png';

  const renderAuthPanel = (size: 'mobile' | 'desktop') => {
    const isDesktopPanel = size === 'desktop';
    return (
      <div className={cn(
        'mx-0 shadow-[0_-20px_54px_-38px_rgba(0,0,0,0.72)]',
        isDesktopPanel
          ? 'rounded-b-[40px] rounded-t-[38px] px-10 pb-10 pt-12'
          : 'min-h-[min(58dvh,32.5rem)] rounded-b-[36px] rounded-t-[34px] px-8 pb-7 pt-11',
        authPanelClass,
      )}>
        <form onSubmit={submit} className="space-y-7">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="E-mail"
            className={authInputClass}
          />
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Senha"
              className={cn(authInputClass, 'pr-10')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-current/60 transition-colors hover:text-current"
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className={cn(
              isDesktopPanel ? 'mt-8 h-14 rounded-[12px]' : 'mt-8 h-12 rounded-[10px]',
              'w-full text-[11px] font-black',
              authPrimaryButtonClass,
            )}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : role === 'patient' ? 'Entrar no Portal' : 'Login'}
          </Button>
        </form>

        {canUseBiometrics ? (
          <Button
            type="button"
            variant="outline"
            disabled={biometricLoading || loading}
            onClick={() => void unlockWithBiometrics()}
            className={cn(
              isDesktopPanel ? 'mt-3 h-14 rounded-[12px]' : 'mt-3 h-12 rounded-[10px]',
              'w-full text-[10px] font-black uppercase tracking-[.12em]',
              authSecondaryButtonClass,
            )}
          >
            {biometricLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Fingerprint className="mr-2 h-4 w-4" />}
            Entrar com biometria
          </Button>
        ) : null}

        <div className="mt-7 space-y-3 text-center">
          <button
            type="button"
            onClick={() => navigate(role === 'patient' ? '/auth?role=pro' : '/auth?role=patient')}
            className="w-full text-xs font-semibold text-current/80 transition-colors hover:text-current"
          >
            {role === 'patient' ? 'Acessar como profissional' : 'Acessar Portal do Paciente'}
          </button>
          <button
            type="button"
            onClick={() => setForgotOpen(true)}
            className="w-full text-xs font-semibold text-current/72 transition-colors hover:text-current"
          >
            {role === 'patient' ? 'Redefinir senha do Portal' : 'Esqueci minha senha'}
          </button>
        </div>
        <div className="mt-8 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-current/55">
          <ShieldCheck className="h-3.5 w-3.5" />
          Sessão protegida
        </div>
      </div>
    );
  };

  const renderRememberControl = (size: 'mobile' | 'desktop') => (
    <label className={cn(
      'flex items-center justify-end gap-3 text-xs font-bold text-current',
      size === 'desktop' ? 'px-10 pt-4' : 'px-8 pt-3',
    )}>
      <span>Remember me</span>
      <input
        type="checkbox"
        checked={remember}
        onChange={(event) => setRemember(event.target.checked)}
        className="h-4 w-7 accent-current"
      />
    </label>
  );

  const renderRoleChoicePanel = (size: 'mobile' | 'desktop') => {
    const isDesktopPanel = size === 'desktop';
    const options = [
      {
        label: 'Sou psicólogo',
        description: 'Acesse agenda, prontuários, Synapse, financeiro e configurações da clínica.',
        icon: Stethoscope,
        href: '/auth?role=pro',
      },
      {
        label: 'Sou paciente',
        description: 'Entre no Portal do Paciente para ativar convite, ver agenda, documentos e financeiro.',
        icon: UserRound,
        href: '/auth?role=patient',
      },
    ];

    return (
      <div className={cn(
        'mx-0 shadow-[0_-20px_54px_-38px_rgba(0,0,0,0.72)]',
        isDesktopPanel
          ? 'rounded-b-[40px] rounded-t-[38px] px-10 pb-10 pt-10'
          : 'min-h-[min(58dvh,32.5rem)] rounded-b-[36px] rounded-t-[34px] px-7 pb-7 pt-9',
        authPanelClass,
      )}>
        <div className="mb-7 text-left">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-current/55">Escolha seu acesso</p>
          <h1 className="mt-3 text-2xl font-black leading-tight tracking-normal">Como você quer entrar?</h1>
          <p className="mt-3 text-sm font-medium leading-relaxed text-current/62">
            Psicólogos e pacientes usam áreas separadas para manter dados clínicos e convites protegidos.
          </p>
        </div>

        <div className="space-y-3">
          {options.map((option) => (
            <button
              key={option.href}
              type="button"
              onClick={() => navigate(option.href)}
              className={cn(
                'group flex w-full items-center gap-4 rounded-[22px] border p-4 text-left transition-colors active:scale-[0.99]',
                isDarkTheme
                  ? 'border-black/10 bg-black/[0.035] hover:bg-black/[0.075]'
                  : 'border-white/12 bg-white/[0.035] hover:bg-white/[0.075]',
              )}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-current/10 bg-current/[0.06]">
                <option.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black tracking-tight">{option.label}</span>
                <span className="mt-1 block text-xs font-semibold leading-relaxed text-current/58">{option.description}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-current/45 transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-current/55">
          <ShieldCheck className="h-3.5 w-3.5" />
          Acesso protegido
        </div>
      </div>
    );
  };

  const authDialogs = (
    <>
      <ForgotPasswordModal
        open={forgotOpen}
        onOpenChange={setForgotOpen}
        context={role === 'patient' ? 'patient' : 'professional'}
        redirectTo={role === 'patient' ? `${window.location.origin}/reset-password?next=portal` : undefined}
        inviteToken={role === 'patient' ? readPatientPortalInviteToken() : undefined}
      />
      <TotpMfaDialog open={mfaOpen} mode="challenge" onOpenChange={setMfaOpen} onSuccess={finishAuthenticatedSession} onCancel={cancelMfa} />
      <BiometricPromptDialog
        open={biometricPromptOpen}
        isMobile={isMobile}
        loading={biometricLoading}
        onOpenChange={(open) => {
          if (biometricLoading) return;
          if (!open) void skipBiometrics();
          else setBiometricPromptOpen(open);
        }}
        onSkip={skipBiometrics}
        onEnable={enableBiometrics}
      />
    </>
  );

  if (isMobile) {
    return (
      <main className={cn(
        'relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-[calc(1rem+env(safe-area-inset-top))]',
        authShellClass,
      )}>
        <section className={cn(
          'relative w-full max-w-[23.5rem] overflow-hidden rounded-[40px] border px-0 pb-5 pt-8',
          'min-h-[min(82dvh,43rem)]',
          authFrameClass,
        )}>
          <div className="flex min-h-[7.25rem] items-start justify-center pt-1 text-center">
            <img src={logoSrc} alt="NeuroNex" className="h-14 w-14 object-contain" />
            <h1 className="sr-only">{role === 'patient' ? 'Área do paciente' : 'Acesso profissional'}</h1>
          </div>

          {showRoleChoice ? renderRoleChoicePanel('mobile') : renderAuthPanel('mobile')}
          {!showRoleChoice && renderRememberControl('mobile')}
        </section>

        {authDialogs}
      </main>
    );
  }

  return (
    <main className={cn(
      'relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-10',
      authShellClass,
    )}>
      <section className={cn(
        'relative w-full max-w-[31rem] overflow-hidden rounded-[44px] border px-0 pb-6 pt-10',
        authFrameClass,
      )}>
        <div className="flex min-h-[9.25rem] items-start justify-center pt-2 text-center">
          <img src={logoSrc} alt="NeuroNex" className="h-16 w-16 object-contain" />
          <h1 className="sr-only">{role === 'patient' ? 'Área do paciente' : 'Acesso profissional'}</h1>
        </div>

        {showRoleChoice ? renderRoleChoicePanel('desktop') : renderAuthPanel('desktop')}
        {!showRoleChoice && renderRememberControl('desktop')}
      </section>

      {authDialogs}
    </main>
  );
};

export default AuthPageV2;
