create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.whatsapp_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  instance_name text not null default 'neuronex-ai',
  environment text not null default 'sandbox' check (environment in ('sandbox', 'production')),
  is_active boolean not null default false,
  connection_state text,
  webhook_url text,
  webhook_enabled boolean,
  webhook_events text[] not null default '{}',
  last_status_at timestamptz,
  last_sync_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instance_name text not null default 'neuronex-ai',
  remote_jid text not null,
  patient_name text,
  patient_phone text,
  profile_picture_url text,
  last_message_preview text,
  last_message_at timestamptz not null default now(),
  unread_count integer not null default 0 check (unread_count >= 0),
  labels jsonb not null default '[]'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, instance_name, remote_jid)
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.whatsapp_conversations(id) on delete cascade,
  instance_name text not null default 'neuronex-ai',
  remote_jid text not null,
  source_message_id text,
  direction text not null check (direction in ('inbound', 'outbound')),
  content text,
  content_type text not null default 'text',
  status text not null default 'sent',
  is_from_ai boolean not null default false,
  media_base64 text,
  media_mimetype text,
  media_filename text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_settings
  add column if not exists instance_name text not null default 'neuronex-ai',
  add column if not exists environment text not null default 'sandbox',
  add column if not exists is_active boolean not null default false,
  add column if not exists connection_state text,
  add column if not exists webhook_url text,
  add column if not exists webhook_enabled boolean,
  add column if not exists webhook_events text[] not null default '{}',
  add column if not exists last_status_at timestamptz,
  add column if not exists last_sync_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.whatsapp_conversations
  add column if not exists instance_name text not null default 'neuronex-ai',
  add column if not exists remote_jid text,
  add column if not exists patient_name text,
  add column if not exists patient_phone text,
  add column if not exists profile_picture_url text,
  add column if not exists last_message_preview text,
  add column if not exists last_message_at timestamptz not null default now(),
  add column if not exists unread_count integer not null default 0,
  add column if not exists labels jsonb not null default '[]'::jsonb,
  add column if not exists raw_payload jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.whatsapp_messages
  add column if not exists instance_name text not null default 'neuronex-ai',
  add column if not exists remote_jid text,
  add column if not exists source_message_id text,
  add column if not exists direction text,
  add column if not exists content text,
  add column if not exists content_type text not null default 'text',
  add column if not exists status text not null default 'sent',
  add column if not exists is_from_ai boolean not null default false,
  add column if not exists media_base64 text,
  add column if not exists media_mimetype text,
  add column if not exists media_filename text,
  add column if not exists raw_payload jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_whatsapp_conversations_user_last_message
  on public.whatsapp_conversations(user_id, last_message_at desc);

create index if not exists idx_whatsapp_messages_conversation_created
  on public.whatsapp_messages(conversation_id, created_at);

create index if not exists idx_whatsapp_messages_user_remote_created
  on public.whatsapp_messages(user_id, remote_jid, created_at desc);

create unique index if not exists idx_whatsapp_messages_user_source_unique
  on public.whatsapp_messages(user_id, source_message_id);

alter table public.whatsapp_settings enable row level security;
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;

drop policy if exists "Professionals can read own WhatsApp settings" on public.whatsapp_settings;
create policy "Professionals can read own WhatsApp settings"
  on public.whatsapp_settings
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Professionals can manage own WhatsApp settings" on public.whatsapp_settings;
create policy "Professionals can manage own WhatsApp settings"
  on public.whatsapp_settings
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Professionals can read own WhatsApp conversations" on public.whatsapp_conversations;
create policy "Professionals can read own WhatsApp conversations"
  on public.whatsapp_conversations
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Professionals can update own WhatsApp conversations" on public.whatsapp_conversations;
create policy "Professionals can update own WhatsApp conversations"
  on public.whatsapp_conversations
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Professionals can read own WhatsApp messages" on public.whatsapp_messages;
create policy "Professionals can read own WhatsApp messages"
  on public.whatsapp_messages
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.whatsapp_settings to authenticated;
grant select, update on public.whatsapp_conversations to authenticated;
grant select on public.whatsapp_messages to authenticated;

drop trigger if exists set_whatsapp_settings_updated_at on public.whatsapp_settings;
create trigger set_whatsapp_settings_updated_at
before update on public.whatsapp_settings
for each row execute function public.update_updated_at_column();

drop trigger if exists set_whatsapp_conversations_updated_at on public.whatsapp_conversations;
create trigger set_whatsapp_conversations_updated_at
before update on public.whatsapp_conversations
for each row execute function public.update_updated_at_column();

drop trigger if exists set_whatsapp_messages_updated_at on public.whatsapp_messages;
create trigger set_whatsapp_messages_updated_at
before update on public.whatsapp_messages
for each row execute function public.update_updated_at_column();
