import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { generateEmbedding } from './embeddings.ts';
import { prepareAgendaActionPlan, prepareAppointmentActionPlan } from '../_shared/appointment-action-plans.ts';

const normalizeIdempotencyPart = (value: unknown) =>
    String(value || '')
        .trim()
        .replace(/[^a-zA-Z0-9:._-]+/g, '_')
        .slice(0, 140);

const buildSynapseEntryIdempotencyKey = (ctx: any, toolName: string) => {
    const channel = normalizeIdempotencyPart(ctx?.channel || ctx?.source?.channel || ctx?.context?.channel || 'app') || 'app';
    const explicitKey = ctx?.idempotencyKey || ctx?.context?.idempotency_key || ctx?.source?.idempotency_key;
    if (explicitKey) return `synapse:${channel}:${toolName}:${normalizeIdempotencyPart(explicitKey)}`;

    const sourceMessageId = ctx?.source?.source_message_id || ctx?.source?.message_id || ctx?.context?.source_message_id;
    if (sourceMessageId) return `synapse:${channel}:${toolName}:${normalizeIdempotencyPart(sourceMessageId)}`;

    return `synapse:${channel}:${toolName}:${crypto.randomUUID()}`;
};

export async function executeTool(name: string, args: any, ctx: any) {
    const { supabaseUser, user } = ctx;
    const conversationId = /^[0-9a-f-]{36}$/i.test(String(ctx?.sessionId || ''))
        ? String(ctx.sessionId)
        : null;
    const planContext = {
        admin: ctx.supabaseAdmin,
        userId: user.id,
        sessionId: conversationId,
        channel: ctx?.channel || 'panel',
        voiceSessionId: ctx?.voiceSessionId || null,
        whatsappMessageId: ctx?.source?.message_id || null,
        toolCallId: ctx?.toolCallId || null,
        correlationId: ctx?.source?.source_message_id || ctx?.idempotencyKey || null,
    };
    let result: any = { error: "Erro desconhecido" };
    let structuredData: any = null;

    try {
        switch (name) {
            case 'search_clinical_history': {
                let query = supabaseUser
                    .from('session_notes')
                    .select('notes, ai_summary, created_at, appointment_id')
                    .eq('patient_id', args.patientId)
                    .order('created_at', { ascending: false })
                    .limit(args.limit || 5);

                if (args.keywords) {
                    query = query.ilike('notes', `%${args.keywords}%`);
                }

                const { data, error } = await query;
                if (error) { result = { error: error.message }; break; }

                if (data && data.length > 0) {
                    result = {
                        notes_found: data.length,
                        data_preview: data.map((n: any) => ({
                            date: n.created_at,
                            summary: n.ai_summary?.summary || n.notes.substring(0, 100) + "..."
                        }))
                    };
                    structuredData = { type: 'clinical_history_widget', data: { notes: data } };
                } else {
                    result = { message: "Nenhuma anotação encontrada com esses critérios." };
                }
                break;
            }

            case 'list_patients': {
                const { data, error } = await ctx.supabaseAdmin
                    .from('patients')
                    .select('name, email, phone, diagnosis, id, user_id, status, notes, risk_score, birth_date, emergency_contact, payer_name, payer_cpf, cpf, medications')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(args.limit || 20);

                result = { patients: data || [], debug_user_id: user.id };
                if (data?.length > 0) {
                    structuredData = { type: 'patient_list_widget', data: { patients: data } };
                }
                break;
            }

            case 'search_patients': {
                const queryStr = (args.name_query || '').trim();

                const { data, error } = await ctx.supabaseAdmin
                    .from('patients')
                    .select('*')
                    .eq('user_id', user.id)
                    .or(`name.ilike.%${queryStr}%,email.ilike.%${queryStr}%`)
                    .limit(10);


                result = { found: data, debug_user_id: user.id, search_term: queryStr };
                if (data?.length === 1) {
                    structuredData = { type: 'patient_card', data: data[0] };
                } else if (data?.length > 1) {
                    structuredData = { type: 'patient_list_widget', data: { patients: data } };
                }
                break;
            }

            case 'report_all_patients': {
                const { data } = await ctx.supabaseAdmin
                    .from('patients')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('name', { ascending: true });

                result = {
                    total_patients: data?.length || 0,
                    all_patients_data: data
                };
                // Structured data for a possible big list view
                if (data?.length > 0) {
                    structuredData = { type: 'patient_list_widget', data: { patients: data, title: "Todos os Pacientes" } };
                }
                break;
            }

            case 'get_patient_details': {
                const { data: patient } = await supabaseUser.from('patients').select('*').eq('id', args.patientId).single();
                if (patient) {
                    structuredData = { type: 'patient_card', data: patient };
                    result = { success: true, patient_name: patient.name, full_data: patient };
                } else {
                    result = { error: "Paciente não encontrado" };
                }
                break;
            }

            case 'generate_patient_insights': {
                // Get patient data
                const { data: patient } = await ctx.supabaseAdmin
                    .from('patients')
                    .select('*')
                    .eq('id', args.patientId)
                    .eq('user_id', user.id)
                    .single();

                if (!patient) {
                    result = { error: "Paciente não encontrado." };
                    break;
                }

                // Get session notes
                const { data: notes } = await ctx.supabaseAdmin
                    .from('session_notes')
                    .select('notes, ai_summary, created_at')
                    .eq('patient_id', args.patientId)
                    .order('created_at', { ascending: false })
                    .limit(10);

                // Get recent appointments
                const { data: appointments } = await ctx.supabaseAdmin
                    .from('appointments')
                    .select('start_time, status, notes')
                    .eq('patient_id', args.patientId)
                    .order('start_time', { ascending: false })
                    .limit(10);

                const patientName = args.patientName || patient.name;

                // Build context for AI analysis
                const clinicalContext = {
                    patient: {
                        name: patientName,
                        diagnosis: patient.diagnosis,
                        medications: patient.medications,
                        riskScore: patient.risk_score,
                        status: patient.status
                    },
                    sessionNotes: notes?.map((n: any) => ({
                        date: new Date(n.created_at).toLocaleDateString('pt-BR'),
                        content: n.notes?.substring(0, 500),
                        aiSummary: n.ai_summary
                    })),
                    appointments: appointments?.map((a: any) => ({
                        date: new Date(a.start_time).toLocaleDateString('pt-BR'),
                        status: a.status
                    })),
                    focusArea: args.focusArea || 'geral'
                };

                // Generate insights using Gemini
                const geminiKey = Deno.env.get('GEMINI_API_KEY');
                const insightPrompt = `
Como psicólogo assistente, analise os dados do paciente e gere insights clínicos.

DADOS DO PACIENTE:
${JSON.stringify(clinicalContext, null, 2)}

Gere uma análise contendo:
1. **Resumo da Evolução**: Como o paciente tem progredido?
2. **Pontos de Atenção**: Áreas que merecem foco
3. **Padrões Observados**: Tendências identificadas nas sessões
4. **Recomendações**: Sugestões para próximas sessões

${args.focusArea && args.focusArea !== 'geral' ? `Foque especialmente em: ${args.focusArea}` : ''}

Responda de forma concisa e profissional.`;

                try {
                    const geminiResponse = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey}`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{ parts: [{ text: insightPrompt }] }],
                                generationConfig: { temperature: 0.3 }
                            })
                        }
                    );

                    const geminiData = await geminiResponse.json();
                    const insights = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "Não foi possível gerar insights.";

                    result = {
                        success: true,
                        patientName,
                        insights,
                        dataUsed: {
                            sessionCount: notes?.length || 0,
                            appointmentCount: appointments?.length || 0
                        }
                    };

                    structuredData = {
                        type: 'patient_insights',
                        data: { patientName, insights, patient }
                    };
                } catch (e: any) {
                    result = { error: `Erro ao gerar insights: ${e.message}` };
                }
                break;
            }

            case 'suggest_treatment_approach': {
                const condition = args.condition;
                const approach = args.approach || 'Geral';

                // If patientId provided, get patient context
                let patientContext = '';
                if (args.patientId) {
                    const { data: patient } = await ctx.supabaseAdmin
                        .from('patients')
                        .select('name, diagnosis, medications, notes')
                        .eq('id', args.patientId)
                        .single();

                    if (patient) {
                        patientContext = `
CONTEXTO DO PACIENTE:
- Nome: ${patient.name}
- Diagnóstico: ${patient.diagnosis || 'Não informado'}
- Medicações: ${JSON.stringify(patient.medications) || 'Nenhuma'}
- Notas: ${patient.notes?.substring(0, 300) || 'Sem notas'}
`;
                    }
                }

                const geminiKey = Deno.env.get('GEMINI_API_KEY');
                const suggestionPrompt = `
Como consultor especializado em psicologia clínica, sugira abordagens terapêuticas baseadas em evidências.

CONDIÇÃO: ${condition}
ABORDAGEM PREFERIDA: ${approach}
${patientContext}

Forneça:
1. **Técnicas Recomendadas**: 3-5 técnicas específicas com breve descrição
2. **Exercícios Práticos**: 2-3 exercícios que podem ser aplicados
3. **Recursos de Apoio**: Materiais ou ferramentas úteis
4. **Considerações**: Pontos de atenção para esta condição

IMPORTANTE: Estas são apenas sugestões educativas. A decisão clínica final é sempre do profissional responsável.

Seja conciso e prático.`;

                try {
                    const geminiResponse = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey}`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{ parts: [{ text: suggestionPrompt }] }],
                                generationConfig: { temperature: 0.4 }
                            })
                        }
                    );

                    const geminiData = await geminiResponse.json();
                    const suggestions = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "Não foi possível gerar sugestões.";

                    result = {
                        success: true,
                        condition,
                        approach,
                        suggestions,
                        disclaimer: "Estas são sugestões educativas. A decisão clínica é responsabilidade do profissional."
                    };

                    structuredData = {
                        type: 'treatment_suggestions',
                        data: { condition, approach, suggestions }
                    };
                } catch (e: any) {
                    result = { error: `Erro ao gerar sugestões: ${e.message}` };
                }
                break;
            }

            case 'detect_risk_patterns': {
                const riskType = args.riskType || 'all';
                const daysThreshold = args.daysThreshold || 30;
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

                const riskPatients: any[] = [];

                // Get all patients for this user
                const { data: patients } = await ctx.supabaseAdmin
                    .from('patients')
                    .select('id, name, status, last_session, risk_score, diagnosis')
                    .eq('user_id', user.id)
                    .eq('status', 'active');

                if (!patients || patients.length === 0) {
                    result = { message: "Nenhum paciente ativo encontrado." };
                    break;
                }

                for (const patient of patients) {
                    const risks: string[] = [];

                    // Check for inactivity
                    if (riskType === 'inactivity' || riskType === 'all') {
                        if (!patient.last_session || new Date(patient.last_session) < cutoffDate) {
                            const daysSinceSession = patient.last_session
                                ? Math.floor((Date.now() - new Date(patient.last_session).getTime()) / (1000 * 60 * 60 * 24))
                                : 999;
                            risks.push(`Sem sessão há ${daysSinceSession} dias`);
                        }
                    }

                    // Check for high risk score
                    if (riskType === 'high_risk' || riskType === 'all') {
                        if (patient.risk_score && patient.risk_score >= 7) {
                            risks.push(`Score de risco alto: ${patient.risk_score}/10`);
                        }
                    }

                    // Check for no-shows (cancelled appointments)
                    if (riskType === 'no_show' || riskType === 'all') {
                        const { data: cancelledAppts } = await ctx.supabaseAdmin
                            .from('appointments')
                            .select('id')
                            .eq('patient_id', patient.id)
                            .eq('status', 'cancelled')
                            .gte('start_time', cutoffDate.toISOString());

                        if (cancelledAppts && cancelledAppts.length >= 2) {
                            risks.push(`${cancelledAppts.length} consultas canceladas recentemente`);
                        }
                    }

                    if (risks.length > 0) {
                        riskPatients.push({
                            id: patient.id,
                            name: patient.name,
                            diagnosis: patient.diagnosis,
                            risks
                        });
                    }
                }

                if (riskPatients.length === 0) {
                    result = {
                        success: true,
                        message: "✅ Nenhum paciente identificado em risco no momento.",
                        checkedPatients: patients.length
                    };
                } else {
                    result = {
                        success: true,
                        message: `Aten??o: ${riskPatients.length} paciente(s) precisam de aten??o.`,
                        patientsAtRisk: riskPatients,
                        checkedPatients: patients.length
                    };
                    structuredData = {
                        type: 'risk_alert',
                        data: { patients: riskPatients }
                    };
                }
                break;
            }

            case 'create_appointment': {
                const startTimeStr = args.datetime.includes('T') && !args.datetime.match(/Z$|[+-]\d{2}:\d{2}$|[+-]\d{4}$/)
                    ? `${args.datetime}-03:00`
                    : args.datetime;
                const start_time = new Date(startTimeStr).toISOString();
                const end_time = new Date(new Date(startTimeStr).getTime() + (args.duration || 50) * 60000).toISOString();
                const occurrenceCount = Math.max(1, Math.min(500, Number(args.occurrenceCount || 1)));
                const useAgendaV2 = occurrenceCount > 1
                    || Boolean(args.recurrenceKind)
                    || ['until', 'open'].includes(String(args.terminationKind || ''))
                    || Array.isArray(args.overrides);
                const legacyFrequency = String(args.frequency || 'weekly');
                const recurrenceKind = String(args.recurrenceKind || (legacyFrequency === 'monthly' ? 'monthly' : 'weekly'));
                const localDate = new Date(startTimeStr);
                const weekdayLabel = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(localDate);
                const weekday = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[weekdayLabel] ?? 0;
                const monthDay = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', day: 'numeric' }).format(localDate));
                const recurrenceRule: Record<string, any> = {
                    kind: recurrenceKind,
                    interval: Number(args.interval || (legacyFrequency === 'biweekly' ? 2 : 1)),
                    termination: args.terminationKind === 'open'
                        ? { kind: 'open' }
                        : args.terminationKind === 'until'
                            ? { kind: 'until', until_date: args.untilDate }
                            : { kind: 'count', count: occurrenceCount },
                };
                if (recurrenceKind === 'weekly') recurrenceRule.week_days = args.weekDays?.length ? args.weekDays : [weekday];
                if (recurrenceKind === 'monthly') recurrenceRule.month_days = args.monthDays?.length ? args.monthDays : [monthDay];
                if (recurrenceKind === 'custom_dates') recurrenceRule.custom_dates = args.customDates || [];
                if (recurrenceKind === 'range_distribution') recurrenceRule.until_date = args.distributionUntilDate || args.untilDate;

                const plan = useAgendaV2
                    ? await prepareAgendaActionPlan(
                        planContext,
                        'create_appointment',
                        {
                            patient_id: args.patientId,
                            first_start_time: start_time,
                            duration_minutes: Number(args.duration || 50),
                            timezone: 'America/Sao_Paulo',
                            type: args.type || 'presencial',
                            notes: args.notes || null,
                            location: args.location || null,
                            recurrence_rule: recurrenceRule,
                            overrides: (args.overrides || []).map((override: any) => ({
                                occurrence_number: override.occurrenceNumber,
                                date: override.date,
                                start_time: override.startTime,
                                duration_minutes: override.durationMinutes,
                                modality: override.modality,
                                location: override.location,
                                reason: override.reason || 'Personalização solicitada ao Synapse',
                                source: 'synapse',
                            })),
                            default_config: { durationMinutes: Number(args.duration || 50), modality: args.type || 'presencial', location: args.location || null },
                            metadata: { createdBy: 'synapse', recurrenceSchemaVersion: 2 },
                            ...(args.financial || args.packageId || args.financialMode
                                ? { financial: args.financial || { mode: args.packageId ? 'package' : args.financialMode, package_id: args.packageId || null } }
                                : {}),
                        },
                        buildSynapseEntryIdempotencyKey(ctx, 'prepare_agenda_v2'),
                    )
                    : await prepareAppointmentActionPlan(
                        planContext,
                        'create_appointment',
                        'create',
                        {
                            patient_id: args.patientId,
                            start_time,
                            end_time,
                            type: args.type || 'presencial',
                            notes: args.notes || null,
                            location: args.location || null,
                            frequency: 'single',
                            occurrence_count: 1,
                            package_id: args.packageId || null,
                            communication: args.communication || { sendConfirmation: true, provider: 'configured' },
                            financial: args.financial || { mode: args.financialMode || 'none' },
                            fiscal: args.fiscal || { automationEnabled: false, trigger: 'professional_settings' },
                        },
                        buildSynapseEntryIdempotencyKey(ctx, 'prepare_appointment'),
                    );
                result = {
                    success: true,
                    confirmation_required: plan.status === 'awaiting_confirmation',
                    review_required: plan.status === 'review_required',
                    status: plan.status,
                    summary: plan.summary,
                };
                structuredData = { type: 'appointment_plan_prepared', data: result };
                break;
            }

            case 'get_calendar': {
                const startStr = args.startDate.includes('T') ? args.startDate : `${args.startDate}T00:00:00`;
                const endStr = args.endDate.includes('T') ? args.endDate : `${args.endDate}T23:59:59`;

                // Force Brazil timezone (-03:00) for naive datetime strings
                const startBrazil = !startStr.match(/Z$|[+-]\d{2}:\d{2}$|[+-]\d{4}$/) ? `${startStr}-03:00` : startStr;
                const endBrazil = !endStr.match(/Z$|[+-]\d{2}:\d{2}$|[+-]\d{4}$/) ? `${endStr}-03:00` : endStr;

                const { data } = await supabaseUser
                    .from('appointments')
                    .select('id, start_time, end_time, type, status, notes, patient_id, patient:patient_id(name)')
                    .eq('user_id', user.id)
                    .gte('start_time', new Date(startBrazil).toISOString())
                    .lte('start_time', new Date(endBrazil).toISOString())
                    .order('start_time');

                // Convert UTC timestamps to Brazil local time so the AI model reads correct times
                const fmt = (iso: string, style: 'time' | 'full') => {
                    const d = new Date(iso);
                    if (style === 'time') return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(d);
                    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(d);
                };

                const dataBrazil = (data || []).map((a: any) => ({
                    id: a.id,
                    patient_name: a.patient?.name || 'Bloqueio',
                    start_time_local: fmt(a.start_time, 'full'),
                    end_time_local: fmt(a.end_time, 'full'),
                    horario: `${fmt(a.start_time, 'time')} às ${fmt(a.end_time, 'time')}`,
                    type: a.type,
                    status: a.status,
                    notes: a.notes,
                }));

                result = { appointments_count: dataBrazil.length, data: dataBrazil };

                if (dataBrazil.length > 0) {
                    structuredData = {
                        type: 'calendar_widget',
                        data: {
                            title: 'Agenda',
                            appointments: dataBrazil,
                        }
                    };
                }
                break;
            }

            case 'reschedule_appointment': {
                const { data: appointment, error: fetchError } = await ctx.supabaseAdmin
                    .from('appointments')
                    .select('*, patient:patient_id(name, phone)')
                    .eq('id', args.appointmentId)
                    .eq('user_id', user.id)
                    .single();

                if (fetchError || !appointment) {
                    result = { error: "Consulta não encontrada." };
                    break;
                }

                const patientName = args.patientName || appointment.patient?.name || 'Paciente';
                const duration = args.newDuration ||
                    (new Date(appointment.end_time).getTime() - new Date(appointment.start_time).getTime()) / 60000;

                // Force Brazil timezone (-03:00) for naive datetime strings from the AI
                const newStartTimeStr = args.newDatetime.includes('T') && !args.newDatetime.match(/Z$|[+-]\d{2}:\d{2}$|[+-]\d{4}$/)
                    ? `${args.newDatetime}-03:00`
                    : args.newDatetime;

                const newStartIso = new Date(newStartTimeStr).toISOString();
                const newEndIso = new Date(new Date(newStartTimeStr).getTime() + duration * 60000).toISOString();
                const plan = await prepareAppointmentActionPlan(
                    planContext,
                    'reschedule_appointment',
                    'reschedule',
                    {
                        appointment_id: args.appointmentId,
                        start_time: newStartIso,
                        end_time: newEndIso,
                        type: args.type || appointment.type,
                        location: args.location === undefined ? appointment.location : args.location,
                        communication: { sendConfirmation: args.notifyPatient !== false, provider: 'configured' },
                    },
                    buildSynapseEntryIdempotencyKey(ctx, 'prepare_reschedule'),
                );
                result = {
                    success: true,
                    confirmation_required: plan.status === 'awaiting_confirmation',
                    review_required: plan.status === 'review_required',
                    status: plan.status,
                    patientName,
                    summary: plan.summary,
                };
                structuredData = { type: 'appointment_plan_prepared', data: result };
                break;
            }

            case 'cancel_appointment': {
                const { data: appointment, error: fetchError } = await ctx.supabaseAdmin
                    .from('appointments')
                    .select('*, patient:patient_id(name, phone)')
                    .eq('id', args.appointmentId)
                    .eq('user_id', user.id)
                    .single();

                if (fetchError || !appointment) {
                    result = { error: "Consulta não encontrada." };
                    break;
                }

                const patientName = args.patientName || appointment.patient?.name || 'Paciente';
                const plan = await prepareAppointmentActionPlan(
                    planContext,
                    'cancel_appointment',
                    'cancel',
                    {
                        appointment_id: args.appointmentId,
                        reason: args.reason || 'Sem motivo informado',
                        communication: { sendConfirmation: true, provider: 'configured' },
                    },
                    buildSynapseEntryIdempotencyKey(ctx, 'prepare_cancellation'),
                );
                result = {
                    success: true,
                    confirmation_required: plan.status === 'awaiting_confirmation',
                    review_required: plan.status === 'review_required',
                    status: plan.status,
                    patientName,
                    summary: plan.summary,
                };
                structuredData = { type: 'appointment_plan_prepared', data: result };
                break;
            }

            case 'search_medical_articles': {
                const query = args.query;
                const limit = args.limit || 3;
                const geminiKey = Deno.env.get('GEMINI_API_KEY');

                // Simulate PubMed search using Gemini knowledge base (since we don't have direct external API access setup)
                // In production, this would call PubMed API
                const searchPrompt = `
Atue como um pesquisador médico acessando a base PubMed.
Pesquise por artigos científicos recentes e relevantes sobre: "${query}".

Retorne exatamente ${limit} resultados no seguinte formato JSON (sem markdown):
[
  {
    "title": "Título do Artigo em Português",
    "authors": "Autor A, Autor B...",
    "year": 2023,
    "summary": "Resumo conciso das descobertas principais (2-3 frases).",
    "relevance": "Por que é relevante para a prática clínica?"
  }
]
`;

                try {
                    const geminiResponse = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey}`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{ parts: [{ text: searchPrompt }] }],
                                generationConfig: { temperature: 0.2, response_mime_type: "application/json" }
                            })
                        }
                    );

                    const geminiData = await geminiResponse.json();
                    const articlesText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
                    const articles = JSON.parse(articlesText || "[]");

                    result = {
                        success: true,
                        query,
                        articles
                    };

                    structuredData = {
                        type: 'medical_articles_list',
                        data: { query, articles }
                    };
                } catch (e: any) {
                    result = { error: `Erro ao buscar artigos: ${e.message}` };
                }
                break;
            }

            case 'search_cid10': {
                const query = args.query;
                const geminiKey = Deno.env.get('GEMINI_API_KEY');

                const cidPrompt = `
Atue como um especialista em codificação médica CID-10 (ICD-10).
Busque pelo código ou descrição: "${query}".

Retorne os resultados mais prováveis no formato JSON:
[
  {
    "code": "F41.1",
    "description": "Ansiedade Generalizada",
    "details": "Transtorno caracterizado por...",
    "category": "Transtornos neuróticos"
  }
]
Limite a 3 resultados.
`;

                try {
                    const response = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey}`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{ parts: [{ text: cidPrompt }] }],
                                generationConfig: { temperature: 0.1, response_mime_type: "application/json" }
                            })
                        }
                    );

                    const data = await response.json();
                    const results = JSON.parse(data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]");

                    result = {
                        success: true,
                        query,
                        results
                    };

                    structuredData = {
                        type: 'cid10_result',
                        data: { query, results }
                    };
                } catch (e: any) {
                    result = { error: `Erro ao buscar CID-10: ${e.message}` };
                }
                break;
            }

            case 'get_medication_info': {
                const medName = args.medicationName;
                const type = args.queryType || 'general';
                const geminiKey = Deno.env.get('GEMINI_API_KEY');

                const medPrompt = `
Atue como um farmacologista clínico. Forneça informações confiáveis sobre o medicamento: "${medName}".
Foco: ${type === 'interactions' ? 'Interações Medicamentosas' : type === 'dosage' ? 'Posologia e Administração' : type === 'side_effects' ? 'Efeitos Colaterais' : 'Visão Geral'}.

Retorne em formato JSON:
{
  "name": "Nome Oficial",
  "class": "Classe Farmacológica",
  "mechanism": "Mecanismo de ação simplificado",
  "info": "Informação solicitada detalhada...",
  "warnings": ["Alerta 1", "Alerta 2"]
}
`;

                try {
                    const response = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey}`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{ parts: [{ text: medPrompt }] }],
                                generationConfig: { temperature: 0.2, response_mime_type: "application/json" }
                            })
                        }
                    );

                    const data = await response.json();
                    const info = JSON.parse(data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}");

                    result = {
                        success: true,
                        medication: medName,
                        data: info
                    };

                    structuredData = {
                        type: 'medication_info_card',
                        data: { medication: medName, details: info }
                    };
                } catch (e: any) {
                    result = { error: `Erro ao buscar medicação: ${e.message}` };
                }
                break;
            }

            case 'get_latest_scientific_updates': {
                const limit = args.limit || 5;
                const source = args.source || 'all';

                let query = ctx.supabaseAdmin
                    .from('scientific_updates')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(limit);

                if (source && source !== 'all') {
                    query = query.eq('source', source);
                }

                const { data: updates, error } = await query;

                // Fallback: Se não houver dados recentes (últimas 24h) ou tabela vazia, força uma atualização
                const hasRecentUpdates = updates && updates.length > 0;

                if (!hasRecentUpdates) {
                    // Trigger update via function if empty
                    const supabaseUrl = Deno.env.get('SUPABASE_URL');
                    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

                    try {
                        const updateResp = await fetch(`${supabaseUrl}/functions/v1/scientific-updater`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${serviceKey}` }
                        });
                        const updateData = await updateResp.json();

                        if (updateData.curatedUpdates) {
                            result = {
                                source: 'live_update',
                                updates: updateData.curatedUpdates.slice(0, limit)
                            };
                            structuredData = {
                                type: 'scientific_feed',
                                data: { updates: updateData.curatedUpdates.slice(0, limit) }
                            };
                        } else {
                            result = { message: "Não foram encontradas atualizações no momento." };
                        }
                    } catch (e) {
                        result = { error: "Erro ao buscar atualizações em tempo real." };
                    }
                } else {
                    result = {
                        success: true,
                        count: updates.length,
                        updates: updates.map((u: any) => ({
                            title: u.title,
                            source: u.source,
                            summary: u.summary,
                            url: u.url
                        }))
                    };

                    structuredData = {
                        type: 'scientific_feed',
                        data: { updates }
                    };
                }
                break;
            }

            case 'search_normative_docs': {
                const query = args.query;
                const limit = args.limit || 3;
                const geminiKey = Deno.env.get('GEMINI_API_KEY');

                // 1. Gerar embedding da query
                const embedding = await generateEmbedding(query, geminiKey || '');

                if (!embedding || embedding.length === 0) {
                    // Fallback se falhar embedding (usa Gemini Knowledge direto)
                    const fallbackPrompt = `
Atue como especialista em legislação psicológica (CFP/Brasil).
Responda com base na resolução CFP 06/2019 e Código de Ética: "${query}".
Seja breve e cite a norma.
`;
                    const fallbackResponse = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey}`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ contents: [{ parts: [{ text: fallbackPrompt }] }] })
                        }
                    );
                    const fbData = await fallbackResponse.json();
                    result = {
                        source: 'gemini_knowledge_fallback',
                        answer: fbData?.candidates?.[0]?.content?.parts?.[0]?.text
                    };
                } else {
                    // 2. Buscar vetorialmente (RPC)
                    const { data: docs, error } = await ctx.supabaseAdmin.rpc('match_normative_documents', {
                        query_embedding: embedding,
                        match_threshold: 0.7,
                        match_count: limit
                    });

                    if (error) throw error;

                    if (!docs || docs.length === 0) {
                        result = { message: "Nenhuma norma específica encontrada na base interna. Tente reformular ou adicione os PDFs das resoluções." };
                    } else {
                        result = {
                            success: true,
                            source: 'normative_base',
                            documents: docs.map((d: any) => ({
                                title: d.title,
                                content: d.content, // Pode ser longo, talvez truncar na UI
                                similarity: d.similarity
                            }))
                        };
                        structuredData = {
                            type: 'normative_search_result',
                            data: { results: result.documents }
                        };
                    }
                }
                break;
            }

            case 'draft_official_document': {
                const { type, patientId, demand, recipients } = args;
                const geminiKey = Deno.env.get('GEMINI_API_KEY');

                // 1. Buscar dados do paciente
                const { data: patient } = await ctx.supabaseAdmin.from('patients').select('*').eq('id', patientId).single();
                const { data: notes } = await ctx.supabaseAdmin.from('session_notes').select('notes, created_at').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(5);

                const patientContext = `
PACIENTE: ${patient?.name || 'Nome não encontrado'}
CPF: ${patient?.cpf || 'Não informado'}
HISTÓRICO RECENTE:
${notes?.map((n: any) => `- ${new Date(n.created_at).toLocaleDateString()}: ${n.notes}`).join('\n')}
                `;

                // 2. RAG: Buscar regras para esse tipo de documento
                const embedding = await generateEmbedding(`regras estrutura obrigatória ${type} resolução cfp`, geminiKey || '');
                let normativeContext = "";

                if (embedding.length > 0) {
                    const { data: norms } = await ctx.supabaseAdmin.rpc('match_normative_documents', {
                        query_embedding: embedding,
                        match_threshold: 0.6,
                        match_count: 2
                    });
                    normativeContext = norms?.map((n: any) => `NORMA (${n.title}): ${n.content}`).join('\n\n') || "";
                }

                // 3. Gerar Documento
                const prompt = `
Atue como um Psicólogo Perito rigoroso.
Sua tarefa é redigir uma MINUTA de um documento oficial do tipo: ${type?.toUpperCase()}.

DEMANDA: ${demand}
DESTINATÁRIO: ${recipients || 'A quem de direito'}

CONTEXTO DO PACIENTE:
${patientContext}

REGRAS NORMATIVAS (Siga estritamente):
${normativeContext}
(Se não houver regras acima, siga a Resolução CFP 06/2019 padrão).

ESTRUTURA OBRIGATÓRIA (CFP 06/2019):
1. Identificação
2. Descrição da Demanda
3. Procedimento (Cite: Entrevistas, Testes, Observação)
4. Análise
5. Conclusão (Com encaminhamento se necessário)

REGRAS DE REDAÇÃO:
- Use linguagem técnica, impessoal e objetiva.
- NÃO faça diagnósticos fechados se não houver dados suficientes.
- Use termos como "sugere", "indica", "compatível com".
- ADICIONE AO FINAL: "Este documento é uma sugestão gerada por IA. A revisão e assinatura são de responsabilidade exclusiva do psicólogo (CRP ativo)."

Retorne APENAS o texto do documento, formatado em Markdown.
                `;

                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                    }
                );

                const data = await response.json();
                const documentText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

                result = {
                    success: true,
                    document: documentText,
                    warning: "Este documento é um esboço. Verifique conformidade com a Resolução 06/2019 antes de assinar."
                };

                structuredData = {
                    type: 'official_document_draft',
                    data: {
                        type,
                        content: documentText,
                        patient: patient?.name
                    }
                };

                break;
            }

            case 'find_available_slots': {
                const startDate = args.startDate;
                const endDate = args.endDate || startDate;
                const duration = args.duration || 50; // Default session duration

                // Get existing appointments in the date range
                const { data: appointments } = await ctx.supabaseAdmin
                    .from('appointments')
                    .select('start_time, end_time')
                    .eq('user_id', user.id)
                    .neq('status', 'cancelled')
                    .gte('start_time', startDate)
                    .lte('start_time', endDate + 'T23:59:59')
                    .order('start_time');

                // Define working hours (configurable per user in future)
                const workingHours = {
                    start: 8, // 8 AM
                    end: 20,  // 8 PM
                    breakStart: 12,
                    breakEnd: 13
                };

                const availableSlots: Array<{ date: string; time: string; datetime: string }> = [];

                // Generate date range
                // Use Brazil timezone offset for slot generation
                const current = new Date(startDate + 'T00:00:00-03:00');
                const end = new Date(endDate + 'T23:59:59-03:00');

                while (current <= end) {
                    const dateStr = current.toISOString().split('T')[0];
                    const dayOfWeek = current.getDay();

                    // Skip weekends
                    if (dayOfWeek === 0 || dayOfWeek === 6) {
                        current.setDate(current.getDate() + 1);
                        continue;
                    }

                    // Generate slots for this day
                    for (let hour = workingHours.start; hour < workingHours.end; hour++) {
                        // Skip lunch break
                        if (hour >= workingHours.breakStart && hour < workingHours.breakEnd) continue;

                        // Check every 30 minutes (half-hour slots)
                        for (const minute of [0, 30]) {
                            // Append -03:00 so slot times are interpreted as Brazil local time
                            const slotStart = new Date(dateStr + 'T' +
                                String(hour).padStart(2, '0') + ':' +
                                String(minute).padStart(2, '0') + ':00-03:00');
                            const slotEnd = new Date(slotStart.getTime() + duration * 60000);

                            // Skip if slot is in the past
                            if (slotStart < new Date()) continue;

                            // Check for conflicts with existing appointments
                            const hasConflict = appointments?.some((appt: any) => {
                                const apptStart = new Date(appt.start_time);
                                const apptEnd = new Date(appt.end_time);
                                return (slotStart < apptEnd && slotEnd > apptStart);
                            });

                            if (!hasConflict) {
                                // Apply time preference filter
                                if (args.preferredTime) {
                                    if (args.preferredTime === 'morning' && hour >= 12) continue;
                                    if (args.preferredTime === 'afternoon' && (hour < 12 || hour >= 18)) continue;
                                    if (args.preferredTime === 'evening' && hour < 18) continue;
                                }

                                availableSlots.push({
                                    date: dateStr,
                                    time: new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(slotStart),
                                    datetime: slotStart.toISOString()
                                });

                                // Limit to first 10 slots to avoid overwhelming response
                                if (availableSlots.length >= 10) break;
                            }
                        }
                        if (availableSlots.length >= 10) break;
                    }

                    current.setDate(current.getDate() + 1);
                    if (availableSlots.length >= 10) break;
                }

                if (availableSlots.length === 0) {
                    result = {
                        message: "Não encontrei horários disponíveis no período solicitado.",
                        suggestion: "Tente expandir o período ou verificar outra semana."
                    };
                } else {
                    result = {
                        success: true,
                        total_slots: availableSlots.length,
                        available_slots: availableSlots,
                        message: `Encontrei ${availableSlots.length} horários livres.`
                    };
                    structuredData = {
                        type: 'available_slots_list',
                        data: { slots: availableSlots }
                    };
                }
                break;
            }

            case 'get_financial_metrics': {
                const now = new Date();
                const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
                const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

                const { data, error } = await ctx.supabaseAdmin.rpc('get_financial_metrics', { p_user_id: user.id, p_start_date: startDate, p_end_date: endDate });

                if (!error && data) {
                    result = { metrics: data };
                    structuredData = { type: 'financial_summary_widget', data: { metrics: data } };
                } else {
                    result = { error: "Não foi possível calcular métricas." };
                }
                break;
            }

            case 'list_transactions': {
                const { data } = await supabaseUser
                    .from('financial_entries')
                    .select('*')
                    .order('due_date', { ascending: false })
                    .order('created_at', { ascending: false })
                    .limit(args.limit || 5);
                result = { transactions: data };
                structuredData = {
                    type: 'interactive_table',
                    data: {
                        title: 'Ultimos Lancamentos',
                        headers: ['Data', 'Desc.', 'Valor'],
                        rows: data?.map((t: any) => [
                            (t.paid_at?.slice(0, 10) || t.due_date || t.competence_date || t.created_at?.slice(0, 10) || '').split('-').reverse().join('/'),
                            t.description || t.title,
                            `R$ ${t.amount}`
                        ]) || []
                    }
                };
                break;
            }

            case 'create_transaction': {
                const amount = Math.abs(Number(args.amount || 0));
                const entryDate = args.date || new Date().toISOString().split('T')[0];
                const idempotencyKey = buildSynapseEntryIdempotencyKey(ctx, 'create_transaction');

                const { data: existingTransaction, error: existingError } = await ctx.supabaseAdmin
                    .from('financial_entries')
                    .select('*')
                    .eq('professional_id', user.id)
                    .eq('idempotency_key', idempotencyKey)
                    .maybeSingle();

                if (existingError) {
                    result = { error: `Erro ao verificar idempotencia: ${existingError.message}` };
                    break;
                }

                if (existingTransaction) {
                    const formattedValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(existingTransaction.amount || amount));
                    result = {
                        success: true,
                        message: `Lancamento de ${formattedValue} ja estava registrado. Mantive o registro existente para evitar duplicidade.`,
                        transactionId: existingTransaction.id,
                        idempotencyKey,
                    };
                    structuredData = {
                        type: 'transaction_created',
                        data: { transaction: existingTransaction }
                    };
                    break;
                }

                const { data: transaction, error: createError } = await ctx.supabaseAdmin
                    .from('financial_entries')
                    .insert({
                        professional_id: user.id,
                        idempotency_key: idempotencyKey,
                        title: args.description,
                        description: args.description,
                        amount: amount,
                        type: args.type,
                        patient_id: args.patientId || null,
                        due_date: entryDate,
                        competence_date: entryDate,
                        paid_at: `${entryDate}T12:00:00.000Z`,
                        status: 'paid',
                        payment_method: 'manual',
                        origin: 'manual',
                        metadata: {
                            category: args.category || 'Outros',
                            source: 'synapse_global',
                            legacy_tool: 'create_transaction',
                            channel: ctx?.channel || 'app',
                            session_id: ctx?.sessionId || null,
                            source_message_id: ctx?.source?.source_message_id || null,
                        },
                    })
                    .select()
                    .single();

                if (createError) {
                    result = { error: `Erro ao criar transação: ${createError.message}` };
                } else {
                    const formattedValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
                    result = {
                        success: true,
                        message: `💰 Transação de ${formattedValue} registrada com sucesso!`,
                        transactionId: transaction.id
                    };
                    structuredData = {
                        type: 'transaction_created',
                        data: { transaction }
                    };
                }
                break;
            }

            case 'generate_financial_report': {
                const startDate = args.startDate;
                const endDate = args.endDate || startDate;
                let query = ctx.supabaseAdmin
                    .from('financial_entries')
                    .select('*')
                    .eq('professional_id', user.id)
                    .gte('due_date', startDate)
                    .lte('due_date', endDate)
                    .order('due_date', { ascending: true });

                if (args.type && args.type !== 'all') {
                    query = query.eq('type', args.type);
                }

                if (args.category) {
                    query = query.filter('metadata->>category', 'ilike', `%${args.category}%`);
                }

                const { data: transactions, error } = await query;

                if (error) {
                    result = { error: `Erro ao gerar relatório: ${error.message}` };
                    break;
                }

                if (!transactions || transactions.length === 0) {
                    result = { message: "Nenhuma transação encontrada no período selecionado." };
                    break;
                }

                // Calculate aggregates
                const income = transactions
                    .filter((t: any) => t.type === 'income')
                    .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

                const expenses = transactions
                    .filter((t: any) => t.type === 'expense')
                    .reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount)), 0);

                const balance = income - expenses;

                result = {
                    period: `${startDate} a ${endDate}`,
                    total_transactions: transactions.length,
                    income,
                    expenses,
                    balance,
                    transactions: transactions.length <= 10 ? transactions : "Mais de 10 transações..."
                };

                structuredData = {
                    type: 'financial_report_widget',
                    data: {
                        startDate,
                        endDate,
                        income,
                        expenses,
                        balance,
                        chartData: transactions.map((t: any) => ({
                            date: t.due_date || t.competence_date || t.created_at?.slice(0, 10),
                            amount: Number(t.amount),
                            type: t.type
                        }))
                    }
                };
                break;
            }

            case 'send_payment_reminder': {
                // Get patient details to confirm valid contact
                const { data: patient, error: fetchError } = await ctx.supabaseAdmin
                    .from('patients')
                    .select('name, phone, email')
                    .eq('id', args.patientId)
                    .eq('user_id', user.id)
                    .single();

                if (fetchError || !patient) {
                    result = { error: "Paciente não encontrado." };
                    break;
                }

                // This tool sends a WhatsApp message if phone exists, customized for billing
                if (!patient.phone) {
                    result = { error: `Paciente ${patient.name} não possui telefone cadastrado para cobrança.` };
                    break;
                }

                const formattedValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(args.amount);
                const dueDateMsg = args.dueDate
                    ? ` com vencimento em *${new Date(args.dueDate).toLocaleDateString('pt-BR')}*`
                    : '';

                const reminderMessage = `Olá ${patient.name}, este é um lembrete amigável sobre o pagamento de ${formattedValue}${dueDateMsg}. Caso já tenha efetuado, por favor desconsidere.`;

                // Reuse whatsapp sending logic by calling internal function or just simulating the action request
                // For now, we will structure this as a specialized WhatsApp intent that the frontend or another tool execution can confirm

                // Check if user has whatsapp connected
                // ... (simplified logic: trust the intent if existing tools cover it, or direct call)

                // Call whatsapp-send directly
                const formattedPhone = patient.phone.replace(/\D/g, '');
                const { data: conversation } = await ctx.supabaseAdmin
                    .from('whatsapp_conversations')
                    .select('id, remote_jid')
                    .eq('user_id', user.id)
                    .or(`patient_phone.eq.${formattedPhone},remote_jid.ilike.%${formattedPhone}%`)
                    .maybeSingle();

                if (conversation) {
                    const supabaseUrl = Deno.env.get('SUPABASE_URL');
                    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

                    try {
                        const sendResponse = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${serviceKey}`
                            },
                            body: JSON.stringify({
                                conversationId: conversation.id,
                                remoteJid: conversation.remote_jid,
                                message: reminderMessage,
                                messageType: 'text'
                            })
                        });
                        const sendResult = await sendResponse.json();

                        if (sendResult.success) {
                            result = {
                                success: true,
                                message: `✅ Lembrete de pagamento enviado para ${patient.name} via WhatsApp!`,
                                details: reminderMessage
                            };
                            structuredData = {
                                type: 'payment_reminder_sent',
                                data: { patientName: patient.name, amount: formattedValue, method: 'whatsapp' }
                            };
                        } else {
                            result = { error: `Falha ao enviar mensagem de cobrança: ${sendResult.error}` };
                        }
                    } catch (e: any) {
                        result = { error: `Erro na API de envio: ${e.message}` };
                    }
                } else {
                    // Fallback: Suggest creating conversation first or warn
                    result = {
                        error: `Não foi possível enviar mensagem automática para ${patient.name} (sem conversa ativa).`,
                        suggestion: "Envie uma mensagem manual primeiro para abrir a janela de 24h."
                    };
                }
                break;
            }

            case 'draft_invoice': {
                result = { success: true, status: "Widget de fatura gerado" };
                structuredData = { type: 'review_invoice_draft', payload: { ...args } };
                break;
            }

            case 'generate_document': {
                result = { success: true, status: "Pré-visualização gerada" };
                structuredData = {
                    type: 'document_preview',
                    data: { type: args.type, title: args.title, content_html: args.content_html, patientName: args.patientName }
                };
                break;
            }

            case 'draft_email': {
                result = { success: true, status: "Rascunho de email criado" };
                structuredData = { type: 'review_draft', payload: { ...args } };
                break;
            }

            case 'create_patient': {
                const emergencyContact = [args.emergency_name, args.emergency_phone].filter(Boolean).join(" - ");

                const { data, error } = await supabaseUser.from('patients').insert({
                    user_id: user.id,
                    name: args.name,
                    email: args.email || null,
                    phone: args.phone || null,
                    cpf: args.cpf || null,
                    diagnosis: args.diagnosis || null,
                    notes: args.notes || null,
                    status: 'pending',
                    birth_date: args.birth_date || null,
                    address: args.address || null,
                    emergency_contact: emergencyContact || null,
                    payer_type: args.payer_type || 'patient',
                    payer_name: args.payer_name || null,
                    payer_cpf: args.payer_cpf || null,
                    medications: args.medications || []
                }).select().single();

                if (!error) {
                    result = { success: true, message: `Paciente ${data.name} cadastrado com sucesso!`, patientId: data.id };
                    structuredData = { type: 'patient_card', data: data };
                } else {
                    console.error("Erro ao criar paciente:", error);
                    result = { error: `Erro ao criar paciente: ${error.message}` };
                }
                break;
            }

            case 'send_whatsapp_message': {
                // First, get patient data if we only have ID
                let phone = args.patientPhone;
                let patientName = args.patientName;

                if (args.patientId && (!phone || !patientName)) {
                    const { data: patient } = await ctx.supabaseAdmin
                        .from('patients')
                        .select('name, phone')
                        .eq('id', args.patientId)
                        .single();

                    if (patient) {
                        phone = phone || patient.phone;
                        patientName = patientName || patient.name;
                    }
                }

                if (!phone) {
                    result = { error: "Paciente não possui número de telefone cadastrado." };
                    break;
                }

                // Format phone number
                const formattedPhone = phone.replace(/\D/g, '');

                // Check for existing conversation
                const { data: conversation } = await ctx.supabaseAdmin
                    .from('whatsapp_conversations')
                    .select('id, remote_jid')
                    .eq('user_id', user.id)
                    .or(`patient_phone.eq.${formattedPhone},remote_jid.ilike.%${formattedPhone}%`)
                    .maybeSingle();

                if (!conversation) {
                    result = {
                        error: `Não encontrei uma conversa WhatsApp ativa com ${patientName}. O paciente precisa ter enviado uma mensagem primeiro.`,
                        suggestion: "O paciente precisa iniciar uma conversa via WhatsApp primeiro."
                    };
                    structuredData = { type: 'whatsapp_not_found', data: { patientName, phone: formattedPhone } };
                    break;
                }

                // Call the whatsapp-send Edge Function
                const supabaseUrl = Deno.env.get('SUPABASE_URL');
                const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

                try {
                    const sendResponse = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${serviceKey}`
                        },
                        body: JSON.stringify({
                            conversationId: conversation.id,
                            remoteJid: conversation.remote_jid,
                            message: args.message,
                            messageType: 'text'
                        })
                    });

                    const sendResult = await sendResponse.json();

                    if (sendResult.success) {
                        result = {
                            success: true,
                            message: `✅ Mensagem enviada para ${patientName} via WhatsApp!`,
                            sentTo: phone
                        };
                        structuredData = {
                            type: 'whatsapp_sent',
                            data: { patientName, message: args.message, phone: formattedPhone }
                        };
                    } else {
                        result = { error: sendResult.error || "Falha ao enviar mensagem WhatsApp." };
                    }
                } catch (e: any) {
                    result = { error: `Erro ao enviar WhatsApp: ${e.message}` };
                }
                break;
            }

            case 'read_whatsapp_conversations': {
                let query = ctx.supabaseAdmin
                    .from('whatsapp_conversations')
                    .select(`
                        id,
                        patient_name,
                        patient_phone,
                        conversation_kind,
                        last_message_preview,
                        last_message_at,
                        unread_count
                    `)
                    .eq('user_id', user.id)
                    .order('last_message_at', { ascending: false })
                    .limit(args.limit || 5);

                if (args.patientName) {
                    query = query.ilike('patient_name', `%${args.patientName}%`);
                }

                const { data: conversations, error } = await query;

                if (error) {
                    result = { error: error.message };
                    break;
                }

                if (!conversations || conversations.length === 0) {
                    result = { message: "Nenhuma conversa WhatsApp encontrada." };
                    break;
                }

                result = {
                    total: conversations.length,
                    conversations: conversations.map((c: any) => ({
                        name: c.patient_name,
                        phone: c.patient_phone,
                        kind: c.conversation_kind,
                        lastMessage: c.last_message_preview,
                        lastAt: c.last_message_at,
                        unread: c.unread_count
                    }))
                };

                structuredData = {
                    type: 'whatsapp_conversations_list',
                    data: { conversations }
                };
                break;
            }

            case 'send_email': {
                // Get patient email if needed
                let toEmail = args.to;
                let patientName = args.patientName;

                if (args.patientId && !toEmail) {
                    const { data: patient } = await ctx.supabaseAdmin
                        .from('patients')
                        .select('name, email')
                        .eq('id', args.patientId)
                        .single();

                    if (patient) {
                        toEmail = patient.email;
                        patientName = patientName || patient.name;
                    }
                }

                if (!toEmail) {
                    result = { error: "Paciente não possui email cadastrado ou email não fornecido." };
                    break;
                }

                // Get Google tokens with refresh support
                const { data: gTokens } = await ctx.supabaseAdmin
                    .from('user_google_tokens')
                    .select('*')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (!gTokens?.access_token) {
                    result = {
                        error: "Conta Google não conectada. Conecte sua conta nas Configurações para enviar emails.",
                        action_required: "connect_google"
                    };
                    structuredData = { type: 'google_not_connected', data: {} };
                    break;
                }

                let gmailAccessToken = gTokens.access_token;

                // Refresh token if expired (within 60s)
                if (gTokens.expires_at && new Date(gTokens.expires_at) < new Date(Date.now() + 60000) && gTokens.refresh_token) {
                    try {
                        const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
                        const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
                        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            body: new URLSearchParams({
                                client_id: GOOGLE_CLIENT_ID!,
                                client_secret: GOOGLE_CLIENT_SECRET!,
                                refresh_token: gTokens.refresh_token,
                                grant_type: 'refresh_token',
                            }).toString(),
                        });
                        if (tokenRes.ok) {
                            const newTokens = await tokenRes.json();
                            gmailAccessToken = newTokens.access_token;
                            await ctx.supabaseAdmin
                                .from('user_google_tokens')
                                .update({ access_token: gmailAccessToken, expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString() })
                                .eq('user_id', user.id);
                        }
                    } catch (refreshErr: any) {
                        console.error('[send_email] Token refresh failed:', refreshErr.message);
                    }
                }

                // Get sender profile
                const { data: senderProfile } = await ctx.supabaseAdmin
                    .from('profiles')
                    .select('first_name, last_name')
                    .eq('id', user.id)
                    .single();
                const senderName = senderProfile?.first_name ? `${senderProfile.first_name} ${senderProfile.last_name || ''}`.trim() : 'NeuroNex';

                try {
                    // Build raw MIME email
                    const toB64 = (s: string) => {
                        const bytes = new TextEncoder().encode(s);
                        return btoa(Array.from(bytes, (b) => String.fromCodePoint(b)).join(""));
                    };
                    const toUrlSafeB64 = (s: string) => toB64(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

                    const rawParts = [
                        `To: ${toEmail}`,
                        `From: ${senderName} <${user.email}>`,
                        `Subject: =?utf-8?B?${toB64(args.subject)}?=`,
                        'MIME-Version: 1.0',
                        'Content-Type: text/html; charset="UTF-8"',
                        'Content-Transfer-Encoding: base64',
                        '',
                        toB64(args.body || ''),
                    ];
                    const rawEmail = rawParts.join('\r\n');

                    const gmailRes = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${gmailAccessToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ raw: toUrlSafeB64(rawEmail) }),
                    });

                    if (gmailRes.ok) {
                        result = {
                            success: true,
                            message: `✅ Email enviado para ${patientName || toEmail}!`,
                            sentTo: toEmail
                        };
                        structuredData = {
                            type: 'email_sent',
                            data: { to: toEmail, subject: args.subject, patientName }
                        };
                    } else {
                        const errBody = await gmailRes.text();
                        console.error('[send_email] Gmail API error:', errBody);
                        result = { error: `Erro da API Gmail: ${errBody}` };
                    }
                } catch (e: any) {
                    result = { error: `Erro ao enviar email: ${e.message}` };
                }
                break;
            }

            case 'create_session_note': {
                // Get patient name if not provided
                let patientName = args.patientName;
                if (!patientName && args.patientId) {
                    const { data: patient } = await ctx.supabaseAdmin
                        .from('patients')
                        .select('name')
                        .eq('id', args.patientId)
                        .single();
                    patientName = patient?.name || 'Paciente';
                }

                // Create the session note
                const { data: note, error } = await ctx.supabaseAdmin
                    .from('session_notes')
                    .insert({
                        user_id: user.id,
                        patient_id: args.patientId,
                        appointment_id: args.appointmentId || null,
                        notes: args.notes,
                        created_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (error) {
                    result = { error: `Erro ao criar anotação: ${error.message}` };
                } else {
                    result = {
                        success: true,
                        message: `📝 Anotação registrada para ${patientName}!`,
                        noteId: note.id
                    };
                    structuredData = {
                        type: 'session_note_created',
                        data: { patientName, notes: args.notes, noteId: note.id }
                    };
                }
                break;
            }

            case 'update_patient_info': {
                // Build update object with only provided fields
                const updateData: any = {};
                const fieldsToUpdate = ['name', 'email', 'phone', 'diagnosis', 'notes', 'address', 'birth_date', 'emergency_contact', 'status'];

                for (const field of fieldsToUpdate) {
                    if (args[field] !== undefined && args[field] !== null) {
                        updateData[field] = args[field];
                    }
                }

                if (Object.keys(updateData).length === 0) {
                    result = { error: "Nenhum campo para atualizar foi fornecido." };
                    break;
                }

                // Get current patient data for confirmation
                let patientName = args.patientName;
                if (!patientName) {
                    const { data: patient } = await ctx.supabaseAdmin
                        .from('patients')
                        .select('name')
                        .eq('id', args.patientId)
                        .single();
                    patientName = patient?.name || 'Paciente';
                }

                // Update patient
                const { error } = await ctx.supabaseAdmin
                    .from('patients')
                    .update(updateData)
                    .eq('id', args.patientId)
                    .eq('user_id', user.id);

                if (error) {
                    result = { error: `Erro ao atualizar paciente: ${error.message}` };
                } else {
                    const updatedFields = Object.keys(updateData).join(', ');
                    result = {
                        success: true,
                        message: `✅ Dados de ${patientName} atualizados: ${updatedFields}`,
                        updatedFields: Object.keys(updateData)
                    };
                    structuredData = {
                        type: 'patient_updated',
                        data: { patientName, patientId: args.patientId, updatedFields: updateData }
                    };
                }
                break;
            }

            case 'add_patient_medication': {
                // Get current medications
                const { data: patient, error: fetchError } = await ctx.supabaseAdmin
                    .from('patients')
                    .select('name, medications')
                    .eq('id', args.patientId)
                    .eq('user_id', user.id)
                    .single();

                if (fetchError || !patient) {
                    result = { error: "Paciente não encontrado." };
                    break;
                }

                const patientName = args.patientName || patient.name;
                let medications = patient.medications || [];
                const action = args.action || 'add';

                const newMedication = {
                    name: args.medicationName,
                    dosage: args.dosage || '',
                    frequency: args.frequency || '',
                    addedAt: new Date().toISOString()
                };

                if (action === 'add') {
                    // Check if medication already exists
                    const existingIndex = medications.findIndex((m: any) =>
                        m.name?.toLowerCase() === args.medicationName?.toLowerCase()
                    );

                    if (existingIndex >= 0) {
                        // Update existing
                        medications[existingIndex] = { ...medications[existingIndex], ...newMedication };
                    } else {
                        // Add new
                        medications.push(newMedication);
                    }
                } else if (action === 'remove') {
                    medications = medications.filter((m: any) =>
                        m.name?.toLowerCase() !== args.medicationName?.toLowerCase()
                    );
                } else if (action === 'update') {
                    const existingIndex = medications.findIndex((m: any) =>
                        m.name?.toLowerCase() === args.medicationName?.toLowerCase()
                    );
                    if (existingIndex >= 0) {
                        medications[existingIndex] = { ...medications[existingIndex], ...newMedication };
                    }
                }

                // Save updated medications
                const { error: updateError } = await ctx.supabaseAdmin
                    .from('patients')
                    .update({ medications })
                    .eq('id', args.patientId);

                if (updateError) {
                    result = { error: `Erro ao atualizar medicações: ${updateError.message}` };
                } else {
                    const actionText = action === 'add' ? 'adicionado' : action === 'remove' ? 'removido' : 'atualizado';
                    result = {
                        success: true,
                        message: `💊 ${args.medicationName} ${actionText} para ${patientName}!`,
                        currentMedications: medications
                    };
                    structuredData = {
                        type: 'medication_updated',
                        data: { patientName, medication: newMedication, action, allMedications: medications }
                    };
                }
                break;
            }

            case 'navigate_system': {
                result = { success: true, navigatedTo: args.path };
                structuredData = { type: 'navigation_action', data: { path: args.path, reason: args.reason } };
                break;
            }

        }
    } catch (e: any) {
        console.error(`Error executing tool ${name}:`, e);
        result = { error: `Falha na ferramenta ${name}: ${e.message}` };
    }

    return { result, structuredData };
}
