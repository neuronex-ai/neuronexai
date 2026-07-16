-- Persistent, atomic abuse protection and append-only audit for the financial PIN.
-- Every callable routine below is reserved to the Edge service role.

begin;

create table if not exists public.financial_pin_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null,
  bucket_type text not null,
  ip_hash text not null default '',
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0,
  consecutive_failures integer not null default 0,
  locked_until timestamptz,
  last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, scope, bucket_type, ip_hash),
  constraint financial_pin_rate_limits_scope_check
    check (scope in ('pin_verify', 'pin_change', 'reset_code', 'reset_request', 'password_reauth')),
  constraint financial_pin_rate_limits_bucket_check
    check (
      (bucket_type = 'user' and ip_hash = '')
      or
      (bucket_type = 'user_ip' and ip_hash ~ '^[0-9a-f]{64}$')
    ),
  constraint financial_pin_rate_limits_attempt_count_check
    check (attempt_count >= 0),
  constraint financial_pin_rate_limits_failure_count_check
    check (consecutive_failures >= 0)
);

alter table public.financial_pin_rate_limits enable row level security;
revoke all on table public.financial_pin_rate_limits from public, anon, authenticated;
grant all on table public.financial_pin_rate_limits to service_role;

create index if not exists financial_pin_rate_limits_locked_idx
  on public.financial_pin_rate_limits (user_id, locked_until desc)
  where locked_until is not null;

create table if not exists public.financial_pin_security_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  user_id uuid not null,
  scope text not null,
  event_type text not null,
  outcome text not null,
  reason_code text not null,
  ip_hash text,
  idempotency_hash text,
  occurred_at timestamptz not null default now(),
  constraint financial_pin_security_events_scope_check
    check (scope in ('pin_verify', 'pin_change', 'reset_code', 'reset_request', 'password_reauth')),
  constraint financial_pin_security_events_type_check
    check (event_type in ('attempt_started', 'attempt_succeeded', 'attempt_failed', 'attempt_blocked')),
  constraint financial_pin_security_events_outcome_check
    check (outcome in ('pending', 'success', 'failure', 'blocked')),
  constraint financial_pin_security_events_reason_check
    check (reason_code ~ '^[A-Z0-9_]{1,64}$'),
  constraint financial_pin_security_events_ip_hash_check
    check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'),
  constraint financial_pin_security_events_idempotency_hash_check
    check (idempotency_hash is null or idempotency_hash ~ '^[0-9a-f]{64}$')
);

alter table public.financial_pin_security_events enable row level security;
revoke all on table public.financial_pin_security_events from public, anon, authenticated;
grant insert, select on table public.financial_pin_security_events to service_role;

create unique index if not exists financial_pin_security_events_attempt_type_uidx
  on public.financial_pin_security_events (attempt_id, event_type);

create unique index if not exists financial_pin_security_events_completion_uidx
  on public.financial_pin_security_events (attempt_id)
  where event_type in ('attempt_succeeded', 'attempt_failed');

create unique index if not exists financial_pin_security_events_idempotency_uidx
  on public.financial_pin_security_events (user_id, scope, idempotency_hash)
  where event_type = 'attempt_started' and idempotency_hash is not null;

create index if not exists financial_pin_security_events_user_time_idx
  on public.financial_pin_security_events (user_id, occurred_at desc);

create or replace function public.prevent_financial_pin_security_event_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'financial PIN security events are append-only';
end;
$$;

drop trigger if exists tr_financial_pin_security_events_append_only
  on public.financial_pin_security_events;
create trigger tr_financial_pin_security_events_append_only
before update or delete on public.financial_pin_security_events
for each row execute function public.prevent_financial_pin_security_event_mutation();

revoke all on function public.prevent_financial_pin_security_event_mutation()
  from public, anon, authenticated;

create or replace function public.begin_financial_pin_attempt(
  p_user_id uuid,
  p_scope text,
  p_ip_hash text default null,
  p_idempotency_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_attempt_id uuid := gen_random_uuid();
  v_ip_hash text := nullif(lower(btrim(coalesce(p_ip_hash, ''))), '');
  v_idempotency_hash text := nullif(lower(btrim(coalesce(p_idempotency_hash, ''))), '');
  v_max_attempts integer;
  v_window_seconds integer;
  v_lock_seconds integer;
  v_user_attempt_count integer;
  v_user_window_started timestamptz;
  v_user_locked_until timestamptz;
  v_user_last_attempt_at timestamptz;
  v_ip_attempt_count integer;
  v_ip_window_started timestamptz;
  v_ip_locked_until timestamptz;
  v_existing_attempt_id uuid;
  v_existing_outcome text;
  v_existing_reason text;
  v_effective_locked_until timestamptz;
begin
  if p_user_id is null then
    raise exception 'financial PIN user is required';
  end if;

  case p_scope
    when 'pin_verify' then
      v_max_attempts := 5;
      v_window_seconds := 900;
      v_lock_seconds := 900;
    when 'pin_change' then
      v_max_attempts := 5;
      v_window_seconds := 900;
      v_lock_seconds := 900;
    when 'reset_code' then
      v_max_attempts := 5;
      v_window_seconds := 900;
      v_lock_seconds := 1800;
    when 'reset_request' then
      v_max_attempts := 3;
      v_window_seconds := 3600;
      v_lock_seconds := 3600;
    when 'password_reauth' then
      v_max_attempts := 5;
      v_window_seconds := 900;
      v_lock_seconds := 1800;
    else
      raise exception 'unsupported financial PIN rate-limit scope';
  end case;

  if v_ip_hash is not null and v_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid financial PIN IP hash';
  end if;

  if v_idempotency_hash is not null and v_idempotency_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid financial PIN idempotency hash';
  end if;

  -- Serializes every security decision for the same user and scope. This closes
  -- the gap where several concurrent requests could all observe an old counter.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_scope, 0));

  if v_idempotency_hash is not null then
    select
      started.attempt_id,
      completed.outcome,
      completed.reason_code
    into
      v_existing_attempt_id,
      v_existing_outcome,
      v_existing_reason
    from public.financial_pin_security_events started
    left join lateral (
      select event.outcome, event.reason_code
      from public.financial_pin_security_events event
      where event.attempt_id = started.attempt_id
        and event.event_type in ('attempt_succeeded', 'attempt_failed')
      order by event.occurred_at desc
      limit 1
    ) completed on true
    where started.user_id = p_user_id
      and started.scope = p_scope
      and started.event_type = 'attempt_started'
      and started.idempotency_hash = v_idempotency_hash
    limit 1;

    if v_existing_attempt_id is not null then
      return jsonb_build_object(
        'allowed', false,
        'replayed', true,
        'attemptId', v_existing_attempt_id,
        'replayOutcome', coalesce(v_existing_outcome, 'pending'),
        'replayReason', coalesce(v_existing_reason, 'OPERATION_IN_PROGRESS')
      );
    end if;
  end if;

  insert into public.financial_pin_rate_limits (user_id, scope, bucket_type, ip_hash)
  values (p_user_id, p_scope, 'user', '')
  on conflict (user_id, scope, bucket_type, ip_hash) do nothing;

  if v_ip_hash is not null then
    insert into public.financial_pin_rate_limits (user_id, scope, bucket_type, ip_hash)
    values (p_user_id, p_scope, 'user_ip', v_ip_hash)
    on conflict (user_id, scope, bucket_type, ip_hash) do nothing;
  end if;

  select attempt_count, window_started_at, locked_until, last_attempt_at
  into v_user_attempt_count, v_user_window_started, v_user_locked_until, v_user_last_attempt_at
  from public.financial_pin_rate_limits
  where user_id = p_user_id
    and scope = p_scope
    and bucket_type = 'user'
    and ip_hash = ''
  for update;

  if v_user_window_started <= v_now - make_interval(secs => v_window_seconds) then
    v_user_attempt_count := 0;
    v_user_window_started := v_now;
    v_user_locked_until := null;
  end if;

  if v_ip_hash is not null then
    select attempt_count, window_started_at, locked_until
    into v_ip_attempt_count, v_ip_window_started, v_ip_locked_until
    from public.financial_pin_rate_limits
    where user_id = p_user_id
      and scope = p_scope
      and bucket_type = 'user_ip'
      and ip_hash = v_ip_hash
    for update;

    if v_ip_window_started <= v_now - make_interval(secs => v_window_seconds) then
      v_ip_attempt_count := 0;
      v_ip_window_started := v_now;
      v_ip_locked_until := null;
    end if;
  end if;

  if p_scope = 'reset_request'
     and v_user_last_attempt_at is not null
     and v_user_last_attempt_at > v_now - interval '60 seconds' then
    v_effective_locked_until := v_user_last_attempt_at + interval '60 seconds';
    insert into public.financial_pin_security_events (
      attempt_id, user_id, scope, event_type, outcome, reason_code, ip_hash, idempotency_hash
    ) values (
      v_attempt_id, p_user_id, p_scope, 'attempt_blocked', 'blocked',
      'RESET_REQUEST_COOLDOWN', v_ip_hash, v_idempotency_hash
    );

    return jsonb_build_object(
      'allowed', false,
      'replayed', false,
      'attemptId', v_attempt_id,
      'lockedUntil', v_effective_locked_until
    );
  end if;

  v_effective_locked_until := greatest(v_user_locked_until, v_ip_locked_until);
  if v_effective_locked_until is not null and v_effective_locked_until > v_now then
    insert into public.financial_pin_security_events (
      attempt_id, user_id, scope, event_type, outcome, reason_code, ip_hash, idempotency_hash
    ) values (
      v_attempt_id, p_user_id, p_scope, 'attempt_blocked', 'blocked',
      'RATE_LIMITED', v_ip_hash, v_idempotency_hash
    );

    return jsonb_build_object(
      'allowed', false,
      'replayed', false,
      'attemptId', v_attempt_id,
      'lockedUntil', v_effective_locked_until
    );
  end if;

  v_user_attempt_count := v_user_attempt_count + 1;
  update public.financial_pin_rate_limits
  set
    window_started_at = v_user_window_started,
    attempt_count = v_user_attempt_count,
    locked_until = case
      when v_user_attempt_count >= v_max_attempts then v_now + make_interval(secs => v_lock_seconds)
      else null
    end,
    last_attempt_at = v_now,
    updated_at = v_now
  where user_id = p_user_id
    and scope = p_scope
    and bucket_type = 'user'
    and ip_hash = '';

  if v_ip_hash is not null then
    v_ip_attempt_count := v_ip_attempt_count + 1;
    update public.financial_pin_rate_limits
    set
      window_started_at = v_ip_window_started,
      attempt_count = v_ip_attempt_count,
      locked_until = case
        when v_ip_attempt_count >= v_max_attempts then v_now + make_interval(secs => v_lock_seconds)
        else null
      end,
      last_attempt_at = v_now,
      updated_at = v_now
    where user_id = p_user_id
      and scope = p_scope
      and bucket_type = 'user_ip'
      and ip_hash = v_ip_hash;
  end if;

  insert into public.financial_pin_security_events (
    attempt_id, user_id, scope, event_type, outcome, reason_code, ip_hash, idempotency_hash
  ) values (
    v_attempt_id, p_user_id, p_scope, 'attempt_started', 'pending',
    'ATTEMPT_RESERVED', v_ip_hash, v_idempotency_hash
  );

  return jsonb_build_object(
    'allowed', true,
    'replayed', false,
    'attemptId', v_attempt_id
  );
end;
$$;

create or replace function public.complete_financial_pin_attempt(
  p_user_id uuid,
  p_attempt_id uuid,
  p_success boolean,
  p_reason_code text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_scope text;
  v_ip_hash text;
  v_reason_code text := upper(btrim(coalesce(p_reason_code, '')));
  v_event_type text;
  v_existing_outcome text;
begin
  if p_user_id is null or p_attempt_id is null then
    raise exception 'financial PIN attempt identity is required';
  end if;
  if v_reason_code !~ '^[A-Z0-9_]{1,64}$' then
    raise exception 'invalid financial PIN reason code';
  end if;

  select scope, ip_hash
  into v_scope, v_ip_hash
  from public.financial_pin_security_events
  where attempt_id = p_attempt_id
    and user_id = p_user_id
    and event_type = 'attempt_started'
  limit 1;

  if v_scope is null then
    raise exception 'financial PIN attempt was not reserved';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || v_scope, 0));

  select outcome
  into v_existing_outcome
  from public.financial_pin_security_events
  where attempt_id = p_attempt_id
    and event_type in ('attempt_succeeded', 'attempt_failed')
  limit 1;

  if v_existing_outcome is not null then
    return jsonb_build_object(
      'recorded', true,
      'replayed', true,
      'outcome', v_existing_outcome
    );
  end if;

  v_event_type := case when p_success then 'attempt_succeeded' else 'attempt_failed' end;

  insert into public.financial_pin_security_events (
    attempt_id, user_id, scope, event_type, outcome, reason_code, ip_hash
  ) values (
    p_attempt_id,
    p_user_id,
    v_scope,
    v_event_type,
    case when p_success then 'success' else 'failure' end,
    v_reason_code,
    v_ip_hash
  );

  if p_success and v_scope <> 'reset_request' then
    update public.financial_pin_rate_limits
    set
      window_started_at = clock_timestamp(),
      attempt_count = 0,
      consecutive_failures = 0,
      locked_until = null,
      updated_at = clock_timestamp()
    where user_id = p_user_id
      and scope = v_scope
      and (
        bucket_type = 'user'
        or (bucket_type = 'user_ip' and ip_hash = coalesce(v_ip_hash, ''))
      );
  elsif not p_success then
    update public.financial_pin_rate_limits
    set
      consecutive_failures = consecutive_failures + 1,
      updated_at = clock_timestamp()
    where user_id = p_user_id
      and scope = v_scope
      and (bucket_type = 'user' or ip_hash = coalesce(v_ip_hash, ''));
  end if;

  return jsonb_build_object('recorded', true, 'replayed', false);
end;
$$;

create or replace function public.commit_financial_pin_change(
  p_user_id uuid,
  p_pin_hash text,
  p_expected_reset_token_hash text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_current_reset_hash text;
  v_current_reset_expires_at timestamptz;
begin
  if p_user_id is null
     or p_pin_hash !~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$' then
    raise exception 'financial PIN identity and hash are required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':pin_change', 0));

  select reset_token_hash, reset_token_expires_at
  into v_current_reset_hash, v_current_reset_expires_at
  from public.user_financial_settings
  where user_id = p_user_id
  for update;

  if p_expected_reset_token_hash is not null
     and (
       v_current_reset_hash is distinct from p_expected_reset_token_hash
       or v_current_reset_expires_at is null
       or v_current_reset_expires_at <= clock_timestamp()
     ) then
    return false;
  end if;

  insert into public.user_financial_settings (
    user_id,
    pin_hash,
    reset_token_hash,
    reset_token_expires_at,
    reset_requested_at,
    reset_attempts,
    pin_updated_at,
    updated_at
  ) values (
    p_user_id,
    p_pin_hash,
    null,
    null,
    null,
    0,
    clock_timestamp(),
    clock_timestamp()
  )
  on conflict (user_id) do update
  set
    pin_hash = excluded.pin_hash,
    reset_token_hash = null,
    reset_token_expires_at = null,
    reset_requested_at = null,
    reset_attempts = 0,
    pin_updated_at = excluded.pin_updated_at,
    updated_at = excluded.updated_at;

  return true;
end;
$$;

revoke all on function public.begin_financial_pin_attempt(uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function public.complete_financial_pin_attempt(uuid, uuid, boolean, text)
  from public, anon, authenticated;
revoke all on function public.commit_financial_pin_change(uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.begin_financial_pin_attempt(uuid, text, text, text)
  to service_role;
grant execute on function public.complete_financial_pin_attempt(uuid, uuid, boolean, text)
  to service_role;
grant execute on function public.commit_financial_pin_change(uuid, text, text)
  to service_role;

comment on table public.financial_pin_rate_limits is
  'Persistent per-user and, when safely pseudonymized, per-user/IP financial PIN abuse buckets.';
comment on table public.financial_pin_security_events is
  'Append-only financial PIN security audit. Contains outcomes and pseudonymous context only; never credentials.';

commit;
