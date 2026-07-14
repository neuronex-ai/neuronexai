import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import {
  requireEntitlementForUser,
  subscriptionAccessErrorResponse,
} from "../_shared/subscription-access.ts";
import { getErrorMessage } from "../_shared/error-message.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ARCEE_API_URL = "https://conductor.arcee.ai/v1/chat/completions";

// Helper function to extract JSON from potential markdown blocks
function extractJSON(text: string) {
  try {
    // Attempt 1: Direct parse
    return JSON.parse(text);
  } catch {
    // Attempt 2: Extract from markdown code blocks
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {
        // Continue to next attempt
      }
    }
    
    // Attempt 3: Find first '{' and last '}'
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
       try {
        return JSON.parse(text.substring(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Autenticar o usuário Supabase
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const jwt = authHeader.replace('Bearer ', '');
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    await requireEntitlementForUser(
      {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
      },
      "ai_copilot",
    );

    // 2. Obter as anotações do corpo da requisição
    const { notes } = await req.json();
    if (!notes || typeof notes !== 'string' || notes.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'As anotações (notes) são obrigatórias.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. Preparar o prompt para a IA
    const systemPrompt = `
      Você é um assistente de IA especializado em psicologia, projetado para ajudar psicólogos a analisar anotações de sessões.
      Sua tarefa é receber as anotações de uma sessão e retornar uma análise concisa e estruturada em um formato JSON.
      O JSON de saída DEVE ter EXATAMENTE a seguinte estrutura, sem texto adicional antes ou depois:
      {
        "sentiment": "string",
        "summary": "string",
        "topics": ["string"],
        "next_steps": ["string"]
      }

      Instruções para cada campo:
      - "sentiment": Analise o sentimento geral da sessão. Os valores possíveis são apenas "Positivo", "Neutro" ou "Negativo".
      - "summary": Forneça um resumo conciso (2-3 frases) dos pontos principais da sessão.
      - "topics": Identifique e liste os principais tópicos ou temas discutidos (ex: "Ansiedade no trabalho", "Relacionamento familiar", "Autoestima").
      - "next_steps": Sugira 2 ou 3 próximos passos ou pontos de foco para o paciente ou para o terapeuta na próxima sessão.

      Analise o texto a seguir e retorne APENAS o objeto JSON.
    `;

    // 4. Chamar a API da Arcee
    const response = await fetch(ARCEE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('GEMINI_API_KEY')}`, // Usando GEMINI_API_KEY
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'auto',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: notes }
        ],
        temperature: 0.5,
        max_tokens: 500,
      }),
    });

    let data;
    let errorBody = '';

    try {
      data = await response.json();
    } catch (e) {
      errorBody = await response.text();
      console.error("Failed to parse AI response as JSON:", e, "Raw body:", errorBody);
    }

    if (!response.ok) {
      return new Response(JSON.stringify({ 
        error: 'Falha ao comunicar com a API de IA.', 
        status: response.status,
        details: data?.error?.message || errorBody || 'Resposta da API vazia ou inválida.' 
      }), { 
        status: response.status, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const aiContent = data?.choices?.[0]?.message?.content;

    if (!aiContent) {
      return new Response(JSON.stringify({ error: 'A resposta da IA estava vazia ou malformada.', raw_data: data }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 5. Tentar parsear o conteúdo JSON retornado pela IA (agora com limpeza)
    const parsedContent = extractJSON(aiContent);
    
    if (parsedContent) {
      return new Response(JSON.stringify(parsedContent), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } else {
      console.error("Error parsing AI JSON response. Raw content:", aiContent);
      return new Response(JSON.stringify({ error: 'A IA retornou um formato inválido.', raw_content: aiContent }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

  } catch (e) {
    const accessResponse = subscriptionAccessErrorResponse(e);
    if (accessResponse) return accessResponse;

    console.error("Unhandled error in generate-summary:", e);
    return new Response(JSON.stringify({ error: 'Erro interno do servidor.', details: getErrorMessage(e, 'Erro interno do servidor.') }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
