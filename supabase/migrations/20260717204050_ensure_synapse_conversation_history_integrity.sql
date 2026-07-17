-- Keep Synapse history limited to meaningful, correctly classified conversations.
-- Titles are derived from the first professional turn and remain non-null.

create or replace function public.synapse_conversation_title(
  raw_content text,
  fallback_title text default 'Conversa com o Synapse'
)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(
    nullif(
      left(
        btrim(
          regexp_replace(
            regexp_replace(coalesce(raw_content, ''), '[`*_#>\[\]\(\)~]+', ' ', 'g'),
            '\s+',
            ' ',
            'g'
          )
        ),
        72
      ),
      ''
    ),
    fallback_title
  );
$$;

update public.chat_sessions as session
set
  origin_channel = 'voice',
  last_channel = case
    when session.last_message_at is null then 'voice'
    else session.last_channel
  end
where exists (
  select 1
  from public.synapse_voice_sessions as voice_session
  where voice_session.conversation_id = session.id
);

update public.messages as message
set
  source_channel = 'voice',
  actor_kind = case
    when message.role = 'user' then 'professional'
    when message.role = 'assistant' then 'synapse'
    when message.role = 'system' then 'system'
    else message.actor_kind
  end
where exists (
  select 1
  from public.synapse_voice_sessions as voice_session
  where voice_session.conversation_id = message.session_id
);

with first_professional_turn as (
  select distinct on (message.session_id)
    message.session_id,
    public.synapse_conversation_title(message.content) as title
  from public.messages as message
  where message.role = 'user'
    and nullif(btrim(message.content), '') is not null
  order by message.session_id, message.created_at, message.id
)
update public.chat_sessions as session
set title = first_turn.title
from first_professional_turn as first_turn
where first_turn.session_id = session.id
  and (
    nullif(btrim(session.title), '') is null
    or lower(btrim(session.title)) in (
      'nova conversa',
      'synapse global',
      'conversa por voz',
      'conversa com o synapse'
    )
  );

update public.chat_sessions
set title = case
  when origin_channel = 'voice' then 'Conversa por voz'
  when origin_channel = 'whatsapp' then 'Conversa do WhatsApp'
  else 'Conversa com o Synapse'
end
where nullif(btrim(title), '') is null;

alter table public.chat_sessions
  alter column title set default 'Conversa com o Synapse',
  alter column title set not null;

create or replace function public.sync_synapse_session_activity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.chat_sessions
  set
    title = case
      when new.role = 'user'
        and nullif(btrim(new.content), '') is not null
        and lower(btrim(title)) in (
          'nova conversa',
          'synapse global',
          'conversa por voz',
          'conversa com o synapse'
        )
      then public.synapse_conversation_title(new.content)
      else title
    end,
    origin_channel = case
      when last_message_at is null then new.source_channel
      else origin_channel
    end,
    last_channel = new.source_channel,
    last_message_at = greatest(coalesce(last_message_at, new.created_at), new.created_at),
    updated_at = greatest(updated_at, new.created_at)
  where id = new.session_id;

  return new;
end;
$$;

comment on function public.synapse_conversation_title(text, text) is
  'Builds a compact, human-readable Synapse conversation title from the first meaningful turn.';
