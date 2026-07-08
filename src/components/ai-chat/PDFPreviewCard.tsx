import { useState, useEffect } from "react";
import { motion } from "framer-motion";
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
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
                type: "spring",
                stiffness: 300,
                damping: 30,
                delay: 0.1
            }}
            className={cn(
                "my-6 rounded-[24px] border border-white/[0.06] bg-[#080808] overflow-hidden shadow-2xl",
                "backdrop-blur-xl relative group",
                isExpanded && "fixed inset-4 z-50 my-0"
            )}
        >
            {/* Premium gradient border effect */}
            <div className="absolute inset-0 rounded-[24px] bg-gradient-to-br from-white/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/[0.04] bg-white/[0.01]">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                        <FileText className="h-5 w-5 text-red-400" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-white tracking-tight">
                            {title || "Documento PDF"}
                        </h4>
                        <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                            {filename}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Zoom controls */}
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleZoomOut}
                            disabled={zoom <= 50}
                            className="h-7 w-7 rounded-md hover:bg-white/[0.08] text-zinc-400 hover:text-white disabled:opacity-30"
                        >
                            <ZoomOut className="h-3.5 w-3.5" />
                        </Button>
                        <span className="text-[10px] text-zinc-500 font-mono min-w-[40px] text-center">
                            {zoom}%
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleZoomIn}
                            disabled={zoom >= 200}
                            className="h-7 w-7 rounded-md hover:bg-white/[0.08] text-zinc-400 hover:text-white disabled:opacity-30"
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
                        className="h-8 w-8 rounded-lg hover:bg-white/[0.08] text-zinc-400 hover:text-white border border-white/[0.05]"
                        title="Baixar PDF"
                    >
                        <Download className="h-4 w-4" />
                    </Button>

                    {onSendEmail && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onSendEmail}
                            disabled={isLoadingEmail || !blobUrl}
                            className="h-8 w-8 rounded-lg hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 hover:border-indigo-500/30 transition-all"
                            title="Enviar por Email"
                        >
                            {isLoadingEmail ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
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
                            className="h-8 w-8 rounded-lg hover:bg-white/[0.08] text-zinc-400 hover:text-white border border-white/[0.05]"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* PDF Preview */}
            <div
                className={cn(
                    "relative bg-zinc-950 overflow-auto custom-scrollbar",
                    isExpanded ? "h-[calc(100vh-120px)]" : "max-h-[600px]"
                )}
                style={{
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: 'top center',
                    transition: 'transform 0.2s ease-out'
                }}
            >
                {isLoading ? (
                    <div className="flex items-center justify-center h-96">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
                            <p className="text-sm text-zinc-600 font-medium">Carregando PDF...</p>
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
                            <FileText className="h-12 w-12 text-zinc-700" />
                            <p className="text-sm text-zinc-600 font-medium">PDF não disponível</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-[#0A0A0B] border-t border-white/[0.04] flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500/50 animate-pulse" />
                    <span className="text-[9px] text-zinc-600 font-mono uppercase tracking-wider">
                        Preview Ativo
                    </span>
                </div>
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-[9px] text-zinc-500 hover:text-zinc-300 font-mono uppercase tracking-wider transition-colors"
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
