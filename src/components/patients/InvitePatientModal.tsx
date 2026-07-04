import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { useInvitePatient, type PatientPortalInviteResult } from "@/hooks/use-invite-patient";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  Mail,
  MailPlus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface InvitePatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient?: {
    id?: string;
    name?: string | null;
    email?: string | null;
  } | null;
}

type InviteModalViewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient?: InvitePatientModalProps["patient"];
  patientName: string;
  canSend: boolean;
  data?: PatientPortalInviteResult;
  isPending: boolean;
  isLinked: boolean;
  expiresLabel: string | null;
  onSendInvite: () => void;
  onCopy: (value: string, label: string) => void;
};

const portalFeatures = [
  "Agenda compartilhada e histórico simples de sessões",
  "Diário de humor e anotações do paciente",
  "Documentos liberados explicitamente pelo psicólogo",
  "Financeiro do paciente com links de pagamento",
];

const firstName = (name?: string | null) => name?.trim().split(/\s+/)[0] || "paciente";

const InviteStatus = ({ canSend, data, isLinked, expiresLabel }: Pick<InviteModalViewProps, "canSend" | "data" | "isLinked" | "expiresLabel">) => {
  if (!canSend) {
    return (
      <div className="mx-auto flex w-full max-w-[560px] items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-left">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div>
          <p className="text-sm font-semibold text-foreground">E-mail obrigatório</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Cadastre um e-mail no prontuário antes de enviar o convite do Portal do Paciente.
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mx-auto flex w-full max-w-[560px] items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-left">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
      <div>
        <p className="text-sm font-semibold text-foreground">{isLinked ? "Paciente conectado" : "Convite enviado"}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {isLinked
            ? "Este paciente já possui vínculo ativo com o seu portal."
            : `O código expira junto do convite${expiresLabel ? ` em ${expiresLabel}` : ""}.`}
        </p>
      </div>
    </div>
  );
};

const ActivationCodeCard = ({ data, onCopy, compact = false }: { data?: PatientPortalInviteResult; onCopy: InviteModalViewProps["onCopy"]; compact?: boolean }) => {
  if (!data?.activationCode) return null;

  return (
    <section className="mx-auto w-full max-w-[560px] rounded-[26px] border border-emerald-500/25 bg-emerald-500/[0.08] p-4 text-center sm:p-5">
      <p className="text-sm font-semibold text-foreground">Código de ativação</p>
      <p className="mx-auto mt-1 max-w-[420px] text-sm leading-relaxed text-muted-foreground">
        Mostrado apenas neste envio. O paciente também recebe este código por e-mail.
      </p>

      <div className={cn("mx-auto mt-4 flex items-center justify-center gap-2", compact && "flex-col")}>
        <code className="rounded-2xl bg-background px-4 py-3 text-2xl font-semibold tracking-[0.24em] text-foreground shadow-sm">
          {data.activationCode}
        </code>
        <Button
          type="button"
          variant="outline"
          size={compact ? "sm" : "icon"}
          className={cn(compact ? "h-10 rounded-xl px-4" : "h-11 w-11 rounded-2xl")}
          onClick={() => onCopy(data.activationCode!, "Código")}
          aria-label="Copiar código de ativação"
        >
          <Copy className="h-4 w-4" />
          {compact ? <span className="ml-2">Copiar código</span> : null}
        </Button>
      </div>

      {data.portalUrl && (
        <div className="mt-4 rounded-2xl bg-background/80 p-3">
          <p className="mx-auto max-w-full break-all text-xs leading-relaxed text-muted-foreground">{data.portalUrl}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => onCopy(data.portalUrl!, "Link")}>
              <Copy className="mr-2 h-3.5 w-3.5" />
              Copiar link
            </Button>
            <Button asChild type="button" variant="outline" size="sm" className="rounded-xl">
              <a href={data.portalUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                Abrir
              </a>
            </Button>
          </div>
        </div>
      )}
    </section>
  );
};

const PatientSummary = ({ patient, compact = false }: { patient: InvitePatientModalProps["patient"]; compact?: boolean }) => (
  <section className="mx-auto w-full max-w-[560px] rounded-[26px] border border-border/60 bg-card/70 p-4 text-center sm:p-5">
    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-foreground text-background">
      <Mail className="h-4 w-4" />
    </div>
    <p className="mt-3 text-sm font-semibold text-foreground">{patient?.name || "Paciente sem nome"}</p>
    <p className="mt-1 break-all text-sm text-muted-foreground">{patient?.email || "E-mail não cadastrado"}</p>

    <div className={cn("mt-5 grid gap-3", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
      <div className="rounded-2xl bg-muted/45 p-3 text-left">
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            O e-mail inclui link público e código numérico de ativação com validade de 7 dias.
          </p>
        </div>
      </div>
      <div className="rounded-2xl bg-muted/45 p-3 text-left">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            Se o link falhar, o paciente pode entrar em /portal/ativar e ativar pelo código usando este mesmo e-mail.
          </p>
        </div>
      </div>
    </div>
  </section>
);

const FlowNotes = ({ compact = false }: { compact?: boolean }) => (
  <section className={cn("mx-auto grid w-full max-w-[560px] gap-2", compact ? "grid-cols-1" : "sm:grid-cols-3")}>
    {[
      "Paciente novo cria uma conta com o e-mail convidado.",
      "Paciente que já tem conta apenas entra e usa o novo código.",
      "Redefinição de senha mantém o paciente no fluxo do portal.",
    ].map((item) => (
      <div key={item} className="rounded-2xl border border-border/45 bg-background p-3 text-center">
        <Sparkles className="mx-auto h-4 w-4 text-muted-foreground" />
        <p className="mt-2 text-xs font-medium leading-relaxed text-muted-foreground">{item}</p>
      </div>
    ))}
  </section>
);

const PortalFeatureGrid = ({ compact = false }: { compact?: boolean }) => (
  <section className={cn("mx-auto grid w-full max-w-[560px] gap-2", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
    {portalFeatures.map((feature) => (
      <div key={feature} className="flex min-h-14 items-start gap-3 rounded-2xl border border-border/40 bg-background p-3 text-left">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm leading-snug text-muted-foreground">{feature}</span>
      </div>
    ))}
  </section>
);

const InviteActionButton = ({ data, isPending, isLinked, canSend, onSendInvite, className }: Pick<InviteModalViewProps, "data" | "isPending" | "isLinked" | "canSend" | "onSendInvite"> & { className?: string }) => (
  <Button onClick={onSendInvite} disabled={!canSend || isPending} className={cn("h-11 rounded-xl", className)}>
    {isPending ? (
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    ) : data ? (
      <RefreshCw className="mr-2 h-4 w-4" />
    ) : (
      <MailPlus className="mr-2 h-4 w-4" />
    )}
    {isLinked ? "Reenviar acesso" : data ? "Reenviar código" : "Convidar paciente"}
  </Button>
);

const DesktopInviteDialog = (props: InviteModalViewProps) => (
  <Dialog open={props.open} onOpenChange={props.onOpenChange}>
    <DialogContent
      style={{
        display: "flex",
        width: "min(640px, calc(100vw - 48px))",
        maxWidth: "640px",
        maxHeight: "min(760px, calc(100dvh - 48px))",
      }}
      className="grid-rows-none flex-col overflow-hidden rounded-[28px] border-border/55 bg-background p-0 shadow-2xl"
    >
      <DialogHeader className="shrink-0 items-center border-b border-border/50 bg-muted/20 px-6 py-5 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/60 bg-background shadow-sm">
          <MailPlus className="h-5 w-5" />
        </div>
        <DialogTitle className="mt-2 text-xl font-semibold tracking-tight">Convidar paciente</DialogTitle>
        <DialogDescription className="mx-auto mt-1 max-w-[460px] text-sm leading-relaxed text-muted-foreground">
          Envie o acesso seguro ao Portal do Paciente para {props.patientName}.
        </DialogDescription>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-4">
          <InviteStatus canSend={props.canSend} data={props.data} isLinked={props.isLinked} expiresLabel={props.expiresLabel} />
          <ActivationCodeCard data={props.data} onCopy={props.onCopy} />
          <PatientSummary patient={props.patient} />
          {props.data ? null : <FlowNotes />}
          {props.data ? <PortalFeatureGrid /> : null}
        </div>
      </div>

      <DialogFooter className="shrink-0 items-center justify-center gap-3 border-t border-border/50 bg-muted/20 px-6 py-4 sm:justify-center sm:space-x-0">
        <Button variant="ghost" onClick={() => props.onOpenChange(false)} disabled={props.isPending} className="h-11 rounded-xl px-5">
          Cancelar
        </Button>
        <InviteActionButton {...props} className="px-5" />
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

const MobileInviteDrawer = (props: InviteModalViewProps) => (
  <Drawer open={props.open} onOpenChange={props.onOpenChange}>
    <DrawerContent className="max-h-[92dvh] rounded-t-[32px] border-border/55 bg-background p-0">
      <DrawerHeader className="shrink-0 items-center px-5 pb-4 pt-7 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-muted/45">
          <MailPlus className="h-5 w-5" />
        </div>
        <DrawerTitle className="mt-3 text-xl font-semibold tracking-tight">Convidar paciente</DrawerTitle>
        <DrawerDescription className="mx-auto max-w-[320px] text-sm leading-relaxed text-muted-foreground">
          Envie o portal para {props.patientName} com link e código de ativação.
        </DrawerDescription>
      </DrawerHeader>

      <div className="flex-1 overflow-y-auto px-5 pb-4">
        <div className="mx-auto flex w-full max-w-[380px] flex-col items-center gap-4">
          <InviteStatus canSend={props.canSend} data={props.data} isLinked={props.isLinked} expiresLabel={props.expiresLabel} />
          <ActivationCodeCard data={props.data} onCopy={props.onCopy} compact />
          <PatientSummary patient={props.patient} compact />
          <FlowNotes compact />
          <PortalFeatureGrid compact />
        </div>
      </div>

      <DrawerFooter className="shrink-0 border-t border-border/50 bg-background/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
        <InviteActionButton {...props} className="w-full" />
        <Button variant="ghost" onClick={() => props.onOpenChange(false)} disabled={props.isPending} className="h-11 w-full rounded-xl">
          Cancelar
        </Button>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
);

export const InvitePatientModal = ({ isOpen, onClose, patient }: InvitePatientModalProps) => {
  const isMobile = useIsMobile();
  const { mutate: invitePatient, isPending, data, reset } = useInvitePatient();

  const patientName = firstName(patient?.name);
  const canSend = Boolean(patient?.id && patient?.email);
  const isLinked = data?.status === "linked";
  const expiresLabel = useMemo(() => {
    if (!data?.expiresAt) return null;
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(data.expiresAt));
  }, [data?.expiresAt]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      reset();
      onClose();
    }
  };

  const handleSendInvite = () => {
    if (!patient?.id) return;
    invitePatient({ patientId: patient.id });
  };

  const copyToClipboard = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado.`);
    } catch {
      toast.error(`Não foi possível copiar ${label.toLowerCase()}.`);
    }
  };

  const viewProps: InviteModalViewProps = {
    open: isOpen,
    onOpenChange: handleOpenChange,
    patient,
    patientName,
    canSend,
    data,
    isPending,
    isLinked,
    expiresLabel,
    onSendInvite: handleSendInvite,
    onCopy: copyToClipboard,
  };

  return isMobile ? <MobileInviteDrawer {...viewProps} /> : <DesktopInviteDialog {...viewProps} />;
};
