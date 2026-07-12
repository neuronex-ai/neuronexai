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
import { useUpdatePatientPackage } from "@/hooks/use-update-patient-package";
import { cn } from "@/lib/utils";
import { PatientPackage } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Loader2, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import * as z from "zod";

const EditPackageSchema = z.object({
  description: z.string().min(5, { message: "A descrição é obrigatória." }),
  totalSessions: z.coerce.number().int().positive({ message: "O número de sessões deve ser positivo." }),
  sessionsUsed: z.coerce.number().int().min(0, { message: "Sessões usadas não pode ser negativo." }),
  price: z.coerce.number().optional().or(z.literal(0)),
  startDate: z.date({ required_error: "A data de início é obrigatória." }),
  endDate: z.date().optional(),
  due_day: z.coerce.number().min(1).max(31).optional(),
});

type EditPackageFormValues = z.infer<typeof EditPackageSchema>;

const fieldClassName = "h-11 rounded-xl border-border/70 bg-muted/35 text-foreground shadow-none transition-colors focus:bg-background";
const dateButtonClassName = "h-11 w-full rounded-xl border-border/70 bg-muted/35 px-3 pl-3 text-left font-normal text-foreground shadow-none hover:bg-muted/55";

interface EditPackageFormProps {
  pkg: PatientPackage;
  onSuccess: () => void;
}

export const EditPackageForm = ({ pkg, onSuccess }: EditPackageFormProps) => {
  const { mutate, isPending } = useUpdatePatientPackage();

  const form = useForm<EditPackageFormValues>({
    resolver: zodResolver(EditPackageSchema),
    defaultValues: {
      description: pkg.description,
      totalSessions: pkg.total_sessions,
      sessionsUsed: pkg.sessions_used,
      price: pkg.price || 0,
      startDate: new Date(pkg.start_date + 'T00:00:00'),
      endDate: pkg.end_date ? new Date(pkg.end_date + 'T00:00:00') : undefined,
      due_day: pkg.due_day || 5,
    },
  });

  const onSubmit = (values: EditPackageFormValues) => {
    const updates = {
      description: values.description,
      total_sessions: values.totalSessions,
      sessions_used: values.sessionsUsed,
      price: values.price || null,
      start_date: values.startDate.toISOString().split('T')[0],
      end_date: values.endDate ? values.endDate.toISOString().split('T')[0] : null,
      due_day: values.due_day,
    };

    mutate({
      packageId: pkg.id,
      patientId: pkg.patient_id,
      updates,
    }, {
      onSuccess: () => {
        onSuccess();
      },
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider font-semibold ml-1">Descrição</FormLabel>
              <FormControl>
                <Input placeholder="Ex.: Pacote mensal" {...field} className={fieldClassName} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="totalSessions"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider font-semibold ml-1">Total</FormLabel>
                <FormControl>
                  <Input type="number" min={1} placeholder="4" {...field} className={fieldClassName} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="sessionsUsed"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider font-semibold ml-1">Usadas</FormLabel>
                <FormControl>
                  <Input type="number" min={0} placeholder="0" {...field} className={fieldClassName} />
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
                <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider font-semibold ml-1">Preço</FormLabel>
                <FormControl>
                  <Input type="number" min={0} step="0.01" inputMode="decimal" placeholder="0,00" {...field} className={fieldClassName} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="due_day"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider font-semibold ml-1">Dia do Vencimento</FormLabel>
              <FormControl>
                <Input type="number" min={1} max={31} inputMode="numeric" {...field} className={fieldClassName} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                        className={cn(dateButtonClassName, !field.value && "text-muted-foreground")}
                      >
                        {field.value ? format(field.value, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto border-border/70 bg-popover p-0" align="start">
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
                <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider font-semibold ml-1 mb-1.5">Fim</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(dateButtonClassName, !field.value && "text-muted-foreground")}
                      >
                        {field.value ? format(field.value, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto border-border/70 bg-popover p-0" align="start">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={ptBR} />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" className="h-12 w-full gap-2 rounded-xl bg-foreground text-background shadow-none hover:bg-foreground/90 active:scale-[0.99]" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="h-4 w-4" />
          {isPending ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </form>
    </Form>
  );
};