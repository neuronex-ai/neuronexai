import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { User, ArrowUpRight, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PatientCardData {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    lastAppointment?: string;
    status?: 'active' | 'inactive' | 'pending';
}

interface PatientMiniCardProps {
    patient: PatientCardData;
    index?: number;
}

export const PatientMiniCard = ({ patient, index = 0 }: PatientMiniCardProps) => {
    const navigate = useNavigate();
    const shouldReduceMotion = useReducedMotion();

    const handleClick = () => {
        navigate(`/pacientes/${patient.id}`);
    };

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'active': return 'bg-emerald-500';
            case 'inactive': return 'bg-muted-foreground/55';
            case 'pending': return 'bg-amber-500';
            default: return 'bg-muted-foreground/55';
        }
    };

    return (
        <motion.button
            type="button"
            initial={shouldReduceMotion ? false : { opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { delay: index * 0.04, duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            onClick={handleClick}
            aria-label={`Abrir prontuário de ${patient.name}`}
            className={cn(
                "group flex w-[min(280px,78vw)] flex-shrink-0 cursor-pointer items-center gap-3 rounded-[18px] border p-3 text-left",
                "border-foreground/[0.085] bg-background/72 shadow-[0_14px_36px_-30px_hsl(var(--foreground)/0.42)] backdrop-blur-xl",
                "hover:border-foreground/[0.14] hover:bg-background/88",
                "dark:border-white/[0.075] dark:bg-white/[0.045] dark:hover:bg-white/[0.07]",
                "transition-all duration-300 ease-apple active:scale-[0.985] motion-reduce:transition-none motion-reduce:active:scale-100"
            )}
        >
            {/* Avatar */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-foreground/[0.085] bg-muted/45 transition-colors group-hover:bg-muted dark:border-white/[0.075] dark:bg-white/[0.06]">
                <User className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-semibold text-foreground">
                        {patient.name}
                    </span>
                    {patient.status && (
                        <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", getStatusColor(patient.status))} />
                    )}
                </div>

                <div className="flex items-center gap-2 mt-0.5">
                    {patient.phone && (
                        <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                            <Phone className="h-2 w-2" />
                            {patient.phone}
                        </span>
                    )}
                </div>
            </div>

            {/* Arrow */}
            <div className="opacity-50 transition-all duration-300 group-hover:opacity-100">
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
            </div>
        </motion.button>
    );
};

interface PatientListWidgetProps {
    patients: PatientCardData[];
    title?: string;
}

export const PatientListWidget = ({ patients, title = "Lista de Pacientes" }: PatientListWidgetProps) => {
    const navigate = useNavigate();
    const shouldReduceMotion = useReducedMotion();
    const showViewAll = patients.length > 5;
    const displayPatients = showViewAll ? patients.slice(0, 5) : patients;
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = React.useState(false);
    const [startX, setStartX] = React.useState(0);
    const [scrollLeft, setScrollLeft] = React.useState(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!scrollContainerRef.current) return;
        setIsDragging(true);
        setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
        setScrollLeft(scrollContainerRef.current.scrollLeft);
        scrollContainerRef.current.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollContainerRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollContainerRef.current.offsetLeft;
        const walk = (x - startX) * 2; // Multiply for faster scroll
        scrollContainerRef.current.scrollLeft = scrollLeft - walk;
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        if (scrollContainerRef.current) {
            scrollContainerRef.current.style.cursor = 'grab';
        }
    };

    const handleMouseLeave = () => {
        if (isDragging) {
            setIsDragging(false);
            if (scrollContainerRef.current) {
                scrollContainerRef.current.style.cursor = 'grab';
            }
        }
    };

    return (
        <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="notes-liquid-surface my-6 overflow-hidden rounded-[26px] border shadow-xl"
        >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-foreground/[0.07] px-5 py-4 dark:border-white/[0.055]">
                <div className="flex items-center gap-2.5">
                    <div className="rounded-lg border border-foreground/[0.085] bg-muted/45 p-1.5 dark:border-white/[0.075] dark:bg-white/[0.06]">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                        {title}
                    </span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground/70">
                    {patients.length} {patients.length === 1 ? 'paciente' : 'pacientes'}
                </span>
            </div>

            {/* Horizontal Scrollable Patient List */}
            <div className="relative group/scroll">
                {/* Gradient fade on left edge */}
                <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-8 bg-gradient-to-r from-background/80 to-transparent opacity-0 transition-opacity group-hover/scroll:opacity-100" />

                {/* Gradient fade on right edge */}
                <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-8 bg-gradient-to-l from-background/80 to-transparent opacity-0 transition-opacity group-hover/scroll:opacity-100" />

                <div
                    ref={scrollContainerRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                    className="flex select-none gap-3 overflow-x-auto snap-x snap-mandatory p-4 scroll-smooth motion-reduce:scroll-auto"
                    style={{
                        cursor: 'grab',
                        scrollbarWidth: 'thin',
                        scrollbarColor: 'hsl(var(--muted-foreground) / 0.22) transparent'
                    }}
                >
                    {displayPatients.map((patient, index) => (
                        <div key={patient.id} className="snap-start">
                            <PatientMiniCard patient={patient} index={index} />
                        </div>
                    ))}

                    {/* View All Card */}
                    {showViewAll && (
                        <motion.div
                            initial={shouldReduceMotion ? false : { opacity: 0, x: -14 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={shouldReduceMotion ? { duration: 0 } : { delay: displayPatients.length * 0.04, duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                            className="flex-shrink-0 w-[280px] snap-start"
                        >
                            <button
                                type="button"
                                onClick={() => navigate("/pacientes")}
                                className="group/viewall flex h-full w-full cursor-pointer items-center justify-center rounded-[18px] border border-dashed border-foreground/[0.14] bg-background/40 p-3 text-center transition-all hover:bg-background/72 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/[0.12] dark:bg-white/[0.035]"
                                aria-label={`Ver todos os ${patients.length} pacientes`}
                            >
                                <div className="text-center">
                                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-foreground/[0.085] bg-muted/45 transition-colors group-hover/viewall:bg-muted dark:border-white/[0.075] dark:bg-white/[0.06]">
                                        <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover/viewall:text-foreground" />
                                    </div>
                                    <p className="text-[10px] font-medium text-muted-foreground">
                                        Ver todos ({patients.length})
                                    </p>
                                </div>
                            </button>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-foreground/[0.07] px-4 py-2 dark:border-white/[0.055]">
                <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/70">
                    Arraste para ver mais • Clique para abrir prontuário
                </span>
                <div className="h-1 w-1 rounded-full bg-emerald-500/50 motion-safe:animate-pulse" />
            </div>
        </motion.div>
    );
};
