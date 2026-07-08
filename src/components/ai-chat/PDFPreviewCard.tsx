import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Download, FileText, Loader2, Mail, X, ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    isLoading: externalLoading = false,
}: PDFPreviewCardProps) => {
    const shouldReduceMotion = useReducedMotion();
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [internalLoading, setInternalLoading] = useState(true);
    const [zoom, setZoom] = useState(100);
    const [isExpanded, setIsExpanded] = useState(false);
    const isLoading = externalLoading || internalLoading;

    useEffect(() => {
        let createdUrl: string | null = null;

        if (pdfBlob) {
            createdUrl = URL.createObjectURL(pdfBlob);
            setBlobUrl(createdUrl);
            setInternalLoading(false);
        } else if (pdfUrl) {
            setBlobUrl(pdfUrl);
            setInternalLoading(false);
        } else {
            setBlobUrl(null);
            setInternalLoading(false);
        }

        return () => {
            if (createdUrl) URL.revokeObjectURL(createdUrl);
        };
    }, [pdfBlob, pdfUrl]);

    const handleDownload = () => {
        if (!blobUrl) return;
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 200));
    const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));

    return (
        <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
                "notes-liquid-surface group relative my-6 overflow-hidden rounded-[24px] border shadow-[0_24px_72px_-48px_hsl(var(--foreground)/0.8)]",
                isExpanded && "fixed inset-4 z-50 my-0 flex flex-col",
            )}
        >
            <div className="relative z-10 flex flex-col gap-4 border-b border-border/35 px-5 py-4 dark:border-white/[0.055] md:flex-row md:items-center md:justify-between md:px-6">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-500">
                        <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <h4 className="truncate text-sm font-black tracking-tight text-foreground">{title || "Documento PDF"}</h4>
                        <p className="mt-0.5 truncate text-[10px] font-mono text-muted-foreground">{filename}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <div className="flex min-h-9 items-center gap-1 rounded-xl border border-border/35 bg-muted/35 px-1.5 py-1 dark:border-white/[0.055] dark:bg-white/[0.035]">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={handleZoomOut}
                            disabled={zoom <= 50}
                            className="h-7 w-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-35"
                            aria-label="Diminuir zoom do PDF"
                        >
                            <ZoomOut className="h-3.5 w-3.5" />
                        </Button>
                        <span className="min-w-10 text-center text-[10px] font-mono text-muted-foreground">{zoom}%</span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={handleZoomIn}
                            disabled={zoom >= 200}
                            className="h-7 w-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-35"
                            aria-label="Aumentar zoom do PDF"
                        >
                            <ZoomIn className="h-3.5 w-3.5" />
                        </Button>
                    </div>

                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleDownload}
                        disabled={!blobUrl}
                        className="h-9 w-9 rounded-xl border border-border/35 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-35 dark:border-white/[0.055]"
                        aria-label="Baixar PDF"
                    >
                        <Download className="h-4 w-4" />
                    </Button>

                    {onSendEmail ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={onSendEmail}
                            disabled={isLoadingEmail || !blobUrl}
                            className="h-9 w-9 rounded-xl border border-border/35 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-35 dark:border-white/[0.055]"
                            aria-label="Enviar PDF por e-mail"
                        >
                            {isLoadingEmail ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Mail className="h-4 w-4" />}
                        </Button>
                    ) : null}

                    {isExpanded ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsExpanded(false)}
                            className="h-9 w-9 rounded-xl border border-border/35 text-muted-foreground hover:bg-muted hover:text-foreground dark:border-white/[0.055]"
                            aria-label="Fechar visualizacao expandida"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    ) : null}
                </div>
            </div>

            <div
                className={cn(
                    "relative min-h-[22rem] overflow-auto bg-muted/25 custom-scrollbar dark:bg-white/[0.025]",
                    isExpanded ? "flex-1" : "max-h-[600px]",
                )}
            >
                {isLoading ? (
                    <div className="flex h-96 items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground motion-reduce:animate-none" />
                            <p className="text-sm font-medium text-muted-foreground">Carregando PDF...</p>
                        </div>
                    </div>
                ) : blobUrl ? (
                    <div className="flex min-h-[600px] justify-center p-3">
                        <embed
                            src={blobUrl}
                            type="application/pdf"
                            className="rounded-lg bg-background shadow-sm"
                            style={{
                                width: `${zoom}%`,
                                minWidth: zoom <= 100 ? `${zoom}%` : "100%",
                                height: isExpanded ? "calc(100vh - 160px)" : "600px",
                                border: "none",
                            }}
                        />
                    </div>
                ) : (
                    <div className="flex h-96 items-center justify-center">
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                            <FileText className="h-12 w-12 opacity-60" />
                            <p className="text-sm font-medium">PDF nao disponivel</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between border-t border-border/30 bg-muted/25 px-5 py-3 dark:border-white/[0.045] dark:bg-white/[0.025] md:px-6">
                <div className="flex min-w-0 items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/70" aria-hidden="true" />
                    <span className="truncate text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Preview ativo</span>
                </div>
                <button
                    type="button"
                    onClick={() => setIsExpanded((current) => !current)}
                    className="rounded-lg px-2 py-1 text-[9px] font-mono uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {isExpanded ? "Minimizar" : "Expandir"}
                </button>
            </div>

            {isExpanded ? (
                <motion.div
                    initial={shouldReduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18 }}
                    className="fixed inset-0 -z-10 bg-background/80 backdrop-blur-xl"
                    onClick={() => setIsExpanded(false)}
                />
            ) : null}
        </motion.div>
    );
};
