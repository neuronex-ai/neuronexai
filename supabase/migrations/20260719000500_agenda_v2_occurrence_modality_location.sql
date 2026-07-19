-- Ensure occurrence-level modality/location overrides affect the operational
-- appointment, not only the immutable plan metadata.

create or replace function private.apply_agenda_v2_occurrence_override()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_id uuid;
  v_plan_version integer;
  v_override jsonb;
begin
  if new.series_id is null or new.occurrence_number is null then
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

  select item.value
  into v_override
  from public.appointment_action_plans plan
  cross join lateral jsonb_array_elements(
    coalesce(plan.immutable_snapshot #> '{agenda,input,overrides}', '[]'::jsonb)
  ) item
  where plan.plan_id = v_plan_id
    and plan.plan_version = v_plan_version
    and plan.professional_id = new.user_id
    and (item.value ->> 'occurrence_number')::integer = new.occurrence_number
  limit 1;

  if v_override is null then
    return new;
  end if;

  if v_override ? 'modality' then
    if v_override ->> 'modality' not in ('presencial', 'online', 'block') then
      raise exception 'Modalidade personalizada inválida.' using errcode = '22023';
    end if;
    new.type := v_override ->> 'modality';
  end if;

  if v_override ? 'location' then
    new.location := nullif(btrim(v_override ->> 'location'), '');
  end if;

  new.audit_metadata := coalesce(new.audit_metadata, '{}'::jsonb) || jsonb_build_object(
    'occurrenceOverride', jsonb_strip_nulls(jsonb_build_object(
      'modality', v_override ->> 'modality',
      'location', v_override ->> 'location',
      'source', coalesce(v_override ->> 'source', 'professional'),
      'reason', v_override ->> 'reason'
    ))
  );
  return new;
end;
$$;

revoke all on function private.apply_agenda_v2_occurrence_override()
  from public, anon, authenticated;

drop trigger if exists agenda_v2_apply_occurrence_override on public.appointments;
create trigger agenda_v2_apply_occurrence_override
before insert on public.appointments
for each row
execute function private.apply_agenda_v2_occurrence_override();

-- Safe idempotent backfill for plans executed before this trigger existed.
with occurrence_overrides as (
  select
    appointment.id as appointment_id,
    item.value as override_value
  from public.appointments appointment
  join public.appointment_action_plans plan
    on plan.plan_id = nullif(appointment.audit_metadata ->> 'planId', '')::uuid
   and plan.plan_version = nullif(appointment.audit_metadata ->> 'planVersion', '')::integer
   and plan.professional_id = appointment.user_id
  cross join lateral jsonb_array_elements(
    coalesce(plan.immutable_snapshot #> '{agenda,input,overrides}', '[]'::jsonb)
  ) item
  where appointment.series_id is not null
    and appointment.occurrence_number is not null
    and (item.value ->> 'occurrence_number')::integer = appointment.occurrence_number
)
update public.appointments appointment
set type = case
      when occurrence_overrides.override_value ? 'modality'
        then occurrence_overrides.override_value ->> 'modality'
      else appointment.type
    end,
    location = case
      when occurrence_overrides.override_value ? 'location'
        then nullif(btrim(occurrence_overrides.override_value ->> 'location'), '')
      else appointment.location
    end,
    audit_metadata = coalesce(appointment.audit_metadata, '{}'::jsonb) || jsonb_build_object(
      'occurrenceOverride', jsonb_strip_nulls(jsonb_build_object(
        'modality', occurrence_overrides.override_value ->> 'modality',
        'location', occurrence_overrides.override_value ->> 'location',
        'source', coalesce(occurrence_overrides.override_value ->> 'source', 'professional'),
        'reason', occurrence_overrides.override_value ->> 'reason'
      ))
    )
from occurrence_overrides
where appointment.id = occurrence_overrides.appointment_id
  and (
    occurrence_overrides.override_value ? 'modality'
    or occurrence_overrides.override_value ? 'location'
  );
