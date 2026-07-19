-- Open-series materialization, smart-fit proposals and immutable template
-- versioning for Agenda Desktop v2.

create schema if not exists private;

create table public.appointment_series_materialization_conflicts (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  series_id uuid not null references public.appointment_series(id) on delete cascade,
  occurrence_number integer not null,
  proposed_start_time timestamptz not null,
  proposed_end_time timestamptz not null,
  reason_code text not null,
  status text not null default 'pending'
    check (status in ('pending', 'resolved', 'dismissed')),
  resolution_action_plan_id uuid,
  safe_details jsonb not null default '{}'::jsonb check (jsonb_typeof(safe_details) = 'object'),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (series_id, occurrence_number, proposed_start_time)
);

create index appointment_series_materialization_conflicts_pending_idx
  on public.appointment_series_materialization_conflicts
  (professional_id, status, proposed_start_time)
  where status = 'pending';

alter table public.appointment_series_materialization_conflicts enable row level security;
revoke all on public.appointment_series_materialization_conflicts
  from public, anon, authenticated;
grant select on public.appointment_series_materialization_conflicts to authenticated;
grant all on public.appointment_series_materialization_conflicts to service_role;
create policy appointment_series_materialization_conflicts_owner_select
  on public.appointment_series_materialization_conflicts for select to authenticated
  using (professional_id = (select auth.uid()));

create or replace function public.save_appointment_series_template(
  p_template_id uuid,
  p_name text,
  p_recurrence_rule jsonb,
  p_default_config jsonb default '{}'::jsonb,
  p_source_patient_id uuid default null,
  p_source_series_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_professional_id uuid := auth.uid();
  v_template public.appointment_series_templates%rowtype;
  v_version public.appointment_series_template_versions%rowtype;
  v_next_version integer;
begin
  if v_professional_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 120 then
    raise exception 'Informe um nome entre 1 e 120 caracteres.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_recurrence_rule, 'null'::jsonb)) <> 'object' then
    raise exception 'Regra de recorrência inválida.' using errcode = '22023';
  end if;
  if p_source_patient_id is not null and not exists (
    select 1 from public.patients patient
    where patient.id = p_source_patient_id and patient.user_id = v_professional_id
  ) then
    raise exception 'Paciente de origem não encontrado.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'series-template:' || v_professional_id::text || ':' || coalesce(p_template_id::text, lower(btrim(p_name))),
    0
  ));

  if p_template_id is null then
    insert into public.appointment_series_templates (
      professional_id, name, source_patient_id, source_series_id
    ) values (
      v_professional_id, btrim(p_name), p_source_patient_id, p_source_series_id
    ) returning * into v_template;
  else
    update public.appointment_series_templates template
    set name = btrim(p_name),
        source_patient_id = p_source_patient_id,
        source_series_id = p_source_series_id,
        is_archived = false,
        updated_at = now()
    where template.id = p_template_id
      and template.professional_id = v_professional_id
    returning * into v_template;
    if not found then raise exception 'Modelo não encontrado.' using errcode = 'P0002'; end if;
  end if;

  select coalesce(max(version.version_number), 0) + 1 into v_next_version
  from public.appointment_series_template_versions version
  where version.template_id = v_template.id;

  insert into public.appointment_series_template_versions (
    template_id,
    professional_id,
    version_number,
    recurrence_rule,
    default_config,
    created_by
  ) values (
    v_template.id,
    v_professional_id,
    v_next_version,
    p_recurrence_rule,
    coalesce(p_default_config, '{}'::jsonb) - 'financial' - 'patientId' - 'patient_id',
    v_professional_id
  ) returning * into v_version;

  return jsonb_build_object(
    'success', true,
    'templateId', v_template.id,
    'templateVersionId', v_version.id,
    'versionNumber', v_version.version_number,
    'name', v_template.name
  );
end;
$$;

revoke all on function public.save_appointment_series_template(uuid, text, jsonb, jsonb, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.save_appointment_series_template(uuid, text, jsonb, jsonb, uuid, uuid)
  to authenticated;

create or replace function public.suggest_appointment_smart_fit(
  p_appointment_id uuid,
  p_search_days integer default 14,
  p_allow_shorter boolean default false,
  p_minimum_duration_minutes integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_professional_id uuid := auth.uid();
  v_appointment public.appointments%rowtype;
  v_duration integer;
  v_result jsonb;
begin
  if v_professional_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select appointment.* into v_appointment
  from public.appointments appointment
  where appointment.id = p_appointment_id
    and appointment.user_id = v_professional_id;
  if not found then raise exception 'Agendamento não encontrado.' using errcode = 'P0002'; end if;
  if v_appointment.start_time is null or v_appointment.end_time is null then
    raise exception 'Agendamento sem intervalo válido.' using errcode = '22023';
  end if;
  v_duration := extract(epoch from (v_appointment.end_time - v_appointment.start_time))::integer / 60;

  with durations as (
    select v_duration as minutes, 0 as duration_penalty
    union all
    select greatest(p_minimum_duration_minutes, 15), 1
    where p_allow_shorter and greatest(p_minimum_duration_minutes, 15) < v_duration
  ), candidates as (
    select
      slot as starts_at,
      slot + make_interval(mins => duration.minutes) as ends_at,
      duration.minutes,
      duration.duration_penalty,
      case when slot::date = v_appointment.start_time::date then 0 else 1 end as date_penalty,
      case when extract(dow from slot) = extract(dow from v_appointment.start_time) then 0 else 1 end as weekday_penalty,
      abs(extract(epoch from (slot - v_appointment.start_time))) as distance_seconds
    from durations duration
    cross join lateral generate_series(
      greatest(date_trunc('day', now()), date_trunc('day', v_appointment.start_time - make_interval(days => least(greatest(p_search_days, 1), 60)))),
      date_trunc('day', v_appointment.start_time + make_interval(days => least(greatest(p_search_days, 1), 60))) + interval '23 hours 50 minutes',
      interval '10 minutes'
    ) slot
    where slot > now()
      and private.agenda_v2_is_available(
        v_professional_id,
        slot,
        slot + make_interval(mins => duration.minutes),
        null
      )
      and not exists (
        select 1 from public.appointments conflict
        where conflict.user_id = v_professional_id
          and conflict.id <> v_appointment.id
          and conflict.start_time is not null
          and conflict.end_time is not null
          and lower(coalesce(conflict.status, '')) not in ('cancelled', 'canceled')
          and conflict.lifecycle_status <> 'cancelled'
          and tstzrange(conflict.start_time, conflict.end_time, '[)')
            && tstzrange(slot, slot + make_interval(mins => duration.minutes), '[)')
      )
      and not exists (
        select 1 from public.appointment_slot_holds hold
        where hold.professional_id = v_professional_id
          and hold.status = 'active'
          and hold.expires_at > now()
          and tstzrange(hold.starts_at, hold.ends_at, '[)')
            && tstzrange(slot, slot + make_interval(mins => duration.minutes), '[)')
      )
  ), ranked as (
    select * from candidates
    order by duration_penalty, date_penalty, weekday_penalty, distance_seconds, starts_at
    limit 3
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'startTime', ranked.starts_at,
    'endTime', ranked.ends_at,
    'durationMinutes', ranked.minutes,
    'keepsFullDuration', ranked.minutes = v_duration,
    'reasonCodes', jsonb_build_array(
      case when ranked.minutes = v_duration then 'full_duration' else 'shorter_duration_opt_in' end,
      case when ranked.date_penalty = 0 then 'same_date' else 'nearest_available' end
    ),
    'distanceMinutes', round(ranked.distance_seconds / 60)
  ) order by ranked.duration_penalty, ranked.date_penalty, ranked.weekday_penalty, ranked.distance_seconds), '[]'::jsonb)
  into v_result
  from ranked;

  return jsonb_build_object(
    'appointmentId', v_appointment.id,
    'originalStartTime', v_appointment.start_time,
    'originalEndTime', v_appointment.end_time,
    'requiresConfirmation', true,
    'candidates', v_result
  );
end;
$$;

revoke all on function public.suggest_appointment_smart_fit(uuid, integer, boolean, integer)
  from public, anon, authenticated;
grant execute on function public.suggest_appointment_smart_fit(uuid, integer, boolean, integer)
  to authenticated;

create or replace function private.capture_series_occurrence_override()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fields text[] := '{}';
  v_source text;
begin
  if old.series_id is null or new.series_id is null then return new; end if;
  if old.start_time is distinct from new.start_time then v_fields := array_append(v_fields, 'startTime'); end if;
  if old.end_time is distinct from new.end_time then v_fields := array_append(v_fields, 'endTime'); end if;
  if old.type is distinct from new.type then v_fields := array_append(v_fields, 'modality'); end if;
  if old.location is distinct from new.location then v_fields := array_append(v_fields, 'location'); end if;
  if cardinality(v_fields) = 0 then return new; end if;

  v_source := case
    when new.action_origin like 'synapse_%' then 'synapse'
    when new.action_origin = 'availability_change' then 'availability_change'
    else 'professional'
  end;
  new.occurrence_status := 'customized';
  new.personalized_fields := array(select distinct unnest(new.personalized_fields || v_fields));
  new.series_revision := coalesce(new.series_revision, 1) + 1;

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
    created_by
  ) values (
    new.series_id,
    new.id,
    new.user_id,
    new.occurrence_number,
    jsonb_build_object(
      'startTime', old.start_time,
      'endTime', old.end_time,
      'modality', old.type,
      'location', old.location
    ),
    jsonb_build_object(
      'startTime', new.start_time,
      'endTime', new.end_time,
      'modality', new.type,
      'location', new.location
    ),
    v_fields,
    v_source,
    coalesce(new.audit_metadata ->> 'changeReason', 'Ocorrência personalizada'),
    coalesce(new.updated_by, new.user_id)
  )
  on conflict (series_id, occurrence_number) do update
  set appointment_id = excluded.appointment_id,
      override_values = excluded.override_values,
      changed_fields = array(select distinct unnest(public.appointment_occurrence_overrides.changed_fields || excluded.changed_fields)),
      source = excluded.source,
      reason = excluded.reason,
      created_by = excluded.created_by,
      created_at = now();
  return new;
end;
$$;

revoke all on function private.capture_series_occurrence_override()
  from public, anon, authenticated;
drop trigger if exists tr_capture_series_occurrence_override on public.appointments;
create trigger tr_capture_series_occurrence_override
before update of start_time, end_time, type, location on public.appointments
for each row execute function private.capture_series_occurrence_override();

create or replace function private.materialize_open_appointment_series(
  p_batch_size integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_series public.appointment_series%rowtype;
  v_input jsonb;
  v_occurrences jsonb;
  v_occurrence jsonb;
  v_start timestamptz;
  v_end timestamptz;
  v_appointment_id uuid;
  v_new_ids uuid[];
  v_materialized integer := 0;
  v_conflicts integer := 0;
  v_processed integer := 0;
  v_package_id uuid;
  v_available_package_sessions integer;
begin
  for v_series in
    select series.*
    from public.appointment_series series
    where series.status = 'active'
      and series.termination_kind = 'open'
      and coalesce(series.next_generation_at, now()) <= now()
    order by series.next_generation_at nulls first, series.created_at
    limit least(greatest(p_batch_size, 1), 200)
    for update skip locked
  loop
    v_processed := v_processed + 1;
    v_new_ids := '{}';
    v_package_id := nullif(v_series.financial_snapshot ->> 'package_id', '')::uuid;
    v_input := jsonb_build_object(
      'patient_id', v_series.patient_id,
      'first_start_time', v_series.first_start_time,
      'duration_minutes', v_series.duration_minutes,
      'timezone', v_series.timezone,
      'type', v_series.appointment_type,
      'recurrence_rule', v_series.recurrence_rule,
      'default_config', v_series.default_config,
      'financial', v_series.financial_snapshot,
      'metadata', coalesce(v_series.default_config -> 'metadata', '{}'::jsonb),
      'notes', v_series.default_config ->> 'notes',
      'location', v_series.default_config ->> 'location'
    );
    v_occurrences := private.generate_agenda_v2_occurrences(v_series.psychologist_id, v_input);

    if v_package_id is not null then
      select package.total_sessions - package.sessions_used - package.sessions_reserved
      into v_available_package_sessions
      from public.patient_packages package
      where package.id = v_package_id
        and package.user_id = v_series.psychologist_id
        and package.patient_id = v_series.patient_id
        and package.package_status = 'active';
    end if;

    for v_occurrence in select value from jsonb_array_elements(v_occurrences)
    loop
      v_start := (v_occurrence ->> 'startTime')::timestamptz;
      v_end := (v_occurrence ->> 'endTime')::timestamptz;
      if v_start <= now() then continue; end if;
      if exists (
        select 1 from public.appointments appointment
        where appointment.series_id = v_series.id
          and appointment.occurrence_number = (v_occurrence ->> 'occurrenceNumber')::smallint
      ) then continue; end if;

      if not private.agenda_v2_is_available(
        v_series.psychologist_id, v_start, v_end, v_series.availability_version_id
      ) or exists (
        select 1 from public.appointments conflict
        where conflict.user_id = v_series.psychologist_id
          and conflict.start_time is not null
          and conflict.end_time is not null
          and lower(coalesce(conflict.status, '')) not in ('cancelled', 'canceled')
          and conflict.lifecycle_status <> 'cancelled'
          and tstzrange(conflict.start_time, conflict.end_time, '[)')
            && tstzrange(v_start, v_end, '[)')
      ) or exists (
        select 1 from public.appointment_slot_holds hold
        where hold.professional_id = v_series.psychologist_id
          and hold.status = 'active'
          and hold.expires_at > now()
          and tstzrange(hold.starts_at, hold.ends_at, '[)')
            && tstzrange(v_start, v_end, '[)')
      ) then
        insert into public.appointment_series_materialization_conflicts (
          professional_id,
          series_id,
          occurrence_number,
          proposed_start_time,
          proposed_end_time,
          reason_code,
          safe_details
        ) values (
          v_series.psychologist_id,
          v_series.id,
          (v_occurrence ->> 'occurrenceNumber')::integer,
          v_start,
          v_end,
          'schedule_conflict',
          jsonb_build_object('requiresConfirmation', true)
        ) on conflict do nothing;
        v_conflicts := v_conflicts + 1;
        continue;
      end if;

      if v_package_id is not null and coalesce(v_available_package_sessions, 0) <= 0 then
        insert into public.appointment_series_materialization_conflicts (
          professional_id,
          series_id,
          occurrence_number,
          proposed_start_time,
          proposed_end_time,
          reason_code,
          safe_details
        ) values (
          v_series.psychologist_id,
          v_series.id,
          (v_occurrence ->> 'occurrenceNumber')::integer,
          v_start,
          v_end,
          'package_capacity',
          jsonb_build_object('requiresFinancialReview', true)
        ) on conflict do nothing;
        v_conflicts := v_conflicts + 1;
        continue;
      end if;

      insert into public.appointments (
        user_id,
        patient_id,
        start_time,
        end_time,
        type,
        status,
        notes,
        location,
        metadata,
        lifecycle_status,
        created_by,
        updated_by,
        action_origin,
        last_actor_type,
        audit_metadata,
        series_id,
        occurrence_number,
        occurrence_count,
        occurrence_status,
        personalized_fields,
        series_revision
      ) values (
        v_series.psychologist_id,
        v_series.patient_id,
        v_start,
        v_end,
        v_series.appointment_type,
        'unscored',
        nullif(v_series.default_config ->> 'notes', ''),
        nullif(v_series.default_config ->> 'location', ''),
        coalesce(v_series.default_config -> 'metadata', '{}'::jsonb),
        'created',
        v_series.psychologist_id,
        v_series.psychologist_id,
        'system',
        'system',
        jsonb_build_object(
          'seriesId', v_series.id,
          'occurrenceNumber', v_occurrence -> 'occurrenceNumber',
          'materializedAutomatically', true
        ),
        v_series.id,
        (v_occurrence ->> 'occurrenceNumber')::smallint,
        null,
        coalesce(v_occurrence ->> 'occurrenceStatus', 'standard'),
        array(select jsonb_array_elements_text(coalesce(v_occurrence -> 'changedFields', '[]'::jsonb))),
        v_series.revision
      ) returning id into v_appointment_id;
      v_new_ids := array_append(v_new_ids, v_appointment_id);
      v_materialized := v_materialized + 1;
      if v_package_id is not null then
        v_available_package_sessions := v_available_package_sessions - 1;
      end if;
    end loop;

    if v_package_id is not null and cardinality(v_new_ids) > 0 then
      perform private.reserve_package_appointments(
        v_series.psychologist_id,
        v_series.patient_id,
        v_package_id,
        v_new_ids,
        'system',
        'open-series:' || v_series.id::text || ':' || current_date::text,
        v_series.psychologist_id
      );
    elsif v_series.financial_snapshot ->> 'mode' = 'manual'
      and coalesce((v_series.financial_snapshot ->> 'value_per_session')::numeric, 0) > 0
      and cardinality(v_new_ids) > 0
    then
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
        'Lançamento de recorrência aberta',
        (v_series.financial_snapshot ->> 'value_per_session')::numeric,
        appointment.start_time::date,
        appointment.start_time::date,
        'pending',
        coalesce(v_series.financial_snapshot ->> 'payment_method', 'manual'),
        'appointment',
        'open-series:' || v_series.id::text || ':appointment:' || appointment.id::text,
        jsonb_build_object('source', 'open_series_materializer')
      from public.appointments appointment
      where appointment.id = any(v_new_ids)
      on conflict (professional_id, idempotency_key)
        where idempotency_key is not null
      do nothing;
    end if;

    update public.appointment_series
    set materialized_through = (
          (v_occurrences -> (jsonb_array_length(v_occurrences) - 1) ->> 'startTime')::timestamptz
          at time zone v_series.timezone
        )::date,
        next_generation_at = now() + interval '1 day',
        updated_at = now()
    where id = v_series.id;
  end loop;

  return jsonb_build_object(
    'processedSeries', v_processed,
    'materializedOccurrences', v_materialized,
    'reviewRequired', v_conflicts
  );
end;
$$;

revoke all on function private.materialize_open_appointment_series(integer)
  from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'materialize-open-appointment-series';
    perform cron.schedule(
      'materialize-open-appointment-series',
      '17 2 * * *',
      'select private.materialize_open_appointment_series(100)'
    );
  end if;
end
$$;
