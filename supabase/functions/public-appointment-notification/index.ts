const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Type": "application/json",
};

Deno.serve((request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers });
  return new Response(
    JSON.stringify({
      error:
        "Este fluxo foi descontinuado. Use o link seguro e versionado do agendamento.",
      code: "LEGACY_APPOINTMENT_FLOW_DISABLED",
    }),
    { status: 410, headers },
  );
});
