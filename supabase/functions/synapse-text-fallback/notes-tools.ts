// @ts-nocheck
import type { AgentToolContext, AgentToolResult, PendingAction } from "./executor.ts";
import { formatPatientAmbiguity, resolvePatientByName as resolvePatientNameReference } from "./patient-resolver.ts";

export const NOTES_READ_TOOLS = new Set([
  "get_notes_desktop_overview",
  "search_personal_notes",
  "get_personal_note_details",
  "list_recent_notes",
  "list_notes_by_module",
  "list_uncategorized_notes",
  "summarize_note",
  "extract_tasks_from_note",
  "list_note_modules",
  "get_note_module_overview",
  "get_tasks_overview",
  "list_tasks",
  "list_today_tasks",
  "list_overdue_tasks",
  "search_tasks",
  "get_task_details",
  "get_files_overview",
  "search_personal_files",
  "search_patient_files",
  "list_recent_files",
  "get_file_details",
  "list_files_by_patient",
  "get_notion_connection_status",
]);

export const NOTES_MUTATION_TOOLS = new Set([
  "create_personal_note",
  "update_personal_note",
  "append_to_personal_note",
  "rename_personal_note",
  "move_note_to_module",
  "tag_personal_note",
  "delete_personal_note",
  "create_note_module",
  "rename_note_module",
  "delete_note_module",
  "create_task",
  "update_task",
  "complete_task",
  "reopen_task",
  "move_task_category",
  "delete_task",
  "link_file_to_patient",
  "unlink_file_from_patient",
  "delete_file",
]);

const cleanText = (value: unknown, max = 5000) => String(value ?? "").trim().slice(0, max);
const cleanId = (value: unknown) => {
  const id = cleanText(value, 100);
  if (!/^[a-zA-Z0-9_-]{6,100}$/.test(id)) throw new Error("Identificador inválido.");
  return id;
};
const normalizeText = (value: unknown) => cleanText(value, 300).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const escapeLike = (value: string) => value.replace(/[%_]/g, "");
const dateOnly = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};
const localDateTime = (iso: string) => new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "short",
}).format(new Date(iso));
const stripHtml = (value = "") => value
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/\s+/g, " ")
  .trim();
const safeTags = (value: unknown) => {
  if (Array.isArray(value)) return value.map((tag) => cleanText(tag, 50)).filter(Boolean).slice(0, 20);
  const raw = cleanText(value, 300);
  if (!raw) return [];
  return raw.split(",").map((tag) => cleanText(tag, 50)).filter(Boolean).slice(0, 20);
};

function mapNote(row: any) {
  return {
    id: row.id,
    title: row.title || "Nota sem título",
    content: row.content || "",
    excerpt: stripHtml(row.content || "").slice(0, 500),
    tags: row.tags || [],
    module_id: row.module_id || null,
    module_name: row.module?.name || null,
    patient_id: row.patient_id || null,
    patient_name: row.patient?.name || null,
    reference_date: row.reference_date || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapModule(row: any, notes: any[] = []) {
  return {
    id: row.id,
    name: row.name,
    created_at: row.created_at,
    notes_count: notes.filter((note) => note.module_id === row.id).length,
  };
}

function mapTask(row: any) {
  return {
    id: row.id,
    note_id: row.note_id || null,
    title: row.title,
    due_date: row.due_date,
    due_date_local: row.due_date ? localDateTime(row.due_date) : null,
    category: row.category || "Geral",
    is_completed: Boolean(row.is_completed),
    created_at: row.created_at,
  };
}

function mapFile(row: any) {
  return {
    id: row.id,
    name: row.original_name || row.name || "Arquivo sem nome",
    patient_id: row.patient_id || null,
    patient_name: row.patient?.name || null,
    category: row.category || null,
    mime_type: row.mime_type || null,
    size_bytes: Number(row.size_bytes || 0),
    status: row.status || null,
    created_at: row.created_at,
    uploaded_at: row.uploaded_at || row.created_at,
    metadata: row.metadata || {},
  };
}

async function listNotes(admin: any, userId: string, limit = 500) {
  const { data, error } = await admin
    .from("personal_notes")
    .select("id,user_id,module_id,patient_id,title,content,tags,reference_date,created_at,updated_at,patient:patient_id(name),module:module_id(name)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(mapNote);
}

async function listModules(admin: any, userId: string) {
  const { data, error } = await admin
    .from("note_modules")
    .select("id,name,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function listTasks(admin: any, userId: string, limit = 500) {
  const { data, error } = await admin
    .from("reminders")
    .select("id,user_id,note_id,title,due_date,category,is_completed,created_at")
    .eq("user_id", userId)
    .order("due_date", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(mapTask);
}

async function listFiles(admin: any, userId: string, args: Record<string, any> = {}) {
  let query = admin
    .from("document_files")
    .select("id,user_id,patient_id,category,original_name,mime_type,size_bytes,status,created_at,uploaded_at,metadata,patient:patient_id(name)")
    .eq("user_id", userId)
    .eq("status", "ready")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(Math.min(500, Math.max(1, Number(args.limit || 100))));
  if (args.patient_id) query = query.eq("patient_id", cleanId(args.patient_id));
  if (args.patient_scope === "personal") query = query.is("patient_id", null);
  if (args.patient_scope === "patients") query = query.not("patient_id", "is", null);
  if (args.category) query = query.eq("category", cleanText(args.category, 80));
  const { data, error } = await query;
  if (error) throw error;
  const files = (data || []).map(mapFile).filter((file: any) => {
    const source = String(file.metadata?.source || "");
    return source !== "ai_chat" && source !== "external_invoice";
  });
  const term = normalizeText(args.query || "");
  return term ? files.filter((file: any) => normalizeText(file.name).includes(term) || normalizeText(file.patient_name).includes(term)) : files;
}

async function resolvePatientByName(admin: any, userId: string, name: string) {
  const term = cleanText(name, 160);
  if (!term) return null;
  const resolution = await resolvePatientNameReference(admin, userId, term);
  if (resolution.status === "not_found") throw new Error(`Não encontrei paciente compatível com “${term}”.`);
  if (resolution.status === "ambiguous") throw new Error(formatPatientAmbiguity(resolution.candidates));
  return resolution.patient;
}

async function resolveModule(admin: any, userId: string, args: Record<string, any>) {
  if (args.module_id) {
    const { data, error } = await admin.from("note_modules").select("id,name,created_at").eq("id", cleanId(args.module_id)).eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Módulo não encontrado.");
    return data;
  }
  const name = cleanText(args.module_name || args.name || "", 120);
  if (!name) return null;
  const { data, error } = await admin.from("note_modules").select("id,name,created_at").eq("user_id", userId).ilike("name", `%${escapeLike(name)}%`).order("created_at").limit(12);
  if (error) throw error;
  const matches = data || [];
  if (!matches.length) throw new Error(`Não encontrei módulo chamado “${name}”.`);
  const exact = matches.filter((item: any) => normalizeText(item.name) === normalizeText(name));
  const candidates = exact.length === 1 ? exact : matches;
  if (candidates.length !== 1) throw new Error(`Encontrei mais de um módulo compatível: ${candidates.map((item: any) => item.name).join(", ")}.`);
  return candidates[0];
}

async function resolveNote(admin: any, userId: string, args: Record<string, any>) {
  if (args.note_id) {
    const { data, error } = await admin
      .from("personal_notes")
      .select("id,user_id,module_id,patient_id,title,content,tags,reference_date,created_at,updated_at,patient:patient_id(name),module:module_id(name)")
      .eq("id", cleanId(args.note_id))
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Nota não encontrada.");
    return mapNote(data);
  }
  const title = cleanText(args.note_title || args.title || "", 160);
  if (!title) throw new Error("Informe o título da nota para eu localizar.");
  const notes = await listNotes(admin, userId, 300);
  const matches = notes.filter((note) => normalizeText(note.title).includes(normalizeText(title)));
  if (!matches.length) throw new Error(`Não encontrei nota com o título “${title}”.`);
  const exact = matches.filter((note) => normalizeText(note.title) === normalizeText(title));
  const candidates = exact.length === 1 ? exact : matches;
  if (candidates.length !== 1) throw new Error(`Encontrei mais de uma nota compatível: ${candidates.slice(0, 5).map((note) => note.title).join(", ")}.`);
  return candidates[0];
}

async function resolveTask(admin: any, userId: string, args: Record<string, any>) {
  if (args.task_id) {
    const { data, error } = await admin.from("reminders").select("id,user_id,note_id,title,due_date,category,is_completed,created_at").eq("id", cleanId(args.task_id)).eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Tarefa não encontrada.");
    return mapTask(data);
  }
  const title = cleanText(args.task_title || args.title || "", 160);
  if (!title) throw new Error("Informe o título da tarefa para eu localizar.");
  const tasks = await listTasks(admin, userId, 300);
  const matches = tasks.filter((task) => normalizeText(task.title).includes(normalizeText(title)));
  if (!matches.length) throw new Error(`Não encontrei tarefa com o título “${title}”.`);
  if (matches.length !== 1) throw new Error(`Encontrei mais de uma tarefa compatível: ${matches.slice(0, 5).map((task) => task.title).join(", ")}.`);
  return matches[0];
}

async function resolveFile(admin: any, userId: string, args: Record<string, any>) {
  if (args.file_id) {
    const { data, error } = await admin
      .from("document_files")
      .select("id,user_id,patient_id,category,original_name,mime_type,size_bytes,status,created_at,uploaded_at,metadata,patient:patient_id(name)")
      .eq("id", cleanId(args.file_id))
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Arquivo não encontrado.");
    return mapFile(data);
  }
  const files = await listFiles(admin, userId, { query: args.file_name || args.query || args.name || "", limit: 80 });
  if (!files.length) throw new Error("Arquivo não encontrado.");
  if (files.length !== 1) throw new Error(`Encontrei mais de um arquivo compatível: ${files.slice(0, 5).map((file: any) => file.name).join(", ")}.`);
  return files[0];
}

function extractSuggestedTasks(note: any) {
  const text = stripHtml(note.content || "");
  const lines = text.split(/\n|\r|•|;/).map((line) => line.trim()).filter(Boolean);
  const suggestions = lines
    .filter((line) => /^(todo|tarefa|ação|acao|pendência|pendencia|lembrar|revisar|enviar|ligar|marcar|agendar|cobrar|fazer|criar|corrigir|validar)\b/i.test(line) || /^[-*]\s*\[[ x]?\]/i.test(line))
    .map((line) => line.replace(/^[-*]\s*\[[ x]?\]\s*/i, "").replace(/^(todo|tarefa|ação|acao|pendência|pendencia):?\s*/i, ""))
    .filter(Boolean)
    .slice(0, 12);
  return suggestions.length ? suggestions : lines.filter((line) => line.length <= 140).slice(0, 6);
}

export function summarizeNotesMutation(name: string, args: Record<string, any>) {
  switch (name) {
    case "create_personal_note": return `Criar a nota “${cleanText(args.title || "Nova nota", 120)}”.`;
    case "update_personal_note": return `Atualizar a nota ${cleanText(args.note_title || args.title || "selecionada", 120)}.`;
    case "append_to_personal_note": return `Adicionar conteúdo ao final da nota ${cleanText(args.note_title || "selecionada", 120)}.`;
    case "rename_personal_note": return `Renomear a nota para “${cleanText(args.new_title, 140)}”.`;
    case "move_note_to_module": return `Mover a nota ${cleanText(args.note_title || "selecionada", 120)} para o módulo ${cleanText(args.module_name || "informado", 120)}.`;
    case "tag_personal_note": return `Atualizar tags da nota ${cleanText(args.note_title || "selecionada", 120)}.`;
    case "delete_personal_note": return `Excluir permanentemente a nota ${cleanText(args.note_title || "selecionada", 120)}.`;
    case "create_note_module": return `Criar o módulo de notas “${cleanText(args.name || args.module_name, 120)}”.`;
    case "rename_note_module": return `Renomear o módulo para “${cleanText(args.new_name, 120)}”.`;
    case "delete_note_module": return `Excluir o módulo ${cleanText(args.module_name || "selecionado", 120)} e deixar suas notas sem módulo.`;
    case "create_task": return `Criar a tarefa “${cleanText(args.title, 160)}”.`;
    case "update_task": return `Atualizar a tarefa ${cleanText(args.task_title || args.title || "selecionada", 120)}.`;
    case "complete_task": return `Marcar a tarefa ${cleanText(args.task_title || "selecionada", 120)} como concluída.`;
    case "reopen_task": return `Reabrir a tarefa ${cleanText(args.task_title || "selecionada", 120)}.`;
    case "move_task_category": return `Mover a tarefa ${cleanText(args.task_title || "selecionada", 120)} para a categoria ${cleanText(args.category, 80)}.`;
    case "delete_task": return `Excluir a tarefa ${cleanText(args.task_title || "selecionada", 120)}.`;
    case "link_file_to_patient": return `Vincular o arquivo ${cleanText(args.file_name || "selecionado", 120)} ao paciente ${cleanText(args.patient_name || "informado", 120)}.`;
    case "unlink_file_from_patient": return `Remover vínculo de paciente do arquivo ${cleanText(args.file_name || "selecionado", 120)}.`;
    case "delete_file": return `Excluir o arquivo ${cleanText(args.file_name || "selecionado", 120)}.`;
    default: return "Executar alteração na aba Notas Desktop.";
  }
}

export async function executeNotesTool(name: string, args: Record<string, any>, context: AgentToolContext): Promise<AgentToolResult> {
  const { admin, userId } = context;
  try {
    switch (name) {
      case "get_notes_desktop_overview": {
        const [notes, modulesRaw, tasks, personalFiles, patientFiles, notionToken] = await Promise.all([
          listNotes(admin, userId, 500),
          listModules(admin, userId),
          listTasks(admin, userId, 500),
          listFiles(admin, userId, { patient_scope: "personal", limit: 80 }),
          listFiles(admin, userId, { patient_scope: "patients", limit: 80 }),
          admin.from("user_notion_tokens").select("user_id,workspace_id").eq("user_id", userId).maybeSingle(),
        ]);
        const modules = modulesRaw.map((module: any) => mapModule(module, notes));
        const today = dateOnly(new Date());
        const overview = {
          notes_count: notes.length,
          modules_count: modules.length,
          uncategorized_notes_count: notes.filter((note) => !note.module_id).length,
          recent_notes: notes.slice(0, 8),
          modules,
          tasks_count: tasks.length,
          open_tasks_count: tasks.filter((task) => !task.is_completed).length,
          overdue_tasks_count: tasks.filter((task) => !task.is_completed && String(task.due_date || "").slice(0, 10) < today).length,
          personal_files_count: personalFiles.length,
          patient_files_count: patientFiles.length,
          recent_files: [...personalFiles, ...patientFiles].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8),
          notion_connected: Boolean(notionToken.data?.user_id),
          excluded_from_this_release: ["google_drive_import"],
        };
        return { ok: true, grounded: true, recordCount: notes.length + tasks.length + personalFiles.length + patientFiles.length, data: overview, structuredData: { type: "notes_desktop_overview", data: overview } };
      }
      case "search_personal_notes": {
        const term = normalizeText(args.query || "");
        const module = args.module_id || args.module_name ? await resolveModule(admin, userId, args).catch(() => null) : null;
        const notes = (await listNotes(admin, userId, 500)).filter((note) => {
          const matchesTerm = !term || normalizeText(note.title).includes(term) || normalizeText(stripHtml(note.content)).includes(term) || (note.tags || []).some((tag: string) => normalizeText(tag).includes(term));
          const matchesModule = module ? note.module_id === module.id : true;
          return matchesTerm && matchesModule;
        }).slice(0, Math.min(80, Math.max(1, Number(args.limit || 20))));
        return { ok: true, grounded: true, recordCount: notes.length, data: { query: args.query || null, notes }, structuredData: notes.length === 1 ? { type: "personal_note", data: notes[0] } : { type: "personal_notes", data: { notes } } };
      }
      case "get_personal_note_details": {
        const note = await resolveNote(admin, userId, args);
        return { ok: true, grounded: true, recordCount: 1, data: { note }, structuredData: { type: "personal_note", data: note } };
      }
      case "list_recent_notes": {
        const notes = (await listNotes(admin, userId, Math.min(80, Math.max(1, Number(args.limit || 12)))));
        return { ok: true, grounded: true, recordCount: notes.length, data: { notes }, structuredData: { type: "personal_notes", data: { notes } } };
      }
      case "list_notes_by_module":
      case "get_note_module_overview": {
        const module = await resolveModule(admin, userId, args);
        if (!module) throw new Error("Informe o módulo para consultar.");
        const notes = (await listNotes(admin, userId, 500)).filter((note) => note.module_id === module.id);
        const data = { module: mapModule(module, notes), notes: notes.slice(0, Math.min(80, Math.max(1, Number(args.limit || 30)))) };
        return { ok: true, grounded: true, recordCount: notes.length, data, structuredData: { type: "note_module_overview", data } };
      }
      case "list_uncategorized_notes": {
        const notes = (await listNotes(admin, userId, 500)).filter((note) => !note.module_id).slice(0, Math.min(80, Math.max(1, Number(args.limit || 30))));
        return { ok: true, grounded: true, recordCount: notes.length, data: { notes }, structuredData: { type: "personal_notes", data: { notes } } };
      }
      case "summarize_note": {
        const note = await resolveNote(admin, userId, args);
        const text = stripHtml(note.content || "");
        const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
        const summary = sentences.slice(0, 5).join(" ").slice(0, 1600) || note.excerpt || "Nota sem conteúdo.";
        return { ok: true, grounded: true, recordCount: 1, data: { note: { id: note.id, title: note.title }, summary, tags: note.tags }, structuredData: { type: "note_summary", data: { note, summary } } };
      }
      case "extract_tasks_from_note": {
        const note = await resolveNote(admin, userId, args);
        const suggestions = extractSuggestedTasks(note).map((title) => ({ title, category: args.category || "Geral", note_id: note.id }));
        return { ok: true, grounded: true, recordCount: suggestions.length, data: { note: { id: note.id, title: note.title }, suggestions }, structuredData: { type: "task_suggestions", data: { note, suggestions } } };
      }
      case "list_note_modules": {
        const notes = await listNotes(admin, userId, 500);
        const modules = (await listModules(admin, userId)).map((module: any) => mapModule(module, notes));
        return { ok: true, grounded: true, recordCount: modules.length, data: { modules }, structuredData: { type: "note_modules", data: { modules } } };
      }
      case "get_tasks_overview": {
        const tasks = await listTasks(admin, userId, 500);
        const today = dateOnly(new Date());
        const weekEnd = dateOnly(addDays(new Date(), 7));
        const data = {
          total: tasks.length,
          open_count: tasks.filter((task) => !task.is_completed).length,
          completed_count: tasks.filter((task) => task.is_completed).length,
          overdue: tasks.filter((task) => !task.is_completed && String(task.due_date || "").slice(0, 10) < today),
          today: tasks.filter((task) => String(task.due_date || "").slice(0, 10) === today),
          next_7_days: tasks.filter((task) => !task.is_completed && String(task.due_date || "").slice(0, 10) >= today && String(task.due_date || "").slice(0, 10) <= weekEnd),
          by_category: tasks.reduce((acc: Record<string, number>, task) => { acc[task.category || "Geral"] = (acc[task.category || "Geral"] || 0) + 1; return acc; }, {}),
        };
        return { ok: true, grounded: true, recordCount: tasks.length, data, structuredData: { type: "tasks_overview", data } };
      }
      case "list_tasks":
      case "search_tasks": {
        const term = normalizeText(args.query || "");
        const category = cleanText(args.category || "", 80);
        const status = cleanText(args.status || "all", 20);
        let tasks = await listTasks(admin, userId, 500);
        if (term) tasks = tasks.filter((task) => normalizeText(task.title).includes(term));
        if (category) tasks = tasks.filter((task) => normalizeText(task.category) === normalizeText(category));
        if (status === "open") tasks = tasks.filter((task) => !task.is_completed);
        if (status === "completed") tasks = tasks.filter((task) => task.is_completed);
        tasks = tasks.slice(0, Math.min(80, Math.max(1, Number(args.limit || 30))));
        return { ok: true, grounded: true, recordCount: tasks.length, data: { tasks }, structuredData: { type: "tasks", data: { tasks } } };
      }
      case "list_today_tasks": {
        const today = dateOnly(new Date());
        const tasks = (await listTasks(admin, userId, 500)).filter((task) => String(task.due_date || "").slice(0, 10) === today);
        return { ok: true, grounded: true, recordCount: tasks.length, data: { date: today, tasks }, structuredData: { type: "tasks", data: { tasks } } };
      }
      case "list_overdue_tasks": {
        const today = dateOnly(new Date());
        const tasks = (await listTasks(admin, userId, 500)).filter((task) => !task.is_completed && String(task.due_date || "").slice(0, 10) < today);
        return { ok: true, grounded: true, recordCount: tasks.length, data: { tasks }, structuredData: { type: "tasks", data: { tasks } } };
      }
      case "get_task_details": {
        const task = await resolveTask(admin, userId, args);
        return { ok: true, grounded: true, recordCount: 1, data: { task }, structuredData: { type: "task", data: task } };
      }
      case "get_files_overview": {
        const personalFiles = await listFiles(admin, userId, { patient_scope: "personal", limit: 200 });
        const patientFiles = await listFiles(admin, userId, { patient_scope: "patients", limit: 300 });
        const files = [...personalFiles, ...patientFiles];
        const data = {
          total: files.length,
          personal_count: personalFiles.length,
          patient_count: patientFiles.length,
          recent_files: files.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 12),
          by_mime_type: files.reduce((acc: Record<string, number>, file: any) => { const key = file.mime_type || "unknown"; acc[key] = (acc[key] || 0) + 1; return acc; }, {}),
          google_drive_import_available: false,
        };
        return { ok: true, grounded: true, recordCount: files.length, data, structuredData: { type: "files_overview", data } };
      }
      case "search_personal_files": {
        const files = await listFiles(admin, userId, { patient_scope: "personal", query: args.query, limit: args.limit || 50 });
        return { ok: true, grounded: true, recordCount: files.length, data: { files }, structuredData: { type: "files", data: { files } } };
      }
      case "search_patient_files": {
        const patient = args.patient_id ? null : args.patient_name ? await resolvePatientByName(admin, userId, args.patient_name) : null;
        const files = await listFiles(admin, userId, { patient_scope: "patients", patient_id: args.patient_id || patient?.id, query: args.query, limit: args.limit || 50 });
        return { ok: true, grounded: true, recordCount: files.length, data: { patient, files }, structuredData: { type: "files", data: { files } } };
      }
      case "list_recent_files": {
        const files = await listFiles(admin, userId, { limit: args.limit || 20 });
        return { ok: true, grounded: true, recordCount: files.length, data: { files }, structuredData: { type: "files", data: { files } } };
      }
      case "get_file_details": {
        const file = await resolveFile(admin, userId, args);
        return { ok: true, grounded: true, recordCount: 1, data: { file }, structuredData: { type: "file", data: file } };
      }
      case "list_files_by_patient": {
        const patient = args.patient_id ? { id: cleanId(args.patient_id) } : await resolvePatientByName(admin, userId, args.patient_name);
        const files = await listFiles(admin, userId, { patient_id: patient?.id, limit: args.limit || 80 });
        return { ok: true, grounded: true, recordCount: files.length, data: { patient, files }, structuredData: { type: "files", data: { files } } };
      }
      case "get_notion_connection_status": {
        const { data, error } = await admin.from("user_notion_tokens").select("user_id,workspace_id").eq("user_id", userId).maybeSingle();
        if (error) throw error;
        const status = { connected: Boolean(data?.user_id), workspace_id: data?.workspace_id || null, supported_actions: ["open_notion_panel", "view_connection_status"], unsupported_in_this_release: ["google_drive_import", "notion_block_editing_by_synapse"] };
        return { ok: true, grounded: true, recordCount: status.connected ? 1 : 0, data: status, structuredData: { type: "notion_status", data: status } };
      }
      default:
        return { ok: false, grounded: false, error: `Ferramenta de Notas não suportada: ${name}` };
    }
  } catch (error) {
    return { ok: false, grounded: true, error: error instanceof Error ? error.message : "Falha ao consultar a aba Notas Desktop." };
  }
}

export async function executeConfirmedNotesMutation(pending: PendingAction, context: AgentToolContext): Promise<AgentToolResult | null> {
  if (!NOTES_MUTATION_TOOLS.has(pending.toolName)) return null;
  const { admin, userId } = context;
  const args = pending.arguments as Record<string, any>;
  try {
    switch (pending.toolName) {
      case "create_personal_note": {
        const module = args.module_id || args.module_name ? await resolveModule(admin, userId, args).catch(() => null) : null;
        const patient = args.patient_id ? { id: cleanId(args.patient_id) } : args.patient_name ? await resolvePatientByName(admin, userId, args.patient_name) : null;
        const { data, error } = await admin.from("personal_notes").insert({ user_id: userId, title: cleanText(args.title || "Nova nota", 240), content: cleanText(args.content || "", 50000), module_id: module?.id || null, patient_id: patient?.id || null, reference_date: args.reference_date || new Date().toISOString(), tags: safeTags(args.tags) }).select("id,user_id,module_id,patient_id,title,content,tags,reference_date,created_at,updated_at").single();
        if (error) throw error;
        const note = mapNote(data);
        return { ok: true, grounded: true, recordCount: 1, data: { note }, message: `Nota “${note.title}” criada.`, structuredData: { type: "personal_note", data: note } };
      }
      case "update_personal_note": {
        const note = await resolveNote(admin, userId, args);
        const update: Record<string, unknown> = {};
        for (const key of ["title", "content", "reference_date"]) if (args[key] !== undefined) update[key] = key === "content" ? cleanText(args[key], 50000) : cleanText(args[key], 240);
        if (args.tags !== undefined) update.tags = safeTags(args.tags);
        if (args.module_id || args.module_name) update.module_id = (await resolveModule(admin, userId, args))?.id || null;
        if (args.patient_id || args.patient_name) update.patient_id = args.patient_id ? cleanId(args.patient_id) : (await resolvePatientByName(admin, userId, args.patient_name))?.id || null;
        update.updated_at = new Date().toISOString();
        const { data, error } = await admin.from("personal_notes").update(update).eq("id", note.id).eq("user_id", userId).select("id,user_id,module_id,patient_id,title,content,tags,reference_date,created_at,updated_at").single();
        if (error) throw error;
        return { ok: true, grounded: true, recordCount: 1, data: { note: mapNote(data), updated_fields: Object.keys(update) }, message: `Nota “${data.title}” atualizada.`, structuredData: { type: "personal_note", data: mapNote(data) } };
      }
      case "append_to_personal_note": {
        const note = await resolveNote(admin, userId, args);
        const separator = args.separator || "\n\n";
        const nextContent = `${note.content || ""}${separator}${cleanText(args.content || args.text || "", 50000)}`.trim();
        const { data, error } = await admin.from("personal_notes").update({ content: nextContent, updated_at: new Date().toISOString() }).eq("id", note.id).eq("user_id", userId).select("id,user_id,module_id,patient_id,title,content,tags,reference_date,created_at,updated_at").single();
        if (error) throw error;
        return { ok: true, grounded: true, recordCount: 1, data: { note: mapNote(data) }, message: `Conteúdo adicionado à nota “${data.title}”.`, structuredData: { type: "personal_note", data: mapNote(data) } };
      }
      case "rename_personal_note": {
        const note = await resolveNote(admin, userId, args);
        const { data, error } = await admin.from("personal_notes").update({ title: cleanText(args.new_title, 240), updated_at: new Date().toISOString() }).eq("id", note.id).eq("user_id", userId).select("id,user_id,module_id,patient_id,title,content,tags,reference_date,created_at,updated_at").single();
        if (error) throw error;
        return { ok: true, grounded: true, recordCount: 1, data: { note: mapNote(data) }, message: `Nota renomeada para “${data.title}”.`, structuredData: { type: "personal_note", data: mapNote(data) } };
      }
      case "move_note_to_module": {
        const note = await resolveNote(admin, userId, args);
        const module = await resolveModule(admin, userId, args);
        if (!module) throw new Error("Módulo não encontrado.");
        const { data, error } = await admin.from("personal_notes").update({ module_id: module.id, updated_at: new Date().toISOString() }).eq("id", note.id).eq("user_id", userId).select("id,user_id,module_id,patient_id,title,content,tags,reference_date,created_at,updated_at").single();
        if (error) throw error;
        return { ok: true, grounded: true, recordCount: 1, data: { note: mapNote(data), module }, message: `Nota “${data.title}” movida para ${module.name}.`, structuredData: { type: "personal_note", data: mapNote(data) } };
      }
      case "tag_personal_note": {
        const note = await resolveNote(admin, userId, args);
        const current = Array.isArray(note.tags) ? note.tags : [];
        const add = safeTags(args.add_tags || args.tags);
        const remove = safeTags(args.remove_tags);
        const nextTags = Array.from(new Set([...current, ...add])).filter((tag) => !remove.some((removed) => normalizeText(removed) === normalizeText(tag))).slice(0, 20);
        const { data, error } = await admin.from("personal_notes").update({ tags: nextTags, updated_at: new Date().toISOString() }).eq("id", note.id).eq("user_id", userId).select("id,user_id,module_id,patient_id,title,content,tags,reference_date,created_at,updated_at").single();
        if (error) throw error;
        return { ok: true, grounded: true, recordCount: 1, data: { note: mapNote(data) }, message: `Tags da nota “${data.title}” atualizadas.`, structuredData: { type: "personal_note", data: mapNote(data) } };
      }
      case "delete_personal_note": {
        const note = await resolveNote(admin, userId, args);
        const { error } = await admin.from("personal_notes").delete().eq("id", note.id).eq("user_id", userId);
        if (error) throw error;
        return { ok: true, grounded: true, recordCount: 1, data: { deleted_note: { id: note.id, title: note.title } }, message: `Nota “${note.title}” excluída.` };
      }
      case "create_note_module": {
        const name = cleanText(args.name || args.module_name, 120);
        if (!name) throw new Error("Informe o nome do módulo.");
        const { data, error } = await admin.from("note_modules").insert({ user_id: userId, name }).select("id,name,created_at").single();
        if (error) throw error;
        return { ok: true, grounded: true, recordCount: 1, data: { module: data }, message: `Módulo “${data.name}” criado.`, structuredData: { type: "note_module", data } };
      }
      case "rename_note_module": {
        const module = await resolveModule(admin, userId, args);
        if (!module) throw new Error("Módulo não encontrado.");
        const { data, error } = await admin.from("note_modules").update({ name: cleanText(args.new_name, 120) }).eq("id", module.id).eq("user_id", userId).select("id,name,created_at").single();
        if (error) throw error;
        return { ok: true, grounded: true, recordCount: 1, data: { module: data }, message: `Módulo renomeado para “${data.name}”.`, structuredData: { type: "note_module", data } };
      }
      case "delete_note_module": {
        const module = await resolveModule(admin, userId, args);
        if (!module) throw new Error("Módulo não encontrado.");
        await admin.from("personal_notes").update({ module_id: null, updated_at: new Date().toISOString() }).eq("module_id", module.id).eq("user_id", userId);
        const { error } = await admin.from("note_modules").delete().eq("id", module.id).eq("user_id", userId);
        if (error) throw error;
        return { ok: true, grounded: true, recordCount: 1, data: { deleted_module: module }, message: `Módulo “${module.name}” excluído; as notas ficaram sem módulo.` };
      }
      case "create_task": {
        const note = args.note_id || args.note_title ? await resolveNote(admin, userId, args).catch(() => null) : null;
        const dueDate = args.due_date || new Date().toISOString();
        const { data, error } = await admin.from("reminders").insert({ user_id: userId, note_id: note?.id || null, title: cleanText(args.title, 240), due_date: dueDate, category: cleanText(args.category || "Geral", 60), is_completed: false }).select("id,user_id,note_id,title,due_date,category,is_completed,created_at").single();
        if (error) throw error;
        return { ok: true, grounded: true, recordCount: 1, data: { task: mapTask(data) }, message: `Tarefa “${data.title}” criada.`, structuredData: { type: "task", data: mapTask(data) } };
      }
      case "update_task": {
        const task = await resolveTask(admin, userId, args);
        const update: Record<string, unknown> = {};
        for (const key of ["title", "due_date", "category", "is_completed"]) if (args[key] !== undefined) update[key] = args[key];
        if (args.note_id || args.note_title) update.note_id = (await resolveNote(admin, userId, args))?.id || null;
        const { data, error } = await admin.from("reminders").update(update).eq("id", task.id).eq("user_id", userId).select("id,user_id,note_id,title,due_date,category,is_completed,created_at").single();
        if (error) throw error;
        return { ok: true, grounded: true, recordCount: 1, data: { task: mapTask(data), updated_fields: Object.keys(update) }, message: `Tarefa “${data.title}” atualizada.`, structuredData: { type: "task", data: mapTask(data) } };
      }
      case "complete_task":
      case "reopen_task": {
        const task = await resolveTask(admin, userId, args);
        const isCompleted = pending.toolName === "complete_task";
        const { data, error } = await admin.from("reminders").update({ is_completed: isCompleted }).eq("id", task.id).eq("user_id", userId).select("id,user_id,note_id,title,due_date,category,is_completed,created_at").single();
        if (error) throw error;
        return { ok: true, grounded: true, recordCount: 1, data: { task: mapTask(data) }, message: isCompleted ? `Tarefa “${data.title}” concluída.` : `Tarefa “${data.title}” reaberta.`, structuredData: { type: "task", data: mapTask(data) } };
      }
      case "move_task_category": {
        const task = await resolveTask(admin, userId, args);
        const { data, error } = await admin.from("reminders").update({ category: cleanText(args.category || "Geral", 60) }).eq("id", task.id).eq("user_id", userId).select("id,user_id,note_id,title,due_date,category,is_completed,created_at").single();
        if (error) throw error;
        return { ok: true, grounded: true, recordCount: 1, data: { task: mapTask(data) }, message: `Tarefa movida para ${data.category}.`, structuredData: { type: "task", data: mapTask(data) } };
      }
      case "delete_task": {
        const task = await resolveTask(admin, userId, args);
        const { error } = await admin.from("reminders").delete().eq("id", task.id).eq("user_id", userId);
        if (error) throw error;
        return { ok: true, grounded: true, recordCount: 1, data: { deleted_task: task }, message: `Tarefa “${task.title}” excluída.` };
      }
      case "link_file_to_patient": {
        const file = await resolveFile(admin, userId, args);
        const patient = args.patient_id ? { id: cleanId(args.patient_id), name: null } : await resolvePatientByName(admin, userId, args.patient_name);
        const metadata = { ...(file.metadata || {}), linked_by: "synapse", linked_at: new Date().toISOString() };
        const { data, error } = await admin.from("document_files").update({ patient_id: patient?.id, category: args.category || "patient_attachment", metadata }).eq("id", file.id).eq("user_id", userId).select("id,user_id,patient_id,category,original_name,mime_type,size_bytes,status,created_at,uploaded_at,metadata,patient:patient_id(name)").single();
        if (error) throw error;
        return { ok: true, grounded: true, recordCount: 1, data: { file: mapFile(data) }, message: `Arquivo “${file.name}” vinculado ao paciente.`, structuredData: { type: "file", data: mapFile(data) } };
      }
      case "unlink_file_from_patient": {
        const file = await resolveFile(admin, userId, args);
        const metadata = { ...(file.metadata || {}), unlinked_by: "synapse", unlinked_at: new Date().toISOString() };
        const { data, error } = await admin.from("document_files").update({ patient_id: null, category: "general", metadata }).eq("id", file.id).eq("user_id", userId).select("id,user_id,patient_id,category,original_name,mime_type,size_bytes,status,created_at,uploaded_at,metadata,patient:patient_id(name)").single();
        if (error) throw error;
        return { ok: true, grounded: true, recordCount: 1, data: { file: mapFile(data) }, message: `Arquivo “${file.name}” desvinculado do paciente.`, structuredData: { type: "file", data: mapFile(data) } };
      }
      case "delete_file": {
        const file = await resolveFile(admin, userId, args);
        const { error } = await admin.from("document_files").update({ deleted_at: new Date().toISOString(), status: "deleted" }).eq("id", file.id).eq("user_id", userId);
        if (error) throw error;
        return { ok: true, grounded: true, recordCount: 1, data: { deleted_file: file }, message: `Arquivo “${file.name}” excluído.` };
      }
      default:
        return { ok: false, grounded: false, error: "Ação de Notas desconhecida." };
    }
  } catch (error) {
    return { ok: false, grounded: true, error: error instanceof Error ? error.message : "Falha ao executar ação da aba Notas Desktop." };
  }
}
