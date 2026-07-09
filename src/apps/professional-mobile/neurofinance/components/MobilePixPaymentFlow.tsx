import { useCallback, useEffect, useState } from "react";
import { Camera, Check, Loader2, QrCode, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  MobileFinanceSheet,
  formatMoney,
  mobileFinanceSurface,
  parseMoney,
} from "../../shared/MobileFinancePrimitives";
import { MobileCodeScannerSheet } from "./MobileCodeScannerSheet";
import { MobileFinancialPinSheet } from "./MobileFinancialPinSheet";
import {
  authorizePixPayment,
  consultPixPayment,
  executePixPayment,
  type OperationResult,
  type PixPaymentConsultation,
} from "../services/neurofinance-mobile-api";

export function MobilePixPaymentFlow({
  open,
  onOpenChange,
  onCompleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
}) {
  const [payload, setPayload] = useState("");
  const [consultation, setConsultation] =
    useState<PixPaymentConsultation | null>(null);
  const [editableAmount, setEditableAmount] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OperationResult | null>(null);

  useEffect(() => {
    if (consultation?.amount) {
      setEditableAmount(
        consultation.amount.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
      );
    }
  }, [consultation]);

  const consult = useCallback(async (nextPayload = payload) => {
    const trimmedPayload = nextPayload.trim();
    if (!trimmedPayload || trimmedPayload.length < 10) {
      toast.error("Código Pix inválido.");
      return;
    }
    setPayload(trimmedPayload);
    setBusy(true);
    try {
      const data = await consultPixPayment(trimmedPayload);
      setConsultation(data.consultation);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Pix inválido.");
    } finally {
      setBusy(false);
    }
  }, [payload]);

  const handleScannedPix = useCallback(async (value: string) => {
    const scannedPayload = value.trim();
    if (scannedPayload.length < 10) {
      toast.error("QR Code Pix inválido.");
      return;
    }
    await consult(scannedPayload);
  }, [consult]);

  const authorizeAndExecute = async (pin: string) => {
    if (!consultation) return;
    const value = consultation.canChangeValue
      ? parseMoney(editableAmount) || consultation.amount
      : consultation.amount;

    setBusy(true);
    try {
      await authorizePixPayment({
        requestId: consultation.id,
        pin,
        value,
      });
      const operation = await executePixPayment(consultation.id);
      setResult(operation);
      setPinOpen(false);
      onCompleted();
      toast.success("Pagamento Pix enviado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Pix não concluído.");
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setPayload("");
    setConsultation(null);
    setEditableAmount("");
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
                Operação enviada
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                Pix em processamento
              </h2>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                A confirmação e o comprovante aparecerão no extrato assim que liberados.
              </p>
              {result.receiptUrl ? (
                <Button
                  variant="outline"
                  onClick={() => window.open(result.receiptUrl!, "_blank", "noopener")}
                  className="mt-7 h-[52px] w-full rounded-[18px]"
                >
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
                Confirme o Pix
              </h2>

              <div className={cn(mobileFinanceSurface, "mt-6 space-y-4 p-5")}>
                <Row label="Recebedor" value={consultation.receiverName || "—"} />
                <Row
                  label="Instituição"
                  value={consultation.institutionName || "—"}
                />
                <Row label="Descrição" value={consultation.description || "Pix"} />
                <Row
                  label="Saldo disponível"
                  value={
                    consultation.availableBalance == null
                      ? "Indisponível"
                      : formatMoney(consultation.availableBalance)
                  }
                />
              </div>

              <label className="mt-5 block">
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Valor
                </span>
                <Input
                  value={editableAmount}
                  readOnly={!consultation.canChangeValue}
                  onChange={(event) => setEditableAmount(event.target.value)}
                  inputMode="decimal"
                  className="mt-2 h-14 rounded-[18px] border-border/50 bg-card text-xl font-semibold"
                />
                <span className="mt-2 block text-[10px] text-muted-foreground">
                  {consultation.canChangeValue
                    ? "O recebedor permite definir o valor."
                    : "O valor foi definido pelo recebedor."}
                </span>
              </label>

              {!consultation.canPayNow &&
              (consultation.availableBalance || 0) < parseMoney(editableAmount) ? (
                <p className="mt-4 rounded-[16px] border border-border/40 bg-card p-3 text-[11px] leading-4 text-muted-foreground">
                  O saldo disponível não cobre este pagamento.
                </p>
              ) : null}

              <Button
                disabled={
                  busy ||
                  parseMoney(editableAmount) <= 0 ||
                  (consultation.availableBalance != null &&
                    consultation.availableBalance < parseMoney(editableAmount))
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
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-border/40 bg-card">
                <QrCode className="h-5 w-5" strokeWidth={1.6} />
              </div>
              <p className="mt-6 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                NeuroFinance
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                Pagar Pix Copia e Cola
              </h2>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                O código será decodificado e os dados do recebedor serão exibidos antes da confirmação.
              </p>

              <label className="mt-6 block">
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Código Pix
                </span>
                <textarea
                  value={payload}
                  onChange={(event) => setPayload(event.target.value)}
                  placeholder="Cole o Pix Copia e Cola"
                  className="mt-2 min-h-32 w-full resize-none rounded-[20px] border border-border/50 bg-card p-4 text-sm outline-none"
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
                  Ler QR
                </Button>
                <Button
                  disabled={busy || !payload.trim()}
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
        title="Autorizar pagamento Pix"
        onConfirm={authorizeAndExecute}
      />
      <MobileCodeScannerSheet
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        mode="pix"
        busy={busy}
        onDetected={handleScannedPix}
      />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="max-w-[62%] text-right text-[12px]">{value}</span>
    </div>
  );
}
