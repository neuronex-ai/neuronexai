"use client";

import { useState, useMemo, useEffect } from "react";
import { CalendarView } from "@/components/agenda/CalendarView";
import {
    AgendaFiltersPopover,
    EMPTY_AGENDA_FILTERS,
    type AgendaFilters,
} from "@/components/agenda/AgendaFiltersPopover";
import { useAppointments } from "@/hooks/use-appointments";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLocation, useSearchParams } from "react-router-dom";
import { useAgendaRealtime } from "@/hooks/use-agenda-realtime";
import { matchesAgendaFilters } from "@/lib/agenda-filters";
import { AppointmentDetailModal } from "@/components/agenda/AppointmentDetailModal";
import { ProfessionalWaitlistPanel } from "@/components/agenda/ProfessionalWaitlistPanel";
import { useProfessionalWaitlist } from "@/hooks/use-professional-waitlist";
import {
    SYNAPSE_PAGE_ACTION_EVENT,
    type SynapseInterfaceAction,
} from "@/lib/synapse-interface-actions";

export default function DesktopAgenda() {
    useAgendaRealtime();
    const shouldReduceMotion = useReducedMotion();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const [waitlistOpen, setWaitlistOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [view, setView] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
    const [filters, setFilters] = useState<AgendaFilters>(EMPTY_AGENDA_FILTERS);
    const [openedAppointmentId, setOpenedAppointmentId] = useState<string | null>(null);

    const { data: appointments = [], isLoading } = useAppointments({ includeCancelled: true });
    const { data: waitlistEntries = [] } = useProfessionalWaitlist();
    const activeWaitlistCount = waitlistEntries.filter((entry) => entry.status === "active" || entry.status === "offered").length;

    useEffect(() => {
        const stateAppointmentId = location.state?.openAppointmentId;
        const queryAppointmentId = searchParams.get("appointmentId");
        const targetId = stateAppointmentId || queryAppointmentId;

        if (targetId) setOpenedAppointmentId(targetId);
        if (["daily", "weekly", "monthly"].includes(location.state?.synapseView)) {
            setView(location.state.synapseView);
        }
        if (location.state?.synapseDate) setSelectedDate(new Date(location.state.synapseDate));
    }, [location.state, searchParams]);

    const openedAppointment = useMemo(
        () => appointments.find((appointment) => appointment.id === openedAppointmentId),
        [appointments, openedAppointmentId]
    );

    useEffect(() => {
        if (openedAppointment) {
            setSelectedDate(new Date(openedAppointment.start_time));
            setView("daily");
        }
    }, [openedAppointment]);

    useEffect(() => {
        const handleSynapseAction = (event: Event) => {
            const action = (event as CustomEvent<SynapseInterfaceAction>).detail;
            if (!action) return;

            if (action.action === "open_daily_schedule") {
                setView(action.agendaView || "daily");
                if (action.date) setSelectedDate(new Date(action.date));
            }

            if (action.action === "scroll_to_appointment" && action.appointmentId) {
                const appointment = appointments.find((item) => item.id === action.appointmentId);
                if (appointment) {
                    setSelectedDate(new Date(appointment.start_time));
                    setView("daily");
                    setOpenedAppointmentId(appointment.id);
                }
            }

            if (action.action === "highlight_element" && action.element === "daily_schedule") {
                const target = document.querySelector("[data-synapse-target='daily-schedule']");
                target?.classList.add("synapse-interface-highlight");
                window.setTimeout(() => target?.classList.remove("synapse-interface-highlight"), 4200);
            }
        };

        window.addEventListener(SYNAPSE_PAGE_ACTION_EVENT, handleSynapseAction);
        return () => window.removeEventListener(SYNAPSE_PAGE_ACTION_EVENT, handleSynapseAction);
    }, [appointments]);

    useEffect(() => {
        if (!waitlistOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setWaitlistOpen(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [waitlistOpen]);

    const closeOpenedAppointment = () => {
        setOpenedAppointmentId(null);
        if (searchParams.has("appointmentId")) {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete("appointmentId");
            setSearchParams(nextParams, { replace: true });
        }
        if (location.state?.openAppointmentId) {
            window.history.replaceState({}, document.title, window.location.href);
        }
    };

    const filteredAppointments = useMemo(() => {
        return appointments.filter((appointment) => matchesAgendaFilters(appointment, filters));
    }, [appointments, filters]);

    return (
        <div className="desktop-lumen-page desktop-content-offset relative flex h-dvh w-full flex-col overflow-hidden bg-transparent pb-4 font-sans text-foreground selection:bg-primary/10 selection:text-primary">
            <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-[2200px] flex-1 px-4 md:px-6 lg:px-8 xl:px-10">
                <div className="agenda-desktop-shell agenda-liquid-surface desktop-retina-frame relative flex min-h-0 flex-1 overflow-hidden rounded-[38px] border p-2 md:p-3">
                <AnimatePresence>
                    {waitlistOpen ? (
                        <>
                            <motion.button
                                key="agenda-waitlist-dismiss"
                                type="button"
                                aria-label="Fechar lista de espera"
                                initial={shouldReduceMotion ? false : { opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16 }}
                                onClick={() => setWaitlistOpen(false)}
                                className="absolute inset-0 z-30 cursor-default bg-foreground/[0.018] backdrop-blur-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-background/20"
                            />
                            <motion.aside
                                key="agenda-waitlist"
                                initial={shouldReduceMotion ? false : { opacity: 0, x: 20, scale: 0.985 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 20, scale: 0.985 }}
                                transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 36, mass: 0.8 }}
                                className="absolute inset-y-3 right-3 z-40 flex min-h-0 w-[min(420px,calc(100%_-_24px))] flex-col overflow-visible"
                            >
                                <ProfessionalWaitlistPanel onClose={() => setWaitlistOpen(false)} />
                            </motion.aside>
                        </>
                    ) : (
                        <motion.button
                            key="agenda-waitlist-edge"
                            type="button"
                            onMouseEnter={() => setWaitlistOpen(true)}
                            onFocus={() => setWaitlistOpen(true)}
                            onClick={() => setWaitlistOpen(true)}
                            className="agenda-edge-trigger absolute inset-y-[18%] right-0 z-20 w-2 rounded-l-full opacity-45 hover:w-3 hover:opacity-100 focus-visible:w-3 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={`Abrir lista de espera${activeWaitlistCount ? `, ${activeWaitlistCount} pessoas ativas` : ""}`}
                        />
                    )}
                </AnimatePresence>

                <main className="relative z-10 flex h-full min-w-0 flex-1 flex-col" data-synapse-target="daily-schedule">
                    <div className="agenda-liquid-surface relative min-h-0 flex-1 overflow-hidden rounded-[32px] border">
                        <CalendarView
                            date={selectedDate}
                            onDateChange={setSelectedDate}
                            appointments={filteredAppointments}
                            allAppointments={appointments}
                            isLoading={isLoading}
                            view={view}
                            onViewChange={setView}
                            filterControl={(
                                <AgendaFiltersPopover
                                    appointments={appointments}
                                    filters={filters}
                                    onFiltersChange={setFilters}
                                />
                            )}
                            waitlistOpen={waitlistOpen}
                            onWaitlistOpenChange={(open) => {
                                setWaitlistOpen(open);
                            }}
                            waitlistCount={activeWaitlistCount}
                        />
                    </div>
                </main>
                </div>
            </div>
            {openedAppointment && (
                <AppointmentDetailModal
                    appointment={openedAppointment}
                    open={!!openedAppointment}
                    onOpenChange={(open) => {
                        if (!open) closeOpenedAppointment();
                    }}
                />
            )}
        </div>
    );
}
