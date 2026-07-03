import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ShieldAlert } from "lucide-react";

import { AppModalShell, ModalHeroIcon } from "@/components/ui/app-modal-shell";
import { Button } from "@/components/ui/button";

type DevelopmentModeNoticeProps = {
  user: User | null;
  enabled?: boolean;
};

const shownKeyFor = (userId: string) => `neuronex.development-mode-notice.shown:${userId}`;

export function DevelopmentModeNotice({ user, enabled = true }: DevelopmentModeNoticeProps) {
  const [open, setOpen] = useState(false);
  const [shownForUserId, setShownForUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !user?.id) {
      setOpen(false);
      return;
    }

    if (shownForUserId === user.id) return;
    if (window.sessionStorage.getItem(shownKeyFor(user.id)) === "true") return;

    setShownForUserId(user.id);
    const timer = window.setTimeout(() => {
      window.sessionStorage.setItem(shownKeyFor(user.id), "true");
      setOpen(true);
    }, 320);

    return () => window.clearTimeout(timer);
  }, [enabled, shownForUserId, user?.id]);

  if (!user) return null;

  return (
    <AppModalShell
      open={open}
      onOpenChange={setOpen}
      size="sm"
      eyebrow="Ambiente restrito"
      title="Modo de desenvolvimento"
      description="O sistema esta em modo de desenvolvimento e atualmente e exclusivo para testes. Nao movimente dados reais nesta conta."
      heroIcon={<ModalHeroIcon icon={ShieldAlert} state="warning" tone="status" ariaLabel="Aviso de desenvolvimento" />}
      footer={
        <Button
          type="button"
          className="h-12 w-full rounded-2xl text-xs font-black uppercase tracking-[0.14em]"
          onClick={() => setOpen(false)}
        >
          Entendi
        </Button>
      }
    >
      <div className="sr-only">Aviso exibido uma vez por usuario autenticado.</div>
    </AppModalShell>
  );
}
