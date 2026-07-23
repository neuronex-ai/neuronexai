-- Surface package balance and validity problems during Agenda review. The
-- execution path already rejects them atomically; previewing them prevents a
-- plan from looking confirmable only to fail after the professional confirms.

create or replace function private.preview_agenda_v2_plan(
  p_professional_id uuid,
  p_input jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_patient_id uuid := nullif(p_input ->> 'patient_id', '')::uuid;
  v_package_id uuid := nullif(p_input #>> '{financial,package_id}', '')::uuid;
  v_package public.patient_packages%rowtype;
  v_package_balance integer;
  v_occurrence_index integer := 0;
  v_occurrences jsonb;
  v_checked jsonb := '[]'::jsonb;
  v_conflicts jsonb := '[]'::jsonb;
  v_item jsonb;
  v_start timestamptz;
  v_end timestamptz;
  v_local_date date;
  v_reason_code text;
  v_reason text;
  v_version_id uuid;
  v_financial jsonb := '{}'::jsonb;
begin
  if v_patient_id is not null and not exists (
    select 1 from public.patients patient
    where patient.id = v_patient_id
      and patient.user_id = p_professional_id
  ) then
    raise exception 'Paciente não encontrado.' using errcode = '42501';
  end if;

  if v_package_id is not null then
    select package.*
    into v_package
    from public.patient_packages package
    where package.id = v_package_id
      and package.user_id = p_professional_id
      and package.patient_id = v_patient_id;

    if not found then
      raise exception 'Pacote não encontrado para este paciente.' using errcode = 'P0002';
    end if;
    if v_package.package_status <> 'active'
      or lower(coalesce(v_package.active, 'true')) not in ('true', '1', 'yes', 'active')
      or (v_package.end_date is not null and v_package.end_date < current_date)
    then
      raise exception 'O pacote não está ativo ou está fora da validade.' using errcode = '22023';
    end if;

    v_package_balance := greatest(
      v_package.total_sessions - v_package.sessions_used - v_package.sessions_reserved,
      0
    );
  end if;

  v_occurrences := private.generate_agenda_v2_occurrences(p_professional_id, p_input);
  if jsonb_array_length(v_occurrences) = 0 then
    raise exception 'A regra não gerou nenhuma sessão.' using errcode = '22023';
  end if;
  v_version_id := private.agenda_v2_availability_version(
    p_professional_id,
    (v_occurrences -> 0 ->> 'startTime')::timestamptz
  );

  for v_item in select value from jsonb_array_elements(v_occurrences)
  loop
    v_occurrence_index := v_occurrence_index + 1;
    v_start := (v_item ->> 'startTime')::timestamptz;
    v_end := (v_item ->> 'endTime')::timestamptz;
    v_local_date := (
      v_start at time zone coalesce(nullif(p_input ->> 'timezone', ''), 'America/Sao_Paulo')
    )::date;
    v_reason_code := null;
    v_reason := null;

    if not private.agenda_v2_is_available(p_professional_id, v_start, v_end, v_version_id) then
      v_reason_code := 'outside_availability';
      v_reason := 'Fora da disponibilidade profissional vigente.';
    elsif exists (
      select 1 from public.appointments appointment
      where appointment.user_id = p_professional_id
        and appointment.start_time is not null
        and appointment.end_time is not null
        and lower(coalesce(appointment.status, '')) not in ('cancelled', 'canceled')
        and appointment.lifecycle_status <> 'cancelled'
        and tstzrange(appointment.start_time, appointment.end_time, '[)')
          && tstzrange(v_start, v_end, '[)')
    ) then
      v_reason_code := 'appointment_conflict';
      v_reason := 'Já existe um compromisso neste horário.';
    elsif exists (
      select 1 from public.appointment_slot_holds hold
      where hold.professional_id = p_professional_id
        and hold.status = 'active'
        and hold.expires_at > now()
        and tstzrange(hold.starts_at, hold.ends_at, '[)')
          && tstzrange(v_start, v_end, '[)')
    ) then
      v_reason_code := 'slot_held';
      v_reason := 'O horário está temporariamente reservado.';
    elsif v_package_id is not null
      and v_package.start_date is not null
      and v_local_date < v_package.start_date
    then
      v_reason_code := 'package_outside_validity';
      v_reason := 'A sessão ocorre antes do início da validade do pacote.';
    elsif v_package_id is not null
      and v_package.end_date is not null
      and v_local_date > v_package.end_date
    then
      v_reason_code := 'package_outside_validity';
      v_reason := 'A sessão ultrapassa a validade do pacote.';
    elsif v_package_id is not null and v_occurrence_index > v_package_balance then
      v_reason_code := 'package_insufficient_balance';
      v_reason := format(
        'O pacote possui saldo para %s sessão(ões), abaixo do necessário para esta série.',
        v_package_balance
      );
    end if;

    v_item := v_item || jsonb_strip_nulls(jsonb_build_object(
      'status', case when v_reason_code is null then 'available' else 'conflict' end,
      'reasonCode', v_reason_code,
      'reason', v_reason
    ));
    v_checked := v_checked || jsonb_build_array(v_item);
    if v_reason_code is not null then
      v_conflicts := v_conflicts || jsonb_build_array(v_item);
    end if;
  end loop;

  if v_patient_id is not null then
    v_financial := private.resolve_patient_appointment_financial(p_professional_id, v_patient_id);
  end if;

  return jsonb_build_object(
    'valid', jsonb_array_length(v_conflicts) = 0,
    'ruleKind', p_input #>> '{recurrence_rule,kind}',
    'terminationKind', p_input #>> '{recurrence_rule,termination,kind}',
    'totalOccurrences', jsonb_array_length(v_checked),
    'durationMinutes', (p_input ->> 'duration_minutes')::integer,
    'firstStartTime', v_checked -> 0 ->> 'startTime',
    'lastStartTime', v_checked -> (jsonb_array_length(v_checked) - 1) ->> 'startTime',
    'availabilityVersionId', v_version_id,
    'occurrences', v_checked,
    'conflicts', v_conflicts,
    'financial', v_financial,
    'package', case
      when v_package_id is null then null
      else jsonb_build_object(
        'id', v_package_id,
        'availableSessions', v_package_balance,
        'requiredSessions', jsonb_array_length(v_checked),
        'startDate', v_package.start_date,
        'endDate', v_package.end_date
      )
    end
  );
end;
$$;

revoke all on function private.preview_agenda_v2_plan(uuid, jsonb)
  from public, anon, authenticated;
