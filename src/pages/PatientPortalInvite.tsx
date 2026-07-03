import { PatientPortalAuthPanel } from "@/components/patient-portal/PatientPortalAuthPanel";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/SessionContextProvider";
import { useActivatePatientPortal, usePatientPortalInvitePreview } from "@/hooks/use-patient-portal";
import {
  clearPatientPortalInviteToken,
  readPatientPortalInviteToken,
  storePatientPortalInviteToken,
} from "@/lib/patient-portal-flow";
import { CalendarClock, CheckCircle2, KeyRound, Loader2, LockKeyhole, ShieldCheck, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

type InviteStep = "preview" | "auth" | "activation" | "success";

const PatientPortalInvite = () => {
  const { token: tokenFromPath = "" } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [inviteToken, setInviteToken] = useState(() => tokenFromPath || readPatientPortalInviteToken());
  const [step, setStep] = useState<InviteStep>(user ? "activation" : "preview");
  const [code, setCode] = useState("");
  const preview = usePatientPortalInvitePreview(inviteToken);
  const activate = useActivatePatientPortal();

  useEffect(() => {
    if (!tokenFromPath) return;
    const stored = storePatientPortalInviteToken(tokenFromPath);
    setInviteToken(stored);
    navigate("/portal/convite", { replace: true });
  }, [navigate, tokenFromPath]);

  useEffect(() => {
    if (user && step === "auth") setStep("activation");
  }, [step, user]);

  const handleAuthenticated = () => {
    setStep("activation");
  };

  const handleCodeChange = (value: string) => {
    setCode(value.replace(/\D/g, "").slice(0, 6));
  };

  const handleActivate = () => {
    if (code.length !== 6) {
      toast.error("Informe o codigo de 6 digitos.");
      return;
    }

    activate.mutate(
      { token: inviteToken || undefined, code },
      {
        onSuccess: () => {
          clearPatientPortalInviteToken();
          setStep("success");
          toast.success("Portal ativado com seguranca.");
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Nao foi possivel ativar o portal.");
        },
      },
    );
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10 text-foreground">
      <section className="w-full max-w-[720px] overflow-hidden rounded-[34px] border border-border/55 bg-card/88 shadow-2xl shadow-black/5">
        <div className="border-b border-border/50 bg-muted/25 px-6 py-6 sm:px-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-foreground text-background">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">Convite para o Portal NeuroNex</h1>
          <p className="mt-3 max-w-[560px] text-sm leading-relaxed text-muted-foreground">
            Ative sua area segura para acompanhar agenda, documentos compartilhados, diario e financeiro.
          </p>
        </div>

        <div className="space-y-5 px-6 py-6 sm:px-8">
          {preview.isLoading && (
            <div className="flex min-h-40 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
          )}

          {preview.isError && (
            <div className="rounded-3xl border border-amber-500/25 bg-amber-500/10 p-5">
              <p className="text-base font-semibold">Convite indisponivel</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                O link pode ter expirado, ter sido copiado incompleto ou ter sido substituido por um convite mais recente.
                Se voce ainda tem o codigo recebido por e-mail, entre no Portal e tente a ativacao por codigo.
              </p>
              <Button onClick={() => navigate("/portal/ativar")} className="mt-4 h-11 rounded-2xl">
                Ir para ativacao
              </Button>
            </div>
          )}

          {preview.data && (
            <>
              <div className="rounded-3xl border border-border/50 bg-background p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Paciente</p>
                    <p className="mt-1 text-xl font-semibold">{preview.data.patient.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{preview.data.patient.emailMasked}</p>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
                <div className="mt-5 rounded-2xl bg-muted/45 p-4">
                  <p className="text-sm font-medium text-muted-foreground">Profissional</p>
                  <p className="mt-1 text-base font-semibold">{preview.data.professional.name}</p>
                  {preview.data.professional.clinicName && (
                    <p className="mt-1 text-sm text-muted-foreground">{preview.data.professional.clinicName}</p>
                  )}
                </div>
              </div>

              {step === "preview" && (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-3xl border border-border/50 bg-background p-4">
                      <KeyRound className="h-5 w-5 text-muted-foreground" />
                      <p className="mt-3 text-sm font-semibold">Codigo por e-mail</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Informe o codigo de 6 digitos para ativar.</p>
                    </div>
                    <div className="rounded-3xl border border-border/50 bg-background p-4">
                      <CalendarClock className="h-5 w-5 text-muted-foreground" />
                      <p className="mt-3 text-sm font-semibold">Validade</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">O convite expira em 7 dias.</p>
                    </div>
                    <div className="rounded-3xl border border-border/50 bg-background p-4">
                      <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                      <p className="mt-3 text-sm font-semibold">Privacidade</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Notas clinicas internas nao sao exibidas.</p>
                    </div>
                  </div>

                  <Button onClick={() => setStep(user ? "activation" : "auth")} className="h-12 w-full rounded-2xl">
                    <UserPlus className="mr-2 h-4 w-4" />
                    {user ? "Inserir codigo de ativacao" : "Inserir codigo de ativacao"}
                  </Button>
                </>
              )}

              {step === "auth" && (
                <PatientPortalAuthPanel
                  inviteToken={inviteToken}
                  expectedEmailMasked={preview.data.patient.emailMasked}
                  onAuthenticated={handleAuthenticated}
                />
              )}

              {step === "activation" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold">Informe o codigo de ativacao</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      O codigo precisa ser o mesmo recebido por e-mail e a conta deve usar o e-mail do convite.
                    </p>
                  </div>
                  <Input
                    value={code}
                    onChange={(event) => handleCodeChange(event.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    className="h-14 rounded-2xl text-center text-2xl font-semibold tracking-[0.3em]"
                  />
                  <Button onClick={handleActivate} disabled={activate.isPending} className="h-12 w-full rounded-2xl">
                    {activate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                    Ativar portal
                  </Button>
                </div>
              )}

              {step === "success" && (
                <div className="rounded-3xl border border-emerald-500/25 bg-emerald-500/10 p-5">
                  <p className="text-base font-semibold">Portal ativado</p>
                  <p className="mt-2 text-sm text-muted-foreground">Seu acesso esta pronto.</p>
                  <Button onClick={() => navigate("/portal", { replace: true })} className="mt-4 h-11 rounded-2xl">
                    Entrar no Portal
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
};

export default PatientPortalInvite;
