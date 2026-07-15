begin;

create extension if not exists pgcrypto;
create schema if not exists private;

-- Keep the existing appointments.status column as the clinical attendance
-- outcome. The operational lifecycle is orthogonal and lives here so that
-- confirmation does not silently change attendance/reporting semantics.
alter table public.appointments
  add column if not exists lifecycle_status text not null default 'created',
  add column if not exists previous_status text,
  add column if not exists invitation_sent_at timestamptz,
  add column if not exists invitation_opened_at timestamptz,
  add column if not exists confirmed_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_reason text,
  add column if not exists reschedule_requested_at timestamptz,
  add column if not exists reschedule_approved_at timestamptz,
  add column if not exists reschedule_rejected_at timestamptz,
  add column if not exists payment_status text not null default 'not_applicable',
  add column if not exists financial_launch_id uuid,
  add column if not exists financial_entry_id uuid,
  add column if not exists package_id uuid,
  add column if not exists charge_id uuid,
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid,
  add column if not exists action_origin text not null default 'professional_app',
  add column if not exists last_actor_type text not null default 'psychologist',
  add column if not exists audit_metadata jsonb not null default '{}'::jsonb;

update public.appointments
set
  lifecycle_status = case
    when status in ('cancelled_by_patient', 'cancelled_by_professional', 'cancelled', 'canceled') then 'cancelled'
    when status in ('attended', 'completed') then 'completed'
    when token is not null
      or exists (
        select 1
        from public.appointment_confirmation_tokens token_row
        where token_row.appointment_id = appointments.id
          and token_row.expires_at > now()
      ) then 'awaiting_confirmation'
    else coalesce(nullif(lifecycle_status, ''), 'created')
  end,
  created_by = coalesce(created_by, user_id),
  updated_by = coalesce(updated_by, user_id),
  action_origin = coalesce(nullif(action_origin, ''), 'migration'),
  audit_metadata = coalesce(audit_metadata, '{}'::jsonb);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_lifecycle_status_check'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_lifecycle_status_check
      check (lifecycle_status in (
        'created',
        'invitation_sent',
        'awaiting_confirmation',
        'confirmed',
        'cancellation_requested',
        'cancelled',
        'reschedule_requested',
        'reschedule_approved',
        'reschedule_rejected',
        'in_progress',
        'completed',
        'closed'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_payment_status_check'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_payment_status_check
      check (payment_status in (
        'not_applicable', 'pending', 'processing', 'paid', 'overdue',
        'failed', 'cancelled', 'refunded', 'expired'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_created_by_fkey'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_created_by_fkey
      foreign key (created_by) references auth.users(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_updated_by_fkey'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_updated_by_fkey
      foreign key (updated_by) references auth.users(id) on delete set null;
  end if;

  if to_regclass('public.transactions') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'appointments_financial_launch_id_fkey'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_financial_launch_id_fkey
      foreign key (financial_launch_id) references public.transactions(id) on delete set null;
  end if;

  if to_regclass('public.financial_entries') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'appointments_financial_entry_id_fkey'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_financial_entry_id_fkey
      foreign key (financial_entry_id) references public.financial_entries(id) on delete set null;
  end if;

  if to_regclass('public.patient_packages') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'appointments_package_id_fkey'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_package_id_fkey
      foreign key (package_id) references public.patient_packages(id) on delete set null;
  end if;

  if to_regclass('public.nb_payments') is not null and not exists (
    select 1 from pg_constraint
    where conname = 'appointments_charge_id_fkey'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_charge_id_fkey
      foreign key (charge_id) references public.nb_payments(id) on delete set null;
  end if;
end $$;

create index if not exists appointments_user_lifecycle_start_idx
  on public.appointments (user_id, lifecycle_status, start_time);
create index if not exists appointments_pending_reschedule_idx
  on public.appointments (user_id, reschedule_requested_at desc)
  where lifecycle_status = 'reschedule_requested';
create index if not exists appointments_financial_launch_id_idx
  on public.appointments (financial_launch_id) where financial_launch_id is not null;
create index if not exists appointments_financial_entry_id_idx
  on public.appointments (financial_entry_id) where financial_entry_id is not null;
create index if not exists appointments_package_id_idx
  on public.appointments (package_id) where package_id is not null;
create index if not exists appointments_charge_id_idx
  on public.appointments (charge_id) where charge_id is not null;
create index if not exists appointments_created_by_idx
  on public.appointments (created_by) where created_by is not null;
create index if not exists appointments_updated_by_idx
  on public.appointments (updated_by) where updated_by is not null;

-- Preserve direct appointment references for financial records that predate
-- this lifecycle model. Source records remain authoritative; these columns
-- are convenient back-references on the central appointment entity.
do $$
begin
  if to_regclass('public.financial_entries') is not null then
    execute $sql$
      update public.appointments appointment
      set financial_entry_id = (
        select entry.id
        from public.financial_entries entry
        where entry.appointment_id = appointment.id
        order by entry.created_at asc nulls last, entry.id
        limit 1
      )
      where appointment.financial_entry_id is null
        and exists (
          select 1 from public.financial_entries entry
          where entry.appointment_id = appointment.id
        )
    $sql$;
    execute $sql$
      update public.appointments appointment
      set payment_status = (
        select case lower(coalesce(entry.status, 'pending'))
          when 'paid' then 'paid'
          when 'overdue' then 'overdue'
          when 'cancelled' then 'cancelled'
          else 'pending'
        end
        from public.financial_entries entry
        where entry.appointment_id = appointment.id
        order by entry.created_at desc nulls last, entry.id desc
        limit 1
      )
      where appointment.payment_status = 'not_applicable'
        and exists (
          select 1 from public.financial_entries entry
          where entry.appointment_id = appointment.id
        )
    $sql$;
  end if;

  if to_regclass('public.transactions') is not null then
    execute $sql$
      update public.appointments appointment
      set financial_launch_id = (
        select transaction_row.id
        from public.transactions transaction_row
        where transaction_row.appointment_id = appointment.id
        order by transaction_row.created_at asc nulls last, transaction_row.id
        limit 1
      )
      where appointment.financial_launch_id is null
        and exists (
          select 1 from public.transactions transaction_row
          where transaction_row.appointment_id = appointment.id
        )
    $sql$;
  end if;

  if to_regclass('public.nb_payments') is not null then
    execute $sql$
      update public.appointments appointment
      set charge_id = (
        select payment.id
        from public.nb_payments payment
        where payment.appointment_id = appointment.id
        order by payment.created_at asc nulls last, payment.id
        limit 1
      )
      where appointment.charge_id is null
        and exists (
          select 1 from public.nb_payments payment
          where payment.appointment_id = appointment.id
        )
    $sql$;
    execute $sql$
      update public.appointments appointment
      set payment_status = (
        select case lower(coalesce(payment.normalized_status, payment.status, 'pending'))
          when 'paid' then 'paid'
          when 'processing' then 'processing'
          when 'failed' then 'failed'
          when 'canceled' then 'cancelled'
          when 'cancelled' then 'cancelled'
          when 'refunded' then 'refunded'
          when 'partially_refunded' then 'refunded'
          when 'expired' then 'expired'
          when 'overdue' then 'overdue'
          else 'pending'
        end
        from public.nb_payments payment
        where payment.appointment_id = appointment.id
        order by payment.created_at desc nulls last, payment.id desc
        limit 1
      )
      where exists (
        select 1 from public.nb_payments payment
        where payment.appointment_id = appointment.id
      )
    $sql$;
  end if;

  if to_regclass('public.patient_package_session_usages') is not null then
    execute $sql$
      update public.appointments appointment
      set package_id = (
        select usage.package_id
        from public.patient_package_session_usages usage
        where usage.appointment_id = appointment.id
        order by usage.id
        limit 1
      )
      where appointment.package_id is null
        and exists (
          select 1 from public.patient_package_session_usages usage
          where usage.appointment_id = appointment.id
        )
    $sql$;
  end if;
end $$;

alter table public.appointment_confirmation_tokens
  add column if not exists token_hash text,
  add column if not exists status text not null default 'pending',
  add column if not exists sent_at timestamptz,
  add column if not exists opened_at timestamptz,
  add column if not exists used_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists created_by uuid,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.appointment_confirmation_tokens
set
  token_hash = coalesce(token_hash, encode(digest(token::text, 'sha256'), 'hex')),
  status = case
    when expires_at <= now() then 'expired'
    when status in ('revoked', 'failed') then status
    else 'sent'
  end,
  sent_at = coalesce(sent_at, created_at),
  metadata = coalesce(metadata, '{}'::jsonb);

-- Public invitation secrets are bearer credentials. Keep only their digest in
-- the database so a read leak cannot be turned into a valid patient link.
alter table public.appointment_confirmation_tokens
  alter column token drop not null;

insert into public.appointment_confirmation_tokens (
  appointment_id,
  token_hash,
  expires_at,
  status,
  sent_at,
  created_at,
  metadata
)
select
  appointment.id,
  encode(digest(appointment.token, 'sha256'), 'hex'),
  greatest(coalesce(appointment.end_time, now()) + interval '7 days', now() + interval '30 days'),
  'sent',
  coalesce(appointment.updated_at, appointment.created_at, now()),
  coalesce(appointment.created_at, now()),
  jsonb_build_object('source', 'legacy_appointment_token_backfill')
from public.appointments appointment
where appointment.token is not null
  and not exists (
    select 1
    from public.appointment_confirmation_tokens existing_token
    where existing_token.token_hash = encode(digest(appointment.token, 'sha256'), 'hex')
  );

update public.appointment_confirmation_tokens
set token = null
where token is not null
  and token_hash is not null;

update public.appointments
set token = null, auth_code = null
where token is not null or auth_code is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'appointment_confirmation_tokens_status_check'
      and conrelid = 'public.appointment_confirmation_tokens'::regclass
  ) then
    alter table public.appointment_confirmation_tokens
      add constraint appointment_confirmation_tokens_status_check
      check (status in ('pending', 'sent', 'opened', 'revoked', 'expired', 'failed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'appointment_confirmation_tokens_created_by_fkey'
      and conrelid = 'public.appointment_confirmation_tokens'::regclass
  ) then
    alter table public.appointment_confirmation_tokens
      add constraint appointment_confirmation_tokens_created_by_fkey
      foreign key (created_by) references auth.users(id) on delete set null;
  end if;
end $$;

create unique index if not exists appointment_confirmation_tokens_hash_uidx
  on public.appointment_confirmation_tokens (token_hash)
  where token_hash is not null;
create index if not exists appointment_confirmation_tokens_appointment_idx
  on public.appointment_confirmation_tokens (appointment_id, expires_at desc);
create index if not exists appointment_confirmation_tokens_active_idx
  on public.appointment_confirmation_tokens (appointment_id, status, expires_at desc)
  where status in ('pending', 'sent', 'opened');

create table if not exists public.appointment_events (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  psychologist_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  event_type text not null,
  from_status text,
  to_status text,
  actor_type text not null default 'system',
  actor_user_id uuid references auth.users(id) on delete set null,
  action_origin text not null default 'system',
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint appointment_events_actor_type_check
    check (actor_type in ('psychologist', 'patient', 'system', 'edge_function', 'provider'))
);

create unique index if not exists appointment_events_idempotency_uidx
  on public.appointment_events (appointment_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists appointment_events_timeline_idx
  on public.appointment_events (appointment_id, created_at desc);
create index if not exists appointment_events_psychologist_idx
  on public.appointment_events (psychologist_id, created_at desc);
create index if not exists appointment_events_patient_idx
  on public.appointment_events (patient_id, created_at desc)
  where patient_id is not null;

create table if not exists public.appointment_reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  psychologist_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  original_start_time timestamptz not null,
  original_end_time timestamptz not null,
  requested_start_time timestamptz not null,
  requested_end_time timestamptz not null,
  reason text,
  status text not null default 'pending',
  requested_by_user_id uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_reason text,
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_reschedule_requests_status_check
    check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  constraint appointment_reschedule_requests_range_check
    check (requested_end_time > requested_start_time)
);

create unique index if not exists appointment_reschedule_requests_pending_uidx
  on public.appointment_reschedule_requests (appointment_id)
  where status = 'pending';
create index if not exists appointment_reschedule_requests_psychologist_idx
  on public.appointment_reschedule_requests (psychologist_id, status, created_at desc);
create index if not exists appointment_reschedule_requests_patient_idx
  on public.appointment_reschedule_requests (patient_id, created_at desc)
  where patient_id is not null;

drop trigger if exists appointment_reschedule_requests_touch_updated_at
  on public.appointment_reschedule_requests;
create trigger appointment_reschedule_requests_touch_updated_at
before update on public.appointment_reschedule_requests
for each row execute function public.update_updated_at_column();

alter table public.appointment_events enable row level security;
alter table public.appointment_reschedule_requests enable row level security;
alter table public.appointment_confirmation_tokens enable row level security;
alter table public.appointments enable row level security;

-- Superseded by the lifecycle notification trigger below. The legacy trigger
-- depended on the plaintext appointments.token column.
drop trigger if exists appointments_emit_persistent_notification
  on public.appointments;

drop policy if exists "Patients can update their appointment via token" on public.appointments;
drop policy if exists "Patients can view their pending appointment via token" on public.appointments;
drop policy if exists "Patients can view their own linked appointments" on public.appointments;
drop policy if exists "Users can only see their own appointments" on public.appointments;
drop policy if exists "Users can only update their own appointments" on public.appointments;
drop policy if exists "Users can only insert their own appointments" on public.appointments;
drop policy if exists "Users can only delete their own appointments" on public.appointments;

create policy "Appointment owners and linked patients can read"
on public.appointments for select
to authenticated
using (
  (select auth.uid()) = user_id
  or (
    patient_id is not null
    and exists (
      select 1
      from public.patients patient
      where patient.id = appointments.patient_id
        and patient.user_id = appointments.user_id
        and patient.email = (select auth.email())
    )
  )
);

create policy "Appointment owners can insert"
on public.appointments for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Appointment owners can update"
on public.appointments for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Appointment owners can delete"
on public.appointments for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Deny all access to authenticated users"
  on public.appointment_confirmation_tokens;

drop policy if exists "Appointment owners can read events" on public.appointment_events;
create policy "Appointment owners can read events"
on public.appointment_events for select
to authenticated
using ((select auth.uid()) = psychologist_id);

drop policy if exists "Appointment owners can read reschedule requests"
  on public.appointment_reschedule_requests;
create policy "Appointment owners can read reschedule requests"
on public.appointment_reschedule_requests for select
to authenticated
using ((select auth.uid()) = psychologist_id);

revoke all on public.appointments from anon;
grant select, insert, update, delete on public.appointments to authenticated;
grant all on public.appointments to service_role;

revoke all on public.appointment_confirmation_tokens from public, anon, authenticated;
grant all on public.appointment_confirmation_tokens to service_role;

revoke all on public.appointment_events from public, anon, authenticated;
grant select on public.appointment_events to authenticated;
grant all on public.appointment_events to service_role;

revoke all on public.appointment_reschedule_requests from public, anon, authenticated;
grant select on public.appointment_reschedule_requests to authenticated;
grant all on public.appointment_reschedule_requests to service_role;

create or replace function private.append_appointment_event(
  p_appointment_id uuid,
  p_event_type text,
  p_from_status text default null,
  p_to_status text default null,
  p_actor_type text default 'system',
  p_actor_user_id uuid default null,
  p_action_origin text default 'system',
  p_metadata jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment public.appointments%rowtype;
  v_event_id uuid;
begin
  select * into v_appointment
  from public.appointments
  where id = p_appointment_id;

  if not found then
    raise exception 'Appointment not found';
  end if;

  insert into public.appointment_events (
    appointment_id,
    psychologist_id,
    patient_id,
    event_type,
    from_status,
    to_status,
    actor_type,
    actor_user_id,
    action_origin,
    idempotency_key,
    metadata
  ) values (
    v_appointment.id,
    v_appointment.user_id,
    v_appointment.patient_id,
    p_event_type,
    p_from_status,
    p_to_status,
    case
      when p_actor_type in ('psychologist', 'patient', 'system', 'edge_function', 'provider') then p_actor_type
      else 'system'
    end,
    p_actor_user_id,
    coalesce(nullif(p_action_origin, ''), 'system'),
    p_idempotency_key,
    jsonb_strip_nulls(coalesce(p_metadata, '{}'::jsonb))
  )
  on conflict (appointment_id, idempotency_key)
    where idempotency_key is not null
  do update set metadata = public.appointment_events.metadata || excluded.metadata
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function private.append_appointment_event(uuid, text, text, text, text, uuid, text, jsonb, text)
  from public, anon, authenticated;

create or replace function private.prepare_appointment_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user uuid := auth.uid();
  v_old_room_status text;
  v_new_room_status text;
begin
  if tg_op = 'INSERT' then
    new.lifecycle_status := coalesce(nullif(new.lifecycle_status, ''), 'created');
    new.created_by := coalesce(new.created_by, v_auth_user, new.user_id);
    new.updated_by := coalesce(new.updated_by, new.created_by, v_auth_user, new.user_id);
    new.action_origin := coalesce(nullif(new.action_origin, ''), 'professional_app');
    new.last_actor_type := coalesce(nullif(new.last_actor_type, ''), 'psychologist');
    new.audit_metadata := coalesce(new.audit_metadata, '{}'::jsonb);
    return new;
  end if;

  if new.updated_by is not distinct from old.updated_by and v_auth_user is not null then
    new.updated_by := v_auth_user;
  end if;

  if new.action_origin is not distinct from old.action_origin and v_auth_user is not null then
    new.action_origin := 'professional_app';
  end if;

  if new.last_actor_type is not distinct from old.last_actor_type and v_auth_user is not null then
    new.last_actor_type := 'psychologist';
  end if;

  new.audit_metadata := coalesce(new.audit_metadata, '{}'::jsonb);

  if new.lifecycle_status is not distinct from old.lifecycle_status then
    if new.status is distinct from old.status
      and new.status in ('cancelled_by_patient', 'cancelled_by_professional', 'cancelled', 'canceled')
    then
      new.lifecycle_status := 'cancelled';
      new.cancelled_at := coalesce(new.cancelled_at, now());
    elsif new.status is distinct from old.status
      and new.status in ('attended', 'completed')
    then
      new.lifecycle_status := 'completed';
    else
      v_old_room_status := old.metadata #>> '{teleconsultationRoom,status}';
      v_new_room_status := new.metadata #>> '{teleconsultationRoom,status}';
      if v_new_room_status is distinct from v_old_room_status and v_new_room_status = 'open' then
        new.lifecycle_status := 'in_progress';
      elsif v_new_room_status is distinct from v_old_room_status and v_new_room_status = 'closed' then
        new.lifecycle_status := 'completed';
      end if;
    end if;
  end if;

  if new.lifecycle_status is distinct from old.lifecycle_status then
    new.previous_status := old.lifecycle_status;
  end if;

  return new;
end;
$$;

create or replace function private.capture_appointment_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_type text;
  v_metadata jsonb;
  v_key text;
begin
  if tg_op = 'INSERT' then
    perform private.append_appointment_event(
      new.id,
      'appointment_created',
      null,
      new.lifecycle_status,
      coalesce(new.last_actor_type, 'psychologist'),
      new.created_by,
      coalesce(new.action_origin, 'professional_app'),
      coalesce(new.audit_metadata, '{}'::jsonb) || jsonb_build_object(
        'startTime', new.start_time,
        'endTime', new.end_time,
        'modality', new.type
      ),
      'appointment:' || new.id::text || ':created'
    );
    return new;
  end if;

  if new.lifecycle_status is distinct from old.lifecycle_status then
    v_event_type := case new.lifecycle_status
      when 'invitation_sent' then 'invitation_sent'
      when 'awaiting_confirmation' then 'awaiting_confirmation'
      when 'confirmed' then 'patient_confirmed'
      when 'cancellation_requested' then 'cancellation_requested'
      when 'cancelled' then case
        when new.action_origin = 'public_appointment' then 'patient_cancelled'
        else 'appointment_cancelled'
      end
      when 'reschedule_requested' then 'patient_requested_reschedule'
      when 'reschedule_approved' then 'psychologist_approved_reschedule'
      when 'reschedule_rejected' then 'psychologist_rejected_reschedule'
      when 'in_progress' then 'consultation_started'
      when 'completed' then 'consultation_completed'
      when 'closed' then 'consultation_closed'
      else 'lifecycle_status_changed'
    end;
  elsif new.start_time is distinct from old.start_time
    or new.end_time is distinct from old.end_time
  then
    v_event_type := 'appointment_rescheduled';
  elsif new.status is distinct from old.status then
    v_event_type := 'clinical_status_changed';
  else
    return new;
  end if;

  v_metadata := coalesce(new.audit_metadata, '{}'::jsonb) || jsonb_build_object(
    'previousClinicalStatus', old.status,
    'clinicalStatus', new.status,
    'previousStartTime', old.start_time,
    'previousEndTime', old.end_time,
    'startTime', new.start_time,
    'endTime', new.end_time
  );
  v_key := nullif(new.audit_metadata ->> 'idempotencyKey', '');

  perform private.append_appointment_event(
    new.id,
    v_event_type,
    old.lifecycle_status,
    new.lifecycle_status,
    coalesce(new.last_actor_type, 'system'),
    new.updated_by,
    coalesce(new.action_origin, 'system'),
    v_metadata,
    v_key
  );

  return new;
end;
$$;

drop trigger if exists appointments_prepare_audit on public.appointments;
create trigger appointments_prepare_audit
before insert or update on public.appointments
for each row execute function private.prepare_appointment_audit();

drop trigger if exists appointments_capture_event on public.appointments;
create trigger appointments_capture_event
after insert or update on public.appointments
for each row execute function private.capture_appointment_event();

-- Backfill the creation event after triggers exist, without mutating appointments.
insert into public.appointment_events (
  appointment_id,
  psychologist_id,
  patient_id,
  event_type,
  to_status,
  actor_type,
  actor_user_id,
  action_origin,
  idempotency_key,
  metadata,
  created_at
)
select
  appointment.id,
  appointment.user_id,
  appointment.patient_id,
  'appointment_created',
  'created',
  'psychologist',
  appointment.created_by,
  'historical_backfill',
  'appointment:' || appointment.id::text || ':created',
  jsonb_build_object(
    'startTime', appointment.start_time,
    'endTime', appointment.end_time,
    'modality', appointment.type,
    'backfilled', true
  ),
  coalesce(appointment.created_at, now())
from public.appointments appointment
on conflict (appointment_id, idempotency_key)
  where idempotency_key is not null
do nothing;

create or replace function public.record_appointment_invitation(
  p_appointment_id uuid,
  p_actor_user_id uuid,
  p_token_id uuid,
  p_delivery jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment public.appointments%rowtype;
  v_now timestamptz := now();
begin
  select * into v_appointment
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found or v_appointment.user_id <> p_actor_user_id then
    raise exception 'Appointment not found for this professional';
  end if;
  if v_appointment.lifecycle_status in ('cancelled', 'in_progress', 'completed', 'closed') then
    raise exception 'This appointment no longer accepts invitations';
  end if;

  update public.appointment_confirmation_tokens
  set
    status = 'sent',
    sent_at = v_now,
    created_by = p_actor_user_id,
    metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_delivery, '{}'::jsonb)
  where id = p_token_id
    and appointment_id = p_appointment_id;

  if not found then
    raise exception 'Confirmation token not found';
  end if;

  if v_appointment.lifecycle_status not in ('created', 'invitation_sent', 'awaiting_confirmation') then
    update public.appointments
    set
      invitation_sent_at = v_now,
      updated_by = p_actor_user_id,
      action_origin = 'professional_app',
      last_actor_type = 'psychologist',
      audit_metadata = coalesce(p_delivery, '{}'::jsonb) || jsonb_build_object('tokenId', p_token_id)
    where id = p_appointment_id
    returning * into v_appointment;

    perform private.append_appointment_event(
      p_appointment_id,
      'invitation_sent',
      v_appointment.lifecycle_status,
      v_appointment.lifecycle_status,
      'psychologist',
      p_actor_user_id,
      'professional_app',
      coalesce(p_delivery, '{}'::jsonb) || jsonb_build_object('tokenId', p_token_id),
      'appointment:' || p_appointment_id::text || ':invitation:' || p_token_id::text || ':sent'
    );
    return to_jsonb(v_appointment);
  end if;

  update public.appointments
  set
    lifecycle_status = 'invitation_sent',
    invitation_sent_at = v_now,
    updated_by = p_actor_user_id,
    action_origin = 'professional_app',
    last_actor_type = 'psychologist',
    audit_metadata = coalesce(p_delivery, '{}'::jsonb) || jsonb_build_object(
      'tokenId', p_token_id,
      'idempotencyKey', 'appointment:' || p_appointment_id::text || ':invitation:' || p_token_id::text || ':sent'
    )
  where id = p_appointment_id;

  update public.appointments
  set
    lifecycle_status = 'awaiting_confirmation',
    updated_by = p_actor_user_id,
    action_origin = 'professional_app',
    last_actor_type = 'psychologist',
    audit_metadata = jsonb_build_object(
      'tokenId', p_token_id,
      'idempotencyKey', 'appointment:' || p_appointment_id::text || ':invitation:' || p_token_id::text || ':awaiting'
    )
  where id = p_appointment_id
  returning * into v_appointment;

  return to_jsonb(v_appointment);
end;
$$;

create or replace function public.mark_appointment_invitation_opened(
  p_token_hash text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token public.appointment_confirmation_tokens%rowtype;
  v_appointment public.appointments%rowtype;
  v_event_id uuid;
begin
  select * into v_token
  from public.appointment_confirmation_tokens
  where token_hash = p_token_hash
    and status in ('sent', 'opened')
    and revoked_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Invalid or expired appointment invitation';
  end if;

  select * into v_appointment
  from public.appointments
  where id = v_token.appointment_id
  for update;

  if v_token.opened_at is null then
    update public.appointment_confirmation_tokens
    set status = 'opened', opened_at = now()
    where id = v_token.id;

    update public.appointments
    set
      invitation_opened_at = coalesce(invitation_opened_at, now()),
      updated_by = null,
      action_origin = 'public_appointment',
      last_actor_type = 'patient',
      audit_metadata = coalesce(p_metadata, '{}'::jsonb)
    where id = v_appointment.id;

    v_event_id := private.append_appointment_event(
      v_appointment.id,
      'invitation_opened',
      v_appointment.lifecycle_status,
      v_appointment.lifecycle_status,
      'patient',
      null,
      'public_appointment',
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('tokenId', v_token.id),
      'appointment:' || v_appointment.id::text || ':invitation:' || v_token.id::text || ':opened'
    );
  end if;

  return v_token.appointment_id;
end;
$$;

create or replace function public.process_appointment_public_action(
  p_token_hash text,
  p_action text,
  p_reason text default null,
  p_requested_start_time timestamptz default null,
  p_requested_end_time timestamptz default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token public.appointment_confirmation_tokens%rowtype;
  v_appointment public.appointments%rowtype;
  v_request public.appointment_reschedule_requests%rowtype;
  v_working_hours jsonb;
  v_day_config jsonb;
  v_day_key text;
  v_duration interval;
  v_current_duration interval;
  v_idempotency_key text;
begin
  if p_action not in ('confirm', 'cancel', 'reschedule') then
    raise exception 'Unsupported appointment action';
  end if;

  select * into v_token
  from public.appointment_confirmation_tokens
  where token_hash = p_token_hash
    and status in ('sent', 'opened')
    and revoked_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Invalid or expired appointment invitation';
  end if;

  select * into v_appointment
  from public.appointments
  where id = v_token.appointment_id
  for update;

  if not found then
    raise exception 'Appointment not found';
  end if;

  update public.appointment_confirmation_tokens
  set used_at = now(), status = 'opened', opened_at = coalesce(opened_at, now())
  where id = v_token.id;

  if p_action = 'confirm' then
    if v_appointment.lifecycle_status = 'cancelled' then
      raise exception 'A cancelled appointment cannot be confirmed';
    end if;
    if v_appointment.lifecycle_status = 'reschedule_requested' then
      raise exception 'The pending reschedule request must be reviewed first';
    end if;
    if v_appointment.lifecycle_status in ('completed', 'closed') then
      raise exception 'This appointment is already finished';
    end if;
    if v_appointment.lifecycle_status = 'confirmed' then
      return jsonb_build_object('appointment', to_jsonb(v_appointment), 'idempotentReplay', true);
    end if;

    update public.appointments
    set
      lifecycle_status = 'confirmed',
      confirmed_at = now(),
      updated_by = null,
      action_origin = 'public_appointment',
      last_actor_type = 'patient',
      audit_metadata = coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'tokenId', v_token.id,
        'idempotencyKey', 'appointment:' || v_appointment.id::text || ':confirmed'
      )
    where id = v_appointment.id
    returning * into v_appointment;

    return jsonb_build_object('appointment', to_jsonb(v_appointment), 'event', 'confirmed');
  end if;

  if p_action = 'cancel' then
    if v_appointment.lifecycle_status = 'cancelled' then
      return jsonb_build_object('appointment', to_jsonb(v_appointment), 'idempotentReplay', true);
    end if;
    if v_appointment.lifecycle_status in ('completed', 'closed') then
      raise exception 'A finished appointment cannot be cancelled';
    end if;

    update public.appointment_reschedule_requests
    set
      status = 'withdrawn',
      reviewed_at = now(),
      metadata = metadata || jsonb_build_object('withdrawnBy', 'patient_cancellation')
    where appointment_id = v_appointment.id
      and status = 'pending';

    update public.appointments
    set
      status = 'cancelled_by_patient',
      lifecycle_status = 'cancelled',
      cancelled_at = now(),
      cancellation_reason = nullif(btrim(p_reason), ''),
      updated_by = null,
      action_origin = 'public_appointment',
      last_actor_type = 'patient',
      audit_metadata = coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'tokenId', v_token.id,
        'reason', nullif(btrim(p_reason), ''),
        'idempotencyKey', 'appointment:' || v_appointment.id::text || ':cancelled'
      )
    where id = v_appointment.id
    returning * into v_appointment;

    return jsonb_build_object('appointment', to_jsonb(v_appointment), 'event', 'cancelled');
  end if;

  if v_appointment.lifecycle_status in ('cancelled', 'completed', 'closed') then
    raise exception 'This appointment cannot be rescheduled';
  end if;
  if p_requested_start_time is null or p_requested_end_time is null then
    raise exception 'Requested start and end times are required';
  end if;
  if p_requested_start_time <= now() or p_requested_end_time <= p_requested_start_time then
    raise exception 'Choose a valid future time';
  end if;
  if (p_requested_start_time at time zone 'America/Sao_Paulo')::date
    <> (p_requested_end_time at time zone 'America/Sao_Paulo')::date
  then
    raise exception 'The appointment must start and end on the same day';
  end if;

  v_duration := p_requested_end_time - p_requested_start_time;
  v_current_duration := v_appointment.end_time - v_appointment.start_time;
  if v_duration <> v_current_duration then
    raise exception 'The requested duration must match the original appointment';
  end if;
  if p_requested_start_time = v_appointment.start_time
    and p_requested_end_time = v_appointment.end_time
  then
    raise exception 'Choose a time different from the current appointment';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_appointment.user_id::text, 0));

  select coalesce(profile.working_hours, '{}'::jsonb)
  into v_working_hours
  from public.profiles profile
  where profile.id = v_appointment.user_id;

  v_day_key := extract(dow from p_requested_start_time at time zone 'America/Sao_Paulo')::integer::text;
  v_day_config := v_working_hours -> v_day_key;
  if not coalesce((v_day_config ->> 'enabled')::boolean, false) then
    raise exception 'The professional is unavailable on the selected day';
  end if;
  if (p_requested_start_time at time zone 'America/Sao_Paulo')::time < (v_day_config ->> 'start')::time
    or (p_requested_end_time at time zone 'America/Sao_Paulo')::time > (v_day_config ->> 'end')::time
  then
    raise exception 'The selected time is outside the professional availability';
  end if;

  if exists (
    select 1
    from public.appointments conflict
    where conflict.user_id = v_appointment.user_id
      and conflict.id <> v_appointment.id
      and conflict.lifecycle_status <> 'cancelled'
      and conflict.status not in ('cancelled_by_patient', 'cancelled_by_professional')
      and conflict.start_time < p_requested_end_time
      and conflict.end_time > p_requested_start_time
  ) then
    raise exception 'The selected time is no longer available';
  end if;

  if exists (
    select 1 from public.appointment_reschedule_requests pending_request
    where pending_request.appointment_id = v_appointment.id
      and pending_request.status = 'pending'
  ) then
    raise exception 'There is already a pending reschedule request for this appointment';
  end if;

  insert into public.appointment_reschedule_requests (
    appointment_id,
    psychologist_id,
    patient_id,
    original_start_time,
    original_end_time,
    requested_start_time,
    requested_end_time,
    reason,
    metadata
  ) values (
    v_appointment.id,
    v_appointment.user_id,
    v_appointment.patient_id,
    v_appointment.start_time,
    v_appointment.end_time,
    p_requested_start_time,
    p_requested_end_time,
    nullif(btrim(p_reason), ''),
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('tokenId', v_token.id)
  )
  returning * into v_request;

  v_idempotency_key := 'appointment:' || v_appointment.id::text || ':reschedule-request:' || v_request.id::text;
  update public.appointments
  set
    lifecycle_status = 'reschedule_requested',
    reschedule_requested_at = now(),
    updated_by = null,
    action_origin = 'public_appointment',
    last_actor_type = 'patient',
    audit_metadata = coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'tokenId', v_token.id,
      'requestId', v_request.id,
      'requestedStartTime', v_request.requested_start_time,
      'requestedEndTime', v_request.requested_end_time,
      'idempotencyKey', v_idempotency_key
    )
  where id = v_appointment.id
  returning * into v_appointment;

  return jsonb_build_object(
    'appointment', to_jsonb(v_appointment),
    'request', to_jsonb(v_request),
    'event', 'reschedule_requested'
  );
end;
$$;

create or replace function public.review_appointment_reschedule(
  p_request_id uuid,
  p_actor_user_id uuid,
  p_decision text,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.appointment_reschedule_requests%rowtype;
  v_appointment public.appointments%rowtype;
  v_working_hours jsonb;
  v_day_config jsonb;
  v_day_key text;
begin
  if p_decision not in ('approve', 'reject') then
    raise exception 'Unsupported review decision';
  end if;

  select * into v_request
  from public.appointment_reschedule_requests
  where id = p_request_id
  for update;

  if not found or v_request.psychologist_id <> p_actor_user_id then
    raise exception 'Reschedule request not found for this professional';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'This reschedule request has already been reviewed';
  end if;

  select * into v_appointment
  from public.appointments
  where id = v_request.appointment_id
  for update;

  if p_decision = 'approve' then
    if v_request.requested_start_time <= now() then
      raise exception 'The requested time is no longer in the future';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(v_appointment.user_id::text, 0));

    select coalesce(profile.working_hours, '{}'::jsonb)
    into v_working_hours
    from public.profiles profile
    where profile.id = v_appointment.user_id;
    v_day_key := extract(dow from v_request.requested_start_time at time zone 'America/Sao_Paulo')::integer::text;
    v_day_config := v_working_hours -> v_day_key;

    if not coalesce((v_day_config ->> 'enabled')::boolean, false)
      or (v_request.requested_start_time at time zone 'America/Sao_Paulo')::time < (v_day_config ->> 'start')::time
      or (v_request.requested_end_time at time zone 'America/Sao_Paulo')::time > (v_day_config ->> 'end')::time
    then
      raise exception 'The requested time is outside the professional availability';
    end if;

    if exists (
      select 1
      from public.appointments conflict
      where conflict.user_id = v_appointment.user_id
        and conflict.id <> v_appointment.id
        and conflict.lifecycle_status <> 'cancelled'
        and conflict.status not in ('cancelled_by_patient', 'cancelled_by_professional')
        and conflict.start_time < v_request.requested_end_time
        and conflict.end_time > v_request.requested_start_time
    ) then
      raise exception 'The requested time is no longer available';
    end if;

    update public.appointment_reschedule_requests
    set
      status = 'approved',
      reviewed_by = p_actor_user_id,
      review_reason = nullif(btrim(p_reason), ''),
      reviewed_at = now(),
      metadata = metadata || coalesce(p_metadata, '{}'::jsonb)
    where id = v_request.id
    returning * into v_request;

    update public.appointments
    set
      lifecycle_status = 'reschedule_approved',
      start_time = v_request.requested_start_time,
      end_time = v_request.requested_end_time,
      reschedule_approved_at = now(),
      updated_by = p_actor_user_id,
      action_origin = 'professional_app',
      last_actor_type = 'psychologist',
      audit_metadata = coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'requestId', v_request.id,
        'reviewReason', nullif(btrim(p_reason), ''),
        'idempotencyKey', 'appointment:' || v_appointment.id::text || ':reschedule-request:' || v_request.id::text || ':approved'
      )
    where id = v_appointment.id
    returning * into v_appointment;
  else
    update public.appointment_reschedule_requests
    set
      status = 'rejected',
      reviewed_by = p_actor_user_id,
      review_reason = nullif(btrim(p_reason), ''),
      reviewed_at = now(),
      metadata = metadata || coalesce(p_metadata, '{}'::jsonb)
    where id = v_request.id
    returning * into v_request;

    update public.appointments
    set
      lifecycle_status = 'reschedule_rejected',
      reschedule_rejected_at = now(),
      updated_by = p_actor_user_id,
      action_origin = 'professional_app',
      last_actor_type = 'psychologist',
      audit_metadata = coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'requestId', v_request.id,
        'reviewReason', nullif(btrim(p_reason), ''),
        'idempotencyKey', 'appointment:' || v_appointment.id::text || ':reschedule-request:' || v_request.id::text || ':rejected'
      )
    where id = v_appointment.id
    returning * into v_appointment;
  end if;

  return jsonb_build_object(
    'appointment', to_jsonb(v_appointment),
    'request', to_jsonb(v_request),
    'decision', p_decision
  );
end;
$$;

create or replace function public.record_appointment_communication_event(
  p_appointment_id uuid,
  p_event_type text,
  p_action_origin text,
  p_metadata jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select private.append_appointment_event(
    p_appointment_id,
    p_event_type,
    null,
    null,
    'edge_function',
    null,
    p_action_origin,
    coalesce(p_metadata, '{}'::jsonb),
    p_idempotency_key
  );
$$;

revoke all on function public.record_appointment_invitation(uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.mark_appointment_invitation_opened(text, jsonb)
  from public, anon, authenticated;
revoke all on function public.process_appointment_public_action(text, text, text, timestamptz, timestamptz, jsonb)
  from public, anon, authenticated;
revoke all on function public.review_appointment_reschedule(uuid, uuid, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.record_appointment_communication_event(uuid, text, text, jsonb, text)
  from public, anon, authenticated;

grant execute on function public.record_appointment_invitation(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.mark_appointment_invitation_opened(text, jsonb) to service_role;
grant execute on function public.process_appointment_public_action(text, text, text, timestamptz, timestamptz, jsonb) to service_role;
grant execute on function public.review_appointment_reschedule(uuid, uuid, text, text, jsonb) to service_role;
grant execute on function public.record_appointment_communication_event(uuid, text, text, jsonb, text) to service_role;

create or replace function private.emit_appointment_lifecycle_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient_name text;
  v_request_id text := new.audit_metadata ->> 'requestId';
begin
  if new.lifecycle_status is not distinct from old.lifecycle_status then
    return new;
  end if;
  if new.lifecycle_status not in ('confirmed', 'cancelled', 'reschedule_requested') then
    return new;
  end if;

  select patient.name into v_patient_name
  from public.patients patient
  where patient.id = new.patient_id;

  perform public.emit_user_notification(
    new.user_id,
    case new.lifecycle_status
      when 'reschedule_requested' then 'appointment:' || new.id::text || ':reschedule-request:' || coalesce(v_request_id, 'pending')
      else 'appointment:' || new.id::text || ':' || new.lifecycle_status
    end,
    'appointment_' || new.lifecycle_status,
    'agenda',
    case new.lifecycle_status when 'confirmed' then 'success' else 'warning' end,
    case new.lifecycle_status
      when 'confirmed' then 'Agendamento confirmado'
      when 'cancelled' then 'Agendamento cancelado pelo paciente'
      else 'Solicitacao de reagendamento'
    end,
    case new.lifecycle_status
      when 'confirmed' then coalesce(v_patient_name, 'O paciente') || ' confirmou a consulta.'
      when 'cancelled' then coalesce(v_patient_name, 'O paciente') || ' cancelou a consulta.'
      else coalesce(v_patient_name, 'O paciente') || ' solicitou um novo horario.'
    end,
    '/agenda?appointmentId=' || new.id::text,
    case new.lifecycle_status when 'reschedule_requested' then 'high' when 'cancelled' then 'high' else 'normal' end,
    jsonb_build_object(
      'sourceModule', 'agenda',
      'eventSource', 'appointment_lifecycle',
      'appointmentId', new.id,
      'patientId', new.patient_id,
      'requestId', v_request_id,
      'requiresAction', new.lifecycle_status = 'reschedule_requested',
      'nativePushEligible', new.lifecycle_status in ('reschedule_requested', 'cancelled'),
      'deadlineAt', new.start_time
    ),
    '{}'::jsonb,
    null
  );

  return new;
end;
$$;

drop trigger if exists appointments_emit_lifecycle_notification on public.appointments;
create trigger appointments_emit_lifecycle_notification
after update of lifecycle_status on public.appointments
for each row execute function private.emit_appointment_lifecycle_notification();

create or replace function private.capture_appointment_financial_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_appointment_id uuid;
  v_source_id uuid;
  v_status text;
  v_old_status text;
  v_event_type text;
  v_payment_status text;
  v_key text;
begin
  v_appointment_id := nullif(v_new ->> 'appointment_id', '')::uuid;
  if v_appointment_id is null then
    return new;
  end if;

  v_source_id := (v_new ->> 'id')::uuid;
  v_status := lower(coalesce(v_new ->> 'normalized_status', v_new ->> 'status', 'pending'));
  v_old_status := lower(coalesce(v_old ->> 'normalized_status', v_old ->> 'status', ''));

  if tg_table_name = 'financial_entries' then
    update public.appointments
    set
      financial_entry_id = coalesce(financial_entry_id, v_source_id),
      payment_status = case v_status
        when 'paid' then 'paid'
        when 'overdue' then 'overdue'
        when 'cancelled' then 'cancelled'
        else 'pending'
      end
    where id = v_appointment_id;
    v_event_type := case
      when tg_op = 'INSERT' then 'financial_entry_created'
      when v_status is distinct from v_old_status and v_status = 'paid' then 'payment_paid'
      when v_status is distinct from v_old_status and v_status = 'overdue' then 'payment_overdue'
      when v_status is distinct from v_old_status and v_status = 'cancelled' then 'charge_cancelled'
      else null
    end;
  elsif tg_table_name = 'nb_payments' then
    v_payment_status := case v_status
      when 'paid' then 'paid'
      when 'processing' then 'processing'
      when 'failed' then 'failed'
      when 'overdue' then 'overdue'
      when 'canceled' then 'cancelled'
      when 'cancelled' then 'cancelled'
      when 'refunded' then 'refunded'
      when 'partially_refunded' then 'refunded'
      when 'expired' then 'expired'
      else 'pending'
    end;
    update public.appointments
    set charge_id = coalesce(charge_id, v_source_id), payment_status = v_payment_status
    where id = v_appointment_id;
    v_event_type := case
      when tg_op = 'INSERT' then 'charge_created'
      when v_status is distinct from v_old_status and v_status = 'paid' then 'payment_paid'
      when v_status is distinct from v_old_status and v_status = 'overdue' then 'payment_overdue'
      when v_status is distinct from v_old_status and v_status = 'expired' then 'payment_expired'
      when v_status is distinct from v_old_status and v_status = 'failed' then 'payment_failed'
      when v_status is distinct from v_old_status and v_status in ('refunded', 'partially_refunded') then 'payment_refunded'
      when v_status is distinct from v_old_status and v_status in ('cancelled', 'canceled') then 'charge_cancelled'
      when coalesce(v_old ->> 'pix_copy_paste', '') = '' and coalesce(v_new ->> 'pix_copy_paste', '') <> '' then 'pix_generated'
      when coalesce(v_old ->> 'boleto_url', '') = '' and coalesce(v_new ->> 'boleto_url', '') <> '' then 'boleto_generated'
      else null
    end;
  elsif tg_table_name = 'transactions' then
    update public.appointments
    set financial_launch_id = coalesce(financial_launch_id, v_source_id), payment_status = case
      when v_status in ('paid', 'completed') then 'paid'
      else 'pending'
    end
    where id = v_appointment_id;
    v_event_type := case when tg_op = 'INSERT' then 'financial_launch_created' else null end;
  elsif tg_table_name = 'patient_package_session_usages' then
    update public.appointments
    set package_id = coalesce(package_id, nullif(v_new ->> 'package_id', '')::uuid)
    where id = v_appointment_id;
    v_event_type := case when tg_op = 'INSERT' then 'package_session_linked' else null end;
  end if;

  if v_event_type is null then
    return new;
  end if;

  v_key := tg_table_name || ':' || v_source_id::text || ':' || v_event_type;
  perform private.append_appointment_event(
    v_appointment_id,
    v_event_type,
    null,
    null,
    case when tg_table_name = 'nb_payments' then 'provider' else 'system' end,
    null,
    case when tg_table_name = 'nb_payments' then 'neurofinance' else 'finance' end,
    jsonb_strip_nulls(jsonb_build_object(
      'sourceTable', tg_table_name,
      'sourceId', v_source_id,
      'status', v_status,
      'previousStatus', nullif(v_old_status, ''),
      'amount', coalesce(v_new -> 'gross_amount', v_new -> 'amount'),
      'paymentMethod', coalesce(v_new ->> 'payment_method_type', v_new ->> 'payment_method'),
      'providerPaymentId', v_new ->> 'provider_payment_id',
      'packageId', v_new ->> 'package_id'
    )),
    v_key
  );

  if tg_table_name = 'nb_payments'
    and coalesce(v_old ->> 'pix_copy_paste', '') = ''
    and coalesce(v_new ->> 'pix_copy_paste', '') <> ''
    and v_event_type <> 'pix_generated'
  then
    perform private.append_appointment_event(
      v_appointment_id,
      'pix_generated',
      null,
      null,
      'provider',
      null,
      'neurofinance',
      jsonb_strip_nulls(jsonb_build_object(
        'sourceTable', tg_table_name,
        'sourceId', v_source_id,
        'providerPaymentId', v_new ->> 'provider_payment_id'
      )),
      tg_table_name || ':' || v_source_id::text || ':pix_generated'
    );
  end if;

  if tg_table_name = 'nb_payments'
    and coalesce(v_old ->> 'boleto_url', '') = ''
    and coalesce(v_new ->> 'boleto_url', '') <> ''
    and v_event_type <> 'boleto_generated'
  then
    perform private.append_appointment_event(
      v_appointment_id,
      'boleto_generated',
      null,
      null,
      'provider',
      null,
      'neurofinance',
      jsonb_strip_nulls(jsonb_build_object(
        'sourceTable', tg_table_name,
        'sourceId', v_source_id,
        'providerPaymentId', v_new ->> 'provider_payment_id'
      )),
      tg_table_name || ':' || v_source_id::text || ':boleto_generated'
    );
  end if;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.financial_entries') is not null then
    execute 'drop trigger if exists financial_entries_capture_appointment_event on public.financial_entries';
    execute 'create trigger financial_entries_capture_appointment_event after insert or update on public.financial_entries for each row execute function private.capture_appointment_financial_event()';
  end if;
  if to_regclass('public.nb_payments') is not null then
    execute 'drop trigger if exists nb_payments_capture_appointment_event on public.nb_payments';
    execute 'create trigger nb_payments_capture_appointment_event after insert or update on public.nb_payments for each row execute function private.capture_appointment_financial_event()';
  end if;
  if to_regclass('public.transactions') is not null then
    execute 'drop trigger if exists transactions_capture_appointment_event on public.transactions';
    execute 'create trigger transactions_capture_appointment_event after insert or update on public.transactions for each row execute function private.capture_appointment_financial_event()';
  end if;
  if to_regclass('public.patient_package_session_usages') is not null then
    execute 'drop trigger if exists package_usages_capture_appointment_event on public.patient_package_session_usages';
    execute 'create trigger package_usages_capture_appointment_event after insert or update on public.patient_package_session_usages for each row execute function private.capture_appointment_financial_event()';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'appointment_events'
  ) then
    alter publication supabase_realtime add table public.appointment_events;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'appointment_reschedule_requests'
  ) then
    alter publication supabase_realtime add table public.appointment_reschedule_requests;
  end if;
end $$;

comment on column public.appointments.status is
  'Clinical attendance outcome retained for reports and billing compatibility.';
comment on column public.appointments.lifecycle_status is
  'Operational appointment state machine for invitation, confirmation, cancellation, rescheduling, and consultation progress.';
comment on table public.appointment_events is
  'Append-only audit timeline for appointment lifecycle, communication, clinical, and financial events.';
comment on table public.appointment_reschedule_requests is
  'Patient proposals that never alter the official appointment time until professional approval.';

notify pgrst, 'reload schema';

commit;
