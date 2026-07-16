import { Button } from "@/components/ui/button";
import { DesktopWorkspacePanel, DesktopWorkspaceShell } from "@/components/ui/desktop-workspace";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ReflectionCarousel as SharedReflectionCarousel } from "@/components/ui/reflection-carousel";
import { useDailyRotationItem } from "@/components/ui/reflection-carousel-rotation";
import { MoodTrendChart } from "@/components/patients/MoodTrendChart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/components/auth/SessionContextProvider";
import {
  type PatientPortalAnamnesis,
  type PatientPortalAnamnesisItem,
  type PatientPortalAppointment,
  type PatientPortalBillingEntry,
  type PatientPortalDocument,
  type PatientPortalGoal,
  type PatientPortalInvoice,
  type PatientPortalPackage,
  type PatientPortalSessionSummary,
  usePatientPortalAnamnesis,
  usePatientPortalAppointmentAction,
  usePatientPortalAppointments,
  usePatientPortalBilling,
  usePatientPortalCurrent,
  usePatientPortalDocuments,
  usePatientPortalGoals,
  usePatientPortalMood,
  usePatientPortalNotes,
  usePatientPortalPackages,
  usePatientPortalProgress,
  usePatientPortalSessionSummaries,
  usePatientPortalTasks,
  useSavePatientPortalAnamnesis,
  useTogglePatientPortalGoal,
  useUpdatePatientPortalProfile,
} from "@/hooks/use-patient-portal";
import { cn } from "@/lib/utils";
import {
  Angry,
  BrainCircuit,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Circle,
  ClipboardList,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Frown,
  HeartPulse,
  Home,
  Laugh,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  Meh,
  Package,
  Plus,
  ReceiptText,
  Route,
  Save,
  Smile,
  Target,
  TrendingUp,
  Trash2,
  Upload,
  UserRound,
  Video,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const dateOnly = new Intl.DateTimeFormat("pt-BR");
const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });
const dayOnly = new Intl.DateTimeFormat("pt-BR", { day: "2-digit" });
const monthOnly = new Intl.DateTimeFormat("pt-BR", { month: "short" });

const moodOptions = [
  { score: 1, label: "Pesado", icon: Angry, tone: "text-rose-600 border-rose-500/25 bg-rose-500/10" },
  { score: 2, label: "Difícil", icon: Frown, tone: "text-orange-600 border-orange-500/25 bg-orange-500/10" },
  { score: 3, label: "Neutro", icon: Meh, tone: "text-amber-600 border-amber-500/25 bg-amber-500/10" },
  { score: 4, label: "Bem", icon: Smile, tone: "text-emerald-600 border-emerald-500/25 bg-emerald-500/10" },
  { score: 5, label: "Leve", icon: Laugh, tone: "text-blue-600 border-blue-500/25 bg-blue-500/10" },
] as const;


const navItems = [
  { value: "home", label: "Início", path: "/portal", icon: Home },
  { value: "sessoes", label: "Sessões", path: "/portal/sessoes", icon: CalendarDays },
  { value: "humor", label: "Humor", path: "/portal/humor", icon: HeartPulse },
  { value: "documentos", label: "NeuroDrive", path: "/portal/documentos", icon: FileText },
  { value: "progresso", label: "Progresso", path: "/portal/progresso", icon: TrendingUp },
  { value: "financeiro", label: "NeuroFinance", path: "/portal/financeiro", icon: CreditCard },
  { value: "perfil", label: "Perfil", path: "/portal/perfil", icon: UserRound },
] as const;

type PortalView = (typeof navItems)[number]["value"];

const viewFromPath = (pathname: string): PortalView => {
  if (pathname.startsWith("/portal/agenda")) return "sessoes";
  if (pathname.startsWith("/portal/pacotes")) return "financeiro";
  const match = navItems.find((item) => item.path !== "/portal" && pathname.startsWith(item.path));
  return match?.value || "home";
};

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const fileSize = (bytes: number) => {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const mapsRouteUrl = (destination?: string | null) =>
  destination
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`
    : "";

const appointmentIsOnline = (appointment?: PatientPortalAppointment | null) =>
  String(appointment?.type || "").toLowerCase() === "online";

const patientSessionUrl = (appointment: PatientPortalAppointment) => {
  const link = appointment.google_meet_link || "";
  return /\/join\/[a-f0-9]{64}$/i.test(link) ? link : "";
};

const appointmentTypeLabel = (type?: string | null) => {
  const normalized = String(type || "").toLowerCase();
  if (normalized === "online") return "Online";
  if (normalized === "presencial" || normalized === "in_person") return "Presencial";
  return "Sessão";
};

const statusLabel = (status?: string | null) => {
  const normalized = String(status || "").toLowerCase();
  if (["paid", "received", "confirmed", "attended", "submitted", "completed"].includes(normalized)) return "Concluído";
  if (["pending", "processing", "draft", "unscored"].includes(normalized)) return "Em acompanhamento";
  if (["overdue", "expired"].includes(normalized)) return "Atenção";
  if (["cancelled", "canceled", "cancelled_by_professional", "cancelled_by_patient"].includes(normalized)) return "Cancelado";
  if (["absent", "missed"].includes(normalized)) return "Não compareceu";
  return "Em acompanhamento";
};

const patientQuotes = [
  "Pequenos passos também desenham caminhos inteiros.",
  "Seu ritmo não precisa parecer com o de ninguém para ser válido.",
  "Cuidar de si é uma forma silenciosa de coragem.",
  "Hoje não precisa ser perfeito; precisa apenas ser possível.",
  "Quando a mente pesa, gentileza vira direção.",
  "Você não é um problema a resolver; é uma história em construção.",
  "Clareza também nasce em dias lentos.",
  "Avançar pode ser só perceber melhor o que você sente.",
  "Existe força em pedir pausa, ajuda e espaço.",
  "O futuro melhora quando o cuidado fica mais perto.",
];

const statusTone = (status?: string | null) => {
  const normalized = String(status || "").toLowerCase();
  if (["paid", "received", "confirmed", "attended", "submitted"].includes(normalized)) {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }
  if (["overdue", "expired", "absent"].includes(normalized)) {
    return "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400";
  }
  return "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400";
};

const Panel = ({ children, className }: { children: ReactNode; className?: string }) => (
  <section className={cn("dashboard-retina-card rounded-[28px] p-5", className)}>{children}</section>
);

const EmptyState = ({ icon: Icon = FileText, title, description }: { icon?: typeof Home; title: string; description: string }) => (
  <div className="dashboard-soft-fill rounded-[28px] border border-dashed border-foreground/[0.14] p-8 text-center dark:border-white/[0.12]">
    <div className="dashboard-retina-card mx-auto flex h-12 w-12 items-center justify-center rounded-[18px] text-muted-foreground">
      <Icon className="h-5 w-5" />
    </div>
    <p className="mt-4 text-sm font-semibold text-foreground">{title}</p>
    <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
  </div>
);

const MetricCard = ({
  title,
  value,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: string;
  icon: typeof Home;
  tone?: "default" | "success" | "warning" | "info";
}) => (
  <Panel className="min-h-[132px]">
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-2xl border",
          tone === "success" && "border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
          tone === "warning" && "border-amber-500/20 bg-amber-500/10 text-amber-600",
          tone === "info" && "border-blue-500/20 bg-blue-500/10 text-blue-600",
          tone === "default" && "dashboard-soft-fill text-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
    </div>
    <p className="mt-5 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
  </Panel>
);

const SectionHeader = ({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) => (
  <div className="mb-4 flex items-start justify-between gap-4">
    <div className="min-w-0">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      {description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>}
    </div>
    {action}
  </div>
);

const LoadingCard = () => (
  <div className="dashboard-retina-card flex min-h-64 items-center justify-center rounded-[30px]">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

const LockedPortalState = ({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) => (
  <div className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
    <section className="w-full max-w-[560px] rounded-[28px] border border-border/65 bg-card/90 p-6 shadow-2xl shadow-black/5 sm:p-8">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground text-background">
        <Lock className="h-6 w-6" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </section>
  </div>
);

const getFirstName = (name: string) => name.trim().split(/\s+/)[0] || name;
const splitPatientName = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
};

const genderOptions = [
  { value: "", label: "Prefiro não informar" },
  { value: "female", label: "Feminino" },
  { value: "male", label: "Masculino" },
  { value: "non_binary", label: "Não binário" },
  { value: "agender", label: "Agênero" },
  { value: "gender_fluid", label: "Gênero fluido" },
  { value: "transgender", label: "Transgênero" },
  { value: "prefer_not_to_say", label: "Prefiro não dizer" },
  { value: "other", label: "Outro" },
];

const PortalModuleRail = ({
  activeView,
  onNavigate,
}: {
  activeView: PortalView;
  onNavigate: (path: string) => void;
}) => (
  <DesktopWorkspacePanel className="p-2.5">
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar lg:grid lg:grid-cols-7 lg:overflow-visible">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = activeView === item.value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onNavigate(item.path)}
            className={cn(
              "group flex h-[82px] min-w-[104px] flex-col items-center justify-center gap-2 rounded-[22px] px-2 text-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 lg:min-w-0",
              active
                ? "bg-foreground text-background shadow-sm dark:bg-white dark:text-zinc-950"
                : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground dark:hover:bg-white/[0.07]",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
            <span className="max-w-full truncate text-[9px] font-black uppercase leading-tight tracking-[0.12em]">
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  </DesktopWorkspacePanel>
);

const PortalHero = ({
  patientName,
  professionalName,
  activeLabel,
  nextAppointment,
  onSignOut,
  loggingOut,
}: {
  patientName: string;
  professionalName: string;
  activeLabel: string;
  nextAppointment?: PatientPortalAppointment;
  onSignOut: () => void;
  loggingOut: boolean;
}) => (
  <DesktopWorkspacePanel highContrast className="p-0">
    <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(360px,0.88fr)]">
      <div className="flex min-h-[228px] flex-col justify-between gap-8">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-background/18 bg-background/[0.08] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-background/62 dark:border-zinc-950/12 dark:bg-zinc-950/[0.05] dark:text-zinc-950/58">
                NeuroDiver
              </span>
              <span className="rounded-full border border-background/18 bg-background/[0.08] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-background/62 dark:border-zinc-950/12 dark:bg-zinc-950/[0.05] dark:text-zinc-950/58">
                {activeLabel}
              </span>
            </div>
            <Button
              onClick={onSignOut}
              disabled={loggingOut}
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-[18px] border border-background/18 bg-background/[0.08] text-background/66 hover:bg-background/[0.14] hover:text-background dark:border-zinc-950/12 dark:bg-zinc-950/[0.05] dark:text-zinc-950/62 dark:hover:text-zinc-950"
              aria-label="Sair"
            >
              {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            </Button>
          </div>
          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[0.96] tracking-tight text-background dark:text-zinc-950 sm:text-5xl xl:text-6xl">
            Oi, {getFirstName(patientName)}.
          </h1>
          <p className="mt-4 max-w-2xl text-sm font-medium leading-relaxed text-background/64 dark:text-zinc-950/62 sm:text-base">
            {professionalName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-background/18 bg-background/[0.08] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-background/66 dark:border-zinc-950/12 dark:bg-zinc-950/[0.05] dark:text-zinc-950/62">
            Portal do paciente
          </span>
          <span className="rounded-full border border-background/18 bg-background/[0.08] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-background/66 dark:border-zinc-950/12 dark:bg-zinc-950/[0.05] dark:text-zinc-950/62">
            Desktop
          </span>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[30px] border border-background/16 bg-background/[0.08] p-5 shadow-sm dark:border-zinc-950/12 dark:bg-zinc-950/[0.05]">
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-background/12 blur-3xl dark:bg-zinc-950/10" />
        <div className="relative z-10 flex h-full flex-col justify-between gap-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-background/54 dark:text-zinc-950/52">
              Próximo agendamento
            </p>
            <p className="mt-3 max-w-md text-2xl font-black leading-tight tracking-tight text-background dark:text-zinc-950">
              {nextAppointment
                ? dateTime.format(new Date(nextAppointment.start_time))
                : "Nenhuma sessão futura confirmada."}
            </p>
            <p className="mt-3 text-sm font-medium leading-relaxed text-background/62 dark:text-zinc-950/62">
              {nextAppointment
                ? appointmentIsOnline(nextAppointment)
                  ? "Sessão online pelo NeuroNex."
                  : nextAppointment.location || "Sessão presencial. O endereço aparecerá quando for compartilhado."
                : "Quando o próximo horário for confirmado, ele aparece aqui com os detalhes de acesso."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {nextAppointment ? (
              appointmentIsOnline(nextAppointment) ? (
                <Button asChild className="h-10 rounded-2xl bg-background text-xs font-black uppercase tracking-[0.14em] text-foreground hover:bg-background/90 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-900">
                  <a href={patientSessionUrl(nextAppointment)} target="_blank" rel="noreferrer">
                    Entrar
                  </a>
                </Button>
              ) : nextAppointment.location ? (
                <Button asChild className="h-10 rounded-2xl bg-background text-xs font-black uppercase tracking-[0.14em] text-foreground hover:bg-background/90 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-900">
                  <a href={mapsRouteUrl(nextAppointment.location)} target="_blank" rel="noreferrer">
                    Abrir rota
                  </a>
                </Button>
              ) : (
                <span className="rounded-full border border-background/18 bg-background/[0.08] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-background/64 dark:border-zinc-950/12 dark:bg-zinc-950/[0.05] dark:text-zinc-950/62">
                  Endereço não informado
                </span>
              )
            ) : (
              <span className="rounded-full border border-background/18 bg-background/[0.08] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-background/64 dark:border-zinc-950/12 dark:bg-zinc-950/[0.05] dark:text-zinc-950/62">
                Sem horário próximo
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  </DesktopWorkspacePanel>
);

const AppointmentRequestDialog = () => {
  return (
    <Button
      type="button"
      variant="outline"
      disabled
      className="h-11 rounded-2xl"
      title="Fale com o profissional para solicitar uma nova sessão."
    >
      <CalendarPlus className="mr-2 h-4 w-4" aria-hidden="true" />
      Nova sessão indisponível
    </Button>
  );
  /*
  const tomorrow = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date;
  }, []);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(toDateInputValue(tomorrow));
  const [time, setTime] = useState("09:00");
  const [type, setType] = useState<"online" | "presencial">("online");
  const requestAppointment = useRequestPatientPortalAppointment();

  const handleSubmit = () => {
    const start = new Date(`${date}T${time}:00`);
    if (!date || !time || !Number.isFinite(start.getTime()) || start.getTime() <= Date.now()) {
      toast.error("Escolha um horário futuro.");
      return;
    }

    requestAppointment.mutate(
      { startTime: start.toISOString(), type },
      {
        onSuccess: () => {
          toast.success("Pedido enviado para confirmação.");
          setOpen(false);
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível solicitar o horário."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11 rounded-2xl bg-zinc-950 px-4 text-xs font-bold uppercase tracking-[0.14em] text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100">
          <CalendarPlus className="mr-2 h-4 w-4" />
          Solicitar horário
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[520px] rounded-[28px] border border-border/70 bg-card p-0 shadow-2xl">
        <div className="border-b border-border/60 p-6">
          <DialogTitle className="text-xl font-semibold tracking-tight">Solicitar agendamento</DialogTitle>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Seu pedido fica pendente até o profissional confirmar o horário.
          </p>
        </div>
        <div className="space-y-5 p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Data</span>
              <input
                type="date"
                min={toDateInputValue(new Date())}
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
              />
            </label>
            <label className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Horário</span>
              <input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { value: "online" as const, label: "Online", icon: Video },
              { value: "presencial" as const, label: "Presencial", icon: MapPin },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setType(option.value)}
                className={cn(
                  "flex h-14 items-center justify-center gap-3 rounded-2xl border px-4 text-sm font-semibold transition-colors",
                  type === option.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                <option.icon className="h-4 w-4" />
                {option.label}
              </button>
            ))}
          </div>
          <Button
            onClick={handleSubmit}
            disabled={requestAppointment.isPending}
            className="h-12 w-full rounded-2xl bg-zinc-950 text-xs font-bold uppercase tracking-[0.16em] text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
          >
            {requestAppointment.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
            Enviar pedido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
  */
};

type PatientAppointmentAction = "confirm" | "cancel" | "reschedule";

const AppointmentActions = ({
  appointment,
}: {
  appointment: PatientPortalAppointment;
}) => {
  const [open, setOpen] = useState(false);
  const [actionType, setActionType] = useState<PatientAppointmentAction>("confirm");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(
    appointment.policy?.calendarMinDate || toDateInputValue(new Date()),
  );
  const [selectedStart, setSelectedStart] = useState("");
  const { action, availability } = usePatientPortalAppointmentAction();
  const selectedSlot = availability.data?.availableSlots.find(
    (slot) => slot.startTime === selectedStart,
  );

  const show = (nextAction: PatientAppointmentAction) => {
    setActionType(nextAction);
    setReason("");
    setSelectedStart("");
    availability.reset();
    setOpen(true);
  };

  const submit = () => {
    if (actionType === "reschedule" && !selectedSlot) {
      toast.error("Escolha um horário disponível.");
      return;
    }
    action.mutate(
      {
        appointmentId: appointment.id,
        expectedRevision: appointment.revision,
        action: actionType,
        reason: reason || undefined,
        requestedStartTime: selectedSlot?.startTime,
        requestedEndTime: selectedSlot?.endTime,
      },
      {
        onSuccess: () => {
          toast.success(
            actionType === "confirm"
              ? "Agendamento confirmado."
              : actionType === "cancel"
                ? "Agendamento cancelado."
                : "Pedido de reagendamento enviado.",
          );
          setOpen(false);
        },
        onError: (error) =>
          toast.error(
            error instanceof Error
              ? error.message
              : "Não foi possível atualizar o agendamento.",
          ),
      },
    );
  };

  const title = actionType === "confirm"
    ? "Confirmar agendamento"
    : actionType === "cancel"
      ? "Cancelar agendamento"
      : "Solicitar outro horário";
  const message = appointment.actions[actionType].message;

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2">
        {appointment.actions.confirm.allowed && (
          <Button type="button" size="sm" onClick={() => show("confirm")} className="rounded-xl">
            Confirmar
          </Button>
        )}
        {appointment.actions.reschedule.allowed && (
          <Button type="button" size="sm" variant="outline" onClick={() => show("reschedule")} className="rounded-xl">
            Reagendar
          </Button>
        )}
        {appointment.actions.cancel.allowed && (
          <Button type="button" size="sm" variant="ghost" onClick={() => show("cancel")} className="rounded-xl text-destructive hover:text-destructive">
            Cancelar
          </Button>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[540px] rounded-[28px] border border-border/70 bg-card p-0 shadow-2xl">
          <div className="border-b border-border/60 p-6">
            <DialogTitle className="text-xl font-semibold tracking-tight">{title}</DialogTitle>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{message}</p>
          </div>
          <div className="space-y-5 p-6">
            {actionType === "reschedule" && (
              <>
                <label className="block space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    Data
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      min={appointment.policy?.calendarMinDate}
                      max={appointment.policy?.calendarMaxDate}
                      value={date}
                      onChange={(event) => {
                        setDate(event.target.value);
                        setSelectedStart("");
                        availability.reset();
                      }}
                      className="h-11 flex-1 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={availability.isPending || !date}
                      onClick={() => availability.mutate({ appointmentId: appointment.id, date })}
                      className="rounded-xl"
                    >
                      {availability.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Ver horários
                    </Button>
                  </div>
                </label>
                {availability.data && (
                  <div className="grid max-h-44 grid-cols-3 gap-2 overflow-y-auto rounded-2xl border border-border bg-background p-3 sm:grid-cols-4">
                    {availability.data.availableSlots.length ? (
                      availability.data.availableSlots.map((slot) => (
                        <Button
                          key={slot.startTime}
                          type="button"
                          size="sm"
                          variant={selectedStart === slot.startTime ? "default" : "outline"}
                          aria-pressed={selectedStart === slot.startTime}
                          onClick={() => setSelectedStart(slot.startTime)}
                          className="rounded-xl"
                        >
                          {slot.label}
                        </Button>
                      ))
                    ) : (
                      <p className="col-span-full py-3 text-center text-sm text-muted-foreground">
                        Nenhum horário disponível nesta data.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
            {actionType !== "confirm" && (
              <label className="block space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Motivo opcional
                </span>
                <Textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value.slice(0, 500))}
                  maxLength={500}
                  className="min-h-24 rounded-2xl bg-background"
                />
              </label>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="rounded-xl">
                Voltar
              </Button>
              <Button type="button" onClick={submit} disabled={action.isPending} className="rounded-xl">
                {action.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {actionType === "confirm" ? "Confirmar" : actionType === "cancel" ? "Cancelar sessão" : "Enviar pedido"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const AppointmentCard = ({ appointment }: { appointment: PatientPortalAppointment }) => {
  const start = new Date(appointment.start_time);
  const isPast = start.getTime() < Date.now();
  const isRequest = appointment.status === "waiting_for_professional";
  const isOnline = appointmentIsOnline(appointment);

  return (
    <article className="rounded-[24px] border border-border/60 bg-card/82 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-4">
          <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border border-border bg-background">
            <span className="text-base font-bold text-foreground">{dayOnly.format(start)}</span>
            <span className="text-[9px] font-bold uppercase text-muted-foreground">{monthOnly.format(start)}</span>
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold capitalize text-foreground">{weekday.format(start)}</p>
            <p className="mt-1 text-sm text-muted-foreground">{dateTime.format(start)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={cn("inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em]", statusTone(isRequest ? "pending" : appointment.status))}>
                {isRequest ? "Aguardando confirmação" : isPast ? "Realizada" : statusLabel(appointment.status)}
              </span>
              <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {isOnline ? <Video className="mr-1.5 h-3 w-3" /> : <MapPin className="mr-1.5 h-3 w-3" />}
                {appointmentTypeLabel(appointment.type)}
              </span>
            </div>
            {!isPast && <AppointmentActions appointment={appointment} />}
          </div>
        </div>
        {isOnline && !isPast && (
          <Button asChild size="sm" className="shrink-0 rounded-xl">
            <a href={patientSessionUrl(appointment)} target="_blank" rel="noreferrer">
              Entrar
            </a>
          </Button>
        )}
        {!isOnline && appointment.location && !isPast && (
          <Button asChild size="sm" variant="outline" className="shrink-0 rounded-xl">
            <a href={mapsRouteUrl(appointment.location)} target="_blank" rel="noreferrer">
              Rota
            </a>
          </Button>
        )}
      </div>
    </article>
  );
};

const NextSessionPanel = ({ appointment }: { appointment?: PatientPortalAppointment }) => {
  const isOnline = appointmentIsOnline(appointment);

  return (
    <Panel className="bg-white/92 dark:bg-white/[0.06]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Próximo agendamento</p>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-foreground">
            {appointment ? dateTime.format(new Date(appointment.start_time)) : "Sem sessão futura confirmada"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {appointment
              ? isOnline
                ? "A sala online abre pelo ambiente seguro da NeuroNex."
                : appointment.location || "O endereço aparece aqui quando for compartilhado pelo profissional."
              : "Quando houver um horário confirmado, ele aparece aqui com acesso rápido e detalhes."}
          </p>
        </div>
        {appointment && (
          <div className="flex flex-wrap gap-2">
            {isOnline ? (
              <Button asChild className="h-11 rounded-2xl">
                <a href={patientSessionUrl(appointment)} target="_blank" rel="noreferrer">
                  <Video className="mr-2 h-4 w-4" />
                  Entrar
                </a>
              </Button>
            ) : appointment.location ? (
              <Button asChild className="h-11 rounded-2xl">
                <a href={mapsRouteUrl(appointment.location)} target="_blank" rel="noreferrer">
                  <Route className="mr-2 h-4 w-4" />
                  Abrir rota
                </a>
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </Panel>
  );
};

const SessionSummaryCard = ({ summary }: { summary: PatientPortalSessionSummary }) => {
  const hasContent = summary.transcriptionEnabled && summary.hasSummary;

  return (
    <article className="rounded-[26px] border border-border/60 bg-card/82 p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-background px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
              {dateOnly.format(new Date(summary.startTime))}
            </span>
            <span className={cn("rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em]", statusTone(summary.reviewStatus === "confirmed" ? "confirmed" : "pending"))}>
              {summary.transcriptionEnabled ? (summary.reviewStatus === "confirmed" ? "Registrado" : "Em revisão") : "Sem transcrição"}
            </span>
          </div>
          <h3 className="mt-4 text-lg font-black tracking-tight text-foreground">{summary.modality}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {hasContent
              ? summary.summary || "A transcrição original está disponível para consulta."
              : summary.transcriptionEnabled
                ? "Resumo em preparação. A versão original aparecerá aqui quando estiver disponível."
                : "Sessão realizada sem transcrição ativa."}
          </p>
        </div>
      </div>
      {hasContent && (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {summary.topics.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Temas</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {summary.topics.map((topic) => (
                  <span key={topic} className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}
          {summary.nextSteps.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Próximos passos</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {summary.nextSteps.map((step) => <li key={step}>{step}</li>)}
              </ul>
            </div>
          )}
          {summary.transcription && (
            <details className="rounded-2xl border border-border/60 bg-background/70 p-4 lg:col-span-2">
              <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                Ver transcrição original
              </summary>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{summary.transcription}</p>
            </details>
          )}
        </div>
      )}
    </article>
  );
};

const SessionsView = ({
  appointments,
  summaries,
}: {
  appointments?: PatientPortalAppointment[];
  summaries?: PatientPortalSessionSummary[];
}) => {
  const rows = appointments || [];
  const upcoming = rows.filter((appointment) => new Date(appointment.start_time).getTime() >= Date.now());
  const past = rows.filter((appointment) => new Date(appointment.start_time).getTime() < Date.now()).reverse();
  const nextAppointment = upcoming.find((appointment) =>
    appointment.status !== "cancelled" && appointment.status !== "closed"
  );
  const summaryRows = summaries || [];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Sessões"
        description="Agendamentos, pedidos e registros de IA compartilhados com você."
        action={<AppointmentRequestDialog />}
      />
      <Tabs defaultValue="agendamentos">
        <TabsList className="h-auto flex-wrap justify-start rounded-[22px] p-1.5">
          <TabsTrigger value="agendamentos" className="rounded-2xl">Agendamentos</TabsTrigger>
          <TabsTrigger value="resumos" className="rounded-2xl">Resumos de IA</TabsTrigger>
        </TabsList>
        <TabsContent value="agendamentos" className="space-y-5">
          <NextSessionPanel appointment={nextAppointment} />
          {rows.length ? (
            <>
              <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                <p className="px-1 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Próximos agendamentos</p>
                {upcoming.length ? upcoming.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} />) : (
                  <EmptyState icon={CalendarDays} title="Nenhuma sessão futura" description="Solicite um horário para o profissional confirmar." />
                )}
              </div>
              {past.length > 0 && (
                <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                  <p className="px-1 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Histórico de sessões</p>
                  {past.slice(0, 10).map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} />)}
                </div>
              )}
            </>
          ) : (
            <EmptyState icon={CalendarDays} title="Nenhuma sessão compartilhada" description="Quando houver sessão confirmada ou pedido pendente, ela aparece aqui." />
          )}
        </TabsContent>
        <TabsContent value="resumos" className="space-y-3">
          {summaryRows.length ? (
            summaryRows.map((summary) => <SessionSummaryCard key={`${summary.appointmentId}:${summary.id}`} summary={summary} />)
          ) : (
            <EmptyState icon={BrainCircuit} title="Nenhum resumo disponível" description="Sessões com transcrição ativada aparecerão aqui quando houver registro compartilhado." />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

type NeuroDriveTab = "documentos" | "anamneses" | "notas" | "tarefas";

const PatientNotesView = ({ notesState }: { notesState: ReturnType<typeof usePatientPortalNotes> }) => {
  const notes = useMemo(() => notesState.data?.notes || [], [notesState.data?.notes]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const selectedNote = notes.find((note) => note.id === selectedId) || null;
  const selectedNoteContent = selectedNote?.content;
  const selectedNoteId = selectedNote?.id;
  const selectedNoteTitle = selectedNote?.title;

  useEffect(() => {
    if (!selectedId && notes.length) {
      setSelectedId(notes[0].id);
    }
  }, [notes, selectedId]);

  useEffect(() => {
    if (selectedNoteId) {
      setTitle(selectedNoteTitle || "");
      setContent(selectedNoteContent || "");
    }
  }, [selectedNoteContent, selectedNoteId, selectedNoteTitle]);

  const startNewNote = () => {
    setSelectedId(null);
    setTitle("");
    setContent("");
  };

  const saveNote = () => {
    notesState.saveNote.mutate(
      {
        noteId: selectedNote?.id,
        title,
        content,
      },
      {
        onSuccess: ({ note }) => {
          setSelectedId(note.id);
          toast.success("Nota salva.");
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível salvar a nota."),
      },
    );
  };

  const deleteNote = () => {
    if (!selectedNote) return;
    const confirmed = window.confirm("Excluir esta nota pessoal?");
    if (!confirmed) return;

    notesState.deleteNote.mutate(selectedNote.id, {
      onSuccess: () => {
        setSelectedId(null);
        setTitle("");
        setContent("");
        toast.success("Nota excluída.");
      },
      onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível excluir a nota."),
    });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <Panel className="min-h-[420px]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Notas pessoais</p>
            <h3 className="mt-2 text-xl font-black tracking-tight text-foreground">Seus registros</h3>
          </div>
          <Button type="button" size="icon" variant="outline" className="h-11 w-11 rounded-2xl" onClick={startNewNote} aria-label="Criar nota">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-5 max-h-[520px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
          {notesState.isLoading ? (
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">Carregando notas...</div>
          ) : notes.length ? (
            notes.map((note) => (
              <button
                key={note.id}
                type="button"
                onClick={() => setSelectedId(note.id)}
                className={cn(
                  "w-full rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selectedId === note.id
                    ? "border-foreground/25 bg-foreground text-background"
                    : "border-border/60 bg-background/70 text-foreground hover:border-foreground/15",
                )}
              >
                <span className="block truncate text-sm font-black">{note.title || "Nota sem título"}</span>
                <span className={cn("mt-2 block line-clamp-2 text-xs leading-relaxed", selectedId === note.id ? "text-background/66" : "text-muted-foreground")}>
                  {note.content || "Sem conteúdo ainda."}
                </span>
                <span className={cn("mt-3 block text-[10px] font-bold uppercase tracking-[0.14em]", selectedId === note.id ? "text-background/48" : "text-muted-foreground")}>
                  {dateOnly.format(new Date(note.updatedAt))}
                </span>
              </button>
            ))
          ) : (
            <EmptyState icon={FileText} title="Nenhuma nota ainda" description="Crie registros rápidos para organizar ideias, tarefas e percepções entre sessões." />
          )}
        </div>
      </Panel>

      <Panel className="min-h-[420px]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
              {selectedNote ? "Editando nota" : "Nova nota"}
            </p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-foreground">Espaço pessoal</h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Essas notas são suas e ficam separadas das anotações clínicas privadas do profissional.
            </p>
          </div>
          {selectedNote && (
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-2xl px-4 text-rose-600 hover:text-rose-700"
              onClick={deleteNote}
              disabled={notesState.deleteNote.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </Button>
          )}
        </div>

        <div className="mt-5 space-y-4">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Título da nota"
            className="h-12 rounded-2xl border-border bg-background/70 px-4 text-base font-semibold"
            maxLength={120}
          />
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Escreva uma nota, ideia, lembrete ou reflexão..."
            className="min-h-[260px] rounded-[24px] border-border bg-background/70 p-4 text-base leading-relaxed"
            maxLength={12000}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              {content.length}/12000 caracteres
            </p>
            <Button
              type="button"
              className="h-12 rounded-2xl bg-zinc-950 px-5 text-xs font-black uppercase tracking-[0.14em] text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
              onClick={saveNote}
              disabled={notesState.saveNote.isPending || (!title.trim() && !content.trim())}
            >
              <Save className="mr-2 h-4 w-4" />
              Salvar nota
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
};

const PatientTasksView = ({ tasksState }: { tasksState: ReturnType<typeof usePatientPortalTasks> }) => {
  const tasks = useMemo(() => tasksState.data?.tasks || [], [tasksState.data?.tasks]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [dueDate, setDueDate] = useState("");
  const selectedTask = tasks.find((task) => task.id === selectedId) || null;
  const selectedTaskContent = selectedTask?.content;
  const selectedTaskDueDate = selectedTask?.dueDate;
  const selectedTaskId = selectedTask?.id;
  const selectedTaskTitle = selectedTask?.title;

  useEffect(() => {
    if (!selectedId && tasks.length) {
      setSelectedId(tasks[0].id);
    }
  }, [tasks, selectedId]);

  useEffect(() => {
    if (selectedTaskId) {
      setTitle(selectedTaskTitle || "");
      setContent(selectedTaskContent || "");
      setDueDate(selectedTaskDueDate ? selectedTaskDueDate.slice(0, 10) : "");
    }
  }, [selectedTaskContent, selectedTaskDueDate, selectedTaskId, selectedTaskTitle]);

  const startNewTask = () => {
    setSelectedId(null);
    setTitle("");
    setContent("");
    setDueDate("");
  };

  const saveTask = () => {
    tasksState.saveTask.mutate(
      {
        taskId: selectedTask?.id,
        title,
        content,
        dueDate: dueDate || null,
      },
      {
        onSuccess: ({ task }) => {
          setSelectedId(task.id);
          toast.success("Tarefa salva.");
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível salvar a tarefa."),
      },
    );
  };

  const toggleTask = (taskId: string, isCompleted: boolean) => {
    tasksState.toggleTask.mutate(
      { taskId, isCompleted },
      {
        onSuccess: () => toast.success(isCompleted ? "Tarefa concluída." : "Tarefa reaberta."),
        onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a tarefa."),
      },
    );
  };

  const deleteTask = () => {
    if (!selectedTask) return;
    const confirmed = window.confirm("Excluir esta tarefa?");
    if (!confirmed) return;

    tasksState.deleteTask.mutate(selectedTask.id, {
      onSuccess: () => {
        setSelectedId(null);
        setTitle("");
        setContent("");
        setDueDate("");
        toast.success("Tarefa excluída.");
      },
      onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível excluir a tarefa."),
    });
  };

  const pendingTasks = tasks.filter((task) => !task.isCompleted);
  const completedTasks = tasks.filter((task) => task.isCompleted);

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <Panel className="min-h-[420px]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Tarefas pessoais</p>
            <h3 className="mt-2 text-xl font-black tracking-tight text-foreground">Seu plano leve</h3>
          </div>
          <Button type="button" size="icon" variant="outline" className="h-11 w-11 rounded-2xl" onClick={startNewTask} aria-label="Criar tarefa">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-5 max-h-[520px] space-y-4 overflow-y-auto pr-1 custom-scrollbar">
          {tasksState.isLoading ? (
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">Carregando tarefas...</div>
          ) : tasks.length ? (
            <>
              {pendingTasks.length > 0 && (
                <div className="space-y-2">
                  <p className="px-1 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Em aberto</p>
                  {pendingTasks.map((task) => (
                    <TaskListButton key={task.id} task={task} selected={selectedId === task.id} onSelect={() => setSelectedId(task.id)} onToggle={() => toggleTask(task.id, true)} />
                  ))}
                </div>
              )}
              {completedTasks.length > 0 && (
                <div className="space-y-2">
                  <p className="px-1 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Concluídas</p>
                  {completedTasks.map((task) => (
                    <TaskListButton key={task.id} task={task} selected={selectedId === task.id} onSelect={() => setSelectedId(task.id)} onToggle={() => toggleTask(task.id, false)} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <EmptyState icon={ClipboardList} title="Nenhuma tarefa ainda" description="Crie lembretes pessoais para organizar pequenas ações entre sessões." />
          )}
        </div>
      </Panel>

      <Panel className="min-h-[420px]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
              {selectedTask ? "Editando tarefa" : "Nova tarefa"}
            </p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-foreground">Próxima ação</h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Use este espaço para compromissos pessoais. Missões compartilhadas pelo profissional ficam em Progresso.
            </p>
          </div>
          {selectedTask && (
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-2xl px-4 text-rose-600 hover:text-rose-700"
              onClick={deleteTask}
              disabled={tasksState.deleteTask.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </Button>
          )}
        </div>

        <div className="mt-5 grid gap-4">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Nome da tarefa"
            className="h-12 rounded-2xl border-border bg-background/70 px-4 text-base font-semibold"
            maxLength={160}
          />
          <Input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="h-12 rounded-2xl border-border bg-background/70 px-4 text-base font-semibold"
          />
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Detalhes opcionais..."
            className="min-h-[180px] rounded-[24px] border-border bg-background/70 p-4 text-base leading-relaxed"
            maxLength={4000}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              {selectedTask?.isCompleted ? "Esta tarefa está concluída." : "Esta tarefa fica visível apenas para você neste portal."}
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedTask && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 rounded-2xl px-5"
                  onClick={() => toggleTask(selectedTask.id, !selectedTask.isCompleted)}
                  disabled={tasksState.toggleTask.isPending}
                >
                  {selectedTask.isCompleted ? "Reabrir" : "Concluir"}
                </Button>
              )}
              <Button
                type="button"
                className="h-12 rounded-2xl bg-zinc-950 px-5 text-xs font-black uppercase tracking-[0.14em] text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
                onClick={saveTask}
                disabled={tasksState.saveTask.isPending || !title.trim()}
              >
                <Save className="mr-2 h-4 w-4" />
                Salvar tarefa
              </Button>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
};

const TaskListButton = ({
  task,
  selected,
  onSelect,
  onToggle,
}: {
  task: { title: string; content: string; dueDate: string | null; isCompleted: boolean };
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) => (
  <div
    className={cn(
      "flex items-start gap-3 rounded-2xl border p-3 transition-colors",
      selected ? "border-foreground/25 bg-foreground text-background" : "border-border/60 bg-background/70 text-foreground hover:border-foreground/15",
    )}
  >
    <button
      type="button"
      onClick={onToggle}
      className="mt-1 shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={task.isCompleted ? "Reabrir tarefa" : "Concluir tarefa"}
    >
      {task.isCompleted ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
    </button>
    <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left focus-visible:outline-none">
      <span className={cn("block truncate text-sm font-black", task.isCompleted && "line-through opacity-70")}>{task.title}</span>
      <span className={cn("mt-1 block line-clamp-2 text-xs leading-relaxed", selected ? "text-background/66" : "text-muted-foreground")}>
        {task.content || (task.dueDate ? `Até ${dateOnly.format(new Date(task.dueDate))}` : "Sem detalhes.")}
      </span>
    </button>
  </div>
);

const DocumentsView = ({
  documents,
  anamneses,
  tab,
  onTabChange,
}: {
  documents?: PatientPortalDocument[];
  anamneses?: PatientPortalAnamnesis[];
  tab: NeuroDriveTab;
  onTabChange: (tab: NeuroDriveTab) => void;
}) => {
  const rows = documents || [];
  const anamnesisRows = anamneses || [];
  const notesState = usePatientPortalNotes(tab === "notas");
  const tasksState = usePatientPortalTasks(tab === "tarefas");

  return (
    <div className="space-y-5">
      <SectionHeader title="NeuroDrive" description="Documentos, anamneses e registros pessoais compartilhados com cuidado." />

      <Tabs value={tab} onValueChange={(value) => onTabChange(value as NeuroDriveTab)}>
        <TabsList className="h-auto max-w-full flex-wrap justify-start rounded-[22px] p-1.5">
          <TabsTrigger value="documentos" className="rounded-2xl">Documentos</TabsTrigger>
          <TabsTrigger value="anamneses" className="rounded-2xl">Anamneses</TabsTrigger>
          <TabsTrigger value="notas" className="rounded-2xl">Notas</TabsTrigger>
          <TabsTrigger value="tarefas" className="rounded-2xl">Tarefas</TabsTrigger>
        </TabsList>
        <TabsContent value="documentos" className="space-y-3">
          {rows.length ? (
            <>
              <p className="px-1 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                {rows.length} arquivo{rows.length === 1 ? "" : "s"} disponível{rows.length === 1 ? "" : "is"}
              </p>
              {rows.map((document) => (
                <article key={document.id} className="rounded-[24px] border border-border/60 bg-card/82 p-4 shadow-sm transition-colors hover:border-foreground/15">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-background text-muted-foreground">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-foreground">{document.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {fileSize(document.sizeBytes)} {document.sharedAt ? `- ${dateOnly.format(new Date(document.sharedAt))}` : ""}
                        </p>
                      </div>
                    </div>
                    <Button
                      disabled={!document.signedUrl}
                      size="icon"
                      variant="outline"
                      className="h-10 w-10 shrink-0 rounded-xl"
                      onClick={() => document.signedUrl && window.open(document.signedUrl, "_blank", "noopener,noreferrer")}
                      aria-label={`Abrir ${document.name}`}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </article>
              ))}
            </>
          ) : (
            <EmptyState title="Nenhum documento compartilhado" description="Quando o profissional liberar um arquivo para você, ele aparecerá aqui." />
          )}
        </TabsContent>
        <TabsContent value="anamneses">
          <AnamnesisView anamneses={anamnesisRows} />
        </TabsContent>
        <TabsContent value="notas">
          <PatientNotesView notesState={notesState} />
        </TabsContent>
        <TabsContent value="tarefas">
          <PatientTasksView tasksState={tasksState} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const GoalsView = ({ goals }: { goals?: PatientPortalGoal[] }) => {
  const rows = goals || [];
  const toggleGoal = useTogglePatientPortalGoal();
  const completedCount = rows.filter((goal) => goal.is_completed).length;
  const progress = rows.length ? Math.round((completedCount / rows.length) * 100) : 0;

  if (!rows.length) {
    return <EmptyState icon={Target} title="Nenhuma missão ativa" description="Missões compartilhadas pelo profissional aparecem aqui para acompanhamento." />;
  }

  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Plano de missões</p>
            <p className="mt-1 text-sm text-muted-foreground">{completedCount} de {rows.length} concluídas</p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-background text-lg font-semibold text-foreground">
            {progress}%
          </div>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </Panel>
      <div className="space-y-3">
        {rows.map((goal) => (
          <button
            key={goal.id}
            type="button"
            onClick={() =>
              toggleGoal.mutate(
                { goalId: goal.id, isCompleted: !goal.is_completed },
                {
                  onSuccess: () => toast.success(goal.is_completed ? "Missão reaberta." : "Missão concluída."),
                  onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a missão."),
                },
              )
            }
            className={cn(
              "flex w-full items-start gap-4 rounded-[24px] border p-4 text-left transition-colors",
              goal.is_completed
                ? "border-emerald-500/20 bg-emerald-500/10"
                : "border-border/60 bg-card/82 hover:border-foreground/15",
            )}
          >
            {goal.is_completed ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" /> : <Circle className="mt-0.5 h-5 w-5 text-muted-foreground" />}
            <span className="min-w-0 flex-1">
              <span className={cn("block text-sm font-semibold text-foreground", goal.is_completed && "text-muted-foreground line-through")}>
                {goal.description}
              </span>
              {goal.due_date && <span className="mt-1 block text-xs font-medium text-muted-foreground">Até {dateOnly.format(new Date(`${goal.due_date}T00:00:00`))}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

const BillingView = ({
  entries,
  invoices,
  packages,
}: {
  entries?: PatientPortalBillingEntry[];
  invoices?: PatientPortalInvoice[];
  packages?: PatientPortalPackage[];
}) => {
  const entryRows = entries || [];
  const invoiceRows = invoices || [];
  const packageRows = packages || [];

  return (
    <div className="space-y-5">
      <SectionHeader title="NeuroFinance" description="Pacotes, sessões e cobranças compartilhadas em um só lugar." />
      <Tabs defaultValue="pacotes">
        <TabsList className="h-auto flex-wrap justify-start rounded-[22px] p-1.5">
          <TabsTrigger value="pacotes" className="rounded-2xl">Pacotes e sessões</TabsTrigger>
          <TabsTrigger value="cobrancas" className="rounded-2xl">Cobranças</TabsTrigger>
        </TabsList>
        <TabsContent value="pacotes" className="space-y-4">
          {packageRows.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {packageRows.map((pkg) => <PackageCard key={pkg.id} pkg={pkg} />)}
            </div>
          ) : (
            <EmptyState icon={Package} title="Nenhum pacote compartilhado" description="Pacotes contratados ou em acompanhamento aparecem aqui quando estiverem disponíveis." />
          )}
        </TabsContent>
        <TabsContent value="cobrancas" className="space-y-3">
          {entryRows.length ? (
            entryRows.map((entry) => <BillingChargeCard key={entry.id} entry={entry} />)
          ) : (
            <EmptyState icon={ReceiptText} title="Nenhuma cobrança disponível" description="Quando houver um pagamento disponível pelo NeuroFinance, ele aparecerá aqui." />
          )}
          {invoiceRows.length > 0 && (
            <div className="space-y-3 pt-2">
              <p className="px-1 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Recibos e documentos</p>
              {invoiceRows.map((invoice) => {
                const url = invoice.invoice_url || invoice.bank_slip_url || invoice.receipt_url || "";
                return (
                  <article key={invoice.id} className="rounded-[24px] border border-border/60 bg-card/82 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-base font-semibold text-foreground">{invoice.invoice_number || "Documento financeiro"}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {money.format(Number(invoice.amount || 0))} {invoice.due_date ? `- ${dateOnly.format(new Date(`${invoice.due_date}T00:00:00`))}` : ""}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" disabled={!url} className="rounded-xl" onClick={() => url && window.open(url, "_blank", "noopener,noreferrer")}>
                        Abrir
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

const BillingActionButton = ({
  href,
  primary = false,
  children,
}: {
  href?: string | null;
  primary?: boolean;
  children: ReactNode;
}) => {
  if (!href) return null;
  return (
    <Button
      asChild
      variant={primary ? "default" : "outline"}
      className={cn(
        "h-12 rounded-2xl px-5 text-xs font-black uppercase tracking-[0.14em]",
        primary && "bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100",
      )}
    >
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    </Button>
  );
};

const billingMethodLabel = (method?: string | null) => {
  const normalized = String(method || "").toLowerCase();
  if (normalized.includes("pix")) return "Pix";
  if (normalized.includes("boleto")) return "Boleto";
  if (normalized.includes("cart") || normalized.includes("card")) return "Cartão";
  if (normalized.includes("link")) return "Link de pagamento";
  return method || "A definir";
};

const BillingChargeCard = ({ entry }: { entry: PatientPortalBillingEntry }) => {
  const canPay = Boolean(entry.payment_url || entry.invoice_url || entry.bank_slip_url || entry.pix_qr_code || entry.pix_copy_paste);
  const chargeTitle = entry.title || entry.description || "Cobrança NeuroFinance";
  const paidAt = entry.paid_at ? dateOnly.format(new Date(entry.paid_at)) : null;
  const dueText = paidAt
    ? `Pagamento registrado em ${paidAt}`
    : entry.due_date
      ? `Disponível até ${dateOnly.format(new Date(`${entry.due_date}T00:00:00`))}`
      : "Disponível no portal";
  const methodLabel = billingMethodLabel(entry.payment_method);
  const statusText = statusLabel(entry.status);
  const primaryPaymentUrl = entry.payment_url || entry.invoice_url;
  const copyPix = async () => {
    if (!entry.pix_copy_paste) return;
    try {
      await navigator.clipboard.writeText(entry.pix_copy_paste);
      toast.success("Código Pix copiado.");
    } catch {
      toast.error("Não foi possível copiar o Pix agora.");
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="w-full rounded-[24px] border border-border/60 bg-card/82 p-4 text-left transition-colors hover:border-foreground/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-base font-semibold text-foreground">{chargeTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">{dueText}</p>
            </div>
            <div className="text-right">
              <p className="text-base font-semibold">{money.format(Number(entry.amount || 0))}</p>
              <span className={cn("mt-2 inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em]", statusTone(entry.status))}>
                {statusText}
              </span>
            </div>
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-none overflow-hidden rounded-[32px] border border-border/70 bg-card p-0 shadow-[0_44px_140px_-72px_rgba(0,0,0,0.92)] sm:max-w-[760px]">
        <div className="relative overflow-hidden border-b border-border/60 p-6 md:p-7">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,hsl(var(--foreground)/0.08),transparent_34%),linear-gradient(135deg,hsl(var(--muted)/0.62),transparent_48%)] dark:bg-[radial-gradient(circle_at_85%_0%,rgba(255,255,255,0.08),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.055),transparent_48%)]" />
          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <span className="inline-flex rounded-full border border-border/60 bg-background/76 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                NeuroFinance
              </span>
              <DialogTitle className="mt-4 text-2xl font-black tracking-tight text-foreground md:text-3xl">{chargeTitle}</DialogTitle>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Acompanhe os detalhes e escolha uma forma disponível para seguir com o pagamento.
              </p>
            </div>
            <div className="shrink-0 rounded-[26px] border border-border/60 bg-background/76 p-4 text-left shadow-sm md:min-w-[220px] md:text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Valor</p>
              <p className="mt-2 text-3xl font-black tracking-tight text-foreground">{money.format(Number(entry.amount || 0))}</p>
              <span className={cn("mt-3 inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em]", statusTone(entry.status))}>
                {statusText}
              </span>
            </div>
          </div>
        </div>
        <div className="max-h-[calc(100vh-18rem)] space-y-5 overflow-y-auto p-6 custom-scrollbar md:p-7">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] border border-border/70 bg-background/70 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Situação</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{statusText}</p>
            </div>
            <div className="rounded-[22px] border border-border/70 bg-background/70 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Forma</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{methodLabel}</p>
            </div>
            <div className="rounded-[22px] border border-border/70 bg-background/70 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Disponibilidade</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{dueText}</p>
            </div>
          </div>

          {(entry.pix_qr_code || entry.pix_copy_paste) && (
            <div className="grid gap-4 rounded-[26px] border border-border/70 bg-background/70 p-4 md:grid-cols-[auto_1fr] md:items-center">
              {entry.pix_qr_code && (
                <div className="mx-auto rounded-[24px] border border-border/60 bg-white p-3 shadow-sm md:mx-0">
                  <img
                    src={entry.pix_qr_code.startsWith("data:") ? entry.pix_qr_code : `data:image/png;base64,${entry.pix_qr_code}`}
                    alt="QR Code Pix"
                    className="h-44 w-44 rounded-[18px]"
                  />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Pix disponível</p>
                <h3 className="mt-2 text-xl font-black tracking-tight text-foreground">Pague pelo QR Code ou copie o código.</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Use o app do seu banco para ler o QR Code. Se preferir, copie o código Pix e cole no pagamento.
                </p>
                {entry.pix_copy_paste && (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <div className="min-w-0 flex-1 truncate rounded-2xl border border-border/70 bg-card px-4 py-3 text-xs font-medium text-muted-foreground">
                      {entry.pix_copy_paste}
                    </div>
                    <Button type="button" variant="outline" className="h-11 rounded-2xl px-4 text-xs font-black uppercase tracking-[0.14em]" onClick={copyPix}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <BillingActionButton href={primaryPaymentUrl} primary>
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir pagamento
            </BillingActionButton>
            <BillingActionButton href={entry.bank_slip_url}>
              <ReceiptText className="mr-2 h-4 w-4" />
              Abrir boleto
            </BillingActionButton>
            <BillingActionButton href={entry.receipt_url}>
              <FileText className="mr-2 h-4 w-4" />
              Ver recibo
            </BillingActionButton>
          </div>

          {!canPay && (
            <div className="rounded-[24px] border border-border/70 bg-background/70 p-5">
              <p className="text-sm font-semibold text-foreground">Pagamento ainda não liberado no portal.</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Quando o profissional disponibilizar o pagamento pelo NeuroFinance, as opções aparecerão aqui automaticamente.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const PackageCard = ({ pkg }: { pkg: PatientPortalPackage }) => {
  const used = Number(pkg.sessions_used || 0);
  const total = Math.max(Number(pkg.total_sessions || 0), 0);
  const remaining = Math.max(total - used, 0);
  const progress = total ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const expired = pkg.end_date ? new Date(`${pkg.end_date}T23:59:59`).getTime() < Date.now() : false;
  const complete = total > 0 && remaining <= 0;

  return (
    <Panel>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-background text-muted-foreground">
            <Package className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground">{pkg.description || "Pacote terapêutico"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Início {dateOnly.format(new Date(`${pkg.start_date}T00:00:00`))}
              {pkg.end_date ? ` - vence ${dateOnly.format(new Date(`${pkg.end_date}T00:00:00`))}` : ""}
            </p>
          </div>
        </div>
        <span className={cn("shrink-0 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em]", statusTone(complete ? "submitted" : expired ? "expired" : "pending"))}>
          {complete ? "Concluído" : expired ? "Expirado" : "Ativo"}
        </span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-background/70 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Usadas</p>
          <p className="mt-2 text-xl font-semibold">{used}/{total || 0}</p>
        </div>
        <div className="rounded-2xl border border-border bg-background/70 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Restantes</p>
          <p className="mt-2 text-xl font-semibold">{remaining}</p>
        </div>
        <div className="rounded-2xl border border-border bg-background/70 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Investimento</p>
          <p className="mt-2 text-xl font-semibold">{pkg.price ? money.format(pkg.price) : "N/A"}</p>
        </div>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
      </div>
    </Panel>
  );
};

const AnamnesisEditor = ({ record }: { record: PatientPortalAnamnesis }) => {
  const [draft, setDraft] = useState<PatientPortalAnamnesisItem[]>(record.content || []);
  const saveAnamnesis = useSavePatientPortalAnamnesis();

  useEffect(() => {
    setDraft(record.content || []);
  }, [record.id, record.content]);

  const updateAnswer = (index: number, value: string) => {
    setDraft((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, answer: value } : item)));
  };

  const save = () => {
    saveAnamnesis.mutate(
      { anamnesisId: record.id, content: draft },
      {
        onSuccess: () => toast.success("Anamnese salva."),
        onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível salvar a anamnese."),
      },
    );
  };

  return (
    <Panel className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-base font-semibold text-foreground">{record.type || "Ficha de anamnese"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {record.status === "submitted" ? "Enviada" : record.status === "expired" ? "Expirada" : "Pendente"} - {record.progress}% preenchida
          </p>
        </div>
        <span className={cn("rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em]", statusTone(record.status))}>
          {record.status === "submitted" ? "Leitura" : record.status === "expired" ? "Expirada" : "Editável"}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${record.progress}%` }} />
      </div>
      {draft.length ? (
        <div className="space-y-4">
          {draft.map((item, index) => (
            item.isSection ? (
              <div key={`${item.question}-${index}`} className="rounded-2xl border border-border bg-muted/30 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {item.question}
              </div>
            ) : (
              <label key={`${item.question}-${index}`} className="block rounded-2xl border border-border bg-background/65 p-4">
                <span className="text-sm font-semibold text-foreground">{item.question}</span>
                <Textarea
                  value={item.answer || ""}
                  readOnly={!record.canEdit}
                  onChange={(event) => updateAnswer(index, event.target.value)}
                  className="mt-3 min-h-28 rounded-2xl border-border bg-card"
                  placeholder={record.canEdit ? "Digite sua resposta" : "Sem resposta"}
                />
              </label>
            )
          ))}
          {record.canEdit && (
            <Button onClick={save} disabled={saveAnamnesis.isPending} className="h-11 rounded-2xl bg-zinc-950 px-5 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100">
              {saveAnamnesis.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar anamnese
            </Button>
          )}
        </div>
      ) : (
        <EmptyState icon={ClipboardList} title="Ficha sem perguntas" description="Esta anamnese ainda não tem conteúdo estruturado para exibir." />
      )}
    </Panel>
  );
};

const AnamnesisView = ({ anamneses }: { anamneses?: PatientPortalAnamnesis[] }) => {
  const rows = anamneses || [];
  if (!rows.length) {
    return <EmptyState icon={ClipboardList} title="Nenhuma anamnese disponível" description="Fichas enviadas pelo profissional aparecem aqui para preencher ou consultar." />;
  }
  return (
    <div className="space-y-5">
      <SectionHeader title="Anamneses" description="Continue fichas pendentes e consulte respostas enviadas em modo leitura." />
      {rows.map((record) => <AnamnesisEditor key={record.id} record={record} />)}
    </div>
  );
};

type ProgressTab = "visao" | "missoes";

const ProgressView = ({
  progress,
  goals,
  tab,
  onTabChange,
}: {
  progress?: {
    attendedSessions: number;
    sessionsTotal: number;
    completedGoals: number;
    goalsTotal: number;
    sharedDocuments: number;
    moodLogs: number;
    activePackages: number;
    lastMood: any;
    nextSteps: PatientPortalGoal[];
  };
  goals?: PatientPortalGoal[];
  tab: ProgressTab;
  onTabChange: (tab: ProgressTab) => void;
}) => {
  const lastMood = progress?.lastMood;
  const moodMeta = moodOptions.find((option) => option.score === lastMood?.mood_score);
  const MoodIcon = moodMeta?.icon || HeartPulse;
  const openGoals = progress?.nextSteps || (goals || []).filter((goal) => !goal.is_completed).slice(0, 5);

  return (
    <div className="space-y-5">
      <SectionHeader title="Progresso" description="Visão geral e missões compartilhadas para acompanhar seu processo." />
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard title="Sessões registradas" value={`${progress?.attendedSessions || 0}/${progress?.sessionsTotal || 0}`} icon={CalendarDays} />
        <MetricCard title="Missões concluídas" value={`${progress?.completedGoals || 0}/${progress?.goalsTotal || 0}`} icon={Target} tone={(progress?.completedGoals || 0) ? "success" : "default"} />
        <MetricCard title="Documentos" value={String(progress?.sharedDocuments || 0)} icon={FileText} tone="info" />
        <MetricCard title="Pacotes em uso" value={String(progress?.activePackages || 0)} icon={Package} />
      </div>
      <Tabs value={tab} onValueChange={(value) => onTabChange(value as ProgressTab)}>
        <TabsList className="h-auto flex-wrap justify-start rounded-[22px] p-1.5">
          <TabsTrigger value="visao" className="rounded-2xl">Visão geral</TabsTrigger>
          <TabsTrigger value="missoes" className="rounded-2xl">Missões</TabsTrigger>
        </TabsList>
        <TabsContent value="visao" className="space-y-5">
          <Panel>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-background text-muted-foreground">
                <BrainCircuit className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-foreground">Direção atual</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Este painel usa apenas sinais compartilhados: sessões, missões, humor, documentos e pacotes. Notas clínicas privadas não aparecem aqui.
                </p>
                <div className="mt-4 grid gap-2">
                  {openGoals.length ? openGoals.map((goal) => (
                    <div key={goal.id} className="rounded-2xl border border-border bg-background/70 p-3 text-sm text-muted-foreground">
                      {goal.description}
                    </div>
                  )) : <p className="text-sm text-muted-foreground">Nenhuma missão aberta no momento.</p>}
                </div>
              </div>
            </div>
          </Panel>
          <Panel>
            <div className="flex items-start gap-4">
              <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border", moodMeta?.tone || "border-border bg-background text-muted-foreground")}>
                <MoodIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">Registro emocional recente</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {lastMood
                    ? `${moodMeta?.label || "Registro"} em ${dateTime.format(new Date(lastMood.created_at))}${lastMood.notes ? `: ${lastMood.notes}` : "."}`
                    : "Nenhum diário preenchido ainda."}
                </p>
              </div>
            </div>
          </Panel>
        </TabsContent>
        <TabsContent value="missoes">
          <GoalsView goals={goals} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const DiaryView = ({ mood }: { mood: ReturnType<typeof usePatientPortalMood> }) => {
  const [moodScore, setMoodScore] = useState(mood.data?.today?.mood_score || 4);
  const [notes, setNotes] = useState(mood.data?.today?.notes || "");
  const logs = mood.data?.logs || [];

  useEffect(() => {
    if (mood.data?.today) {
      setMoodScore(mood.data.today.mood_score);
      setNotes(mood.data.today.notes || "");
    }
  }, [mood.data?.today]);

  const saveMood = () => {
    mood.saveMood.mutate(
      { moodScore, notes },
      { onSuccess: () => toast.success("Registro salvo no diário.") },
    );
  };

  return (
    <div className="space-y-5">
      <MoodTrendChart logs={logs} audience="patient" />
      <Panel>
        <p className="text-lg font-semibold text-foreground">Como você está hoje?</p>
        <div className="mt-5 grid grid-cols-5 gap-2">
          {moodOptions.map((option) => (
            <button
              key={option.score}
              type="button"
              onClick={() => setMoodScore(option.score)}
              className={cn(
                "flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border px-2 text-xs font-semibold transition-colors",
                moodScore === option.score ? option.tone : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              <option.icon className="h-5 w-5" />
              <span className="max-w-full truncate">{option.label}</span>
            </button>
          ))}
        </div>
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Escreva uma nota breve para acompanhar seu processo."
          className="mt-4 min-h-28 rounded-2xl border-border bg-background"
          maxLength={1200}
        />
        <Button onClick={saveMood} disabled={mood.saveMood.isPending} className="mt-4 h-11 rounded-2xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100">
          {mood.saveMood.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar registro
        </Button>
      </Panel>
      <section className="space-y-3">
        <p className="px-1 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Registros recentes</p>
        {logs.length ? logs.map((log) => (
          <article key={log.id} className="rounded-[24px] border border-border/60 bg-card/82 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">{dateTime.format(new Date(log.created_at))}</p>
                {log.notes && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{log.notes}</p>}
              </div>
              <span className={cn("rounded-full border px-3 py-1 text-sm font-semibold", moodOptions.find((option) => option.score === log.mood_score)?.tone || "border-border bg-background text-foreground")}>
                {log.mood_score}
              </span>
            </div>
          </article>
        )) : <EmptyState icon={HeartPulse} title="Nenhum registro ainda" description="Use esta área para acompanhar pequenas mudanças entre as sessões." />}
      </section>
    </div>
  );
};

const ProfileView = ({
  patientName,
  patientEmail,
  patientAvatarUrl,
  patientGenderIdentity,
  professionalName,
  onSignOut,
  loggingOut,
}: {
  patientName: string;
  patientEmail?: string | null;
  patientAvatarUrl?: string | null;
  patientGenderIdentity?: string | null;
  professionalName: string;
  onSignOut: () => void;
  loggingOut: boolean;
}) => {
  const initialName = useMemo(() => splitPatientName(patientName), [patientName]);
  const [firstName, setFirstName] = useState(initialName.firstName);
  const [lastName, setLastName] = useState(initialName.lastName);
  const [genderIdentity, setGenderIdentity] = useState(patientGenderIdentity || "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const updateProfile = useUpdatePatientPortalProfile();

  useEffect(() => {
    setFirstName(initialName.firstName);
    setLastName(initialName.lastName);
  }, [initialName.firstName, initialName.lastName]);

  useEffect(() => {
    setGenderIdentity(patientGenderIdentity || "");
  }, [patientGenderIdentity]);

  const previewUrl = avatarFile ? URL.createObjectURL(avatarFile) : patientAvatarUrl || "";

  useEffect(() => {
    if (!avatarFile || !previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [avatarFile, previewUrl]);

  const save = () => {
    updateProfile.mutate(
      {
        firstName,
        lastName,
        genderIdentity: genderIdentity || null,
        avatarFile,
      },
      {
        onSuccess: () => {
          setAvatarFile(null);
          toast.success("Perfil atualizado.");
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível atualizar seu perfil."),
      },
    );
  };

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex items-center gap-4 lg:w-[320px]">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[26px] border border-border bg-background text-muted-foreground">
              {previewUrl ? (
                <img src={previewUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserRound className="h-7 w-7" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-foreground">{patientName}</p>
              <p className="mt-1 truncate text-sm text-muted-foreground">{patientEmail || "E-mail não informado"}</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => setAvatarFile(event.target.files?.[0] || null)}
              />
              <Button type="button" variant="outline" size="sm" className="mt-3 rounded-2xl" onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Foto
              </Button>
            </div>
          </div>

          <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Nome</span>
              <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} maxLength={80} />
            </label>
            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Sobrenome</span>
              <Input value={lastName} onChange={(event) => setLastName(event.target.value)} maxLength={120} />
            </label>
            <label className="space-y-2 sm:col-span-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Gênero</span>
              <select
                value={genderIdentity}
                onChange={(event) => setGenderIdentity(event.target.value)}
                className="flex h-11 w-full rounded-xl border border-border/30 bg-background/50 px-4 py-2 text-sm shadow-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {genderOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <div className="sm:col-span-2">
              <Button onClick={save} disabled={updateProfile.isPending} className="h-12 rounded-2xl bg-zinc-950 px-6 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100">
                {updateProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar perfil
              </Button>
            </div>
          </div>
        </div>
        <div className="mt-5 rounded-2xl border border-border bg-background/70 p-4">
          <p className="text-sm font-semibold text-foreground">Profissional vinculado</p>
          <p className="mt-1 text-sm text-muted-foreground">{professionalName}</p>
        </div>
      </Panel>
      <Button onClick={onSignOut} disabled={loggingOut} variant="outline" className="h-12 w-full rounded-2xl">
        {loggingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
        Sair
      </Button>
    </div>
  );
};

const HomeSummaryRow = ({
  title,
  icon: Icon,
  detail,
  value,
  onClick,
}: {
  title: string;
  icon: typeof Home;
  detail: string;
  value: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-full items-center justify-between gap-4 rounded-2xl border border-border/60 bg-background/62 p-4 text-left transition-colors hover:border-foreground/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <span className="flex min-w-0 items-center gap-4">
      <span className="dashboard-soft-fill flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] text-muted-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{detail}</span>
      </span>
    </span>
    <span className="shrink-0 text-right text-sm font-black text-foreground">{value}</span>
  </button>
);

const PatientReflectionCarousel = ({ patientName }: { patientName: string }) => {
  const dailyQuote = useDailyRotationItem(patientQuotes);
  const slides = [
    {
      eyebrow: "Frase do dia",
      title: dailyQuote || patientQuotes[0],
      description: "Uma pequena lâmina para atravessar o dia com menos ruído e mais presença.",
    },
    {
      eyebrow: "Boas-vindas",
      title: "Esse ambiente foi construído para você.",
      description: `Não somos empresários. Somos pacientes que, como você, vislumbram um futuro melhor. Seja muito bem-vindo, ${getFirstName(patientName)}.`,
    },
  ];

  return (
    <SharedReflectionCarousel
      slides={slides}
      icon={BrainCircuit}
      ariaLabel="Reflexões para o seu dia"
    />
  );
};

const HomeView = ({
  nextAppointment,
  pendingAmount,
  documentsCount,
  activeGoals,
  anamnesisRecord,
  packages,
  mood,
  patientName,
  onNavigate,
}: {
  nextAppointment?: PatientPortalAppointment;
  pendingAmount: number;
  documentsCount: number;
  activeGoals: number;
  anamnesisRecord?: PatientPortalAnamnesis;
  packages: PatientPortalPackage[];
  mood: ReturnType<typeof usePatientPortalMood>;
  patientName: string;
  onNavigate: (path: string) => void;
}) => {
  const todayMood = mood.data?.today;
  const moodMeta = moodOptions.find((option) => option.score === todayMood?.mood_score);
  const packageActive = packages.find((pkg) => Number(pkg.total_sessions || 0) > Number(pkg.sessions_used || 0));
  const remainingSessions = packageActive ? Math.max(Number(packageActive.total_sessions || 0) - Number(packageActive.sessions_used || 0), 0) : 0;
  const nextSessionDetail = nextAppointment
    ? `${appointmentTypeLabel(nextAppointment.type)} - ${dateTime.format(new Date(nextAppointment.start_time))}`
    : "Sem sessão futura confirmada";
  const anamnesisValue = anamnesisRecord
    ? anamnesisRecord.status === "submitted"
      ? "Enviada"
      : `${anamnesisRecord.progress}%`
    : "Sem ficha nova";

  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Resumo do momento</p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-foreground">O essencial, sem ruído.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Sessões, documentos, progresso e financeiro aparecem aqui apenas como atalhos rápidos.
            </p>
          </div>
          <Button variant="outline" className="h-11 rounded-2xl" onClick={() => onNavigate("/portal/sessoes")}>
            Ver sessões
          </Button>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <HomeSummaryRow
            title="Próximo agendamento"
            detail={nextSessionDetail}
            value={nextAppointment ? "Ver" : "Solicitar"}
            icon={CalendarDays}
            onClick={() => onNavigate("/portal/sessoes")}
          />
          <HomeSummaryRow
            title="NeuroFinance"
            detail={pendingAmount ? money.format(pendingAmount) : "Sem pagamentos disponíveis agora."}
            value={pendingAmount ? "Disponível" : "Tudo em dia"}
            icon={CreditCard}
            onClick={() => onNavigate("/portal/financeiro")}
          />
          <HomeSummaryRow
            title="NeuroDrive"
            detail={`${documentsCount} documento${documentsCount === 1 ? "" : "s"} compartilhado${documentsCount === 1 ? "" : "s"}`}
            value="Abrir"
            icon={FileText}
            onClick={() => onNavigate("/portal/documentos")}
          />
          <HomeSummaryRow
            title="Progresso"
            detail={activeGoals ? `${activeGoals} missão${activeGoals === 1 ? "" : "ões"} em acompanhamento` : "Sem missão aberta agora"}
            value={activeGoals ? "Missões" : "Em dia"}
            icon={TrendingUp}
            onClick={() => onNavigate("/portal/progresso")}
          />
        </div>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel className="min-h-[156px]">
          <p className="text-sm font-semibold text-muted-foreground">Humor de hoje</p>
          <p className="mt-4 text-2xl font-black tracking-tight text-foreground">
            {todayMood ? moodMeta?.label || `Humor ${todayMood.mood_score}` : "Sem registro"}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {todayMood ? "Seu diário de humor está salvo para hoje." : "Registre seu humor quando fizer sentido."}
          </p>
          <Button variant="outline" className="mt-5 rounded-2xl" onClick={() => onNavigate("/portal/humor")}>
            Abrir humor
          </Button>
        </Panel>
        <Panel className="min-h-[156px]">
          <p className="text-sm font-semibold text-muted-foreground">Anamnese</p>
          <p className="mt-4 text-2xl font-black tracking-tight text-foreground">{anamnesisValue}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {anamnesisRecord ? "Acompanhe ou continue sua ficha quando fizer sentido." : "Nenhuma ficha nova no momento."}
          </p>
          <Button variant="outline" className="mt-5 rounded-2xl" onClick={() => onNavigate(anamnesisRecord ? "/portal/documentos?tab=anamneses" : "/portal/humor")}>
            {anamnesisRecord ? "Abrir anamnese" : "Registrar humor"}
          </Button>
        </Panel>
        <Panel className="min-h-[156px]">
          <p className="text-sm font-semibold text-muted-foreground">Pacotes</p>
          <p className="mt-4 text-2xl font-black tracking-tight text-foreground">
            {packageActive ? `${remainingSessions} sessões` : "Sem pacote ativo"}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {packageActive ? packageActive.description || "Pacote em acompanhamento." : "Quando houver um pacote, ele aparece no NeuroFinance."}
          </p>
          <Button variant="outline" className="mt-5 rounded-2xl" onClick={() => onNavigate("/portal/financeiro")}>
            Abrir NeuroFinance
          </Button>
        </Panel>
      </div>

      <PatientReflectionCarousel patientName={patientName} />
    </div>
  );
};

const PatientPortal = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const activeView = viewFromPath(location.pathname);
  const searchParams = new URLSearchParams(location.search);
  const requestedTab = searchParams.get("tab") || "";
  const neuroDriveTab = (["documentos", "anamneses", "notas", "tarefas"].includes(requestedTab) ? requestedTab : "documentos") as NeuroDriveTab;
  const progressTab = (["visao", "missoes"].includes(requestedTab) ? requestedTab : "visao") as ProgressTab;
  const current = usePatientPortalCurrent();
  const isActive = current.data?.status === "active";
  const appointments = usePatientPortalAppointments(isActive);
  const documents = usePatientPortalDocuments(isActive);
  const billing = usePatientPortalBilling(isActive);
  const mood = usePatientPortalMood(isActive);
  const goals = usePatientPortalGoals(isActive);
  const anamnesis = usePatientPortalAnamnesis(isActive);
  const packages = usePatientPortalPackages(isActive);
  const progress = usePatientPortalProgress(isActive);
  const sessionSummaries = usePatientPortalSessionSummaries(isActive);

  const patientName = current.data?.patient?.name || "Paciente";
  const professionalName = current.data?.professional?.name || "Seu psicólogo";
  const activeNav = navItems.find((item) => item.value === activeView) || navItems[0];

  useEffect(() => {
    if (location.pathname.startsWith("/portal/agenda")) {
      navigate("/portal/sessoes", { replace: true });
    } else if (location.pathname.startsWith("/portal/historico")) {
      navigate("/portal/progresso", { replace: true });
    } else if (location.pathname.startsWith("/portal/metas")) {
      navigate("/portal/progresso?tab=missoes", { replace: true });
    } else if (location.pathname.startsWith("/portal/anamneses")) {
      navigate("/portal/documentos?tab=anamneses", { replace: true });
    }
  }, [location.pathname, navigate]);

  const setNeuroDriveTab = (tab: NeuroDriveTab) => navigate(tab === "documentos" ? "/portal/documentos" : `/portal/documentos?tab=${tab}`);
  const setProgressTab = (tab: ProgressTab) => navigate(tab === "visao" ? "/portal/progresso" : `/portal/progresso?tab=${tab}`);

  const appointmentRows = useMemo(() => appointments.data?.appointments || [], [appointments.data?.appointments]);
  const billingEntries = useMemo(() => billing.data?.entries || [], [billing.data?.entries]);
  const goalRows = goals.data?.goals || [];
  const packageRows = packages.data?.packages || [];
  const anamnesisRows = anamnesis.data?.anamneses || [];

  const nextAppointment = useMemo(() => (
    appointmentRows
      .filter((appointment) =>
        new Date(appointment.start_time).getTime() >= Date.now() &&
        appointment.status !== "cancelled" &&
        appointment.status !== "closed"
      )
      .sort((left, right) => new Date(left.start_time).getTime() - new Date(right.start_time).getTime())[0]
  ), [appointmentRows]);

  const pendingAmount = useMemo(() => (
    billingEntries
      .filter((entry) => !["paid", "received", "confirmed"].includes(String(entry.status || "").toLowerCase()))
      .reduce((total, entry) => total + Number(entry.amount || 0), 0)
  ), [billingEntries]);

  const handleSignOut = async () => {
    setLoggingOut(true);
    await signOut();
    navigate("/auth", { replace: true });
  };

  if (current.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!current.data || current.data.status === "needs_activation") {
    return (
      <LockedPortalState
        title="Ative seu Portal do Paciente"
        description="Entre pelo link do convite enviado por e-mail ou informe o código de ativação para liberar seu acesso."
        action={(
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={() => navigate("/portal/ativar")} className="h-11 rounded-xl">Inserir código</Button>
            <Button onClick={handleSignOut} variant="outline" className="h-11 rounded-xl">Sair</Button>
          </div>
        )}
      />
    );
  }

  if (current.data.status === "suspended") {
    return (
      <LockedPortalState
        title="Portal temporariamente indisponível"
        description={current.data.message || "O acesso ao portal depende da assinatura ativa do profissional."}
        action={<Button onClick={handleSignOut} variant="outline" className="h-11 rounded-xl">Sair</Button>}
      />
    );
  }

  if (current.data.status === "revoked") {
    return (
      <LockedPortalState
        title="Vínculo revogado"
        description="Solicite um novo convite ao profissional para voltar a acessar o portal."
        action={<Button onClick={handleSignOut} variant="outline" className="h-11 rounded-xl">Sair</Button>}
      />
    );
  }

  const renderView = () => {
    switch (activeView) {
      case "sessoes":
        return appointments.isLoading || sessionSummaries.isLoading ? <LoadingCard /> : (
          <SessionsView appointments={appointmentRows} summaries={sessionSummaries.data?.summaries} />
        );
      case "documentos":
        return documents.isLoading || anamnesis.isLoading ? <LoadingCard /> : (
          <DocumentsView
            documents={documents.data?.documents}
            anamneses={anamnesisRows}
            tab={neuroDriveTab}
            onTabChange={setNeuroDriveTab}
          />
        );
      case "progresso":
        return progress.isLoading || goals.isLoading ? <LoadingCard /> : (
          <ProgressView
            progress={progress.data?.progress}
            goals={goalRows}
            tab={progressTab}
            onTabChange={setProgressTab}
          />
        );
      case "financeiro":
        return billing.isLoading || packages.isLoading ? <LoadingCard /> : <BillingView entries={billingEntries} invoices={billing.data?.invoices} packages={packageRows} />;
      case "humor":
        return mood.isLoading ? <LoadingCard /> : <DiaryView mood={mood} />;
      case "perfil":
        return (
          <ProfileView
            patientName={patientName}
            patientEmail={current.data.patient?.email}
            patientAvatarUrl={current.data.patient?.avatarUrl}
            patientGenderIdentity={current.data.patient?.genderIdentity}
            professionalName={professionalName}
            onSignOut={handleSignOut}
            loggingOut={loggingOut}
          />
        );
      case "home":
      default:
        if (appointments.isLoading || billing.isLoading || documents.isLoading || goals.isLoading || mood.isLoading || anamnesis.isLoading || packages.isLoading) {
          return <LoadingCard />;
        }
        return (
          <HomeView
            nextAppointment={nextAppointment}
            pendingAmount={pendingAmount}
            documentsCount={documents.data?.documents?.length || 0}
            activeGoals={goalRows.filter((goal) => !goal.is_completed).length}
            anamnesisRecord={anamnesisRows.find((record) => record.status === "pending") || anamnesisRows[0]}
            packages={packageRows}
            mood={mood}
            patientName={patientName}
            onNavigate={navigate}
          />
        );
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background pb-12 pt-6 text-foreground selection:bg-primary/10 selection:text-primary lg:pt-8">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_12%_8%,hsl(var(--foreground)/0.055),transparent_32%),radial-gradient(circle_at_88%_4%,hsl(var(--primary)/0.075),transparent_30%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.22)_58%,hsl(var(--background)))] dark:bg-[radial-gradient(circle_at_12%_8%,rgba(255,255,255,0.045),transparent_32%),radial-gradient(circle_at_88%_4%,rgba(255,255,255,0.028),transparent_30%),linear-gradient(180deg,#070708,#0b0b0c_58%,#070708)]" />

      <main className="page-spacing relative z-10 mx-auto flex w-full max-w-[2200px] flex-col gap-4 px-4 pb-10 sm:px-6 md:px-8 lg:px-12 xl:px-16">
        <DesktopWorkspaceShell>
          <div className="space-y-4">
            <PortalHero
              patientName={patientName}
              professionalName={professionalName}
              activeLabel={activeNav.label}
              nextAppointment={nextAppointment}
              onSignOut={handleSignOut}
              loggingOut={loggingOut}
            />

            <PortalModuleRail activeView={activeView} onNavigate={navigate} />

            <DesktopWorkspacePanel className="min-h-[520px] p-4 sm:p-5 lg:p-6">
              {renderView()}
            </DesktopWorkspacePanel>
          </div>
        </DesktopWorkspaceShell>
      </main>
    </div>
  );
};

export default PatientPortal;
