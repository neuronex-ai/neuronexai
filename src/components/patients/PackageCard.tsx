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
import { motion } from "framer-motion";
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
    const progressValue = (pkg.sessions_used / pkg.total_sessions) * 100;
    const isCompleted = sessionsRemaining <= 0;
    const isExpired = pkg.end_date && new Date(pkg.end_date + 'T23:59:59') < new Date();

    const { mutate: consumeSession, isPending: isUsingSession } = useUsePackageSession();
    const { mutate: deletePackage, isPending: isDeleting } = useDeletePatientPackage();
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

    const handleUseSession = () => {
        consumeSession({ packageId: pkg.id, patientId });
    };

    const handleDelete = () => {
        deletePackage({ packageId: pkg.id, patientId });
        setIsConfirmingDelete(false);
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
                "group relative p-[1px] rounded-[28px] transition-all overflow-hidden shadow-xl",
                isCompleted ? "opacity-60 grayscale" : "hover:shadow-2xl"
            )}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-white to-zinc-50 dark:from-[#141415] dark:to-[#080809] rounded-[28px]" />

            <div className="relative bg-white/50 dark:bg-[#0b0b0d] backdrop-blur-xl p-6 rounded-[27px] flex flex-col gap-6 border border-zinc-200 dark:border-white/[0.085]">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className={cn(
                            "p-3.5 rounded-2xl border transition-all group-hover:scale-110 shadow-sm",
                            isCompleted
                                ? "bg-zinc-100 border-zinc-200 text-zinc-400 dark:bg-[#141415] dark:border-white/[0.065] dark:text-zinc-500"
                                : "bg-white border-zinc-200 text-zinc-900 dark:bg-[#141415] dark:border-white/[0.075] dark:text-white"
                        )}>
                            <Package className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="font-black text-zinc-900 dark:text-white text-lg tracking-tight">{pkg.description}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={cn(
                                    "text-[9px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-lg border",
                                    isCompleted
                                        ? "bg-zinc-100 border-zinc-200 text-zinc-500 dark:bg-[#141415] dark:border-white/[0.065]"
                                        : isExpired
                                            ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                                            : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                )}>
                                    {isCompleted ? "Concluído" : isExpired ? "Expirado" : "Plano Ativo"}
                                </span>
                            </div>
                        </div>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#18181a] rounded-xl">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-white/95 dark:bg-[#0b0b0d]/95 backdrop-blur-xl border-zinc-200 dark:border-white/[0.085] rounded-2xl p-1.5 shadow-2xl">
                            <EditPackageModal pkg={pkg}>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer text-[10px] font-black uppercase tracking-widest gap-2.5 p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-[#18181a] text-zinc-700 dark:text-zinc-300 focus:text-zinc-900 dark:focus:text-white">
                                    <Edit className="h-3.5 w-3.5" /> Editar
                                </DropdownMenuItem>
                            </EditPackageModal>
                            <DropdownMenuItem
                                className="text-rose-500 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-500/10 cursor-pointer text-[10px] font-black uppercase tracking-widest gap-2.5 p-2.5 rounded-xl mt-1"
                                onSelect={() => setIsConfirmingDelete(true)}
                            >
                                <Trash2 className="h-3.5 w-3.5" /> Excluir
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5 p-4 rounded-2xl bg-zinc-50 dark:bg-[#080809] border border-zinc-200/50 dark:border-white/[0.065]">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Sessões Utilizadas</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-zinc-900 dark:text-white">{pkg.sessions_used}</span>
                            <span className="text-xs text-zinc-500 font-bold">/ {pkg.total_sessions}</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5 p-4 rounded-2xl bg-zinc-50 dark:bg-[#080809] border border-zinc-200/50 dark:border-white/[0.065] text-right">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Valor Investido</span>
                        <span className="text-xl font-black text-zinc-900 dark:text-white">{formatCurrency(pkg.price)}</span>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="h-2.5 w-full bg-zinc-100 dark:bg-[#080809] rounded-full overflow-hidden border border-zinc-200/50 dark:border-white/[0.05]">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progressValue}%` }}
                            transition={{ duration: 1.5, ease: "circOut" }}
                            className={cn("h-full rounded-full", isCompleted ? "bg-zinc-300 dark:bg-zinc-700" : "bg-zinc-900 dark:bg-white")}
                        />
                    </div>
                    <div className="flex justify-between text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">
                        <span>Consumo do Plano</span>
                        <span className="text-zinc-900 dark:text-white">{Math.round(progressValue)}%</span>
                    </div>
                </div>

                <div className="pt-6 border-t border-zinc-200 dark:border-white/[0.075] flex items-center justify-between mt-2">
                    <div className="flex flex-col gap-1.5 text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3 opacity-50" />
                            <span>Adesão: {format(new Date(pkg.start_date + 'T00:00:00'), 'dd/MM/yyyy')}</span>
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
                                ? "bg-zinc-100 text-zinc-400 dark:bg-[#141415] dark:text-zinc-600 shadow-none border border-zinc-200 dark:border-white/[0.065]"
                                : "bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                        )}
                    >
                        {isUsingSession ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <CheckCircle className="h-3.5 w-3.5 mr-2" />
                        )}
                        {isUsingSession ? "Processando..." : "Debitar Sessão"}
                    </Button>
                </div>
            </div>

            <AlertDialog open={isConfirmingDelete} onOpenChange={setIsConfirmingDelete}>
                <AlertDialogContent className="bg-white/95 dark:bg-[#0b0b0d]/95 backdrop-blur-2xl border border-zinc-200 dark:border-white/[0.085] rounded-[32px] p-8 shadow-2xl max-w-[400px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Excluir Plano?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-zinc-500 font-medium leading-relaxed">
                            Esta ação é irreversível e removerá o histórico de consumo associado a este plano terapêutico.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-8 gap-3">
                        <AlertDialogCancel className="h-11 rounded-2xl border-zinc-200 dark:border-white/[0.075] bg-zinc-50 dark:bg-[#141415] hover:bg-zinc-100 dark:hover:bg-[#18181a] text-zinc-900 dark:text-white text-[10px] font-black uppercase tracking-widest">Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="h-11 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-500/20"
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Excluindo..." : "Sim, Excluir"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </motion.div>
    );
};
