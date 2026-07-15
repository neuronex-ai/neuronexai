-- Transactional appointment series (Cloud version 20260715080146).
-- The legacy recurring_appointments table is intentionally left untouched.

create schema if not exists private;

create table if not exists public.appointment_series (
  id uuid primary key default gen_random_uuid(),
  psychologist_id uuid not null references public.profiles(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly')),
  total_occurrences smallint not null check (total_occurrences between 2 and 20),
  first_start_time timestamptz not null,
  last_start_time timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 15 and 1440),
  appointment_type text not null check (appointment_type in ('presencial', 'online', 'block')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_series_chronology_check check (last_start_time >= first_start_time)
);

comment on table public.appointment_series is
  'Canonical recurrence series. Every generated appointment remains an independent appointment row.';
comment on column public.appointment_series.total_occurrences is
  'Exact total count requested by the professional; it includes the first appointment.';

alter table public.appointments
  add column if not exists series_id uuid references public.appointment_series(id) on delete set null,
  add column if not exists occurrence_number smallint,
  add column if not exists occurrence_count smallint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.appointments'::regclass
      and conname = 'appointments_occurrence_shape_check'
  ) then
    alter table public.appointments
      add constraint appointments_occurrence_shape_check check (
        (
          series_id is null
          and occurrence_number is null
          and occurrence_count is null
        )
        or
        (
          series_id is not null
          and occurrence_number is not null
          and occurrence_count is not null
          and occurrence_count between 2 and 20
          and occurrence_number between 1 and occurrence_count
        )
      );
  end if;
end
$$;

create index if not exists appointment_series_psychologist_start_idx
  on public.appointment_series(psychologist_id, first_start_time desc);
create index if not exists appointment_series_patient_start_idx
  on public.appointment_series(patient_id, first_start_time desc)
  where patient_id is not null;
create index if not exists appointments_series_id_idx
  on public.appointments(series_id)
  where series_id is not null;
create unique index if not exists appointments_series_occurrence_uidx
  on public.appointments(series_id, occurrence_number)
  where series_id is not null;

alter table public.appointment_series enable row level security;

drop policy if exists appointment_series_owner_select on public.appointment_series;
create policy appointment_series_owner_select
  on public.appointment_series
  for select
  to authenticated
  using (psychologist_id = (select auth.uid()));

revoke all on table public.appointment_series from public, anon, authenticated;
grant select on table public.appointment_series to authenticated;
grant all on table public.appointment_series to service_role;

create or replace function private.validate_appointment_series(
  p_psychologist_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_frequency text,
  p_occurrence_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_working_hours jsonb;
  v_day_config jsonb;
  v_duration interval;
  v_duration_minutes integer;
  v_occurrence_start timestamptz;
  v_occurrence_end timestamptz;
  v_occurrence jsonb;
  v_occurrences jsonb := '[]'::jsonb;
  v_conflicts jsonb := '[]'::jsonb;
  v_reason_code text;
  v_reason text;
  v_day_key text;
  v_index integer;
  v_last_start_time timestamptz;
begin
  if p_psychologist_id is null then
    raise exception 'Professional is required' using errcode = '22023';
  end if;
  if p_start_time is null or p_end_time is null or p_end_time <= p_start_time then
    raise exception 'Choose a valid start and end time' using errcode = '22023';
  end if;
  if (p_start_time at time zone 'America/Sao_Paulo')::date
    <> (p_end_time at time zone 'America/Sao_Paulo')::date
  then
    raise exception 'Appointments must start and end on the same day' using errcode = '22023';
  end if;
  if p_frequency not in ('single', 'weekly', 'biweekly', 'monthly') then
    raise exception 'Unsupported recurrence frequency' using errcode = '22023';
  end if;
  if p_occurrence_count not between 1 and 20 then
    raise exception 'Occurrence count must be between 1 and 20' using errcode = '22023';
  end if;
  if p_frequency = 'single' and p_occurrence_count <> 1 then
    raise exception 'A single appointment must have exactly one occurrence' using errcode = '22023';
  end if;
  if p_frequency <> 'single' and p_occurrence_count < 2 then
    raise exception 'A recurring series must have at least two occurrences' using errcode = '22023';
  end if;

  v_duration := p_end_time - p_start_time;
  v_duration_minutes := extract(epoch from v_duration)::integer / 60;
  if v_duration_minutes not between 15 and 1440 then
    raise exception 'Appointment duration must be between 15 and 1440 minutes' using errcode = '22023';
  end if;

  select coalesce(profile.working_hours, '{}'::jsonb)
  into v_working_hours
  from public.profiles profile
  where profile.id = p_psychologist_id;

  if not found then
    raise exception 'Professional profile not found' using errcode = 'P0002';
  end if;

  for v_index in 1..p_occurrence_count loop
    v_occurrence_start := case p_frequency
      when 'weekly' then p_start_time + ((v_index - 1) * interval '7 days')
      when 'biweekly' then p_start_time + ((v_index - 1) * interval '14 days')
      when 'monthly' then p_start_time + make_interval(months => v_index - 1)
      else p_start_time
    end;
    v_occurrence_end := v_occurrence_start + v_duration;
    v_last_start_time := v_occurrence_start;
    v_reason_code := null;
    v_reason := null;

    if v_occurrence_start <= now() then
      v_reason_code := 'past_time';
      v_reason := 'A data ou o horário já passou.';
    elsif (v_occurrence_start at time zone 'America/Sao_Paulo')::date
      <> (v_occurrence_end at time zone 'America/Sao_Paulo')::date
    then
      v_reason_code := 'crosses_day';
      v_reason := 'A sessão precisa começar e terminar no mesmo dia.';
    else
      v_day_key := extract(dow from v_occurrence_start at time zone 'America/Sao_Paulo')::integer::text;
      v_day_config := v_working_hours -> v_day_key;

      if not coalesce((v_day_config ->> 'enabled')::boolean, false) then
        v_reason_code := 'outside_working_day';
        v_reason := 'O profissional não atende neste dia.';
      elsif coalesce(v_day_config ->> 'start', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or coalesce(v_day_config ->> 'end', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      then
        v_reason_code := 'invalid_working_hours';
        v_reason := 'A disponibilidade do profissional precisa ser revisada.';
      elsif (v_occurrence_start at time zone 'America/Sao_Paulo')::time < (v_day_config ->> 'start')::time
        or (v_occurrence_end at time zone 'America/Sao_Paulo')::time > (v_day_config ->> 'end')::time
      then
        v_reason_code := 'outside_working_hours';
        v_reason := 'O horário está fora do expediente do profissional.';
      elsif exists (
        select 1
        from public.appointments conflict
        where conflict.user_id = p_psychologist_id
          and conflict.start_time is not null
          and conflict.end_time is not null
          and coalesce(conflict.lifecycle_status, 'created') <> 'cancelled'
          and coalesce(conflict.status, '') not in (
            'cancelled',
            'cancelled_by_patient',
            'cancelled_by_professional'
          )
          and conflict.start_time < v_occurrence_end
          and conflict.end_time > v_occurrence_start
      ) then
        v_reason_code := 'appointment_conflict';
        v_reason := 'Já existe um compromisso neste horário.';
      end if;
    end if;

    v_occurrence := jsonb_build_object(
      'occurrenceNumber', v_index,
      'startTime', v_occurrence_start,
      'endTime', v_occurrence_end,
      'status', case when v_reason_code is null then 'available' else 'conflict' end,
      'reasonCode', v_reason_code,
      'reason', v_reason
    );
    v_occurrences := v_occurrences || jsonb_build_array(v_occurrence);
    if v_reason_code is not null then
      v_conflicts := v_conflicts || jsonb_build_array(v_occurrence);
    end if;
  end loop;

  return jsonb_build_object(
    'valid', jsonb_array_length(v_conflicts) = 0,
    'frequency', p_frequency,
    'totalOccurrences', p_occurrence_count,
    'durationMinutes', v_duration_minutes,
    'firstStartTime', p_start_time,
    'lastStartTime', v_last_start_time,
    'occurrences', v_occurrences,
    'conflicts', v_conflicts
  );
end;
$$;

revoke all on function private.validate_appointment_series(
  uuid,
  timestamptz,
  timestamptz,
  text,
  integer
) from public, anon, authenticated;

create or replace function public.preview_appointment_series(
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_frequency text default 'single',
  p_occurrence_count integer default 1,
  p_psychologist_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_psychologist_id uuid;
begin
  if v_actor_id is not null then
    if p_psychologist_id is not null and p_psychologist_id <> v_actor_id then
      raise exception 'Cannot preview another professional schedule' using errcode = '42501';
    end if;
    v_psychologist_id := v_actor_id;
  elsif v_role = 'service_role' or session_user in ('postgres', 'supabase_admin') then
    v_psychologist_id := p_psychologist_id;
  else
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  return private.validate_appointment_series(
    v_psychologist_id,
    p_start_time,
    p_end_time,
    p_frequency,
    p_occurrence_count
  );
end;
$$;

revoke all on function public.preview_appointment_series(
  timestamptz,
  timestamptz,
  text,
  integer,
  uuid
) from public, anon;
grant execute on function public.preview_appointment_series(
  timestamptz,
  timestamptz,
  text,
  integer,
  uuid
) to authenticated, service_role;

create or replace function private.prevent_appointment_time_conflict()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.start_time is null or new.end_time is null then
    return new;
  end if;
  if new.end_time <= new.start_time then
    raise exception 'appointment_invalid_time_range' using errcode = '22023';
  end if;
  if coalesce(new.lifecycle_status, 'created') = 'cancelled'
    or coalesce(new.status, '') in ('cancelled', 'cancelled_by_patient', 'cancelled_by_professional')
  then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  if exists (
    select 1
    from public.appointments conflict
    where conflict.user_id = new.user_id
      and conflict.id <> new.id
      and conflict.start_time is not null
      and conflict.end_time is not null
      and coalesce(conflict.lifecycle_status, 'created') <> 'cancelled'
      and coalesce(conflict.status, '') not in (
        'cancelled',
        'cancelled_by_patient',
        'cancelled_by_professional'
      )
      and conflict.start_time < new.end_time
      and conflict.end_time > new.start_time
  ) then
    raise exception 'appointment_time_conflict'
      using errcode = '23P01',
      detail = jsonb_build_object(
        'startTime', new.start_time,
        'endTime', new.end_time
      )::text;
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_appointment_time_conflict() from public, anon, authenticated;

drop trigger if exists appointments_prevent_time_conflict on public.appointments;
create trigger appointments_prevent_time_conflict
before insert or update of user_id, start_time, end_time
on public.appointments
for each row
execute function private.prevent_appointment_time_conflict();

create or replace function public.create_appointment_series(
  p_patient_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_frequency text default 'single',
  p_occurrence_count integer default 1,
  p_type text default 'presencial',
  p_notes text default null,
  p_location text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_psychologist_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_psychologist_id uuid;
  v_validation jsonb;
  v_series_id uuid;
  v_appointment public.appointments%rowtype;
  v_appointments jsonb := '[]'::jsonb;
  v_occurrence jsonb;
  v_clean_metadata jsonb;
begin
  if v_actor_id is not null then
    if p_psychologist_id is not null and p_psychologist_id <> v_actor_id then
      raise exception 'Cannot create appointments for another professional' using errcode = '42501';
    end if;
    v_psychologist_id := v_actor_id;
  elsif v_role = 'service_role' or session_user in ('postgres', 'supabase_admin') then
    v_psychologist_id := p_psychologist_id;
  else
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if v_psychologist_id is null then
    raise exception 'Professional is required' using errcode = '22023';
  end if;
  if p_type not in ('presencial', 'online', 'block') then
    raise exception 'Unsupported appointment type' using errcode = '22023';
  end if;
  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'Metadata must be a JSON object' using errcode = '22023';
  end if;
  if p_patient_id is not null and not exists (
    select 1
    from public.patients patient
    where patient.id = p_patient_id
      and patient.user_id = v_psychologist_id
  ) then
    raise exception 'Patient not found for this professional' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_psychologist_id::text, 0));

  v_validation := private.validate_appointment_series(
    v_psychologist_id,
    p_start_time,
    p_end_time,
    p_frequency,
    p_occurrence_count
  );

  if not coalesce((v_validation ->> 'valid')::boolean, false) then
    return jsonb_build_object('success', false) || v_validation;
  end if;

  v_clean_metadata := p_metadata - 'recurrence';

  if p_frequency <> 'single' then
    insert into public.appointment_series (
      psychologist_id,
      patient_id,
      frequency,
      total_occurrences,
      first_start_time,
      last_start_time,
      duration_minutes,
      appointment_type,
      created_by
    ) values (
      v_psychologist_id,
      p_patient_id,
      p_frequency,
      p_occurrence_count,
      (v_validation ->> 'firstStartTime')::timestamptz,
      (v_validation ->> 'lastStartTime')::timestamptz,
      (v_validation ->> 'durationMinutes')::integer,
      p_type,
      v_actor_id
    )
    returning id into v_series_id;
  end if;

  for v_occurrence in
    select value
    from jsonb_array_elements(v_validation -> 'occurrences')
  loop
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
      occurrence_count
    ) values (
      v_psychologist_id,
      p_patient_id,
      (v_occurrence ->> 'startTime')::timestamptz,
      (v_occurrence ->> 'endTime')::timestamptz,
      p_type,
      'unscored',
      nullif(p_notes, ''),
      nullif(p_location, ''),
      v_clean_metadata,
      'created',
      v_actor_id,
      v_actor_id,
      'professional_app',
      'psychologist',
      case when v_series_id is null then '{}'::jsonb else jsonb_build_object(
        'seriesId', v_series_id,
        'occurrenceNumber', (v_occurrence ->> 'occurrenceNumber')::integer,
        'occurrenceCount', p_occurrence_count
      ) end,
      v_series_id,
      case when v_series_id is null then null else (v_occurrence ->> 'occurrenceNumber')::smallint end,
      case when v_series_id is null then null else p_occurrence_count::smallint end
    )
    returning * into v_appointment;

    v_appointments := v_appointments || jsonb_build_array(jsonb_build_object(
      'appointmentId', v_appointment.id,
      'seriesId', v_appointment.series_id,
      'occurrenceNumber', v_appointment.occurrence_number,
      'occurrenceCount', v_appointment.occurrence_count,
      'startTime', v_appointment.start_time,
      'endTime', v_appointment.end_time
    ));
  end loop;

  return jsonb_build_object(
    'success', true,
    'seriesId', v_series_id,
    'frequency', p_frequency,
    'totalOccurrences', p_occurrence_count,
    'appointments', v_appointments,
    'conflicts', '[]'::jsonb
  );
end;
$$;

revoke all on function public.create_appointment_series(
  uuid,
  timestamptz,
  timestamptz,
  text,
  integer,
  text,
  text,
  text,
  jsonb,
  uuid
) from public, anon;
grant execute on function public.create_appointment_series(
  uuid,
  timestamptz,
  timestamptz,
  text,
  integer,
  text,
  text,
  text,
  jsonb,
  uuid
) to authenticated, service_role;

comment on function public.preview_appointment_series(
  timestamptz,
  timestamptz,
  text,
  integer,
  uuid
) is 'Read-only availability preview for every occurrence in a proposed appointment series.';
comment on function public.create_appointment_series(
  uuid,
  timestamptz,
  timestamptz,
  text,
  integer,
  text,
  text,
  text,
  jsonb,
  uuid
) is 'Atomically revalidates and creates one appointment or every occurrence in a recurrence series.';
