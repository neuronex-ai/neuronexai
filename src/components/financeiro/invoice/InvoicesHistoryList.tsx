import { useInvoicesPage } from "@/hooks/use-invoices";
import { formatCurrency } from "@/lib/utils";
import { Loader2, FileCheck, ExternalLink, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePatients } from "@/hooks/use-patients";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";

interface InvoicesHistoryListProps {
    fiscalOnly?: boolean;
    heightClassName?: string;
    patientId?: string;
    allowDelete?: boolean;
}

export const InvoicesHistoryList = ({ fiscalOnly = false, heightClassName = "h-[350px]", patientId, allowDelete = true }: InvoicesHistoryListProps) => {
    const { data: invoicePage, isLoading } = useInvoicesPage({ page: 1, pageSize: 50, patientId });
    const invoices = invoicePage?.invoices;
    const { data: patients } = usePatients();
    const queryClient = useQueryClient();
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const getPatientName = (patientId: string) => {
        return patients?.find(p => p.id === patientId)?.name || "Paciente";
    };

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            // Try to cancel NeuroFinance boleto if invoice has a linked boleto_id
            // Note: Boleto cancellation is handled automatically through Asaas webhooks
            // when the invoice record is deleted from the database.

            const { error: dbError } = await supabase.from('invoices').delete().eq('id', id);
            if (dbError) throw dbError;

            toast.success("Cobrança excluída e cancelada.");

            // Invalidar queries dependentes
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            queryClient.invalidateQueries({ queryKey: ['financialMetrics'] });
            queryClient.invalidateQueries({ queryKey: ['advancedCashFlow'] });
            queryClient.invalidateQueries({ queryKey: ['pendingInvoicesTotal'] });
        } catch (e: unknown) {
            console.error(e);
            toast.error(getUserFacingErrorMessage(e, "delete"));
        } finally {
            setDeletingId(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                <Loader2 className="h-6 w-6 animate-spin mb-2" />
                <p className="text-[10px] uppercase tracking-widest font-bold">Carregando Histórico</p>
            </div>
        );
    }

    const allInvoices = fiscalOnly
        ? (invoices || []).filter((invoice) => Boolean(invoice.nfse_status))
        : invoices || [];

    if (allInvoices.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-600 border border-dashed border-white/5 rounded-2xl bg-white/[0.01]">
                <Wallet className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">{fiscalOnly ? "Nenhuma nota fiscal registrada" : "Nenhuma cobrança registrada"}</p>
            </div>
        );
    }

    return (
        <ScrollArea className={`${heightClassName} pr-2`}>
            <div className="space-y-2">
                {allInvoices.map((inv) => {
                    const isFiscal = !!inv.nfse_status;
                    const nfseStatus = inv.nfse_status?.toUpperCase();
                    const statusColor = inv.status === 'paid' ? "text-emerald-500" : "text-amber-500";
                    const primaryDocumentUrl = inv.nfse_pdf_url || inv.nfse_xml_url || inv.payment_url || inv.pdf_url;

                    return (
                        <div
                            key={inv.id}
                            className="group flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-3 transition-all hover:bg-zinc-50 dark:border-white/5 dark:bg-zinc-900/30 dark:hover:bg-zinc-900/60"
                        >
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "w-9 h-9 rounded-lg flex items-center justify-center border shadow-sm bg-zinc-100 border-zinc-200 dark:bg-zinc-800/50 dark:border-white/5"
                                )}>
                                    {inv.status === 'paid' ? <FileCheck className="h-4 w-4 text-emerald-500" /> : <Wallet className="h-4 w-4 text-zinc-400" />}
                                </div>

                                <div>
                                    <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{getPatientName(inv.patient_id!)}</h4>
                                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-500">
                                        <span className={cn("uppercase font-medium", statusColor)}>{inv.status === 'paid' ? 'PAGO' : 'PENDENTE'}</span>
                                        <span>•</span>
                                        <span>{format(new Date(inv.created_at), "dd/MM/yyyy")}</span>
                                        {isFiscal && <span className="text-blue-400 font-bold ml-1">NFS-e {nfseStatus}</span>}
                                    </div>
                                    {inv.nfse_number && (
                                        <p className="mt-1 text-[10px] text-zinc-500">Nota {inv.nfse_number}</p>
                                    )}
                                    {inv.nfse_error_message && (
                                        <p className="mt-1 max-w-[260px] truncate text-[10px] text-rose-500">{inv.nfse_error_message}</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <span className="text-xs font-mono font-bold text-zinc-400">
                                    {formatCurrency(inv.amount)}
                                </span>

                                {primaryDocumentUrl && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-white"
                                        onClick={() => window.open(primaryDocumentUrl, '_blank')}
                                        title={isFiscal ? "Abrir documento fiscal" : "Link de Pagamento"}
                                    >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                    </Button>
                                )}

                                {inv.nfse_pdf_url && inv.nfse_xml_url && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-white"
                                        onClick={() => window.open(inv.nfse_xml_url!, '_blank')}
                                        title="Abrir XML da NFS-e"
                                    >
                                        <FileCheck className="h-3.5 w-3.5" />
                                    </Button>
                                )}

                                {allowDelete ? <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 rounded-lg hover:bg-rose-500/10 text-zinc-600 hover:text-rose-500 transition-colors"
                                    onClick={() => handleDelete(inv.id)}
                                    disabled={deletingId === inv.id}
                                    title="Excluir Cobrança"
                                >
                                    {deletingId === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                </Button> : null}
                            </div>
                        </div>
                    );
                })}
            </div>
        </ScrollArea>
    );
};
