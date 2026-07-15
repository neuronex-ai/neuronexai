import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('ponte multicanal do Synapse', () => {
  it('evita o proxy aninhado no painel e no WhatsApp', () => {
    const chatHook = source('src/hooks/use-ai-chat.ts');
    const whatsappGateway = source('supabase/functions/synapse-whatsapp-in/index.ts');

    expect(chatHook).toContain('edgeFunctionUrl("synapse-text-fallback")');
    expect(whatsappGateway).toContain('/functions/v1/synapse-text-fallback');
    expect(whatsappGateway).not.toContain('/functions/v1/gemini-text-chat');
  });

  it('exige segredo interno e identifica o profissional no servidor', () => {
    const fallback = source('supabase/functions/synapse-text-fallback/index.ts');
    const auth = source('supabase/functions/_shared/synapse-request-auth.ts');

    expect(fallback).toContain('resolveSynapseRequestIdentity');
    expect(auth).toContain('x-internal-synapse-secret');
    expect(auth).toContain('getUserById');
    expect(auth).toContain('userClient: null');
  });

  it('mantém efeitos externos bloqueados no WhatsApp até liberação supervisionada', () => {
    const executor = source('supabase/functions/synapse-text-fallback/executor-v3.ts');
    const policy = source('supabase/functions/_shared/synapse-channel-policy.ts');

    expect(executor).toContain('SYNAPSE_WHATSAPP_ALLOW_EXTERNAL_ACTIONS');
    expect(policy).toContain('create_neurofinance_charge');
    expect(policy).toContain('create_fiscal_invoice');
    expect(policy).toContain('send_patient_email');
  });
});
