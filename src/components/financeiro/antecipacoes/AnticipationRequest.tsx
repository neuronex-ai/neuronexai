import { BellRing, Sparkles } from "lucide-react";

export function AnticipationUnavailable() {
  return (
    <section className="relative overflow-hidden rounded-[30px] border border-border/65 bg-card/82 p-8 text-card-foreground shadow-[0_32px_92px_-70px_hsl(var(--foreground)/0.62)] backdrop-blur-3xl md:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,hsl(var(--foreground)/0.055),transparent_38%)]" />
      <div className="relative max-w-2xl">
        <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-foreground text-background shadow-[0_20px_50px_-32px_hsl(var(--foreground)/0.72)]">
          <Sparkles className="h-6 w-6" />
        </div>
        <p className="mt-8 text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">Em breve</p>
        <h3 className="mt-2 text-2xl font-black tracking-tight text-foreground">Novidades para seus recebimentos</h3>
        <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-muted-foreground">
          A antecipação de recebíveis ainda não está disponível. Avisaremos pelo próprio NeuroFinance quando esse recurso estiver pronto para sua conta.
        </p>
        <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-border/55 bg-background/50 px-4 py-2 text-[9px] font-black uppercase tracking-[0.13em] text-muted-foreground">
          <BellRing className="h-3.5 w-3.5" /> Nenhuma ação é necessária agora
        </div>
      </div>
    </section>
  );
}

export function AnticipationRequest() {
  return <AnticipationUnavailable />;
}
