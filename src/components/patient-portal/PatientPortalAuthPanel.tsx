import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth/SessionContextProvider";
import {
  createPatientPortalAccess,
  sendPatientPortalAccessLink,
  sendPatientPortalPasswordReset,
} from "@/hooks/use-patient-portal";
import { supabase } from "@/integrations/supabase/client";
import { isPatientAccount } from "@/lib/auth-account-role";
import { storePatientPortalInviteToken } from "@/lib/patient-portal-flow";
import { cn } from "@/lib/utils";
import { ArrowLeft, Loader2, LogIn, Mail, UserPlus } from "lucide-react";
import { toast } from "sonner";

type AuthMode = "choice" | "login" | "signup";

interface PatientPortalAuthPanelProps {
  inviteToken?: string;
  initialMode?: AuthMode;
  expectedEmailMasked?: string;
  onAuthenticated: () => void | Promise<void>;
  className?: string;
}

const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const PatientPortalAuthPanel = ({
  inviteToken,
  initialMode = "choice",
  expectedEmailMasked,
  onAuthenticated,
  className,
}: PatientPortalAuthPanelProps) => {
  const { refetchUser, signOut } = useAuth();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState<"signup" | "login" | "link" | "reset" | null>(null);

  const rememberToken = () => {
    if (inviteToken) storePatientPortalInviteToken(inviteToken);
  };

  const finishAuthenticated = async () => {
    rememberToken();
    await refetchUser();
    await onAuthenticated();
  };

  const handleSignup = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password || !confirmPassword) {
      toast.error("Preencha e-mail, senha e confirmacao.");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter no minimo 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas nao coincidem.");
      return;
    }
    if (!acceptedTerms) {
      toast.error("Aceite os termos para criar o acesso.");
      return;
    }

    setLoading("signup");
    try {
      rememberToken();
      const result = await createPatientPortalAccess({
        email: normalizedEmail,
        password,
        inviteToken,
      });

      if (result.status === "existing_user") {
        toast.info("Ja existe uma conta para este e-mail. Entre com sua senha ou use o link enviado.");
        setMode("login");
        return;
      }

      const authResult = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (authResult.error) throw authResult.error;
      if (!authResult.data.user || !isPatientAccount(authResult.data.user)) {
        await signOut();
        throw new Error("Este e-mail nao pertence a uma conta de paciente.");
      }

      toast.success("Acesso criado. Informe o codigo recebido para ativar o portal.");
      await finishAuthenticated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel criar seu acesso.");
    } finally {
      setLoading(null);
    }
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password) {
      toast.error("Preencha e-mail e senha.");
      return;
    }

    setLoading("login");
    try {
      rememberToken();
      const result = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (result.error) throw result.error;
      if (!result.data.user || !isPatientAccount(result.data.user)) {
        await signOut();
        throw new Error("Use uma conta de paciente para acessar este portal.");
      }

      toast.success("Login realizado. Continue a ativacao do convite.");
      await finishAuthenticated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel entrar.");
    } finally {
      setLoading(null);
    }
  };

  const handleAccessLink = async () => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      toast.error("Digite seu e-mail para receber o link.");
      return;
    }

    setLoading("link");
    try {
      rememberToken();
      await sendPatientPortalAccessLink({ email: normalizedEmail, inviteToken });
      toast.success("Se houver uma conta de paciente, enviaremos o link de acesso.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel enviar o link.");
    } finally {
      setLoading(null);
    }
  };

  const handleResetPassword = async () => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      toast.error("Digite seu e-mail para redefinir a senha.");
      return;
    }

    setLoading("reset");
    try {
      rememberToken();
      await sendPatientPortalPasswordReset({ email: normalizedEmail, inviteToken });
      toast.success("Se houver uma conta de paciente, enviaremos o link de redefinicao.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel enviar o link de redefinicao.");
    } finally {
      setLoading(null);
    }
  };

  if (mode === "choice") {
    return (
      <div className={cn("space-y-3", className)}>
        {expectedEmailMasked ? (
          <p className="text-sm text-muted-foreground">
            Use o e-mail do convite ({expectedEmailMasked}) para liberar seu acesso.
          </p>
        ) : null}
        <Button onClick={() => setMode("signup")} className="h-12 w-full rounded-2xl">
          <UserPlus className="mr-2 h-4 w-4" />
          Criar meu acesso
        </Button>
        <Button onClick={() => setMode("login")} variant="outline" className="h-12 w-full rounded-2xl">
          <LogIn className="mr-2 h-4 w-4" />
          Ja tenho uma conta
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("space-y-5", className)}>
      <button
        type="button"
        onClick={() => setMode("choice")}
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      {mode === "signup" ? (
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Criar acesso de paciente</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A conta do paciente e global. O codigo do convite vincula esta conta ao consultorio correto.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="patient-signup-email">E-mail do convite</Label>
            <Input
              id="patient-signup-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seu@email.com"
              className="h-12 rounded-2xl"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="patient-signup-password">Senha</Label>
              <Input
                id="patient-signup-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 rounded-2xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="patient-signup-confirm">Confirmar senha</Label>
              <Input
                id="patient-signup-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="h-12 rounded-2xl"
              />
            </div>
          </div>
          <label className="flex items-start gap-3 rounded-2xl border border-border/50 bg-muted/25 p-4 text-sm leading-relaxed">
            <Checkbox
              checked={acceptedTerms}
              onCheckedChange={(value) => setAcceptedTerms(value === true)}
              className="mt-0.5"
            />
            <span>
              Li e aceito os Termos de Uso e a Politica de Privacidade aplicaveis ao Portal do Paciente.
            </span>
          </label>
          <Button type="submit" disabled={loading !== null} className="h-12 w-full rounded-2xl">
            {loading === "signup" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            Criar acesso
          </Button>
        </form>
      ) : (
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Entrar como paciente</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Depois do login, voce volta automaticamente para a ativacao do convite.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="patient-login-email">E-mail</Label>
            <Input
              id="patient-login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seu@email.com"
              className="h-12 rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="patient-login-password">Senha</Label>
            <Input
              id="patient-login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 rounded-2xl"
            />
          </div>
          <Button type="submit" disabled={loading !== null} className="h-12 w-full rounded-2xl">
            {loading === "login" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
            Entrar e continuar
          </Button>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" disabled={loading !== null} onClick={handleAccessLink} className="h-11 rounded-2xl">
              {loading === "link" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              Enviar link
            </Button>
            <Button type="button" variant="ghost" disabled={loading !== null} onClick={handleResetPassword} className="h-11 rounded-2xl">
              {loading === "reset" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Redefinir senha
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};
