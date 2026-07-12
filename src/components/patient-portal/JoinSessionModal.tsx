import type { ReactNode } from 'react';
import { useState } from 'react';
import { ShieldCheck, Video } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Appointment } from '@/types';

interface JoinSessionModalProps {
  appointment: Appointment;
  children: ReactNode;
}

export const JoinSessionModal = ({ appointment, children }: JoinSessionModalProps) => {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const secureMeetLink = /\/join\/[a-f0-9]{64}$/i.test(appointment.google_meet_link || '')
    ? appointment.google_meet_link
    : '';

  const handleJoin = () => {
    if (!secureMeetLink) return;
    window.open(secureMeetLink, '_blank', 'noopener,noreferrer');
    setOpen(false);
  };

  const content = (
    <div className="flex h-full w-full flex-col items-center justify-center bg-transparent p-6 text-center sm:p-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-border/45 bg-foreground/[0.035] dark:border-white/[0.055]">
        <Video className="h-7 w-7" aria-hidden="true" />
      </div>
      <p className="mt-6 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Teleconsulta segura</p>
      <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">Sala de teleconsulta</h2>
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
        Abra a entrada segura e aguarde a liberação do seu psicólogo.
      </p>

      <div className="mt-6 flex min-h-11 items-center gap-2 rounded-2xl bg-foreground/[0.035] px-4 text-xs font-semibold text-muted-foreground">
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        {secureMeetLink ? 'Convite protegido e pronto para uso' : 'Solicite um novo convite ao profissional'}
      </div>

      <div className="mt-8 w-full max-w-sm space-y-2">
        <Button onClick={handleJoin} disabled={!secureMeetLink} className="h-12 w-full rounded-2xl font-bold">
          {secureMeetLink ? 'Entrar agora' : 'Convite indisponível'}
        </Button>
        <Button variant="ghost" className="h-11 w-full rounded-2xl" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{children}</DrawerTrigger>
        <DrawerContent className="h-[min(560px,74dvh)] border-border/45 bg-background p-0">
          <DrawerTitle className="sr-only">Entrar na teleconsulta</DrawerTitle>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="h-auto max-h-[min(640px,calc(100dvh-2rem))] max-w-md gap-0 overflow-hidden rounded-[28px] border-border/45 bg-background p-0 shadow-2xl">
        <DialogTitle className="sr-only">Entrar na teleconsulta</DialogTitle>
        {content}
      </DialogContent>
    </Dialog>
  );
};
