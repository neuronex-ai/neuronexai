-- Synapse recurrence conflict auto-fit
-- Reuse the Agenda v2 smart-fit ranking instead of a separate forward-only scan.

create or replace function private.synapse_autofix_agenda_v2_input(
  p_professional_id uuid,
  p_input jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_input jsonb := coalesce(p_input, '{}'::jsonb);
  v_preview jsonb;
  v_conflict jsonb;
  v_suggestion jsonb;
  v_candidate jsonb;
  v_overrides jsonb;
  v_adjustments jsonb := '[]'::jsonb;
  v_occurrence integer;
  v_original timestamptz;
  v_candidate_start timestamptz;
  v_candidate_end timestamptz;
  v_duration integer;
  v_timezone text := coalesce(nullif(v_input ->> 'timezone', ''), 'America/Sao_Paulo');
  v_reason_code text;
begin
  if p_professional_id is null then
    raise exception 'Professional is required' using errcode = '42501';
  end if;

  -- Internal callers operate with service role; expose the actor to the existing
  -- public smart-fit RPC so it uses exactly the same Agenda rules as the app.
  perform set_config('request.jwt.claim.sub', p_professional_id::text, true);

  v_input := jsonb_set(
    v_input,
    '{recurrence_rule,missing_month_day}',
    to_jsonb('calendar_day'::text),
    true
  );

  v_preview := private.preview_agenda_v2_plan(p_professional_id, v_input);
  v_overrides := case
    when jsonb_typeof(v_input -> 'overrides') = 'array' then v_input -> 'overrides'
    else '[]'::jsonb
  end;

  for v_conflict in
    select value
    from jsonb_array_elements(coalesce(v_preview -> 'conflicts', '[]'::jsonb))
  loop
    v_reason_code := coalesce(v_conflict ->> 'reasonCode', '');
    if v_reason_code not in ('appointment_conflict', 'outside_availability', 'slot_held') then
      continue;
    end if;

    v_occurrence := nullif(v_conflict ->> 'occurrenceNumber', '')::integer;
    v_original := nullif(v_conflict ->> 'startTime', '')::timestamptz;
    v_duration := greatest(
      15,
      least(
        1440,
        coalesce(
          nullif(v_conflict ->> 'durationMinutes', '')::integer,
          nullif(v_input ->> 'duration_minutes', '')::integer,
          50
        )
      )
    );
    if v_occurrence is null or v_original is null then
      continue;
    end if;

    -- The Agenda RPC ranks candidates by: full duration, same date, same weekday,
    -- then physical distance from the requested time. It also excludes appointments,
    -- holds and sibling occurrences from this same series.
    v_suggestion := public.suggest_agenda_plan_smart_fit(
      v_input,
      v_occurrence,
      14,
      false,
      v_duration
    );
    v_candidate := v_suggestion -> 'candidates' -> 0;
    if v_candidate is null or jsonb_typeof(v_candidate) <> 'object' then
      continue;
    end if;

    v_candidate_start := nullif(v_candidate ->> 'startTime', '')::timestamptz;
    v_candidate_end := nullif(v_candidate ->> 'endTime', '')::timestamptz;
    if v_candidate_start is null or v_candidate_end is null then
      continue;
    end if;

    select coalesce(jsonb_agg(item.value order by item.ordinality), '[]'::jsonb)
    into v_overrides
    from jsonb_array_elements(v_overrides) with ordinality item(value, ordinality)
    where nullif(item.value ->> 'occurrence_number', '')::integer is distinct from v_occurrence;

    v_overrides := v_overrides || jsonb_build_array(jsonb_build_object(
      'occurrence_number', v_occurrence,
      'date', (v_candidate_start at time zone v_timezone)::date,
      'start_time', to_char(v_candidate_start at time zone v_timezone, 'HH24:MI:SS'),
      'duration_minutes', v_duration,
      'reason', format(
        'Conflito resolvido pelo Smart Fit da Agenda: %s → %s.',
        to_char(v_original at time zone v_timezone, 'DD/MM/YYYY HH24:MI'),
        to_char(v_candidate_start at time zone v_timezone, 'DD/MM/YYYY HH24:MI')
      ),
      'source', 'synapse_smart_fit'
    ));

    v_input := jsonb_set(v_input, '{overrides}', v_overrides, true);
    v_adjustments := v_adjustments || jsonb_build_array(jsonb_build_object(
      'occurrenceNumber', v_occurrence,
      'reasonCode', v_reason_code,
      'originalStartTime', v_original,
      'startTime', v_candidate_start,
      'endTime', v_candidate_end,
      'durationMinutes', v_duration,
      'keepsFullDuration', coalesce((v_candidate ->> 'keepsFullDuration')::boolean, true),
      'distanceMinutes', nullif(v_candidate ->> 'distanceMinutes', '')::numeric
    ));

    -- Re-preview after each accepted override so the next Smart Fit sees the
    -- already customized siblings and never overlaps them.
    v_preview := private.preview_agenda_v2_plan(p_professional_id, v_input);
  end loop;

  return jsonb_build_object(
    'input', v_input,
    'preview', private.preview_agenda_v2_plan(p_professional_id, v_input),
    'adjustments', v_adjustments
  );
end;
$function$;

create or replace function public.prepare_agenda_action_plan_internal(
  p_actor_user_id uuid,
  p_input jsonb,
  p_provenance jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_input jsonb := coalesce(p_input, '{}'::jsonb);
  v_fixed jsonb;
  v_plan jsonb;
  v_parent_plan_id uuid;
  v_parent_plan_version integer;
  v_parent_args jsonb;
  v_parent_matches integer := 0;
  v_correlation text := coalesce(p_provenance ->> 'correlation_id', '');
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users actor where actor.id = p_actor_user_id) then
    raise exception 'Actor not found' using errcode = 'P0002';
  end if;

  begin
    if v_correlation ~ '^[0-9a-fA-F-]{36}:[0-9]+$' then
      v_parent_plan_id := split_part(v_correlation, ':', 1)::uuid;
      v_parent_plan_version := split_part(v_correlation, ':', 2)::integer;
    end if;
  exception when invalid_text_representation then
    v_parent_plan_id := null;
    v_parent_plan_version := null;
  end;

  if v_parent_plan_id is not null and v_parent_plan_version is not null then
    select count(*) into v_parent_matches
    from public.synapse_composite_action_plans parent
    cross join lateral jsonb_array_elements(coalesce(parent.steps_internal, '[]'::jsonb)) step(value)
    where parent.plan_id = v_parent_plan_id
      and parent.plan_version = v_parent_plan_version
      and parent.professional_id = p_actor_user_id
      and step.value ->> 'toolName' = 'create_appointment';

    if v_parent_matches = 1 then
      select step.value -> 'arguments' into v_parent_args
      from public.synapse_composite_action_plans parent
      cross join lateral jsonb_array_elements(coalesce(parent.steps_internal, '[]'::jsonb)) step(value)
      where parent.plan_id = v_parent_plan_id
        and parent.plan_version = v_parent_plan_version
        and parent.professional_id = p_actor_user_id
        and step.value ->> 'toolName' = 'create_appointment'
      limit 1;
    end if;

    if v_parent_matches = 1 and jsonb_typeof(v_parent_args) = 'object' then
      v_input := jsonb_set(
        v_input,
        '{financial}',
        coalesce(v_input -> 'financial', '{}'::jsonb)
          || jsonb_strip_nulls(jsonb_build_object(
            'mode', coalesce(
              nullif(v_parent_args ->> 'financial_mode', ''),
              v_parent_args #>> '{financial,mode}',
              v_input #>> '{financial,mode}'
            ),
            'value_per_session', coalesce(
              nullif(v_parent_args ->> 'value_per_session', '')::numeric,
              nullif(v_parent_args ->> 'amount', '')::numeric,
              nullif(v_parent_args #>> '{financial,value_per_session}', '')::numeric,
              nullif(v_input #>> '{financial,value_per_session}', '')::numeric,
              0
            ),
            'charge_mode', coalesce(
              nullif(v_parent_args ->> 'charge_mode', ''),
              v_parent_args #>> '{financial,charge_mode}',
              v_input #>> '{financial,charge_mode}',
              'per_occurrence'
            ),
            'create_charge', coalesce(
              (v_parent_args ->> 'create_charge')::boolean,
              (v_parent_args #>> '{financial,create_charge}')::boolean,
              (v_input #>> '{financial,create_charge}')::boolean,
              false
            ),
            'transaction_method', coalesce(
              nullif(v_parent_args ->> 'transaction_method', ''),
              nullif(v_parent_args ->> 'payment_method', ''),
              v_parent_args #>> '{financial,transaction_method}',
              v_parent_args #>> '{financial,payment_method}',
              v_input #>> '{financial,transaction_method}',
              v_input #>> '{financial,payment_method}',
              'patient_choice'
            ),
            'payment_method', coalesce(
              nullif(v_parent_args ->> 'payment_method', ''),
              nullif(v_parent_args ->> 'transaction_method', ''),
              v_parent_args #>> '{financial,payment_method}',
              v_parent_args #>> '{financial,transaction_method}',
              v_input #>> '{financial,payment_method}',
              v_input #>> '{financial,transaction_method}',
              'patient_choice'
            ),
            'installments', greatest(1, least(24, coalesce(
              nullif(v_parent_args ->> 'installments', '')::integer,
              nullif(v_parent_args #>> '{financial,installments}', '')::integer,
              nullif(v_input #>> '{financial,installments}', '')::integer,
              1
            ))),
            'due_days_before', greatest(0, least(365, coalesce(
              nullif(v_parent_args ->> 'due_days_before', '')::integer,
              nullif(v_parent_args #>> '{financial,due_days_before}', '')::integer,
              nullif(v_input #>> '{financial,due_days_before}', '')::integer,
              0
            ))),
            'insurance_agreement_id', coalesce(
              nullif(v_parent_args ->> 'insurance_agreement_id', ''),
              nullif(v_parent_args #>> '{financial,insurance_agreement_id}', ''),
              nullif(v_input #>> '{financial,insurance_agreement_id}', '')
            ),
            'insurance_agreement_name', coalesce(
              nullif(v_parent_args ->> 'insurance_agreement_name', ''),
              nullif(v_parent_args #>> '{financial,insurance_agreement_name}', ''),
              nullif(v_input #>> '{financial,insurance_agreement_name}', '')
            )
          )),
        true
      );
    end if;
  end if;

  perform set_config('request.jwt.claim.sub', p_actor_user_id::text, true);
  v_fixed := private.synapse_autofix_agenda_v2_input(p_actor_user_id, v_input);
  v_plan := public.prepare_agenda_action_plan(
    'create_series_v2',
    v_fixed -> 'input',
    coalesce(p_provenance, '{}'::jsonb),
    p_idempotency_key
  );

  return v_plan || jsonb_build_object(
    'autoFitAdjustments', coalesce(v_fixed -> 'adjustments', '[]'::jsonb)
  );
end;
$function$;
