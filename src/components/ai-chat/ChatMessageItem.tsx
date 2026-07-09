"use client";

import type { ComponentPropsWithoutRef } from "react";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Copy, FileText, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { PatientListWidget, type PatientCardData } from "./PatientMiniCard";
import { PDFPreviewCard } from "./PDFPreviewCard";
import { SynapseOrbAvatar } from "@/components/synapse/SynapseOrbAvatar";
import { SynapseWidgetRenderer } from "@/components/synapse/SynapseWidgetRenderer";
import { useSendEmail } from "@/hooks/use-send-email";
import { generateDocumentPDF, type DocumentPDFData } from "@/lib/pdf-generator";
import {
    firstString,
    isRecord,
    parseSynapseWidgetFromContent,
    type SynapseRichData,
} from "@/lib/synapse-widget-parser";
import { cn } from "@/lib/utils";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    created_at: string;
}

interface ChatMessageItemProps {
    message: Message;
    richData?: SynapseRichData;
    onAction?: (type: string, payload: unknown) => void;
}

type MarkdownAnchorProps = ComponentPropsWithoutRef<"a"> & { node?: unknown };
type MarkdownCodeProps = ComponentPropsWithoutRef<"code"> & {
    node?: unknown;
    inline?: boolean;
    className?: string;
};
type MarkdownBlockquoteProps = ComponentPropsWithoutRef<"blockquote"> & { node?: unknown };

type ParsedTable = {
    headers: string[];
    rows: string[][];
    raw: string;
};

const getRecordString = (value: unknown, ...keys: string[]) => {
    if (!isRecord(value)) return undefined;
    return firstString(...keys.map((key) => value[key]));
};

const toDocumentPDFData = (value: unknown): DocumentPDFData | null => {
    if (!isRecord(value)) return null;

    return {
        type: getRecordString(value, "type", "documentType") || "Documento",
        title: getRecordString(value, "title") || "Documento NeuroNex",
        content: getRecordString(value, "content", "body", "htmlBody") || "",
        patientName: getRecordString(value, "patientName", "patient_name") || "Paciente",
        patientDoc: getRecordString(value, "patientDoc", "patient_doc", "cpf"),
        professionalName: getRecordString(value, "professionalName", "professional_name") || "Profissional",
        professionalRegistry: getRecordString(value, "professionalRegistry", "professional_registry", "crp") || "",
        date: getRecordString(value, "date") || new Date().toLocaleDateString("pt-BR"),
        clinicName: getRecordString(value, "clinicName", "clinic_name"),
    };
};

const getDocumentFilename = (value: unknown) =>
    getRecordString(value, "filename") || `${getRecordString(value, "title") || "documento"}.pdf`;

const parsePatientList = (content: string): { patients: PatientCardData[]; raw: string } | null => {
    const patients: PatientCardData[] = [];
    let rawText = "";
    const mainPattern = /^\s*[*-]\s+\*\*(.+?)\*\*\s+\(ID:\s*`?([a-f0-9-]+)`?\)/gim;
    const matches: Array<{ match: RegExpExecArray; details: string }> = [];
    let match: RegExpExecArray | null;
    const lines = content.split("\n");

    while ((match = mainPattern.exec(content)) !== null) {
        matches.push({ match, details: "" });
    }

    if (matches.length > 0) {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const patientMatch = line.match(/^\s*[*-]\s+\*\*(.+?)\*\*\s+\(ID:\s*`?([a-f0-9-]+)`?\)/i);
            if (!patientMatch) continue;

            const name = patientMatch[1].trim();
            const id = patientMatch[2].trim();
            let phone = "";
            let email = "";
            let j = i + 1;

            while (j < lines.length && lines[j].match(/^\s{4,}[*-]/)) {
                const detailLine = lines[j];
                const phoneMatch = detailLine.match(/\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/);
                if (phoneMatch && !phone) {
                    phone = phoneMatch[0].replace(/\D/g, "").replace(/^(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3");
                }

                const emailMatch = detailLine.match(/[\w.-]+@[\w.-]+\.\w+/);
                if (emailMatch && !email) {
                    email = emailMatch[0];
                }
                j++;
            }

            patients.push({ id, name, email: email || undefined, phone: phone || undefined, status: "active" });
        }

        const firstMatch = matches[0].match;
        const lastMatch = matches[matches.length - 1].match;
        const startIndex = content.indexOf(firstMatch[0]);
        let endIndex = content.indexOf(lastMatch[0]) + lastMatch[0].length;
        const remainingContent = content.substring(endIndex);
        const remainingLines = remainingContent.split("\n");

        for (const line of remainingLines) {
            if (line.trim() && !line.match(/^\s{4,}[*-]/)) break;
            endIndex += line.length + 1;
        }

        const beforeList = content.substring(0, startIndex);
        const introMatch = beforeList.match(/([^\n]*pacientes[^\n]*):?\s*$/i);
        const actualStart = introMatch ? beforeList.lastIndexOf(introMatch[1]) : startIndex;
        rawText = content.substring(actualStart, endIndex).trim();
    }

    return patients.length > 0 ? { patients, raw: rawText } : null;
};

const parseMarkdownTable = (content: string): ParsedTable | null => {
    const separatorChars = ["-", ":", "\\s", "|"].join("");
    const tablePattern = new RegExp(
        "\\|(.+)\\|\\n\\|[" + separatorChars + "]+\\|\\n((?:\\|.+\\|\\n?)+)",
        "g",
    );
    const match = tablePattern.exec(content);
    if (!match) return null;

    const headers = match[1].split("|").map((header) => header.trim()).filter(Boolean);
    const rows = match[2].trim().split("\n").map((row) =>
        row.split("|").map((cell) => cell.trim()).filter(Boolean),
    );

    return { headers, rows, raw: match[0] };
};

const SimpleTable = ({ headers, rows, reduceMotion }: ParsedTable & { reduceMotion: boolean }) => (
    <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="notes-liquid-surface my-6 w-full overflow-hidden rounded-[24px] border shadow-[0_22px_64px_-48px_hsl(var(--foreground)/0.8)] md:rounded-[28px]"
    >
        <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[400px] border-collapse text-left">
                <thead className="border-b border-border/35 bg-muted/35 dark:border-white/[0.055] dark:bg-white/[0.035]">
                    <tr>
                        {headers.map((header) => (
                            <th key={header} className="whitespace-nowrap px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground md:px-6">
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, rowIndex) => (
                        <tr key={row.join("|") || rowIndex} className="group border-b border-border/25 transition-colors last:border-0 hover:bg-muted/30 dark:border-white/[0.04] dark:hover:bg-white/[0.035]">
                            {row.map((cell, cellIndex) => (
                                <td key={`${rowIndex}-${cellIndex}-${cell}`} className="max-w-[220px] break-words px-5 py-4 text-[13px] font-medium text-foreground/82 transition-colors group-hover:text-foreground md:px-6 md:text-[14px]">
                                    <ReactMarkdown components={{ p: ({ children }) => <>{children}</> }}>{cell}</ReactMarkdown>
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </motion.div>
);

export const ChatMessageItem = ({ message, richData }: ChatMessageItemProps) => {
    const isAssistant = message.role === "assistant";
    const shouldReduceMotion = useReducedMotion();
    const [copied, setCopied] = useState(false);
    const [pdfBlob, setPdfBlob] = useState<string | null>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const { mutate: sendEmail, isPending: isSendingEmail } = useSendEmail();
    const navigate = useNavigate();

    const richPayload = richData?.data ?? richData?.payload;
    const documentData = useMemo(
        () => (richData?.type === "generate_document" ? toDocumentPDFData(richPayload) : null),
        [richData?.type, richPayload],
    );

    useEffect(() => {
        let active = true;
        if (!documentData) return;

        const generate = async () => {
            setIsGeneratingPdf(true);
            try {
                const blob = await generateDocumentPDF(documentData);
                if (active) {
                    const url = URL.createObjectURL(blob);
                    setPdfBlob((previous) => {
                        if (previous) URL.revokeObjectURL(previous);
                        return url;
                    });
                }
            } catch (error) {
                console.error("Failed to generate PDF", error);
            } finally {
                if (active) setIsGeneratingPdf(false);
            }
        };

        void generate();

        return () => {
            active = false;
        };
    }, [documentData]);

    useEffect(() => () => {
        if (pdfBlob) URL.revokeObjectURL(pdfBlob);
    }, [pdfBlob]);

    const handleSendEmail = async () => {
        const email = prompt("Para qual email deseja enviar o documento?");
        if (!email) return;
        if (!documentData) {
            toast.error("Dados do documento nao encontrados.");
            return;
        }

        try {
            const blob = await generateDocumentPDF(documentData);
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
                const base64data = (reader.result as string)?.split(",")[1];
                if (!base64data) {
                    toast.error("Erro ao processar arquivo PDF.");
                    return;
                }

                sendEmail({
                    type: "document",
                    params: {
                        to: email,
                        subject: `Documento: ${documentData.title || "Documento NeuroNex"}`,
                        htmlBody: `<div style="font-family: sans-serif; color: #333;"><h2>Documento Enviado via NeuroNex</h2><p>Ola,</p><p>Segue em anexo o documento <strong>${documentData.title || "Documento"}</strong>.</p><br/><p style="color: #666; font-size: 12px;">Enviado automaticamente por NeuroNex.</p></div>`,
                        documentType: "documento",
                        pdfAttachment: {
                            filename: getDocumentFilename(richPayload),
                            content: base64data,
                            contentType: "application/pdf",
                        },
                    },
                });
            };
        } catch {
            toast.error("Erro ao preparar documento para envio.");
        }
    };

    const handleCopy = () => {
        void navigator.clipboard.writeText(message.content);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
    };

    const parsedContent = useMemo(() => {
        if (!isAssistant) return { patients: null, table: null, cleanContent: message.content, widgetData: null };
        const widgetContent = parseSynapseWidgetFromContent(message.content);
        const sourceContent = widgetContent.cleanContent || (widgetContent.widgetData ? "" : message.content);
        const patientData = parsePatientList(sourceContent);
        const tableData = parseMarkdownTable(sourceContent);
        let cleanContent = sourceContent;
        if (tableData) cleanContent = cleanContent.replace(tableData.raw, "");
        if (patientData) cleanContent = cleanContent.replace(patientData.raw, "");
        return {
            patients: patientData?.patients || null,
            table: tableData,
            cleanContent: cleanContent.trim(),
            widgetData: widgetContent.widgetData,
        };
    }, [message.content, isAssistant]);

    const customComponents = {
        a: ({ href, children, ...props }: MarkdownAnchorProps) => {
            const patientMatch = href?.match(/\/pacientes\/([a-f0-9-]+)/);
            if (patientMatch && href) {
                return (
                    <button
                        type="button"
                        onClick={() => navigate(href)}
                        className="font-black text-foreground underline underline-offset-4 transition-colors hover:text-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        {children}
                    </button>
                );
            }

            if (href?.toLowerCase().endsWith(".pdf")) {
                return (
                    <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="notes-liquid-surface my-6 flex max-w-full items-center gap-4 rounded-[22px] border p-4 no-underline shadow-[0_18px_55px_-45px_hsl(var(--foreground)/0.72)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0 md:max-w-sm md:rounded-[26px] md:p-5"
                    >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/45 bg-muted/65 text-muted-foreground dark:border-white/[0.075] dark:bg-white/[0.055] md:h-12 md:w-12">
                            <FileText className="h-5 w-5" strokeWidth={1.7} />
                        </div>
                        <div className="flex min-w-0 flex-col gap-0.5 overflow-hidden text-left">
                            <span className="truncate text-[14px] font-black text-foreground md:text-[15px]">{String(children)}</span>
                            <span className="text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground md:text-[10px]">Abrir documento</span>
                        </div>
                    </a>
                );
            }

            return (
                <a href={href} {...props} className="break-all font-bold text-foreground underline underline-offset-4 hover:text-foreground/70">
                    {children}
                </a>
            );
        },
        code: ({ inline, className, children, ...props }: MarkdownCodeProps) => {
            if (inline) {
                return (
                    <code className="rounded-md border border-border/35 bg-muted/60 px-1.5 py-0.5 font-mono text-[12px] text-foreground dark:border-white/[0.075] dark:bg-white/[0.055] md:text-[13px]" {...props}>
                        {children}
                    </code>
                );
            }

            const codeString = String(children).trim();
            if (codeString.startsWith("{") && codeString.endsWith("}")) {
                try {
                    const parsedJson = JSON.parse(codeString) as unknown;
                    if (isRecord(parsedJson) && firstString(parsedJson.type, parsedJson.__actionType)) {
                        return (
                            <div className="my-6 bg-transparent">
                                <SynapseWidgetRenderer widgetData={parsedJson} />
                            </div>
                        );
                    }
                } catch {
                    // Not a Synapse widget; render as a normal code block.
                }
            }

            return (
                <pre className="notes-liquid-surface my-6 w-full overflow-x-auto rounded-[22px] border p-5 shadow-[0_18px_55px_-45px_hsl(var(--foreground)/0.72)] custom-scrollbar md:rounded-[26px] md:p-6">
                    <code className={cn("font-mono text-[13px] leading-relaxed text-foreground/72 md:text-[14px]", className)} {...props}>
                        {children}
                    </code>
                </pre>
            );
        },
        blockquote: ({ children }: MarkdownBlockquoteProps) => (
            <blockquote className="my-8 border-l-2 border-border/70 pl-6 text-[16px] font-medium italic leading-relaxed text-muted-foreground md:pl-8 md:text-[17px]">
                {children}
            </blockquote>
        ),
    };

    return (
        <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
                "group relative flex w-full flex-col gap-3 overflow-hidden rounded-[30px] border border-transparent px-4 py-6 transition-colors duration-300 md:gap-4 md:rounded-[40px] md:px-8 md:py-8",
                !isAssistant ? "bg-primary shadow-[0_24px_70px_-52px_hsl(var(--foreground)/0.7)]" : "notes-liquid-surface border-border/45 dark:border-white/[0.07]",
            )}
        >
            {isAssistant ? (
                <div className="mb-1 flex shrink-0 items-center gap-3">
                    <SynapseOrbAvatar className="h-9 w-9 md:h-10 md:w-10" />
                    <div className="min-w-0">
                        <span className="block truncate text-[10px] font-black uppercase tracking-[0.28em] text-muted-foreground">
                            Synapse
                        </span>
                        <span className="block text-[8px] font-bold uppercase tracking-widest text-muted-foreground/55">
                            {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                    </div>
                </div>
            ) : (
                <div className="mb-1 flex shrink-0 items-center justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-black/10 text-primary-foreground shadow-sm">
                            <User className="h-4.5 w-4.5" strokeWidth={2} />
                        </div>
                        <div className="flex min-w-0 flex-col gap-0">
                            <span className="truncate text-[10px] font-black uppercase leading-none tracking-[0.24em] text-primary-foreground/70">
                                Sua conta
                            </span>
                            <span className="text-[8px] font-bold uppercase tracking-widest text-primary-foreground/50">
                                {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            <div
                className={cn(
                    "prose max-w-none flex-1 overflow-hidden break-words px-0.5 md:px-0",
                    "prose-p:my-2 prose-p:text-[15px] prose-p:font-medium prose-p:leading-[1.58] md:prose-p:text-[17px]",
                    "prose-strong:break-words prose-strong:font-black",
                    "prose-headings:my-3 prose-headings:break-words prose-headings:font-black prose-headings:tracking-tight",
                    "prose-ul:my-4 prose-ul:list-disc prose-ul:pl-6 md:prose-ul:my-6 md:prose-ul:pl-8",
                    "prose-li:my-1 prose-li:break-words prose-li:pl-1 prose-li:marker:text-muted-foreground/55",
                    !isAssistant 
                        ? "text-primary-foreground prose-p:text-primary-foreground prose-strong:text-primary-foreground prose-headings:text-primary-foreground prose-li:text-primary-foreground/90 prose-code:text-primary-foreground" 
                        : "text-foreground/92 dark:text-white prose-p:text-foreground/92 dark:prose-p:text-white prose-strong:text-foreground dark:prose-strong:text-white prose-headings:text-foreground dark:prose-headings:text-white prose-li:text-foreground/78 dark:prose-li:text-white/80 dark:prose-invert",
                )}
            >
                {parsedContent.cleanContent ? (
                    <ReactMarkdown components={customComponents}>{parsedContent.cleanContent}</ReactMarkdown>
                ) : null}
            </div>

            <AnimatePresence>
                {(parsedContent.table || parsedContent.patients || parsedContent.widgetData || richData) && (
                    <motion.div
                        initial={shouldReduceMotion ? false : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        className="w-full space-y-4 overflow-hidden bg-transparent md:space-y-5"
                    >
                        {parsedContent.table && <SimpleTable {...parsedContent.table} reduceMotion={Boolean(shouldReduceMotion)} />}
                        {parsedContent.patients && parsedContent.patients.length > 0 && (
                            <div className="my-4 w-full overflow-hidden bg-transparent">
                                <PatientListWidget patients={parsedContent.patients} />
                            </div>
                        )}
                        {richData?.type === "generate_document" && documentData && (
                            <div className="my-4 w-full bg-transparent">
                                <PDFPreviewCard
                                    pdfUrl={pdfBlob || undefined}
                                    filename={getDocumentFilename(richPayload)}
                                    title={documentData.title || "Documento gerado"}
                                    isLoading={isGeneratingPdf}
                                    isLoadingEmail={isSendingEmail}
                                    onSendEmail={handleSendEmail}
                                />
                            </div>
                        )}
                        {parsedContent.widgetData && (
                            <div className="bg-transparent">
                                <SynapseWidgetRenderer widgetData={parsedContent.widgetData} />
                            </div>
                        )}
                        {richData && richData.type !== "generate_document" && richData.type !== "review_draft" && richData.type !== "review_invoice_draft" && (
                            <div className="bg-transparent">
                                <SynapseWidgetRenderer widgetData={{ __actionType: richData.type, data: richPayload }} />
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="mt-1 flex items-center justify-start gap-2 opacity-55 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
                <button
                    type="button"
                    onClick={handleCopy}
                    className={cn(
                        "flex min-h-9 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        !isAssistant 
                            ? "border-white/20 bg-black/10 text-primary-foreground hover:bg-black/20" 
                            : "border-border/35 bg-muted/35 text-muted-foreground hover:bg-muted hover:text-foreground dark:border-white/[0.055] dark:bg-white/[0.035]"
                    )}
                    aria-label="Copiar mensagem"
                >
                    {copied ? (
                        <>
                            <Check className="h-3 w-3 text-emerald-400" />
                            Copiado
                        </>
                    ) : (
                        <>
                            <Copy className="h-3 w-3" />
                            Copiar
                        </>
                    )}
                </button>
            </div>
        </motion.div>
    );
};