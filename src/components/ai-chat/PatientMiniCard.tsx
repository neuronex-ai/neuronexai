import React from "react";
import { motion } from "framer-motion";
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

    const handleClick = () => {
        navigate(`/pacientes/${patient.id}`);
    };

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'active': return 'bg-emerald-500';
            case 'inactive': return 'bg-zinc-500';
            case 'pending': return 'bg-amber-500';
            default: return 'bg-zinc-500';
        }
    };

    return (
        <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            onClick={handleClick}
            className={cn(
                "flex-shrink-0 w-[280px] flex items-center gap-3 p-3 rounded-[16px] text-left",
                "bg-white/[0.03] border border-white/[0.06]",
                "hover:bg-white/[0.06] hover:border-white/[0.1] hover:scale-[1.02]",
                "transition-all duration-300 ease-apple group",
                "active:scale-[0.98] cursor-pointer"
            )}
        >
            {/* Avatar */}
            <div className="h-10 w-10 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center shrink-0 group-hover:bg-white/[0.08] transition-colors">
                <User className="h-4 w-4 text-zinc-400 group-hover:text-zinc-300" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white truncate">
                        {patient.name}
                    </span>
                    {patient.status && (
                        <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", getStatusColor(patient.status))} />
                    )}
                </div>

                <div className="flex items-center gap-2 mt-0.5">
                    {patient.phone && (
                        <span className="text-[9px] text-zinc-500 flex items-center gap-1">
                            <Phone className="h-2 w-2" />
                            {patient.phone}
                        </span>
                    )}
                </div>
            </div>

            {/* Arrow */}
            <div className="opacity-50 group-hover:opacity-100 transition-all duration-300">
                <ArrowUpRight className="h-3.5 w-3.5 text-zinc-500 group-hover:text-white" />
            </div>
        </motion.button>
    );
};

interface PatientListWidgetProps {
    patients: PatientCardData[];
    title?: string;
}

export const PatientListWidget = ({ patients, title = "Lista de Pacientes" }: PatientListWidgetProps) => {
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
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="my-6 rounded-[24px] bg-[#0A0A0B] border border-white/[0.06] overflow-hidden shadow-xl"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05] bg-white/[0.01]">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08]">
                        <User className="h-3.5 w-3.5 text-zinc-400" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                        {title}
                    </span>
                </div>
                <span className="text-[10px] font-mono text-zinc-600">
                    {patients.length} {patients.length === 1 ? 'paciente' : 'pacientes'}
                </span>
            </div>

            {/* Horizontal Scrollable Patient List */}
            <div className="relative group/scroll">
                {/* Gradient fade on left edge */}
                <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#0A0A0B] to-transparent z-10 pointer-events-none opacity-0 group-hover/scroll:opacity-100 transition-opacity" />

                {/* Gradient fade on right edge */}
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#0A0A0B] to-transparent z-10 pointer-events-none opacity-0 group-hover/scroll:opacity-100 transition-opacity" />

                <div
                    ref={scrollContainerRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                    className="flex gap-3 p-4 overflow-x-auto snap-x snap-mandatory scroll-smooth select-none"
                    style={{
                        cursor: 'grab',
                        scrollbarWidth: 'thin',
                        scrollbarColor: 'rgba(255, 255, 255, 0.1) transparent'
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
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: displayPatients.length * 0.05, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                            className="flex-shrink-0 w-[280px] snap-start"
                        >
                            <div className="h-full flex items-center justify-center p-3 rounded-[16px] border border-dashed border-white/[0.1] bg-white/[0.01] hover:bg-white/[0.03] transition-all cursor-pointer group/viewall">
                                <div className="text-center">
                                    <div className="h-10 w-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-2 group-hover/viewall:bg-white/[0.06] transition-colors">
                                        <ArrowUpRight className="h-4 w-4 text-zinc-500 group-hover/viewall:text-zinc-300" />
                                    </div>
                                    <p className="text-[10px] text-zinc-500 font-medium">
                                        Ver todos ({patients.length})
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-2 bg-[#050505] border-t border-white/[0.05] flex justify-between items-center">
                <span className="text-[9px] text-zinc-600 font-medium uppercase tracking-wider">
                    Arraste para ver mais • Clique para abrir prontuário
                </span>
                <div className="h-1 w-1 rounded-full bg-emerald-500/50 animate-pulse" />
            </div>
        </motion.div>
    );
};
