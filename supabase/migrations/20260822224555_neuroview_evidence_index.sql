create schema if not exists private;

create table if not exists public.neuroview_evidence_index (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid,
  source_type text not null check (source_type in (
    'personal_note', 'flow', 'session_note', 'mood',
    'goal', 'anamnesis', 'appointment', 'reminder'
  )),
  source_id uuid not null,
  occurred_at timestamptz not null,
  updated_at timestamptz not null default now(),
  title text not null,
  tags text[] not null default '{}',
  reviewed boolean not null default true,
  is_actionable boolean not null default false,
  action_due_at timestamptz,
  action_completed boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, source_type, source_id)
);

create table if not exists public.neuroview_evidence_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in (
    'personal_note', 'flow', 'session_note', 'mood',
    'goal', 'anamnesis', 'appointment', 'reminder'
  )),
  source_id uuid not null,
  priority smallint not null default 0 check (priority between 0 and 100),
  is_pinned boolean not null default false,
  is_hidden boolean not null default false,
  theme_override text,
  updated_at timestamptz not null default now(),
  unique (user_id, source_type, source_id)
);

create index if not exists neuroview_evidence_user_patient_time_idx
  on public.neuroview_evidence_index (user_id, patient_id, occurred_at desc);
create index if not exists neuroview_evidence_user_source_idx
  on public.neuroview_evidence_index (user_id, source_type, updated_at desc);
create index if not exists neuroview_evidence_tags_idx
  on public.neuroview_evidence_index using gin (tags);
create index if not exists neuroview_override_user_source_idx
  on public.neuroview_evidence_overrides (user_id, source_type, source_id);

alter table public.neuroview_evidence_index enable row level security;
alter table public.neuroview_evidence_overrides enable row level security;

drop policy if exists "Professionals read their NeuroView evidence" on public.neuroview_evidence_index;
create policy "Professionals read their NeuroView evidence"
  on public.neuroview_evidence_index
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Professionals read their NeuroView overrides" on public.neuroview_evidence_overrides;
create policy "Professionals read their NeuroView overrides"
  on public.neuroview_evidence_overrides
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Professionals insert their NeuroView overrides" on public.neuroview_evidence_overrides;
create policy "Professionals insert their NeuroView overrides"
  on public.neuroview_evidence_overrides
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Professionals update their NeuroView overrides" on public.neuroview_evidence_overrides;
create policy "Professionals update their NeuroView overrides"
  on public.neuroview_evidence_overrides
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Professionals delete their NeuroView overrides" on public.neuroview_evidence_overrides;
create policy "Professionals delete their NeuroView overrides"
  on public.neuroview_evidence_overrides
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.neuroview_evidence_index from public, anon;
revoke all on table public.neuroview_evidence_overrides from public, anon;
grant select on table public.neuroview_evidence_index to authenticated;
grant select, insert, update, delete on table public.neuroview_evidence_overrides to authenticated;

create or replace function private.upsert_neuroview_evidence(
  p_table_name text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_user_id uuid;
  v_patient_id uuid;
  v_source_type text;
  v_source_id uuid;
  v_title text;
  v_occurred_at timestamptz;
  v_updated_at timestamptz;
  v_tags text[] := '{}';
  v_reviewed boolean := true;
  v_is_actionable boolean := false;
  v_action_due_at timestamptz;
  v_action_completed boolean := false;
  v_metadata jsonb := '{}'::jsonb;
  v_tag_payload jsonb := '[]'::jsonb;
begin
  v_source_id := nullif(p_payload ->> 'id', '')::uuid;
  v_user_id := nullif(p_payload ->> 'user_id', '')::uuid;
  v_patient_id := nullif(p_payload ->> 'patient_id', '')::uuid;

  case p_table_name
    when 'personal_notes' then
      v_source_type := 'personal_note';
      v_title := coalesce(nullif(p_payload ->> 'title', ''), 'Nota clínica');
      v_occurred_at := coalesce(
        nullif(p_payload ->> 'reference_date', '')::timestamptz,
        nullif(p_payload ->> 'updated_at', '')::timestamptz,
        nullif(p_payload ->> 'created_at', '')::timestamptz,
        now()
      );
      v_updated_at := coalesce(nullif(p_payload ->> 'updated_at', '')::timestamptz, v_occurred_at);
      v_tag_payload := case when jsonb_typeof(p_payload -> 'tags') = 'array' then p_payload -> 'tags' else '[]'::jsonb end;
      v_metadata := jsonb_build_object('referenceDate', p_payload ->> 'reference_date');

    when 'neuro_flows' then
      v_source_type := 'flow';
      v_title := coalesce(nullif(p_payload ->> 'title', ''), 'Fluxo clínico');
      v_occurred_at := coalesce(nullif(p_payload ->> 'updated_at', '')::timestamptz, now());
      v_updated_at := v_occurred_at;
      v_tag_payload := case when jsonb_typeof(p_payload -> 'tags') = 'array' then p_payload -> 'tags' else '[]'::jsonb end;

    when 'session_notes' then
      v_source_type := 'session_note';
      v_occurred_at := coalesce(nullif(p_payload ->> 'created_at', '')::timestamptz, now());
      v_updated_at := coalesce(
        nullif(p_payload ->> 'ai_summary_edited_at', '')::timestamptz,
        nullif(p_payload ->> 'confirmed_at', '')::timestamptz,
        v_occurred_at
      );
      v_title := 'Sessão clínica • ' || to_char(v_occurred_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY');
      v_reviewed := coalesce(p_payload ->> 'review_status', 'pending_review') = 'confirmed';
      v_is_actionable := not v_reviewed;
      v_action_due_at := nullif(p_payload ->> 'review_due_at', '')::timestamptz;
      v_action_completed := v_reviewed;
      if v_reviewed and jsonb_typeof(p_payload #> '{ai_summary,topics}') = 'array' then
        v_tag_payload := p_payload #> '{ai_summary,topics}';
      end if;
      v_metadata := jsonb_strip_nulls(jsonb_build_object(
        'reviewStatus', p_payload ->> 'review_status',
        'sentiment', case when v_reviewed then p_payload #>> '{ai_summary,sentiment}' end,
        'nextSteps', case when v_reviewed and jsonb_typeof(p_payload #> '{ai_summary,next_steps}') = 'array'
          then p_payload #> '{ai_summary,next_steps}' else '[]'::jsonb end
      ));

    when 'patient_mood_logs' then
      v_source_type := 'mood';
      v_occurred_at := coalesce(nullif(p_payload ->> 'created_at', '')::timestamptz, now());
      v_updated_at := v_occurred_at;
      v_title := 'Humor registrado • ' || coalesce(p_payload ->> 'mood_score', '—');
      v_tag_payload := case when jsonb_typeof(p_payload -> 'tags') = 'array' then p_payload -> 'tags' else '[]'::jsonb end;
      v_metadata := jsonb_build_object(
        'moodScore', nullif(p_payload ->> 'mood_score', '')::numeric,
        'source', p_payload ->> 'source'
      );

    when 'patient_goals' then
      v_source_type := 'goal';
      v_title := coalesce(nullif(p_payload ->> 'description', ''), 'Meta terapêutica');
      v_occurred_at := coalesce(nullif(p_payload ->> 'created_at', '')::timestamptz, now());
      v_updated_at := v_occurred_at;
      v_is_actionable := not coalesce((p_payload ->> 'is_completed')::boolean, false);
      v_action_due_at := nullif(p_payload ->> 'due_date', '')::timestamptz;
      v_action_completed := coalesce((p_payload ->> 'is_completed')::boolean, false);

    when 'patient_anamneses' then
      v_source_type := 'anamnesis';
      select patient.user_id into v_user_id
      from public.patients as patient
      where patient.id = v_patient_id;
      v_title := 'Anamnese • ' || coalesce(nullif(p_payload ->> 'type', ''), 'registro clínico');
      v_occurred_at := coalesce(
        nullif(p_payload ->> 'updated_at', '')::timestamptz,
        nullif(p_payload ->> 'created_at', '')::timestamptz,
        now()
      );
      v_updated_at := v_occurred_at;
      v_metadata := jsonb_build_object('anamnesisType', p_payload ->> 'type');

    when 'appointments' then
      v_source_type := 'appointment';
      v_title := case
        when coalesce(p_payload ->> 'clinical_outcome', 'pending') <> 'pending' then 'Desfecho de sessão'
        else 'Sessão agendada'
      end;
      v_occurred_at := coalesce(nullif(p_payload ->> 'start_time', '')::timestamptz, now());
      v_updated_at := coalesce(nullif(p_payload ->> 'updated_at', '')::timestamptz, v_occurred_at);
      v_is_actionable := coalesce((p_payload ->> 'outcome_review_required')::boolean, false);
      v_action_due_at := nullif(p_payload ->> 'professional_response_due_at', '')::timestamptz;
      v_action_completed := not v_is_actionable;
      v_metadata := jsonb_strip_nulls(jsonb_build_object(
        'appointmentStatus', p_payload ->> 'lifecycle_status',
        'clinicalOutcome', p_payload ->> 'clinical_outcome'
      ));

    when 'reminders' then
      v_source_type := 'reminder';
      v_title := coalesce(nullif(p_payload ->> 'title', ''), 'Lembrete clínico');
      v_occurred_at := coalesce(nullif(p_payload ->> 'created_at', '')::timestamptz, now());
      v_updated_at := v_occurred_at;
      v_action_due_at := nullif(p_payload ->> 'due_date', '')::timestamptz;
      v_action_completed := coalesce((p_payload ->> 'is_completed')::boolean, false);
      v_is_actionable := not v_action_completed;
      v_tag_payload := case when nullif(p_payload ->> 'category', '') is not null
        then jsonb_build_array(p_payload ->> 'category') else '[]'::jsonb end;
      select note.patient_id into v_patient_id
      from public.personal_notes as note
      where note.id = nullif(p_payload ->> 'note_id', '')::uuid;
      v_metadata := jsonb_build_object('category', p_payload ->> 'category');

    else
      return;
  end case;

  if v_user_id is null and v_patient_id is not null then
    select patient.user_id into v_user_id
    from public.patients as patient
    where patient.id = v_patient_id;
  end if;

  if v_source_id is null or v_user_id is null or v_occurred_at is null then
    return;
  end if;

  select coalesce(array_agg(tag order by tag), '{}'::text[])
  into v_tags
  from (
    select distinct btrim(value) as tag
    from jsonb_array_elements_text(v_tag_payload)
    where btrim(value) <> ''
  ) as normalized_tags;

  insert into public.neuroview_evidence_index (
    user_id, patient_id, source_type, source_id, occurred_at, updated_at,
    title, tags, reviewed, is_actionable, action_due_at, action_completed, metadata
  ) values (
    v_user_id, v_patient_id, v_source_type, v_source_id, v_occurred_at, coalesce(v_updated_at, v_occurred_at),
    left(v_title, 240), v_tags, v_reviewed, v_is_actionable, v_action_due_at, v_action_completed, v_metadata
  )
  on conflict (user_id, source_type, source_id) do update set
    patient_id = excluded.patient_id,
    occurred_at = excluded.occurred_at,
    updated_at = excluded.updated_at,
    title = excluded.title,
    tags = excluded.tags,
    reviewed = excluded.reviewed,
    is_actionable = excluded.is_actionable,
    action_due_at = excluded.action_due_at,
    action_completed = excluded.action_completed,
    metadata = excluded.metadata;
end;
$$;

create or replace function private.sync_neuroview_evidence_index()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_payload jsonb;
  v_source_type text;
begin
  if tg_op = 'DELETE' then
    v_payload := to_jsonb(old);
    v_source_type := case tg_table_name
      when 'personal_notes' then 'personal_note'
      when 'neuro_flows' then 'flow'
      when 'session_notes' then 'session_note'
      when 'patient_mood_logs' then 'mood'
      when 'patient_goals' then 'goal'
      when 'patient_anamneses' then 'anamnesis'
      when 'appointments' then 'appointment'
      when 'reminders' then 'reminder'
    end;
    delete from public.neuroview_evidence_index
    where source_type = v_source_type
      and source_id = nullif(v_payload ->> 'id', '')::uuid;
    delete from public.neuroview_evidence_overrides
    where source_type = v_source_type
      and source_id = nullif(v_payload ->> 'id', '')::uuid;
    return old;
  end if;

  v_payload := to_jsonb(new);
  perform private.upsert_neuroview_evidence(tg_table_name, v_payload);
  return new;
end;
$$;

revoke all on function private.upsert_neuroview_evidence(text, jsonb) from public;
revoke all on function private.sync_neuroview_evidence_index() from public;

drop trigger if exists sync_neuroview_personal_notes on public.personal_notes;
create trigger sync_neuroview_personal_notes
  after insert or update or delete on public.personal_notes
  for each row execute function private.sync_neuroview_evidence_index();

drop trigger if exists sync_neuroview_flows on public.neuro_flows;
create trigger sync_neuroview_flows
  after insert or update or delete on public.neuro_flows
  for each row execute function private.sync_neuroview_evidence_index();

drop trigger if exists sync_neuroview_session_notes on public.session_notes;
create trigger sync_neuroview_session_notes
  after insert or update or delete on public.session_notes
  for each row execute function private.sync_neuroview_evidence_index();

drop trigger if exists sync_neuroview_mood_logs on public.patient_mood_logs;
create trigger sync_neuroview_mood_logs
  after insert or update or delete on public.patient_mood_logs
  for each row execute function private.sync_neuroview_evidence_index();

drop trigger if exists sync_neuroview_goals on public.patient_goals;
create trigger sync_neuroview_goals
  after insert or update or delete on public.patient_goals
  for each row execute function private.sync_neuroview_evidence_index();

drop trigger if exists sync_neuroview_anamneses on public.patient_anamneses;
create trigger sync_neuroview_anamneses
  after insert or update or delete on public.patient_anamneses
  for each row execute function private.sync_neuroview_evidence_index();

drop trigger if exists sync_neuroview_appointments on public.appointments;
create trigger sync_neuroview_appointments
  after insert or update or delete on public.appointments
  for each row execute function private.sync_neuroview_evidence_index();

drop trigger if exists sync_neuroview_reminders on public.reminders;
create trigger sync_neuroview_reminders
  after insert or update or delete on public.reminders
  for each row execute function private.sync_neuroview_evidence_index();

select private.upsert_neuroview_evidence('personal_notes', to_jsonb(source)) from public.personal_notes as source;
select private.upsert_neuroview_evidence('neuro_flows', to_jsonb(source)) from public.neuro_flows as source;
select private.upsert_neuroview_evidence('session_notes', to_jsonb(source)) from public.session_notes as source;
select private.upsert_neuroview_evidence('patient_mood_logs', to_jsonb(source)) from public.patient_mood_logs as source;
select private.upsert_neuroview_evidence('patient_goals', to_jsonb(source)) from public.patient_goals as source;
select private.upsert_neuroview_evidence('patient_anamneses', to_jsonb(source)) from public.patient_anamneses as source;
select private.upsert_neuroview_evidence('appointments', to_jsonb(source)) from public.appointments as source;
select private.upsert_neuroview_evidence('reminders', to_jsonb(source)) from public.reminders as source;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'neuroview_evidence_index'
  ) then
    alter publication supabase_realtime add table public.neuroview_evidence_index;
  end if;
end;
$$;
