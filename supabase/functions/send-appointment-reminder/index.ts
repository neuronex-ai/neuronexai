import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { deliverPatientEmail, renderTemplate } from '../_shared/email-delivery.ts';
import { ensureTeleconsultationInvite } from '../_shared/teleconsultation-access.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const db = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    { auth: { persistSession: false } },
  );

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Autenticação necessária.' }, 401);
    const authResult = await db.auth.getUser(authorization.replace('Bearer ', ''));
    const user = authResult.data.user;
    if (authResult.error || !user?.email) return json({ error: 'Sessão inválida ou expirada.' }, 401);

    const {
      appointmentId,
      patientEmail,
      patientName,
      startTime,
      action = 'reminder',
      cancellationReason,
    } = await request.json();
    if (!appointmentId) return json({ error: 'ID do agendamento é obrigatório.' }, 400);

    const appointmentResult = await db.from('appointments')
      .select('id,user_id,patient_id,start_time,end_time,type,location,google_meet_link,token,auth_code')
      .eq('id', appointmentId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (appointmentResult.error || !appointmentResult.data) return json({ error: 'Agendamento não encontrado para esta conta.' }, 404);
    const appointment = appointmentResult.data;
    const secureInvite = appointment.type === 'online'
      ? await ensureTeleconsultationInvite(db, appointment)
      : null;

    const [patientResult, profileResult] = await Promise.all([
      db.from('patients').select('name,email').eq('id', appointment.patient_id).eq('user_id', user.id).maybeSingle(),
      db.from('profiles').select('first_name,last_name,full_name,clinic_name').eq('id', user.id).maybeSingle(),
    ]);
    const patient = patientResult.data;
    const recipient = String(patientEmail || patient?.email || '').trim();
    const recipientName = String(patientName || patient?.name || 'Paciente');
    if (!recipient.includes('@')) return json({ error: 'O paciente não possui e-mail válido.' }, 400);

    let token = appointment.token;
    let authCode = appointment.auth_code;
    if (!token || !authCode) {
      token ||= crypto.randomUUID();
      authCode ||= crypto.getRandomValues(new Uint32Array(1))[0].toString().slice(-6).padStart(6, '0');
      await db.from('appointments').update({ token, auth_code: authCode }).eq('id', appointment.id).eq('user_id', user.id);
    }

    const referenceDate = new Date(startTime || appointment.start_time);
    if (Number.isNaN(referenceDate.getTime())) return json({ error: 'Data do agendamento inválida.' }, 400);
    const appointmentDate = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(referenceDate);
    const appointmentTime = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    }).format(referenceDate);

    const isCancellation = action === 'cancel';
    const templateKey = isCancellation ? 'appointment_cancelled' : 'appointment_reminder';
    const templateResult = await db.from('system_email_templates')
      .select('subject,body_html')
      .eq('template_key', templateKey)
      .eq('enabled', true)
      .maybeSingle();

    const profile = profileResult.data;
    const professionalName = profile?.full_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.clinic_name || 'Seu psicólogo';
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://neuronexai.com.br';
    const confirmationUrl = `${frontendUrl}/confirmar-agendamento/${token}`;
    const isOnlineAppointment = appointment.type === 'online';
    const sessionAccessUrl = isOnlineAppointment ? secureInvite!.meetLink : confirmationUrl;
    const appointmentLocation = isOnlineAppointment
      ? `Teleconsulta NeuroNex: ${sessionAccessUrl}`
      : appointment.location || 'Local a combinar com o profissional';
    const actionUrl = isCancellation
      ? `${frontendUrl}/agenda`
      : sessionAccessUrl;
    const variables = {
      RECIPIENT_NAME: recipientName.split(' ')[0],
      APPOINTMENT_DATE: appointmentDate,
      APPOINTMENT_TIME: appointmentTime,
      APPOINTMENT_LOCATION: appointmentLocation,
      ACTION_URL: actionUrl,
      CANCELLATION_MESSAGE: cancellationReason || 'Entre em contato com o profissional para combinar um novo horário.',
      PROFESSIONAL_NAME: professionalName,
      SECURITY_CODE: authCode,
    };

    const fallbackSubject = isCancellation ? 'O atendimento foi cancelado' : 'Seu atendimento está próximo';
    const fallbackHtml = isCancellation
      ? '<p>Olá, {{{RECIPIENT_NAME}}}.</p><p>O atendimento de {{{APPOINTMENT_DATE}}} às {{{APPOINTMENT_TIME}}} foi cancelado.</p><p>{{{CANCELLATION_MESSAGE}}}</p>'
      : '<p>Olá, {{{RECIPIENT_NAME}}}.</p><p>Seu atendimento será em {{{APPOINTMENT_DATE}}} às {{{APPOINTMENT_TIME}}}.</p><p><a href="{{{ACTION_URL}}}">Abrir atendimento</a></p>';
    const fallbackHtmlWithLocation = isCancellation
      ? fallbackHtml
      : fallbackHtml.replace('</p><p><a href="{{{ACTION_URL}}}">', '</p><p><strong>Local:</strong> {{{APPOINTMENT_LOCATION}}}</p><p><a href="{{{ACTION_URL}}}">');
    const subject = renderTemplate(templateResult.data?.subject || fallbackSubject, variables);
    let html = renderTemplate(templateResult.data?.body_html || fallbackHtmlWithLocation, variables);
    if (!isCancellation && !html.includes(appointmentLocation)) {
      html += `<p><strong>Local:</strong> ${appointmentLocation}</p>`;
    }

    const delivery = await deliverPatientEmail({
      db,
      userId: user.id,
      senderName: professionalName,
      senderEmail: user.email,
      to: recipient,
      subject,
      html,
    });

    await db.from('email_delivery_logs').insert({
      user_id: user.id,
      template_key: templateKey,
      recipient,
      provider: delivery.provider,
      sender: delivery.provider === 'gmail' ? user.email : 'notificacoes@email.neuronex.site',
      status: 'sent',
      provider_message_id: delivery.providerMessageId,
      metadata: {
        appointmentId: appointment.id,
        action,
        gmailError: delivery.gmailError,
      },
    });

    return json({ success: true, provider: delivery.provider, providerMessageId: delivery.providerMessageId });
  } catch (error) {
    console.error('[send-appointment-reminder]', error);
    return json({ error: error instanceof Error ? error.message : 'Não foi possível enviar a mensagem.' }, 500);
  }
});
