"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Loader2, Check, MoreVertical, FileDown, Mail, Trash2, RefreshCcw, ClipboardList } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { usePatientById } from "@/hooks/use-patient-by-id";
import { useProfile } from "@/hooks/use-profile";
import { useGoogleAuth } from "@/hooks/use-google-auth";
import { downloadDocumentPDF, generateDocumentPDFBase64, DocumentPDFData } from "@/lib/pdf-generator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface ExtractedItem {
    question: string;
    answer: string;
    isSection?: boolean;
}

const ANAMNESIS_RENDER_PAGE_SIZE = 12;

const parseAnamnesisContent = (content: unknown): ExtractedItem[] => {
    if (Array.isArray(content)) {
        return content.filter(Boolean) as ExtractedItem[];
    }

    if (!content || typeof content !== "object") {
        return [];
    }

    const fields = (content as { fields?: Record<string, unknown> }).fields;
    if (!fields || typeof fields !== "object") {
        return [];
    }

    return Object.entries(fields).map(([question, answer]) => ({
        question,
        answer: String(answer ?? ""),
    }));
};

const AutoSaveField = memo(function AutoSaveField({
    initialValue,
    type,
    onSave,
    className
}: {
    initialValue: string;
    type: 'question' | 'answer';
    onSave: (val: string) => void;
    className?: string;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState(initialValue);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length);
        }
    }, [isEditing]);

    useEffect(() => {
        if (!isEditing) {
            setValue(initialValue);
        }
    }, [initialValue, isEditing]);

    const handleBlur = () => {
        setIsEditing(false);
        if (value !== initialValue) {
            onSave(value);
        }
    };

    if (isEditing) {
        return (
            <Textarea
                ref={inputRef}
                value={value}
                aria-label={type === "question" ? "Editar título do campo" : "Editar resposta da anamnese"}
                onChange={(e) => setValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={(event) => {
                    if (event.key === "Escape") {
                        event.preventDefault();
                        setValue(initialValue);
                        setIsEditing(false);
                    }
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                        event.preventDefault();
                        event.currentTarget.blur();
                    }
                }}
                className={cn(
                    "desktop-retina-inset min-h-[128px] w-full resize-none overflow-hidden rounded-[22px] border border-border/55 bg-background/72 p-5 text-[15px] leading-relaxed text-foreground outline-none transition-[border-color,background-color,box-shadow] duration-300 focus:border-foreground/20 focus:bg-background focus:ring-4 focus:ring-foreground/[0.035]",
                    type === 'question' && "min-h-[42px] px-3 py-2 text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400",
                    className
                )}
            />
        );
    }

    return (
        <button
            type="button"
            onClick={() => setIsEditing(true)}
            aria-label={type === "question" ? "Editar título do campo" : "Editar resposta da anamnese"}
            className={cn(
                "group/field -mx-2 min-h-11 w-[calc(100%+1rem)] cursor-text rounded-2xl px-2 text-left transition-colors duration-300 hover:bg-foreground/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45",
                type === 'question' ? "py-1" : "py-2 min-h-[2.5rem]"
            )}
        >
            <p className={cn(
                type === 'question'
                    ? "text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500/80 transition-colors group-hover/field:text-zinc-900 dark:text-zinc-500 dark:group-hover/field:text-zinc-200"
                    : "whitespace-pre-wrap break-words text-[15px] font-medium leading-relaxed text-zinc-700 dark:text-zinc-300",
                className
            )}>
                {value || <span className="opacity-50 italic font-normal text-zinc-500">Clique para adicionar resposta...</span>}
            </p>
        </button>
    );
});

const AnamnesisEntry = memo(function AnamnesisEntry({
    item,
    index,
    onUpdate,
}: {
    item: ExtractedItem;
    index: number;
    onUpdate: (index: number, field: 'question' | 'answer', value: string) => void;
}) {
    if (item.isSection) {
        return (
            <div
                className="relative mb-1 pb-4 pt-7 first:pt-0"
                style={{ contentVisibility: "auto", containIntrinsicSize: "72px" }}
            >
                <div className="pointer-events-none absolute inset-x-6 top-1/2 h-px bg-gradient-to-r from-transparent via-zinc-950/10 to-transparent dark:via-zinc-700/45" />
                <div className="relative z-10 flex justify-center">
                    <div className="desktop-retina-inset relative overflow-hidden rounded-full border border-border/50 bg-background/82 px-8 py-2">
                        <AutoSaveField
                            type="question"
                            initialValue={item.question}
                            onSave={(value) => onUpdate(index, 'question', value)}
                            className="!text-center !text-[11px] !font-bold !uppercase !tracking-[0.24em] !text-foreground"
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="patient-record-card group/item relative overflow-hidden rounded-[26px] border p-6 md:p-7"
            style={{ contentVisibility: "auto", containIntrinsicSize: "190px" }}
        >
            <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent opacity-80 dark:via-zinc-700/45" />
            <div className="relative z-10 mb-4">
                <AutoSaveField
                    type="question"
                    initialValue={item.question}
                    onSave={(value) => onUpdate(index, 'question', value)}
                    className="!text-[10px] !font-bold !uppercase !tracking-[0.2em] !text-muted-foreground"
                />
            </div>
            <div className="relative z-10">
                <AutoSaveField
                    type="answer"
                    initialValue={item.answer}
                    onSave={(value) => onUpdate(index, 'answer', value)}
                    className="!text-[15px] !font-medium !leading-relaxed !text-foreground/90"
                />
            </div>
        </div>
    );
});

interface ViewAnamnesisProps {
    onChangeTemplate?: () => void;
    onResetToSelection?: () => void;
}

export function ViewAnamnesis({ onChangeTemplate, onResetToSelection }: ViewAnamnesisProps = {}) {
    const { id: patientId } = useParams<{ id: string }>();
    const shouldReduceMotion = useReducedMotion();
    const [data, setData] = useState<ExtractedItem[]>([]);
    const [visibleCount, setVisibleCount] = useState(ANAMNESIS_RENDER_PAGE_SIZE);
    const [isLoading, setIsLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [anamnesisId, setAnamnesisId] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);
    const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { isConnected: isGoogleConnected } = useGoogleAuth();

    const { data: profile } = useProfile();
    const { data: patient } = usePatientById(patientId || "");

    const fetchAnamnesis = useCallback(async () => {
        if (!patientId) return;
        try {
            const { data: records, error } = await supabase
                .from('patient_anamneses')
                .select('id, content, updated_at')
                .eq('patient_id', patientId)
                .order('updated_at', { ascending: false });

            if (error) throw error;

            const record = records?.find((candidate) => parseAnamnesisContent(candidate.content).length > 0);
            if (record) {
                setAnamnesisId(record.id);
                const items = parseAnamnesisContent(record.content);
                setData(items);
                setVisibleCount(Math.min(ANAMNESIS_RENDER_PAGE_SIZE, Math.max(items.length, 1)));
            }
        } catch (err) {
            console.error('[ViewAnamnesis] Fetch error:', err);
            toast.error("Erro ao carregar anamnese");
        } finally {
            setIsLoading(false);
        }
    }, [patientId]);

    useEffect(() => {
        void fetchAnamnesis();
    }, [fetchAnamnesis]);

    const [linkModalOpen, setLinkModalOpen] = useState(false);
    const [publicToken, setPublicToken] = useState<string | null>(null);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (!anamnesisId) return;

        const channel = supabase
            .channel(`anamnesis-${anamnesisId}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'patient_anamneses', filter: `id=eq.${anamnesisId}` }, (payload) => {
                const items = parseAnamnesisContent(payload.new.content);
                setData(items);
                setVisibleCount((current) => Math.min(Math.max(current, ANAMNESIS_RENDER_PAGE_SIZE), Math.max(items.length, 1)));
                toast.info("Anamnese atualizada remotamente!");
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [anamnesisId]);

    const saveToDb = useCallback(async (newData: ExtractedItem[]) => {
        if (!anamnesisId) return;

        setSaveStatus('saving');
        try {
            const { error } = await supabase
                .from('patient_anamneses')
                .update({
                    content: newData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', anamnesisId);

            if (error) throw error;
            setSaveStatus('saved');
            if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
            saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 1600);
        } catch (err) {
            console.error(err);
            toast.error("Erro ao salvar alteração");
            setSaveStatus('idle');
        }
    }, [anamnesisId]);

    const handleUpdate = useCallback((index: number, field: 'question' | 'answer', newValue: string) => {
        setData((currentData) => {
            const newData = currentData.map((item, itemIndex) => (
                itemIndex === index ? { ...item, [field]: newValue } : item
            ));
            void saveToDb(newData);
            return newData;
        });
    }, [saveToDb]);

    useEffect(() => () => {
        if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    }, []);

    useEffect(() => {
        setVisibleCount((current) => {
            if (data.length === 0) return ANAMNESIS_RENDER_PAGE_SIZE;
            return Math.min(Math.max(current, ANAMNESIS_RENDER_PAGE_SIZE), data.length);
        });
    }, [data.length]);

    useEffect(() => {
        if (!isLoading && data.length === 0) {
            onResetToSelection?.();
        }
    }, [data.length, isLoading, onResetToSelection]);

    const visibleData = useMemo(
        () => data.slice(0, Math.min(visibleCount, data.length)),
        [data, visibleCount]
    );

    const hiddenFieldsCount = Math.max(data.length - visibleData.length, 0);

    const handleLoadMoreFields = useCallback(() => {
        setVisibleCount((current) => Math.min(current + ANAMNESIS_RENDER_PAGE_SIZE, data.length));
    }, [data.length]);

    const getPDFData = (): DocumentPDFData => {
        const formattedContent = data.map(item =>
            `<p><strong>${item.question}</strong></p><p>${item.answer || "Não informado"}</p>`
        ).join('<br/>');

        return {
            type: "Anamnese",
            title: "Ficha de Anamnese",
            content: formattedContent,
            patientName: patient?.name || "Paciente",
            patientDoc: patient?.cpf || undefined,
            professionalName: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || "Profissional",
            professionalRegistry: profile?.crp || "NeuroNex CRP",
            date: format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
            clinicName: "NeuroNex Clinic"
        };
    };

    const handleDownloadPDF = async () => {
        if (!patient || !profile) {
            toast.error("Aguarde o carregamento dos dados...");
            return;
        }
        try {
            toast.info("Gerando PDF...");
            const pdfData = getPDFData();
            await downloadDocumentPDF(pdfData, `anamnese_${patient.name.split(' ')[0]}.pdf`);
            toast.success("Download iniciado!");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao gerar PDF");
        }
    };

    const handleSendEmail = async () => {
        if (!patient?.email) {
            toast.error("Paciente sem e-mail cadastrado.");
            return;
        }

        if (isGoogleConnected === false) {
            toast.error("Conecte sua conta Google Workspace nos Ajustes para utilizar o envio via Gmail.", {
                action: {
                    label: "Conectar",
                    onClick: () => window.location.href = "/ajustes?tab=integrations"
                }
            });
            return;
        }

        setIsSending(true);
        toast.info("Gerando PDF e enviando via Gmail...");

        try {
            const pdfData = getPDFData();
            const base64 = await generateDocumentPDFBase64(pdfData);

            const { error } = await supabase.functions.invoke('send-document-email', {
                body: {
                    to: patient.email,
                    subject: `Ficha de Anamnese - ${patient.name}`,
                    htmlBody: `<p>Olá, ${patient.name.split(' ')[0]}.</p><p>Segue em anexo a sua ficha de anamnese completa.</p>`,
                    documentType: 'Ficha de Anamnese',
                    pdfAttachment: {
                        filename: `Anamnese_${patient.name.split(' ')[0]}.pdf`,
                        content: base64,
                        contentType: 'application/pdf'
                    }
                }
            });

            if (error) {
                console.error("Function error:", error);
                throw new Error("Erro na função de envio.");
            }

            toast.success(`Enviado para ${patient.email}`);
        } catch (error: any) {
            console.error(error);
            toast.error("Erro ao enviar e-mail via Gmail.");
        } finally {
            setIsSending(false);
        }
    };

    if (isLoading) {
        return (
            <div className="w-full h-full flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-zinc-300 dark:text-zinc-600 animate-spin" />
            </div>
        );
    }

    if (!data.length && !isLoading) {
        return null;
    }


    const handleDelete = async () => {
        if (!anamnesisId) return;
        setIsDeleting(true);
        try {
            // Try hard delete first
            const { data: deleted, error } = await supabase
                .from('patient_anamneses')
                .delete()
                .eq('id', anamnesisId)
                .select('id');

            if (error) throw error;

            // If RLS blocked the delete (0 rows affected), fall back to clearing content
            if (!deleted || deleted.length === 0) {
                console.warn('[Anamnesis] Hard delete returned 0 rows - falling back to content clear');
                const { error: updateError } = await supabase
                    .from('patient_anamneses')
                    .update({
                        content: [],
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', anamnesisId);

                if (updateError) throw updateError;
            }

            toast.success("Ficha de anamnese excluída.");
            setData([]);
            setAnamnesisId(null);
            setConfirmDeleteOpen(false);
            if (onResetToSelection) {
                onResetToSelection();
            }
        } catch (err) {
            console.error('[Anamnesis] Delete error:', err);
            toast.error("Erro ao excluir.");
            setConfirmDeleteOpen(false);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleGenerateLink = async () => {
        if (!anamnesisId) return;
        setLinkModalOpen(true);

        const token = Math.floor(10000 + Math.random() * 90000).toString();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        try {
            const { error } = await supabase
                .from('patient_anamneses')
                .update({
                    access_token: token,
                    token_expires_at: expiresAt.toISOString()
                })
                .eq('id', anamnesisId);

            if (error) throw error;
            setPublicToken(token);
        } catch (err) {
            console.error(err);
            toast.error("Erro ao gerar link.");
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copiado!");
    };

    return (
        <div className="flex h-[calc(100dvh-var(--desktop-navbar-clearance)-8rem)] min-h-[560px] max-h-[820px] w-full flex-col items-center overflow-hidden px-1 pb-4">
            <div className="relative flex h-full w-full max-w-5xl flex-1 flex-col px-0.5">

                <motion.div
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                    className="patient-record-panel group/doc-container relative flex h-full w-full flex-col overflow-hidden rounded-[30px] border"
                >
                    <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent opacity-75 dark:via-zinc-700/45" />

                    <div className="relative z-20 flex flex-col items-center justify-between gap-4 border-b border-border/50 bg-muted/24 p-5 sm:flex-row sm:px-6">
                        <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200/70 bg-zinc-950 text-white shadow-[0_18px_38px_-24px_rgba(24,24,27,0.55)] dark:border-zinc-700 dark:bg-zinc-200 dark:text-zinc-950 dark:shadow-[0_18px_42px_-28px_rgba(0,0,0,0.72)]">
                                <ClipboardList className="h-4.5 w-4.5" />
                            </div>
                            <div>
                                <h3 className="mb-1 text-base font-bold leading-none tracking-tight text-foreground">Ficha de anamnese</h3>
                                <p className="text-[9px] font-bold uppercase tracking-[0.2em] leading-none text-muted-foreground">Documento clínico • NeuroNex</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <AnimatePresence mode="wait">
                                {saveStatus === 'saving' && (
                                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex items-center gap-3 rounded-full border border-zinc-200/70 bg-white/74 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 shadow-sm backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/75">
                                        <Loader2 className="w-4 h-4 animate-spin" /> SALVANDO...
                                    </motion.div>
                                )}
                                {saveStatus === 'saved' && (
                                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex items-center gap-3 rounded-full border border-zinc-200/70 bg-zinc-950 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-[0_16px_38px_-28px_rgba(24,24,27,0.7)] dark:border-zinc-700 dark:bg-zinc-200 dark:text-zinc-950">
                                        <Check className="w-4 h-4" /> ATUALIZADO
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" aria-label="Ações da ficha de anamnese" className="desktop-retina-inset h-11 w-11 rounded-2xl border border-border/50 bg-background/48 text-muted-foreground shadow-sm transition-colors hover:bg-background hover:text-foreground">
                                        <MoreVertical className="h-5 w-5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="desktop-retina-modal w-72 rounded-[26px] border-border/60 bg-popover/96 p-3 shadow-2xl">
                                    <div className="mb-1 px-4 py-3 text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">Ações do documento</div>
                                    <DropdownMenuItem onClick={handleDownloadPDF} className="gap-4 rounded-2xl cursor-pointer text-zinc-700 dark:text-zinc-300 text-[11px] font-black uppercase tracking-widest py-4 px-5 hover:bg-zinc-50 dark:hover:bg-white/5 transition-all">
                                        <div className="p-2 rounded-xl bg-zinc-50 dark:bg-white/10"><FileDown className="h-4 w-4" /></div> Baixar PDF
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleSendEmail} disabled={isSending} className="gap-4 rounded-2xl cursor-pointer text-zinc-700 dark:text-zinc-300 text-[11px] font-black uppercase tracking-widest py-4 px-5 hover:bg-zinc-50 dark:hover:bg-white/5 transition-all">
                                        <div className="p-2 rounded-xl bg-zinc-50 dark:bg-white/10">
                                            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                                        </div> Enviar por E-mail
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleGenerateLink} className="gap-4 rounded-2xl cursor-pointer text-zinc-700 dark:text-zinc-300 text-[11px] font-black uppercase tracking-widest py-4 px-5 hover:bg-zinc-50 dark:hover:bg-white/5 transition-all">
                                        <div className="p-2 rounded-xl bg-zinc-50 dark:bg-white/10"><ClipboardList className="h-4 w-4" /></div> Enviar ao paciente
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="mx-2 my-3 bg-zinc-200/70 dark:bg-zinc-800/75" />
                                    <DropdownMenuItem
                                        onClick={() => {
                                            if (onChangeTemplate) {
                                                onChangeTemplate();
                                            } else {
                                                setConfirmDeleteOpen(true);
                                            }
                                        }}
                                        className="gap-4 rounded-2xl cursor-pointer text-zinc-600 dark:text-zinc-400 text-[11px] font-black uppercase tracking-widest py-4 px-5 hover:bg-zinc-50 dark:hover:bg-white/5 transition-all"
                                    >
                                        <div className="p-2 rounded-xl bg-zinc-50 dark:bg-white/10"><RefreshCcw className="h-4 w-4" /></div> Trocar modelo
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => { setConfirmDeleteOpen(true); }}
                                        className="gap-4 rounded-2xl cursor-pointer text-rose-500 text-[11px] font-black uppercase tracking-widest py-4 px-5 hover:bg-rose-500/5 transition-all"
                                    >
                                        <div className="p-2 rounded-xl bg-rose-500/10"><Trash2 className="h-4 w-4" /></div> Excluir modelo
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    <div className="anamnesis-scroll-surface custom-scrollbar relative z-10 flex-1 overflow-y-auto overscroll-contain p-5 [contain:layout_paint_style] [scrollbar-gutter:stable] sm:p-7">
                        <div className="mx-auto max-w-4xl space-y-4">
                            {visibleData.map((item, idx) => (
                                <AnamnesisEntry key={`${item.isSection ? "section" : "field"}-${idx}`} item={item} index={idx} onUpdate={handleUpdate} />
                            ))}
                            {hiddenFieldsCount > 0 && (
                                <div className="flex flex-col items-center gap-3 pt-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleLoadMoreFields}
                                        className="h-12 rounded-2xl border-zinc-200/70 bg-white/70 px-6 text-[10px] font-black uppercase tracking-[0.18em] text-foreground shadow-[0_18px_40px_-32px_rgba(24,24,27,0.45)] backdrop-blur-xl transition-all hover:bg-white active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900/75 dark:hover:bg-zinc-900"
                                    >
                                        Carregar mais campos
                                    </Button>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                        Mostrando {visibleData.length} de {data.length}
                                    </p>
                                </div>
                            )}
                            <div className="h-20" />
                        </div>
                    </div>
                </motion.div>
            </div>

            <Dialog open={linkModalOpen} onOpenChange={setLinkModalOpen}>
                <DialogContent className="desktop-retina-modal desktop-retina-form z-[210] w-[calc(100%-2rem)] max-w-md gap-0 overflow-hidden rounded-[30px] border border-border/65 bg-background/96 p-0 shadow-2xl">
                    <DialogHeader className="border-b border-border/50 p-6 text-left">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[18px] bg-foreground text-background shadow-sm">
                            <ClipboardList className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <DialogTitle className="text-xl font-black tracking-tight text-foreground">Compartilhar anamnese</DialogTitle>
                        <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                            Envie o link e o código de segurança ao paciente para que ele preencha a ficha.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 p-6">
                        <div className="space-y-2">
                            <label className="block text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">Link de acesso</label>
                            <div className="grid grid-cols-[minmax(0,1fr)_44px] gap-2">
                                <div className="desktop-retina-inset truncate rounded-[15px] border border-border/50 bg-muted/30 px-4 py-3 font-mono text-[10px] text-muted-foreground">
                                    {`${window.location.origin}/anamnese-externa/${anamnesisId}`}
                                </div>
                                <Button size="icon" aria-label="Copiar link" className="h-11 w-11 rounded-[15px] bg-foreground text-background" onClick={() => copyToClipboard(`${window.location.origin}/anamnese-externa/${anamnesisId}`)}>
                                    <Check className="h-4 w-4" aria-hidden="true" />
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">Código de segurança</label>
                            <div className="grid grid-cols-[minmax(0,1fr)_44px] gap-2">
                                <div className="desktop-retina-inset rounded-[15px] border border-border/50 bg-muted/30 px-4 py-2.5 text-center text-xl font-black tracking-[0.32em] text-foreground tabular-nums">
                                    {publicToken || <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />}
                                </div>
                                <Button size="icon" aria-label="Copiar código" className="h-11 w-11 rounded-[15px] bg-foreground text-background" onClick={() => copyToClipboard(publicToken || "")}>
                                    <Check className="h-4 w-4" aria-hidden="true" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="grid grid-cols-1 gap-2 border-t border-border/50 bg-muted/18 p-4 sm:grid-cols-2 sm:space-x-0">
                        <Button variant="outline" className="h-11 rounded-xl" onClick={() => setLinkModalOpen(false)}>Fechar</Button>
                        <Button className="h-11 rounded-xl bg-foreground text-background" onClick={() => {
                            const text = `Olá! Segue o link para preenchimento da sua ficha de anamnese:\n\nLink: ${window.location.origin}/anamnese-externa/${anamnesisId}\nCódigo: ${publicToken}\n\nPor favor, preencha assim que possível.`;
                            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
                        }}>
                            <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
                <AlertDialogContent className="desktop-retina-modal z-[220] w-[calc(100%-2rem)] max-w-md gap-0 overflow-hidden rounded-[30px] border border-border/70 bg-background/96 p-0 shadow-2xl backdrop-blur-2xl sm:rounded-[30px]">
                    <div className="p-6 sm:p-8">
                        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-500 dark:text-rose-300">
                            <Trash2 className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <AlertDialogHeader className="space-y-2 text-left">
                            <AlertDialogTitle className="text-xl font-semibold tracking-tight text-foreground">
                                Excluir modelo de anamnese?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-sm leading-relaxed text-muted-foreground">
                                O modelo e todas as respostas preenchidas serão excluídos permanentemente. Depois, você poderá escolher outro modelo ou importar um documento.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                    </div>
                    <AlertDialogFooter className="grid grid-cols-1 gap-2 border-t border-border/60 bg-muted/20 p-4 sm:grid-cols-2 sm:space-x-0">
                        <AlertDialogCancel className="mt-0 h-11 rounded-xl border-border/70 bg-background text-foreground hover:bg-muted">
                            Manter modelo
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="h-11 rounded-xl bg-rose-600 text-white shadow-none hover:bg-rose-700 focus-visible:ring-rose-500"
                            disabled={isDeleting}
                            onClick={(event) => {
                                event.preventDefault();
                                void handleDelete();
                            }}
                        >
                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                            {isDeleting ? "Excluindo..." : "Excluir modelo"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

const MessageCircle = ({ className }: { className?: string }) => (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /><path d="M8 12h.01" /><path d="M12 12h.01" /><path d="M16 12h.01" /></svg>
);
