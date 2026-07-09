-- Asaas/NeuroFinance cloud schema hardening.
--
-- Non-destructive phase:
-- - create the missing private credential vault table expected by Edge Functions;
-- - create the missing contract-acceptance audit table used by onboarding;
-- - expose browser-safe read views for Asaas operational tables;
-- - remove direct browser writes from provider-backed tables;
-- - add missing FK indexes and validated relationships where production data is clean.
--
-- Destructive cleanup (dropping financial_accounts.asaas_api_key, base_asaas_events,
-- base-asaas-webhook and legacy transactions) is intentionally handled by a
-- separate, approved migration/runbook after credential migration and validation.

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
grant usage on schema private to authenticated;
grant usage on schema private to service_role;

create table if not exists private.asaas_account_credentials (
  id uuid primary key default gen_random_uuid(),
  financial_account_id uuid not null unique references public.financial_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  asaas_account_id text,
  key_ciphertext text not null,
  key_iv text not null,
  key_tag text not null,
  key_algorithm text not null default 'AES-256-GCM',
  key_version text not null default 'v1',
  status text not null default 'active' check (status in ('active', 'rotating', 'revoked')),
  source text not null default 'edge_function',
  rotated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.asaas_account_credentials enable row level security;

drop policy if exists "Service role manages Asaas private credentials"
  on private.asaas_account_credentials;

create policy "Service role manages Asaas private credentials"
  on private.asaas_account_credentials
  for all
  to service_role
  using (true)
  with check (true);

revoke all on private.asaas_account_credentials from public;
revoke all on private.asaas_account_credentials from anon;
revoke all on private.asaas_account_credentials from authenticated;
grant select, insert, update, delete on private.asaas_account_credentials to service_role;

create index if not exists idx_private_asaas_credentials_user
  on private.asaas_account_credentials(user_id);

create index if not exists idx_private_asaas_credentials_account
  on private.asaas_account_credentials(asaas_account_id)
  where asaas_account_id is not null;

comment on table private.asaas_account_credentials is
  'Private encrypted Asaas subaccount API keys. Ciphertext is encrypted by Edge Functions with an application key stored outside the database.';

comment on column private.asaas_account_credentials.key_ciphertext is
  'Encrypted Asaas API key ciphertext. No plaintext credential should be written to this table.';

comment on column public.financial_accounts.asaas_api_key is
  'Deprecated transitional Asaas key column. Browser roles must not have access; drop after encrypted credential migration and rotation.';

alter table if exists public.financial_accounts
  add column if not exists neuronex_terms_version text,
  add column if not exists asaas_terms_reference text,
  add column if not exists asaas_privacy_policy_reference text;

create table if not exists public.neurofinance_contract_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  financial_account_id uuid references public.financial_accounts(id) on delete set null,
  provider text not null default 'asaas',
  acceptance_type text not null check (
    acceptance_type in (
      'neuronex_terms',
      'asaas_terms',
      'asaas_privacy_policy',
      'financial_onboarding_bundle',
      'pix_random_key_consent'
    )
  ),
  accepted_at timestamptz not null default now(),
  flow_origin text not null,
  content_version text not null,
  content_reference text not null,
  content_hash text not null,
  ip_collection_basis text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.neurofinance_contract_acceptances enable row level security;

drop policy if exists "Users read own NeuroFinance acceptances"
  on public.neurofinance_contract_acceptances;

create policy "Users read own NeuroFinance acceptances"
  on public.neurofinance_contract_acceptances
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Service role manages NeuroFinance acceptances"
  on public.neurofinance_contract_acceptances;

create policy "Service role manages NeuroFinance acceptances"
  on public.neurofinance_contract_acceptances
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.neurofinance_contract_acceptances from anon;
revoke all on public.neurofinance_contract_acceptances from authenticated;
grant select on public.neurofinance_contract_acceptances to authenticated;
grant select, insert, update, delete on public.neurofinance_contract_acceptances to service_role;

create index if not exists idx_neurofinance_acceptances_user_created
  on public.neurofinance_contract_acceptances(user_id, created_at desc);

create index if not exists idx_neurofinance_acceptances_account_type
  on public.neurofinance_contract_acceptances(financial_account_id, acceptance_type, accepted_at desc);

comment on table public.neurofinance_contract_acceptances is
  'Audit trail of server-side financial contract acceptances and Pix random-key consent for Asaas BaaS.';

comment on column public.neurofinance_contract_acceptances.content_hash is
  'Immutable content hash or immutable reference identifier resolved server-side; do not rely on user-provided text.';

comment on column public.neurofinance_contract_acceptances.ip_collection_basis is
  'Reserved for future IP collection only after documenting purpose, lawful basis and retention.';

alter table public.financial_accounts enable row level security;
alter table public.nb_payments enable row level security;
alter table public.nb_payouts enable row level security;

drop policy if exists "Users read own financial_accounts" on public.financial_accounts;
drop policy if exists "Users insert own financial_accounts" on public.financial_accounts;
drop policy if exists "Users update own financial_accounts" on public.financial_accounts;

create policy "Users read own financial_accounts"
  on public.financial_accounts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users read own payments" on public.nb_payments;
drop policy if exists "Users insert own payments" on public.nb_payments;
drop policy if exists "Users update own payments" on public.nb_payments;

create policy "Users read own payments"
  on public.nb_payments
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users read own payouts" on public.nb_payouts;
drop policy if exists "Users insert own payouts" on public.nb_payouts;
drop policy if exists "Users update own payouts" on public.nb_payouts;

create policy "Users read own payouts"
  on public.nb_payouts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.financial_accounts from anon, authenticated;
revoke insert, update, delete on public.nb_payments from anon, authenticated;
revoke insert, update, delete on public.nb_payouts from anon, authenticated;

revoke select on public.financial_accounts from anon, authenticated;
revoke select on public.nb_payments from anon, authenticated;
revoke select on public.nb_payouts from anon, authenticated;

create or replace view public.financial_accounts_safe_v
with (security_invoker = true)
as
select
  fa.id,
  fa.user_id,
  fa.status,
  fa.status as ui_status,
  fa.provider,
  fa.onboarding_started_at,
  fa.onboarding_completed_at,
  fa.charges_enabled,
  fa.payouts_enabled,
  fa.details_submitted,
  fa.default_currency,
  fa.bank_account_last4,
  fa.bank_name,
  fa.pix_enabled,
  fa.card_enabled,
  fa.platform_fee_percent,
  fa.platform_fee_fixed,
  fa.created_at,
  fa.updated_at,
  fa.asaas_account_id,
  fa.asaas_wallet_id,
  coalesce(fa.requirements, '{}'::jsonb) - 'raw' - 'provider_response' as requirements,
  coalesce(fa.requirements, '{}'::jsonb) - 'raw' - 'provider_response' as account_status,
  fa.asaas_onboarding_url,
  fa.asaas_environment,
  fa.last_asaas_event_type,
  fa.last_asaas_event_at,
  fa.last_balance_sync_at,
  fa.last_sync_error,
  fa.holder_name,
  fa.cpf_cnpj,
  fa.birth_date,
  fa.mobile_phone,
  fa.pep_status,
  fa.address_street,
  fa.address_number,
  fa.address_complement,
  fa.address_neighborhood,
  fa.address_city,
  fa.address_state,
  fa.address_postal_code,
  fa.company_type,
  fa.income_value,
  fa.business_url,
  fa.business_description,
  fa.business_mcc,
  fa.bank_code,
  fa.bank_agency,
  fa.bank_account_type,
  fa.bank_holder_name,
  fa.bank_holder_cpf_cnpj,
  fa.tos_accepted_at,
  fa.pix_key_consent_at,
  fa.neuronex_terms_version,
  fa.asaas_terms_reference,
  fa.asaas_privacy_policy_reference
from public.financial_accounts fa;

create or replace view public.nb_payments_safe_v
with (security_invoker = true)
as
select
  p.id,
  p.user_id,
  p.patient_id,
  p.appointment_id,
  p.financial_account_id,
  p.provider,
  p.payment_method_type,
  p.status,
  p.normalized_status,
  p.funds_status,
  p.gross_amount,
  p.platform_fee_amount,
  p.estimated_fee_amount,
  p.actual_fee_amount,
  p.net_amount,
  p.currency,
  p.description,
  p.pix_qr_code,
  p.pix_copy_paste,
  p.checkout_url,
  p.boleto_url,
  p.boleto_pdf,
  coalesce(p.checkout_url, p.nfse_pdf_url) as invoice_url,
  coalesce(p.boleto_url, p.boleto_pdf) as bank_slip_url,
  null::text as receipt_url,
  p.refund_amount,
  p.paid_at,
  p.expires_at,
  p.confirmed_at,
  p.available_at,
  p.estimated_credit_at,
  p.installments,
  p.channel,
  p.dispute_status,
  p.dispute_reason,
  p.dispute_amount,
  (p.status in ('pending', 'overdue', 'created')) as cancelable,
  p.anticipable,
  p.anticipated,
  p.provider_due_date,
  p.nfse_provider,
  p.nfse_reference,
  p.nfse_status,
  p.nfse_number,
  p.nfse_verification_code,
  p.nfse_pdf_url,
  p.nfse_xml_url,
  p.nfse_status_description,
  p.nfse_authorized_at,
  p.nfse_synced_at,
  p.nfse_error_message,
  p.created_at,
  p.updated_at
from public.nb_payments p;

create or replace view public.nb_payouts_safe_v
with (security_invoker = true)
as
select
  po.id,
  po.user_id,
  po.financial_account_id,
  po.provider,
  po.amount,
  po.currency,
  po.status,
  po.operation_type,
  po.fee_amount,
  po.destination_type,
  po.destination_summary,
  null::text as receipt_url,
  null::text as error_code,
  null::text as error_message,
  po.requested_at,
  po.processed_at,
  po.completed_at,
  po.created_at,
  po.updated_at
from public.nb_payouts po;

revoke all on public.financial_accounts_safe_v from anon, authenticated;
revoke all on public.nb_payments_safe_v from anon, authenticated;
revoke all on public.nb_payouts_safe_v from anon, authenticated;

grant select on public.financial_accounts_safe_v to authenticated;
grant select on public.nb_payments_safe_v to authenticated;
grant select on public.nb_payouts_safe_v to authenticated;

grant select (
  id, user_id, status, provider, onboarding_started_at, onboarding_completed_at,
  charges_enabled, payouts_enabled, details_submitted, default_currency,
  bank_account_last4, bank_name, pix_enabled, card_enabled,
  platform_fee_percent, platform_fee_fixed, created_at, updated_at,
  asaas_account_id, asaas_wallet_id, requirements, asaas_onboarding_url,
  asaas_environment, last_asaas_event_type, last_asaas_event_at,
  last_balance_sync_at, last_sync_error, holder_name, cpf_cnpj, birth_date,
  mobile_phone, pep_status, address_street, address_number, address_complement,
  address_neighborhood, address_city, address_state, address_postal_code,
  company_type, income_value, business_url, business_description, business_mcc,
  bank_code, bank_agency, bank_account_type, bank_holder_name,
  bank_holder_cpf_cnpj, tos_accepted_at, pix_key_consent_at,
  neuronex_terms_version, asaas_terms_reference, asaas_privacy_policy_reference
) on public.financial_accounts to authenticated;

grant select (
  id, user_id, patient_id, appointment_id, financial_account_id, provider,
  payment_method_type, status, normalized_status, funds_status, gross_amount,
  platform_fee_amount, estimated_fee_amount, actual_fee_amount, net_amount,
  currency, description, pix_qr_code, pix_copy_paste, checkout_url,
  boleto_url, boleto_pdf, refund_amount, paid_at, expires_at, confirmed_at,
  available_at, estimated_credit_at, installments, channel, dispute_status,
  dispute_reason, dispute_amount, anticipable, anticipated,
  provider_due_date, nfse_provider, nfse_reference, nfse_status, nfse_number,
  nfse_verification_code, nfse_pdf_url, nfse_xml_url, nfse_status_description,
  nfse_authorized_at, nfse_synced_at, nfse_error_message, created_at, updated_at
) on public.nb_payments to authenticated;

grant select (
  id, user_id, financial_account_id, provider, amount, currency, status,
  operation_type, fee_amount, destination_type, destination_summary,
  requested_at, processed_at, completed_at, created_at, updated_at
) on public.nb_payouts to authenticated;

comment on view public.financial_accounts_safe_v is
  'Browser-safe owner read model for NeuroFinance accounts. Excludes Asaas API keys, raw provider payload, metadata, documents, full bank account and onboarding payload.';

comment on view public.nb_payments_safe_v is
  'Browser-safe owner read model for provider-backed payments. Writes remain restricted to Edge Functions and webhooks.';

comment on view public.nb_payouts_safe_v is
  'Browser-safe owner read model for payouts/transfers. Excludes provider payloads, destination payloads, Pix keys and provider identifiers.';

create index if not exists idx_nb_payments_financial_account_id
  on public.nb_payments(financial_account_id);

create index if not exists idx_nb_payments_fee_rule_id
  on public.nb_payments(fee_rule_id)
  where fee_rule_id is not null;

create index if not exists idx_nb_payouts_financial_account_id
  on public.nb_payouts(financial_account_id);

create index if not exists idx_neurofinance_anticipations_financial_account_id
  on public.neurofinance_anticipations(financial_account_id);

create index if not exists idx_neurofinance_anticipations_payment_id
  on public.neurofinance_anticipations(payment_id)
  where payment_id is not null;

create index if not exists idx_neurofinance_baas_operations_financial_account_id
  on public.neurofinance_baas_operations(financial_account_id);

create index if not exists idx_neurofinance_bill_payments_financial_account_id
  on public.neurofinance_bill_payments(financial_account_id);

create index if not exists idx_neurofinance_outgoing_requests_financial_account_id
  on public.neurofinance_outgoing_requests(financial_account_id);

create index if not exists idx_neurofinance_outgoing_requests_payout_id
  on public.neurofinance_outgoing_requests(payout_id)
  where payout_id is not null;

create index if not exists idx_subscription_audit_logs_checkout_session_id
  on public.subscription_audit_logs(checkout_session_id)
  where checkout_session_id is not null;

create index if not exists idx_subscription_audit_logs_event_id
  on public.subscription_audit_logs(event_id)
  where event_id is not null;

create index if not exists idx_subscription_events_checkout_session_id
  on public.subscription_events(checkout_session_id)
  where checkout_session_id is not null;

create index if not exists idx_user_subscriptions_plan_code
  on public.user_subscriptions(plan_code);

do $$
begin
  if to_regclass('public.financial_entries') is not null
     and to_regclass('public.nb_payments') is not null
     and not exists (
       select 1
       from pg_constraint
       where conname = 'financial_entries_neurofinance_charge_id_fkey'
         and conrelid = 'public.financial_entries'::regclass
     )
  then
    alter table public.financial_entries
      add constraint financial_entries_neurofinance_charge_id_fkey
      foreign key (neurofinance_charge_id)
      references public.nb_payments(id)
      on delete set null
      not valid;
  end if;

  if to_regclass('public.financial_reconciliations') is not null
     and to_regclass('public.nb_payments') is not null
     and not exists (
       select 1
       from pg_constraint
       where conname = 'financial_reconciliations_neurofinance_charge_id_fkey'
         and conrelid = 'public.financial_reconciliations'::regclass
     )
  then
    alter table public.financial_reconciliations
      add constraint financial_reconciliations_neurofinance_charge_id_fkey
      foreign key (neurofinance_charge_id)
      references public.nb_payments(id)
      on delete set null
      not valid;
  end if;
end $$;

alter table public.financial_entries
  validate constraint financial_entries_neurofinance_charge_id_fkey;

alter table public.financial_reconciliations
  validate constraint financial_reconciliations_neurofinance_charge_id_fkey;
