import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckSquare, FileText, FolderOpen, GitBranch, LayoutList, Plus, Search, Sparkles, StickyNote, Workflow, X } from "lucide-react";
import { mockFiles, mockNotes, mockTasks, type Note } from "../../mock/notes";

type View = "notes" | "tasks" | "neuroview" | "neuroflow" | "neuropulse" | "files" | "notion";

const modules: Array<{ id: View; label: string; icon: typeof StickyNote }> = [
  { id: "notes", label: "Notas", icon: StickyNote },
  { id: "tasks", label: "Tarefas", icon: CheckSquare },
  { id: "neuroview", label: "NeuroView", icon: GitBranch },
  { id: "neuroflow", label: "NeuroFlow", icon: Workflow },
  { id: "neuropulse", label: "NeuroPulse", icon: Sparkles },
  { id: "files", label: "Arquivos", icon: FolderOpen },
  { id: "notion", label: "Notion", icon: LayoutList },
];

function ModulePlaceholder({ view }: { view: View }) {
  const config = modules.find((item) => item.id === view)!;
  const Icon = config.icon;
  const descriptions: Record<View, string> = {
    notes: "Seu espaço de notas clínicas.",
    tasks: "Quadro de tarefas e lembretes.",
    neuroview: "Estrutura visual reservada para o NeuroView.",
    neuroflow: "Canvas de fluxos reservado para o NeuroFlow.",
    neuropulse: "Diagramas e lentes clínicas reservados para o NeuroPulse.",
    files: "Gerenciador de arquivos e documentos.",
    notion: "Páginas e documentos integrados.",
  };
  return <div className="notes-module-placeholder">
    <div className="notes-module-icon"><Icon size={22} /></div>
    <h2>{config.label}</h2>
    <p>{descriptions[view]}</p>
    {(view === "neuroview" || view === "neuroflow" || view === "neuropulse") && <span>Estrutura importada nesta rodada; implementação visual profunda será trazida em etapas.</span>}
  </div>;
}

function NoteEditor({ note, onClose }: { note: Note; onClose: () => void }) {
  return <div className="notes-editor">
    <div className="notes-editor-head"><div><span>NOTA</span><h2>{note.title}</h2></div><button className="notes-icon-btn" onClick={onClose}><X size={16}/></button></div>
    <div className="notes-editor-body"><p>{note.preview}</p><p>Este conteúdo é um mock local no laboratório. A integração com persistência real será feita somente depois da validação da interface.</p></div>
  </div>;
}

export default function Notes() {
  const [view, setView] = useState<View>("notes");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Note | null>(mockNotes[0]);
  const [tasks, setTasks] = useState(mockTasks);

  const filtered = useMemo(() => mockNotes.filter((note) => `${note.title} ${note.preview} ${note.tag}`.toLowerCase().includes(query.toLowerCase())), [query]);

  return <section className="notes-page">
    <div className="notes-shell">
      <aside className="notes-sidebar">
        <div className="notes-sidebar-head"><div><span>NEURONEX</span><strong>Workspace</strong></div><button className="notes-icon-btn"><Plus size={16}/></button></div>
        <div className="notes-module-list">{modules.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? "selected" : ""} onClick={() => setView(id)}><Icon size={15}/><span>{label}</span></button>)}</div>
        <div className="notes-sidebar-footer"><Sparkles size={14}/><span>Synapse pode navegar por este workspace.</span></div>
      </aside>

      <AnimatePresence mode="wait">
        {view === "notes" ? <motion.div key="notes" className="notes-main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="notes-list-panel">
            <div className="notes-list-head"><div><span>NOTAS</span><h1>Minhas notas</h1></div><button className="primary-btn"><Plus size={14}/> Nova nota</button></div>
            <div className="notes-search"><Search size={14}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar notas..." /></div>
            <div className="notes-list">{filtered.map((note) => <button key={note.id} className={`note-row ${selected?.id === note.id ? "selected" : ""}`} onClick={() => setSelected(note)}><div className="note-row-top"><strong>{note.title}</strong><span>{note.updatedAt}</span></div><p>{note.preview}</p><small>{note.tag}</small></button>)}{filtered.length === 0 && <div className="notes-empty">Nenhuma nota encontrada.</div>}</div>
          </div>
          {selected && <NoteEditor note={selected} onClose={() => setSelected(null)} />}
        </motion.div> : view === "tasks" ? <motion.div key="tasks" className="notes-content-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="notes-panel-title"><div><span>TAREFAS</span><h1>Quadro de tarefas</h1></div><button className="primary-btn"><Plus size={14}/> Nova tarefa</button></div>
          <div className="task-board"><div className="task-column"><span>A FAZER</span>{tasks.filter((task) => !task.done).map((task) => <button key={task.id} className="task-card" onClick={() => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, done: true } : item))}><CheckSquare size={14}/>{task.title}</button>)}</div><div className="task-column"><span>CONCLUÍDAS</span>{tasks.filter((task) => task.done).map((task) => <button key={task.id} className="task-card done" onClick={() => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, done: false } : item))}><CheckSquare size={14}/>{task.title}</button>)}</div></div>
        </motion.div> : view === "files" ? <motion.div key="files" className="notes-content-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="notes-panel-title"><div><span>ARQUIVOS</span><h1>Documentos</h1></div><button className="primary-btn"><Plus size={14}/> Enviar arquivo</button></div><div className="file-grid">{mockFiles.map((file) => <div className="file-card" key={file.id}><FileText size={20}/><strong>{file.name}</strong><span>{file.type} · {file.size}</span></div>)}</div>
        </motion.div> : <motion.div key={view} className="notes-content-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><ModulePlaceholder view={view}/></motion.div>}
      </AnimatePresence>
    </div>
  </section>;
}
