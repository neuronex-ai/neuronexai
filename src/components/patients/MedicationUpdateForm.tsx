import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useUpdatePatient } from "@/hooks/use-update-patient";
import { Patient } from "@/types";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const MedicationSchema = z.object({
    medications: z.array(z.object({
        name: z.string().min(1, "Nome necessário"),
        dosage: z.string().optional(),
        frequency: z.string().optional(),
    })).optional().default([]),
});

type MedicationFormValues = z.infer<typeof MedicationSchema>;

interface MedicationUpdateFormProps {
    patient: Patient;
    onSuccess: () => void;
}

export const MedicationUpdateForm = ({ patient, onSuccess }: MedicationUpdateFormProps) => {
    const { mutate, isPending } = useUpdatePatient();

    const form = useForm<MedicationFormValues>({
        resolver: zodResolver(MedicationSchema),
        defaultValues: {
            medications: patient.medications || []
        }
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "medications"
    });

    const onSubmit = (values: MedicationFormValues) => {
        mutate({
            id: patient.id,
            updates: {
                medications: values.medications ? values.medications.map(m => ({
                    name: m.name || "",
                    dosage: m.dosage,
                    frequency: m.frequency
                })) : []
            }
        }, {
            onSuccess: () => {
                toast.success("Medicações atualizadas!");
                onSuccess();
            },
            onError: (err) => {
                toast.error("Erro ao atualizar: " + err.message);
            }
        });
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="desktop-retina-form space-y-6">
                <div className="patient-record-scrollbar max-h-[400px] space-y-3 overflow-y-auto pr-2">
                    {fields.map((field, index) => (
                        <div key={field.id} className="desktop-retina-inset grid gap-3 rounded-[20px] border border-border/45 bg-background/55 p-3 sm:grid-cols-[minmax(0,1fr)_110px_150px_40px] sm:items-start">
                            <FormField
                                control={form.control}
                                name={`medications.${index}.name`}
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormLabel className="sr-only">Nome da medicação</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Nome da medicação" {...field} className="h-10 rounded-xl border-border/45 bg-background/64 text-sm font-medium" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name={`medications.${index}.dosage`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="sr-only">Dosagem</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Dosagem" {...field} className="h-10 rounded-xl border-border/45 bg-background/64 text-center text-sm" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name={`medications.${index}.frequency`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="sr-only">Frequência</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ex.: 1 vez ao dia" {...field} className="h-10 rounded-xl border-border/45 bg-background/64 text-sm" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => remove(index)}
                                className="h-10 w-10 flex-shrink-0 rounded-xl text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500"
                                aria-label={`Remover medicação ${index + 1}`}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}

                    {fields.length === 0 && (
                        <div className="rounded-[20px] bg-muted/30 py-8 text-center">
                            <p className="text-xs text-muted-foreground">Nenhuma medicação registrada.</p>
                        </div>
                    )}
                </div>

                <div className="flex gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => append({ name: "", dosage: "", frequency: "" })}
                        className="h-11 flex-1 rounded-xl border-border/45 bg-background/55 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                        <Plus className="h-4 w-4 mr-2" /> Adicionar
                    </Button>
                    <Button
                        type="submit"
                        disabled={isPending}
                        className="h-11 flex-1 rounded-xl bg-foreground text-xs font-bold uppercase tracking-wider text-background hover:bg-foreground/90"
                    >
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                    </Button>
                </div>
            </form>
        </Form>
    );
};
