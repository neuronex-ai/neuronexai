import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { token } = await req.json()
    if (!token) throw new Error('Token obrigatório');

    let appointment: any = null;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);

    console.log(`Looking up token: ${token}, isUUID: ${isUUID}`);

    // 1. FIRST: Check the dedicated confirmation tokens table (where email tokens are stored)
    if (isUUID) {
      const { data: tokenData, error: tokenError } = await supabaseClient
        .from('appointment_confirmation_tokens')
        .select('appointment_id, expires_at')
        .eq('token', token)
        .maybeSingle();

      console.log('Token lookup result:', tokenData, tokenError);

      if (tokenData) {
        // Check expiration
        const now = new Date();
        const expiresAt = new Date(tokenData.expires_at);

        console.log(`Token expires at: ${expiresAt}, now: ${now}, expired: ${now > expiresAt}`);

        if (now > expiresAt) {
          return new Response(
            JSON.stringify({ error: 'O link de confirmação expirou. Solicite um novo ao seu psicólogo.' }),
            { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Token is valid, fetch the appointment
        const { data: byId, error: aptError } = await supabaseClient
          .from('appointments')
          .select('*')
          .eq('id', tokenData.appointment_id)
          .maybeSingle();

        console.log('Appointment lookup result:', byId ? 'found' : 'not found', aptError);

        if (byId) {
          appointment = byId;
        }
      }
    }

    // 2. Legacy confirmation links may still use the dedicated bearer token
    // stored on the appointment. The public appointment UUID is deliberately
    // not accepted as a credential.
    if (!appointment) {
      const { data: byTokenColumn } = await supabaseClient
        .from('appointments')
        .select('*')
        .eq('token', token)
        .maybeSingle();

      if (byTokenColumn) {
        console.log('Found appointment by legacy token column');
        appointment = byTokenColumn;
      }
    }

    // Not found
    if (!appointment) {
      console.log('No appointment found for token');
      return new Response(
        JSON.stringify({ error: 'Convite inválido ou não encontrado. Verifique o link ou solicite um novo.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Fetch additional details
    const [patientResult, profileResult] = await Promise.all([
      supabaseClient.from('patients').select('name').eq('id', appointment.patient_id).maybeSingle(),
      supabaseClient.from('profiles').select('clinic_name, full_name, address_line1, address_city, address, phone').eq('id', appointment.user_id).maybeSingle()
    ]);

    const responseData = {
      appointment: {
        ...appointment,
        patient_name: patientResult.data?.name || appointment.patient_name || 'Paciente',
        user_id: appointment.user_id
      },
      professional: {
        clinic: profileResult.data?.clinic_name || 'Consultório',
        name: profileResult.data?.full_name || 'Seu Psicólogo',
        address_line1: profileResult.data?.address_line1 || profileResult.data?.address,
        address_city: profileResult.data?.address_city,
        phone: profileResult.data?.phone
      }
    };

    console.log('Returning appointment data for:', appointment.id);

    return new Response(
      JSON.stringify(responseData),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error in get-appointment-by-token:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao carregar agendamento. Tente novamente.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
