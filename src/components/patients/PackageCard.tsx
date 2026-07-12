import { PatientPackage } from "@/types";
import { Button } from "@/components/ui/button";
import { Package, CheckCircle, Loader2, MoreVertical, Edit, Trash2, Calendar, Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useUsePackageSession } from "@/hooks/use-use-package-session";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EditPackageModal } from "./EditPackageModal";
import { useDeletePatientPackage } from "@/hooks/use-delete-patient-package";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PackageCardProps {
    pkg: PatientPackage;
    patientId: string;
}

const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined || value === 0) return "N/A";
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const PackageCard = ({ pkg, patientId }: PackageCardProps) => {
    const sessionsRemaining = pkg.total_sessions - pkg.sessions_used;
    const progressValue = pkg.total_sessions > 0 ? (pkg.sessions_used / pkg.total_sessions) * 100 : 0;
    const isCompleted = sessionsRemaining <= 0;
    const isExpired = pkg.end_date && new Date(pkg.end_date + 'T23:59:59') < new Date();

    const { mutate: consumeSession, isPending: isUsingSession } = useUsePackageSession();
    const { mutate: deletePackage, isPending: isDeleting } = useDeletePatientPackage();
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isEditingPackage, setIsEditingPackage] = useState(false);
    const shouldReduceMotion = useReducedMotion();

    const handleUseSession = () => {
        consumeSession({ packageId: pkg.id, patientId });
    };

    const handleDelete = () => {
        deletePackage({ packageId: pkg.id, patientId });
        setIsConfirmingDelete(false);
    };

    return (
        <motion.div
            layout={!shouldReduceMotion}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className={cn(
                "group relative p-[1px] rounded-[28px] transition-all overflow-hidden shadow-xl",
                isCompleted ? "opacity-60 grayscale" : "hover:shadow-2xl"
            )}
        >
            <div className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-white to-zinc-50 dark:from-[#141414] dark:to-[#080808]" />

            <div className="patient-record-card relative flex flex-col gap-6 rounded-[27px] border p-6">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className={cn(
                            "p-3.5 rounded-2xl border transition-all group-hover:scale-110 shadow-sm",
                            isCompleted
                                ? "border-border/50 bg-muted/55 text-muted-foreground"
                                : "border-border/50 bg-background/64 text-foreground"
                        )}>
                            <Package className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="font-black text-zinc-900 dark:text-white text-lg tracking-tight">{pkg.description}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={cn(
                                    "text-[9px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-lg border",
                                    isCompleted
                                        ? "border-border/50 bg-muted/55 text-muted-foreground"
                                        : isExpired
                                            ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                                            : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                )}>
                                    {isCompleted ? "Concluído" : isExpired ? "Expirado" : "Plano ativo"}
                                </span>
                            </div>
                        </div>
                    </div>

                    <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Ações do plano" className="h-11 w-11 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="desktop-retina-modal rounded-2xl border-border/60 bg-popover/96 p-1.5 shadow-2xl">
                            <DropdownMenuItem
                                onSelect={() => {
                                    setIsMenuOpen(false);
                                    setIsEditingPackage(true);
                                }}
                                className="cursor-pointer gap-2.5 rounded-xl p-2.5 text-[10px] font-black uppercase tracking-widest text-foreground focus:bg-muted"
                            >
                                <Edit className="h-3.5 w-3.5" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="text-rose-500 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-500/10 cursor-pointer text-[10px] font-black uppercase tracking-widest gap-2.5 p-2.5 rounded-xl mt-1"
                                onSelect={() => {
                                    setIsMenuOpen(false);
                                    setIsConfirmingDelete(true);
                                }}
                            >
                                <Trash2 className="h-3.5 w-3.5" /> Excluir
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <EditPackageModal
                        pkg={pkg}
                        open={isEditingPackage}
                        onOpenChange={setIsEditingPackage}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="desktop-retina-inset flex flex-col gap-1.5 rounded-2xl border border-border/50 bg-background/52 p-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sessões utilizadas</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-zinc-900 dark:text-white">{pkg.sessions_used}</span>
                            <span className="text-xs text-zinc-500 font-bold">/ {pkg.total_sessions}</span>
                        </div>
                    </div>
                    <div className="desktop-retina-inset flex flex-col gap-1.5 rounded-2xl border border-border/50 bg-background/52 p-4 text-right">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Valor do plano</span>
                        <span className="text-xl font-black text-zinc-900 dark:text-white">{formatCurrency(pkg.price)}</span>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="h-2.5 w-full overflow-hidden rounded-full border border-border/45 bg-background/52">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progressValue}%` }}
                            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.55, ease: [0.32, 0.72, 0, 1] }}
                            className={cn("h-full rounded-full", isCompleted ? "bg-zinc-300 dark:bg-zinc-700" : "bg-zinc-900 dark:bg-white")}
                        />
                    </div>
                    <div className="flex justify-between text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">
                        <span>Uso do plano</span>
                        <span className="text-zinc-900 dark:text-white">{Math.round(progressValue)}%</span>
                    </div>
                </div>

                <div className="pt-6 border-t border-zinc-200 dark:border-white/[0.075] flex items-center justify-between mt-2">
                    <div className="flex flex-col gap-1.5 text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3 opacity-50" />
                            <span>Início: {pkg.start_date ? format(new Date(pkg.start_date + 'T00:00:00'), 'dd/MM/yyyy') : "não informado"}</span>
                        </div>
                        {pkg.end_date && (
                            <div className="flex items-center gap-2">
                                <Clock className="h-3 w-3 opacity-50" />
                                <span>Vencimento: {format(new Date(pkg.end_date + 'T00:00:00'), 'dd/MM/yyyy')}</span>
                            </div>
                        )}
                    </div>

                    <Button
                        onClick={handleUseSession}
                        disabled={isCompleted || isExpired || isUsingSession}
                        size="sm"
                        className={cn(
                            "h-10 px-5 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg active:scale-95",
                            isCompleted || isExpired
                                ? "border border-border/50 bg-muted text-muted-foreground shadow-none"
                                : "bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                        )}
                    >
                        {isUsingSession ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <CheckCircle className="h-3.5 w-3.5 mr-2" />
                        )}
                        {isUsingSession ? "Registrando..." : "Registrar sessão"}
                    </Button>
                </div>
            </div>

            <AlertDialog open={isConfirmingDelete} onOpenChange={setIsConfirmingDelete}>
                <AlertDialogContent className="desktop-retina-modal max-w-[400px] rounded-[30px] border border-border/65 bg-background/96 p-0 shadow-2xl">
                    <AlertDialogHeader className="p-6 text-left">
                        <AlertDialogTitle className="text-xl font-black tracking-tight text-foreground">Excluir plano?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-medium leading-relaxed text-muted-foreground">
                            Esta ação é irreversível e removerá o histórico de consumo associado a este plano terapêutico.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="grid grid-cols-2 gap-2 border-t border-border/55 bg-muted/18 p-4 sm:space-x-0">
                        <AlertDialogCancel className="mt-0 h-11 rounded-xl border-border/60 bg-background text-[10px] font-black uppercase tracking-widest text-foreground hover:bg-muted">Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="h-11 rounded-xl bg-rose-600 text-[10px] font-black uppercase tracking-widest text-white shadow-none hover:bg-rose-700"
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Excluindo..." : "Excluir plano"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </motion.div>
    );
};
