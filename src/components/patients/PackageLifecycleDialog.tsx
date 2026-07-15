import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, Loader2, PackageSearch } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  type PackageFinancialStrategy,
  type PackageLifecycleOperation,
  type PackageLifecycleScope,
  usePackageFutureOccurrences,
  usePackageLifecycle,
} from "@/hooks/use-package-lifecycle";
import { usePatientPackages } from "@/hooks/use-patient-packages";
import type { PatientPackage } from "@/types";
import { cn } from "@/lib/utils";

interface PackageLifecycleDialogProps {
  pkg: PatientPackage;
  patientId: string;
  operationType: PackageLifecycleOperation | null;
  onOpenChange: (open: boolean) => void;
}

const operationCopy: Record<PackageLifecycleOperation, { title: string; description: string }> = {
  replace: {
    title: "Substituir pacote nas sessões futuras",
    description: "O histórico realizado permanece no pacote atual. Somente reservas futuras podem mudar.",
  },
  end: {
    title: "Encerrar pacote",
    description: "O pacote será encerrado e suas reservas futuras serão liberadas.",
  },
  release: {
    title: "Remover vínculo das sessões futuras",
    description: "Libera reservas futuras sem apagar o pacote ou os movimentos anteriores.",
  },
};

const scopeOptions: Array<{ value: PackageLifecycleScope; title: string; detail: string }> = [
  { value: "only_this", title: "Somente esta ocorrência", detail: "Altera uma única sessão futura." },
  { value: "this_and_next", title: "Esta e todas as próximas", detail: "Usa a ocorrência selecionada como início da série." },
  { value: "all_future", title: "Todas as ocorrências futuras não realizadas", detail: "Recomendado para as sessões restantes do pacote." },
];

const financialOptions: Array<{ value: PackageFinancialStrategy; title: string; detail: string }> = [
  { value: "keep_existing", title: "Manter cobranças compatíveis", detail: "Não chama o Asaas novamente quando as condições permanecem iguais." },
  { value: "cancel_and_recreate_per_session", title: "Cancelar e preparar cobranças por sessão", detail: "As novas cobranças só serão liberadas após a confirmação dos cancelamentos." },
  { value: "cancel_and_create_single", title: "Cancelar e preparar uma cobrança do pacote", detail: "Prepara uma cobrança única conforme a política do novo pacote." },
  { value: "cancel_without_replacement", title: "Cancelar porque o novo pacote já cobre as sessões", detail: "Não prepara outra cobrança para as ocorrências." },
  { value: "manual_review", title: "Lançamento financeiro manual", detail: "Conclui o vínculo interno e abre uma pendência financeira." },
];

const formatDateTime = (value: string) =>
  format(new Date(value), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR });

export function PackageLifecycleDialog({
  pkg,
  patientId,
  operationType,
  onOpenChange,
}: PackageLifecycleDialogProps) {
  const open = operationType !== null;
  const [step, setStep] = useState<"configure" | "review">("configure");
  const [scope, setScope] = useState<PackageLifecycleScope>("all_future");
  const [targetPackageId, setTargetPackageId] = useState<string>("");
  const [anchorAppointmentId, setAnchorAppointmentId] = useState<string>("");
  const [financialStrategy, setFinancialStrategy] = useState<PackageFinancialStrategy>("keep_existing");
  const [reason, setReason] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const { data: packages = [] } = usePatientPackages(patientId);
  const { data: occurrences = [], isLoading: isLoadingOccurrences } = usePackageFutureOccurrences(pkg.id, open);
  const {
    preview,
    previewResult,
    previewError,
    resetPreview,
    isPreviewing,
    execute,
    isExecuting,
  } = usePackageLifecycle();

  const eligibleTargets = useMemo(
    () => packages.filter((candidate) =>
      candidate.id !== pkg.id
      && candidate.package_status === "active"
      && String(candidate.active ?? "true") !== "false"),
    [packages, pkg.id],
  );

  useEffect(() => {
    if (!open) return;
    setStep("configure");
    setScope(operationType === "end" ? "all_future" : "all_future");
    setTargetPackageId("");
    setAnchorAppointmentId("");
    setFinancialStrategy("keep_existing");
    setReason("");
    setIdempotencyKey(`package-lifecycle:${crypto.randomUUID()}`);
    resetPreview();
  }, [open, operationType, resetPreview]);

  if (!operationType) return null;
  const copy = operationCopy[operationType];

  const previewImpact = async () => {
    const result = await preview({
      sourcePackageId: pkg.id,
      targetPackageId: operationType === "replace" ? targetPackageId || null : null,
      operationType,
      scope,
      anchorAppointmentId: scope === "all_future" ? null : anchorAppointmentId || null,
      financialStrategy,
    });
    if (result) setStep("review");
  };

  const confirm = async () => {
    if (!previewResult) return;
    const result = await execute({
      sourcePackageId: pkg.id,
      targetPackageId: operationType === "replace" ? targetPackageId || null : null,
      operationType,
      scope,
      anchorAppointmentId: scope === "all_future" ? null : anchorAppointmentId || null,
      financialStrategy,
      reason,
      idempotencyKey,
      expectedAppointmentIds: previewResult.occurrences.map((occurrence) => occurrence.appointmentId),
    });
    if (result) onOpenChange(false);
  };

  const canPreview = operationType !== "replace" || Boolean(targetPackageId);
  const hasReview = Boolean(previewResult?.reviewReasons.length);
  const hasHardBlocks = Boolean(previewResult?.hardBlocks.length);
  const availableFinancialOptions = operationType === "replace"
    ? financialOptions
    : financialOptions.filter((option) =>
      !["cancel_and_recreate_per_session", "cancel_and_create_single"].includes(option.value));
  const confirmLabel = operationType === "replace"
    ? "Confirmar substituição"
    : operationType === "end"
    ? "Confirmar encerramento"
    : "Confirmar remoção do vínculo";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border/60 px-6 py-5">
          <div className="flex items-start gap-3">
            {step === "review" ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="-ml-2 h-11 w-11 shrink-0 rounded-full"
                onClick={() => setStep("configure")}
                aria-label="Voltar para as opções"
              >
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </Button>
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted">
                <PackageSearch className="h-5 w-5" aria-hidden="true" />
              </div>
            )}
            <div>
              <DialogTitle>{step === "review" ? "Revise o impacto" : copy.title}</DialogTitle>
              <DialogDescription className="mt-1">{copy.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(100dvh-14rem)]">
          {step === "configure" ? (
            <div className="space-y-6 px-6 py-5">
              {operationType === "replace" ? (
                <div className="space-y-2">
                  <Label htmlFor="target-package">Novo pacote</Label>
                  <Select value={targetPackageId} onValueChange={setTargetPackageId}>
                    <SelectTrigger id="target-package">
                      <SelectValue placeholder="Selecione o Pacote B" />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleTargets.map((candidate) => (
                        <SelectItem key={candidate.id} value={candidate.id}>
                          {candidate.description} · {Math.max(candidate.total_sessions - candidate.sessions_used - (candidate.sessions_reserved || 0), 0)} disponíveis
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!eligibleTargets.length ? (
                    <p className="text-xs text-amber-600">Não há outro pacote ativo deste paciente.</p>
                  ) : null}
                </div>
              ) : null}

              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-foreground">Escopo</legend>
                <RadioGroup
                  value={scope}
                  onValueChange={(value) => setScope(value as PackageLifecycleScope)}
                  disabled={operationType === "end"}
                >
                  {scopeOptions.map((option) => (
                    <Label
                      key={option.value}
                      htmlFor={`scope-${option.value}`}
                      className={cn(
                        "flex min-h-14 cursor-pointer items-start gap-3 rounded-2xl border p-4",
                        scope === option.value ? "border-foreground/30 bg-muted/55" : "border-border/60",
                        operationType === "end" && option.value !== "all_future" && "opacity-45",
                      )}
                    >
                      <RadioGroupItem id={`scope-${option.value}`} value={option.value} className="mt-0.5" />
                      <span>
                        <span className="block text-sm font-semibold">{option.title}</span>
                        <span className="mt-1 block text-xs font-normal text-muted-foreground">{option.detail}</span>
                      </span>
                    </Label>
                  ))}
                </RadioGroup>
              </fieldset>

              {scope !== "all_future" ? (
                <div className="space-y-2">
                  <Label htmlFor="anchor-appointment">Ocorrência inicial</Label>
                  <Select value={anchorAppointmentId} onValueChange={setAnchorAppointmentId} disabled={isLoadingOccurrences}>
                    <SelectTrigger id="anchor-appointment">
                      <SelectValue placeholder={isLoadingOccurrences ? "Carregando sessões…" : "Selecione a sessão"} />
                    </SelectTrigger>
                    <SelectContent>
                      {occurrences.map((occurrence) => (
                        <SelectItem key={occurrence.appointmentId} value={occurrence.appointmentId}>
                          {formatDateTime(occurrence.startTime)}
                          {occurrence.occurrenceNumber ? ` · ${occurrence.occurrenceNumber} de ${occurrence.occurrenceCount}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-foreground">Tratamento das cobranças futuras</legend>
                <RadioGroup
                  value={financialStrategy}
                  onValueChange={(value) => setFinancialStrategy(value as PackageFinancialStrategy)}
                >
                  {availableFinancialOptions.map((option) => (
                    <Label
                      key={option.value}
                      htmlFor={`financial-${option.value}`}
                      className={cn(
                        "flex min-h-14 cursor-pointer items-start gap-3 rounded-2xl border p-4",
                        financialStrategy === option.value ? "border-foreground/30 bg-muted/55" : "border-border/60",
                      )}
                    >
                      <RadioGroupItem id={`financial-${option.value}`} value={option.value} className="mt-0.5" />
                      <span>
                        <span className="block text-sm font-semibold">{option.title}</span>
                        <span className="mt-1 block text-xs font-normal text-muted-foreground">{option.detail}</span>
                      </span>
                    </Label>
                  ))}
                </RadioGroup>
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor="package-lifecycle-reason">Motivo</Label>
                <Textarea
                  id="package-lifecycle-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Ex.: pacote substituído após uso parcial"
                  rows={3}
                />
              </div>

              {previewError ? (
                <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  {previewError.message}
                </div>
              ) : null}
            </div>
          ) : previewResult ? (
            <div className="space-y-5 px-6 py-5">
              <section className="rounded-2xl border border-border/60 bg-muted/30 p-5">
                <p className="text-base font-semibold">
                  Você está {operationType === "replace" ? "substituindo o pacote" : operationType === "end" ? "encerrando o pacote" : "removendo o vínculo"} das {previewResult.affectedCount} sessões restantes.
                </p>
                {previewResult.firstStartTime && previewResult.lastStartTime ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    De {formatDateTime(previewResult.firstStartTime)} até {formatDateTime(previewResult.lastStartTime)}.
                  </p>
                ) : null}
              </section>

              <div className="grid gap-4 sm:grid-cols-2">
                <section className="rounded-2xl border border-border/60 p-4">
                  <h3 className="text-sm font-semibold">Histórico preservado</h3>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <li>{previewResult.preservedHistory.consumedSessions} sessões realizadas e consumidas</li>
                    <li>{previewResult.preservedHistory.paidCharges} cobranças pagas</li>
                    <li>{previewResult.preservedHistory.fiscalDocuments} documentos fiscais preservados</li>
                  </ul>
                </section>
                <section className="rounded-2xl border border-border/60 p-4">
                  <h3 className="text-sm font-semibold">Alterações futuras</h3>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <li>{previewResult.affectedCount} reservas serão liberadas no pacote atual</li>
                    {operationType === "replace" ? <li>{previewResult.affectedCount} sessões serão reservadas no novo pacote</li> : null}
                    <li>{previewResult.financialImpact.pendingCharges} cobranças futuras serão avaliadas</li>
                  </ul>
                </section>
              </div>

              {previewResult.hardBlocks.map((message) => (
                <div key={message} role="alert" className="flex gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {message}
                </div>
              ))}
              {previewResult.reviewReasons.map((message) => (
                <div key={message} role="alert" className="flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {message}
                </div>
              ))}

              <section>
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  Sessões afetadas
                </h3>
                <ol className="mt-3 divide-y divide-border/60 rounded-2xl border border-border/60">
                  {previewResult.occurrences.map((occurrence) => (
                    <li key={occurrence.appointmentId} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <span>{formatDateTime(occurrence.startTime)}</span>
                      {occurrence.occurrenceNumber ? (
                        <span className="text-xs text-muted-foreground">{occurrence.occurrenceNumber} de {occurrence.occurrenceCount}</span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </section>

              {!hasHardBlocks && !hasReview ? (
                <div className="flex gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  O passado permanecerá intacto. A operação está pronta para confirmação.
                </div>
              ) : null}
            </div>
          ) : null}
        </ScrollArea>

        <DialogFooter className="border-t border-border/60 bg-background px-6 py-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isExecuting}>
            Cancelar
          </Button>
          {step === "configure" ? (
            <Button
              type="button"
              onClick={() => void previewImpact()}
              disabled={!canPreview || (scope !== "all_future" && !anchorAppointmentId) || reason.trim().length < 3 || isPreviewing}
            >
              {isPreviewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
              Analisar impacto
            </Button>
          ) : (
            <Button type="button" onClick={() => void confirm()} disabled={hasHardBlocks || isExecuting}>
              {isExecuting ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
              {hasReview ? "Enviar para revisão" : confirmLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
