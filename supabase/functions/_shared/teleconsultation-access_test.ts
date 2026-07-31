import {
  assert,
  assertEquals,
  assertNotEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  buildSessionJoinInfo,
  createInviteToken,
  ensureTeleconsultationInvite,
  inviteTokenFromLink,
  sha256Hex,
} from './teleconsultation-access.ts';

Deno.test('convite usa 256 bits e somente o hash precisa ser persistido', async () => {
  const first = createInviteToken();
  const second = createInviteToken();

  assertEquals(first.length, 64);
  assert(/^[a-f0-9]{64}$/.test(first));
  assertNotEquals(first, second);
  assertNotEquals(await sha256Hex(first), first);
});

Deno.test('link seguro aceita token de 64 hex e rejeita UUID legado', () => {
  const token = 'a'.repeat(64);
  assertEquals(inviteTokenFromLink(`https://neuronexai.com.br/join/${token}`), token);
  assertEquals(inviteTokenFromLink('https://neuronexai.com.br/join/ccf733ad-48d3-47af-8ffd-54cf90afabad'), null);
});

Deno.test('convite ativo é reutilizado sem criar outro token ou gravar novamente', async () => {
  const token = 'b'.repeat(64);
  const tokenHash = await sha256Hex(token);
  let tableReads = 0;
  const query = {
    select: () => query,
    eq: () => query,
    is: () => query,
    gt: () => query,
    maybeSingle: () => {
      tableReads += 1;
      return Promise.resolve({
        data: {
          id: '11111111-1111-4111-8111-111111111111',
          appointment_id: '22222222-2222-4222-8222-222222222222',
          token_hash: tokenHash,
          expires_at: '2099-01-01T00:00:00.000Z',
          revoked_at: null,
        },
        error: null,
      });
    },
  };
  const admin = {
    from: (table: string) => {
      assertEquals(table, 'teleconsultation_invites');
      return query;
    },
  };

  const result = await ensureTeleconsultationInvite(admin, {
    id: '22222222-2222-4222-8222-222222222222',
    user_id: '33333333-3333-4333-8333-333333333333',
    type: 'online',
    start_time: '2026-08-05T15:00:00.000Z',
    end_time: '2026-08-05T15:50:00.000Z',
    google_meet_link: `https://neuronexai.com.br/join/${token}`,
  });

  assertEquals(result.inviteToken, token);
  assertEquals(result.inviteId, '11111111-1111-4111-8111-111111111111');
  assertEquals(tableReads, 1);
});

Deno.test('sala só abre depois da decisão e de heartbeat recente', () => {
  const waiting = buildSessionJoinInfo({
    metadata: {
      teleconsultationRoom: { status: 'waiting' },
    },
  });
  assertEquals(waiting.canJoin, false);
  assertEquals(waiting.decisionStatus, 'pending');

  const open = buildSessionJoinInfo({
    metadata: {
      teleconsultationTranscription: { enabled: false },
      teleconsultationRoom: {
        status: 'open',
        lastHeartbeatAt: new Date().toISOString(),
      },
    },
  });
  assertEquals(open.canJoin, true);
  assertEquals(open.transcriptionEnabled, false);

  const stale = buildSessionJoinInfo({
    metadata: {
      teleconsultationTranscription: { enabled: true },
      teleconsultationRoom: {
        status: 'open',
        lastHeartbeatAt: new Date(Date.now() - 60_000).toISOString(),
      },
    },
  });
  assertEquals(stale.canJoin, false);
  assertEquals(stale.roomStatus, 'closed');
});
