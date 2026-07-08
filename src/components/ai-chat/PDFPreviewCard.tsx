import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FileText, Download, Mail, Loader2, ZoomIn, ZoomOut, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PDFPreviewCardProps {
    pdfBlob?: Blob;
    pdfUrl?: string;
    filename: string;
    title?: string;
    onSendEmail?: () => void;
    isLoadingEmail?: boolean;
    isLoading?: boolean;
}

export const PDFPreviewCard = ({
    pdfBlob,
    pdfUrl,
    filename,
    title,
    onSendEmail,
    isLoadingEmail = false,
    isLoading: externalLoading = false
}: PDFPreviewCardProps) => {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [internalLoading, setInternalLoading] = useState(true);
    const shouldReduceMotion = useReducedMotion();
    const isLoading = externalLoading || internalLoading;
    const [zoom, setZoom] = useState(100);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        if (pdfBlob) {
            const url = URL.createObjectURL(pdfBlob);
            setBlobUrl(url);
            setInternalLoading(false);
            return () => URL.revokeObjectURL(url);
        } else if (pdfUrl) {
            setBlobUrl(pdfUrl);
            setInternalLoading(false);
        }
    }, [pdfBlob, pdfUrl]);

    const handleDownload = () => {
        if (!blobUrl) return;
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));

    return (
        <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.97, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : {
                type: "spring",
                stiffness: 300,
                damping: 30,
                delay: 0.1
            }}
            className={cn(
                "notes-liquid-surface group relative my-6 overflow-hidden rounded-[26px] border shadow-2xl",
                isExpanded && "fixed inset-4 z-50 my-0"
            )}
        >
            {/* Premium gradient border effect */}
            <div className="pointer-events-none absolute inset-0 rounded-[26px] bg-[linear-gradient(135deg,hsl(var(--foreground)/0.04),transparent_44%)] opacity-0 transition-opacity group-hover:opacity-100" />

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between gap-3 border-b border-foreground/[0.07] px-5 py-4 dark:border-white/[0.055] sm:px-6">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-foreground/[0.085] bg-muted/45 dark:border-white/[0.075] dark:bg-white/[0.06]">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                        <h4 className="truncate text-sm font-bold tracking-tight text-foreground">
                            {title || "Documento PDF"}
                        </h4>
                        <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                            {filename}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Zoom controls */}
                    <div className="flex items-center gap-1 rounded-lg border border-foreground/[0.085] bg-background/55 px-2 py-1 dark:border-white/[0.075] dark:bg-white/[0.045]">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleZoomOut}
                            disabled={zoom <= 50}
                            className="h-7 w-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                            aria-label="Diminuir zoom"
                        >
                            <ZoomOut className="h-3.5 w-3.5" />
                        </Button>
                        <span className="min-w-[40px] text-center font-mono text-[10px] text-muted-foreground">
                            {zoom}%
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleZoomIn}
                            disabled={zoom >= 200}
                            className="h-7 w-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                            aria-label="Aumentar zoom"
                        >
                            <ZoomIn className="h-3.5 w-3.5" />
                        </Button>
                    </div>

                    {/* Action buttons */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleDownload}
                        disabled={!blobUrl}
                        className="h-8 w-8 rounded-lg border border-foreground/[0.085] text-muted-foreground hover:bg-muted hover:text-foreground dark:border-white/[0.075]"
                        title="Baixar PDF"
                        aria-label="Baixar PDF"
                    >
                        <Download className="h-4 w-4" />
                    </Button>

                    {onSendEmail && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onSendEmail}
                            disabled={isLoadingEmail || !blobUrl}
                            className="h-8 w-8 rounded-lg border border-foreground/[0.085] text-muted-foreground transition-all hover:bg-muted hover:text-foreground dark:border-white/[0.075]"
                            title="Enviar por Email"
                            aria-label="Enviar PDF por e-mail"
                        >
                            {isLoadingEmail ? (
                                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                            ) : (
                                <Mail className="h-4 w-4" />
                            )}
                        </Button>
                    )}

                    {isExpanded && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsExpanded(false)}
                            className="h-8 w-8 rounded-lg border border-foreground/[0.085] text-muted-foreground hover:bg-muted hover:text-foreground dark:border-white/[0.075]"
                            aria-label="Fechar preview expandido"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* PDF Preview */}
            <div
                className={cn(
                    "custom-scrollbar relative overflow-auto bg-muted/35 dark:bg-black/35",
                    isExpanded ? "h-[calc(100vh-120px)]" : "max-h-[600px]"
                )}
                style={{
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: 'top center',
                    transition: shouldReduceMotion ? 'none' : 'transform 0.2s ease-out'
                }}
            >
                {isLoading ? (
                    <div className="flex items-center justify-center h-96">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground motion-reduce:animate-none" />
                            <p className="text-sm font-medium text-muted-foreground">Carregando PDF...</p>
                        </div>
                    </div>
                ) : blobUrl ? (
                    <embed
                        src={blobUrl}
                        type="application/pdf"
                        className="w-full min-h-[600px]"
                        style={{
                            height: isExpanded ? 'calc(100vh - 120px)' : '600px',
                            border: 'none'
                        }}
                    />
                ) : (
                    <div className="flex items-center justify-center h-96">
                        <div className="flex flex-col items-center gap-3">
                            <FileText className="h-12 w-12 text-muted-foreground/45" />
                            <p className="text-sm font-medium text-muted-foreground">PDF não disponível</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-foreground/[0.07] px-5 py-3 dark:border-white/[0.055] sm:px-6">
                <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500/50 motion-safe:animate-pulse" />
                    <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
                        Preview Ativo
                    </span>
                </div>
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={isExpanded ? "Minimizar preview" : "Expandir preview"}
                >
                    {isExpanded ? "Minimizar" : "Expandir"}
                </button>
            </div>

            {/* Backdrop for expanded mode */}
            {isExpanded && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm -z-10"
                    onClick={() => setIsExpanded(false)}
                />
            )}
        </motion.div>
    );
};
