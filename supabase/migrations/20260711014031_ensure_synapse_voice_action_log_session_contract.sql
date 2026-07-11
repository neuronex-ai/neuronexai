-- Synapse voice tool writes chat conversation and voice-session audit fields
-- into synapse_action_logs. Keep this explicit because older environments can
-- have the table without the chat session column in migration history.

alter table if exists public.synapse_action_logs
  add column if not exists session_id uuid references public.chat_sessions(id) on delete set null,
  add column if not exists voice_session_id uuid references public.synapse_voice_sessions(id) on delete set null,
  add column if not exists tool_name text,
  add column if not exists confirmation_required boolean not null default false,
  add column if not exists risk_level text;

create index if not exists synapse_action_logs_session_created_idx
  on public.synapse_action_logs(session_id, created_at desc)
  where session_id is not null;

create index if not exists synapse_action_logs_voice_session_idx
  on public.synapse_action_logs(voice_session_id, created_at desc)
  where voice_session_id is not null;
