-- Keep a single server-side financial PIN per user and expose only safe status metadata.
-- PIN creation, verification and reset continue exclusively through the authenticated
-- financial-pin Edge Function, which uses the service role after reauthentication.

begin;

alter table public.user_financial_settings
  add column if not exists reset_token_hash text,
  add column if not exists reset_token_expires_at timestamptz,
  add column if not exists reset_requested_at timestamptz,
  add column if not exists reset_attempts integer not null default 0,
  add column if not exists pin_updated_at timestamptz,
  add column if not exists pin_last_verified_at timestamptz;

alter table public.user_financial_settings enable row level security;

drop policy if exists "Users can manage their own financial settings"
  on public.user_financial_settings;
drop policy if exists "Users read own financial settings"
  on public.user_financial_settings;

create policy "Users read own financial PIN status"
  on public.user_financial_settings
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.user_financial_settings from anon, authenticated;
grant select (
  id,
  user_id,
  updated_at,
  pin_updated_at,
  pin_last_verified_at
) on table public.user_financial_settings to authenticated;

grant all on table public.user_financial_settings to service_role;

comment on table public.user_financial_settings is
  'Server-managed financial PIN credentials. Authenticated clients may read status metadata only; hashes and reset tokens are Edge-only.';

commit;
