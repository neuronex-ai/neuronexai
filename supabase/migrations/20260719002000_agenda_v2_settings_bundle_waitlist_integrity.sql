-- Close the indirect consistency gaps between scheduled availability,
-- waitlist rules and commercial-policy edits made in the same UI save.

create or replace function private.validate_professional_waitlist_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.preferred_duration_minutes < new.minimum_duration_minutes then
    raise exception 'A duração preferida precisa ser igual ou maior que a mínima.' using errcode = '22023';
  end if;
  if new.valid_until is not null and new.valid_until < new.valid_from then
    raise exception 'A data final precisa ser igual ou posterior à inicial.' using errcode = '22023';
  end if;
  if new.status in ('active', 'paused', 'offered') and exists (
    select 1
    from public.professional_waitlist_entries existing
    where existing.professional_id = new.professional_id
      and existing.patient_id = new.patient_id
      and existing.status in ('active', 'paused', 'offered')
      and existing.id <> new.id
  ) then
    raise exception 'Este paciente já possui uma espera ativa. Edite a regra existente.' using errcode = '23505';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_professional_waitlist_entry()
  from public, anon, authenticated;

drop trigger if exists agenda_v2_validate_waitlist_entry on public.professional_waitlist_entries;
create trigger agenda_v2_validate_waitlist_entry
before insert or update of patient_id, status, valid_from, valid_until,
  minimum_duration_minutes, preferred_duration_minutes
on public.professional_waitlist_entries
for each row execute function private.validate_professional_waitlist_entry();

create unique index if not exists professional_waitlist_one_open_entry_idx
  on public.professional_waitlist_entries (professional_id, patient_id)
  where status in ('active', 'paused', 'offered');

create or replace function private.defer_waitlist_availability_activation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_effective_from timestamptz;
  v_status text;
begin
  if new.availability_version_id is not distinct from old.availability_version_id
    or new.availability_version_id is null
  then
    return new;
  end if;

  select version.effective_from, version.status
  into v_effective_from, v_status
  from public.professional_availability_versions version
  where version.id = new.availability_version_id
    and version.professional_id = new.professional_id;

  if found and v_status = 'scheduled' and v_effective_from > now() then
    new.rules_snapshot := coalesce(new.rules_snapshot, '{}'::jsonb) || jsonb_build_object(
      'pendingAvailabilityVersionId', new.availability_version_id,
      'pendingAvailabilityEffectiveFrom', v_effective_from
    );
    new.availability_version_id := old.availability_version_id;
  end if;
  return new;
end;
$$;

revoke all on function private.defer_waitlist_availability_activation()
  from public, anon, authenticated;

drop trigger if exists agenda_v2_defer_waitlist_availability on public.professional_waitlist_entries;
create trigger agenda_v2_defer_waitlist_availability
before update of availability_version_id on public.professional_waitlist_entries
for each row execute function private.defer_waitlist_availability_activation();

create or replace function private.activate_due_professional_availability_versions()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_due record;
  v_activated integer := 0;
  v_legacy jsonb;
  v_day integer;
  v_day_window jsonb;
begin
  for v_due in
    select distinct on (version.professional_id)
      version.id,
      version.professional_id,
      version.version_number
    from public.professional_availability_versions version
    where version.status = 'scheduled'
      and version.effective_from <= now()
    order by version.professional_id, version.effective_from desc, version.version_number desc
  loop
    perform pg_advisory_xact_lock(hashtextextended('availability:' || v_due.professional_id::text, 0));

    update public.professional_availability_versions version
    set status = 'superseded'
    where version.professional_id = v_due.professional_id
      and version.id <> v_due.id
      and (
        version.status = 'active'
        or (version.status = 'scheduled' and version.effective_from <= now())
      );

    update public.professional_availability_versions
    set status = 'active'
    where id = v_due.id and status = 'scheduled';
    if not found then continue; end if;

    update public.professional_waitlist_entries entry
    set availability_version_id = v_due.id,
        rules_snapshot = coalesce(entry.rules_snapshot, '{}'::jsonb)
          - 'pendingAvailabilityVersionId'
          - 'pendingAvailabilityEffectiveFrom',
        updated_at = now()
    where entry.professional_id = v_due.professional_id
      and entry.status in ('active', 'paused', 'offered')
      and entry.rules_snapshot ->> 'pendingAvailabilityVersionId' = v_due.id::text;

    v_legacy := '{}'::jsonb;
    for v_day in 0..6 loop
      select jsonb_build_object(
        'enabled', count(*) > 0,
        'start', coalesce(min(availability_window.start_time)::text, '08:00:00'),
        'end', coalesce(max(availability_window.end_time)::text, '19:00:00')
      )
      into v_day_window
      from public.professional_availability_windows availability_window
      where availability_window.availability_version_id = v_due.id
        and availability_window.weekday = v_day;
      v_legacy := v_legacy || jsonb_build_object(v_day::text, v_day_window);
    end loop;

    update public.profiles
    set working_hours = v_legacy, updated_at = now()
    where id = v_due.professional_id;
    v_activated := v_activated + 1;
  end loop;

  return jsonb_build_object('success', true, 'activatedCount', v_activated);
end;
$$;

revoke all on function private.activate_due_professional_availability_versions()
  from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'agenda-v2-activate-availability';
    perform cron.schedule(
      'agenda-v2-activate-availability',
      '* * * * *',
      'select private.activate_due_professional_availability_versions();'
    );
  end if;
end;
$$;

create or replace function private.match_professional_waitlist_slot(
  p_professional_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_modality text default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'entryId', candidate.entry_id,
    'patientId', candidate.patient_id,
    'patientName', candidate.patient_name,
    'priority', candidate.priority,
    'minimumDurationMinutes', candidate.minimum_duration_minutes,
    'preferredDurationMinutes', candidate.preferred_duration_minutes,
    'waitingSince', candidate.created_at,
    'offerCount', candidate.offer_count
  ) order by candidate.priority, candidate.created_at, candidate.offer_count), '[]'::jsonb)
  from (
    select
      entry.id as entry_id,
      entry.patient_id,
      patient.name as patient_name,
      entry.priority,
      entry.minimum_duration_minutes,
      entry.preferred_duration_minutes,
      entry.created_at,
      entry.offer_count
    from public.professional_waitlist_entries entry
    join public.patients patient
      on patient.id = entry.patient_id
     and patient.user_id = entry.professional_id
    where entry.professional_id = p_professional_id
      and entry.status = 'active'
      and entry.valid_from <= (p_starts_at at time zone 'America/Sao_Paulo')::date
      and (entry.valid_until is null or entry.valid_until >= (p_starts_at at time zone 'America/Sao_Paulo')::date)
      and extract(epoch from (p_ends_at - p_starts_at)) / 60 >= entry.minimum_duration_minutes
      and (entry.modality is null or p_modality is null or entry.modality = p_modality)
      and private.agenda_v2_is_available(
        p_professional_id,
        p_starts_at,
        p_ends_at,
        entry.availability_version_id
      )
      and (
        not exists (
          select 1 from public.professional_waitlist_windows configured
          where configured.waitlist_entry_id = entry.id
        )
        or exists (
          select 1 from public.professional_waitlist_windows wait_window
          where wait_window.waitlist_entry_id = entry.id
            and (
              wait_window.specific_date = (p_starts_at at time zone 'America/Sao_Paulo')::date
              or wait_window.weekday = extract(dow from p_starts_at at time zone 'America/Sao_Paulo')::smallint
            )
            and wait_window.start_time <= (p_starts_at at time zone 'America/Sao_Paulo')::time
            and wait_window.end_time >= (p_ends_at at time zone 'America/Sao_Paulo')::time
        )
      )
    order by entry.priority, entry.created_at, entry.offer_count
    limit 100
  ) candidate;
$$;

revoke all on function private.match_professional_waitlist_slot(uuid, timestamptz, timestamptz, text)
  from public, anon, authenticated;

create or replace function public.save_agenda_settings_bundle(
  p_availability jsonb default null,
  p_policy jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_availability jsonb;
  v_policy jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_availability is null and p_policy is null then
    raise exception 'Nenhuma alteração foi informada.' using errcode = '22023';
  end if;

  if p_availability is not null then
    v_availability := public.save_professional_availability(
      coalesce(p_availability -> 'windows', '[]'::jsonb),
      (p_availability ->> 'effective_from')::timestamptz,
      p_availability ->> 'strategy',
      coalesce(p_availability ->> 'waitlist_strategy', 'migrate_all'),
      case when jsonb_typeof(p_availability -> 'waitlist_entry_ids') = 'array' then
        array(select jsonb_array_elements_text(p_availability -> 'waitlist_entry_ids')::uuid)
      else null end,
      coalesce(nullif(p_availability ->> 'timezone', ''), 'America/Sao_Paulo'),
      p_availability ->> 'reason'
    );
  end if;

  if p_policy is not null then
    v_policy := public.create_appointment_policy_version(
      (p_policy ->> 'free_cancellation_hours')::numeric,
      (p_policy ->> 'free_reschedule_hours')::numeric,
      (p_policy ->> 'minimum_patient_reaction_hours')::numeric,
      (p_policy ->> 'professional_response_sla_hours')::numeric,
      p_policy ->> 'late_cancellation_consequence',
      p_policy ->> 'no_show_consequence',
      p_policy ->> 'package_credit_policy',
      p_policy ->> 'charge_policy',
      p_policy ->> 'fiscal_policy',
      coalesce(nullif(p_policy ->> 'timezone', ''), 'America/Sao_Paulo'),
      nullif(p_policy ->> 'effective_at', '')::timestamptz,
      p_policy ->> 'reason',
      p_policy ->> 'idempotency_key'
    );
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'success', true,
    'availability', v_availability,
    'policy', v_policy
  ));
end;
$$;

revoke all on function public.save_agenda_settings_bundle(jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_agenda_settings_bundle(jsonb, jsonb)
  to authenticated;
