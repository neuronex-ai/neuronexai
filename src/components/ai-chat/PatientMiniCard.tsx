import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Phone, User } from "lucide-react";

import { cn } from "@/lib/utils";

export interface PatientCardData {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    lastAppointment?: string;
    status?: "active" | "inactive" | "pending";
}

interface PatientMiniCardProps {
    patient: PatientCardData;
    index?: number;
}

const getStatusColor = (status?: string) => {
    switch (status) {
        case "active":
            return "bg-emerald-500";
        case "pending":
            return "bg-amber-500";
        case "inactive":
        default:
            return "bg-muted-foreground/45";
    }
};

export const PatientMiniCard = ({ patient, index = 0 }: PatientMiniCardProps) => {
    const navigate = useNavigate();
    const shouldReduceMotion = useReducedMotion();

    return (
        <motion.button
            initial={shouldReduceMotion ? false : { opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { delay: index * 0.035, duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            type="button"
            onClick={() => navigate(`/pacientes/${patient.id}`)}
            className={cn(
                "notes-liquid-surface group flex min-h-[76px] w-[280px] flex-shrink-0 items-center gap-3 rounded-[18px] border p-3 text-left",
                "transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-foreground/12",
                "active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100",
            )}
            aria-label={`Abrir prontuario de ${patient.name}`}
        >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/45 bg-muted/70 text-muted-foreground transition-colors group-hover:bg-muted dark:border-white/[0.075] dark:bg-white/[0.055]">
                <User className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-black tracking-tight text-foreground">{patient.name}</span>
                    {patient.status ? <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", getStatusColor(patient.status))} /> : null}
                </div>

                <div className="mt-1 flex min-w-0 items-center gap-2">
                    {patient.phone ? (
                        <span className="flex min-w-0 items-center gap-1 truncate text-[10px] font-medium text-muted-foreground">
                            <Phone className="h-2.5 w-2.5 shrink-0" />
                            {patient.phone}
                        </span>
                    ) : (
                        <span className="truncate text-[10px] font-medium text-muted-foreground">Abrir detalhes</span>
                    )}
                </div>
            </div>

            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
        </motion.button>
    );
};

interface PatientListWidgetProps {
    patients: PatientCardData[];
    title?: string;
}

export const PatientListWidget = ({ patients, title = "Lista de pacientes" }: PatientListWidgetProps) => {
    const navigate = useNavigate();
    const shouldReduceMotion = useReducedMotion();
    const showViewAll = patients.length > 5;
    const displayPatients = showViewAll ? patients.slice(0, 5) : patients;
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = React.useState(false);
    const [startX, setStartX] = React.useState(0);
    const [scrollLeft, setScrollLeft] = React.useState(0);

    const handleMouseDown = (event: React.MouseEvent) => {
        if (!scrollContainerRef.current) return;
        setIsDragging(true);
        setStartX(event.pageX - scrollContainerRef.current.offsetLeft);
        setScrollLeft(scrollContainerRef.current.scrollLeft);
        scrollContainerRef.current.style.cursor = "grabbing";
    };

    const handleMouseMove = (event: React.MouseEvent) => {
        if (!isDragging || !scrollContainerRef.current) return;
        event.preventDefault();
        const x = event.pageX - scrollContainerRef.current.offsetLeft;
        const walk = (x - startX) * 2;
        scrollContainerRef.current.scrollLeft = scrollLeft - walk;
    };

    const stopDragging = () => {
        setIsDragging(false);
        if (scrollContainerRef.current) {
            scrollContainerRef.current.style.cursor = "grab";
        }
    };

    return (
        <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="notes-liquid-surface my-6 overflow-hidden rounded-[24px] border shadow-[0_22px_64px_-48px_hsl(var(--foreground)/0.78)]"
        >
            <div className="flex items-center justify-between border-b border-border/35 px-5 py-4 dark:border-white/[0.055]">
                <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border/45 bg-muted/70 text-muted-foreground dark:border-white/[0.075] dark:bg-white/[0.055]">
                        <User className="h-3.5 w-3.5" />
                    </div>
                    <span className="truncate text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                        {title}
                    </span>
                </div>
                <span className="shrink-0 text-[10px] font-mono text-muted-foreground">
                    {patients.length} {patients.length === 1 ? "paciente" : "pacientes"}
                </span>
            </div>

            <div className="relative group/scroll">
                <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-8 bg-gradient-to-r from-background/80 to-transparent opacity-0 transition-opacity group-hover/scroll:opacity-100 dark:from-background/70" />
                <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-8 bg-gradient-to-l from-background/80 to-transparent opacity-0 transition-opacity group-hover/scroll:opacity-100 dark:from-background/70" />

                <div
                    ref={scrollContainerRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={stopDragging}
                    onMouseLeave={stopDragging}
                    className="flex snap-x snap-mandatory gap-3 overflow-x-auto p-4 scroll-smooth select-none motion-reduce:scroll-auto"
                    style={{
                        cursor: "grab",
                        scrollbarWidth: "thin",
                        scrollbarColor: "hsl(var(--muted-foreground) / 0.2) transparent",
                    }}
                    aria-label="Pacientes encontrados"
                >
                    {displayPatients.map((patient, index) => (
                        <div key={patient.id} className="snap-start">
                            <PatientMiniCard patient={patient} index={index} />
                        </div>
                    ))}

                    {showViewAll ? (
                        <motion.button
                            initial={shouldReduceMotion ? false : { opacity: 0, x: -16 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={shouldReduceMotion ? { duration: 0 } : { delay: displayPatients.length * 0.035, duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                            type="button"
                            onClick={() => navigate("/pacientes")}
                            className="flex min-h-[76px] w-[280px] flex-shrink-0 snap-start items-center justify-center rounded-[18px] border border-dashed border-border/55 bg-muted/25 p-3 text-center transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/[0.075] dark:bg-white/[0.025]"
                        >
                            <div>
                                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-border/45 bg-muted/65 text-muted-foreground dark:border-white/[0.075] dark:bg-white/[0.055]">
                                    <ArrowUpRight className="h-4 w-4" />
                                </div>
                                <p className="text-[10px] font-bold text-muted-foreground">Ver todos ({patients.length})</p>
                            </div>
                        </motion.button>
                    ) : null}
                </div>
            </div>

            <div className="flex items-center justify-between border-t border-border/30 bg-muted/25 px-4 py-2 dark:border-white/[0.045] dark:bg-white/[0.025]">
                <span className="truncate text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    Arraste para navegar. Clique para abrir prontuario.
                </span>
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/70" aria-hidden="true" />
            </div>
        </motion.div>
    );
};
