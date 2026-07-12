import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Loader2, Check, Wallet, Repeat, ArrowRightLeft } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAddPatientPackage } from "@/hooks/use-add-patient-package";
import { useRecurringInvoices } from "@/hooks/use-recurring-invoices";
import { useAddTransaction } from "@/hooks/use-add-transaction";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const NewPackageSchema = z.object({
  description: z.string().min(5, { message: "A descrição é obrigatória." }),
  totalSessions: z.coerce.number().int().positive({ message: "O número de sessões deve ser positivo." }),
  price: z.coerce.number().optional(),
  startDate: z.date({ required_error: "A data de início é obrigatória." }),
  endDate: z.date().optional(),
  createFinancial: z.boolean().default(false),
  financialType: z.enum(["transaction", "recurring"]).optional(),
  recurrenceDay: z.coerce.number().min(1).max(31).optional(),
});

type NewPackageFormValues = z.infer<typeof NewPackageSchema>;

interface NewPackageFormProps {
  patientId: string;
  onSuccess: () => void;
}

export const NewPackageForm = ({ patientId, onSuccess }: NewPackageFormProps) => {
  const { mutate: addPackage, isPending: isAddingPackage } = useAddPatientPackage();
  const { addInvoice } = useRecurringInvoices();
  const { mutate: addTransaction } = useAddTransaction();

  const [showFinancialOptions, setShowFinancialOptions] = useState(false);

  const form = useForm<NewPackageFormValues>({
    resolver: zodResolver(NewPackageSchema),
    defaultValues: {
      description: "",
      totalSessions: 4,
      price: undefined,
      startDate: new Date(),
      endDate: undefined,
      createFinancial: false,
      financialType: "transaction",
      recurrenceDay: 5,
    },
  });

  const financialType = form.watch("financialType");

  const onSubmit = (values: NewPackageFormValues) => {
    addPackage({
      patientId,
      description: values.description,
      totalSessions: values.totalSessions,
      price: values.price || null,
      startDate: values.startDate,
      endDate: values.endDate || null,
      dueDay: values.recurrenceDay,
    }, {
      onSuccess: () => {
        // Integração Financeira
        if (values.createFinancial && values.price && values.price > 0) {

          if (values.financialType === 'transaction') {
            // Criar Transação Única (À Vista)
            addTransaction({
              description: `Plano: ${values.description}`,
              amount: values.price,
              type: 'income',
              category: 'Pacotes',
              date: new Date(),
            }, {
              onSuccess: () => toast.success("Plano e lançamento financeiro registrados.")
            });
          } else if (values.financialType === 'recurring') {
            // Criar Recorrência (Mensalidade)
            addInvoice({
              patient_id: patientId,
              amount: values.price,
              description: `Mensalidade: ${values.description}`,
              day_of_month: values.recurrenceDay || 5,
              active: true,
            }, {
              onSuccess: () => toast.success("Plano e cobrança recorrente criados.")
            });
          }

        } else {
          toast.success("Plano de sessões adicionado com sucesso.");
        }

        form.reset();
        onSuccess();
      },
      onError: (error) => {
        toast.error(`Erro ao adicionar o plano: ${error.message}`);
      },
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider font-semibold ml-1">Descrição</FormLabel>
              <FormControl>
                <Input placeholder="Ex.: Plano mensal (4 sessões)" {...field} className="desktop-retina-inset h-11 rounded-xl border-border/50 bg-background/58 text-foreground focus:bg-background" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="totalSessions"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider font-semibold ml-1">Qtd. Sessões</FormLabel>
                <FormControl>
                  <Input type="number" min={1} placeholder="4" {...field} className="desktop-retina-inset h-11 rounded-xl border-border/50 bg-background/58 text-foreground focus:bg-background" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider font-semibold ml-1">Preço (R$)</FormLabel>
                <FormControl>
                  <Input type="number" inputMode="decimal" placeholder="600,00" {...field} className="desktop-retina-inset h-11 rounded-xl border-border/50 bg-background/58 text-foreground focus:bg-background" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider font-semibold ml-1 mb-1.5">Início</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "h-11 w-full rounded-xl border-border/50 bg-background/58 px-3 pl-3 text-left font-normal text-foreground hover:bg-muted",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? format(field.value, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="desktop-retina-modal w-auto border-border/60 bg-popover/96 p-0" align="start">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={ptBR} />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider font-semibold ml-1 mb-1.5">Fim (Opcional)</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "h-11 w-full rounded-xl border-border/50 bg-background/58 px-3 pl-3 text-left font-normal text-foreground hover:bg-muted",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? format(field.value, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="desktop-retina-modal w-auto border-border/60 bg-popover/96 p-0" align="start">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={ptBR} />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Financial Integration Section */}
        <div className="desktop-retina-inset space-y-4 rounded-xl border border-border/50 bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg border border-emerald-500/20">
                <Wallet className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <span className="block text-xs font-bold text-foreground">Registrar também no Financeiro?</span>
                <span className="block text-[10px] text-muted-foreground">Cria o lançamento automaticamente</span>
              </div>
            </div>
            <FormField
              control={form.control}
              name="createFinancial"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(val) => {
                        field.onChange(val);
                        setShowFinancialOptions(val);
                      }}
                      className="data-[state=checked]:bg-emerald-500"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          {showFinancialOptions && (
            <div className="animate-fade-in space-y-4 border-t border-border/45 pt-2">
              <FormField
                control={form.control}
                name="financialType"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="grid grid-cols-2 gap-2"
                      >
                        <div>
                          <RadioGroupItem value="transaction" id="transaction" className="peer sr-only" />
                          <label
                            htmlFor="transaction"
                            className={cn(
                              "flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl border cursor-pointer transition-all",
                              field.value === 'transaction'
                                ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
                                : "border-border/45 bg-background/45 text-muted-foreground hover:bg-muted"
                            )}
                          >
                            <ArrowRightLeft className="h-4 w-4" />
                            <span className="text-[10px] font-bold uppercase tracking-wide">À vista</span>
                          </label>
                        </div>

                        <div>
                          <RadioGroupItem value="recurring" id="recurring" className="peer sr-only" />
                          <label
                            htmlFor="recurring"
                            className={cn(
                              "flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl border cursor-pointer transition-all",
                              field.value === 'recurring'
                                ? "border-foreground/25 bg-foreground/10 text-foreground"
                                : "border-border/45 bg-background/45 text-muted-foreground hover:bg-muted"
                            )}
                          >
                            <Repeat className="h-4 w-4" />
                            <span className="text-[10px] font-bold uppercase tracking-wide">Mensal</span>
                          </label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />

              {financialType === 'recurring' && (
                <FormField
                  control={form.control}
                  name="recurrenceDay"
                  render={({ field }) => (
                    <FormItem className="animate-fade-in">
                      <div className="flex items-center justify-between rounded-lg border border-border/45 bg-background/45 p-3">
                        <span className="text-xs text-foreground/80">Dia do vencimento</span>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={31}
                            {...field}
                            className="h-9 w-16 border-border/50 bg-background text-center text-xs"
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          )}
        </div>

        <Button type="submit" className="w-full gap-2 h-12 rounded-xl shadow-glow mt-2 bg-primary hover:bg-primary/90 text-white transition-all" disabled={isAddingPackage}>
          {isAddingPackage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 stroke-[3]" />}
          {isAddingPackage ? "Salvando..." : "Criar plano"}
        </Button>
      </form>
    </Form>
  );
};
