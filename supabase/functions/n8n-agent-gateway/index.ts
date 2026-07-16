import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { prepareAppointmentActionPlan } from '../_shared/appointment-action-plans.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const normalizeIdempotencyPart = (value: unknown) =>
  String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9:._-]+/g, '_')
    .slice(0, 140);

const buildN8nFinancialIdempotencyKey = (action: string, professionalId: string, params: any, body: any) => {
  const explicitKey = params?.idempotency_key || body?.idempotency_key;
  if (explicitKey) return `n8n:${action}:${normalizeIdempotencyPart(explicitKey)}`;

  const sourceMessageId = params?.source_message_id || body?.source_message_id || params?.message_id || body?.message_id;
  if (sourceMessageId) return `n8n:${action}:${normalizeIdempotencyPart(sourceMessageId)}`;

  return `n8n:${action}:${normalizeIdempotencyPart(professionalId)}:${crypto.randomUUID()}`;
};

// ── Gmail Helpers ──────────────────────────────────────────────────────
const toBase64 = (str: string) => {
  const bytes = new TextEncoder().encode(str);
  const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join('');
  return btoa(binString);
};

const toUrlSafeBase64 = (str: string) => {
  return toBase64(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function refreshGoogleAccessToken(supabase: any, userId: string, refreshToken: string) {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')?.trim();
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')?.trim();
  if (!clientId || !clientSecret) throw new Error('GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET não configurados.');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  });

  if (!res.ok) throw new Error('Falha ao renovar o token Google do profissional.');
  const tokens = await res.json();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await supabase.from('user_google_tokens').update({
    access_token: tokens.access_token,
    expires_at: expiresAt.toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId);

  return tokens.access_token;
}

// ── Helper: Obter access token válido do Gmail ─────────────────────────
async function getValidGmailToken(supabaseClient: any, userId: string) {
  const { data: tokenData, error: tokenError } = await supabaseClient
    .from('user_google_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (tokenError || !tokenData) {
    throw new Error('O profissional não tem uma conta Google conectada ao NeuroNex. Peça para ele conectar em Configurações > Integrações.');
  }

  let accessToken = tokenData.access_token;
  if (new Date(tokenData.expires_at) < new Date(Date.now() + 60000)) {
    accessToken = await refreshGoogleAccessToken(supabaseClient, userId, tokenData.refresh_token);
  }

  return accessToken;
}

// ── Helper: Enviar email via Gmail API ──────────────────────────────────
async function sendViaGmail(accessToken: string, rawEmail: string) {
  const gmailRes = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: toUrlSafeBase64(rawEmail) }),
  });

  if (!gmailRes.ok) {
    const errText = await gmailRes.text();
    throw new Error(`Erro ao enviar email via Gmail: ${errText}`);
  }

  return await gmailRes.json();
}

// ── Helper: Buscar dados do sender ──────────────────────────────────────
async function getSenderInfo(supabaseClient: any, accessToken: string, userId: string) {
  const { data: profileData } = await supabaseClient
    .from('profiles')
    .select('full_name, first_name, last_name, clinic_name, address_line1, address_city')
    .eq('id', userId)
    .single();

  const senderName = profileData?.full_name
    || [profileData?.first_name, profileData?.last_name].filter(Boolean).join(' ')
    || 'Psicólogo';

  const profileRes = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  let senderEmail = 'noreply@neuronex.app';
  if (profileRes.ok) {
    const gmailProfile = await profileRes.json();
    senderEmail = gmailProfile.emailAddress;
  }

  return { senderName, senderEmail, profile: profileData };
}

// ── Helper: Persistir conversa no NeuroNex (para aparecer no Synapse Global) ──
async function persistConversation(
  supabaseClient: any,
  profissionalId: string,
  userMessage: string,
  agentResponse: string
) {
  const channelSessionId = `whatsapp:${profissionalId}:n8n-agent@internal`;

  // 1. Buscar ou criar binding existente
  const { data: binding } = await supabaseClient
    .from('synapse_channel_bindings')
    .select('id')
    .eq('session_id', channelSessionId)
    .single();

  let sessionId;

  if (binding) {
    sessionId = binding.id;

    // Atualizar last_seen_at
    await supabaseClient
      .from('synapse_channel_bindings')
      .update({ last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', sessionId);
  } else {
    // Criar chat_session + binding
    sessionId = crypto.randomUUID();

    await supabaseClient.from('chat_sessions').insert({
      id: sessionId,
      user_id: profissionalId,
      title: 'WhatsApp: Agente N8N'
    });

    await supabaseClient.from('synapse_channel_bindings').insert({
      id: sessionId,
      professional_id: profissionalId,
      channel: 'whatsapp',
      external_user_id: 'n8n-agent@internal',
      session_id: channelSessionId,
      instance_name: 'n8n-agent',
      push_name: 'Agente N8N'
    });
  }

  // 2. Salvar mensagem do usuário
  if (userMessage) {
    await supabaseClient.from('messages').insert([{
      user_id: profissionalId,
      content: userMessage,
      role: 'user',
      session_id: sessionId,
    }]);
  }

  // 3. Salvar resposta do agente
  if (agentResponse) {
    await supabaseClient.from('messages').insert([{
      user_id: profissionalId,
      content: agentResponse,
      role: 'assistant',
      session_id: sessionId,
    }]);
  }

  // 4. Atualizar título do chat session com updated_at
  await supabaseClient
    .from('chat_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  return sessionId;
}


// ── Templates de Email ─────────────────────────────────────────────────

function buildAppointmentReminderHtml(params: {
  patientFirstName: string;
  dateFormatted: string;
  timeFormatted: string;
  locationLabel: string;
  locationText: string;
  confirmationLink?: string;
}) {
  const { patientFirstName, dateFormatted, timeFormatted, locationLabel, locationText, confirmationLink } = params;

  const confirmButton = confirmationLink ? `
    <a href="${confirmationLink}" style="display: inline-block; background-color: #fff; color: #000; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: bold;">Confirmar Presença</a>
  ` : '';

  return `
  <!DOCTYPE html>
  <html>
  <body style="margin: 0; padding: 0; background-color: #000000; font-family: sans-serif; color: #ffffff;">
    <div style="background-color: #000000; padding: 40px 20px;">
      <div style="max-width: 500px; margin: 0 auto; background-color: #09090b; border: 1px solid #27272a; border-radius: 24px; padding: 40px; text-align: center;">
        <h2 style="margin: 0; color: #fff;">Olá, ${patientFirstName}</h2>
        <p style="color: #a1a1aa; margin-top: 10px;">Lembrete do seu agendamento.</p>
        
        <div style="background-color: #18181b; padding: 20px; border-radius: 16px; margin: 30px 0;">
           <div style="font-size: 32px; font-weight: bold; color: #fff;">${timeFormatted}</div>
           <div style="color: #A855F7; text-transform: uppercase; font-size: 14px; margin-top: 5px;">${dateFormatted}</div>
           <br/>
           <div style="font-size: 12px; color: #52525b; text-transform: uppercase;">${locationLabel}</div>
           <div style="color: #e4e4e7; font-size: 14px; margin-top: 5px;">${locationText}</div>
        </div>

        ${confirmButton}
        
        <p style="margin-top: 30px; font-size: 12px; color: #52525b;">Enviado via NeuroNex</p>
      </div>
    </div>
  </body>
  </html>`;
}

function buildAppointmentConfirmationHtml(params: {
  patientFirstName: string;
  dateFormatted: string;
  timeFormatted: string;
  locationLabel: string;
  locationText: string;
  professionalName: string;
}) {
  const { patientFirstName, dateFormatted, timeFormatted, locationLabel, locationText, professionalName } = params;

  return `
  <!DOCTYPE html>
  <html>
  <body style="margin: 0; padding: 0; background-color: #000000; font-family: sans-serif; color: #ffffff;">
    <div style="background-color: #000000; padding: 40px 20px;">
      <div style="max-width: 500px; margin: 0 auto; background-color: #09090b; border: 1px solid #27272a; border-radius: 24px; padding: 40px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
        <h2 style="margin: 0; color: #fff;">Consulta Confirmada!</h2>
        <p style="color: #a1a1aa; margin-top: 10px;">Olá, ${patientFirstName}. Sua consulta com ${professionalName} está confirmada.</p>
        
        <div style="background-color: #18181b; padding: 20px; border-radius: 16px; margin: 30px 0;">
           <div style="font-size: 32px; font-weight: bold; color: #fff;">${timeFormatted}</div>
           <div style="color: #A855F7; text-transform: uppercase; font-size: 14px; margin-top: 5px;">${dateFormatted}</div>
           <br/>
           <div style="font-size: 12px; color: #52525b; text-transform: uppercase;">${locationLabel}</div>
           <div style="color: #e4e4e7; font-size: 14px; margin-top: 5px;">${locationText}</div>
        </div>
        
        <p style="margin-top: 30px; font-size: 12px; color: #52525b;">Enviado via NeuroNex</p>
      </div>
    </div>
  </body>
  </html>`;
}

// ── Helper: Formatar dados da consulta ──────────────────────────────────
function formatAppointmentDetails(appointment: any, profile: any) {
  const dateDate = new Date(appointment.start_time);
  const rawDateFormatted = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(dateDate);

  const dateFormatted = rawDateFormatted.charAt(0).toUpperCase() + rawDateFormatted.slice(1);

  const timeFormatted = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit'
  }).format(dateDate);

  let locationLabel = '';
  let locationText = '';

  if (appointment.type === 'online') {
    locationLabel = 'Link da Sala';
    locationText = appointment.google_meet_link
      ? `<a href="${appointment.google_meet_link}" style="color: #A855F7; text-decoration: none;">Acessar Sala Virtual</a>`
      : 'Link será gerado em breve';
  } else {
    locationLabel = 'Endereço';
    const address = appointment.location || profile?.address_line1 || 'Endereço não cadastrado';
    const city = profile?.address_city ? ` - ${profile.address_city}` : '';
    locationText = `${address}${city}`;
  }

  return { dateFormatted, timeFormatted, locationLabel, locationText };
}


serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Auth Check
    const authHeader = req.headers.get('Authorization');
    const expectedToken = Deno.env.get('N8N_WEBHOOK_SECRET');
    if (!expectedToken) {
      return new Response(JSON.stringify({ error: 'Gateway secret is not configured.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (authHeader !== `Bearer ${expectedToken}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized. Invalid Bearer token.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Parse Payload
    const bodyText = await req.text();
    if (!bodyText) {
      throw new Error('Empty request body');
    }

    let body;
    try {
      body = JSON.parse(bodyText);
    } catch (e) {
      throw new Error('Invalid JSON payload');
    }

    const { action, profissional_id, params } = body;

    const actionClean = action?.trim();
    const profissionalIdClean = profissional_id?.trim();

    if (!profissionalIdClean || !actionClean) {
      throw new Error('Os campos `profissional_id` e `action` são obrigatórios no payload JSON.');
    }

    // 3. Setup Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim() ?? '';
    const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? '';

    if (!supabaseUrl || !supabaseServiceRole) {
      throw new Error('Configuração interna do Supabase/Edge Functions ausente.');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceRole, {
      auth: { persistSession: false }
    });

    let result = null;

    // =========================================================================
    // 4. Action Router
    // =========================================================================
    switch (actionClean) {

      // ✅ AGENDA / COMPROMISSOS =================================================
      case 'get_appointments': {
        const { start_date, end_date } = params || {};
        let query = supabaseClient.from('appointments').select(`
          *,
          patients(id, name, email, phone)
        `).eq('user_id', profissionalIdClean);

        if (start_date) query = query.gte('start_time', start_date);
        if (end_date) query = query.lte('end_time', end_date);

        const { data, error } = await query.order('start_time', { ascending: true });
        if (error) throw error;
        result = data;
        break;
      }

      case 'create_appointment': {
        const { patient_id, start_time, end_time, type = 'presencial', notes, location } = params || {};
        if (!start_time || !end_time) throw new Error('Parâmetros `start_time` e `end_time` são obrigatórios para agendamentos.');
        result = await prepareAppointmentActionPlan(
          {
            admin: supabaseClient,
            userId: profissionalIdClean,
            sessionId: params?.conversation_id || null,
            channel: 'whatsapp',
            whatsappMessageId: params?.message_id || params?.source_message_id || null,
            correlationId: params?.correlation_id || params?.source_message_id || null,
          },
          'create_appointment',
          'create',
          {
            patient_id: patient_id || null,
            start_time,
            end_time,
            type,
            notes: notes || null,
            location: location || null,
            frequency: params?.frequency || (Number(params?.occurrence_count || 1) > 1 ? 'weekly' : 'single'),
            occurrence_count: Number(params?.occurrence_count || 1),
            package_id: params?.package_id || null,
            communication: params?.communication || { sendConfirmation: true, provider: 'configured' },
            financial: params?.financial || { mode: params?.financial_mode || 'none' },
            fiscal: params?.fiscal || { automationEnabled: false, trigger: 'professional_settings' },
          },
          buildN8nFinancialIdempotencyKey('prepare_appointment', profissionalIdClean, params, body),
        );
        break;
      }

      case 'reschedule_appointment': {
        const { appointment_id, start_time, end_time } = params || {};
        if (!appointment_id || !start_time || !end_time) {
          throw new Error('Parâmetros `appointment_id`, `start_time` e `end_time` são obrigatórios.');
        }
        result = await prepareAppointmentActionPlan(
          {
            admin: supabaseClient,
            userId: profissionalIdClean,
            sessionId: params?.conversation_id || null,
            channel: 'whatsapp',
            whatsappMessageId: params?.message_id || params?.source_message_id || null,
            correlationId: params?.correlation_id || params?.source_message_id || null,
          },
          'reschedule_appointment',
          'reschedule',
          {
            appointment_id,
            start_time,
            end_time,
            type: params?.type || null,
            location: params?.location || null,
            communication: params?.communication || { sendConfirmation: true, provider: 'configured' },
          },
          buildN8nFinancialIdempotencyKey('prepare_reschedule', profissionalIdClean, params, body),
        );
        break;
      }

      case 'cancel_appointment': {
        const { appointment_id } = params || {};
        if (!appointment_id) throw new Error('Parâmetro `appointment_id` é obrigatório para cancelamentos.');
        result = await prepareAppointmentActionPlan(
          {
            admin: supabaseClient,
            userId: profissionalIdClean,
            sessionId: params?.conversation_id || null,
            channel: 'whatsapp',
            whatsappMessageId: params?.message_id || params?.source_message_id || null,
            correlationId: params?.correlation_id || params?.source_message_id || null,
          },
          'cancel_appointment',
          'cancel',
          {
            appointment_id,
            reason: params?.reason || 'Cancelamento solicitado pelo adaptador do WhatsApp',
            communication: params?.communication || { sendConfirmation: true, provider: 'configured' },
          },
          buildN8nFinancialIdempotencyKey('prepare_cancellation', profissionalIdClean, params, body),
        );
        break;
      }

      // ✅ PACIENTES ===============================================================
      case 'get_patients': {
        const { search } = params || {};
        let query = supabaseClient.from('patients').select('*').eq('user_id', profissionalIdClean);

        if (search) {
          query = query.ilike('name', `%${search}%`);
        }
        const { data, error } = await query.order('name', { ascending: true });
        if (error) throw error;
        result = data;
        break;
      }

      case 'get_patient_details': {
        const { patient_id } = params || {};
        if (!patient_id) throw new Error('Parâmetro `patient_id` é obrigatório.');

        const { data, error } = await supabaseClient.from('patients').select(`
          *,
          appointments(*),
          session_notes(id, created_at, notes, ai_summary)
        `).eq('id', patient_id).eq('user_id', profissionalIdClean).single();
        if (error) throw error;
        result = data;
        break;
      }

      case 'create_patient': {
        const { name, email, phone, cpf, notes } = params || {};
        if (!name) throw new Error('Nome do paciente é obrigatório (`name`).');

        const { data, error } = await supabaseClient.from('patients').insert({
          user_id: profissionalIdClean,
          name, email, phone, cpf, notes, status: 'active'
        }).select().single();
        if (error) throw error;
        result = data;
        break;
      }

      // ✅ GESTÃO FINANCEIRA ======================================================
      case 'get_financial_transactions': {
        const { start_date, end_date, type } = params || {};
        let query = supabaseClient
          .from('financial_entries')
          .select('*, patients(name, email)')
          .eq('professional_id', profissionalIdClean);

        if (start_date) query = query.gte('due_date', start_date);
        if (end_date) query = query.lte('due_date', end_date);
        if (type) query = query.eq('type', type);

        const { data, error } = await query.order('due_date', { ascending: false }).order('created_at', { ascending: false });
        if (error) throw error;
        result = data;
        break;
      }

      case 'add_transaction': {
        const { description, amount, type, date, payment_method, category, patient_id, appointment_id } = params || {};
        if (!description || !amount || !type || !date) {
          throw new Error('Parâmetros obrigatórios para transação: `description`, `amount`, `type` (income/expense) e `date`.');
        }

        if (!['income', 'expense'].includes(type)) {
          throw new Error('`type` deve ser `income` ou `expense`.');
        }

        const methodInput = String(payment_method || 'manual').toLowerCase();
        const normalizedPaymentMethod =
          methodInput.includes('pix') ? 'pix' :
          methodInput.includes('boleto') ? 'boleto' :
          methodInput.includes('cart') || methodInput.includes('card') ? 'card' :
          methodInput.includes('dinheiro') || methodInput.includes('cash') ? 'cash' :
          methodInput.includes('transfer') ? 'external_transfer' :
          methodInput.includes('convenio') ? 'convenio' :
          methodInput === 'manual' ? 'manual' : 'other';
        const normalizedDate = String(date).slice(0, 10);
        const idempotencyKey = buildN8nFinancialIdempotencyKey(actionClean, profissionalIdClean, params, body);

        const { data: existingEntry, error: existingEntryError } = await supabaseClient
          .from('financial_entries')
          .select('*')
          .eq('professional_id', profissionalIdClean)
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle();

        if (existingEntryError) throw existingEntryError;
        if (existingEntry) {
          result = {
            ...existingEntry,
            already_exists: true,
            idempotency_key: idempotencyKey,
          };
          break;
        }

        const { data, error } = await supabaseClient.from('financial_entries').insert({
          professional_id: profissionalIdClean,
          idempotency_key: idempotencyKey,
          patient_id: patient_id || null,
          appointment_id: appointment_id || null,
          type,
          title: description,
          description,
          amount: Math.abs(Number(amount)),
          due_date: normalizedDate,
          competence_date: normalizedDate,
          paid_at: `${normalizedDate}T12:00:00.000Z`,
          status: 'paid',
          payment_method: normalizedPaymentMethod,
          origin: 'manual',
          metadata: {
            category: category || null,
            source: 'synapse_n8n_agent',
            legacy_tool: 'add_transaction',
            source_message_id: params?.source_message_id || body?.source_message_id || null,
            channel: params?.channel || body?.channel || null,
          },
        }).select().single();
        if (error) throw error;
        result = data;
        break;
      }

      // ✅ PRONTUÁRIOS E NOTAS =====================================================
      case 'get_session_notes': {
        const { patient_id, limit = 5 } = params || {};
        if (!patient_id) throw new Error('Parâmetro `patient_id` é obrigatório.');

        const { data, error } = await supabaseClient.from('session_notes')
          .select('*')
          .eq('user_id', profissionalIdClean)
          .eq('patient_id', patient_id)
          .order('created_at', { ascending: false })
          .limit(limit);
        if (error) throw error;
        result = data;
        break;
      }

      case 'add_session_note': {
        const { patient_id, notes, appointment_id } = params || {};
        if (!patient_id || !notes) throw new Error('Parâmetros `patient_id` e `notes` são obrigatórios.');

        const { data, error } = await supabaseClient.from('session_notes').insert({
          user_id: profissionalIdClean,
          patient_id,
          appointment_id: appointment_id || null,
          notes
        }).select().single();
        if (error) throw error;
        result = data;
        break;
      }

      // ✅ INFORMAÇÕES PESSOAIS DO PROFISSIONAL ====================================
      case 'get_professional_profile': {
        const { data, error } = await supabaseClient.from('profiles').select('*')
          .eq('id', profissionalIdClean).single();
        if (error) throw error;
        result = data;
        break;
      }

      // ✅ ENVIAR EMAIL CUSTOMIZADO VIA GMAIL ======================================
      case 'send_gmail':
      case 'send_custom_email': {
        const { to, subject, body, html } = params || {};
        if (!to || !subject) throw new Error('Parâmetros `to` (email destino) e `subject` (assunto) são obrigatórios.');
        if (!body && !html) throw new Error('Você deve fornecer `body` (texto plano) ou `html` (HTML) para o corpo do e-mail.');

        const accessToken = await getValidGmailToken(supabaseClient, profissionalIdClean);
        const { senderName, senderEmail } = await getSenderInfo(supabaseClient, accessToken, profissionalIdClean);

        const contentType = html ? 'text/html' : 'text/plain';
        const emailContent = html || body;

        const rawEmail = [
          `To: ${to}`,
          `From: ${senderName} <${senderEmail}>`,
          `Subject: =?utf-8?B?${toBase64(subject)}?=`,
          'MIME-Version: 1.0',
          `Content-Type: ${contentType}; charset=utf-8`,
          'Content-Transfer-Encoding: base64',
          '',
          toBase64(emailContent),
        ].join('\r\n');

        const gmailData = await sendViaGmail(accessToken, rawEmail);

        result = {
          success: true,
          method: 'gmail',
          message_id: gmailData.id,
          from: senderEmail,
          to: to,
          subject: subject,
        };
        break;
      }

      // ✅ LEMBRETE DE CONSULTA (DETERMINÍSTICO — COM TEMPLATE) ====================
      case 'send_appointment_reminder': {
        const { appointment_id } = params || {};
        if (!appointment_id) throw new Error('Parâmetro `appointment_id` é obrigatório.');

        // 1. Buscar dados da consulta + paciente
        const { data: appointment, error: apptError } = await supabaseClient
          .from('appointments')
          .select(`*, patients(id, name, email, phone)`)
          .eq('id', appointment_id)
          .eq('user_id', profissionalIdClean)
          .single();

        if (apptError || !appointment) throw new Error('Agendamento não encontrado.');
        if (!appointment.patients?.email) throw new Error(`Paciente ${appointment.patients?.name || ''} não possui email cadastrado.`);
        if (appointment.status === 'cancelled') throw new Error('Agendamento já está cancelado.');

        // 2. Obter token + perfil do profissional
        const accessToken = await getValidGmailToken(supabaseClient, profissionalIdClean);
        const { senderName, senderEmail, profile } = await getSenderInfo(supabaseClient, accessToken, profissionalIdClean);

        // 3. Formatar dados
        const details = formatAppointmentDetails(appointment, profile);

        // 4. Montar email com template
        const emailHtml = buildAppointmentReminderHtml({
          patientFirstName: appointment.patients.name.split(' ')[0],
          ...details,
        });

        const subject = `Lembrete de Consulta — ${appointment.patients.name.split(' ')[0]}`;

        const rawEmail = [
          `To: ${appointment.patients.email}`,
          `From: ${senderName} <${senderEmail}>`,
          `Subject: =?utf-8?B?${toBase64(subject)}?=`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=utf-8',
          'Content-Transfer-Encoding: base64',
          '',
          toBase64(emailHtml),
        ].join('\r\n');

        const gmailData = await sendViaGmail(accessToken, rawEmail);

        result = {
          success: true,
          action: 'send_appointment_reminder',
          message_id: gmailData.id,
          patient: appointment.patients.name,
          email_to: appointment.patients.email,
          appointment_date: details.dateFormatted,
          appointment_time: details.timeFormatted,
        };
        break;
      }

      // ✅ CONFIRMAÇÃO DE CONSULTA (DETERMINÍSTICO — COM TEMPLATE) =================
      case 'send_appointment_confirmation': {
        const { appointment_id } = params || {};
        if (!appointment_id) throw new Error('Parâmetro `appointment_id` é obrigatório.');

        // 1. Buscar dados da consulta + paciente
        const { data: appointment, error: apptError } = await supabaseClient
          .from('appointments')
          .select(`*, patients(id, name, email, phone)`)
          .eq('id', appointment_id)
          .eq('user_id', profissionalIdClean)
          .single();

        if (apptError || !appointment) throw new Error('Agendamento não encontrado.');
        if (!appointment.patients?.email) throw new Error(`Paciente ${appointment.patients?.name || ''} não possui email cadastrado.`);

        // 2. Obter token + perfil do profissional
        const accessToken = await getValidGmailToken(supabaseClient, profissionalIdClean);
        const { senderName, senderEmail, profile } = await getSenderInfo(supabaseClient, accessToken, profissionalIdClean);

        // 3. Formatar dados
        const details = formatAppointmentDetails(appointment, profile);

        // 4. Montar email com template de confirmação
        const emailHtml = buildAppointmentConfirmationHtml({
          patientFirstName: appointment.patients.name.split(' ')[0],
          professionalName: senderName,
          ...details,
        });

        const subject = `Consulta Confirmada — ${appointment.patients.name.split(' ')[0]}`;

        const rawEmail = [
          `To: ${appointment.patients.email}`,
          `From: ${senderName} <${senderEmail}>`,
          `Subject: =?utf-8?B?${toBase64(subject)}?=`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=utf-8',
          'Content-Transfer-Encoding: base64',
          '',
          toBase64(emailHtml),
        ].join('\r\n');

        const gmailData = await sendViaGmail(accessToken, rawEmail);

        result = {
          success: true,
          action: 'send_appointment_confirmation',
          message_id: gmailData.id,
          patient: appointment.patients.name,
          email_to: appointment.patients.email,
          appointment_date: details.dateFormatted,
          appointment_time: details.timeFormatted,
          appointment_status_unchanged: true,
        };
        break;
      }

      // ✅ PERSISTIR CONVERSA NO NEURONEX ==========================================
      case 'log_interaction': {
        const { user_message, agent_response } = params || {};
        if (!user_message && !agent_response) throw new Error('Pelo menos `user_message` ou `agent_response` é obrigatório.');

        const sessionId = await persistConversation(
          supabaseClient,
          profissionalIdClean,
          user_message || '',
          agent_response || ''
        );

        result = {
          success: true,
          action: 'log_interaction',
          session_id: sessionId,
          message: 'Conversa persistida no NeuroNex.',
        };
        break;
      }

      default:
        throw new Error(`Ação (action) '${actionClean}' não suportada pelo Gateway.`);
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao executar a ação solicitada.';
    return new Response(JSON.stringify({ success: false, error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
