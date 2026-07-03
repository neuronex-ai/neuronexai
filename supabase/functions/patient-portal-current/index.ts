import {
  corsResponse,
  errorResponse,
  getAuthenticatedUser,
  jsonResponse,
  supabaseAdmin,
} from "../_shared/asaas-client.ts";
import { GetObjectCommand, S3Client } from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";
import {
  getPatientPortalContext,
  requireActivePatientPortal,
} from "../_shared/patient-portal.ts";

async function readBody(req: Request) {
  if (req.method !== "POST") return {};
  return await req.json().catch(() => ({}));
}

function moduleUnavailable(module: string, payload: Record<string, unknown>) {
  return {
    ...payload,
    unavailable: true,
    error: {
      module,
      message: "Modulo temporariamente indisponivel.",
    },
  };
}

async function safeModule(module: string, fallback: Record<string, unknown>, loader: () => Promise<Record<string, unknown>>) {
  try {
    return await loader();
  } catch (error) {
    console.warn(`[patient-portal-current:${module}]`, error);
    return moduleUnavailable(module, fallback);
  }
}

async function loadAppointments(context: any) {
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select("id,start_time,end_time,type,status,location,google_meet_link,created_at,updated_at,metadata,notes")
    .eq("patient_id", context.patient.id)
    .eq("user_id", context.professional.id)
    .order("start_time", { ascending: true });
  if (error) throw error;
  return { appointments: data || [] };
}

async function loadDocuments(context: any) {
  const { data, error } = await supabaseAdmin
    .from("document_files")
    .select("id,bucket,object_key,original_name,mime_type,size_bytes,created_at,shared_with_patient_at")
    .eq("patient_id", context.patient.id)
    .eq("user_id", context.professional.id)
    .eq("status", "ready")
    .eq("shared_with_patient", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = data || [];
  const needsSignedUrls = rows.some((doc: any) => doc.bucket && doc.object_key);
  const r2Endpoint = Deno.env.get("R2_ENDPOINT");
  const r2AccessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
  const r2SecretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");

  if (needsSignedUrls && (!r2Endpoint || !r2AccessKeyId || !r2SecretAccessKey)) {
    throw new Error("Nao foi possivel preparar este documento agora.");
  }

  const r2 = needsSignedUrls
    ? new S3Client({
        region: "auto",
        endpoint: r2Endpoint!,
        credentials: {
          accessKeyId: r2AccessKeyId!,
          secretAccessKey: r2SecretAccessKey!,
        },
      })
    : null;

  const documents = await Promise.all(rows.map(async (doc: any) => {
    let signedUrl: string | null = null;
    if (r2 && doc.bucket && doc.object_key) {
      const name = encodeURIComponent(doc.original_name || "documento").replace(/'/g, "%27");
      signedUrl = await getSignedUrl(
        r2,
        new GetObjectCommand({
          Bucket: doc.bucket,
          Key: doc.object_key,
          ResponseContentType: doc.mime_type || undefined,
          ResponseContentDisposition: `inline; filename*=UTF-8''${name}`,
        }),
        { expiresIn: 300 },
      );
    }
    return {
      id: doc.id,
      name: doc.original_name,
      mimeType: doc.mime_type,
      sizeBytes: doc.size_bytes,
      createdAt: doc.created_at,
      sharedAt: doc.shared_with_patient_at,
      signedUrl,
    };
  }));

  return { documents };
}

function normalizeStatusLabel(status?: string | null) {
  const normalized = String(status || "").toLowerCase();
  if (["paid", "received", "confirmed", "attended", "completed"].includes(normalized)) return "Concluído";
  if (["pending", "processing", "draft", "unscored"].includes(normalized)) return "Em acompanhamento";
  if (["overdue", "expired"].includes(normalized)) return "Atenção necessária";
  if (["cancelled", "canceled", "cancelled_by_professional", "cancelled_by_patient"].includes(normalized)) return "Cancelado";
  if (["absent", "missed"].includes(normalized)) return "Não compareceu";
  return "Em acompanhamento";
}

function normalizePaymentMethod(method?: string | null) {
  const normalized = String(method || "").toLowerCase();
  if (normalized.includes("pix")) return "Pix";
  if (normalized.includes("boleto")) return "Boleto";
  if (normalized.includes("card") || normalized.includes("cart")) return "Cartão";
  return "Link de pagamento";
}

function metadataString(metadata: any, keys: string[]) {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

async function loadBilling(context: any) {
  const [paymentsResult, invoicesResult] = await Promise.all([
    supabaseAdmin
      .from("nb_payments")
      .select("id,description,gross_amount,status,payment_method_type,checkout_url,boleto_url,boleto_pdf,nfse_pdf_url,pix_qr_code,pix_copy_paste,paid_at,expires_at,created_at,metadata")
      .eq("patient_id", context.patient.id)
      .eq("user_id", context.professional.id)
      .neq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("invoices")
      .select("id,invoice_number,amount,status,due_date,created_at,pdf_url,payment_url,nfse_pdf_url,nfse_xml_url")
      .eq("patient_id", context.patient.id)
      .eq("user_id", context.professional.id)
      .order("due_date", { ascending: false })
      .limit(50),
  ]);
  if (paymentsResult.error) throw paymentsResult.error;
  if (invoicesResult.error) throw invoicesResult.error;

  return {
    entries: (paymentsResult.data || []).map((payment: any) => {
      const metadata = payment.metadata || {};
      const paymentUrl =
        payment.checkout_url ||
        metadataString(metadata, ["payment_url", "paymentUrl", "checkout_url", "checkoutUrl", "asaas_invoice_url", "invoiceUrl"]);
      const bankSlipUrl =
        payment.boleto_url ||
        payment.boleto_pdf ||
        metadataString(metadata, ["bank_slip_url", "bankSlipUrl", "asaas_bank_slip_url", "boleto_url", "boletoUrl", "boleto_pdf", "boletoPdf"]);
      const receiptUrl =
        metadataString(metadata, ["receipt_url", "receiptUrl", "asaas_transaction_receipt_url", "transaction_receipt_url"]);
      const invoiceUrl =
        payment.checkout_url ||
        payment.nfse_pdf_url ||
        metadataString(metadata, ["invoice_url", "invoiceUrl", "asaas_invoice_url", "payment_url", "paymentUrl"]);

      return {
        id: payment.id,
        title: payment.description || "Cobrança NeuroFinance",
        description: payment.description || null,
        amount: Number(payment.gross_amount || 0) / 100,
        due_date: payment.expires_at ? String(payment.expires_at).slice(0, 10) : metadataString(metadata, ["due_date", "dueDate"]),
        paid_at: payment.paid_at || null,
        status: payment.status || "pending",
        status_label: normalizeStatusLabel(payment.status),
        payment_method: normalizePaymentMethod(payment.payment_method_type),
        neurofinance_charge_id: payment.id,
        payment_url: paymentUrl,
        invoice_url: invoiceUrl,
        bank_slip_url: bankSlipUrl,
        receipt_url: receiptUrl,
        pix_qr_code: payment.pix_qr_code || metadataString(metadata, ["pix_qr_code", "pixQrCode", "encodedImage"]),
        pix_copy_paste: payment.pix_copy_paste || metadataString(metadata, ["pix_copy_paste", "pixCopyPaste", "payload"]),
        created_at: payment.created_at,
        metadata: {
          paymentMethod: normalizePaymentMethod(payment.payment_method_type),
        },
      };
    }),
    invoices: (invoicesResult.data || []).map((invoice: any) => ({
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      amount: invoice.amount,
      status: invoice.status,
      due_date: invoice.due_date,
      created_at: invoice.created_at,
      receipt_url: invoice.pdf_url || null,
      invoice_url: invoice.nfse_pdf_url || invoice.pdf_url || null,
      bank_slip_url: invoice.payment_url || null,
      nfse_xml_url: invoice.nfse_xml_url || null,
    })),
  };
}

async function loadSessionSummaries(context: any) {
  const [appointmentsResult, notesResult, transcriptsResult] = await Promise.all([
    supabaseAdmin
      .from("appointments")
      .select("id,start_time,end_time,type,status,metadata")
      .eq("patient_id", context.patient.id)
      .eq("user_id", context.professional.id)
      .lte("start_time", new Date().toISOString())
      .order("start_time", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("session_notes")
      .select("id,appointment_id,ai_summary,transcription,original_ai_summary,original_transcription,review_status,review_due_at,created_at")
      .eq("patient_id", context.patient.id)
      .eq("user_id", context.professional.id)
      .not("appointment_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(80),
    supabaseAdmin
      .from("session_transcripts")
      .select("id,appointment_id,status,consent_status,reviewed_at,summary_note_id,created_at")
      .eq("patient_id", context.patient.id)
      .eq("user_id", context.professional.id)
      .not("appointment_id", "is", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(80),
  ]);

  if (appointmentsResult.error) throw appointmentsResult.error;
  if (notesResult.error) throw notesResult.error;
  if (transcriptsResult.error) throw transcriptsResult.error;

  const notesByAppointment = new Map<string, any>();
  for (const note of notesResult.data || []) {
    if (note.appointment_id && !notesByAppointment.has(note.appointment_id)) notesByAppointment.set(note.appointment_id, note);
  }

  const transcriptsByAppointment = new Map<string, any>();
  for (const transcript of transcriptsResult.data || []) {
    if (transcript.appointment_id && !transcriptsByAppointment.has(transcript.appointment_id)) {
      transcriptsByAppointment.set(transcript.appointment_id, transcript);
    }
  }

  const summaries = (appointmentsResult.data || []).map((appointment: any) => {
    const note = notesByAppointment.get(appointment.id);
    const transcript = transcriptsByAppointment.get(appointment.id);
    const metadata = appointment.metadata || {};
    const transcriptionDecision = metadata.teleconsultationTranscription;
    const transcriptionEnabled =
      Boolean(transcriptionDecision?.enabled) ||
      transcript?.consent_status === "granted" ||
      Boolean(note?.original_transcription || note?.transcription);
    const summary = note?.original_ai_summary || note?.ai_summary || null;
    const transcription = note?.original_transcription || note?.transcription || null;

    return {
      id: note?.id || transcript?.id || appointment.id,
      appointmentId: appointment.id,
      startTime: appointment.start_time,
      endTime: appointment.end_time || null,
      modality: appointment.type === "online" ? "Online" : "Presencial",
      statusLabel: normalizeStatusLabel(appointment.status),
      transcriptionEnabled,
      hasSummary: Boolean(summary?.summary || transcription),
      summary: summary?.summary || null,
      topics: Array.isArray(summary?.topics) ? summary.topics.slice(0, 8).map((item: unknown) => String(item)) : [],
      nextSteps: Array.isArray(summary?.next_steps) ? summary.next_steps.slice(0, 8).map((item: unknown) => String(item)) : [],
      emotionalAnalysis: typeof summary?.emotional_analysis === "string" ? summary.emotional_analysis : null,
      sentiment: typeof summary?.sentiment === "string" ? summary.sentiment : null,
      transcription,
      reviewStatus: note?.review_status || (transcriptionEnabled ? "pending_review" : "none"),
      reviewDueAt: note?.review_due_at || null,
    };
  });

  return { summaries };
}

function normalizeAnamnesisContent(content: unknown) {
  if (Array.isArray(content)) return content;
  if (!content || typeof content !== "object") return [];

  const fields = (content as { fields?: Record<string, unknown> }).fields;
  if (fields && typeof fields === "object") {
    return Object.entries(fields).map(([question, answer]) => ({
      question,
      answer: String(answer ?? ""),
    }));
  }

  return [];
}

function calculateAnamnesisProgress(content: unknown) {
  const items = normalizeAnamnesisContent(content);
  const questions = items.filter((item: any) => !item?.isSection);
  if (!questions.length) return 0;
  const answered = questions.filter((item: any) => String(item?.answer || "").trim().length > 0).length;
  return Math.round((answered / questions.length) * 100);
}

async function loadAnamnesis(context: any) {
  const { data, error } = await supabaseAdmin
    .from("patient_anamneses")
    .select("id,type,content,created_at,updated_at,token_expires_at")
    .eq("patient_id", context.patient.id)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) throw error;

  const now = Date.now();
  return {
    anamneses: (data || []).map((record: any) => {
      const progress = calculateAnamnesisProgress(record.content);
      const expiresAt = record.token_expires_at ? new Date(record.token_expires_at).getTime() : 0;
      return {
        id: record.id,
        type: record.type || "Anamnese",
        content: normalizeAnamnesisContent(record.content),
        progress,
        status: progress >= 100 ? "submitted" : expiresAt > now ? "pending" : "expired",
        canEdit: progress < 100 && expiresAt > now,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
        tokenExpiresAt: record.token_expires_at,
      };
    }),
  };
}

async function saveAnamnesis(user: any, context: any, body: Record<string, unknown>) {
  const anamnesisId = String(body.anamnesisId || "");
  const content = Array.isArray(body.content) ? body.content : null;
  if (!anamnesisId || !content) return errorResponse("Anamnese invalida.", 400);

  const { data: record, error: loadError } = await supabaseAdmin
    .from("patient_anamneses")
    .select("id,content,token_expires_at")
    .eq("id", anamnesisId)
    .eq("patient_id", context.patient.id)
    .maybeSingle();
  if (loadError) throw loadError;
  if (!record) return errorResponse("Anamnese nao encontrada.", 404);

  const currentProgress = calculateAnamnesisProgress((record as any).content);
  const expiresAt = (record as any).token_expires_at ? new Date((record as any).token_expires_at).getTime() : 0;
  if (currentProgress >= 100 || expiresAt <= Date.now()) {
    return errorResponse("Esta anamnese esta em modo leitura.", 403);
  }

  const sanitizedContent = content.slice(0, 300).map((item: any) => ({
    question: String(item?.question || "").slice(0, 500),
    answer: String(item?.answer || "").slice(0, 8000),
    isSection: Boolean(item?.isSection),
  }));

  const { data, error } = await supabaseAdmin
    .from("patient_anamneses")
    .update({
      content: sanitizedContent,
      updated_at: new Date().toISOString(),
    })
    .eq("id", anamnesisId)
    .eq("patient_id", context.patient.id)
    .select("id,type,content,created_at,updated_at,token_expires_at")
    .single();
  if (error) throw error;

  const progress = calculateAnamnesisProgress(data.content);
  try {
    await supabaseAdmin.rpc("emit_user_notification", {
      p_user_id: context.professional.id,
      p_event_id: `portal-anamnesis:${anamnesisId}:progress`,
      p_type: progress >= 100 ? "anamnesis_completed" : "anamnesis_progress",
      p_category: "prontuario",
      p_severity: progress >= 100 ? "success" : "info",
      p_title: progress >= 100 ? "Anamnese concluida" : "Anamnese atualizada",
      p_message: `${context.patient.name || "Paciente"} salvou ${progress}% da anamnese pelo Portal do Paciente.`,
      p_action_url: `/pacientes/${context.patient.id}?tab=anamnesis`,
      p_priority: progress >= 100 ? "normal" : "low",
      p_data: {
        sourceModule: "patient_portal",
        eventSource: "patient_portal_anamnesis",
        anamnesisId,
        patientId: context.patient.id,
        actorUserId: user.id,
        progress,
      },
      p_payload: {},
      p_organization_id: null,
    });
  } catch (notifyError) {
    console.warn("[patient-portal-current] anamnesis notification skipped", notifyError);
  }

  return {
    anamnesis: {
      id: data.id,
      type: data.type || "Anamnese",
      content: normalizeAnamnesisContent(data.content),
      progress,
      status: progress >= 100 ? "submitted" : "pending",
      canEdit: progress < 100,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      tokenExpiresAt: data.token_expires_at,
    },
  };
}

async function loadPackages(context: any) {
  const { data, error } = await supabaseAdmin
    .from("patient_packages")
    .select("id,description,total_sessions,sessions_used,price,start_date,end_date,due_day,created_at")
    .eq("patient_id", context.patient.id)
    .eq("user_id", context.professional.id)
    .order("start_date", { ascending: false })
    .limit(30);
  if (error) throw error;
  return { packages: data || [] };
}

async function loadProgress(context: any) {
  const [appointments, goals, mood, documents, packages] = await Promise.all([
    loadAppointments(context),
    loadGoals(context),
    loadMood({ id: context.patient.id }, context, {}),
    supabaseAdmin
      .from("document_files")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", context.patient.id)
      .eq("user_id", context.professional.id)
      .eq("status", "ready")
      .eq("shared_with_patient", true)
      .is("deleted_at", null),
    loadPackages(context),
  ]);
  if (documents.error) throw documents.error;

  const appointmentRows = appointments.appointments || [];
  const goalRows = goals.goals || [];
  const moodRows = mood.logs || [];
  const packageRows = packages.packages || [];
  const completedGoals = goalRows.filter((goal: any) => goal.is_completed).length;
  const attendedSessions = appointmentRows.filter((appointment: any) => {
    const start = new Date(appointment.start_time).getTime();
    return Number.isFinite(start) && start < Date.now() && !String(appointment.status || "").includes("cancelled");
  }).length;
  const activePackages = packageRows.filter((pkg: any) => Number(pkg.total_sessions || 0) > Number(pkg.sessions_used || 0)).length;

  return {
    progress: {
      sessionsTotal: appointmentRows.length,
      attendedSessions,
      goalsTotal: goalRows.length,
      completedGoals,
      sharedDocuments: documents.count || 0,
      moodLogs: moodRows.length,
      activePackages,
      lastMood: moodRows[0] || null,
      nextSteps: goalRows.filter((goal: any) => !goal.is_completed).slice(0, 5),
    },
  };
}

async function loadAppointmentRequests(context: any) {
  const appointments = await loadAppointments(context);
  return {
    requests: (appointments.appointments || []).filter((appointment: any) =>
      appointment?.metadata?.origin === "patient_portal" && appointment?.metadata?.syncStatus === "pending"
    ),
  };
}

async function loadGoals(context: any) {
  const { data, error } = await supabaseAdmin
    .from("patient_goals")
    .select("id,description,is_completed,due_date,created_at")
    .eq("patient_id", context.patient.id)
    .eq("user_id", context.professional.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return { goals: data || [] };
}

async function loadMood(user: any, context: any, body: Record<string, unknown>) {
  if (body.moodScore !== undefined) {
    const moodScore = Number(body.moodScore);
    const notes = String(body.notes || "").trim().slice(0, 2000);
    if (!Number.isInteger(moodScore) || moodScore < 1 || moodScore > 5) {
      return errorResponse("Informe um humor entre 1 e 5.", 400);
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const existingResult = await supabaseAdmin
      .from("patient_mood_logs")
      .select("id")
      .eq("patient_id", context.patient.id)
      .eq("created_by_user_id", user.id)
      .eq("source", "patient_portal")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .maybeSingle();
    if (existingResult.error) throw existingResult.error;

    if (existingResult.data?.id) {
      const { error } = await supabaseAdmin
        .from("patient_mood_logs")
        .update({ mood_score: moodScore, notes })
        .eq("id", existingResult.data.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from("patient_mood_logs").insert({
        user_id: context.professional.id,
        patient_id: context.patient.id,
        mood_score: moodScore,
        notes,
        source: "patient_portal",
        created_by_user_id: user.id,
      });
      if (error) throw error;
    }
  }

  const { data, error } = await supabaseAdmin
    .from("patient_mood_logs")
    .select("id,mood_score,notes,source,created_at")
    .eq("patient_id", context.patient.id)
    .eq("user_id", context.professional.id)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;

  return {
    logs: data || [],
    today: (data || []).find((log: any) => {
      const created = new Date(log.created_at);
      const now = new Date();
      return created.toDateString() === now.toDateString() && log.source === "patient_portal";
    }) || null,
  };
}

async function requestAppointment(context: any, body: Record<string, unknown>) {
  const startTime = new Date(String(body.startTime || ""));
  const type = String(body.type || "online");

  if (!Number.isFinite(startTime.getTime()) || startTime.getTime() <= Date.now()) {
    return errorResponse("Escolha um horário futuro.", 400);
  }
  if (!["online", "presencial"].includes(type)) {
    return errorResponse("Modalidade invalida.", 400);
  }

  const endTime = new Date(startTime.getTime() + 50 * 60 * 1000);
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .insert({
      user_id: context.professional.id,
      patient_id: context.patient.id,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      type,
      status: "unscored",
      notes: "Solicitacao via Portal do Paciente",
      metadata: {
        kind: "session",
        sessionType: "acompanhamento",
        modality: type,
        durationMinutes: 50,
        origin: "patient_portal",
        syncStatus: "pending",
      },
    })
    .select("id,start_time,end_time,type,status,location,google_meet_link,created_at,updated_at")
    .single();

  if (error) throw error;
  return { appointment: data };
}

async function toggleGoal(context: any, body: Record<string, unknown>) {
  const goalId = String(body.goalId || "");
  const isCompleted = Boolean(body.isCompleted);
  if (!goalId) return errorResponse("Meta invalida.", 400);

  const { data, error } = await supabaseAdmin
    .from("patient_goals")
    .update({ is_completed: isCompleted })
    .eq("id", goalId)
    .eq("patient_id", context.patient.id)
    .eq("user_id", context.professional.id)
    .select("id,description,is_completed,due_date,created_at")
    .single();

  if (error) throw error;
  return { goal: data };
}

function mapPatientNote(note: any) {
  return {
    id: note.id,
    title: note.title || "Nota sem título",
    content: note.content || "",
    tags: Array.isArray(note.tags) ? note.tags.map((tag: unknown) => String(tag)) : [],
    referenceDate: note.reference_date || null,
    createdAt: note.created_at,
    updatedAt: note.updated_at,
  };
}

function noteTags(note: any) {
  return Array.isArray(note?.tags) ? note.tags.map((tag: unknown) => String(tag)) : [];
}

async function loadPatientNotes(user: any, context: any) {
  const { data, error } = await supabaseAdmin
    .from("personal_notes")
    .select("id,title,content,tags,reference_date,created_at,updated_at")
    .eq("user_id", user.id)
    .eq("patient_id", context.patient.id)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return {
    notes: (data || [])
      .filter((note: any) => {
        const tags = noteTags(note);
        return tags.includes("portal-paciente") && !tags.includes("tarefa");
      })
      .map(mapPatientNote),
  };
}

async function savePatientNote(user: any, context: any, body: Record<string, unknown>) {
  const noteId = String(body.noteId || "").trim();
  const title = String(body.title || "").trim().replace(/\s+/g, " ").slice(0, 120);
  const content = String(body.content || "").trim().slice(0, 12000);

  if (!title && !content) return errorResponse("Escreva algo para salvar a nota.", 400);

  const payload = {
    user_id: user.id,
    patient_id: context.patient.id,
    module_id: null,
    title: title || "Nota sem título",
    content,
    tags: ["portal-paciente"],
    reference_date: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const query = noteId
    ? supabaseAdmin
        .from("personal_notes")
        .update(payload)
        .eq("id", noteId)
        .eq("user_id", user.id)
        .eq("patient_id", context.patient.id)
        .select("id,title,content,tags,reference_date,created_at,updated_at")
        .single()
    : supabaseAdmin
        .from("personal_notes")
        .insert(payload)
        .select("id,title,content,tags,reference_date,created_at,updated_at")
        .single();

  const { data, error } = await query;
  if (error) throw error;

  return { note: mapPatientNote(data) };
}

function mapPatientTask(note: any) {
  const tags = noteTags(note);
  return {
    id: note.id,
    title: note.title || "Tarefa sem título",
    content: note.content || "",
    isCompleted: tags.includes("status:completed"),
    dueDate: note.reference_date || null,
    createdAt: note.created_at,
    updatedAt: note.updated_at,
  };
}

async function loadPatientTasks(user: any, context: any) {
  const { data, error } = await supabaseAdmin
    .from("personal_notes")
    .select("id,title,content,tags,reference_date,created_at,updated_at")
    .eq("user_id", user.id)
    .eq("patient_id", context.patient.id)
    .order("updated_at", { ascending: false })
    .limit(80);

  if (error) throw error;
  return {
    tasks: (data || [])
      .filter((note: any) => {
        const tags = noteTags(note);
        return tags.includes("portal-paciente") && tags.includes("tarefa");
      })
      .map(mapPatientTask),
  };
}

async function savePatientTask(user: any, context: any, body: Record<string, unknown>) {
  const taskId = String(body.taskId || "").trim();
  const title = String(body.title || "").trim().replace(/\s+/g, " ").slice(0, 160);
  const content = String(body.content || "").trim().slice(0, 4000);
  const dueDateRaw = body.dueDate === null || body.dueDate === undefined ? "" : String(body.dueDate || "").trim();
  const dueDate = dueDateRaw ? new Date(`${dueDateRaw.slice(0, 10)}T12:00:00.000Z`) : null;

  if (!title) return errorResponse("Informe um nome para a tarefa.", 400);
  if (dueDate && !Number.isFinite(dueDate.getTime())) return errorResponse("Data da tarefa inválida.", 400);

  const existingTags = taskId
    ? await supabaseAdmin
        .from("personal_notes")
        .select("tags")
        .eq("id", taskId)
        .eq("user_id", user.id)
        .eq("patient_id", context.patient.id)
        .maybeSingle()
    : { data: null, error: null };
  if (existingTags.error) throw existingTags.error;

  const currentTags = noteTags(existingTags.data);
  const completed = currentTags.includes("status:completed");
  const payload = {
    user_id: user.id,
    patient_id: context.patient.id,
    module_id: null,
    title,
    content,
    tags: ["portal-paciente", "tarefa", completed ? "status:completed" : "status:pending"],
    reference_date: dueDate ? dueDate.toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const query = taskId
    ? supabaseAdmin
        .from("personal_notes")
        .update(payload)
        .eq("id", taskId)
        .eq("user_id", user.id)
        .eq("patient_id", context.patient.id)
        .select("id,title,content,tags,reference_date,created_at,updated_at")
        .single()
    : supabaseAdmin
        .from("personal_notes")
        .insert(payload)
        .select("id,title,content,tags,reference_date,created_at,updated_at")
        .single();

  const { data, error } = await query;
  if (error) throw error;
  return { task: mapPatientTask(data) };
}

async function togglePatientTask(user: any, context: any, body: Record<string, unknown>) {
  const taskId = String(body.taskId || "").trim();
  const isCompleted = Boolean(body.isCompleted);
  if (!taskId) return errorResponse("Tarefa inválida.", 400);

  const { data: existing, error: loadError } = await supabaseAdmin
    .from("personal_notes")
    .select("id,tags")
    .eq("id", taskId)
    .eq("user_id", user.id)
    .eq("patient_id", context.patient.id)
    .maybeSingle();
  if (loadError) throw loadError;
  if (!existing) return errorResponse("Tarefa não encontrada.", 404);

  const tags = noteTags(existing).filter((tag) => !tag.startsWith("status:"));
  if (!tags.includes("portal-paciente")) tags.push("portal-paciente");
  if (!tags.includes("tarefa")) tags.push("tarefa");
  tags.push(isCompleted ? "status:completed" : "status:pending");

  const { data, error } = await supabaseAdmin
    .from("personal_notes")
    .update({ tags, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("user_id", user.id)
    .eq("patient_id", context.patient.id)
    .select("id,title,content,tags,reference_date,created_at,updated_at")
    .single();
  if (error) throw error;
  return { task: mapPatientTask(data) };
}

async function deletePatientTask(user: any, context: any, body: Record<string, unknown>) {
  const taskId = String(body.taskId || "").trim();
  if (!taskId) return errorResponse("Tarefa inválida.", 400);

  const { error } = await supabaseAdmin
    .from("personal_notes")
    .delete()
    .eq("id", taskId)
    .eq("user_id", user.id)
    .eq("patient_id", context.patient.id);

  if (error) throw error;
  return { deleted: true };
}

async function deletePatientNote(user: any, context: any, body: Record<string, unknown>) {
  const noteId = String(body.noteId || "").trim();
  if (!noteId) return errorResponse("Nota inválida.", 400);

  const { error } = await supabaseAdmin
    .from("personal_notes")
    .delete()
    .eq("id", noteId)
    .eq("user_id", user.id)
    .eq("patient_id", context.patient.id);

  if (error) throw error;
  return { deleted: true };
}

async function updateProfile(context: any, body: Record<string, unknown>) {
  const firstName = String(body.firstName || "").trim().replace(/\s+/g, " ").slice(0, 80);
  const lastName = String(body.lastName || "").trim().replace(/\s+/g, " ").slice(0, 120);
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const genderIdentity = body.genderIdentity === null || body.genderIdentity === undefined
    ? null
    : String(body.genderIdentity || "").trim();
  const avatarUrl = body.avatarUrl === undefined || body.avatarUrl === null
    ? undefined
    : String(body.avatarUrl || "").trim();

  const allowedGenders = new Set([
    "male",
    "female",
    "agender",
    "gender_fluid",
    "non_binary",
    "transgender",
    "prefer_not_to_say",
    "other",
  ]);

  if (fullName.length < 2) return errorResponse("Informe seu nome.", 400);
  if (fullName.length > 160) return errorResponse("Nome muito longo.", 400);
  if (genderIdentity && !allowedGenders.has(genderIdentity)) {
    return errorResponse("Gênero inválido.", 400);
  }
  if (avatarUrl !== undefined && avatarUrl && !/^https:\/\/.+/i.test(avatarUrl)) {
    return errorResponse("Foto invalida.", 400);
  }

  const updates: Record<string, unknown> = {
    name: fullName,
    gender_identity: genderIdentity || null,
  };
  if (avatarUrl !== undefined) updates.avatar_url = avatarUrl || null;

  const { error } = await supabaseAdmin
    .from("patients")
    .update(updates)
    .eq("id", context.patient.id)
    .eq("user_id", context.professional.id);
  if (error) throw error;

  return await getPatientPortalContext({
    id: context.patientUserId || "",
    email: context.patient?.email || null,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();
  if (req.method !== "GET" && req.method !== "POST") return errorResponse("Metodo nao permitido.", 405);

  try {
    const body = await readBody(req);
    const action = String((body as any).action || "current");

    if (action === "current") {
      const user = await getAuthenticatedUser(req);
      const context = await getPatientPortalContext({ id: user.id, email: user.email });
      return jsonResponse(context);
    }

    const { user, context, response } = await requireActivePatientPortal(req);
    if (response) return response;

    if (action === "appointments") return jsonResponse(await loadAppointments(context));
    if (action === "documents") return jsonResponse(await safeModule("documents", { documents: [] }, () => loadDocuments(context)));
    if (action === "billing") return jsonResponse(await safeModule("billing", { entries: [], invoices: [] }, () => loadBilling(context)));
    if (action === "session_summaries") return jsonResponse(await loadSessionSummaries(context));
    if (action === "anamnesis") return jsonResponse(await loadAnamnesis(context));
    if (action === "packages") return jsonResponse(await loadPackages(context));
    if (action === "progress") return jsonResponse(await safeModule("progress", {
      progress: {
        sessionsTotal: 0,
        attendedSessions: 0,
        goalsTotal: 0,
        completedGoals: 0,
        sharedDocuments: 0,
        moodLogs: 0,
        activePackages: 0,
        lastMood: null,
        nextSteps: [],
      },
    }, () => loadProgress(context)));
    if (action === "appointment_requests") return jsonResponse(await loadAppointmentRequests(context));
    if (action === "goals") return jsonResponse(await safeModule("goals", { goals: [] }, () => loadGoals(context)));
    if (action === "patient_notes") return jsonResponse(await loadPatientNotes(user, context));
    if (action === "save_patient_note") {
      const result = await savePatientNote(user, context, body as Record<string, unknown>);
      return result instanceof Response ? result : jsonResponse(result);
    }
    if (action === "delete_patient_note") {
      const result = await deletePatientNote(user, context, body as Record<string, unknown>);
      return result instanceof Response ? result : jsonResponse(result);
    }
    if (action === "patient_tasks") return jsonResponse(await loadPatientTasks(user, context));
    if (action === "save_patient_task") {
      const result = await savePatientTask(user, context, body as Record<string, unknown>);
      return result instanceof Response ? result : jsonResponse(result);
    }
    if (action === "toggle_patient_task") {
      const result = await togglePatientTask(user, context, body as Record<string, unknown>);
      return result instanceof Response ? result : jsonResponse(result);
    }
    if (action === "delete_patient_task") {
      const result = await deletePatientTask(user, context, body as Record<string, unknown>);
      return result instanceof Response ? result : jsonResponse(result);
    }
    if (action === "save_anamnesis") {
      const result = await saveAnamnesis(user, context, body as Record<string, unknown>);
      return result instanceof Response ? result : jsonResponse(result);
    }
    if (action === "request_appointment") {
      const result = await requestAppointment(context, body as Record<string, unknown>);
      return result instanceof Response ? result : jsonResponse(result);
    }
    if (action === "toggle_goal") {
      const result = await toggleGoal(context, body as Record<string, unknown>);
      return result instanceof Response ? result : jsonResponse(result);
    }
    if (action === "update_profile") {
      const result = await updateProfile({ ...context, patientUserId: user.id }, body as Record<string, unknown>);
      return result instanceof Response ? result : jsonResponse(result);
    }
    if (action === "mood") {
      const result = await loadMood(user, context, body as Record<string, unknown>);
      return result instanceof Response ? result : jsonResponse(result);
    }

    return errorResponse("Ação do portal desconhecida.", 400);
  } catch (error) {
    console.error("[patient-portal-current]", error);
    return errorResponse(error instanceof Error ? error.message : "Não foi possível carregar seu portal.", 500);
  }
});
