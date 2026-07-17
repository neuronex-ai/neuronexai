export type SynapseHistoryChannel = 'text' | 'voice' | 'whatsapp';

type HistorySessionLike = {
  id: string;
  title?: string | null;
  origin_channel?: 'panel' | 'voice' | 'whatsapp' | 'system';
  context_state?: {
    source?: string | null;
  } | null;
};

const WHATSAPP_TITLE = /^WhatsApp(?:\s+Business)?\b/i;
const VOICE_TITLE = /^(?:Conversa|Sess[aã]o)\s+por\s+voz\b/i;

/**
 * Resolves legacy sessions without depending on the channel columns introduced
 * by the conversation-integrity migration. Explicit provenance always wins;
 * voice runtime records and legacy titles are compatibility fallbacks.
 */
export const resolveSynapseHistoryChannel = (
  session: HistorySessionLike,
  voiceConversationIds: ReadonlySet<string> = new Set(),
): SynapseHistoryChannel => {
  if (
    session.origin_channel === 'whatsapp' ||
    session.context_state?.source?.toLowerCase() === 'whatsapp' ||
    WHATSAPP_TITLE.test(session.title || '')
  ) {
    return 'whatsapp';
  }

  if (
    session.origin_channel === 'voice' ||
    voiceConversationIds.has(session.id) ||
    VOICE_TITLE.test(session.title || '')
  ) {
    return 'voice';
  }

  return 'text';
};

