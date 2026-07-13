create table if not exists public.synapse_notes_agent_run_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.synapse_notes_agent_runs(id) on delete cascade,
  sequence integer not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint synapse_notes_agent_run_events_sequence_check check (sequence > 0),
  constraint synapse_notes_agent_run_events_type_check check (
    event_type in ('node_reveal', 'edge_reveal', 'focus_node', 'focus_link', 'complete', 'error')
  ),
  constraint synapse_notes_agent_run_events_payload_check check (jsonb_typeof(payload) = 'object'),
  constraint synapse_notes_agent_run_events_run_sequence_key unique (run_id, sequence)
);

create index if not exists synapse_notes_agent_run_events_run_sequence_idx
  on public.synapse_notes_agent_run_events(run_id, sequence);

alter table public.synapse_notes_agent_run_events enable row level security;

drop policy if exists "Users can view own Synapse notes run events"
  on public.synapse_notes_agent_run_events;

create policy "Users can view own Synapse notes run events"
  on public.synapse_notes_agent_run_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.synapse_notes_agent_runs run
      where run.id = synapse_notes_agent_run_events.run_id
        and run.user_id = (select auth.uid())
    )
  );

revoke all on public.synapse_notes_agent_run_events from anon;
revoke all on public.synapse_notes_agent_run_events from authenticated;
grant select on public.synapse_notes_agent_run_events to authenticated;
grant all on public.synapse_notes_agent_run_events to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'synapse_notes_agent_run_events'
    )
  then
    alter publication supabase_realtime add table public.synapse_notes_agent_run_events;
  end if;
end $$;

create or replace function public.complete_synapse_neuroview_run(
  p_run_id uuid,
  p_user_id uuid,
  p_steps jsonb,
  p_trace jsonb,
  p_result jsonb,
  p_events jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event jsonb;
  v_sequence integer := 0;
begin
  perform 1
  from public.synapse_notes_agent_runs run
  where run.id = p_run_id
    and run.user_id = p_user_id
    and run.product = 'neuroview'
  for update;

  if not found then
    raise exception 'synapse_run_not_found' using errcode = 'P0002';
  end if;

  delete from public.synapse_notes_agent_run_events where run_id = p_run_id;
  for v_event in select value from jsonb_array_elements(coalesce(p_events, '[]'::jsonb))
  loop
    v_sequence := v_sequence + 1;
    insert into public.synapse_notes_agent_run_events(run_id, sequence, event_type, payload)
    values (p_run_id, v_sequence, v_event->>'type', coalesce(v_event->'payload', '{}'::jsonb));
  end loop;

  update public.synapse_notes_agent_runs
  set status = 'completed', progress = 100, steps = p_steps, trace = p_trace,
      result = p_result, error_message = null, updated_at = now(), completed_at = now()
  where id = p_run_id and user_id = p_user_id;

  return jsonb_build_object('run_id', p_run_id, 'event_count', v_sequence);
end;
$$;

create or replace function public.commit_synapse_neuroflow_run(
  p_run_id uuid,
  p_user_id uuid,
  p_title text,
  p_description text,
  p_workflow jsonb,
  p_steps jsonb,
  p_trace jsonb,
  p_events jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_patient_id uuid;
  v_flow_id uuid;
  v_event jsonb;
  v_sequence integer := 0;
begin
  select run.patient_id
  into v_patient_id
  from public.synapse_notes_agent_runs run
  where run.id = p_run_id
    and run.user_id = p_user_id
    and run.product = 'neuroflow'
  for update;

  if not found then
    raise exception 'synapse_run_not_found' using errcode = 'P0002';
  end if;
  if coalesce(p_workflow->>'schema', '') <> 'neuroflow.workflow.v2' then
    raise exception 'invalid_neuroflow_schema' using errcode = '22023';
  end if;

  insert into public.neuro_flows(
    user_id, patient_id, title, description, tags, workflow,
    workflow_schema_version, save_revision, last_saved_at
  )
  values (
    p_user_id, v_patient_id, left(p_title, 180), left(p_description, 1200),
    array['Synapse', 'NeuroFlow', 'Paciente']::text[], p_workflow,
    'neuroflow.workflow.v2', 0, now()
  )
  returning id into v_flow_id;

  delete from public.synapse_notes_agent_run_events where run_id = p_run_id;
  for v_event in select value from jsonb_array_elements(coalesce(p_events, '[]'::jsonb))
  loop
    v_sequence := v_sequence + 1;
    insert into public.synapse_notes_agent_run_events(run_id, sequence, event_type, payload)
    values (p_run_id, v_sequence, v_event->>'type', coalesce(v_event->'payload', '{}'::jsonb));
  end loop;

  update public.synapse_notes_agent_runs
  set status = 'completed', progress = 100, steps = p_steps, trace = p_trace,
      result = jsonb_build_object(
        'workflow', p_workflow,
        'flow', jsonb_build_object('id', v_flow_id, 'title', p_title, 'patient_id', v_patient_id)
      ),
      target_flow_id = v_flow_id, error_message = null, updated_at = now(), completed_at = now()
  where id = p_run_id and user_id = p_user_id;

  return jsonb_build_object('id', v_flow_id, 'title', p_title, 'patient_id', v_patient_id);
end;
$$;

create or replace function public.commit_synapse_neuropulse_run(
  p_run_id uuid,
  p_user_id uuid,
  p_title text,
  p_note_content text,
  p_entry_data jsonb,
  p_steps jsonb,
  p_trace jsonb,
  p_events jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_patient_id uuid;
  v_note_id uuid := gen_random_uuid();
  v_entry_id uuid := gen_random_uuid();
  v_event jsonb;
  v_sequence integer := 0;
begin
  select run.patient_id
  into v_patient_id
  from public.synapse_notes_agent_runs run
  where run.id = p_run_id
    and run.user_id = p_user_id
    and run.product = 'neuropulse'
  for update;

  if not found then
    raise exception 'synapse_run_not_found' using errcode = 'P0002';
  end if;

  insert into public.personal_notes(
    id, user_id, title, content, tags, patient_id, module_id, reference_date
  )
  values (
    v_note_id, p_user_id, left(p_title, 180), p_note_content,
    array['NeuroPulse', 'Mermaid', 'Synapse']::text[], v_patient_id, null, now()
  );

  insert into public.neuro_pulse_entries(id, user_id, title, data)
  values (
    v_entry_id, p_user_id, left(p_title, 180),
    coalesce(p_entry_data, '{}'::jsonb) || jsonb_build_object('note_id', v_note_id, 'patient_id', v_patient_id)
  );

  delete from public.synapse_notes_agent_run_events where run_id = p_run_id;
  for v_event in select value from jsonb_array_elements(coalesce(p_events, '[]'::jsonb))
  loop
    v_sequence := v_sequence + 1;
    insert into public.synapse_notes_agent_run_events(run_id, sequence, event_type, payload)
    values (p_run_id, v_sequence, v_event->>'type', coalesce(v_event->'payload', '{}'::jsonb));
  end loop;

  update public.synapse_notes_agent_runs
  set status = 'completed', progress = 100, steps = p_steps, trace = p_trace,
      result = coalesce(p_entry_data, '{}'::jsonb) || jsonb_build_object(
        'note', jsonb_build_object('id', v_note_id, 'title', p_title),
        'entry', jsonb_build_object('id', v_entry_id, 'title', p_title)
      ),
      note_id = v_note_id, pulse_entry_id = v_entry_id,
      error_message = null, updated_at = now(), completed_at = now()
  where id = p_run_id and user_id = p_user_id;

  return jsonb_build_object(
    'note', jsonb_build_object('id', v_note_id, 'title', p_title),
    'entry', jsonb_build_object('id', v_entry_id, 'title', p_title)
  );
end;
$$;

revoke all on function public.complete_synapse_neuroview_run(uuid, uuid, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.commit_synapse_neuroflow_run(uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.commit_synapse_neuropulse_run(uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.complete_synapse_neuroview_run(uuid, uuid, jsonb, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.commit_synapse_neuroflow_run(uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.commit_synapse_neuropulse_run(uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb) to service_role;

comment on table public.synapse_notes_agent_run_events is
  'Ordered, user-owned interaction protocol replayed by NeuroView, NeuroFlow and NeuroPulse.';
