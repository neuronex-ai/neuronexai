import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, X, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getR2DocumentDownloadUrl } from "@/lib/r2-documents-client";

interface DocumentPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    file: {
        path: string;
        name: string;
        mimetype?: string;
        documentId?: string;
        signedUrl?: string | null;
    } | null;
}

export const DocumentPreviewModal = ({ isOpen, onClose, file }: DocumentPreviewModalProps) => {
    const [signedUrl, setSignedUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && file?.path) {
            const fetchSignedUrl = async () => {
                setIsLoading(true);
                try {
                    const documentId = file.documentId || (file.path.startsWith("r2:") ? file.path.slice(3) : "");
                    if (file.signedUrl) {
                        setSignedUrl(file.signedUrl);
                    } else if (documentId) {
                        setSignedUrl(await getR2DocumentDownloadUrl({ documentId, disposition: "inline" }));
                    } else {
                        throw new Error("Documento sem referencia R2.");
                    }
                } catch (error) {
                    console.error("Error signing R2 URL:", error);
                    setSignedUrl(null);
                }
                setIsLoading(false);
            };
            fetchSignedUrl();
        } else {
            setSignedUrl(null);
        }
    }, [isOpen, file]);

    if (!file) return null;

    const isPdf = file.mimetype === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.mimetype?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);

    const handleDownload = () => {
        if (signedUrl) {
            const link = document.createElement('a');
            link.href = signedUrl;
            link.download = file.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handlePrint = () => {
        if (signedUrl && isPdf) {
            const printWindow = window.open(signedUrl, '_blank');
            if (printWindow) {
                printWindow.print();
            }
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl h-[85vh] p-0 gap-0 bg-background border-border overflow-hidden flex flex-col z-[150]">
                {/* Header */}
                <div className="h-16 flex items-center justify-between px-6 border-b bg-card">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            {isPdf ? <FileText className="h-5 w-5" /> : isImage ? <ImageIcon className="h-5 w-5" /> : <Loader2 className="h-5 w-5" />}
                        </div>
                        <div>
                            <h3 className="font-bold text-foreground truncate max-w-[200px] sm:max-w-[400px]">{file.name}</h3>
                            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider">Visualização de Documento</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {signedUrl && (
                            <>
                                <Button variant="ghost" size="sm" onClick={handleDownload} className="gap-2 hidden sm:flex h-9 rounded-lg text-muted-foreground hover:text-foreground">
                                    <Download className="h-4 w-4" /> Baixar
                                </Button>
                                {isPdf && (
                                    <Button variant="ghost" size="sm" onClick={handlePrint} className="gap-2 hidden sm:flex h-9 rounded-lg text-muted-foreground hover:text-foreground">
                                        <Printer className="h-4 w-4" /> Imprimir
                                    </Button>
                                )}
                            </>
                        )}
                        <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg">
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 bg-secondary/30 relative overflow-hidden flex items-center justify-center p-4 md:p-8">
                    {!signedUrl || isLoading ? (
                        <div className="animate-pulse flex flex-col items-center gap-4">
                            <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Carregando...</p>
                        </div>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center relative z-10 transition-all duration-500 animate-in fade-in zoom-in-95">
                            {isPdf ? (
                                <iframe src={`${signedUrl}#view=FitH`} className="w-full h-full rounded-2xl shadow-2xl bg-white border border-border/10" title={file.name} />
                            ) : isImage ? (
                                <img src={signedUrl} alt={file.name} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-border/10" />
                            ) : (
                                <div className="text-center space-y-6 max-w-md p-8 rounded-3xl bg-card border border-border/50 shadow-2xl">
                                    <div className="h-24 w-24 bg-secondary rounded-full flex items-center justify-center mx-auto shadow-inner">
                                        <FileText className="h-10 w-10 text-muted-foreground/50" />
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="text-lg font-bold text-foreground">Visualização não disponível</h4>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            Este tipo de arquivo não pode ser visualizado diretamente. Por favor, faça o download para acessar o conteúdo.
                                        </p>
                                    </div>
                                    <Button onClick={() => window.open(signedUrl, '_blank')} className="w-full gap-2 rounded-xl py-6 font-bold shadow-lg shadow-primary/20">
                                        <Download className="h-4 w-4" /> Download Arquivo
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
