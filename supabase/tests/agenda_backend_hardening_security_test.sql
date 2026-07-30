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

  select count(*) into v_trigger_count
  from pg_trigger trigger_row
  where trigger_row.tgrelid = 'public.appointments'::regclass
    and not trigger_row.tgisinternal
    and trigger_row.tgname in (
      'appointments_20_prepare_external_effect_state',
      'appointments_enqueue_external_effects',
      'appointments_persist_series_default_config',
      'agenda_v2_apply_materialized_series_override',
      'appointments_persist_materialized_occurrence_override'
    );

  if v_trigger_count <> 5 then
    raise exception 'Agenda hardening appointment triggers are incomplete';
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
    'private.generate_agenda_v2_occurrences_20260718(uuid,jsonb)'
  ) is null then
    raise exception 'wrapped canonical Agenda functions are missing';
  end if;
end
$test$;

rollback;
