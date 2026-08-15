export type Note = {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
  tag: string;
};

export const mockNotes: Note[] = [
  { id: "note-01", title: "Sessão — acompanhamento", preview: "Observações clínicas e pontos para a próxima sessão...", updatedAt: "Hoje, 10:42", tag: "Clínico" },
  { id: "note-02", title: "Hipóteses e padrões", preview: "Relações observadas entre eventos, sintomas e contexto...", updatedAt: "Ontem, 18:20", tag: "Reflexão" },
  { id: "note-03", title: "Plano de acompanhamento", preview: "Próximos passos e tarefas definidas para o caso...", updatedAt: "12 ago", tag: "Plano" },
  { id: "note-04", title: "Ideias de intervenção", preview: "Rascunho de possibilidades para explorar em sessão...", updatedAt: "10 ago", tag: "Rascunho" },
];

export const mockTasks = [
  { id: "task-01", title: "Revisar anotações da sessão", done: false },
  { id: "task-02", title: "Preparar material para próxima sessão", done: false },
  { id: "task-03", title: "Atualizar plano terapêutico", done: true },
];

export const mockFiles = [
  { id: "file-01", name: "anamnese-inicial.pdf", type: "PDF", size: "2,4 MB" },
  { id: "file-02", name: "plano-terapeutico.docx", type: "DOCX", size: "184 KB" },
  { id: "file-03", name: "mapa-clinico.png", type: "PNG", size: "1,1 MB" },
];
