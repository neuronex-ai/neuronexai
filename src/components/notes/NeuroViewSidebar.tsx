import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";

interface Patient {
    id: string;
    name: string;
    avatar_url?: string | null;
}

interface NeuroViewSidebarProps {
    patients: Patient[];
    onHoverNode: (id: string | null) => void;
    onSelectPatient: (patient: Patient) => void;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export const NeuroViewSidebar = ({
    patients,
    onHoverNode,
    onSelectPatient,
    isOpen,
    onOpenChange
}: NeuroViewSidebarProps) => {
    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    return (
        <div className="absolute bottom-20 left-5 top-[78px] z-40 flex pointer-events-none">
            <AnimatePresence mode="wait">
                {isOpen ? (
                    <motion.div
                        key="sidebar-open"
                        initial={{ opacity: 0, x: -20, width: 0 }}
                        animate={{ opacity: 1, x: 0, width: 196 }}
                        exit={{ opacity: 0, x: -20, width: 0 }}
                        transition={{ type: "spring", damping: 30, stiffness: 300 }}
                        className="pointer-events-auto flex h-full flex-col overflow-hidden rounded-[26px] border border-white/[0.09] bg-[#070708]/76 shadow-[0_30px_90px_-48px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-3xl [.light_&]:border-black/[0.08] [.light_&]:bg-white/[0.72] [.light_&]:shadow-[0_28px_80px_-46px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.55)]"
                    >
                        <div className="flex flex-col gap-2.5 border-b border-white/[0.07] bg-white/[0.025] p-3 [.light_&]:border-black/[0.06] [.light_&]:bg-black/[0.015]">
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white [.light_&]:text-foreground">
                                    <Users className="h-3.5 w-3.5 text-white/55 [.light_&]:text-zinc-500" /> Pacientes
                                </span>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => onOpenChange(false)}
                                    className="h-6 w-6 rounded-xl text-white/50 hover:bg-white/[0.06] hover:text-white [.light_&]:text-muted-foreground [.light_&]:hover:bg-black/[0.05] [.light_&]:hover:text-foreground"
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                            <p className="text-[8.5px] font-black uppercase tracking-[0.22em] text-white/32 [.light_&]:text-muted-foreground/50">
                                {patients.length} nós ativos
                            </p>
                        </div>

                        <div className="relative flex-1 overflow-hidden">
                            <div className="custom-scrollbar absolute inset-0 space-y-1 overflow-y-auto p-2 pb-5">
                                {patients.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center gap-2 py-12 text-white/30 [.light_&]:text-muted-foreground/30">
                                        <Users className="h-8 w-8 opacity-20" />
                                        <p className="px-4 text-center text-[10px] font-medium">Nenhum paciente</p>
                                    </div>
                                ) : (
                                    patients.map((patient) => (
                                        <motion.button
                                            key={patient.id}
                                            layoutId={patient.id}
                                            onMouseEnter={() => onHoverNode(`pat-${patient.id}`)}
                                            onMouseLeave={() => onHoverNode(null)}
                                            onClick={() => onSelectPatient(patient)}
                                            whileHover={{ backgroundColor: "rgba(120,120,120,0.1)", scale: 1.015 }}
                                            whileTap={{ scale: 0.98 }}
                                            className="group flex w-full cursor-pointer items-center gap-2.5 rounded-2xl border border-transparent p-1.5 text-left transition-colors duration-200 hover:border-white/[0.06] [.light_&]:hover:border-black/[0.06]"
                                        >
                                            <Avatar className="h-7 w-7 shadow-sm ring-1 ring-white/10 transition-all group-hover:ring-white/24 [.light_&]:ring-black/[0.08] [.light_&]:group-hover:ring-zinc-400/60">
                                                <AvatarImage src={patient.avatar_url || undefined} />
                                                <AvatarFallback className="bg-[#1A1A1D] text-[8.5px] font-black text-white/60 [.light_&]:bg-zinc-100 [.light_&]:text-zinc-500">
                                                    {getInitials(patient.name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-[11px] font-semibold text-white/66 transition-colors group-hover:text-white [.light_&]:text-muted-foreground [.light_&]:group-hover:text-foreground">
                                                    {patient.name}
                                                </p>
                                            </div>
                                            <ChevronRight className="h-3 w-3 text-white/30 opacity-0 transition-opacity group-hover:opacity-100 group-hover:text-white/50 [.light_&]:text-muted-foreground/30 [.light_&]:group-hover:text-foreground/50" />
                                        </motion.button>
                                    ))
                                )}
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="sidebar-closed"
                        initial={{ opacity: 0, scale: 0.8, x: -20 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.8, x: -20 }}
                        transition={{ type: "spring", damping: 20, stiffness: 400 }}
                        className="pointer-events-auto"
                    >
                        <Button
                            size="icon"
                            variant="outline"
                            onClick={() => onOpenChange(true)}
                            className="h-10 w-10 rounded-2xl border border-white/[0.09] bg-[#070708]/72 text-white/70 shadow-[0_20px_54px_-34px_rgba(0,0,0,0.75)] backdrop-blur-2xl hover:bg-white/[0.08] hover:text-white [.light_&]:border-black/[0.08] [.light_&]:bg-white/70 [.light_&]:text-muted-foreground [.light_&]:hover:bg-white [.light_&]:hover:text-foreground"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export const NeuroVisionSidebar = NeuroViewSidebar;
