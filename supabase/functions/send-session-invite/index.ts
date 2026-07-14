import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { getErrorMessage } from "../_shared/error-message.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { appointmentId, patientEmail, patientName, meetLink } = await req.json()
    
    // 1. Criar cliente Supabase Admin para buscar token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Pegar o usuário logado que chamou a função
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)

    if (userError || !user) throw new Error('Usuário não autenticado')

    // 3. Buscar o token de acesso do Google no banco
    const { data: tokens, error: tokenError } = await supabaseClient
      .from('user_google_tokens')
      .select('access_token')
      .eq('user_id', user.id)
      .single()

    if (tokenError || !tokens) {
      throw new Error('Google Workspace não conectado. Por favor, conecte sua conta em Integrações.')
    }

    // 4. Montar o e-mail (MIME format)
    const subject = `Convite para Teleconsulta: ${patientName}`;
    const message = [
      `To: ${patientEmail}`,
      `Subject: ${subject}`,
      `Content-Type: text/html; charset=utf-8`,
      ``,
      `<div style="font-family: sans-serif; color: #111; padding: 20px;">`,
      `<h2 style="color: #000;">Sua sessão está pronta.</h2>`,
      `<p>Olá, <strong>${patientName}</strong>.</p>`,
      `<p>Seu psicólogo aguarda você na sala virtual.</p>`,
      `<br/>`,
      `<a href="${meetLink}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Entrar na Sessão</a>`,
      `<br/><br/>`,
      `<p style="color: #666; font-size: 12px;">Link direto: ${meetLink}</p>`,
      `</div>`
    ].join('\n');

    const encodedMessage = btoa(unescape(encodeURIComponent(message)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // 5. Enviar via Gmail API
    const response = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: encodedMessage
      })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Erro Gmail API: ${JSON.stringify(errorData)}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: getErrorMessage(error, 'Não foi possível enviar o convite.') }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})