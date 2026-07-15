const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function generateGroqFallback(input: {
  systemPrompt: string;
  history: Array<{ role: string; parts?: Array<{ text?: string }> }>;
  message: string;
}) {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) throw new Error("Provedor alternativo indisponível.");

  const primary = Deno.env.get("GROQ_CHAT_MODEL") || "llama-3.1-8b-instant";
  const secondary = Deno.env.get("GROQ_FALLBACK_MODEL") || "openai/gpt-oss-120b";
  const messages = [
    { role: "system", content: input.systemPrompt },
    ...input.history.map((item) => ({
      role: item.role === "model" ? "assistant" : "user",
      content: item.parts?.map((part) => part.text || "").join("\n") || "",
    })),
    { role: "user", content: input.message },
  ];

  let selectedModel = primary;
  let response = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: primary, messages, temperature: 0.35, max_completion_tokens: 1100 }),
  });

  if (!response.ok && secondary !== primary) {
    selectedModel = secondary;
    response = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: secondary, messages, temperature: 0.35, max_completion_tokens: 1100 }),
    });
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || "Falha no provedor alternativo.");

  return {
    text: String(payload?.choices?.[0]?.message?.content || "").trim(),
    provider: "groq",
    model: selectedModel,
  };
}
