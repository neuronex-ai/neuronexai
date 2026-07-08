"use client";

import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { User, Copy, Check, FileText } from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { PatientListWidget, PatientCardData } from "./PatientMiniCard";
import { PDFPreviewCard } from "./PDFPreviewCard";
import { generateDocumentPDF } from "@/lib/pdf-generator";
import { useSendEmail } from "@/hooks/use-send-email";
import { SynapseOrbAvatar } from "@/components/synapse/SynapseOrbAvatar";
import { SynapseWidgetRenderer } from "@/components/synapse/SynapseWidgetRenderer";
import { parseSynapseWidgetFromContent } from "@/lib/synapse-widget-parser";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    created_at: string;
}

interface ChatMessageItemProps {
    message: Message;
    richData?: any;
    onAction?: (type: string, payload: any) => void;
}

// Global Widget Renderer - Clean & Action-Oriented
export const WidgetRenderer = ({ type, data }: { type: string; data: unknown }) => (
    <SynapseWidgetRenderer widgetData={{ __actionType: type, data }} />
); /*
    const navigate = useNavigate();

    const handleNavigate = () => {
        // Extraction of ID if available
        const entityId = data?.id || data?.patient_id || data?.appointment_id;

        if (type === 'patient_list' || type === 'patient' || type === 'patient_card') {
            if (entityId) navigate(`/mobile/pacientes/${entityId}`);
            else navigate('/mobile/pacientes');
        } else if (type === 'appointment_list' || type === 'agenda' || type === 'create_appointment') {
            if (entityId) navigate(`/mobile/agenda?id=${entityId}`);
            else navigate('/mobile/agenda');
        } else if (type === 'financial_summary') {
            navigate('/mobile/financeiro');
        }
    };

    // Helper to format action names for humans in Portuguese
    const formatActionName = (name: string) => {
        const mapping: Record<string, string> = {
            'create_appointment': 'Agendamento Criado',
            'send_email': 'Email Enviado',
            'create_invoice': 'Cobrança Gerada',
            'update_patient': 'Paciente Atualizado',
            'create_patient': 'Paciente Cadastrado',
            'generate_document': 'Documento Gerado',
            'patient_list': 'Lista de Pacientes',
            'patient_card': 'Ficha do Paciente',
            'patient': 'Paciente Localizado',
            'agenda': 'Agenda do Dia'
        };
        return mapping[name] || name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    switch (type) {
        case 'patient_list':
            return (
                <div className="my-6 w-full overflow-hidden bg-transparent">
                    <PatientListWidget patients={data.patients || data} />
                </div>
            );
        case 'appointment_list':
        case 'agenda':
            return (
                <div className="my-6 w-full rounded-[24px] md:rounded-[32px] bg-black border border-white/10 shadow-2xl overflow-hidden" onClick={handleNavigate}>
                    <div className="p-5 md:p-8 border-b border-white/[0.05] bg-white/[0.02]">
                        <div className="flex items-center gap-3 md:gap-4">
                            <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl md:rounded-2xl bg-white/5 flex items-center justify-center text-white border border-white/10 shadow-inner shrink-0">
                                <Calendar className="h-5 w-5 md:h-6 md:w-6" strokeWidth={1.5} />
                            </div>
                            <div className="min-w-0">
                                <h4 className="text-[11px] md:text-[13px] font-black text-white tracking-[0.15em] md:tracking-[0.2em] uppercase truncate">Sua Agenda</h4>
                                <p className="text-[9px] md:text-[11px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5 opacity-60 truncate">Próximos compromissos</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-2 md:p-3">
                        <div className="space-y-1">
                            {(data.appointments || data).map((app: any, i: number) => (
                                <div key={i} className="flex items-center justify-between p-4 md:p-6 rounded-[20px] md:rounded-[24px] bg-transparent hover:bg-white/[0.04] transition-all group cursor-pointer active:scale-[0.98]">
                                    <div className="flex flex-col gap-0.5 min-w-0 pr-4">
                                        <span className="text-[14px] md:text-[16px] font-bold text-zinc-100 group-hover:text-white transition-colors truncate">{app.patient_name || app.title}</span>
                                        <span className="text-[10px] md:text-[12px] text-zinc-500 font-mono uppercase tracking-widest">{app.horario || app.time || app.start_time_local || app.date}</span>
                                    </div>
                                    <div className="h-9 w-9 md:h-11 md:w-11 rounded-full border border-white/[0.08] flex items-center justify-center text-zinc-600 group-hover:text-white group-hover:bg-white/[0.08] transition-all shrink-0">
                                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        case 'financial_summary': {
            const metrics = data.metrics || data;
            return (
                <div className="my-6 w-full rounded-[24px] md:rounded-[32px] bg-black border border-white/10 shadow-2xl overflow-hidden relative" onClick={handleNavigate}>
                    <div className="p-5 md:p-8 border-b border-white/[0.05] relative z-10 bg-white/[0.02]">
                        <div className="flex items-center gap-3 md:gap-4">
                            <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl md:rounded-2xl bg-white/5 flex items-center justify-center text-white border border-white/10 shadow-inner shrink-0">
                                <DollarSign className="h-5 w-5 md:h-6 md:w-6" strokeWidth={1.5} />
                            </div>
                            <div className="min-w-0">
                                <h4 className="text-[11px] md:text-[13px] font-black text-white tracking-[0.15em] md:tracking-[0.2em] uppercase truncate">Financeiro</h4>
                                <p className="text-[9px] md:text-[11px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5 opacity-60 truncate">Resumo do dia</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-5 md:p-8 space-y-4 md:space-y-6 relative z-10">
                        <div className="grid grid-cols-2 gap-3 md:gap-6">
                            <div className="p-4 md:p-6 rounded-[20px] md:rounded-[28px] bg-white/[0.03] border border-white/[0.05] flex flex-col gap-1.5 min-w-0">
                                <p className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.1em] opacity-50 truncate">Projetado</p>
                                <p className="text-lg md:text-2xl font-black text-white tracking-tighter truncate">R$ {metrics.projectedRevenue?.toLocaleString('pt-BR') || '0,00'}</p>
                            </div>
                            <div className="p-4 md:p-6 rounded-[20px] md:rounded-[28px] bg-white/[0.03] border border-white/[0.05] flex flex-col gap-1.5 min-w-0">
                                <p className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.1em] opacity-50 truncate">Pendente</p>
                                <p className="text-lg md:text-2xl font-black text-white tracking-tighter truncate">R$ {metrics.pendingInvoices?.toLocaleString('pt-BR') || '0,00'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
        default:
            // "Real Action" Bar Style
            return (
                <div
                    onClick={handleNavigate}
                    className="my-6 p-5 md:p-6 rounded-[20px] bg-black border border-white/10 flex items-center justify-between group hover:bg-zinc-950 transition-all shadow-xl active:scale-[0.98] cursor-pointer overflow-hidden w-full"
                >
                    <div className="flex flex-col gap-0.5 min-w-0 pr-4">
                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] opacity-60 truncate">Ação Realizada</p>
                        <p className="text-[14px] font-black text-white tracking-tight leading-tight truncate">{formatActionName(type)}</p>
                    </div>
                    <div className="h-9 w-9 rounded-full border border-white/[0.08] flex items-center justify-center text-zinc-600 group-hover:text-white group-hover:bg-white/[0.08] transition-all shrink-0">
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
                    </div>
                </div>
            );
    }
};

*/

const parsePatientList = (content: string): { patients: PatientCardData[], raw: string } | null => {
    const patients: PatientCardData[] = [];
    let rawText = '';
    const mainPattern = /^\s*[*-]\s+\*\*(.+?)\*\*\s+\(ID:\s*`?([a-f0-9-]+)`?\)/gim;
    const matches: Array<{ match: RegExpExecArray, details: string }> = [];
    let match;
    const lines = content.split('\n');
    let currentPatientIndex = -1;
    while ((match = mainPattern.exec(content)) !== null) {
        matches.push({ match, details: '' });
    }
    if (matches.length > 0) {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const patientMatch = line.match(/^\s*[*-]\s+\*\*(.+?)\*\*\s+\(ID:\s*`?([a-f0-9-]+)`?\)/i);
            if (patientMatch) {
                currentPatientIndex++;
                const name = patientMatch[1].trim();
                const id = patientMatch[2].trim();
                let phone = '';
                let email = '';
                let j = i + 1;
                while (j < lines.length && lines[j].match(/^\s{4,}[*-]/)) {
                    const detailLine = lines[j];
                    const phoneMatch = detailLine.match(/\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/);
                    if (phoneMatch && !phone) {
                        phone = phoneMatch[0].replace(/\D/g, '').replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');
                    }
                    const emailMatch = detailLine.match(/[\w.-]+@[\w.-]+\.\w+/);
                    if (emailMatch && !email) {
                        email = emailMatch[0];
                    }
                    j++;
                }
                patients.push({ id, name, email: email || undefined, phone: phone || undefined, status: 'active' });
            }
        }
        if (matches.length > 0) {
            const firstMatch = matches[0].match;
            const lastMatch = matches[matches.length - 1].match;
            const startIndex = content.indexOf(firstMatch[0]);
            let endIndex = content.indexOf(lastMatch[0]) + lastMatch[0].length;
            const remainingContent = content.substring(endIndex);
            const remainingLines = remainingContent.split('\n');
            for (const line of remainingLines) {
                if (line.trim() && !line.match(/^\s{4,}[*-]/)) break;
                endIndex += line.length + 1;
            }
            const beforeList = content.substring(0, startIndex);
            const introMatch = beforeList.match(/([^\n]*pacientes[^\n]*):?\s*$/i);
            const actualStart = introMatch ? beforeList.lastIndexOf(introMatch[1]) : startIndex;
            rawText = content.substring(actualStart, endIndex).trim();
        }
    }
    return patients.length > 0 ? { patients, raw: rawText } : null;
};

const parseMarkdownTable = (content: string) => {
    const separatorChars = ["-", ":", "\\s", "|"].join("");
    const tablePattern = new RegExp(
        "\\|(.+)\\|\\n\\|[" + separatorChars + "]+\\|\\n((?:\\|.+\\|\\n?)+)",
        "g",
    );
    const match = tablePattern.exec(content);
    if (match) {
        const headers = match[1].split('|').map(h => h.trim()).filter(Boolean);
        const rows = match[2].trim().split('\n').map(row =>
            row.split('|').map(cell => cell.trim()).filter(Boolean)
        );
        return { headers, rows, raw: match[0] };
    }
    return null;
};

const SimpleTable = ({ headers, rows }: { headers: string[], rows: string[][] }) => (
    <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="notes-liquid-surface my-6 w-full overflow-hidden rounded-[24px] border shadow-2xl md:rounded-[28px]"
    >
        <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[400px]">
                <thead className="border-b border-foreground/[0.08] bg-muted/35 dark:border-white/[0.065] dark:bg-white/[0.045]">
                    <tr>
                        {headers.map((h, i) => (
                            <th key={i} className="whitespace-nowrap px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground md:px-7 md:py-6 md:text-[11px]">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} className="group border-b border-foreground/[0.055] transition-colors last:border-0 hover:bg-muted/30 dark:border-white/[0.045] dark:hover:bg-white/[0.035]">
                            {row.map((cell, j) => (
                                <td key={j} className="max-w-[200px] break-words px-5 py-4 text-[13px] font-medium text-foreground/82 transition-colors group-hover:text-foreground md:px-7 md:py-6 md:text-[15px]">
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
    const [copied, setCopied] = useState(false);
    const [pdfBlob, setPdfBlob] = useState<string | null>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const { mutate: sendEmail, isPending: isSendingEmail } = useSendEmail();
    const navigate = useNavigate();

    useEffect(() => {
        let active = true;
        if (richData?.type === 'generate_document' && richData.data) {
            const generate = async () => {
                setIsGeneratingPdf(true);
                try {
                    const blob = await generateDocumentPDF(richData.data);
                    if (active) {
                        const url = URL.createObjectURL(blob);
                        setPdfBlob(url);
                    }
                } catch (e) {
                    console.error("Failed to generate PDF", e);
                } finally {
                    if (active) setIsGeneratingPdf(false);
                }
            };
            generate();
        }
        return () => { active = false; };
    }, [richData]);

    const handleSendEmail = async () => {
        const email = prompt("Para qual email deseja enviar o documento?");
        if (!email) return;
        if (!richData?.data) { toast.error("Dados do documento não encontrados."); return; }
        try {
            const blob = await generateDocumentPDF(richData.data);
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
                const base64data = (reader.result as string)?.split(',')[1];
                if (!base64data) { toast.error("Erro ao processar arquivo PDF."); return; }
                const emailParams = {
                    to: email,
                    subject: `Documento: ${richData.data.title || "Documento NeuroNex"}`,
                    htmlBody: `<div style="font-family: sans-serif; color: #333;"><h2>Documento Enviado via NeuroNex</h2><p>Olá,</p><p>Segue em anexo o documento <strong>${richData.data.title || "Documento"}</strong>.</p><br/><p style="color: #666; font-size: 12px;">Enviado automaticamente por NeuroNex.</p></div>`,
                    documentType: "documento",
                    pdfAttachment: { filename: `${richData.data.title || "documento"}.pdf`, content: base64data, contentType: "application/pdf" }
                };
                sendEmail({ type: 'document', params: emailParams as any });
            };
        } catch (error) { toast.error("Erro ao preparar documento para envio."); }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const parsedContent = useMemo(() => {
        if (!isAssistant) return { patients: null, table: null, cleanContent: message.content, widgetData: null };
        const widgetContent = parseSynapseWidgetFromContent(message.content);
        const sourceContent = widgetContent.cleanContent || (widgetContent.widgetData ? "" : message.content);
        const patientData = parsePatientList(sourceContent);
        const tableData = parseMarkdownTable(sourceContent);
        let cleanContent = sourceContent;
        if (tableData) cleanContent = cleanContent.replace(tableData.raw, '');
        if (patientData) cleanContent = cleanContent.replace(patientData.raw, '');
        return { patients: patientData?.patients || null, table: tableData, cleanContent: cleanContent.trim(), widgetData: widgetContent.widgetData };
    }, [message.content, isAssistant]);

    const customComponents = {
        a: ({ href, children, ...props }: any) => {
            const patientMatch = href?.match(/\/pacientes\/([a-f0-9-]+)/);
            if (patientMatch) {
                return (
                    <button onClick={() => navigate(href)} className="font-black text-foreground underline underline-offset-4 transition-colors hover:text-foreground/80">
                        {children}
                    </button>
                );
            }
            if (href?.toLowerCase().endsWith('.pdf')) {
                return (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="notes-liquid-surface group my-6 flex max-w-full items-center gap-4 rounded-[24px] border p-5 no-underline shadow-xl transition-all active:scale-[0.985] md:max-w-sm">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-foreground/[0.085] bg-muted/45 shadow-inner transition-all duration-500 group-hover:scale-105 dark:border-white/[0.075] dark:bg-white/[0.06] md:h-14 md:w-14 md:rounded-2xl">
                            <FileText className="h-6 w-6 text-muted-foreground md:h-8 md:w-8" strokeWidth={1.5} />
                        </div>
                        <div className="flex flex-col overflow-hidden text-left gap-0.5">
                            <span className="truncate text-[14px] font-black text-foreground md:text-[16px]">{String(children)}</span>
                            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground md:text-[11px] md:tracking-[0.18em]">Abrir Documento</span>
                        </div>
                    </a>
                );
            }
            return <a href={href} {...props} className="break-all font-bold text-foreground underline-offset-4 hover:underline">{children}</a>;
        },
        code: ({ inline, className, children, ...props }: any) => {
            if (inline) return <code className="break-all rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] text-foreground md:text-[13px]" {...props}>{children}</code>;
            const codeString = String(children).trim();
            if (codeString.startsWith('{') && codeString.endsWith('}')) {
                try {
                    const json = JSON.parse(codeString);
                    const type = json.type || json.__actionType;
                    if (type) {
                        return (
                            <div className="my-6 bg-transparent">
                                <SynapseWidgetRenderer widgetData={json} />
                            </div>
                        );
                    }
                } catch (e) {
                    console.debug("Ignoring non-widget code block", e);
                }
            }
            return (
                <pre className="custom-scrollbar notes-liquid-surface my-6 w-full overflow-x-auto rounded-[24px] border p-5 shadow-xl md:rounded-[28px] md:p-7">
                    <code className={cn("font-mono text-[13px] leading-relaxed text-foreground/78 md:text-[14px]", className)} {...props}>{children}</code>
                </pre>
            );
        },
        blockquote: ({ children }: any) => (
            <blockquote className="my-8 border-l-2 border-foreground/15 pl-6 text-[16px] font-medium italic leading-relaxed text-muted-foreground md:pl-10 md:text-[18px]">
                {children}
            </blockquote>
        ),
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                "group relative flex w-full flex-col gap-2 overflow-hidden rounded-[32px] border border-transparent px-4 py-6 transition-all duration-700 md:gap-4 md:px-10 md:py-10",
                isAssistant ? "bg-transparent" : "notes-liquid-surface border-foreground/[0.075] shadow-2xl dark:border-white/[0.065]"
            )}
        >
            {isAssistant ? (
                <div className="mb-2 flex items-center gap-3 shrink-0">
                    <SynapseOrbAvatar className="h-9 w-9 md:h-10 md:w-10" />
                    <div className="min-w-0">
                        <span className="block truncate text-[10px] font-black uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
                            Synapse
                        </span>
                        <span className="block text-[8px] font-bold uppercase tracking-widest text-zinc-500/55 dark:text-zinc-500">
                            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between mb-2 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-2xl transition-all duration-700",
                            "border-foreground/[0.085] bg-foreground text-background dark:border-white/[0.075] dark:bg-white dark:text-zinc-950"
                        )}>
                            <User className="h-4.5 w-4.5" strokeWidth={2} />
                        </div>
                        <div className="flex flex-col gap-0 min-w-0">
                            <span className="truncate text-[10px] font-black uppercase leading-none tracking-[0.3em] text-muted-foreground">
                                Sua Conta
                            </span>
                            <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            <div className={cn(
                "prose max-w-none prose-p:my-2 prose-p:text-[15px] prose-p:font-medium prose-p:leading-[1.45] prose-p:text-foreground/86 md:prose-p:text-[18px]",
                "prose-strong:break-words prose-strong:font-black prose-strong:tracking-tight prose-strong:text-foreground",
                "prose-headings:my-3 prose-headings:break-words prose-headings:font-black prose-headings:tracking-normal prose-headings:text-foreground",
                "prose-ul:my-4 md:prose-ul:my-6 prose-ul:list-disc prose-ul:pl-6 md:prose-ul:pl-8",
                "prose-li:my-1 prose-li:break-words prose-li:pl-1 prose-li:text-muted-foreground prose-li:marker:text-foreground/20",
                "flex-1 px-0.5 md:px-0 w-full overflow-hidden break-words",
                isAssistant ? "mt-0" : ""
            )}>
                {parsedContent.cleanContent ? (
                    <ReactMarkdown components={customComponents}>{parsedContent.cleanContent}</ReactMarkdown>
                ) : null}
            </div>

            <AnimatePresence>
                {(parsedContent.table || parsedContent.patients || parsedContent.widgetData || richData) && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4 md:space-y-6 w-full overflow-hidden bg-transparent">
                        {parsedContent.table && <SimpleTable headers={parsedContent.table.headers} rows={parsedContent.table.rows} />}
                        {parsedContent.patients && parsedContent.patients.length > 0 && (
                            <div className="my-4 w-full overflow-hidden bg-transparent">
                                <PatientListWidget patients={parsedContent.patients} />
                            </div>
                        )}
                        {richData?.type === 'generate_document' && (
                            <div className="my-4 w-full bg-transparent">
                                <PDFPreviewCard
                                    pdfUrl={pdfBlob || undefined}
                                    filename={richData.data?.filename || "documento.pdf"}
                                    title={richData.data?.title || "Documento Gerado"}
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
                        {richData && richData.type !== 'generate_document' && richData.type !== 'review_draft' && richData.type !== 'review_invoice_draft' && (
                            <div className="bg-transparent">
                                <SynapseWidgetRenderer widgetData={{ __actionType: richData.type, data: richData.payload || richData.data }} />
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Actions at the bottom */}
            <div className="mt-2 flex items-center justify-start gap-2 opacity-40 group-hover:opacity-100 transition-all duration-300">
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 rounded-lg border border-foreground/[0.085] bg-background/55 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95 dark:border-white/[0.075] dark:bg-white/[0.045]"
                >
                    {copied ? (
                        <>
                            <Check className="h-3 w-3 text-emerald-500" />
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
