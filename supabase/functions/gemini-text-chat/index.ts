const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept, x-synapse-progress",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const streamHeaders = {
  ...corsHeaders,
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "Connection": "keep-alive",
  "X-Accel-Buffering": "no",
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Metodo nao permitido." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
    });
  }

  try {
    const authorization = request.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Sessao ausente." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/+$/, "");
    if (!supabaseUrl) throw new Error("SUPABASE_URL nao configurada.");

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const body = await request.text();
    const accept = request.headers.get("Accept") || "";
    const progressMode = request.headers.get("X-Synapse-Progress") || "";
    const response = await fetch(`${supabaseUrl}/functions/v1/synapse-text-fallback`, {
      method: "POST",
      headers: {
        Authorization: authorization,
        ...(anonKey ? { apikey: anonKey } : {}),
        "Content-Type": "application/json",
        ...(accept ? { Accept: accept } : {}),
        ...(progressMode ? { "X-Synapse-Progress": progressMode } : {}),
      },
      body,
    });

    const responseType = response.headers.get("Content-Type") || "";
    if (responseType.includes("text/event-stream")) {
      return new Response(response.body, {
        status: response.status,
        headers: streamHeaders,
      });
    }

    const payload = await response.text();
    return new Response(payload, {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (error) {
    console.error("[gemini-text-chat compatibility proxy]", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Falha ao acionar o Synapse.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      },
    );
  }
});
