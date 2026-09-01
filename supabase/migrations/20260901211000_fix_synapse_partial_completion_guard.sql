create or replace function private.guard_synapse_composite_action_plan_mutation()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'Synapse composite action plans cannot be deleted';
  end if;

  if old.plan_id is distinct from new.plan_id
    or old.plan_version is distinct from new.plan_version
    or old.plan_hash is distinct from new.plan_hash
    or old.professional_id is distinct from new.professional_id
    or old.conversation_id is distinct from new.conversation_id
    or old.voice_session_id is distinct from new.voice_session_id
    or old.title is distinct from new.title
    or old.step_count is distinct from new.step_count
    or old.steps_internal is distinct from new.steps_internal
    or old.review_public is distinct from new.review_public
    or old.created_at is distinct from new.created_at
    or old.expires_at is distinct from new.expires_at
  then
    raise exception 'Synapse composite action plan identity and steps are immutable';
  end if;

  if old.status in (
    'completed', 'completed_with_warnings', 'failed', 'partial', 'partially_completed',
    'manual_review_required', 'cancelled', 'superseded', 'expired'
  ) and new.status is distinct from old.status then
    raise exception 'Synapse composite action plan is terminal';
  end if;

  if not (
    (old.status = 'awaiting_confirmation' and new.status in (
      'executing', 'cancelled', 'superseded', 'expired'
    ))
    or (old.status = 'executing' and new.status in (
      'executing', 'completed', 'completed_with_warnings', 'failed',
      'partial', 'partially_completed', 'manual_review_required'
    ))
    or new.status = old.status
  ) then
    raise exception 'Invalid Synapse composite action plan transition';
  end if;

  new.updated_at := now();
  return new;
end;
$function$;