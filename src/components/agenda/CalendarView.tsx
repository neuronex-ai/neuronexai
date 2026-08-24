"use client";

import { Appointment } from "@/types";
import { format, addDays, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval, setHours, setMinutes, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatTimeBrazil } from "@/lib/timezone";
import { Loader2, Clock, Video, MapPin, ChevronLeft, ChevronRight, Lock, Plus, UsersRound, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MagneticSegmentedControl } from "@/components/ui/magnetic-segmented-control";
import { Calendar } from "@/components/ui/calendar";
import { AppointmentDetailModal } from "./AppointmentDetailModal";
import { AgendaSettingsModal } from "./AgendaSettingsModal";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
    DndContext,
    DragEndEvent,
    DragOverEvent,
    useSensor,
    useSensors,
    PointerSensor,
    TouchSensor,
    KeyboardSensor,
    DragOverlay,
    DragStartEvent,
    DragCancelEvent,
    defaultDropAnimationSideEffects,
    MeasuringStrategy,
    pointerWithin,
    rectIntersection,
    type CollisionDetection,
    type Announcements,
    type ScreenReaderInstructions,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useMemo, useEffect, useRef, type ReactNode } from "react";
import { NewAppointmentModal } from "./NewAppointmentModal";
import {
    AppointmentRescheduleConflictDialog,
    type RescheduleConflict,
} from "./AppointmentRescheduleConflictDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createPortal } from "react-dom";
import { useAuth } from "@/components/auth/SessionContextProvider";
import { useNavigate } from "react-router-dom";
import { useGoogleAuth } from "@/hooks/use-google-auth";
import { getAppointmentStatusMeta } from "@/lib/appointment-status";
import { getAppointmentDisplayTitle } from "@/lib/appointment-utils";
import {
    getAppointmentPlanIssues,
    prepareAppointmentActionPlan,
} from "@/lib/appointment-action-plans";
import { getAppointmentPlanErrorMessage } from "@/lib/appointment-action-plan-errors";
import { requestAppointmentPlanReview } from "@/lib/appointment-plan-review";
import { isWaitlistAppointment } from "@/lib/appointment-metadata";
import { isAppointmentDraggable } from "@/lib/appointment-drag";
import {
    SYNAPSE_PAGE_ACTION_EVENT,
    type SynapseInterfaceAction,
} from "@/lib/synapse-interface-actions";

// Generate time labels from 00:00 to 23:00
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
const HOUR_HEIGHT = 64; // px per hour row
const FLOATING_HEADER_CLEARANCE = 76;

const compactWeekday = (day: Date) =>
    format(day, "EEE", { locale: ptBR })
        .replace(".", "")
        .slice(0, 3)
        .toLocaleUpperCase("pt-BR");

interface CalendarViewProps {
    date: Date;
    onDateChange: (date: Date) => void;
    appointments: Appointment[];
    /** Coleção canônica, sem filtros visuais, usada para detectar conflitos. */
    allAppointments?: Appointment[];
    isLoading: boolean;
    view: 'daily' | 'weekly' | 'monthly';
    onViewChange?: (view: 'daily' | 'weekly' | 'monthly') => void;
    filterControl?: ReactNode;
    waitlistOpen?: boolean;
    onWaitlistOpenChange?: (open: boolean) => void;
    waitlistCount?: number;
}

interface WorkingHoursConfig {
    [key: string]: { enabled: boolean; start: string; end: string };
}

interface AvailabilityWindowConfig {
    weekday: number;
    start_time: string;
    end_time: string;
}

interface AvailabilityVersionConfig {
    effective_from: string;
    version_number: number;
    professional_availability_windows: AvailabilityWindowConfig[];
}

type AppointmentWithGhost = Appointment & { isGhost?: boolean };

const appointmentDragLabel = (appointment?: Appointment) =>
    appointment ? getAppointmentDisplayTitle(appointment) : "agendamento";

const dropTargetLabel = (id?: string | number | null) => {
    if (id === null || id === undefined) return "uma área indisponível";
    const target = new Date(String(id));
    if (Number.isNaN(target.getTime())) return "o novo horário";
    return format(target, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
};

const AGENDA_DRAG_ANNOUNCEMENTS: Announcements = {
    onDragStart({ active }) {
        return `${appointmentDragLabel(active.data.current?.app)} selecionado para reagendamento. Use as setas para escolher outro horário.`;
    },
    onDragOver({ active, over }) {
        if (!over) return `${appointmentDragLabel(active.data.current?.app)} fora de um horário disponível.`;
        return `${appointmentDragLabel(active.data.current?.app)} sobre ${dropTargetLabel(over.id)}.`;
    },
    onDragEnd({ active, over }) {
        if (!over) return `Reagendamento de ${appointmentDragLabel(active.data.current?.app)} cancelado.`;
        return `${appointmentDragLabel(active.data.current?.app)} movido para ${dropTargetLabel(over.id)}. Revise a alteração antes de confirmar.`;
    },
    onDragCancel({ active }) {
        return `Reagendamento de ${appointmentDragLabel(active.data.current?.app)} cancelado.`;
    },
};

const AGENDA_DRAG_INSTRUCTIONS: ScreenReaderInstructions = {
    draggable: "Para reagendar, pressione Espaço ou Enter. Use as setas para escolher o horário, Espaço ou Enter para revisar, e Escape para cancelar.",
};

const agendaCollisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    return pointerCollisions.length > 0
        ? pointerCollisions
        : rectIntersection(args);
};

export const CalendarView = ({
    date,
    onDateChange,
    appointments,
    allAppointments = appointments,
    isLoading,
    view,
    onViewChange,
    filterControl,
    waitlistOpen,
    onWaitlistOpenChange,
    waitlistCount = 0,
}: CalendarViewProps) => {
    const shouldReduceMotion = useReducedMotion();
    const { user } = useAuth();
    const navigate = useNavigate();
    const { isConnected: isGoogleConnected, isLoading: isLoadingGoogle } = useGoogleAuth();
    const [activeId, setActiveId] = useState<string | null>(null);
    const [overId, setOverId] = useState<string | null>(null);
    const [isPreparingReschedule, setIsPreparingReschedule] = useState(false);
    const [rescheduleConflict, setRescheduleConflict] = useState<RescheduleConflict | null>(null);
    const rescheduleInFlightRef = useRef(false);
    const dragIdempotencyRef = useRef<{ fingerprint: string; key: string } | null>(null);
    const suppressCalendarClickRef = useRef(false);
    const [newAppointmentDate, setNewAppointmentDate] = useState<Date | undefined>();
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | undefined>();
    const [isMounted, setIsMounted] = useState(false);
    const [workingHours, setWorkingHours] = useState<WorkingHoursConfig | null>(null);
    const [availabilityVersions, setAvailabilityVersions] = useState<AvailabilityVersionConfig[] | null>(null);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Load working hours from profile
    useEffect(() => {
        if (!user?.id) return;
        const loadAvailability = async () => {
            const database = supabase;
            const [profileResult, versionResult] = await Promise.all([
                database.from('profiles').select('working_hours').eq('id', user.id).single(),
                database
                    .from('professional_availability_versions')
                    .select('effective_from,version_number,professional_availability_windows(weekday,start_time,end_time)')
                    .in('status', ['active', 'scheduled'])
                    .order('effective_from', { ascending: true })
                    .order('version_number', { ascending: true }),
            ]);
            if (profileResult.data?.working_hours) setWorkingHours(profileResult.data.working_hours as WorkingHoursConfig);
            setAvailabilityVersions(Array.isArray(versionResult.data)
                ? versionResult.data as AvailabilityVersionConfig[]
                : null);
        };
        void loadAvailability();
        window.addEventListener('agenda-availability-updated', loadAvailability);
        return () => window.removeEventListener('agenda-availability-updated', loadAvailability);
    }, [user?.id]);

    const weekDays = useMemo(() => {
        const start = startOfWeek(date, { weekStartsOn: 1 });
        const end = endOfWeek(date, { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [date]);

    const monthDays = useMemo(() => {
        const start = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(date), { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [date]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 6,
            }
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 200,
                tolerance: 5
            }
        }),
        useSensor(KeyboardSensor)
    );

    const handleDragStart = (event: DragStartEvent) => {
        suppressCalendarClickRef.current = true;
        setActiveId(event.active.id as string);
    };

    const handleDragOver = (event: DragOverEvent) => {
        setOverId(event.over ? String(event.over.id) : null);
    };

    const handleDragCancel = (_event: DragCancelEvent) => {
        setActiveId(null);
        setOverId(null);
        window.setTimeout(() => {
            suppressCalendarClickRef.current = false;
        }, 0);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setOverId(null);
        window.setTimeout(() => {
            suppressCalendarClickRef.current = false;
        }, 0);

        if (!over || rescheduleInFlightRef.current) return;

        const appointmentId = active.id as string;
        const targetDate = new Date(over.id as string);
        const appointment = allAppointments.find(a => a.id === appointmentId);

        if (!appointment) return;

        const oldStart = new Date(appointment.start_time);
        const duration = new Date(appointment.end_time).getTime() - oldStart.getTime();

        const newStart = new Date(targetDate);
        if (view === "monthly") {
            newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0);
        } else {
            newStart.setMinutes(oldStart.getMinutes(), 0, 0);
        }
        const newEnd = new Date(newStart.getTime() + duration);

        if (
            newStart.getTime() === oldStart.getTime()
            && newEnd.getTime() === new Date(appointment.end_time).getTime()
        ) return;

        const now = new Date();
        if (newStart < now) {
            toast.error("Não é possível reagendar para um horário no passado.");
            return;
        }

        rescheduleInFlightRef.current = true;
        setIsPreparingReschedule(true);
        try {
            const intentFingerprint = [
                appointmentId,
                appointment.start_time,
                appointment.end_time,
                newStart.toISOString(),
                newEnd.toISOString(),
                appointment.type,
                appointment.location || "",
            ].join(":");
            if (dragIdempotencyRef.current?.fingerprint !== intentFingerprint) {
                dragIdempotencyRef.current = {
                    fingerprint: intentFingerprint,
                    key: `professional-app:drag-reschedule:${appointmentId}:${crypto.randomUUID()}`,
                };
            }
            const plan = await prepareAppointmentActionPlan("reschedule", {
                appointment_id: appointmentId,
                start_time: newStart.toISOString(),
                end_time: newEnd.toISOString(),
                type: appointment.type,
                location: appointment.location,
                communication: {
                    sendConfirmation: true,
                    provider: "configured",
                    template: "appointment_reconfirmation_required",
                    reminderPolicy: "professional_settings",
                },
            }, dragIdempotencyRef.current.key, "professional_app");

            if (plan.status !== "awaiting_confirmation" && plan.status !== "review_required") {
                throw new Error("O novo horário não está disponível para revisão.");
            }

            if (plan.status === "review_required") {
                setRescheduleConflict({
                    appointment,
                    requestedStart: newStart.toISOString(),
                    requestedEnd: newEnd.toISOString(),
                    issues: getAppointmentPlanIssues(plan),
                });
                toast.info("O horário entrou em conflito. O Synapse está buscando um encaixe próximo.");
                return;
            }

            requestAppointmentPlanReview({
                planId: plan.planId,
                planVersion: plan.planVersion,
                planHash: plan.planHash,
                originChannel: "professional_app",
            });
            toast.info("Revise o novo horário antes de concluir o reagendamento.");
        } catch (error) {
            toast.error(getAppointmentPlanErrorMessage(error, "reschedule"));
        } finally {
            rescheduleInFlightRef.current = false;
            setIsPreparingReschedule(false);
        }
    };

    const activeAppointment = useMemo(() =>
        allAppointments.find(a => a.id === activeId),
        [activeId, allAppointments]);

    // Determine if a specific hour is blocked for a given day
    const isHourBlocked = (day: Date, hour: number): boolean => {
        if (availabilityVersions?.length) {
            const slotDate = setMinutes(setHours(day, hour), 0);
            const version = [...availabilityVersions]
                .filter((item) => new Date(item.effective_from) <= slotDate)
                .sort((left, right) => {
                    const effectiveDifference = new Date(right.effective_from).getTime() - new Date(left.effective_from).getTime();
                    return effectiveDifference || right.version_number - left.version_number;
                })[0];
            if (!version) return true;
            const slotStart = hour * 60;
            const slotEnd = slotStart + 50;
            const fits = version.professional_availability_windows.some((window) => {
                if (window.weekday !== day.getDay()) return false;
                const [startHour, startMinute] = window.start_time.split(':').map(Number);
                const [endHour, endMinute] = window.end_time.split(':').map(Number);
                const startsAt = startHour * 60 + startMinute;
                const endsAt = endHour * 60 + endMinute;
                return startsAt <= slotStart && endsAt >= slotEnd;
            });
            return !fits;
        }
        if (!workingHours) return false;
        const dayId = day.getDay().toString();
        const hw = workingHours[dayId];
        if (!hw) return false;
        if (!hw.enabled) return true; // Entire day is off
        const startHour = parseInt(hw.start.split(':')[0]);
        const endHour = parseInt(hw.end.split(':')[0]);
        return hour < startHour || hour >= endHour;
    };

    const handleSlotClick = (day: Date, hour: number) => {
        const targetDate = setMinutes(setHours(day, hour), 0);
        if (targetDate < new Date()) {
            toast.error("Não é possível agendar no passado.");
            return;
        }
        setNewAppointmentDate(day);
        setSelectedTimeSlot(`${String(hour).padStart(2, '0')}:00`);
    };

    useEffect(() => {
        const handleSynapseAction = (event: Event) => {
            const action = (event as CustomEvent<SynapseInterfaceAction>).detail;
            if (action?.action !== "open_modal" || action.modal !== "new_appointment") return;

            const targetDate = action.date ? new Date(action.date) : new Date();
            onDateChange(targetDate);
            onViewChange?.("daily");
            setNewAppointmentDate(targetDate);
            setSelectedTimeSlot(action.date ? format(targetDate, "HH:mm") : undefined);
        };

        window.addEventListener(SYNAPSE_PAGE_ACTION_EVENT, handleSynapseAction);
        return () => window.removeEventListener(SYNAPSE_PAGE_ACTION_EVENT, handleSynapseAction);
    }, [onDateChange, onViewChange]);

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center bg-transparent">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground motion-reduce:animate-none" />
            </div>
        );
    }

    // ─── Render: Time-grid based view (daily / weekly) ────────────────────

    const renderTimeGridView = () => {
        const days = view === 'daily' ? [date] : weekDays;

        return (
            <div className="flex h-full min-h-0 flex-1 flex-col">
                <div className="agenda-calendar-scroll custom-scrollbar relative h-full flex-1 overflow-y-auto overscroll-contain">
                    <div aria-hidden="true" style={{ height: FLOATING_HEADER_CLEARANCE }} />
                    <div
                        className="agenda-floating-day-header pointer-events-none sticky z-30 flex shrink-0"
                        style={{ top: FLOATING_HEADER_CLEARANCE }}
                    >
                        <div className="w-16 shrink-0" />
                        {days.map(day => {
                            const isToday = isSameDay(day, new Date());
                            return (
                                <div
                                    key={day.toISOString()}
                                    className="flex min-w-0 flex-1 justify-center px-1.5 py-2"
                                >
                                    <span
                                        className={cn(
                                            "agenda-day-pill inline-flex h-8 min-w-[72px] items-center justify-center rounded-full border px-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground",
                                            isToday && "synapse-liquid-tab-active text-foreground",
                                        )}
                                        aria-label={format(day, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                                    >
                                        {compactWeekday(day)}
                                        <span className="mx-1.5 opacity-45" aria-hidden="true">·</span>
                                        <span className="tabular-nums">{format(day, "dd")}</span>
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex" style={{ minHeight: HOUR_LABELS.length * HOUR_HEIGHT }}>
                        {/* Time gutter */}
                        <div className="agenda-time-gutter relative w-16 shrink-0">
                            {HOUR_LABELS.map((label, i) => (
                                <div
                                    key={label}
                                    className="absolute w-full flex items-start justify-end pr-3"
                                    style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                                >
                                    <span className="-mt-[6px] text-[10px] font-medium tabular-nums text-muted-foreground/65">
                                        {label}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Day columns */}
                        {days.map(day => {
                            const isToday = isSameDay(day, new Date());
                            const dayId = day.toISOString();

                            return (
                                <GridDroppableColumn
                                    key={dayId}
                                    day={day}
                                    appointments={appointments}
                                    isToday={isToday}
                                    isBlocked={(hour) => isHourBlocked(day, hour)}
                                    onSlotClick={(hour) => handleSlotClick(day, hour)}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    // ─── Render: Monthly (existing card-based layout) ─────────────────────

    const renderMonthlyView = () => (
        <div className="agenda-calendar-scroll custom-scrollbar h-full min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div aria-hidden="true" style={{ height: FLOATING_HEADER_CLEARANCE }} />
            <div className={cn(
                "grid min-h-full select-none auto-rows-[minmax(132px,1fr)] gap-2.5 p-1.5",
                "grid-cols-4 sm:grid-cols-7"
            )}>
                {monthDays.map(day => (
                    <MonthDroppableColumn
                        key={day.toISOString()}
                        id={day.toISOString()}
                        day={day}
                        appointments={appointments}
                        isDraggingAny={!!activeId}
                        activeAppointment={activeAppointment}
                        isTarget={overId === day.toISOString()}
                        onAddAppointment={() => {
                            if (suppressCalendarClickRef.current) return;
                            setNewAppointmentDate(day);
                            setSelectedTimeSlot(undefined);
                        }}
                    />
                ))}
            </div>
        </div>
    );

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={agendaCollisionDetection}
            accessibility={{
                announcements: AGENDA_DRAG_ANNOUNCEMENTS,
                screenReaderInstructions: AGENDA_DRAG_INSTRUCTIONS,
                restoreFocus: true,
            }}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
            measuring={{
                droppable: {
                    strategy: MeasuringStrategy.WhileDragging,
                },
            }}
        >
            <div
                id="agenda-main-calendar"
                data-synapse-target="agenda-calendar"
                aria-busy={isPreparingReschedule}
                className="agenda-calendar-canvas relative z-10 flex h-full flex-col overflow-hidden bg-transparent px-3 pb-3 pt-3"
            >
                <header className="agenda-floating-header pointer-events-none absolute left-5 right-5 top-5 z-40 flex items-center justify-between gap-4 text-foreground">
                    <div className="agenda-command-cluster pointer-events-auto flex min-w-0 shrink items-center gap-2">
                        {filterControl}

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="agenda-floating-pill agenda-header-control agenda-tactile h-11 shrink-0 rounded-full px-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground"
                                    aria-label={`Escolher data. Atual: ${format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`}
                                >
                                    <motion.span
                                        key={date.toISOString()}
                                        initial={shouldReduceMotion ? false : { opacity: 0, y: 3 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                                    >
                                        {format(date, "dd MMM yyyy", { locale: ptBR })}
                                    </motion.span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent
                                align="start"
                                sideOffset={10}
                                className="agenda-menu-surface notification-liquid-menu w-auto rounded-[24px] border p-3"
                            >
                                <Calendar
                                    mode="single"
                                    selected={date}
                                    onSelect={(selected) => selected && onDateChange(selected)}
                                    locale={ptBR}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>

                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => navigate('/ajustes?tab=integrations')}
                            className="agenda-floating-pill agenda-header-control agenda-tactile hidden h-11 shrink-0 rounded-full px-4 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground lg:inline-flex"
                            aria-label={isGoogleConnected ? "Google conectado. Abrir integrações" : "Conectar Google Agenda"}
                        >
                            {isLoadingGoogle ? "Conectando" : isGoogleConnected ? "Conectado" : "Conectar"}
                        </Button>
                    </div>

                    <div className="agenda-command-cluster pointer-events-auto flex shrink-0 items-center gap-2">
                        <div className="agenda-floating-pill agenda-header-control agenda-period-rail flex h-11 shrink-0 items-center rounded-full p-1">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => onDateChange(view === 'monthly' ? subMonths(date, 1) : addDays(date, view === 'daily' ? -1 : -7))}
                                aria-label="Mostrar período anterior"
                                className="agenda-period-step notification-liquid-control h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>

                            {onViewChange ? (
                                <MagneticSegmentedControl
                                    id="agenda-calendar-view"
                                    indicatorId="agenda-calendar-view-indicator"
                                    value={view}
                                    onValueChange={onViewChange}
                                    ariaLabel="Visualização da agenda"
                                    behavior="single-select"
                                    options={[
                                        { value: "daily", label: "Dia" },
                                        { value: "weekly", label: "Sem" },
                                        { value: "monthly", label: "Mês" },
                                    ]}
                                    className="agenda-period-segments h-9 min-h-9 shrink-0 rounded-full bg-transparent p-0"
                                    triggerClassName="h-8 min-h-8 rounded-full px-3 py-0 text-[9px] font-semibold uppercase tracking-[0.1em]"
                                />
                            ) : null}

                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => onDateChange(view === 'monthly' ? addMonths(date, 1) : addDays(date, view === 'daily' ? 1 : 7))}
                                aria-label="Mostrar próximo período"
                                className="agenda-period-step notification-liquid-control h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>

                        {onWaitlistOpenChange ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => onWaitlistOpenChange(!waitlistOpen)}
                                aria-label={`Lista de espera${waitlistCount ? `, ${waitlistCount} pessoas ativas` : ""}`}
                                aria-pressed={waitlistOpen}
                                className={cn(
                                    "agenda-floating-pill agenda-header-control agenda-icon-control agenda-tactile relative h-11 w-11 rounded-full text-muted-foreground",
                                    waitlistOpen && "synapse-liquid-tab-active text-foreground",
                                )}
                            >
                                <UsersRound className="h-3.5 w-3.5" />
                                {waitlistCount > 0 ? (
                                    <span className="notification-unread-badge absolute -right-0.5 -top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full px-1 text-[7px] font-black leading-none">
                                        {Math.min(waitlistCount, 99)}
                                    </span>
                                ) : null}
                            </Button>
                        ) : null}

                        <AgendaSettingsModal />

                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => { setNewAppointmentDate(new Date()); setSelectedTimeSlot(undefined); }}
                            aria-label="Criar novo agendamento"
                            className="agenda-floating-pill agenda-header-control agenda-icon-control agenda-primary-action flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                </header>

                {/* Main content area */}
                <div
                    data-synapse-target="agenda-appointments"
                    className="agenda-grid-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-[26px] border"
                >
                    {view === 'monthly' ? renderMonthlyView() : renderTimeGridView()}
                </div>

                {newAppointmentDate && (
                    <NewAppointmentModal
                        initialDate={newAppointmentDate}
                        selectedTime={selectedTimeSlot}
                        onOpenChange={(isOpen) => !isOpen && setNewAppointmentDate(undefined)}
                        open={!!newAppointmentDate}
                    />
                )}

                <AppointmentRescheduleConflictDialog
                    conflict={rescheduleConflict}
                    onOpenChange={(open) => {
                        if (!open) setRescheduleConflict(null);
                    }}
                    onPlanReady={(plan) => {
                        requestAppointmentPlanReview({
                            planId: plan.planId,
                            planVersion: plan.planVersion,
                            planHash: plan.planHash,
                            originChannel: "professional_app",
                        });
                    }}
                />
            </div>

            {isMounted && createPortal(
                <DragOverlay
                    zIndex={9999}
                    dropAnimation={{
                        duration: 150,
                        easing: 'ease-out',
                        sideEffects: defaultDropAnimationSideEffects({
                            styles: {
                                active: { opacity: '0' },
                            },
                        }),
                    }}
                >
                    {activeAppointment ? (
                        <div style={{ width: '280px' }} className="cursor-grabbing">
                            <div className="scale-[1.02] rotate-0 overflow-hidden rounded-[20px] shadow-2xl transition-transform duration-200 motion-reduce:scale-100 motion-reduce:transition-none">
                                <AppointmentCard app={activeAppointment} isOverlay />
                            </div>
                        </div>
                    ) : null}
                </DragOverlay>,
                document.body
            )}
        </DndContext>
    );
};

// ─── Grid Time View Droppable Subcomponent ──────────────────────────────────

const HourDroppableSlot = ({
    id,
    hourIndex,
    blocked,
    onSlotClick
}: {
    id: string;
    hourIndex: number;
    blocked: boolean;
    onSlotClick: (hour: number) => void;
}) => {
    const { setNodeRef, isOver } = useDroppable({
        id,
        disabled: blocked,
        data: { blocked },
    });

    return (
        <button
            type="button"
            ref={setNodeRef}
            onClick={() => !blocked && onSlotClick(hourIndex)}
            className={cn(
                "agenda-grid-slot group absolute w-full border-t",
                blocked ? "cursor-not-allowed" : "cursor-pointer",
                isOver && !blocked && "z-[5]"
            )}
            data-blocked={blocked}
            data-over={isOver && !blocked}
            aria-label={blocked ? "Horário bloqueado" : `Criar agendamento às ${String(hourIndex).padStart(2, "0")}:00`}
            disabled={blocked}
            style={{ top: hourIndex * HOUR_HEIGHT, height: HOUR_HEIGHT }}
        >
            {blocked ? (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <div className="synapse-chat-glass flex items-center gap-1.5 rounded-full border px-2 py-1">
                        <Lock className="h-2.5 w-2.5 text-muted-foreground" />
                        <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">Bloqueado</span>
                    </div>
                </div>
            ) : (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-muted-foreground/35 opacity-0 transition-opacity group-hover:opacity-100 motion-reduce:transition-none">
                    <Plus className="w-4 h-4" />
                </div>
            )}
            {/* Half-hour dashed line */}
            <div className="agenda-grid-day pointer-events-none absolute w-full border-t border-dashed opacity-45" style={{ top: HOUR_HEIGHT / 2 }} />
        </button>
    );
};

const GridDroppableColumn = ({
    day,
    appointments,
    isToday,
    isBlocked,
    onSlotClick
}: {
    day: Date;
    appointments: Appointment[];
    isToday: boolean;
    isBlocked: (hour: number) => boolean;
    onSlotClick: (hour: number) => void;
}) => {
    const dayApps = useMemo(() =>
        appointments
            .filter(app => isSameDay(new Date(app.start_time), day))
            .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
        [appointments, day]);

    return (
        <div
            className={cn(
                "agenda-grid-day relative min-w-0 flex-1 border-l transition-colors",
                isToday && "agenda-grid-today"
            )}
        >
            {/* Interactive Grid Slots */}
            {HOUR_LABELS.map((_, i) => {
                const blocked = isBlocked(i);
                const targetHourDate = new Date(day);
                targetHourDate.setHours(i, 0, 0, 0);
                return (
                    <HourDroppableSlot
                        key={i}
                        id={targetHourDate.toISOString()}
                        hourIndex={i}
                        blocked={blocked}
                        onSlotClick={onSlotClick}
                    />
                );
            })}

            {/* Current time indicator */}
            {isToday && (() => {
                const now = new Date();
                const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
                const topPx = (minutesSinceMidnight / 60) * HOUR_HEIGHT;
                return (
                    <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: topPx }}>
                        <div className="flex items-center">
                            <div className="agenda-current-time-dot -ml-[5px] h-2.5 w-2.5 rounded-full" />
                            <div className="agenda-current-time-line flex-1" />
                        </div>
                    </div>
                );
            })()}

            {/* Appointment cards (Draggable in grid) */}
            {dayApps.map((app) => (
                <DraggableGridItem key={app.id} app={app} />
            ))}
        </div>
    );
};

const WaitlistOriginMark = ({ appointment, className }: { appointment: Appointment; className?: string }) => {
    if (!isWaitlistAppointment(appointment)) return null;
    return (
        <span
            role="img"
            className={cn(
                "appointment-liquid-control inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border/55 bg-muted/45 text-muted-foreground dark:bg-white/[0.035]",
                className,
            )}
            aria-label="Criado pela lista de espera inteligente"
            title="Criado pela lista de espera inteligente"
        >
            <ListPlus className="h-3 w-3" aria-hidden="true" />
        </span>
    );
};

const DraggableGridItem = ({ app }: { app: Appointment }) => {
    const draggable = isAppointmentDraggable(app);
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: app.id,
        data: { type: 'appointment', app },
        disabled: !draggable,
    });

    const appStart = new Date(app.start_time);
    const appEnd = new Date(app.end_time);
    const startMinutes = appStart.getHours() * 60 + appStart.getMinutes();
    const endMinutes = appEnd.getHours() * 60 + appEnd.getMinutes();
    const topPx = (startMinutes / 60) * HOUR_HEIGHT;
    const heightPx = Math.max(((endMinutes - startMinutes) / 60) * HOUR_HEIGHT, 28);

    return (
        <div
            ref={setNodeRef}
            data-synapse-appointment-id={app.id}
            className={cn(
                "absolute left-1 right-1 z-10",
                isDragging ? "invisible pointer-events-none opacity-0" : "visible"
            )}
            style={{ top: topPx, height: heightPx }}
        >
            <AppointmentDetailModal appointment={app}>
                <div
                    {...listeners}
                    {...attributes}
                    aria-disabled={!draggable}
                    className={cn(
                        "h-full w-full focus:outline-none",
                        draggable ? "cursor-grab touch-none active:cursor-grabbing" : "cursor-pointer",
                    )}
                    onClick={(e) => {
                        // Prevent click propagation when dragging
                        if (isDragging) e.stopPropagation();
                    }}
                >
                    <div className={cn(
                        "agenda-tactile group/card h-full w-full overflow-hidden rounded-[14px] border text-left shadow-sm hover:z-30",
                        getAppointmentStatusMeta(app.status, app.notes).bgClass,
                        getAppointmentStatusMeta(app.status, app.notes).borderClass
                    )}>
                        <div className="pointer-events-none flex flex-col gap-0.5 px-2.5 py-1.5">
                            <div className="flex items-center gap-1.5">
                                {app.type === 'online'
                                    ? <Video className="h-3 w-3 shrink-0 text-muted-foreground" />
                                    : <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                                }
                                <WaitlistOriginMark appointment={app} className="h-4 w-4" />
                                <span className="truncate text-[11px] font-bold text-foreground">
                                    {getAppointmentDisplayTitle(app)}
                                </span>
                            </div>
                            {heightPx > 36 && (
                                <span className="text-[9px] font-bold tabular-nums text-muted-foreground">
                                    {formatTimeBrazil(app.start_time)} – {formatTimeBrazil(app.end_time)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </AppointmentDetailModal>
        </div>
    );
};


// ─── Monthly sub-components (kept separate) ─────────────────────────────────

const MonthDroppableColumn = ({
    id,
    day,
    appointments,
    isDraggingAny,
    activeAppointment,
    isTarget,
    onAddAppointment
}: {
    id: string,
    day: Date,
    appointments: Appointment[],
    isDraggingAny?: boolean,
    activeAppointment?: Appointment,
    isTarget?: boolean,
    onAddAppointment?: () => void,
}) => {
    const { setNodeRef } = useDroppable({ id });

    const dayApps = useMemo(() =>
        appointments
            .filter(app => isSameDay(new Date(app.start_time), day))
            .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
        [appointments, day]);

    const isToday = isSameDay(day, new Date());

    const itemsWithGhost = useMemo<AppointmentWithGhost[]>(() => {
        if (!isTarget || !activeAppointment) return dayApps;

        const appsExceptActive = dayApps.filter(a => a.id !== activeAppointment.id);
        const activeStartTime = new Date(activeAppointment.start_time);

        const insertIndex = appsExceptActive.findIndex(a => new Date(a.start_time) > activeStartTime);

        const result: AppointmentWithGhost[] = [...appsExceptActive];
        const ghostApp: AppointmentWithGhost = { ...activeAppointment, isGhost: true };

        if (insertIndex === -1) result.push(ghostApp);
        else result.splice(insertIndex, 0, ghostApp);

        return result;
    }, [dayApps, isTarget, activeAppointment]);

    return (
        <div
          ref={setNodeRef}
          onClick={() => {
            if (!isDraggingAny) onAddAppointment?.();
          }}
          data-dragging={isDraggingAny}
          data-target={isTarget}
          className={cn(
            "agenda-month-cell group/col relative flex min-w-0 cursor-pointer flex-col gap-1 rounded-[18px] border p-1.5",
            isTarget && "z-10",
          )}
        >
            <div className="flex w-full flex-row items-center justify-between px-1 py-1">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!isDraggingAny) onAddAppointment?.();
                  }}
                  className={cn(
                    "agenda-day-pill agenda-tactile flex h-8 min-w-[70px] items-center justify-center rounded-full border px-2 text-[9px] font-black uppercase tracking-[0.1em]",
                    isToday ? "synapse-liquid-tab-active text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-label={`Adicionar agendamento em ${format(day, "dd 'de' MMMM", { locale: ptBR })}`}
                >
                    {compactWeekday(day)}
                    <span className="mx-1 opacity-45" aria-hidden="true">·</span>
                    <span className="tabular-nums">{format(day, "dd")}</span>
                </button>
                {dayApps.length > 0 && <div className="h-1 w-1 rounded-full bg-muted-foreground/60" />}
            </div>

            <div className="flex flex-col flex-1 relative gap-1 min-h-[80px]">
                <AnimatePresence mode="popLayout">
                    {itemsWithGhost.slice(0, 2).map((app) => (
                        app.isGhost ? (
                            <div key="ghost" className="scale-[0.98] opacity-40 motion-reduce:scale-100">
                                <AppointmentCard app={app} isGhost />
                            </div>
                        ) : (
                            <div key={app.id} onClick={e => e.stopPropagation()}>
                                <DraggableItem app={app} isMonthly />
                            </div>
                        )
                    ))}
                </AnimatePresence>

                {dayApps.length > 2 && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <button type="button" onClick={e => e.stopPropagation()} className="agenda-tactile notification-liquid-control min-h-11 w-full cursor-pointer rounded-lg border py-1 text-center text-[9px] font-bold text-muted-foreground hover:text-foreground">
                                +{dayApps.length - 2} mais
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="agenda-menu-surface notification-popover-surface w-[260px] rounded-[24px] border p-3" align="center" side="bottom">
                            <p className="mb-3 px-1 text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                                {format(day, "dd MMM", { locale: ptBR })} &mdash; {dayApps.length} agendamentos
                            </p>
                            <div className="space-y-1.5 max-h-[240px] overflow-y-auto custom-scrollbar">
                                {dayApps.map(app => (
                                    <AppointmentDetailModal key={app.id} appointment={app}>
                                        <button type="button" className="agenda-choice-card agenda-month-more-appointment agenda-tactile group min-h-11 w-full rounded-xl border p-2.5 text-left">
                                            <div className="flex items-center gap-2">
                                                <div className={cn(
                                                    "w-1.5 h-1.5 rounded-full shrink-0",
                                                    getAppointmentStatusMeta(app.status, app.notes).dotClass
                                                )} />
                                                <WaitlistOriginMark appointment={app} className="h-4 w-4" />
                                                <span className="truncate text-[11px] font-bold text-foreground">
                                                    {getAppointmentDisplayTitle(app)}
                                                </span>
                                                <span className="ml-auto shrink-0 text-[9px] font-bold text-muted-foreground">
                                                    {formatTimeBrazil(app.start_time)}
                                                </span>
                                            </div>
                                        </button>
                                    </AppointmentDetailModal>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>
                )}
            </div>
        </div>
    );
};

const DraggableItem = ({ app, isMonthly }: { app: Appointment, isMonthly?: boolean }) => {
    const draggable = isAppointmentDraggable(app);
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: app.id,
        data: { type: 'appointment', app },
        disabled: !draggable,
    });

    return (
        <div
            ref={setNodeRef}
            data-synapse-appointment-id={app.id}
            className={cn(
                "relative outline-none",
                isDragging ? "invisible pointer-events-none" : "visible"
            )}
        >
            <AppointmentDetailModal appointment={app}>
                <div
                    {...listeners}
                    {...attributes}
                    aria-disabled={!draggable}
                    className={cn(
                        "w-full focus:outline-none",
                        draggable ? "cursor-grab touch-none active:cursor-grabbing" : "cursor-pointer",
                    )}
                    onClick={(e) => { if (isDragging) e.stopPropagation(); }}
                >
                    <AppointmentCard app={app} isMonthly={isMonthly} />
                </div>
            </AppointmentDetailModal>
        </div>
    );
};

const AppointmentCard = ({ app, isOverlay, isMonthly, isGhost }: { app: Appointment, isOverlay?: boolean, isMonthly?: boolean, isGhost?: boolean }) => (
    <div
        className={cn(
            "agenda-appointment-card group relative overflow-hidden rounded-[20px] border",
            !isOverlay && !isGhost && "agenda-tactile",
            isOverlay && "border-none shadow-none z-50 pointer-events-none",
            isGhost && "border-dashed opacity-55 shadow-none",
            isMonthly ? "rounded-xl border-none p-1.5" : "p-4",
        )}
    >
        {!isMonthly && (
            <div className={cn(
                "absolute right-4 top-4 h-1.5 w-1.5 rounded-full",
                getAppointmentStatusMeta(app.status, app.notes).dotClass
            )} />
        )}

        <div className="flex flex-col gap-2">
            {!isMonthly && (
                <div className="mb-1 flex items-center gap-1.5">
                    <div className="notification-liquid-icon flex h-8 w-8 items-center justify-center rounded-full border">
                        {app.type === 'online' ? <Video className="h-3.5 w-3.5 text-muted-foreground" /> : <MapPin className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                    <WaitlistOriginMark appointment={app} />
                </div>
            )}

            <div className={cn("space-y-0.5", isMonthly && "flex items-center gap-1.5")}>
                {isMonthly ? <WaitlistOriginMark appointment={app} className="h-4 w-4" /> : null}
                <h4 className={cn("line-clamp-1 font-medium leading-tight tracking-tight text-foreground", isMonthly ? "text-[10px]" : "text-[13px] font-bold")}>
                    {getAppointmentDisplayTitle(app)}
                </h4>
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {!isMonthly && <Clock className="h-3 w-3" />}
                    {formatTimeBrazil(app.start_time)}
                </div>
            </div>
        </div>

        {!isOverlay && !isGhost && (
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/[0.025] to-transparent opacity-0 transition-opacity group-hover:opacity-100 dark:from-white/[0.018]" />
        )}
    </div>
);
