import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('contrato de segurança da teleconsulta', () => {
  it('não autoriza appointments por token público e separa usuários anônimos', () => {
    const migration = source('supabase/migrations/20260712180523_secure_teleconsultation_guest_access.sql');

    expect(migration).toContain('revoke all on public.appointments from public, anon');
    expect(migration).toContain("auth.jwt() ->> 'is_anonymous'");
    expect(migration).not.toMatch(/appointments[\s\S]{0,240}token\s+is\s+not\s+null/i);
    expect(migration).toContain('teleconsultation_invites');
    expect(migration).toContain('teleconsultation_participants');
  });

  it('deriva remetente no servidor e não concede INSERT direto no chat', () => {
    const migration = source('supabase/migrations/20260712180523_secure_teleconsultation_guest_access.sql');

    expect(migration).toContain('send_session_chat_message');
    expect(migration).toContain('revoke all on public.session_chat_messages from public, anon, authenticated');
    expect(migration).toContain('grant select on public.session_chat_messages to authenticated');
    expect(migration).not.toContain('grant insert on public.session_chat_messages to authenticated');
    expect(migration).toContain("sender_kind := 'patient'");
    expect(migration).toContain("sender_kind := 'therapist'");
  });

  it('emite JWT por sala exata e nunca promove o paciente', () => {
    const jitsi = source('supabase/functions/generate-jitsi-token/index.ts');

    expect(jitsi).toContain('room: appointmentId');
    expect(jitsi).not.toMatch(/room\s*:\s*["']\*["']/);
    expect(jitsi).toContain('moderator = false');
    expect(jitsi).toContain('recording: false');
    expect(jitsi).toContain('transcription: false');
  });

  it('bloqueia links antigos compostos somente pelo UUID', () => {
    const joinPage = source('src/pages/JoinSession.tsx');
    const lookup = source('supabase/functions/get-appointment-by-token/index.ts');

    expect(joinPage).toContain('SECURE_INVITE_PATTERN');
    expect(joinPage).toContain('Solicite um novo convite');
    expect(lookup).not.toContain('or(`token.eq.${token},id.eq.${token}`)');
  });
});
