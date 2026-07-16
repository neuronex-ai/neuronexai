import { corsResponse, errorResponse } from "../_shared/asaas-client.ts";

Deno.serve((request) => {
  if (request.method === "OPTIONS") return corsResponse();
  return errorResponse(
    "Este fluxo antigo foi descontinuado. Gerencie a consulta pelo link seguro e versionado.",
    410,
  );
});
