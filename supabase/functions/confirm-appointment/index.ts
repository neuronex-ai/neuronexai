import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { getErrorMessage } from "../_shared/error-message.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // --- Robust Base URL Detection ---
  let baseUrl = Deno.env.get('FRONTEND_URL');
  if (!baseUrl) {
      console.warn("WARNING: FRONTEND_URL environment variable is not set. Falling back to a default. This may fail in production.");
      baseUrl = 'http://localhost:8080';
  }
  baseUrl = baseUrl.replace(/\/$/, "");
  // Force HTTPS for non-local environments
  if (!baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1')) {
      if (!baseUrl.startsWith('https://')) {
          baseUrl = `https://${baseUrl.replace(/^http:\/\//, '')}`;
      }
  }
  // --------------------------------

  const REDIRECT_SUCCESS_URL = `${baseUrl}/agenda?confirmation=success`;
  const REDIRECT_FAILURE_URL = `${baseUrl}/agenda?confirmation=failure`;

  const supabaseService = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return Response.redirect(`${REDIRECT_FAILURE_URL}&message=Token de confirmação ausente.`, 302);
    }

    const { data: tokenData, error: tokenError } = await supabaseService
      .from('appointment_confirmation_tokens')
      .select('appointment_id, expires_at')
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      console.error("Token not found:", tokenError);
      return Response.redirect(`${REDIRECT_FAILURE_URL}&message=Token inválido ou expirado.`, 302);
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return Response.redirect(`${REDIRECT_FAILURE_URL}&message=Token expirado.`, 302);
    }

    const { error: updateError } = await supabaseService
      .from('appointments')
      .update({ status: 'confirmed' })
      .eq('id', tokenData.appointment_id);

    if (updateError) {
      console.error("Appointment update failed:", updateError);
      return Response.redirect(`${REDIRECT_FAILURE_URL}&message=Falha ao atualizar o status da consulta.`, 302);
    }
    
    await supabaseService
      .from('appointment_confirmation_tokens')
      .delete()
      .eq('token', token);

    return Response.redirect(`${REDIRECT_SUCCESS_URL}&appointmentId=${tokenData.appointment_id}`, 302);

  } catch (e) {
    console.error("Unhandled error in confirm-appointment:", e);
    return new Response(JSON.stringify({ error: 'Internal server error', details: getErrorMessage(e, 'Internal server error') }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});