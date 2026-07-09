import { useCallback, useEffect, useState } from "react";
import { Camera, Check, Loader2, ReceiptText, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeBoletoInput } from "@/lib/boleto";
import { cn } from "@/lib/utils";
import {
  MobileFinanceSheet,
  formatMoney,
  mobileFinanceSurface,
} from "../../shared/MobileFinancePrimitives";
import { MobileCodeScannerSheet } from "./MobileCodeScannerSheet";
import { MobileFinancialPinSheet } from "./MobileFinancialPinSheet";
import {
  authorizeBillPayment,
  consultBillPayment,
  executeBillPayment,
  type BillConsultation,
  type OperationResult,
} from "../services/neurofinance-mobile-api";

export function MobileBillPaymentFlow({
  open,
  onOpenChange,
  onCompleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
}) {
  const [line, setLine] = useState("");
  const [consultation, setConsultation] = useState<BillConsultation | null>(null);
  const [mode, setMode] = useState<"now" | "scheduled">("now");
  const [scheduleDate, setScheduleDate] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OperationResult | null>(null);

  useEffect(() => {
    if (consultation) {
      const nextMode =
        consultation.recommendedMode ||
        (consultation.canPayNow ? "now" : "scheduled");
      setMode(nextMode);
      setScheduleDate(consultation.defaultScheduleDate || consultation.dueDate || "");
    }
  }, [consultation]);

  const consult = useCallback(async (nextLine = line) => {
    const normalized = normalizeBoletoInput(nextLine);
    if (!normalized.isValid) {
      toast.error("Informe uma linha digitável ou código de barras válido.");
      return;
    }
    setLine(normalized.digits);
    setBusy(true);
    try {
      const data = await consultBillPayment(normalized.digits);
      setConsultation(data.consultation);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Boleto não localizado.");
    } finally {
      setBusy(false);
    }
  }, [line]);

  const handleScannedBill = useCallback(async (value: string) => {
    const normalized = normalizeBoletoInput(value);
    if (!normalized.isValid) {
      toast.error("Código de boleto inválido.");
      return;
    }
    await consult(normalized.digits);
  }, [consult]);

  const authorizeAndExecute = async (pin: string) => {
    if (!consultation) return;
    setBusy(true);
    try {
      await authorizeBillPayment({
        consultationId: consultation.id,
        paymentMode: mode,
        scheduleDate: mode === "scheduled" ? scheduleDate : undefined,
        pin,
      });
      const operation = await executeBillPayment(consultation.id);
      setResult(operation);
      setPinOpen(false);
      onCompleted();
      toast.success(
        operation.autoScheduled
          ? "Saldo alterado. O boleto foi agendado com segurança."
          : mode === "scheduled"
            ? "Boleto agendado."
            : "Pagamento enviado.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Operação não concluída.");
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setLine("");
    setConsultation(null);
    setResult(null);
    setPinOpen(false);
    setScannerOpen(false);
  };

  return (
    <>
      <MobileFinanceSheet
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next);
          if (!next) reset();
        }}
        bodyClassName="pb-[calc(28px+env(safe-area-inset-bottom))]"
      >
          {result ? (
            <div className="py-9 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background">
                <Check className="h-6 w-6" />
              </div>
              <p className="mt-6 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Operação confirmada
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                {result.autoScheduled ? "Boleto agendado" : "Pagamento enviado"}
              </h2>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                O status será atualizado automaticamente conforme a confirmação bancária.
              </p>
              {result.receiptUrl ? (
                <Button
                  variant="outline"
                  onClick={() => window.open(result.receiptUrl!, "_blank", "noopener")}
                  className="mt-7 h-[52px] w-full rounded-[18px]"
                >
                  <ReceiptText className="mr-2 h-4 w-4" />
                  Abrir comprovante
                </Button>
              ) : null}
            </div>
          ) : consultation ? (
            <div className="py-7">
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Revisão segura
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                Confirme o boleto
              </h2>

              <div className={cn(mobileFinanceSurface, "mt-6 space-y-4 p-5")}>
                <Row label="Beneficiário" value={consultation.beneficiaryName || "—"} />
                <Row
                  label="Instituição"
                  value={consultation.bankName || consultation.bankCode || "—"}
                />
                <Row
                  label="Vencimento"
                  value={
                    consultation.dueDate
                      ? new Date(`${consultation.dueDate}T12:00:00`).toLocaleDateString(
                          "pt-BR",
                        )
                      : "—"
                  }
                />
                <Row label="Valor" value={formatMoney(consultation.value)} />
                <Row label="Tarifa" value={formatMoney(consultation.fee)} />
                <Row
                  label="Total"
                  value={formatMoney(consultation.requiredBalance)}
                  strong
                />
                <Row
                  label="Saldo disponível"
                  value={
                    consultation.availableBalance == null
                      ? "Indisponível"
                      : formatMoney(consultation.availableBalance)
                  }
                />
              </div>

              <div className="mt-5 space-y-2">
                {consultation.canPayNow ? (
                  <button
                    type="button"
                    onClick={() => setMode("now")}
                    className={cn(
                      "w-full rounded-[20px] border p-4 text-left transition",
                      mode === "now"
                        ? "border-foreground bg-foreground text-background"
                        : "border-border/50 bg-card",
                    )}
                  >
                    <p className="text-sm font-semibold">Pagar agora com o saldo</p>
                    <p className="mt-1 text-[11px] opacity-65">
                      O saldo será validado novamente antes do envio.
                    </p>
                  </button>
                ) : null}

                {consultation.canSchedule ? (
                  <button
                    type="button"
                    onClick={() => setMode("scheduled")}
                    className={cn(
                      "w-full rounded-[20px] border p-4 text-left transition",
                      mode === "scheduled"
                        ? "border-foreground bg-foreground text-background"
                        : "border-border/50 bg-card",
                    )}
                  >
                    <p className="text-sm font-semibold">Agendar pagamento</p>
                    <p className="mt-1 text-[11px] opacity-65">
                      Escolha uma data válida até o vencimento.
                    </p>
                  </button>
                ) : null}
              </div>

              {!consultation.canPayNow && consultation.canSchedule ? (
                <p className="mt-3 rounded-[16px] border border-border/40 bg-card p-3 text-[11px] leading-4 text-muted-foreground">
                  O saldo atual não cobre o total. O NeuroFinance permite agendar este boleto para uma data futura válida.
                </p>
              ) : null}

              {mode === "scheduled" ? (
                <label className="mt-5 block">
                  <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Data de pagamento
                  </span>
                  <Input
                    type="date"
                    value={scheduleDate}
                    min={consultation.minimumScheduleDate || undefined}
                    max={consultation.dueDate || undefined}
                    onChange={(event) => setScheduleDate(event.target.value)}
                    className="mt-2 h-[52px] rounded-[18px] border-border/50 bg-card"
                  />
                </label>
              ) : null}

              <Button
                disabled={
                  busy ||
                  (!consultation.canPayNow && !consultation.canSchedule) ||
                  (mode === "scheduled" && !scheduleDate)
                }
                onClick={() => setPinOpen(true)}
                className="mt-6 h-14 w-full rounded-[20px] text-xs font-semibold uppercase tracking-[0.16em]"
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                Confirmar com biometria/PIN
              </Button>
            </div>
          ) : (
            <div className="py-7">
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                NeuroFinance
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                Pagar boleto
              </h2>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Informe a linha digitável. O valor, beneficiário, vencimento e saldo serão validados antes da autorização.
              </p>

              <label className="mt-6 block">
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Linha digitável
                </span>
                <Input
                  value={line}
                  onChange={(event) => setLine(event.target.value)}
                  inputMode="numeric"
                  placeholder="Cole ou digite os números"
                  className="mt-2 h-16 rounded-[20px] border-border/50 bg-card text-base"
                />
              </label>

              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setScannerOpen(true)}
                  className="h-14 rounded-[20px] text-xs font-semibold uppercase tracking-[0.12em]"
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Ler código
                </Button>
                <Button
                  disabled={busy || !normalizeBoletoInput(line).isValid}
                  onClick={() => void consult()}
                  className="h-14 rounded-[20px] text-xs font-semibold uppercase tracking-[0.12em]"
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Consultar
                </Button>
              </div>
            </div>
          )}
      </MobileFinanceSheet>

      <MobileFinancialPinSheet
        open={pinOpen}
        onOpenChange={setPinOpen}
        busy={busy}
        title={mode === "scheduled" ? "Autorizar agendamento" : "Autorizar pagamento"}
        onConfirm={authorizeAndExecute}
      />
      <MobileCodeScannerSheet
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        mode="boleto"
        busy={busy}
        onDetected={handleScannedBill}
      />
    </>
  );
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={cn("max-w-[60%] text-right text-[12px]", strong && "font-semibold")}>
        {value}
      </span>
    </div>
  );
}
