"use client";

import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, HelpCircle, ArrowRight, Info, Check, X, Upload, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useFinancialAccount } from '@/hooks/use-financial-account';
import { getUserFacingErrorMessage } from '@/lib/user-facing-error';

interface AccountResolutionFormProps {
    requirement: string;
    onSuccess: () => void;
}

const FIELD_LABELS: Record<string, string> = {
    'individual.address.line1': 'Endereço Residencial (Rua e Número)',
    'individual.address.postal_code': 'CEP',
    'individual.address.city': 'Cidade',
    'individual.address.state': 'Estado (UF)',
    'individual.id_number': 'Seu CPF',
    'individual.verification.document': 'Documento de Identidade (RG/CNH)',
    'business_profile.url': 'Link do Perfil Profissional ou Redes Sociais',
    'business_profile.product_description': 'Breve descrição do seu trabalho clínico',
};

export const AccountResolutionForm = ({ requirement, onSuccess }: AccountResolutionFormProps) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<any>({});
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { uploadFile, updateAccount } = useFinancialAccount();



    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            let payload = { ...formData };

            if (requirement.includes('document') && file) {
                const uploadData = new FormData();
                uploadData.append('file', file);
                uploadData.append('document_type', 'IDENTIFICATION'); // Defaulting to IDENTIFICATION

                const uploadRes = await uploadFile.mutateAsync(uploadData);

                if (requirement === 'individual.verification.document') {
                    payload = {
                        individual: {
                            verification: {
                                document: { front: (uploadRes as any).id }
                            }
                        }
                    };
                }
            }

            await updateAccount.mutateAsync(payload);

            toast.success('Informações enviadas para análise do NeuroFinance!');

            onSuccess();
        } catch (err: any) {
            console.error('Update error:', err);
            toast.error(getUserFacingErrorMessage(err, 'save'));
        } finally {
            setLoading(false);
        }
    };

    const updateNestedValue = (path: string, val: any) => {
        const parts = path.split('.');
        setFormData((prev: any) => {
            const next = { ...prev };
            let curr = next;
            for (let i = 0; i < parts.length - 1; i++) {
                curr[parts[i]] = curr[parts[i]] || {};
                curr = curr[parts[i]];
            }
            curr[parts[parts.length - 1]] = val;
            return next;
        });
    };

    const renderField = (path: string, placeholder: string, type: string = "text") => {
        const label = FIELD_LABELS[path] || path.split('.').pop()?.replace(/_/g, ' ');
        return (
            <div className="space-y-3 group">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 group-focus-within:text-zinc-900 dark:group-focus-within:text-white transition-colors">
                    {label}
                </label>
                <Input
                    type={type}
                    placeholder={placeholder}
                    className="h-16 rounded-[24px] bg-white dark:bg-black/40 border-zinc-200 dark:border-white/10 focus:ring-0 focus:border-zinc-900 dark:focus:border-white transition-all text-sm font-bold px-6"
                    onChange={(e) => updateNestedValue(path, e.target.value)}
                />
            </div>
        );
    };

    const renderRequirementForm = () => {
        if (requirement === 'individual.political_exposure') {
            return (
                <div className="space-y-8 py-4">
                    <div className="space-y-2">
                        <h4 className="text-sm font-black uppercase tracking-tight text-zinc-900 dark:text-white">Você é uma Pessoa Politicamente Exposta (PEP)?</h4>
                        <p className="text-[11px] font-medium text-zinc-500 leading-relaxed">
                            Pessoas politicamente expostas são aquelas que exercem ou exerceram, nos últimos 5 anos, cargos, funções ou empregos públicos relevantes.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            { value: 'none', label: 'Não, não sou PEP', desc: 'Não ocupo cargos públicos relevantes', icon: X },
                            { value: 'existing', label: 'Sim, sou PEP', desc: 'Ocupo ou ocupei cargo relevante', icon: Check }
                        ].map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => updateNestedValue('individual.political_exposure', opt.value)}
                                className={cn(
                                    "p-6 rounded-[28px] border transition-all duration-300 text-left group/opt relative overflow-hidden",
                                    formData.individual?.political_exposure === opt.value
                                        ? "bg-zinc-900 dark:bg-white border-transparent shadow-xl"
                                        : "bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 hover:border-zinc-400"
                                )}
                            >
                                <div className={cn(
                                    "w-10 h-10 rounded-2xl flex items-center justify-center mb-4 transition-colors",
                                    formData.individual?.political_exposure === opt.value
                                        ? "bg-white/20 dark:bg-zinc-900/10 text-white dark:text-black"
                                        : "bg-zinc-100 dark:bg-white/5 text-zinc-400"
                                )}>
                                    <opt.icon className="w-5 h-5" />
                                </div>
                                <p className={cn(
                                    "text-[10px] font-black uppercase tracking-tight",
                                    formData.individual?.political_exposure === opt.value ? "text-white dark:text-black" : "text-zinc-900 dark:text-white"
                                )}>
                                    {opt.label}
                                </p>
                                <p className={cn(
                                    "text-[8px] font-bold uppercase tracking-widest mt-1 opacity-50",
                                    formData.individual?.political_exposure === opt.value ? "text-white dark:text-black" : "text-zinc-400"
                                )}>
                                    {opt.desc}
                                </p>
                            </button>
                        ))}
                    </div>
                </div>
            );
        }

        if (requirement.includes('individual.address')) {
            return (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {renderField('individual.address.line1', 'Ex: Av. Paulista, 1000')}
                        {renderField('individual.address.postal_code', '00000-000')}
                        {renderField('individual.address.city', 'Ex: São Paulo')}
                        {renderField('individual.address.state', 'Ex: SP')}
                    </div>
                </div>
            );
        }

        if (requirement.includes('individual.id_number')) {
            return renderField('individual.id_number', '000.000.000-00');
        }

        if (requirement.includes('individual.dob')) {
            return (
                <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Data de Nascimento</label>
                    <div className="grid grid-cols-3 gap-4">
                        <Input
                            placeholder="Dia"
                            className="h-16 rounded-[24px] text-center font-bold"
                            onChange={(e) => updateNestedValue('individual.dob.day', e.target.value)}
                        />
                        <Input
                            placeholder="Mês"
                            className="h-16 rounded-[24px] text-center font-bold"
                            onChange={(e) => updateNestedValue('individual.dob.month', e.target.value)}
                        />
                        <Input
                            placeholder="Ano"
                            className="h-16 rounded-[24px] text-center font-bold"
                            onChange={(e) => updateNestedValue('individual.dob.year', e.target.value)}
                        />
                    </div>
                </div>
            );
        }

        if (requirement.includes('business_profile.url')) {
            return renderField('business_profile.url', 'Ex: instagram.com/psicologo.fulano');
        }

        if (requirement.includes('business_profile.product_description')) {
            return (
                <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Descrição do seu trabalho</label>
                    <textarea
                        className="w-full min-h-[120px] p-6 rounded-[32px] bg-white dark:bg-black/40 border border-zinc-200 dark:border-white/10 focus:border-zinc-900 dark:focus:border-white transition-all text-sm font-bold resize-none outline-none"
                        placeholder="Ex: Ofereço serviços de psicoterapia clínica presencial e online para adultos e adolescentes..."
                        onChange={(e) => updateNestedValue('business_profile.product_description', e.target.value)}
                    />
                </div>
            );
        }

        if (requirement.includes('document')) {
            return (
                <div className="space-y-6">
                    <div className="p-12 rounded-[40px] border-2 border-dashed border-zinc-200 dark:border-white/10 hover:border-zinc-900 dark:hover:border-white transition-all text-center space-y-4 group cursor-pointer relative" onClick={() => fileInputRef.current?.click()}>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />

                        <div className="w-20 h-20 rounded-full bg-zinc-100 dark:bg-white/5 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                            {file ? <FileText className="w-8 h-8 text-zinc-900 dark:text-white" /> : <Upload className="w-8 h-8 text-zinc-400" />}
                        </div>

                        <div>
                            <h4 className="text-sm font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                {file ? file.name : "Selecionar Documento"}
                            </h4>
                            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest mt-1">
                                RG, CNH ou Passaporte (Frente)
                            </p>
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 flex gap-3">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-tight">
                            Formatos aceitos: PNG, JPG ou PDF. Tamanho máximo: 10MB.
                            Certifique-se de que a foto está nítida e todos os cantos do documento estão visíveis.
                        </p>
                    </div>
                </div>
            );
        }

        return (

            <div className="p-12 rounded-[40px] bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 text-center space-y-6">
                <div className="w-16 h-16 rounded-[24px] bg-white dark:bg-white/5 flex items-center justify-center mx-auto shadow-sm">
                    <HelpCircle className="w-8 h-8 text-zinc-300" />
                </div>
                <div>
                    <h4 className="text-xs font-black uppercase tracking-tight text-zinc-900 dark:text-white mb-2">Item sob verificação</h4>
                    <p className="text-[10px] font-medium text-zinc-400 leading-relaxed uppercase tracking-widest max-w-[240px] mx-auto">
                        Este item requer uma validação manual. Nossa equipe entrará em contato se precisar de algo mais.
                    </p>
                </div>
            </div>
        );
    };

    return (
        <form onSubmit={handleUpdate} className="h-full flex flex-col">
            <div className="flex-1 space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
                <div className="flex items-center gap-6 p-8 rounded-[40px] bg-zinc-900 dark:bg-white text-white dark:text-black shadow-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    <div className="w-14 h-14 rounded-[20px] bg-white/10 dark:bg-zinc-900/5 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-7 h-7" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tighter leading-none">Validar Informação</h3>
                        <p className="text-[9px] font-black uppercase tracking-[0.3em] opacity-50 mt-2">Ambiente Seguro NeuroFinance</p>
                    </div>
                </div>

                <div className="px-4">
                    {renderRequirementForm()}
                </div>

                <div className="p-8 rounded-[32px] bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5">
                    <div className="flex items-start gap-4">
                        <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-white/5 flex items-center justify-center shrink-0">
                            <Info className="w-4 h-4 text-zinc-400" />
                        </div>
                        <p className="text-[10px] font-bold text-zinc-500 leading-relaxed uppercase tracking-tight">
                            Ao confirmar, seus dados serão criptografados e enviados para análise de segurança bancária.
                            Este procedimento é vital para desbloquear saques e emissão de cobranças na sua conta.
                        </p>
                    </div>
                </div>
            </div>

            <div className="mt-12 pt-8 flex justify-end">
                <Button
                    type="submit"
                    disabled={loading}
                    className="h-20 px-12 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black hover:scale-105 active:scale-95 transition-all group font-black uppercase tracking-[0.2em] text-[11px] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_40px_-12px_rgba(255,255,255,0.1)]"
                >
                    {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <>
                            Confirmar Atualização
                            <ArrowRight className="w-4 h-4 ml-4 group-hover:translate-x-1 transition-transform" />
                        </>
                    )}
                </Button>
            </div>
        </form>
    );
};
