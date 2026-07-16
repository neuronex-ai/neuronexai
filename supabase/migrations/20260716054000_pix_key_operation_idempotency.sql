alter table public.neurofinance_baas_operations
  add column if not exists idempotency_key text,
  add column if not exists request_fingerprint text;

create unique index if not exists uq_neurofinance_baas_operations_idempotency
  on public.neurofinance_baas_operations (user_id, operation_type, idempotency_key)
  where idempotency_key is not null;

alter table public.neurofinance_baas_operations
  drop constraint if exists neurofinance_baas_operations_idempotency_key_length;

alter table public.neurofinance_baas_operations
  add constraint neurofinance_baas_operations_idempotency_key_length
  check (idempotency_key is null or char_length(idempotency_key) between 16 and 160);

-- The table stores provider payloads for restricted technical audit. Those
-- payloads must never be queried directly by the professional application.
drop policy if exists "Users read own BaaS operations" on public.neurofinance_baas_operations;
revoke all on table public.neurofinance_baas_operations from anon, authenticated, public;
grant all on table public.neurofinance_baas_operations to service_role;

comment on column public.neurofinance_baas_operations.idempotency_key is
  'Client operation key used to claim a single provider-side mutation.';

comment on column public.neurofinance_baas_operations.request_fingerprint is
  'SHA-256 fingerprint used to reject reuse of an idempotency key with different input.';
