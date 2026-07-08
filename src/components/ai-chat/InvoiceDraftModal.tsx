import { useEffect, useState } from "react";
import { CheckCircle, DollarSign, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AppModalShell, ModalHeroIcon } from "@/components/ui/app-modal-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGenerateInvoice } from "@/hooks/use-generate-invoice";
import { usePatients } from "@/hooks/use-patients";

export type InvoiceDraftData = {
  patientName?: string;
  patientId?: string;
  amount: number;
  description: string;
  dueDate?: string;
};

interface InvoiceDraftModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: InvoiceDraftData | null;
  onSent: () => void;
}

export const InvoiceDraftModal = ({ open, onOpenChange, initialData, onSent }: InvoiceDraftModalProps) => {
  const { mutate: generateInvoice, isPending } = useGenerateInvoice();
  const { data: patients } = usePatients();

  const [patientId, setPatientId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (!initialData || !open) return;

    setAmount(initialData.amount?.toString() || "");
    setDescription(initialData.description || "Sessões de Terapia");

    if (initialData.patientId) {
      setPatientId(initialData.patientId);
    } else if (initialData.patientName && patients) {
      const patientName = initialData.patientName.toLowerCase();
      const found = patients.find((patient) => patient.name.toLowerCase().includes(patientName));
      if (found) setPatientId(found.id);
    }

    if (initialData.dueDate) {
      setDueDate(initialData.dueDate);
    } else {
      const fallbackDueDate = new Date();
      fallbackDueDate.setDate(fallbackDueDate.getDate() + 3);
      setDueDate(fallbackDueDate.toISOString().split("T")[0]);
    }
  }, [initialData, open, patients]);

  const handleConfirm = () => {
    if (!patientId || !amount || !dueDate) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    generateInvoice({
      patientId,
      amount: Number.parseFloat(amount),
      description,
      dueDate: new Date(dueDate),
    }, {
      onSuccess: () => {
        onSent();
        onOpenChange(false);
      },
    });
  };

  return (
    <AppModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="Gerar cobrança"
      description="A IA preparou este lançamento financeiro. Confira os dados antes de emitir."
      eyebrow="Synapse"
      size="md"
      preventClose={isPending}
      heroIcon={<ModalHeroIcon icon={DollarSign} ariaLabel="Cobrança preparada" />}
      bodyClassName="space-y-5 pb-5"
      footerClassName="border-t border-border/55 bg-background/92 dark:border-white/10 dark:bg-[#09090b]/92"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="h-11 rounded-xl px-6 text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isPending} className="h-11 rounded-xl px-6 shadow-lg">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            Emitir Cobrança
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="ml-1 text-[10px] font-bold uppercase text-muted-foreground">Paciente</Label>
          <Select value={patientId} onValueChange={setPatientId}>
            <SelectTrigger className="h-11 rounded-xl border-border/55 bg-muted/35 text-xs text-foreground focus:ring-1 dark:border-white/[0.075]">
              <SelectValue placeholder="Selecione o paciente..." />
            </SelectTrigger>
            <SelectContent className="border-border/40 bg-popover/95 backdrop-blur-xl">
              {patients?.map((patient) => (
                <SelectItem key={patient.id} value={patient.id}>{patient.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="ml-1 text-[10px] font-bold uppercase text-muted-foreground">Valor (R$)</Label>
            <Input
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="h-11 rounded-xl border-border/55 bg-muted/35 text-lg font-bold text-foreground focus-visible:ring-1 dark:border-white/[0.075]"
            />
          </div>
          <div className="space-y-2">
            <Label className="ml-1 text-[10px] font-bold uppercase text-muted-foreground">Vencimento</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="h-11 rounded-xl border-border/55 bg-muted/35 text-xs text-foreground focus-visible:ring-1 dark:border-white/[0.075]"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="ml-1 text-[10px] font-bold uppercase text-muted-foreground">Descrição</Label>
          <Input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="h-11 rounded-xl border-border/55 bg-muted/35 text-sm text-foreground focus-visible:ring-1 dark:border-white/[0.075]"
          />
        </div>
      </div>
    </AppModalShell>
  );
};
