import {
  requireRequestEntitlement,
  subscriptionAccessErrorResponse,
} from "../_shared/subscription-access.ts";
import { requiresCanonicalSynapseAgent } from "../_shared/synapse-grounding-policy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type",
};

const routes: Record<string, [string, string | null]> = {
  "/dashboard": ["navigate", "dashboard"],
  "/agenda": ["open_daily_schedule", null],
  "/pacientes": ["navigate", "patients"],
  "/financeiro": ["navigate", "finance"],
  "/notas": ["navigate", "notes"],
  "/teleconsulta": ["navigate", "teleconsultation"],
};

function reply(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeAction(value: any) {
  if (!value || typeof value !== "object") return null;

  const data = value.data || value.payload || value;
  if (value.type === "interface_action") return value;
  if (value.type !== "navigation_action" || typeof data.path !== "string") return value;

  const mapped = routes[data.path.replace(/\/$/, "")];
  if (!mapped) return null;

  return {
    type: "interface_action",
    data: {
      action: mapped[0],
      target: mapped[1] || undefined,
      reason: data.reason,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await requireRequestEntitlement(req, "ai_copilot");

    const auth = req.headers.get("Authorization") || "";
    const body = await req.json();
    if (requiresCanonicalSynapseAgent(String(body.message || ""))) {
      return reply({
        error: "Esta solicitação precisa do agente operacional do Synapse. Tente novamente em instantes.",
        code: "SYNAPSE_TOOLS_REQUIRED",
        retryable: true,
      }, 409);
    }
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");

    const primary = await fetch(`${url}/functions/v1/gemini-text-chat`, {
      method: "POST",
      headers: {
        Authorization: auth,
        apikey: anon || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const primaryData = await primary.json().catch(() => null);
    if (primary.ok && primaryData && !primaryData.error) {
      return reply({
        ...primaryData,
        clientAction: safeAction(primaryData.clientAction),
        provider: primaryData.provider || "gemini",
        model: primaryData.model || "gemini-2.5-flash-lite",
      });
    }

    const key = Deno.env.get("GROQ_API_KEY");
    if (!key) {
      return reply({ error: primaryData?.error || "Servico temporariamente indisponivel." }, 503);
    }

    const model = Deno.env.get("GROQ_CHAT_MODEL") || "llama-3.1-8b-instant";
    const fallback = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "Voce e o Synapse da NeuroNex. Responda em portugues brasileiro, com precisao e concisao. Nao invente dados, nao afirme executar ferramentas e nunca exponha rotas, URLs, IDs ou detalhes tecnicos.",
          },
          { role: "user", content: String(body.message || "") },
        ],
        temperature: 0.3,
        max_completion_tokens: 900,
      }),
    });

    const fallbackData = await fallback.json().catch(() => null);
    if (!fallback.ok) {
      return reply({ error: fallbackData?.error?.message || "Servico temporariamente indisponivel." }, 503);
    }

    return reply({
      response: String(fallbackData?.choices?.[0]?.message?.content || "Nao consegui concluir agora."),
      clientAction: null,
      session_id: body.sessionId || body.session_id,
      provider: "groq",
      model,
      fallback: true,
    });
  } catch (error) {
    const accessResponse = subscriptionAccessErrorResponse(error);
    if (accessResponse) return accessResponse;

    return reply({ error: error instanceof Error ? error.message : "Falha no gateway." }, 500);
  }
});
