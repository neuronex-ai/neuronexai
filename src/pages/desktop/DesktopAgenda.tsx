"use client";

import { useState, useMemo, useEffect } from "react";
import { Sidebar } from "@/components/agenda/Sidebar";
import { CalendarView } from "@/components/agenda/CalendarView";
import { useAppointments } from "@/hooks/use-appointments";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLocation, useSearchParams } from "react-router-dom";
import { useAgendaRealtime } from "@/hooks/use-agenda-realtime";
import { isCancelledAppointmentStatus } from "@/lib/appointment-status";
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
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [waitlistOpen, setWaitlistOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [view, setView] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [openedAppointmentId, setOpenedAppointmentId] = useState<string | null>(null);

    const { data: appointments = [], isLoading } = useAppointments();
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
        if (!sidebarOpen && !waitlistOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setSidebarOpen(false);
                setWaitlistOpen(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [sidebarOpen, waitlistOpen]);

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
        return appointments.filter(app => {
            if (isCancelledAppointmentStatus(app.status, app.notes)) return false;
            const matchesSearch = (app.patient_name || "").toLowerCase().includes(searchQuery.toLowerCase());
            const matchesTag = !selectedTag ||
                (selectedTag === 'Online' && app.type === 'online') ||
                (selectedTag === 'Presencial' && app.type === 'presencial') ||
                (selectedTag === 'Primeira Vez' && app.notes?.toLowerCase().includes('primeira'));
            return matchesSearch && matchesTag;
        });
    }, [appointments, searchQuery, selectedTag]);

    return (
        <div className="desktop-lumen-page desktop-content-offset relative flex h-dvh w-full flex-col overflow-hidden bg-transparent pb-4 font-sans text-foreground selection:bg-primary/10 selection:text-primary">
            <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-[2200px] flex-1 px-4 md:px-6 lg:px-8 xl:px-10">
                <div className="agenda-desktop-shell desktop-retina-frame relative flex min-h-0 flex-1 overflow-hidden rounded-[38px] border border-border/45 bg-card/44 p-2 md:p-3">
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(155deg,hsl(var(--foreground)/0.018),transparent_40%,hsl(var(--foreground)/0.006))] dark:bg-[linear-gradient(155deg,rgba(255,255,255,0.018),transparent_42%,rgba(255,255,255,0.004))]" />
                <AnimatePresence>
                    {sidebarOpen && (
                        <>
                            <motion.button
                                key="agenda-sidebar-dismiss"
                                type="button"
                                aria-label="Fechar painel da agenda"
                                initial={shouldReduceMotion ? false : { opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16 }}
                                onClick={() => setSidebarOpen(false)}
                                className="absolute inset-0 z-30 hidden cursor-default bg-zinc-950/[0.018] backdrop-blur-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20 dark:bg-black/20 dark:focus-visible:ring-white/25 xl:block"
                            />
                            <motion.aside
                                key="sidebar"
                                initial={shouldReduceMotion ? false : { opacity: 0, x: -18, scale: 0.985 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -18, scale: 0.985 }}
                                transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 36, mass: 0.8 }}
                                className="absolute inset-y-3 left-3 z-40 hidden min-h-0 w-[324px] flex-col overflow-hidden xl:flex"
                            >
                                <div className="desktop-retina-panel relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[32px] border border-border/55 bg-card/94 p-2 backdrop-blur-2xl">
                                    <div className="pointer-events-none absolute inset-0 rounded-[32px] bg-[linear-gradient(150deg,hsl(var(--foreground)/0.025),transparent_38%)] dark:bg-[linear-gradient(150deg,rgba(255,255,255,0.02),transparent_42%)]" />
                                    <div className="relative z-10 flex h-full min-h-0 flex-col">
                                        <Sidebar
                                            selectedDate={selectedDate}
                                            onDateChange={setSelectedDate}
                                            appointments={appointments}
                                            searchQuery={searchQuery}
                                            onSearchChange={setSearchQuery}
                                            selectedTag={selectedTag}
                                            onTagChange={setSelectedTag}
                                            onClose={() => setSidebarOpen(false)}
                                        />
                                    </div>
                                </div>
                            </motion.aside>
                        </>
                    )}
                </AnimatePresence>

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
                                className="absolute inset-0 z-30 cursor-default bg-zinc-950/[0.018] backdrop-blur-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-black/20"
                            />
                            <motion.aside
                                key="agenda-waitlist"
                                initial={shouldReduceMotion ? false : { opacity: 0, x: 20, scale: 0.985 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 20, scale: 0.985 }}
                                transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 36, mass: 0.8 }}
                                className="absolute inset-y-3 right-3 z-40 flex min-h-0 w-[min(420px,calc(100%_-_24px))] flex-col overflow-hidden"
                            >
                                <ProfessionalWaitlistPanel onClose={() => setWaitlistOpen(false)} />
                            </motion.aside>
                        </>
                    ) : (
                        <motion.button
                            key="agenda-waitlist-edge"
                            type="button"
                            onMouseEnter={() => { setSidebarOpen(false); setWaitlistOpen(true); }}
                            onFocus={() => { setSidebarOpen(false); setWaitlistOpen(true); }}
                            onClick={() => { setSidebarOpen(false); setWaitlistOpen(true); }}
                            className="absolute inset-y-[18%] right-0 z-20 w-2 rounded-l-full bg-foreground/[0.055] opacity-35 transition-[width,opacity] hover:w-3 hover:opacity-100 focus-visible:w-3 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={`Abrir lista de espera${activeWaitlistCount ? `, ${activeWaitlistCount} pessoas ativas` : ""}`}
                        />
                    )}
                </AnimatePresence>

                <main className="relative z-10 flex h-full min-w-0 flex-1 flex-col" data-synapse-target="daily-schedule">
                    <div className="desktop-retina-panel relative min-h-0 flex-1 overflow-hidden rounded-[32px] border border-border/50 bg-card/82">
                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(155deg,hsl(var(--foreground)/0.014),transparent_38%)] dark:bg-[linear-gradient(155deg,rgba(255,255,255,0.012),transparent_42%)]" />
                        <CalendarView
                            date={selectedDate}
                            onDateChange={setSelectedDate}
                            appointments={filteredAppointments}
                            isLoading={isLoading}
                            view={view}
                            onViewChange={setView}
                            sidebarOpen={sidebarOpen}
                            setSidebarOpen={(open) => {
                                if (open) setWaitlistOpen(false);
                                setSidebarOpen(open);
                            }}
                            waitlistOpen={waitlistOpen}
                            onWaitlistOpenChange={(open) => {
                                if (open) setSidebarOpen(false);
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
