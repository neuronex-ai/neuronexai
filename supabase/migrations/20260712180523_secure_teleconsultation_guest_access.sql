begin;

create extension if not exists pgcrypto;

-- Appointments contain clinical and scheduling data. Public invitation links
-- must never be an alternate Data API authorization path.
do $$
declare
  policy_row record;
begin
  if to_regclass('public.appointments') is not null then
    for policy_row in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = 'appointments'
    loop
      execute format('drop policy if exists %I on public.appointments', policy_row.policyname);
    end loop;
  end if;
end
$$;

alter table public.appointments enable row level security;

revoke all on public.appointments from public, anon;
grant select, insert, update, delete on public.appointments to authenticated;

create policy appointments_owner_select
on public.appointments
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
);

create policy appointments_owner_insert
on public.appointments
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
);

create policy appointments_owner_update
on public.appointments
for update
to authenticated
using (
  (select auth.uid()) = user_id
  and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
)
with check (
  (select auth.uid()) = user_id
  and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
);

create policy appointments_owner_delete
on public.appointments
for delete
to authenticated
using (
  (select auth.uid()) = user_id
  and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
);

create table if not exists public.teleconsultation_invites (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  token_hint text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teleconsultation_invites_expiry_check check (expires_at > created_at)
);

create unique index if not exists teleconsultation_invites_one_active_per_appointment_idx
  on public.teleconsultation_invites(appointment_id)
  where revoked_at is null;

create index if not exists teleconsultation_invites_expiry_idx
  on public.teleconsultation_invites(expires_at)
  where revoked_at is null;

create index if not exists teleconsultation_invites_created_by_idx
  on public.teleconsultation_invites(created_by);

alter table public.teleconsultation_invites enable row level security;
revoke all on public.teleconsultation_invites from public, anon, authenticated;
grant all on public.teleconsultation_invites to service_role;

create table if not exists public.teleconsultation_participants (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  invite_id uuid not null references public.teleconsultation_invites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'patient',
  expires_at timestamptz not null,
  revoked_at timestamptz,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint teleconsultation_participants_role_check check (role = 'patient'),
  constraint teleconsultation_participants_name_check check (
    char_length(btrim(display_name)) between 1 and 120
  ),
  unique (invite_id, user_id)
);

create index if not exists teleconsultation_participants_user_appointment_idx
  on public.teleconsultation_participants(user_id, appointment_id);

create unique index if not exists teleconsultation_participants_one_active_room_per_user_idx
  on public.teleconsultation_participants(user_id)
  where revoked_at is null;

create index if not exists teleconsultation_participants_appointment_expiry_idx
  on public.teleconsultation_participants(appointment_id, expires_at)
  where revoked_at is null;

alter table public.teleconsultation_participants enable row level security;
revoke all on public.teleconsultation_participants from public, anon, authenticated;
grant select on public.teleconsultation_participants to authenticated;
grant all on public.teleconsultation_participants to service_role;

create policy teleconsultation_participants_read_own
on public.teleconsultation_participants
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and revoked_at is null
  and expires_at > now()
);

create or replace function public.is_active_teleconsultation_participant(
  p_appointment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.teleconsultation_participants participant
    join public.teleconsultation_invites invite
      on invite.id = participant.invite_id
    where participant.appointment_id = p_appointment_id
      and participant.user_id = auth.uid()
      and participant.revoked_at is null
      and participant.expires_at > now()
      and invite.revoked_at is null
      and invite.expires_at > now()
  );
$$;

revoke all on function public.is_active_teleconsultation_participant(uuid) from public, anon;
grant execute on function public.is_active_teleconsultation_participant(uuid) to authenticated;

create or replace function public.revoke_teleconsultation_access_on_appointment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  revoked_at_value timestamptz := now();
  cancelled boolean := lower(coalesce(new.status, '')) in (
    'cancelled',
    'canceled',
    'cancelled_by_patient',
    'cancelled_by_professional'
  );
begin
  if new.type <> 'online' or cancelled then
    update public.teleconsultation_invites
    set revoked_at = coalesce(revoked_at, revoked_at_value),
        updated_at = revoked_at_value
    where appointment_id = new.id
      and revoked_at is null;

    update public.teleconsultation_participants
    set revoked_at = coalesce(revoked_at, revoked_at_value),
        last_seen_at = revoked_at_value
    where appointment_id = new.id
      and revoked_at is null;

    new.google_meet_link := null;
  end if;
  return new;
end;
$$;

revoke all on function public.revoke_teleconsultation_access_on_appointment_change() from public, anon, authenticated;

drop trigger if exists revoke_teleconsultation_access_after_appointment_change on public.appointments;
create trigger revoke_teleconsultation_access_after_appointment_change
before update of status, type on public.appointments
for each row
when (old.status is distinct from new.status or old.type is distinct from new.type)
execute function public.revoke_teleconsultation_access_on_appointment_change();

create table if not exists public.session_chat_messages (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null,
  sender_role text not null,
  content text not null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'session_chat_messages_role_check'
      and conrelid = 'public.session_chat_messages'::regclass
  ) then
    alter table public.session_chat_messages
      add constraint session_chat_messages_role_check
      check (sender_role in ('therapist', 'patient')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'session_chat_messages_content_check'
      and conrelid = 'public.session_chat_messages'::regclass
  ) then
    alter table public.session_chat_messages
      add constraint session_chat_messages_content_check
      check (char_length(btrim(content)) between 1 and 2000) not valid;
  end if;
end
$$;

create index if not exists session_chat_messages_appointment_created_idx
  on public.session_chat_messages(appointment_id, created_at desc);

create index if not exists session_chat_messages_sender_idx
  on public.session_chat_messages(sender_id);

alter table public.session_chat_messages enable row level security;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'session_chat_messages'
  loop
    execute format('drop policy if exists %I on public.session_chat_messages', policy_row.policyname);
  end loop;
end
$$;

revoke all on public.session_chat_messages from public, anon, authenticated;
grant select on public.session_chat_messages to authenticated;
grant all on public.session_chat_messages to service_role;

create policy session_chat_messages_room_members_read
on public.session_chat_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.appointments appointment
    where appointment.id = session_chat_messages.appointment_id
      and appointment.user_id = (select auth.uid())
      and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  )
  or public.is_active_teleconsultation_participant(session_chat_messages.appointment_id)
);

create or replace function public.send_session_chat_message(
  p_appointment_id uuid,
  p_content text
)
returns public.session_chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  clean_content text := btrim(coalesce(p_content, ''));
  sender_display_name text;
  sender_kind text;
  room_status text;
  room_heartbeat timestamptz;
  appointment_status text;
  recent_message_count integer;
  inserted_message public.session_chat_messages;
begin
  if caller_id is null then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;

  if char_length(clean_content) < 1 or char_length(clean_content) > 2000 then
    raise exception 'A mensagem precisa ter entre 1 e 2000 caracteres.' using errcode = '22023';
  end if;

  select count(*)::integer
  into recent_message_count
  from public.session_chat_messages message
  where message.appointment_id = p_appointment_id
    and message.sender_id = caller_id
    and message.created_at > now() - interval '10 seconds';

  if recent_message_count >= 8 then
    raise exception 'Aguarde um instante antes de enviar novas mensagens.' using errcode = '54000';
  end if;

  select
    appointment.metadata #>> '{teleconsultationRoom,status}',
    nullif(appointment.metadata #>> '{teleconsultationRoom,lastHeartbeatAt}', '')::timestamptz,
    lower(coalesce(appointment.status, ''))
  into room_status, room_heartbeat, appointment_status
  from public.appointments appointment
  where appointment.id = p_appointment_id;

  if coalesce(room_status, 'waiting') <> 'open'
    or room_heartbeat is null
    or room_heartbeat < now() - interval '45 seconds'
    or appointment_status in (
      'cancelled',
      'canceled',
      'cancelled_by_patient',
      'cancelled_by_professional'
    )
  then
    raise exception 'O chat fica disponível somente enquanto a sala está aberta.' using errcode = '42501';
  end if;

  select coalesce(
    nullif(btrim(profile.full_name), ''),
    nullif(btrim(profile.name), ''),
    nullif(btrim(profile.first_name), ''),
    'Profissional'
  )
  into sender_display_name
  from public.appointments appointment
  left join public.profiles profile on profile.id = appointment.user_id
  where appointment.id = p_appointment_id
    and appointment.user_id = caller_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;

  if sender_display_name is not null then
    sender_kind := 'therapist';
  else
    select participant.display_name
    into sender_display_name
    from public.teleconsultation_participants participant
    join public.teleconsultation_invites invite
      on invite.id = participant.invite_id
    where participant.appointment_id = p_appointment_id
      and participant.user_id = caller_id
      and participant.revoked_at is null
      and participant.expires_at > now()
      and invite.revoked_at is null
      and invite.expires_at > now()
    order by participant.joined_at desc
    limit 1;

    if sender_display_name is null then
      raise exception 'Você não participa desta teleconsulta.' using errcode = '42501';
    end if;

    sender_kind := 'patient';
  end if;

  insert into public.session_chat_messages (
    appointment_id,
    sender_id,
    sender_name,
    sender_role,
    content
  )
  values (
    p_appointment_id,
    caller_id,
    sender_display_name,
    sender_kind,
    clean_content
  )
  returning * into inserted_message;

  return inserted_message;
end;
$$;

revoke all on function public.send_session_chat_message(uuid, text) from public, anon;
grant execute on function public.send_session_chat_message(uuid, text) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'session_chat_messages'
  ) then
    alter publication supabase_realtime add table public.session_chat_messages;
  end if;
end
$$;

comment on table public.teleconsultation_invites is
  'Revocable bearer invites for a single teleconsultation appointment. Raw tokens never live in this table.';
comment on table public.teleconsultation_participants is
  'Short-lived room memberships created only after an invite is redeemed.';
comment on function public.send_session_chat_message(uuid, text) is
  'Derives sender identity server-side and writes only for an active room member.';

notify pgrst, 'reload schema';

commit;
