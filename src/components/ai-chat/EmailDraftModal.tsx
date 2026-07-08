import { useEffect, useState } from "react";
import { Edit3, Loader2, Mail, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { AppModalShell, ModalHeroIcon } from "@/components/ui/app-modal-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { edgeFunctionUrl } from "@/lib/supabase-config";

export type EmailDraftData = {
  to: string;
  subject: string;
  body: string;
  patientName?: string;
};

interface EmailDraftModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: EmailDraftData | null;
  onSent: () => void;
}

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : "Falha desconhecida no envio.");

export const EmailDraftModal = ({ open, onOpenChange, initialData, onSent }: EmailDraftModalProps) => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!initialData) return;

    setTo(initialData.to || "");
    setSubject(initialData.subject || "");
    setBody(initialData.body || "");
  }, [initialData]);

  const handleSend = async () => {
    if (!session?.access_token) {
      toast.error("Sessão expirada. Entre novamente para enviar e-mails.");
      return;
    }

    setIsSending(true);

    try {
      const response = await fetch(edgeFunctionUrl("send-document-email"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to,
          subject,
          htmlBody: body.replace(/\n/g, "<br>"),
          documentType: "Mensagem Direta",
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorData?.error || "Falha desconhecida no envio.");
      }

      toast.success("E-mail enviado com sucesso!");
      onSent();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      const message = getErrorMessage(error);

      if (message.includes("Google account not connected") || message.includes("Missing auth header")) {
        toast.error("Conta Google não conectada.", {
          description: "Vá em Configurações > Integrações para conectar.",
          action: {
            label: "Conectar",
            onClick: () => {
              onOpenChange(false);
              navigate("/ajustes?tab=integrations");
            },
          },
          duration: 5000,
        });
      } else if (message.includes("insufficient permissions") || message.includes("invalid_grant")) {
        toast.error("Permissão de e-mail expirada.", {
          description: "Reconecte sua conta Google para atualizar as permissões.",
          action: {
            label: "Reconectar",
            onClick: () => {
              onOpenChange(false);
              navigate("/ajustes?tab=integrations");
            },
          },
          duration: 5000,
        });
      } else {
        toast.error(`Erro ao enviar: ${message}`);
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AppModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="Revisar e-mail"
      description="A IA preparou este rascunho. Edite o conteúdo e confirme antes de enviar."
      eyebrow="Synapse"
      size="lg"
      preventClose={isSending}
      heroIcon={<ModalHeroIcon icon={Mail} ariaLabel="Rascunho de e-mail" />}
      bodyClassName="space-y-5 pb-5"
      footerClassName="border-t border-border/55 bg-background/92 dark:border-white/10 dark:bg-[#09090b]/92"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
            className="h-11 rounded-xl px-6 text-muted-foreground hover:text-foreground"
          >
            Descartar
          </Button>
          <Button type="button" onClick={handleSend} disabled={isSending} className="h-11 rounded-xl px-6 shadow-lg">
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Confirmar e Enviar
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="ml-1 text-[10px] font-bold uppercase text-muted-foreground">Para</Label>
          <Input
            type="email"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="h-11 rounded-xl border-border/55 bg-muted/35 font-mono text-xs text-foreground focus-visible:ring-1 dark:border-white/[0.075]"
          />
        </div>

        <div className="space-y-2">
          <Label className="ml-1 text-[10px] font-bold uppercase text-muted-foreground">Assunto</Label>
          <Input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="h-11 rounded-xl border-border/55 bg-muted/35 font-medium text-foreground focus-visible:ring-1 dark:border-white/[0.075]"
          />
        </div>

        <div className="space-y-2">
          <Label className="ml-1 text-[10px] font-bold uppercase text-muted-foreground">Mensagem</Label>
          <div className="relative">
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className="min-h-[220px] resize-none rounded-xl border-border/55 bg-muted/35 p-4 text-sm leading-relaxed text-foreground focus-visible:ring-1 dark:border-white/[0.075]"
            />
            <Edit3 className="pointer-events-none absolute bottom-4 right-4 h-4 w-4 text-muted-foreground/40" />
          </div>
        </div>
      </div>
    </AppModalShell>
  );
};
