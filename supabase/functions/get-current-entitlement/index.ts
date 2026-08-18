import {
  corsResponse,
  errorResponse,
  getAuthenticatedUser,
  jsonResponse,
} from "../_shared/asaas-client.ts";
import { readCurrentEntitlement } from "../_shared/subscription-access.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  if (req.method !== "POST" && req.method !== "GET") {
    return errorResponse("Metodo nao permitido.", 405);
  }

  try {
    const user = await getAuthenticatedUser(req);
    const entitlement = await readCurrentEntitlement({
      id: user.id,
      email: user.email,
      app_metadata: user.app_metadata,
      user_metadata: user.user_metadata,
    });

    // Compatibility field only. Access is always derived from the effective
    // entitlement, configured features and limits. Neither a specific e-mail
    // nor admin_override may bypass feature gates in the client.
    return jsonResponse({
      ...entitlement,
      isDevAccount: false,
    });
  } catch (error) {
    console.error("get-current-entitlement:error", error);
    return errorResponse("Nao foi possivel carregar sua assinatura.", 500);
  }
});
