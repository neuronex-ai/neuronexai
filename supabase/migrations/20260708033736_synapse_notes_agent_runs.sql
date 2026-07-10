create table if not exists public.synapse_notes_agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product text not null,
  patient_id uuid references public.patients(id) on delete set null,
  chat_session_id uuid references public.chat_sessions(id) on delete set null,
  status text not null default 'queued',
  intent text,
  progress integer not null default 0,
  steps jsonb not null default '[]'::jsonb,
  trace jsonb not null default '{"steps":[],"nodes":[],"links":[]}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  target_flow_id uuid references public.neuro_flows(id) on delete set null,
  pulse_entry_id uuid references public.neuro_pulse_entries(id) on delete set null,
  note_id uuid references public.personal_notes(id) on delete set null,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint synapse_notes_agent_runs_product_check
    check (product in ('neuroview', 'neuroflow', 'neuropulse')),
  constraint synapse_notes_agent_runs_status_check
    check (status in ('queued', 'gathering', 'reasoning', 'drafting', 'applying', 'completed', 'failed', 'cancelled')),
  constraint synapse_notes_agent_runs_progress_check
    check (progress between 0 and 100)
);

create index if not exists synapse_notes_agent_runs_user_updated_idx
  on public.synapse_notes_agent_runs(user_id, updated_at desc);

create index if not exists synapse_notes_agent_runs_user_patient_idx
  on public.synapse_notes_agent_runs(user_id, patient_id, updated_at desc)
  where patient_id is not null;

create index if not exists synapse_notes_agent_runs_status_idx
  on public.synapse_notes_agent_runs(user_id, status, updated_at desc);

alter table public.synapse_notes_agent_runs enable row level security;

drop policy if exists "Users can view own Synapse notes agent runs"
  on public.synapse_notes_agent_runs;

create policy "Users can view own Synapse notes agent runs"
  on public.synapse_notes_agent_runs
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.synapse_notes_agent_runs from anon;
revoke all on public.synapse_notes_agent_runs from authenticated;
grant select on public.synapse_notes_agent_runs to authenticated;
grant all on public.synapse_notes_agent_runs to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'synapse_notes_agent_runs'
    )
  then
    alter publication supabase_realtime add table public.synapse_notes_agent_runs;
  end if;
end $$;

comment on table public.synapse_notes_agent_runs is
  'User-owned realtime progress log for Synapse agent runs inside Notes Desktop NeuroView, NeuroFlow and NeuroPulse.';
