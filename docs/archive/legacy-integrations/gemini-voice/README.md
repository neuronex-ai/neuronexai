# Arquivo histórico — voz Gemini

> **Atenção, agentes:** este diretório é somente histórico. Não o importe, não o restaure no aplicativo e não o trate como a arquitetura de voz atual da NeuroNex.

Estes arquivos pertenciam a uma experiência antiga de captura e ferramentas de voz baseada em Gemini. Eles foram retirados de `public/` e `src/` porque não participam mais do build nem do funcionamento atual.

## Estrutura de voz atual

A voz atual usa a arquitetura Synapse com Deepgram. Antes de alterar voz, consulte as implementações ativas:

- `server/voice-agent-gateway/`
- `supabase/functions/synapse-voice-agent-session/`
- `supabase/functions/synapse-voice-gateway/`
- `src/hooks/use-synapse-voice.ts`
- `src/hooks/use-deepgram-agent-voice.ts`

Não reutilize contratos, nomes de ferramentas ou processadores deste arquivo histórico sem uma nova decisão explícita de produto e uma auditoria das integrações atuais.
