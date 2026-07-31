-- Keep protected appointment fields database-owned while allowing the
-- canonical Agenda V2 executor to perform its own trusted writes. Also make
-- an occurrence removed in the review step part of the immutable plan input,
-- instead of hiding it only in the browser.

-- ---------------------------------------------------------------------------
-- Trusted Agenda V2 execution context
-- ---------------------------------------------------------------------------

alter function public.execute_agenda_action_plan(uuid, integer, text, text)
  rename to execute_agenda_action_plan_20260730;

revoke all on function public.execute_agenda_action_plan_20260730(
  uuid, integer, text, text
) from public, anon, authenticated, service_role;

create function public.execute_agenda_action_plan(
  p_plan_id uuid,
  p_plan_version integer,
  p_plan_hash text,
  p_confirmation_channel text default 'professional_app'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Transaction-local and reachable only through this ownership-checked RPC.
  -- The database-owned-field trigger remains active for direct table writes.
  perform set_config(
    'neuronex.appointment_command',
    'appointment_action_plan',
    true
  );

  return public.execute_agenda_action_plan_20260730(
    p_plan_id,
    p_plan_version,
    p_plan_hash,
    p_confirmation_channel
  );
end;
$$;

revoke all on function public.execute_agenda_action_plan(
  uuid, integer, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.execute_agenda_action_plan(
  uuid, integer, text, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- Canonical occurrence exclusions
-- ---------------------------------------------------------------------------

alter function private.generate_agenda_v2_occurrences(uuid, jsonb)
  rename to generate_agenda_v2_occurrences_20260730;

revoke all on function private.generate_agenda_v2_occurrences_20260730(
  uuid, jsonb
) from public, anon, authenticated, service_role;

create function private.generate_agenda_v2_occurrences(
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
  v_input jsonb := coalesce(p_input, '{}'::jsonb);
  v_raw_excluded jsonb;
  v_excluded integer[] := '{}';
  v_generated jsonb;
  v_result jsonb;
begin
  v_raw_excluded := coalesce(
    v_input -> 'excluded_occurrence_numbers',
    v_input #> '{default_config,excluded_occurrence_numbers}',
    '[]'::jsonb
  );

  if jsonb_typeof(v_raw_excluded) <> 'array' then
    raise exception 'A lista de sessões removidas é inválida.'
      using errcode = '22023';
  end if;

  begin
    select coalesce(array_agg(distinct excluded_number order by excluded_number), '{}')
    into v_excluded
    from (
      select value::integer as excluded_number
      from jsonb_array_elements_text(v_raw_excluded)
    ) excluded
    where excluded_number between 1 and 32767;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'A lista de sessões removidas é inválida.'
        using errcode = '22023';
  end;

  if exists (
    select 1
    from jsonb_array_elements_text(v_raw_excluded) item
    where item.value !~ '^[1-9][0-9]{0,4}$'
       or item.value::integer not between 1 and 32767
  ) then
    raise exception 'A lista de sessões removidas é inválida.'
      using errcode = '22023';
  end if;

  if v_input #>> '{recurrence_rule,termination,kind}' = 'open'
    and 1 = any(v_excluded)
  then
    raise exception
      'Em uma série sem data final, mantenha a primeira sessão e ajuste sua data ou horário.'
      using errcode = '22023';
  end if;

  v_generated := private.generate_agenda_v2_occurrences_20260730(
    p_professional_id,
    v_input
  );

  with kept as (
    select
      occurrence.value,
      occurrence.ordinality,
      (occurrence.value ->> 'occurrenceNumber')::integer
        as original_occurrence_number
    from jsonb_array_elements(v_generated)
      with ordinality occurrence(value, ordinality)
    where not (
      (occurrence.value ->> 'occurrenceNumber')::integer = any(v_excluded)
    )
  ),
  renumbered as (
    select
      kept.value,
      kept.ordinality,
      kept.original_occurrence_number,
      row_number() over (order by kept.ordinality)::integer
        as occurrence_number
    from kept
  )
  select coalesce(
    jsonb_agg(
      (renumbered.value - 'occurrenceNumber')
        || jsonb_build_object(
          'occurrenceNumber', renumbered.occurrence_number,
          'originalOccurrenceNumber', renumbered.original_occurrence_number
        )
      order by renumbered.ordinality
    ),
    '[]'::jsonb
  )
  into v_result
  from renumbered;

  if jsonb_array_length(v_result) = 0 then
    raise exception 'Mantenha pelo menos uma sessão na recorrência.'
      using errcode = '22023';
  end if;

  return v_result;
end;
$$;

revoke all on function private.generate_agenda_v2_occurrences(
  uuid, jsonb
) from public, anon, authenticated, service_role;

-- Persist the exclusion snapshot for future materializations of open series.
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
    'overrides', coalesce(v_input -> 'overrides', '[]'::jsonb),
    'excluded_occurrence_numbers',
      coalesce(v_input -> 'excluded_occurrence_numbers', '[]'::jsonb)
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

comment on function public.execute_agenda_action_plan(
  uuid, integer, text, text
) is
  'Ownership-checked Agenda V2 execution entrypoint. Opens a transaction-local trusted context for database-owned appointment fields.';

comment on function private.generate_agenda_v2_occurrences(uuid, jsonb) is
  'Generates Agenda V2 occurrences, applies approved overrides, removes explicitly excluded occurrences, and returns contiguous display numbers.';
