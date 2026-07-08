"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Copy, Hash, KeyRound, Landmark, Loader2, LockKeyhole, Pencil, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFinancialAccount } from "@/hooks/use-financial-account";
import { usePixKeys } from "@/hooks/use-neurofinance-pix";
import { supabase } from "@/integrations/supabase/client";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { formatDocumentInput, formatPixKeyInput, onlyDigits } from "@/lib/financial-input";
import { cn } from "@/lib/utils";

const digits = onlyDigits;

function getPixKeyValue(item: any) {
    return String(item?.key || item?.addressKey || item?.value || item?.id || "").trim();
}

export const BankAccountsView = () => {
    const { account, isLoading, updateAccount, refetch } = useFinancialAccount();
    const { data: pixKeys = [], isLoading: isLoadingPixKeys } = usePixKeys();
    const [isEditing, setIsEditing] = useState(false);
    const [isSavingPix, setIsSavingPix] = useState(false);
    const [form, setForm] = useState({ holderName: "", cpfCnpj: "", bankCode: "", agency: "", account: "", digit: "", pixKey: "" });
    const pixKeyValues = useMemo<string[]>(() => pixKeys.map(getPixKeyValue).filter(Boolean) as string[], [pixKeys]);
    const storedPixKey = pixKeyValues[0] || "";

    useEffect(() => {
        if (!account) return;
        setForm({
            holderName: account.bank_holder_name || account.holder_name || "",
            cpfCnpj: account.bank_holder_cpf_cnpj || account.cpf_cnpj || "",
            bankCode: account.bank_code || account.bank_name || "",
            agency: account.bank_agency || "",
            account: "",
            digit: "",
            pixKey: storedPixKey,
        });
    }, [account, storedPixKey]);

    const hasStoredAccount = Boolean(account?.bank_account_last4);
    const hasCompleteBankAccount = Boolean(account?.bank_code && account?.bank_agency && hasStoredAccount);
    const hasPixKey = Boolean(storedPixKey);

    const maskedAccount = useMemo(() => {
        const last4 = account?.bank_account_last4 || "";
        return last4 ? `•••• ${last4}` : "Não informada";
    }, [account?.bank_account_last4]);

    const setField = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));

    const copyPixKey = async (value: string) => {
        await navigator.clipboard.writeText(value);
        toast.success("Chave Pix copiada.");
    };

    const handleSave = async () => {
        const hasBankForm = Boolean(form.holderName.trim() || digits(form.bankCode) || digits(form.agency) || digits(form.account));
        const hasPixForm = Boolean(form.pixKey.trim());
        if (!hasBankForm && !hasPixForm) return toast.error("Informe uma conta bancária ou uma chave Pix.");
        if (hasBankForm && (!form.holderName.trim() || digits(form.bankCode).length !== 3 || !digits(form.agency) || !digits(form.account))) return toast.error("Confira titular, banco, agência e conta.");

        try {
            if (hasBankForm) {
                await updateAccount.mutateAsync({
                    bank_code: digits(form.bankCode),
                    agency: digits(form.agency),
                    account: digits(form.account),
                    account_digit: digits(form.digit),
                    owner_name: form.holderName.trim(),
                    cpfCnpj: digits(form.cpfCnpj),
                    account_type: "CONTA_CORRENTE",
                });
            }

            if (hasPixForm) {
                setIsSavingPix(true);
                const { data, error } = await supabase.functions.invoke("neurofinance-post-onboarding", {
                    body: { action: "save_destination", pix: { key: form.pixKey.trim(), type: "manual" } },
                });
                if (error) throw error;
                if (data?.error) throw new Error(data.error);
            }

            await refetch();
            setIsEditing(false);
            toast.success("Dados de recebimento atualizados.");
        } catch (error: any) {
            console.error("[BankAccountsView] Falha ao atualizar destino de recebimento", error);
            toast.error(getUserFacingErrorMessage(error, "save"));
        } finally {
            setIsSavingPix(false);
        }
    };

    if (isLoading) return <div className="flex min-h-[280px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-zinc-400" /></div>;

    return (
        <div className="mx-auto max-w-4xl space-y-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.26em] text-zinc-400">Destino de repasse</p>
                    <h3 className="mt-2 text-2xl font-black tracking-tight text-zinc-950 dark:text-white">Conta bancária e Pix</h3>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Escolha para onde deseja receber seus saques do NeuroFinance.</p>
                </div>
                <Button onClick={() => setIsEditing((value) => !value)} variant="outline" className="h-11 rounded-xl border-black/10 bg-white/70 px-5 text-[10px] font-black uppercase tracking-[0.18em] backdrop-blur-xl transition-all active:scale-[0.98] dark:border-white/10 dark:bg-white/[0.04]">
                    {isEditing ? <X className="mr-2 h-4 w-4" /> : <Pencil className="mr-2 h-4 w-4" />}
                    {isEditing ? "Cancelar" : "Atualizar dados"}
                </Button>
            </div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-[32px] border border-black/[0.07] bg-white/[0.82] p-6 shadow-[0_28px_80px_-52px_rgba(0,0,0,0.55)] backdrop-blur-3xl sm:p-8 dark:border-white/[0.08] dark:bg-white/[0.035]">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(255,255,255,.75),transparent_38%),radial-gradient(circle_at_90%_100%,rgba(0,0,0,.05),transparent_38%)] dark:bg-[radial-gradient(circle_at_10%_0%,rgba(255,255,255,.08),transparent_42%)]" />
                {!isEditing ? (
                    <div className="relative z-10 space-y-5">
                        <div className="grid gap-4 md:grid-cols-2">
                            <SummaryCard icon={Landmark} title="Conta bancária" status={hasCompleteBankAccount ? "Cadastrada" : hasStoredAccount ? "Completar dados" : "Pendente"} active={hasCompleteBankAccount}>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Info label="Titular" value={form.holderName || "Não informado"} />
                                    <Info label="Banco / agência" value={`${form.bankCode || "—"} / ${form.agency || "—"}`} />
                                    <Info label="Conta" value={maskedAccount} mono />
                                </div>
                            </SummaryCard>
                            <SummaryCard icon={KeyRound} title="Chave Pix pessoal" status={hasPixKey ? "Cadastrada" : "Opcional"} active={hasPixKey}>
                                <div className="space-y-4">
                                    <Info label="Chave escolhida para saques" value={storedPixKey || "Não informada"} mono={hasPixKey} />
                                    <div className="space-y-2">
                                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Chaves da sua conta NeuroFinance</p>
                                        {isLoadingPixKeys ? (
                                            <div className="flex h-11 items-center gap-2 rounded-2xl border border-zinc-200/70 px-3 text-[10px] font-bold text-zinc-400 dark:border-white/10"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando chaves...</div>
                                        ) : pixKeyValues.length ? (
                                            <div className="space-y-2">
                                                {pixKeyValues.map((value) => (
                                                    <div key={value} className="flex items-center gap-2 rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.035]">
                                                        <Hash className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                                                        <span className="min-w-0 flex-1 truncate font-mono text-[10px] font-bold text-zinc-700 dark:text-zinc-200">{value}</span>
                                                        <button type="button" onClick={() => copyPixKey(value)} className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-950 text-white transition-transform active:scale-90 dark:bg-white dark:text-zinc-950" title="Copiar chave Pix"><Copy className="h-3.5 w-3.5" /></button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="rounded-2xl border border-dashed border-zinc-200/80 px-3 py-3 text-[10px] font-bold text-zinc-400 dark:border-white/10">Nenhuma chave criada em Área Pix &gt; Minhas Chaves.</div>
                                        )}
                                    </div>
                                </div>
                            </SummaryCard>
                        </div>
                        {hasStoredAccount && !hasCompleteBankAccount ? <button type="button" onClick={() => setIsEditing(true)} className="flex w-full items-center gap-3 rounded-2xl border border-amber-500/15 bg-amber-500/[0.06] px-4 py-3 text-left transition-colors hover:bg-amber-500/[0.1] dark:border-amber-300/10"><AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" /><span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">A conta {maskedAccount} está registrada. Complete banco e agência para habilitar repasses.</span></button> : null}
                    </div>
                ) : (
                    <div className="relative z-10 space-y-6">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Titular"><Input value={form.holderName} onChange={(e) => setField("holderName", e.target.value)} /></Field>
                            <Field label="CPF/CNPJ do titular"><Input value={form.cpfCnpj} onChange={(e) => setField("cpfCnpj", formatDocumentInput(e.target.value))} /></Field>
                            <Field label="Código do banco"><Input value={form.bankCode} maxLength={3} onChange={(e) => setField("bankCode", digits(e.target.value).slice(0, 3))} /></Field>
                            <Field label="Agência"><Input value={form.agency} onChange={(e) => setField("agency", digits(e.target.value, 10))} /></Field>
                            <Field label="Conta"><Input value={form.account} onChange={(e) => setField("account", digits(e.target.value, 18))} /></Field>
                            <Field label="Dígito"><Input value={form.digit} maxLength={2} onChange={(e) => setField("digit", digits(e.target.value).slice(0, 2))} /></Field>
                            <div className="sm:col-span-2"><Field label="Chave Pix pessoal"><Input value={form.pixKey} onChange={(e) => setField("pixKey", formatPixKeyInput(e.target.value))} placeholder="CPF, e-mail, telefone ou chave aleatória" /></Field></div>
                        </div>
                        <Button onClick={handleSave} disabled={updateAccount.isPending || isSavingPix} className="h-14 w-full rounded-2xl bg-zinc-950 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] dark:bg-white dark:text-zinc-950">
                            {updateAccount.isPending || isSavingPix ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ShieldCheck className="mr-2 h-4 w-4" /> Salvar dados de recebimento</>}
                        </Button>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

const SummaryCard = ({ icon: Icon, title, status, active, children }: { icon: any; title: string; status: string; active: boolean; children: React.ReactNode }) => <div className="rounded-[28px] border border-zinc-200/70 bg-zinc-50/70 p-5 dark:border-white/10 dark:bg-white/[0.035]"><div className="mb-6 flex items-start justify-between gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-black/[0.06] bg-black/[0.03] dark:border-white/[0.08] dark:bg-white/[0.05]"><Icon className="h-5 w-5" /></div><div className="flex items-center gap-2 rounded-full border border-emerald-500/15 bg-emerald-500/[0.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">{active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <LockKeyhole className="h-3.5 w-3.5" />}{status}</div></div><h4 className="mb-5 text-sm font-black uppercase tracking-[0.18em] text-zinc-950 dark:text-white">{title}</h4>{children}</div>;
const Info = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => <div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">{label}</p><p className={cn("mt-2 truncate text-sm font-black text-zinc-950 dark:text-white", mono && "font-mono tracking-[0.08em]")}>{value}</p></div>;
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="space-y-2"><Label className="ml-1 text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400">{label}</Label><div className="[&_input]:h-12 [&_input]:rounded-xl [&_input]:border-black/10 [&_input]:bg-white/70 [&_input]:font-bold dark:[&_input]:border-white/10 dark:[&_input]:bg-white/[0.04]">{children}</div></div>;
