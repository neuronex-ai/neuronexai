import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { ensureTeleconsultationInvite, isUuid } from '../_shared/teleconsultation-access.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const toBase64 = (str: string) => {
  const bytes = new TextEncoder().encode(str);
  const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
  return btoa(binString);
};

const toUrlSafeBase64 = (str: string) => {
  return toBase64(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function refreshAccessToken(supabaseService: any, userId: string, refreshToken: string) {
  const tokenUrl = 'https://oauth2.googleapis.com/token';
  const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
  const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');

  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  });

  if (!tokenResponse.ok) throw new Error("Failed to refresh Google access token.");
  const tokens = await tokenResponse.json();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await supabaseService
    .from('user_google_tokens')
    .update({ access_token: tokens.access_token, expires_at: expiresAt.toISOString() })
    .eq('user_id', userId);

  return tokens.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseService = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing auth header');
    
    // Validar token do usuário que chamou a função
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseService.auth.getUser(jwt);
    if (userError || !user) throw new Error('Invalid token');
    const userId = user.id;

    // Receber dados do body
    const { appointmentId, patientEmail, patientName } = await req.json();

    if (!isUuid(appointmentId) || !patientEmail) {
        throw new Error("Dados incompletos: agendamento ou e-mail do paciente ausente.");
    }

    const { data: appointment, error: appointmentError } = await supabaseService
      .from('appointments')
      .select('id,user_id,patient_id,type,start_time,end_time,google_meet_link')
      .eq('id', appointmentId)
      .eq('user_id', userId)
      .maybeSingle();
    if (appointmentError) throw appointmentError;
    if (!appointment || appointment.type !== 'online') throw new Error('Teleconsulta não encontrada.');

    const { data: patient, error: patientError } = await supabaseService
      .from('patients')
      .select('name,email')
      .eq('id', appointment.patient_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (patientError) throw patientError;
    if (!patient || patient.email?.toLowerCase() !== String(patientEmail).trim().toLowerCase()) {
      throw new Error('O destinatário não corresponde ao paciente desta teleconsulta.');
    }

    const secureInvite = await ensureTeleconsultationInvite(supabaseService, appointment);
    const meetLink = secureInvite.meetLink;

    // Buscar token do Google do Psicólogo
    const { data: tokenData } = await supabaseService.from('user_google_tokens').select('*').eq('user_id', userId).single();
    if (!tokenData) throw new Error('Google account not connected');

    let accessToken = tokenData.access_token;
    if (new Date(tokenData.expires_at) < new Date(Date.now() + 60000)) {
      accessToken = await refreshAccessToken(supabaseService, userId, tokenData.refresh_token);
    }

    // Buscar nome da clínica (opcional) para o template
    const { data: profile } = await supabaseService
      .from('profiles')
      .select('clinic_name,full_name,first_name,last_name')
      .eq('id', userId)
      .single();
    const clinicName = profile?.clinic_name || "Consultório de Psicologia";
    const professionalName = profile?.full_name ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
      user.email?.split('@')[0] ||
      'Psicólogo';
    const firstName = String(patient.name || patientName || 'Paciente').split(' ')[0];

    // --- TEMPLATE PREMIUM (IGUAL AO DE LEMBRETE) ---
    const fullHtml = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <!--[if mso]>
        <style type="text/css">
        body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
        </style>
        <![endif]-->
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            body { font-family: 'Inter', Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #050505; color: #ffffff; }
            a { text-decoration: none; }
        </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #050505; -webkit-font-smoothing: antialiased;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #050505;">
            <tr>
                <td align="center" style="padding: 40px 10px;">
                    <!-- Main Container -->
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #0A0A0B; border-radius: 24px; overflow: hidden; border: 1px solid #27272a;">
                        
                        <!-- Gradient Accent Top -->
                        <tr><td height="6" style="background: linear-gradient(90deg, #7C3AED 0%, #10B981 100%); font-size: 0; line-height: 0;">&nbsp;</td></tr>
                        
                        <!-- Header -->
                        <tr>
                            <td style="padding: 32px 40px 0 40px; text-align: center;">
                                <p style="margin: 0; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #71717A;">${clinicName}</p>
                                <h1 style="margin: 8px 0 4px 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Olá, ${firstName}</h1>
                                <p style="margin: 0; font-size: 13px; color: #A1A1AA;">Sua sessão está pronta para começar.</p>
                            </td>
                        </tr>

                        <!-- Highlight Box -->
                        <tr>
                            <td style="padding: 32px 40px;">
                                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #18181B; border: 1px solid #27272a; border-radius: 16px;">
                                    <tr>
                                        <td align="center" style="padding: 24px;">
                                            <!-- Badge -->
                                            <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 12px;">
                                                <tr>
                                                    <td style="background-color: #F5F3FF; border: 1px solid #DDD6FE; border-radius: 100px; padding: 4px 12px;">
                                                        <span style="color: #8B5CF6; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; font-family: sans-serif;">ONLINE</span>
                                                    </td>
                                                </tr>
                                            </table>
                                            
                                            <!-- Title -->
                                            <div style="font-size: 24px; font-weight: 800; color: #ffffff; line-height: 1.2; letter-spacing: -0.5px; margin-bottom: 8px;">Sala Virtual Aberta</div>
                                            <div style="font-size: 14px; font-weight: 500; color: #A1A1AA; text-transform: capitalize;">Com ${professionalName}</div>
                                            
                                            <!-- Divider -->
                                            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 24px;">
                                                <tr><td style="border-top: 1px solid #27272a; font-size: 0; line-height: 0;">&nbsp;</td></tr>
                                            </table>
                                            
                                            <!-- Instructions -->
                                            <div style="margin-top: 20px;">
                                                <p style="font-size: 13px; color: #E4E4E7; margin: 0; line-height: 1.5;">
                                                    Por favor, clique no botão abaixo para entrar na videochamada segura.
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- Button Area -->
                        <tr>
                            <td align="center" style="padding: 0 40px 40px 40px;">
                                <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="width: 100%;">
                                    <tr>
                                        <td align="center">
                                            <!--[if mso]>
                                            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${meetLink}" style="height:50px;v-text-anchor:middle;width:240px;" arcsize="16%" stroke="f" fillcolor="#ffffff">
                                            <w:anchorlock/>
                                            <center>
                                            <![endif]-->
                                            <a href="${meetLink}" style="background-color:#ffffff;border-radius:12px;color:#000000;display:inline-block;font-family:'Inter', sans-serif;font-size:14px;font-weight:700;line-height:50px;text-align:center;text-decoration:none;width:100%;-webkit-text-size-adjust:none;text-transform:uppercase;letter-spacing:0.5px;">Entrar na Sessão</a>
                                            <!--[if mso]>
                                            </center>
                                            </v:roundrect>
                                            <![endif]-->
                                        </td>
                                    </tr>
                                </table>
                                <p style="text-align: center; margin-top: 16px; font-size: 11px; color: #52525B;">
                                    Link direto: <a href="${meetLink}" style="color: #71717A; text-decoration: underline;">${meetLink}</a>
                                </p>
                            </td>
                        </tr>
                    </table>

                    <!-- Footer Branding -->
                    <p style="text-align: center; margin-top: 24px; font-size: 10px; color: #3F3F46; text-transform: uppercase; letter-spacing: 1px;">
                        Enviado com segurança via NeuroNex
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;

    // Preparar envio via Gmail API
    const rawEmail = [
      `To: ${patientEmail}`,
      `From: ${professionalName} <${user.email}>`,
      `Subject: =?utf-8?B?${toBase64(`Convite para Teleconsulta: ${firstName}`)}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      toBase64(fullHtml)
    ].join('\r\n');

    const gmailRes = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: toUrlSafeBase64(rawEmail) }),
    });

    if (!gmailRes.ok) {
        const errText = await gmailRes.text();
        throw new Error(`Gmail API Error: ${errText}`);
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: any) {
    console.error("Invite Error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
