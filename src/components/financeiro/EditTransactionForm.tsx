import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateTransaction } from "@/hooks/use-update-transaction";
import { cn } from "@/lib/utils";
import { NewTransactionFormValues, NewTransactionSchema } from "@/lib/validation";
import { Transaction } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Banknote, Barcode, Calendar as CalendarIcon, CreditCard, DollarSign, Loader2, QrCode, Save, TrendingDown, TrendingUp } from "lucide-react";
import { useForm } from "react-hook-form";

interface EditTransactionFormProps {
  transaction: Transaction;
  onSuccess: () => void;
}

export const EditTransactionForm = ({ transaction, onSuccess }: EditTransactionFormProps) => {
  const { mutate, isPending } = useUpdateTransaction();

  const form = useForm<NewTransactionFormValues>({
    resolver: zodResolver(NewTransactionSchema),
    defaultValues: {
      description: transaction.description,
      amount: transaction.amount,
      type: transaction.type,
      category: transaction.category || "",
      date: new Date(transaction.date + 'T00:00:00'),
      payment_method: (transaction.payment_method || 'pix') as any,
      installments: transaction.installments || 1,
      external_reference: transaction.external_reference || ""
    },
  });

  const paymentMethod = form.watch("payment_method");

  const onSubmit = (values: NewTransactionFormValues) => {
    const updates = {
      description: values.description,
      amount: values.amount,
      type: values.type,
      category: values.category || null,
      date: values.date.toISOString().split('T')[0],
      payment_method: values.payment_method,
      installments: values.installments,
      external_reference: values.external_reference
    };

    mutate({ id: transaction.id, updates }, {
      onSuccess: () => {
        onSuccess();
      },
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="desktop-retina-form space-y-5">

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="ml-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Tipo de lançamento</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="grid grid-cols-2 gap-3"
                >
                  <FormItem className="space-y-0">
                    <FormControl>
                      <div>
                        <RadioGroupItem value="income" id="income" className="peer sr-only" />
                        <label
                          htmlFor="income"
                          className={cn(
                            "desktop-retina-interactive flex min-h-20 cursor-pointer flex-col items-center justify-center gap-2 rounded-[18px] border p-3 transition-colors",
                            field.value === "income"
                              ? "border-foreground bg-foreground text-background"
                              : "desktop-retina-inset border-border/45 bg-background/58 text-muted-foreground hover:bg-muted"
                          )}
                        >
                          <TrendingUp className="h-5 w-5" />
                          <span className="text-xs font-bold uppercase tracking-wider">Receita</span>
                        </label>
                      </div>
                    </FormControl>
                  </FormItem>

                  <FormItem className="space-y-0">
                    <FormControl>
                      <div>
                        <RadioGroupItem value="expense" id="expense" className="peer sr-only" />
                        <label
                          htmlFor="expense"
                          className={cn(
                            "desktop-retina-interactive flex min-h-20 cursor-pointer flex-col items-center justify-center gap-2 rounded-[18px] border p-3 transition-colors",
                            field.value === "expense"
                              ? "border-foreground bg-foreground text-background"
                              : "desktop-retina-inset border-border/45 bg-background/58 text-muted-foreground hover:bg-muted"
                          )}
                        >
                          <TrendingDown className="h-5 w-5" />
                          <span className="text-xs font-bold uppercase tracking-wider">Despesa</span>
                        </label>
                      </div>
                    </FormControl>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider font-semibold ml-1">Descrição</FormLabel>
              <FormControl>
                <Input placeholder="Ex.: Sessão de psicoterapia" {...field} className="h-11 rounded-xl border-border/45 bg-background/64" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider font-semibold ml-1">
                  Valor (R$)

                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="number" min="0" step="0.01" placeholder="0,00" {...field} className="h-11 rounded-xl border-border/45 bg-background/64 pl-9 font-mono" />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider font-semibold ml-1">Categoria</FormLabel>
                <FormControl>
                  <Input placeholder="Ex.: Terapia" {...field} className="h-11 rounded-xl border-border/45 bg-background/64" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="desktop-retina-inset space-y-3 rounded-[20px] border border-border/45 bg-background/52 p-4">
          <FormField
            control={form.control}
            name="payment_method"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Método</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="grid grid-cols-3 gap-2"
                  >
                    {[{ id: 'pix', icon: QrCode, l: 'Pix' }, { id: 'money', icon: Banknote, l: 'Dinheiro' }, { id: 'credit_card', icon: CreditCard, l: 'Cartão' }, { id: 'boleto', icon: Barcode, l: 'Boleto' }].map((m) => (
                      <FormItem key={m.id}>
                        <FormControl>
                          <RadioGroupItem value={m.id} id={m.id} className="peer sr-only" />
                        </FormControl>
                        <label htmlFor={m.id} className="flex min-h-14 cursor-pointer flex-col items-center justify-center rounded-xl bg-muted/45 p-2 text-muted-foreground transition-colors hover:bg-muted peer-data-[state=checked]:bg-foreground peer-data-[state=checked]:text-background">
                          <m.icon className="h-4 w-4 mb-1" />
                          <span className="text-[9px] font-bold uppercase">{m.l}</span>
                        </label>
                      </FormItem>
                    ))}
                  </RadioGroup>
                </FormControl>
              </FormItem>
            )}
          />

          {/* Installments for Credit Card */}
          {paymentMethod === 'credit_card' && (
            <FormField
              control={form.control}
              name="installments"
              render={({ field }) => (
                <FormItem className="animate-fade-in">
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Parcelas</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                      <FormControl>
                        <SelectTrigger className="h-9 w-24 rounded-xl border-border/45 bg-background/65 text-xs"><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent className="desktop-retina-modal border-border/55 bg-popover/96">
                        {[1, 2, 3, 4, 5, 6, 10, 12].map(i => <SelectItem key={i} value={String(i)}>{i}x</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </FormItem>
              )}
            />
          )}
        </div>

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider font-semibold ml-1 mb-1.5">Data</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "h-11 w-full rounded-xl border-border/45 bg-background/64 pl-3 text-left font-normal hover:bg-muted",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? format(field.value, "dd/MM/yyyy", { locale: ptBR }) : <span>Escolha uma data</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="desktop-retina-modal w-auto border-border/55 bg-popover/96 p-0" align="start">
                  <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={ptBR} />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="external_reference"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="ml-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Referência ou comprovante
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="Opcional: número do recibo ou referência externa"
                  {...field}
                  className="h-11 rounded-xl border-border/45 bg-background/64"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="h-12 w-full gap-2 rounded-xl bg-foreground text-background hover:bg-foreground/90" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="h-4 w-4" />
          {isPending ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </form>
    </Form>
  );
};
