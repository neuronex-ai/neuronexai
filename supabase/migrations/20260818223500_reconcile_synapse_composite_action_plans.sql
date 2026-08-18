-- Reconcile the Synapse composite-action plan table that already exists in the
-- Sandbox but is not represented in Git. This migration is deliberately
-- additive/idempotent and does not replay the divergent migration backlog.

create table if not exists public.synapse_composite_action_plans (
  plan_id uuid not null default gen_random_uuid(),
  plan_version integer not null default 1,
  plan_hash text not null,
  professional_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid not null,
  voice_session_id uuid,
  title text not null,
  status text not null default 'awaiting_confirmation',
  step_count integer not null,
  steps_internal jsonb not null,
  review_public jsonb not null,
  result_internal jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '20 minutes'),
  confirmed_at timestamptz,
  executed_at timestamptz,
  primary key (plan_id, plan_version)
);

alter table public.synapse_composite_action_plans
  add column if not exists idempotency_key text,
  add column if not exists intent text,
  add column if not exists spoken_summary text,
  add column if not exists confirmation_policy text not null default 'voice',
  add column if not exists risk_level text not null default 'normal',
  add column if not exists capability_version integer not null default 1;

-- The table is empty in the audited Sandbox. Keep the statement safe for any
-- environment where an older producer may already have inserted rows.
update public.synapse_composite_action_plans
set idempotency_key = coalesce(
  nullif(btrim(idempotency_key), ''),
  encode(digest(
    concat_ws(':', professional_id::text, conversation_id::text, plan_id::text),
    'sha256'
  ), 'hex')
)
where idempotency_key is null or btrim(idempotency_key) = '';

alter table public.synapse_composite_action_plans
  alter column idempotency_key set not null;

alter table public.synapse_composite_action_plans
  drop constraint if exists synapse_composite_action_plans_step_count_check;

alter table public.synapse_composite_action_plans
  add constraint synapse_composite_action_plans_step_count_check
  check (step_count >= 1 and step_count <= 12);

alter table public.synapse_composite_action_plans
  drop constraint if exists synapse_composite_action_plans_status_check;

alter table public.synapse_composite_action_plans
  add constraint synapse_composite_action_plans_status_check
  check (status = any (array[
    'awaiting_confirmation'::text,
    'executing'::text,
    'completed'::text,
    'completed_with_warnings'::text,
    'failed'::text,
    'partial'::text,
    'partially_completed'::text,
    'manual_review_required'::text,
    'cancelled'::text,
    'superseded'::text,
    'expired'::text
  ]));

alter table public.synapse_composite_action_plans
  drop constraint if exists synapse_composite_action_plans_idempotency_key_check;
alter table public.synapse_composite_action_plans
  add constraint synapse_composite_action_plans_idempotency_key_check
  check (char_length(btrim(idempotency_key)) between 16 and 180);

alter table public.synapse_composite_action_plans
  drop constraint if exists synapse_composite_action_plans_confirmation_policy_check;
alter table public.synapse_composite_action_plans
  add constraint synapse_composite_action_plans_confirmation_policy_check
  check (confirmation_policy in ('direct', 'voice', 'opaque'));

alter table public.synapse_composite_action_plans
  drop constraint if exists synapse_composite_action_plans_risk_level_check;
alter table public.synapse_composite_action_plans
  add constraint synapse_composite_action_plans_risk_level_check
  check (risk_level in ('normal', 'critical', 'neurofinance'));

alter table public.synapse_composite_action_plans
  drop constraint if exists synapse_composite_action_plans_capability_version_check;
alter table public.synapse_composite_action_plans
  add constraint synapse_composite_action_plans_capability_version_check
  check (capability_version between 1 and 100);

create unique index if not exists synapse_composite_action_plans_idempotency_version_uidx
  on public.synapse_composite_action_plans (professional_id, idempotency_key, plan_version);

create index if not exists synapse_composite_action_plans_plan_latest_idx
  on public.synapse_composite_action_plans (plan_id, plan_version desc);

create index if not exists synapse_composite_action_plans_owner_status_idx
  on public.synapse_composite_action_plans (professional_id, conversation_id, status, created_at desc);

create index if not exists synapse_composite_action_plans_expiry_idx
  on public.synapse_composite_action_plans (expires_at)
  where status = 'awaiting_confirmation';

alter table public.synapse_composite_action_plans enable row level security;

comment on table public.synapse_composite_action_plans is
  'Server-owned immutable versions of multi-step Synapse action plans. UI receives only review_public; steps_internal/result_internal remain server-side.';
comment on column public.synapse_composite_action_plans.idempotency_key is
  'Stable command/plan idempotency key; reused across versions while plan_version changes.';
comment on column public.synapse_composite_action_plans.plan_hash is
  'SHA-256 of the executable plan version. Confirmation is valid only for the visible/current hash.';
