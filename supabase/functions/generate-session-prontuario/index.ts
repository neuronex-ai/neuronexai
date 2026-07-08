import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// Helper para extrair JSON limpo da resposta da IA
function extractJSON(text: string) {
  try {
    // 1. Tenta parse direto
    return JSON.parse(text);
  } catch {
    // 2. Remove blocos de código markdown
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      // 3. Tenta encontrar o objeto JSON dentro do texto
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
         try {
          return JSON.parse(cleaned.substring(start, end + 1));
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing auth header');
    
    const jwt = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Invalid token');

    const {
      patientId,
      appointmentId,
      notes,
      chatHistory,
      reviewMode = 'confirmed',
      sourceTranscriptId = null,
    } = await req.json();
    const shouldKeepPending = reviewMode === 'pending';
    const now = new Date();
    const reviewDueAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    
    // Preparar transcrição (unindo notas manuais + histórico/transcrição de voz)
    let fullContext = `Notas do Terapeuta: ${notes}\n\n`;
    
    if (Array.isArray(chatHistory) && chatHistory.length > 0) {
        fullContext += "Transcrição/Chat da Sessão:\n" + chatHistory.map((m: any) => 
            `[${m.time || '00:00'}] ${m.sender}: ${m.text}`
        ).join('\n');
    } else if (typeof chatHistory === 'string') {
        fullContext += "Transcrição:\n" + chatHistory;
    }

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) throw new Error("GEMINI_API_KEY não configurada.");

    // Prompt enriquecido para análise emocional
    const systemPrompt = `
      Atue como um Supervisor Clínico Sênior e IA Psicológica.
      Analise os dados brutos desta sessão (notas e transcrição).
      
      Gere um objeto JSON estrito com a seguinte estrutura:
      {
        "sentiment": "Positivo" | "Neutro" | "Negativo" | "Ansioso" | "Depressivo" | "Estável",
        "summary": "Resumo clínico profissional (2-3 parágrafos) focado na evolução.",
        "topics": ["Lista de 3 a 5 temas principais abordados"],
        "next_steps": ["Lista de 2 a 3 intervenções ou focos para a próxima sessão"],
        "emotional_analysis": "Análise breve dos padrões emocionais detectados (ex: picos de ansiedade ao falar de trabalho)."
      }
      
      Retorne APENAS o JSON.
    `;

    const response = await fetch(`${GEMINI_API_URL}?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
            parts: [
                { text: systemPrompt },
                { text: `DADOS DA SESSÃO:\n${fullContext}` }
            ]
        }],
        generationConfig: { temperature: 0.3 }
      }),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API Error: ${errText}`);
    }

    const aiData = await response.json();
    const aiText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!aiText) throw new Error("IA retornou resposta vazia.");

    const parsedSummary = extractJSON(aiText);
    const storedTranscription = typeof chatHistory === 'string' ? chatHistory : JSON.stringify(chatHistory);

    // Salvar no banco
    const { data: newNote, error: insertError } = await supabase
        .from('session_notes')
        .insert({
            user_id: user.id,
            patient_id: patientId,
            appointment_id: appointmentId,
            notes: notes, // Mantém as notas originais editadas pelo usuário
            transcription: storedTranscription,
            ai_summary: parsedSummary, // JSON estruturado
            original_ai_summary: parsedSummary,
            original_transcription: storedTranscription,
            ai_summary_edited: false,
            ai_summary_edit_count: 0,
            review_status: shouldKeepPending ? 'pending_review' : 'confirmed',
            review_due_at: shouldKeepPending ? reviewDueAt.toISOString() : null,
            confirmed_at: shouldKeepPending ? null : now.toISOString(),
            confirmed_by: shouldKeepPending ? null : user.id,
            locked_at: shouldKeepPending ? null : now.toISOString(),
            source_transcript_id: sourceTranscriptId,
        })
        .select()
        .single();

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ success: true, sessionNote: newNote }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (e: any) {
    console.error("Error generating prontuario:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
