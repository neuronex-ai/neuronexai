create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
grant usage on schema private to service_role;

create table if not exists private.neurozap_instance_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  instance_name text not null unique,
  instance_api_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.neurozap_instance_credentials enable row level security;
revoke all on table private.neurozap_instance_credentials from public;
revoke all on table private.neurozap_instance_credentials from anon;
revoke all on table private.neurozap_instance_credentials from authenticated;
grant select, insert, update, delete on table private.neurozap_instance_credentials to service_role;

drop trigger if exists set_neurozap_instance_credentials_updated_at on private.neurozap_instance_credentials;
create trigger set_neurozap_instance_credentials_updated_at
before update on private.neurozap_instance_credentials
for each row execute function public.update_updated_at_column();

alter table public.whatsapp_settings
  add column if not exists psychologist_remote_jid text,
  add column if not exists psychologist_phone text,
  add column if not exists last_error text,
  add column if not exists settings_applied_at timestamptz;

alter table public.synapse_whatsapp_instances
  add column if not exists owner_remote_jid text,
  add column if not exists environment text not null default 'sandbox',
  add column if not exists webhook_url text,
  add column if not exists last_connection_state text;

create unique index if not exists synapse_whatsapp_instances_instance_name_key
  on public.synapse_whatsapp_instances(instance_name);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'synapse_whatsapp_instances_environment_check'
      and conrelid = 'public.synapse_whatsapp_instances'::regclass
  ) then
    alter table public.synapse_whatsapp_instances
      add constraint synapse_whatsapp_instances_environment_check
      check (environment in ('sandbox', 'production'));
  end if;
end $$;

alter table public.whatsapp_conversations
  add column if not exists conversation_kind text not null default 'patient',
  add column if not exists synapse_session_id uuid references public.chat_sessions(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'whatsapp_conversations_kind_check'
      and conrelid = 'public.whatsapp_conversations'::regclass
  ) then
    alter table public.whatsapp_conversations
      add constraint whatsapp_conversations_kind_check
      check (conversation_kind in ('patient', 'psychologist'));
  end if;
end $$;

alter table public.whatsapp_messages
  add column if not exists synapse_session_id uuid references public.chat_sessions(id) on delete set null,
  add column if not exists sender_kind text not null default 'patient';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'whatsapp_messages_sender_kind_check'
      and conrelid = 'public.whatsapp_messages'::regclass
  ) then
    alter table public.whatsapp_messages
      add constraint whatsapp_messages_sender_kind_check
      check (sender_kind in ('patient', 'psychologist', 'synapse', 'professional', 'system'));
  end if;
end $$;

create index if not exists idx_whatsapp_settings_psychologist_remote_jid
  on public.whatsapp_settings(psychologist_remote_jid)
  where psychologist_remote_jid is not null;

create index if not exists idx_synapse_whatsapp_instances_owner_remote_jid
  on public.synapse_whatsapp_instances(owner_remote_jid)
  where owner_remote_jid is not null;

create index if not exists idx_whatsapp_conversations_user_kind_last_message
  on public.whatsapp_conversations(user_id, conversation_kind, last_message_at desc);

create index if not exists idx_whatsapp_conversations_synapse_session_id
  on public.whatsapp_conversations(synapse_session_id)
  where synapse_session_id is not null;

create index if not exists idx_whatsapp_messages_synapse_session_id
  on public.whatsapp_messages(synapse_session_id, created_at)
  where synapse_session_id is not null;

create index if not exists idx_chat_sessions_user_whatsapp_remote
  on public.chat_sessions(user_id, ((context_state ->> 'remoteJid')))
  where context_state ->> 'source' = 'whatsapp';
