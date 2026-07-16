begin;

do $test$
declare
  v_authenticated_can_insert boolean;
  v_authenticated_can_update boolean;
  v_authenticated_can_delete boolean;
  v_internal_execute boolean;
  v_trigger_count integer;
begin
  if to_regclass('public.appointment_action_plans') is null
    or to_regclass('public.appointment_action_plan_events') is null
  then
    raise exception 'appointment action plan tables are missing';
  end if;

  select
    has_table_privilege('authenticated', 'public.appointment_action_plans', 'insert'),
    has_table_privilege('authenticated', 'public.appointment_action_plans', 'update'),
    has_table_privilege('authenticated', 'public.appointment_action_plans', 'delete')
  into
    v_authenticated_can_insert,
    v_authenticated_can_update,
    v_authenticated_can_delete;

  if v_authenticated_can_insert or v_authenticated_can_update or v_authenticated_can_delete then
    raise exception 'authenticated role can write appointment plans directly';
  end if;

  select has_function_privilege(
    'service_role',
    'public.execute_appointment_action_plan_internal(uuid,uuid,integer,text,text,uuid)',
    'execute'
  ) into v_internal_execute;
  if not v_internal_execute then
    raise exception 'service role cannot execute the internal appointment plan RPC';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.execute_appointment_action_plan_internal(uuid,uuid,integer,text,text,uuid)',
    'execute'
  ) then
    raise exception 'authenticated role can execute the internal appointment plan RPC';
  end if;

  select count(*) into v_trigger_count
  from pg_trigger trigger_row
  where trigger_row.tgrelid in (
    'public.appointment_action_plans'::regclass,
    'public.appointment_action_plan_events'::regclass
  )
    and not trigger_row.tgisinternal
    and trigger_row.tgname in (
      'appointment_action_plans_guard_mutation',
      'appointment_action_plan_events_immutable'
    );
  if v_trigger_count <> 2 then
    raise exception 'immutable plan/event triggers are incomplete';
  end if;

  if not exists (
    select 1
    from pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = 'appointment_action_plans'
      and policy.policyname = 'appointment_action_plans_owner_select'
  ) then
    raise exception 'owner-only plan read policy is missing';
  end if;
end
$test$;

rollback;
