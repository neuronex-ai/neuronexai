-- Canonical Agenda v2 preview/execute contracts. UI and Synapse call the same
-- deterministic functions; no model writes directly to operational tables.

create extension if not exists pgcrypto;
create schema if not exists private;

alter table public.appointment_action_plans
  drop constraint if exists appointment_action_plans_action_check;
alter table public.appointment_action_plans
  add constraint appointment_action_plans_action_check check (
    action in (
      'create', 'reschedule', 'cancel',
      'create_series_v2', 'reschedule_occurrence_v2',
      'change_availability_v2', 'offer_waitlist_v2',
      'set_teleconsultation_transcription', 'close_teleconsultation'
    )
  );

create or replace function private.resolve_patient_appointment_financial(
  p_professional_id uuid,
  p_patient_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_settings public.patient_financial_settings%rowtype;
  v_agreement public.patient_insurance_agreements%rowtype;
  v_preferences public.psychologist_patient_preferences%rowtype;
  v_automation public.financial_automation_settings%rowtype;
  v_history_amount numeric;
  v_source text;
  v_plan_type text;
  v_base_cents integer := 0;
  v_expected_cents integer := 0;
  v_should_charge boolean := false;
begin
  if not exists (
    select 1 from public.patients patient
    where patient.id = p_patient_id
      and patient.user_id = p_professional_id
  ) then
    raise exception 'Paciente não encontrado.' using errcode = '42501';
  end if;

  select settings.* into v_settings
  from public.patient_financial_settings settings
  where settings.user_id = p_professional_id
    and settings.patient_id = p_patient_id
  limit 1;

  if found then
    v_source := 'patient_profile';
    v_plan_type := v_settings.plan_type;
    v_base_cents := coalesce(v_settings.session_value_cents, 0);
  else
    select coalesce(
      appointment.price,
      nullif(appointment.metadata #>> '{financial,transactionAmount}', '')::numeric
    ) into v_history_amount
    from public.appointments appointment
    where appointment.user_id = p_professional_id
      and appointment.patient_id = p_patient_id
      and coalesce(
        appointment.price,
        nullif(appointment.metadata #>> '{financial,transactionAmount}', '')::numeric
      ) > 0
    order by appointment.start_time desc nulls last
    limit 1;

    if v_history_amount is not null then
      v_source := 'patient_history';
      v_plan_type := 'per_session';
      v_base_cents := round(v_history_amount * 100)::integer;
    else
      select preference.* into v_preferences
      from public.psychologist_patient_preferences preference
      where preference.user_id = p_professional_id;

      select automation.* into v_automation
      from public.financial_automation_settings automation
      where automation.professional_id = p_professional_id
        and automation.clinic_id is null
      limit 1;

      v_source := 'professional_default';
      v_plan_type := coalesce(v_preferences.default_financial_plan, 'per_session');
      v_base_cents := coalesce(
        v_preferences.default_session_value_cents,
        round(v_automation.appointment_default_amount * 100)::integer,
        0
      );
    end if;
  end if;

  if v_plan_type = 'insurance' and v_settings.insurance_agreement_id is not null then
    select agreement.* into v_agreement
    from public.patient_insurance_agreements agreement
    where agreement.id = v_settings.insurance_agreement_id
      and agreement.user_id = p_professional_id
      and agreement.active;

    if found then
      v_expected_cents := case v_agreement.repass_type
        when 'percentage' then round(v_base_cents * coalesce(v_agreement.repass_percentage, 0) / 100)::integer
        else coalesce(v_agreement.repass_value_cents, 0)
      end;
    end if;
    v_should_charge := false;
  elsif v_plan_type in ('exempt', 'monthly') then
    v_expected_cents := case when v_plan_type = 'monthly'
      then coalesce(v_settings.monthly_value_cents, 0)
      else 0
    end;
    v_should_charge := false;
  else
    v_expected_cents := v_base_cents;
    v_should_charge := v_base_cents > 0;
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'source', v_source,
    'planType', v_plan_type,
    'sessionValueCents', v_base_cents,
    'expectedReceivableCents', v_expected_cents,
    'shouldCreateCharge', v_should_charge,
    'billingDay', v_settings.billing_day,
    'agreement', case when v_agreement.id is null then null else jsonb_build_object(
      'id', v_agreement.id,
      'name', v_agreement.name,
      'repassType', v_agreement.repass_type,
      'repassValueCents', v_agreement.repass_value_cents,
      'repassPercentage', v_agreement.repass_percentage,
      'expectedReceiptDays', v_agreement.expected_receipt_days
    ) end
  ));
end;
$$;

revoke all on function private.resolve_patient_appointment_financial(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.resolve_patient_appointment_financial(
  p_patient_id uuid
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
  return private.resolve_patient_appointment_financial(auth.uid(), p_patient_id);
end;
$$;

revoke all on function public.resolve_patient_appointment_financial(uuid)
  from public, anon, authenticated;
grant execute on function public.resolve_patient_appointment_financial(uuid)
  to authenticated;

create or replace function private.agenda_v2_availability_version(
  p_professional_id uuid,
  p_at timestamptz
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select version.id
  from public.professional_availability_versions version
  where version.professional_id = p_professional_id
    and version.effective_from <= p_at
    and version.status in ('active', 'scheduled')
  order by version.effective_from desc, version.version_number desc
  limit 1;
$$;

create or replace function private.agenda_v2_is_available(
  p_professional_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_version_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_version_id uuid := coalesce(
    p_version_id,
    private.agenda_v2_availability_version(p_professional_id, p_starts_at)
  );
  v_timezone text := 'America/Sao_Paulo';
  v_local_start timestamp;
  v_local_end timestamp;
begin
  if exists (
    select 1 from public.professional_availability_exceptions exception
    where exception.professional_id = p_professional_id
      and exception.exception_kind = 'blocked'
      and tstzrange(exception.starts_at, exception.ends_at, '[)')
        && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    return false;
  end if;

  if exists (
    select 1 from public.professional_availability_exceptions exception
    where exception.professional_id = p_professional_id
      and exception.exception_kind = 'available'
      and exception.starts_at <= p_starts_at
      and exception.ends_at >= p_ends_at
  ) then
    return true;
  end if;

  if v_version_id is null then
    return extract(isodow from p_starts_at at time zone v_timezone) between 1 and 5;
  end if;

  select version.timezone into v_timezone
  from public.professional_availability_versions version
  where version.id = v_version_id
    and version.professional_id = p_professional_id;

  if not found then return false; end if;
  v_local_start := p_starts_at at time zone v_timezone;
  v_local_end := p_ends_at at time zone v_timezone;

  if v_local_start::date <> v_local_end::date then return false; end if;

  return exists (
    select 1 from public.professional_availability_windows availability_window
    where availability_window.availability_version_id = v_version_id
      and availability_window.professional_id = p_professional_id
      and availability_window.weekday = extract(dow from v_local_start)::smallint
      and availability_window.start_time <= v_local_start::time
      and availability_window.end_time >= v_local_end::time
  );
end;
$$;

revoke all on function private.agenda_v2_availability_version(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function private.agenda_v2_is_available(uuid, timestamptz, timestamptz, uuid)
  from public, anon, authenticated;

create or replace function private.generate_agenda_v2_occurrences(
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
  v_rule jsonb := coalesce(p_input -> 'recurrence_rule', '{}'::jsonb);
  v_termination jsonb;
  v_kind text;
  v_termination_kind text;
  v_first timestamptz;
  v_timezone text;
  v_local_first timestamp;
  v_base_time time;
  v_first_date date;
  v_until date;
  v_target integer;
  v_interval integer;
  v_cursor date;
  v_month_start date;
  v_candidate_date date;
  v_candidate_start timestamptz;
  v_candidate_end timestamptz;
  v_candidates jsonb := '[]'::jsonb;
  v_result jsonb := '[]'::jsonb;
  v_adjustment text;
  v_day_text text;
  v_requested_day integer;
  v_last_day integer;
  v_month_offset integer := 0;
  v_duration integer;
  v_occurrence integer := 0;
  v_override jsonb;
  v_changed_fields jsonb;
  v_override_date date;
  v_override_time time;
  v_distribution_days integer;
begin
  v_first := (p_input ->> 'first_start_time')::timestamptz;
  v_duration := coalesce((p_input ->> 'duration_minutes')::integer, 50);
  v_timezone := coalesce(nullif(p_input ->> 'timezone', ''), 'America/Sao_Paulo');
  v_kind := coalesce(nullif(v_rule ->> 'kind', ''), 'weekly');
  v_termination := coalesce(v_rule -> 'termination', '{}'::jsonb);
  v_termination_kind := coalesce(nullif(v_termination ->> 'kind', ''), 'count');
  v_interval := greatest(coalesce((v_rule ->> 'interval')::integer, 1), 1);
  v_local_first := v_first at time zone v_timezone;
  v_base_time := v_local_first::time;
  v_first_date := v_local_first::date;

  if v_duration not between 15 and 1440 then
    raise exception 'A duração deve ficar entre 15 e 1440 minutos.' using errcode = '22023';
  end if;

  if v_termination_kind = 'count' then
    v_target := least(greatest(coalesce((v_termination ->> 'count')::integer, 1), 1), 500);
    v_until := v_first_date + 36500;
  elsif v_termination_kind = 'until' then
    v_target := 500;
    v_until := (v_termination ->> 'until_date')::date;
  elsif v_termination_kind = 'open' then
    v_target := 32767;
    v_until := greatest(v_first_date, current_date) + 90;
  else
    raise exception 'Término de recorrência inválido.' using errcode = '22023';
  end if;

  if v_until < v_first_date then
    raise exception 'A data final precisa ser igual ou posterior à primeira sessão.' using errcode = '22023';
  end if;

  if v_kind in ('weekly', 'interval') then
    v_cursor := v_first_date;
    while jsonb_array_length(v_candidates) < v_target and v_cursor <= v_until loop
      if (
        v_kind = 'interval'
        and mod(v_cursor - v_first_date, v_interval) = 0
      ) or (
        v_kind = 'weekly'
        and mod(((v_cursor - v_first_date) / 7), v_interval) = 0
        and (
          not (v_rule ? 'week_days')
          or jsonb_array_length(v_rule -> 'week_days') = 0
          or (v_rule -> 'week_days') @> to_jsonb(array[extract(dow from v_cursor)::integer])
        )
      ) then
        v_candidates := v_candidates || jsonb_build_array(jsonb_build_object(
          'date', v_cursor,
          'adjustment_reason', null
        ));
      end if;
      v_cursor := v_cursor + 1;
    end loop;
  elsif v_kind = 'monthly' then
    while jsonb_array_length(v_candidates) < v_target loop
      v_month_start := (date_trunc('month', v_first_date)::date + (v_month_offset || ' months')::interval)::date;
      exit when v_month_start > v_until;
      v_last_day := extract(day from (v_month_start + interval '1 month - 1 day'))::integer;

      for v_day_text in
        select value
        from jsonb_array_elements_text(
          case when jsonb_array_length(coalesce(v_rule -> 'month_days', '[]'::jsonb)) > 0
            then v_rule -> 'month_days'
            else jsonb_build_array(extract(day from v_first_date)::integer)
          end
        )
        order by value::integer
      loop
        v_requested_day := v_day_text::integer;
        if v_requested_day not between 1 and 31 then continue; end if;
        v_candidate_date := make_date(
          extract(year from v_month_start)::integer,
          extract(month from v_month_start)::integer,
          least(v_requested_day, v_last_day)
        );
        v_adjustment := case when v_requested_day > v_last_day
          then 'Dia inexistente ajustado para o último dia útil do mês.'
          else null
        end;

        if coalesce(v_rule ->> 'missing_month_day', 'last_business_day') = 'last_business_day'
          and (
            v_requested_day > v_last_day
            or extract(dow from v_candidate_date) in (0, 6)
            or exists (
              select 1 from public.professional_availability_exceptions exception
              where exception.professional_id = p_professional_id
                and exception.exception_kind = 'blocked'
                and (exception.starts_at at time zone v_timezone)::date = v_candidate_date
            )
          )
        then
          while extract(dow from v_candidate_date) in (0, 6)
            or exists (
              select 1 from public.professional_availability_exceptions exception
              where exception.professional_id = p_professional_id
                and exception.exception_kind = 'blocked'
                and (exception.starts_at at time zone v_timezone)::date = v_candidate_date
            )
          loop
            v_candidate_date := v_candidate_date - 1;
          end loop;
          v_adjustment := coalesce(v_adjustment, 'Data ajustada para o último dia útil permitido do mês.');
        end if;

        if v_candidate_date >= v_first_date and v_candidate_date <= v_until then
          v_candidates := v_candidates || jsonb_build_array(jsonb_build_object(
            'date', v_candidate_date,
            'adjustment_reason', v_adjustment
          ));
        end if;
        exit when jsonb_array_length(v_candidates) >= v_target;
      end loop;
      v_month_offset := v_month_offset + v_interval;
      exit when v_month_offset > 2400;
    end loop;
  elsif v_kind = 'custom_dates' then
    for v_day_text in
      select distinct value
      from jsonb_array_elements_text(coalesce(v_rule -> 'custom_dates', '[]'::jsonb))
      order by value
    loop
      v_candidate_date := v_day_text::date;
      if v_candidate_date >= v_first_date and v_candidate_date <= v_until then
        v_candidates := v_candidates || jsonb_build_array(jsonb_build_object(
          'date', v_candidate_date,
          'adjustment_reason', null
        ));
      end if;
      exit when jsonb_array_length(v_candidates) >= v_target;
    end loop;
  elsif v_kind = 'range_distribution' then
    if v_termination_kind <> 'count' or nullif(v_rule ->> 'until_date', '') is null then
      raise exception 'A distribuição exige quantidade e data final.' using errcode = '22023';
    end if;
    v_until := (v_rule ->> 'until_date')::date;
    v_distribution_days := v_until - v_first_date;
    if v_target > 1 and v_distribution_days < v_target - 1 then
      raise exception 'O intervalo não comporta a quantidade sem repetir datas.' using errcode = '22023';
    end if;
    for v_occurrence in 1..v_target loop
      v_candidate_date := v_first_date + case when v_target = 1 then 0 else
        round(v_distribution_days * (v_occurrence - 1)::numeric / (v_target - 1))::integer
      end;
      v_candidates := v_candidates || jsonb_build_array(jsonb_build_object(
        'date', v_candidate_date,
        'adjustment_reason', case when v_occurrence in (1, v_target) then null
          else 'Data distribuída proporcionalmente dentro do intervalo.' end
      ));
    end loop;
  else
    raise exception 'Tipo de recorrência inválido.' using errcode = '22023';
  end if;

  v_occurrence := 0;
  for v_override in select value from jsonb_array_elements(v_candidates)
  loop
    v_occurrence := v_occurrence + 1;
    select item.value into v_changed_fields
    from jsonb_array_elements(coalesce(p_input -> 'overrides', '[]'::jsonb)) item
    where (item.value ->> 'occurrence_number')::integer = v_occurrence
    limit 1;

    v_override_date := coalesce(
      nullif(v_changed_fields ->> 'date', '')::date,
      (v_override ->> 'date')::date
    );
    v_override_time := coalesce(
      nullif(v_changed_fields ->> 'start_time', '')::time,
      v_base_time
    );
    v_duration := coalesce(
      nullif(v_changed_fields ->> 'duration_minutes', '')::integer,
      (p_input ->> 'duration_minutes')::integer,
      50
    );
    if v_duration not between 15 and 1440 then
      raise exception 'Override de duração inválido.' using errcode = '22023';
    end if;

    v_candidate_start := (v_override_date::text || ' ' || v_override_time::text)::timestamp at time zone v_timezone;
    v_candidate_end := v_candidate_start + make_interval(mins => v_duration);

    v_result := v_result || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'occurrenceNumber', v_occurrence,
      'startTime', v_candidate_start,
      'endTime', v_candidate_end,
      'durationMinutes', v_duration,
      'occurrenceStatus', case
        when v_changed_fields is not null then 'customized'
        when nullif(v_override ->> 'adjustment_reason', '') is not null then 'adjusted'
        else 'standard'
      end,
      'changedFields', case when v_changed_fields is null then '[]'::jsonb else
        to_jsonb(array_remove(array[
          case when v_changed_fields ? 'date' then 'date' end,
          case when v_changed_fields ? 'start_time' then 'startTime' end,
          case when v_changed_fields ? 'duration_minutes' then 'durationMinutes' end,
          case when v_changed_fields ? 'modality' then 'modality' end,
          case when v_changed_fields ? 'location' then 'location' end
        ], null))
      end,
      'adjustmentReason', nullif(v_override ->> 'adjustment_reason', ''),
      'overrideReason', nullif(v_changed_fields ->> 'reason', '')
    )));
  end loop;

  return v_result;
end;
$$;

revoke all on function private.generate_agenda_v2_occurrences(uuid, jsonb)
  from public, anon, authenticated;

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
  v_occurrences jsonb;
  v_checked jsonb := '[]'::jsonb;
  v_conflicts jsonb := '[]'::jsonb;
  v_item jsonb;
  v_start timestamptz;
  v_end timestamptz;
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
    v_start := (v_item ->> 'startTime')::timestamptz;
    v_end := (v_item ->> 'endTime')::timestamptz;
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
    'financial', v_financial
  );
end;
$$;

revoke all on function private.preview_agenda_v2_plan(uuid, jsonb)
  from public, anon, authenticated;

create or replace function public.preview_agenda_plan(p_input jsonb)
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
  return private.preview_agenda_v2_plan(auth.uid(), coalesce(p_input, '{}'::jsonb));
end;
$$;

revoke all on function public.preview_agenda_plan(jsonb)
  from public, anon, authenticated;
grant execute on function public.preview_agenda_plan(jsonb) to authenticated;

create or replace function private.safe_agenda_v2_action_plan(
  p_plan public.appointment_action_plans
)
returns jsonb
language sql
stable
security definer
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

revoke all on function private.safe_agenda_v2_action_plan(public.appointment_action_plans)
  from public, anon, authenticated;

create or replace function public.prepare_agenda_action_plan(
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
declare
  v_professional_id uuid := auth.uid();
  v_action text := lower(coalesce(p_action, ''));
  v_preview jsonb;
  v_snapshot jsonb;
  v_hash text;
  v_status text;
  v_plan public.appointment_action_plans%rowtype;
  v_previous public.appointment_action_plans%rowtype;
  v_origin text := case lower(coalesce(p_provenance ->> 'origin_channel', 'professional_app'))
    when 'synapse_text' then 'synapse_text'
    when 'synapse_voice' then 'synapse_voice'
    when 'synapse_whatsapp' then 'synapse_whatsapp'
    else 'professional_app'
  end;
begin
  if v_professional_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if v_action <> 'create_series_v2' then
    raise exception 'Ação da Agenda v2 ainda não suportada.' using errcode = '22023';
  end if;
  if nullif(btrim(p_idempotency_key), '') is null
    or char_length(p_idempotency_key) not between 8 and 240
  then
    raise exception 'A valid idempotency key is required' using errcode = '22023';
  end if;

  v_preview := private.preview_agenda_v2_plan(v_professional_id, p_input);
  v_status := case when coalesce((v_preview ->> 'valid')::boolean, false)
    then 'awaiting_confirmation'
    else 'review_required'
  end;
  v_snapshot := jsonb_build_object(
    'schemaVersion', 2,
    'agenda', jsonb_build_object(
      'action', v_action,
      'patientId', p_input ->> 'patient_id',
      'input', p_input,
      'preview', v_preview
    ),
    'financial', coalesce(p_input -> 'financial', v_preview -> 'financial', '{}'::jsonb),
    'provenance', coalesce(p_provenance, '{}'::jsonb) || jsonb_build_object('origin_channel', v_origin)
  );
  v_hash := encode(digest(v_snapshot::text, 'sha256'), 'hex');

  perform pg_advisory_xact_lock(hashtextextended(
    'agenda-v2-idempotency:' || v_professional_id::text || ':' || p_idempotency_key,
    0
  ));

  select plan.* into v_previous
  from public.appointment_action_plans plan
  where plan.professional_id = v_professional_id
    and plan.idempotency_key = p_idempotency_key
  order by plan.plan_version desc
  limit 1
  for update;

  if found and v_previous.plan_hash = v_hash
    and v_previous.status not in ('expired', 'superseded', 'failed')
  then
    return private.safe_agenda_v2_action_plan(v_previous);
  end if;
  if found then
    raise exception 'A chave de idempotência já representa outro plano.' using errcode = '23505';
  end if;

  insert into public.appointment_action_plans (
    plan_hash,
    action,
    status,
    professional_id,
    patient_id,
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
    v_hash,
    v_action,
    v_status,
    v_professional_id,
    nullif(p_input ->> 'patient_id', '')::uuid,
    v_origin,
    nullif(p_provenance ->> 'conversation_id', '')::uuid,
    nullif(p_provenance ->> 'voice_session_id', '')::uuid,
    nullif(p_provenance ->> 'whatsapp_message_id', ''),
    nullif(p_provenance ->> 'tool_call', ''),
    nullif(p_provenance ->> 'correlation_id', ''),
    v_snapshot,
    jsonb_build_object(
      'action', 'create_series_v2',
      'patientId', p_input ->> 'patient_id',
      'totalOccurrences', v_preview -> 'totalOccurrences',
      'conflictCount', jsonb_array_length(v_preview -> 'conflicts'),
      'firstStartTime', v_preview -> 'firstStartTime',
      'lastStartTime', v_preview -> 'lastStartTime',
      'financial', v_preview -> 'financial'
    ),
    p_idempotency_key
  ) returning * into v_plan;

  insert into public.appointment_action_plan_events (
    plan_id,
    plan_version,
    professional_id,
    patient_id,
    event_type,
    to_status,
    actor_type,
    actor_user_id,
    action_origin,
    idempotency_key,
    safe_metadata
  ) values (
    v_plan.plan_id,
    v_plan.plan_version,
    v_professional_id,
    v_plan.patient_id,
    'agenda_v2_plan_prepared',
    v_plan.status,
    case when v_origin like 'synapse_%' then 'synapse' else 'psychologist' end,
    v_professional_id,
    v_origin,
    p_idempotency_key || ':prepared',
    jsonb_build_object('requiresReview', v_status = 'review_required')
  );

  return private.safe_agenda_v2_action_plan(v_plan);
end;
$$;

revoke all on function public.prepare_agenda_action_plan(text, jsonb, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.prepare_agenda_action_plan(text, jsonb, jsonb, text)
  to authenticated;

create or replace function public.execute_agenda_action_plan(
  p_plan_id uuid,
  p_plan_version integer,
  p_plan_hash text,
  p_confirmation_channel text default 'professional_app'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_professional_id uuid := auth.uid();
  v_plan public.appointment_action_plans%rowtype;
  v_input jsonb;
  v_preview jsonb;
  v_occurrence jsonb;
  v_series_id uuid;
  v_appointment_id uuid;
  v_appointment_ids uuid[] := '{}';
  v_total integer;
  v_open boolean;
  v_financial jsonb;
  v_package_id uuid;
  v_metadata jsonb;
begin
  if v_professional_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('appointment-plan:' || p_plan_id::text, 0));
  select plan.* into v_plan
  from public.appointment_action_plans plan
  where plan.plan_id = p_plan_id
    and plan.plan_version = p_plan_version
    and plan.professional_id = v_professional_id
  for update;

  if not found then raise exception 'Plano não encontrado.' using errcode = 'P0002'; end if;
  if v_plan.action <> 'create_series_v2' then
    raise exception 'Plano incompatível com a Agenda v2.' using errcode = '22023';
  end if;
  if v_plan.plan_hash <> lower(coalesce(p_plan_hash, '')) then
    raise exception 'Plano alterado ou inválido.' using errcode = '22023';
  end if;
  if v_plan.status = 'completed' then
    return private.safe_agenda_v2_action_plan(v_plan);
  end if;
  if v_plan.status <> 'awaiting_confirmation' or v_plan.expires_at <= now() then
    raise exception 'O plano expirou ou não pode ser confirmado.' using errcode = '55000';
  end if;

  update public.appointment_action_plans
  set status = 'confirmed',
      confirmed_at = now(),
      confirmed_by = v_professional_id,
      confirmation_channel = case when p_confirmation_channel in (
        'professional_app', 'synapse_text', 'synapse_voice', 'synapse_whatsapp'
      ) then p_confirmation_channel else 'professional_app' end
  where id = v_plan.id
  returning * into v_plan;

  update public.appointment_action_plans
  set status = 'executing', executing_at = now()
  where id = v_plan.id
  returning * into v_plan;

  perform pg_advisory_xact_lock(hashtextextended('appointments:' || v_professional_id::text, 0));
  v_input := v_plan.immutable_snapshot #> '{agenda,input}';
  v_preview := private.preview_agenda_v2_plan(v_professional_id, v_input);

  if not coalesce((v_preview ->> 'valid')::boolean, false) then
    update public.appointment_action_plans
    set status = 'review_required',
        last_error = 'schedule_changed',
        result_public = jsonb_build_object(
          'message', 'A agenda mudou. Revise os conflitos antes de confirmar.',
          'preview', v_preview
        )
    where id = v_plan.id
    returning * into v_plan;
    return private.safe_agenda_v2_action_plan(v_plan);
  end if;

  v_total := jsonb_array_length(v_preview -> 'occurrences');
  v_open := v_input #>> '{recurrence_rule,termination,kind}' = 'open';
  v_financial := coalesce(v_plan.immutable_snapshot -> 'financial', '{}'::jsonb);
  v_package_id := nullif(v_financial ->> 'package_id', '')::uuid;
  v_metadata := coalesce(v_input -> 'metadata', '{}'::jsonb) - 'recurrence';

  insert into public.appointment_series (
    psychologist_id,
    patient_id,
    frequency,
    total_occurrences,
    first_start_time,
    last_start_time,
    duration_minutes,
    appointment_type,
    created_by,
    rule_kind,
    recurrence_rule,
    termination_kind,
    until_date,
    timezone,
    materialized_through,
    next_generation_at,
    availability_version_id,
    template_version_id,
    default_config,
    financial_snapshot
  ) values (
    v_professional_id,
    nullif(v_input ->> 'patient_id', '')::uuid,
    coalesce(v_input #>> '{recurrence_rule,kind}', 'weekly'),
    case when v_open then null else v_total end,
    (v_preview ->> 'firstStartTime')::timestamptz,
    case when v_open then null else (v_preview ->> 'lastStartTime')::timestamptz end,
    (v_input ->> 'duration_minutes')::integer,
    coalesce(v_input ->> 'type', 'presencial'),
    v_professional_id,
    coalesce(v_input #>> '{recurrence_rule,kind}', 'weekly'),
    v_input -> 'recurrence_rule',
    coalesce(v_input #>> '{recurrence_rule,termination,kind}', 'count'),
    nullif(v_input #>> '{recurrence_rule,termination,until_date}', '')::date,
    coalesce(v_input ->> 'timezone', 'America/Sao_Paulo'),
    case when v_open then ((v_preview ->> 'lastStartTime')::timestamptz at time zone coalesce(v_input ->> 'timezone', 'America/Sao_Paulo'))::date else null end,
    case when v_open then now() + interval '1 day' else null end,
    nullif(v_preview ->> 'availabilityVersionId', '')::uuid,
    nullif(v_input ->> 'template_version_id', '')::uuid,
    coalesce(v_input -> 'default_config', '{}'::jsonb),
    v_financial
  ) returning id into v_series_id;

  for v_occurrence in
    select value from jsonb_array_elements(v_preview -> 'occurrences')
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
      occurrence_count,
      occurrence_status,
      personalized_fields,
      series_revision
    ) values (
      v_professional_id,
      nullif(v_input ->> 'patient_id', '')::uuid,
      (v_occurrence ->> 'startTime')::timestamptz,
      (v_occurrence ->> 'endTime')::timestamptz,
      coalesce(v_input ->> 'type', 'presencial'),
      'unscored',
      nullif(v_input ->> 'notes', ''),
      nullif(v_input ->> 'location', ''),
      v_metadata,
      'created',
      v_professional_id,
      v_professional_id,
      v_plan.origin_channel,
      'psychologist',
      jsonb_build_object(
        'seriesId', v_series_id,
        'occurrenceNumber', (v_occurrence ->> 'occurrenceNumber')::integer,
        'occurrenceCount', case when v_open then null else v_total end,
        'planId', v_plan.plan_id,
        'planVersion', v_plan.plan_version
      ),
      v_series_id,
      (v_occurrence ->> 'occurrenceNumber')::smallint,
      case when v_open then null else v_total::smallint end,
      coalesce(v_occurrence ->> 'occurrenceStatus', 'standard'),
      array(select jsonb_array_elements_text(coalesce(v_occurrence -> 'changedFields', '[]'::jsonb))),
      1
    ) returning id into v_appointment_id;
    v_appointment_ids := array_append(v_appointment_ids, v_appointment_id);

    if v_occurrence ->> 'occurrenceStatus' = 'customized' then
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
        v_series_id,
        v_appointment_id,
        v_professional_id,
        (v_occurrence ->> 'occurrenceNumber')::integer,
        jsonb_build_object(
          'startTime', v_input ->> 'first_start_time',
          'durationMinutes', v_input ->> 'duration_minutes'
        ),
        v_occurrence,
        array(select jsonb_array_elements_text(coalesce(v_occurrence -> 'changedFields', '[]'::jsonb))),
        coalesce(v_input #>> array['overrides', ((v_occurrence ->> 'occurrenceNumber')::integer - 1)::text, 'source'], 'professional'),
        v_occurrence ->> 'overrideReason',
        v_plan.plan_id,
        v_professional_id
      );
    end if;
  end loop;

  if v_package_id is not null then
    perform private.reserve_package_appointments(
      v_professional_id,
      nullif(v_input ->> 'patient_id', '')::uuid,
      v_package_id,
      v_appointment_ids,
      v_plan.origin_channel,
      'agenda-v2-plan:' || v_plan.plan_id::text,
      v_professional_id
    );
  elsif v_financial ->> 'mode' = 'manual'
    and coalesce((v_financial ->> 'value_per_session')::numeric, 0) > 0
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
      'Lançamento preparado pela Agenda v2',
      (v_financial ->> 'value_per_session')::numeric,
      appointment.start_time::date,
      appointment.start_time::date,
      'pending',
      coalesce(v_financial ->> 'payment_method', 'manual'),
      'appointment',
      'agenda-v2-plan:' || v_plan.plan_id::text || ':appointment:' || appointment.id::text,
      jsonb_build_object('source', 'agenda_v2_action_plan', 'planVersion', v_plan.plan_version)
    from public.appointments appointment
    where appointment.id = any(v_appointment_ids)
    on conflict (professional_id, idempotency_key)
      where idempotency_key is not null
    do nothing;
  end if;

  update public.appointment_action_plans
  set status = 'completed',
      completed_at = now(),
      result_public = jsonb_build_object(
        'message', v_total::text || ' sessões criadas com segurança.',
        'seriesId', v_series_id,
        'appointmentIds', to_jsonb(v_appointment_ids),
        'totalOccurrences', v_total
      ),
      result_internal = jsonb_build_object(
        'seriesId', v_series_id,
        'appointmentIds', to_jsonb(v_appointment_ids)
      )
  where id = v_plan.id
  returning * into v_plan;

  insert into public.appointment_action_plan_events (
    plan_id,
    plan_version,
    professional_id,
    patient_id,
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
    v_plan.plan_id,
    v_plan.plan_version,
    v_professional_id,
    v_plan.patient_id,
    'agenda_v2_plan_completed',
    'executing',
    'completed',
    'psychologist',
    v_professional_id,
    v_plan.origin_channel,
    v_plan.confirmation_channel,
    v_plan.idempotency_key || ':completed',
    jsonb_build_object('seriesId', v_series_id, 'totalOccurrences', v_total)
  );

  return private.safe_agenda_v2_action_plan(v_plan);
exception when others then
  if v_plan.id is not null then
    update public.appointment_action_plans
    set status = 'failed', failed_at = now(), last_error = sqlstate || ':' || sqlerrm
    where id = v_plan.id and status in ('confirmed', 'executing')
    returning * into v_plan;
  end if;
  raise;
end;
$$;

revoke all on function public.execute_agenda_action_plan(uuid, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.execute_agenda_action_plan(uuid, integer, text, text)
  to authenticated;

create or replace function private.preview_availability_v2_change(
  p_professional_id uuid,
  p_windows jsonb,
  p_effective_from timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_conflicts jsonb;
begin
  if jsonb_typeof(coalesce(p_windows, '[]'::jsonb)) <> 'array' then
    raise exception 'Janelas de disponibilidade inválidas.' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'appointmentId', appointment.id,
    'patientId', appointment.patient_id,
    'seriesId', appointment.series_id,
    'startTime', appointment.start_time,
    'endTime', appointment.end_time,
    'reasonCode', 'outside_new_availability'
  ) order by appointment.start_time), '[]'::jsonb)
  into v_conflicts
  from public.appointments appointment
  where appointment.user_id = p_professional_id
    and appointment.start_time >= greatest(p_effective_from, now())
    and appointment.start_time is not null
    and appointment.end_time is not null
    and lower(coalesce(appointment.status, '')) not in ('cancelled', 'canceled')
    and appointment.lifecycle_status <> 'cancelled'
    and not exists (
      select 1
      from jsonb_array_elements(p_windows) availability_window
      where (availability_window ->> 'weekday')::smallint = extract(
          dow from appointment.start_time at time zone coalesce(nullif(availability_window ->> 'timezone', ''), 'America/Sao_Paulo')
        )::smallint
        and (availability_window ->> 'start_time')::time <= (appointment.start_time at time zone coalesce(nullif(availability_window ->> 'timezone', ''), 'America/Sao_Paulo'))::time
        and (availability_window ->> 'end_time')::time >= (appointment.end_time at time zone coalesce(nullif(availability_window ->> 'timezone', ''), 'America/Sao_Paulo'))::time
    );

  return jsonb_build_object(
    'valid', jsonb_array_length(v_conflicts) = 0,
    'effectiveFrom', p_effective_from,
    'conflictCount', jsonb_array_length(v_conflicts),
    'conflicts', v_conflicts
  );
end;
$$;

revoke all on function private.preview_availability_v2_change(uuid, jsonb, timestamptz)
  from public, anon, authenticated;

create or replace function public.preview_availability_change(
  p_windows jsonb,
  p_effective_from timestamptz default now()
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
  return private.preview_availability_v2_change(auth.uid(), p_windows, p_effective_from);
end;
$$;

create or replace function public.save_professional_availability(
  p_windows jsonb,
  p_effective_from timestamptz,
  p_strategy text,
  p_waitlist_strategy text default 'migrate_all',
  p_waitlist_entry_ids uuid[] default null,
  p_timezone text default 'America/Sao_Paulo',
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_professional_id uuid := auth.uid();
  v_preview jsonb;
  v_version_id uuid;
  v_version_number integer;
  v_status text;
  v_window jsonb;
  v_legacy jsonb := '{}'::jsonb;
  v_day integer;
  v_day_window jsonb;
begin
  if v_professional_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_strategy not in ('keep_exceptions', 'resolve_before_save', 'keep_previous_until') then
    raise exception 'Estratégia de mudança inválida.' using errcode = '22023';
  end if;
  if p_waitlist_strategy not in ('migrate_all', 'migrate_selected', 'keep_previous') then
    raise exception 'Estratégia da lista de espera inválida.' using errcode = '22023';
  end if;
  if p_strategy = 'keep_previous_until' and p_effective_from <= now() then
    raise exception 'Informe uma data futura para manter a regra anterior.' using errcode = '22023';
  end if;

  v_preview := private.preview_availability_v2_change(
    v_professional_id,
    p_windows,
    p_effective_from
  );
  if p_strategy = 'resolve_before_save'
    and (v_preview ->> 'conflictCount')::integer > 0
  then
    raise exception 'Resolva os conflitos selecionados antes de ativar a regra.' using errcode = '55000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('availability:' || v_professional_id::text, 0));
  select coalesce(max(version.version_number), 0) + 1 into v_version_number
  from public.professional_availability_versions version
  where version.professional_id = v_professional_id;
  v_status := case when p_effective_from <= now() then 'active' else 'scheduled' end;

  if v_status = 'active' then
    update public.professional_availability_versions
    set status = 'superseded'
    where professional_id = v_professional_id and status = 'active';
  end if;

  insert into public.professional_availability_versions (
    professional_id,
    version_number,
    timezone,
    effective_from,
    status,
    change_strategy,
    reason,
    created_by
  ) values (
    v_professional_id,
    v_version_number,
    coalesce(nullif(p_timezone, ''), 'America/Sao_Paulo'),
    p_effective_from,
    v_status,
    p_strategy,
    nullif(btrim(p_reason), ''),
    v_professional_id
  ) returning id into v_version_id;

  for v_window in select value from jsonb_array_elements(p_windows)
  loop
    insert into public.professional_availability_windows (
      availability_version_id,
      professional_id,
      weekday,
      start_time,
      end_time
    ) values (
      v_version_id,
      v_professional_id,
      (v_window ->> 'weekday')::smallint,
      (v_window ->> 'start_time')::time,
      (v_window ->> 'end_time')::time
    );
  end loop;

  if p_strategy = 'keep_exceptions' then
    insert into public.professional_availability_impacts (
      availability_version_id,
      professional_id,
      appointment_id,
      impact_kind,
      resolution,
      details,
      resolved_at
    )
    select
      v_version_id,
      v_professional_id,
      (item ->> 'appointmentId')::uuid,
      case when nullif(item ->> 'seriesId', '') is null then 'appointment' else 'series' end,
      'kept_as_exception',
      item,
      now()
    from jsonb_array_elements(v_preview -> 'conflicts') item;
  end if;

  if p_waitlist_strategy = 'migrate_all' then
    update public.professional_waitlist_entries
    set availability_version_id = v_version_id, updated_at = now()
    where professional_id = v_professional_id
      and status in ('active', 'paused', 'offered');
  elsif p_waitlist_strategy = 'migrate_selected' then
    update public.professional_waitlist_entries
    set availability_version_id = v_version_id, updated_at = now()
    where professional_id = v_professional_id
      and id = any(coalesce(p_waitlist_entry_ids, '{}'::uuid[]));
  end if;

  if v_status = 'active' then
    for v_day in 0..6 loop
      select jsonb_build_object(
        'enabled', count(*) > 0,
        'start', coalesce(min(availability_window.start_time)::text, '08:00:00'),
        'end', coalesce(max(availability_window.end_time)::text, '19:00:00')
      ) into v_day_window
      from public.professional_availability_windows availability_window
      where availability_window.availability_version_id = v_version_id
        and availability_window.weekday = v_day;
      v_legacy := v_legacy || jsonb_build_object(v_day::text, v_day_window);
    end loop;
    update public.profiles
    set working_hours = v_legacy, updated_at = now()
    where id = v_professional_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'availabilityVersionId', v_version_id,
    'versionNumber', v_version_number,
    'status', v_status,
    'impact', v_preview,
    'waitlistStrategy', p_waitlist_strategy
  );
end;
$$;

revoke all on function public.preview_availability_change(jsonb, timestamptz)
  from public, anon, authenticated;
revoke all on function public.save_professional_availability(jsonb, timestamptz, text, text, uuid[], text, text)
  from public, anon, authenticated;
grant execute on function public.preview_availability_change(jsonb, timestamptz)
  to authenticated;
grant execute on function public.save_professional_availability(jsonb, timestamptz, text, text, uuid[], text, text)
  to authenticated;

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

create or replace function public.match_professional_waitlist_slot(
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_modality text default null
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
  if p_ends_at <= p_starts_at then
    raise exception 'Intervalo inválido.' using errcode = '22023';
  end if;
  return private.match_professional_waitlist_slot(auth.uid(), p_starts_at, p_ends_at, p_modality);
end;
$$;

create or replace function private.prepare_waitlist_offer_core(
  p_professional_id uuid,
  p_entry_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_idempotency_key text,
  p_actor_type text default 'professional'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.professional_waitlist_entries%rowtype;
  v_hold public.appointment_slot_holds%rowtype;
  v_offer public.professional_waitlist_offers%rowtype;
  v_token text;
  v_expires_at timestamptz;
  v_matches jsonb;
begin
  if p_starts_at <= now() or p_ends_at <= p_starts_at then
    raise exception 'A oferta precisa apontar para um horário futuro válido.' using errcode = '22023';
  end if;

  select entry.* into v_entry
  from public.professional_waitlist_entries entry
  where entry.id = p_entry_id
    and entry.professional_id = p_professional_id
    and entry.status in ('active', 'offered')
  for update;
  if not found then raise exception 'Entrada da lista de espera não encontrada.' using errcode = 'P0002'; end if;

  v_matches := private.match_professional_waitlist_slot(
    p_professional_id,
    p_starts_at,
    p_ends_at,
    v_entry.modality
  );
  if not exists (
    select 1 from jsonb_array_elements(v_matches) item
    where item ->> 'entryId' = p_entry_id::text
  ) then
    raise exception 'O horário não atende às regras desta entrada.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('appointments:' || p_professional_id::text, 0));
  update public.appointment_slot_holds
  set status = 'expired', released_at = now()
  where professional_id = p_professional_id
    and status = 'active'
    and expires_at <= now();
  update public.professional_waitlist_offers
  set status = 'expired', responded_at = now()
  where professional_id = p_professional_id
    and status = 'pending'
    and expires_at <= now();

  if exists (
    select 1 from public.appointments appointment
    where appointment.user_id = p_professional_id
      and appointment.start_time is not null
      and appointment.end_time is not null
      and lower(coalesce(appointment.status, '')) not in ('cancelled', 'canceled')
      and appointment.lifecycle_status <> 'cancelled'
      and tstzrange(appointment.start_time, appointment.end_time, '[)')
        && tstzrange(p_starts_at, p_ends_at, '[)')
  ) or exists (
    select 1 from public.appointment_slot_holds hold
    where hold.professional_id = p_professional_id
      and hold.status = 'active'
      and hold.expires_at > now()
      and tstzrange(hold.starts_at, hold.ends_at, '[)')
        && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    raise exception 'O horário já foi ocupado ou reservado.' using errcode = '23P01';
  end if;

  v_expires_at := least(now() + interval '2 hours', p_starts_at);
  v_token := encode(gen_random_bytes(32), 'hex');

  insert into public.appointment_slot_holds (
    professional_id,
    patient_id,
    waitlist_entry_id,
    starts_at,
    ends_at,
    expires_at,
    idempotency_key
  ) values (
    p_professional_id,
    v_entry.patient_id,
    v_entry.id,
    p_starts_at,
    p_ends_at,
    v_expires_at,
    p_idempotency_key
  ) returning * into v_hold;

  insert into public.professional_waitlist_offers (
    professional_id,
    waitlist_entry_id,
    hold_id,
    patient_id,
    token_hash,
    offered_start_time,
    offered_end_time,
    expires_at
  ) values (
    p_professional_id,
    v_entry.id,
    v_hold.id,
    v_entry.patient_id,
    encode(digest(v_token, 'sha256'), 'hex'),
    p_starts_at,
    p_ends_at,
    v_expires_at
  ) returning * into v_offer;

  update public.professional_waitlist_entries
  set status = 'offered',
      offer_count = offer_count + 1,
      last_offered_at = now(),
      updated_at = now()
  where id = v_entry.id;

  insert into public.professional_waitlist_events (
    professional_id,
    waitlist_entry_id,
    offer_id,
    event_type,
    actor_type,
    safe_metadata
  ) values (
    p_professional_id,
    v_entry.id,
    v_offer.id,
    'offer_created',
    p_actor_type,
    jsonb_build_object('startsAt', p_starts_at, 'endsAt', p_ends_at, 'expiresAt', v_expires_at)
  );

  insert into public.professional_waitlist_offer_outbox (
    professional_id,
    offer_id,
    payload,
    idempotency_key
  ) values (
    p_professional_id,
    v_offer.id,
    jsonb_build_object(
      'patientId', v_entry.patient_id,
      'startsAt', p_starts_at,
      'endsAt', p_ends_at,
      'expiresAt', v_expires_at,
      'responsePath', '/lista-de-espera/oferta?token=' || v_token
    ),
    'waitlist-offer:' || v_offer.id::text
  );

  return jsonb_build_object(
    'success', true,
    'offerId', v_offer.id,
    'holdId', v_hold.id,
    'token', v_token,
    'startsAt', p_starts_at,
    'endsAt', p_ends_at,
    'expiresAt', v_expires_at,
    'responsePath', '/lista-de-espera/oferta?token=' || v_token
  );
end;
$$;

revoke all on function private.prepare_waitlist_offer_core(uuid, uuid, timestamptz, timestamptz, text, text)
  from public, anon, authenticated;

create or replace function public.prepare_waitlist_offer(
  p_entry_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
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
  return private.prepare_waitlist_offer_core(
    auth.uid(), p_entry_id, p_starts_at, p_ends_at, p_idempotency_key, 'professional'
  );
end;
$$;

create or replace function public.respond_waitlist_offer(
  p_token text,
  p_response text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.professional_waitlist_offers%rowtype;
  v_hold public.appointment_slot_holds%rowtype;
  v_entry public.professional_waitlist_entries%rowtype;
  v_appointment_id uuid;
begin
  if p_response not in ('accept', 'decline') then
    raise exception 'Resposta inválida.' using errcode = '22023';
  end if;
  if p_token is null or char_length(p_token) <> 64 then
    raise exception 'Oferta inválida ou expirada.' using errcode = '22023';
  end if;

  select offer.* into v_offer
  from public.professional_waitlist_offers offer
  where offer.token_hash = encode(digest(p_token, 'sha256'), 'hex')
  for update;
  if not found then raise exception 'Oferta inválida ou expirada.' using errcode = 'P0002'; end if;

  select hold.* into v_hold from public.appointment_slot_holds hold
  where hold.id = v_offer.hold_id for update;
  select entry.* into v_entry from public.professional_waitlist_entries entry
  where entry.id = v_offer.waitlist_entry_id for update;

  if v_offer.status <> 'pending' or v_hold.status <> 'active' or v_offer.expires_at <= now() then
    update public.professional_waitlist_offers
    set status = case when status = 'pending' then 'expired' else status end,
        responded_at = coalesce(responded_at, now())
    where id = v_offer.id;
    update public.appointment_slot_holds
    set status = case when status = 'active' then 'expired' else status end,
        released_at = coalesce(released_at, now())
    where id = v_hold.id;
    raise exception 'Oferta inválida ou expirada.' using errcode = '55000';
  end if;

  if p_response = 'decline' then
    update public.professional_waitlist_offers
    set status = 'declined', responded_at = now() where id = v_offer.id;
    update public.appointment_slot_holds
    set status = 'declined', released_at = now() where id = v_hold.id;
    update public.professional_waitlist_entries
    set status = 'active', updated_at = now() where id = v_entry.id;
    insert into public.professional_waitlist_events (
      professional_id, waitlist_entry_id, offer_id, event_type, actor_type
    ) values (
      v_offer.professional_id, v_entry.id, v_offer.id, 'offer_declined', 'patient'
    );
    return jsonb_build_object('success', true, 'status', 'declined');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('appointments:' || v_offer.professional_id::text, 0));
  if exists (
    select 1 from public.appointments appointment
    where appointment.user_id = v_offer.professional_id
      and appointment.start_time is not null
      and appointment.end_time is not null
      and lower(coalesce(appointment.status, '')) not in ('cancelled', 'canceled')
      and appointment.lifecycle_status <> 'cancelled'
      and tstzrange(appointment.start_time, appointment.end_time, '[)')
        && tstzrange(v_offer.offered_start_time, v_offer.offered_end_time, '[)')
  ) then
    update public.professional_waitlist_offers
    set status = 'superseded', responded_at = now() where id = v_offer.id;
    update public.appointment_slot_holds
    set status = 'released', released_at = now() where id = v_hold.id;
    update public.professional_waitlist_entries
    set status = 'active', updated_at = now() where id = v_entry.id;
    raise exception 'O horário acabou de ser ocupado. A oferta foi liberada.' using errcode = '23P01';
  end if;

  insert into public.appointments (
    user_id,
    patient_id,
    start_time,
    end_time,
    type,
    status,
    lifecycle_status,
    metadata,
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
    coalesce(v_entry.modality, 'presencial'),
    'unscored',
    'created',
    jsonb_build_object('origin', 'waitlist', 'waitlistEntryId', v_entry.id, 'waitlistOfferId', v_offer.id),
    v_offer.professional_id,
    v_offer.professional_id,
    'patient_portal',
    'patient',
    jsonb_build_object('waitlistOfferId', v_offer.id)
  ) returning id into v_appointment_id;

  update public.professional_waitlist_offers
  set status = 'accepted', responded_at = now(), accepted_appointment_id = v_appointment_id
  where id = v_offer.id;
  update public.appointment_slot_holds
  set status = 'accepted', released_at = now() where id = v_hold.id;
  update public.professional_waitlist_entries
  set status = 'scheduled', updated_at = now() where id = v_entry.id;
  update public.professional_waitlist_offer_outbox
  set status = case when status in ('pending', 'failed') then 'cancelled' else status end
  where offer_id = v_offer.id;

  insert into public.professional_waitlist_events (
    professional_id, waitlist_entry_id, offer_id, event_type, actor_type, safe_metadata
  ) values (
    v_offer.professional_id,
    v_entry.id,
    v_offer.id,
    'offer_accepted',
    'patient',
    jsonb_build_object('appointmentId', v_appointment_id)
  );

  return jsonb_build_object(
    'success', true,
    'status', 'accepted',
    'appointmentId', v_appointment_id,
    'startTime', v_offer.offered_start_time,
    'endTime', v_offer.offered_end_time
  );
end;
$$;

revoke all on function public.match_professional_waitlist_slot(timestamptz, timestamptz, text)
  from public, anon, authenticated;
revoke all on function public.prepare_waitlist_offer(uuid, timestamptz, timestamptz, text)
  from public, anon, authenticated;
revoke all on function public.respond_waitlist_offer(text, text)
  from public, anon, authenticated;
grant execute on function public.match_professional_waitlist_slot(timestamptz, timestamptz, text)
  to authenticated;
grant execute on function public.prepare_waitlist_offer(uuid, timestamptz, timestamptz, text)
  to authenticated;
grant execute on function public.respond_waitlist_offer(text, text)
  to anon, authenticated;

create or replace function private.offer_cancelled_slot_to_waitlist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_matches jsonb;
  v_entry_id uuid;
begin
  if old.start_time is null or old.end_time is null then return new; end if;
  if not (
    (old.lifecycle_status <> 'cancelled' and new.lifecycle_status = 'cancelled')
    or old.start_time is distinct from new.start_time
    or old.end_time is distinct from new.end_time
  ) then
    return new;
  end if;

  begin
    v_matches := private.match_professional_waitlist_slot(
      old.user_id, old.start_time, old.end_time, old.type
    );
    select (item ->> 'entryId')::uuid into v_entry_id
    from jsonb_array_elements(v_matches) item
    join public.professional_waitlist_entries entry
      on entry.id = (item ->> 'entryId')::uuid
    where entry.offer_automatically
    limit 1;

    if v_entry_id is not null then
      perform private.prepare_waitlist_offer_core(
        old.user_id,
        v_entry_id,
        old.start_time,
        old.end_time,
        'automatic-vacancy:' || old.id::text || ':' || old.confirmation_revision::text,
        'system'
      );
    end if;
  exception when others then
    insert into public.appointment_events (
      appointment_id,
      psychologist_id,
      patient_id,
      event_type,
      actor_type,
      action_origin,
      idempotency_key,
      metadata
    ) values (
      old.id,
      old.user_id,
      old.patient_id,
      'waitlist_match_deferred',
      'system',
      'system',
      'waitlist-match-deferred:' || old.id::text || ':' || old.confirmation_revision::text,
      jsonb_build_object('reasonCode', sqlstate)
    ) on conflict do nothing;
  end;
  return new;
end;
$$;

revoke all on function private.offer_cancelled_slot_to_waitlist()
  from public, anon, authenticated;
drop trigger if exists tr_offer_cancelled_slot_to_waitlist on public.appointments;
create trigger tr_offer_cancelled_slot_to_waitlist
after update of lifecycle_status, start_time, end_time on public.appointments
for each row execute function private.offer_cancelled_slot_to_waitlist();

create or replace function private.expire_waitlist_offers()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.professional_waitlist_offers offer
    set status = 'expired', responded_at = now()
    where offer.status = 'pending' and offer.expires_at <= now()
    returning offer.id, offer.hold_id, offer.waitlist_entry_id
  ), released as (
    update public.appointment_slot_holds hold
    set status = 'expired', released_at = now()
    from expired
    where hold.id = expired.hold_id and hold.status = 'active'
    returning expired.waitlist_entry_id
  )
  update public.professional_waitlist_entries entry
  set status = 'active', updated_at = now()
  where entry.id in (select released.waitlist_entry_id from released)
    and entry.status = 'offered';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function private.expire_waitlist_offers()
  from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'expire-professional-waitlist-offers';
    perform cron.schedule(
      'expire-professional-waitlist-offers',
      '*/5 * * * *',
      'select private.expire_waitlist_offers()'
    );
  end if;
end
$$;
