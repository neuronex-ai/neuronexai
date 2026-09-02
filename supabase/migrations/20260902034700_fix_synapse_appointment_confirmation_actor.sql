-- The current Synapse appointment runtime calls the six-argument overload of
-- execute_appointment_action_plan_internal. Propagate the reviewed professional
-- into auth.uid() before entering the canonical appointment core, matching the
-- service-side actor propagation already used by Agenda v2.

create or replace function public.execute_appointment_action_plan_internal(
  p_actor_user_id uuid,
  p_plan_id uuid,
  p_plan_version integer,
  p_plan_hash text,
  p_confirmation_channel text,
  p_conversation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform private.assert_appointment_plan_service_role();

  if not exists (
    select 1
    from auth.users actor
    where actor.id = p_actor_user_id
  ) then
    raise exception 'Actor not found' using errcode = 'P0002';
  end if;

  perform set_config('request.jwt.claim.sub', p_actor_user_id::text, true);

  return private.execute_appointment_action_plan_core(
    p_actor_user_id,
    p_plan_id,
    p_plan_version,
    p_plan_hash,
    p_confirmation_channel,
    p_conversation_id
  );
end;
$function$;
