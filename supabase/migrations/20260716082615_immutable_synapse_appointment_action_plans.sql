create extension if not exists pgcrypto;
create schema if not exists private;

create table public.appointment_action_plans (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null default gen_random_uuid(),
  plan_version integer not null default 1,
  plan_hash text not null,
  snapshot_version integer not null default 1,
  action text not null,
  status text not null default 'prepared',
  professional_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete restrict,
  appointment_id uuid references public.appointments(id) on delete restrict,
  series_id uuid references public.appointment_series(id) on delete restrict,
  origin_channel text not null,
  conversation_id uuid,
  voice_session_id uuid,
  whatsapp_message_id text,
  tool_call text,
  correlation_id text,
  immutable_snapshot jsonb not null,
  safe_summary jsonb not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmation_channel text,
  executing_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  superseded_at timestamptz,
  failed_at timestamptz,
  updated_at timestamptz not null default now(),
  result_public jsonb,
  result_internal jsonb,
  last_error text,
  constraint appointment_action_plans_version_check check (
    plan_version >= 1 and snapshot_version = 1
  ),
  constraint appointment_action_plans_hash_check check (
    plan_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint appointment_action_plans_action_check check (
    action in (
      'create', 'reschedule', 'cancel',
      'set_teleconsultation_transcription', 'close_teleconsultation'
    )
  ),
  constraint appointment_action_plans_status_check check (
    status in (
      'prepared', 'awaiting_confirmation', 'confirmed', 'executing',
      'completed', 'cancelled', 'expired', 'superseded',
      'review_required', 'failed'
    )
  ),
  constraint appointment_action_plans_origin_channel_check check (
    origin_channel in (
      'synapse_text', 'synapse_voice', 'synapse_whatsapp', 'professional_app'
    )
  ),
  constraint appointment_action_plans_confirmation_channel_check check (
    confirmation_channel is null or confirmation_channel in (
      'synapse_text', 'synapse_voice', 'synapse_whatsapp', 'professional_app'
    )
  ),
  constraint appointment_action_plans_payload_check check (
    jsonb_typeof(immutable_snapshot) = 'object'
    and jsonb_typeof(safe_summary) = 'object'
    and octet_length(immutable_snapshot::text) <= 262144
    and octet_length(safe_summary::text) <= 65536
  ),
  constraint appointment_action_plans_expiry_check check (
    expires_at > created_at
  ),
  constraint appointment_action_plans_idempotency_check check (
    char_length(idempotency_key) between 8 and 240
  ),
  unique (plan_id, plan_version),
  unique (professional_id, idempotency_key, plan_version)
);

create index appointment_action_plans_owner_status_idx
  on public.appointment_action_plans (professional_id, status, created_at desc);
create index appointment_action_plans_conversation_idx
  on public.appointment_action_plans (
    professional_id, conversation_id, status, created_at desc
  )
  where conversation_id is not null;
create index appointment_action_plans_voice_session_idx
  on public.appointment_action_plans (
    professional_id, voice_session_id, status, created_at desc
  )
  where voice_session_id is not null;
create index appointment_action_plans_appointment_idx
  on public.appointment_action_plans (appointment_id, created_at desc)
  where appointment_id is not null;
create index appointment_action_plans_expiring_idx
  on public.appointment_action_plans (expires_at, created_at)
  where status in ('prepared', 'awaiting_confirmation', 'confirmed');

comment on table public.appointment_action_plans is
  'Immutable, versioned authorization snapshots for canonical appointment mutations.';
comment on column public.appointment_action_plans.plan_hash is
  'Lowercase SHA-256 hex digest of immutable_snapshot::text (canonical JSONB representation).';
comment on column public.appointment_action_plans.result_internal is
  'Backend-only execution result. Never expose this column through frontend DTOs.';

create table public.appointment_action_plan_events (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  plan_version integer not null,
  professional_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  event_type text not null,
  from_status text,
  to_status text,
  actor_type text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action_origin text not null,
  confirmation_channel text,
  idempotency_key text not null,
  safe_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint appointment_action_plan_events_plan_fkey
    foreign key (plan_id, plan_version)
    references public.appointment_action_plans(plan_id, plan_version)
    on delete restrict,
  constraint appointment_action_plan_events_actor_check check (
    actor_type in ('psychologist', 'synapse', 'system')
  ),
  constraint appointment_action_plan_events_metadata_check check (
    jsonb_typeof(safe_metadata) = 'object'
    and octet_length(safe_metadata::text) <= 32768
  ),
  unique (professional_id, idempotency_key)
);

create index appointment_action_plan_events_plan_idx
  on public.appointment_action_plan_events (plan_id, plan_version, created_at);
create index appointment_action_plan_events_appointment_idx
  on public.appointment_action_plan_events (appointment_id, created_at desc)
  where appointment_id is not null;

alter table public.appointment_action_plans enable row level security;
alter table public.appointment_action_plan_events enable row level security;

create policy appointment_action_plans_owner_select
  on public.appointment_action_plans
  for select
  to authenticated
  using (professional_id = (select auth.uid()));

create policy appointment_action_plan_events_owner_select
  on public.appointment_action_plan_events
  for select
  to authenticated
  using (professional_id = (select auth.uid()));

revoke all on table public.appointment_action_plans
  from public, anon, authenticated;
revoke all on table public.appointment_action_plan_events
  from public, anon, authenticated;
grant select on table public.appointment_action_plans to authenticated;
grant select on table public.appointment_action_plan_events to authenticated;
grant all on table public.appointment_action_plans to service_role;
grant all on table public.appointment_action_plan_events to service_role;

create or replace function private.guard_appointment_action_plan_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Appointment action plans cannot be deleted';
  end if;

  if
    new.id is distinct from old.id
    or new.plan_id is distinct from old.plan_id
    or new.plan_version is distinct from old.plan_version
    or new.plan_hash is distinct from old.plan_hash
    or new.snapshot_version is distinct from old.snapshot_version
    or new.action is distinct from old.action
    or new.professional_id is distinct from old.professional_id
    or new.patient_id is distinct from old.patient_id
    or (
      new.appointment_id is distinct from old.appointment_id
      and not (
        old.action = 'create'
        and old.appointment_id is null
        and new.appointment_id is not null
        and old.status = 'executing'
      )
    )
    or (
      new.series_id is distinct from old.series_id
      and not (
        old.action = 'create'
        and old.series_id is null
        and new.series_id is not null
        and old.status = 'executing'
      )
    )
    or new.origin_channel is distinct from old.origin_channel
    or new.conversation_id is distinct from old.conversation_id
    or new.voice_session_id is distinct from old.voice_session_id
    or new.whatsapp_message_id is distinct from old.whatsapp_message_id
    or new.tool_call is distinct from old.tool_call
    or new.correlation_id is distinct from old.correlation_id
    or new.immutable_snapshot is distinct from old.immutable_snapshot
    or new.safe_summary is distinct from old.safe_summary
    or new.idempotency_key is distinct from old.idempotency_key
    or new.created_at is distinct from old.created_at
    or new.expires_at is distinct from old.expires_at
  then
    raise exception 'Immutable appointment plan facts cannot change';
  end if;

  if new.status is distinct from old.status and not (
    (old.status in ('prepared', 'awaiting_confirmation', 'review_required')
      and new.status in ('confirmed', 'cancelled', 'expired', 'superseded', 'failed'))
    or (old.status = 'confirmed' and new.status in ('executing', 'cancelled', 'expired', 'failed'))
    or (old.status = 'executing' and new.status in ('completed', 'review_required', 'failed'))
  ) then
    raise exception 'Invalid appointment plan status transition';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger appointment_action_plans_guard_mutation
before update or delete on public.appointment_action_plans
for each row execute function private.guard_appointment_action_plan_mutation();

create or replace function private.reject_appointment_action_plan_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Appointment action plan events are append-only';
end;
$$;

create trigger appointment_action_plan_events_immutable
before update or delete on public.appointment_action_plan_events
for each row execute function private.reject_appointment_action_plan_event_mutation();

revoke all on function private.guard_appointment_action_plan_mutation()
  from public, anon, authenticated, service_role;
revoke all on function private.reject_appointment_action_plan_event_mutation()
  from public, anon, authenticated, service_role;

create or replace function private.append_appointment_action_plan_event(
  p_plan public.appointment_action_plans,
  p_event_type text,
  p_from_status text,
  p_to_status text,
  p_actor_type text,
  p_actor_user_id uuid,
  p_action_origin text,
  p_confirmation_channel text,
  p_idempotency_key text,
  p_safe_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
begin
  insert into public.appointment_action_plan_events (
    plan_id,
    plan_version,
    professional_id,
    patient_id,
    appointment_id,
    event_type,
    from_status,
    to_status,
    actor_type,
    actor_user_id,
    action_origin,
    confirmation_channel,
    idempotency_key,
    safe_metadata
  ) values (
    p_plan.plan_id,
    p_plan.plan_version,
    p_plan.professional_id,
    p_plan.patient_id,
    p_plan.appointment_id,
    p_event_type,
    p_from_status,
    p_to_status,
    p_actor_type,
    p_actor_user_id,
    p_action_origin,
    p_confirmation_channel,
    p_idempotency_key,
    coalesce(p_safe_metadata, '{}'::jsonb)
  )
  on conflict (professional_id, idempotency_key) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select event.id into v_event_id
    from public.appointment_action_plan_events event
    where event.professional_id = p_plan.professional_id
      and event.idempotency_key = p_idempotency_key;
  end if;
  return v_event_id;
end;
$$;

revoke all on function private.append_appointment_action_plan_event(
  public.appointment_action_plans,
  text, text, text, text, uuid, text, text, text, jsonb
) from public, anon, authenticated, service_role;

create or replace function private.normalize_appointment_plan_channel(
  p_channel text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case lower(coalesce(nullif(btrim(p_channel), ''), 'professional_app'))
    when 'panel' then 'synapse_text'
    when 'text' then 'synapse_text'
    when 'voice' then 'synapse_voice'
    when 'whatsapp' then 'synapse_whatsapp'
    when 'synapse_text' then 'synapse_text'
    when 'synapse_voice' then 'synapse_voice'
    when 'synapse_whatsapp' then 'synapse_whatsapp'
    else 'professional_app'
  end;
$$;

create or replace function private.build_appointment_action_plan_snapshot(
  p_professional_id uuid,
  p_action text,
  p_input jsonb,
  p_provenance jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text := lower(coalesce(p_action, ''));
  v_input jsonb := coalesce(p_input, '{}'::jsonb);
  v_provenance jsonb := coalesce(p_provenance, '{}'::jsonb);
  v_appointment public.appointments%rowtype;
  v_patient_id uuid;
  v_patient_name text;
  v_appointment_id uuid;
  v_start_time timestamptz;
  v_end_time timestamptz;
  v_frequency text;
  v_occurrence_count integer;
  v_type text;
  v_location text;
  v_validation jsonb;
  v_policy jsonb := '{}'::jsonb;
  v_binding jsonb;
  v_payment_count integer := 0;
  v_entry_count integer := 0;
  v_financial_mode text;
  v_communication jsonb;
  v_fiscal jsonb;
  v_package_id uuid;
  v_package_preview jsonb;
  v_working_hours jsonb;
  v_day_config jsonb;
  v_day_key text;
  v_availability_reason text;
begin
  if p_professional_id is null then
    raise exception 'Professional is required' using errcode = '42501';
  end if;
  if jsonb_typeof(v_input) <> 'object' or jsonb_typeof(v_provenance) <> 'object' then
    raise exception 'Plan input and provenance must be objects' using errcode = '22023';
  end if;
  if v_action not in (
    'create', 'reschedule', 'cancel',
    'set_teleconsultation_transcription', 'close_teleconsultation'
  ) then
    raise exception 'Unsupported appointment plan action' using errcode = '22023';
  end if;

  if v_action = 'create' then
    v_patient_id := nullif(v_input ->> 'patient_id', '')::uuid;
    v_start_time := nullif(v_input ->> 'start_time', '')::timestamptz;
    v_end_time := nullif(v_input ->> 'end_time', '')::timestamptz;
    v_frequency := coalesce(nullif(v_input ->> 'frequency', ''), 'single');
    v_occurrence_count := coalesce((v_input ->> 'occurrence_count')::integer, 1);
    v_type := coalesce(nullif(v_input ->> 'type', ''), 'presencial');
    v_location := nullif(btrim(v_input ->> 'location'), '');
    v_package_id := nullif(v_input ->> 'package_id', '')::uuid;

    if v_patient_id is not null then
      select patient.name into v_patient_name
      from public.patients patient
      where patient.id = v_patient_id
        and patient.user_id = p_professional_id;
      if not found then
        raise exception 'Patient not found for this professional' using errcode = 'P0002';
      end if;
    elsif v_type <> 'block' then
      raise exception 'Patient is required for a clinical appointment' using errcode = '22023';
    else
      v_patient_name := 'Bloqueio de agenda';
    end if;

    v_validation := private.validate_appointment_series(
      p_professional_id,
      v_start_time,
      v_end_time,
      v_frequency,
      v_occurrence_count
    );

    if v_package_id is not null and not exists (
      select 1
      from public.patient_packages package
      where package.id = v_package_id
        and package.user_id = p_professional_id
        and package.patient_id = v_patient_id
        and package.package_status = 'active'
    ) then
      raise exception 'Package is not active for this patient' using errcode = 'P0002';
    end if;

    select coalesce(
      (
        select to_jsonb(policy) - 'metadata' - 'request_fingerprint'
          - 'idempotency_key' - 'created_by'
        from public.appointment_policy_versions policy
        where policy.psychologist_id = p_professional_id
          and policy.effective_at <= now()
        order by policy.effective_at desc, policy.version desc
        limit 1
      ),
      jsonb_build_object(
        'version', 1,
        'free_cancellation_hours', 24,
        'free_reschedule_hours', 24,
        'timezone', 'America/Sao_Paulo'
      )
    ) into v_policy;
  else
    v_appointment_id := nullif(v_input ->> 'appointment_id', '')::uuid;
    select appointment.* into v_appointment
    from public.appointments appointment
    where appointment.id = v_appointment_id
      and appointment.user_id = p_professional_id;
    if not found then
      raise exception 'Appointment not found for this professional' using errcode = 'P0002';
    end if;
    if (
      v_action in ('reschedule', 'cancel')
      and v_appointment.lifecycle_status in ('in_progress', 'completed', 'closed')
    ) or (
      v_action = 'reschedule'
      and v_appointment.lifecycle_status in ('cancelled', 'reschedule_requested')
    ) or (
      v_action in ('set_teleconsultation_transcription', 'close_teleconsultation')
      and (
        v_appointment.type <> 'online'
        or v_appointment.lifecycle_status in ('cancelled', 'completed', 'closed')
      )
    )
    then
      raise exception 'Appointment state does not allow this action' using errcode = '55000';
    end if;

    v_patient_id := v_appointment.patient_id;
    select patient.name into v_patient_name
    from public.patients patient
    where patient.id = v_patient_id
      and patient.user_id = p_professional_id;
    v_start_time := case
      when v_action = 'reschedule'
        then nullif(v_input ->> 'start_time', '')::timestamptz
      else v_appointment.start_time
    end;
    v_end_time := case
      when v_action = 'reschedule'
        then nullif(v_input ->> 'end_time', '')::timestamptz
      else v_appointment.end_time
    end;
    v_frequency := 'single';
    v_occurrence_count := 1;
    v_type := coalesce(nullif(v_input ->> 'type', ''), v_appointment.type);
    v_location := coalesce(
      nullif(btrim(v_input ->> 'location'), ''),
      v_appointment.location
    );

    if v_action = 'reschedule' then
      if v_start_time is null or v_end_time is null
        or v_end_time <= v_start_time
        or v_start_time <= now()
      then
        raise exception 'Choose a valid future schedule' using errcode = '22023';
      end if;
      v_validation := jsonb_build_object(
        'valid',
        not exists (
          select 1
          from public.appointments conflict
          where conflict.user_id = p_professional_id
            and conflict.id <> v_appointment.id
            and conflict.lifecycle_status <> 'cancelled'
            and conflict.status not in (
              'cancelled', 'cancelled_by_patient', 'cancelled_by_professional'
            )
            and conflict.start_time < v_end_time
            and conflict.end_time > v_start_time
        ),
        'frequency', 'single',
        'totalOccurrences', 1,
        'durationMinutes',
          extract(epoch from (v_end_time - v_start_time))::integer / 60,
        'firstStartTime', v_start_time,
        'lastStartTime', v_start_time,
        'occurrences', jsonb_build_array(jsonb_build_object(
          'occurrenceNumber', 1,
          'startTime', v_start_time,
          'endTime', v_end_time
        )),
        'conflicts', coalesce((
          select jsonb_agg(jsonb_build_object(
            'startTime', conflict.start_time,
            'endTime', conflict.end_time,
            'reasonCode', 'appointment_conflict',
            'reason', 'Já existe um compromisso neste horário.'
          ))
          from public.appointments conflict
          where conflict.user_id = p_professional_id
            and conflict.id <> v_appointment.id
            and conflict.lifecycle_status <> 'cancelled'
            and conflict.status not in (
              'cancelled', 'cancelled_by_patient', 'cancelled_by_professional'
            )
            and conflict.start_time < v_end_time
            and conflict.end_time > v_start_time
        ), '[]'::jsonb)
      );

      select coalesce(profile.working_hours, '{}'::jsonb)
      into v_working_hours
      from public.profiles profile
      where profile.id = p_professional_id;
      v_day_key := extract(
        dow from v_start_time at time zone 'America/Sao_Paulo'
      )::integer::text;
      v_day_config := coalesce(v_working_hours -> v_day_key, '{}'::jsonb);
      v_availability_reason := case
        when not coalesce((v_day_config ->> 'enabled')::boolean, false)
          then 'O profissional não atende neste dia.'
        when coalesce(v_day_config ->> 'start', '')
          !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
          or coalesce(v_day_config ->> 'end', '')
          !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
          then 'A disponibilidade do profissional precisa ser revisada.'
        when (v_start_time at time zone 'America/Sao_Paulo')::time
          < (v_day_config ->> 'start')::time
          or (v_end_time at time zone 'America/Sao_Paulo')::time
          > (v_day_config ->> 'end')::time
          then 'O horário está fora do expediente do profissional.'
        else null
      end;
      if v_availability_reason is not null then
        v_validation := jsonb_set(v_validation, '{valid}', 'false'::jsonb);
        v_validation := jsonb_set(
          v_validation,
          '{conflicts}',
          coalesce(v_validation -> 'conflicts', '[]'::jsonb)
            || jsonb_build_array(jsonb_build_object(
              'startTime', v_start_time,
              'endTime', v_end_time,
              'reasonCode', 'outside_working_hours',
              'reason', v_availability_reason
            ))
        );
      end if;
    else
      v_validation := jsonb_build_object(
        'valid', true,
        'frequency', 'single',
        'totalOccurrences', 1,
        'durationMinutes',
          extract(epoch from (v_end_time - v_start_time))::integer / 60,
        'firstStartTime', v_start_time,
        'lastStartTime', v_start_time,
        'occurrences', jsonb_build_array(jsonb_build_object(
          'occurrenceNumber', 1,
          'startTime', v_start_time,
          'endTime', v_end_time
        )),
        'conflicts', '[]'::jsonb
      );
    end if;

    if v_appointment.policy_snapshot_id is not null then
      select to_jsonb(snapshot) - 'metadata'
      into v_policy
      from public.appointment_policy_snapshots snapshot
      where snapshot.id = v_appointment.policy_snapshot_id;
    end if;

    select jsonb_build_object(
      'bindingId', binding.id,
      'packageId', binding.package_id,
      'status', binding.status,
      'coverageStatus', coalesce(coverage.status, 'none')
    )
    into v_binding
    from public.appointment_package_bindings binding
    left join lateral (
      select financial_coverage.status
      from public.appointment_financial_coverages financial_coverage
      where financial_coverage.binding_id = binding.id
      order by financial_coverage.covered_at desc
      limit 1
    ) coverage on true
    where binding.appointment_id = v_appointment.id
      and binding.status in ('reserved', 'consumed')
    order by binding.bound_at desc
    limit 1;

    select count(*) into v_payment_count
    from public.nb_payments payment
    where payment.appointment_id = v_appointment.id;

    select count(*) into v_entry_count
    from public.financial_entries entry
    where entry.appointment_id = v_appointment.id
      and entry.status <> 'cancelled';

    if v_action = 'cancel'
      and v_binding ->> 'status' = 'reserved'
    then
      v_package_preview := public.preview_package_lifecycle_change_internal(
        p_professional_id,
        (v_binding ->> 'packageId')::uuid,
        null,
        'release',
        'only_this',
        v_appointment.id,
        'cancel_without_replacement'
      );
    end if;
  end if;

  v_communication := coalesce(
    v_input -> 'communication',
    jsonb_build_object(
      'sendConfirmation', v_action in ('create', 'reschedule'),
      'provider', 'configured',
      'template', case
        when v_action = 'reschedule' then 'appointment_reconfirmation_required'
        else 'appointment_invitation'
      end,
      'reminderPolicy', 'professional_settings'
    )
  );
  v_fiscal := coalesce(
    v_input -> 'fiscal',
    jsonb_build_object(
      'automationEnabled', false,
      'trigger', 'professional_settings',
      'potentialDocuments', v_occurrence_count,
      'blocked', false
    )
  );
  v_financial_mode := coalesce(
    nullif(v_input #>> '{financial,mode}', ''),
    case
      when v_package_id is not null or v_binding is not null then 'package'
      when v_payment_count > 0 then 'neurofinance'
      when v_entry_count > 0 then 'manual'
      else 'none'
    end
  );

  return jsonb_strip_nulls(jsonb_build_object(
    'snapshotVersion', 1,
    'action', v_action,
    'input', v_input,
    'agenda', jsonb_build_object(
      'professionalId', p_professional_id,
      'patientId', v_patient_id,
      'patientName', coalesce(v_patient_name, 'Paciente'),
      'appointmentId', v_appointment_id,
      'startTime', v_start_time,
      'endTime', v_end_time,
      'durationMinutes',
        extract(epoch from (v_end_time - v_start_time))::integer / 60,
      'type', v_type,
      'location', v_location,
      'teleconsultation', v_type = 'online',
      'frequency', v_frequency,
      'occurrenceCount', v_occurrence_count,
      'occurrences', v_validation -> 'occurrences',
      'conflicts', v_validation -> 'conflicts',
      'hasConflicts', not coalesce((v_validation ->> 'valid')::boolean, false)
    ),
    'communication', v_communication,
    'financial', coalesce(v_input -> 'financial', '{}'::jsonb)
      || jsonb_build_object(
        'mode', v_financial_mode,
        'paymentCount', v_payment_count,
        'manualEntryCount', v_entry_count,
        'packageBinding', v_binding,
        'packageImpact', v_package_preview,
        'packageReviewRequired', v_package_preview is not null
          and not coalesce((v_package_preview ->> 'canExecute')::boolean, false),
        'unsafeExternalFacts',
          v_action = 'cancel'
          and v_binding is null
          and (v_payment_count > 0 or v_entry_count > 0)
      ),
    'fiscal', v_fiscal,
    'policy', coalesce(v_policy, '{}'::jsonb),
    'bindings', jsonb_build_object(
      'packageId', coalesce(v_package_id, (v_binding ->> 'packageId')::uuid),
      'packageBinding', v_binding
    ),
    'stateExpected', case
      when v_action = 'create' then jsonb_build_object(
        'scheduleValidation', encode(
          digest(v_validation::text, 'sha256'),
          'hex'
        )
      )
      else jsonb_build_object(
        'appointmentRevision', v_appointment.confirmation_revision,
        'confirmedRevision', v_appointment.confirmed_revision,
        'lifecycleStatus', v_appointment.lifecycle_status,
        'updatedAt', v_appointment.updated_at,
        'patientRightStatus', v_appointment.patient_right_status,
        'financialOutcome', v_appointment.financial_outcome,
        'teleconsultationStateHash', encode(digest(
          jsonb_build_object(
            'transcription', coalesce(
              v_appointment.metadata -> 'teleconsultationTranscription',
              'null'::jsonb
            ),
            'room', coalesce(
              v_appointment.metadata -> 'teleconsultationRoom',
              'null'::jsonb
            )
          )::text,
          'sha256'
        ), 'hex')
      )
    end,
    'provenance', v_provenance
  ));
end;
$$;

revoke all on function private.build_appointment_action_plan_snapshot(
  uuid, text, jsonb, jsonb
) from public, anon, authenticated, service_role;

create or replace function private.appointment_action_plan_safe_summary(
  p_snapshot jsonb,
  p_status text
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'action', p_snapshot ->> 'action',
    'title', case p_snapshot ->> 'action'
      when 'create' then 'Criar agendamento'
      when 'reschedule' then 'Alterar horário do agendamento'
      when 'set_teleconsultation_transcription' then 'Definir transcrição da teleconsulta'
      when 'close_teleconsultation' then 'Encerrar sala de teleconsulta'
      else 'Cancelar agendamento'
    end,
    'agenda', jsonb_build_object(
      'patientName', p_snapshot #>> '{agenda,patientName}',
      'startTime', p_snapshot #>> '{agenda,startTime}',
      'endTime', p_snapshot #>> '{agenda,endTime}',
      'durationMinutes', (p_snapshot #>> '{agenda,durationMinutes}')::integer,
      'type', p_snapshot #>> '{agenda,type}',
      'location', p_snapshot #>> '{agenda,location}',
      'teleconsultation',
        coalesce((p_snapshot #>> '{agenda,teleconsultation}')::boolean, false),
      'frequency', p_snapshot #>> '{agenda,frequency}',
      'occurrenceCount',
        coalesce((p_snapshot #>> '{agenda,occurrenceCount}')::integer, 1),
      'occurrences', p_snapshot #> '{agenda,occurrences}',
      'conflicts', p_snapshot #> '{agenda,conflicts}'
    ),
    'communication', p_snapshot -> 'communication',
    'financial', jsonb_build_object(
      'mode', p_snapshot #>> '{financial,mode}',
      'valuePerSession', p_snapshot #> '{financial,value_per_session}',
      'total', p_snapshot #> '{financial,total}',
      'chargeMode', p_snapshot #>> '{financial,charge_mode}',
      'paymentCount',
        coalesce((p_snapshot #>> '{financial,paymentCount}')::integer, 0),
      'manualEntryCount',
        coalesce((p_snapshot #>> '{financial,manualEntryCount}')::integer, 0),
      'packageStatus', p_snapshot #>> '{financial,packageBinding,status}',
      'impactMessage', case
        when coalesce(
          (p_snapshot #>> '{financial,packageReviewRequired}')::boolean,
          false
        ) then 'O pacote ou documento fiscal exige revisão antes da execução.'
        when p_snapshot ->> 'action' = 'cancel'
          and p_snapshot #>> '{financial,packageBinding,status}' = 'reserved'
          then 'A reserva do pacote será liberada com segurança.'
        when coalesce(
          (p_snapshot #>> '{financial,unsafeExternalFacts}')::boolean,
          false
        ) then 'O impacto financeiro exige revisão antes da execução.'
        when p_snapshot #>> '{financial,mode}' = 'neurofinance'
          then 'A cobrança será preparada sem contato externo nesta transação.'
        when p_snapshot #>> '{financial,mode}' = 'manual'
          then 'O lançamento manual seguirá o mesmo vínculo do agendamento.'
        else 'Nenhum ajuste financeiro externo será criado.'
      end
    ),
    'fiscal', jsonb_build_object(
      'automationEnabled',
        coalesce((p_snapshot #>> '{fiscal,automationEnabled}')::boolean, false),
      'trigger', p_snapshot #>> '{fiscal,trigger}',
      'potentialDocuments',
        coalesce((p_snapshot #>> '{fiscal,potentialDocuments}')::integer, 0),
      'blocked', coalesce((p_snapshot #>> '{fiscal,blocked}')::boolean, false)
    ),
    'policy', jsonb_build_object(
      'freeCancellationHours',
        p_snapshot #> '{policy,free_cancellation_hours}',
      'freeRescheduleHours',
        p_snapshot #> '{policy,free_reschedule_hours}',
      'lateCancellationConsequence',
        p_snapshot #>> '{policy,late_cancellation_consequence}',
      'packageCreditPolicy',
        p_snapshot #>> '{policy,package_credit_policy}',
      'chargePolicy', p_snapshot #>> '{policy,charge_policy}',
      'fiscalPolicy', p_snapshot #>> '{policy,fiscal_policy}',
      'timezone', coalesce(
        p_snapshot #>> '{policy,timezone}',
        'America/Sao_Paulo'
      )
    ),
    'requiresReview', p_status = 'review_required'
  ));
$$;

create or replace function private.safe_appointment_action_plan(
  p_plan public.appointment_action_plans
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'planId', p_plan.plan_id,
    'planVersion', p_plan.plan_version,
    'planHash', p_plan.plan_hash,
    'status', p_plan.status,
    'createdAt', p_plan.created_at,
    'expiresAt', p_plan.expires_at,
    'confirmedAt', p_plan.confirmed_at,
    'confirmationChannel', p_plan.confirmation_channel,
    'summary', p_plan.safe_summary,
    'result', p_plan.result_public,
    'confirmationRequired', p_plan.status = 'awaiting_confirmation'
  ));
$$;

revoke all on function private.appointment_action_plan_safe_summary(jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function private.safe_appointment_action_plan(
  public.appointment_action_plans
) from public, anon, authenticated, service_role;

create or replace function private.prepare_appointment_action_plan_core(
  p_professional_id uuid,
  p_action text,
  p_input jsonb,
  p_provenance jsonb,
  p_idempotency_key text,
  p_plan_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text := case lower(coalesce(p_action, ''))
    when 'create_appointment' then 'create'
    when 'reschedule_appointment' then 'reschedule'
    when 'cancel_appointment' then 'cancel'
    when 'set_teleconsultation_transcription_decision'
      then 'set_teleconsultation_transcription'
    when 'close_teleconsultation_room' then 'close_teleconsultation'
    else lower(coalesce(p_action, ''))
  end;
  v_provenance jsonb := coalesce(p_provenance, '{}'::jsonb);
  v_snapshot jsonb;
  v_hash text;
  v_status text;
  v_plan public.appointment_action_plans%rowtype;
  v_previous public.appointment_action_plans%rowtype;
  v_plan_id uuid;
  v_plan_version integer := 1;
  v_origin_channel text;
  v_patient_id uuid;
  v_appointment_id uuid;
begin
  if nullif(btrim(p_idempotency_key), '') is null
    or char_length(p_idempotency_key) not between 8 and 240
  then
    raise exception 'A valid idempotency key is required' using errcode = '22023';
  end if;

  v_origin_channel := private.normalize_appointment_plan_channel(
    v_provenance ->> 'origin_channel'
  );
  v_provenance := v_provenance || jsonb_build_object(
    'origin_channel', v_origin_channel
  );
  v_snapshot := private.build_appointment_action_plan_snapshot(
    p_professional_id,
    v_action,
    p_input,
    v_provenance
  );
  v_hash := encode(digest(v_snapshot::text, 'sha256'), 'hex');
  v_patient_id := nullif(v_snapshot #>> '{agenda,patientId}', '')::uuid;
  v_appointment_id := nullif(
    v_snapshot #>> '{agenda,appointmentId}',
    ''
  )::uuid;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'appointment-plan-idempotency:' || p_professional_id::text || ':' ||
        p_idempotency_key,
      0
    )
  );

  select plan.* into v_previous
  from public.appointment_action_plans plan
  where plan.professional_id = p_professional_id
    and plan.idempotency_key = p_idempotency_key
  order by plan.plan_version desc
  limit 1
  for update;

  if found and v_previous.plan_hash = v_hash
    and v_previous.status not in ('expired', 'superseded', 'failed')
  then
    return private.safe_appointment_action_plan(v_previous);
  end if;

  if found then
    if v_previous.status in ('confirmed', 'executing') then
      raise exception 'The current appointment plan is already being executed'
        using errcode = '55000';
    end if;
    v_plan_id := v_previous.plan_id;
    v_plan_version := v_previous.plan_version + 1;
    if v_previous.status not in (
      'completed', 'cancelled', 'expired', 'superseded', 'failed'
    ) then
      update public.appointment_action_plans
      set status = 'superseded', superseded_at = now()
      where id = v_previous.id
      returning * into v_previous;
      perform private.append_appointment_action_plan_event(
        v_previous,
        'plan_superseded',
        'awaiting_confirmation',
        'superseded',
        'system',
        p_professional_id,
        v_origin_channel,
        null,
        p_idempotency_key || ':v' || v_previous.plan_version::text ||
          ':superseded',
        jsonb_build_object('reason', 'material_facts_changed')
      );
    end if;
  else
    v_plan_id := coalesce(p_plan_id, gen_random_uuid());
  end if;

  v_status := case
    when coalesce(
      (v_snapshot #>> '{agenda,hasConflicts}')::boolean,
      false
    ) then 'review_required'
    when v_action = 'cancel'
      and coalesce(
        (v_snapshot #>> '{financial,unsafeExternalFacts}')::boolean,
        false
      ) then 'review_required'
    when v_action = 'cancel'
      and coalesce(
        (v_snapshot #>> '{financial,packageReviewRequired}')::boolean,
        false
      ) then 'review_required'
    when v_action = 'create'
      and v_snapshot #>> '{financial,mode}' = 'neurofinance'
      then 'review_required'
    else 'awaiting_confirmation'
  end;

  insert into public.appointment_action_plans (
    plan_id,
    plan_version,
    plan_hash,
    action,
    status,
    professional_id,
    patient_id,
    appointment_id,
    origin_channel,
    conversation_id,
    voice_session_id,
    whatsapp_message_id,
    tool_call,
    correlation_id,
    immutable_snapshot,
    safe_summary,
    idempotency_key
  ) values (
    v_plan_id,
    v_plan_version,
    v_hash,
    v_action,
    v_status,
    p_professional_id,
    v_patient_id,
    v_appointment_id,
    v_origin_channel,
    nullif(v_provenance ->> 'conversation_id', '')::uuid,
    nullif(v_provenance ->> 'voice_session_id', '')::uuid,
    nullif(btrim(v_provenance ->> 'whatsapp_message_id'), ''),
    nullif(btrim(v_provenance ->> 'tool_call'), ''),
    nullif(btrim(v_provenance ->> 'correlation_id'), ''),
    v_snapshot,
    private.appointment_action_plan_safe_summary(v_snapshot, v_status),
    p_idempotency_key
  )
  returning * into v_plan;

  perform private.append_appointment_action_plan_event(
    v_plan,
    'plan_prepared',
    null,
    v_plan.status,
    'synapse',
    p_professional_id,
    v_origin_channel,
    null,
    p_idempotency_key || ':v' || v_plan.plan_version::text || ':prepared',
    jsonb_build_object(
      'confirmationRequired', v_plan.status = 'awaiting_confirmation',
      'requiresReview', v_plan.status = 'review_required'
    )
  );

  return private.safe_appointment_action_plan(v_plan);
end;
$$;

revoke all on function private.prepare_appointment_action_plan_core(
  uuid, text, jsonb, jsonb, text, uuid
) from public, anon, authenticated, service_role;

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
set search_path = ''
as $$
declare
  v_plan public.appointment_action_plans%rowtype;
  v_new_plan public.appointment_action_plans%rowtype;
  v_appointment public.appointments%rowtype;
  v_rebuilt_snapshot jsonb;
  v_rebuilt_hash text;
  v_confirmation_channel text;
  v_result jsonb := '{}'::jsonb;
  v_public_result jsonb := '{}'::jsonb;
  v_package_result jsonb;
  v_new_status text;
  v_failure_from_status text;
  v_appointment_ids uuid[];
  v_package_id uuid;
  v_previous_revision integer;
  v_financial_status text := 'not_required';
  v_execution_started boolean := false;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('appointment-plan:' || p_plan_id::text, 0)
  );

  select plan.* into v_plan
  from public.appointment_action_plans plan
  where plan.plan_id = p_plan_id
    and plan.plan_version = p_plan_version
    and plan.professional_id = p_professional_id
  for update;

  if not found then
    raise exception 'Appointment plan not found' using errcode = 'P0002';
  end if;
  if v_plan.plan_hash <> lower(coalesce(p_plan_hash, '')) then
    raise exception 'Appointment plan hash changed; review the latest version'
      using errcode = '40001';
  end if;
  if v_plan.conversation_id is not null
    and v_plan.conversation_id is distinct from p_conversation_id
  then
    raise exception 'Appointment plan belongs to another conversation'
      using errcode = '42501';
  end if;
  if v_plan.status = 'completed' then
    return private.safe_appointment_action_plan(v_plan);
  end if;
  if v_plan.status not in ('awaiting_confirmation', 'confirmed') then
    raise exception 'Appointment plan cannot be executed from its current state'
      using errcode = '55000';
  end if;
  if v_plan.expires_at <= now() then
    update public.appointment_action_plans
    set status = 'expired', failed_at = now(), last_error = 'plan_expired'
    where id = v_plan.id
    returning * into v_plan;
    perform private.append_appointment_action_plan_event(
      v_plan,
      'plan_expired',
      'awaiting_confirmation',
      'expired',
      'system',
      p_professional_id,
      v_plan.origin_channel,
      null,
      v_plan.idempotency_key || ':v' || v_plan.plan_version::text || ':expired',
      '{}'::jsonb
    );
    return private.safe_appointment_action_plan(v_plan);
  end if;

  v_confirmation_channel := private.normalize_appointment_plan_channel(
    p_confirmation_channel
  );

  if v_plan.appointment_id is not null then
    select appointment.* into v_appointment
    from public.appointments appointment
    where appointment.id = v_plan.appointment_id
      and appointment.user_id = p_professional_id
    for update;
    if not found then
      raise exception 'Appointment disappeared before execution';
    end if;
    perform pg_advisory_xact_lock(
      hashtextextended('appointment:' || v_plan.appointment_id::text, 0)
    );
  elsif v_plan.action = 'create' then
    perform pg_advisory_xact_lock(hashtextextended(p_professional_id::text, 0));
  end if;

  v_rebuilt_snapshot := private.build_appointment_action_plan_snapshot(
    p_professional_id,
    v_plan.action,
    v_plan.immutable_snapshot -> 'input',
    v_plan.immutable_snapshot -> 'provenance'
  );
  v_rebuilt_hash := encode(digest(v_rebuilt_snapshot::text, 'sha256'), 'hex');

  if v_rebuilt_hash <> v_plan.plan_hash then
    update public.appointment_action_plans
    set status = 'superseded', superseded_at = now()
    where id = v_plan.id
    returning * into v_plan;
    perform private.append_appointment_action_plan_event(
      v_plan,
      'plan_superseded',
      'awaiting_confirmation',
      'superseded',
      'system',
      p_professional_id,
      v_plan.origin_channel,
      null,
      v_plan.idempotency_key || ':v' || v_plan.plan_version::text ||
        ':stale-execution',
      jsonb_build_object('reason', 'state_changed_before_execution')
    );

    v_new_status := case
      when coalesce(
        (v_rebuilt_snapshot #>> '{agenda,hasConflicts}')::boolean,
        false
      ) then 'review_required'
      when v_plan.action = 'cancel'
        and coalesce(
          (v_rebuilt_snapshot #>> '{financial,unsafeExternalFacts}')::boolean,
          false
        ) then 'review_required'
      when v_plan.action = 'cancel'
        and coalesce(
          (v_rebuilt_snapshot #>> '{financial,packageReviewRequired}')::boolean,
          false
        ) then 'review_required'
      when v_plan.action = 'create'
        and v_rebuilt_snapshot #>> '{financial,mode}' = 'neurofinance'
        then 'review_required'
      else 'awaiting_confirmation'
    end;

    insert into public.appointment_action_plans (
      plan_id,
      plan_version,
      plan_hash,
      action,
      status,
      professional_id,
      patient_id,
      appointment_id,
      series_id,
      origin_channel,
      conversation_id,
      voice_session_id,
      whatsapp_message_id,
      tool_call,
      correlation_id,
      immutable_snapshot,
      safe_summary,
      idempotency_key
    ) values (
      v_plan.plan_id,
      v_plan.plan_version + 1,
      v_rebuilt_hash,
      v_plan.action,
      v_new_status,
      v_plan.professional_id,
      v_plan.patient_id,
      v_plan.appointment_id,
      v_plan.series_id,
      v_plan.origin_channel,
      v_plan.conversation_id,
      v_plan.voice_session_id,
      v_plan.whatsapp_message_id,
      v_plan.tool_call,
      v_plan.correlation_id,
      v_rebuilt_snapshot,
      private.appointment_action_plan_safe_summary(
        v_rebuilt_snapshot,
        v_new_status
      ),
      v_plan.idempotency_key
    )
    returning * into v_new_plan;

    perform private.append_appointment_action_plan_event(
      v_new_plan,
      'plan_prepared',
      null,
      v_new_plan.status,
      'system',
      p_professional_id,
      v_new_plan.origin_channel,
      null,
      v_new_plan.idempotency_key || ':v' ||
        v_new_plan.plan_version::text || ':reprepared',
      jsonb_build_object('reason', 'state_changed_before_execution')
    );
    return private.safe_appointment_action_plan(v_new_plan);
  end if;

  update public.appointment_action_plans
  set
    status = 'confirmed',
    confirmed_at = coalesce(confirmed_at, now()),
    confirmed_by = p_professional_id,
    confirmation_channel = v_confirmation_channel
  where id = v_plan.id
  returning * into v_plan;
  perform private.append_appointment_action_plan_event(
    v_plan,
    'plan_confirmed',
    'awaiting_confirmation',
    'confirmed',
    'psychologist',
    p_professional_id,
    v_plan.origin_channel,
    v_confirmation_channel,
    v_plan.idempotency_key || ':v' || v_plan.plan_version::text ||
      ':confirmed',
    jsonb_build_object('authorizedSnapshotHash', v_plan.plan_hash)
  );

  update public.appointment_action_plans
  set status = 'executing', executing_at = now()
  where id = v_plan.id
  returning * into v_plan;
  v_execution_started := true;
  perform private.append_appointment_action_plan_event(
    v_plan,
    'plan_execution_started',
    'confirmed',
    'executing',
    'synapse',
    p_professional_id,
    v_plan.origin_channel,
    v_confirmation_channel,
    v_plan.idempotency_key || ':v' || v_plan.plan_version::text ||
      ':executing',
    '{}'::jsonb
  );

  if v_plan.action = 'create' then
    v_result := public.create_appointment_series_with_package(
      v_plan.patient_id,
      (v_plan.immutable_snapshot #>> '{agenda,startTime}')::timestamptz,
      (v_plan.immutable_snapshot #>> '{agenda,endTime}')::timestamptz,
      v_plan.immutable_snapshot #>> '{agenda,frequency}',
      (v_plan.immutable_snapshot #>> '{agenda,occurrenceCount}')::integer,
      v_plan.immutable_snapshot #>> '{agenda,type}',
      nullif(v_plan.immutable_snapshot #>> '{input,notes}', ''),
      nullif(v_plan.immutable_snapshot #>> '{agenda,location}', ''),
      jsonb_build_object(
        'source', 'appointment_action_plan',
        'planId', v_plan.plan_id,
        'planVersion', v_plan.plan_version,
        'originChannel', v_plan.origin_channel,
        'conversationId', v_plan.conversation_id,
        'voiceSessionId', v_plan.voice_session_id,
        'correlationId', v_plan.correlation_id
      ),
      nullif(v_plan.immutable_snapshot #>> '{bindings,packageId}', '')::uuid,
      p_professional_id
    );

    if not coalesce((v_result ->> 'success')::boolean, false) then
      raise exception 'The schedule changed before the plan was executed'
        using errcode = '40001';
    end if;

    select array_agg((item ->> 'appointmentId')::uuid order by ordinal)
    into v_appointment_ids
    from jsonb_array_elements(v_result -> 'appointments')
      with ordinality as created(item, ordinal);

    update public.appointments appointment
    set
      updated_by = p_professional_id,
      action_origin = 'synapse',
      last_actor_type = 'psychologist',
      audit_metadata = coalesce(appointment.audit_metadata, '{}'::jsonb)
        || jsonb_build_object(
          'originChannel', v_plan.origin_channel,
          'planId', v_plan.plan_id,
          'planVersion', v_plan.plan_version,
          'conversationId', v_plan.conversation_id,
          'voiceSessionId', v_plan.voice_session_id,
          'correlationId', v_plan.correlation_id,
          'idempotencyKey', v_plan.idempotency_key
        )
    where appointment.id = any(v_appointment_ids);

    if coalesce(
      (v_plan.immutable_snapshot #>> '{communication,sendConfirmation}')::boolean,
      true
    ) then
      insert into public.appointment_communication_outbox (
        appointment_id,
        psychologist_id,
        patient_id,
        template_key,
        payload,
        idempotency_key
      )
      select
        appointment.id,
        appointment.user_id,
        appointment.patient_id,
        'appointment_invitation',
        jsonb_build_object(
          'originChannel', v_plan.origin_channel,
          'planVersion', v_plan.plan_version
        ),
        'appointment:' || appointment.id::text || ':revision:' ||
          appointment.confirmation_revision::text || ':plan-invitation'
      from public.appointments appointment
      where appointment.id = any(v_appointment_ids)
        and appointment.patient_id is not null
      on conflict (psychologist_id, idempotency_key) do nothing;
    end if;

    if v_plan.immutable_snapshot #>> '{financial,mode}' = 'manual' then
      insert into public.financial_entries (
        professional_id,
        patient_id,
        appointment_id,
        type,
        title,
        description,
        amount,
        due_date,
        competence_date,
        status,
        payment_method,
        origin,
        idempotency_key,
        metadata
      )
      select
        appointment.user_id,
        appointment.patient_id,
        appointment.id,
        'income',
        'Sessão agendada',
        'Lançamento preparado pelo plano de agendamento',
        coalesce(
          (v_plan.immutable_snapshot #>> '{financial,value_per_session}')::numeric,
          0
        ),
        appointment.start_time::date,
        appointment.start_time::date,
        'pending',
        'manual',
        'appointment',
        'appointment-plan:' || v_plan.plan_id::text || ':appointment:' ||
          appointment.id::text || ':manual-entry',
        jsonb_build_object(
          'source', 'appointment_action_plan',
          'planVersion', v_plan.plan_version
        )
      from public.appointments appointment
      where appointment.id = any(v_appointment_ids)
        and coalesce(
          (v_plan.immutable_snapshot #>> '{financial,value_per_session}')::numeric,
          0
        ) > 0
      on conflict (professional_id, idempotency_key)
        where idempotency_key is not null
      do nothing;
      v_financial_status := 'prepared';
    elsif v_plan.immutable_snapshot #>> '{financial,mode}' = 'package' then
      v_financial_status := 'package_reserved';
    end if;

    v_public_result := jsonb_build_object(
      'message', case
        when coalesce(array_length(v_appointment_ids, 1), 0) = 1
          then 'Agendamento criado com sucesso.'
        else coalesce(array_length(v_appointment_ids, 1), 0)::text ||
          ' agendamentos criados na mesma série.'
      end,
      'appointmentIds', to_jsonb(v_appointment_ids),
      'seriesId', v_result ->> 'seriesId',
      'financialAdjustmentStatus', v_financial_status,
      'confirmationInvitationsPrepared',
        coalesce(
          (v_plan.immutable_snapshot #>> '{communication,sendConfirmation}')::boolean,
          true
        )
    );
  elsif v_plan.action = 'reschedule' then
    v_previous_revision := v_appointment.confirmation_revision;

    perform set_config('neuronex.appointment_command', 'appointment_action_plan', true);
    update public.appointments
    set
      start_time = (v_plan.immutable_snapshot #>> '{agenda,startTime}')::timestamptz,
      end_time = (v_plan.immutable_snapshot #>> '{agenda,endTime}')::timestamptz,
      type = v_plan.immutable_snapshot #>> '{agenda,type}',
      location = nullif(v_plan.immutable_snapshot #>> '{agenda,location}', ''),
      updated_by = p_professional_id,
      action_origin = 'synapse',
      last_actor_type = 'psychologist',
      audit_metadata = coalesce(audit_metadata, '{}'::jsonb)
        || jsonb_build_object(
          'originChannel', v_plan.origin_channel,
          'planId', v_plan.plan_id,
          'planVersion', v_plan.plan_version,
          'conversationId', v_plan.conversation_id,
          'voiceSessionId', v_plan.voice_session_id,
          'correlationId', v_plan.correlation_id,
          'idempotencyKey', v_plan.idempotency_key
        )
    where id = v_appointment.id
    returning * into v_appointment;

    if v_appointment.confirmation_revision > v_previous_revision
      and coalesce(
        (v_plan.immutable_snapshot #>> '{communication,sendConfirmation}')::boolean,
        true
      )
    then
      insert into public.appointment_communication_outbox (
        appointment_id,
        psychologist_id,
        patient_id,
        template_key,
        payload,
        idempotency_key
      ) values (
        v_appointment.id,
        v_appointment.user_id,
        v_appointment.patient_id,
        'appointment_reconfirmation_required',
        jsonb_build_object(
          'originChannel', v_plan.origin_channel,
          'previousRevision', v_previous_revision,
          'newRevision', v_appointment.confirmation_revision
        ),
        'appointment:' || v_appointment.id::text || ':revision:' ||
          v_appointment.confirmation_revision::text || ':reconfirmation'
      )
      on conflict (psychologist_id, idempotency_key) do nothing;
    end if;

    v_public_result := jsonb_build_object(
      'message', 'Horário alterado pelo fluxo profissional.',
      'appointmentId', v_appointment.id,
      'confirmationRevision', v_appointment.confirmation_revision,
      'newConfirmationRequired',
        v_appointment.confirmation_revision > v_previous_revision,
      'financialAdjustmentStatus', 'preserved'
    );
  elsif v_plan.action = 'set_teleconsultation_transcription' then
    perform set_config('neuronex.appointment_command', 'appointment_action_plan', true);
    update public.appointments
    set
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'teleconsultationTranscription', jsonb_strip_nulls(jsonb_build_object(
          'enabled', coalesce(
            (v_plan.immutable_snapshot #>> '{input,enabled}')::boolean,
            false
          ),
          'decidedAt', now(),
          'decidedBy', p_professional_id,
          'noticeVersion', '2026-07-appointment-plan-v1',
          'notes', nullif(v_plan.immutable_snapshot #>> '{input,notes}', '')
        ))
      ),
      updated_by = p_professional_id,
      action_origin = 'synapse',
      last_actor_type = 'psychologist',
      audit_metadata = coalesce(audit_metadata, '{}'::jsonb)
        || jsonb_build_object(
          'originChannel', v_plan.origin_channel,
          'planId', v_plan.plan_id,
          'planVersion', v_plan.plan_version,
          'conversationId', v_plan.conversation_id,
          'voiceSessionId', v_plan.voice_session_id,
          'correlationId', v_plan.correlation_id,
          'idempotencyKey', v_plan.idempotency_key
        )
    where id = v_appointment.id
    returning * into v_appointment;

    v_public_result := jsonb_build_object(
      'message', case
        when coalesce(
          (v_plan.immutable_snapshot #>> '{input,enabled}')::boolean,
          false
        ) then 'Transcrição autorizada para esta teleconsulta.'
        else 'Teleconsulta configurada para seguir sem transcrição.'
      end,
      'appointmentId', v_appointment.id,
      'financialAdjustmentStatus', 'preserved'
    );
  elsif v_plan.action = 'close_teleconsultation' then
    perform set_config('neuronex.appointment_command', 'appointment_action_plan', true);
    update public.appointments
    set
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'teleconsultationRoom',
        coalesce(metadata -> 'teleconsultationRoom', '{}'::jsonb)
          || jsonb_build_object(
            'status', 'closed',
            'closedAt', now(),
            'closedReason', coalesce(
              nullif(v_plan.immutable_snapshot #>> '{input,reason}', ''),
              'synapse_close'
            )
          )
      ),
      updated_by = p_professional_id,
      action_origin = 'synapse',
      last_actor_type = 'psychologist',
      audit_metadata = coalesce(audit_metadata, '{}'::jsonb)
        || jsonb_build_object(
          'originChannel', v_plan.origin_channel,
          'planId', v_plan.plan_id,
          'planVersion', v_plan.plan_version,
          'conversationId', v_plan.conversation_id,
          'voiceSessionId', v_plan.voice_session_id,
          'correlationId', v_plan.correlation_id,
          'idempotencyKey', v_plan.idempotency_key
        )
    where id = v_appointment.id
    returning * into v_appointment;

    v_public_result := jsonb_build_object(
      'message', 'Sala de teleconsulta encerrada com segurança.',
      'appointmentId', v_appointment.id,
      'financialAdjustmentStatus', 'preserved'
    );
  else
    if v_appointment.lifecycle_status = 'cancelled' then
      v_public_result := jsonb_build_object(
        'message', 'O agendamento já estava cancelado.',
        'appointmentId', v_appointment.id,
        'idempotentReplay', true
      );
    else
      v_package_id := nullif(
        v_plan.immutable_snapshot #>> '{bindings,packageId}',
        ''
      )::uuid;
      if v_package_id is not null
        and v_plan.immutable_snapshot #>> '{financial,packageBinding,status}'
          = 'reserved'
      then
        v_package_result := public.execute_package_lifecycle_change_internal(
          p_professional_id,
          v_package_id,
          null,
          'release',
          'only_this',
          v_appointment.id,
          'cancel_without_replacement',
          coalesce(
            nullif(v_plan.immutable_snapshot #>> '{input,reason}', ''),
            'Cancelamento autorizado pelo profissional'
          ),
          'appointment-plan:' || v_plan.plan_id::text || ':release-package',
          array[v_appointment.id],
          'synapse'
        );
        v_financial_status := coalesce(
          v_package_result ->> 'status',
          'package_release_prepared'
        );
      end if;

      perform set_config('neuronex.appointment_command', 'appointment_action_plan', true);
      update public.appointments
      set
        status = 'cancelled_by_professional',
        lifecycle_status = 'cancelled',
        cancelled_at = now(),
        cancellation_reason = coalesce(
          nullif(v_plan.immutable_snapshot #>> '{input,reason}', ''),
          'Cancelamento autorizado pelo profissional'
        ),
        clinical_outcome = 'cancelled',
        financial_outcome = case
          when v_package_id is not null then 'credit_released'
          else 'no_consequence'
        end,
        change_responsibility = 'professional',
        outcome_review_required = false,
        updated_by = p_professional_id,
        action_origin = 'synapse',
        last_actor_type = 'psychologist',
        audit_metadata = coalesce(audit_metadata, '{}'::jsonb)
          || jsonb_build_object(
            'originChannel', v_plan.origin_channel,
            'planId', v_plan.plan_id,
            'planVersion', v_plan.plan_version,
            'conversationId', v_plan.conversation_id,
            'voiceSessionId', v_plan.voice_session_id,
            'correlationId', v_plan.correlation_id,
            'idempotencyKey', v_plan.idempotency_key
          )
      where id = v_appointment.id
      returning * into v_appointment;

      v_public_result := jsonb_build_object(
        'message', 'Agendamento cancelado pelo fluxo profissional.',
        'appointmentId', v_appointment.id,
        'financialAdjustmentStatus', v_financial_status,
        'packagePreserved', v_package_id is not null
      );
    end if;
  end if;

  v_result := jsonb_build_object(
    'planId', v_plan.plan_id,
    'planVersion', v_plan.plan_version,
    'planHash', v_plan.plan_hash,
    'action', v_plan.action,
    'result', v_public_result
  );
  update public.appointment_action_plans
  set
    status = 'completed',
    appointment_id = case
      when action = 'create' then v_appointment_ids[1]
      else appointment_id
    end,
    series_id = case
      when action = 'create'
        then nullif(v_public_result ->> 'seriesId', '')::uuid
      else series_id
    end,
    completed_at = now(),
    result_public = v_public_result,
    result_internal = v_result,
    last_error = null
  where id = v_plan.id
  returning * into v_plan;

  perform private.append_appointment_action_plan_event(
    v_plan,
    'plan_executed',
    'executing',
    'completed',
    'synapse',
    p_professional_id,
    v_plan.origin_channel,
    v_confirmation_channel,
    v_plan.idempotency_key || ':v' || v_plan.plan_version::text ||
      ':completed',
    jsonb_build_object(
      'result', 'completed',
      'newConfirmationRequired',
        coalesce((v_public_result ->> 'newConfirmationRequired')::boolean, false),
      'financialAdjustmentStatus',
        v_public_result ->> 'financialAdjustmentStatus'
    )
  );

  return private.safe_appointment_action_plan(v_plan);
exception
  when others then
    if v_plan.id is not null and v_execution_started then
      select status into v_failure_from_status
      from public.appointment_action_plans
      where id = v_plan.id;
      update public.appointment_action_plans
      set
        status = 'failed',
        failed_at = now(),
        last_error = left(sqlerrm, 1000)
      where id = v_plan.id
        and status in ('awaiting_confirmation', 'confirmed', 'executing')
      returning * into v_plan;
      if found then
        perform private.append_appointment_action_plan_event(
          v_plan,
          'plan_failed',
          v_failure_from_status,
          'failed',
          'system',
          p_professional_id,
          v_plan.origin_channel,
          v_confirmation_channel,
          v_plan.idempotency_key || ':v' || v_plan.plan_version::text ||
            ':failed',
          jsonb_build_object('safeError', 'execution_failed')
        );
      end if;
    end if;
    raise;
end;
$$;

revoke all on function private.execute_appointment_action_plan_core(
  uuid, uuid, integer, text, text, uuid
) from public, anon, authenticated, service_role;

create or replace function private.get_appointment_action_plan_status_core(
  p_professional_id uuid,
  p_plan_id uuid,
  p_plan_version integer default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_plan public.appointment_action_plans%rowtype;
begin
  select plan.* into v_plan
  from public.appointment_action_plans plan
  where plan.plan_id = p_plan_id
    and plan.professional_id = p_professional_id
    and (p_plan_version is null or plan.plan_version = p_plan_version)
  order by plan.plan_version desc
  limit 1;
  if not found then
    raise exception 'Appointment plan not found' using errcode = 'P0002';
  end if;
  return private.safe_appointment_action_plan(v_plan);
end;
$$;

create or replace function private.cancel_appointment_action_plan_core(
  p_professional_id uuid,
  p_plan_id uuid,
  p_plan_version integer,
  p_plan_hash text,
  p_conversation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.appointment_action_plans%rowtype;
  v_from_status text;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('appointment-plan:' || p_plan_id::text, 0)
  );
  select plan.* into v_plan
  from public.appointment_action_plans plan
  where plan.plan_id = p_plan_id
    and plan.plan_version = p_plan_version
    and plan.professional_id = p_professional_id
  for update;
  if not found then
    raise exception 'Appointment plan not found' using errcode = 'P0002';
  end if;
  if v_plan.plan_hash <> lower(coalesce(p_plan_hash, '')) then
    raise exception 'Appointment plan hash changed' using errcode = '40001';
  end if;
  if v_plan.conversation_id is not null
    and v_plan.conversation_id is distinct from p_conversation_id
  then
    raise exception 'Appointment plan belongs to another conversation'
      using errcode = '42501';
  end if;
  if v_plan.status = 'cancelled' then
    return private.safe_appointment_action_plan(v_plan);
  end if;
  if v_plan.status not in ('prepared', 'awaiting_confirmation', 'review_required') then
    raise exception 'Appointment plan can no longer be cancelled'
      using errcode = '55000';
  end if;
  v_from_status := v_plan.status;
  update public.appointment_action_plans
  set status = 'cancelled', cancelled_at = now()
  where id = v_plan.id
  returning * into v_plan;
  perform private.append_appointment_action_plan_event(
    v_plan,
    'plan_cancelled',
    v_from_status,
    'cancelled',
    'psychologist',
    p_professional_id,
    v_plan.origin_channel,
    null,
    v_plan.idempotency_key || ':v' || v_plan.plan_version::text ||
      ':cancelled',
    '{}'::jsonb
  );
  return private.safe_appointment_action_plan(v_plan);
end;
$$;

revoke all on function private.get_appointment_action_plan_status_core(
  uuid, uuid, integer
) from public, anon, authenticated, service_role;
revoke all on function private.cancel_appointment_action_plan_core(
  uuid, uuid, integer, text, uuid
) from public, anon, authenticated, service_role;

create or replace function private.assert_appointment_plan_service_role()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
    and session_user not in ('postgres', 'supabase_admin')
  then
    raise exception 'Service role required' using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.assert_appointment_plan_service_role()
  from public, anon, authenticated, service_role;

create or replace function public.prepare_appointment_action_plan(
  p_action text,
  p_input jsonb,
  p_provenance jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  return private.prepare_appointment_action_plan_core(
    auth.uid(),
    p_action,
    p_input,
    coalesce(p_provenance, '{}'::jsonb)
      || jsonb_build_object('origin_channel', 'professional_app'),
    p_idempotency_key,
    null
  );
end;
$$;

create or replace function public.prepare_appointment_action_plan_internal(
  p_actor_user_id uuid,
  p_action text,
  p_input jsonb,
  p_provenance jsonb,
  p_idempotency_key text,
  p_plan_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_appointment_plan_service_role();
  return private.prepare_appointment_action_plan_core(
    p_actor_user_id,
    p_action,
    p_input,
    p_provenance,
    p_idempotency_key,
    p_plan_id
  );
end;
$$;

create or replace function public.execute_appointment_action_plan(
  p_plan_id uuid,
  p_plan_version integer,
  p_plan_hash text,
  p_confirmation_channel text default 'professional_app',
  p_conversation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  return private.execute_appointment_action_plan_core(
    auth.uid(),
    p_plan_id,
    p_plan_version,
    p_plan_hash,
    p_confirmation_channel,
    p_conversation_id
  );
end;
$$;

create or replace function public.execute_appointment_action_plan_internal(
  p_actor_user_id uuid,
  p_plan_id uuid,
  p_plan_version integer,
  p_plan_hash text,
  p_confirmation_channel text,
  p_conversation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_appointment_plan_service_role();
  return private.execute_appointment_action_plan_core(
    p_actor_user_id,
    p_plan_id,
    p_plan_version,
    p_plan_hash,
    p_confirmation_channel,
    p_conversation_id
  );
end;
$$;

create or replace function public.get_appointment_action_plan_status(
  p_plan_id uuid,
  p_plan_version integer default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  return private.get_appointment_action_plan_status_core(
    auth.uid(),
    p_plan_id,
    p_plan_version
  );
end;
$$;

create or replace function public.get_appointment_action_plan_status_internal(
  p_actor_user_id uuid,
  p_plan_id uuid,
  p_plan_version integer default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_appointment_plan_service_role();
  return private.get_appointment_action_plan_status_core(
    p_actor_user_id,
    p_plan_id,
    p_plan_version
  );
end;
$$;

create or replace function public.cancel_appointment_action_plan(
  p_plan_id uuid,
  p_plan_version integer,
  p_plan_hash text,
  p_conversation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  return private.cancel_appointment_action_plan_core(
    auth.uid(),
    p_plan_id,
    p_plan_version,
    p_plan_hash,
    p_conversation_id
  );
end;
$$;

create or replace function public.cancel_appointment_action_plan_internal(
  p_actor_user_id uuid,
  p_plan_id uuid,
  p_plan_version integer,
  p_plan_hash text,
  p_conversation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_appointment_plan_service_role();
  return private.cancel_appointment_action_plan_core(
    p_actor_user_id,
    p_plan_id,
    p_plan_version,
    p_plan_hash,
    p_conversation_id
  );
end;
$$;

revoke all on function public.prepare_appointment_action_plan(
  text, jsonb, jsonb, text
) from public, anon;
grant execute on function public.prepare_appointment_action_plan(
  text, jsonb, jsonb, text
) to authenticated;

revoke all on function public.execute_appointment_action_plan(
  uuid, integer, text, text, uuid
) from public, anon;
grant execute on function public.execute_appointment_action_plan(
  uuid, integer, text, text, uuid
) to authenticated;

revoke all on function public.get_appointment_action_plan_status(
  uuid, integer
) from public, anon;
grant execute on function public.get_appointment_action_plan_status(
  uuid, integer
) to authenticated;

revoke all on function public.cancel_appointment_action_plan(
  uuid, integer, text, uuid
) from public, anon;
grant execute on function public.cancel_appointment_action_plan(
  uuid, integer, text, uuid
) to authenticated;

revoke all on function public.prepare_appointment_action_plan_internal(
  uuid, text, jsonb, jsonb, text, uuid
) from public, anon, authenticated;
grant execute on function public.prepare_appointment_action_plan_internal(
  uuid, text, jsonb, jsonb, text, uuid
) to service_role;

revoke all on function public.execute_appointment_action_plan_internal(
  uuid, uuid, integer, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.execute_appointment_action_plan_internal(
  uuid, uuid, integer, text, text, uuid
) to service_role;

revoke all on function public.get_appointment_action_plan_status_internal(
  uuid, uuid, integer
) from public, anon, authenticated;
grant execute on function public.get_appointment_action_plan_status_internal(
  uuid, uuid, integer
) to service_role;

revoke all on function public.cancel_appointment_action_plan_internal(
  uuid, uuid, integer, text, uuid
) from public, anon, authenticated;
grant execute on function public.cancel_appointment_action_plan_internal(
  uuid, uuid, integer, text, uuid
) to service_role;

comment on table public.appointment_action_plans is
  'Immutable, versioned authorization snapshots for appointment mutations across Synapse and professional channels.';
comment on table public.appointment_action_plan_events is
  'Append-only authorization and execution history for appointment action plans.';
