-- Agenda v2: transactional waitlist commands, public offer reader and
-- smart-fit suggestions for occurrences that have not been materialized yet.

create or replace function public.upsert_professional_waitlist_entry(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_professional_id uuid := auth.uid();
  v_entry public.professional_waitlist_entries%rowtype;
  v_entry_id uuid := nullif(p_input ->> 'id', '')::uuid;
  v_patient_id uuid := nullif(p_input ->> 'patient_id', '')::uuid;
  v_window jsonb;
begin
  if v_professional_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.patients patient
    where patient.id = v_patient_id and patient.user_id = v_professional_id
  ) then
    raise exception 'Paciente não encontrado.' using errcode = 'P0002';
  end if;

  if v_entry_id is null then
    insert into public.professional_waitlist_entries (
      professional_id, patient_id, availability_version_id, status, priority,
      valid_from, valid_until, minimum_duration_minutes, preferred_duration_minutes,
      modality, location, offer_automatically, rules_snapshot, created_by
    ) values (
      v_professional_id,
      v_patient_id,
      private.agenda_v2_availability_version(v_professional_id, now()),
      'active',
      least(greatest(coalesce((p_input ->> 'priority')::integer, 3), 1), 5),
      coalesce(nullif(p_input ->> 'valid_from', '')::date, current_date),
      nullif(p_input ->> 'valid_until', '')::date,
      least(greatest(coalesce((p_input ->> 'minimum_duration_minutes')::integer, 50), 15), 1440),
      least(greatest(coalesce((p_input ->> 'preferred_duration_minutes')::integer, 50), 15), 1440),
      case when p_input ->> 'modality' in ('presencial', 'online') then p_input ->> 'modality' else null end,
      nullif(btrim(p_input ->> 'location'), ''),
      coalesce((p_input ->> 'offer_automatically')::boolean, true),
      coalesce(p_input -> 'rules_snapshot', '{}'::jsonb),
      v_professional_id
    ) returning * into v_entry;
  else
    select entry.* into v_entry
    from public.professional_waitlist_entries entry
    where entry.id = v_entry_id and entry.professional_id = v_professional_id
    for update;
    if not found then raise exception 'Entrada não encontrada.' using errcode = 'P0002'; end if;

    update public.professional_waitlist_entries entry
    set patient_id = v_patient_id,
        priority = least(greatest(coalesce((p_input ->> 'priority')::integer, entry.priority), 1), 5),
        valid_from = coalesce(nullif(p_input ->> 'valid_from', '')::date, entry.valid_from),
        valid_until = case when p_input ? 'valid_until' then nullif(p_input ->> 'valid_until', '')::date else entry.valid_until end,
        minimum_duration_minutes = least(greatest(coalesce((p_input ->> 'minimum_duration_minutes')::integer, entry.minimum_duration_minutes), 15), 1440),
        preferred_duration_minutes = least(greatest(coalesce((p_input ->> 'preferred_duration_minutes')::integer, entry.preferred_duration_minutes), 15), 1440),
        modality = case when p_input ->> 'modality' in ('presencial', 'online') then p_input ->> 'modality' else null end,
        location = nullif(btrim(p_input ->> 'location'), ''),
        offer_automatically = coalesce((p_input ->> 'offer_automatically')::boolean, entry.offer_automatically),
        rules_snapshot = coalesce(p_input -> 'rules_snapshot', entry.rules_snapshot),
        updated_at = now()
    where entry.id = v_entry_id
    returning entry.* into v_entry;
  end if;

  if v_entry.preferred_duration_minutes < v_entry.minimum_duration_minutes then
    raise exception 'A duração preferida precisa ser igual ou maior que a mínima.' using errcode = '22023';
  end if;
  if v_entry.valid_until is not null and v_entry.valid_until < v_entry.valid_from then
    raise exception 'A data final precisa ser igual ou posterior à inicial.' using errcode = '22023';
  end if;

  delete from public.professional_waitlist_windows
  where waitlist_entry_id = v_entry.id and professional_id = v_professional_id;

  for v_window in select value from jsonb_array_elements(coalesce(p_input -> 'windows', '[]'::jsonb))
  loop
    insert into public.professional_waitlist_windows (
      waitlist_entry_id, professional_id, weekday, specific_date, start_time, end_time
    ) values (
      v_entry.id,
      v_professional_id,
      nullif(v_window ->> 'weekday', '')::smallint,
      nullif(v_window ->> 'specific_date', '')::date,
      (v_window ->> 'start_time')::time,
      (v_window ->> 'end_time')::time
    );
  end loop;

  insert into public.professional_waitlist_events (
    professional_id, waitlist_entry_id, event_type, actor_type, safe_metadata
  ) values (
    v_professional_id, v_entry.id,
    case when v_entry_id is null then 'entry_created' else 'entry_updated' end,
    'professional',
    jsonb_build_object('priority', v_entry.priority, 'automaticOffer', v_entry.offer_automatically)
  );

  return jsonb_build_object('success', true, 'entryId', v_entry.id, 'status', v_entry.status);
end;
$$;

create or replace function public.set_professional_waitlist_entry_status(
  p_entry_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_professional_id uuid := auth.uid();
  v_status text := lower(coalesce(p_status, ''));
begin
  if v_professional_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if v_status not in ('active', 'paused', 'removed') then
    raise exception 'Status inválido.' using errcode = '22023';
  end if;
  update public.professional_waitlist_entries
  set status = v_status, updated_at = now()
  where id = p_entry_id and professional_id = v_professional_id;
  if not found then raise exception 'Entrada não encontrada.' using errcode = 'P0002'; end if;

  if v_status = 'removed' then
    update public.appointment_slot_holds
    set status = 'released', released_at = now()
    where waitlist_entry_id = p_entry_id and professional_id = v_professional_id and status = 'active';
    update public.professional_waitlist_offers
    set status = 'superseded', responded_at = now()
    where waitlist_entry_id = p_entry_id and professional_id = v_professional_id and status = 'pending';
  end if;

  insert into public.professional_waitlist_events (
    professional_id, waitlist_entry_id, event_type, actor_type, safe_metadata
  ) values (
    v_professional_id, p_entry_id, 'entry_status_changed', 'professional', jsonb_build_object('status', v_status)
  );
  return jsonb_build_object('success', true, 'entryId', p_entry_id, 'status', v_status);
end;
$$;

create or replace function public.get_waitlist_offer(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_offer public.professional_waitlist_offers%rowtype;
  v_patient_name text;
  v_professional_name text;
  v_clinic_name text;
  v_modality text;
begin
  if p_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('found', false);
  end if;
  select offer.* into v_offer
  from public.professional_waitlist_offers offer
  where offer.token_hash = encode(digest(p_token, 'sha256'), 'hex');
  if not found then return jsonb_build_object('found', false); end if;

  select split_part(btrim(patient.name), ' ', 1) into v_patient_name
  from public.patients patient where patient.id = v_offer.patient_id;
  select
    coalesce(nullif(btrim(profile.full_name), ''), nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''), nullif(btrim(profile.name), ''), 'Seu profissional'),
    nullif(btrim(profile.clinic_name), '')
  into v_professional_name, v_clinic_name
  from public.profiles profile where profile.id = v_offer.professional_id;
  select entry.modality into v_modality
  from public.professional_waitlist_entries entry where entry.id = v_offer.waitlist_entry_id;

  return jsonb_build_object(
    'found', true,
    'status', case when v_offer.status = 'pending' and v_offer.expires_at <= now() then 'expired' else v_offer.status end,
    'patientFirstName', v_patient_name,
    'professionalName', v_professional_name,
    'clinicName', v_clinic_name,
    'modality', v_modality,
    'startsAt', v_offer.offered_start_time,
    'endsAt', v_offer.offered_end_time,
    'expiresAt', v_offer.expires_at
  );
end;
$$;

create or replace function public.suggest_agenda_plan_smart_fit(
  p_input jsonb,
  p_occurrence_number integer,
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
  v_preview jsonb;
  v_occurrence jsonb;
  v_original_start timestamptz;
  v_original_end timestamptz;
  v_duration integer;
  v_result jsonb;
begin
  if v_professional_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  v_preview := private.preview_agenda_v2_plan(v_professional_id, p_input);
  select item.value into v_occurrence
  from jsonb_array_elements(v_preview -> 'occurrences') item
  where (item.value ->> 'occurrenceNumber')::integer = p_occurrence_number;
  if v_occurrence is null then raise exception 'Sessão não encontrada na recorrência.' using errcode = 'P0002'; end if;
  v_original_start := (v_occurrence ->> 'startTime')::timestamptz;
  v_original_end := (v_occurrence ->> 'endTime')::timestamptz;
  v_duration := (v_occurrence ->> 'durationMinutes')::integer;

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
      case when slot::date = v_original_start::date then 0 else 1 end as date_penalty,
      case when extract(dow from slot) = extract(dow from v_original_start) then 0 else 1 end as weekday_penalty,
      abs(extract(epoch from (slot - v_original_start))) as distance_seconds
    from durations duration
    cross join lateral generate_series(
      greatest(date_trunc('day', now()), date_trunc('day', v_original_start - make_interval(days => least(greatest(p_search_days, 1), 60)))),
      date_trunc('day', v_original_start + make_interval(days => least(greatest(p_search_days, 1), 60))) + interval '23 hours 50 minutes',
      interval '10 minutes'
    ) slot
    where slot > now()
      and private.agenda_v2_is_available(v_professional_id, slot, slot + make_interval(mins => duration.minutes), null)
      and not exists (
        select 1 from public.appointments conflict
        where conflict.user_id = v_professional_id
          and conflict.start_time is not null and conflict.end_time is not null
          and lower(coalesce(conflict.status, '')) not in ('cancelled', 'canceled')
          and conflict.lifecycle_status <> 'cancelled'
          and tstzrange(conflict.start_time, conflict.end_time, '[)')
            && tstzrange(slot, slot + make_interval(mins => duration.minutes), '[)')
      )
      and not exists (
        select 1 from public.appointment_slot_holds hold
        where hold.professional_id = v_professional_id and hold.status = 'active' and hold.expires_at > now()
          and tstzrange(hold.starts_at, hold.ends_at, '[)')
            && tstzrange(slot, slot + make_interval(mins => duration.minutes), '[)')
      )
      and not exists (
        select 1 from jsonb_array_elements(v_preview -> 'occurrences') sibling
        where (sibling.value ->> 'occurrenceNumber')::integer <> p_occurrence_number
          and tstzrange((sibling.value ->> 'startTime')::timestamptz, (sibling.value ->> 'endTime')::timestamptz, '[)')
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
    'distanceMinutes', round(ranked.distance_seconds / 60)
  ) order by ranked.duration_penalty, ranked.date_penalty, ranked.weekday_penalty, ranked.distance_seconds), '[]'::jsonb)
  into v_result from ranked;

  return jsonb_build_object(
    'occurrenceNumber', p_occurrence_number,
    'originalStartTime', v_original_start,
    'originalEndTime', v_original_end,
    'requiresConfirmation', true,
    'candidates', v_result
  );
end;
$$;

revoke all on function public.upsert_professional_waitlist_entry(jsonb) from public, anon, authenticated;
revoke all on function public.set_professional_waitlist_entry_status(uuid, text) from public, anon, authenticated;
revoke all on function public.get_waitlist_offer(text) from public, anon, authenticated;
revoke all on function public.suggest_agenda_plan_smart_fit(jsonb, integer, integer, boolean, integer) from public, anon, authenticated;
grant execute on function public.upsert_professional_waitlist_entry(jsonb) to authenticated;
grant execute on function public.set_professional_waitlist_entry_status(uuid, text) to authenticated;
grant execute on function public.get_waitlist_offer(text) to anon, authenticated;
grant execute on function public.suggest_agenda_plan_smart_fit(jsonb, integer, integer, boolean, integer) to authenticated;
