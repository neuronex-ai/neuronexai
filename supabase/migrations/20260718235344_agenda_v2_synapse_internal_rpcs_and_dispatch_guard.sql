-- Trusted Synapse entrypoints preserve the actor identity while the Edge
-- Function uses the service role. The user-facing RPCs remain unchanged.
create or replace function public.prepare_agenda_action_plan_internal(
  p_actor_user_id uuid,
  p_input jsonb,
  p_provenance jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users actor where actor.id = p_actor_user_id) then
    raise exception 'Actor not found' using errcode = 'P0002';
  end if;
  perform set_config('request.jwt.claim.sub', p_actor_user_id::text, true);
  return public.prepare_agenda_action_plan(
    'create_series_v2',
    p_input,
    coalesce(p_provenance, '{}'::jsonb),
    p_idempotency_key
  );
end;
$$;

create or replace function public.execute_agenda_action_plan_internal(
  p_actor_user_id uuid,
  p_plan_id uuid,
  p_plan_version integer,
  p_plan_hash text,
  p_confirmation_channel text default 'synapse_text'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users actor where actor.id = p_actor_user_id) then
    raise exception 'Actor not found' using errcode = 'P0002';
  end if;
  perform set_config('request.jwt.claim.sub', p_actor_user_id::text, true);
  return public.execute_agenda_action_plan(
    p_plan_id,
    p_plan_version,
    p_plan_hash,
    p_confirmation_channel
  );
end;
$$;

revoke all on function public.prepare_agenda_action_plan_internal(uuid, jsonb, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.execute_agenda_action_plan_internal(uuid, uuid, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.prepare_agenda_action_plan_internal(uuid, jsonb, jsonb, text)
  to service_role;
grant execute on function public.execute_agenda_action_plan_internal(uuid, uuid, integer, text, text)
  to service_role;

-- The Cloud project currently rejects every Edge Function deployment because
-- its plan has reached the function limit. Keep queued offers intact, but do
-- not call the old worker with an unsupported payload until the updated worker
-- can be deployed from this repository.
select cron.unschedule(jobid)
from cron.job
where jobname = 'neuronex-waitlist-offer-dispatch';
