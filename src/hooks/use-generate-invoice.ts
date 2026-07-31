import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { toUserFacingError } from '@/lib/user-facing-error';
import { SUPABASE_ANON_KEY, edgeFunctionUrl } from '@/lib/supabase-config';

interface GenerateInvoiceData {
  patientId: string;
  amount: number;
  description: string;
  dueDate: Date;
  billingType?: string;
  paymentMethodType?: string[];
  financialEntryId?: string | null;
  appointmentId?: string | null;
  operationId?:string;
  silent?: boolean;
}

interface GenerateInvoiceResponse {
  paymentId: string;
  asaasPaymentId: string;
  paymentUrl: string;
  pixQrCode?: string;
  pixCopyPaste?: string;
  boletoUrl?: string;
  expiresAt?: string;
  amount: number;
}

const normalizePaymentMethod = (value?: string) => {
  const aliases: Record<string, string> = {
    pix: "pix",
    credit_card: "card",
    card: "card",
    boleto: "boleto",
    undefined: "undefined",
  };

  return aliases[String(value || "undefined").trim().toLowerCase()] || "undefined";
};

export const useGenerateInvoice = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: GenerateInvoiceData): Promise<GenerateInvoiceResponse> => {
      if (!user?.id) throw new Error("Sessão inválida.");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada. Faça login novamente.");

      // Call the Edge Function directly - it handles DB insertion into nb_payments
      // Resolve payment methods
      const selectedMethods = data.paymentMethodType?.length
        ? data.paymentMethodType
        : data.billingType?.split(",") || ["undefined"];
      const methods = selectedMethods.map(normalizePaymentMethod);
      const primaryMethod = methods.length === 1 ? methods[0] : "undefined";

      const asaasResponse = await fetch(edgeFunctionUrl('asaas-create-payment'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          amount: Math.round(data.amount * 100), // Em centavos — Edge Function divide por 100 para Asaas
          description: data.description || 'Cobrança NeuroBank',
          patient_id: data.patientId,
          payment_method: primaryMethod, // singular for Edge Function
          payment_methods: methods,       // array as backup
          due_date: data.dueDate.toISOString().split('T')[0],
          financial_entry_id: data.financialEntryId || null,
          appointment_id: data.appointmentId || null,
          operation_id:data.operationId||crypto.randomUUID(),
        }),
      });

      if (!asaasResponse.ok) {
        const errResponse = await asaasResponse.json().catch(() => ({}));
        const paymentError = new Error(
          errResponse.error || "Não foi possível gerar a cobrança agora.",
        ) as Error & { code?: string; status?: number };
        paymentError.code = errResponse.code || errResponse.details?.code;
        paymentError.status = asaasResponse.status;
        throw paymentError;
      }

      const result = await asaasResponse.json();

      return {
        paymentId: result.payment_id,
        asaasPaymentId: result.asaas_payment_id,
        paymentUrl: result.checkout_url,
        pixQrCode: result.pix_qr_code,
        pixCopyPaste: result.pix_copy_paste,
        boletoUrl: result.bank_slip_url,
        expiresAt: result.expires_at,
        amount: result.amount / 100,
      };
    },
    onSuccess: (_result, variables) => {
      if (!variables.silent) toast.success("Cobrança NeuroFinance gerada com sucesso!");
      // Invalidate both for safety during transition, but primary is nb_payments
      queryClient.invalidateQueries({ queryKey: ['nb_payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices-page'] });
      queryClient.invalidateQueries({ queryKey: ['financial_transactions'] });
    },
    onError: (error, variables) => {
      console.error('useGenerateInvoice error:', error);
      if (variables.silent) return;
      const friendlyError = toUserFacingError(error, "payment");
      toast.error(friendlyError.title, { description: friendlyError.message });
    }
  });
};
