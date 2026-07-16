import { useAuth } from "@/components/auth/SessionContextProvider";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePatients } from "@/hooks/use-patients";
import { useUploadInvoice } from "@/hooks/use-upload-invoice";
import { supabase } from "@/integrations/supabase/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Check, Loader2, Upload } from "lucide-react";
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
        <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 rounded-full hover:bg-white/10">
                <ArrowLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-lg font-semibold text-white">Registrar Nota Externa</h3>
        </div>

        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                    control={form.control}
                    name="patientId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Paciente</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={Boolean(initialPatientId)}>
                                <FormControl>
                                    <SelectTrigger className="bg-black/20 border-white/10 h-11 rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                </FormControl>
                                <SelectContent className="bg-[#0A0A0B] border-white/10">
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
                                    <Input placeholder="000123" {...field} className="bg-black/20 border-white/10 h-11 rounded-xl" />
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
                                    <Input type="number" placeholder="0.00" {...field} className="bg-black/20 border-white/10 h-11 rounded-xl" />
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
                                <Input type="date" {...field} className="bg-black/20 border-white/10 h-11 rounded-xl" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="space-y-2">
                    <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Arquivo da Nota (PDF)</FormLabel>
                    <div className="border-2 border-dashed border-white/10 rounded-xl p-6 flex flex-col items-center justify-center text-center bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer relative">
                        <input 
                            type="file" 
                            accept=".pdf" 
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        />
                        {selectedFile ? (
                            <div className="flex items-center gap-2 text-emerald-400">
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

                <Button type="submit" disabled={isSubmitting || isUploading} className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold uppercase text-xs tracking-widest shadow-glow mt-2">
                    {isSubmitting || isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Arquivar Nota"}
                </Button>
            </form>
        </Form>
    </div>
  );
};
