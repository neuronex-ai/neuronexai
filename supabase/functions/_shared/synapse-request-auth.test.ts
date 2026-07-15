import { assertEquals, assertRejects } from "jsr:@std/assert@1";

import {
  resolveSynapseRequestIdentity,
  SynapseRequestAuthError,
} from "./synapse-request-auth.ts";

const professionalId = "11111111-1111-4111-8111-111111111111";

const request = (headers: HeadersInit = {}) => new Request("https://example.test", { headers });

const userClient = (user: any = { id: professionalId }) => ({
  auth: {
    getUser: async () => ({ data: { user }, error: null }),
  },
});

const admin = (user: any = { id: professionalId }) => ({
  auth: {
    admin: {
      getUserById: async () => ({ data: { user }, error: null }),
    },
  },
});

Deno.test("internal Synapse request resolves the professional without exposing a service-role user client", async () => {
  const identity = await resolveSynapseRequestIdentity({
    request: request({ "x-internal-synapse-secret": "secret-value" }),
    body: { professional_id: professionalId, channel: "whatsapp" },
    userClient: userClient(),
    admin: admin(),
    expectedInternalSecret: "secret-value",
  });

  assertEquals(identity.user.id, professionalId);
  assertEquals(identity.isInternal, true);
  assertEquals(identity.channel, "whatsapp");
  assertEquals(identity.userClient, null);
});

Deno.test("internal Synapse request rejects a wrong secret and invalid professional", async () => {
  await assertRejects(
    () => resolveSynapseRequestIdentity({
      request: request({ "x-internal-synapse-secret": "wrong-secret" }),
      body: { professional_id: professionalId },
      userClient: userClient(),
      admin: admin(),
      expectedInternalSecret: "right-secret",
    }),
    SynapseRequestAuthError,
  );

  await assertRejects(
    () => resolveSynapseRequestIdentity({
      request: request({ "x-internal-synapse-secret": "right-secret" }),
      body: { professional_id: "not-a-uuid" },
      userClient: userClient(),
      admin: admin(),
      expectedInternalSecret: "right-secret",
    }),
    SynapseRequestAuthError,
  );
});

Deno.test("normal Synapse request keeps the authenticated RLS client", async () => {
  const client = userClient();
  const identity = await resolveSynapseRequestIdentity({
    request: request({ Authorization: "Bearer user-jwt" }),
    body: { channel: "voice" },
    userClient: client,
    admin: admin(),
    expectedInternalSecret: "secret-value",
  });

  assertEquals(identity.isInternal, false);
  assertEquals(identity.channel, "voice");
  assertEquals(identity.userClient, client);
});
