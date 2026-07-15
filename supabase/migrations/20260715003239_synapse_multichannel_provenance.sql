-- Additive multichannel provenance for the canonical Synapse conversation.
-- `chat_sessions` and `messages` remain the durable source of truth; voice and
-- WhatsApp tables keep their channel-specific delivery/runtime details.

alter table public.chat_sessions
  add column if not exists origin_channel text not null default 'panel',
  add column if not exists last_channel text not null default 'panel',
  add column if not exists channel_state jsonb not null default '{}'::jsonb,
  add column if not exists last_message_at timestamptz;

alter table public.messages
  add column if not exists source_channel text not null default 'panel',
  add column if not exists source_event_id text,
  add column if not exists actor_kind text,
  add column if not exists idempotency_key text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chat_sessions_origin_channel_check'
      and conrelid = 'public.chat_sessions'::regclass
  ) then
    alter table public.chat_sessions
      add constraint chat_sessions_origin_channel_check
      check (origin_channel in ('panel', 'voice', 'whatsapp', 'system'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'chat_sessions_last_channel_check'
      and conrelid = 'public.chat_sessions'::regclass
  ) then
    alter table public.chat_sessions
      add constraint chat_sessions_last_channel_check
      check (last_channel in ('panel', 'voice', 'whatsapp', 'system'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'messages_source_channel_check'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_source_channel_check
      check (source_channel in ('panel', 'voice', 'whatsapp', 'system'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'messages_actor_kind_check'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_actor_kind_check
      check (actor_kind is null or actor_kind in ('professional', 'patient', 'synapse', 'system', 'tool'));
  end if;
end $$;

-- Existing WhatsApp conversations already carry reliable source metadata in
-- context_state. Backfill only those rows; all other existing sessions remain
-- panel-originated unless a later event states otherwise.
update public.chat_sessions
set
  origin_channel = 'whatsapp',
  last_channel = 'whatsapp'
where context_state ->> 'source' = 'whatsapp';

update public.messages as message
set
  source_channel = case
    when session.context_state ->> 'source' = 'whatsapp' then 'whatsapp'
    else message.source_channel
  end,
  actor_kind = case
    when message.role = 'assistant' then 'synapse'
    when message.role = 'system' then 'system'
    when message.role = 'user'
      and session.context_state ->> 'source' = 'whatsapp'
      and session.context_state ->> 'conversation_kind' = 'patient' then 'patient'
    when message.role = 'user' then 'professional'
    else message.actor_kind
  end
from public.chat_sessions as session
where session.id = message.session_id;

update public.chat_sessions as session
set last_message_at = activity.last_message_at
from (
  select session_id, max(created_at) as last_message_at
  from public.messages
  group by session_id
) as activity
where activity.session_id = session.id
  and (session.last_message_at is null or activity.last_message_at > session.last_message_at);

create index if not exists chat_sessions_user_last_message_idx
  on public.chat_sessions (user_id, last_message_at desc nulls last, updated_at desc);

create index if not exists messages_session_channel_created_idx
  on public.messages (session_id, source_channel, created_at);

create unique index if not exists messages_source_event_unique_idx
  on public.messages (session_id, source_channel, source_event_id)
  where source_event_id is not null;

create unique index if not exists messages_user_idempotency_unique_idx
  on public.messages (user_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.sync_synapse_session_activity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.chat_sessions
  set
    last_channel = new.source_channel,
    last_message_at = greatest(coalesce(last_message_at, new.created_at), new.created_at),
    updated_at = greatest(updated_at, new.created_at)
  where id = new.session_id;

  return new;
end;
$$;

drop trigger if exists sync_synapse_session_activity_after_message on public.messages;
create trigger sync_synapse_session_activity_after_message
after insert on public.messages
for each row execute function public.sync_synapse_session_activity();

comment on column public.chat_sessions.origin_channel is
  'Channel where the canonical Synapse conversation started: panel, voice, WhatsApp or system.';

comment on column public.chat_sessions.last_channel is
  'Channel that most recently added a message to this canonical conversation.';

comment on column public.messages.source_channel is
  'Channel that produced this message while preserving one shared Synapse history.';

comment on column public.messages.source_event_id is
  'Provider event identifier used to correlate and deduplicate channel deliveries.';

comment on column public.messages.idempotency_key is
  'Stable operation key used to prevent the same message from being persisted twice.';
