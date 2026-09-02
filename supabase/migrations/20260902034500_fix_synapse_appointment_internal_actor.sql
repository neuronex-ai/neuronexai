-- Keep the service-only Synapse appointment executor authenticated as the
-- professional whose already-reviewed plan is being executed.
--
-- The internal wrapper receives p_actor_user_id, but the legacy appointment
-- core eventually calls create_appointment_series_with_package(), which reads
-- auth.uid(). Service-role RPC calls do not automatically populate that value.
-- Agenda v2 already propagates the actor this way; mirror that behavior here
-- without relaxing any existing service-role, plan ownership, hash or version
-- checks.

create or replace function public.execute_appointment_action_plan_internal(
  p_actor_user_id uuid,
  p_plan_id uuid,
  p_plan_version integer,
  p_plan_hash text,
  p_tool_call_id text default null,
  p_correlation_id text default null,
  p_voice_session_id uuid default null,
  p_origin_channel text default null
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
    p_tool_call_id,
    p_correlation_id,
    p_voice_session_id,
    p_origin_channel
  );
end;
$function$;
