# Asaas/Supabase Architecture Audit

Data da auditoria: 2026-07-09
Projeto Supabase: `krewdaklcyzqfxkkgvqr`

## 1. Diagnostico atual

A integracao Asaas estava funcional em partes, mas carregava tres problemas estruturais:

1. Credencial Asaas de subconta ainda existia em coluna publica (`financial_accounts.asaas_api_key`), enquanto o codigo atual ja esperava um cofre privado.
2. O Cloud tinha estruturas legadas ainda presentes (`base_asaas_events`, `transactions`) e uma RPC ativa (`get_financial_metrics`) dependia de `transactions`.
3. As tabelas financeiras provider-backed tinham grants herdados demais para `anon`/`authenticated` (`REFERENCES`, `TRIGGER`, `TRUNCATE`) e varias Edge Functions Asaas estavam implantadas com `verify_jwt=false`, divergindo do `supabase/config.toml`.

O que foi aplicado no Cloud nesta fase foi nao destrutivo. Nenhum `DROP TABLE`, `DROP COLUMN` ou `DELETE` de dados de producao foi executado.

## 2. Mudancas nao destrutivas aplicadas

### Migration `20260709073033_asaas_neurofinance_cloud_schema_hardening.sql`

Aplicada no Cloud com sucesso.

- Criou `private.asaas_account_credentials`, com RLS e acesso apenas para `service_role`.
- Criou `public.neurofinance_contract_acceptances`.
- Criou as views seguras `financial_accounts_safe_v`, `nb_payments_safe_v`, `nb_payouts_safe_v` com `security_invoker=true`.
- Removeu writes diretos de browser em `financial_accounts`, `nb_payments`, `nb_payouts`.
- Removeu grants diretos de `SELECT` amplo dessas tabelas para browser.
- Recriou policies de owner-read para `authenticated`.
- Adicionou FKs validadas:
  - `financial_entries.neurofinance_charge_id -> nb_payments(id)`
  - `financial_reconciliations.neurofinance_charge_id -> nb_payments(id)`
- Adicionou indices de FK para tabelas Asaas/NeuroFinance/subscription relevantes.

### Migration `20260709154922_harden_neurofinance_grants_and_metrics.sql`

Aplicada no Cloud com sucesso.

- Removeu privilegios residuais `REFERENCES`, `TRIGGER`, `TRUNCATE` de `anon`/`authenticated` nas tabelas provider-backed.
- Reaplicou apenas `SELECT` por coluna segura para `authenticated`.
- Garantiu `SELECT` nas views seguras.
- Adicionou `idx_neurofinance_acceptances_actor_user`.
- Substituiu `public.get_financial_metrics` para ler `financial_entries`, nao `transactions`.
- Restringiu `EXECUTE` da RPC para `authenticated` e `service_role`.

## 3. Validacao executada no Cloud

Resultados principais:

- `private.asaas_account_credentials`: existe, 0 linhas.
- `financial_accounts`: 1 linha.
- `financial_accounts.asaas_api_key`: 1 linha ainda contem chave publica/transicional.
- `neurofinance_contract_acceptances`: existe, 0 linhas.
- `base_asaas_events`: existe, 0 linhas.
- `transactions`: existe, 30 linhas.
- `financial_entries.legacy_transaction_id`: 30 referencias.
- Browser `SELECT` em `financial_accounts.asaas_api_key`: 0 grants.
- FKs Asaas/NeuroFinance/subscription auditadas: 0 sem indice cobrindo a FK.
- `get_financial_metrics`: nao referencia mais `public.transactions`, referencia `public.financial_entries`, e retornou `source = financial_entries` em chamada de teste.

Advisors Supabase apos as migrations:

- Security ainda alerta `vector` instalado no schema `public`.
- Security ainda alerta leaked password protection desabilitado.
- Performance ainda alerta FKs sem indice fora do escopo Asaas/NeuroFinance, principalmente agenda/auth/documentos.
- Nao restou alerta de FK sem indice no recorte Asaas/NeuroFinance validado manualmente.

## 4. Inventario e classificacao

### Estruturas atuais que devem ficar

| Item | Papel | Fonte da verdade |
| --- | --- | --- |
| `financial_accounts` | Subconta financeira Asaas do psicologo/tenant. | Estado operacional da subconta, sem plaintext de chave apos fase final. |
| `private.asaas_account_credentials` | Cofre criptografado de API keys de subconta. | Chave Asaas de subconta para Edge Functions. |
| `neurofinance_contract_acceptances` | Auditoria de aceite de termos NeuroNex/Asaas/Pix. | Aceites de onboarding financeiro. |
| `nb_payments` | Cobrancas/pagamentos Asaas do NeuroFinance. | Cobrancas provider-backed. |
| `financial_entries` | Lancamentos financeiros canonicos manuais, de agenda e reconciliados. | Caixa/gestao financeira do produto. |
| `financial_reconciliations` | Ponte entre `financial_entries` e `nb_payments`. | Rastreabilidade de conciliacao. |
| `nb_payouts` | Saques, repasses e transferencias Asaas. | Payouts provider-backed. |
| `neurofinance_baas_operations` | Log operacional de Pix, bill payment e BaaS. | Auditoria de operacoes Asaas BaaS. |
| `neurofinance_bill_payments` | Agendamentos/pagamentos de contas. | Contas pagas/agendadas via BaaS. |
| `neurofinance_outgoing_requests` | Solicitacoes de saida/transferencia. | Workflow de outflow. |
| `neurofinance_anticipations` | Antecipacoes de recebiveis. | Estado de antecipacao. |
| `neurofinance_tariff_rules` | Tarifas/regras NeuroFinance. | Calculo de fees e simulacoes. |
| `asaas_webhook_events` | Idempotencia e auditoria de webhooks Asaas. | Log canonico de eventos recebidos. |
| `user_subscriptions`, `subscription_events`, `subscription_audit_logs`, `checkout_sessions` | Assinatura NeuroNex do usuario. | Assinatura/plano da NeuroNex, separada de NeuroFinance. |
| `invoices` | NFS-e/fiscal e cobrancas legadas ainda usadas pelo produto. | Fiscal/NFS-e; nao deve ser confundida com `nb_payments`. |

### Views seguras atuais

| View | Uso |
| --- | --- |
| `financial_accounts_safe_v` | Leitura de status da subconta sem chave, payload bruto, banco completo ou documentos. |
| `nb_payments_safe_v` | Leitura de cobrancas sem provider payload, provider id sensivel e metadados brutos. |
| `nb_payouts_safe_v` | Leitura de payouts sem Pix key, provider payload e destino bruto. |

### Legado que deve ser removido apos plano destrutivo

| Item | Estado | Remocao |
| --- | --- | --- |
| `financial_accounts.asaas_api_key` | Existe e tem 1 linha com chave. | Migrar/rotacionar para `private.asaas_account_credentials`, validar, entao `DROP COLUMN`. |
| `base_asaas_events` | Existe com 0 linhas. | Exportar prova de vazio, entao `DROP TABLE`. |
| `base-asaas-webhook` | Sem config ativa; pasta local vazia removida. | Confirmar inexistencia no Cloud e apagar qualquer deploy antigo se aparecer. |
| `transactions` | Existe com 30 linhas e 30 referencias em `financial_entries`. | Manter ate validar paridade e retirar `legacy_transaction_id`; depois arquivar/exportar e dropar. |
| Migrations historicas com `transactions`/`stripe_`/ledger | Historico do repositorio. | Nao reescrever historico; neutralizar objetos vivos no Cloud e documentar supersessao. |

## 5. RPCs, functions, triggers e policies

### Functions/RPCs atuais relevantes

| Function | Classificacao | Observacao |
| --- | --- | --- |
| `public.get_financial_metrics` | Atual corrigida | Agora usa `financial_entries` e exclui receita cancelada. |
| `public.refresh_neurofinance_overview_snapshot` | Atual | Mantem snapshot/overview NeuroFinance. |
| `private.can_access_financial_scope` | Atual | Helper RLS para escopo financeiro; `private` precisa manter `USAGE` para `authenticated`. |
| `private.request_neurofinance_reconciliation` | Atual | Apoia conciliacao financeira. |
| Trigger de notificacao/updated_at | Atual | Mantem eventos e timestamps; nao foi alvo de remocao. |

### Policies/grants atuais no recorte Asaas

- `financial_accounts`, `nb_payments`, `nb_payouts`: RLS ligada, policy de leitura por owner para `authenticated`.
- `neurofinance_contract_acceptances`: leitura por owner e service role gerencia.
- `private.asaas_account_credentials`: service role only.
- `anon`: sem privileges nas tabelas Asaas provider-backed auditadas.
- `authenticated`: apenas selects seguros/por coluna e views seguras.

## 6. Edge Functions

### Funcoes Asaas/NeuroFinance atuais

| Function | JWT esperado | Classificacao |
| --- | --- | --- |
| `asaas-webhook` | `false` | Publica por design, valida `ASAAS_WEBHOOK_TOKEN`. |
| `asaas-financial-sync` | `false` | Interna/scheduled; precisa segredo/cron controlado. |
| `asaas-connect-onboarding` | `true` | User action; deve gravar API key no cofre privado. |
| `asaas-account-sync` | `true` | User action; recupera credencial pela Asaas quando o cofre ainda estiver vazio. |
| `asaas-account-update` | `true` | User action; deve usar cofre privado. |
| `asaas-upload-file`, `asaas-submit-kyc` | `true` | KYC/documentos. |
| `asaas-create-payment`, `asaas-payment-link`, `asaas-payment-actions`, `asaas-refund` | `true` | Cobrancas/acoes de cobranca. |
| `asaas-payout`, `asaas-pix-out`, `asaas-pix`, `asaas-pix-payment`, `asaas-bill-payment` | `true` | BaaS/Pix/outflows. |
| `asaas-invoices` | `true` | NFS-e/fiscal Asaas. |
| `asaas-balance-details` | `true` | Extrato/saldo. |
| `asaas-checkout-branding` | `true` | Branding de checkout; nao deve selecionar `asaas_api_key`. |
| `financial-pin`, `neurofinance-post-onboarding` | `true` | Segurança/UX NeuroFinance. |

### Drift de Cloud

O Cloud lista varias funcoes de user action Asaas com `verify_jwt=false`, apesar do `supabase/config.toml` definir `true`. As principais a corrigir em deploy controlado:

- `asaas-account-sync`
- `asaas-account-update`
- `asaas-balance-details`
- `asaas-connect-onboarding`
- `asaas-create-payment`
- `asaas-payment-link`
- `asaas-payout`
- `asaas-pix-out`
- `asaas-checkout-branding`
- funcoes de assinatura como `create-checkout-session`, `get-current-entitlement`, `continue-free-plan` tambem apareceram com drift e devem ser reimplantadas com cuidado.

Nao reimplantar todas antes de migrar a chave privada: se a nova versao sem fallback publico for publicada enquanto `private.asaas_account_credentials` esta vazio, funcoes que dependem da API key da subconta podem falhar.

## 7. Webhooks Asaas

`asaas-webhook` usa `asaas_webhook_events` para idempotencia e trata:

- Pagamentos: `PAYMENT_CREATED`, `PAYMENT_UPDATED`, `PAYMENT_AUTHORIZED`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, eventos de risco, chargeback, dunning, boleto/checkout viewed, split divergence, estorno e cancelamento/restauracao.
- Transfers/payouts: `TRANSFER_CREATED`, `TRANSFER_PENDING`, `TRANSFER_IN_BANK_PROCESSING`, `TRANSFER_BLOCKED`, `TRANSFER_DONE`, `TRANSFER_FAILED`, `TRANSFER_CANCELLED`.
- Prefixos: `BILL_`, `INVOICE_`, `SUBSCRIPTION_`, `CHECKOUT_`, `RECEIVABLE_ANTICIPATION_`, `ACCOUNT_STATUS_`.
- Genericos notificados: `BALANCE_`, `INTERNAL_TRANSFER_`, `PIX_AUTOMATIC_`, `MOBILE_PHONE_RECHARGE_`.

Fluxo esperado:

1. Persistir evento bruto em `asaas_webhook_events`.
2. Resolver `financial_accounts` por `asaas_account_id` quando vier no payload.
3. Atualizar `nb_payments`, `nb_payouts`, operacoes BaaS ou status da conta.
4. Conciliar em `financial_entries` via `financial_reconciliations`.
5. Atualizar snapshot/overview.
6. Emitir notificacao quando aplicavel.

## 8. Schema final recomendado

Fonte da verdade final:

- Assinatura NeuroNex: `user_subscriptions`, `checkout_sessions`, `subscription_events`, `subscription_audit_logs`.
- Subconta Asaas do psicologo: `financial_accounts` + `private.asaas_account_credentials`.
- Cobrancas Asaas/NeuroFinance: `nb_payments`.
- Lancamentos manuais, agenda e caixa: `financial_entries`.
- Ponte cobranca/lancamento: `financial_reconciliations`.
- Payouts/repasses/saques: `nb_payouts`.
- Pix/BaaS/bill payment/outflows: `neurofinance_baas_operations`, `neurofinance_bill_payments`, `neurofinance_outgoing_requests`.
- NFS-e/fiscal: `invoices` + campos NFS-e em `nb_payments`.
- Webhook/idempotencia: `asaas_webhook_events`.
- Leitura browser: somente views seguras e selects por coluna segura.

Nada novo deve ler `financial_accounts.asaas_api_key`, `base_asaas_events` ou `transactions`.

## 9. Plano de migracao de dados

### Fase 0: backup

Antes de qualquer DROP/DELETE:

1. Criar backup/snapshot do projeto Supabase.
2. Exportar:
   - `financial_accounts`
   - `private.asaas_account_credentials`
   - `asaas_webhook_events`
   - `base_asaas_events`
   - `transactions`
   - `financial_entries`
   - `financial_reconciliations`
   - `nb_payments`
   - `nb_payouts`
3. Registrar contagens e checksums por tabela.

### Fase 1: credenciais Asaas

1. Confirmar que `ASAAS_ACCOUNT_KEY_ENCRYPTION_SECRET` esta configurado nas Edge Functions.
2. Reimplantar primeiro `asaas-account-sync` e `asaas-connect-onboarding` com `verify_jwt=true`.
3. Para cada `financial_accounts` com `asaas_api_key` publica:
   - recuperar subconta pela API Asaas usando email/CPF-CNPJ;
   - gravar API key em `private.asaas_account_credentials`;
   - validar chamada `getAsaasAccountStatus` com a chave privada;
   - marcar metadata de recuperacao.
4. Validar:
   - `count(private.asaas_account_credentials where status='active')` = contas Asaas ativas esperadas;
   - 0 falhas em `asaas-account-sync`;
   - pagamentos/payouts continuam funcionando.
5. Rotacionar a chave Asaas exposta anteriormente.

### Fase 2: deploy de Edge Functions

1. Reimplantar funcoes de user action com `verify_jwt=true`.
2. Manter `asaas-webhook` sem JWT e com token Asaas.
3. Manter funcoes scheduled/internal sem JWT apenas se tiverem segredo proprio, cron controlado ou chamada exclusivamente server-side.
4. Rodar smoke tests:
   - onboarding;
   - sync de conta;
   - criacao de cobranca;
   - webhook de pagamento confirmado;
   - payout/Pix out;
   - NFS-e;
   - saldo/extrato.

### Fase 3: remocao destrutiva

Somente depois das validacoes:

1. `alter table public.financial_accounts drop column asaas_api_key;`
2. `drop table public.base_asaas_events;`
3. Remover qualquer deploy antigo de `base-asaas-webhook`, se existir.
4. Para `transactions`:
   - comparar 30 linhas com `financial_entries.legacy_transaction_id`;
   - exportar arquivo de arquivo morto;
   - remover dependencias em codigo/RPC;
   - remover `legacy_transaction_id` depois de janela de auditoria;
   - dropar `transactions` em migration separada.

## 10. Arquivos relevantes

Arquivos de schema/migration:

- `supabase/migrations/20260709073033_asaas_neurofinance_cloud_schema_hardening.sql`
- `supabase/migrations/20260709154922_harden_neurofinance_grants_and_metrics.sql`

Arquivos de Edge Functions e shared helpers:

- `supabase/functions/_shared/asaas-client.ts`
- `supabase/functions/asaas-account-sync/index.ts`
- `supabase/functions/asaas-connect-onboarding/index.ts`
- `supabase/functions/asaas-webhook/index.ts`
- `supabase/functions/asaas-checkout-branding/index.ts`

Arquivos frontend/types:

- `src/lib/neurofinance-safe-selects.ts`
- `src/lib/__tests__/neurofinance-safe-selects.test.ts`
- `src/integrations/supabase/database.types.ts`
- hooks de transacoes que agora devem usar `financial_entries`, nao `transactions`.

## 11. Riscos e validacao

| Risco | Validacao |
| --- | --- |
| Quebrar conta existente sem chave privada | Migrar/recuperar credencial antes de deploy completo sem fallback. |
| Vazamento cross-tenant financeiro | Testar RLS com dois usuarios: safe views e base tables. |
| Webhook duplicado | Reenviar mesmo evento e confirmar `duplicate=true`/sem duplicidade em `nb_payments`. |
| Receita inflada por cancelamentos | Confirmar `get_financial_metrics` exclui `status='cancelled'`. |
| Assinatura NeuroNex confundida com NeuroFinance | Testar checkout/trial/entitlement separado de `nb_payments`. |
| Remocao de `transactions` quebrar UI antiga | Buscar `.from('transactions')` e validar paridade dos 30 registros antes do DROP. |
| Edge Function com JWT errado | Reconsultar `_list_edge_functions` depois do deploy e comparar com `config.toml`. |

## 12. Rollback

Para migrations nao destrutivas:

- Reverter `get_financial_metrics` para definicao anterior, se necessario.
- Reaplicar grants anteriores somente se um fluxo legitimo quebrar, evitando restaurar `asaas_api_key` para browser.
- Remover views/tabelas novas apenas se houver rollback completo de release.

Para fase destrutiva futura:

- Restaurar snapshot do Supabase se o DROP afetar producao.
- Reimportar export de `transactions`/`base_asaas_events` se necessario.
- Recriar `financial_accounts.asaas_api_key` apenas como rollback emergencial, preenchendo a partir de backup seguro e rotacionando logo depois.
- Reimplantar versao anterior das Edge Functions se o cofre privado falhar.

## 13. Pendencias fora do recorte Asaas

Os advisors e o client tipado revelaram dividas reais fora desta integracao:

- Extensao `vector` no schema `public`.
- Leaked password protection desabilitado no Auth.
- FKs sem indice em agenda/auth/documentos.
- TypeScript global ainda falha em:
  - `src/components/ai-chat/ChatSidebar.tsx`
  - `src/mobile/components/synapse/MobileSynapseWidgetRenderer.tsx`
- O Cloud/types tambem indicam referencias a estruturas ausentes em partes nao Asaas, como `patient_health_metrics` e algumas RPCs de biofeedback, quando o client Supabase e tipado globalmente.

Essas pendencias devem virar uma limpeza separada, para nao misturar a arquitetura financeira com modulos clinicos/mobile.

