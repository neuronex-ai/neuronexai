"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CreateAccountDraft,
  type EmailAvailability,
  type GenderIdentity,
  type PasswordStrength,
  ProfessionalContext,
  maskBrazilPhone,
  normalizeEmail,
  useCreateAccountFlow,
} from "@/hooks/use-create-account-flow";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  Loader2,
  MailCheck,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

const fadeSlide: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] as const },
  },
  exit: { opacity: 0, y: -12, scale: 0.99, transition: { duration: 0.18 } },
};

const contextOptions: Array<{ value: ProfessionalContext; label: string; description: string }> = [
  { value: "individual_professional", label: "Sou profissional individual", description: "Atendo com agenda e pacientes próprios." },
  { value: "psychology_student", label: "Sou estudante de psicologia", description: "Quero organizar estudos, prática e evolução." },
];

const genderOptions: Array<{ value: GenderIdentity; label: string }> = [
  { value: "female", label: "Feminino" },
  { value: "male", label: "Masculino" },
  { value: "non_binary", label: "Não binário" },
  { value: "prefer_not_to_say", label: "Prefiro não informar" },
];

const passwordRules = [
  { key: "minLength", label: "Mínimo de 8 caracteres" },
  { key: "lower", label: "1 letra minúscula" },
  { key: "upper", label: "1 letra maiúscula" },
  { key: "special", label: "1 caractere especial: @ # < ! $ % & * ; / ?" },
] as const;

const ACCOUNT_CREATION_PAUSED = String(import.meta.env.VITE_ACCOUNT_CREATION_PAUSED || "").toLowerCase() === "true";

export default function CreateAccount() {
  if (ACCOUNT_CREATION_PAUSED) return <CreateAccountPausedPage />;
  return <CreateAccountFlow />;
}

function CreateAccountPausedPage() {
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  const isDarkTheme = theme === "dark";
  const logoSrc = isDarkTheme ? "/favicon-light.png" : "/favicon-dark.png";
  const shellClass = isDarkTheme ? "bg-[#020202] text-white" : "bg-[#f8f8f6] text-[#171514]";
  const frameClass = isDarkTheme
    ? "border-black/80 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.13),transparent_30%),linear-gradient(145deg,#020202_0%,#141414_48%,#030303_100%)] shadow-[0_28px_82px_-48px_rgba(255,255,255,0.2)]"
    : "border-black/[0.055] bg-[#f8f8f6] shadow-[0_28px_82px_-50px_rgba(0,0,0,0.42)]";
  const panelClass = isDarkTheme
    ? "bg-[linear-gradient(160deg,#ffffff_0%,#f4f3ef_48%,#e7e6e0_100%)] text-[#171514]"
    : "bg-[linear-gradient(160deg,#292626_0%,#201e1e_48%,#171515_100%)] text-white";
  const mutedPanelClass = isDarkTheme ? "border-black/10 bg-black/[0.035] text-[#171514]" : "border-white/15 bg-white/[0.035] text-white";
  const primaryButtonClass = isDarkTheme ? "bg-[#201e1e] text-white hover:bg-black" : "bg-[#fff1f4] text-[#171514] hover:bg-white";

  return (
    <main className={cn("relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-[calc(1rem+env(safe-area-inset-top))]", shellClass)}>
      <section
        className={cn(
          "relative grid w-full max-w-[54rem] overflow-hidden border",
          isMobile ? "min-h-[min(78dvh,38rem)] max-w-[24rem] rounded-[40px] pb-5 pt-8" : "min-h-[34rem] grid-cols-[0.85fr_1.15fr] rounded-[44px] p-0",
          frameClass,
        )}
      >
        {!isMobile ? (
          <aside className={cn("flex flex-col justify-between p-10", isDarkTheme ? "border-r-0" : "border-r border-current/5")}>
            <div className="inline-flex w-fit items-center gap-3">
              <img src={logoSrc} alt="NeuroNex AI" className="h-10 w-10 object-contain" />
              <span className="text-xs font-black uppercase tracking-[0.24em]">NeuroNex AI</span>
            </div>
            <div className="max-w-[22rem]">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-current/35">Novas contas pausadas</p>
              <h1 className="mt-6 text-5xl font-black leading-[0.92] tracking-[-0.06em]">Estamos aprimorando o NeuroNex.</h1>
              <p className="mt-7 text-base font-semibold leading-relaxed text-current/50">
                A criação de contas está temporariamente indisponível durante esta etapa de desenvolvimento.
              </p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-current/10">
              <div className="h-full w-1/2 rounded-full bg-current" />
            </div>
          </aside>
        ) : (
          <div className="flex min-h-[7.2rem] items-start justify-center pt-1">
            <img src={logoSrc} alt="NeuroNex AI" className="h-14 w-14 object-contain" />
          </div>
        )}

        <div className={cn("flex min-h-full flex-col", isMobile ? "" : "justify-center p-8 lg:p-10")}>
          <div className={cn("mx-0 shadow-[0_-20px_54px_-38px_rgba(0,0,0,0.72)]", isMobile ? "min-h-[min(52dvh,29rem)] rounded-b-[36px] rounded-t-[34px] px-7 pb-7 pt-9" : "rounded-[40px] px-10 py-10", panelClass)}>
            <div className={cn("mb-6 inline-flex h-12 w-12 items-center justify-center rounded-[18px] border", mutedPanelClass)}>
              <ShieldCheck className="h-5 w-5" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-current/42">Pausa temporária</p>
            <h2 className="mt-3 text-[2.25rem] font-black leading-[0.95] tracking-[-0.06em]">
              Cadastro fechado para novos acessos.
            </h2>
            <p className="mt-5 text-sm font-semibold leading-relaxed text-current/58">
              Faremos uma pausa temporária para aprimorarmos funcionalidades dentro da NeuroNex. Em breve, sua clínica conversará com você.
            </p>
            <div className={cn("mt-7 rounded-[18px] border p-4 text-xs font-semibold leading-relaxed", mutedPanelClass)}>
              Durante este período, apenas a equipe de desenvolvimento terá acesso à plataforma. Caso tenha dúvidas, contato nosso suporte.
            </div>
            <Button asChild className={cn("mt-7 h-14 w-full rounded-[12px] text-[11px] font-black uppercase tracking-[0.18em]", primaryButtonClass)}>
              <Link to="/auth">
                Entrar com conta existente
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

function CreateAccountFlow() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  const flow = useCreateAccountFlow();
  const [showPassword, setShowPassword] = useState(false);
  const [successProgress, setSuccessProgress] = useState(12);

  const isDarkTheme = theme === "dark";
  const logoSrc = isDarkTheme ? "/favicon-light.png" : "/favicon-dark.png";
  const shellClass = isDarkTheme ? "bg-[#020202] text-white" : "bg-[#f8f8f6] text-[#171514]";
  const frameClass = isDarkTheme
    ? "border-black/80 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.13),transparent_30%),linear-gradient(145deg,#020202_0%,#141414_48%,#030303_100%)] shadow-[0_28px_82px_-48px_rgba(255,255,255,0.2)]"
    : "border-black/[0.055] bg-[#f8f8f6] shadow-[0_28px_82px_-50px_rgba(0,0,0,0.42)]";
  const panelClass = isDarkTheme
    ? "bg-[linear-gradient(160deg,#ffffff_0%,#f4f3ef_48%,#e7e6e0_100%)] text-[#171514]"
    : "bg-[linear-gradient(160deg,#292626_0%,#201e1e_48%,#171515_100%)] text-white";
  const inputClass = cn(
    "h-[3.25rem] rounded-[10px] border bg-transparent px-3 text-sm font-semibold shadow-none transition-colors duration-200 focus-visible:ring-0 focus-visible:ring-offset-0",
    isDarkTheme
      ? "border-black/10 text-[#171514] placeholder:text-[#98a0ad] hover:bg-zinc-100/70 focus-visible:border-black/20 focus-visible:bg-zinc-200/80 selection:bg-white selection:text-black"
      : "border-white/20 text-white placeholder:text-white/55 hover:bg-black/10 focus-visible:border-white/50 focus-visible:bg-black/25 selection:bg-white selection:text-[#171514]",
  );
  const primaryButtonClass = isDarkTheme ? "bg-[#201e1e] text-white hover:bg-black" : "bg-[#fff1f4] text-[#171514] hover:bg-white";
  const selectContentClass = isDarkTheme ? "border-black/10 bg-[#f7f6f1] text-[#171514]" : "border-white/10 bg-[#111010] text-white";
  const mutedPanelClass = isDarkTheme ? "border-black/10 bg-black/[0.035] text-[#171514]" : "border-white/15 bg-white/[0.035] text-white";
  const stepNumber = flow.step === "identity" ? 1 : flow.step === "password" ? 2 : 3;
  const progress = flow.step === "identity" ? 34 : flow.step === "password" ? 68 : 100;

  const firstName = useMemo(() => flow.draft.fullName.trim().split(/\s+/)[0] || "profissional", [flow.draft.fullName]);

  const updateDraft = <K extends keyof CreateAccountDraft>(key: K, value: CreateAccountDraft[K]) => {
    if (key === "email" || key === "recoveryEmail") {
      flow.setDraft({ [key]: normalizeEmail(String(value)) } as Partial<CreateAccountDraft>);
      return;
    }
    if (key === "phone") {
      flow.setDraft({ phone: maskBrazilPhone(String(value)) });
      return;
    }
    flow.setDraft({ [key]: value } as Partial<CreateAccountDraft>);
  };

  const submitIdentity = async () => {
    try {
      await flow.sendVerificationEmail();
      toast.success("Enviamos o código para o seu e-mail.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o e-mail de confirmação.");
    }
  };

  const submitOtp = async () => {
    try {
      await flow.verifyEmailCode();
      toast.success("E-mail confirmado. Agora crie sua senha.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Código inválido ou expirado.");
    }
  };

  const resendOtp = async () => {
    try {
      await flow.resendVerification();
      toast.success("E-mail reenviado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível reenviar agora.");
    }
  };

  const submitPassword = async () => {
    try {
      await flow.createPassword();
      flow.completeSignup();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar sua senha.");
    }
  };

  useEffect(() => {
    if (flow.step !== "success") return;
    setSuccessProgress(20);
    const marks = [36, 54, 72, 88, 100];
    const timers = marks.map((mark, index) => window.setTimeout(() => setSuccessProgress(mark), 420 + index * 360));
    const redirect = window.setTimeout(() => navigate("/initial-settings", { replace: true }), 2800);
    return () => {
      timers.forEach(window.clearTimeout);
      window.clearTimeout(redirect);
    };
  }, [flow.step, navigate]);

  return (
    <main className={cn("relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-[calc(1rem+env(safe-area-inset-top))]", shellClass)}>
      <section
        className={cn(
          "relative grid w-full max-w-[68rem] overflow-hidden border",
          isMobile ? "min-h-[min(86dvh,45rem)] max-w-[24rem] rounded-[40px] pb-5 pt-8" : "min-h-[42rem] grid-cols-[0.9fr_1.1fr] rounded-[44px] p-0",
          frameClass,
        )}
      >
        {!isMobile ? (
          <CreateAccountSideRail logoSrc={logoSrc} isDarkTheme={isDarkTheme} stepNumber={stepNumber} progress={progress} />
        ) : (
          <div className="flex min-h-[7.2rem] items-start justify-center pt-1">
            <img src={logoSrc} alt="NeuroNex AI" className="h-14 w-14 object-contain" />
          </div>
        )}

        <div className={cn("flex min-h-full flex-col", isMobile ? "" : "justify-center p-8 lg:p-10")}>
          <div className={cn("mx-0 shadow-[0_-20px_54px_-38px_rgba(0,0,0,0.72)]", isMobile ? "min-h-[min(58dvh,33rem)] rounded-b-[36px] rounded-t-[34px] px-7 pb-7 pt-9" : "rounded-[40px] px-10 py-10", panelClass)}>
            <div className="mb-7">
              <div className="mb-4 flex items-center justify-between gap-4">
                <span className={cn("inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[9px] font-black uppercase tracking-[0.16em]", mutedPanelClass)}>
                  <Clock3 className="h-3.5 w-3.5" />
                  Cerca de 5 min
                </span>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-current/42">{stepNumber}/3</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-current/10">
                <motion.div className="h-full rounded-full bg-current" animate={{ width: `${progress}%` }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} />
              </div>
            </div>

            <AnimatePresence mode="wait">
              {flow.step === "identity" ? (
                <IdentityStep
                  key="identity"
                  draft={flow.draft}
                  inputClass={inputClass}
                  mutedPanelClass={mutedPanelClass}
                  selectContentClass={selectContentClass}
                  actionButtonClass={primaryButtonClass}
                  emailAvailability={flow.emailAvailability}
                  recoveryEmailAvailability={flow.recoveryEmailAvailability}
                  loading={flow.loading}
                  onChange={updateDraft}
                  onSubmit={submitIdentity}
                />
              ) : null}

              {flow.step === "password" ? (
                <PasswordStep
                  key="password"
                  firstName={firstName}
                  inputClass={inputClass}
                  mutedPanelClass={mutedPanelClass}
                  primaryButtonClass={primaryButtonClass}
                  loading={flow.loading}
                  password={flow.password}
                  confirmPassword={flow.confirmPassword}
                  showPassword={showPassword}
                  strength={flow.passwordStrength}
                  onPasswordChange={flow.setPassword}
                  onConfirmPasswordChange={flow.setConfirmPassword}
                  onTogglePassword={() => setShowPassword((value) => !value)}
                  onSubmit={submitPassword}
                />
              ) : null}

              {flow.step === "success" ? <SuccessStep key="success" firstName={firstName} progress={successProgress} primaryButtonClass={primaryButtonClass} /> : null}
            </AnimatePresence>
          </div>
        </div>
      </section>

      <Dialog open={flow.emailDialogOpen} onOpenChange={flow.setEmailDialogOpen}>
        <DialogContent className={cn("max-w-[24rem] rounded-[28px] border p-6", isDarkTheme ? "border-white/10 bg-[#111010] text-white" : "border-black/10 bg-[#f8f8f6] text-[#171514]")}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-[-0.04em]">Confirme seu e-mail</DialogTitle>
            <DialogDescription className="text-sm font-semibold text-current/55">
              Digite o código de 6 dígitos enviado para {flow.draft.email || "seu e-mail"}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-3">
            <InputOTP maxLength={6} value={flow.otp} onChange={flow.setOtp}>
              <InputOTPGroup>
                {Array.from({ length: 6 }).map((_, index) => <InputOTPSlot key={index} index={index} />)}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button type="button" disabled={flow.loading || flow.otp.replace(/\D/g, "").length < 6} onClick={() => void submitOtp()} className={cn("h-12 rounded-[14px] text-[11px] font-black uppercase tracking-[0.16em]", primaryButtonClass)}>
            {flow.loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailCheck className="mr-2 h-4 w-4" />}
            Confirmar
          </Button>
          <button type="button" disabled={flow.resendCooldown > 0 || flow.loading} onClick={() => void resendOtp()} className="text-xs font-black uppercase tracking-[0.16em] text-current/45 disabled:opacity-40">
            {flow.resendCooldown > 0 ? `Reenviar em ${flow.resendCooldown}s` : "Reenviar código"}
          </button>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function CreateAccountSideRail({ logoSrc, isDarkTheme, stepNumber, progress }: { logoSrc: string; isDarkTheme: boolean; stepNumber: number; progress: number }) {
  const items = [
    { label: "Perfil", icon: UserRound },
    { label: "Senha", icon: ShieldCheck },
    { label: "Pronto", icon: CheckCircle2 },
  ];

  return (
    <aside className={cn("flex flex-col justify-between p-10", isDarkTheme ? "border-r-0" : "border-r border-current/5")}>
      <div className="inline-flex w-fit items-center gap-3">
        <img src={logoSrc} alt="NeuroNex AI" className="h-10 w-10 object-contain" />
        <span className="text-xs font-black uppercase tracking-[0.24em]">NeuroNex AI</span>
      </div>

      <div className="max-w-[24rem]">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-current/35">Cadastro seguro</p>
        <h1 className="mt-6 text-6xl font-black leading-[0.9] tracking-[-0.065em]">Sua conta NeuroNex começa aqui.</h1>
        <p className="mt-7 max-w-sm text-base font-semibold leading-relaxed text-current/50">Validamos seu e-mail antes da senha para evitar contas duplicadas e problemas de sessão.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {items.map((item, index) => {
          const active = index + 1 <= stepNumber;
          return (
            <div key={item.label} className={cn("min-h-[6.6rem] rounded-[24px] border p-4 transition-colors", active && isDarkTheme && "border-white bg-white text-black", active && !isDarkTheme && "border-black bg-black text-white", !active && isDarkTheme && "border-white/18 bg-white/[0.035] text-white/72", !active && !isDarkTheme && "border-black/12 bg-white/55 text-black/62")}>
              <item.icon className="h-5 w-5" />
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.12em]">{item.label}</p>
            </div>
          );
        })}
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-current/10">
        <motion.div className="h-full bg-current" animate={{ width: `${progress}%` }} />
      </div>
    </aside>
  );
}

function IdentityStep({ draft, inputClass, mutedPanelClass, selectContentClass, actionButtonClass, emailAvailability, recoveryEmailAvailability, loading, onChange, onSubmit }: { draft: CreateAccountDraft; inputClass: string; mutedPanelClass: string; selectContentClass: string; actionButtonClass: string; emailAvailability: EmailAvailability; recoveryEmailAvailability: EmailAvailability; loading: boolean; onChange: <K extends keyof CreateAccountDraft>(key: K, value: CreateAccountDraft[K]) => void; onSubmit: () => void }) {
  return (
    <motion.div variants={fadeSlide} initial="hidden" animate="visible" exit="exit" className="space-y-7">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-current/42">Criar conta</p>
        <h2 className="mt-2 text-[2rem] font-black leading-[0.95] tracking-[-0.06em]">Teste o NeuroNex AI grátis.</h2>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-current/56">Não pedimos cartão de crédito. Primeiro, só precisamos confirmar quem está chegando.</p>
      </div>

      <div className="space-y-5">
        <AuthField label="Seu nome completo"><Input value={draft.fullName} onChange={(event) => onChange("fullName", event.target.value)} autoComplete="name" placeholder="Nome e sobrenome" className={inputClass} /></AuthField>

        <AuthField label="Gênero">
          <Select value={draft.genderIdentity} onValueChange={(value) => onChange("genderIdentity", value as GenderIdentity)}>
            <SelectTrigger className={cn("h-[3.25rem] rounded-[10px] border px-3 text-sm font-bold", mutedPanelClass)}><SelectValue placeholder="Escolha uma opção" /></SelectTrigger>
            <SelectContent className={cn("rounded-[18px] shadow-2xl", selectContentClass)}>{genderOptions.map((option) => <SelectItem key={option.value} value={option.value} className="rounded-[12px] focus:bg-current/10 focus:text-current">{option.label}</SelectItem>)}</SelectContent>
          </Select>
        </AuthField>

        <AuthField label="E-mail"><Input value={draft.email} onChange={(event) => onChange("email", event.target.value)} type="email" inputMode="email" autoComplete="email" placeholder="voce@exemplo.com" className={inputClass} /><EmailAvailabilityHint availability={emailAvailability} kind="primary" /></AuthField>

        <AuthField label="E-mail de recuperação (opcional)"><Input value={draft.recoveryEmail} onChange={(event) => onChange("recoveryEmail", event.target.value)} type="email" inputMode="email" autoComplete="email" placeholder="email.alternativo@email.com" className={inputClass} /><EmailAvailabilityHint availability={recoveryEmailAvailability} kind="recovery" /></AuthField>

        <AuthField label="Celular / WhatsApp">
          <div className="grid grid-cols-[4.4rem_1fr] gap-2">
            <div className={cn("flex h-[3.25rem] items-center justify-center gap-2 rounded-[10px] border text-sm font-black", mutedPanelClass)}><span aria-hidden="true">BR</span><span>+55</span></div>
            <Input value={draft.phone} onChange={(event) => onChange("phone", event.target.value)} type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(11) 99999-0000" className={inputClass} />
          </div>
        </AuthField>

        <AuthField label="Conte um pouco sobre você">
          <Select value={draft.professionalContext} onValueChange={(value) => onChange("professionalContext", value as ProfessionalContext)}>
            <SelectTrigger className={cn("h-[3.25rem] rounded-[10px] border px-3 text-sm font-bold", mutedPanelClass)}><SelectValue placeholder="Escolha uma opção" /></SelectTrigger>
            <SelectContent className={cn("rounded-[18px] shadow-2xl", selectContentClass)}>{contextOptions.map((option) => <SelectItem key={option.value} value={option.value} className="rounded-[12px] focus:bg-current/10 focus:text-current">{option.label}</SelectItem>)}</SelectContent>
          </Select>
          {draft.professionalContext ? <p className="mt-2 text-[11px] font-semibold leading-relaxed text-current/45">{contextOptions.find((item) => item.value === draft.professionalContext)?.description}</p> : null}
        </AuthField>
      </div>

      <div className={cn("rounded-[18px] border p-1", mutedPanelClass)}>
        <button type="button" onClick={() => onChange("acceptedTerms", !draft.acceptedTerms)} className="flex min-h-[4.25rem] w-full items-start gap-3 rounded-[14px] p-3 text-left text-[11px] font-semibold leading-relaxed transition active:scale-[0.99]">
          <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] border", draft.acceptedTerms ? "bg-current text-background" : "border-current/25 bg-transparent")}>
            {draft.acceptedTerms ? <Check className="h-4 w-4" /> : null}
          </span>
          <span>
            Ao informar meus dados, eu concordo com a{" "}
            <Link to="/politica-de-privacidade" className="font-black underline underline-offset-4 hover:opacity-75" onClick={(event) => event.stopPropagation()}>Política de Privacidade</Link>{" "}
            e os{" "}
            <Link to="/termos-de-uso" className="font-black underline underline-offset-4 hover:opacity-75" onClick={(event) => event.stopPropagation()}>Termos de Uso</Link>{" "}
            da NeuroNex AI.
          </span>
        </button>
      </div>

      <Button type="button" disabled={loading || emailAvailability.status === "checking" || emailAvailability.status === "exists" || !draft.acceptedTerms} onClick={() => void onSubmit()} className={cn("h-14 w-full rounded-[12px] text-[11px] font-black uppercase tracking-[0.2em]", actionButtonClass)}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
        Próximo
      </Button>
    </motion.div>
  );
}

function PasswordStep({ firstName, inputClass, mutedPanelClass, primaryButtonClass, loading, password, confirmPassword, showPassword, strength, onPasswordChange, onConfirmPasswordChange, onTogglePassword, onSubmit }: { firstName: string; inputClass: string; mutedPanelClass: string; primaryButtonClass: string; loading: boolean; password: string; confirmPassword: string; showPassword: boolean; strength: PasswordStrength; onPasswordChange: (value: string) => void; onConfirmPasswordChange: (value: string) => void; onTogglePassword: () => void; onSubmit: () => void }) {
  return (
    <motion.div variants={fadeSlide} initial="hidden" animate="visible" exit="exit" className="space-y-7">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-current/42">E-mail confirmado</p>
        <h2 className="mt-2 text-[2rem] font-black leading-[0.95] tracking-[-0.06em]">Perfeito, {firstName}. Agora vamos criar sua senha.</h2>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-current/56">Crie uma senha para acessar a NeuroNex com segurança.</p>
      </div>

      <div className="space-y-5">
        <PasswordInput label="Senha" value={password} show={showPassword} className={inputClass} onToggle={onTogglePassword} onChange={onPasswordChange} />
        <PasswordStrengthCard strength={strength} mutedPanelClass={mutedPanelClass} />
        <PasswordInput label="Confirme sua senha" value={confirmPassword} show={showPassword} className={inputClass} onToggle={onTogglePassword} onChange={onConfirmPasswordChange} />
      </div>

      <Button type="button" disabled={loading} onClick={() => void onSubmit()} className={cn("h-14 w-full rounded-[12px] text-[11px] font-black", primaryButtonClass)}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
        Criar senha
      </Button>
    </motion.div>
  );
}

function SuccessStep({ firstName, progress, primaryButtonClass }: { firstName: string; progress: number; primaryButtonClass: string }) {
  return (
    <motion.div variants={fadeSlide} initial="hidden" animate="visible" exit="exit" className="flex min-h-[28rem] flex-col items-center justify-center text-center">
      <div className="relative mb-8"><div className="absolute inset-0 rounded-full bg-current/10 blur-3xl" /><div className="relative flex h-24 w-24 items-center justify-center rounded-[32px] border border-current/10 bg-current/[0.04]"><CheckCircle2 className="h-11 w-11" /></div></div>
      <h2 className="text-[2.3rem] font-black leading-[0.95] tracking-[-0.06em]">Conta criada, {firstName}.</h2>
      <p className="mt-4 max-w-sm text-sm font-semibold leading-relaxed text-current/55">Vamos abrir as configurações iniciais para deixar sua experiência pronta.</p>
      <div className="mt-8 h-2 w-full max-w-xs overflow-hidden rounded-full bg-current/10"><motion.div className="h-full rounded-full bg-current" animate={{ width: `${progress}%` }} /></div>
      <Button type="button" disabled className={cn("mt-8 h-12 rounded-[14px] px-8 text-[10px] font-black uppercase tracking-[0.18em] opacity-80", primaryButtonClass)}><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparando</Button>
    </motion.div>
  );
}

function PasswordInput({ label, value, show, className, onToggle, onChange }: { label: string; value: string; show: boolean; className: string; onToggle: () => void; onChange: (value: string) => void }) {
  return (
    <AuthField label={label}>
      <div className="relative">
        <Input value={value} onChange={(event) => onChange(event.target.value)} type={show ? "text" : "password"} autoComplete="new-password" className={cn("pr-12", className)} />
        <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[10px] text-current/45 hover:bg-current/10 hover:text-current" aria-label={show ? "Ocultar senha" : "Mostrar senha"}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </AuthField>
  );
}

function PasswordStrengthCard({ strength, mutedPanelClass }: { strength: PasswordStrength; mutedPanelClass: string }) {
  return (
    <div className={cn("rounded-[20px] border p-4", mutedPanelClass)}>
      <div className="grid gap-2">
        {passwordRules.map((rule) => {
          const ok = Boolean(strength[rule.key]);
          return <div key={rule.key} className="flex items-center gap-2 text-[11px] font-bold"><span className={cn("flex h-5 w-5 items-center justify-center rounded-full", ok ? "bg-emerald-500 text-white" : "bg-current/10 text-current/35")}>{ok ? <Check className="h-3.5 w-3.5" /> : null}</span>{rule.label}</div>;
        })}
      </div>
    </div>
  );
}

function EmailAvailabilityHint({ availability, kind }: { availability: EmailAvailability; kind: "primary" | "recovery" }) {
  if (availability.status === "idle") return null;
  const message = availability.message || (availability.status === "checking" ? "Verificando e-mail..." : availability.status === "available" ? "E-mail disponível." : availability.status === "exists" && kind === "primary" ? "Já existe uma conta com este e-mail." : availability.status === "exists" ? "Pode usar como recuperação." : "Confira este e-mail.");
  const tone = availability.status === "available" || (availability.status === "exists" && kind === "recovery") ? "text-emerald-500" : availability.status === "checking" ? "text-current/45" : "text-red-500";
  return <p className={cn("mt-2 text-[11px] font-bold", tone)}>{message}</p>;
}

function AuthField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-current/45">{label}</span>
      {children}
    </label>
  );
}
