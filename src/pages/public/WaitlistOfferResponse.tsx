import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarCheck2, CheckCircle2, Clock3, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { DesktopLumenBackdrop } from "@/components/ui/DesktopLumenBackdrop";
import { supabase } from "@/integrations/supabase/client";

interface OfferDetails {
  found: boolean;
  status?: "pending" | "accepted" | "declined" | "expired" | "superseded";
  patientFirstName?: string | null;
  professionalName?: string | null;
  clinicName?: string | null;
  modality?: "presencial" | "online" | null;
  startsAt?: string;
  endsAt?: string;
  expiresAt?: string;
}

const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

const getOfferResponseErrorMessage = (error: unknown) => {
  const message = error && typeof error === "object" && "message" in error
    ? String(error.message).toLowerCase()
    : String(error || "").toLowerCase();

  if (
    message.includes("expirada")
    || message.includes("inválida")
    || message.includes("invalida")
    || message.includes("55000")
    || message.includes("23p01")
  ) {
    return "Esta oferta não está mais disponível. Peça ao seu profissional uma nova vaga.";
  }

  return "Não foi possível registrar sua resposta agora. Tente novamente em instantes.";
};

export default function WaitlistOfferResponse() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [offer, setOffer] = useState<OfferDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResponding, setIsResponding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Oferta de horário · NeuroNex";
    const loadOffer = async () => {
      if (!TOKEN_PATTERN.test(token)) {
        setOffer({ found: false });
        setIsLoading(false);
        return;
      }
      const database = supabase as any;
      const { data, error: rpcError } = await database.rpc("get_waitlist_offer", { p_token: token });
      if (rpcError) {
        setError("Não foi possível consultar esta oferta agora.");
      } else {
        setOffer(data as OfferDetails);
      }
      setIsLoading(false);
    };
    void loadOffer();
  }, [token]);

  const respond = async (response: "accept" | "decline") => {
    setIsResponding(true);
    setError(null);
    const database = supabase as any;
    const { data, error: rpcError } = await database.rpc("respond_waitlist_offer", {
      p_token: token,
      p_response: response,
    });
    if (rpcError) {
      setError(getOfferResponseErrorMessage(rpcError));
      setIsResponding(false);
      return;
    }
    setOffer((current) => current ? { ...current, status: data?.status || (response === "accept" ? "accepted" : "declined") } : current);
    setIsResponding(false);
  };

  const pending = offer?.found && offer.status === "pending";
  const startsAt = offer?.startsAt ? new Date(offer.startsAt) : null;
  const endsAt = offer?.endsAt ? new Date(offer.endsAt) : null;

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground">
      <DesktopLumenBackdrop />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,hsl(var(--foreground)/0.055),transparent_42%)]" />
      <section className="notification-popover-surface relative z-10 w-full max-w-md overflow-hidden rounded-[32px] border border-border/55 p-5 shadow-2xl backdrop-blur-3xl sm:p-6" aria-labelledby="offer-title">
        {isLoading ? (
          <div className="flex min-h-64 items-center justify-center gap-3" role="status">
            <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" />
            <span className="text-sm font-semibold text-muted-foreground">Consultando a oferta...</span>
          </div>
        ) : !offer?.found ? (
          <div className="py-8 text-center">
            <span className="notification-liquid-icon mx-auto flex h-14 w-14 items-center justify-center rounded-[20px]"><XCircle className="h-5 w-5" /></span>
            <h1 id="offer-title" className="mt-5 text-xl font-black tracking-[-0.03em]">Este link não está disponível</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Peça ao seu profissional uma nova oferta de horário.</p>
          </div>
        ) : (
          <>
            <header className="text-center">
              <span className="notification-liquid-icon mx-auto flex h-14 w-14 items-center justify-center rounded-[20px]">
                {offer.status === "accepted" ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <CalendarCheck2 className="h-5 w-5" />}
              </span>
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Lista de espera segura</p>
              <h1 id="offer-title" className="mt-2 text-2xl font-black tracking-[-0.045em]">
                {offer.status === "accepted"
                  ? "Horário confirmado"
                  : offer.status === "declined"
                    ? "Oferta recusada"
                    : offer.status === "expired" || offer.status === "superseded"
                      ? "Oferta encerrada"
                      : `${offer.patientFirstName ? `${offer.patientFirstName}, ` : ""}abriu um horário`}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {pending
                  ? `${offer.professionalName || "Seu profissional"} reservou esta vaga temporariamente para você.`
                  : offer.status === "accepted"
                    ? "A sessão já foi incluída na agenda."
                    : "Nenhuma sessão foi criada com este link."}
              </p>
            </header>

            {startsAt && endsAt ? (
              <div className="notes-liquid-surface mt-5 rounded-[24px] border p-4 backdrop-blur-2xl">
                <div className="flex items-center gap-3"><span className="synapse-chat-glass flex h-10 w-10 items-center justify-center rounded-[14px] border"><Clock3 className="h-4 w-4" /></span><div><p className="text-sm font-black capitalize">{format(startsAt, "EEEE, dd 'de' MMMM", { locale: ptBR })}</p><p className="mt-1 text-xs font-semibold text-muted-foreground">{format(startsAt, "HH:mm")}–{format(endsAt, "HH:mm")} · {offer.modality === "online" ? "Online" : offer.modality === "presencial" ? "Presencial" : "Modalidade a confirmar"}</p></div></div>
                {offer.clinicName ? <p className="mt-3 border-t border-border/40 pt-3 text-xs text-muted-foreground">{offer.clinicName}</p> : null}
              </div>
            ) : null}

            {error ? <div role="alert" className="mt-4 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">{error}</div> : null}

            {pending ? (
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" onClick={() => respond("decline")} disabled={isResponding} className="notification-liquid-control h-12 rounded-full font-black">Não posso</Button>
                <Button type="button" onClick={() => respond("accept")} disabled={isResponding} className="h-12 rounded-full font-black">{isResponding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}</Button>
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-center gap-2 text-[10px] font-bold text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" />Link individual, temporário e protegido</div>
          </>
        )}
      </section>
    </main>
  );
}
