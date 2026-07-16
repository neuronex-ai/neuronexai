import { SessionNote, Patient, AISummary } from "@/types";
import { Sparkles, TrendingUp, TrendingDown, Meh, Edit, Trash2, FileDown, Mail, MessageSquare, NotebookPen, ListTodo, Plus, Loader2, Check, MoreVertical, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import { useCreatePersonalNote } from "@/hooks/use-create-personal-note";
import { useCreateReminder } from "@/hooks/use-create-reminder";
import { downloadDocumentPDF, DocumentPDFData, generateDocumentPDFBase64 } from "@/lib/pdf-generator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { SessionAppointmentSource } from "@/components/patients/SessionAppointmentSource";

interface ClinicalSummaryCardProps {
  latestNote: SessionNote | undefined;
  patient: Patient;
}

const sentimentConfig = {
  Positivo: { icon: TrendingUp, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  Estável: { icon: TrendingUp, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  Neutro: { icon: Meh, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
  Negativo: { icon: TrendingDown, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10" },
  Ansioso: { icon: TrendingDown, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
  Depressivo: { icon: TrendingDown, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10" },
};

const ExpandableText = ({ text, className, limit = 150 }: { text: string, className?: string, limit?: number }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!text) return null;

  const shouldTruncate = text.length > limit;

  return (
    <div className="relative">
      <p className={cn(className, !isExpanded && shouldTruncate ? "line-clamp-3" : "")}>
        {text}
      </p>
      {shouldTruncate && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 mt-2 transition-colors cursor-pointer"
        >
          {isExpanded ? (
            <>Recolher <ChevronUp className="h-3 w-3" /></>
          ) : (
            <>Ler mais <ChevronDown className="h-3 w-3" /></>
          )}
        </button>
      )}
    </div>
  );
};

export const ClinicalSummaryCard = ({ latestNote, patient }: ClinicalSummaryCardProps) => {
  const shouldReduceMotion = useReducedMotion();
  const { data: profile } = useProfile();
  const { mutate: createNote } = useCreatePersonalNote();
  const { mutate: createReminder } = useCreateReminder();
  const [isEditing, setIsEditing] = useState(false);
  const [editType, setEditType] = useState<"summary" | "next_steps" | "topics" | null>(null);
  const [editedSummary, setEditedSummary] = useState("");
  const [editedSteps, setEditedSteps] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSending, setIsSending] = useState(false);

  if (!latestNote?.ai_summary) {
    return (
      <div className="patient-record-card rounded-3xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
        Nenhum registro de análise clínica disponível para a sessão mais recente.
      </div>
    );
  }

  const summary = latestNote.ai_summary;
  const sentiment = sentimentConfig[summary.sentiment as keyof typeof sentimentConfig] || sentimentConfig.Neutro;
  const SentimentIcon = sentiment.icon;

  const psychologistName = profile ? `${profile.first_name} ${profile.last_name}` : "Psicólogo(a)";
  const nowStr = format(new Date(), "HH:mm, dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  const getHeaderInfo = () => {
    return `Paciente: ${patient.name}\nPsicólogo: ${psychologistName}\nData: ${nowStr}\n\n`;
  };

  const getPDFData = (content: string, title: string): DocumentPDFData => ({
    type: "Análise Clínica",
    title,
    content: `<p>${content}</p>`,
    patientName: patient.name,
    professionalName: psychologistName,
    professionalRegistry: profile?.crp || "",
    date: nowStr,
    clinicName: profile?.clinic_name || "NeuroNex"
  });

  const handleExportToNotes = () => {
    createNote({
      patientId: patient.id,
      title: `Resumo Clínico - ${format(new Date(), 'dd/MM/yyyy')}`,
      content: summary.summary
    });
  };

  const handleExportToReminders = () => {
    summary.next_steps?.forEach(step => {
      createReminder({
        title: `Conduta: ${step}`,
        dueDate: new Date()
      });
    });
  };

  const handleDownloadPDF = async () => {
    const data = getPDFData(summary.summary, "RESUMO CLÍNICO DA ÚLTIMA SESSÃO");
    await downloadDocumentPDF(data, `resumo_${patient.name}.pdf`);
  };

  const handleSendEmail = async () => {
    if (!patient.email) {
      toast.error("Paciente não possui e-mail cadastrado.");
      return;
    }

    setIsSending(true);
    try {
      const pdfBase64 = await generateDocumentPDFBase64(getPDFData(summary.summary, "RESUMO CLÍNICO"));
      const { error } = await supabase.functions.invoke('send-document-email', {
        body: {
          to: patient.email,
          subject: `Resumo Clínico - ${patient.name}`,
          htmlBody: `Olá ${patient.name}, segue o resumo da nossa última sessão analisada.\n\n${summary.summary}`,
          documentType: "Resumo Clínico",
          pdfAttachment: {
            filename: `resumo_clinico_${patient.name}.pdf`,
            content: pdfBase64,
            contentType: 'application/pdf'
          }
        }
      });
      if (error) throw error;
      toast.success("E-mail enviado com sucesso!");
    } catch (e: any) {
      toast.error(`Erro ao enviar e-mail: ${e.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleWhatsApp = () => {
    if (!patient.phone) {
      toast.error("Paciente não possui telefone cadastrado.");
      return;
    }
    const message = encodeURIComponent(`*NeuroNex - Resumo Clínico*\n\n${getHeaderInfo()}${summary.summary}\n\n_Documento PDF enviado via sistema._`);
    window.open(`https://wa.me/${patient.phone.replace(/\D/g, '')}?text=${message}`, '_blank');
  };

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      const updatedSummary: AISummary = {
        ...summary,
        summary: editType === "summary" ? editedSummary : summary.summary,
        next_steps: editType === "next_steps" ? editedSteps : (summary.next_steps || []),
        topics: editType === "topics" ? editedSteps : (summary.topics || [])
      };

      const { error } = await supabase
        .from('session_notes')
        .update({ ai_summary: updatedSummary })
        .eq('id', latestNote.id);

      if (error) throw error;
      toast.success("Análise atualizada com sucesso!");
      setIsEditing(false);
    } catch (e: any) {
      toast.error("Erro ao atualizar: " + e.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Tem certeza que deseja remover esta análise clínica?")) return;
    try {
      const { error } = await supabase
        .from('session_notes')
        .update({ ai_summary: null })
        .eq('id', latestNote.id);

      if (error) throw error;
      toast.success("Resumo removido com sucesso.");
    } catch (e: any) {
      toast.error("Erro ao remover: " + e.message);
    }
  };

  return (
    <>
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
        className="desktop-retina-panel group/card relative overflow-hidden rounded-[28px] border border-border/45 bg-card/68 p-6 sm:p-7"
      >

        <div className="relative z-10 mb-6 flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Synapse AI</span>
              <span className="block text-lg font-bold tracking-tight text-foreground">Resumo da sessão</span>
            </div>
            <SessionAppointmentSource appointmentId={latestNote.appointment_id} />
            <div className="mb-1 flex w-fit items-center gap-2 rounded-full border border-border/70 bg-muted/55 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:border-zinc-800 dark:bg-[#141414]">
              <SentimentIcon className="h-3.5 w-3.5" />
              <span>{summary.sentiment}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border border-border/70 bg-muted/45 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:border-zinc-800 dark:bg-[#141414] dark:hover:bg-[#181818]">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="desktop-retina-modal w-64 rounded-[22px] border-border/60 bg-popover/96 p-2 text-popover-foreground shadow-xl">
                <DropdownMenuItem onClick={handleDownloadPDF} className="cursor-pointer gap-3 rounded-lg py-2.5">
                  <FileDown className="h-4 w-4 text-blue-400" /> Baixar PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSendEmail} disabled={isSending} className="cursor-pointer gap-3 rounded-lg py-2.5">
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4 text-emerald-400" />}
                  Enviar por E-mail
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleWhatsApp} className="cursor-pointer gap-3 rounded-lg py-2.5">
                  <MessageSquare className="h-4 w-4 text-green-400" /> WhatsApp
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 bg-border/60" />
                <DropdownMenuItem onClick={handleExportToNotes} className="cursor-pointer gap-3 rounded-xl py-3 text-muted-foreground focus:bg-muted focus:text-foreground">
                  <NotebookPen className="h-4 w-4 text-amber-400" /> Mover para Notas
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportToReminders} className="cursor-pointer gap-3 rounded-xl py-3 text-muted-foreground focus:bg-muted focus:text-foreground">
                  <ListTodo className="h-4 w-4 text-purple-400" /> Criar Lembretes
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 bg-border/60" />
                <DropdownMenuItem onClick={handleDelete} className="gap-3 rounded-xl py-3 text-rose-400 focus:text-rose-300 focus:bg-rose-500/10 cursor-pointer">
                  <Trash2 className="h-4 w-4" /> Excluir Análise
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="relative z-10 mb-2 group/summary pt-2">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 z-20 h-6 w-6 rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover/summary:opacity-100"
            onClick={() => {
              setEditType("summary");
              setEditedSummary(summary.summary);
              setIsEditing(true);
            }}
          >
            <Edit className="h-3 w-3" />
          </Button>
          <ExpandableText
            text={`"${summary.summary}"`}
            className="text-lg md:text-xl text-zinc-800 dark:text-zinc-200 leading-relaxed font-light italic select-text pl-1 pr-6"
          />
        </div>

        {summary.topics && summary.topics.length > 0 && (
          <div className="relative z-10 mb-10 group/topics">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-2 py-0.5">Tópicos Identificados</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover/topics:opacity-100"
                onClick={() => {
                  setEditType("topics");
                  setEditedSteps([...(summary.topics || [])]);
                  setIsEditing(true);
                }}
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {summary.topics.map((topic) => (
                <div key={topic} className="cursor-default rounded-full border border-zinc-200 bg-zinc-100 px-4 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-200 dark:border-zinc-800 dark:bg-[#141414] dark:text-zinc-300 dark:hover:bg-[#181818]">
                  {topic}
                </div>
              ))}
            </div>
          </div>
        )}

        {summary.next_steps && summary.next_steps.length > 0 && (
          <div className="group/steps relative z-10 border-t border-border/65 pt-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                Intervenções sugeridas
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover/steps:opacity-100"
                onClick={() => {
                  setEditType("next_steps");
                  setEditedSteps([...summary.next_steps]);
                  setIsEditing(true);
                }}
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {summary.next_steps.map((step) => (
                <div
                  key={step}
                  className="group/item flex select-text items-start gap-4 rounded-3xl border border-zinc-100 bg-zinc-50 p-5 transition-all hover:border-zinc-200 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-[#141414] dark:hover:border-zinc-700 dark:hover:bg-[#181818]"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600 group-hover/item:bg-emerald-400 transition-colors mt-2 shrink-0" />
                  <span className="text-sm text-zinc-600 dark:text-zinc-300 font-light leading-relaxed">{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="desktop-retina-modal overflow-hidden rounded-[30px] border-border/60 p-0 sm:max-w-[600px]">
          <DialogHeader className="p-6 border-b border-border/10 bg-secondary/20">
            <DialogTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              {editType === "summary" ? <Sparkles className="h-4 w-4 text-primary" /> : <ListTodo className="h-4 w-4 text-primary" />}
              {editType === "summary" ? "Editar Resumo Clínico" : editType === "topics" ? "Editar Tópicos Chave" : "Editar Condutas Sugeridas"}
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 space-y-4">
            {editType === "summary" ? (
              <Textarea
                value={editedSummary}
                onChange={(e) => setEditedSummary(e.target.value)}
                className="min-h-[250px] bg-secondary/20 border-border/10 rounded-xl focus:ring-primary/20 text-sm leading-relaxed"
                placeholder="Edite o resumo da IA aqui..."
              />
            ) : (
              <div className="space-y-3">
                {editedSteps.map((step, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Textarea
                      value={step}
                      onChange={(e) => {
                        const newSteps = [...editedSteps];
                        newSteps[idx] = e.target.value;
                        setEditedSteps(newSteps);
                      }}
                      className="min-h-[80px] bg-secondary/20 border-border/10 rounded-xl text-xs py-2 h-auto"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditedSteps(editedSteps.filter((_, i) => i !== idx))}
                      className="text-rose-500 hover:bg-rose-500/10 shrink-0 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={() => setEditedSteps([...editedSteps, ""])}
                  className="w-full border-dashed border-border/20 bg-transparent hover:bg-secondary/10 text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 mr-2" /> {editType === "topics" ? "Adicionar Tópico" : "Adicionar Conduta"}
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 border-t border-border/10 bg-secondary/10 flex sm:justify-between items-center">
            <span className="text-[10px] text-muted-foreground italic ml-2">As alterações afetam apenas o prontuário deste paciente.</span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setIsEditing(false)} className="rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer">Cancelar</Button>
              <Button
                onClick={handleUpdate}
                disabled={isUpdating}
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-6 text-xs font-bold uppercase tracking-wider min-w-[120px] cursor-pointer"
              >
                {isUpdating ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Check className="h-3 w-3 mr-2" />}
                Salvar Alterações
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
