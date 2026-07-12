import {
  assert,
  assertEquals,
  assertNotEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  buildSessionJoinInfo,
  createInviteToken,
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
