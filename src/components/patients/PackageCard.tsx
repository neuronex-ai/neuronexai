import { format } from "date-fns";
import { motion, useReducedMotion } from "framer-motion";
import {
  Calendar,
  CircleStop,
  Clock,
  Edit,
  MoreVertical,
  Package,
  PackageCheck,
  PackageSearch,
  Unlink,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PackageLifecycleOperation } from "@/hooks/use-package-lifecycle";
import { cn } from "@/lib/utils";
import type { PatientPackage } from "@/types";

import { EditPackageModal } from "./EditPackageModal";
import { PackageLifecycleDialog } from "./PackageLifecycleDialog";
import { PatientStatusIcon } from "./PatientStatusIcon";

interface PackageCardProps {
  pkg: PatientPackage;
  patientId: string;
}

const formatCurrency = (value: number | null) => {
  if (value === null || value === undefined || value === 0) return "N/A";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

export const PackageCard = ({ pkg, patientId }: PackageCardProps) => {
  const sessionsReserved = pkg.sessions_reserved || 0;
  const sessionsAvailable = Math.max(pkg.total_sessions - pkg.sessions_used - sessionsReserved, 0);
  const progressValue = pkg.total_sessions > 0 ? (pkg.sessions_used / pkg.total_sessions) * 100 : 0;
  const isCompleted = pkg.package_status === "completed" || pkg.sessions_used >= pkg.total_sessions;
  const isEnded = pkg.package_status === "ended" || pkg.package_status === "replaced";
  const isExpired = Boolean(pkg.end_date && new Date(`${pkg.end_date}T23:59:59`) < new Date());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditingPackage, setIsEditingPackage] = useState(false);
  const [lifecycleOperation, setLifecycleOperation] = useState<PackageLifecycleOperation | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const statusLabel = isEnded
    ? pkg.package_status === "replaced" ? "Substituído" : "Encerrado"
    : isCompleted
    ? "Concluído"
    : isExpired
    ? "Expirado"
    : "Pacote ativo";

  const chooseOperation = (operation: PackageLifecycleOperation) => {
    setIsMenuOpen(false);
    setLifecycleOperation(operation);
  };

  return (
    <motion.div
      layout={!shouldReduceMotion}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
      className={cn(
        "group relative overflow-hidden rounded-[28px] p-px shadow-xl transition-all",
        isCompleted || isEnded ? "opacity-70" : "hover:shadow-2xl",
      )}
    >
      <div className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-white to-zinc-50 dark:from-[#141414] dark:to-[#080808]" />

      <div className="patient-record-card relative flex flex-col gap-6 rounded-[27px] border p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl border border-border/50 bg-background/64 p-3.5 text-foreground shadow-sm">
              <Package className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white">{pkg.description}</h3>
              <div className="mt-1 flex items-center gap-2">
                {!isCompleted && !isEnded && !isExpired ? (
                  <PatientStatusIcon icon={PackageCheck} label={statusLabel} tone="green" />
                ) : (
                  <span
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.15em]",
                      isExpired
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        : "bg-muted/55 text-muted-foreground",
                    )}
                  >
                    {statusLabel}
                  </span>
                )}
              </div>
            </div>
          </div>

          <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Ações do pacote" className="h-11 w-11 rounded-xl">
                <MoreVertical className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="desktop-retina-modal w-72 rounded-2xl p-1.5 shadow-2xl">
              <DropdownMenuItem
                onSelect={() => {
                  setIsMenuOpen(false);
                  setIsEditingPackage(true);
                }}
                className="cursor-pointer gap-2.5 rounded-xl p-3 text-xs font-semibold"
              >
                <Edit className="h-4 w-4" aria-hidden="true" /> Editar pacote
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => chooseOperation("replace")}
                disabled={isEnded || isCompleted}
                className="cursor-pointer gap-2.5 rounded-xl p-3 text-xs font-semibold"
              >
                <PackageSearch className="h-4 w-4" aria-hidden="true" /> Substituir nas sessões futuras
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => chooseOperation("release")}
                disabled={isEnded || isCompleted || sessionsReserved === 0}
                className="cursor-pointer gap-2.5 rounded-xl p-3 text-xs font-semibold"
              >
                <Unlink className="h-4 w-4" aria-hidden="true" /> Remover vínculo das sessões futuras
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => chooseOperation("end")}
                disabled={isEnded}
                className="cursor-pointer gap-2.5 rounded-xl p-3 text-xs font-semibold text-rose-600 focus:bg-rose-500/10 focus:text-rose-600"
              >
                <CircleStop className="h-4 w-4" aria-hidden="true" /> Encerrar pacote
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <EditPackageModal pkg={pkg} open={isEditingPackage} onOpenChange={setIsEditingPackage} />
          <PackageLifecycleDialog
            pkg={pkg}
            patientId={patientId}
            operationType={lifecycleOperation}
            onOpenChange={(nextOpen) => {
              if (!nextOpen) setLifecycleOperation(null);
            }}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="desktop-retina-inset rounded-2xl border border-border/50 bg-background/52 p-4">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Utilizadas</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-foreground">{pkg.sessions_used}</span>
              <span className="text-xs font-bold text-muted-foreground">/ {pkg.total_sessions}</span>
            </div>
          </div>
          <div className="desktop-retina-inset rounded-2xl border border-border/50 bg-background/52 p-4 text-center">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Reservadas</span>
            <span className="mt-1 block text-2xl font-black text-foreground">{sessionsReserved}</span>
          </div>
          <div className="desktop-retina-inset rounded-2xl border border-border/50 bg-background/52 p-4 text-right">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Disponíveis</span>
            <span className="mt-1 block text-2xl font-black text-foreground">{sessionsAvailable}</span>
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
          <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            <span>Consumo realizado</span>
            <span className="text-foreground">{Math.round(progressValue)}%</span>
          </div>
        </div>

        <div className="mt-2 flex items-end justify-between border-t border-border/60 pt-6">
          <div className="flex flex-col gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3 opacity-50" aria-hidden="true" />
              <span>Início: {pkg.start_date ? format(new Date(`${pkg.start_date}T00:00:00`), "dd/MM/yyyy") : "não informado"}</span>
            </div>
            {pkg.end_date ? (
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3 opacity-50" aria-hidden="true" />
                <span>Validade: {format(new Date(`${pkg.end_date}T00:00:00`), "dd/MM/yyyy")}</span>
              </div>
            ) : null}
          </div>
          <span className="text-sm font-black text-foreground">{formatCurrency(pkg.price)}</span>
        </div>
      </div>
    </motion.div>
  );
};
