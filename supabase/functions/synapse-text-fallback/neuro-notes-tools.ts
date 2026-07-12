import type { AgentToolContext, AgentToolResult } from "./executor.ts";

type Product = "neuroview" | "neuroflow" | "neuropulse";
type RunStatus = "queued" | "gathering" | "reasoning" | "drafting" | "applying" | "completed" | "failed";

interface RunStep {
  title: string;
  status: "pending" | "active" | "completed" | "failed";
  description?: string;
  at: string;
}

interface PatientBundle {
  patient: any;
  notes: any[];
  sessionNotes: any[];
  appointments: any[];
  flows: any[];
  pulseEntries: any[];
  documents: any[];
  chatMessages: any[];
}

export const NEURO_NOTES_AGENT_TOOLS = new Set([
  "analyze_neuroview_patient_patterns",
  "create_neuroflow_from_patient_history",
  "create_neuropulse_cause_effect_diagram",
]);

const cleanText = (value: unknown, max = 5000) => String(value ?? "").trim().slice(0, max);
const cleanId = (value: unknown) => {
  const id = cleanText(value, 100);
  if (!/^[a-zA-Z0-9_-]{6,100}$/.test(id)) throw new Error("Identificador inválido.");
  return id;
};
const clamp = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.floor(parsed))) : fallback;
};
const normalizeText = (value: unknown) =>
  cleanText(value, 800)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const escapeLike = (value: string) => value.replace(/[%_]/g, "");
const stripHtml = (value = "") =>
  value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const slug = (value: string, fallback: string) => {
  const result = normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  return result || fallback;
};
const mermaidLabel = (value: string, max = 86) =>
  cleanText(value, max)
    .replace(/"/g, "'")
    .replace(/[{}[\]|<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const createStep = (title: string, status: RunStep["status"], description?: string): RunStep => ({
  title,
  status,
  description,
  at: new Date().toISOString(),
});

async function updateRun(
  admin: any,
  runId: string,
  patch: Record<string, unknown>,
  status?: RunStatus,
  progress?: number,
) {
  const update = {
    ...patch,
    ...(status ? { status } : {}),
    ...(typeof progress === "number" ? { progress } : {}),
    updated_at: new Date().toISOString(),
    ...(status === "completed" || status === "failed" ? { completed_at: new Date().toISOString() } : {}),
  };
  const { error } = await admin.from("synapse_notes_agent_runs").update(update).eq("id", runId);
  if (error) throw error;
}

async function createRun(
  context: AgentToolContext,
  product: Product,
  patient: any,
  intent: string,
  steps: RunStep[],
) {
  const { data, error } = await context.admin
    .from("synapse_notes_agent_runs")
    .insert({
      user_id: context.userId,
      product,
      patient_id: patient?.id || null,
      chat_session_id: context.sessionId || null,
      status: "gathering",
      intent,
      progress: 12,
      steps,
      trace: { steps, nodes: [], links: [], summary: "" },
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function resolvePatient(admin: any, userId: string, args: Record<string, any>) {
  if (args.patient_id) {
    const { data, error } = await admin
      .from("patients")
      .select("id,name,status,diagnosis,notes,risk_score,last_session,next_session,created_at")
      .eq("id", cleanId(args.patient_id))
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Paciente não encontrado ou sem permissão.");
    return data;
  }

  const name = escapeLike(cleanText(args.patient_name || args.patient || "", 160));
  if (!name) throw new Error("Informe o paciente para eu vincular a análise.");

  const { data, error } = await admin
    .from("patients")
    .select("id,name,status,diagnosis,notes,risk_score,last_session,next_session,created_at")
    .eq("user_id", userId)
    .ilike("name", `%${name}%`)
    .order("name")
    .limit(12);
  if (error) throw error;
  const matches = data || [];
  if (!matches.length) throw new Error(`Não encontrei paciente com o nome "${name}".`);
  const exact = matches.filter((item: any) => normalizeText(item.name) === normalizeText(name));
  const candidates = exact.length === 1 ? exact : matches;
  if (candidates.length !== 1) {
    throw new Error(`Encontrei mais de um paciente compatível: ${candidates.slice(0, 5).map((item: any) => item.name).join(", ")}.`);
  }
  return candidates[0];
}

async function optionalQuery(label: string, query: PromiseLike<{ data: any; error: any }>) {
  const { data, error } = await query;
  if (error) {
    console.warn(`[synapse-neuro-notes] ${label}`, error.message || error);
    return [];
  }
  return data || [];
}

async function gatherPatientBundle(context: AgentToolContext, patient: any, includeChat = false): Promise<PatientBundle> {
  const { admin, userId, sessionId } = context;
  const patientId = patient.id;

  const [
    notes,
    sessionNotes,
    appointments,
    flows,
    pulseEntries,
    documents,
    chatMessages,
  ] = await Promise.all([
    optionalQuery("personal_notes", admin
      .from("personal_notes")
      .select("id,title,content,tags,reference_date,created_at,updated_at,patient_id")
      .eq("user_id", userId)
      .eq("patient_id", patientId)
      .order("updated_at", { ascending: false })
      .limit(120)),
    optionalQuery("session_notes", admin
      .from("session_notes")
      .select("id,notes,ai_summary,created_at,appointment_id")
      .eq("user_id", userId)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(80)),
    optionalQuery("appointments", admin
      .from("appointments")
      .select("id,start_time,end_time,type,status,notes,metadata")
      .eq("user_id", userId)
      .eq("patient_id", patientId)
      .order("start_time", { ascending: false })
      .limit(80)),
    optionalQuery("neuro_flows", admin
      .from("neuro_flows")
      .select("id,title,description,tags,workflow,updated_at,created_at,patient_id")
      .eq("user_id", userId)
      .eq("patient_id", patientId)
      .order("updated_at", { ascending: false })
      .limit(40)),
    optionalQuery("neuro_pulse_entries", admin
      .from("neuro_pulse_entries")
      .select("id,title,data,created_at")
      .eq("user_id", userId)
      .contains("data", { patient_id: patientId })
      .order("created_at", { ascending: false })
      .limit(40)),
    optionalQuery("document_files", admin
      .from("document_files")
      .select("id,original_name,category,mime_type,status,created_at,uploaded_at")
      .eq("user_id", userId)
      .eq("patient_id", patientId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(40)),
    includeChat
      ? optionalQuery("messages", admin
        .from("messages")
        .select("id,role,content,created_at")
        .eq("user_id", userId)
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(18))
      : Promise.resolve([]),
  ]);

  return { patient, notes, sessionNotes, appointments, flows, pulseEntries, documents, chatMessages: chatMessages.reverse() };
}

const keywordGroups = [
  { key: "evitacao", label: "Evitação / esquiva", terms: ["evita", "evitacao", "foge", "adiar", "procrast", "isola", "cancel"] },
  { key: "ansiedade", label: "Ansiedade / antecipação", terms: ["ansiedade", "ansioso", "medo", "preocup", "rumin", "panico", "tensao"] },
  { key: "controle", label: "Controle / hiperresponsabilidade", terms: ["controle", "perfeccion", "cobran", "responsabil", "exig", "falhar"] },
  { key: "vinculo", label: "Vínculo / pertencimento", terms: ["vinculo", "relacion", "famil", "parceir", "rejei", "abandono", "solid"] },
  { key: "humor", label: "Humor / energia", terms: ["triste", "depress", "apatia", "desanim", "energia", "irrit", "culpa"] },
  { key: "corpo", label: "Sinais corporais", terms: ["sono", "insônia", "insonia", "corpo", "dor", "respira", "cans", "apetite"] },
];

function allTexts(bundle: PatientBundle) {
  return [
    cleanText(bundle.patient?.diagnosis || "", 1000),
    cleanText(bundle.patient?.notes || "", 2000),
    ...bundle.notes.map((note) => `${note.title || ""} ${stripHtml(note.content || "")}`),
    ...bundle.sessionNotes.map((note) => `${note.ai_summary || ""} ${note.notes || ""}`),
    ...bundle.appointments.map((appointment) => appointment.notes || ""),
    ...bundle.pulseEntries.map((entry) => `${entry.title || ""} ${entry.data?.summary || ""} ${entry.data?.input || ""}`),
    ...bundle.chatMessages.map((message) => message.content || ""),
  ].join("\n");
}

function rankThemes(bundle: PatientBundle) {
  const text = normalizeText(allTexts(bundle));
  const tagCounts = new Map<string, number>();
  bundle.notes.forEach((note) => (note.tags || []).forEach((tag: string) => {
    const safe = cleanText(tag, 50);
    if (safe) tagCounts.set(safe, (tagCounts.get(safe) || 0) + 2);
  }));
  keywordGroups.forEach((group) => {
    const count = group.terms.reduce((sum, term) => sum + (text.includes(normalizeText(term)) ? 1 : 0), 0);
    if (count > 0) tagCounts.set(group.label, (tagCounts.get(group.label) || 0) + count);
  });
  return Array.from(tagCounts.entries())
    .map(([label, score]) => ({ label, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

function evidenceNotes(bundle: PatientBundle, limit = 8) {
  return bundle.notes
    .slice(0, limit)
    .map((note) => ({
      id: note.id,
      title: note.title || "Nota sem titulo",
      excerpt: stripHtml(note.content || "").slice(0, 260),
      tags: note.tags || [],
      updated_at: note.updated_at || note.created_at,
    }));
}

function buildNeuroViewTrace(bundle: PatientBundle) {
  const themes = rankThemes(bundle);
  const notes = evidenceNotes(bundle, 10);
  const nodes = [
    { id: `pat-${bundle.patient.id}`, type: "patient", weight: 1, reason: "Paciente analisado" },
    ...notes.slice(0, 7).map((note, index) => ({
      id: `note-${note.id}`,
      type: "note",
      weight: Number((0.92 - index * 0.06).toFixed(2)),
      reason: note.title,
    })),
    ...themes.slice(0, 5).map((theme) => ({
      id: `tag-${theme.label}`,
      type: "tag",
      weight: Math.min(1, 0.42 + theme.score / 10),
      reason: `${theme.score} sinais vinculados`,
    })),
    ...bundle.flows.slice(0, 3).map((flow) => ({
      id: `flow-${flow.id}`,
      type: "flow",
      weight: 0.72,
      reason: flow.title,
    })),
  ];

  const links = [
    ...notes.slice(0, 7).map((note) => ({
      source: `pat-${bundle.patient.id}`,
      target: `note-${note.id}`,
      reason: "Nota vinculada ao paciente",
    })),
    ...notes.slice(0, 6).flatMap((note) => (note.tags || []).slice(0, 3).map((tag: string) => ({
      source: `note-${note.id}`,
      target: `tag-${tag}`,
      reason: "Tag recorrente",
    }))),
    ...bundle.flows.slice(0, 3).map((flow) => ({
      source: `pat-${bundle.patient.id}`,
      target: `flow-${flow.id}`,
      reason: "Fluxo vinculado ao paciente",
    })),
  ];

  return { nodes, links, themes, evidence: notes };
}

function buildInsightSummary(bundle: PatientBundle, themes: Array<{ label: string; score: number }>) {
  const hasHistory = bundle.notes.length + bundle.sessionNotes.length + bundle.pulseEntries.length + bundle.flows.length;
  if (!hasHistory) {
    return `Ainda há pouco histórico vinculado a ${bundle.patient.name}. O Synapse abriu o NeuroView, mas não encontrou evidência suficiente para inferir padrões sem inventar.`;
  }

  const topThemes = themes.slice(0, 4).map((theme) => theme.label);
  const recentNotes = bundle.notes.slice(0, 3).map((note) => note.title).filter(Boolean);
  return [
    `Análise NeuroView de ${bundle.patient.name} concluída.`,
    topThemes.length ? `Padrões mais salientes: ${topThemes.join(", ")}.` : "Não apareceu uma tag dominante; o padrão parece depender mais da sequência das notas do que de um tema único.",
    `Base considerada: ${bundle.notes.length} notas, ${bundle.sessionNotes.length} registros de prontuário, ${bundle.flows.length} fluxos e ${bundle.pulseEntries.length} NeuroPulse entries.`,
    recentNotes.length ? `Evidências recentes: ${recentNotes.join("; ")}.` : "",
  ].filter(Boolean).join("\n");
}

function buildWorkflow(bundle: PatientBundle, objective: string) {
  const themes = rankThemes(bundle);
  const notes = evidenceNotes(bundle, 6);
  const patientId = bundle.patient.id;
  const title = `Synapse Flow - ${bundle.patient.name}`;
  const mkNode = (id: string, type: string, x: number, y: number, label: string, description: string, extra: Record<string, unknown> = {}) => ({
    id,
    type,
    position: { x, y },
    data: {
      label,
      content: description,
      description,
      patientId,
      source: "synapse",
      confidence: extra.confidence ?? 0.68,
      evidenceNoteIds: notes.map((note) => note.id).slice(0, 4),
      ...extra,
    },
  });
  const themeA = themes[0]?.label || "Padrão principal ainda em formação";
  const themeB = themes[1]?.label || "Resposta emocional/comportamental";
  const themeC = themes[2]?.label || "Hipótese a acompanhar";
  const firstNote = notes[0];
  const secondNote = notes[1];

  const nodes = [
    mkNode("patient-context", "patient", 0, 0, bundle.patient.name, `Contexto clínico consolidado. Objetivo: ${objective || "mapear padrões do histórico"}.`, { patientName: bundle.patient.name, confidence: 0.92 }),
    mkNode("recurring-trigger", "trigger", 320, -170, themeA, `Sinal recorrente detectado em notas/tags do paciente.`, { sourceNoteId: firstNote?.id }),
    mkNode("meaning-loop", "thought", 640, -170, "Significado atribuído", `Possível interpretação interna que organiza o padrão: ${themeA}.`, { sourceNoteId: firstNote?.id }),
    mkNode("emotion-response", "emotion", 960, -170, themeB, `Resposta emocional/somática associada ao padrão percebido.`, { sourceNoteId: secondNote?.id }),
    mkNode("behavior-response", "behavior", 960, 80, "Resposta comportamental", "Ações prováveis: aproximação, esquiva, controle, pausa ou busca de reasseguramento conforme o contexto.", { confidence: 0.62 }),
    mkNode("consequence-loop", "loop", 640, 180, "Ciclo de reforço", "Consequências que podem manter o padrão: alívio imediato, custo posterior ou repetição do mesmo roteiro.", { confidence: 0.64 }),
    mkNode("clinical-hypothesis", "diagnostic", 320, 180, themeC, "Hipótese de trabalho a validar em consulta, não conclusão diagnóstica.", { confidence: 0.58 }),
    mkNode("possible-action", "intervention", 0, 250, "Ações possíveis", "Explorar exceções, mapear antecedentes, testar micro-ações e observar respostas do paciente.", { confidence: 0.7 }),
  ];

  const edges = [
    ["patient-context", "recurring-trigger", "histórico sugere"],
    ["recurring-trigger", "meaning-loop", "evoca significado"],
    ["meaning-loop", "emotion-response", "modula emoção"],
    ["emotion-response", "behavior-response", "organiza resposta"],
    ["behavior-response", "consequence-loop", "gera consequência"],
    ["consequence-loop", "recurring-trigger", "retroalimenta"],
    ["consequence-loop", "clinical-hypothesis", "orienta hipótese"],
    ["clinical-hypothesis", "possible-action", "abre intervenção"],
  ].map(([source, target, relation], index) => ({
    id: `synapse-edge-${index + 1}`,
    source,
    target,
    type: "neural",
    animated: true,
    label: relation,
    data: { relation, strength: index < 5 ? 0.76 : 0.62, polarity: "supports", source: "synapse" },
  }));

  return {
    schema: "neuroflow.workflow.v2",
    nodes,
    edges,
    viewport: { x: 120, y: 130, zoom: 0.74 },
    metadata: {
      title,
      patientId,
      ownerScope: "patient",
      updatedAt: new Date().toISOString(),
      generatedBy: "synapse",
      objective: objective || null,
    },
    links: [
      { type: "patient", id: patientId, nodeId: "patient-context", label: bundle.patient.name },
      ...notes.slice(0, 4).map((note) => ({ type: "note", id: note.id, nodeId: "recurring-trigger", label: note.title })),
    ],
  };
}

function buildNeuroPulseMermaid(bundle: PatientBundle, lensLabel: string, prompt: string) {
  const themes = rankThemes(bundle);
  const principal = mermaidLabel(themes[0]?.label || prompt || "Relato clínico");
  const secondary = mermaidLabel(themes[1]?.label || "Resposta percebida");
  const third = mermaidLabel(themes[2]?.label || "Hipotese a validar");
  const chatCue = mermaidLabel(bundle.chatMessages.map((m) => m.content).join(" ").slice(-360) || prompt || "Contexto do chat", 96);
  const patient = mermaidLabel(bundle.patient.name, 60);

  return [
    "flowchart TD",
    `  A["Paciente: ${patient}"] --> B["Contexto: ${chatCue}"]`,
    `  B --> C["Gatilho percebido: ${principal}"]`,
    `  C --> D["Significado / cognicao"]`,
    `  D --> E["Emocao: ${secondary}"]`,
    `  E --> F["Comportamento / resposta"]`,
    `  F --> G["Consequencia de curto prazo"]`,
    `  G --> H["Ciclo que pode manter o padrao"]`,
    `  H --> C`,
    `  D --> I["Hipotese ${mermaidLabel(lensLabel, 46)}: ${third}"]`,
    `  I --> J["Intervencao ou pergunta clinica"]`,
    "  classDef context fill:#101114,stroke:#f5f5f5,color:#f5f5f5,stroke-width:1px;",
    "  classDef trigger fill:#252525,stroke:#d6d6d6,color:#ffffff,stroke-width:1px;",
    "  classDef cognition fill:#1b2430,stroke:#9fb3c8,color:#eef6ff,stroke-width:1px;",
    "  classDef emotion fill:#2a1d2d,stroke:#d8a7e3,color:#fff2ff,stroke-width:1px;",
    "  classDef behavior fill:#1d2b24,stroke:#a7d9bc,color:#f2fff7,stroke-width:1px;",
    "  classDef consequence fill:#2b251d,stroke:#e0c38a,color:#fff8ea,stroke-width:1px;",
    "  classDef intervention fill:#122626,stroke:#8bd7d2,color:#edffff,stroke-width:1px;",
    "  class A,B context;",
    "  class C trigger;",
    "  class D,I cognition;",
    "  class E emotion;",
    "  class F behavior;",
    "  class G,H consequence;",
    "  class J intervention;",
  ].join("\n");
}

function validateNeuroPulseMermaid(value: string) {
  const normalized = cleanText(value, 6000)
    .replace(/^```(?:mermaid)?\s*/i, "")
    .replace(/```$/i, "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!/^flowchart\s+TD\b/i.test(normalized)) throw new Error("Mermaid precisa iniciar com flowchart TD.");
  if (/<[a-z!/]/i.test(normalized)) throw new Error("Mermaid não pode conter HTML.");
  const nodeLines = normalized.split("\n").filter((line) => /^\s*[A-Z][A-Z0-9]*\["/.test(line));
  const edgeLines = normalized.split("\n").filter((line) => /-->|---/.test(line));
  if (nodeLines.length > 18) throw new Error("Mermaid excede o limite de 18 nós.");
  if (edgeLines.length > 28) throw new Error("Mermaid excede o limite de 28 arestas.");
  return normalized;
}

function lensLabel(value?: string) {
  const labels: Record<string, string> = {
    psicanalise: "Psicanálise",
    tcc: "TCC",
    sistemica: "Sistêmica",
    humanista: "Humanista",
    gestalt: "Gestalt-terapia",
    junguiana: "Junguiana",
    neuropsicologia: "Neuropsicologia",
  };
  const key = cleanText(value || "tcc", 40).toLowerCase();
  return labels[key] || cleanText(value || "TCC", 80);
}

export async function executeNeuroNotesAgentTool(
  name: string,
  args: Record<string, any>,
  context: AgentToolContext,
): Promise<AgentToolResult | null> {
  if (!NEURO_NOTES_AGENT_TOOLS.has(name)) return null;

  const { admin, userId } = context;
  const patient = await resolvePatient(admin, userId, args);
  const intent = cleanText(args.objective || args.focus || args.prompt || args.reason || "", 800);
  const initialSteps = [
    createStep("Resolver paciente", "completed", patient.name),
    createStep("Coletar histórico vinculado", "active", "Notas, prontuário, fluxos e NeuroPulse."),
  ];

    if (name === "analyze_neuroview_patient_patterns") {
      const run = await createRun(context, "neuroview", patient, intent || "Analisar padrões no NeuroView", initialSteps);
      const bundle = await gatherPatientBundle(context, patient, false);
      const traceCore = buildNeuroViewTrace(bundle);
      const steps = [
        ...initialSteps.map((step) => ({ ...step, status: "completed" as const })),
        createStep("Agrupar sinais recorrentes", "completed", `${traceCore.themes.length} temas candidatos.`),
        createStep("Cruzar notas e conexões", "completed", `${traceCore.nodes.length} nós destacados.`),
        createStep("Sintetizar padrões", "completed", "Resposta clínica gerada com evidências."),
      ];
      const summary = buildInsightSummary(bundle, traceCore.themes);
      const trace = { steps, nodes: traceCore.nodes, links: traceCore.links, summary };
      await updateRun(admin, run.id, { steps, trace, result: { summary, themes: traceCore.themes, evidence: traceCore.evidence } }, "completed", 100);
      return {
        ok: true,
        grounded: true,
        recordCount: traceCore.evidence.length,
        data: { run_id: run.id, patient, trace, summary },
        message: summary,
        structuredData: { type: "neuroview_patient_patterns", data: { patient, runId: run.id, trace, summary } },
        clientAction: {
          type: "interface_action",
          data: {
            action: "open_neuroview_reasoning",
            target: "notes",
            patientId: patient.id,
            runId: run.id,
            notesView: "neuroview",
            trace,
            reason: `Abrindo NeuroView para analisar os padrões de ${patient.name}.`,
          },
        },
      };
    }

    if (name === "create_neuroflow_from_patient_history") {
      const run = await createRun(context, "neuroflow", patient, intent || "Construir NeuroFlow pelo histórico", initialSteps);
      const bundle = await gatherPatientBundle(context, patient, false);
      const workflow = buildWorkflow(bundle, intent);
      const title = String(workflow.metadata.title || `Synapse Flow - ${patient.name}`);
      const flowDescription = `Fluxo gerado pelo Synapse com base no histórico vinculado de ${patient.name}.`;
      await updateRun(admin, run.id, {
        steps: [
          ...initialSteps.map((step) => ({ ...step, status: "completed" as const })),
          createStep("Modelar ações e loops", "completed", `${workflow.nodes.length} blocos e ${workflow.edges.length} conexões.`),
          createStep("Salvar NeuroFlow", "active", title),
        ],
        trace: { steps: [], nodes: workflow.nodes.map((node: any) => ({ id: node.id, type: node.type, reason: node.data?.label })), links: workflow.edges.map((edge: any) => ({ source: edge.source, target: edge.target, reason: edge.label })), summary: flowDescription },
        result: { workflow },
      }, "applying", 82);

      const { data: flow, error: flowError } = await admin
        .from("neuro_flows")
        .insert({
          user_id: userId,
          patient_id: patient.id,
          title,
          description: flowDescription,
          tags: ["Synapse", "NeuroFlow", "Paciente"],
          workflow,
          workflow_schema_version: "neuroflow.workflow.v2",
          last_saved_at: new Date().toISOString(),
        })
        .select("id,title,patient_id")
        .single();
      if (flowError) throw flowError;

      const steps = [
        ...initialSteps.map((step) => ({ ...step, status: "completed" as const })),
        createStep("Modelar ações e loops", "completed", `${workflow.nodes.length} blocos e ${workflow.edges.length} conexões.`),
        createStep("Salvar NeuroFlow", "completed", title),
      ];
      await updateRun(admin, run.id, {
        steps,
        target_flow_id: flow.id,
        trace: { steps, nodes: workflow.nodes.map((node: any) => ({ id: node.id, type: node.type, reason: node.data?.label })), links: workflow.edges.map((edge: any) => ({ source: edge.source, target: edge.target, reason: edge.label })), summary: flowDescription },
        result: { workflow, flow },
      }, "completed", 100);

      return {
        ok: true,
        grounded: true,
        recordCount: bundle.notes.length + bundle.sessionNotes.length + bundle.flows.length,
        data: { run_id: run.id, patient, flow, workflow },
        message: `Criei um NeuroFlow vinculado a ${patient.name} com ${workflow.nodes.length} blocos e ${workflow.edges.length} conexões.`,
        structuredData: { type: "neuroflow_generation", data: { patient, runId: run.id, flow, workflow } },
        clientAction: {
          type: "interface_action",
          data: {
            action: "open_neuroflow_generation",
            target: "notes",
            notesView: "neuroflow",
            patientId: patient.id,
            runId: run.id,
            flowId: flow.id,
            reason: `Abrindo o NeuroFlow gerado para ${patient.name}.`,
          },
        },
      };
    }

    if (name === "create_neuropulse_cause_effect_diagram") {
      const run = await createRun(context, "neuropulse", patient, intent || "Gerar fluxograma causa e efeito", initialSteps);
      const bundle = await gatherPatientBundle(context, patient, true);
      const lens = cleanText(args.lens || args.approach || "tcc", 40);
      const lensName = lensLabel(lens);
      const rawMermaid = buildNeuroPulseMermaid(bundle, lensName, intent);
      const mermaid = validateNeuroPulseMermaid(rawMermaid);
      const title = `NeuroPulse - ${patient.name} - ${new Date().toLocaleDateString("pt-BR")}`;
      const noteContent = [
        `<p><strong>NeuroPulse gerado pelo Synapse</strong> - ${escapeHtml(lensName)}</p>`,
        `<p>${escapeHtml(cleanText(intent || "Fluxograma de causa e efeito criado a partir do histórico do paciente e do chat atual.", 600))}</p>`,
        `<pre class="mermaid">${escapeHtml(mermaid)}</pre>`,
      ].join("");

      const { data: note, error: noteError } = await admin
        .from("personal_notes")
        .insert({
          user_id: userId,
          title,
          content: noteContent,
          tags: ["NeuroPulse", "Mermaid", "Synapse"],
          patient_id: patient.id,
          module_id: "neuropulse",
          reference_date: new Date().toISOString(),
        })
        .select("id,title")
        .single();
      if (noteError) throw noteError;

      const { data: entry, error: entryError } = await admin
        .from("neuro_pulse_entries")
        .insert({
          user_id: userId,
          title,
          data: {
            note_id: note.id,
            patient_id: patient.id,
            lens,
            lens_label: lensName,
            input: intent,
            mermaid,
            source: "synapse",
            chat_session_id: context.sessionId,
          },
        })
        .select("id,title")
        .single();
      if (entryError) throw entryError;

      const steps = [
        ...initialSteps.map((step) => ({ ...step, status: "completed" as const })),
        createStep("Converter relato em grafo causal", "completed", lensName),
        createStep("Validar Mermaid", "completed", "Formato flowchart TD aceito pela interface."),
        createStep("Salvar NeuroPulse", "completed", title),
      ];
      const trace = {
        steps,
        nodes: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].map((id) => ({ id, type: "mermaid", reason: "Nó causal NeuroPulse" })),
        links: [],
        summary: `Fluxograma NeuroPulse salvo para ${patient.name}.`,
      };
      await updateRun(admin, run.id, {
        steps,
        trace,
        result: { mermaid, note, entry, lens, lens_label: lensName },
        note_id: note.id,
        pulse_entry_id: entry.id,
      }, "completed", 100);

      return {
        ok: true,
        grounded: true,
        recordCount: bundle.notes.length + bundle.sessionNotes.length + bundle.chatMessages.length,
        data: { run_id: run.id, patient, note, entry, mermaid, lens, lens_label: lensName },
        message: `Criei o fluxograma NeuroPulse de causa e efeito para ${patient.name} e salvei como nota Mermaid.`,
        structuredData: { type: "neuropulse_diagram", data: { patient, runId: run.id, note, entry, mermaid } },
        clientAction: {
          type: "interface_action",
          data: {
            action: "open_neuropulse_diagram",
            target: "notes",
            notesView: "neuropulse",
            patientId: patient.id,
            runId: run.id,
            noteId: note.id,
            pulseEntryId: entry.id,
            mermaid,
            reason: `Abrindo o NeuroPulse gerado para ${patient.name}.`,
          },
        },
      };
    }

    return null;
}
