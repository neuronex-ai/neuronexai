"use client";

import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { NotionIcon } from "@/components/icons/NotionIcon";
import { GoogleIcon } from "@/components/icons/GoogleIcon";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import {
    Upload,
    FolderOpen,
    Users,
    ChevronDown,
    LayoutGrid,
    LayoutList,
    Pencil,
    Check,
    X,
    Loader2,
    ExternalLink,
    Link2,
    RefreshCw,
    Eye,
    User,
    Cloud,
    HardDrive,
    Trash2,
    Download,
    MoreVertical,
    Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MagneticSegmentedControl } from "@/components/ui/magnetic-segmented-control";
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
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/SessionContextProvider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePatientsList } from "@/hooks/use-patients-list";
import { useGoogleAuth } from "@/hooks/use-google-auth";
import {
    deleteR2Document,
    getR2DocumentDownloadUrl,
    uploadDocumentToR2,
} from "@/lib/r2-documents-client";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DocumentPreviewModal } from "@/components/patients/DocumentPreviewModal";
import { PremiumFileIcon } from "@/components/ui/PremiumFileIcons";
import { edgeFunctionUrl } from "@/lib/supabase-config";

interface FileItem {
    name: string;
    id: string;
    documentId: string;
    created_at: string;
    size: number;
    path: string;
    mimetype?: string;
    patientId?: string | null;
    storageProvider: "r2";
    metadata?: Record<string, unknown>;
}

interface GoogleDriveFile {
    id: string;
    name: string;
    mimeType: string;
    size?: string;
    modifiedTime?: string;
    iconLink?: string;
    webViewLink?: string;
}

const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const getFileIcon = (name: string, className?: string) => {
    return <PremiumFileIcon filename={name} className={cn("w-6 h-8 drop-shadow-md", className)} />;
};

const getDocumentIdFromPath = (path: string) => path.replace(/^r2:/, "");

export const FilesManager = ({ initialTab = "personal" }: { initialTab?: "personal" | "patients" }) => {
    const shouldReduceMotion = useReducedMotion();
    const { user, session } = useAuth();
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const patientFileInputRef = useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = useState<"personal" | "patients">(initialTab);
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedPatient, setExpandedPatient] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [viewLayout, setViewLayout] = useState<"list" | "grid">("list");

    // Preview
    const [previewFile, setPreviewFile] = useState<{ path: string; name: string; mimetype?: string } | null>(null);

    // Rename
    const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState("");
    const [pendingDeletePath, setPendingDeletePath] = useState<string | null>(null);

    // Patient linking dialog (after upload on patient tab)
    const [showPatientLinkDialog, setShowPatientLinkDialog] = useState(false);
    const [pendingUploadFiles, setPendingUploadFiles] = useState<File[]>([]);
    const [selectedPatientForUpload, setSelectedPatientForUpload] = useState<string>("");

    // Google Drive
    const { isConnected: isGoogleConnected, connectGoogle } = useGoogleAuth();
    const [showDriveModal, setShowDriveModal] = useState(false);
    const [driveFiles, setDriveFiles] = useState<GoogleDriveFile[]>([]);
    const [isDriveLoading, setIsDriveLoading] = useState(false);
    const [importingDriveFileId, setImportingDriveFileId] = useState<string | null>(null);

    const userId = user?.id;

    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);

    // Fetch personal files
    const { data: personalFiles, isLoading: isLoadingPersonal } = useQuery<FileItem[]>({
        queryKey: ["personalFiles", userId],
        queryFn: async () => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from("document_files")
                .select("id,patient_id,category,original_name,mime_type,size_bytes,created_at,metadata")
                .is("patient_id", null)
                .eq("status", "ready")
                .is("deleted_at", null)
                .order("created_at", { ascending: false })
                .limit(200);

            if (error) throw error;
            return (data || [])
                .filter((item) => {
                    const metadata = (item.metadata || {}) as Record<string, unknown>;
                    const source = String(metadata.source || "");
                    return source !== "ai_chat" && source !== "external_invoice";
                })
                .map((item) => ({
                    name: item.original_name,
                    id: item.id,
                    documentId: item.id,
                    created_at: item.created_at,
                    size: item.size_bytes || 0,
                    path: `r2:${item.id}`,
                    mimetype: item.mime_type,
                    patientId: item.patient_id,
                    storageProvider: "r2" as const,
                    metadata: (item.metadata || {}) as Record<string, unknown>,
                }));
        },
        enabled: !!userId,
    });

    // Fetch patient list
    const { data: patients } = usePatientsList();

    // Fetch patient files (grouped)
    const { data: patientFilesMap, isLoading: isLoadingPatients } = useQuery<
        Record<string, FileItem[]>
    >({
        queryKey: ["allPatientFiles", userId],
        queryFn: async () => {
            if (!userId || !patients) return {};
            const result: Record<string, FileItem[]> = {};
            const patientIds = patients.map((patient) => patient.id);
            if (!patientIds.length) return result;

            const { data, error } = await supabase
                .from("document_files")
                .select("id,patient_id,category,original_name,mime_type,size_bytes,created_at,metadata")
                .in("patient_id", patientIds)
                .eq("status", "ready")
                .is("deleted_at", null)
                .order("created_at", { ascending: false })
                .limit(500);
            if (error) throw error;

            (data || []).forEach((item) => {
                if (!item.patient_id) return;
                const file = {
                    name: item.original_name,
                    id: item.id,
                    documentId: item.id,
                    created_at: item.created_at,
                    size: item.size_bytes || 0,
                    path: `r2:${item.id}`,
                    mimetype: item.mime_type,
                    patientId: item.patient_id,
                    storageProvider: "r2" as const,
                    metadata: (item.metadata || {}) as Record<string, unknown>,
                };
                result[item.patient_id] = [...(result[item.patient_id] || []), file];
            });
            return result;
        },
        enabled: !!userId && !!patients && patients.length > 0,
    });

    // ─── UPLOAD HANDLERS ─────────────────────────────────────────
    const handlePersonalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !userId) return;

        setIsUploading(true);
        try {
            for (const file of Array.from(files)) {
                await uploadDocumentToR2({
                    file,
                    category: "general",
                    metadata: { source: "notes_files_manager", area: "personal" },
                });
            }
            toast.success(`${files.length} arquivo(s) enviado(s) com sucesso.`);
            queryClient.invalidateQueries({ queryKey: ["personalFiles"] });
        } catch (err: any) {
            toast.error(`Erro ao enviar: ${err.message}`);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handlePatientUploadTrigger = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setPendingUploadFiles(Array.from(files));
        setSelectedPatientForUpload("");
        setShowPatientLinkDialog(true);
        if (patientFileInputRef.current) patientFileInputRef.current.value = "";
    };

    const confirmPatientUpload = async () => {
        if (!selectedPatientForUpload || !userId || pendingUploadFiles.length === 0) {
            toast.error("Selecione um paciente para vincular o arquivo.");
            return;
        }

        setIsUploading(true);
        setShowPatientLinkDialog(false);
        try {
            for (const file of pendingUploadFiles) {
                await uploadDocumentToR2({
                    file,
                    patientId: selectedPatientForUpload,
                    category: "patient_attachment",
                    metadata: { source: "notes_files_manager", area: "patient" },
                });
            }
            const patientName = patients?.find(p => p.id === selectedPatientForUpload)?.name || "paciente";
            toast.success(`${pendingUploadFiles.length} arquivo(s) vinculado(s) a ${patientName}.`);
            queryClient.invalidateQueries({ queryKey: ["allPatientFiles"] });
        } catch (err: any) {
            toast.error(`Erro ao enviar: ${err.message}`);
        } finally {
            setIsUploading(false);
            setPendingUploadFiles([]);
        }
    };

    // ─── DELETE ─────────────────────────────────────────────────
    const handleDelete = (path: string) => {
        setPendingDeletePath(path);
    };

    const confirmDelete = async () => {
        if (!pendingDeletePath) return;
        const path = pendingDeletePath;
        setPendingDeletePath(null);
        const error = await deleteR2Document(getDocumentIdFromPath(path)).then(() => null).catch((value) => value);
        if (error) {
            toast.error("Erro ao excluir arquivo.");
        } else {
            toast.success("Arquivo excluído.");
            queryClient.invalidateQueries({ queryKey: ["personalFiles"] });
            queryClient.invalidateQueries({ queryKey: ["allPatientFiles"] });
        }
    };

    // ─── DOWNLOAD ──────────────────────────────────────────────
    const handleDownload = async (path: string, name: string) => {
        const url = await getR2DocumentDownloadUrl({ documentId: getDocumentIdFromPath(path), disposition: "attachment" }).catch(() => "");
        const data = url ? new Blob() : null;
        const error = url ? null : new Error("download_failed");
        if (error || !data) {
            toast.error("Erro ao baixar arquivo.");
            return;
        }
        const a = document.createElement("a");
        a.href = url;
        a.download = name.replace(/^\d+_/, "");
        a.click();
        URL.revokeObjectURL(url);
    };

    // ─── RENAME ────────────────────────────────────────────────
    const handleRenameStart = (file: FileItem) => {
        setRenamingFileId(file.id);
        setRenameValue(file.name.replace(/^\d+_/, ""));
    };

    const handleRenameConfirm = async (_file: FileItem) => {
        if (!renameValue.trim() || !userId) return;
        toast.info("Renomear arquivos R2 exige uma acao server-side. Mantive o arquivo original por seguranca.");
        setRenamingFileId(null);
    };

    // ─── GOOGLE DRIVE ──────────────────────────────────────────
    const handleOpenDrive = async () => {
        if (!isGoogleConnected) {
            toast.info("Conecte sua conta Google nas configurações primeiro.", {
                action: { label: "Conectar", onClick: () => void connectGoogle() },
            });
            return;
        }
        setShowDriveModal(true);
        fetchDriveFiles();
    };

    const fetchDriveFiles = async () => {
        if (!session) return;
        setIsDriveLoading(true);
        try {
            const response = await fetch(edgeFunctionUrl("google-drive-files"), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ action: "list" }),
            });
            if (!response.ok) throw new Error("Falha ao listar arquivos do Drive.");
            const data = await response.json();
            setDriveFiles(data.files || []);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setIsDriveLoading(false);
        }
    };

    const handleImportFromDrive = async (driveFile: GoogleDriveFile) => {
        if (!session || !userId) return;
        setImportingDriveFileId(driveFile.id);
        try {
            const response = await fetch(edgeFunctionUrl("google-drive-files"), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ action: "download", fileId: driveFile.id, fileName: driveFile.name }),
            });
            if (!response.ok) throw new Error("Falha ao importar arquivo do Drive.");

            const blob = await response.blob();
            // Sanitize filename: remove diacritics, replace spaces with underscores, strip unsafe chars
            const sanitizedName = driveFile.name
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // remove accents
                .replace(/\s+/g, "_")                                // spaces → underscores
                .replace(/[^a-zA-Z0-9_.-]/g, "");                   // keep only safe chars
            const importedFile = new File([blob], sanitizedName || driveFile.name, {
                type: blob.type || driveFile.mimeType || "application/octet-stream",
            });
            await uploadDocumentToR2({
                file: importedFile,
                category: "general",
                metadata: {
                    source: "google_drive_import",
                    googleDriveFileId: driveFile.id,
                    googleDriveMimeType: driveFile.mimeType,
                },
            });
            toast.success(`"${driveFile.name}" importado do Google Drive.`);
            queryClient.invalidateQueries({ queryKey: ["personalFiles"] });
        } catch (err: any) {
            toast.error(`Erro ao importar: ${err.message}`);
        } finally {
            setImportingDriveFileId(null);
        }
    };

    // ─── FILTERS ───────────────────────────────────────────────
    const filteredPersonalFiles = (personalFiles || []).filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const patientsWithFiles = patients?.filter((p) => patientFilesMap?.[p.id]) || [];
    const filteredPatients = patientsWithFiles.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const tabs = [
        { id: "personal" as const, label: "Meus Arquivos", icon: User },
        { id: "patients" as const, label: "Arquivos de Pacientes", icon: Users },
    ];

    return (
        <div className="flex flex-col h-full w-full font-sans relative bg-transparent">
            {/* Header */}
            <div className="relative z-10 shrink-0 space-y-5 px-7 pb-4 pt-7 lg:px-8 lg:pt-8">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <h2 className="text-3xl font-black leading-none tracking-tight text-zinc-50 [.light_&]:text-zinc-900">Arquivos</h2>
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 dark:text-zinc-500 mt-2">Sinfonia Documental</p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* View Toggle */}
                        <MagneticSegmentedControl
                            id="notes-files-layout"
                            indicatorId="notes-files-layout-indicator"
                            value={viewLayout}
                            onValueChange={setViewLayout}
                            ariaLabel="Formato de exibição dos arquivos"
                            behavior="single-select"
                            options={[
                                {
                                    value: "list",
                                    ariaLabel: "Exibir arquivos em lista",
                                    label: <LayoutList aria-hidden="true" className="h-4 w-4" />,
                                },
                                {
                                    value: "grid",
                                    ariaLabel: "Exibir arquivos em grade",
                                    label: <LayoutGrid aria-hidden="true" className="h-4 w-4" />,
                                },
                            ]}
                            className="h-12 min-h-12 rounded-2xl border-white/[0.05] bg-black/40 [.light_&]:border-zinc-200/50 [.light_&]:bg-zinc-100/50"
                            triggerClassName="h-11 min-h-11 w-11 rounded-xl px-0"
                        />

                        {/* Cloud Integrations */}
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 gap-2 rounded-lg border-white/10 bg-white/5 text-[11px] font-semibold hover:bg-white/10 [.light_&]:border-black/5 [.light_&]:bg-white [.light_&]:hover:bg-black/5"
                                >
                                    <Cloud className="h-3.5 w-3.5" />
                                    Integrações
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="desktop-retina-modal overflow-hidden rounded-[32px] border border-border/70 bg-background/96 p-0 shadow-2xl backdrop-blur-2xl sm:max-w-lg">
                                <div className="relative z-10 p-6 sm:p-8">
                                    <DialogHeader className="mb-7">
                                        <div className="mb-2 flex items-center gap-4">
                                            <div className="desktop-retina-inset flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-muted/40 text-foreground">
                                                <Link2 className="h-5 w-5" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-semibold uppercase leading-none tracking-[0.24em] text-muted-foreground">Conectividade</span>
                                                <DialogTitle className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">Integrações</DialogTitle>
                                            </div>
                                        </div>
                                    </DialogHeader>

                                    <div className="space-y-7">
                                        <p className="text-sm font-normal leading-relaxed text-muted-foreground">
                                            Conecte serviços externos para organizar documentos no mesmo fluxo de trabalho. O acesso ao Google está temporariamente indisponível enquanto aprimoramos a integração.
                                        </p>

                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            {/* Google Drive */}
                                            <button
                                                type="button"
                                                disabled
                                                onClick={handleOpenDrive}
                                                className="flex min-h-40 cursor-not-allowed flex-col items-center justify-center gap-4 rounded-[24px] border border-border/70 bg-muted/30 p-5 text-center opacity-75"
                                                aria-label="Google Drive indisponível no momento"
                                            >
                                                <div className="desktop-retina-inset flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-background p-3.5">
                                                    <GoogleIcon className="h-full w-full" />
                                                </div>
                                                <span className="text-sm font-semibold text-foreground">Google Drive</span>
                                                <span className="rounded-full border border-border/70 bg-background px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Em breve</span>
                                            </button>

                                            {/* Notion */}
                                            <Link
                                                to="/ajustes?tab=integrations"
                                                className="group flex min-h-40 flex-col items-center justify-center gap-4 rounded-[24px] border border-border/70 bg-muted/30 p-5 text-center transition-colors hover:bg-muted/55"
                                            >
                                                <div className="desktop-retina-inset flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-background">
                                                    <NotionIcon className="h-8 w-8 text-foreground opacity-80 transition-opacity group-hover:opacity-100" />
                                                </div>
                                                <span className="text-sm font-semibold text-foreground">Notion</span>
                                                <span className="text-xs text-muted-foreground">Ver configurações</span>
                                            </Link>
                                        </div>

                                        <div>
                                            <Button
                                                asChild
                                                className="group h-12 w-full rounded-xl bg-foreground text-sm font-medium text-background shadow-none hover:bg-foreground/90 active:scale-[0.99]"
                                            >
                                                <Link to="/ajustes?tab=integrations">
                                                    Abrir configurações
                                                    <ExternalLink className="ml-2.5 h-4 w-4 opacity-60 transition-opacity group-hover:opacity-100" />
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>

                        <Button
                            size="sm"
                            className="h-12 gap-3 rounded-2xl bg-zinc-100 px-6 text-[11px] font-black uppercase tracking-[0.2em] text-black shadow-[0_20px_40px_-12px_rgba(0,0,0,0.5)] transition-all hover:scale-[1.02] [.light_&]:bg-zinc-900 [.light_&]:text-white [.light_&]:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)]"
                            onClick={() => {
                                if (activeTab === "patients") {
                                    patientFileInputRef.current?.click();
                                } else {
                                    fileInputRef.current?.click();
                                }
                            }}
                            disabled={isUploading}
                        >
                            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" strokeWidth={3} />}
                            {isUploading ? "Enviando..." : "Enviar"}
                        </Button>
                        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handlePersonalUpload} />
                        <input ref={patientFileInputRef} type="file" multiple className="hidden" onChange={handlePatientUploadTrigger} />
                    </div>
                </div>

                {/* Tabs & Search Row */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-6">
                    <MagneticSegmentedControl
                        id="notes-files-scope"
                        indicatorId="notes-files-scope-indicator"
                        value={activeTab}
                        onValueChange={setActiveTab}
                        ariaLabel="Origem dos arquivos"
                        behavior="single-select"
                        options={tabs.map((tab) => ({
                            value: tab.id,
                            label: (
                                <>
                                    <tab.icon aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />
                                    {tab.label}
                                </>
                            ),
                        }))}
                        className="h-12 min-h-12 w-full max-w-md rounded-2xl border-white/[0.05] bg-black/40 [.light_&]:border-zinc-200/50 [.light_&]:bg-zinc-100/50"
                        triggerClassName="h-11 min-h-11 flex-1 rounded-xl px-4 text-[11px] font-black uppercase tracking-[0.1em]"
                    />

                    <div className="flex-1 relative group">
                        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-zinc-100 [.light_&]:group-focus-within:text-zinc-900" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={activeTab === "personal" ? "Buscar nos seus arquivos..." : "Buscar por paciente..."}
                            className="h-14 rounded-2xl border-transparent bg-black/20 pl-11 text-[13px] font-medium shadow-inner transition-all placeholder:text-zinc-600 hover:bg-black/30 focus-visible:bg-black/40 focus-visible:ring-0 [.light_&]:bg-zinc-100/30 [.light_&]:placeholder:text-zinc-400 [.light_&]:hover:bg-zinc-100/50 [.light_&]:focus-visible:bg-white"
                        />
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="custom-scrollbar relative z-10 flex-1 overflow-y-auto px-7 pb-10 lg:px-8">
                <div className="absolute inset-0 notes-retina-texture opacity-[0.1] pointer-events-none" />
                <AnimatePresence initial={!shouldReduceMotion} mode="wait">
                    {activeTab === "personal" ? (
                        <motion.div
                            key="personal"
                            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        >
                            {isLoadingPersonal ? (
                                <div className="space-y-3 pt-4">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="h-16 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
                                    ))}
                                </div>
                            ) : filteredPersonalFiles.length === 0 ? (
                                <EmptyState
                                    icon={<FolderOpen className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />}
                                    title="Nenhum arquivo pessoal"
                                    description="Envie arquivos do seu dispositivo. A importação pelo Google Drive estará disponível em breve."
                                    action={
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" className="h-9 rounded-xl gap-2 text-xs" onClick={() => fileInputRef.current?.click()}>
                                                <Upload className="h-3.5 w-3.5" /> Enviar Arquivo
                                            </Button>
                                            <Button size="sm" variant="outline" className="h-9 rounded-xl gap-2 text-xs" onClick={handleOpenDrive} disabled title="Integração em revisão">
                                                <HardDrive className="h-3.5 w-3.5" /> Drive em breve
                                            </Button>
                                        </div>
                                    }
                                />
                            ) : viewLayout === "grid" ? (
                                <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 pt-2">
                                    {filteredPersonalFiles.map((file) => (
                                        <FileGridCard
                                            key={file.id}
                                            file={file}
                                            onDelete={handleDelete}
                                            onDownload={handleDownload}
                                            onPreview={setPreviewFile}
                                            onRenameStart={handleRenameStart}
                                            renamingFileId={renamingFileId}
                                            renameValue={renameValue}
                                            setRenameValue={setRenameValue}
                                            onRenameConfirm={handleRenameConfirm}
                                            onRenameCancel={() => setRenamingFileId(null)}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {filteredPersonalFiles.map((file) => (
                                        <FileRow
                                            key={file.id}
                                            file={file}
                                            onDelete={handleDelete}
                                            onDownload={handleDownload}
                                            onPreview={setPreviewFile}
                                            onRenameStart={handleRenameStart}
                                            renamingFileId={renamingFileId}
                                            renameValue={renameValue}
                                            setRenameValue={setRenameValue}
                                            onRenameConfirm={handleRenameConfirm}
                                            onRenameCancel={() => setRenamingFileId(null)}
                                        />
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="patients"
                            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                            className="space-y-3"
                        >
                            {isLoadingPatients ? (
                                <div className="space-y-3 pt-4">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="h-16 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
                                    ))}
                                </div>
                            ) : filteredPatients.length === 0 ? (
                                <EmptyState
                                    icon={<Users className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />}
                                    title="Nenhum arquivo de paciente"
                                    description="Envie um arquivo e vincule a um paciente."
                                    action={
                                        <Button size="sm" variant="outline" className="h-9 rounded-xl gap-2 text-xs" onClick={() => patientFileInputRef.current?.click()}>
                                            <Upload className="h-3.5 w-3.5" /> Enviar e Vincular
                                        </Button>
                                    }
                                />
                            ) : (
                                filteredPatients.map((patient) => (
                                    <div key={patient.id} className="space-y-1">
                                        <button
                                            onClick={() => setExpandedPatient(expandedPatient === patient.id ? null : patient.id)}
                                            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                                    <User className="h-4 w-4 text-primary" />
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-sm font-semibold text-foreground">{patient.name}</p>
                                                    <p className="text-[10px] text-muted-foreground">
                                                        {patientFilesMap?.[patient.id]?.length || 0} arquivo(s)
                                                    </p>
                                                </div>
                                            </div>
                                            <ChevronDown
                                                className={cn("h-4 w-4 text-muted-foreground transition-transform", expandedPatient === patient.id && "rotate-180")}
                                            />
                                        </button>
                                        <AnimatePresence initial={!shouldReduceMotion}>
                                            {expandedPatient === patient.id && (
                                                <motion.div
                                                    initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                                    className="overflow-hidden pl-4 space-y-1"
                                                >
                                                    {viewLayout === "grid" ? (
                                                        <div className="grid grid-cols-2 xl:grid-cols-3 gap-2 py-2">
                                                            {patientFilesMap?.[patient.id]?.map((file) => (
                                                                <FileGridCard
                                                                    key={file.id}
                                                                    file={file}
                                                                    onDelete={handleDelete}
                                                                    onDownload={handleDownload}
                                                                    onPreview={setPreviewFile}
                                                                    onRenameStart={handleRenameStart}
                                                                    renamingFileId={renamingFileId}
                                                                    renameValue={renameValue}
                                                                    setRenameValue={setRenameValue}
                                                                    onRenameConfirm={handleRenameConfirm}
                                                                    onRenameCancel={() => setRenamingFileId(null)}
                                                                    compact
                                                                />
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        patientFilesMap?.[patient.id]?.map((file) => (
                                                            <FileRow
                                                                key={file.id}
                                                                file={file}
                                                                onDelete={handleDelete}
                                                                onDownload={handleDownload}
                                                                onPreview={setPreviewFile}
                                                                onRenameStart={handleRenameStart}
                                                                renamingFileId={renamingFileId}
                                                                renameValue={renameValue}
                                                                setRenameValue={setRenameValue}
                                                                onRenameConfirm={handleRenameConfirm}
                                                                onRenameCancel={() => setRenamingFileId(null)}
                                                                compact
                                                            />
                                                        ))
                                                    )}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                ))
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ─── Preview Modal ──────────────────────────────── */}
            <DocumentPreviewModal
                isOpen={!!previewFile}
                onClose={() => setPreviewFile(null)}
                file={previewFile}
            />

            {/* ─── Patient Link Dialog ───────────────────────── */}
            <Dialog open={showPatientLinkDialog} onOpenChange={setShowPatientLinkDialog}>
                <DialogContent className="sm:max-w-md rounded-[32px] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl border-zinc-200/50 dark:border-white/10 p-8 shadow-2xl z-[150]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                            <div className="p-2.5 rounded-2xl bg-zinc-100 dark:bg-white/5 border border-zinc-200/50 dark:border-white/10">
                                <Users className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                            </div>
                            Vincular Paciente
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-6">
                        <p className="text-[13px] text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">
                            Selecione o paciente que será vinculado a{" "}
                            <span className="font-bold text-zinc-900 dark:text-zinc-100 px-1.5 py-0.5 rounded-lg bg-zinc-100 dark:bg-white/5 border border-zinc-200/50 dark:border-white/10">
                                {pendingUploadFiles.length} arquivo(s)
                            </span>.
                        </p>
                        <Select value={selectedPatientForUpload} onValueChange={setSelectedPatientForUpload}>
                            <SelectTrigger className="h-14 rounded-2xl bg-zinc-50/50 dark:bg-black/20 border-zinc-200/50 dark:border-white/10 text-sm font-bold shadow-inner transition-all hover:bg-white dark:hover:bg-black/30">
                                <SelectValue placeholder="Selecionar paciente..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-zinc-200/50 dark:border-white/10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl p-2 z-[160] shadow-2xl">
                                {patients?.map((p) => (
                                    <SelectItem key={p.id} value={p.id} className="rounded-xl py-3 focus:bg-zinc-100 dark:focus:bg-white/5 cursor-pointer">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-white/5 flex items-center justify-center font-black text-[10px] text-zinc-400 uppercase">
                                                {p.name.substring(0, 2)}
                                            </div>
                                            <span className="font-bold text-zinc-700 dark:text-zinc-300">{p.name}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter className="gap-3 sm:gap-0">
                        <Button
                            variant="ghost"
                            className="flex-1 h-12 rounded-2xl text-[11px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/5 transition-all"
                            onClick={() => { setShowPatientLinkDialog(false); setPendingUploadFiles([]); }}
                        >
                            Cancelar
                        </Button>
                        <Button
                            className="flex-[1.5] h-12 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 text-[11px] font-black uppercase tracking-widest hover:opacity-90 shadow-xl shadow-zinc-900/10 dark:shadow-none transition-all gap-2"
                            onClick={confirmPatientUpload}
                            disabled={!selectedPatientForUpload || isUploading}
                        >
                            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                            Vincular e Enviar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Google Drive Modal ────────────────────────── */}
            <Dialog open={showDriveModal} onOpenChange={setShowDriveModal}>
                <DialogContent className="sm:max-w-2xl max-h-[80vh] rounded-[40px] bg-[#0F0F10]/95 backdrop-blur-2xl border-white/10 p-0 shadow-[0_32px_128px_-16px_rgba(0,0,0,0.7)] ring-1 ring-white/10 overflow-hidden z-[150] flex flex-col">
                    <div className="p-8 relative z-10 flex flex-col h-full">
                        <DialogHeader className="mb-8">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center p-3 shadow-inner">
                                    <GoogleIcon className="h-full w-full" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] leading-none">Armazenamento</span>
                                    <DialogTitle className="text-2xl font-black text-white mt-1.5">Google Drive</DialogTitle>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto min-h-0 space-y-2 py-2 custom-scrollbar">
                            {isDriveLoading ? (
                                <div className="flex flex-col items-center justify-center h-48 gap-4">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <p className="text-sm text-muted-foreground font-medium">Sincronizando com o Drive...</p>
                                </div>
                            ) : driveFiles.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-48 gap-4 text-center">
                                    <Cloud className="h-10 w-10 text-muted-foreground opacity-40" />
                                    <div>
                                        <p className="text-sm font-bold text-foreground">Nenhum arquivo encontrado</p>
                                        <p className="text-xs text-muted-foreground font-medium max-w-xs">Seu Google Drive parece estar vazio ou a permissão não foi concedida.</p>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={fetchDriveFiles} className="gap-2 rounded-xl bg-white/5 border-white/10 hover:bg-white/10 font-bold">
                                        <RefreshCw className="h-3.5 w-3.5" /> Recarregar
                                    </Button>
                                </div>
                            ) : (
                                driveFiles.map((df) => (
                                    <div
                                        key={df.id}
                                        className="flex items-center justify-between gap-5 px-6 py-6 rounded-[32px] bg-white/[0.015] dark:bg-black/20 border border-white/[0.03] hover:border-white/10 hover:bg-white/[0.04] transition-all duration-500 group shadow-sm overflow-hidden relative"
                                    >
                                        <div className="absolute inset-0 notes-retina-texture opacity-[0.1] pointer-events-none" />

                                        <div className="flex items-center gap-6 min-w-0 flex-1 relative z-10 transition-transform group-hover:translate-x-1 duration-700">
                                            <div className="w-14 h-14 rounded-2xl bg-white/[0.02] flex items-center justify-center shrink-0 border border-white/[0.05] group-hover:scale-105 transition-all duration-700 overflow-visible">
                                                {getFileIcon(df.name, "h-8 w-8")}
                                            </div>
                                            <div className="min-w-0 flex-1 space-y-1.5">
                                                <p className="text-[15px] font-bold text-white truncate tracking-tight transition-colors">{df.name}</p>
                                                <div className="flex items-center gap-3">
                                                    <div className="px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.05]">
                                                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">
                                                            {df.size ? formatFileSize(parseInt(df.size)) : "—"}
                                                        </p>
                                                    </div>
                                                    <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">
                                                        {df.modifiedTime ? format(new Date(df.modifiedTime), "dd MMM yyyy", { locale: ptBR }) : "Desconhecido"}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 relative z-10">
                                            {df.webViewLink && (
                                                <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl text-zinc-500 hover:text-white hover:bg-white/10 transition-all border border-transparent hover:border-white/10" asChild>
                                                    <a href={df.webViewLink} target="_blank" rel="noopener noreferrer">
                                                        <ExternalLink className="h-4.5 w-4.5" />
                                                    </a>
                                                </Button>
                                            )}
                                            <Button
                                                size="sm"
                                                className="h-12 px-7 rounded-2xl text-[11px] gap-2.5 font-black uppercase tracking-[0.2em] bg-white text-black hover:bg-zinc-200 transition-all shadow-xl shadow-white/5 disabled:opacity-30"
                                                onClick={() => handleImportFromDrive(df)}
                                                disabled={importingDriveFileId === df.id}
                                            >
                                                {importingDriveFileId === df.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Download className="h-4 w-4" />
                                                )}
                                                Importar
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!pendingDeletePath} onOpenChange={(open) => !open && setPendingDeletePath(null)}>
                <AlertDialogContent className="max-w-md rounded-[26px] border-white/[0.08] bg-zinc-950/95 p-0 text-white shadow-[0_36px_100px_-32px_rgba(0,0,0,0.9)] backdrop-blur-3xl [.light_&]:border-zinc-200/80 [.light_&]:bg-white/95 [.light_&]:text-zinc-950">
                    <div className="p-6">
                        <AlertDialogHeader className="space-y-3">
                            <AlertDialogTitle className="text-xl font-black tracking-tight">Excluir este arquivo?</AlertDialogTitle>
                            <AlertDialogDescription className="text-sm leading-relaxed text-zinc-400 [.light_&]:text-zinc-600">
                                O arquivo será removido permanentemente e não poderá ser recuperado.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-7 gap-2">
                            <AlertDialogCancel className="h-11 rounded-xl border-white/[0.08] bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white [.light_&]:border-zinc-200 [.light_&]:bg-white [.light_&]:text-zinc-700 [.light_&]:hover:bg-zinc-100">
                                Cancelar
                            </AlertDialogCancel>
                            <AlertDialogAction onClick={() => void confirmDelete()} className="h-11 rounded-xl bg-red-500 text-white hover:bg-red-600">
                                Excluir
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </div>
                </AlertDialogContent>
            </AlertDialog>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.1); border-radius: 20px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            `}</style>
        </div>
    );
};

// ─── EMPTY STATE ────────────────────────────────────────────────
const EmptyState = ({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) => (
    <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center">{icon}</div>
        <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground max-w-xs">{description}</p>
        </div>
        {action}
    </div>
);

// ─── FILE ROW (LIST VIEW) ──────────────────────────────────────
interface FileRowProps {
    file: FileItem;
    onDelete: (path: string) => void;
    onDownload: (path: string, name: string) => void;
    onPreview: (file: { path: string; name: string; mimetype?: string }) => void;
    onRenameStart: (file: FileItem) => void;
    renamingFileId: string | null;
    renameValue: string;
    setRenameValue: (v: string) => void;
    onRenameConfirm: (file: FileItem) => void;
    onRenameCancel: () => void;
    compact?: boolean;
}

const FileRow = ({
    file, onDelete, onDownload, onPreview, onRenameStart,
    renamingFileId, renameValue, setRenameValue, onRenameConfirm, onRenameCancel, compact,
}: FileRowProps) => {
    const displayName = file.name.replace(/^\d+_/, "");
    const isRenaming = renamingFileId === file.id;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
                "group flex items-center gap-6 p-4 rounded-[24px] bg-white dark:bg-black/[0.2] border border-zinc-200/50 dark:border-white/[0.05] hover:border-zinc-300 dark:hover:border-white/[0.1] hover:bg-zinc-50/50 dark:hover:bg-white/[0.03] transition-all duration-300 cursor-pointer overflow-hidden",
                compact && "p-3 gap-4"
            )}
            onClick={() => !isRenaming && onPreview({ path: file.path, name: displayName, mimetype: file.mimetype })}
        >
            <div className="absolute inset-0 notes-retina-texture opacity-[0.1] pointer-events-none" />

            <div className={cn(
                "p-3 rounded-2xl bg-zinc-100 dark:bg-white/[0.05] group-hover:bg-white dark:group-hover:bg-white/[0.1] transition-all duration-500 group-hover:scale-105",
                compact && "p-2.5 rounded-xl"
            )}>
                {getFileIcon(displayName, compact ? "h-6 w-6" : "h-8 w-8")}
            </div>

            <div className="flex-1 min-w-0">
                {isRenaming ? (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="h-10 text-[13px] bg-zinc-100/50 dark:bg-black/20 border-zinc-200 dark:border-white/10 rounded-xl"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter") onRenameConfirm(file);
                                if (e.key === "Escape") onRenameCancel();
                            }}
                        />
                        <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/20" onClick={() => onRenameConfirm(file)}>
                            <Check className="h-4 w-4 text-emerald-500" strokeWidth={3} />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20" onClick={onRenameCancel}>
                            <X className="h-4 w-4 text-red-500" strokeWidth={3} />
                        </Button>
                    </div>
                ) : (
                    <>
                        <p className={cn("text-[14px] font-bold text-zinc-900 dark:text-zinc-100 truncate tracking-tight transition-colors group-hover:text-black dark:group-hover:text-white", compact && "text-[13px]")}>
                            {displayName}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                            <p className="text-[10px] font-black uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">
                                {formatFileSize(file.size)}
                            </p>
                            <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                            <p className="text-[10px] font-black uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">
                                {format(new Date(file.created_at), "dd MMM yyyy", { locale: ptBR })}
                            </p>
                        </div>
                    </>
                )}
            </div>

            {!isRenaming && (
                <div
                    className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                >
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-xl bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-zinc-100 hover:text-zinc-900 dark:hover:text-black shadow-sm transition-all border border-zinc-200/50 dark:border-white/5"
                        onClick={() => onPreview({ path: file.path, name: displayName, mimetype: file.mimetype })}
                    >
                        <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-xl bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-zinc-100 hover:text-zinc-900 dark:hover:text-black shadow-sm transition-all border border-zinc-200/50 dark:border-white/5"
                        onClick={() => onRenameStart(file)}
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-xl bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-zinc-100 hover:text-zinc-900 dark:hover:text-black shadow-sm transition-all border border-zinc-200/50 dark:border-white/5"
                        onClick={() => onDownload(file.path, displayName)}
                    >
                        <Download className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-xl bg-white/50 dark:bg-black/20 hover:bg-red-500 hover:text-white shadow-sm transition-all border border-transparent"
                        onClick={() => onDelete(file.path)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </motion.div>
    );
};

// ─── FILE GRID CARD (GRID VIEW) ──────────────────────────────────
const FileGridCard = ({
    file, onDelete, onDownload, onPreview, onRenameStart,
    renamingFileId, renameValue, setRenameValue, onRenameConfirm, onRenameCancel, compact,
}: FileRowProps) => {
    const displayName = file.name.replace(/^\d+_/, "");
    const isRenaming = renamingFileId === file.id;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
                "group relative flex flex-col p-5 rounded-[28px] bg-white dark:bg-black/[0.2] border border-zinc-200/50 dark:border-white/[0.05] hover:border-zinc-300 dark:hover:border-white/[0.1] hover:shadow-[0_30px_60px_-12px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_30px_60px_-12px_rgba(0,0,0,0.6)] transition-all duration-500 cursor-pointer overflow-hidden",
                compact && "p-4"
            )}
            onClick={() => !isRenaming && onPreview({ path: file.path, name: displayName, mimetype: file.mimetype })}
        >
            <div className="absolute inset-0 notes-retina-texture opacity-[0.12] pointer-events-none" />

            {/* Quick Actions Overlay (Top Right) */}
            {!isRenaming && (
                <div className="absolute top-4 right-4 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-[-10px] group-hover:translate-y-0" onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl bg-white/80 dark:bg-black/60 backdrop-blur-xl border border-zinc-200/50 dark:border-white/10 shadow-lg">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 p-2 rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl border-zinc-200/50 dark:border-white/10 shadow-2xl">
                            <DropdownMenuItem onClick={() => onPreview({ path: file.path, name: displayName, mimetype: file.mimetype })} className="rounded-xl gap-3 py-3 cursor-pointer">
                                <Eye className="h-4 w-4" />
                                <span className="text-[11px] font-black uppercase tracking-wider">Visualizar</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onDownload(file.path, displayName)} className="rounded-xl gap-3 py-3 cursor-pointer">
                                <Download className="h-4 w-4" />
                                <span className="text-[11px] font-black uppercase tracking-wider">Baixar</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onRenameStart(file)} className="rounded-xl gap-3 py-3 cursor-pointer">
                                <Pencil className="h-4 w-4" />
                                <span className="text-[11px] font-black uppercase tracking-wider">Renomear</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onDelete(file.path)} className="rounded-xl gap-3 py-3 cursor-pointer text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">
                                <Trash2 className="h-4 w-4" />
                                <span className="text-[11px] font-black uppercase tracking-wider">Excluir</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}

            {/* Icon area */}
            <div className="relative aspect-square rounded-[22px] bg-zinc-50 dark:bg-white/[0.03] group-hover:bg-white dark:group-hover:bg-zinc-900 flex items-center justify-center mb-5 transition-all duration-500 group-hover:shadow-inner">
                <div className="group-hover:scale-110 transition-transform duration-500">
                    {getFileIcon(displayName, "w-16 h-20 drop-shadow-2xl")}
                </div>
            </div>

            {/* Info area */}
            <div className="space-y-2">
                {isRenaming ? (
                    <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                        <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="h-10 text-[13px] bg-zinc-100/50 dark:bg-black/20 border-zinc-200 dark:border-white/10 rounded-xl"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter") onRenameConfirm(file);
                                if (e.key === "Escape") onRenameCancel();
                            }}
                        />
                        <div className="flex gap-2">
                            <Button size="sm" variant="ghost" className="flex-1 h-9 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-[10px] font-black uppercase tracking-widest" onClick={() => onRenameConfirm(file)}>
                                <Check className="h-3 w-3 mr-2" strokeWidth={3} /> Salvar
                            </Button>
                            <Button size="sm" variant="ghost" className="flex-1 h-9 rounded-xl border border-zinc-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest" onClick={onRenameCancel}>
                                <X className="h-3 w-3 mr-2" strokeWidth={3} /> Cancelar
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <p className="text-[13px] font-bold text-zinc-900 dark:text-zinc-100 truncate w-full tracking-tight transition-colors group-hover:text-black dark:group-hover:text-white" title={displayName}>
                            {displayName}
                        </p>
                        <div className="flex items-center gap-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400 dark:text-zinc-500">
                                {formatFileSize(file.size)}
                            </p>
                            <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400 dark:text-zinc-500">
                                {format(new Date(file.created_at), "dd MMM", { locale: ptBR })}
                            </p>
                        </div>
                    </>
                )}
            </div>
        </motion.div>
    );
};
