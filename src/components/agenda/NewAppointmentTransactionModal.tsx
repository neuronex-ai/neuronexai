"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { DollarSign, Loader2, TrendingUp, TrendingDown, Wallet, X, Calendar, Tag } from "lucide-react";
import { Appointment } from "@/types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAddAppointmentTransaction } from "@/hooks/use-add-appointment-transaction";


const AppointmentTransactionSchema = z.object({
  description: z.string().min(3, { message: "A descrição deve ter pelo menos 3 caracteres." }),
  amount: z.coerce.number().positive({ message: "O valor deve ser positivo." }),
  type: z.enum(["income", "expense"], { required_error: "O tipo é obrigatório." }),
  category: z.string().optional().or(z.literal("")),
});

type AppointmentTransactionFormValues = z.infer<typeof AppointmentTransactionSchema>;

interface NewAppointmentTransactionModalProps {
  appointment: Appointment;
  patientName: string;
  children: React.ReactNode;
  defaultAmount?: number;
  defaultDescription?: string;
  defaultCategory?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const NewAppointmentTransactionModal = ({
  appointment,
  patientName,
  children,
  defaultAmount,
  defaultDescription,
  defaultCategory,
  isOpen: controlledOpen,
  onOpenChange: setControlledOpen
}: NewAppointmentTransactionModalProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = setControlledOpen !== undefined ? setControlledOpen : setInternalOpen;

  const { mutate, isPending } = useAddAppointmentTransaction();

  const form = useForm<AppointmentTransactionFormValues>({
    resolver: zodResolver(AppointmentTransactionSchema),
    defaultValues: {
      description: defaultDescription || `Sessão - ${patientName}`,
      amount: defaultAmount || 0,
      type: "income",
      category: defaultCategory || "Terapia",
    },
  });

  // Atualiza valores se os defaults mudarem (ex: vindo da auditoria)
  useEffect(() => {
    if (open) {
      form.reset({
        description: defaultDescription || `Sessão - ${patientName}`,
        amount: defaultAmount || 0,
        type: "income",
        category: defaultCategory || "Terapia",
      });
    }
  }, [open, defaultAmount, defaultDescription, defaultCategory, patientName, form]);

  const transactionType = form.watch("type");

  const onSubmit = (values: AppointmentTransactionFormValues) => {
    mutate({
      appointmentId: appointment.id,
      description: values.description,
      amount: values.amount,
      type: values.type,
      category: values.category || 'N/A',
      date: new Date(appointment.start_time),
    }, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="agenda-modal-surface z-[9000] overflow-hidden rounded-[32px] p-0 outline-none sm:max-w-md [&>button]:hidden">
        <DialogHeader className="agenda-modal-header p-8 pb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="synapse-chat-glass flex h-11 w-11 items-center justify-center rounded-[15px] border">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <DialogTitle className="text-lg font-bold tracking-tight">Registrar Transação</DialogTitle>
            </div>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="agenda-tactile notification-liquid-control h-11 w-11 rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
          <DialogDescription className="text-xs font-medium text-muted-foreground ml-1">
            Vincule este lançamento financeiro à sessão do paciente.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-8 pt-4 space-y-8">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="grid grid-cols-2 gap-4"
                    >
                      <FormItem>
                        <RadioGroupItem value="income" id="income" className="peer sr-only" />
                        <FormLabel htmlFor="income" className="agenda-choice-card agenda-tactile flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-[24px] border p-6 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 peer-data-[state=checked]:text-primary">
                          <TrendingUp className="mb-2 h-6 w-6" />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Receita</span>
                        </FormLabel>
                      </FormItem>
                      <FormItem>
                        <RadioGroupItem value="expense" id="expense" className="peer sr-only" />
                        <FormLabel htmlFor="expense" className="agenda-choice-card agenda-tactile flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-[24px] border p-6 peer-data-[state=checked]:border-destructive peer-data-[state=checked]:bg-destructive/10 peer-data-[state=checked]:text-destructive">
                          <TrendingDown className="mb-2 h-6 w-6" />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Despesa</span>
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-6">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Descrição</FormLabel>
                    <FormControl>
                      <div className="relative group">
                        <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
                        <Input placeholder="Ex: Pagamento da sessão" {...field} className="agenda-field h-12 rounded-xl pl-11" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Valor (R$)</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
                          <Input type="number" step="0.01" placeholder="0.00" {...field} className="agenda-field h-12 rounded-xl pl-11 font-bold" />
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
                      <FormLabel className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Categoria</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Terapia" {...field} className="agenda-field h-12 rounded-xl" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="agenda-liquid-card flex items-center gap-2 rounded-2xl border p-3">
              <Calendar className="h-4 w-4 text-muted-foreground/50" />
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Registro em {new Date(appointment.start_time).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
              </p>
            </div>

            <Button
              type="submit"
              className="agenda-primary-action agenda-tactile h-14 w-full rounded-[20px] font-black uppercase text-[11px] tracking-[0.22em] disabled:opacity-50"
              disabled={isPending}
            >
              {isPending && <Loader2 className="mr-3 h-4 w-4 animate-spin" />}
              {isPending ? "Processando..." : transactionType === 'income' ? "Confirmar Recebimento" : "Registrar Despesa"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
