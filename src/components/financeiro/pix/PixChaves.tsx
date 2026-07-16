import { useState } from "react";
import { Copy, Hash, Key, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";

import { SecureOperationPinDialog } from "@/components/financeiro/secure/SecureOperationPinDialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { type PixKeyDto, usePixKeys } from "@/hooks/use-neurofinance-pix";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";

type PendingOperation =
    | { kind: "create"; idempotencyKey: string }
    | { kind: "delete"; key: PixKeyDto; idempotencyKey: string };

function humanizeKeyType(value?: string | null) {
    const normalized = String(value || "").trim().toUpperCase();
    if (["EVP", "RANDOM", "RANDOM_KEY"].includes(normalized)) return "Chave aleatória";
    if (normalized === "CPF") return "CPF";
    if (normalized === "CNPJ") return "CNPJ";
    if (["EMAIL", "E-MAIL"].includes(normalized)) return "E-mail";
    if (["PHONE", "TELEPHONE", "CELLPHONE"].includes(normalized)) return "Telefone";
    return "Chave Pix";
}

function humanizeKeyStatus(value?: string | null) {
    const normalized = String(value || "").trim().toUpperCase();
    if (["ACTIVE", "APPROVED", "ENABLED"].includes(normalized)) return "Ativa";
    if (["PENDING", "AWAITING_APPROVAL"].includes(normalized)) return "Em análise";
    if (["DISABLED", "DELETED", "CANCELLED", "CANCELED"].includes(normalized)) return "Inativa";
    return "Em acompanhamento";
}

export function PixChaves() {
    const reduceMotion = Boolean(useReducedMotion());
    const { data: keys = [], isLoading, error, createKey, deleteKey } = usePixKeys();
    const [deleteCandidate, setDeleteCandidate] = useState<PixKeyDto | null>(null);
    const [operation, setOperation] = useState<PendingOperation | null>(null);
    const [pinError, setPinError] = useState<string | null>(null);
    const isMutating = createKey.isPending || deleteKey.isPending;

    const copy = async (value: string) => {
        await navigator.clipboard.writeText(value);
        toast.success("Chave Pix copiada.");
    };

    const openCreatePin = () => {
        setPinError(null);
        setOperation({ kind: "create", idempotencyKey: `pix-key-create:${crypto.randomUUID()}` });
    };

    const confirmDeleteReview = () => {
        if (!deleteCandidate) return;
        setPinError(null);
        setOperation({
            kind: "delete",
            key: deleteCandidate,
            idempotencyKey: `pix-key-delete:${crypto.randomUUID()}`,
        });
        setDeleteCandidate(null);
    };

    const confirmPin = async (pin: string) => {
        if (!operation) return;
        setPinError(null);
        try {
            if (operation.kind === "create") {
                await createKey.mutateAsync({ pin, idempotencyKey: operation.idempotencyKey });
            } else {
                await deleteKey.mutateAsync({ id: operation.key.id, pin, idempotencyKey: operation.idempotencyKey });
            }
            setOperation(null);
        } catch (operationError) {
            setPinError(getUserFacingErrorMessage(operationError, operation.kind === "create" ? "save" : "delete"));
        }
    };

    return (
        <div className="space-y-6">
            <div className="finance-panel flex flex-col gap-4 rounded-[24px] border border-black/[0.06] bg-white/70 p-5 backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between dark:border-black/75 dark:bg-zinc-900/[0.38]">
                <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"><Key className="h-5 w-5" /></div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-tight text-zinc-950 dark:text-white">Minhas chaves Pix</h3>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">Chaves para receber pela sua conta NeuroFinance</p>
                    </div>
                </div>
                <Button type="button" onClick={openCreatePin} disabled={isMutating} className="h-11 rounded-xl bg-zinc-950 px-5 text-[9px] font-black uppercase tracking-[0.16em] text-white active:scale-[0.98] dark:bg-white dark:text-zinc-950">
                    {createKey.isPending ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <><Plus className="mr-2 h-4 w-4" /> Criar chave aleatória</>}
                </Button>
            </div>

            <div className="finance-inset flex items-start gap-3 rounded-2xl border border-black/[0.06] bg-black/[0.025] p-4 dark:border-black/70 dark:bg-black/[0.24]">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                <p className="text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">A criação e a remoção exigem sua confirmação por PIN. O histórico técnico permanece protegido para auditoria.</p>
            </div>

            {isLoading ? (
                <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-400 motion-reduce:animate-none" /></div>
            ) : error ? (
                <div role="alert" className="finance-inset rounded-2xl border border-border/60 bg-muted/35 p-5 text-sm text-muted-foreground">{getUserFacingErrorMessage(error, "load")}</div>
            ) : keys.length === 0 ? (
                <div className="finance-inset flex min-h-52 flex-col items-center justify-center rounded-[24px] border border-dashed border-black/10 bg-black/[0.015] text-center dark:border-black/70 dark:bg-black/[0.18]">
                    <Hash className="mb-4 h-9 w-9 text-zinc-300 dark:text-zinc-700" />
                    <p className="text-sm font-bold text-zinc-600 dark:text-zinc-300">Nenhuma chave cadastrada</p>
                    <p className="mt-1 text-[10px] text-zinc-400">Crie uma chave aleatória para receber Pix com mais agilidade.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {keys.map((item, index) => (
                        <motion.div key={item.id} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={reduceMotion ? { duration: 0 } : { delay: index * 0.04 }} className="finance-inset flex items-center gap-4 rounded-[20px] border border-black/[0.06] bg-white/75 p-4 backdrop-blur-xl dark:border-black/70 dark:bg-black/[0.24]">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"><Hash className="h-4 w-4" /></div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">{humanizeKeyType(item.type)} · {humanizeKeyStatus(item.status)}</p>
                                <p className="mt-1 truncate font-mono text-xs font-bold text-zinc-950 dark:text-white">{item.key}</p>
                            </div>
                            <button type="button" onClick={() => copy(item.key)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/[0.04] transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none dark:bg-white/[0.05]" title="Copiar chave" aria-label="Copiar chave Pix"><Copy className="h-4 w-4" /></button>
                            <button type="button" onClick={() => setDeleteCandidate(item)} disabled={isMutating} className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/[0.06] text-rose-500 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 motion-reduce:transition-none" title="Remover chave" aria-label="Revisar remoção da chave Pix"><Trash2 className="h-4 w-4" /></button>
                        </motion.div>
                    ))}
                </div>
            )}

            <AlertDialog open={Boolean(deleteCandidate)} onOpenChange={(open) => !open && setDeleteCandidate(null)}>
                <AlertDialogContent className="desktop-retina-modal max-w-md overflow-hidden rounded-[28px] border-border/60 bg-background/98 p-0">
                    <AlertDialogHeader className="space-y-2 p-6 text-left">
                        <AlertDialogTitle>Remover esta chave Pix?</AlertDialogTitle>
                        <AlertDialogDescription>Ela deixará de receber novos pagamentos. A ação será confirmada com seu PIN e registrada no histórico técnico.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="grid grid-cols-2 gap-2 border-t border-border/50 bg-muted/20 p-4 sm:space-x-0">
                        <AlertDialogCancel className="mt-0 h-11 rounded-xl">Voltar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteReview} className="h-11 rounded-xl bg-foreground text-background">Continuar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <SecureOperationPinDialog open={Boolean(operation)} onOpenChange={(open) => { if (!open && !isMutating) setOperation(null); }} onConfirm={confirmPin} actionLabel={operation?.kind === "delete" ? "a remoção da chave Pix" : "a criação da chave Pix"} isLoading={isMutating} errorMessage={pinError} />
        </div>
    );
}
