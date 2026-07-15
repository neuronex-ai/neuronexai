import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260715003239_synapse_multichannel_provenance.sql',
  ),
  'utf8',
);

describe('contrato multicanal do Synapse', () => {
  it('mantém uma conversa canônica e registra a origem de cada mensagem', () => {
    expect(migration).toContain("add column if not exists origin_channel text not null default 'panel'");
    expect(migration).toContain("add column if not exists source_channel text not null default 'panel'");
    expect(migration).toContain('source_event_id text');
    expect(migration).toContain('actor_kind text');
  });

  it('impede duplicidade por evento do canal e por chave de operação', () => {
    expect(migration).toContain('messages_source_event_unique_idx');
    expect(migration).toContain('messages_user_idempotency_unique_idx');
    expect(migration).toContain('where source_event_id is not null');
    expect(migration).toContain('where idempotency_key is not null');
  });

  it('atualiza a atividade da conversa sem criar uma segunda memória', () => {
    expect(migration).toContain('sync_synapse_session_activity');
    expect(migration).toContain('last_channel = new.source_channel');
    expect(migration).toContain('last_message_at = greatest');
    expect(migration).not.toContain('create table public.synapse_conversations');
  });
});
