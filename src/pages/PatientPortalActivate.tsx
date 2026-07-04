import { PatientPortalAuthPanel } from "@/components/patient-portal/PatientPortalAuthPanel";
import { useAuth } from "@/components/auth/SessionContextProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActivatePatientPortal, usePatientPortalCurrent, usePatientPortalInvitePreview } from "@/hooks/use-patient-portal";
import {
  clearPatientPortalInviteToken,
  readPatientPortalInviteToken,
  storePatientPortalInviteToken,
} from "@/lib/patient-portal-flow";
import { KeyRound, Loader2, LogIn, MailCheck, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

const PatientPortalActivate = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const queryToken = searchParams.get("token") || "";
  const [token, setToken] = useState(() => queryToken || readPatientPortalInviteToken());
  const [code, setCode] = useState("");
  const current = usePatientPortalCurrent();
  const preview = usePatientPortalInvitePreview(token);
  const activate = useActivatePatientPortal();

  useEffect(() => {
    if (!queryToken) return;
    const stored = storePatientPortalInviteToken(queryToken);
    setToken(stored);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("token");
    setSearchParams(nextParams, { replace: true });
  }, [queryToken, searchParams, setSearchParams]);

  useEffect(() => {
    if (current.data?.status !== "active") return;
    clearPatientPortalInviteToken();
    navigate("/portal", { replace: true });
  }, [current.data?.status, navigate]);

  const expectedEmailMasked = useMemo(() => preview.data?.patient.emailMasked, [preview.data?.patient.emailMasked]);

  const handleCodeChange = (value: string) => {
    setCode(value.replace(/\D/g, "").slice(0, 6));
  };

  const handleActivate = () => {
    if (code.length !== 6) {
      toast.error("Informe o codigo de 6 digitos.");
      return;
    }

    activate.mutate(
      { token: token || undefined, code },
      {
        onSuccess: () => {
          clearPatientPortalInviteToken();
          toast.success("Portal ativado com seguranca.");
          navigate("/portal", { replace: true });
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Nao foi possivel ativar o portal.");
        },
      },
    );
  };

  const renderCardBody = () => {
    if (isLoading) {
      return (
        <div className="flex min-h-40 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (!user) {
      return (
        <div className="space-y-5">
          <div className="rounded-3xl border border-border/50 bg-background p-4">
            <div className="flex gap-3">
              <LogIn className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold">Entre ou crie seu acesso</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Para ativar o convite, primeiro confirme que voce esta usando a conta de paciente correta.
                </p>
              </div>
            </div>
          </div>
          <PatientPortalAuthPanel
            inviteToken={token}
            expectedEmailMasked={expectedEmailMasked}
            onAuthenticated={() => undefined}
          />
        </div>
      );
    }

    if (current.isLoading) {
      return (
        <div className="flex min-h-40 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (!token && current.data?.status !== "needs_activation") {
      return (
        <div className="rounded-3xl border border-border/50 bg-background p-5">
          <div className="flex gap-3">
            <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold">Nenhum consultorio vinculado</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Use o link de convite enviado pelo profissional ou solicite um novo convite.
              </p>
              <Button onClick={() => navigate("/portal/convite")} variant="outline" className="mt-4 h-11 rounded-2xl">
                Voltar ao convite
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        {preview.data ? (
          <div className="rounded-3xl border border-border/50 bg-background p-4">
            <p className="text-sm font-medium text-muted-foreground">Convite para</p>
            <p className="mt-1 text-base font-semibold">{preview.data.patient.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{preview.data.patient.emailMasked}</p>
          </div>
        ) : null}

        {preview.isError && token ? (
          <div className="rounded-3xl border border-amber-500/25 bg-amber-500/10 p-4">
            <p className="text-sm font-semibold">Nao conseguimos validar este link.</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Se o codigo ainda estiver valido, tente a ativacao com o mesmo e-mail do convite.
            </p>
          </div>
        ) : null}

        {!token ? (
          <div className="rounded-3xl border border-border/50 bg-background p-4">
            <div className="flex gap-3">
              <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold">Ativacao por codigo</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Use este caminho quando voce recebeu o codigo por e-mail, mas o link do convite nao abriu.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <label className="block">
          <span className="text-sm font-semibold text-foreground">Codigo de ativacao</span>
          <Input
            value={code}
            onChange={(event) => handleCodeChange(event.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            className="mt-2 h-14 rounded-2xl text-center text-2xl font-semibold tracking-[0.3em]"
          />
        </label>

        <Button onClick={handleActivate} disabled={activate.isPending || preview.isLoading} className="h-12 w-full rounded-2xl">
          {activate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
          Ativar acesso
        </Button>
      </div>
    );
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10 text-foreground">
      <section className="w-full max-w-[620px] rounded-[34px] border border-border/55 bg-card/88 p-6 shadow-2xl shadow-black/5 sm:p-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-foreground text-background">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Ativar Portal</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          O e-mail da conta precisa ser o mesmo do convite. Depois disso, informe o codigo de 6 digitos recebido por e-mail.
        </p>

        <div className="mt-6">{renderCardBody()}</div>
      </section>
    </main>
  );
};

export default PatientPortalActivate;
