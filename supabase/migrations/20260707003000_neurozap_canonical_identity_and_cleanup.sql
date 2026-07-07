alter table public.whatsapp_conversations
  add column if not exists canonical_remote_jid text,
  add column if not exists remote_jid_aliases jsonb not null default '[]'::jsonb,
  add column if not exists contact_about text,
  add column if not exists contact_status text,
  add column if not exists contact_last_seen_at timestamptz;

alter table public.whatsapp_messages
  add column if not exists canonical_remote_jid text;

update public.whatsapp_conversations
set canonical_remote_jid = coalesce(canonical_remote_jid, remote_jid)
where canonical_remote_jid is null;

update public.whatsapp_messages
set canonical_remote_jid = coalesce(canonical_remote_jid, remote_jid)
where canonical_remote_jid is null;

create index if not exists idx_whatsapp_conversations_user_instance_canonical
  on public.whatsapp_conversations(user_id, instance_name, canonical_remote_jid)
  where canonical_remote_jid is not null;

create index if not exists idx_whatsapp_conversations_user_aliases
  on public.whatsapp_conversations using gin(remote_jid_aliases);

create index if not exists idx_whatsapp_messages_user_instance_canonical_created
  on public.whatsapp_messages(user_id, instance_name, canonical_remote_jid, created_at desc)
  where canonical_remote_jid is not null;

create index if not exists idx_chat_sessions_user_whatsapp_canonical
  on public.chat_sessions(user_id, ((context_state ->> 'canonicalRemoteJid')))
  where context_state ->> 'source' = 'whatsapp';
