import { useAuth } from "@/components/auth/SessionContextProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import {
  formatBrazilianPhone,
  isValidBrazilianPhone,
  normalizeBrazilianPhoneDigits,
} from "@/lib/brazilian-phone";
import {
  disableBiometricSignIn,
  enableBiometricSignIn,
  canAttemptNativeBiometrics,
  getBiometricPreferenceForUser,
  getBiometricStatus,
  isBiometricStatusUsable,
  isBiometricEnabledForUser,
  type BiometricPreference,
  type BiometricStatus,
} from "@/lib/native-mobile-security";
import { Fingerprint, KeyRound, Loader2, Mail, Phone } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AuthenticatorSettings } from "./AuthenticatorSettings";

const Card = ({ children }: { children: ReactNode }) => (
  <section className="rounded-[24px] border border-border/50 bg-card p-6 md:p-8">
    {children}
  </section>
);

const formatStoredPhone = (value?: string | null) => {
  if (!value) return "não cadastrado";
  const formatted = formatBrazilianPhone(value);
  return formatted ? `+55 ${formatted}` : value;
};

export const SecuritySettingsPanelV2 = () => {
  const { session, user } = useAuth();
  const { profile, refetch: refetchProfile } = useProfile();
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [phoneHasTooManyDigits, setPhoneHasTooManyDigits] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [biometricStatus, setBiometricStatus] =
    useState<BiometricStatus | null>(null);
  const [biometricPreference, setBiometricPreference] =
    useState<BiometricPreference>("unset");

  const refreshBiometricSettings = useCallback(async () => {
    const status = await getBiometricStatus();
    setBiometricStatus(status);
    setBiometricPreference(getBiometricPreferenceForUser(user?.id));
  }, [user?.id]);

  useEffect(() => {
    void refreshBiometricSettings().catch(() => undefined);
  }, [refreshBiometricSettings]);

  const changeEmail = async () => {
    if (!newEmail.includes("@")) return toast.error("Digite um e-mail válido.");
    setSaving("email");
    try {
      const result = await supabase.auth.updateUser({
        email: newEmail.trim().toLowerCase(),
      });
      if (result.error) throw result.error;
      setNewEmail("");
      toast.success("Enviamos a confirmação para o novo endereço.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar o e-mail.",
      );
    } finally {
      setSaving(null);
    }
  };

  const changePhone = async () => {
    if (!user || phoneHasTooManyDigits || !isValidBrazilianPhone(newPhone)) {
      return toast.error(
        "Digite o DDD e um telefone com oito ou nove dígitos.",
      );
    }
    const canonicalPhone = `+55${normalizeBrazilianPhoneDigits(newPhone)}`;
    setSaving("phone");
    try {
      const result = await supabase
        .from("profiles")
        .update({ phone: canonicalPhone })
        .eq("id", user.id);
      if (result.error) throw result.error;
      setNewPhone("");
      setPhoneHasTooManyDigits(false);
      await refetchProfile();
      toast.success("Telefone de contato atualizado.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o telefone.",
      );
    } finally {
      setSaving(null);
    }
  };

  const changePassword = async () => {
    if (!user?.email || !currentPassword || !newPassword)
      return toast.error("Preencha todos os campos.");
    if (newPassword.length < 8)
      return toast.error("Use pelo menos oito caracteres.");
    if (newPassword !== confirmPassword)
      return toast.error("As novas senhas não coincidem.");
    setSaving("password");
    try {
      const authentication = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (authentication.error) throw new Error("A senha atual não confere.");
      const result = await supabase.auth.updateUser({ password: newPassword });
      if (result.error) throw result.error;
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Senha alterada com segurança.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar a senha.",
      );
    } finally {
      setSaving(null);
    }
  };

  const toggleBiometrics = async (enabled: boolean) => {
    if (!user?.id) return;
    setBiometricBusy(true);
    try {
      if (enabled) {
        if (!session)
          throw new Error(
            "Entre novamente para ativar a biometria neste aparelho.",
          );
        await enableBiometricSignIn({
          userId: user.id,
          email: user.email,
          session,
        });
        toast.success("Login com biometria ativado neste aparelho.");
      } else {
        await disableBiometricSignIn(user.id);
        toast.success("Login com biometria desativado neste aparelho.");
      }
      await refreshBiometricSettings();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar a biometria.",
      );
    } finally {
      setBiometricBusy(false);
    }
  };

  const biometricEnabled = Boolean(
    user?.id && isBiometricEnabledForUser(user.id),
  );
  const biometricAvailable = Boolean(isBiometricStatusUsable(biometricStatus));
  const biometricCanAttempt =
    biometricAvailable || canAttemptNativeBiometrics();
  const biometricStatusText = !biometricAvailable
    ? biometricCanAttempt
      ? "Toque para validar a biometria neste aparelho."
      : "Disponível em aparelhos com biometria ou bloqueio seguro."
    : biometricAvailable
      ? biometricPreference === "disabled"
        ? "Desativado por escolha neste aparelho."
        : "Aparelho pronto para acesso e confirmações com biometria."
      : biometricStatus?.reason ||
        "Configure digital, rosto ou bloqueio seguro no aparelho.";

  return (
    <div className="max-w-4xl space-y-8">
      <header>
        <h2 className="text-2xl font-bold">Login e Segurança</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie as formas de acesso e proteção da sua conta.
        </p>
      </header>

      <AuthenticatorSettings />

      <Card>
        <div className="flex items-start justify-between gap-5">
          <div className="flex gap-5">
            <Fingerprint className="mt-1 h-6 w-6 text-muted-foreground" />
            <div>
              <h3 className="font-bold">Entrar com biometria</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Use digital, rosto ou bloqueio do aparelho para entrar e
                confirmar ações importantes.
              </p>
              <p className="mt-3 text-xs font-medium text-muted-foreground">
                {biometricStatusText}
              </p>
            </div>
          </div>
          {biometricBusy ? (
            <Loader2 className="mt-1 h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <Switch
              checked={biometricEnabled}
              disabled={
                !user?.id || (!biometricCanAttempt && !biometricEnabled)
              }
              onCheckedChange={(value) => void toggleBiometrics(value)}
            />
          )}
        </div>
      </Card>

      <Card>
        <div className="flex gap-5">
          <Mail className="mt-1 h-6 w-6 text-muted-foreground" />
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="font-bold">E-mail de acesso</h3>
              <p className="text-sm text-muted-foreground">
                Atual: {user?.email}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                placeholder="Novo e-mail"
              />
              <Button
                onClick={() => void changeEmail()}
                disabled={saving === "email"}
              >
                {saving === "email" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Alterar"
                )}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex gap-5">
          <Phone className="mt-1 h-6 w-6 text-muted-foreground" />
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="font-bold">Telefone de contato</h3>
              <p className="text-sm text-muted-foreground">
                Atual: {formatStoredPhone(profile?.phone)}. Usaremos este número
                apenas como contato da conta.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex min-w-0 flex-1 overflow-hidden rounded-md border border-input bg-background shadow-sm focus-within:ring-1 focus-within:ring-ring">
                <span
                  className="flex h-10 shrink-0 items-center border-r border-border/60 bg-muted/35 px-3 text-sm font-semibold text-foreground"
                  aria-hidden="true"
                >
                  +55
                </span>
                <Input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  value={newPhone}
                  onChange={(event) => {
                    setPhoneHasTooManyDigits(
                      normalizeBrazilianPhoneDigits(event.target.value).length > 11,
                    );
                    setNewPhone(formatBrazilianPhone(event.target.value));
                  }}
                  placeholder="(48) 98872-4548"
                  maxLength={16}
                  aria-label="Telefone com DDD"
                  className="min-w-0 flex-1 rounded-none border-0 shadow-none focus-visible:ring-0"
                />
              </div>
              <Button
                onClick={() => void changePhone()}
                disabled={saving === "phone"}
              >
                {saving === "phone" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Salvar"
                )}
              </Button>
            </div>
            <p className={phoneHasTooManyDigits ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}>
              {phoneHasTooManyDigits
                ? "O telefone excedeu o limite. Digite apenas DDD e oito ou nove dígitos."
                : "Aceita celular com o nono dígito e telefone fixo."}
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex gap-5">
          <KeyRound className="mt-1 h-6 w-6 text-muted-foreground" />
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="font-bold">Senha</h3>
              <p className="text-sm text-muted-foreground">
                Confirme a senha atual antes de substituí-la.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Senha atual"
              />
              <Input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Nova senha"
              />
              <Input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirmar nova senha"
              />
            </div>
            <Button
              onClick={() => void changePassword()}
              disabled={saving === "password"}
            >
              {saving === "password" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Atualizar senha"
              )}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-bold">PIN do NeuroFinance</h3>
            <p className="text-sm text-muted-foreground">
              O PIN é único para a sua conta e deve ser gerenciado na área
              financeira.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/ajustes?tab=payments">Ir para NeuroFinance</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
};
