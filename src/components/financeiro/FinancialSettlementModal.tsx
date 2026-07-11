"use client";
import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildFinancialEntryIdempotencyKey,
  type FinancialEntryPaymentMethod,
  useTransitionFinancialEntry,
} from "@/hooks/use-financial-entries";
import { managementOutstandingAmountOf } from "@/lib/financial-management-model";
import type { Transaction } from "@/types";
const METHODS: Array<{ value: FinancialEntryPaymentMethod; label: string }> = [
  { value: "pix", label: "Pix" },
  { value: "cash", label: "Dinheiro" },
  { value: "card", label: "Cartão" },
  { value: "external_transfer", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "convenio", label: "Convênio" },
  { value: "manual", label: "Outro meio" },
];
const money = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function FinancialSettlementModal({
  transaction,
  open,
  onOpenChange,
}: {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const transition = useTransitionFinancialEntry();
  const op = useRef(crypto.randomUUID());
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [method, setMethod] = useState<FinancialEntryPaymentMethod>("pix");
  useEffect(() => {
    if (open && transaction) {
      op.current = crypto.randomUUID();
      setAmount(
        managementOutstandingAmountOf(transaction).toFixed(2).replace(".", ","),
      );
      setDate(format(new Date(), "yyyy-MM-dd"));
    }
  }, [open, transaction]);
  if (!transaction) return null;
  const meta = (transaction.metadata || {}) as Record<string, unknown>;
  const linked = Boolean(meta.neurofinance_charge_id);
  const value = Number(amount.replace(/\./g, "").replace(",", "."));
  const submit = async () => {
    if (!Number.isFinite(value) || value <= 0)
      return toast.error("Informe um valor maior que zero.");
    try {
      const r = await transition.mutateAsync({
        id: transaction.id,
        action: "settle",
        amount: value,
        effectiveAt: new Date(`${date}T12:00:00`),
        paymentMethod: method,
        idempotencyKey: buildFinancialEntryIdempotencyKey([
          "settlement",
          transaction.id,
          op.current,
        ]),
      });
      toast.success(
        Number(r.remaining_amount) > 0
          ? `Baixa parcial registrada. Restam ${money(Number(r.remaining_amount))}.`
          : "Recebimento registrado.",
      );
      onOpenChange(false);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível registrar a baixa.",
      );
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="finance-modal-surface finance-modal-form max-w-md rounded-[24px]">
        <DialogTitle>
          Registrar{" "}
          {transaction.type === "income" ? "recebimento" : "pagamento"}
        </DialogTitle>
        <DialogDescription>
          Baixa total ou parcial com histórico auditável.
        </DialogDescription>
        <div className="finance-inset rounded-2xl border p-4">
          <p className="font-medium">{transaction.description}</p>
          <p className="text-xs text-muted-foreground">
            Saldo: {money(managementOutstandingAmountOf(transaction))}
          </p>
        </div>
        {linked ? (
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[.07] p-3 text-sm">
            A baixa deve vir da conciliação NeuroFinance.
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Valor</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Data</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label>Forma</Label>
          <Select
            value={method}
            onValueChange={(v) => setMethod(v as FinancialEntryPaymentMethod)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METHODS.map((x) => (
                <SelectItem key={x.value} value={x.value}>
                  {x.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={transition.isPending || linked}>
            {transition.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
