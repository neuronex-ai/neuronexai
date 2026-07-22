-- NeuralCast public newsletter subscriber capture.
-- This copy travels with the feature folder; the canonical NeuroNex migration
-- remains in supabase/migrations/20260722023000_neuralcast_newsletter_subscribers.sql.

create table if not exists public.neuralcast_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  source text not null default '/neuralcast',
  status text not null default 'active' check (status in ('active', 'unsubscribed')),
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists neuralcast_subscribers_email_unique
  on public.neuralcast_subscribers (lower(email));

alter table public.neuralcast_subscribers enable row level security;

revoke all on table public.neuralcast_subscribers from public, anon, authenticated;

create or replace function public.subscribe_neuralcast_newsletter(
  p_email text,
  p_name text default null,
  p_source text default '/neuralcast'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(trim(coalesce(p_email, ''));
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_source text := left(coalesce(nullif(trim(p_source), ''), '/neuralcast'), 240);
  v_id uuid;
begin
  if length(v_email) > 320 or v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;

  insert into public.neuralcast_subscribers (
    email,
    name,
    source,
    status,
    consent_at,
    updated_at
  )
  values (
    v_email,
    left(v_name, 160),
    v_source,
    'active',
    now(),
    now()
  )
  on conflict ((lower(email))) do update
    set name = coalesce(excluded.name, public.neuralcast_subscribers.name),
        source = excluded.source,
        status = 'active',
        consent_at = now(),
        updated_at = now()
  returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'subscriber_id', v_id,
    'status', 'active'
  );
end;
$$;

revoke all on function public.subscribe_neuralcast_newsletter(text, text, text)
  from public;
grant execute on function public.subscribe_neuralcast_newsletter(text, text, text)
  to anon, authenticated;
