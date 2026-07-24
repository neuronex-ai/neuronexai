import { useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  CalendarClock,
  ChevronLeft,
  Copy,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  Send,
  Sparkles,
  Trash2,
  UserRoundPlus,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { usePatients } from "@/hooks/use-patients";
import {
  useProfessionalWaitlist,
  type ProfessionalWaitlistEntry,
  type ProfessionalWaitlistInput,
  type ProfessionalWaitlistSlotSuggestion,
} from "@/hooks/use-professional-waitlist";
import { cn } from "@/lib/utils";

const WEEK_DAYS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
];

interface WindowDraft {
  key: string;
  mode: "weekday" | "date";
  weekday: number;
  specificDate: string;
  startTime: string;
  endTime: string;
}

const newWindow = (): WindowDraft => ({
  key: crypto.randomUUID(),
  mode: "weekday",
  weekday: 3,
  specificDate: "",
  startTime: "13:50",
  endTime: "16:20",
});

const emptyForm = (): ProfessionalWaitlistInput => ({
  patient_id: "",
  priority: 3,
  valid_from: format(new Date(), "yyyy-MM-dd"),
  valid_until: null,
  minimum_duration_minutes: 50,
  preferred_duration_minutes: 50,
  modality: null,
  location: null,
  offer_automatically: true,
  windows: [],
  rules_snapshot: {},
});

const hasActivePendingOffer = (
  entry: ProfessionalWaitlistEntry,
  now = new Date(),
) => entry.professional_waitlist_offers.some((offer) => (
  offer.status === "pending"
  && new Date(offer.expires_at) > now
));

const SAO_PAULO_DATE_TIME = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const toSaoPauloDateTimeLocal = (value: string) => {
  const parts = Object.fromEntries(
    SAO_PAULO_DATE_TIME
      .formatToParts(new Date(value))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

interface ProfessionalWaitlistPanelProps {
  onClose: () => void;
}

export function ProfessionalWaitlistPanel({ onClose }: ProfessionalWaitlistPanelProps) {
  const { data: patients = [] } = usePatients();
  const {
    data: entries = [],
    isLoading,
    saveEntry,
    setEntryStatus,
    prepareOffer,
    suggestOfferSlot,
    isSaving,
    isChangingStatus,
    isPreparingOffer,
    isSuggestingOffer,
  } = useProfessionalWaitlist();
  const [mode, setMode] = useState<"list" | "form">("list");
  const [formValue, setFormValue] = useState<ProfessionalWaitlistInput>(emptyForm);
  const [windows, setWindows] = useState<WindowDraft[]>([newWindow()]);
  const [offeringEntryId, setOfferingEntryId] = useState<string | null>(null);
  const [suggestingEntryId, setSuggestingEntryId] = useState<string | null>(null);
  const [offerStart, setOfferStart] = useState("");
  const [offerStartIso, setOfferStartIso] = useState("");
  const [offerEndIso, setOfferEndIso] = useState("");
  const [offerDuration, setOfferDuration] = useState(50);
  const [offerSuggestionSource, setOfferSuggestionSource] =
    useState<ProfessionalWaitlistSlotSuggestion["source"] | null>(null);
  const [createdOfferPath, setCreatedOfferPath] = useState<string | null>(null);
  const offerSuggestionInFlight = useRef(false);
  const offerSubmissionInFlight = useRef(false);
  const offerSubmissionKeyRef = useRef<string | null>(null);

  const activeCount = entries.filter((entry) => entry.status === "active" || entry.status === "offered").length;
  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === formValue.patient_id),
    [formValue.patient_id, patients],
  );

  const patchForm = (patch: Partial<ProfessionalWaitlistInput>) => {
    setFormValue((current) => ({ ...current, ...patch }));
  };

  const updateWindow = (key: string, patch: Partial<WindowDraft>) => {
    setWindows((current) => current.map((item) => item.key === key ? { ...item, ...patch } : item));
  };

  const resetForm = () => {
    setFormValue(emptyForm());
    setWindows([newWindow()]);
    setMode("list");
  };

  const beginEdit = (entry: ProfessionalWaitlistEntry) => {
    setFormValue({
      id: entry.id,
      patient_id: entry.patient_id,
      priority: entry.priority,
      valid_from: entry.valid_from,
      valid_until: entry.valid_until,
      minimum_duration_minutes: entry.minimum_duration_minutes,
      preferred_duration_minutes: entry.preferred_duration_minutes,
      modality: entry.modality,
      location: entry.location,
      offer_automatically: entry.offer_automatically,
      windows: [],
      rules_snapshot: {},
    });
    setWindows(entry.professional_waitlist_windows.map((item) => ({
      key: item.id || crypto.randomUUID(),
      mode: item.specific_date ? "date" : "weekday",
      weekday: item.weekday ?? 3,
      specificDate: item.specific_date || "",
      startTime: item.start_time.slice(0, 5),
      endTime: item.end_time.slice(0, 5),
    })));
    setCreatedOfferPath(null);
    setOfferingEntryId(null);
    setMode("form");
  };

  const submitEntry = async () => {
    if (!formValue.patient_id) {
      toast.error("Selecione um paciente.");
      return;
    }
    if (formValue.preferred_duration_minutes < formValue.minimum_duration_minutes) {
      toast.error("A duração preferida não pode ser menor que a mínima.");
      return;
    }
    if (windows.some((item) => !item.startTime || !item.endTime || item.endTime <= item.startTime || (item.mode === "date" && !item.specificDate))) {
      toast.error("Revise as janelas de disponibilidade.");
      return;
    }
    try {
      await saveEntry({
        ...formValue,
        windows: windows.map((item) => ({
          weekday: item.mode === "weekday" ? item.weekday : null,
          specific_date: item.mode === "date" ? item.specificDate : null,
          start_time: item.startTime,
          end_time: item.endTime,
        })),
        rules_snapshot: {
          patientName: selectedPatient?.name || null,
          communication: "A oferta automática sempre exige aceite do paciente.",
        },
      });
      toast.success(formValue.id ? "Regras da espera atualizadas." : "Paciente incluído na lista de espera.");
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    }
  };

  const changeStatus = async (entry: ProfessionalWaitlistEntry, status: "active" | "paused" | "removed") => {
    try {
      const result = await setEntryStatus({ entryId: entry.id, status });
      if (result.status === "scheduled") {
        toast.info(result.message || "A vaga já foi aceita e o agendamento está confirmado na Agenda.");
        return;
      }
      toast.success(status === "removed" ? "Paciente removido da lista." : status === "paused" ? "Espera pausada." : "Espera retomada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar.");
    }
  };

  const toggleOfferReview = async (entry: ProfessionalWaitlistEntry) => {
    if (offeringEntryId === entry.id) {
      setOfferingEntryId(null);
      setOfferSuggestionSource(null);
      return;
    }

    if (isSuggestingOffer || offerSuggestionInFlight.current) return;
    offerSuggestionInFlight.current = true;
    setSuggestingEntryId(entry.id);
    setOfferingEntryId(null);
    setOfferStart("");
    setOfferStartIso("");
    setOfferEndIso("");
    setOfferSuggestionSource(null);
    setCreatedOfferPath(null);

    try {
      const suggestion = await suggestOfferSlot(entry.id);
      if (!suggestion) {
        toast.info("Ainda não há uma vaga livre compatível com estas preferências.");
        return;
      }

      setOfferStart(toSaoPauloDateTimeLocal(suggestion.startsAt));
      setOfferStartIso(suggestion.startsAt);
      setOfferEndIso(suggestion.endsAt);
      setOfferDuration(suggestion.durationMinutes);
      setOfferSuggestionSource(suggestion.source);
      setOfferingEntryId(entry.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível calcular a vaga.");
    } finally {
      offerSuggestionInFlight.current = false;
      setSuggestingEntryId(null);
    }
  };

  const sendOffer = async (entry: ProfessionalWaitlistEntry) => {
    if (offerSubmissionInFlight.current) return;
    const startsAt = new Date(offerStartIso);
    const endsAt = new Date(offerEndIso);
    if (
      !offerStartIso
      || !offerEndIso
      || Number.isNaN(startsAt.getTime())
      || Number.isNaN(endsAt.getTime())
      || startsAt <= new Date()
      || endsAt <= startsAt
    ) {
      toast.error("A vaga calculada não está mais disponível.");
      return;
    }
    offerSubmissionInFlight.current = true;
    const idempotencyKey = offerSubmissionKeyRef.current || crypto.randomUUID();
    offerSubmissionKeyRef.current = idempotencyKey;
    try {
      const result = await prepareOffer({
        entryId: entry.id,
        startsAt: offerStartIso,
        endsAt: offerEndIso,
        idempotencyKey,
      });

      if (result.idempotent || result.alreadyOffered) {
        setOfferSuggestionSource("pending_offer");
        toast.info("Esta vaga já está sendo oferecida ao paciente. A oferta pendente foi preservada.");
        return;
      }

      if (!result.responsePath) {
        throw new Error("A vaga foi reservada, mas o link protegido não ficou disponível. Tente novamente em instantes.");
      }

      setCreatedOfferPath(result.responsePath);
      setOfferSuggestionSource("pending_offer");
      toast.success("Vaga reservada e oferecida ao paciente.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a oferta.");
    } finally {
      offerSubmissionInFlight.current = false;
      offerSubmissionKeyRef.current = null;
    }
  };

  const copyOfferLink = async () => {
    if (!createdOfferPath) return;
    await navigator.clipboard.writeText(`${window.location.origin}${createdOfferPath}`);
    toast.success("Link protegido copiado.");
  };

  return (
    <div className="agenda-waitlist-surface notification-popover-surface relative flex h-full min-h-0 flex-col overflow-hidden rounded-[32px] border border-border/55">
      <header className="notification-panel-header relative z-20 flex shrink-0 items-center justify-between border-b border-border/35 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {mode === "form" ? (
            <Button type="button" variant="ghost" size="icon" onClick={resetForm} className="notification-liquid-control h-11 w-11 rounded-full" aria-label="Voltar para a lista">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          ) : (
            <span className="notification-liquid-icon flex h-11 w-11 items-center justify-center rounded-[15px]">
              <UsersRound className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-sm font-black tracking-[-0.02em] text-foreground">
              {mode === "form" ? formValue.id ? "Editar espera" : "Adicionar à espera" : "Lista de espera"}
            </h2>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              {mode === "form" ? "Regras simples e precisas" : `${activeCount} ${activeCount === 1 ? "pessoa ativa" : "pessoas ativas"}`}
            </p>
          </div>
        </div>
        <div className="notification-liquid-toolbar flex items-center gap-1 p-1">
          {mode === "list" ? (
            <Button type="button" variant="ghost" size="icon" onClick={() => setMode("form")} className="notification-liquid-control h-11 w-11 rounded-full" aria-label="Adicionar paciente à lista de espera">
              <UserRoundPlus className="h-4 w-4" />
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="icon" onClick={onClose} className="notification-liquid-control h-11 w-11 rounded-full" aria-label="Fechar lista de espera">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {mode === "form" ? (
        <div className="notification-scroll-region min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">Paciente</Label>
            <Select value={formValue.patient_id} onValueChange={(patient_id) => patchForm({ patient_id })}>
              <SelectTrigger className="agenda-field h-12 rounded-2xl font-bold"><SelectValue placeholder="Quem está esperando?" /></SelectTrigger>
              <SelectContent className="agenda-menu-surface notification-liquid-menu rounded-[18px] p-1.5">
                {patients.map((patient) => <SelectItem key={patient.id} value={patient.id} className="notification-liquid-menu-item rounded-[13px] py-2.5">{patient.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">Prioridade</Label>
              <Select value={String(formValue.priority)} onValueChange={(priority) => patchForm({ priority: Number(priority) })}>
                <SelectTrigger className="agenda-field h-11 rounded-2xl font-bold"><SelectValue /></SelectTrigger>
                <SelectContent className="agenda-menu-surface notification-liquid-menu rounded-[18px] p-1.5">
                  <SelectItem value="1">1 · Máxima</SelectItem><SelectItem value="2">2 · Alta</SelectItem><SelectItem value="3">3 · Normal</SelectItem><SelectItem value="4">4 · Baixa</SelectItem><SelectItem value="5">5 · Flexível</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">Modalidade</Label>
              <Select value={formValue.modality || "any"} onValueChange={(modality) => patchForm({ modality: modality === "any" ? null : modality as "presencial" | "online" })}>
                <SelectTrigger className="agenda-field h-11 rounded-2xl font-bold"><SelectValue /></SelectTrigger>
                <SelectContent className="agenda-menu-surface notification-liquid-menu rounded-[18px] p-1.5"><SelectItem value="any">Qualquer</SelectItem><SelectItem value="presencial">Presencial</SelectItem><SelectItem value="online">Online</SelectItem></SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">Válido desde</Label><Input type="date" value={formValue.valid_from} onChange={(event) => patchForm({ valid_from: event.target.value })} className="agenda-field h-11 rounded-2xl font-bold" /></div>
            <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">Até (opcional)</Label><Input type="date" value={formValue.valid_until || ""} onChange={(event) => patchForm({ valid_until: event.target.value || null })} className="agenda-field h-11 rounded-2xl font-bold" /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">Duração mínima</Label><Input type="number" min={15} step={5} value={formValue.minimum_duration_minutes} onChange={(event) => patchForm({ minimum_duration_minutes: Number(event.target.value) })} className="agenda-field h-11 rounded-2xl font-bold" /></div>
            <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">Preferida</Label><Input type="number" min={15} step={5} value={formValue.preferred_duration_minutes} onChange={(event) => patchForm({ preferred_duration_minutes: Number(event.target.value) })} className="agenda-field h-11 rounded-2xl font-bold" /></div>
          </div>

          <section className="agenda-liquid-surface rounded-[22px] border p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-xs font-black text-foreground">Quando pode entrar?</p><p className="mt-1 text-[11px] text-muted-foreground">Adicione uma ou mais janelas.</p></div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setWindows((current) => [...current, newWindow()])} className="notification-liquid-control h-11 rounded-full px-3 text-xs font-bold"><Plus className="mr-1 h-3.5 w-3.5" />Janela</Button>
            </div>
            <div className="mt-3 space-y-3">
              {windows.map((windowDraft, index) => (
                <div key={windowDraft.key} className="agenda-liquid-card rounded-[18px] border p-3">
                  <div className="flex items-center gap-2">
                    <Select value={windowDraft.mode} onValueChange={(value) => updateWindow(windowDraft.key, { mode: value as WindowDraft["mode"] })}><SelectTrigger className="agenda-field h-11 flex-1 rounded-xl text-xs font-bold"><SelectValue /></SelectTrigger><SelectContent className="agenda-menu-surface"><SelectItem value="weekday">Toda semana</SelectItem><SelectItem value="date">Data específica</SelectItem></SelectContent></Select>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setWindows((current) => current.filter((item) => item.key !== windowDraft.key))} className="notification-liquid-control h-11 w-11 rounded-full" aria-label={`Remover janela ${index + 1}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                  <div className="mt-2">
                    {windowDraft.mode === "weekday" ? <Select value={String(windowDraft.weekday)} onValueChange={(weekday) => updateWindow(windowDraft.key, { weekday: Number(weekday) })}><SelectTrigger className="agenda-field h-11 rounded-xl text-xs font-bold"><SelectValue /></SelectTrigger><SelectContent className="agenda-menu-surface">{WEEK_DAYS.map((day) => <SelectItem key={day.value} value={String(day.value)}>{day.label}</SelectItem>)}</SelectContent></Select> : <Input type="date" value={windowDraft.specificDate} onChange={(event) => updateWindow(windowDraft.key, { specificDate: event.target.value })} className="agenda-field h-11 rounded-xl text-xs font-bold" />}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2"><Input type="time" value={windowDraft.startTime} onChange={(event) => updateWindow(windowDraft.key, { startTime: event.target.value })} className="agenda-field h-11 rounded-xl text-xs font-bold" aria-label={`Início da janela ${index + 1}`} /><Input type="time" value={windowDraft.endTime} onChange={(event) => updateWindow(windowDraft.key, { endTime: event.target.value })} className="agenda-field h-11 rounded-xl text-xs font-bold" aria-label={`Fim da janela ${index + 1}`} /></div>
                </div>
              ))}
              {!windows.length ? (
                <p className="rounded-[16px] border border-dashed border-border/55 bg-background/35 px-3 py-3 text-[11px] leading-relaxed text-muted-foreground">
                  Sem janelas: o paciente pode receber qualquer vaga que respeite a grade profissional.
                </p>
              ) : null}
            </div>
          </section>

          <div className="agenda-liquid-card flex items-center justify-between gap-4 rounded-[20px] border p-3.5">
            <div><p className="text-xs font-black text-foreground">Oferta automática</p><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Reserva a vaga por 2 horas e pede o aceite.</p></div>
            <Switch checked={formValue.offer_automatically} onCheckedChange={(offer_automatically) => patchForm({ offer_automatically })} aria-label="Oferecer horários automaticamente" />
          </div>
          <Button type="button" onClick={submitEntry} disabled={isSaving} className="h-12 w-full rounded-full font-black">{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : formValue.id ? <Pencil className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}{formValue.id ? "Salvar regras" : "Adicionar à lista"}</Button>
        </div>
      ) : (
        <div className="notification-scroll-region min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {isLoading ? <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando espera...</div> : null}
          {!isLoading && !entries.length ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center"><span className="notification-liquid-icon flex h-14 w-14 items-center justify-center rounded-[20px]"><CalendarClock className="h-5 w-5" /></span><p className="mt-4 text-sm font-black text-foreground">Agenda cheia sem perder ninguém</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Cadastre preferências e o Synapse encontra quem cabe em cada vaga.</p><Button type="button" onClick={() => setMode("form")} className="mt-5 h-11 rounded-full px-5 font-black"><Plus className="mr-2 h-4 w-4" />Adicionar paciente</Button></div>
          ) : null}
          <div className="space-y-3">
            {entries.map((entry) => (
              <article key={entry.id} className={cn("agenda-liquid-card notification-card rounded-[20px] border p-3.5", entry.status === "paused" && "opacity-65")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><div className="flex items-center gap-2"><span className={cn("flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[10px] font-black", entry.priority <= 2 ? "bg-amber-500/12 text-amber-600" : "bg-muted text-muted-foreground")}>P{entry.priority}</span><p className="truncate text-sm font-black text-foreground">{entry.patients?.name || "Paciente"}</p></div><p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{entry.professional_waitlist_windows.length ? entry.professional_waitlist_windows.map((item) => `${item.specific_date ? format(new Date(`${item.specific_date}T12:00:00`), "dd/MM") : WEEK_DAYS.find((day) => day.value === item.weekday)?.label}: ${item.start_time.slice(0, 5)}–${item.end_time.slice(0, 5)}`).join(" · ") : "Qualquer horário disponível"}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70">Mín. {entry.minimum_duration_minutes} min · {entry.modality || "qualquer modalidade"}{entry.offer_automatically ? " · automático" : ""}</p></div>
                  <div className="flex shrink-0 gap-1"><Button type="button" variant="ghost" size="icon" onClick={() => beginEdit(entry)} className="notification-liquid-control h-11 w-11 rounded-full" aria-label="Editar regras da espera"><Pencil className="h-3.5 w-3.5" /></Button><Button type="button" variant="ghost" size="icon" disabled={isChangingStatus} onClick={() => changeStatus(entry, entry.status === "paused" ? "active" : "paused")} className="notification-liquid-control h-11 w-11 rounded-full" aria-label={entry.status === "paused" ? "Retomar espera" : "Pausar espera"}>{entry.status === "paused" ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}</Button><Button type="button" variant="ghost" size="icon" disabled={isChangingStatus} onClick={() => changeStatus(entry, "removed")} className="notification-liquid-control h-11 w-11 rounded-full hover:text-destructive" aria-label="Remover da lista"><Trash2 className="h-3.5 w-3.5" /></Button></div>
                </div>
                {entry.status === "active" || entry.status === "offered" ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void toggleOfferReview(entry)}
                    disabled={isSuggestingOffer}
                    className="notification-liquid-control mt-3 h-11 w-full rounded-full text-xs font-black"
                    aria-expanded={offeringEntryId === entry.id}
                    aria-controls={`waitlist-offer-review-${entry.id}`}
                    aria-busy={suggestingEntryId === entry.id}
                  >
                    {suggestingEntryId === entry.id
                      ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
                      : <Send className="mr-1.5 h-3.5 w-3.5" />}
                    {hasActivePendingOffer(entry)
                      ? "Revisar vaga oferecida"
                      : "Oferecer a vaga"}
                  </Button>
                ) : null}
                {offeringEntryId === entry.id ? (
                  <div
                    id={`waitlist-offer-review-${entry.id}`}
                    className="mt-3 space-y-3 border-t border-border/40 pt-3"
                    aria-live="polite"
                  >
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">
                        {offerSuggestionSource === "pending_offer" ? "Vaga oferecida" : "Vaga sugerida pelo Synapse"}
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        {offerSuggestionSource === "pending_offer"
                          ? "O paciente já recebeu esta vaga e a reserva aguarda a resposta dele."
                          : "Confira a data, o horário e a duração calculados antes de oferecer ao paciente."}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor={`waitlist-offer-start-${entry.id}`}
                        className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground"
                      >
                        Data e horário
                      </Label>
                      <Input
                        id={`waitlist-offer-start-${entry.id}`}
                        type="datetime-local"
                        value={offerStart}
                        readOnly
                        aria-readonly="true"
                        className="agenda-field h-11 rounded-xl text-xs font-bold"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={offerDuration}
                        readOnly
                        aria-readonly="true"
                        className="agenda-field h-11 w-24 rounded-xl text-xs font-bold"
                        aria-label="Duração sugerida em minutos"
                      />
                      {offerSuggestionSource !== "pending_offer" ? (
                        <Button
                          type="button"
                          onClick={() => sendOffer(entry)}
                          disabled={isPreparingOffer}
                          className="agenda-primary-action h-11 flex-1 rounded-full text-xs font-black"
                        >
                          {isPreparingOffer
                            ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
                            : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                          Confirmar e oferecer
                        </Button>
                      ) : null}
                    </div>
                    {createdOfferPath ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={copyOfferLink}
                        className="notification-liquid-control h-11 w-full rounded-full text-xs font-bold"
                      >
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                        Copiar link de aceite
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
