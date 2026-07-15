begin;

alter table public.appointments
  add column if not exists confirmation_revision integer not null default 1,
  add column if not exists confirmed_revision integer;

update public.appointments
set confirmed_revision = confirmation_revision
where confirmed_at is not null
  and confirmed_revision is null;

alter table public.appointments
  drop constraint if exists appointments_confirmation_revision_check,
  add constraint appointments_confirmation_revision_check
    check (
      confirmation_revision >= 1
      and (confirmed_revision is null or confirmed_revision between 1 and confirmation_revision)
    );

alter table public.appointment_confirmation_tokens
  add column if not exists appointment_revision integer;

update public.appointment_confirmation_tokens token_row
set appointment_revision = appointment.confirmation_revision
from public.appointments appointment
where appointment.id = token_row.appointment_id
  and token_row.appointment_revision is null;

alter table public.appointment_confirmation_tokens
  alter column appointment_revision set not null,
  drop constraint if exists appointment_confirmation_tokens_revision_check,
  add constraint appointment_confirmation_tokens_revision_check
    check (appointment_revision >= 1);

create index if not exists appointment_confirmation_tokens_revision_idx
  on public.appointment_confirmation_tokens (
    appointment_id,
    appointment_revision,
    status,
    expires_at desc
  );

alter table public.appointments
  drop constraint if exists appointments_lifecycle_status_check;

alter table public.appointments
  add constraint appointments_lifecycle_status_check
  check (lifecycle_status in (
    'created',
    'invitation_sent',
    'awaiting_confirmation',
    'awaiting_reconfirmation',
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

create or replace function private.guard_appointment_confirmation_token_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_revision integer;
begin
  if new.status not in ('pending', 'sent', 'opened') or new.revoked_at is not null then
    return new;
  end if;

  select appointment.confirmation_revision
  into v_current_revision
  from public.appointments appointment
  where appointment.id = new.appointment_id;

  if not found then
    raise exception 'Appointment not found for confirmation token';
  end if;

  if new.appointment_revision <> v_current_revision then
    raise exception 'Confirmation token belongs to a superseded appointment revision';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_appointment_confirmation_token_revision()
  from public, anon, authenticated;

drop trigger if exists appointment_confirmation_tokens_guard_revision
  on public.appointment_confirmation_tokens;
create trigger appointment_confirmation_tokens_guard_revision
before insert or update of appointment_id, appointment_revision, status, revoked_at
on public.appointment_confirmation_tokens
for each row execute function private.guard_appointment_confirmation_token_revision();

create or replace function private.version_appointment_confirmation_cycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_material_change boolean;
  v_patient_requested_approval boolean := false;
  v_has_confirmation_cycle boolean;
  v_professional_change boolean;
  v_next_revision integer;
  v_changed_fields text[];
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  -- Revisions are database-owned. Direct table updates cannot forge either
  -- the current version or the version acknowledged by the patient.
  new.confirmation_revision := old.confirmation_revision;
  new.confirmed_revision := old.confirmed_revision;

  -- Confirmation is scoped only to patient-facing scheduling details. Notes,
  -- financial metadata and other internal fields never restart this cycle.
  v_material_change :=
    new.start_time is distinct from old.start_time
    or new.end_time is distinct from old.end_time
    or new.type is distinct from old.type
    or nullif(btrim(new.location), '') is distinct from nullif(btrim(old.location), '')
    or nullif(btrim(new.google_meet_link), '') is distinct from nullif(btrim(old.google_meet_link), '');

  v_professional_change := auth.uid() = old.user_id;

  v_has_confirmation_cycle :=
    old.confirmed_at is not null
    or old.confirmed_revision is not null
    or old.lifecycle_status <> 'created'
    or exists (
      select 1
      from public.appointment_confirmation_tokens token_row
      where token_row.appointment_id = old.id
    );

  if v_material_change
    and old.lifecycle_status = 'reschedule_requested'
    and new.lifecycle_status = 'reschedule_approved'
    and new.type is not distinct from old.type
    and nullif(btrim(new.location), '') is not distinct from nullif(btrim(old.location), '')
    and nullif(btrim(new.google_meet_link), '') is not distinct from nullif(btrim(old.google_meet_link), '')
  then
    select exists (
      select 1
      from public.appointment_reschedule_requests request_row
      where request_row.appointment_id = old.id
        and request_row.status = 'approved'
        and request_row.reviewed_by = new.updated_by
        and request_row.requested_start_time = new.start_time
        and request_row.requested_end_time = new.end_time
    ) into v_patient_requested_approval;
  end if;

  if v_material_change
    and v_professional_change
    and v_has_confirmation_cycle
    and old.patient_id is not null
    and old.lifecycle_status not in ('cancelled', 'in_progress', 'completed', 'closed')
    and not v_patient_requested_approval
  then
    v_next_revision := old.confirmation_revision + 1;
    v_changed_fields := array_remove(array[
      case when new.start_time is distinct from old.start_time then 'date_or_start_time' end,
      case when new.end_time is distinct from old.end_time then 'end_time_or_duration' end,
      case when new.type is distinct from old.type then 'modality' end,
      case when nullif(btrim(new.location), '') is distinct from nullif(btrim(old.location), '') then 'location' end,
      case when nullif(btrim(new.google_meet_link), '') is distinct from nullif(btrim(old.google_meet_link), '') then 'teleconsultation_link' end
    ], null);

    new.confirmation_revision := v_next_revision;
    new.confirmed_revision := null;
    new.confirmed_at := null;
    new.invitation_sent_at := null;
    new.invitation_opened_at := null;
    new.lifecycle_status := 'awaiting_reconfirmation';
    new.updated_by := auth.uid();
    new.action_origin := 'professional_app';
    new.last_actor_type := 'psychologist';
    new.audit_metadata := coalesce(new.audit_metadata, '{}'::jsonb) || jsonb_build_object(
      'confirmationRevision', v_next_revision,
      'previousConfirmationRevision', old.confirmation_revision,
      'previousConfirmedAt', old.confirmed_at,
      'changedFields', to_jsonb(v_changed_fields),
      'idempotencyKey',
        'appointment:' || old.id::text || ':confirmation-revision:' || v_next_revision::text || ':required'
    );

    update public.appointment_confirmation_tokens token_row
    set
      status = 'revoked',
      revoked_at = coalesce(token_row.revoked_at, now()),
      metadata = coalesce(token_row.metadata, '{}'::jsonb) || jsonb_build_object(
        'revokedReason', 'appointment_revision_changed',
        'supersededByRevision', v_next_revision
      )
    where token_row.appointment_id = old.id
      and token_row.status in ('pending', 'sent', 'opened')
      and token_row.revoked_at is null;
  end if;

  -- The public action function stays idempotent, while each confirmed revision
  -- receives its own immutable timeline event instead of overwriting revision 1.
  if new.lifecycle_status = 'confirmed'
    and (
      old.lifecycle_status is distinct from 'confirmed'
      or old.confirmed_revision is distinct from new.confirmation_revision
    )
  then
    new.confirmed_revision := new.confirmation_revision;
    new.audit_metadata := coalesce(new.audit_metadata, '{}'::jsonb) || jsonb_build_object(
      'confirmationRevision', new.confirmation_revision,
      'idempotencyKey',
        'appointment:' || new.id::text || ':confirmation-revision:' || new.confirmation_revision::text || ':confirmed'
    );
  end if;

  return new;
end;
$$;

revoke all on function private.version_appointment_confirmation_cycle()
  from public, anon, authenticated;

drop trigger if exists appointments_00_version_confirmation_cycle
  on public.appointments;
create trigger appointments_00_version_confirmation_cycle
before update on public.appointments
for each row execute function private.version_appointment_confirmation_cycle();

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
        'modality', new.type,
        'confirmationRevision', new.confirmation_revision
      ),
      'appointment:' || new.id::text || ':created'
    );
    return new;
  end if;

  if new.lifecycle_status is distinct from old.lifecycle_status then
    v_event_type := case new.lifecycle_status
      when 'invitation_sent' then 'invitation_sent'
      when 'awaiting_confirmation' then 'awaiting_confirmation'
      when 'awaiting_reconfirmation' then 'appointment_reconfirmation_required'
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
    'endTime', new.end_time,
    'previousConfirmationRevision', old.confirmation_revision,
    'confirmationRevision', new.confirmation_revision,
    'confirmedRevision', new.confirmed_revision
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

revoke all on function private.capture_appointment_event()
  from public, anon, authenticated;

comment on column public.appointments.confirmation_revision is
  'Monotonic version of the patient-facing appointment details. Material professional changes start a new confirmation cycle.';
comment on column public.appointments.confirmed_revision is
  'Current appointment revision confirmed by the patient; null means the current revision is not confirmed.';
comment on column public.appointment_confirmation_tokens.appointment_revision is
  'Appointment revision this bearer token is allowed to open and mutate.';

commit;
