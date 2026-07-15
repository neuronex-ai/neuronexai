type SupabaseUser = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

type AuthClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: SupabaseUser | null };
      error: unknown;
    }>;
  };
};

type AdminClient = {
  auth: {
    admin: {
      getUserById: (userId: string) => Promise<{
        data: { user: SupabaseUser | null };
        error: unknown;
      }>;
    };
  };
};

export type SynapseRequestIdentity = {
  user: SupabaseUser;
  isInternal: boolean;
  channel: "panel" | "voice" | "whatsapp";
  userClient: AuthClient | null;
};

export class SynapseRequestAuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "SynapseRequestAuthError";
    this.status = status;
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function secretsMatch(presented: string, expected: string) {
  if (!presented || !expected || presented.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= presented.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

export async function resolveSynapseRequestIdentity(input: {
  request: Request;
  body: Record<string, unknown>;
  userClient: AuthClient;
  admin: AdminClient;
  expectedInternalSecret: string;
}): Promise<SynapseRequestIdentity> {
  const presentedInternalSecret = input.request.headers.get("x-internal-synapse-secret") || "";

  if (presentedInternalSecret) {
    if (!secretsMatch(presentedInternalSecret, input.expectedInternalSecret)) {
      throw new SynapseRequestAuthError("Canal interno inválido.");
    }

    const professionalId = String(input.body.professional_id || "").trim();
    if (!UUID_PATTERN.test(professionalId)) {
      throw new SynapseRequestAuthError("Profissional interno inválido.", 400);
    }

    const { data, error } = await input.admin.auth.admin.getUserById(professionalId);
    if (error || !data.user || data.user.id !== professionalId) {
      throw new SynapseRequestAuthError("Profissional interno não encontrado.");
    }

    return {
      user: data.user,
      isInternal: true,
      channel: "whatsapp",
      // A service-role client must never masquerade as the professional's RLS client.
      userClient: null,
    };
  }

  const authorization = input.request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    throw new SynapseRequestAuthError("Sessão ausente.");
  }

  const { data, error } = await input.userClient.auth.getUser();
  if (error || !data.user) {
    throw new SynapseRequestAuthError("Sessão inválida.");
  }

  const requestedChannel = String(input.body.channel || (input.body.context as Record<string, unknown> | undefined)?.channel || "panel");
  const channel = requestedChannel === "voice" ? "voice" : "panel";

  return {
    user: data.user,
    isInternal: false,
    channel,
    userClient: input.userClient,
  };
}

export function synapseRequestAuthErrorResponse(error: unknown, headers: HeadersInit = {}) {
  if (!(error instanceof SynapseRequestAuthError)) return null;
  return new Response(JSON.stringify({ error: error.message }), {
    status: error.status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}
