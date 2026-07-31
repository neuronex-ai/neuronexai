begin;

do $test$
declare
  v_rls_enabled boolean;
  v_function_definition text;
  v_trigger_count integer;
begin
  if to_regclass('private.appointment_effect_outbox') is null then
    raise exception 'private appointment effect outbox is missing';
  end if;

  select relrowsecurity into v_rls_enabled
  from pg_class
  where oid = 'private.appointment_effect_outbox'::regclass;

  if not coalesce(v_rls_enabled, false) then
    raise exception 'appointment effect outbox must keep RLS enabled';
  end if;

  if has_table_privilege(
    'authenticated',
    'private.appointment_effect_outbox',
    'select'
  ) or has_table_privilege(
    'service_role',
    'private.appointment_effect_outbox',
    'select'
  ) then
    raise exception 'workers or clients can read the private outbox directly';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.claim_appointment_effect_outbox(integer,text,uuid)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.claim_appointment_effect_outbox(integer,text,uuid)',
    'execute'
  ) then
    raise exception 'appointment effect claim privileges are unsafe';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.patch_appointment_google_sync_effect(uuid,integer,uuid,uuid,text,text,text,text)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.patch_appointment_google_sync_effect(uuid,integer,uuid,uuid,text,text,text,text)',
    'execute'
  ) then
    raise exception 'Google sync patch privileges are unsafe';
  end if;

  select pg_get_functiondef(
    'public.claim_appointment_effect_outbox(integer,text,uuid)'::regprocedure
  ) into v_function_definition;

  if position('FOR UPDATE SKIP LOCKED' in upper(v_function_definition)) = 0 then
    raise exception 'appointment effect claim does not use SKIP LOCKED';
  end if;
  if position('PREDECESSOR.QUEUE_SEQUENCE < EFFECT.QUEUE_SEQUENCE' in upper(v_function_definition)) = 0
    or position('ORDER BY EFFECT.NEXT_ATTEMPT_AT, EFFECT.QUEUE_SEQUENCE' in upper(v_function_definition)) = 0
  then
    raise exception 'appointment effect claim does not preserve deterministic FIFO order';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'private'
      and tablename = 'appointment_effect_outbox'
      and indexname = 'appointment_effect_outbox_ready_idx'
      and indexdef ilike '%where%status%pending%failed%'
  ) then
    raise exception 'appointment effect ready partial index is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'private'
      and table_name = 'appointment_effect_outbox'
      and column_name = 'queue_sequence'
      and is_identity = 'YES'
  ) then
    raise exception 'appointment effect monotonic queue sequence is missing';
  end if;

  select count(*) into v_trigger_count
  from pg_trigger trigger_row
  where trigger_row.tgrelid = 'public.appointments'::regclass
    and not trigger_row.tgisinternal
    and trigger_row.tgname in (
      'appointments_20_prepare_external_effect_state_insert',
      'appointments_20_prepare_external_effect_state_update',
      'appointments_80_enqueue_external_effects_insert',
      'appointments_80_enqueue_external_effects_update',
      'appointments_persist_series_default_config',
      'agenda_v2_apply_materialized_series_override',
      'appointments_persist_materialized_occurrence_override'
    );

  if v_trigger_count <> 7 then
    raise exception 'Agenda hardening appointment triggers are incomplete';
  end if;

  if not private.explicit_neurofinance_plan_is_confirmable(jsonb_build_object(
    'action', 'create',
    'input', jsonb_build_object(
      'financial', jsonb_build_object('mode', 'neurofinance')
    ),
    'agenda', jsonb_build_object('hasConflicts', false),
    'financial', jsonb_build_object(
      'mode', 'neurofinance',
      'value_per_session', 150,
      'unsafeExternalFacts', false,
      'packageReviewRequired', false
    )
  )) then
    raise exception 'explicit valid NeuroFinance decision is not confirmable';
  end if;

  if private.explicit_neurofinance_plan_is_confirmable(jsonb_build_object(
    'action', 'create',
    'input', jsonb_build_object(
      'financial', jsonb_build_object('mode', 'neurofinance')
    ),
    'agenda', jsonb_build_object('hasConflicts', true),
    'financial', jsonb_build_object(
      'mode', 'neurofinance',
      'value_per_session', 150
    )
  )) then
    raise exception 'NeuroFinance conflict review was bypassed';
  end if;

  select pg_get_functiondef(
    'private.preview_agenda_v2_plan(uuid,jsonb)'::regprocedure
  ) into v_function_definition;
  if position('NOT V_IS_EVENT' in upper(v_function_definition)) = 0
    or position('V_START <= NOW()' in upper(v_function_definition)) = 0
    or position('APPOINTMENT_CONFLICT' in upper(v_function_definition)) = 0
  then
    raise exception 'Agenda V2 event validation does not preserve safety checks';
  end if;

  select pg_get_functiondef(
    'private.validate_appointment_series(uuid,timestamptz,timestamptz,text,integer)'::regprocedure
  ) into v_function_definition;
  if position('V_ALLOW_OUTSIDE_WORKING_HOURS' in upper(v_function_definition)) = 0
    or position('PAST_TIME' in upper(v_function_definition)) = 0
    or position('APPOINTMENT_CONFLICT' in upper(v_function_definition)) = 0
  then
    raise exception 'single event validation does not preserve safety checks';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'professional_waitlist_offers'
      and column_name = 'appointment_snapshot'
      and data_type = 'jsonb'
  ) then
    raise exception 'waitlist appointment snapshot is missing';
  end if;

  if to_regprocedure(
    'private.execute_appointment_action_plan_core_20260716(uuid,uuid,integer,text,text,uuid)'
  ) is null or to_regprocedure(
    'private.prepare_appointment_action_plan_core_20260716(uuid,text,jsonb,jsonb,text,uuid)'
  ) is null or to_regprocedure(
    'private.generate_agenda_v2_occurrences_20260718(uuid,jsonb)'
  ) is null then
    raise exception 'wrapped canonical Agenda functions are missing';
  end if;
end
$test$;

rollback;
