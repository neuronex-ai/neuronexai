import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Link, Loader2, Mail, MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Patient } from "@/types";

interface PreJoinActionsProps {
  appointmentId: string;
  patient: Patient | undefined | null;
  meetLink: string;
  therapistName: string;
  disabled?: boolean;
  disabledReason?: string;
  onDisabledClick?: () => void;
  variant?: "mobile" | "desktop";
}

export const PreJoinActions = ({
  appointmentId,
  patient,
  meetLink,
  therapistName,
  disabled = false,
  disabledReason,
  onDisabledClick,
  variant = "mobile",
}: PreJoinActionsProps) => {
  const [sending, setSending] = useState<"email" | null>(null);

  const guardDisabled = () => {
    if (!disabled) return false;
    toast.info(disabledReason || "Conclua as decisões da sala antes de convidar o paciente.");
    onDisabledClick?.();
    return true;
  };

  const handleWhatsApp = () => {
    if (guardDisabled()) return;
    if (!patient?.phone) {
      toast.error("Telefone do paciente não cadastrado.");
      return;
    }

    const digits = patient.phone.replace(/\D/g, "");
    if (!digits) {
      toast.error("Telefone do paciente não cadastrado.");
      return;
    }

    const phone = digits.startsWith("55") ? digits : `55${digits}`;
    const message = `Olá, ${patient.name}. Sua teleconsulta já pode ser acessada pelo link da sala NeuroNex: ${meetLink}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  const handleEmail = async () => {
    if (guardDisabled()) return;
    if (!patient?.email) {
      toast.error("E-mail do paciente não cadastrado.");
      return;
    }

    setSending("email");
    const toastId = toast.loading("Enviando convite por e-mail...");
    try {
      const { error } = await supabase.functions.invoke("send-google-invite", {
        body: {
          appointmentId,
          patientEmail: patient.email,
          patientName: patient.name,
          meetLink,
          therapistName,
        },
      });

      if (error) throw new Error(error.message);
      toast.success("Convite enviado por e-mail.", { id: toastId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível enviar o convite.";
      toast.error(message, { id: toastId });
    } finally {
      setSending(null);
    }
  };

  const handleCopyLink = () => {
    if (guardDisabled()) return;
    void navigator.clipboard.writeText(meetLink);
    toast.success("Link copiado para a área de transferência.");
  };

  const isDesktop = variant === "desktop";
  const buttonClass = (tone: "emerald" | "sky" | "amber") =>
    cn(
      "teleconsultation-inset teleconsultation-action shrink-0 shadow-none",
      isDesktop ? "h-12 w-12 rounded-[16px]" : "h-11 w-11 rounded-full",
      disabled && "opacity-45",
      !isDesktop && tone === "emerald" && "group hover:[&>svg]:text-emerald-500",
      !isDesktop && tone === "sky" && "group hover:[&>svg]:text-sky-500",
      !isDesktop && tone === "amber" && "group hover:[&>svg]:text-amber-500",
    );

  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className={buttonClass("emerald")}
        onClick={handleWhatsApp}
        aria-label="Enviar via WhatsApp"
      >
        <MessageSquare className="h-4 w-4 text-zinc-500 transition-colors duration-200 dark:text-zinc-400" />
      </Button>

      <Button
        variant="outline"
        size="icon"
        className={buttonClass("sky")}
        onClick={handleEmail}
        disabled={sending === "email"}
        aria-label="Enviar por e-mail"
      >
        {sending === "email" ? (
          <Loader2 className="h-4 w-4 animate-spin text-zinc-500 dark:text-zinc-400" />
        ) : (
          <Mail className="h-4 w-4 text-zinc-500 transition-colors duration-200 dark:text-zinc-400" />
        )}
      </Button>

      <div className="mx-1 hidden h-8 w-px bg-zinc-200 dark:bg-white/10 sm:block" />

      <Button
        variant="outline"
        size="icon"
        className={buttonClass("amber")}
        onClick={handleCopyLink}
        aria-label="Copiar link"
      >
        <Link className="h-4 w-4 text-zinc-500 transition-colors duration-200 dark:text-zinc-400" />
      </Button>

      <span className={cn("min-w-0 flex-[1_1_8rem] text-[9px] font-bold uppercase leading-tight tracking-[0.16em] text-zinc-400 dark:text-zinc-600", isDesktop && "sm:ml-3")}>
        {disabled ? "Decisão pendente" : "Convidar paciente"}
      </span>
    </div>
  );
};
