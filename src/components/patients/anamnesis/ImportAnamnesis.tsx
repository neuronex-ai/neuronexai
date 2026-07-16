import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Upload, X, Loader2, FileText, FileType, Image as ImageIcon, Sparkles, Wand2, Edit2, Check, Save, FileJson, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScanningEffect } from "./ScanningEffect";
import { useParams } from "react-router-dom";

interface ExtractedItem {
    question: string;
    answer: string;
    isSection?: boolean;
    isEditing?: boolean;
}

interface ImportAnamnesisProps {
    onBack: () => void;
    onSuccess?: () => void;
}

export function ImportAnamnesis({ onBack, onSuccess }: ImportAnamnesisProps) {
    const { id: patientId } = useParams<{ id: string }>();
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scanPhase, setScanPhase] = useState<'idle' | 'uploading' | 'analyzing' | 'extracting' | 'done'>('idle');
    const [extractedData, setExtractedData] = useState<ExtractedItem[]>([]);
    const [visibleCount, setVisibleCount] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [scanDuration, setScanDuration] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const shouldReduceMotion = useReducedMotion();

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isScanning && scanPhase !== 'done') {
            const start = Date.now();
            interval = setInterval(() => {
                setScanDuration(Math.floor((Date.now() - start) / 1000));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isScanning, scanPhase]);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileValidation(e.dataTransfer.files[0]);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFileValidation(e.target.files[0]);
        }
    };

    const handleFileValidation = (selectedFile: File) => {
        const allowedTypes = [
            'application/pdf',
            'image/png',
            'image/jpeg',
            'image/jpg',
            'image/webp',
            'text/plain',
            'text/markdown',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];

        const isMd = selectedFile.name.toLowerCase().endsWith('.md');

        if (!allowedTypes.includes(selectedFile.type) && !isMd) {
            if (selectedFile.name.toLowerCase().endsWith('.doc')) {
                toast.error("Formato .doc antigo não suportado", { description: "Por favor converta para .docx ou PDF." });
            } else {
                toast.error("Formato não suportado", { description: "Envie um PDF, DOCX, TXT, Markdown ou uma imagem." });
            }
            return;
        }

        if (selectedFile.size > 10 * 1024 * 1024) {
            toast.error("Arquivo muito grande", { description: "O limite é 10MB." });
            return;
        }
        setFile(selectedFile);
        setExtractedData([]);
        setVisibleCount(0);
        setError(null);
        setScanPhase('idle');
    };

    const fileToBase64 = (f: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(f);
        });
    };

    const extractTextFromDocx = async (f: File): Promise<string> => {
        const arrayBuffer = await f.arrayBuffer();
        const { default: mammoth } = await import("mammoth");
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value;
    };

    const extractTextFromFile = (f: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsText(f);
        });
    };

    const progressiveReveal = (items: ExtractedItem[]) => {
        setExtractedData(items);
        setVisibleCount(items.length);
    };

    const startScan = async () => {
        if (!file) return;

        setIsScanning(true);
        setScanPhase('uploading');
        setError(null);
        setExtractedData([]);

        try {
            let base64Data = "";
            let mimeType = file.type || "application/octet-stream";

            if (file.name.endsWith('.docx')) {
                const text = await extractTextFromDocx(file);
                base64Data = btoa(unescape(encodeURIComponent(text)));
                mimeType = "text/plain";
            } else if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
                const text = await extractTextFromFile(file);
                base64Data = btoa(unescape(encodeURIComponent(text)));
                mimeType = "text/plain";
            } else {
                base64Data = await fileToBase64(file);
            }

            setScanPhase('analyzing');

            const { data, error: fnError } = await supabase.functions.invoke('neuroscan-extract', {
                body: {
                    fileBase64: base64Data,
                    mimeType: mimeType,
                    fileName: file.name
                }
            });

            if (fnError) throw new Error(fnError.message);
            if (data?.error) throw new Error(data.error);
            if (!data?.items?.length) throw new Error("Nenhum dado encontrado.");

            setScanPhase('extracting');
            await new Promise(r => setTimeout(r, 600));

            setScanPhase('done');
            setIsScanning(false);

            const processedItems = data.items.map((item: any) => ({
                ...item,
                isEditing: false
            }));

            progressiveReveal(processedItems);
            toast.success("Análise concluída", { description: `${processedItems.length} campos extraídos.` });

        } catch (err: any) {
            console.error('[NeuroScan] Error:', err);
            setError(err.message || "Erro desconhecido. Verifique o arquivo.");
            setIsScanning(false);
            setScanPhase('idle');
        }
    };

    const toggleEdit = (index: number) => {
        const newData = [...extractedData];
        newData[index].isEditing = !newData[index].isEditing;
        setExtractedData(newData);
    };

    const updateField = (index: number, field: 'question' | 'answer', value: string) => {
        const newData = [...extractedData];
        newData[index][field] = value;
        setExtractedData(newData);
    };

    const saveAnamnesis = async () => {
        if (!patientId) {
            toast.error("Erro ao identificar paciente.");
            return;
        }

        setIsSaving(true);
        try {
            const cleanData = extractedData.map(({ isEditing, ...rest }) => rest);

            // Strategy: Try to update existing record first, then insert if none exists.
            // This avoids UNIQUE constraint violations that occur when DELETE is silently
            // blocked by RLS policies.
            const { data: existingRecords } = await supabase
                .from('patient_anamneses')
                .select('id')
                .eq('patient_id', patientId);

            if (existingRecords && existingRecords.length > 0) {
                // Update the first existing record with new content
                const primaryRecord = existingRecords[0];
                const { error: updateError } = await supabase
                    .from('patient_anamneses')
                    .update({
                        type: 'imported',
                        content: cleanData
                    })
                    .eq('id', primaryRecord.id);

                if (updateError) {
                    console.error('[NeuroScan] Update error:', updateError);
                    throw updateError;
                }

                // Clean up any duplicate records (best-effort, ignore errors)
                if (existingRecords.length > 1) {
                    await supabase
                        .from('patient_anamneses')
                        .delete()
                        .in('id', existingRecords.slice(1).map((record) => record.id));
                }
            } else {
                // No existing record — insert a new one
                const { error: insertErr } = await supabase
                    .from('patient_anamneses')
                    .insert({
                        patient_id: patientId,
                        type: 'imported',
                        content: cleanData
                    });

                if (insertErr) {
                    console.error('[NeuroScan] Insert error:', insertErr);
                    throw insertErr;
                }
            }

            toast.success("Anamnese importada com sucesso!");

            if (onSuccess) {
                onSuccess();
            } else {
                onBack();
            }
        } catch (err: any) {
            console.error('[NeuroScan] Save error:', err);
            toast.error("Erro ao importar", { description: err.message || "Verifique os dados e tente novamente." });
        } finally {
            setIsSaving(false);
        }
    };

    const getFileIcon = () => {
        if (!file) return FileText;
        if (file.type.includes('image')) return ImageIcon;
        if (file.type.includes('pdf')) return FileType;
        if (file.name.endsWith('.docx')) return FileText;
        if (file.name.endsWith('.json')) return FileJson;
        return FileText;
    };

    const FileIcon = getFileIcon();
    const showResults = extractedData.length > 0 || scanPhase === 'extracting' || scanPhase === 'done';
    const showUpload = !showResults;

    return (
        <div className="flex h-full w-full flex-col gap-6 p-1 md:p-4">

            <header className="flex items-center justify-between shrink-0 relative z-10">
                <div className="flex items-center gap-5">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onBack}
                        aria-label="Voltar à escolha de anamnese"
                        className="desktop-retina-inset desktop-retina-interactive h-11 w-11 rounded-2xl border border-border/50 bg-background/58 shadow-sm hover:bg-muted"
                    >
                        <ChevronLeft className="w-5 h-5 text-zinc-500" />
                    </Button>
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-zinc-900 shadow-lg">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white leading-none">NeuroScan AI</h1>
                            <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-[0.15em]">Importação Inteligente</p>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex flex-col gap-6 min-h-0 overflow-hidden relative z-10">

                <AnimatePresence mode="wait">
                    {showUpload && (
                        <motion.div
                            key="upload-area"
                            initial={shouldReduceMotion ? false : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex-1 flex items-center justify-center"
                        >
                            <div className={cn(
                                "patient-record-panel group relative w-full max-w-[520px] overflow-hidden rounded-[30px] border p-0 transition-[border-color,background-color,transform] duration-300",
                                isDragging ? "scale-[1.01] border-foreground/35 bg-muted/70" : "hover:border-border/70",
                            )}>
                                <ScanningEffect isActive={isScanning} />

                                <div className="relative z-20 flex flex-col items-center justify-center p-12 text-center space-y-8"
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                >
                                    <AnimatePresence mode="wait">
                                        {!file ? (
                                            <motion.div
                                                key="empty"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="space-y-8 w-full"
                                            >
                                                <div className="desktop-retina-inset mx-auto flex h-24 w-24 items-center justify-center rounded-[28px] border border-border/45 bg-muted/35 transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
                                                    <Upload className="w-8 h-8 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-white transition-colors" />
                                                </div>
                                                <div className="space-y-2">
                                                    <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Arraste seu arquivo</h3>
                                                    <p className="text-[10px] text-zinc-400 uppercase tracking-[0.2em] font-bold">PDF, DOCX, TXT ou Imagem</p>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="desktop-retina-interactive h-12 rounded-2xl border-border/50 bg-background/62 px-10 text-[10px] font-bold uppercase tracking-widest shadow-sm hover:bg-foreground hover:text-background"
                                                >
                                                    Selecionar Arquivo
                                                </Button>
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="file-loaded"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="w-full max-w-[280px] space-y-8"
                                            >
                                                <div className="desktop-retina-inset relative mx-auto flex h-36 w-28 items-center justify-center rounded-2xl border border-border/50 bg-background/64 shadow-lg">
                                                    <FileIcon className="w-10 h-10 text-zinc-300" />
                                                    {!isScanning && (
                                                        <button
                                                            onClick={() => { setFile(null); setError(null); }}
                                                            aria-label="Remover arquivo"
                                                            className="desktop-retina-interactive absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background shadow-lg"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="space-y-1">
                                                    <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{file.name}</p>
                                                    <p className="text-[10px] text-zinc-400 font-medium">
                                                        {(file.size / 1024 / 1024).toFixed(2)} MB
                                                    </p>
                                                </div>

                                                {!isScanning && scanPhase === 'idle' && (
                                                    <Button
                                                        onClick={startScan}
                                                        className="w-full rounded-2xl h-14 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl"
                                                    >
                                                        <Wand2 className="w-4 h-4 mr-3" /> Analisar com IA
                                                    </Button>
                                                )}

                                                {isScanning && (
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="flex items-center gap-2.5 text-zinc-500 dark:text-zinc-400">
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                            <span className="text-[10px] font-bold uppercase tracking-widest">
                                                                {scanPhase === 'analyzing' ? 'Analisando...' : 'Processando...'}
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] text-zinc-400 tabular-nums">{scanDuration}s</p>
                                                    </div>
                                                )}

                                                {error && (
                                                    <div className="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/10 text-rose-500 text-xs font-medium leading-relaxed">
                                                        {error}
                                                        <button onClick={() => { setError(null); startScan(); }} className="block mt-3 underline opacity-70 hover:opacity-100 text-[10px] uppercase tracking-widest font-bold">
                                                            Tentar novamente
                                                        </button>
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.docx,.md"
                                    onChange={handleFileSelect}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {showResults && (
                    <motion.div
                        initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
                        className="flex-1 flex flex-col gap-4 min-h-0"
                    >
                        {/* Status bar with top confirm button */}
                        <div className="patient-record-panel flex h-14 shrink-0 items-center justify-between rounded-2xl border px-4 sm:px-6">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">
                                    {visibleCount >= extractedData.length ? `${extractedData.length} campos extraídos` : 'Carregando campos...'}
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
                                    {visibleCount} / {extractedData.length}
                                </span>
                                {visibleCount >= extractedData.length && extractedData.length > 0 && (
                                    <Button
                                        onClick={saveAnamnesis}
                                        disabled={isSaving}
                                        size="sm"
                                        className="rounded-xl h-9 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-[10px] uppercase tracking-widest shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 px-5"
                                    >
                                        {isSaving ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                                        ) : (
                                            <Save className="w-3.5 h-3.5 mr-2" />
                                        )}
                                        {isSaving ? "Salvando..." : "Confirmar"}
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Results container */}
                        <div className="patient-record-panel relative flex-1 overflow-hidden rounded-[28px] border">
                            <div className="custom-scrollbar h-full overflow-y-auto overscroll-contain p-6 pb-40 [contain:layout_paint_style] [scrollbar-gutter:stable] md:p-8 md:pb-40">
                                <div className="max-w-3xl mx-auto space-y-6">
                                    {extractedData.slice(0, visibleCount).map((item, idx) => (
                                    <div
                                            key={idx}
                                            style={{ contentVisibility: "auto", containIntrinsicSize: item.isSection ? "72px" : "180px" }}
                                        >
                                            {item.isSection ? (
                                                <div className="flex items-center gap-6 pt-8 pb-4 mt-6 first:mt-0">
                                                    <div className="h-px flex-1 bg-zinc-200/70 dark:bg-zinc-800/75" />
                                                    <div className="flex items-center gap-2 shrink-0 group">
                                                        {item.isEditing ? (
                                                            <div className="flex items-center gap-2">
                                                                <Input
                                                                    value={item.question}
                                                                    onChange={(e) => updateField(idx, 'question', e.target.value)}
                                                                className="desktop-retina-inset h-9 w-56 rounded-lg border-border/50 bg-background/58 text-xs font-bold uppercase tracking-widest text-foreground"
                                                                />
                                                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => toggleEdit(idx)}>
                                                                    <Check className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <h3 className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">{item.question}</h3>
                                                                <button onClick={() => toggleEdit(idx)} className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                                                                    <Edit2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                    <div className="h-px flex-1 bg-zinc-200/70 dark:bg-zinc-800/75" />
                                                </div>
                                            ) : (
                                                <div className="desktop-retina-inset group relative rounded-[22px] border border-border/40 bg-background/56 p-5 transition-colors duration-300 hover:border-border/75 hover:bg-background/76">
                                                    <div className="flex justify-between items-start mb-2 gap-4">
                                                        {item.isEditing ? (
                                                            <Input
                                                                value={item.question}
                                                                onChange={(e) => updateField(idx, 'question', e.target.value)}
                                                                className="desktop-retina-inset h-9 flex-1 rounded-lg border-border/50 bg-background/58 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                                                            />
                                                        ) : (
                                                            <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest leading-none">{item.question}</label>
                                                        )}

                                                        <button
                                                            onClick={() => toggleEdit(idx)}
                                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white shrink-0 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/5"
                                                        >
                                                            {item.isEditing ? <Check className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
                                                        </button>
                                                    </div>

                                                    {item.isEditing ? (
                                                        <Textarea
                                                            value={item.answer}
                                                            onChange={(e) => updateField(idx, 'answer', e.target.value)}
                                                            className="desktop-retina-inset min-h-[100px] resize-none rounded-xl border-border/50 bg-background/58 p-4 text-sm leading-relaxed text-foreground"
                                                        />
                                                    ) : (
                                                        <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                                                            {item.answer || <span className="text-zinc-300 dark:text-zinc-700 italic">Não detectado</span>}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Confirm import button */}
                            {visibleCount >= extractedData.length && extractedData.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="absolute bottom-0 left-0 right-0 z-30 flex justify-center bg-gradient-to-t from-background via-background/98 to-transparent p-8 pt-16"
                                >
                                    <Button
                                        onClick={saveAnamnesis}
                                        disabled={isSaving}
                                        className="w-full max-w-sm rounded-2xl h-14 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-[11px] uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                                    >
                                        {isSaving ? (
                                            <Loader2 className="w-5 h-5 animate-spin mr-3" />
                                        ) : (
                                            <Save className="w-5 h-5 mr-3" />
                                        )}
                                        {isSaving ? "Salvando..." : "Confirmar Importação"}
                                    </Button>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
