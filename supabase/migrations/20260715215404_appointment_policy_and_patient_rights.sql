begin;

create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create extension if not exists pg_net;
create schema if not exists private;

-- Global concurrency invariant for appointment-scoped commands:
--   1. lock the public.appointments row;
--   2. acquire the appointment advisory transaction lock;
--   3. only then lock child rows such as tokens, requests or bindings.
-- UPDATE triggers already run while the appointment row is locked, so using
-- advisory-first anywhere else would create a row/advisory deadlock cycle.

-- Commercial policies are append-only. A new configuration creates a new
-- version; it never mutates the version already frozen for an invitation.
create table public.appointment_policy_versions (
  id uuid primary key default gen_random_uuid(),
  psychologist_id uuid not null references auth.users(id) on delete cascade,
  version integer not null,
  effective_at timestamptz not null default now(),
  free_cancellation_hours numeric(8,2) not null default 24,
  free_reschedule_hours numeric(8,2) not null default 24,
  minimum_patient_reaction_hours numeric(8,2) not null default 4,
  professional_response_sla_hours numeric(8,2) not null default 8,
  late_cancellation_consequence text not null default 'manual_review',
  no_show_consequence text not null default 'manual_review',
  professional_no_response_behavior text not null default 'protect_patient',
  package_credit_policy text not null default 'release_reserved_credit',
  charge_policy text not null default 'cancel_pending_keep_paid_as_credit',
  fiscal_policy text not null default 'disable_unissued_review_issued',
  timezone text not null default 'America/Sao_Paulo',
  created_by uuid references auth.users(id) on delete set null,
  source text not null default 'professional_settings',
  idempotency_key text,
  request_fingerprint text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint appointment_policy_versions_version_check check (version >= 1),
  constraint appointment_policy_versions_hours_check check (
    free_cancellation_hours >= 0
    and free_cancellation_hours <= 8760
    and free_reschedule_hours >= 0
    and free_reschedule_hours <= 8760
    and minimum_patient_reaction_hours >= 0
    and minimum_patient_reaction_hours <= 720
    and professional_response_sla_hours > 0
    and professional_response_sla_hours <= 720
  ),
  constraint appointment_policy_versions_late_cancel_check check (
    late_cancellation_consequence in (
      'consume_credit', 'keep_charge', 'partial_fee', 'manual_review', 'waive'
    )
  ),
  constraint appointment_policy_versions_no_show_check check (
    no_show_consequence in (
      'consume_credit', 'keep_charge', 'partial_fee', 'manual_review', 'waive'
    )
  ),
  constraint appointment_policy_versions_no_response_check check (
    professional_no_response_behavior = 'protect_patient'
  ),
  constraint appointment_policy_versions_package_credit_policy_check check (
    package_credit_policy in (
      'release_reserved_credit', 'keep_reserved_credit', 'manual_review'
    )
  ),
  constraint appointment_policy_versions_charge_policy_check check (
    charge_policy in (
      'cancel_pending_keep_paid_as_credit', 'keep_existing',
      'refund_paid', 'manual_review'
    )
  ),
  constraint appointment_policy_versions_fiscal_policy_check check (
    fiscal_policy in (
      'disable_unissued_review_issued', 'keep_existing', 'manual_review'
    )
  ),
  constraint appointment_policy_versions_request_identity_check check (
    (idempotency_key is null and request_fingerprint is null)
    or (
      idempotency_key is not null
      and request_fingerprint is not null
      and char_length(idempotency_key) between 1 and 240
      and request_fingerprint ~ '^[0-9a-f]{64}$'
    )
  ),
  unique (psychologist_id, version)
);

create index appointment_policy_versions_effective_idx
  on public.appointment_policy_versions (psychologist_id, effective_at desc, version desc);
create index appointment_policy_versions_request_fingerprint_idx
  on public.appointment_policy_versions (psychologist_id, request_fingerprint)
  where request_fingerprint is not null;
create unique index appointment_policy_versions_idempotency_idx
  on public.appointment_policy_versions (psychologist_id, idempotency_key)
  where idempotency_key is not null;

-- One appointment can receive more than one immutable snapshot over its life:
-- for example after the professional changes the patient-facing schedule.
-- The appointments.policy_snapshot_id column always points at the current one.
create table public.appointment_policy_snapshots (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete restrict,
  appointment_revision integer not null,
  snapshot_sequence integer not null,
  policy_version_id uuid references public.appointment_policy_versions(id) on delete restrict,
  policy_version integer not null,
  appointment_start_time timestamptz not null,
  appointment_end_time timestamptz not null,
  free_cancellation_hours numeric(8,2) not null,
  free_reschedule_hours numeric(8,2) not null,
  minimum_patient_reaction_hours numeric(8,2) not null,
  professional_response_sla_hours numeric(8,2) not null,
  late_cancellation_consequence text not null,
  no_show_consequence text not null,
  professional_no_response_behavior text not null,
  package_credit_policy text not null,
  charge_policy text not null,
  fiscal_policy text not null,
  timezone text not null,
  free_cancellation_cutoff_at timestamptz not null,
  free_reschedule_cutoff_at timestamptz not null,
  predicted_financial_consequence text not null,
  source text not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint appointment_policy_snapshots_revision_check check (
    appointment_revision >= 1 and snapshot_sequence >= 1
  ),
  constraint appointment_policy_snapshots_hours_check check (
    free_cancellation_hours between 0 and 8760
    and free_reschedule_hours between 0 and 8760
    and minimum_patient_reaction_hours between 0 and 720
    and professional_response_sla_hours > 0
    and professional_response_sla_hours <= 720
  ),
  constraint appointment_policy_snapshots_range_check check (
    appointment_end_time > appointment_start_time
    and free_cancellation_cutoff_at <= appointment_start_time
    and free_reschedule_cutoff_at <= appointment_start_time
  ),
  unique (appointment_id, snapshot_sequence),
  unique (id, appointment_id, appointment_revision)
);

create index appointment_policy_snapshots_appointment_revision_idx
  on public.appointment_policy_snapshots (
    appointment_id, appointment_revision, snapshot_sequence desc
  );
create index appointment_policy_snapshots_policy_version_idx
  on public.appointment_policy_snapshots (policy_version_id)
  where policy_version_id is not null;

alter table public.appointments
  add column if not exists policy_snapshot_id uuid,
  add column if not exists patient_right_status text not null default 'standard',
  add column if not exists clinical_outcome text not null default 'not_determined',
  add column if not exists financial_outcome text not null default 'pending',
  add column if not exists change_responsibility text not null default 'none',
  add column if not exists patient_action_due_at timestamptz,
  add column if not exists professional_response_due_at timestamptz,
  add column if not exists financial_protection_reason text,
  add column if not exists outcome_review_required boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_policy_snapshot_id_fkey'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_policy_snapshot_id_fkey
      foreign key (policy_snapshot_id)
      references public.appointment_policy_snapshots(id)
      on delete restrict;
  end if;
end;
$$;

create or replace function public.prepare_appointment_invitation(
  p_appointment_id uuid,
  p_actor_user_id uuid,
  p_token_hash text,
  p_appointment_revision integer,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment public.appointments%rowtype;
  v_token public.appointment_confirmation_tokens%rowtype;
  v_snapshot_id uuid;
  v_expires_at timestamptz;
  v_now timestamptz := now();
  v_request_fingerprint text;
begin
  if nullif(btrim(p_token_hash), '') is null
    or nullif(btrim(p_idempotency_key), '') is null
  then
    raise exception 'Token hash and idempotency key are required';
  end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Token hash has an invalid format';
  end if;
  if char_length(p_idempotency_key) > 240 then
    raise exception 'Idempotency key is too long';
  end if;

  select * into v_appointment
  from public.appointments
  where id = p_appointment_id
  for update;

  perform pg_advisory_xact_lock(
    hashtextextended('appointment:' || p_appointment_id::text, 0)
  );

  if not found or v_appointment.user_id <> p_actor_user_id then
    raise exception 'Appointment not found for this professional';
  end if;
  if v_appointment.lifecycle_status in ('cancelled', 'in_progress', 'completed', 'closed') then
    raise exception 'This appointment no longer accepts invitations';
  end if;
  if p_appointment_revision <> v_appointment.confirmation_revision then
    raise exception 'Appointment revision changed before invitation creation';
  end if;

  v_request_fingerprint := encode(digest(
    concat_ws('|',
      v_appointment.id::text,
      p_actor_user_id::text,
      p_appointment_revision::text,
      p_idempotency_key
    ),
    'sha256'
  ), 'hex');

  select * into v_token
  from public.appointment_confirmation_tokens
  where appointment_id = v_appointment.id
    and idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_token.appointment_revision <> v_appointment.confirmation_revision
      or (
        v_token.request_fingerprint is not null
        and v_token.request_fingerprint <> v_request_fingerprint
      )
    then
      raise exception 'Idempotency key belongs to different invitation facts';
    end if;

    if v_token.status in ('sent', 'opened')
      and v_token.revoked_at is null
      and v_token.expires_at > v_now
    then
      return jsonb_build_object(
        'tokenId', v_token.id,
        'appointmentRevision', v_token.appointment_revision,
        'expiresAt', v_token.expires_at,
        'created', false,
        'status', v_token.status,
        'policySnapshotId', v_appointment.policy_snapshot_id
      );
    end if;

    if v_token.status = 'pending'
      and v_token.revoked_at is null
      and v_token.sent_at is null
      and v_token.expires_at > v_now
      and coalesce(v_token.last_prepared_at, v_token.created_at) > v_now - interval '15 minutes'
    then
      return jsonb_build_object(
        'tokenId', v_token.id,
        'appointmentRevision', v_token.appointment_revision,
        'expiresAt', v_token.expires_at,
        'created', false,
        'status', 'pending',
        'inFlight', true,
        'policySnapshotId', v_appointment.policy_snapshot_id
      );
    end if;

    if v_token.status not in ('pending', 'failed')
      or v_token.revoked_at is not null
      or v_token.sent_at is not null
    then
      raise exception 'Finalized or revoked invitations require a new idempotency key';
    end if;
  end if;

  v_snapshot_id := private.create_appointment_policy_snapshot(
    v_appointment.id,
    case
      when v_appointment.lifecycle_status = 'awaiting_reconfirmation'
        then 'appointment_reconfirmation'
      else 'appointment_invitation'
    end,
    null,
    true
  );

  v_expires_at := greatest(
    v_appointment.end_time + interval '2 hours',
    coalesce(v_appointment.patient_action_due_at + interval '2 hours', '-infinity'::timestamptz),
    v_now + interval '24 hours'
  );

  if v_token.id is not null then
    update public.appointment_confirmation_tokens
    set
      token_hash = p_token_hash,
      expires_at = v_expires_at,
      status = 'pending',
      request_fingerprint = v_request_fingerprint,
      last_prepared_at = v_now,
      metadata = coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'appointmentRevision', v_appointment.confirmation_revision,
        'policySnapshotId', v_snapshot_id,
        'retryRotatedAt', v_now
      )
    where id = v_token.id
      and status in ('pending', 'failed')
      and revoked_at is null
      and sent_at is null
    returning * into v_token;

    if not found then
      raise exception 'Invitation retry lost its eligibility';
    end if;

    return jsonb_build_object(
      'tokenId', v_token.id,
      'appointmentRevision', v_token.appointment_revision,
      'expiresAt', v_token.expires_at,
      'created', true,
      'retried', true,
      'status', v_token.status,
      'policySnapshotId', v_snapshot_id
    );
  end if;

  update public.appointment_confirmation_tokens
  set
    status = 'revoked',
    revoked_at = coalesce(revoked_at, now()),
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'revokedReason', 'replaced_by_new_invitation',
      'replacementIdempotencyKey', p_idempotency_key
    )
  where appointment_id = v_appointment.id
    and status in ('pending', 'sent', 'opened')
    and revoked_at is null;

  insert into public.appointment_confirmation_tokens (
    appointment_id,
    appointment_revision,
    token_hash,
    expires_at,
    status,
    created_by,
    idempotency_key,
    request_fingerprint,
    last_prepared_at,
    metadata
  ) values (
    v_appointment.id,
    v_appointment.confirmation_revision,
    p_token_hash,
    v_expires_at,
    'pending',
    p_actor_user_id,
    p_idempotency_key,
    v_request_fingerprint,
    v_now,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'appointmentRevision', v_appointment.confirmation_revision,
      'policySnapshotId', v_snapshot_id
    )
  ) returning * into v_token;

  return jsonb_build_object(
    'tokenId', v_token.id,
    'appointmentRevision', v_token.appointment_revision,
    'expiresAt', v_token.expires_at,
    'created', true,
    'status', v_token.status,
    'policySnapshotId', v_snapshot_id
  );
end;
$$;

revoke all on function public.prepare_appointment_invitation(
  uuid, uuid, text, integer, text, jsonb
) from public, anon, authenticated;
grant execute on function public.prepare_appointment_invitation(
  uuid, uuid, text, integer, text, jsonb
) to service_role;

alter table public.appointments
  drop constraint if exists appointments_patient_right_status_check,
  add constraint appointments_patient_right_status_check check (
    patient_right_status in (
      'standard', 'request_pending', 'reaction_window',
      'financially_protected', 'disputed'
    )
  ),
  drop constraint if exists appointments_clinical_outcome_check,
  add constraint appointments_clinical_outcome_check check (
    clinical_outcome in (
      'not_determined', 'attended', 'no_show', 'cancelled', 'technical_failure'
    )
  ),
  drop constraint if exists appointments_financial_outcome_check,
  add constraint appointments_financial_outcome_check check (
    financial_outcome in (
      'pending', 'no_consequence', 'credit_released', 'credit_consumed',
      'charge_kept', 'refund_pending', 'refunded', 'manual_review', 'protected'
    )
  ),
  drop constraint if exists appointments_change_responsibility_check,
  add constraint appointments_change_responsibility_check check (
    change_responsibility in ('none', 'patient', 'professional', 'system')
  );

create index appointments_policy_snapshot_id_idx
  on public.appointments (policy_snapshot_id)
  where policy_snapshot_id is not null;
create index appointments_patient_rights_due_idx
  on public.appointments (patient_right_status, patient_action_due_at)
  where patient_right_status in ('request_pending', 'reaction_window');

alter table public.appointment_reschedule_requests
  add column if not exists appointment_revision integer,
  add column if not exists policy_snapshot_id uuid,
  add column if not exists requested_at timestamptz,
  add column if not exists seconds_remaining_at_request bigint,
  add column if not exists within_free_window boolean,
  add column if not exists professional_response_due_at timestamptz,
  add column if not exists financial_right_protected boolean not null default false,
  add column if not exists reaction_due_at timestamptz,
  add column if not exists protection_reason text,
  add column if not exists expired_without_response_at timestamptz;

update public.appointment_reschedule_requests request_row
set
  appointment_revision = coalesce(request_row.appointment_revision, appointment.confirmation_revision, 1),
  requested_at = coalesce(request_row.requested_at, request_row.created_at),
  within_free_window = coalesce(request_row.within_free_window, false)
from public.appointments appointment
where appointment.id = request_row.appointment_id
  and (
    request_row.appointment_revision is null
    or request_row.requested_at is null
    or request_row.within_free_window is null
  );

alter table public.appointment_reschedule_requests
  alter column appointment_revision set not null,
  alter column requested_at set not null,
  alter column within_free_window set not null,
  drop constraint if exists appointment_reschedule_requests_policy_snapshot_id_fkey,
  add constraint appointment_reschedule_requests_policy_snapshot_id_fkey
    foreign key (policy_snapshot_id)
    references public.appointment_policy_snapshots(id)
    on delete restrict,
  drop constraint if exists appointment_reschedule_requests_status_check,
  add constraint appointment_reschedule_requests_status_check check (
    status in ('pending', 'approved', 'rejected', 'withdrawn', 'expired_no_response')
  ),
  drop constraint if exists appointment_reschedule_requests_timing_check,
  add constraint appointment_reschedule_requests_timing_check check (
    seconds_remaining_at_request is null or seconds_remaining_at_request >= 0
  );

create index appointment_reschedule_requests_response_due_idx
  on public.appointment_reschedule_requests (professional_response_due_at, created_at)
  where status = 'pending';
create unique index if not exists appointment_reschedule_requests_pending_uidx
  on public.appointment_reschedule_requests (appointment_id)
  where status = 'pending';
create index appointment_reschedule_requests_revision_slot_idx
  on public.appointment_reschedule_requests (
    appointment_id, appointment_revision, requested_start_time, requested_end_time, status
  );
create index appointment_reschedule_requests_policy_snapshot_idx
  on public.appointment_reschedule_requests (policy_snapshot_id)
  where policy_snapshot_id is not null;

create table public.appointment_outcome_override_requests (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete restrict,
  psychologist_id uuid not null references auth.users(id) on delete cascade,
  requested_status text,
  requested_clinical_outcome text,
  requested_financial_outcome text,
  reason text not null,
  evidence jsonb not null default '{}'::jsonb,
  policy_snapshot_id uuid references public.appointment_policy_snapshots(id) on delete restrict,
  patient_right_status text not null,
  status text not null default 'pending_review',
  requested_by uuid references auth.users(id) on delete set null,
  action_origin text not null default 'professional_app',
  idempotency_key text not null,
  request_fingerprint text not null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_reason text,
  constraint appointment_outcome_override_status_check check (
    status in ('pending_review', 'approved', 'rejected', 'withdrawn')
  ),
  constraint appointment_outcome_override_requested_status_check check (
    requested_status is null or requested_status in (
      'scheduled', 'attended', 'completed', 'no_show', 'absent',
      'cancelled_by_patient', 'cancelled_by_professional'
    )
  ),
  constraint appointment_outcome_override_requested_clinical_check check (
    requested_clinical_outcome is null or requested_clinical_outcome in (
      'not_determined', 'attended', 'no_show', 'cancelled', 'technical_failure'
    )
  ),
  constraint appointment_outcome_override_requested_financial_check check (
    requested_financial_outcome is null or requested_financial_outcome in (
      'pending', 'no_consequence', 'credit_released', 'credit_consumed',
      'charge_kept', 'refund_pending', 'refunded', 'manual_review', 'protected'
    )
  ),
  constraint appointment_outcome_override_patient_right_check check (
    patient_right_status in (
      'standard', 'request_pending', 'reaction_window',
      'financially_protected', 'disputed'
    )
  ),
  constraint appointment_outcome_override_input_shape_check check (
    char_length(btrim(reason)) between 1 and 1000
    and jsonb_typeof(evidence) = 'object'
    and octet_length(evidence::text) <= 32768
    and char_length(idempotency_key) between 1 and 240
    and request_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  unique (psychologist_id, idempotency_key)
);

create index appointment_outcome_override_appointment_idx
  on public.appointment_outcome_override_requests (appointment_id, created_at desc);
create index appointment_outcome_override_pending_idx
  on public.appointment_outcome_override_requests (psychologist_id, created_at)
  where status = 'pending_review';

create table public.appointment_communication_outbox (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete restrict,
  reschedule_request_id uuid references public.appointment_reschedule_requests(id) on delete restrict,
  psychologist_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  template_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  delivered_at timestamptz,
  provider text,
  provider_message_id text,
  last_error text,
  idempotency_key text not null,
  appointment_revision integer not null,
  policy_snapshot_id uuid references public.appointment_policy_snapshots(id) on delete restrict,
  appointment_start_time timestamptz not null,
  appointment_end_time timestamptz not null,
  payload_fingerprint text not null,
  lease_token uuid,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_communication_outbox_status_check check (
    status in ('pending', 'processing', 'delivered', 'failed', 'cancelled')
  ),
  constraint appointment_communication_outbox_attempts_check check (attempts >= 0),
  constraint appointment_communication_outbox_revision_check check (appointment_revision >= 1),
  constraint appointment_communication_outbox_range_check check (
    appointment_end_time > appointment_start_time
  ),
  constraint appointment_communication_outbox_lease_check check (
    (status = 'processing' and lease_token is not null and lease_expires_at is not null)
    or (status <> 'processing' and lease_expires_at is null)
  ),
  constraint appointment_communication_outbox_input_shape_check check (
    char_length(btrim(template_key)) between 1 and 120
    and char_length(idempotency_key) between 1 and 240
    and jsonb_typeof(payload) = 'object'
    and payload_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  unique (psychologist_id, idempotency_key)
);

create index appointment_communication_outbox_ready_idx
  on public.appointment_communication_outbox (next_attempt_at, created_at)
  where status in ('pending', 'failed');
create index appointment_communication_outbox_appointment_idx
  on public.appointment_communication_outbox (appointment_id, created_at desc);

alter table public.appointment_confirmation_tokens
  add column if not exists idempotency_key text,
  add column if not exists request_fingerprint text,
  add column if not exists last_prepared_at timestamptz;

update public.appointment_confirmation_tokens
set last_prepared_at = coalesce(last_prepared_at, created_at, now())
where last_prepared_at is null;

update public.appointments
set token = null, auth_code = null
where token is not null or auth_code is not null;

update public.appointment_confirmation_tokens
set token = null
where token is not null;

alter table public.appointments
  drop constraint if exists appointments_no_plaintext_token_check,
  add constraint appointments_no_plaintext_token_check check (token is null),
  drop constraint if exists appointments_no_plaintext_auth_code_check,
  add constraint appointments_no_plaintext_auth_code_check check (auth_code is null);

alter table public.appointment_confirmation_tokens
  drop constraint if exists appointment_confirmation_tokens_no_plaintext_check,
  add constraint appointment_confirmation_tokens_no_plaintext_check check (token is null),
  drop constraint if exists appointment_confirmation_tokens_hash_format_check,
  add constraint appointment_confirmation_tokens_hash_format_check check (
    token_hash is null or token_hash ~ '^[0-9a-f]{64}$'
  );

with ranked_active_tokens as (
  select
    id,
    row_number() over (
      partition by appointment_id
      order by coalesce(sent_at, created_at) desc, id desc
    ) as active_rank
  from public.appointment_confirmation_tokens
  where status in ('pending', 'sent', 'opened')
    and revoked_at is null
)
update public.appointment_confirmation_tokens token_row
set
  status = 'revoked',
  revoked_at = coalesce(token_row.revoked_at, now()),
  metadata = coalesce(token_row.metadata, '{}'::jsonb)
    || jsonb_build_object('revokedReason', 'active_token_normalization')
from ranked_active_tokens ranked
where ranked.id = token_row.id
  and ranked.active_rank > 1;

create unique index appointment_confirmation_tokens_one_active_idx
  on public.appointment_confirmation_tokens (appointment_id)
  where status in ('pending', 'sent', 'opened') and revoked_at is null;
create unique index appointment_confirmation_tokens_idempotency_idx
  on public.appointment_confirmation_tokens (appointment_id, idempotency_key)
  where idempotency_key is not null;

-- Immutable audit facts cannot be updated or physically deleted.
create or replace function private.reject_immutable_appointment_policy_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Appointment policy history is immutable';
end;
$$;

revoke all on function private.reject_immutable_appointment_policy_mutation()
  from public, anon, authenticated;

create or replace function private.validate_appointment_policy_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_timezone_names timezone_row
    where timezone_row.name = new.timezone
  ) then
    raise exception 'Unknown IANA timezone';
  end if;
  if jsonb_typeof(new.metadata) <> 'object' then
    raise exception 'Policy metadata must be a JSON object';
  end if;
  if nullif(btrim(new.source), '') is null or char_length(new.source) > 80 then
    raise exception 'Policy source is invalid';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_appointment_policy_version()
  from public, anon, authenticated;

drop trigger if exists appointment_policy_versions_validate
  on public.appointment_policy_versions;
create trigger appointment_policy_versions_validate
before insert on public.appointment_policy_versions
for each row execute function private.validate_appointment_policy_version();

drop trigger if exists appointment_policy_versions_immutable
  on public.appointment_policy_versions;
create trigger appointment_policy_versions_immutable
before update or delete on public.appointment_policy_versions
for each row execute function private.reject_immutable_appointment_policy_mutation();

drop trigger if exists appointment_policy_snapshots_immutable
  on public.appointment_policy_snapshots;
create trigger appointment_policy_snapshots_immutable
before update or delete on public.appointment_policy_snapshots
for each row execute function private.reject_immutable_appointment_policy_mutation();

drop trigger if exists appointment_outcome_override_requests_no_delete
  on public.appointment_outcome_override_requests;
create trigger appointment_outcome_override_requests_no_delete
before delete on public.appointment_outcome_override_requests
for each row execute function private.reject_immutable_appointment_policy_mutation();

create or replace function private.guard_appointment_outcome_override_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.appointment_id is distinct from old.appointment_id
    or new.psychologist_id is distinct from old.psychologist_id
    or new.requested_status is distinct from old.requested_status
    or new.requested_clinical_outcome is distinct from old.requested_clinical_outcome
    or new.requested_financial_outcome is distinct from old.requested_financial_outcome
    or new.reason is distinct from old.reason
    or new.evidence is distinct from old.evidence
    or new.policy_snapshot_id is distinct from old.policy_snapshot_id
    or new.patient_right_status is distinct from old.patient_right_status
    or new.requested_by is distinct from old.requested_by
    or new.action_origin is distinct from old.action_origin
    or new.idempotency_key is distinct from old.idempotency_key
    or new.request_fingerprint is distinct from old.request_fingerprint
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Outcome override request facts are immutable';
  end if;
  if old.status <> 'pending_review' and to_jsonb(new) is distinct from to_jsonb(old) then
    raise exception 'A reviewed outcome override request is immutable';
  end if;
  if new.status is distinct from old.status
    and new.status not in ('approved', 'rejected', 'withdrawn')
  then
    raise exception 'Invalid outcome override transition';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_appointment_outcome_override_mutation()
  from public, anon, authenticated;

drop trigger if exists appointment_outcome_override_requests_guard_update
  on public.appointment_outcome_override_requests;
create trigger appointment_outcome_override_requests_guard_update
before update on public.appointment_outcome_override_requests
for each row execute function private.guard_appointment_outcome_override_mutation();

alter table public.appointment_policy_versions enable row level security;
alter table public.appointment_policy_snapshots enable row level security;
alter table public.appointment_outcome_override_requests enable row level security;
alter table public.appointment_communication_outbox enable row level security;

create policy "Professionals can view own appointment policy versions"
on public.appointment_policy_versions for select to authenticated
using (psychologist_id = (select auth.uid()));

create policy "Professionals can view own appointment policy snapshots"
on public.appointment_policy_snapshots for select to authenticated
using (
  exists (
    select 1
    from public.appointments appointment
    where appointment.id = appointment_policy_snapshots.appointment_id
      and appointment.user_id = (select auth.uid())
  )
);

create policy "Professionals can view own outcome review requests"
on public.appointment_outcome_override_requests for select to authenticated
using (psychologist_id = (select auth.uid()));

revoke all on table public.appointment_policy_versions from public, anon, authenticated;
revoke all on table public.appointment_policy_snapshots from public, anon, authenticated;
revoke all on table public.appointment_outcome_override_requests from public, anon, authenticated;
revoke all on table public.appointment_communication_outbox from public, anon, authenticated;
grant select on table public.appointment_policy_versions to authenticated;
grant select on table public.appointment_policy_snapshots to authenticated;
grant select on table public.appointment_outcome_override_requests to authenticated;
grant all on table public.appointment_policy_versions to service_role;
grant all on table public.appointment_policy_snapshots to service_role;
grant all on table public.appointment_outcome_override_requests to service_role;
grant all on table public.appointment_communication_outbox to service_role;

create or replace function public.create_appointment_policy_version(
  p_free_cancellation_hours numeric,
  p_free_reschedule_hours numeric,
  p_minimum_patient_reaction_hours numeric,
  p_professional_response_sla_hours numeric,
  p_late_cancellation_consequence text,
  p_no_show_consequence text,
  p_package_credit_policy text,
  p_charge_policy text,
  p_fiscal_policy text,
  p_timezone text default 'America/Sao_Paulo',
  p_effective_at timestamptz default null,
  p_reason text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_version integer;
  v_policy public.appointment_policy_versions%rowtype;
  v_request_fingerprint text;
  v_effective_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required for a new policy version';
  end if;
  if nullif(btrim(coalesce(p_idempotency_key, '')), '') is null
    or char_length(p_idempotency_key) > 240
  then
    raise exception 'A valid idempotency key is required';
  end if;

  v_request_fingerprint := encode(digest(
    jsonb_build_object(
      'freeCancellationHours', p_free_cancellation_hours,
      'freeRescheduleHours', p_free_reschedule_hours,
      'minimumPatientReactionHours', p_minimum_patient_reaction_hours,
      'professionalResponseSlaHours', p_professional_response_sla_hours,
      'lateCancellationConsequence', p_late_cancellation_consequence,
      'noShowConsequence', p_no_show_consequence,
      'packageCreditPolicy', p_package_credit_policy,
      'chargePolicy', p_charge_policy,
      'fiscalPolicy', p_fiscal_policy,
      'timezone', p_timezone,
      'effectiveAt', case
        when p_effective_at is null then to_jsonb('server_now'::text)
        else to_jsonb(p_effective_at)
      end,
      'reason', btrim(p_reason)
    )::text,
    'sha256'
  ), 'hex');

  perform pg_advisory_xact_lock(hashtextextended('appointment-policy:' || v_user_id::text, 0));

  select * into v_policy
  from public.appointment_policy_versions
  where psychologist_id = v_user_id
    and idempotency_key = btrim(p_idempotency_key);

  if found then
    if v_policy.request_fingerprint <> v_request_fingerprint then
      raise exception 'Policy idempotency key was reused with different facts';
    end if;
    return jsonb_build_object(
      'id', v_policy.id,
      'version', v_policy.version,
      'effectiveAt', v_policy.effective_at,
      'createdAt', v_policy.created_at,
      'idempotentReplay', true
    );
  end if;

  -- Anti-retroactivity applies to a new operation. A byte-for-byte idempotent
  -- retry must remain valid even after its original effective time has passed.
  if p_effective_at < now() - interval '1 minute' then
    raise exception 'A policy cannot become effective retroactively';
  end if;
  v_effective_at := coalesce(p_effective_at, now());

  select coalesce(max(version), 0) + 1
  into v_version
  from public.appointment_policy_versions
  where psychologist_id = v_user_id;

  insert into public.appointment_policy_versions (
    psychologist_id,
    version,
    effective_at,
    free_cancellation_hours,
    free_reschedule_hours,
    minimum_patient_reaction_hours,
    professional_response_sla_hours,
    late_cancellation_consequence,
    no_show_consequence,
    professional_no_response_behavior,
    package_credit_policy,
    charge_policy,
    fiscal_policy,
    timezone,
    created_by,
    source,
    idempotency_key,
    request_fingerprint,
    metadata
  ) values (
    v_user_id,
    v_version,
    v_effective_at,
    p_free_cancellation_hours,
    p_free_reschedule_hours,
    p_minimum_patient_reaction_hours,
    p_professional_response_sla_hours,
    p_late_cancellation_consequence,
    p_no_show_consequence,
    'protect_patient',
    nullif(btrim(p_package_credit_policy), ''),
    nullif(btrim(p_charge_policy), ''),
    nullif(btrim(p_fiscal_policy), ''),
    nullif(btrim(p_timezone), ''),
    v_user_id,
    'professional_settings',
    btrim(p_idempotency_key),
    v_request_fingerprint,
    jsonb_build_object('reason', btrim(p_reason))
  )
  returning * into v_policy;

  return jsonb_build_object(
    'id', v_policy.id,
    'version', v_policy.version,
    'effectiveAt', v_policy.effective_at,
    'createdAt', v_policy.created_at,
    'idempotentReplay', false
  );
end;
$$;

revoke all on function public.create_appointment_policy_version(
  numeric, numeric, numeric, numeric, text, text, text, text, text,
  text, timestamptz, text, text
) from public, anon;
grant execute on function public.create_appointment_policy_version(
  numeric, numeric, numeric, numeric, text, text, text, text, text,
  text, timestamptz, text, text
) to authenticated;

create or replace function public.get_effective_appointment_policy()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_policy public.appointment_policy_versions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  -- PostgreSQL's clock is authoritative; no browser timestamp participates in
  -- deciding which version is currently effective.
  select * into v_policy
  from public.appointment_policy_versions policy
  where policy.psychologist_id = v_user_id
    and policy.effective_at <= now()
  order by policy.effective_at desc, policy.version desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'configured', false,
      'version', null,
      'effectiveAt', null,
      'freeCancellationHours', 24,
      'freeRescheduleHours', 24,
      'minimumPatientReactionHours', 4,
      'professionalResponseSlaHours', 8,
      'lateCancellationConsequence', 'manual_review',
      'noShowConsequence', 'manual_review',
      'professionalNoResponseBehavior', 'protect_patient',
      'packageCreditPolicy', 'release_reserved_credit',
      'chargePolicy', 'cancel_pending_keep_paid_as_credit',
      'fiscalPolicy', 'disable_unissued_review_issued',
      'timezone', 'America/Sao_Paulo'
    );
  end if;

  return jsonb_build_object(
    'configured', true,
    'version', v_policy.version,
    'effectiveAt', v_policy.effective_at,
    'freeCancellationHours', v_policy.free_cancellation_hours,
    'freeRescheduleHours', v_policy.free_reschedule_hours,
    'minimumPatientReactionHours', v_policy.minimum_patient_reaction_hours,
    'professionalResponseSlaHours', v_policy.professional_response_sla_hours,
    'lateCancellationConsequence', v_policy.late_cancellation_consequence,
    'noShowConsequence', v_policy.no_show_consequence,
    'professionalNoResponseBehavior', v_policy.professional_no_response_behavior,
    'packageCreditPolicy', v_policy.package_credit_policy,
    'chargePolicy', v_policy.charge_policy,
    'fiscalPolicy', v_policy.fiscal_policy,
    'timezone', v_policy.timezone
  );
end;
$$;

revoke all on function public.get_effective_appointment_policy()
  from public, anon;
grant execute on function public.get_effective_appointment_policy()
  to authenticated;

create or replace function private.create_appointment_policy_snapshot(
  p_appointment_id uuid,
  p_source text,
  p_policy_version_id uuid default null,
  p_preserve_granted_deadlines boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment public.appointments%rowtype;
  v_previous public.appointment_policy_snapshots%rowtype;
  v_policy public.appointment_policy_versions%rowtype;
  v_snapshot_id uuid;
  v_sequence integer;
  v_default_version integer;
  v_cancel_cutoff timestamptz;
  v_reschedule_cutoff timestamptz;
begin
  select * into v_appointment
  from public.appointments
  where id = p_appointment_id
  for update;

  perform pg_advisory_xact_lock(
    hashtextextended('appointment:' || p_appointment_id::text, 0)
  );

  if not found or v_appointment.start_time is null or v_appointment.end_time is null then
    raise exception 'A scheduled appointment is required';
  end if;

  if v_appointment.policy_snapshot_id is not null then
    select * into v_previous
    from public.appointment_policy_snapshots
    where id = v_appointment.policy_snapshot_id;

    if found
      and v_previous.appointment_revision = v_appointment.confirmation_revision
      and v_previous.appointment_start_time = v_appointment.start_time
      and v_previous.appointment_end_time = v_appointment.end_time
      and (p_policy_version_id is null or v_previous.policy_version_id = p_policy_version_id)
    then
      return v_previous.id;
    end if;
  end if;

  if v_previous.id is null then
    select * into v_previous
    from public.appointment_policy_snapshots
    where appointment_id = v_appointment.id
    order by snapshot_sequence desc
    limit 1;
  end if;

  if p_policy_version_id is not null then
    select * into v_policy
    from public.appointment_policy_versions
    where id = p_policy_version_id
      and psychologist_id = v_appointment.user_id
      and effective_at <= now();
    if not found then
      raise exception 'Policy version is not available for this professional';
    end if;
  elsif v_previous.id is not null and v_previous.policy_version_id is not null then
    select * into v_policy
    from public.appointment_policy_versions
    where id = v_previous.policy_version_id;
  else
    select * into v_policy
    from public.appointment_policy_versions
    where psychologist_id = v_appointment.user_id
      and effective_at <= now()
    order by effective_at desc, version desc
    limit 1;
  end if;

  if v_policy.id is null then
    perform pg_advisory_xact_lock(
      hashtextextended('appointment-policy:' || v_appointment.user_id::text, 0)
    );

    select coalesce(max(version), 0) + 1
    into v_default_version
    from public.appointment_policy_versions
    where psychologist_id = v_appointment.user_id;

    insert into public.appointment_policy_versions (
      psychologist_id,
      version,
      effective_at,
      created_by,
      source,
      metadata
    ) values (
      v_appointment.user_id,
      v_default_version,
      now(),
      v_appointment.user_id,
      'system_default',
      jsonb_build_object('reason', 'default_policy_initialized')
    )
    on conflict (psychologist_id, version) do nothing;

    select * into v_policy
    from public.appointment_policy_versions
    where psychologist_id = v_appointment.user_id
      and effective_at <= now()
    order by effective_at desc, version desc
    limit 1;
  end if;

  v_cancel_cutoff := v_appointment.start_time
    - make_interval(secs => (v_policy.free_cancellation_hours * 3600)::double precision);
  v_reschedule_cutoff := v_appointment.start_time
    - make_interval(secs => (v_policy.free_reschedule_hours * 3600)::double precision);

  -- Once a patient has received a deadline, a later snapshot cannot shorten it.
  -- If the professional moves the consultation before the old deadline, the
  -- appointment start itself is the upper bound; financial protection is then
  -- handled by the patient-right state machine.
  if p_preserve_granted_deadlines
    and v_previous.id is not null
  then
    v_cancel_cutoff := greatest(
      v_cancel_cutoff,
      least(v_previous.free_cancellation_cutoff_at, v_appointment.start_time)
    );
    v_reschedule_cutoff := greatest(
      v_reschedule_cutoff,
      least(v_previous.free_reschedule_cutoff_at, v_appointment.start_time)
    );
  end if;

  select coalesce(max(snapshot_sequence), 0) + 1
  into v_sequence
  from public.appointment_policy_snapshots
  where appointment_id = v_appointment.id;

  insert into public.appointment_policy_snapshots (
    appointment_id,
    appointment_revision,
    snapshot_sequence,
    policy_version_id,
    policy_version,
    appointment_start_time,
    appointment_end_time,
    free_cancellation_hours,
    free_reschedule_hours,
    minimum_patient_reaction_hours,
    professional_response_sla_hours,
    late_cancellation_consequence,
    no_show_consequence,
    professional_no_response_behavior,
    package_credit_policy,
    charge_policy,
    fiscal_policy,
    timezone,
    free_cancellation_cutoff_at,
    free_reschedule_cutoff_at,
    predicted_financial_consequence,
    source,
    metadata
  ) values (
    v_appointment.id,
    v_appointment.confirmation_revision,
    v_sequence,
    v_policy.id,
    v_policy.version,
    v_appointment.start_time,
    v_appointment.end_time,
    v_policy.free_cancellation_hours,
    v_policy.free_reschedule_hours,
    v_policy.minimum_patient_reaction_hours,
    v_policy.professional_response_sla_hours,
    v_policy.late_cancellation_consequence,
    v_policy.no_show_consequence,
    v_policy.professional_no_response_behavior,
    v_policy.package_credit_policy,
    v_policy.charge_policy,
    v_policy.fiscal_policy,
    v_policy.timezone,
    v_cancel_cutoff,
    v_reschedule_cutoff,
    v_policy.late_cancellation_consequence,
    coalesce(nullif(p_source, ''), 'appointment_invitation'),
    jsonb_build_object(
      'policyEffectiveAt', v_policy.effective_at,
      'preservedGrantedDeadlines', p_preserve_granted_deadlines
    )
  ) returning id into v_snapshot_id;

  update public.appointments
  set policy_snapshot_id = v_snapshot_id
  where id = v_appointment.id;

  return v_snapshot_id;
end;
$$;

revoke all on function private.create_appointment_policy_snapshot(uuid, text, uuid, boolean)
  from public, anon, authenticated;

create or replace function public.ensure_appointment_policy_snapshot(
  p_appointment_id uuid,
  p_actor_user_id uuid,
  p_source text default 'appointment_invitation'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_snapshot_id uuid;
  v_owner uuid;
  v_snapshot public.appointment_policy_snapshots%rowtype;
begin
  select user_id into v_owner
  from public.appointments
  where id = p_appointment_id;

  if not found or v_owner <> p_actor_user_id then
    raise exception 'Appointment not found for this professional';
  end if;

  v_snapshot_id := private.create_appointment_policy_snapshot(
    p_appointment_id,
    p_source,
    null,
    true
  );

  select * into v_snapshot
  from public.appointment_policy_snapshots
  where id = v_snapshot_id;

  return jsonb_build_object(
    'id', v_snapshot.id,
    'policyVersion', v_snapshot.policy_version,
    'appointmentRevision', v_snapshot.appointment_revision,
    'freeCancellationCutoffAt', v_snapshot.free_cancellation_cutoff_at,
    'freeRescheduleCutoffAt', v_snapshot.free_reschedule_cutoff_at,
    'professionalResponseSlaHours', v_snapshot.professional_response_sla_hours,
    'minimumPatientReactionHours', v_snapshot.minimum_patient_reaction_hours,
    'lateCancellationConsequence', v_snapshot.late_cancellation_consequence,
    'packageCreditPolicy', v_snapshot.package_credit_policy,
    'chargePolicy', v_snapshot.charge_policy,
    'fiscalPolicy', v_snapshot.fiscal_policy,
    'timezone', v_snapshot.timezone
  );
end;
$$;

revoke all on function public.ensure_appointment_policy_snapshot(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.ensure_appointment_policy_snapshot(uuid, uuid, text)
  to service_role;

-- Existing appointments receive a default current snapshot. This does not send
-- notifications and does not mutate their historical invitation timestamps.
do $$
declare
  v_appointment record;
begin
  for v_appointment in
    select id
    from public.appointments
    where start_time is not null
      and end_time is not null
      and policy_snapshot_id is null
    order by id
  loop
    perform private.create_appointment_policy_snapshot(
      v_appointment.id,
      'historical_backfill',
      null,
      false
    );
  end loop;
end;
$$;

-- Legacy pending requests are made coherent only after every scheduled
-- appointment has a snapshot. A missing historical cutoff favors the patient;
-- the worker will immediately expire deadlines that are already in the past.
with pending_facts as (
  select
    request_row.id,
    appointment.policy_snapshot_id,
    appointment.confirmation_revision,
    appointment.start_time,
    snapshot.free_reschedule_cutoff_at,
    snapshot.professional_response_sla_hours,
    coalesce(request_row.requested_at, request_row.created_at, now()) as requested_at
  from public.appointment_reschedule_requests request_row
  join public.appointments appointment
    on appointment.id = request_row.appointment_id
  left join public.appointment_policy_snapshots snapshot
    on snapshot.id = appointment.policy_snapshot_id
  where request_row.status = 'pending'
)
update public.appointment_reschedule_requests request_row
set
  appointment_revision = facts.confirmation_revision,
  policy_snapshot_id = facts.policy_snapshot_id,
  requested_at = facts.requested_at,
  seconds_remaining_at_request = case
    when facts.free_reschedule_cutoff_at is null then null
    else greatest(
      floor(extract(epoch from (facts.free_reschedule_cutoff_at - facts.requested_at)))::bigint,
      0
    )
  end,
  within_free_window = case
    when facts.free_reschedule_cutoff_at is null then true
    else facts.requested_at <= facts.free_reschedule_cutoff_at
  end,
  professional_response_due_at = least(
    facts.start_time,
    facts.requested_at + make_interval(
      secs => (coalesce(facts.professional_response_sla_hours, 0) * 3600)::double precision
    )
  ),
  financial_right_protected = request_row.financial_right_protected
    or facts.free_reschedule_cutoff_at is null
    or facts.requested_at <= facts.free_reschedule_cutoff_at,
  protection_reason = case
    when request_row.financial_right_protected then request_row.protection_reason
    when facts.free_reschedule_cutoff_at is null then 'legacy_request_cutoff_unknown'
    when facts.requested_at <= facts.free_reschedule_cutoff_at then 'legacy_timely_request_backfill'
    else null
  end,
  metadata = coalesce(request_row.metadata, '{}'::jsonb)
    || jsonb_build_object('patientRightsBackfilled', true)
from pending_facts facts
where request_row.id = facts.id;

update public.appointments appointment
set
  patient_right_status = 'request_pending',
  professional_response_due_at = pending.professional_response_due_at,
  financial_protection_reason = case
    when pending.financial_right_protected then pending.protection_reason
    else null
  end
from public.appointment_reschedule_requests pending
where pending.appointment_id = appointment.id
  and pending.status = 'pending';

alter table public.appointment_reschedule_requests
  drop constraint if exists appointment_reschedule_requests_snapshot_coherence_fkey,
  add constraint appointment_reschedule_requests_snapshot_coherence_fkey
    foreign key (policy_snapshot_id, appointment_id, appointment_revision)
    references public.appointment_policy_snapshots(id, appointment_id, appointment_revision)
    on delete restrict,
  drop constraint if exists appointment_reschedule_requests_original_range_check,
  add constraint appointment_reschedule_requests_original_range_check check (
    original_end_time > original_start_time
  ),
  drop constraint if exists appointment_reschedule_requests_due_check,
  add constraint appointment_reschedule_requests_due_check check (
    professional_response_due_at is null
    or professional_response_due_at <= original_start_time
  );

-- Event rows are append-only. An idempotent replay returns the original event
-- instead of merging new metadata into historical evidence.
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
  v_existing public.appointment_events%rowtype;
  v_event_id uuid;
  v_actor_type text;
  v_action_origin text;
  v_metadata jsonb;
begin
  select * into v_appointment
  from public.appointments
  where id = p_appointment_id;

  if not found then
    raise exception 'Appointment not found';
  end if;

  v_actor_type := case
    when p_actor_type in ('psychologist', 'patient', 'system', 'edge_function', 'provider')
      then p_actor_type
    else 'system'
  end;
  v_action_origin := coalesce(nullif(p_action_origin, ''), 'system');
  v_metadata := jsonb_strip_nulls(coalesce(p_metadata, '{}'::jsonb));

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
    v_actor_type,
    p_actor_user_id,
    v_action_origin,
    p_idempotency_key,
    v_metadata
  )
  on conflict (appointment_id, idempotency_key)
    where idempotency_key is not null
  do nothing
  returning id into v_event_id;

  if v_event_id is null and p_idempotency_key is not null then
    select * into v_existing
    from public.appointment_events
    where appointment_id = p_appointment_id
      and idempotency_key = p_idempotency_key
    for share;

    if not found then
      raise exception 'Idempotent appointment event disappeared';
    end if;

    if v_existing.event_type is distinct from p_event_type
      or v_existing.from_status is distinct from p_from_status
      or v_existing.to_status is distinct from p_to_status
      or v_existing.actor_type is distinct from v_actor_type
      or v_existing.actor_user_id is distinct from p_actor_user_id
      or v_existing.action_origin is distinct from v_action_origin
      or v_existing.metadata is distinct from v_metadata
    then
      raise exception 'Idempotency key was reused with different appointment event facts';
    end if;

    v_event_id := v_existing.id;
  end if;

  return v_event_id;
end;
$$;

revoke all on function private.append_appointment_event(
  uuid, text, text, text, text, uuid, text, jsonb, text
) from public, anon, authenticated;

drop trigger if exists appointment_events_immutable
  on public.appointment_events;
create trigger appointment_events_immutable
before update or delete on public.appointment_events
for each row execute function private.reject_immutable_appointment_policy_mutation();

revoke all on table public.appointment_events
  from public, anon, authenticated;
grant all on table public.appointment_events to service_role;

do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'appointment_events'
  loop
    execute format('drop policy %I on public.appointment_events', v_policy.policyname);
  end loop;
end;
$$;

create or replace function private.guard_appointment_database_owned_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_authenticated_owner boolean := auth.uid() is not null and auth.uid() = old.user_id;
  v_trusted_command text := current_setting('neuronex.appointment_command', true);
begin
  if tg_op = 'DELETE' then
    raise exception 'Appointments with history cannot be physically deleted';
  end if;

  if v_authenticated_owner
    and coalesce(v_trusted_command, '') not in (
      'policy_application', 'outcome_override_request', 'complete_clinical_session'
    )
    and (
    new.user_id is distinct from old.user_id
    or new.patient_id is distinct from old.patient_id
    or new.status is distinct from old.status
    or new.lifecycle_status is distinct from old.lifecycle_status
    or new.previous_status is distinct from old.previous_status
    or new.invitation_sent_at is distinct from old.invitation_sent_at
    or new.invitation_opened_at is distinct from old.invitation_opened_at
    or new.confirmed_at is distinct from old.confirmed_at
    or new.cancelled_at is distinct from old.cancelled_at
    or new.cancellation_reason is distinct from old.cancellation_reason
    or new.reschedule_requested_at is distinct from old.reschedule_requested_at
    or new.reschedule_approved_at is distinct from old.reschedule_approved_at
    or new.reschedule_rejected_at is distinct from old.reschedule_rejected_at
    or new.confirmation_revision is distinct from old.confirmation_revision
    or new.confirmed_revision is distinct from old.confirmed_revision
    or new.created_by is distinct from old.created_by
    or new.updated_by is distinct from old.updated_by
    or new.action_origin is distinct from old.action_origin
    or new.last_actor_type is distinct from old.last_actor_type
    or new.audit_metadata is distinct from old.audit_metadata
    or new.policy_snapshot_id is distinct from old.policy_snapshot_id
    or new.patient_right_status is distinct from old.patient_right_status
    or new.clinical_outcome is distinct from old.clinical_outcome
    or new.financial_outcome is distinct from old.financial_outcome
    or new.change_responsibility is distinct from old.change_responsibility
    or new.patient_action_due_at is distinct from old.patient_action_due_at
    or new.professional_response_due_at is distinct from old.professional_response_due_at
    or new.financial_protection_reason is distinct from old.financial_protection_reason
    or new.outcome_review_required is distinct from old.outcome_review_required
    or new.payment_status is distinct from old.payment_status
    or new.financial_launch_id is distinct from old.financial_launch_id
    or new.financial_entry_id is distinct from old.financial_entry_id
    or new.package_id is distinct from old.package_id
    or new.charge_id is distinct from old.charge_id
    or new.payment_config is distinct from old.payment_config
    or new.price is distinct from old.price
    or new.token is distinct from old.token
    or new.auth_code is distinct from old.auth_code
  ) then
    raise exception 'Appointment lifecycle, outcome, patient and financial fields are database-owned';
  end if;

  if v_trusted_command is distinct from 'public_patient_action'
    and new.status is distinct from old.status
    and new.status in ('cancelled_by_patient', 'no_show', 'absent')
  then
    if new.status = 'cancelled_by_patient' and auth.uid() is not null then
      raise exception 'Only the patient secure action can record patient cancellation';
    end if;

    if old.patient_right_status in (
      'request_pending', 'reaction_window', 'financially_protected', 'disputed'
    ) or exists (
      select 1
      from public.appointment_reschedule_requests request_row
      where request_row.appointment_id = old.id
        and request_row.appointment_revision = old.confirmation_revision
        and request_row.status = 'pending'
    ) then
      raise exception 'This appointment has protected patient rights and requires review';
    end if;

    if new.status in ('no_show', 'absent') and now() < old.start_time then
      raise exception 'No-show cannot be recorded before the appointment starts';
    end if;
  end if;

  if new.financial_outcome is distinct from old.financial_outcome
    and new.financial_outcome in ('credit_consumed', 'charge_kept')
    and old.patient_right_status in (
      'request_pending', 'reaction_window', 'financially_protected', 'disputed'
    )
  then
    raise exception 'A protected appointment cannot receive an automatic financial penalty';
  end if;

  if new.policy_snapshot_id is not null
    and not exists (
      select 1
      from public.appointment_policy_snapshots snapshot
      where snapshot.id = new.policy_snapshot_id
        and snapshot.appointment_id = old.id
    )
  then
    raise exception 'Policy snapshot does not belong to this appointment';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_appointment_database_owned_fields()
  from public, anon, authenticated;

drop trigger if exists appointments_00_guard_database_owned_fields
  on public.appointments;
create trigger appointments_00_guard_database_owned_fields
before update on public.appointments
for each row execute function private.guard_appointment_database_owned_fields();

drop trigger if exists appointments_block_physical_delete
  on public.appointments;
create trigger appointments_block_physical_delete
before delete on public.appointments
for each row execute function private.guard_appointment_database_owned_fields();

-- Lifecycle transitions are explicit commands. Clinical status and arbitrary
-- metadata must never promote an appointment to in-progress/completed.
create or replace function private.prepare_appointment_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user uuid := auth.uid();
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
  if new.lifecycle_status is distinct from old.lifecycle_status then
    new.previous_status := old.lifecycle_status;
  end if;
  return new;
end;
$$;

revoke all on function private.prepare_appointment_audit()
  from public, anon, authenticated;

create or replace function private.guard_appointment_package_consumption()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment public.appointments%rowtype;
  v_binding public.appointment_package_bindings%rowtype;
begin
  if new.action <> 'consume' then
    return new;
  end if;
  if new.appointment_id is null or new.binding_id is null then
    raise exception 'Package consumption requires an explicit appointment reservation';
  end if;

  select * into v_appointment
  from public.appointments
  where id = new.appointment_id
  for update;

  perform pg_advisory_xact_lock(
    hashtextextended('appointment:' || new.appointment_id::text, 0)
  );

  if not found
    or v_appointment.user_id <> new.professional_id
    or v_appointment.patient_id is distinct from new.patient_id
  then
    raise exception 'Package consumption does not match the appointment parties';
  end if;

  select * into v_binding
  from public.appointment_package_bindings
  where id = new.binding_id
    and appointment_id = v_appointment.id
    and professional_id = v_appointment.user_id
    and patient_id = v_appointment.patient_id
    and package_id = new.package_id
    and status = 'reserved'
  for update;

  if not found then
    raise exception 'Package consumption requires the current reserved binding';
  end if;

  if v_appointment.confirmed_revision is null
    or v_appointment.confirmed_revision <> v_appointment.confirmation_revision
    or v_appointment.lifecycle_status not in ('completed', 'closed')
    or v_appointment.clinical_outcome <> 'attended'
    or lower(coalesce(v_appointment.status, '')) not in ('attended', 'completed')
    or now() < v_appointment.start_time
    or v_appointment.patient_right_status <> 'standard'
    or v_appointment.outcome_review_required
    or v_appointment.financial_outcome in ('protected', 'manual_review')
    or exists (
      select 1
      from public.appointment_reschedule_requests pending
      where pending.appointment_id = v_appointment.id
        and pending.appointment_revision = v_appointment.confirmation_revision
        and pending.status = 'pending'
    )
  then
    raise exception 'Package consumption is blocked until attendance and patient rights are finalized';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_appointment_package_consumption()
  from public, anon, authenticated;

drop trigger if exists patient_package_session_usages_guard_consumption
  on public.patient_package_session_usages;
create trigger patient_package_session_usages_guard_consumption
before insert on public.patient_package_session_usages
for each row execute function private.guard_appointment_package_consumption();

do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'appointments'
  loop
    execute format('drop policy %I on public.appointments', v_policy.policyname);
  end loop;
end;
$$;

create policy "Appointment owners can read"
on public.appointments for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Appointment owners can create"
on public.appointments for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Appointment owners can update safe fields"
on public.appointments for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on table public.appointments from public, anon, authenticated;
grant select, insert, update on table public.appointments to authenticated;
grant all on table public.appointments to service_role;

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
  v_trusted_command text := current_setting('neuronex.appointment_command', true);
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  -- A row-level UPDATE trigger is entered after PostgreSQL has locked OLD.
  -- The advisory lock is therefore deliberately second in the global order.
  perform pg_advisory_xact_lock(
    hashtextextended('appointment:' || old.id::text, 0)
  );

  new.confirmation_revision := old.confirmation_revision;
  new.confirmed_revision := old.confirmed_revision;

  v_material_change :=
    new.start_time is distinct from old.start_time
    or new.end_time is distinct from old.end_time
    or new.type is distinct from old.type
    or nullif(btrim(new.location), '') is distinct from nullif(btrim(old.location), '')
    or nullif(btrim(new.google_meet_link), '') is distinct from nullif(btrim(old.google_meet_link), '');

  if v_material_change
    and coalesce(v_trusted_command, '') not in (
      'historical_appointment_correction', 'archive_appointment'
    )
    and (
      new.start_time is null
      or new.end_time is null
      or new.end_time <= new.start_time
      or new.start_time <= now()
      or old.lifecycle_status in ('cancelled', 'in_progress', 'completed', 'closed')
    )
  then
    raise exception 'Patient-facing appointment facts can only change to a valid future schedule';
  end if;

  v_professional_change :=
    auth.uid() = old.user_id
    or (
      auth.role() = 'service_role'
      and new.updated_by = old.user_id
      and new.action_origin in ('google_calendar', 'professional_app', 'synapse')
      and new.last_actor_type = 'psychologist'
    );

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
    and old.lifecycle_status = 'reschedule_requested'
    and not v_patient_requested_approval
  then
    raise exception 'Review the pending patient request before changing the appointment';
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
    new.change_responsibility := 'professional';
    new.updated_by := coalesce(auth.uid(), new.updated_by, old.user_id);
    new.action_origin := case
      when new.action_origin = 'google_calendar' then 'google_calendar'
      when new.action_origin = 'synapse' then 'synapse'
      else 'professional_app'
    end;
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

alter table public.appointments
  drop constraint if exists appointments_lifecycle_status_check;
alter table public.appointments
  add constraint appointments_lifecycle_status_check check (lifecycle_status in (
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
    'professional_response_overdue',
    'in_progress',
    'completed',
    'closed'
  ));

-- Authenticated command for the legitimate clinical completion path. The
-- browser cannot write status/lifecycle/outcome directly; it can only request
-- this atomic transition with already-owned clinical references.
create or replace function public.complete_appointment_clinical_session(
  p_appointment_id uuid,
  p_session_summary_note_id uuid,
  p_session_transcript_id uuid,
  p_draft_pending boolean,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_appointment public.appointments%rowtype;
  v_existing_event public.appointment_events%rowtype;
  v_now timestamptz := now();
  v_event_key text;
  v_clinical_refs jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_draft_pending is null
    or nullif(btrim(coalesce(p_idempotency_key, '')), '') is null
    or char_length(p_idempotency_key) > 240
  then
    raise exception 'Clinical completion input is invalid';
  end if;

  -- Required global order: appointment row -> appointment advisory -> children.
  select * into v_appointment
  from public.appointments
  where id = p_appointment_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Appointment not found for this professional';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('appointment:' || v_appointment.id::text, 0)
  );

  v_event_key := 'appointment:' || v_appointment.id::text
    || ':clinical-session-completion:' || btrim(p_idempotency_key);

  select * into v_existing_event
  from public.appointment_events event
  where event.appointment_id = v_appointment.id
    and event.idempotency_key = v_event_key;

  if found then
    if v_existing_event.event_type <> 'consultation_completed'
      or coalesce(v_existing_event.metadata ->> 'sessionSummaryNoteId', '')
        <> coalesce(p_session_summary_note_id::text, '')
      or coalesce(v_existing_event.metadata ->> 'sessionTranscriptId', '')
        <> coalesce(p_session_transcript_id::text, '')
      or coalesce(v_existing_event.metadata ->> 'sessionDraftPending', '')
        <> p_draft_pending::text
      or coalesce(v_existing_event.metadata ->> 'confirmationRevision', '')
        <> v_appointment.confirmation_revision::text
    then
      raise exception 'Clinical completion idempotency key was reused with different facts';
    end if;
    if v_appointment.status <> 'attended'
      or v_appointment.lifecycle_status <> 'completed'
      or v_appointment.clinical_outcome <> 'attended'
    then
      raise exception 'Clinical completion history does not match the appointment state';
    end if;

    return jsonb_build_object(
      'success', true,
      'outcome', 'completed',
      'completedAt', v_existing_event.created_at,
      'requiresFinancialReview',
        v_appointment.outcome_review_required
        or v_appointment.patient_right_status <> 'standard'
        or v_appointment.financial_outcome in ('manual_review', 'protected'),
      'idempotentReplay', true
    );
  end if;

  if v_appointment.status in (
      'attended', 'completed', 'cancelled',
      'cancelled_by_patient', 'cancelled_by_professional'
    )
    or v_appointment.lifecycle_status in ('cancelled', 'completed', 'closed')
  then
    raise exception 'Appointment clinical outcome is already finalized';
  end if;
  if v_now < v_appointment.start_time then
    raise exception 'A clinical session cannot be completed before it starts';
  end if;
  if exists (
    select 1
    from public.appointment_reschedule_requests request_row
    where request_row.appointment_id = v_appointment.id
      and request_row.status = 'pending'
  ) then
    raise exception 'Resolve the pending patient request before completing the clinical session';
  end if;

  if p_session_summary_note_id is not null and not exists (
    select 1
    from public.session_notes note
    where note.id = p_session_summary_note_id
      and note.appointment_id = v_appointment.id
      and note.user_id = v_appointment.user_id
      and note.patient_id = v_appointment.patient_id
  ) then
    raise exception 'Session summary note does not belong to this appointment';
  end if;

  if p_session_transcript_id is not null and not exists (
    select 1
    from public.session_transcripts transcript
    where transcript.id = p_session_transcript_id
      and transcript.appointment_id = v_appointment.id
      and transcript.user_id = v_appointment.user_id
      and transcript.patient_id is not distinct from v_appointment.patient_id
      and transcript.deleted_at is null
  ) then
    raise exception 'Session transcript does not belong to this appointment';
  end if;

  if p_session_summary_note_id is not null
    and p_session_transcript_id is not null
    and (
      exists (
        select 1
        from public.session_notes note
        where note.id = p_session_summary_note_id
          and note.source_transcript_id is not null
          and note.source_transcript_id <> p_session_transcript_id
      )
      or exists (
        select 1
        from public.session_transcripts transcript
        where transcript.id = p_session_transcript_id
          and transcript.summary_note_id is not null
          and transcript.summary_note_id <> p_session_summary_note_id
      )
    )
  then
    raise exception 'Session summary and transcript references are inconsistent';
  end if;

  v_clinical_refs := jsonb_strip_nulls(jsonb_build_object(
    'sessionSummaryNoteId', p_session_summary_note_id,
    'sessionTranscriptId', p_session_transcript_id,
    'sessionDraftPending', p_draft_pending,
    'sessionCompletedAt', v_now,
    'confirmationRevision', v_appointment.confirmation_revision,
    'confirmedRevision', v_appointment.confirmed_revision,
    'patientRightStatusAtCompletion', v_appointment.patient_right_status
  ));

  perform set_config('neuronex.appointment_command', 'complete_clinical_session', true);
  update public.appointments
  set
    status = 'attended',
    lifecycle_status = 'completed',
    clinical_outcome = 'attended',
    financial_outcome = case
      when financial_outcome = 'protected' then financial_outcome
      when confirmed_revision is distinct from confirmation_revision
        or patient_right_status <> 'standard'
        then 'manual_review'
      else financial_outcome
    end,
    outcome_review_required = outcome_review_required
      or confirmed_revision is distinct from confirmation_revision
      or patient_right_status <> 'standard'
      or financial_outcome in ('manual_review', 'protected'),
    change_responsibility = 'professional',
    metadata = (coalesce(metadata, '{}'::jsonb) - 'sessionDraftNotes') || v_clinical_refs,
    updated_at = v_now,
    updated_by = v_user_id,
    action_origin = 'professional_app',
    last_actor_type = 'psychologist',
    audit_metadata = v_clinical_refs || jsonb_build_object(
      'idempotencyKey', v_event_key
    )
  where id = v_appointment.id
  returning * into v_appointment;

  if not exists (
    select 1
    from public.appointment_events event
    where event.appointment_id = v_appointment.id
      and event.idempotency_key = v_event_key
      and event.event_type = 'consultation_completed'
  ) then
    raise exception 'Clinical completion event was not recorded';
  end if;

  return jsonb_build_object(
    'success', true,
    'outcome', 'completed',
    'completedAt', v_now,
    'requiresFinancialReview',
      v_appointment.outcome_review_required
      or v_appointment.patient_right_status <> 'standard'
      or v_appointment.financial_outcome in ('manual_review', 'protected'),
    'idempotentReplay', false
  );
end;
$$;

revoke all on function public.complete_appointment_clinical_session(
  uuid, uuid, uuid, boolean, text
) from public, anon;
grant execute on function public.complete_appointment_clinical_session(
  uuid, uuid, uuid, boolean, text
) to authenticated;

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
  v_token public.appointment_confirmation_tokens%rowtype;
  v_now timestamptz := now();
  v_from_status text;
begin
  select * into v_appointment
  from public.appointments
  where id = p_appointment_id
  for update;

  perform pg_advisory_xact_lock(
    hashtextextended('appointment:' || p_appointment_id::text, 0)
  );

  if not found or v_appointment.user_id <> p_actor_user_id then
    raise exception 'Appointment not found for this professional';
  end if;
  if v_appointment.lifecycle_status in ('cancelled', 'in_progress', 'completed', 'closed') then
    raise exception 'This appointment no longer accepts invitations';
  end if;

  select * into v_token
  from public.appointment_confirmation_tokens
  where id = p_token_id
    and appointment_id = v_appointment.id
  for update;

  if not found
    or v_token.appointment_revision <> v_appointment.confirmation_revision
    or v_token.revoked_at is not null
    or v_token.expires_at <= v_now
  then
    raise exception 'Confirmation token is not valid for the current appointment revision';
  end if;

  if v_token.status in ('sent', 'opened') then
    return to_jsonb(v_appointment) || jsonb_build_object('idempotentReplay', true);
  end if;
  if v_token.status <> 'pending' or v_token.sent_at is not null then
    raise exception 'Confirmation token is not pending delivery';
  end if;

  update public.appointment_confirmation_tokens
  set
    status = 'sent',
    sent_at = v_now,
    created_by = p_actor_user_id,
    metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_delivery, '{}'::jsonb)
  where id = v_token.id
    and status = 'pending'
    and sent_at is null;

  if not found then
    raise exception 'Confirmation token delivery was already finalized';
  end if;

  v_from_status := v_appointment.lifecycle_status;
  update public.appointments
  set
    lifecycle_status = case
      when v_appointment.lifecycle_status = 'awaiting_reconfirmation'
        then 'awaiting_reconfirmation'
      else 'awaiting_confirmation'
    end,
    invitation_sent_at = v_now,
    updated_by = p_actor_user_id,
    action_origin = 'professional_app',
    last_actor_type = 'psychologist',
    audit_metadata = coalesce(p_delivery, '{}'::jsonb) || jsonb_build_object(
      'tokenId', v_token.id,
      'confirmationRevision', v_appointment.confirmation_revision,
      'idempotencyKey',
        'appointment:' || v_appointment.id::text || ':invitation:' || v_token.id::text || ':awaiting'
    )
  where id = v_appointment.id
  returning * into v_appointment;

  perform private.append_appointment_event(
    v_appointment.id,
    'invitation_sent',
    v_from_status,
    v_appointment.lifecycle_status,
    'psychologist',
    p_actor_user_id,
    'email_delivery',
    coalesce(p_delivery, '{}'::jsonb) || jsonb_build_object(
      'confirmationRevision', v_appointment.confirmation_revision
    ),
    'appointment:' || v_appointment.id::text || ':invitation:' || v_token.id::text || ':sent'
  );

  return to_jsonb(v_appointment) || jsonb_build_object('idempotentReplay', false);
end;
$$;

revoke all on function public.record_appointment_invitation(uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_appointment_invitation(uuid, uuid, uuid, jsonb)
  to service_role;

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
  v_now timestamptz := now();
begin
  select * into v_token
  from public.appointment_confirmation_tokens
  where token_hash = p_token_hash
    and status in ('sent', 'opened')
    and revoked_at is null
    and expires_at > v_now;

  if not found then
    raise exception 'Invalid or expired appointment invitation';
  end if;

  select * into v_appointment
  from public.appointments
  where id = v_token.appointment_id
  for update;

  perform pg_advisory_xact_lock(
    hashtextextended('appointment:' || v_token.appointment_id::text, 0)
  );

  select * into v_token
  from public.appointment_confirmation_tokens
  where id = v_token.id
    and appointment_id = v_appointment.id
    and token_hash = p_token_hash
    and status in ('sent', 'opened')
    and revoked_at is null
    and expires_at > v_now
  for update;

  if not found
    or v_token.appointment_revision <> v_appointment.confirmation_revision
  then
    raise exception 'Invitation belongs to a superseded appointment revision';
  end if;

  if v_token.opened_at is null then
    update public.appointment_confirmation_tokens
    set status = 'opened', opened_at = v_now
    where id = v_token.id;

    update public.appointments
    set
      invitation_opened_at = coalesce(invitation_opened_at, v_now),
      updated_by = null,
      action_origin = 'public_appointment',
      last_actor_type = 'patient',
      audit_metadata = coalesce(p_metadata, '{}'::jsonb)
    where id = v_appointment.id;

    perform private.append_appointment_event(
      v_appointment.id,
      'invitation_opened',
      v_appointment.lifecycle_status,
      v_appointment.lifecycle_status,
      'patient',
      null,
      'public_appointment',
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'confirmationRevision', v_appointment.confirmation_revision
      ),
      'appointment:' || v_appointment.id::text || ':invitation:' || v_token.id::text || ':opened'
    );
  end if;

  return v_appointment.id;
end;
$$;

revoke all on function public.mark_appointment_invitation_opened(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.mark_appointment_invitation_opened(text, jsonb)
  to service_role;

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
  v_snapshot public.appointment_policy_snapshots%rowtype;
  v_request public.appointment_reschedule_requests%rowtype;
  v_working_hours jsonb;
  v_day_config jsonb;
  v_day_key text;
  v_duration interval;
  v_current_duration interval;
  v_idempotency_key text;
  v_now timestamptz := now();
  v_within_free_window boolean;
  v_right_protected boolean;
  v_seconds_remaining bigint;
  v_response_due_at timestamptz;
begin
  if p_action not in ('confirm', 'cancel', 'reschedule') then
    raise exception 'Unsupported appointment action';
  end if;

  select * into v_token
  from public.appointment_confirmation_tokens
  where token_hash = p_token_hash
    and status in ('sent', 'opened')
    and revoked_at is null
    and expires_at > v_now;

  if not found then
    raise exception 'Invalid or expired appointment invitation';
  end if;

  select * into v_appointment
  from public.appointments
  where id = v_token.appointment_id
  for update;

  perform pg_advisory_xact_lock(
    hashtextextended('appointment:' || v_token.appointment_id::text, 0)
  );

  if not found then
    raise exception 'Appointment not found';
  end if;

  select * into v_token
  from public.appointment_confirmation_tokens
  where id = v_token.id
    and appointment_id = v_appointment.id
    and token_hash = p_token_hash
    and status in ('sent', 'opened')
    and revoked_at is null
    and expires_at > v_now
  for update;

  if not found then
    raise exception 'Invalid or expired appointment invitation';
  end if;
  if v_token.appointment_revision <> v_appointment.confirmation_revision then
    raise exception 'Confirmation token belongs to a superseded appointment revision';
  end if;

  if v_appointment.policy_snapshot_id is null then
    v_appointment.policy_snapshot_id := private.create_appointment_policy_snapshot(
      v_appointment.id,
      'public_action_backfill',
      null,
      true
    );
  end if;

  select * into v_snapshot
  from public.appointment_policy_snapshots
  where id = v_appointment.policy_snapshot_id
    and appointment_id = v_appointment.id
    and appointment_revision = v_appointment.confirmation_revision;

  if not found then
    raise exception 'Appointment policy snapshot not found';
  end if;

  update public.appointment_confirmation_tokens
  set used_at = v_now, status = 'opened', opened_at = coalesce(opened_at, v_now)
  where id = v_token.id;

  if p_action = 'confirm' then
    if v_appointment.lifecycle_status = 'cancelled' then
      raise exception 'A cancelled appointment cannot be confirmed';
    end if;
    if v_appointment.lifecycle_status = 'reschedule_requested' then
      raise exception 'The pending reschedule request must be reviewed first';
    end if;
    if v_appointment.lifecycle_status in ('in_progress', 'completed', 'closed') then
      raise exception 'This appointment no longer accepts confirmation';
    end if;
    if v_now >= v_appointment.start_time then
      raise exception 'This appointment has already reached its scheduled start';
    end if;
    if v_appointment.lifecycle_status = 'confirmed'
      and v_appointment.confirmed_revision = v_appointment.confirmation_revision
    then
      return jsonb_build_object(
        'appointment', to_jsonb(v_appointment),
        'idempotentReplay', true
      );
    end if;

    perform set_config('neuronex.appointment_command', 'public_patient_action', true);
    update public.appointments
    set
      lifecycle_status = 'confirmed',
      confirmed_at = v_now,
      patient_right_status = 'standard',
      patient_action_due_at = null,
      professional_response_due_at = null,
      financial_protection_reason = null,
      outcome_review_required = false,
      change_responsibility = 'patient',
      updated_by = null,
      action_origin = 'public_appointment',
      last_actor_type = 'patient',
      audit_metadata = coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'tokenId', v_token.id,
        'confirmationRevision', v_appointment.confirmation_revision,
        'policySnapshotId', v_snapshot.id,
        'idempotencyKey',
          'appointment:' || v_appointment.id::text
          || ':confirmation-revision:' || v_appointment.confirmation_revision::text
          || ':confirmed'
      )
    where id = v_appointment.id
    returning * into v_appointment;

    return jsonb_build_object('appointment', to_jsonb(v_appointment), 'event', 'confirmed');
  end if;

  if p_action = 'cancel' then
    if v_appointment.lifecycle_status = 'cancelled' then
      return jsonb_build_object(
        'appointment', to_jsonb(v_appointment),
        'idempotentReplay', true
      );
    end if;
    if v_appointment.lifecycle_status in ('in_progress', 'completed', 'closed') then
      raise exception 'A started or finished appointment cannot be cancelled by this link';
    end if;
    if v_now >= v_appointment.start_time then
      raise exception 'A started appointment cannot be cancelled by this link';
    end if;

    v_within_free_window := v_now <= v_snapshot.free_cancellation_cutoff_at;
    v_right_protected :=
      v_appointment.patient_right_status in ('financially_protected', 'disputed')
      or (
        v_appointment.patient_right_status = 'reaction_window'
        and v_appointment.patient_action_due_at is not null
        and v_now <= v_appointment.patient_action_due_at
        and v_appointment.financial_protection_reason = 'timely_request_reaction_window'
      )
      or exists (
        select 1
        from public.appointment_reschedule_requests protected_request
        where protected_request.appointment_id = v_appointment.id
          and protected_request.appointment_revision = v_appointment.confirmation_revision
          and protected_request.financial_right_protected
          and protected_request.status = 'pending'
      );

    update public.appointment_reschedule_requests
    set
      status = 'withdrawn',
      reviewed_at = v_now,
      metadata = metadata || jsonb_build_object('withdrawnBy', 'patient_cancellation')
    where appointment_id = v_appointment.id
      and status = 'pending';

    perform set_config('neuronex.appointment_command', 'public_patient_action', true);
    update public.appointments
    set
      status = 'cancelled_by_patient',
      lifecycle_status = 'cancelled',
      cancelled_at = v_now,
      cancellation_reason = nullif(btrim(p_reason), ''),
      clinical_outcome = 'cancelled',
      financial_outcome = case
        when v_within_free_window or v_right_protected then 'no_consequence'
        else 'manual_review'
      end,
      patient_right_status = case
        when v_right_protected then 'financially_protected'
        else 'standard'
      end,
      financial_protection_reason = case
        when v_right_protected then coalesce(
          financial_protection_reason,
          'patient_action_preserved_after_timely_request'
        )
        else null
      end,
      outcome_review_required = not (v_within_free_window or v_right_protected),
      change_responsibility = 'patient',
      patient_action_due_at = null,
      professional_response_due_at = null,
      updated_by = null,
      action_origin = 'public_appointment',
      last_actor_type = 'patient',
      audit_metadata = coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'tokenId', v_token.id,
        'reason', nullif(btrim(p_reason), ''),
        'withinFreeWindow', v_within_free_window,
        'financialRightProtected', v_right_protected,
        'policySnapshotId', v_snapshot.id,
        'idempotencyKey', 'appointment:' || v_appointment.id::text || ':cancelled'
      )
    where id = v_appointment.id
    returning * into v_appointment;

    return jsonb_build_object(
      'appointment', to_jsonb(v_appointment),
      'event', 'cancelled',
      'withinFreeWindow', v_within_free_window,
      'financialRightProtected', v_right_protected
    );
  end if;

  if v_appointment.lifecycle_status in ('cancelled', 'in_progress', 'completed', 'closed') then
    raise exception 'This appointment cannot be rescheduled';
  end if;
  if v_now >= v_appointment.start_time then
    raise exception 'A started appointment cannot be rescheduled';
  end if;
  if p_requested_start_time is null or p_requested_end_time is null then
    raise exception 'Requested start and end times are required';
  end if;
  if p_requested_start_time <= v_now or p_requested_end_time <= p_requested_start_time then
    raise exception 'Choose a valid future time';
  end if;
  if p_requested_start_time > v_now + interval '6 months' then
    raise exception 'Choose a time within the next six months';
  end if;
  if (p_requested_start_time at time zone v_snapshot.timezone)::date
    <> (p_requested_end_time at time zone v_snapshot.timezone)::date
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

  select * into v_request
  from public.appointment_reschedule_requests pending_request
  where pending_request.appointment_id = v_appointment.id
    and pending_request.status = 'pending'
  order by pending_request.created_at desc
  limit 1
  for update;

  if found then
    if v_request.requested_start_time = p_requested_start_time
      and v_request.requested_end_time = p_requested_end_time
    then
      return jsonb_build_object(
        'appointment', to_jsonb(v_appointment),
        'request', to_jsonb(v_request),
        'event', 'reschedule_requested',
        'idempotentReplay', true
      );
    end if;
    raise exception 'There is already a pending reschedule request for this appointment';
  end if;

  if exists (
    select 1
    from public.appointment_reschedule_requests rejected_request
    where rejected_request.appointment_id = v_appointment.id
      and rejected_request.appointment_revision = v_appointment.confirmation_revision
      and rejected_request.status = 'rejected'
      and rejected_request.requested_start_time = p_requested_start_time
      and rejected_request.requested_end_time = p_requested_end_time
  ) then
    raise exception 'This time was already rejected in the current confirmation cycle';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_appointment.user_id::text, 0));

  select coalesce(profile.working_hours, '{}'::jsonb)
  into v_working_hours
  from public.profiles profile
  where profile.id = v_appointment.user_id;

  v_day_key := extract(dow from p_requested_start_time at time zone v_snapshot.timezone)::integer::text;
  v_day_config := v_working_hours -> v_day_key;
  if jsonb_typeof(v_day_config) <> 'object'
    or coalesce(v_day_config ->> 'enabled', 'false') <> 'true'
    or coalesce(v_day_config ->> 'start', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or coalesce(v_day_config ->> 'end', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  then
    raise exception 'The professional is unavailable on the selected day';
  end if;
  if (p_requested_start_time at time zone v_snapshot.timezone)::time < (v_day_config ->> 'start')::time
    or (p_requested_end_time at time zone v_snapshot.timezone)::time > (v_day_config ->> 'end')::time
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

  v_within_free_window := v_now <= v_snapshot.free_reschedule_cutoff_at;
  v_right_protected :=
    v_within_free_window
    or v_appointment.patient_right_status in ('financially_protected', 'disputed')
    or (
      v_appointment.patient_right_status = 'reaction_window'
      and v_appointment.patient_action_due_at is not null
      and v_now <= v_appointment.patient_action_due_at
      and v_appointment.financial_protection_reason = 'timely_request_reaction_window'
    );
  v_seconds_remaining := greatest(
    floor(extract(epoch from (v_snapshot.free_reschedule_cutoff_at - v_now)))::bigint,
    0
  );
  v_response_due_at := least(
    v_appointment.start_time,
    v_now + make_interval(
      secs => (v_snapshot.professional_response_sla_hours * 3600)::double precision
    )
  );

  insert into public.appointment_reschedule_requests (
    appointment_id,
    psychologist_id,
    patient_id,
    original_start_time,
    original_end_time,
    requested_start_time,
    requested_end_time,
    reason,
    appointment_revision,
    policy_snapshot_id,
    requested_at,
    seconds_remaining_at_request,
    within_free_window,
    professional_response_due_at,
    financial_right_protected,
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
    v_appointment.confirmation_revision,
    v_snapshot.id,
    v_now,
    v_seconds_remaining,
    v_within_free_window,
    v_response_due_at,
    v_right_protected,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('tokenId', v_token.id)
  ) returning * into v_request;

  v_idempotency_key := 'appointment:' || v_appointment.id::text
    || ':reschedule-request:' || v_request.id::text;
  perform set_config('neuronex.appointment_command', 'public_patient_action', true);
  update public.appointments
  set
    lifecycle_status = 'reschedule_requested',
    reschedule_requested_at = v_now,
    patient_right_status = 'request_pending',
    professional_response_due_at = v_response_due_at,
    patient_action_due_at = null,
    financial_protection_reason = case
      when v_right_protected then coalesce(
        financial_protection_reason,
        case when v_within_free_window
          then 'timely_reschedule_request'
          else 'timely_request_reaction_window'
        end
      )
      else null
    end,
    change_responsibility = 'patient',
    updated_by = null,
    action_origin = 'public_appointment',
    last_actor_type = 'patient',
    audit_metadata = coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'tokenId', v_token.id,
      'requestId', v_request.id,
      'requestedStartTime', v_request.requested_start_time,
      'requestedEndTime', v_request.requested_end_time,
      'withinFreeWindow', v_within_free_window,
      'financialRightProtected', v_right_protected,
      'professionalResponseDueAt', v_response_due_at,
      'policySnapshotId', v_snapshot.id,
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

revoke all on function public.process_appointment_public_action(
  text, text, text, timestamptz, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.process_appointment_public_action(
  text, text, text, timestamptz, timestamptz, jsonb
) to service_role;

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
  v_snapshot public.appointment_policy_snapshots%rowtype;
  v_now timestamptz := now();
  v_reaction_seconds bigint;
  v_reaction_due_at timestamptz;
  v_response_late boolean;
  v_permanent_protection boolean;
  v_new_snapshot_id uuid;
  v_working_hours jsonb;
  v_day_config jsonb;
  v_day_key text;
begin
  if p_decision not in ('approve', 'reject') then
    raise exception 'Unsupported reschedule decision';
  end if;

  select * into v_request
  from public.appointment_reschedule_requests
  where id = p_request_id;

  if not found or v_request.psychologist_id <> p_actor_user_id then
    raise exception 'Reschedule request not found for this professional';
  end if;

  select * into v_appointment
  from public.appointments
  where id = v_request.appointment_id
  for update;

  perform pg_advisory_xact_lock(
    hashtextextended('appointment:' || v_request.appointment_id::text, 0)
  );

  if not found or v_appointment.user_id <> p_actor_user_id then
    raise exception 'Appointment not found for this professional';
  end if;

  select * into v_request
  from public.appointment_reschedule_requests
  where id = p_request_id
    and appointment_id = v_appointment.id
    and psychologist_id = p_actor_user_id
  for update;

  if not found then
    raise exception 'Reschedule request not found for this appointment';
  end if;

  if v_request.status <> 'pending' then
    if (v_request.status = 'approved' and p_decision = 'approve')
      or (v_request.status = 'rejected' and p_decision = 'reject')
    then
      return jsonb_build_object(
        'appointment', to_jsonb(v_appointment),
        'request', to_jsonb(v_request),
        'decision', p_decision,
        'idempotentReplay', true
      );
    end if;
    raise exception 'This reschedule request has already been reviewed';
  end if;

  if v_appointment.lifecycle_status <> 'reschedule_requested'
    or v_appointment.status in (
      'cancelled_by_patient', 'cancelled_by_professional', 'cancelled', 'canceled',
      'attended', 'completed', 'no_show', 'absent'
    )
  then
    raise exception 'The appointment no longer has this pending reschedule state';
  end if;
  if v_request.appointment_revision <> v_appointment.confirmation_revision
    or v_request.original_start_time <> v_appointment.start_time
    or v_request.original_end_time <> v_appointment.end_time
  then
    raise exception 'The reschedule request belongs to superseded appointment facts';
  end if;

  select * into v_snapshot
  from public.appointment_policy_snapshots
  where id = v_request.policy_snapshot_id
    and appointment_id = v_appointment.id
    and appointment_revision = v_appointment.confirmation_revision;

  if not found then
    select * into v_snapshot
    from public.appointment_policy_snapshots
    where id = v_appointment.policy_snapshot_id
      and appointment_id = v_appointment.id
      and appointment_revision = v_appointment.confirmation_revision;
  end if;
  if not found then
    raise exception 'Appointment policy snapshot not found';
  end if;

  -- A decision after the original consultation has started cannot create a
  -- retroactive obligation for the patient. It becomes an overdue case.
  if v_now >= v_appointment.start_time then
    update public.appointment_reschedule_requests
    set
      status = 'expired_no_response',
      expired_without_response_at = v_now,
      reviewed_at = v_now,
      financial_right_protected = true,
      protection_reason = 'professional_response_after_appointment_start',
      metadata = metadata || coalesce(p_metadata, '{}'::jsonb)
    where id = v_request.id
    returning * into v_request;

    update public.appointments
    set
      lifecycle_status = 'professional_response_overdue',
      patient_right_status = 'financially_protected',
      financial_outcome = 'protected',
      financial_protection_reason = 'professional_response_after_appointment_start',
      outcome_review_required = true,
      professional_response_due_at = null,
      updated_by = p_actor_user_id,
      action_origin = 'professional_app',
      last_actor_type = 'psychologist',
      audit_metadata = coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'requestId', v_request.id,
        'policySnapshotId', v_snapshot.id,
        'idempotencyKey',
          'appointment:' || v_appointment.id::text
          || ':reschedule-request:' || v_request.id::text
          || ':expired-no-response'
      )
    where id = v_appointment.id
    returning * into v_appointment;

    insert into public.appointment_communication_outbox (
      appointment_id,
      reschedule_request_id,
      psychologist_id,
      patient_id,
      template_key,
      payload,
      idempotency_key
    ) values (
      v_appointment.id,
      v_request.id,
      v_appointment.user_id,
      v_appointment.patient_id,
      'appointment_reschedule_response_overdue',
      jsonb_build_object('protectionReason', v_request.protection_reason),
      'appointment:' || v_appointment.id::text
        || ':request:' || v_request.id::text || ':response-overdue-email'
    ) on conflict (psychologist_id, idempotency_key) do nothing;

    return jsonb_build_object(
      'appointment', to_jsonb(v_appointment),
      'request', to_jsonb(v_request),
      'decision', 'expired_no_response',
      'financialRightProtected', true
    );
  end if;

  if p_decision = 'approve' then
    if v_request.requested_start_time <= v_now
      or v_request.requested_end_time <= v_request.requested_start_time
      or v_request.requested_end_time - v_request.requested_start_time
        <> v_request.original_end_time - v_request.original_start_time
      or (v_request.requested_start_time at time zone v_snapshot.timezone)::date
        <> (v_request.requested_end_time at time zone v_snapshot.timezone)::date
    then
      raise exception 'The requested slot is no longer valid';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(v_appointment.user_id::text, 0));

    select coalesce(profile.working_hours, '{}'::jsonb)
    into v_working_hours
    from public.profiles profile
    where profile.id = v_appointment.user_id;

    v_day_key := extract(
      dow from v_request.requested_start_time at time zone v_snapshot.timezone
    )::integer::text;
    v_day_config := v_working_hours -> v_day_key;
    if jsonb_typeof(v_day_config) <> 'object'
      or coalesce(v_day_config ->> 'enabled', 'false') <> 'true'
      or coalesce(v_day_config ->> 'start', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or coalesce(v_day_config ->> 'end', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or (v_request.requested_start_time at time zone v_snapshot.timezone)::time
        < (v_day_config ->> 'start')::time
      or (v_request.requested_end_time at time zone v_snapshot.timezone)::time
        > (v_day_config ->> 'end')::time
    then
      raise exception 'The requested slot is outside current professional availability';
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
      reviewed_at = v_now,
      financial_right_protected = financial_right_protected
        or professional_response_due_at is null
        or v_now >= professional_response_due_at,
      protection_reason = case
        when professional_response_due_at is null
          or v_now >= professional_response_due_at
          then 'professional_response_after_sla'
        else protection_reason
      end,
      metadata = metadata || coalesce(p_metadata, '{}'::jsonb)
    where id = v_request.id
    returning * into v_request;

    update public.appointments
    set
      lifecycle_status = 'reschedule_approved',
      start_time = v_request.requested_start_time,
      end_time = v_request.requested_end_time,
      reschedule_approved_at = v_now,
      patient_right_status = 'standard',
      patient_action_due_at = null,
      professional_response_due_at = null,
      financial_protection_reason = null,
      outcome_review_required = false,
      change_responsibility = 'patient',
      updated_by = p_actor_user_id,
      action_origin = 'professional_app',
      last_actor_type = 'psychologist',
      audit_metadata = coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'requestId', v_request.id,
        'reviewReason', nullif(btrim(p_reason), ''),
        'policySnapshotId', v_snapshot.id,
        'idempotencyKey',
          'appointment:' || v_appointment.id::text
          || ':reschedule-request:' || v_request.id::text || ':approved'
      )
    where id = v_appointment.id
    returning * into v_appointment;

    v_new_snapshot_id := private.create_appointment_policy_snapshot(
      v_appointment.id,
      'patient_requested_reschedule_approved',
      v_snapshot.policy_version_id,
      true
    );

    select * into v_appointment
    from public.appointments
    where id = v_appointment.id;
  else
    v_response_late := v_request.professional_response_due_at is null
      or v_now >= v_request.professional_response_due_at;
    v_reaction_seconds := greatest(
      coalesce(v_request.seconds_remaining_at_request, 0),
      ceil(v_snapshot.minimum_patient_reaction_hours * 3600)::bigint
    );
    v_reaction_due_at := v_now + make_interval(secs => v_reaction_seconds::double precision);
    v_permanent_protection := v_response_late
      or (
        v_request.financial_right_protected
        and v_reaction_due_at >= v_appointment.start_time
      );

    update public.appointment_reschedule_requests
    set
      status = 'rejected',
      reviewed_by = p_actor_user_id,
      review_reason = nullif(btrim(p_reason), ''),
      reviewed_at = v_now,
      reaction_due_at = v_reaction_due_at,
      financial_right_protected = financial_right_protected or v_permanent_protection,
      protection_reason = case
        when v_response_late then 'professional_response_after_sla'
        when financial_right_protected and v_reaction_due_at >= v_appointment.start_time
          then 'minimum_reaction_window_reaches_appointment'
        when financial_right_protected then 'timely_request_reaction_window'
        else null
      end,
      metadata = metadata || coalesce(p_metadata, '{}'::jsonb)
    where id = v_request.id
    returning * into v_request;

    update public.appointments
    set
      lifecycle_status = 'reschedule_rejected',
      reschedule_rejected_at = v_now,
      patient_right_status = case
        when v_permanent_protection then 'financially_protected'
        when v_request.financial_right_protected then 'reaction_window'
        else 'standard'
      end,
      patient_action_due_at = v_reaction_due_at,
      professional_response_due_at = null,
      financial_outcome = case
        when v_permanent_protection then 'protected'
        else financial_outcome
      end,
      financial_protection_reason = case
        when v_permanent_protection then v_request.protection_reason
        when v_request.financial_right_protected then 'timely_request_reaction_window'
        else null
      end,
      outcome_review_required = v_permanent_protection,
      change_responsibility = 'professional',
      updated_by = p_actor_user_id,
      action_origin = 'professional_app',
      last_actor_type = 'psychologist',
      audit_metadata = coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'requestId', v_request.id,
        'reviewReason', nullif(btrim(p_reason), ''),
        'responseLate', v_response_late,
        'reactionDueAt', v_reaction_due_at,
        'financialRightProtected', v_permanent_protection,
        'policySnapshotId', v_snapshot.id,
        'idempotencyKey',
          'appointment:' || v_appointment.id::text
          || ':reschedule-request:' || v_request.id::text || ':rejected'
      )
    where id = v_appointment.id
    returning * into v_appointment;
  end if;

  insert into public.appointment_communication_outbox (
    appointment_id,
    reschedule_request_id,
    psychologist_id,
    patient_id,
    template_key,
    payload,
    idempotency_key
  ) values (
    v_appointment.id,
    v_request.id,
    v_appointment.user_id,
    v_appointment.patient_id,
    case
      when p_decision = 'approve' then 'appointment_reschedule_approved'
      else 'appointment_reschedule_rejected'
    end,
    jsonb_build_object(
      'decision', p_decision,
      'reviewReason', nullif(btrim(p_reason), ''),
      'reactionDueAt', v_request.reaction_due_at,
      'financialRightProtected', v_request.financial_right_protected,
      'policySnapshotId', coalesce(v_new_snapshot_id, v_snapshot.id)
    ),
    'appointment:' || v_appointment.id::text
      || ':request:' || v_request.id::text || ':decision-email'
  ) on conflict (psychologist_id, idempotency_key) do nothing;

  return jsonb_build_object(
    'appointment', to_jsonb(v_appointment),
    'request', to_jsonb(v_request),
    'decision', p_decision,
    'financialRightProtected', v_request.financial_right_protected,
    'reactionDueAt', v_request.reaction_due_at
  );
end;
$$;

revoke all on function public.review_appointment_reschedule(
  uuid, uuid, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.review_appointment_reschedule(
  uuid, uuid, text, text, jsonb
) to service_role;

create or replace function private.expire_overdue_appointment_patient_rights()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.appointment_reschedule_requests%rowtype;
  v_appointment public.appointments%rowtype;
  v_expired_count integer := 0;
begin
  for v_request in
    select request_row.*
    from public.appointment_reschedule_requests request_row
    join public.appointments appointment
      on appointment.id = request_row.appointment_id
    where request_row.status = 'pending'
      and (
        request_row.professional_response_due_at <= now()
        or appointment.start_time <= now()
      )
    order by coalesce(request_row.professional_response_due_at, appointment.start_time), request_row.id
    limit 100
  loop
    select * into v_appointment
    from public.appointments
    where id = v_request.appointment_id
    for update;

    perform pg_advisory_xact_lock(
      hashtextextended('appointment:' || v_request.appointment_id::text, 0)
    );

    if not found then
      continue;
    end if;

    select * into v_request
    from public.appointment_reschedule_requests request_row
    where request_row.id = v_request.id
      and request_row.status = 'pending'
      and (
        request_row.professional_response_due_at <= now()
        or v_appointment.start_time <= now()
      )
    for update;

    if not found then
      continue;
    end if;

    update public.appointment_reschedule_requests
    set
      status = 'expired_no_response',
      expired_without_response_at = now(),
      reviewed_at = now(),
      financial_right_protected = true,
      protection_reason = 'professional_response_sla_expired',
      metadata = metadata || jsonb_build_object(
        'expiredBy', 'appointment_patient_rights_worker'
      )
    where id = v_request.id
      and status = 'pending'
    returning * into v_request;

    if not found then
      continue;
    end if;

    if v_appointment.lifecycle_status = 'reschedule_requested' then
      update public.appointments
      set
        lifecycle_status = 'professional_response_overdue',
        patient_right_status = 'financially_protected',
        financial_outcome = 'protected',
        financial_protection_reason = 'professional_response_sla_expired',
        outcome_review_required = true,
        professional_response_due_at = null,
        change_responsibility = 'professional',
        updated_by = null,
        action_origin = 'system',
        last_actor_type = 'system',
        audit_metadata = jsonb_build_object(
          'requestId', v_request.id,
          'professionalResponseDueAt', v_request.professional_response_due_at,
          'idempotencyKey',
            'appointment:' || v_appointment.id::text
            || ':reschedule-request:' || v_request.id::text
            || ':expired-no-response'
        )
      where id = v_appointment.id
      returning * into v_appointment;
    end if;

    insert into public.appointment_communication_outbox (
      appointment_id,
      reschedule_request_id,
      psychologist_id,
      patient_id,
      template_key,
      payload,
      idempotency_key
    ) values (
      v_appointment.id,
      v_request.id,
      v_appointment.user_id,
      v_appointment.patient_id,
      'appointment_reschedule_response_overdue',
      jsonb_build_object(
        'professionalResponseDueAt', v_request.professional_response_due_at,
        'financialRightProtected', true
      ),
      'appointment:' || v_appointment.id::text
        || ':request:' || v_request.id::text || ':response-overdue-email'
    ) on conflict (psychologist_id, idempotency_key) do nothing;

    perform public.emit_user_notification(
      v_appointment.user_id,
      'appointment:' || v_appointment.id::text
        || ':request:' || v_request.id::text || ':professional-response-overdue',
      'appointment_reschedule_overdue',
      'agenda',
      'destructive',
      U&'Decis\00E3o de reagendamento em atraso',
      U&'O prazo para responder ao paciente venceu. O caso est\00E1 financeiramente protegido.',
      '/agenda?appointmentId=' || v_appointment.id::text,
      'urgent',
      jsonb_build_object(
        'sourceModule', 'agenda',
        'appointmentId', v_appointment.id,
        'requestId', v_request.id,
        'requiresAction', true,
        'nativePushEligible', true,
        'deadlineAt', v_request.professional_response_due_at
      ),
      '{}'::jsonb,
      null
    );

    v_expired_count := v_expired_count + 1;
  end loop;

  -- Action windows expire independently from financial protection. Permanent
  -- protection uses its own status and is therefore never cleared here.
  for v_appointment in
    select appointment.*
    from public.appointments appointment
    where appointment.patient_right_status in ('reaction_window', 'standard')
      and appointment.patient_action_due_at < now()
    order by appointment.patient_action_due_at, appointment.id
    for update skip locked
    limit 100
  loop
    -- The row was locked by the cursor; acquire the advisory lock before any
    -- appointment-scoped child/event work, matching every other command.
    perform pg_advisory_xact_lock(
      hashtextextended('appointment:' || v_appointment.id::text, 0)
    );

    update public.appointments
    set
      patient_right_status = 'standard',
      patient_action_due_at = null,
      financial_protection_reason = case
        when v_appointment.patient_right_status = 'reaction_window'
          then null
        else v_appointment.financial_protection_reason
      end,
      updated_by = null,
      action_origin = 'system',
      last_actor_type = 'system',
      audit_metadata = jsonb_build_object(
        'idempotencyKey',
          'appointment:' || v_appointment.id::text || ':patient-reaction-window:expired'
      )
    where id = v_appointment.id;

    perform private.append_appointment_event(
      v_appointment.id,
      'patient_reaction_window_expired',
      v_appointment.lifecycle_status,
      v_appointment.lifecycle_status,
      'system',
      null,
      'system',
      jsonb_build_object('patientActionDueAt', v_appointment.patient_action_due_at),
      'appointment:' || v_appointment.id::text || ':patient-reaction-window:expired'
    );
  end loop;

  return v_expired_count;
end;
$$;

revoke all on function private.expire_overdue_appointment_patient_rights()
  from public, anon, authenticated;

create or replace function private.prepare_appointment_communication_outbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment public.appointments%rowtype;
  v_fingerprint text;
  v_existing_fingerprint text;
begin
  if jsonb_typeof(new.payload) <> 'object' then
    raise exception 'Communication payload must be a JSON object';
  end if;
  if new.payload::text ~* '"(token|raw_?token|action_?url|confirmation_?url)"[[:space:]]*:' then
    raise exception 'Raw invitation credentials cannot be persisted in the outbox';
  end if;
  if nullif(btrim(new.template_key), '') is null
    or nullif(btrim(new.idempotency_key), '') is null
    or char_length(new.template_key) > 120
    or char_length(new.idempotency_key) > 240
  then
    raise exception 'Communication template or idempotency key is invalid';
  end if;

  select * into v_appointment
  from public.appointments
  where id = new.appointment_id
  for share;

  if not found
    or v_appointment.user_id <> new.psychologist_id
    or v_appointment.patient_id is distinct from new.patient_id
    or v_appointment.start_time is null
    or v_appointment.end_time is null
  then
    raise exception 'Communication facts do not match a scheduled appointment';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('appointment:' || v_appointment.id::text, 0)
  );

  if new.reschedule_request_id is not null then
    perform request_row.id
    from public.appointment_reschedule_requests request_row
    where request_row.id = new.reschedule_request_id
      and request_row.appointment_id = v_appointment.id
      and request_row.psychologist_id = v_appointment.user_id
      and request_row.patient_id is not distinct from v_appointment.patient_id
      and request_row.appointment_revision = v_appointment.confirmation_revision
    for key share;

    if not found then
      raise exception 'Communication request does not belong to the current appointment revision';
    end if;
  end if;

  if new.appointment_revision is not null
    and new.appointment_revision <> v_appointment.confirmation_revision
  then
    raise exception 'Communication revision does not match the appointment';
  end if;
  if new.policy_snapshot_id is not null
    and new.policy_snapshot_id is distinct from v_appointment.policy_snapshot_id
  then
    raise exception 'Communication policy snapshot does not match the appointment';
  end if;
  if new.appointment_start_time is not null
    and new.appointment_start_time <> v_appointment.start_time
  then
    raise exception 'Communication start time does not match the appointment';
  end if;
  if new.appointment_end_time is not null
    and new.appointment_end_time <> v_appointment.end_time
  then
    raise exception 'Communication end time does not match the appointment';
  end if;

  new.appointment_revision := v_appointment.confirmation_revision;
  new.policy_snapshot_id := v_appointment.policy_snapshot_id;
  new.appointment_start_time := v_appointment.start_time;
  new.appointment_end_time := v_appointment.end_time;
  new.lease_token := null;
  new.lease_expires_at := null;

  v_fingerprint := encode(digest(
    concat_ws('|',
      new.appointment_id::text,
      new.appointment_revision::text,
      coalesce(new.policy_snapshot_id::text, ''),
      new.appointment_start_time::text,
      new.appointment_end_time::text,
      new.template_key,
      new.payload::text,
      new.idempotency_key
    ),
    'sha256'
  ), 'hex');
  if new.payload_fingerprint is not null
    and new.payload_fingerprint <> v_fingerprint
  then
    raise exception 'Communication fingerprint does not match its immutable facts';
  end if;
  new.payload_fingerprint := v_fingerprint;

  perform pg_advisory_xact_lock(hashtextextended(
    'appointment-outbox:' || new.psychologist_id::text || ':' || new.idempotency_key,
    0
  ));
  select outbox.payload_fingerprint into v_existing_fingerprint
  from public.appointment_communication_outbox outbox
  where outbox.psychologist_id = new.psychologist_id
    and outbox.idempotency_key = new.idempotency_key;
  if found and v_existing_fingerprint <> v_fingerprint then
    raise exception 'Communication idempotency key was reused with different facts';
  end if;
  return new;
end;
$$;

revoke all on function private.prepare_appointment_communication_outbox()
  from public, anon, authenticated;

drop trigger if exists appointment_communication_outbox_prepare
  on public.appointment_communication_outbox;
create trigger appointment_communication_outbox_prepare
before insert on public.appointment_communication_outbox
for each row execute function private.prepare_appointment_communication_outbox();

create or replace function private.guard_appointment_communication_outbox_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Communication outbox history cannot be deleted';
  end if;
  if new.id is distinct from old.id
    or new.appointment_id is distinct from old.appointment_id
    or new.reschedule_request_id is distinct from old.reschedule_request_id
    or new.psychologist_id is distinct from old.psychologist_id
    or new.patient_id is distinct from old.patient_id
    or new.template_key is distinct from old.template_key
    or new.payload is distinct from old.payload
    or new.idempotency_key is distinct from old.idempotency_key
    or new.appointment_revision is distinct from old.appointment_revision
    or new.policy_snapshot_id is distinct from old.policy_snapshot_id
    or new.appointment_start_time is distinct from old.appointment_start_time
    or new.appointment_end_time is distinct from old.appointment_end_time
    or new.payload_fingerprint is distinct from old.payload_fingerprint
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Communication business facts are immutable';
  end if;
  if old.status in ('delivered', 'cancelled')
    and to_jsonb(new) is distinct from to_jsonb(old)
  then
    raise exception 'A finalized communication cannot be mutated';
  end if;
  if new.attempts < old.attempts then
    raise exception 'Communication attempts cannot decrease';
  end if;
  if new.status is distinct from old.status and not (
    (old.status in ('pending', 'failed') and new.status in ('processing', 'cancelled'))
    or (old.status = 'processing' and new.status in ('delivered', 'failed', 'cancelled'))
  ) then
    raise exception 'Invalid communication outbox transition';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_appointment_communication_outbox_mutation()
  from public, anon, authenticated;

drop trigger if exists appointment_communication_outbox_guard_mutation
  on public.appointment_communication_outbox;
create trigger appointment_communication_outbox_guard_mutation
before update or delete on public.appointment_communication_outbox
for each row execute function private.guard_appointment_communication_outbox_mutation();

create index appointment_communication_outbox_stale_lease_idx
  on public.appointment_communication_outbox (lease_expires_at, created_at)
  where status = 'processing';

create or replace function public.claim_appointment_communication_outbox(
  p_limit integer default 10,
  p_outbox_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate record;
  v_appointment public.appointments%rowtype;
  v_outbox public.appointment_communication_outbox%rowtype;
  v_rows jsonb := '[]'::jsonb;
  v_limit integer := greatest(1, least(coalesce(p_limit, 10), 50));
  v_claimed_count integer := 0;
begin
  -- Candidates are discovered without locking the outbox first. Each claim
  -- then follows appointment row -> appointment advisory -> outbox row, so it
  -- cannot race a schedule/revision update or invert the global lock order.
  for v_candidate in
    select outbox.id, outbox.appointment_id
    from public.appointment_communication_outbox outbox
    where (
        outbox.status in ('pending', 'failed')
        or (outbox.status = 'processing' and outbox.lease_expires_at <= now())
      )
      and outbox.next_attempt_at <= now()
      and (p_outbox_id is null or outbox.id = p_outbox_id)
    order by outbox.created_at, outbox.id
    limit case when p_outbox_id is null then least(v_limit * 4, 200) else 1 end
  loop
    select * into v_appointment
    from public.appointments appointment
    where appointment.id = v_candidate.appointment_id
    for update;

    if not found then
      continue;
    end if;

    perform pg_advisory_xact_lock(
      hashtextextended('appointment:' || v_appointment.id::text, 0)
    );

    select * into v_outbox
    from public.appointment_communication_outbox outbox
    where outbox.id = v_candidate.id
      and (
        outbox.status in ('pending', 'failed')
        or (outbox.status = 'processing' and outbox.lease_expires_at <= now())
      )
      and outbox.next_attempt_at <= now()
    for update skip locked;

    if not found then
      continue;
    end if;

    if v_appointment.confirmation_revision <> v_outbox.appointment_revision
      or v_appointment.policy_snapshot_id is distinct from v_outbox.policy_snapshot_id
      or v_appointment.start_time <> v_outbox.appointment_start_time
      or v_appointment.end_time <> v_outbox.appointment_end_time
    then
      update public.appointment_communication_outbox outbox
      set
        status = 'cancelled',
        lease_expires_at = null,
        last_error = 'stale_appointment_facts',
        updated_at = now()
      where outbox.id = v_outbox.id;
      continue;
    end if;

    update public.appointment_communication_outbox outbox
    set
      status = 'processing',
      attempts = outbox.attempts + 1,
      claimed_at = now(),
      lease_token = gen_random_uuid(),
      lease_expires_at = now() + interval '5 minutes',
      updated_at = now(),
      last_error = null
    where outbox.id = v_outbox.id
    returning outbox.* into v_outbox;

    v_rows := v_rows || jsonb_build_array(to_jsonb(v_outbox));
    v_claimed_count := v_claimed_count + 1;
    exit when v_claimed_count >= v_limit;
  end loop;

  return v_rows;
end;
$$;

revoke all on function public.claim_appointment_communication_outbox(integer, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_appointment_communication_outbox(integer, uuid)
  to service_role;

drop function if exists public.complete_appointment_communication_outbox(
  uuid, boolean, text, text, text
);

create or replace function public.complete_appointment_communication_outbox(
  p_outbox_id uuid,
  p_lease_token uuid,
  p_success boolean,
  p_provider text default null,
  p_provider_message_id text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.appointment_communication_outbox
  set
    status = case when p_success then 'delivered' else 'failed' end,
    delivered_at = case when p_success then now() else delivered_at end,
    provider = case when p_success then p_provider else provider end,
    provider_message_id = case when p_success then p_provider_message_id else provider_message_id end,
    last_error = case when p_success then null else left(coalesce(p_error, 'Unknown delivery error'), 2000) end,
    lease_expires_at = null,
    next_attempt_at = case
      when p_success then next_attempt_at
      else now() + make_interval(
        secs => least(3600, greatest(60, power(2, least(attempts, 10))::integer * 30))::double precision
      )
    end,
    updated_at = now()
  where id = p_outbox_id
    and status = 'processing'
    and lease_token = p_lease_token
    and lease_expires_at > now();

  if not found then
    raise exception 'Communication lease is invalid or expired';
  end if;
end;
$$;

revoke all on function public.complete_appointment_communication_outbox(
  uuid, uuid, boolean, text, text, text
) from public, anon, authenticated;
grant execute on function public.complete_appointment_communication_outbox(
  uuid, uuid, boolean, text, text, text
) to service_role;

do $$
begin
  if not exists (
    select 1 from vault.decrypted_secrets
    where name = 'appointment_communication_webhook_secret'
  ) then
    perform vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'appointment_communication_webhook_secret',
      'Internal authentication for the appointment communication outbox worker'
    );
  end if;
end;
$$;

create or replace function public.verify_appointment_communication_webhook_secret(
  p_candidate text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected text;
begin
  if coalesce(p_candidate, '') = '' then
    return false;
  end if;

  select decrypted_secret into v_expected
  from vault.decrypted_secrets
  where name = 'appointment_communication_webhook_secret'
  order by created_at desc
  limit 1;

  return v_expected is not null
    and encode(digest(convert_to(v_expected, 'UTF8'), 'sha256'), 'hex')
      = encode(digest(convert_to(p_candidate, 'UTF8'), 'sha256'), 'hex');
end;
$$;

revoke all on function public.verify_appointment_communication_webhook_secret(text)
  from public, anon, authenticated;
grant execute on function public.verify_appointment_communication_webhook_secret(text)
  to service_role;

create or replace function private.dispatch_appointment_communication_outbox()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
  v_base_url constant text := 'https://krewdaklcyzqfxkkgvqr.supabase.co';
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'appointment_communication_webhook_secret'
  limit 1;

  if v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := rtrim(v_base_url, '/') || '/functions/v1/process-appointment-communications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-neuronex-webhook-secret', v_secret
    ),
    body := jsonb_build_object('limit', 20)
  );
end;
$$;

revoke all on function private.dispatch_appointment_communication_outbox()
  from public, anon, authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname in (
  'neuronex-appointment-patient-rights',
  'neuronex-appointment-communication-dispatch'
);

select cron.schedule(
  'neuronex-appointment-patient-rights',
  '* * * * *',
  $cron$
    select private.expire_overdue_appointment_patient_rights();
  $cron$
);

select cron.schedule(
  'neuronex-appointment-communication-dispatch',
  '* * * * *',
  $cron$
    select private.dispatch_appointment_communication_outbox();
  $cron$
);

create table public.appointment_policy_application_operations (
  id uuid primary key default gen_random_uuid(),
  psychologist_id uuid not null references auth.users(id) on delete cascade,
  policy_version_id uuid not null references public.appointment_policy_versions(id) on delete restrict,
  appointment_ids uuid[] not null,
  reason text not null,
  status text not null default 'completed',
  result jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  request_fingerprint text not null,
  created_at timestamptz not null default now(),
  constraint appointment_policy_application_status_check check (
    status in ('completed', 'failed')
  ),
  unique (psychologist_id, idempotency_key)
);

drop trigger if exists appointment_policy_application_operations_immutable
  on public.appointment_policy_application_operations;
create trigger appointment_policy_application_operations_immutable
before update or delete on public.appointment_policy_application_operations
for each row execute function private.reject_immutable_appointment_policy_mutation();

alter table public.appointment_policy_application_operations enable row level security;
create policy "Professionals can view own policy applications"
on public.appointment_policy_application_operations for select to authenticated
using (psychologist_id = (select auth.uid()));
revoke all on table public.appointment_policy_application_operations
  from public, anon, authenticated;
grant select on table public.appointment_policy_application_operations to authenticated;
grant all on table public.appointment_policy_application_operations to service_role;

create index appointment_policy_application_policy_idx
  on public.appointment_policy_application_operations (policy_version_id, created_at desc);

create or replace function public.preview_appointment_policy_application(
  p_policy_version_id uuid,
  p_appointment_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_policy public.appointment_policy_versions%rowtype;
  v_requested_count integer;
  v_items jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_policy
  from public.appointment_policy_versions
  where id = p_policy_version_id
    and psychologist_id = v_user_id
    and effective_at <= now();
  if not found then
    raise exception 'Policy version not found or not effective';
  end if;

  v_requested_count := cardinality(coalesce(p_appointment_ids, '{}'::uuid[]));
  if v_requested_count < 1 or v_requested_count > 100 then
    raise exception 'Select between one and one hundred appointments';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'appointmentId', appointment.id,
      'startTime', appointment.start_time,
      'lifecycleStatus', appointment.lifecycle_status,
      'eligible',
        appointment.start_time > now()
        and appointment.lifecycle_status not in ('cancelled', 'in_progress', 'completed', 'closed'),
      'blockedReason', case
        when appointment.start_time <= now() then 'appointment_not_future'
        when appointment.lifecycle_status in ('cancelled', 'in_progress', 'completed', 'closed')
          then 'appointment_state_not_eligible'
        else null
      end,
      'currentPolicyVersion', snapshot.policy_version,
      'newPolicyVersion', v_policy.version,
      'currentCancellationCutoffAt', snapshot.free_cancellation_cutoff_at,
      'proposedCancellationCutoffAt', greatest(
        appointment.start_time
          - make_interval(secs => (v_policy.free_cancellation_hours * 3600)::double precision),
        coalesce(
          least(snapshot.free_cancellation_cutoff_at, appointment.start_time),
          '-infinity'::timestamptz
        )
      ),
      'currentRescheduleCutoffAt', snapshot.free_reschedule_cutoff_at,
      'proposedRescheduleCutoffAt', greatest(
        appointment.start_time
          - make_interval(secs => (v_policy.free_reschedule_hours * 3600)::double precision),
        coalesce(
          least(snapshot.free_reschedule_cutoff_at, appointment.start_time),
          '-infinity'::timestamptz
        )
      ),
      'grantedDeadlinesWillBePreserved',
        snapshot.id is not null
    ) order by appointment.start_time, appointment.id
  ) into v_items
  from public.appointments appointment
  left join public.appointment_policy_snapshots snapshot
    on snapshot.id = appointment.policy_snapshot_id
  where appointment.user_id = v_user_id
    and appointment.id = any(p_appointment_ids);

  if jsonb_array_length(coalesce(v_items, '[]'::jsonb)) <> v_requested_count then
    raise exception 'One or more appointments do not belong to this professional';
  end if;

  return jsonb_build_object(
    'policyVersion', v_policy.version,
    'effectiveAt', v_policy.effective_at,
    'items', coalesce(v_items, '[]'::jsonb),
    'requestedCount', v_requested_count
  );
end;
$$;

revoke all on function public.preview_appointment_policy_application(uuid, uuid[])
  from public, anon;
grant execute on function public.preview_appointment_policy_application(uuid, uuid[])
  to authenticated;

create or replace function public.apply_appointment_policy_to_future_occurrences(
  p_policy_version_id uuid,
  p_appointment_ids uuid[],
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_policy public.appointment_policy_versions%rowtype;
  v_appointment public.appointments%rowtype;
  v_operation public.appointment_policy_application_operations%rowtype;
  v_snapshot_id uuid;
  v_results jsonb := '[]'::jsonb;
  v_requested_count integer;
  v_normalized_ids uuid[];
  v_request_fingerprint text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null
    or nullif(btrim(coalesce(p_idempotency_key, '')), '') is null
  then
    raise exception 'Reason and idempotency key are required';
  end if;

  select array_agg(distinct appointment_id order by appointment_id)
  into v_normalized_ids
  from unnest(coalesce(p_appointment_ids, '{}'::uuid[])) appointment_id;
  v_requested_count := cardinality(coalesce(v_normalized_ids, '{}'::uuid[]));
  if v_requested_count < 1 or v_requested_count > 100
    or v_requested_count <> cardinality(coalesce(p_appointment_ids, '{}'::uuid[]))
  then
    raise exception 'Select between one and one hundred distinct appointments';
  end if;

  v_request_fingerprint := encode(digest(
    concat_ws('|',
      p_policy_version_id::text,
      v_normalized_ids::text,
      btrim(p_reason)
    ),
    'sha256'
  ), 'hex');

  perform pg_advisory_xact_lock(hashtextextended(
    'appointment-policy-application:' || v_user_id::text || ':' || p_idempotency_key,
    0
  ));

  select * into v_operation
  from public.appointment_policy_application_operations
  where psychologist_id = v_user_id
    and idempotency_key = p_idempotency_key;
  if found then
    if v_operation.request_fingerprint <> v_request_fingerprint then
      raise exception 'Policy application idempotency key was reused with different facts';
    end if;
    return v_operation.result || jsonb_build_object('idempotentReplay', true);
  end if;

  select * into v_policy
  from public.appointment_policy_versions
  where id = p_policy_version_id
    and psychologist_id = v_user_id
    and effective_at <= now();
  if not found then
    raise exception 'Policy version not found or not effective';
  end if;

  if (
    select count(*)
    from public.appointments appointment
    where appointment.user_id = v_user_id
      and appointment.id = any(v_normalized_ids)
  ) <> v_requested_count then
    raise exception 'One or more appointments do not belong to this professional';
  end if;

  perform set_config('neuronex.appointment_command', 'policy_application', true);

  for v_appointment in
    select appointment.*
    from public.appointments appointment
    where appointment.user_id = v_user_id
      and appointment.id = any(v_normalized_ids)
    order by appointment.id
    for update
  loop
    if v_appointment.start_time <= now()
      or v_appointment.lifecycle_status in ('cancelled', 'in_progress', 'completed', 'closed')
    then
      raise exception 'Appointment % is not eligible for a future policy change', v_appointment.id;
    end if;

    v_snapshot_id := private.create_appointment_policy_snapshot(
      v_appointment.id,
      'explicit_future_policy_application',
      v_policy.id,
      true
    );

    perform private.append_appointment_event(
      v_appointment.id,
      'appointment_policy_changed_for_future_occurrence',
      v_appointment.lifecycle_status,
      v_appointment.lifecycle_status,
      'psychologist',
      v_user_id,
      'professional_app',
      jsonb_build_object(
        'policyVersion', v_policy.version,
        'policySnapshotId', v_snapshot_id,
        'reason', btrim(p_reason)
      ),
      'appointment:' || v_appointment.id::text
        || ':policy-version:' || v_policy.version::text
        || ':application:' || p_idempotency_key
    );

    insert into public.appointment_communication_outbox (
      appointment_id,
      psychologist_id,
      patient_id,
      template_key,
      payload,
      idempotency_key
    ) values (
      v_appointment.id,
      v_user_id,
      v_appointment.patient_id,
      'appointment_policy_changed',
      jsonb_build_object(
        'policyVersion', v_policy.version,
        'policySnapshotId', v_snapshot_id,
        'reason', btrim(p_reason)
      ),
      'appointment:' || v_appointment.id::text
        || ':policy-snapshot:' || v_snapshot_id::text || ':email'
    ) on conflict (psychologist_id, idempotency_key) do nothing;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'appointmentId', v_appointment.id,
      'policySnapshotId', v_snapshot_id,
      'status', 'applied'
    ));
  end loop;

  insert into public.appointment_policy_application_operations (
    psychologist_id,
    policy_version_id,
    appointment_ids,
    reason,
    result,
    idempotency_key,
    request_fingerprint
  ) values (
    v_user_id,
    v_policy.id,
    v_normalized_ids,
    btrim(p_reason),
    jsonb_build_object(
      'success', true,
      'policyVersion', v_policy.version,
      'items', v_results
    ),
    p_idempotency_key,
    v_request_fingerprint
  ) returning * into v_operation;

  return v_operation.result || jsonb_build_object('idempotentReplay', false);
end;
$$;

revoke all on function public.apply_appointment_policy_to_future_occurrences(
  uuid, uuid[], text, text
) from public, anon;
grant execute on function public.apply_appointment_policy_to_future_occurrences(
  uuid, uuid[], text, text
) to authenticated;

create or replace function public.request_appointment_outcome_override(
  p_appointment_id uuid,
  p_requested_status text,
  p_requested_clinical_outcome text,
  p_requested_financial_outcome text,
  p_reason text,
  p_evidence jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_appointment public.appointments%rowtype;
  v_request public.appointment_outcome_override_requests%rowtype;
  v_request_fingerprint text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null
    or nullif(btrim(coalesce(p_idempotency_key, '')), '') is null
  then
    raise exception 'Reason and idempotency key are required';
  end if;
  if char_length(btrim(p_reason)) > 1000
    or char_length(p_idempotency_key) > 240
    or jsonb_typeof(coalesce(p_evidence, '{}'::jsonb)) <> 'object'
    or octet_length(coalesce(p_evidence, '{}'::jsonb)::text) > 32768
  then
    raise exception 'Override request input is invalid';
  end if;
  if nullif(btrim(p_requested_status), '') is not null
    and p_requested_status not in (
      'scheduled', 'attended', 'completed', 'no_show', 'absent',
      'cancelled_by_patient', 'cancelled_by_professional'
    )
  then
    raise exception 'Requested appointment status is invalid';
  end if;
  if nullif(btrim(p_requested_clinical_outcome), '') is not null
    and p_requested_clinical_outcome not in (
      'not_determined', 'attended', 'no_show', 'cancelled', 'technical_failure'
    )
  then
    raise exception 'Requested clinical outcome is invalid';
  end if;
  if nullif(btrim(p_requested_financial_outcome), '') is not null
    and p_requested_financial_outcome not in (
      'pending', 'no_consequence', 'credit_released', 'credit_consumed',
      'charge_kept', 'refund_pending', 'refunded', 'manual_review', 'protected'
    )
  then
    raise exception 'Requested financial outcome is invalid';
  end if;

  v_request_fingerprint := encode(digest(
    concat_ws('|',
      p_appointment_id::text,
      coalesce(nullif(btrim(p_requested_status), ''), ''),
      coalesce(nullif(btrim(p_requested_clinical_outcome), ''), ''),
      coalesce(nullif(btrim(p_requested_financial_outcome), ''), ''),
      btrim(p_reason),
      coalesce(p_evidence, '{}'::jsonb)::text
    ),
    'sha256'
  ), 'hex');

  select * into v_appointment
  from public.appointments
  where id = p_appointment_id
    and user_id = v_user_id
  for update;
  if not found then
    raise exception 'Appointment not found for this professional';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('appointment:' || v_appointment.id::text, 0)
  );
  perform pg_advisory_xact_lock(hashtextextended(
    'appointment-outcome-override:' || v_user_id::text || ':' || p_idempotency_key,
    0
  ));

  select * into v_request
  from public.appointment_outcome_override_requests
  where psychologist_id = v_user_id
    and idempotency_key = p_idempotency_key;

  if found then
    if v_request.request_fingerprint <> v_request_fingerprint then
      raise exception 'Outcome override idempotency key was reused with different facts';
    end if;
    return jsonb_build_object(
      'requestId', v_request.id,
      'status', v_request.status,
      'createdAt', v_request.created_at,
      'idempotentReplay', true
    );
  end if;

  insert into public.appointment_outcome_override_requests (
    appointment_id,
    psychologist_id,
    requested_status,
    requested_clinical_outcome,
    requested_financial_outcome,
    reason,
    evidence,
    policy_snapshot_id,
    patient_right_status,
    requested_by,
    action_origin,
    idempotency_key,
    request_fingerprint
  ) values (
    v_appointment.id,
    v_user_id,
    nullif(btrim(p_requested_status), ''),
    nullif(btrim(p_requested_clinical_outcome), ''),
    nullif(btrim(p_requested_financial_outcome), ''),
    btrim(p_reason),
    coalesce(p_evidence, '{}'::jsonb),
    v_appointment.policy_snapshot_id,
    v_appointment.patient_right_status,
    v_user_id,
    'professional_app',
    p_idempotency_key,
    v_request_fingerprint
  )
  returning * into v_request;

  perform set_config('neuronex.appointment_command', 'outcome_override_request', true);
  update public.appointments
  set
    patient_right_status = 'disputed',
    outcome_review_required = true,
    updated_by = v_user_id,
    action_origin = 'professional_app',
    last_actor_type = 'psychologist',
    audit_metadata = jsonb_build_object(
      'overrideRequestId', v_request.id,
      'idempotencyKey',
        'appointment:' || v_appointment.id::text
        || ':outcome-override:' || v_request.id::text || ':requested'
    )
  where id = v_appointment.id;

  return jsonb_build_object(
    'requestId', v_request.id,
    'status', v_request.status,
    'createdAt', v_request.created_at,
    'idempotentReplay', false
  );
end;
$$;

revoke all on function public.request_appointment_outcome_override(
  uuid, text, text, text, text, jsonb, text
) from public, anon;
grant execute on function public.request_appointment_outcome_override(
  uuid, text, text, text, text, jsonb, text
) to authenticated;

create or replace function public.get_safe_appointment_timeline(
  p_appointment_id uuid
)
returns table (
  title text,
  actor_name text,
  channel_name text,
  occurred_at timestamptz,
  status_change text,
  detail text,
  visual_kind text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.appointments appointment
    where appointment.id = p_appointment_id
      and appointment.user_id = auth.uid()
  ) then
    raise exception 'Appointment not found for this professional';
  end if;

  return query
  select
    case event.event_type
      when 'appointment_created' then U&'Agendamento criado'
      when 'invitation_sent' then U&'Convite enviado por e-mail'
      when 'awaiting_confirmation' then U&'Aguardando confirma\00E7\00E3o'
      when 'appointment_reconfirmation_required' then U&'Agendamento alterado; nova confirma\00E7\00E3o solicitada'
      when 'invitation_opened' then U&'Paciente abriu o convite'
      when 'patient_confirmed' then U&'Paciente confirmou'
      when 'cancellation_requested' then U&'Cancelamento solicitado'
      when 'patient_cancelled' then U&'Paciente cancelou'
      when 'appointment_cancelled' then U&'Agendamento cancelado'
      when 'patient_requested_reschedule' then U&'Paciente solicitou reagendamento'
      when 'psychologist_approved_reschedule' then U&'Reagendamento aprovado'
      when 'psychologist_rejected_reschedule' then U&'Reagendamento recusado'
      when 'appointment_rescheduled' then U&'Data oficial atualizada'
      when 'clinical_status_changed' then U&'Situa\00E7\00E3o cl\00EDnica atualizada'
      when 'consultation_started' then U&'Consulta iniciada'
      when 'consultation_completed' then U&'Consulta realizada'
      when 'consultation_closed' then U&'Consulta encerrada'
      when 'patient_reaction_window_expired' then U&'Prazo de resposta do paciente encerrado'
      when 'financial_entry_created' then U&'Cobran\00E7a criada'
      when 'financial_launch_created' then U&'Lan\00E7amento financeiro criado'
      when 'charge_created' then U&'Cobran\00E7a vinculada'
      when 'charge_cancelled' then U&'Cobran\00E7a cancelada'
      when 'boleto_generated' then U&'Boleto gerado'
      when 'boleto_viewed' then U&'Paciente visualizou o boleto'
      when 'charge_viewed' then U&'Paciente visualizou a cobran\00E7a'
      when 'pix_generated' then U&'PIX gerado'
      when 'payment_paid' then U&'Cobran\00E7a paga'
      when 'payment_overdue' then U&'Cobran\00E7a vencida'
      when 'payment_expired' then U&'Cobran\00E7a expirada'
      when 'payment_failed' then U&'Falha na cobran\00E7a'
      when 'payment_refunded' then U&'Pagamento estornado'
      when 'package_session_linked' then U&'Sess\00E3o vinculada ao pacote'
      when 'package_sessions_reserved' then U&'Sess\00E3o reservada no pacote'
      when 'package_session_consumed' then U&'Sess\00E3o consumida do pacote'
      when 'package_reservation_released' then U&'Reserva do pacote liberada'
      when 'package_session_reversed' then U&'Consumo do pacote estornado'
      when 'package_replacement_linked' then U&'Novo pacote vinculado \00E0s sess\00F5es futuras'
      when 'package_ended_partial' then U&'Pacote encerrado ap\00F3s uso parcial'
      when 'future_charges_preserved' then U&'Cobran\00E7as futuras mantidas'
      when 'charge_cancellation_requested' then U&'Cancelamento de cobran\00E7a solicitado'
      when 'new_charges_prepared' then U&'Novas cobran\00E7as preparadas'
      when 'financial_adjustment_review' then U&'Ajuste financeiro aguardando revis\00E3o'
      when 'cancellation_email_sent' then U&'E-mail de cancelamento enviado'
      when 'reschedule_approved_email_sent' then U&'Novo hor\00E1rio enviado ao paciente'
      when 'reschedule_rejected_email_sent' then U&'Recusa enviada ao paciente'
      when 'reschedule_decision_email_failed' then U&'Falha ao enviar a decis\00E3o por e-mail'
      when 'reschedule_decision_email_skipped' then U&'Decis\00E3o registrada sem envio de e-mail'
      when 'appointment_policy_changed_for_future_occurrence' then U&'Pol\00EDtica da consulta futura atualizada'
      else U&'Atualiza\00E7\00E3o do agendamento'
    end,
    case
      when event.actor_type = 'patient' then coalesce(
        nullif(btrim(patient.social_name), ''),
        nullif(btrim(patient.name), ''),
        'Paciente'
      )
      when event.actor_type = 'psychologist' then coalesce(
        nullif(btrim(profile.full_name), ''),
        nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
        nullif(btrim(profile.name), ''),
        U&'Psic\00F3logo respons\00E1vel'
      )
      else 'NeuroNex'
    end,
    case event.action_origin
      when 'public_appointment' then U&'Link seguro do paciente'
      when 'professional_app' then U&'Painel da NeuroNex'
      when 'email_delivery' then U&'Automa\00E7\00E3o de e-mail'
      when 'patient_portal' then U&'Portal do paciente'
      when 'google_calendar' then U&'Google Agenda'
      when 'synapse' then 'Synapse'
      when 'provider_webhook' then U&'Integra\00E7\00E3o financeira segura'
      when 'teleconsultation' then 'Teleconsulta NeuroNex'
      else U&'Automa\00E7\00E3o da NeuroNex'
    end,
    event.created_at,
    case
      when status_from.label is null and status_to.label is null then null
      when status_from.label is not distinct from status_to.label then null
      when status_from.label is null then U&'Situa\00E7\00E3o atual: ' || status_to.label
      when status_to.label is null then U&'Situa\00E7\00E3o anterior: ' || status_from.label
      else status_from.label || U&' \2192 ' || status_to.label
    end,
    case event.event_type
      when 'invitation_opened' then U&'O link seguro da consulta foi acessado.'
      when 'appointment_reconfirmation_required' then U&'Os detalhes mudaram e o paciente precisa confirmar esta nova vers\00E3o.'
      when 'patient_requested_reschedule' then U&'A solicita\00E7\00E3o aguarda an\00E1lise do profissional.'
      when 'psychologist_approved_reschedule' then U&'O novo hor\00E1rio solicitado foi aceito.'
      when 'psychologist_rejected_reschedule' then U&'O hor\00E1rio original foi mantido.'
      when 'appointment_rescheduled' then U&'O novo hor\00E1rio passou a ser o hor\00E1rio oficial.'
      when 'package_sessions_reserved' then U&'A sess\00E3o foi reservada sem consumir saldo realizado.'
      when 'package_session_consumed' then U&'O consumo foi registrado para esta ocorr\00EAncia.'
      when 'package_reservation_released' then U&'A reserva futura foi liberada sem alterar sess\00F5es realizadas.'
      when 'package_replacement_linked' then U&'A ocorr\00EAncia futura passou a ser coberta pelo novo pacote.'
      when 'package_ended_partial' then U&'Sess\00F5es realizadas, pagamentos e documentos anteriores foram preservados.'
      else null
    end,
    case
      when event.event_type like '%email%' or event.event_type like '%invitation%' then 'email'
      when event.event_type like '%cancel%' then 'cancel'
      when event.event_type like '%reschedule%' then 'reschedule'
      when event.event_type ~ '(payment|financial|charge|pix|boleto|package)' then 'financial'
      when event.event_type ~ '(confirm|completed|closed|approved)' then 'success'
      else 'default'
    end
  from public.appointment_events event
  join public.appointments appointment on appointment.id = event.appointment_id
  left join public.patients patient on patient.id = event.patient_id
  left join public.profiles profile on profile.id = event.psychologist_id
  left join lateral (
    select case event.from_status
      when 'created' then 'Criado'
      when 'invitation_sent' then 'Convite enviado'
      when 'awaiting_confirmation' then U&'Aguardando confirma\00E7\00E3o'
      when 'awaiting_reconfirmation' then U&'Aguardando nova confirma\00E7\00E3o'
      when 'confirmed' then 'Confirmado'
      when 'cancellation_requested' then 'Cancelamento solicitado'
      when 'cancelled' then 'Cancelado'
      when 'reschedule_requested' then 'Reagendamento solicitado'
      when 'reschedule_approved' then 'Reagendamento aprovado'
      when 'reschedule_rejected' then 'Reagendamento recusado'
      when 'professional_response_overdue' then U&'Resposta do profissional em atraso'
      when 'in_progress' then 'Em atendimento'
      when 'completed' then 'Realizado'
      when 'closed' then 'Encerrado'
      else null
    end as label
  ) status_from on true
  left join lateral (
    select case event.to_status
      when 'created' then 'Criado'
      when 'invitation_sent' then 'Convite enviado'
      when 'awaiting_confirmation' then U&'Aguardando confirma\00E7\00E3o'
      when 'awaiting_reconfirmation' then U&'Aguardando nova confirma\00E7\00E3o'
      when 'confirmed' then 'Confirmado'
      when 'cancellation_requested' then 'Cancelamento solicitado'
      when 'cancelled' then 'Cancelado'
      when 'reschedule_requested' then 'Reagendamento solicitado'
      when 'reschedule_approved' then 'Reagendamento aprovado'
      when 'reschedule_rejected' then 'Reagendamento recusado'
      when 'professional_response_overdue' then U&'Resposta do profissional em atraso'
      when 'in_progress' then 'Em atendimento'
      when 'completed' then 'Realizado'
      when 'closed' then 'Encerrado'
      else null
    end as label
  ) status_to on true
  where event.appointment_id = p_appointment_id
    and appointment.user_id = auth.uid()
  order by event.created_at desc, event.id desc;
end;
$$;

revoke all on function public.get_safe_appointment_timeline(uuid)
  from public, anon;
grant execute on function public.get_safe_appointment_timeline(uuid)
  to authenticated;

alter table public.system_email_templates
  add column if not exists preheader text,
  add column if not exists body_text text,
  add column if not exists version integer not null default 1;

alter table public.system_email_templates
  drop constraint if exists system_email_templates_version_check,
  add constraint system_email_templates_version_check check (version >= 1);

create or replace function private.build_neuronex_operational_email_template(
  p_title text,
  p_intro text,
  p_cta_label text,
  p_include_policy boolean default true
)
returns text
language sql
immutable
set search_path = ''
as $$
  select '<!doctype html>'
    || '<html lang="pt-BR"><head><meta charset="UTF-8">'
    || '<meta name="viewport" content="width=device-width,initial-scale=1">'
    || '<meta name="x-apple-disable-message-reformatting">'
    || '<title>' || p_title || '</title></head>'
    || '<body style="margin:0;padding:0;background:#f4f4f5;color:#18181b;">'
    || '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">{{{PREHEADER}}}</div>'
    || '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f4f4f5;">'
    || '<tr><td align="center" style="padding:32px 12px;">'
    || '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #e4e4e7;border-radius:24px;">'
    || '<tr><td style="padding:30px 34px;background:#09090b;border-radius:24px 24px 0 0;color:#ffffff;">'
    || '<p style="margin:0;font:700 12px/1.4 Arial,sans-serif;letter-spacing:3px;">NEURONEX</p>'
    || '<p style="margin:10px 0 0;font:400 13px/1.5 Arial,sans-serif;color:#d4d4d8;">Atendimento privado</p>'
    || '</td></tr>'
    || '<tr><td style="padding:38px 34px 18px;">'
    || '<p style="margin:0 0 14px;font:400 15px/1.6 Arial,sans-serif;color:#52525b;">Ol&aacute;, {{{RECIPIENT_NAME}}}.</p>'
    || '<h1 style="margin:0 0 16px;font:700 30px/1.18 Arial,sans-serif;letter-spacing:-0.5px;color:#18181b;">'
    || p_title || '</h1>'
    || '<p style="margin:0;font:400 16px/1.7 Arial,sans-serif;color:#3f3f46;">'
    || p_intro || '</p></td></tr>'
    || '<tr><td style="padding:8px 34px 0;">'
    || '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#fafafa;border:1px solid #e4e4e7;border-radius:18px;">'
    || '<tr><td style="padding:22px 22px 8px;font:700 11px/1.4 Arial,sans-serif;letter-spacing:1.6px;color:#71717a;">DETALHES DO ATENDIMENTO</td></tr>'
    || '<tr><td style="padding:0 22px 6px;font:400 14px/1.6 Arial,sans-serif;"><strong>Profissional:</strong> {{{PROFESSIONAL_NAME}}}</td></tr>'
    || '<tr><td style="padding:0 22px 6px;font:400 14px/1.6 Arial,sans-serif;"><strong>Data:</strong> {{{APPOINTMENT_DATE}}}</td></tr>'
    || '<tr><td style="padding:0 22px 6px;font:400 14px/1.6 Arial,sans-serif;"><strong>Hor&aacute;rio:</strong> {{{APPOINTMENT_TIME}}}</td></tr>'
    || '<tr><td style="padding:0 22px 22px;font:400 14px/1.6 Arial,sans-serif;"><strong>Modalidade/local:</strong> {{{APPOINTMENT_LOCATION}}}</td></tr>'
    || '</table></td></tr>'
    || case when p_include_policy then
      '<tr><td style="padding:18px 34px 0;">'
      || '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-left:4px solid #18181b;background:#f4f4f5;border-radius:12px;">'
      || '<tr><td style="padding:17px 18px 7px;font:700 12px/1.4 Arial,sans-serif;">Sua janela de escolha</td></tr>'
      || '<tr><td style="padding:0 18px 5px;font:400 14px/1.6 Arial,sans-serif;color:#3f3f46;"><strong>Cancelamento sem perda do cr&eacute;dito:</strong> at&eacute; {{{FREE_CANCELLATION_DEADLINE}}}.</td></tr>'
      || '<tr><td style="padding:0 18px 7px;font:400 14px/1.6 Arial,sans-serif;color:#3f3f46;"><strong>Reagendamento sem perda do cr&eacute;dito:</strong> at&eacute; {{{FREE_RESCHEDULE_DEADLINE}}}.</td></tr>'
      || '<tr><td style="padding:0 18px 17px;font:400 13px/1.6 Arial,sans-serif;color:#52525b;">Depois do prazo aplic&aacute;vel a cada a&ccedil;&atilde;o: {{{LATE_CONSEQUENCE}}}</td></tr>'
      || '</table></td></tr>'
      else '' end
    || '<tr><td style="padding:28px 34px 38px;">'
    || '<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>'
    || '<td bgcolor="#18181b" style="border-radius:12px;">'
    || '<a href="{{{ACTION_URL}}}" style="display:inline-block;padding:15px 24px;font:700 15px/1 Arial,sans-serif;color:#ffffff;text-decoration:none;border-radius:12px;">'
    || p_cta_label || '</a></td></tr></table>'
    || '<p style="margin:18px 0 0;font:400 12px/1.6 Arial,sans-serif;color:#71717a;">Se o bot&atilde;o n&atilde;o abrir, copie este endere&ccedil;o: {{{ACTION_URL}}}</p>'
    || '</td></tr>'
    || '<tr><td style="padding:22px 34px;background:#fafafa;border-top:1px solid #e4e4e7;border-radius:0 0 24px 24px;">'
    || '<p style="margin:0 0 7px;font:700 11px/1.5 Arial,sans-serif;color:#3f3f46;">SEGURAN&Ccedil;A</p>'
    || '<p style="margin:0;font:400 11px/1.6 Arial,sans-serif;color:#71717a;">Este link &eacute; pessoal. N&atilde;o o encaminhe. A NeuroNex nunca solicitar&aacute; senha ou dados cl&iacute;nicos por e-mail.</p>'
    || '</td></tr></table></td></tr></table></body></html>';
$$;

insert into public.system_email_templates (
  template_key, subject, preheader, body_html, body_text, sender_profile, enabled, version
)
values
  (
    'appointment_confirmation',
    U&'Confirme os detalhes da sua consulta',
    U&'Revise o hor\00E1rio e confirme com seguran\00E7a.',
    private.build_neuronex_operational_email_template(
      U&'Confirme os detalhes da sua consulta',
      U&'Seu atendimento foi reservado. Revise as informa\00E7\00F5es e escolha confirmar, cancelar ou solicitar outro hor\00E1rio.',
      U&'Gerenciar agendamento',
      true
    ),
    U&'Ol\00E1, {{{RECIPIENT_NAME}}}.\000A\000AConfirme os detalhes da sua consulta com {{{PROFESSIONAL_NAME}}}.\000AData: {{{APPOINTMENT_DATE}}}\000AHor\00E1rio: {{{APPOINTMENT_TIME}}}\000AModalidade/local: {{{APPOINTMENT_LOCATION}}}\000A\000ACancelamento sem perda do cr\00E9dito: at\00E9 {{{FREE_CANCELLATION_DEADLINE}}}.\000AReagendamento sem perda do cr\00E9dito: at\00E9 {{{FREE_RESCHEDULE_DEADLINE}}}.\000ADepois do prazo aplic\00E1vel a cada a\00E7\00E3o: {{{LATE_CONSEQUENCE}}}\000A\000AAcesse: {{{ACTION_URL}}}\000A\000AEste link \00E9 pessoal. N\00E3o o encaminhe.',
    'operational', true, 2
  ),
  (
    'appointment_reconfirmation',
    U&'O hor\00E1rio mudou: confirme novamente',
    U&'O profissional atualizou detalhes que exigem uma nova confirma\00E7\00E3o.',
    private.build_neuronex_operational_email_template(
      U&'Confirme novamente o atendimento',
      U&'O profissional alterou um detalhe relevante da consulta. Sua confirma\00E7\00E3o anterior permanece no hist\00F3rico, mas esta nova vers\00E3o precisa da sua resposta.',
      U&'Revisar novo hor\00E1rio',
      true
    ),
    U&'Ol\00E1, {{{RECIPIENT_NAME}}}. O atendimento foi atualizado e precisa de nova confirma\00E7\00E3o.\000AData: {{{APPOINTMENT_DATE}}}\000AHor\00E1rio: {{{APPOINTMENT_TIME}}}\000ACancelamento sem perda do cr\00E9dito: at\00E9 {{{FREE_CANCELLATION_DEADLINE}}}.\000AReagendamento sem perda do cr\00E9dito: at\00E9 {{{FREE_RESCHEDULE_DEADLINE}}}.\000AAcesse: {{{ACTION_URL}}}',
    'operational', true, 2
  ),
  (
    'appointment_reschedule_requested',
    U&'Solicita\00E7\00E3o de reagendamento recebida',
    U&'A solicita\00E7\00E3o est\00E1 protegida enquanto aguarda decis\00E3o.',
    private.build_neuronex_operational_email_template(
      U&'Solicita\00E7\00E3o recebida',
      U&'O pedido de outro hor\00E1rio foi registrado. O hor\00E1rio original continua vis\00EDvel at\00E9 a decis\00E3o do profissional.',
      U&'Acompanhar solicita\00E7\00E3o',
      true
    ),
    U&'Sua solicita\00E7\00E3o de reagendamento foi recebida. Acompanhe em {{{ACTION_URL}}}.',
    'operational', true, 1
  ),
  (
    'appointment_reschedule_approved',
    U&'Seu novo hor\00E1rio foi aprovado',
    U&'Confira os detalhes atualizados da consulta.',
    private.build_neuronex_operational_email_template(
      U&'Novo hor\00E1rio aprovado',
      U&'O hor\00E1rio solicitado foi aprovado e passou a ser o hor\00E1rio oficial da consulta.',
      U&'Ver detalhes da consulta',
      true
    ),
    U&'Seu novo hor\00E1rio foi aprovado. Data: {{{APPOINTMENT_DATE}}}. Hor\00E1rio: {{{APPOINTMENT_TIME}}}. Acesse: {{{ACTION_URL}}}',
    'operational', true, 1
  ),
  (
    'appointment_reschedule_rejected',
    U&'Retorno sobre seu pedido de reagendamento',
    U&'O hor\00E1rio original foi mantido e suas a\00E7\00F5es foram reabertas.',
    private.build_neuronex_operational_email_template(
      U&'Hor\00E1rio original mantido',
      U&'O pedido anterior n\00E3o foi aceito. Voc\00EA ainda pode confirmar, cancelar ou solicitar outro hor\00E1rio dentro da janela informada.',
      U&'Escolher pr\00F3xima a\00E7\00E3o',
      true
    ),
    U&'O hor\00E1rio original foi mantido. Motivo: {{{REVIEW_REASON}}}. Voc\00EA pode agir at\00E9 {{{PATIENT_ACTION_DEADLINE}}}. Acesse: {{{ACTION_URL}}}',
    'operational', true, 1
  ),
  (
    'appointment_reschedule_response_overdue',
    U&'Sua solicita\00E7\00E3o est\00E1 protegida',
    U&'O prazo de resposta do profissional venceu sem decis\00E3o.',
    private.build_neuronex_operational_email_template(
      U&'Decis\00E3o do profissional em atraso',
      U&'O prazo de resposta venceu. O hor\00E1rio original n\00E3o foi cancelado automaticamente e nenhuma penalidade financeira pode ser aplicada por esse atraso.',
      U&'Ver situa\00E7\00E3o protegida',
      true
    ),
    U&'O prazo de resposta do profissional venceu. Seu direito financeiro est\00E1 protegido e o hor\00E1rio original n\00E3o foi cancelado automaticamente. Acesse: {{{ACTION_URL}}}',
    'operational', true, 1
  ),
  (
    'appointment_cancelled',
    U&'Atualiza\00E7\00E3o sobre seu atendimento',
    U&'O cancelamento foi registrado com a pol\00EDtica aplic\00E1vel.',
    private.build_neuronex_operational_email_template(
      U&'Atendimento cancelado',
      U&'O cancelamento foi registrado. Os efeitos de cr\00E9dito, cobran\00E7a e documento fiscal obedecem \00E0 pol\00EDtica congelada desta ocorr\00EAncia.',
      U&'Ver detalhes',
      true
    ),
    U&'O atendimento de {{{APPOINTMENT_DATE}}} \00E0s {{{APPOINTMENT_TIME}}} foi cancelado. Acesse: {{{ACTION_URL}}}',
    'operational', true, 1
  ),
  (
    'appointment_policy_changed',
    U&'Pol\00EDtica atualizada para uma consulta futura',
    U&'Confira a mudan\00E7a; nenhum prazo j\00E1 concedido foi reduzido.',
    private.build_neuronex_operational_email_template(
      U&'Pol\00EDtica futura atualizada',
      U&'A pol\00EDtica desta ocorr\00EAncia futura foi atualizada por a\00E7\00E3o expl\00EDcita. Nenhum prazo anteriormente concedido foi antecipado.',
      U&'Revisar pol\00EDtica',
      true
    ),
    U&'A pol\00EDtica de uma consulta futura foi atualizada sem reduzir prazos j\00E1 concedidos. Acesse: {{{ACTION_URL}}}',
    'operational', true, 1
  ),
  (
    'appointment_waitlist_offer',
    U&'Um hor\00E1rio compat\00EDvel ficou dispon\00EDvel',
    U&'A oferta \00E9 tempor\00E1ria e exige seu consentimento.',
    private.build_neuronex_operational_email_template(
      U&'Oferta privada de hor\00E1rio',
      U&'Um hor\00E1rio compat\00EDvel com suas prefer\00EAncias ficou dispon\00EDvel. Nada ser\00E1 alterado sem seu aceite.',
      U&'Analisar oferta',
      false
    ),
    U&'Um hor\00E1rio compat\00EDvel ficou dispon\00EDvel. A oferta expira em {{{OFFER_EXPIRES_AT}}}. Acesse: {{{ACTION_URL}}}',
    'operational', true, 1
  ),
  (
    'appointment_financial_adjustment',
    U&'Ajuste financeiro relacionado \00E0 sua sess\00E3o',
    U&'Confira o efeito seguro sobre cr\00E9dito ou cobran\00E7a.',
    private.build_neuronex_operational_email_template(
      U&'Ajuste financeiro da sess\00E3o',
      U&'Houve uma atualiza\00E7\00E3o financeira ligada a esta ocorr\00EAncia. Nenhuma informa\00E7\00E3o cl\00EDnica foi inclu\00EDda neste e-mail.',
      U&'Ver ajuste com seguran\00E7a',
      false
    ),
    U&'Um ajuste financeiro foi relacionado \00E0 sua sess\00E3o. Acesse: {{{ACTION_URL}}}',
    'finance', true, 1
  )
on conflict (template_key) do update set
  subject = excluded.subject,
  preheader = excluded.preheader,
  body_html = excluded.body_html,
  body_text = excluded.body_text,
  sender_profile = excluded.sender_profile,
  enabled = excluded.enabled,
  version = greatest(public.system_email_templates.version, excluded.version),
  updated_at = now()
where public.system_email_templates.version <= excluded.version;

drop function private.build_neuronex_operational_email_template(text, text, text, boolean);

-- This legacy notifier accepts token-shaped input and therefore remains an
-- internal helper behind token-validating Edge Functions only.
revoke execute on function public.emit_public_appointment_notification(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.emit_public_appointment_notification(uuid, text, text)
  to service_role;

comment on table public.appointment_policy_versions is
  'Append-only commercial policy versions configured by a professional.';
comment on table public.appointment_policy_snapshots is
  'Immutable appointment-specific policy facts, cutoffs and consequences.';
comment on table public.appointment_communication_outbox is
  'Retryable patient communication tasks; no raw bearer token is stored.';

commit;
