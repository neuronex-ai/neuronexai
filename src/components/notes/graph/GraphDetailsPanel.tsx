import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft, X, FileText, Edit2, Save, Trash2, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PersonalNote, Patient } from "@/types";
import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { htmlToPlainText, plainTextToNoteHtml, noteExcerpt } from "@/lib/note-content";
import type { EvidenceNode } from "../clinical-evidence/evidence-types";
import { getEvidenceSourceLabel } from "../clinical-evidence/evidence-model";
import { EvidenceExplanationDialog, EvidenceScoreCards } from "../clinical-evidence/EvidenceExplanation";

interface GraphDetailsPanelProps {
  selectedNote: PersonalNote | null;
  selectedPatient: Patient | null;
  selectedEvidence?: EvidenceNode | null;
  onCloseNote: () => void;
  onClosePatient: () => void;
  onCloseEvidence?: () => void;
  onDeleteNote: (id: string) => void;
  onUpdateNote: (id: string, updates: Partial<PersonalNote>) => void;
  onSelectNote: (note: PersonalNote) => void;
  patientNotes: PersonalNote[];
  patients?: Patient[];
}

const panelVariants = {
  hidden: { opacity: 0, x: 50, scale: 0.95 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 }
  },
  exit: {
    opacity: 0,
    x: 50,
    scale: 0.95,
    transition: { duration: 0.2 }
  }
};

export const GraphDetailsPanel = ({
  selectedNote,
  selectedPatient,
  selectedEvidence = null,
  onCloseNote,
  onClosePatient,
  onCloseEvidence,
  onDeleteNote,
  onUpdateNote,
  onSelectNote,
  patientNotes,
  patients
}: GraphDetailsPanelProps) => {

  // --- Note Editing State ---
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  useEffect(() => {
    if (selectedNote) {
      setEditTitle(selectedNote.title);
      setEditContent(htmlToPlainText(selectedNote.content));
      setIsEditing(false);
    }
  }, [selectedNote]);

  const handleSave = () => {
    if (selectedNote) {
      onUpdateNote(selectedNote.id, { title: editTitle, content: plainTextToNoteHtml(editContent) });
      setIsEditing(false);
    }
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {selectedEvidence && (
          <motion.div
            key="evidence-panel"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute bottom-5 right-5 top-20 z-[70] flex w-[390px] flex-col pointer-events-none"
          >
            <div className="pointer-events-auto flex flex-1 flex-col overflow-hidden rounded-[24px] border border-border/10 bg-card/90 shadow-2xl ring-1 ring-border/5 backdrop-blur-2xl dark:border-white/10 dark:bg-[#0A0A0B]/90 dark:ring-white/5">
              <div className="flex items-start justify-between gap-4 border-b border-border/10 px-6 py-5 dark:border-white/5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground"><Sparkles className="h-3.5 w-3.5" /> Por que está aqui?</div>
                  <h3 className="mt-2 truncate text-sm font-bold">{selectedEvidence.title}</h3>
                  <p className="mt-1 text-[10px] text-muted-foreground">{getEvidenceSourceLabel(selectedEvidence.sourceType)} · {selectedEvidence.theme}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={onCloseEvidence} aria-label="Fechar explicação da evidência" className="h-8 w-8 rounded-lg"><X className="h-4 w-4" /></Button>
              </div>
              <div className="flex-1 space-y-5 overflow-y-auto p-6">
                {!selectedEvidence.reviewed ? (
                  <p className="rounded-2xl border border-violet-500/15 bg-violet-500/5 p-3 text-xs leading-relaxed">Aguardando revisão; esta evidência ainda não altera a gravidade.</p>
                ) : null}
                <EvidenceScoreCards evidence={selectedEvidence} />
                <p className="text-[11px] leading-relaxed text-muted-foreground">Perto = atenção · maior = densidade · pulso = tensão. Risco registrado permanece separado.</p>
                <EvidenceExplanationDialog evidence={selectedEvidence} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLOATING GLASS PANEL - Note Detail */}
      <AnimatePresence mode="wait">
        {selectedNote && (
          <motion.div
            key="note-panel"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute top-20 right-5 bottom-5 z-[70] w-[400px] flex flex-col pointer-events-none"
          >
            <div className="flex-1 flex flex-col bg-card/90 dark:bg-[#0A0A0B]/90 backdrop-blur-2xl border border-border/10 dark:border-white/10 rounded-[24px] shadow-2xl overflow-hidden pointer-events-auto ring-1 ring-border/5 dark:ring-white/5">

              {/* Header */}
              <div className="flex-shrink-0 px-6 py-5 border-b border-border/10 dark:border-white/5 flex items-center justify-between bg-secondary/10 dark:bg-white/[0.02]">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-background/50 dark:bg-white/5 border border-border/10 dark:border-white/5 text-muted-foreground dark:text-white/70">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="h-8 bg-background dark:bg-black/40 border-border/10 dark:border-white/10 text-sm font-bold text-foreground dark:text-white px-2 rounded-lg"
                      />
                    ) : (
                      <h3 className="text-sm font-bold text-foreground dark:text-white truncate">{selectedNote.title}</h3>
                    )}
                    <p className="text-[10px] text-muted-foreground dark:text-zinc-500 font-mono mt-0.5">
                      {selectedNote.reference_date ? format(new Date(selectedNote.reference_date), "dd MMM yyyy", { locale: ptBR }) : 'Sem data'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-1">
                  {!isEditing ? (
                    <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} className="h-8 w-8 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground dark:hover:bg-white/10 dark:text-zinc-400 dark:hover:text-white transition-colors">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon" onClick={handleSave} className="h-8 w-8 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                      <Save className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={onCloseNote} className="h-8 w-8 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground dark:hover:bg-white/10 dark:text-zinc-400 dark:hover:text-white transition-colors">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-background/50 dark:bg-[#0F0F11]/50">
                {isEditing ? (
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-full min-h-[300px] bg-transparent border-none focus:ring-0 text-sm leading-relaxed text-foreground dark:text-zinc-300 resize-none p-0"
                    placeholder="Escreva sua nota..."
                  />
                ) : (
                  <div
                    className="prose prose-sm prose-gray dark:prose-invert max-w-none text-foreground/80 dark:text-zinc-300 leading-relaxed font-light"
                    dangerouslySetInnerHTML={{ __html: selectedNote.content || '<p class="text-zinc-500 italic">Nota vazia.</p>' }}
                  />
                )}
              </div>

              {/* Footer */}
              <div className="flex-shrink-0 p-4 border-t border-border/10 dark:border-white/5 bg-secondary/5 dark:bg-[#0A0A0B] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {selectedNote.patient_id && patients?.find(p => p.id === selectedNote.patient_id) && (
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-secondary/50 dark:bg-white/5 border border-border/10 dark:border-white/10 text-muted-foreground dark:text-zinc-400 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {patients.find(p => p.id === selectedNote.patient_id)?.name}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 dark:text-rose-400 dark:hover:text-rose-300 rounded-lg gap-2"
                  onClick={() => onDeleteNote(selectedNote.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLOATING GLASS PANEL - Patient Detail */}
      <AnimatePresence mode="wait">
        {selectedPatient && (
          <motion.div
            key="patient-panel"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute top-20 right-5 bottom-5 z-[70] w-[380px] flex flex-col pointer-events-none"
          >
            <div className="flex-1 flex flex-col bg-card/90 dark:bg-[#0A0A0B]/90 backdrop-blur-2xl border border-border/10 dark:border-white/10 rounded-[24px] shadow-2xl overflow-hidden pointer-events-auto ring-1 ring-border/5 dark:ring-white/5">
              <div className="p-6 border-b border-border/10 dark:border-white/5 flex items-center gap-4 bg-secondary/10 dark:bg-white/[0.02]">
                <Button variant="ghost" size="icon" onClick={onClosePatient} className="h-8 w-8 rounded-full bg-background/50 hover:bg-secondary dark:bg-white/5 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground dark:text-white/60 dark:hover:text-white">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h3 className="text-base font-bold text-foreground dark:text-white tracking-tight">{selectedPatient.name}</h3>
                  <p className="text-[10px] text-muted-foreground dark:text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Notas Vinculadas</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2.5 bg-background/50 dark:bg-[#0F0F11]/50">
                {patientNotes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                    <FileText className="h-8 w-8 mb-2 opacity-20" />
                    <p className="text-xs font-medium">Nenhuma nota vinculada.</p>
                  </div>
                ) : (
                  patientNotes.map(note => (
                    <motion.div
                      key={note.id}
                      onClick={() => onSelectNote(note)}
                      whileHover={{ scale: 1.02, backgroundColor: "rgba(120,120,120,0.1)" }}
                      whileTap={{ scale: 0.98 }}
                      className="p-4 rounded-2xl bg-card border border-border/10 dark:bg-white/[0.03] dark:border-white/5 cursor-pointer group transition-colors shadow-sm"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="text-sm font-bold text-foreground dark:text-zinc-200 group-hover:text-primary dark:group-hover:text-white transition-colors line-clamp-1">{note.title}</h4>
                        <ArrowLeft className="h-3 w-3 text-muted-foreground dark:text-zinc-600 rotate-180 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs text-muted-foreground dark:text-zinc-500 line-clamp-2 leading-relaxed">{noteExcerpt(note.content)}</p>
                      <p className="text-[9px] text-muted-foreground/60 dark:text-zinc-600 mt-2 font-mono">
                        {format(new Date(note.created_at), "dd MMM yyyy", { locale: ptBR })}
                      </p>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
