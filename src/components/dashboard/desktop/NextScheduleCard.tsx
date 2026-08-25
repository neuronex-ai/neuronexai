"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  MapPin,
  Mic2,
  ReceiptText,
  Repeat2,
  Share2,
  Sparkles,
  Video,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { AppointmentDetailModal } from "@/components/agenda/AppointmentDetailModal";
import { NewAppointmentModal } from "@/components/agenda/NewAppointmentModal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Appointment } from "@/types";

import {
  buildNextScheduleCardPresentation,
  type ScheduleStatusTone,
} from "./next-schedule-card-model";

type NextScheduleCardProps = {
  today: Date;
  appointment?: Appointment;
  followingAppointment?: Appointment;
  isLoading: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  latestSummaryText: string | null;
  latestTopics: string[];
  latestNextSteps: string[];
  loadingSessionNotes: boolean;
};

const toneClassNames: Record<ScheduleStatusTone, string> = {
  neutral: "border-foreground/10 bg-foreground/[0.045] text-muted-foreground",
  positive: "border-foreground/14 bg-foreground/[0.075] text-foreground",
  warning: "border-foreground/16 bg-foreground/[0.065] text-foreground",
  critical: "border-foreground/20 bg-foreground/[0.09] text-foreground",
};

const DetailPill = ({
  icon: Icon,
  label,
  tone = "neutral",
}: {
  icon: typeof Clock3;
  label: string;
  tone?: ScheduleStatusTone;
}) => (
  <span
    className={cn(
      "next-schedule-pill inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-bold leading-none",
      toneClassNames[tone],
    )}
  >
    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    <span className="truncate">{label}</span>
  </span>
);

const SkeletonCard = () => (
  <div className="next-schedule-card h-[228px] animate-pulse rounded-[28px] border p-4" aria-label="Carregando próximo compromisso">
    <div className="flex items-center justify-between">
      <div className="h-4 w-32 rounded-full bg-muted/55" />
      <div className="h-10 w-10 rounded-2xl bg-muted/45" />
    </div>
    <div className="mt-8 h-12 w-36 rounded-2xl bg-muted/55" />
    <div className="mt-3 h-5 w-48 rounded-full bg-muted/45" />
    <div className="mt-6 flex gap-2">
      <div className="h-8 w-24 rounded-full bg-muted/45" />
      <div className="h-8 w-28 rounded-full bg-muted/40" />
    </div>
  </div>
);

const EmptyScheduleCard = ({ today }: { today: Date }) => (
  <div className="next-schedule-card flex h-[228px] flex-col justify-between rounded-[28px] border p-4">
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Próximo compromisso</p>
        <h3 className="mt-2 text-xl font-bold tracking-[-0.035em] text-foreground">Agenda livre</h3>
      </div>
      <span className="next-schedule-icon flex h-11 w-11 items-center justify-center rounded-[16px] border text-muted-foreground">
        <CalendarIcon className="h-5 w-5" aria-hidden="true" />
      </span>
    </div>
    <p className="max-w-[32ch] text-sm font-medium leading-relaxed text-muted-foreground">
      Não há outro compromisso nos próximos sete dias.
    </p>
    <NewAppointmentModal selectedDate={today}>
      <Button className="h-11 w-fit rounded-full bg-foreground px-5 text-xs font-bold text-background hover:bg-foreground/90">
        Novo agendamento
        <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
      </Button>
    </NewAppointmentModal>
  </div>
);

export const NextScheduleCard = ({
  today,
  appointment,
  followingAppointment,
  isLoading,
  expanded,
  onExpandedChange,
  latestSummaryText,
  latestTopics,
  latestNextSteps,
  loadingSessionNotes,
}: NextScheduleCardProps) => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const detailsId = "dashboard-next-schedule-details";

  if (isLoading) return <SkeletonCard />;
  if (!appointment) return <EmptyScheduleCard today={today} />;

  const presentation = buildNextScheduleCardPresentation(appointment, followingAppointment);
  const isSession = presentation.kind === "session";
  const isBlock = presentation.kind === "block";
  const shareLabel = presentation.isOnline
    ? isSession ? "Compartilhar sala" : "Compartilhar acesso"
    : "Compartilhar local";
  const recurrenceContext = presentation.recurrenceLabel
    ? presentation.kind === "session"
      ? `Sessão ${presentation.recurrenceLabel} da recorrência`
      : `Ocorrência ${presentation.recurrenceLabel} da recorrência`
    : null;
  const scheduleSummary = [presentation.modalityLabel, recurrenceContext, presentation.locationLabel]
    .filter(Boolean)
    .join(" · ");

  const shareLocation = async () => {
    const location = presentation.locationLabel;
    const shareText = `${presentation.title} · ${presentation.dateLabel} às ${presentation.timeLabel}\n${location}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: presentation.title, text: shareText });
        return;
      }
      await navigator.clipboard.writeText(shareText);
      toast.success("Local copiado para compartilhar.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Não foi possível compartilhar o local.");
    }
  };

  const handleShare = () => {
    if (presentation.isOnline && isSession) {
      navigate("/teleconsulta", {
        state: { activeAppointmentId: appointment.id, openInvite: true },
      });
      return;
    }
    void shareLocation();
  };

  const openSynapsePrep = () => {
    const query = `Organize meu pré-sessão para o agendamento ${appointment.id}. Traga um resumo clínico breve, pendências e pontos para revisar, sem executar alterações.`;
    navigate(`/synapse-ai?q=${encodeURIComponent(query)}`);
  };

  const openPatientPreparation = () => {
    if (appointment.patient_id) {
      navigate(`/pacientes/${encodeURIComponent(appointment.patient_id)}?tab=prontuario`);
      return;
    }
    navigate("/agenda", { state: { openAppointmentId: appointment.id } });
  };

  return (
    <motion.article
      initial={false}
      animate={{ height: expanded ? 408 : 228 }}
      transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 430, damping: 42 }}
      className="next-schedule-card relative overflow-hidden rounded-[28px] border text-foreground"
      data-state={expanded ? "expanded" : "collapsed"}
      data-kind={presentation.kind}
    >
      {presentation.canShare ? (
        <motion.button
          type="button"
          onClick={handleShare}
          aria-label={shareLabel}
          title={shareLabel}
          className="next-schedule-presence absolute right-4 top-4 z-30 flex h-11 w-11 items-center justify-center rounded-[16px] border text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          animate={shouldReduceMotion ? undefined : { scale: expanded ? 1.04 : 1, opacity: expanded ? 1 : 0.78 }}
          transition={{ duration: 0.22 }}
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
        </motion.button>
      ) : (
        <motion.div
          aria-hidden="true"
          className="next-schedule-presence pointer-events-none absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-[16px] border text-muted-foreground"
          animate={shouldReduceMotion ? undefined : { scale: expanded ? 1.04 : 1, opacity: expanded ? 1 : 0.72 }}
          transition={{ duration: 0.22 }}
        >
          {isBlock ? <Clock3 className="h-5 w-5" /> : <CalendarIcon className="h-5 w-5" />}
        </motion.div>
      )}

      <button
        type="button"
        onClick={() => onExpandedChange(!expanded)}
        aria-expanded={expanded}
        aria-controls={detailsId}
        className="relative z-10 block w-full rounded-[28px] p-4 pr-[4.5rem] text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <span className="flex min-h-8 items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{presentation.eyebrow}</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/45" aria-hidden="true" />
          <span className="text-[10px] font-semibold text-muted-foreground">{presentation.dateLabel}</span>
        </span>

        <span className="mt-2 flex items-end gap-3">
          <span className="text-[2.75rem] font-bold leading-[0.9] tracking-[-0.075em] tabular-nums text-foreground">
            {isBlock ? presentation.intervalLabel : presentation.timeLabel}
          </span>
          <ChevronDown
            className={cn(
              "mb-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
              expanded && "rotate-180",
            )}
            aria-hidden="true"
          />
        </span>

        <span className="mt-2 block truncate text-base font-bold tracking-[-0.03em] text-foreground">{presentation.title}</span>
        <span className="mt-1.5 block truncate text-xs font-medium text-muted-foreground">{scheduleSummary}</span>
      </button>

      <AnimatePresence initial={false}>
        {!expanded ? (
          <motion.div
            key="collapsed-pills"
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-4 bottom-4 z-20 flex items-center gap-2 overflow-hidden"
          >
            <DetailPill icon={CheckCircle2} label={presentation.confirmationLabel} tone={presentation.confirmationTone} />
            {presentation.financialValueLabel ? <DetailPill icon={ReceiptText} label={presentation.financialValueLabel} /> : null}
            {presentation.financialStatusLabel ? <DetailPill icon={ReceiptText} label={presentation.financialStatusLabel} tone={presentation.financialStatusTone} /> : null}
          </motion.div>
        ) : (
          <motion.section
            key="expanded-details"
            id={detailsId}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2, delay: 0.06 }}
            className="next-schedule-details absolute inset-x-4 bottom-4 top-[158px] z-20 flex min-h-0 flex-col rounded-[22px] border p-3"
          >
            <div className="grid grid-cols-2 gap-2">
              <div className="next-schedule-detail-cell min-w-0 rounded-[16px] border p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Confirmação</p>
                <p className="mt-1 truncate text-xs font-bold text-foreground">{presentation.confirmationLabel}</p>
              </div>
              <div className="next-schedule-detail-cell min-w-0 rounded-[16px] border p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{isSession ? "Financeiro" : "Local"}</p>
                <p className="mt-1 truncate text-xs font-bold text-foreground">
                  {isSession
                    ? [presentation.financialValueLabel, presentation.financialStatusLabel].filter(Boolean).join(" · ")
                    : presentation.locationLabel}
                </p>
              </div>
            </div>

            <div className="mt-2 min-h-0 flex-1 overflow-y-auto rounded-[16px] px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {isBlock ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold leading-relaxed text-foreground">Intervalo reservado: {presentation.intervalLabel}.</p>
                  <p className="text-xs font-medium leading-relaxed text-muted-foreground">
                    {presentation.followingLabel || "Nenhum outro compromisso encontrado nos próximos sete dias."}
                  </p>
                </div>
              ) : isSession ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {presentation.recurrenceLabel ? <DetailPill icon={Repeat2} label={`Ocorrência ${presentation.recurrenceLabel}`} /> : null}
                    <DetailPill icon={presentation.isOnline ? Video : MapPin} label={presentation.locationLabel} />
                  </div>
                  {loadingSessionNotes ? (
                    <div className="h-8 animate-pulse rounded-xl bg-muted/35" />
                  ) : (
                    <p className="line-clamp-2 text-xs font-medium leading-relaxed text-muted-foreground">
                      {latestSummaryText || "Sem resumo clínico confirmado para revisar antes desta sessão."}
                    </p>
                  )}
                  {latestSummaryText ? (
                    <div className="flex flex-wrap gap-1.5">
                      {[...latestTopics, ...latestNextSteps].slice(0, 3).map((item) => (
                        <span key={item} className="rounded-full border border-foreground/8 bg-foreground/[0.035] px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {presentation.recurrenceLabel ? <DetailPill icon={Repeat2} label={`Ocorrência ${presentation.recurrenceLabel}`} /> : null}
                    <DetailPill icon={presentation.isOnline ? Video : MapPin} label={presentation.locationLabel} />
                  </div>
                  <p className="line-clamp-3 text-xs font-medium leading-relaxed text-muted-foreground">
                    {presentation.notesLabel || "Sem observações adicionais para este evento."}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-2 flex items-center gap-2">
              {isSession ? (
                <>
                  <Button
                    type="button"
                    onClick={presentation.isOnline
                      ? () => navigate("/teleconsulta", { state: { activeAppointmentId: appointment.id } })
                      : openPatientPreparation}
                    className="h-11 min-w-0 flex-1 rounded-full bg-foreground px-3 text-xs font-bold text-background hover:bg-foreground/90"
                  >
                    {presentation.isOnline ? <Video className="mr-1.5 h-4 w-4" /> : <FileText className="mr-1.5 h-4 w-4" />}
                    {presentation.isOnline ? "Abrir sala" : "Preparar sessão"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={openSynapsePrep}
                    className="h-11 min-w-0 flex-1 rounded-full px-3 text-xs font-bold"
                  >
                    <Mic2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    Synapse prepara
                  </Button>
                </>
              ) : (
                <AppointmentDetailModal appointment={appointment}>
                  <Button type="button" className="h-11 min-w-0 flex-1 rounded-full bg-foreground px-3 text-xs font-bold text-background hover:bg-foreground/90">
                    <Sparkles className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    {isBlock ? "Abrir bloqueio" : "Ver evento"}
                  </Button>
                </AppointmentDetailModal>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </motion.article>
  );
};
