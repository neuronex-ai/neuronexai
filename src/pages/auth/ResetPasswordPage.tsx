import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import type { PatientPortalContext } from "@/hooks/use-patient-portal";
import {
  clearPatientPortalInviteToken,
  readPatientPortalInviteToken,
  storePatientPortalInviteToken,
} from "@/lib/patient-portal-flow";
import { readSupabaseFunctionError } from "@/lib/read-supabase-function-error";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

type RecoveryState = "checking" | "ready" | "invalid";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [recoveryState, setRecoveryState] = useState<RecoveryState>("checking");
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const next = searchParams.get("next");
  const isPortalFlow = next === "portal";

  useEffect(() => {
    let cancelled = false;

    const cleanRecoveryUrl = () => {
      const params = new URLSearchParams(window.location.search);
      params.delete("code");
      params.delete("token");
      const nextQuery = params.toString();
      window.history.replaceState(
        {},
        document.title,
        `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`,
      );
    };

    const prepareRecoverySession = async () => {
      const params = new URLSearchParams(window.location.search);
      const inviteToken = params.get("token");
      if (inviteToken) storePatientPortalInviteToken(inviteToken);

      const code = params.get("code");
      const { data: existing } = await supabase.auth.getSession();
      if (existing.session) {
        if (!cancelled) setRecoveryState("ready");
        cleanRecoveryUrl();
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        if (!cancelled) setRecoveryState("ready");
        cleanRecoveryUrl();
        return;
      }

      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const hashError = hashParams.get("error_description");
      if (hashError) throw new Error(decodeURIComponent(hashError));

      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const recoveryType = hashParams.get("type");
      if (accessToken && refreshToken && (!recoveryType || recoveryType === "recovery")) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) throw error;
        window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
        if (!cancelled) setRecoveryState("ready");
        return;
      }

      if (!cancelled) setRecoveryState("invalid");
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) setRecoveryState("ready");
    });

    prepareRecoverySession().catch((error) => {
      console.error("Password recovery error:", error);
      if (!cancelled) {
        toast.error(error instanceof Error ? error.message : "Link de recuperacao invalido ou expirado.");
        setRecoveryState("invalid");
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  const navigateAfterPortalReset = async () => {
    const inviteToken = readPatientPortalInviteToken();
    const { data, error } = await supabase.functions.invoke<PatientPortalContext>("patient-portal-current", {
      body: { action: "current" },
    });

    if (error) {
      const message = await readSupabaseFunctionError(error, "Nao foi possivel carregar o Portal do Paciente.");
      toast.error(message);
      navigate("/portal/ativar", { replace: true });
      return;
    }

    if (data?.status === "active") {
      clearPatientPortalInviteToken();
      navigate("/portal", { replace: true });
      return;
    }

    if (data?.status === "needs_activation" || inviteToken) {
      navigate("/portal/ativar", { replace: true });
      return;
    }

    navigate("/portal/ativar", { replace: true });
  };

  const handleReset = async (event: React.FormEvent) => {
    event.preventDefault();

    if (recoveryState !== "ready") {
      toast.error("Abra o link de redefinicao recebido por e-mail antes de salvar a nova senha.");
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

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast.success("Senha redefinida com sucesso.");

      if (isPortalFlow) {
        await navigateAfterPortalReset();
        return;
      }

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) {
        navigate("/auth", { replace: true });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("setup_completed")
        .eq("id", userId)
        .maybeSingle();

      navigate(profile?.setup_completed ? "/dashboard" : "/initial-settings", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao redefinir senha.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    if (recoveryState === "checking") {
      return (
        <div className="flex min-h-40 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (recoveryState === "invalid") {
      return (
        <div className="space-y-5 text-center">
          <p className="text-sm leading-relaxed text-muted-foreground">
            O link de redefinicao expirou ou ja foi usado. Solicite um novo link para continuar.
          </p>
          <Button onClick={() => navigate(isPortalFlow ? "/portal/ativar" : "/auth", { replace: true })} className="h-12 w-full rounded-2xl">
            Solicitar novo acesso
          </Button>
        </div>
      );
    }

    return (
      <form onSubmit={handleReset} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="new-password">Nova senha</Label>
          <div className="relative">
            <Input
              id="new-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Digite uma senha segura"
              autoComplete="new-password"
              className="h-14 rounded-2xl pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirmar senha</Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            className="h-14 rounded-2xl"
          />
        </div>

        <Button type="submit" disabled={isLoading} className="h-14 w-full rounded-2xl">
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Salvar nova senha"}
        </Button>
      </form>
    );
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <section className="w-full max-w-md rounded-[34px] border border-border/55 bg-card/90 p-8 shadow-2xl shadow-black/5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-foreground text-background">
          <KeyRound className="h-7 w-7" />
        </div>
        <div className="mt-6 space-y-3 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Redefinir senha</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Crie uma nova senha segura para continuar.
          </p>
        </div>

        <div className="mt-8">{renderContent()}</div>
      </section>
    </main>
  );
};

export default ResetPasswordPage;
