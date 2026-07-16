import { useAuth } from "@/components/auth/SessionContextProvider";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePatients } from "@/hooks/use-patients";
import { useUploadInvoice } from "@/hooks/use-upload-invoice";
import { supabase } from "@/integrations/supabase/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Check, FileCheck2, Loader2, Upload } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";

const ExternalInvoiceSchema = z.object({
  patientId: z.string().min(1, "Selecione um paciente"),
  number: z.string().min(1, "Número da nota é obrigatório"),
  amount: z.string().min(1, "Valor é obrigatório"),
  date: z.string().min(1, "Data de emissão é obrigatória"),
  description: z.string().optional(),
});

type ExternalInvoiceFormValues = z.infer<typeof ExternalInvoiceSchema>;

interface RegisterExternalInvoiceFormProps {
  onBack: () => void;
  onSuccess: () => void;
  initialPatientId?: string;
}

export const RegisterExternalInvoiceForm = ({ onBack, onSuccess, initialPatientId }: RegisterExternalInvoiceFormProps) => {
  const { user } = useAuth();
  const { data: patients } = usePatients();
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadInvoice();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ExternalInvoiceFormValues>({
    resolver: zodResolver(ExternalInvoiceSchema),
    defaultValues: {
      patientId: initialPatientId || "",
      description: "Serviços de Psicologia",
      date: new Date().toISOString().split('T')[0]
    }
  });

  const onSubmit = async (values: ExternalInvoiceFormValues) => {
    if (!user) return;
    setIsSubmitting(true);

    try {
      // 1. Criar registro da fatura
      const { data: invoice, error } = await supabase
        .from('invoices')
        .insert({
          user_id: user.id,
          patient_id: values.patientId,
          invoice_number: values.number,
          amount: parseFloat(values.amount),
          status: 'paid', // Assumimos que nota externa já está emitida/processada
          due_date: values.date,
          description: values.description,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // 2. Upload do arquivo (se houver)
      let fileUrl = null;
      if (selectedFile && invoice) {
        fileUrl = await uploadFile({ file: selectedFile, invoiceId: invoice.id });
        
        // Atualizar registro com URL
        await supabase
            .from('invoices')
            .update({ pdf_url: fileUrl })
            .eq('id', invoice.id);
      }

      toast.success("Nota fiscal registrada com sucesso!");
      onSuccess();
    } catch (error: any) {
      console.error(error);
      toast.error(getUserFacingErrorMessage(error, "save"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
        <div className="grid grid-cols-[40px_1fr_40px] items-start">
            <Button variant="ghost" size="icon" onClick={onBack} className="h-10 w-10 rounded-xl hover:bg-muted" aria-label="Voltar para gestão fiscal">
                <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex flex-col items-center text-center">
                <span className="finance-modal-icon flex h-11 w-11 items-center justify-center rounded-[15px] bg-muted/65 text-foreground">
                    <FileCheck2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-3 text-lg font-semibold text-foreground">Arquivar NFS-e externa</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Registre um documento fiscal já emitido.</p>
            </div>
            <span aria-hidden="true" />
        </div>

        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="desktop-retina-form space-y-5">
                <FormField
                    control={form.control}
                    name="patientId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Paciente</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={Boolean(initialPatientId)}>
                                <FormControl>
                                    <SelectTrigger className="h-11 rounded-xl border-border/45 bg-background/64"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                </FormControl>
                                <SelectContent className="desktop-retina-modal border-border/55 bg-popover/96">
                                    {patients?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="number"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Número da Nota</FormLabel>
                                <FormControl>
                                    <Input placeholder="000123" {...field} className="h-11 rounded-xl border-border/45 bg-background/64" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Valor (R$)</FormLabel>
                                <FormControl>
                                    <Input type="number" min="0" step="0.01" placeholder="0,00" {...field} className="h-11 rounded-xl border-border/45 bg-background/64" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Data de Emissão</FormLabel>
                            <FormControl>
                                <Input type="date" {...field} className="h-11 rounded-xl border-border/45 bg-background/64" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="space-y-2">
                    <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Arquivo da Nota (PDF)</FormLabel>
                    <div className="desktop-retina-inset relative flex cursor-pointer flex-col items-center justify-center rounded-[18px] border border-dashed border-border/55 bg-background/52 p-6 text-center transition-colors hover:bg-muted/55">
                        <input 
                            type="file" 
                            accept=".pdf" 
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        />
                        {selectedFile ? (
                            <div className="flex items-center gap-2 text-foreground">
                                <Check className="h-5 w-5" />
                                <span className="text-sm font-medium">{selectedFile.name}</span>
                            </div>
                        ) : (
                            <>
                                <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                                <p className="text-xs text-muted-foreground">Clique ou arraste o PDF aqui</p>
                            </>
                        )}
                    </div>
                </div>

                <Button type="submit" disabled={isSubmitting || isUploading} className="mt-2 h-12 w-full rounded-xl bg-foreground text-xs font-bold uppercase tracking-widest text-background hover:bg-foreground/90">
                    {isSubmitting || isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Arquivar Nota"}
                </Button>
            </form>
        </Form>
    </div>
  );
};
