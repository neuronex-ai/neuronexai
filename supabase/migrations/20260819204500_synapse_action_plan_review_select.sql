-- P0: the Desktop must be able to recover a pending Synapse review after
-- refresh/reconnect without exposing internal executable payloads to other users.
-- The frontend selects review_public and plan identity fields only; RLS remains
-- the ownership boundary for the underlying table.

DROP POLICY IF EXISTS "Professionals can read own Synapse action plans"
ON public.synapse_composite_action_plans;

CREATE POLICY "Professionals can read own Synapse action plans"
ON public.synapse_composite_action_plans
FOR SELECT
TO authenticated
USING (professional_id = auth.uid());
