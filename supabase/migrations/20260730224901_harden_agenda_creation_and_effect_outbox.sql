-- Agenda Desktop hardening
--
-- This migration deliberately keeps the appointment row/series transaction as
-- the source of truth. Provider calls are represented by a private outbox and
-- happen only after the canonical transaction commits.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Private post-commit effect outbox
-- ---------------------------------------------------------------------------

create table private.appointment_effect_outbox (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  appointment_revision integer not null default 1,
  effect_type text not null,
  operation text not null,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  payload_fingerprint text not null,
  idempotency_key text not null,
  attempts integer not null default 0,
  max_attempts integer not null default 8,
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  result_safe jsonb,
  last_error text,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_effect_outbox_revision_check
    check (appointment_revision >= 1),
  constraint appointment_effect_outbox_type_check
    check (effect_type in ('google_sync', 'teleconsultation_room', 'neurofinance_charge')),
  constraint appointment_effect_outbox_operation_check
    check (operation in ('create', 'update', 'cancel')),
  constraint appointment_effect_outbox_status_check
    check (status in (
      'pending', 'processing', 'waiting_connection',
      'completed', 'failed', 'cancelled'
    )),
  constraint appointment_effect_outbox_attempts_check
    check (attempts >= 0 and max_attempts between 1 and 25),
  constraint appointment_effect_outbox_fingerprint_check
    check (payload_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint appointment_effect_outbox_idempotency_check
    check (char_length(idempotency_key) between 8 and 240),
  constraint appointment_effect_outbox_payload_check
    check (
      jsonb_typeof(payload) = 'object'
      and octet_length(payload::text) <= 262144
      and (result_safe is null or (
        jsonb_typeof(result_safe) = 'object'
        and octet_length(result_safe::text) <= 65536
      ))
    ),
  constraint appointment_effect_outbox_lease_check
    check (
      (status = 'processing' and lease_token is not null and lease_expires_at is not null)
      or (status <> 'processing' and lease_token is null and lease_expires_at is null)
    ),
  unique (professional_id, idempotency_key)
);

create index appointment_effect_outbox_appointment_idx
  on private.appointment_effect_outbox (appointment_id, created_at desc);

create index appointment_effect_outbox_ready_idx
  on private.appointment_effect_outbox (effect_type, next_attempt_at, created_at)
  where status in ('pending', 'failed');

create index appointment_effect_outbox_stale_lease_idx
  on private.appointment_effect_outbox (lease_expires_at, created_at)
  where status = 'processing';

alter table private.appointment_effect_outbox enable row level security;
revoke all on table private.appointment_effect_outbox
  from public, anon, authenticated, service_role;

comment on table private.appointment_effect_outbox is
  'Private, idempotent post-commit provider work. Workers must use the restricted RPCs.';
comment on column private.appointment_effect_outbox.payload is
  'Provider-independent input. Secrets and raw invitation capabilities are forbidden.';

create or replace function private.enqueue_appointment_effect(
  p_professional_id uuid,
  p_appointment_id uuid,
  p_appointment_revision integer,
  p_effect_type text,
  p_operation text,
  p_payload jsonb,
  p_idempotency_key text,
  p_status text default 'pending'
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_fingerprint text;
  v_existing private.appointment_effect_outbox%rowtype;
  v_id uuid;
begin
  if jsonb_typeof(v_payload) <> 'object' then
    raise exception 'Appointment effect payload must be an object' using errcode = '22023';
  end if;
  if v_payload ?| array[
    'accessToken', 'refreshToken', 'token', 'tokenHash',
    'invitationToken', 'responsePath'
  ] then
    raise exception 'Raw credentials cannot be persisted in the appointment effect outbox'
      using errcode = '22023';
  end if;
  if p_status not in ('pending', 'waiting_connection') then
    raise exception 'Invalid initial appointment effect status' using errcode = '22023';
  end if;

  v_fingerprint := encode(digest(v_payload::text, 'sha256'), 'hex');

  insert into private.appointment_effect_outbox (
    professional_id,
    appointment_id,
    appointment_revision,
    effect_type,
    operation,
    status,
    payload,
    payload_fingerprint,
    idempotency_key
  ) values (
    p_professional_id,
    p_appointment_id,
    greatest(coalesce(p_appointment_revision, 1), 1),
    p_effect_type,
    p_operation,
    p_status,
    v_payload,
    v_fingerprint,
    p_idempotency_key
  )
  on conflict (professional_id, idempotency_key) do nothing
  returning id into v_id;

  if v_id is not null then
    return v_id;
  end if;

  select effect.* into v_existing
  from private.appointment_effect_outbox effect
  where effect.professional_id = p_professional_id
    and effect.idempotency_key = p_idempotency_key;

  if v_existing.payload_fingerprint <> v_fingerprint
    or v_existing.appointment_id <> p_appointment_id
    or v_existing.effect_type <> p_effect_type
    or v_existing.operation <> p_operation
  then
    raise exception 'Appointment effect idempotency key represents another payload'
      using errcode = '23505';
  end if;

  return v_existing.id;
end;
$$;

revoke all on function private.enqueue_appointment_effect(
  uuid, uuid, integer, text, text, jsonb, text, text
) from public, anon, authenticated, service_role;

create or replace function public.claim_appointment_effect_outbox(
  p_limit integer default 20,
  p_effect_type text default null,
  p_outbox_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_rows jsonb;
begin
  if p_effect_type is not null
    and p_effect_type not in ('google_sync', 'teleconsultation_room', 'neurofinance_charge')
  then
    raise exception 'Invalid appointment effect type' using errcode = '22023';
  end if;

  with candidates as (
    select effect.id
    from private.appointment_effect_outbox effect
    where (
        effect.status in ('pending', 'failed')
        or (effect.status = 'processing' and effect.lease_expires_at <= now())
      )
      and effect.next_attempt_at <= now()
      and effect.attempts < effect.max_attempts
      and (p_effect_type is null or effect.effect_type = p_effect_type)
      and (p_outbox_id is null or effect.id = p_outbox_id)
    order by effect.next_attempt_at, effect.created_at, effect.id
    limit case
      when p_outbox_id is null then least(greatest(coalesce(p_limit, 20), 1), 100)
      else 1
    end
    for update skip locked
  ), claimed as (
    update private.appointment_effect_outbox effect
    set
      status = 'processing',
      attempts = effect.attempts + 1,
      lease_token = gen_random_uuid(),
      lease_expires_at = now() + interval '5 minutes',
      updated_at = now(),
      last_error = null
    from candidates
    where effect.id = candidates.id
    returning effect.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', claimed.id,
    'professionalId', claimed.professional_id,
    'appointmentId', claimed.appointment_id,
    'appointmentRevision', claimed.appointment_revision,
    'effectType', claimed.effect_type,
    'operation', claimed.operation,
    'payload', claimed.payload,
    'payloadFingerprint', claimed.payload_fingerprint,
    'idempotencyKey', claimed.idempotency_key,
    'attempt', claimed.attempts,
    'maxAttempts', claimed.max_attempts,
    'leaseToken', claimed.lease_token,
    'leaseExpiresAt', claimed.lease_expires_at
  )), '[]'::jsonb)
  into v_rows
  from claimed;

  return v_rows;
end;
$$;

create or replace function public.complete_appointment_effect_outbox(
  p_outbox_id uuid,
  p_lease_token uuid,
  p_result_safe jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_effect private.appointment_effect_outbox%rowtype;
begin
  if jsonb_typeof(coalesce(p_result_safe, '{}'::jsonb)) <> 'object'
    or octet_length(coalesce(p_result_safe, '{}'::jsonb)::text) > 65536
  then
    raise exception 'Invalid safe appointment effect result' using errcode = '22023';
  end if;

  update private.appointment_effect_outbox effect
  set
    status = 'completed',
    result_safe = coalesce(p_result_safe, '{}'::jsonb),
    completed_at = now(),
    lease_token = null,
    lease_expires_at = null,
    last_error = null,
    updated_at = now()
  where effect.id = p_outbox_id
    and effect.status = 'processing'
    and effect.lease_token = p_lease_token
  returning effect.* into v_effect;

  if not found then
    raise exception 'Appointment effect lease is no longer valid' using errcode = '40001';
  end if;

  return jsonb_build_object(
    'success', true,
    'id', v_effect.id,
    'status', v_effect.status,
    'completedAt', v_effect.completed_at
  );
end;
$$;

create or replace function public.retry_appointment_effect_outbox(
  p_outbox_id uuid,
  p_lease_token uuid,
  p_error text,
  p_retryable boolean default true,
  p_wait_for_connection boolean default false,
  p_retry_after_seconds integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_effect private.appointment_effect_outbox%rowtype;
  v_delay integer;
begin
  v_delay := least(
    greatest(
      coalesce(
        p_retry_after_seconds,
        (30 * power(2, least((select attempts from private.appointment_effect_outbox where id = p_outbox_id), 7)))::integer
      ),
      5
    ),
    86400
  );

  update private.appointment_effect_outbox effect
  set
    status = case
      when p_wait_for_connection then 'waiting_connection'
      when not coalesce(p_retryable, true) or effect.attempts >= effect.max_attempts then 'failed'
      else 'failed'
    end,
    attempts = case
      when p_wait_for_connection then greatest(effect.attempts - 1, 0)
      when not coalesce(p_retryable, true) then effect.max_attempts
      else effect.attempts
    end,
    next_attempt_at = case
      when p_wait_for_connection then effect.next_attempt_at
      else now() + make_interval(secs => v_delay)
    end,
    lease_token = null,
    lease_expires_at = null,
    last_error = left(coalesce(nullif(p_error, ''), 'provider_error'), 1000),
    updated_at = now()
  where effect.id = p_outbox_id
    and effect.status = 'processing'
    and effect.lease_token = p_lease_token
  returning effect.* into v_effect;

  if not found then
    raise exception 'Appointment effect lease is no longer valid' using errcode = '40001';
  end if;

  return jsonb_build_object(
    'success', true,
    'id', v_effect.id,
    'status', v_effect.status,
    'attempts', v_effect.attempts,
    'maxAttempts', v_effect.max_attempts,
    'nextAttemptAt', v_effect.next_attempt_at
  );
end;
$$;

revoke all on function public.claim_appointment_effect_outbox(integer, text, uuid)
  from public, anon, authenticated;
revoke all on function public.complete_appointment_effect_outbox(uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.retry_appointment_effect_outbox(
  uuid, uuid, text, boolean, boolean, integer
) from public, anon, authenticated;

grant execute on function public.claim_appointment_effect_outbox(integer, text, uuid)
  to service_role;
grant execute on function public.complete_appointment_effect_outbox(uuid, uuid, jsonb)
  to service_role;
grant execute on function public.retry_appointment_effect_outbox(
  uuid, uuid, text, boolean, boolean, integer
) to service_role;

-- Patch the appointment provider state without a read/modify/write race in an
-- Edge Function. This deliberately does not transition the outbox; the worker
-- follows it with complete_... or retry_... using the same lease token.
create or replace function public.patch_appointment_google_sync_effect(
  p_appointment_id uuid,
  p_revision integer,
  p_outbox_id uuid,
  p_lease_token uuid,
  p_google_event_id text,
  p_google_meet_link text,
  p_status text,
  p_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_effect private.appointment_effect_outbox%rowtype;
  v_appointment public.appointments%rowtype;
  v_status text := lower(coalesce(p_status, ''));
begin
  if v_status not in ('synced', 'failed', 'queued', 'waiting_connection', 'conflict') then
    raise exception 'Invalid Google sync status' using errcode = '22023';
  end if;

  -- Read the immutable routing columns first, then follow the global lock
  -- order: appointment row -> appointment advisory -> outbox row.
  select effect.* into v_effect
  from private.appointment_effect_outbox effect
  where effect.id = p_outbox_id;

  if not found
    or v_effect.effect_type <> 'google_sync'
    or v_effect.appointment_id <> p_appointment_id
  then
    raise exception 'Google sync effect not found' using errcode = 'P0002';
  end if;

  select appointment.* into v_appointment
  from public.appointments appointment
  where appointment.id = p_appointment_id
    and appointment.user_id = v_effect.professional_id
  for update;

  if not found then
    raise exception 'Appointment not found for Google sync effect' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('appointment:' || p_appointment_id::text, 0)
  );

  select effect.* into v_effect
  from private.appointment_effect_outbox effect
  where effect.id = p_outbox_id
    and effect.appointment_id = p_appointment_id
    and effect.appointment_revision = p_revision
    and effect.effect_type = 'google_sync'
    and effect.status = 'processing'
    and effect.lease_token = p_lease_token
  for update;

  if not found then
    raise exception 'Google sync effect lease is no longer valid' using errcode = '40001';
  end if;
  if v_appointment.confirmation_revision <> p_revision then
    raise exception 'Appointment changed after the Google sync effect was claimed'
      using errcode = '40001';
  end if;

  update public.appointments appointment
  set
    google_event_id = case
      when nullif(p_google_event_id, '') is not null then p_google_event_id
      else appointment.google_event_id
    end,
    google_meet_link = case
      when nullif(p_google_meet_link, '') is not null then p_google_meet_link
      else appointment.google_meet_link
    end,
    metadata = (coalesce(appointment.metadata, '{}'::jsonb) - 'googleSyncError')
      || jsonb_strip_nulls(jsonb_build_object(
        'syncStatus', v_status,
        'googleSyncState', v_status,
        'googleSyncError', case when v_status = 'synced' then null else left(p_error, 500) end,
        'googleSyncedAt', case when v_status = 'synced' then now() else null end
      ))
  where appointment.id = p_appointment_id
  returning * into v_appointment;

  return jsonb_build_object(
    'success', true,
    'appointmentId', v_appointment.id,
    'appointmentRevision', v_appointment.confirmation_revision,
    'syncStatus', v_status,
    'googleEventId', v_appointment.google_event_id,
    'googleMeetLink', v_appointment.google_meet_link
  );
end;
$$;

revoke all on function public.patch_appointment_google_sync_effect(
  uuid, integer, uuid, uuid, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.patch_appointment_google_sync_effect(
  uuid, integer, uuid, uuid, text, text, text, text
) to service_role;

-- Keep the existing worker and webhook secret. The worker claims work through
-- the service-role-only RPCs above; the dispatcher never sends effect payloads.
create or replace function private.dispatch_appointment_effect_outbox()
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_secret text;
  v_base_url constant text := 'https://krewdaklcyzqfxkkgvqr.supabase.co';
begin
  if not exists (
    select 1
    from private.appointment_effect_outbox effect
    where (
        effect.status in ('pending', 'failed')
        or (effect.status = 'processing' and effect.lease_expires_at <= now())
      )
      and effect.next_attempt_at <= now()
      and effect.attempts < effect.max_attempts
  ) then
    return;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'appointment_communication_webhook_secret'
  order by created_at desc
  limit 1;

  if v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := v_base_url || '/functions/v1/process-appointment-communications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-neuronex-webhook-secret', v_secret
    ),
    body := jsonb_build_object('limit', 20, 'processEffects', true)
  );
end;
$$;

revoke all on function private.dispatch_appointment_effect_outbox()
  from public, anon, authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'dispatch-appointment-effect-outbox';

    perform cron.schedule(
      'dispatch-appointment-effect-outbox',
      '*/2 * * * *',
      'select private.dispatch_appointment_effect_outbox()'
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Canonical appointment -> post-commit effects bridge
-- ---------------------------------------------------------------------------

create or replace function private.appointment_has_google_connection(
  p_professional_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  v_connected boolean := false;
begin
  if to_regclass('public.user_google_tokens') is null then
    return false;
  end if;

  execute 'select exists (
    select 1 from public.user_google_tokens token_row where token_row.user_id = $1
  )'
  into v_connected
  using p_professional_id;

  return coalesce(v_connected, false);
end;
$$;

revoke all on function private.appointment_has_google_connection(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.appointment_google_relevant_metadata(
  p_metadata jsonb
)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'kind', coalesce(p_metadata, '{}'::jsonb) -> 'kind',
    'sessionType', coalesce(p_metadata, '{}'::jsonb) -> 'sessionType',
    'modality', coalesce(p_metadata, '{}'::jsonb) -> 'modality',
    'durationMinutes', coalesce(p_metadata, '{}'::jsonb) -> 'durationMinutes',
    'eventTitle', coalesce(p_metadata, '{}'::jsonb) -> 'eventTitle',
    'eventCategory', coalesce(p_metadata, '{}'::jsonb) -> 'eventCategory',
    'eventCategoryLabel', coalesce(p_metadata, '{}'::jsonb) -> 'eventCategoryLabel',
    'eventLocation', coalesce(p_metadata, '{}'::jsonb) -> 'eventLocation',
    'eventNotes', coalesce(p_metadata, '{}'::jsonb) -> 'eventNotes'
  ));
$$;

revoke all on function private.appointment_google_relevant_metadata(jsonb)
  from public, anon, authenticated, service_role;

-- Merge only professional-editable clinical fields. Provider state,
-- provenance and finance keys cannot be overwritten by a stale browser row.
create or replace function public.patch_appointment_clinical_details(
  p_appointment_id uuid,
  p_notes text,
  p_notes_set boolean,
  p_metadata_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_professional_id uuid := auth.uid();
  v_patch jsonb := coalesce(p_metadata_patch, '{}'::jsonb);
  v_appointment public.appointments%rowtype;
begin
  if v_professional_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(v_patch) <> 'object'
    or v_patch - array[
      'kind', 'sessionType', 'modality', 'durationMinutes',
      'eventTitle', 'eventCategory', 'eventCategoryLabel',
      'eventLocation', 'eventNotes'
    ] <> '{}'::jsonb
  then
    raise exception 'Clinical metadata patch contains protected fields'
      using errcode = '22023';
  end if;
  if octet_length(v_patch::text) > 32768
    or (coalesce(p_notes_set, false) and octet_length(coalesce(p_notes, '')) > 65536)
  then
    raise exception 'Clinical appointment details are too large' using errcode = '22023';
  end if;
  if v_patch ? 'kind'
    and v_patch ->> 'kind' not in ('session', 'event', 'block')
  then
    raise exception 'Invalid appointment kind' using errcode = '22023';
  end if;
  if v_patch ? 'modality'
    and v_patch ->> 'modality' not in ('presencial', 'online', 'block')
  then
    raise exception 'Invalid appointment modality' using errcode = '22023';
  end if;
  if v_patch ? 'durationMinutes' then
    if jsonb_typeof(v_patch -> 'durationMinutes') <> 'number'
      or (v_patch ->> 'durationMinutes')::numeric <> trunc((v_patch ->> 'durationMinutes')::numeric)
      or (v_patch ->> 'durationMinutes')::integer not between 15 and 1440
    then
      raise exception 'Invalid appointment duration' using errcode = '22023';
    end if;
  end if;

  select appointment.* into v_appointment
  from public.appointments appointment
  where appointment.id = p_appointment_id
    and appointment.user_id = v_professional_id
  for update;

  if not found then
    raise exception 'Appointment not found' using errcode = 'P0002';
  end if;
  if v_appointment.lifecycle_status in ('cancelled', 'in_progress', 'completed', 'closed') then
    raise exception 'Appointment no longer accepts clinical detail changes'
      using errcode = '55000';
  end if;

  update public.appointments appointment
  set
    notes = case when coalesce(p_notes_set, false) then p_notes else appointment.notes end,
    metadata = coalesce(appointment.metadata, '{}'::jsonb)
      || v_patch
      || jsonb_build_object('localUpdatedAt', now()),
    updated_at = now()
  where appointment.id = p_appointment_id
  returning appointment.* into v_appointment;

  return to_jsonb(v_appointment);
end;
$$;

revoke all on function public.patch_appointment_clinical_details(
  uuid, text, boolean, jsonb
) from public, anon, authenticated;
grant execute on function public.patch_appointment_clinical_details(
  uuid, text, boolean, jsonb
) to authenticated;

create or replace function private.prepare_appointment_external_effect_state()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_google_connected boolean;
  v_google_origin boolean;
  v_schedule_changed boolean;
  v_financial_mode text;
  v_series_financial jsonb := '{}'::jsonb;
begin
  if jsonb_typeof(coalesce(new.metadata, '{}'::jsonb)) <> 'object' then
    new.metadata := '{}'::jsonb;
  end if;

  v_schedule_changed := tg_op = 'INSERT' or (
    new.start_time is distinct from old.start_time
    or new.end_time is distinct from old.end_time
    or new.type is distinct from old.type
    or new.location is distinct from old.location
    or new.notes is distinct from old.notes
    or private.appointment_google_relevant_metadata(new.metadata)
      is distinct from private.appointment_google_relevant_metadata(old.metadata)
    or new.lifecycle_status is distinct from old.lifecycle_status
  );

  if not v_schedule_changed then
    return new;
  end if;

  if new.series_id is not null then
    select coalesce(series.financial_snapshot, '{}'::jsonb)
    into v_series_financial
    from public.appointment_series series
    where series.id = new.series_id;
  end if;

  v_financial_mode := lower(coalesce(
    nullif(new.metadata #>> '{financial,mode}', ''),
    nullif(v_series_financial ->> 'mode', ''),
    'none'
  ));

  -- `none` is authoritative. A stale UI flag cannot create a charge later.
  if v_financial_mode = 'none' then
    new.metadata := new.metadata || jsonb_build_object(
      'financial', coalesce(new.metadata -> 'financial', '{}'::jsonb)
        || jsonb_build_object(
          'mode', 'none',
          'neurofinanceChargeRequested', false
        )
    );
  elsif v_financial_mode in ('manual', 'package', 'insurance', 'neurofinance') then
    new.metadata := new.metadata || jsonb_build_object(
      'financial', coalesce(new.metadata -> 'financial', '{}'::jsonb)
        || jsonb_build_object('mode', v_financial_mode)
    );
  end if;

  v_google_connected := private.appointment_has_google_connection(new.user_id);
  v_google_origin := new.action_origin = 'google_calendar'
    or lower(coalesce(new.metadata ->> 'origin', '')) = 'google';

  new.metadata := new.metadata || jsonb_build_object(
    'syncStatus', case
      when v_google_origin or new.google_event_id is not null
        and not v_schedule_changed then 'synced'
      when v_google_connected then 'queued'
      when new.google_event_id is not null then 'queued'
      else 'not_configured'
    end,
    'googleSyncState', case
      when v_google_origin or new.google_event_id is not null
        and not v_schedule_changed then 'synced'
      when v_google_connected then 'queued'
      when new.google_event_id is not null then 'queued'
      else 'not_configured'
    end
  );

  return new;
end;
$$;

revoke all on function private.prepare_appointment_external_effect_state()
  from public, anon, authenticated, service_role;

drop trigger if exists appointments_20_prepare_external_effect_state
  on public.appointments;
create trigger appointments_20_prepare_external_effect_state
before insert or update of
  start_time, end_time, type, location, notes, lifecycle_status, metadata, google_event_id
on public.appointments
for each row execute function private.prepare_appointment_external_effect_state();

create or replace function private.enqueue_appointment_external_effects()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_google_connected boolean;
  v_cancelled boolean;
  v_schedule_changed boolean;
  v_operation text;
  v_revision integer := greatest(coalesce(new.confirmation_revision, 1), 1);
  v_financial jsonb := coalesce(new.metadata -> 'financial', '{}'::jsonb);
  v_series_financial jsonb := '{}'::jsonb;
  v_financial_mode text;
  v_amount_cents bigint;
  v_payment_method text;
  v_due_date date;
  v_operation_id text;
begin
  v_cancelled := new.lifecycle_status = 'cancelled'
    or lower(coalesce(new.status, '')) in ('cancelled', 'canceled', 'cancelled_by_patient');
  v_schedule_changed := tg_op = 'INSERT' or (
    new.start_time is distinct from old.start_time
    or new.end_time is distinct from old.end_time
    or new.type is distinct from old.type
    or new.location is distinct from old.location
    or new.notes is distinct from old.notes
    or private.appointment_google_relevant_metadata(new.metadata)
      is distinct from private.appointment_google_relevant_metadata(old.metadata)
    or new.lifecycle_status is distinct from old.lifecycle_status
  );

  if not v_schedule_changed then
    return new;
  end if;

  v_operation := case
    when v_cancelled then 'cancel'
    when tg_op = 'INSERT' then 'create'
    else 'update'
  end;
  v_google_connected := private.appointment_has_google_connection(new.user_id);

  if v_cancelled then
    update private.appointment_effect_outbox effect
    set
      status = 'cancelled',
      cancelled_at = now(),
      lease_token = null,
      lease_expires_at = null,
      last_error = 'appointment_cancelled',
      updated_at = now()
    where effect.appointment_id = new.id
      and effect.effect_type in ('teleconsultation_room', 'neurofinance_charge')
      and effect.status in ('pending', 'failed', 'waiting_connection', 'processing');
  end if;

  if lower(coalesce(new.metadata ->> 'syncStatus', '')) = 'queued'
    and (v_google_connected or new.google_event_id is not null)
  then
    perform private.enqueue_appointment_effect(
      new.user_id,
      new.id,
      v_revision,
      'google_sync',
      v_operation,
      jsonb_strip_nulls(jsonb_build_object(
        'appointmentId', new.id,
        'appointmentRevision', v_revision,
        'operation', v_operation,
        'googleEventId', new.google_event_id
      )),
      'appointment:' || new.id::text || ':revision:' || v_revision::text
        || ':google:' || v_operation,
      case when v_google_connected then 'pending' else 'waiting_connection' end
    );
  end if;

  if new.patient_id is not null and (
    (not v_cancelled and new.type = 'online')
    or (v_cancelled and (
      old.type = 'online'
      or coalesce(old.metadata -> 'teleconsultationRoom', '{}'::jsonb) <> '{}'::jsonb
    ))
  ) then
    perform private.enqueue_appointment_effect(
      new.user_id,
      new.id,
      v_revision,
      'teleconsultation_room',
      v_operation,
      jsonb_build_object(
        'appointmentId', new.id,
        'appointmentRevision', v_revision,
        'operation', v_operation
      ),
      'appointment:' || new.id::text || ':revision:' || v_revision::text
        || ':teleconsultation:' || v_operation
    );
  end if;

  if new.series_id is not null then
    select coalesce(series.financial_snapshot, '{}'::jsonb)
    into v_series_financial
    from public.appointment_series series
    where series.id = new.series_id;
  end if;

  v_financial := v_series_financial || v_financial;
  v_financial_mode := lower(coalesce(nullif(v_financial ->> 'mode', ''), 'none'));
  v_amount_cents := round(100 * coalesce(
    nullif(v_financial ->> 'value_per_session', '')::numeric,
    nullif(v_financial ->> 'amount', '')::numeric,
    nullif(v_financial ->> 'transactionAmount', '')::numeric,
    0
  ))::bigint;
  v_payment_method := coalesce(
    nullif(v_financial ->> 'payment_method', ''),
    nullif(v_financial ->> 'transactionMethod', ''),
    'patient_decides'
  );
  v_due_date := coalesce(
    nullif(v_financial ->> 'due_date', '')::date,
    new.start_time::date
  );
  v_operation_id := 'appointment:' || new.id::text || ':revision:'
    || v_revision::text || ':neurofinance:create';

  if not v_cancelled
    and v_financial_mode = 'neurofinance'
    and v_amount_cents > 0
  then
    perform private.enqueue_appointment_effect(
      new.user_id,
      new.id,
      v_revision,
      'neurofinance_charge',
      'create',
      jsonb_strip_nulls(jsonb_build_object(
        'appointmentId', new.id,
        'appointmentRevision', v_revision,
        'amountCents', v_amount_cents,
        'paymentMethod', v_payment_method,
        'dueDate', v_due_date,
        'financialEntryId', new.financial_entry_id,
        'operationId', v_operation_id,
        'idempotencyKey', v_operation_id
      )),
      v_operation_id
    );
  end if;

  return new;
end;
$$;

revoke all on function private.enqueue_appointment_external_effects()
  from public, anon, authenticated, service_role;

drop trigger if exists appointments_enqueue_external_effects
  on public.appointments;
create trigger appointments_enqueue_external_effects
after insert or update of start_time, end_time, type, location, notes, lifecycle_status, metadata
on public.appointments
for each row execute function private.enqueue_appointment_external_effects();

-- OAuth reconnection resumes linked Google work without auto-uploading every
-- appointment that has never been synchronized.
create or replace function private.resume_google_appointment_effects()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_appointment public.appointments%rowtype;
  v_operation text;
begin
  update private.appointment_effect_outbox effect
  set status = 'pending', next_attempt_at = now(), updated_at = now()
  where effect.professional_id = new.user_id
    and effect.effect_type = 'google_sync'
    and effect.status = 'waiting_connection';

  for v_appointment in
    select appointment.*
    from public.appointments appointment
    where appointment.user_id = new.user_id
      and appointment.google_event_id is not null
      and lower(coalesce(appointment.metadata ->> 'syncStatus', ''))
        in ('queued', 'failed', 'not_configured')
  loop
    v_operation := case
      when v_appointment.lifecycle_status = 'cancelled'
        or lower(coalesce(v_appointment.status, ''))
          in ('cancelled', 'canceled', 'cancelled_by_patient')
      then 'cancel'
      else 'update'
    end;

    perform private.enqueue_appointment_effect(
      v_appointment.user_id,
      v_appointment.id,
      greatest(coalesce(v_appointment.confirmation_revision, 1), 1),
      'google_sync',
      v_operation,
      jsonb_strip_nulls(jsonb_build_object(
        'appointmentId', v_appointment.id,
        'appointmentRevision', greatest(coalesce(v_appointment.confirmation_revision, 1), 1),
        'operation', v_operation,
        'googleEventId', v_appointment.google_event_id
      )),
      'appointment:' || v_appointment.id::text || ':revision:'
        || greatest(coalesce(v_appointment.confirmation_revision, 1), 1)::text
        || ':google:' || v_operation
    );
  end loop;

  return new;
end;
$$;

revoke all on function private.resume_google_appointment_effects()
  from public, anon, authenticated, service_role;

do $$
begin
  if to_regclass('public.user_google_tokens') is not null then
    execute 'drop trigger if exists user_google_tokens_resume_appointment_effects
      on public.user_google_tokens';
    execute 'create trigger user_google_tokens_resume_appointment_effects
      after insert or update of access_token, refresh_token, expires_at
      on public.user_google_tokens
      for each row execute function private.resume_google_appointment_effects()';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Preserve single-action-plan metadata and provenance
-- ---------------------------------------------------------------------------

alter function private.execute_appointment_action_plan_core(
  uuid, uuid, integer, text, text, uuid
) rename to execute_appointment_action_plan_core_20260716;

create or replace function private.execute_appointment_action_plan_core(
  p_professional_id uuid,
  p_plan_id uuid,
  p_plan_version integer,
  p_plan_hash text,
  p_confirmation_channel text,
  p_conversation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_response jsonb;
  v_plan public.appointment_action_plans%rowtype;
  v_appointment_ids uuid[] := '{}';
  v_input jsonb := '{}'::jsonb;
  v_input_metadata jsonb := '{}'::jsonb;
  v_safe_provenance jsonb := '{}'::jsonb;
  v_financial jsonb := '{}'::jsonb;
  v_default_config jsonb := '{}'::jsonb;
  v_created_appointment public.appointments%rowtype;
  v_amount_cents bigint;
  v_neurofinance_operation_id text;
begin
  v_response := private.execute_appointment_action_plan_core_20260716(
    p_professional_id,
    p_plan_id,
    p_plan_version,
    p_plan_hash,
    p_confirmation_channel,
    p_conversation_id
  );

  select plan.* into v_plan
  from public.appointment_action_plans plan
  where plan.plan_id = p_plan_id
    and plan.plan_version = p_plan_version
    and plan.professional_id = p_professional_id;

  if not found or v_plan.action <> 'create' or v_plan.status <> 'completed' then
    return v_response;
  end if;

  v_input := coalesce(v_plan.immutable_snapshot -> 'input', '{}'::jsonb);
  v_input_metadata := coalesce(v_input -> 'metadata', '{}'::jsonb);
  if jsonb_typeof(v_input_metadata) <> 'object' then
    v_input_metadata := '{}'::jsonb;
  end if;
  -- Provider state is database-owned; preserve all other caller metadata.
  v_input_metadata := v_input_metadata - 'syncStatus' - 'googleSyncState';
  v_financial := coalesce(v_plan.immutable_snapshot -> 'financial', '{}'::jsonb);
  if jsonb_typeof(v_financial) <> 'object' then
    v_financial := jsonb_build_object('mode', 'none');
  end if;

  v_safe_provenance := jsonb_strip_nulls(jsonb_build_object(
    'originChannel', v_plan.origin_channel,
    'planId', v_plan.plan_id,
    'planVersion', v_plan.plan_version,
    'conversationId', v_plan.conversation_id,
    'voiceSessionId', v_plan.voice_session_id,
    'correlationId', v_plan.correlation_id,
    'idempotencyKey', v_plan.idempotency_key
  ));

  select coalesce(array_agg(item::uuid), '{}')
  into v_appointment_ids
  from jsonb_array_elements_text(
    coalesce(v_plan.result_public -> 'appointmentIds', '[]'::jsonb)
  ) item;

  if cardinality(v_appointment_ids) = 0 and v_plan.appointment_id is not null then
    v_appointment_ids := array[v_plan.appointment_id];
  end if;

  update public.appointments appointment
  set
    metadata = coalesce(appointment.metadata, '{}'::jsonb)
      || v_input_metadata
      || jsonb_build_object(
        'provenance', coalesce(appointment.metadata -> 'provenance', '{}'::jsonb)
          || coalesce(v_input_metadata -> 'provenance', '{}'::jsonb)
          || v_safe_provenance,
        'financial', coalesce(appointment.metadata -> 'financial', '{}'::jsonb)
          || coalesce(v_input_metadata -> 'financial', '{}'::jsonb)
          || v_financial
      ),
    audit_metadata = coalesce(appointment.audit_metadata, '{}'::jsonb)
      || jsonb_build_object('provenance', v_safe_provenance)
  where appointment.id = any(v_appointment_ids);

  v_default_config := jsonb_strip_nulls(jsonb_build_object(
    'type', nullif(v_input ->> 'type', ''),
    'modality', nullif(v_input ->> 'type', ''),
    'notes', nullif(v_input ->> 'notes', ''),
    'location', nullif(v_input ->> 'location', ''),
    'metadata', v_input_metadata,
    'overrides', coalesce(v_input -> 'overrides', '[]'::jsonb)
  ));

  if v_plan.series_id is not null then
    update public.appointment_series series
    set
      default_config = coalesce(series.default_config, '{}'::jsonb) || v_default_config,
      financial_snapshot = v_financial,
      updated_at = now()
    where series.id = v_plan.series_id;
  end if;

  if lower(coalesce(v_financial ->> 'mode', 'none')) = 'none' then
    update private.appointment_effect_outbox effect
    set
      status = 'cancelled',
      cancelled_at = now(),
      lease_token = null,
      lease_expires_at = null,
      last_error = 'financial_mode_none',
      updated_at = now()
    where effect.appointment_id = any(v_appointment_ids)
      and effect.effect_type = 'neurofinance_charge'
      and effect.status in ('pending', 'processing', 'waiting_connection', 'failed');
  elsif lower(v_financial ->> 'mode') = 'neurofinance' then
    -- The initial row trigger may not see the action-plan financial snapshot
    -- for legacy single-series creation. Re-evaluate after canonical execution.
    update public.appointments appointment
    set metadata = coalesce(appointment.metadata, '{}'::jsonb) || jsonb_build_object(
      'financial', coalesce(appointment.metadata -> 'financial', '{}'::jsonb) || v_financial
    )
    where appointment.id = any(v_appointment_ids);

    v_amount_cents := round(100 * coalesce(
      nullif(v_financial ->> 'value_per_session', '')::numeric,
      nullif(v_financial ->> 'amount', '')::numeric,
      nullif(v_financial ->> 'transactionAmount', '')::numeric,
      0
    ))::bigint;

    if v_amount_cents > 0 then
      for v_created_appointment in
        select appointment.*
        from public.appointments appointment
        where appointment.id = any(v_appointment_ids)
      loop
        v_neurofinance_operation_id := 'appointment:'
          || v_created_appointment.id::text || ':revision:'
          || greatest(coalesce(v_created_appointment.confirmation_revision, 1), 1)::text
          || ':neurofinance:create';

        perform private.enqueue_appointment_effect(
          v_created_appointment.user_id,
          v_created_appointment.id,
          greatest(coalesce(v_created_appointment.confirmation_revision, 1), 1),
          'neurofinance_charge',
          'create',
          jsonb_strip_nulls(jsonb_build_object(
            'appointmentId', v_created_appointment.id,
            'appointmentRevision', greatest(coalesce(v_created_appointment.confirmation_revision, 1), 1),
            'amountCents', v_amount_cents,
            'paymentMethod', coalesce(
              nullif(v_financial ->> 'payment_method', ''),
              nullif(v_financial ->> 'transactionMethod', ''),
              'patient_decides'
            ),
            'dueDate', coalesce(
              nullif(v_financial ->> 'due_date', '')::date,
              v_created_appointment.start_time::date
            ),
            'financialEntryId', v_created_appointment.financial_entry_id,
            'operationId', v_neurofinance_operation_id,
            'idempotencyKey', v_neurofinance_operation_id
          )),
          v_neurofinance_operation_id
        );
      end loop;
    end if;
  end if;

  return v_response;
end;
$$;

revoke all on function private.execute_appointment_action_plan_core(
  uuid, uuid, integer, text, text, uuid
) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Open-series default configuration and future overrides
-- ---------------------------------------------------------------------------

alter function private.generate_agenda_v2_occurrences(uuid, jsonb)
  rename to generate_agenda_v2_occurrences_20260718;

create or replace function private.generate_agenda_v2_occurrences(
  p_professional_id uuid,
  p_input jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  v_effective_input jsonb := coalesce(p_input, '{}'::jsonb);
  v_overrides jsonb;
  v_generated jsonb;
  v_result jsonb;
begin
  v_overrides := coalesce(
    v_effective_input -> 'overrides',
    v_effective_input #> '{default_config,overrides}',
    '[]'::jsonb
  );
  if jsonb_typeof(v_overrides) <> 'array' then
    v_overrides := '[]'::jsonb;
  end if;

  v_effective_input := v_effective_input || jsonb_build_object('overrides', v_overrides);
  v_generated := private.generate_agenda_v2_occurrences_20260718(
    p_professional_id,
    v_effective_input
  );

  select coalesce(jsonb_agg(
    occurrence.value || jsonb_strip_nulls(jsonb_build_object(
      'modality', nullif(occurrence_override.value ->> 'modality', ''),
      'location', case
        when occurrence_override.value ? 'location'
          then occurrence_override.value ->> 'location'
        else null
      end
    ))
    order by occurrence.ordinality
  ), '[]'::jsonb)
  into v_result
  from jsonb_array_elements(v_generated) with ordinality occurrence(value, ordinality)
  left join lateral (
    select item.value
    from jsonb_array_elements(v_overrides) item
    where (item.value ->> 'occurrence_number')::integer
      = (occurrence.value ->> 'occurrenceNumber')::integer
    limit 1
  ) occurrence_override on true;

  return v_result;
end;
$$;

revoke all on function private.generate_agenda_v2_occurrences(uuid, jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.persist_appointment_series_default_config()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_plan_id uuid;
  v_plan_version integer;
  v_input jsonb;
  v_config jsonb;
begin
  if new.series_id is null then
    return new;
  end if;

  begin
    v_plan_id := nullif(new.audit_metadata ->> 'planId', '')::uuid;
    v_plan_version := nullif(new.audit_metadata ->> 'planVersion', '')::integer;
  exception when invalid_text_representation then
    return new;
  end;

  if v_plan_id is null or v_plan_version is null then
    return new;
  end if;

  select plan.immutable_snapshot #> '{agenda,input}'
  into v_input
  from public.appointment_action_plans plan
  where plan.plan_id = v_plan_id
    and plan.plan_version = v_plan_version
    and plan.professional_id = new.user_id;

  if v_input is null or jsonb_typeof(v_input) <> 'object' then
    return new;
  end if;

  v_config := jsonb_strip_nulls(jsonb_build_object(
    'type', nullif(v_input ->> 'type', ''),
    'modality', nullif(v_input ->> 'type', ''),
    'notes', nullif(v_input ->> 'notes', ''),
    'location', nullif(v_input ->> 'location', ''),
    'metadata', coalesce(v_input -> 'metadata', '{}'::jsonb)
      - 'syncStatus' - 'googleSyncState',
    'overrides', coalesce(v_input -> 'overrides', '[]'::jsonb)
  ));

  update public.appointment_series series
  set default_config = coalesce(series.default_config, '{}'::jsonb) || v_config,
      updated_at = now()
  where series.id = new.series_id
    and series.psychologist_id = new.user_id;

  return new;
end;
$$;

revoke all on function private.persist_appointment_series_default_config()
  from public, anon, authenticated, service_role;

drop trigger if exists appointments_persist_series_default_config
  on public.appointments;
create trigger appointments_persist_series_default_config
after insert on public.appointments
for each row execute function private.persist_appointment_series_default_config();

create or replace function private.apply_materialized_series_override()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_override jsonb;
begin
  if new.series_id is null
    or new.occurrence_number is null
    or not coalesce((new.audit_metadata ->> 'materializedAutomatically')::boolean, false)
  then
    return new;
  end if;

  select item.value into v_override
  from public.appointment_series series
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(series.default_config -> 'overrides') = 'array'
        then series.default_config -> 'overrides'
      else '[]'::jsonb
    end
  ) item
  where series.id = new.series_id
    and series.psychologist_id = new.user_id
    and (item.value ->> 'occurrence_number')::integer = new.occurrence_number
  limit 1;

  if v_override is null then
    return new;
  end if;

  if v_override ? 'modality' then
    if v_override ->> 'modality' not in ('presencial', 'online', 'block') then
      raise exception 'Modalidade personalizada invÃ¡lida.' using errcode = '22023';
    end if;
    new.type := v_override ->> 'modality';
  end if;

  if v_override ? 'location' then
    new.location := nullif(btrim(v_override ->> 'location'), '');
  end if;

  new.audit_metadata := coalesce(new.audit_metadata, '{}'::jsonb)
    || jsonb_build_object('occurrenceOverride', jsonb_strip_nulls(jsonb_build_object(
      'modality', v_override ->> 'modality',
      'location', v_override ->> 'location',
      'source', coalesce(v_override ->> 'source', 'professional'),
      'reason', v_override ->> 'reason'
    )));
  return new;
end;
$$;

revoke all on function private.apply_materialized_series_override()
  from public, anon, authenticated, service_role;

drop trigger if exists agenda_v2_apply_materialized_series_override
  on public.appointments;
create trigger agenda_v2_apply_materialized_series_override
before insert on public.appointments
for each row execute function private.apply_materialized_series_override();

create or replace function private.persist_materialized_occurrence_override()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_series public.appointment_series%rowtype;
  v_override jsonb;
begin
  if new.series_id is null
    or new.occurrence_number is null
    or not coalesce((new.audit_metadata ->> 'materializedAutomatically')::boolean, false)
  then
    return new;
  end if;

  select series.* into v_series
  from public.appointment_series series
  where series.id = new.series_id;

  if not found then
    return new;
  end if;

  select item.value into v_override
  from jsonb_array_elements(
    case
      when jsonb_typeof(v_series.default_config -> 'overrides') = 'array'
        then v_series.default_config -> 'overrides'
      else '[]'::jsonb
    end
  ) item
  where (item.value ->> 'occurrence_number')::integer = new.occurrence_number
  limit 1;

  if v_override is null then
    return new;
  end if;

  insert into public.appointment_occurrence_overrides (
    series_id,
    appointment_id,
    professional_id,
    occurrence_number,
    original_values,
    override_values,
    changed_fields,
    source,
    reason,
    action_plan_id,
    created_by
  ) values (
    v_series.id,
    new.id,
    new.user_id,
    new.occurrence_number,
    jsonb_build_object(
      'startTime', v_series.first_start_time,
      'durationMinutes', v_series.duration_minutes,
      'modality', v_series.appointment_type,
      'location', v_series.default_config ->> 'location'
    ),
    v_override,
    case
      when cardinality(new.personalized_fields) > 0 then new.personalized_fields
      else array['customized']::text[]
    end,
    coalesce(v_override ->> 'source', 'professional'),
    nullif(v_override ->> 'reason', ''),
    null,
    coalesce(v_series.created_by, new.user_id)
  )
  on conflict (series_id, occurrence_number) do update
  set
    appointment_id = excluded.appointment_id,
    override_values = excluded.override_values,
    changed_fields = excluded.changed_fields,
    source = excluded.source,
    reason = excluded.reason,
    created_by = excluded.created_by;

  return new;
end;
$$;

revoke all on function private.persist_materialized_occurrence_override()
  from public, anon, authenticated, service_role;

drop trigger if exists appointments_persist_materialized_occurrence_override
  on public.appointments;
create trigger appointments_persist_materialized_occurrence_override
after insert on public.appointments
for each row execute function private.persist_materialized_occurrence_override();

-- Repair already-created open series without overwriting an explicitly saved
-- template key. Prefer the immutable plan input; fall back to the first row.
with plan_config as (
  select distinct on (appointment.series_id)
    appointment.series_id,
    jsonb_strip_nulls(jsonb_build_object(
      'type', nullif(plan.immutable_snapshot #>> '{agenda,input,type}', ''),
      'modality', nullif(plan.immutable_snapshot #>> '{agenda,input,type}', ''),
      'notes', nullif(plan.immutable_snapshot #>> '{agenda,input,notes}', ''),
      'location', nullif(plan.immutable_snapshot #>> '{agenda,input,location}', ''),
      'metadata', coalesce(plan.immutable_snapshot #> '{agenda,input,metadata}', '{}'::jsonb)
        - 'syncStatus' - 'googleSyncState',
      'overrides', coalesce(plan.immutable_snapshot #> '{agenda,input,overrides}', '[]'::jsonb)
    )) as config
  from public.appointments appointment
  join public.appointment_action_plans plan
    on plan.plan_id = case
      when appointment.audit_metadata ->> 'planId'
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (appointment.audit_metadata ->> 'planId')::uuid
      else null
    end
   and plan.plan_version = case
      when appointment.audit_metadata ->> 'planVersion' ~ '^[1-9][0-9]*$'
      then (appointment.audit_metadata ->> 'planVersion')::integer
      else null
    end
   and plan.professional_id = appointment.user_id
  where appointment.series_id is not null
  order by appointment.series_id, appointment.occurrence_number nulls last, appointment.created_at
)
update public.appointment_series series
set default_config = coalesce(series.default_config, '{}'::jsonb) || plan_config.config,
    updated_at = now()
from plan_config
where series.id = plan_config.series_id;

with first_occurrence as (
  select distinct on (appointment.series_id)
    appointment.series_id,
    appointment.type,
    appointment.notes,
    appointment.location,
    appointment.metadata
  from public.appointments appointment
  where appointment.series_id is not null
  order by appointment.series_id, appointment.occurrence_number nulls last, appointment.created_at
)
update public.appointment_series series
set default_config = jsonb_build_object(
      'type', coalesce(series.default_config ->> 'type', first_occurrence.type),
      'modality', coalesce(series.default_config ->> 'modality', first_occurrence.type),
      'notes', coalesce(series.default_config ->> 'notes', first_occurrence.notes),
      'location', coalesce(series.default_config ->> 'location', first_occurrence.location),
      'metadata', coalesce(series.default_config -> 'metadata', first_occurrence.metadata, '{}'::jsonb),
      'overrides', coalesce(series.default_config -> 'overrides', '[]'::jsonb)
    ) || series.default_config,
    updated_at = now()
from first_occurrence
where series.id = first_occurrence.series_id;

-- ---------------------------------------------------------------------------
-- Waitlist offer snapshot and transactional patient acceptance
-- ---------------------------------------------------------------------------

alter table public.professional_waitlist_offers
  add column if not exists appointment_snapshot jsonb not null default '{}'::jsonb;

alter table public.professional_waitlist_offers
  drop constraint if exists professional_waitlist_offers_appointment_snapshot_check,
  add constraint professional_waitlist_offers_appointment_snapshot_check check (
    jsonb_typeof(appointment_snapshot) = 'object'
    and octet_length(appointment_snapshot::text) <= 65536
  );

create or replace function private.prepare_waitlist_appointment_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_entry public.professional_waitlist_entries%rowtype;
  v_financial jsonb;
  v_duration integer;
begin
  select entry.* into v_entry
  from public.professional_waitlist_entries entry
  where entry.id = new.waitlist_entry_id
    and entry.professional_id = new.professional_id;

  if not found then
    raise exception 'Waitlist entry is not available for this offer' using errcode = '23503';
  end if;

  v_duration := round(extract(epoch from (
    new.offered_end_time - new.offered_start_time
  )) / 60)::integer;
  v_financial := coalesce(v_entry.rules_snapshot -> 'financial', '{}'::jsonb);

  if jsonb_typeof(v_financial) <> 'object'
    or lower(coalesce(v_financial ->> 'mode', 'none'))
      not in ('none', 'manual', 'package', 'insurance', 'neurofinance')
  then
    v_financial := jsonb_build_object('mode', 'none');
  elsif not (v_financial ? 'mode') then
    v_financial := v_financial || jsonb_build_object('mode', 'none');
  end if;

  new.appointment_snapshot := jsonb_strip_nulls(jsonb_build_object(
    'schemaVersion', 1,
    'kind', 'session',
    'sessionType', coalesce(
      nullif(v_entry.rules_snapshot ->> 'sessionType', ''),
      'follow_up'
    ),
    'durationMinutes', v_duration,
    'modality', coalesce(v_entry.modality, 'presencial'),
    'location', nullif(v_entry.location, ''),
    'notes', nullif(v_entry.rules_snapshot ->> 'notes', ''),
    'metadata', coalesce(v_entry.rules_snapshot -> 'metadata', '{}'::jsonb),
    'financial', v_financial,
    'policy', coalesce(v_entry.rules_snapshot -> 'policy', '{}'::jsonb),
    'source', 'waitlist_offer'
  )) || coalesce(new.appointment_snapshot, '{}'::jsonb);

  -- Legacy/default `{}` input may not override financial implicitly.
  if not (new.appointment_snapshot ? 'financial')
    or jsonb_typeof(new.appointment_snapshot -> 'financial') <> 'object'
  then
    new.appointment_snapshot := new.appointment_snapshot
      || jsonb_build_object('financial', jsonb_build_object('mode', 'none'));
  end if;

  if coalesce(new.appointment_snapshot ->> 'modality', 'presencial')
      not in ('presencial', 'online')
    or coalesce(new.appointment_snapshot ->> 'durationMinutes', '') !~ '^[0-9]+$'
  then
    raise exception 'Invalid waitlist appointment snapshot' using errcode = '22023';
  end if;
  if (new.appointment_snapshot ->> 'durationMinutes')::integer not between 15 and 1440
    or lower(coalesce(new.appointment_snapshot #>> '{financial,mode}', 'none'))
      not in ('none', 'manual', 'package', 'insurance', 'neurofinance')
  then
    raise exception 'Invalid waitlist appointment snapshot' using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function private.prepare_waitlist_appointment_snapshot()
  from public, anon, authenticated, service_role;

drop trigger if exists professional_waitlist_offers_prepare_appointment_snapshot
  on public.professional_waitlist_offers;
create trigger professional_waitlist_offers_prepare_appointment_snapshot
before insert on public.professional_waitlist_offers
for each row execute function private.prepare_waitlist_appointment_snapshot();

-- Backfill legacy offers. They intentionally default to no financial launch.
update public.professional_waitlist_offers offer
set appointment_snapshot = jsonb_strip_nulls(jsonb_build_object(
  'schemaVersion', 1,
  'kind', 'session',
  'sessionType', coalesce(nullif(entry.rules_snapshot ->> 'sessionType', ''), 'follow_up'),
  'durationMinutes', round(extract(epoch from (
    offer.offered_end_time - offer.offered_start_time
  )) / 60)::integer,
  'modality', coalesce(entry.modality, 'presencial'),
  'location', nullif(entry.location, ''),
  'notes', nullif(entry.rules_snapshot ->> 'notes', ''),
  'metadata', coalesce(entry.rules_snapshot -> 'metadata', '{}'::jsonb),
  'financial', jsonb_build_object('mode', 'none'),
  'policy', coalesce(entry.rules_snapshot -> 'policy', '{}'::jsonb),
  'source', 'waitlist_offer_legacy_backfill',
  'requiresFinancialReview', true
))
from public.professional_waitlist_entries entry
where entry.id = offer.waitlist_entry_id
  and offer.appointment_snapshot = '{}'::jsonb;

create or replace function private.cancel_terminal_waitlist_offer_outbox()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.status in ('accepted', 'declined', 'expired', 'superseded')
    and new.status is distinct from old.status
  then
    update public.professional_waitlist_offer_outbox outbox
    set
      status = case
        when outbox.status = 'delivered' then 'delivered'
        else 'cancelled'
      end,
      last_error = case
        when outbox.status = 'delivered' then outbox.last_error
        else 'offer_' || new.status
      end
    where outbox.offer_id = new.id
      and outbox.status <> 'cancelled';
  end if;
  return new;
end;
$$;

revoke all on function private.cancel_terminal_waitlist_offer_outbox()
  from public, anon, authenticated, service_role;

drop trigger if exists professional_waitlist_offers_cancel_terminal_outbox
  on public.professional_waitlist_offers;
create trigger professional_waitlist_offers_cancel_terminal_outbox
after update of status on public.professional_waitlist_offers
for each row execute function private.cancel_terminal_waitlist_offer_outbox();

create or replace function public.respond_waitlist_offer(
  p_token text,
  p_response text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_offer public.professional_waitlist_offers%rowtype;
  v_hold public.appointment_slot_holds%rowtype;
  v_entry public.professional_waitlist_entries%rowtype;
  v_appointment_id uuid;
  v_policy_snapshot_id uuid;
  v_snapshot jsonb;
  v_financial jsonb;
  v_financial_mode text;
  v_now timestamptz := now();
begin
  if p_response not in ('accept', 'decline') then
    raise exception 'Resposta invÃ¡lida.' using errcode = '22023';
  end if;
  if p_token is null or char_length(p_token) <> 64 then
    raise exception 'Oferta invÃ¡lida ou expirada.' using errcode = '22023';
  end if;

  select offer.* into v_offer
  from public.professional_waitlist_offers offer
  where offer.token_hash = encode(digest(p_token, 'sha256'), 'hex')
  for update;

  if not found then
    raise exception 'Oferta invÃ¡lida ou expirada.' using errcode = 'P0002';
  end if;

  -- An accepted token is a safe idempotent replay; never create twice.
  if v_offer.status = 'accepted' and v_offer.accepted_appointment_id is not null then
    return jsonb_build_object(
      'success', true,
      'idempotent', true,
      'status', 'accepted',
      'appointmentId', v_offer.accepted_appointment_id,
      'startTime', v_offer.offered_start_time,
      'endTime', v_offer.offered_end_time
    );
  end if;

  select hold.* into v_hold
  from public.appointment_slot_holds hold
  where hold.id = v_offer.hold_id
  for update;
  if not found then
    return jsonb_build_object(
      'success', false,
      'status', 'expired',
      'reasonCode', 'hold_missing'
    );
  end if;

  select entry.* into v_entry
  from public.professional_waitlist_entries entry
  where entry.id = v_offer.waitlist_entry_id
  for update;
  if not found then
    return jsonb_build_object(
      'success', false,
      'status', 'expired',
      'reasonCode', 'entry_missing'
    );
  end if;

  if v_offer.status <> 'pending'
    or v_hold.status <> 'active'
    or v_offer.expires_at <= v_now
    or v_hold.expires_at <= v_now
  then
    update public.professional_waitlist_offers
    set status = case when status = 'pending' then 'expired' else status end,
        responded_at = coalesce(responded_at, v_now)
    where id = v_offer.id;
    update public.appointment_slot_holds
    set status = case when status = 'active' then 'expired' else status end,
        released_at = coalesce(released_at, v_now)
    where id = v_hold.id;
    update public.professional_waitlist_entries entry
    set status = case when entry.status = 'offered' then 'active' else entry.status end,
        updated_at = v_now
    where entry.id = v_entry.id;

    return jsonb_build_object(
      'success', false,
      'status', 'expired',
      'reasonCode', 'offer_expired'
    );
  end if;

  if p_response = 'decline' then
    update public.professional_waitlist_offers
    set status = 'declined', responded_at = v_now
    where id = v_offer.id;
    update public.appointment_slot_holds
    set status = 'declined', released_at = v_now
    where id = v_hold.id;
    update public.professional_waitlist_entries
    set status = 'active', updated_at = v_now
    where id = v_entry.id;
    insert into public.professional_waitlist_events (
      professional_id, waitlist_entry_id, offer_id, event_type, actor_type
    ) values (
      v_offer.professional_id, v_entry.id, v_offer.id, 'offer_declined', 'patient'
    );
    return jsonb_build_object('success', true, 'status', 'declined');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('appointments:' || v_offer.professional_id::text, 0)
  );

  if exists (
    select 1
    from public.appointments appointment
    where appointment.user_id = v_offer.professional_id
      and appointment.start_time is not null
      and appointment.end_time is not null
      and lower(coalesce(appointment.status, '')) not in ('cancelled', 'canceled')
      and appointment.lifecycle_status <> 'cancelled'
      and tstzrange(appointment.start_time, appointment.end_time, '[)')
        && tstzrange(v_offer.offered_start_time, v_offer.offered_end_time, '[)')
  ) then
    update public.professional_waitlist_offers
    set status = 'superseded', responded_at = v_now
    where id = v_offer.id;
    update public.appointment_slot_holds
    set status = 'released', released_at = v_now
    where id = v_hold.id;
    update public.professional_waitlist_entries
    set status = 'active', updated_at = v_now
    where id = v_entry.id;

    return jsonb_build_object(
      'success', false,
      'status', 'superseded',
      'reasonCode', 'slot_taken'
    );
  end if;

  v_snapshot := coalesce(v_offer.appointment_snapshot, '{}'::jsonb);
  v_financial := coalesce(v_snapshot -> 'financial', jsonb_build_object('mode', 'none'));
  v_financial_mode := lower(coalesce(v_financial ->> 'mode', 'none'));

  insert into public.appointments (
    user_id,
    patient_id,
    start_time,
    end_time,
    type,
    status,
    lifecycle_status,
    visibility_status,
    notes,
    location,
    metadata,
    confirmed_at,
    confirmed_revision,
    patient_right_status,
    financial_outcome,
    change_responsibility,
    created_by,
    updated_by,
    action_origin,
    last_actor_type,
    audit_metadata
  ) values (
    v_offer.professional_id,
    v_offer.patient_id,
    v_offer.offered_start_time,
    v_offer.offered_end_time,
    coalesce(v_snapshot ->> 'modality', v_entry.modality, 'presencial'),
    'unscored',
    'confirmed',
    'visible',
    nullif(v_snapshot ->> 'notes', ''),
    nullif(coalesce(v_snapshot ->> 'location', v_entry.location), ''),
    coalesce(v_snapshot -> 'metadata', '{}'::jsonb)
      || jsonb_build_object(
        'origin', 'waitlist',
        'waitlistEntryId', v_entry.id,
        'waitlistOfferId', v_offer.id,
        'waitlistAcceptedAt', v_now,
        'sessionType', coalesce(v_snapshot ->> 'sessionType', 'follow_up'),
        'financial', v_financial
      ),
    v_now,
    1,
    'standard',
    case when v_financial_mode = 'none' then 'no_consequence' else 'pending' end,
    'patient',
    v_offer.professional_id,
    null,
    'patient_portal',
    'patient',
    jsonb_build_object(
      'waitlistEntryId', v_entry.id,
      'waitlistOfferId', v_offer.id,
      'waitlistAcceptedAt', v_now,
      'appointmentSnapshotVersion', case
        when v_snapshot ->> 'schemaVersion' ~ '^[1-9][0-9]*$'
          then (v_snapshot ->> 'schemaVersion')::integer
        else 1
      end,
      'financialMode', v_financial_mode
    )
  ) returning id into v_appointment_id;

  perform set_config('neuronex.appointment_command', 'policy_application', true);
  v_policy_snapshot_id := private.create_appointment_policy_snapshot(
    v_appointment_id,
    'waitlist_acceptance',
    null,
    true
  );

  update public.professional_waitlist_offers
  set status = 'accepted',
      responded_at = v_now,
      accepted_appointment_id = v_appointment_id
  where id = v_offer.id;
  update public.appointment_slot_holds
  set status = 'accepted', released_at = v_now
  where id = v_hold.id;
  update public.professional_waitlist_entries
  set status = 'scheduled', updated_at = v_now
  where id = v_entry.id;

  insert into public.professional_waitlist_events (
    professional_id,
    waitlist_entry_id,
    offer_id,
    event_type,
    actor_type,
    safe_metadata
  ) values (
    v_offer.professional_id,
    v_entry.id,
    v_offer.id,
    'offer_accepted',
    'patient',
    jsonb_build_object(
      'appointmentId', v_appointment_id,
      'policySnapshotId', v_policy_snapshot_id,
      'financialMode', v_financial_mode
    )
  );

  perform public.emit_user_notification(
    p_user_id => v_offer.professional_id,
    p_event_id => 'waitlist-offer-accepted:' || v_offer.id::text,
    p_type => 'waitlist_offer_accepted',
    p_category => 'agenda',
    p_severity => 'success',
    p_title => 'Vaga aceita na lista de espera',
    p_message => 'O paciente aceitou a vaga. O novo agendamento jÃ¡ estÃ¡ disponÃ­vel na Agenda.',
    p_action_url => '/agenda?appointmentId=' || v_appointment_id::text,
    p_priority => 'high',
    p_data => jsonb_build_object(
      'appointmentId', v_appointment_id,
      'waitlistEntryId', v_entry.id,
      'waitlistOfferId', v_offer.id,
      'sourceModule', 'agenda',
      'requiresAction', true
    ),
    p_payload => jsonb_build_object('origin', 'waitlist'),
    p_organization_id => null
  );

  return jsonb_build_object(
    'success', true,
    'status', 'accepted',
    'appointmentId', v_appointment_id,
    'policySnapshotId', v_policy_snapshot_id,
    'startTime', v_offer.offered_start_time,
    'endTime', v_offer.offered_end_time
  );
end;
$$;

revoke all on function public.respond_waitlist_offer(text, text)
  from public, anon, authenticated;
grant execute on function public.respond_waitlist_offer(text, text)
  to anon, authenticated;

-- Repair terminal/expired queue state left by earlier exception-based paths.
update public.professional_waitlist_offers offer
set status = 'expired', responded_at = coalesce(offer.responded_at, now())
where offer.status = 'pending' and offer.expires_at <= now();

update public.appointment_slot_holds hold
set status = 'expired', released_at = coalesce(hold.released_at, now())
where hold.status = 'active' and hold.expires_at <= now();

update public.professional_waitlist_offer_outbox outbox
set status = 'cancelled',
    last_error = 'offer_' || offer.status
from public.professional_waitlist_offers offer
where offer.id = outbox.offer_id
  and offer.status in ('accepted', 'declined', 'expired', 'superseded')
  and outbox.status in ('pending', 'processing', 'failed');

update public.professional_waitlist_entries entry
set status = 'active', updated_at = now()
where entry.status = 'offered'
  and not exists (
    select 1
    from public.professional_waitlist_offers offer
    join public.appointment_slot_holds hold on hold.id = offer.hold_id
    where offer.waitlist_entry_id = entry.id
      and offer.status = 'pending'
      and offer.expires_at > now()
      and hold.status = 'active'
      and hold.expires_at > now()
  );
