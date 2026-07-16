import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  EdgeFunctionInvocationError,
  normalizeEdgeFunctionError,
} from "@/lib/invoke-edge-function";
import { toast } from "sonner";

interface SendDocumentEmailParams {
  to: string;
  subject: string;
  htmlBody: string;
  documentType: string;
  recipientName?: string;
  actionUrl?: string;
  pdfAttachment: {
    filename: string;
    content: string;
    contentType: string;
  };
}

interface SendReminderEmailParams {
  appointmentId?: string;
  idempotencyKey?: string;
  patientEmail: string;
  patientName: string;
  startTime: string;
  location?: string;
  type?: string;
  action?: "invite" | "reminder" | "cancel" | "reschedule";
  cancellationReason?: string;
}

type SendEmailParams =
  | { type: "document"; params: SendDocumentEmailParams }
  | { type: "reminder"; params: SendReminderEmailParams };

export const useSendEmail = () =>
  useMutation({
    mutationFn: async ({ type, params }: SendEmailParams) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Sua sessão expirou. Entre novamente para enviar o e-mail.");

      const functionName =
        type === "document"
          ? "send-document-email"
          : "send-appointment-reminder";
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: params,
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        throw await normalizeEdgeFunctionError(
          error,
          "Não foi possível enviar o e-mail. Tente novamente em instantes.",
        );
      }
      if (data?.error) throw new Error(data.error);
      return data as { provider?: "gmail" | "resend"; idempotentReplay?: boolean };
    },
    onSuccess: (result, variables) => {
      const emailType =
        variables.type === "document"
          ? "Documento"
        : variables.params.action === "invite" || variables.params.action === "reminder"
            ? "Convite de confirmação"
            : "Notificação do agendamento";
      const destination =
        variables.type === "document"
          ? variables.params.to
          : (variables.params as SendReminderEmailParams).patientEmail;
      const channel =
        result?.provider === "gmail"
          ? "Gmail"
          : result?.provider === "resend"
            ? "canal institucional"
            : "e-mail";
      toast.success(`${emailType} enviado com sucesso!`, {
        description: `Enviado para ${destination} por ${channel}.`,
      });
    },
    onError: (error: Error) => {
      const diagnostic = error instanceof EdgeFunctionInvocationError
        ? { kind: error.kind, status: error.status, code: error.code }
        : { kind: "unknown" };
      console.error("Erro ao enviar e-mail:", diagnostic);
      toast.error("Erro ao enviar e-mail", {
        description: error.message || "Tente novamente mais tarde.",
      });
    },
  });
