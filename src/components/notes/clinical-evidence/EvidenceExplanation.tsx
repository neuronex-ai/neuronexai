import { BookOpenText, CalendarDays, CircleGauge, Database, Network, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { htmlToPlainText } from "@/lib/note-content";
import { getEvidenceSourceLabel } from "./evidence-model";
import type { EvidenceNode } from "./evidence-types";

type Props = {
  evidence: EvidenceNode;
  body?: string | null;
  darkMode?: boolean;
  triggerClassName?: string;
};

const percent = (value: number) => `${Math.round(value * 100)}%`;

const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(date)
    : "Data indisponível";
};

const confidenceLabel = (value: number) => {
  if (value >= 0.72) return "Base consistente";
  if (value >= 0.45) return "Base parcial";
  return "Poucos dados revisados";
};

export const EvidenceScoreCards = ({ evidence }: Pick<Props, "evidence">) => {
  const items = [
    { label: "Atenção", value: evidence.gravity.score, detail: "Define a proximidade do paciente." },
    { label: "Densidade", value: evidence.gravity.density, detail: "Define o tamanho desta evidência." },
    { label: "Tensão", value: evidence.gravity.tension, detail: "Define a intensidade do pulso." },
    { label: "Confiança", value: evidence.gravity.confidence, detail: confidenceLabel(evidence.gravity.confidence) },
  ];

  return (
    <div className="grid grid-cols-2 gap-2" aria-label="Leituras visuais da evidência">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-border/60 bg-foreground/[0.025] p-3 dark:border-white/8 dark:bg-white/[0.035]">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{item.label}</span>
            <strong className="text-lg font-semibold tabular-nums tracking-[-0.04em]">{percent(item.value)}</strong>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{item.detail}</p>
        </div>
      ))}
    </div>
  );
};

const Metric = ({ label, value, unavailable = false }: { label: string; value: number; unavailable?: boolean }) => (
  <div className="grid grid-cols-[112px_1fr_38px] items-center gap-2 text-[10px]">
    <span className="text-muted-foreground">{label}</span>
    <span className="h-1 overflow-hidden rounded-full bg-foreground/8">
      <span className="block h-full rounded-full bg-foreground/70" style={{ width: unavailable ? "0%" : percent(value) }} />
    </span>
    <span className="text-right tabular-nums">{unavailable ? "—" : percent(value)}</span>
  </div>
);

export const EvidenceExplanationDialog = ({ evidence, body, darkMode = false, triggerClassName }: Props) => {
  const metadataBody = [evidence.metadata.summary, evidence.metadata.description, evidence.metadata.content]
    .find((value) => typeof value === "string" && value.trim()) as string | undefined;
  const plainBody = htmlToPlainText(body || metadataBody || "").trim();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className={cn("h-10 w-full rounded-xl text-xs", triggerClassName)}>
          <BookOpenText className="h-3.5 w-3.5" /> Ver explicação completa
        </Button>
      </DialogTrigger>
      <DialogContent className={cn(
        "max-h-[min(820px,calc(100dvh-32px))] max-w-[760px] gap-0 overflow-hidden rounded-[28px] p-0",
        darkMode && "border-white/10 bg-[#0c0c0f] text-white",
      )}>
        <DialogHeader className="border-b border-border/60 px-6 pb-5 pt-6 dark:border-white/8">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <CircleGauge className="h-3.5 w-3.5" /> Por que está aqui?
          </div>
          <DialogTitle className="mt-2 pr-8 text-xl tracking-[-0.025em]">{evidence.title}</DialogTitle>
          <DialogDescription>
            {getEvidenceSourceLabel(evidence.sourceType)} · {dateLabel(evidence.occurredAt)} · tema revisado: {evidence.theme}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[min(650px,calc(100dvh-170px))]">
          <div className="space-y-5 p-6">
            {!evidence.gravity.eligible ? (
              <div className="rounded-2xl border border-violet-400/20 bg-violet-400/8 p-4 text-xs leading-relaxed">
                Este item aguarda revisão profissional. Ele pode ser consultado, mas não altera atenção, densidade ou tensão.
              </div>
            ) : null}

            <EvidenceScoreCards evidence={evidence} />

            <section className="rounded-2xl border border-border/60 p-4 dark:border-white/8" aria-labelledby="evidence-reading-title">
              <h3 id="evidence-reading-title" className="flex items-center gap-2 text-xs font-semibold"><Network className="h-4 w-4" /> Como chegamos a esta leitura</h3>
              <div className="mt-4 space-y-3">
                <Metric label="Recência" value={evidence.gravity.recency} />
                <Metric label="Recorrência" value={evidence.gravity.recurrence} />
                <Metric label="Variedade de fontes" value={evidence.gravity.sourceDiversity} />
                <Metric label="Vínculo ao tema" value={evidence.gravity.relationSupport} />
                <Metric label="Aceleração" value={evidence.gravity.acceleration} />
                <Metric label="Mudança registrada" value={evidence.gravity.objectiveChange || 0} unavailable={evidence.gravity.objectiveChange === null} />
                <Metric label="Força das conexões" value={evidence.gravity.connectionStrength} />
                <Metric label="Próxima ação" value={evidence.gravity.actionability} />
                <Metric label="Prioridade manual" value={evidence.gravity.clinicianPriority} />
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-2">
              <section className="rounded-2xl border border-border/60 p-4 dark:border-white/8">
                <h3 className="flex items-center gap-2 text-xs font-semibold"><Database className="h-4 w-4" /> Origem rastreável</h3>
                <dl className="mt-3 space-y-2 text-[11px]">
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Fonte</dt><dd>{getEvidenceSourceLabel(evidence.sourceType)}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Atualização</dt><dd className="text-right">{dateLabel(evidence.updatedAt)}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Revisão</dt><dd>{evidence.reviewed ? "Confirmada" : "Pendente"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Relação</dt><dd>{evidence.priority > 0 ? "Com ajuste profissional" : "Pelos dados revisados"}</dd></div>
                </dl>
              </section>
              <section className="rounded-2xl border border-border/60 p-4 dark:border-white/8">
                <h3 className="flex items-center gap-2 text-xs font-semibold"><CalendarDays className="h-4 w-4" /> Contexto</h3>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  {evidence.tags.length ? `Marcadores: ${evidence.tags.join(", ")}.` : "Não há marcadores revisados neste item."}
                  {evidence.isActionable ? ` ${evidence.actionCompleted ? "A ação vinculada foi concluída." : "Há uma ação ainda aberta."}` : " Não há ação vinculada."}
                </p>
              </section>
            </div>

            {plainBody ? (
              <section className="rounded-2xl border border-border/60 p-4 dark:border-white/8">
                <h3 className="text-xs font-semibold">Conteúdo disponível</h3>
                <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-muted-foreground">{plainBody.slice(0, 1600)}</p>
              </section>
            ) : null}

            <div className="flex gap-3 rounded-2xl bg-foreground/[0.035] p-4 dark:bg-white/[0.04]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Esta leitura organiza fatos rastreáveis; não cria diagnóstico. Risco usa somente o registro clínico já existente e nunca entra nesse cálculo. “—” significa que não havia dado comparável, não que houve ausência de mudança.
              </p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
