"use client";

import { Appointment } from "@/types";
import { format, addDays, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval, setHours, setMinutes, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatTimeBrazil } from "@/lib/timezone";
import { Loader2, Clock, Video, MapPin, ChevronLeft, ChevronRight, Lock, Plus, PanelLeftClose, PanelLeftOpen, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MagneticSegmentedControl } from "@/components/ui/magnetic-segmented-control";
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
    DragOverlay,
    DragStartEvent,
    defaultDropAnimationSideEffects,
    MeasuringStrategy,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppointments } from "@/hooks/use-appointments";
import { useState, useMemo, useEffect } from "react";
import { NewAppointmentModal } from "./NewAppointmentModal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createPortal } from "react-dom";
import { useAuth } from "@/components/auth/SessionContextProvider";
import { useNavigate } from "react-router-dom";
import { useGoogleAuth } from "@/hooks/use-google-auth";
import { getAppointmentStatusMeta, isCancelledAppointmentStatus } from "@/lib/appointment-status";
import { getAppointmentDisplayTitle } from "@/lib/appointment-utils";
import { useUpdateAppointment } from "@/hooks/use-update-appointment";
import {
    SYNAPSE_PAGE_ACTION_EVENT,
    type SynapseInterfaceAction,
} from "@/lib/synapse-interface-actions";

// Generate time labels from 00:00 to 23:00
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
const HOUR_HEIGHT = 64; // px per hour row

interface CalendarViewProps {
    date: Date;
    onDateChange: (date: Date) => void;
    appointments: Appointment[];
    isLoading: boolean;
    view: 'daily' | 'weekly' | 'monthly';
    onViewChange?: (view: 'daily' | 'weekly' | 'monthly') => void;
    sidebarOpen?: boolean;
    setSidebarOpen?: (open: boolean) => void;
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

export const CalendarView = ({ date, onDateChange, appointments, isLoading, view, onViewChange, sidebarOpen, setSidebarOpen, waitlistOpen, onWaitlistOpenChange, waitlistCount = 0 }: CalendarViewProps) => {
    const shouldReduceMotion = useReducedMotion();
    const { user } = useAuth();
    const navigate = useNavigate();
    const { isConnected: isGoogleConnected, isLoading: isLoadingGoogle } = useGoogleAuth();
    const { refetch } = useAppointments();
    const updateAppointment = useUpdateAppointment();
    const [activeId, setActiveId] = useState<string | null>(null);
    const [overId, setOverId] = useState<string | null>(null);
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
                distance: 2,
            }
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 200,
                tolerance: 5
            }
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragOver = (event: DragOverEvent) => {
        setOverId(event.over ? String(event.over.id) : null);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setOverId(null);

        if (!over) return;

        const appointmentId = active.id as string;
        const targetDate = new Date(over.id as string);
        const appointment = appointments.find(a => a.id === appointmentId);

        if (!appointment) return;

        const oldStart = new Date(appointment.start_time);
        const duration = new Date(appointment.end_time).getTime() - oldStart.getTime();

        const newStart = new Date(targetDate);
        newStart.setMinutes(oldStart.getMinutes());
        const newEnd = new Date(newStart.getTime() + duration);

        const now = new Date();
        if (newStart < now) {
            toast.error("Não é possível reagendar para um horário no passado.");
            return;
        }

        const hasConflict = appointments.some(app => {
            if (app.id === appointment.id) return false;
            if (isCancelledAppointmentStatus(app.status, app.notes)) return false;
            const appStart = new Date(app.start_time);
            const appEnd = new Date(app.end_time);
            return newStart < appEnd && newEnd > appStart;
        });

        if (hasConflict) {
            toast.error("Conflito de agenda no novo horário");
            return;
        }

        try {
            await updateAppointment.mutateAsync({
                id: appointmentId,
                updates: {
                    start_time: newStart.toISOString(),
                    end_time: newEnd.toISOString()
                }
            });
            toast.success("Agendamento reagendado");
            refetch();
        } catch (err) {
            toast.error("Falha ao mover agendamento");
        }
    };

    const activeAppointment = useMemo(() =>
        appointments.find(a => a.id === activeId),
        [activeId, appointments]);

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
                <Loader2 className="h-10 w-10 text-zinc-300 dark:text-white/20 animate-spin" />
            </div>
        );
    }

    // ─── Render: Time-grid based view (daily / weekly) ────────────────────

    const renderTimeGridView = () => {
        const days = view === 'daily' ? [date] : weekDays;

        return (
            <div className="flex h-full min-h-0 flex-1 flex-col">
                {/* Day Headers */}
                <div className="flex shrink-0 border-b border-zinc-200/70 bg-white/64 backdrop-blur-xl dark:border-white/[0.048] dark:bg-white/[0.018]">
                    {/* Time gutter header */}
                    <div className="w-16 shrink-0" />
                    {/* Day columns headers */}
                    {days.map(day => {
                        const isToday = isSameDay(day, new Date());
                        return (
                            <div
                                key={day.toISOString()}
                                className={cn(
                                    "min-w-0 flex-1 border-l border-zinc-100/80 py-3.5 text-center dark:border-white/[0.032]",
                                    isToday && "bg-zinc-100/62 dark:bg-white/[0.024]"
                                )}
                            >
                                <span className={cn(
                                    "mb-1 block text-[9px] font-black uppercase tracking-[0.22em]",
                                    isToday ? "text-zinc-900 dark:text-white" : "text-zinc-400 dark:text-zinc-500"
                                )}>
                                    {format(day, "EEE", { locale: ptBR })}
                                </span>
                                <span className={cn(
                                    "text-xl font-black tracking-[-0.045em]",
                                    isToday ? "text-zinc-900 dark:text-white" : "text-zinc-400 dark:text-zinc-400"
                                )}>
                                    {format(day, "dd")}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Time grid body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar relative h-full">
                    <div className="flex" style={{ minHeight: HOUR_LABELS.length * HOUR_HEIGHT }}>
                        {/* Time gutter */}
                        <div className="relative w-16 shrink-0 bg-white/38 dark:bg-black/[0.08]">
                            {HOUR_LABELS.map((label, i) => (
                                <div
                                    key={label}
                                    className="absolute w-full flex items-start justify-end pr-3"
                                    style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                                >
                                    <span className="-mt-[6px] text-[10px] font-bold tabular-nums text-zinc-400 dark:text-white/24">
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
        <div className={cn(
            "grid h-full min-h-0 flex-1 select-none gap-4",
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
                        setNewAppointmentDate(day);
                        setSelectedTimeSlot(undefined);
                    }}
                />
            ))}
        </div>
    );

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            measuring={{
                droppable: {
                    strategy: MeasuringStrategy.WhileDragging,
                },
            }}
        >
            <div
                id="agenda-main-calendar"
                data-synapse-target="agenda-calendar"
                className="relative z-10 flex h-full flex-col overflow-hidden bg-transparent px-3 pb-3 pt-3"
            >
                <header className="desktop-retina-panel relative mb-3 flex shrink-0 flex-col justify-between gap-4 overflow-hidden rounded-[26px] border border-border/50 bg-card/82 p-3 text-foreground xl:flex-row xl:items-center">
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(150deg,hsl(var(--foreground)/0.024),transparent_38%,hsl(var(--foreground)/0.006))] dark:bg-[linear-gradient(150deg,rgba(255,255,255,0.018),transparent_42%,rgba(255,255,255,0.004))]" />
                    {/* Left side: Sidebar Toggle, Title/Date, Google Status */}
                    <div className="relative z-10 flex flex-wrap items-center gap-4">
                        {setSidebarOpen && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                                aria-label={sidebarOpen ? "Ocultar painel da agenda" : "Mostrar painel da agenda"}
                                className="desktop-retina-interactive hidden h-11 w-11 rounded-full border border-border/55 bg-background/70 text-muted-foreground hover:border-border hover:bg-background hover:text-foreground xl:flex"
                            >
                                {sidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
                            </Button>
                        )}

                        <div className="flex items-baseline gap-4">
                            <motion.div
                                key={`${view}-${date.toISOString()}`}
                                initial={shouldReduceMotion ? false : { opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
                            >
                                <span className="text-4xl font-black leading-none tracking-[-0.065em] text-foreground xl:text-[2.65rem]">
                                    {format(date, "dd")} <span className="font-black lowercase text-muted-foreground">{format(date, "MMMM", { locale: ptBR })}</span> <span className="ml-1 text-2xl font-black text-muted-foreground/55">{format(date, "yyyy")}</span>
                                </span>
                            </motion.div>
                        </div>

                        {/* Google Connected Badge Moved Here */}
                        <div className="ml-2 hidden sm:block">
                            {isLoadingGoogle ? (
                                <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
                            ) : isGoogleConnected ? (
                                <div className="desktop-retina-inset flex cursor-default items-center gap-2 rounded-full border border-border/50 bg-background/64 px-2.5 py-1">
                                    <div className="relative flex h-1.5 w-1.5">
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                                    </div>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Conectado</span>
                                </div>
                            ) : (
                                <Button
                                    onClick={() => navigate('/ajustes?tab=integrations')}
                                    className="desktop-retina-interactive h-7 rounded-full bg-foreground px-3 text-[9px] font-black uppercase tracking-widest text-background hover:bg-foreground/88"
                                >
                                    Conectar
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Right side: Compact Actions Panel */}
                    <div className="relative z-10 flex flex-wrap items-center gap-3">

                        {/* View Switcher Controls */}
                        {onViewChange && (
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
                                className="desktop-retina-inset h-12 min-h-12 shrink-0 rounded-full border-border/50 bg-muted/36"
                                triggerClassName="h-11 min-h-11 rounded-full px-4 py-0 text-[10px] font-black uppercase tracking-wider"
                            />
                        )}

                        <div className="hidden h-6 w-px bg-border/65 sm:block" />

                        {/* Navigation Controls */}
                        <div className="flex items-center gap-1.5">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onDateChange(view === 'monthly' ? subMonths(date, 1) : addDays(date, view === 'daily' ? -1 : -7))}
                                aria-label="Mostrar período anterior"
                                className="desktop-retina-interactive h-11 w-11 rounded-full border border-border/50 bg-background/70 text-muted-foreground hover:border-border hover:bg-background hover:text-foreground"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => onDateChange(new Date())}
                                className="desktop-retina-interactive h-11 rounded-full border border-border/50 bg-background/70 px-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:border-border hover:bg-background hover:text-foreground"
                            >
                                Hoje
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onDateChange(view === 'monthly' ? addMonths(date, 1) : addDays(date, view === 'daily' ? 1 : 7))}
                                aria-label="Mostrar próximo período"
                                className="desktop-retina-interactive h-11 w-11 rounded-full border border-border/50 bg-background/70 text-muted-foreground hover:border-border hover:bg-background hover:text-foreground"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="mx-1 hidden h-6 w-px bg-border/65 sm:block" />

                        {/* Settings Button */}
                        <AgendaSettingsModal />

                        {onWaitlistOpenChange ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => onWaitlistOpenChange(!waitlistOpen)}
                                aria-label={`Lista de espera${waitlistCount ? `, ${waitlistCount} pessoas ativas` : ""}`}
                                aria-pressed={waitlistOpen}
                                className={cn(
                                    "notification-liquid-control relative h-11 w-11 rounded-full border border-border/50 bg-background/70 text-muted-foreground",
                                    waitlistOpen && "notification-liquid-tab-active text-foreground",
                                )}
                            >
                                <UsersRound className="h-4 w-4" />
                                {waitlistCount > 0 ? (
                                    <span className="notification-unread-badge absolute -right-0.5 -top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full px-1 text-[7px] font-black leading-none">
                                        {Math.min(waitlistCount, 99)}
                                    </span>
                                ) : null}
                            </Button>
                        ) : null}

                        {/* New Appointment Add Button */}
                        <Button
                            size="icon"
                            onClick={() => { setNewAppointmentDate(new Date()); setSelectedTimeSlot(undefined); }}
                            aria-label="Criar novo agendamento"
                            className="desktop-retina-interactive flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-foreground font-bold uppercase tracking-[0.1em] text-background hover:bg-foreground/88"
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                </header>

                {/* Main content area */}
                <div
                    data-synapse-target="agenda-appointments"
                    className="desktop-retina-inset flex min-h-0 flex-1 flex-col overflow-y-auto rounded-[24px] border border-border/45 bg-background/66"
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
                            <div className="scale-[1.02] rotate-0 shadow-2xl transition-transform duration-200 rounded-[20px] overflow-hidden">
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
    const { setNodeRef, isOver } = useDroppable({ id });

    return (
        <div
            ref={setNodeRef}
            onClick={() => !blocked && onSlotClick(hourIndex)}
            className={cn(
                "group absolute w-full border-t border-zinc-100/80 transition-colors dark:border-white/[0.028]",
                blocked ? "cursor-not-allowed bg-zinc-100/70 dark:bg-white/[0.018]" : "cursor-pointer hover:bg-zinc-100/45 dark:hover:bg-white/[0.025]",
                isOver && !blocked && "z-[5] bg-zinc-950/[0.08] dark:bg-white/[0.08]"
            )}
            style={{ top: hourIndex * HOUR_HEIGHT, height: HOUR_HEIGHT }}
        >
            {blocked ? (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white/90 px-2 py-1 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.055]">
                        <Lock className="w-2.5 h-2.5 text-zinc-400 dark:text-zinc-500" />
                        <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Bloqueado</span>
                    </div>
                </div>
            ) : (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-white/22">
                    <Plus className="w-4 h-4" />
                </div>
            )}
            {/* Half-hour dashed line */}
            <div className="pointer-events-none absolute w-full border-t border-dashed border-zinc-100/70 dark:border-white/[0.018]" style={{ top: HOUR_HEIGHT / 2 }} />
        </div>
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
                "relative min-w-0 flex-1 border-l border-zinc-100/80 transition-colors dark:border-white/[0.032]",
                isToday && "bg-zinc-50/55 dark:bg-white/[0.018]"
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
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] -ml-[5px]" />
                            <div className="flex-1 h-[2px] bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.3)]" />
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

const DraggableGridItem = ({ app }: { app: Appointment }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: app.id,
        data: { type: 'appointment', app }
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
                    className="w-full h-full cursor-grab active:cursor-grabbing focus:outline-none touch-none"
                    onClick={(e) => {
                        // Prevent click propagation when dragging
                        if (isDragging) e.stopPropagation();
                    }}
                >
                    <div className={cn(
                        "group/card h-full w-full overflow-hidden rounded-[14px] border text-left shadow-sm transition-all duration-200 hover:z-30 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.995] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100",
                        getAppointmentStatusMeta(app.status, app.notes).bgClass,
                        getAppointmentStatusMeta(app.status, app.notes).borderClass
                    )}>
                        <div className="pointer-events-none flex flex-col gap-0.5 px-2.5 py-1.5">
                            <div className="flex items-center gap-1.5">
                                {app.type === 'online'
                                    ? <Video className="h-3 w-3 shrink-0 text-zinc-500 dark:text-zinc-400" />
                                    : <MapPin className="h-3 w-3 shrink-0 text-zinc-500 dark:text-zinc-400" />
                                }
                                <span className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                    {getAppointmentDisplayTitle(app)}
                                </span>
                            </div>
                            {heightPx > 36 && (
                                <span className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 tabular-nums">
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
        <div ref={setNodeRef} onClick={onAddAppointment} className={cn(
            "group/col relative flex min-w-0 cursor-pointer flex-col transition-all duration-300",
            "gap-1 rounded-[18px] border border-zinc-200/70 bg-white p-1.5 shadow-sm hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-md dark:border-white/[0.07] dark:bg-white/[0.035] dark:hover:border-white/14 dark:hover:bg-white/[0.055] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
            isDraggingAny && "bg-zinc-500/[0.02] dark:bg-white/[0.01]",
            isTarget && "z-10 bg-white/[0.9] ring-1 ring-zinc-300 dark:bg-white/[0.065] dark:ring-white/14"
        )}>
            <div className="flex-row justify-between w-full px-2 py-1 flex items-center">
                <span className={cn(
                    "text-[10px] font-medium",
                    isToday ? "rounded-md bg-zinc-950 px-1.5 py-0.5 text-white dark:bg-white dark:text-zinc-950" : "text-zinc-500 dark:text-white/36"
                )}>
                    {format(day, "dd")}
                </span>
                {dayApps.length > 0 && <div className="w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-600" />}
            </div>

            <div className="flex flex-col flex-1 relative gap-1 min-h-[80px]">
                <AnimatePresence mode="popLayout">
                    {itemsWithGhost.slice(0, 2).map((app) => (
                        app.isGhost ? (
                            <div key="ghost" className="opacity-40 scale-[0.98]">
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
                            <button onClick={e => e.stopPropagation()} className="w-full cursor-pointer rounded-lg border border-zinc-200/70 bg-zinc-100/80 py-1 text-center text-[9px] font-bold text-zinc-400 transition-all hover:bg-zinc-200 hover:text-zinc-700 dark:border-white/[0.06] dark:bg-white/[0.045] dark:text-white/38 dark:hover:bg-white/[0.08] dark:hover:text-white/72">
                                +{dayApps.length - 2} mais
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[260px] rounded-[24px] border border-zinc-200 bg-white p-3 shadow-2xl backdrop-blur-3xl dark:border-white/10 dark:bg-zinc-950" align="center" side="bottom">
                            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-500 mb-3 px-1">
                                {format(day, "dd MMM", { locale: ptBR })} &mdash; {dayApps.length} agendamentos
                            </p>
                            <div className="space-y-1.5 max-h-[240px] overflow-y-auto custom-scrollbar">
                                {dayApps.map(app => (
                                    <AppointmentDetailModal key={app.id} appointment={app}>
                                        <button className="group w-full rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 text-left transition-all hover:border-zinc-300 hover:bg-zinc-100 dark:border-white/[0.07] dark:bg-white/[0.035] dark:hover:border-white/14 dark:hover:bg-white/[0.06]">
                                            <div className="flex items-center gap-2">
                                                <div className={cn(
                                                    "w-1.5 h-1.5 rounded-full shrink-0",
                                                    getAppointmentStatusMeta(app.status, app.notes).dotClass
                                                )} />
                                                <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 truncate group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                                                    {getAppointmentDisplayTitle(app)}
                                                </span>
                                                <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-600 ml-auto shrink-0">
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
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: app.id,
        data: { type: 'appointment', app }
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
                    className="w-full cursor-grab active:cursor-grabbing focus:outline-none touch-none"
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
            "group relative overflow-hidden rounded-[20px] border border-zinc-200 bg-white shadow-sm dark:border-white/[0.07] dark:bg-white/[0.04]",
            !isOverlay && !isGhost && "transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg active:scale-[0.99] dark:hover:border-white/14 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100",
            isOverlay && "border-none shadow-none z-50 pointer-events-none",
            isGhost && "border-dashed border-zinc-300 dark:border-white/20 bg-zinc-100/50 dark:bg-white/[0.03] shadow-none",
            isMonthly ? "rounded-xl border-none bg-zinc-100/90 p-1.5 dark:bg-white/[0.045]" : "p-4"
        )}
    >
        {!isMonthly && (
            <div className={cn(
                "absolute top-4 right-4 w-1.5 h-1.5 rounded-full transition-all duration-500",
                getAppointmentStatusMeta(app.status, app.notes).dotClass
            )} />
        )}

        <div className="flex flex-col gap-2">
            {!isMonthly && (
                <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 transition-colors group-hover:bg-zinc-200 dark:border-white/[0.07] dark:bg-white/[0.035] dark:group-hover:bg-white/[0.08]">
                    {app.type === 'online' ? <Video className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors" /> : <MapPin className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors" />}
                </div>
            )}

            <div className={cn("space-y-0.5", isMonthly && "flex items-center gap-1.5")}>
                <h4 className={cn("font-medium tracking-tight leading-tight line-clamp-1 text-zinc-900 dark:text-white", isMonthly ? "text-[10px]" : "text-[13px] font-bold")}>
                    {getAppointmentDisplayTitle(app)}
                </h4>
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
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
