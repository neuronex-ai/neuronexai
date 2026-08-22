-- Keep executable plan details server-owned while allowing the signed-in
-- professional to recover the public review payload for their own plan.
alter table public.synapse_composite_action_plans enable row level security;

drop policy if exists "Professionals can read own Synapse action plans"
  on public.synapse_composite_action_plans;

create policy "Professionals can read own Synapse action plans"
on public.synapse_composite_action_plans
for select
to authenticated
using (professional_id = (select auth.uid()));

revoke all on table public.synapse_composite_action_plans from anon;
revoke all on table public.synapse_composite_action_plans from authenticated;

grant select (
  plan_id,
  plan_version,
  plan_hash,
  confirmation_policy,
  review_public,
  expires_at,
  updated_at,
  conversation_id,
  status
) on public.synapse_composite_action_plans to authenticated;

-- Edge Functions use the service role for plan creation and execution.
grant all on table public.synapse_composite_action_plans to service_role;
