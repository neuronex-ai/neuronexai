# Auditoria incremental - local startup e Supabase security

Data: 2026-06-29

## Fechado nesta rodada

- Local voltou a iniciar em `http://127.0.0.1:8080/`.
- `.env.local` foi recriado localmente com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`; o arquivo segue ignorado pelo Git.
- `node_modules` foi reconstruido com npm, removendo a instalacao contaminada por layout pnpm.
- `npm run build` e `npx tsc -p tsconfig.app.json --noEmit` passaram.
- `gemini-text-chat` foi endurecida: `verify_jwt=true` no `supabase/config.toml` e no Supabase Cloud.
- `check_appointment_overlap` e `get_financial_metrics` foram migradas no Supabase Cloud para `SECURITY INVOKER`, mantendo validacao por `auth.uid()` ou `service_role`.
- Removidos cascos vazios locais de Edge Functions legadas: `twilio-sms`, `issue-focus-nfe`, `issue-invoice-focusnfe`, `send-monthly-report`.

## Edge Functions com `verify_jwt=false`

Classificacao local pelo `supabase/config.toml`:

| Funcao | Categoria | Observacao |
| --- | --- | --- |
| `asaas-webhook` | Webhook publico legitimo | Deve validar token/assinatura do provedor no corpo da funcao. |
| `asaas-financial-sync` | Manutencao/cron com segredo ou chamada autenticada propria | Mantem `verify_jwt=false` por permitir cron secret; revisar segredo em producao. |
| `synapse-whatsapp-in` | Webhook publico legitimo | Entrada externa do NeuroZap/WhatsApp; precisa autenticacao propria por segredo/header. |
| `n8n-agent-gateway` | Endpoint publico com Bearer proprio | Exige `N8N_WEBHOOK_SECRET`; manter sem JWT enquanto for integracao server-to-server. |
| `signup-email-status`, `signup-start`, `signup-verify`, `signup-complete` | Fluxo publico de signup | Publicos por desenho; devem limitar payload e evitar criacao de trial para paciente. |
| `patient-portal-invite-preview`, `patient-portal-auth` | Portal paciente publico por token/credencial | Publicos por desenho; manter isolados do app profissional. |
| `verify-checkout-session` | Callback/verificacao pos-checkout | Publico por desenho; deve validar provider/session antes de liberar acesso. |
| `subscription-maintenance` | Manutencao com segredo | Requer `SUBSCRIPTION_MAINTENANCE_SECRET` em producao. |
| `address-autocomplete`, `address-validate` | Endpoint publico legitimo | Baixo risco relativo; aplicar rate limit/cotas se exposto a abuso. |
| `notion-auth-callback`, `notion-webhook` | OAuth callback/webhook | Publicos por desenho; callback deve validar `state`. |

Observacao atualizada em 2026-07-14: as implementacoes locais de Microsoft To Do e Todoist foram removidas por decisao de produto. O Cloud ainda pode conter funcoes historicas que nao aparecem no `config.toml` atual, incluindo callbacks dessas integracoes, alem de rotas publicas de agendamento. Nada remoto foi desativado nesta limpeza. A reconciliacao do Cloud e das tabelas historicas precisa ocorrer em uma rodada propria, com inventario e forma de restauracao antes de qualquer exclusao.

## Security Advisor - pendencias principais

- `prepare_document_upload` ainda aparece como `SECURITY DEFINER` executavel por `authenticated`. Esse e o proximo ponto a corrigir, mas deve ser feito junto com a Edge Function R2 para nao quebrar uploads ja validados.
- RPCs publicas por token de anamnese/agendamento (`get_public_anamnesis`, `update_public_anamnesis`, `emit_public_*`) continuam intencionais, mas o desenho ideal e migrar para Edge Functions publicas com validacao propria e revogar RPC direto.
- Tabelas com RLS sem policy: `app_core.domain_events`, `public.neurofinance_outgoing_requests`, `public.signup_email_verifications`, `public.support_requests`.
- Policies permissivas: `public.audit_logs` e `public.waitlist` permitem insert amplo.
- `vector` ainda esta instalado no schema `public`; mover para schema dedicado quando houver janela de migracao.
- Varias funcoes ainda nao tem `search_path` fixo; tratar em lote separado.

## Proxima acao recomendada

1. Mover o registro de upload R2 para dentro de `r2-create-upload-url`.
2. Criar RPC service-only `prepare_document_upload_for_user(...)`.
3. Atualizar o frontend para nao chamar `prepare_document_upload` direto.
4. Deployar `r2-create-upload-url`.
5. Revogar `prepare_document_upload` de `authenticated`.
6. Revalidar upload/download/expiracao de URL R2.
