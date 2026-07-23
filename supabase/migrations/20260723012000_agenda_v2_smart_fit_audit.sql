-- Preserve the provenance and duration semantics of an individual smart fit.
-- A professional-app edit remains professional; an explicitly Synapse-origin
-- plan is recorded as such and a shortened occurrence is visibly customized.

create or replace function private.capture_series_occurrence_override()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fields text[] := '{}';
  v_source text;
  v_reason text;
  v_old_duration integer;
  v_new_duration integer;
begin
  if old.series_id is null or new.series_id is null then return new; end if;

  v_old_duration := round(extract(epoch from (old.end_time - old.start_time)) / 60)::integer;
  v_new_duration := round(extract(epoch from (new.end_time - new.start_time)) / 60)::integer;

  if old.start_time is distinct from new.start_time then
    v_fields := array_append(v_fields, 'startTime');
  end if;
  if old.end_time is distinct from new.end_time then
    v_fields := array_append(v_fields, 'endTime');
  end if;
  if v_old_duration is distinct from v_new_duration then
    v_fields := array_append(v_fields, 'durationMinutes');
  end if;
  if old.type is distinct from new.type then
    v_fields := array_append(v_fields, 'modality');
  end if;
  if old.location is distinct from new.location then
    v_fields := array_append(v_fields, 'location');
  end if;
  if cardinality(v_fields) = 0 then return new; end if;

  v_source := case
    when new.audit_metadata ->> 'changeSource' = 'availability_change'
      or new.action_origin = 'availability_change'
      then 'availability_change'
    when new.audit_metadata ->> 'originChannel'
      in ('synapse_text', 'synapse_voice', 'synapse_whatsapp')
      then 'synapse'
    else 'professional'
  end;
  v_reason := coalesce(
    nullif(new.audit_metadata ->> 'changeReason', ''),
    case
      when v_source = 'synapse' and 'durationMinutes' = any(v_fields)
        then 'Reencaixe inteligente do Synapse com duração personalizada.'
      when v_source = 'synapse'
        then 'Reencaixe inteligente sugerido pelo Synapse.'
      when v_source = 'availability_change'
        then 'Ocorrência reencaixada após mudança da grade.'
      else 'Ocorrência personalizada pelo profissional.'
    end
  );

  new.occurrence_status := 'customized';
  new.personalized_fields := array(
    select distinct unnest(new.personalized_fields || v_fields)
  );
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
      'durationMinutes', v_old_duration,
      'modality', old.type,
      'location', old.location
    ),
    jsonb_build_object(
      'startTime', new.start_time,
      'endTime', new.end_time,
      'durationMinutes', v_new_duration,
      'modality', new.type,
      'location', new.location
    ),
    v_fields,
    v_source,
    v_reason,
    coalesce(new.updated_by, new.user_id)
  )
  on conflict (series_id, occurrence_number) do update
  set appointment_id = excluded.appointment_id,
      override_values = excluded.override_values,
      changed_fields = array(
        select distinct unnest(
          public.appointment_occurrence_overrides.changed_fields
          || excluded.changed_fields
        )
      ),
      source = excluded.source,
      reason = excluded.reason,
      created_by = excluded.created_by,
      created_at = now();

  return new;
end;
$$;

revoke all on function private.capture_series_occurrence_override()
  from public, anon, authenticated;
