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
  add column if not exists synapse_session_id uuid references public.chat_sessions(id) on delete set null,
  add column if not exists contact_type text not null default 'person',
  add column if not exists is_group boolean not null default false,
  add column if not exists deleted_at timestamptz;

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

  if not exists (
    select 1
    from pg_constraint
    where conname = 'whatsapp_conversations_contact_type_check'
      and conrelid = 'public.whatsapp_conversations'::regclass
  ) then
    alter table public.whatsapp_conversations
      add constraint whatsapp_conversations_contact_type_check
      check (contact_type in ('person', 'group'));
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

create index if not exists idx_whatsapp_conversations_user_deleted_last_message
  on public.whatsapp_conversations(user_id, deleted_at, last_message_at desc);

create index if not exists idx_whatsapp_conversations_user_contact_type
  on public.whatsapp_conversations(user_id, contact_type);

create index if not exists idx_whatsapp_conversations_synapse_session_id
  on public.whatsapp_conversations(synapse_session_id)
  where synapse_session_id is not null;

create index if not exists idx_whatsapp_messages_synapse_session_id
  on public.whatsapp_messages(synapse_session_id, created_at)
  where synapse_session_id is not null;

create index if not exists idx_chat_sessions_user_whatsapp_remote
  on public.chat_sessions(user_id, ((context_state ->> 'remoteJid')))
  where context_state ->> 'source' = 'whatsapp';

alter table public.whatsapp_settings replica identity full;
alter table public.whatsapp_conversations replica identity full;
alter table public.whatsapp_messages replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'whatsapp_settings'
  ) then
    alter publication supabase_realtime add table public.whatsapp_settings;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'whatsapp_conversations'
  ) then
    alter publication supabase_realtime add table public.whatsapp_conversations;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'whatsapp_messages'
  ) then
    alter publication supabase_realtime add table public.whatsapp_messages;
  end if;
end $$;
