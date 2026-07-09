-- Synapse voice runtime sessions and turn-level audit trail.
-- Additive only: chat_sessions remains the durable conversation table.

create table if not exists public.synapse_voice_sessions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  psychologist_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'deepgram-agent',
  stt_provider text not null default 'deepgram-flux',
  tts_provider text not null default 'deepgram-managed-elevenlabs',
  voice_id text,
  listen_model text,
  think_model text,
  status text not null default 'created'
    check (status in ('created', 'connecting', 'ready', 'active', 'ended', 'error', 'cancelled')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_event_at timestamptz not null default now(),
  close_code integer,
  close_reason text,
  latency_ms jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists synapse_voice_sessions_user_started_idx
  on public.synapse_voice_sessions(user_id, started_at desc);

create index if not exists synapse_voice_sessions_conversation_idx
  on public.synapse_voice_sessions(conversation_id, started_at desc);

create table if not exists public.synapse_voice_turns (
  id uuid primary key default gen_random_uuid(),
  voice_session_id uuid not null references public.synapse_voice_sessions(id) on delete cascade,
  conversation_id uuid not null references public.chat_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  origin text not null default 'deepgram_conversation_text',
  transcript text,
  response_text text,
  is_final boolean not null default true,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  tool_call_id text,
  tool_name text,
  confirmation_required boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists synapse_voice_turns_session_created_idx
  on public.synapse_voice_turns(voice_session_id, created_at);

create index if not exists synapse_voice_turns_conversation_created_idx
  on public.synapse_voice_turns(conversation_id, created_at);

alter table public.synapse_voice_sessions enable row level security;
alter table public.synapse_voice_turns enable row level security;

drop policy if exists "Users read own Synapse voice sessions" on public.synapse_voice_sessions;
create policy "Users read own Synapse voice sessions"
  on public.synapse_voice_sessions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own Synapse voice sessions" on public.synapse_voice_sessions;
create policy "Users insert own Synapse voice sessions"
  on public.synapse_voice_sessions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own Synapse voice sessions" on public.synapse_voice_sessions;
create policy "Users update own Synapse voice sessions"
  on public.synapse_voice_sessions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users read own Synapse voice turns" on public.synapse_voice_turns;
create policy "Users read own Synapse voice turns"
  on public.synapse_voice_turns
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own Synapse voice turns" on public.synapse_voice_turns;
create policy "Users insert own Synapse voice turns"
  on public.synapse_voice_turns
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.synapse_voice_sessions to authenticated;
grant select, insert on public.synapse_voice_turns to authenticated;
grant all on public.synapse_voice_sessions to service_role;
grant all on public.synapse_voice_turns to service_role;

alter table public.synapse_action_logs
  add column if not exists voice_session_id uuid references public.synapse_voice_sessions(id) on delete set null,
  add column if not exists tool_name text,
  add column if not exists confirmation_required boolean not null default false,
  add column if not exists risk_level text;

create index if not exists synapse_action_logs_voice_session_idx
  on public.synapse_action_logs(voice_session_id, created_at desc)
  where voice_session_id is not null;
