import { CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useWhatsAppAgent } from "@/hooks/use-whatsapp-agent";

type WhatsAppConnectHelperProps = {
  onConnected?: () => void;
};

export function WhatsAppConnectHelper({ onConnected }: WhatsAppConnectHelperProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const { connect } = useWhatsAppAgent();

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await connect.mutateAsync();
      onConnected?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel iniciar a conexao.");
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="space-y-4 rounded-3xl border border-white/5 bg-white/[0.02] p-5 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.05] text-white">
        <MessageCircle className="h-7 w-7" />
      </div>
      <div>
        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white">
          Conexao gerenciada
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-xs font-medium leading-relaxed text-zinc-500">
          Inicie a conexao segura do NeuroZap e sincronize conversas depois que o WhatsApp estiver autorizado.
        </p>
      </div>
      <Button
        type="button"
        onClick={handleConnect}
        disabled={isConnecting}
        className="h-11 w-full rounded-2xl bg-white text-xs font-black uppercase tracking-[0.14em] text-black hover:bg-zinc-200"
      >
        {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
        Conectar WhatsApp
      </Button>
    </div>
  );
}
