"use client";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { NewPatientModal } from "@/components/patients/NewPatientModal";
import { Button } from "@/components/ui/button";
import { useSynapse } from "@/context/SynapseContext";
import { useAppointmentsByDateRange } from "@/hooks/use-appointments-by-date-range";
import { useFinancialAccount } from "@/hooks/use-financial-account";
import { usePendingPatientsCount } from "@/hooks/use-pending-patients-count";
import { getAppointmentStatusMeta, isCancelledAppointmentStatus } from "@/lib/appointment-status";
import { getAppointmentDisplayTitle } from "@/lib/appointment-utils";
import { cn } from "@/lib/utils";
import { addDays, differenceInMinutes, endOfDay, format, isAfter, isSameDay, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Appointment } from "@/types";
import { motion } from "framer-motion";
import {
    ArrowRight,
    Calendar,
    Clock,
    FileText,
    MessageSquare,
    Mic,
    Plus,
    Sparkles,
    Users,
    WalletCards,
} from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
    MobileActionListItem,
    MobileEmptyState,
    MobilePageScaffold,
    MobileSectionHeader,
} from "../components/MobilePagePrimitives";
import { MobileNewAppointmentSheet } from "../components/MobileNewAppointmentSheet";

type MobileAppointment = Omit<Appointment, "type"> & {
    type: Appointment["type"] | "teleconsulta";
};
type MobileAuthUser = {
    user_metadata?: Record<string, unknown>;
};

type MetricCardProps = {
    label: string;
    value: string | number;
    description: string;
    icon: typeof Calendar;
    tone?: "default" | "dark" | "warning" | "success";
    onClick: () => void;
};

const getFirstName = (user?: MobileAuthUser | null) => {
    const metadata = user?.user_metadata || {};
    const firstName = typeof metadata.first_name === "string" ? metadata.first_name : null;
    const name = typeof metadata.name === "string" ? metadata.name : null;
    return firstName || name?.split(" ")?.[0] || "Doutor";
};

const formatAppointmentTime = (appointment?: MobileAppointment) => {
    if (!appointment?.start_time) return "—";
    return format(new Date(appointment.start_time), "HH:mm");
};

const getMinutesUntil = (appointment?: MobileAppointment) => {
    if (!appointment?.start_time) return null;
    const minutes = differenceInMinutes(new Date(appointment.start_time), new Date());
    if (minutes < 0) return "em andamento";
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours}h ${rest}min` : `${hours}h`;
};

const MetricCard = ({ label, value, description, icon: Icon, tone = "default", onClick }: MetricCardProps) => (
    <button
        type="button"
        onClick={onClick}
        className={cn(
            "min-w-0 rounded-[20px] border p-3.5 text-left transition-colors active:opacity-80",
            tone === "dark"
                ? "border-foreground bg-foreground text-background"
                : "border-border/45 bg-card/72 text-foreground dark:border-white/10 dark:bg-white/[0.03]",
            tone === "warning" && "border-amber-500/20 bg-amber-500/[0.06]",
            tone === "success" && "border-emerald-500/18 bg-emerald-500/[0.055]",
        )}
    >
        <div className="flex items-center justify-between gap-2">
            <span className={cn(
                "flex h-9 w-9 items-center justify-center rounded-[13px]",
                tone === "dark" ? "bg-background/10" : "bg-foreground/[0.045] text-muted-foreground",
            )}>
                <Icon className="h-4 w-4" />
            </span>
            <ArrowRight className="h-3.5 w-3.5 opacity-30" />
        </div>
        <p className="mt-4 truncate text-[1.65rem] font-black leading-none tracking-[-0.055em]">{value}</p>
        <p className={cn("mt-2 text-[7px] font-black uppercase tracking-[0.14em]", tone === "dark" ? "opacity-55" : "text-muted-foreground/55")}>{label}</p>
        <p className={cn("mt-1 line-clamp-2 text-[9px] font-medium leading-relaxed", tone === "dark" ? "opacity-65" : "text-muted-foreground/68")}>{description}</p>
    </button>
);

const AppointmentRow = ({ appointment, highlighted = false, onClick }: { appointment: MobileAppointment; highlighted?: boolean; onClick: () => void }) => {
    const status = getAppointmentStatusMeta(appointment.status, appointment.notes);
    const isPast = new Date(appointment.end_time) < new Date();

    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex w-full items-center gap-3 rounded-[18px] border p-3 text-left transition-colors active:opacity-80",
                highlighted
                    ? "border-foreground bg-foreground text-background"
                    : "border-border/40 bg-card/65 dark:border-white/10 dark:bg-white/[0.025]",
                isPast && "opacity-45",
            )}
        >
            <div className={cn(
                "flex h-11 w-14 shrink-0 items-center justify-center rounded-[14px] text-sm font-black",
                highlighted ? "bg-background/10" : "bg-foreground/[0.045] text-foreground",
            )}>
                {formatAppointmentTime(appointment)}
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-black tracking-[-0.02em]">
                    {getAppointmentDisplayTitle(appointment) || appointment.patient_name || "Paciente"}
                </p>
                <div className="mt-1.5 flex min-w-0 items-center gap-2">
                    <span className={cn(
                        "truncate text-[8px] font-black uppercase tracking-[0.11em]",
                        highlighted ? "opacity-60" : status.textClass,
                    )}>
                        {status.label}
                    </span>
                    <span className={cn("text-[8px] font-medium", highlighted ? "opacity-45" : "text-muted-foreground/55")}>
                        {appointment.type === "online" || appointment.type === "teleconsulta" ? "Online" : "Consultório"}
                    </span>
                </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 opacity-30" />
        </button>
    );
};

export const MobileDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const today = useMemo(() => new Date(), []);
    const { setShellState, setActiveTab, toggleVoiceMode } = useSynapse();
    const { data: allAppointments, isLoading } = useAppointmentsByDateRange(startOfDay(today), endOfDay(addDays(today, 7)));
    const { data: pendingPatientsRaw } = usePendingPatientsCount();
    const { isConnected: financialConnected } = useFinancialAccount();

    const activeAppointments = useMemo(() => {
        if (!allAppointments) return [];
        return allAppointments
            .filter((appointment: MobileAppointment) => !isCancelledAppointmentStatus(appointment.status, appointment.notes))
            .sort((left: MobileAppointment, right: MobileAppointment) => new Date(left.start_time).getTime() - new Date(right.start_time).getTime());
    }, [allAppointments]);

    const todayAppointments = useMemo(
        () => activeAppointments.filter((appointment: MobileAppointment) => isSameDay(new Date(appointment.start_time), today)),
        [activeAppointments, today],
    );

    const nextAppointment = useMemo(
        () => activeAppointments.find((appointment: MobileAppointment) => isAfter(new Date(appointment.end_time), new Date())),
        [activeAppointments],
    );

    const remainingCount = todayAppointments.filter((appointment: MobileAppointment) => isAfter(new Date(appointment.end_time), new Date())).length;
    const pendingPatients = Number(pendingPatientsRaw || 0);
    const firstName = getFirstName(user);
    const minutesUntil = getMinutesUntil(nextAppointment);

    const openSynapseText = () => {
        setShellState("compact");
        setActiveTab("chat");
    };

    const openSynapseVoice = () => {
        setShellState("compact");
        setActiveTab("voice");
        toggleVoiceMode();
    };

    return (
        <MobilePageScaffold className="bg-background">
            <div className="space-y-5 pb-2">
                <motion.section
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden rounded-[24px] border border-foreground bg-foreground p-5 text-background"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-[8px] font-black uppercase tracking-[0.17em] opacity-50">
                                {format(today, "EEEE, d 'de' MMMM", { locale: ptBR })}
                            </p>
                            <h1 className="mt-2 text-[2.35rem] font-black leading-[0.9] tracking-[-0.065em]">
                                Bom dia, {firstName}.
                            </h1>
                        </div>
                        <MobileNewAppointmentSheet selectedDate={today}>
                            <button type="button" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-background text-foreground active:opacity-80" aria-label="Novo agendamento">
                                <Plus className="h-4.5 w-4.5" />
                            </button>
                        </MobileNewAppointmentSheet>
                    </div>

                    <p className="mt-4 text-xs font-medium leading-relaxed opacity-68">
                        {nextAppointment
                            ? `A próxima sessão começa às ${formatAppointmentTime(nextAppointment)}${minutesUntil ? ` (${minutesUntil})` : ""}.`
                            : pendingPatients > 0
                                ? `${pendingPatients} paciente${pendingPatients > 1 ? "s" : ""} precisam de atenção hoje.`
                                : "Sua agenda está livre para organizar a clínica e planejar a semana."}
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-2.5">
                        <Button onClick={() => navigate("/agenda")} className="h-11 rounded-[14px] bg-background text-[8px] font-black uppercase tracking-[0.12em] text-foreground hover:bg-background/90">
                            Abrir agenda
                        </Button>
                        <Button onClick={openSynapseText} variant="outline" className="h-11 rounded-[14px] border-background/15 bg-background/[0.07] text-[8px] font-black uppercase tracking-[0.12em] text-background hover:bg-background/10">
                            <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Synapse
                        </Button>
                    </div>
                </motion.section>

                <section className="grid grid-cols-2 gap-2.5">
                    <MetricCard label="Hoje" value={remainingCount} description="Atendimentos restantes" icon={Calendar} tone="dark" onClick={() => navigate("/agenda")} />
                    <MetricCard label="Próxima" value={nextAppointment ? formatAppointmentTime(nextAppointment) : "—"} description={nextAppointment ? getAppointmentDisplayTitle(nextAppointment) || "Paciente" : "Sem sessão"} icon={Clock} onClick={() => navigate("/agenda")} />
                    <MetricCard label="Pacientes" value={pendingPatients} description="Cadastros ou retornos" icon={Users} tone={pendingPatients > 0 ? "warning" : "success"} onClick={() => navigate("/pacientes")} />
                    <MetricCard label="Financeiro" value={financialConnected ? "ON" : "OFF"} description={financialConnected ? "Conta conectada" : "Ativação pendente"} icon={WalletCards} tone={financialConnected ? "success" : "warning"} onClick={() => navigate("/financeiro")} />
                </section>

                <section className="space-y-3">
                    <MobileSectionHeader
                        eyebrow="Próxima sessão"
                        title="Preparação imediata"
                        description="Acesse o compromisso sem percorrer a agenda inteira."
                    />
                    {isLoading ? (
                        <div className="h-24 animate-pulse rounded-[18px] bg-foreground/[0.04]" />
                    ) : nextAppointment ? (
                        <AppointmentRow
                            appointment={nextAppointment}
                            highlighted
                            onClick={() => navigate("/agenda", { state: { openAppointmentId: nextAppointment.id } })}
                        />
                    ) : (
                        <MobileEmptyState
                            icon={Clock}
                            title="Sem próxima sessão"
                            description="Quando houver um agendamento, o acesso rápido aparecerá aqui."
                            className="min-h-[190px] rounded-[20px] border border-dashed border-border/45"
                        />
                    )}
                </section>

                <section className="space-y-3">
                    <MobileSectionHeader
                        eyebrow="Agenda viva"
                        title="Hoje na clínica"
                        action={<Button onClick={() => navigate("/agenda")} variant="outline" className="h-9 rounded-xl px-3 text-[7px] font-black uppercase tracking-[0.11em]">Ver agenda</Button>}
                    />
                    {todayAppointments.length ? (
                        <div className="space-y-2">
                            {todayAppointments.slice(0, 4).map((appointment: MobileAppointment) => (
                                <AppointmentRow
                                    key={appointment.id}
                                    appointment={appointment}
                                    highlighted={appointment.id === nextAppointment?.id}
                                    onClick={() => navigate("/agenda", { state: { openAppointmentId: appointment.id } })}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-[18px] border border-border/40 bg-card/60 p-4 text-center text-[10px] font-medium text-muted-foreground">
                            Nenhum atendimento marcado para hoje.
                        </div>
                    )}
                </section>

                <section className="space-y-3">
                    <MobileSectionHeader eyebrow="Ações rápidas" title="Atalhos úteis" />
                    <div className="grid gap-2">
                        <MobileNewAppointmentSheet selectedDate={today}>
                            <div><MobileActionListItem icon={Plus} title="Novo agendamento" description="Abra o formulário para marcar uma sessão." /></div>
                        </MobileNewAppointmentSheet>
                        <NewPatientModal>
                            <div><MobileActionListItem icon={Users} title="Novo paciente" description="Cadastre uma pessoa e os dados de atendimento." /></div>
                        </NewPatientModal>
                        <MobileActionListItem icon={FileText} title="Notas" description="Abra seus registros e anotações rápidas." onClick={() => navigate("/notas")} />
                        <MobileActionListItem icon={Sparkles} title="Synapse por texto" description="Converse com o assistente dentro do sistema." onClick={openSynapseText} />
                        <MobileActionListItem icon={Mic} title="Synapse por voz" description="Inicie o modo de voz quando estiver em um ambiente adequado." onClick={openSynapseVoice} />
                    </div>
                </section>
            </div>
        </MobilePageScaffold>
    );
};
