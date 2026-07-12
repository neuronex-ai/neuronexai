import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    isAttendedAppointmentStatus,
    isCancelledAppointmentStatus,
} from "@/lib/appointment-status";
import { getInitials } from "@/lib/appointment-utils";
import { cn } from "@/lib/utils";
import { Appointment } from "@/types";
import { format, formatDistanceToNow, isFuture, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { Calendar, CheckCircle2, Clock, History, Loader2, MapPin, Play, Video } from "lucide-react";
import React from "react";
import { PatientRecapSidebar } from "./PatientRecapSidebar";

interface UpcomingSessionsPanelProps {
    upcomingSessions: Appointment[];
    activeAppointment: Appointment | undefined;
    isLoading: boolean;
    startSession: (appointmentId: string) => void;
}

export const UpcomingSessionsPanel = ({
    upcomingSessions,
    isLoading,
    startSession
}: UpcomingSessionsPanelProps) => {
    const [selectedSession, setSelectedSession] = React.useState<Appointment | null>(null);

    // Logic to find "Next Session"
    const sortedSessions = [...upcomingSessions].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    const nextSessionIndex = sortedSessions.findIndex(s =>
        !isCancelledAppointmentStatus(s.status, s.notes) &&
        !isAttendedAppointmentStatus(s.status, s.notes) &&
        (isToday(new Date(s.start_time)) || isFuture(new Date(s.start_time)))
    );
    const nextSession = nextSessionIndex !== -1 ? sortedSessions[nextSessionIndex] : null;
    const futureSessions = sortedSessions.filter((s, idx) =>
        idx > nextSessionIndex &&
        !isAttendedAppointmentStatus(s.status, s.notes) &&
        !isCancelledAppointmentStatus(s.status, s.notes)
    );
    const pastSessions = sortedSessions.filter(s =>
        isAttendedAppointmentStatus(s.status, s.notes) ||
        (isPast(new Date(s.end_time)) && s.id !== nextSession?.id)
    );

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center bg-transparent">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
            </div>
        );
    }

    return (
        <div className="relative z-10 flex h-full w-full overflow-hidden bg-transparent">
            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-6 pr-8 pt-0">
                <div className="max-w-5xl mx-auto space-y-8">

                    {/* Header - Floating Bar Style */}
                    <div className="mb-5 relative z-40 w-full animate-fade-in group">
                        <div className="desktop-retina-frame w-full h-[72px] flex items-center justify-between px-6 py-2 bg-white/60 dark:bg-[#080808]/80 backdrop-blur-[40px] border border-white/20 dark:border-white/10 rounded-[32px] hover:border-white/30 dark:hover:border-white/20 transition-all duration-500 ease-out">

                            {/* Left: Title & Badge */}
                            <div className="flex items-center gap-4 h-full">
                                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                    <Video className="w-5 h-5 text-emerald-600 dark:text-emerald-500 shadow-sm" />
                                </div>
                                <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight leading-none">Teleconsulta</h1>
                            </div>

                            {/* Right: Actions */}
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="h-9 px-4 rounded-full bg-black/[0.03] dark:bg-white/[0.03] border-black/[0.05] dark:border-white/[0.05] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all group-hover:border-black/10 dark:group-hover:border-white/10 uppercase tracking-wider text-[10px] font-bold">
                                    {upcomingSessions.length} Sessões Agendadas
                                </Badge>
                            </div>
                        </div>
                    </div>

                    {/* Hero Card: Next Session */}
                    {nextSession ? (
                        <div className="relative group rounded-[32px] p-1 transition-all duration-500 hover:scale-[1.01]">
                            <div className="absolute inset-0 bg-gradient-to-r from-zinc-500/10 to-zinc-500/5 dark:from-white/10 dark:to-white/5 rounded-[32px] blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
                            <div className="desktop-retina-panel relative bg-white/40 dark:bg-[#121212]/88 backdrop-blur-[40px] rounded-[32px] border border-white/20 dark:border-white/10 p-8 overflow-hidden">

                                <div className="relative z-10 flex items-center justify-between gap-8">
                                    {/* Left Content */}
                                    <div className="space-y-6 flex-1">
                                        <div className="flex items-center gap-3">
                                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase shadow-sm backdrop-blur-md">
                                                Próxima Sessão
                                            </Badge>
                                            <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                                                {formatDistanceToNow(new Date(nextSession.start_time), { addSuffix: true, locale: ptBR })}
                                            </span>
                                        </div>

                                        <div className="space-y-4">
                                            <h2 className="text-4xl font-bold text-zinc-900 dark:text-white tracking-tight leading-[1.1] xl:text-5xl">
                                                {nextSession.patient_name}
                                            </h2>
                                            <div className="flex items-center gap-6 text-sm text-zinc-600 dark:text-zinc-300">
                                                <div className="flex items-center gap-2 bg-white/20 dark:bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                                                    <Clock className="w-4 h-4 text-zinc-400" />
                                                    <span className="font-mono text-base">{format(new Date(nextSession.start_time), "HH:mm")}</span>
                                                </div>
                                                <div className="flex items-center gap-2 bg-white/20 dark:bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                                                    {nextSession.type === 'online' ? <Video className="w-4 h-4 text-emerald-500" /> : <MapPin className="w-4 h-4 text-rose-500" />}
                                                    <span className="font-bold uppercase tracking-wider text-[11px]">{nextSession.type === 'online' ? 'Teleconsulta' : 'Presencial'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Content (Button) */}
                                    {!isCancelledAppointmentStatus(nextSession.status, nextSession.notes) ? (
                                        <div className="flex-shrink-0">
                                            <Button
                                                onClick={() => startSession(nextSession.id)}
                                                className="h-14 px-10 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-black font-bold uppercase tracking-widest text-xs hover:scale-105 active:scale-95 transition-all duration-500 shadow-xl hover:shadow-2xl hover:bg-zinc-800 dark:hover:bg-zinc-200"
                                            >
                                                <Play className="w-5 h-5 mr-3 fill-current" /> Iniciar Agora
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex-shrink-0 text-right opacity-50">
                                            <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">Aguardando Confirmação</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="desktop-retina-panel bg-white/30 backdrop-blur-xl border border-white/20 rounded-[40px] p-12 text-center">
                            <Calendar className="w-12 h-12 mx-auto mb-4 text-zinc-400/50 dark:text-zinc-600/50" />
                            <p className="text-zinc-500 dark:text-zinc-400 font-medium">Nenhuma sessão agendada.</p>
                        </div>
                    )}
                    {/* Lists Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* Future Sessions */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-widest">
                                <Calendar className="w-4 h-4 text-muted-foreground" /> Sessões Futuras
                            </div>
                            <div className="space-y-3">
                                {futureSessions.length > 0 ? futureSessions.map(session => (
                                    <div key={session.id} className="desktop-retina-inset desktop-retina-interactive group p-4 rounded-3xl bg-white/40 backdrop-blur-md border border-white/20 hover:bg-white/60 hover:border-white/40 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center text-xs font-bold text-zinc-700 dark:text-zinc-300 border border-black/5 dark:border-white/5">
                                                {getInitials(session.patient_name || '')}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{session.patient_name}</p>
                                                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">{format(new Date(session.start_time), "dd/MM • HH:mm")}</p>
                                            </div>
                                        </div>
                                        {session.type === 'online' && <div className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-lg border border-emerald-500/20 tracking-widest uppercase">ONLINE</div>}
                                    </div>
                                )) : (
                                    <p className="text-xs text-muted-foreground pl-2">Nada agendado.</p>
                                )}
                            </div>
                        </div>

                        {/* History */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-widest">
                                <History className="w-4 h-4 text-muted-foreground" /> Histórico Recente
                            </div>
                            <div className="space-y-3">
                                {pastSessions.slice(0, 5).map(session => (
                                    <div
                                        key={session.id}
                                        onClick={() => setSelectedSession(session)}
                                        className={cn(
                                            "group p-4 rounded-[24px] border flex items-center justify-between transition-all duration-500 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] cursor-pointer relative overflow-hidden",
                                            selectedSession?.id === session.id
                                                ? "bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 opacity-100 scale-[1.02] shadow-lg"
                                                : "desktop-retina-inset bg-white/20 border-white/10 opacity-60 hover:opacity-100 hover:bg-white/40 hover:border-white/20 hover:scale-[1.01]"
                                        )}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                                <CheckCircle2 className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{session.patient_name}</p>
                                                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">{format(new Date(session.start_time), "dd/MM • HH:mm")}</p>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="border-black/5 dark:border-white/10 text-zinc-500 dark:text-zinc-400 text-[9px] bg-black/5 dark:bg-white/5">Concluída</Badge>
                                    </div>
                                ))}
                                {pastSessions.length === 0 && (
                                    <p className="text-xs text-muted-foreground pl-2">Nenhum histórico.</p>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* Right Sidebar (AI) */}
            <motion.div
                initial={false}
                animate={{
                    width: (selectedSession || nextSession) ? 400 : 0,
                    opacity: (selectedSession || nextSession) ? 1 : 0
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="hidden xl:block overflow-hidden h-full border-l border-border/20 pt-5 lg:pt-8"
            >
                <PatientRecapSidebar
                    patientId={(selectedSession || nextSession)?.patient_id}
                    patientName={(selectedSession || nextSession)?.patient_name}
                    className="w-[400px] bg-card/30 backdrop-blur-3xl"
                />
            </motion.div>
        </div>
    );
};
