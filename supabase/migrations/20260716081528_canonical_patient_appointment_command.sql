-- Canonical patient command shared by the secure public link and Patient Portal.
-- The wrappers authenticate a channel. All business rules live in the private
-- command and the appointment lifecycle triggers it activates.

create or replace function private.apply_appointment_command(
  p_appointment_id uuid,
  p_actor_user_id uuid,
  p_actor_type text,
  p_action_origin text,
  p_expected_revision integer,
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
  if p_actor_type <> 'patient' then
    raise exception 'Unsupported appointment actor';
  end if;
  if p_action_origin not in ('public_appointment', 'patient_portal') then
    raise exception 'Unsupported appointment action origin';
  end if;
  if p_action not in ('confirm', 'cancel', 'reschedule') then
    raise exception 'Unsupported appointment action';
  end if;
  if p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'Appointment revision is required';
  end if;

  -- Every appointment command acquires locks in the same order.
  perform pg_advisory_xact_lock(
    hashtextextended('appointment:' || p_appointment_id::text, 0)
  );

  select * into v_appointment
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'Appointment not found';
  end if;
  if v_appointment.confirmation_revision <> p_expected_revision then
    raise exception using
      message = 'Appointment changed in another session. Refresh the data and try again.',
      errcode = '40001';
  end if;

  if v_appointment.policy_snapshot_id is null then
    v_appointment.policy_snapshot_id := private.create_appointment_policy_snapshot(
      v_appointment.id,
      p_action_origin || '_action_backfill',
      p_actor_user_id,
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
      updated_by = p_actor_user_id,
      action_origin = p_action_origin,
      last_actor_type = 'patient',
      audit_metadata = coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'confirmationRevision', v_appointment.confirmation_revision,
        'policySnapshotId', v_snapshot.id,
        'idempotencyKey',
          'appointment:' || v_appointment.id::text
          || ':confirmation-revision:' || v_appointment.confirmation_revision::text
          || ':confirmed'
      )
    where id = v_appointment.id
    returning * into v_appointment;

    perform public.emit_user_notification(
      v_appointment.user_id,
      'appointment:' || v_appointment.id::text || ':revision:' ||
        v_appointment.confirmation_revision::text || ':patient-confirmed',
      'appointment_confirmed',
      'agenda',
      'success',
      'Agendamento confirmado',
      'O paciente confirmou presença no horário agendado.',
      '/agenda?appointmentId=' || v_appointment.id::text,
      'normal',
      jsonb_build_object(
        'sourceModule', 'agenda',
        'eventSource', p_action_origin,
        'appointmentId', v_appointment.id,
        'requiresAction', false
      )
    );

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
      raise exception 'A started or finished appointment cannot be cancelled by the patient';
    end if;
    if v_now >= v_appointment.start_time then
      raise exception 'A started appointment cannot be cancelled by the patient';
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
      updated_by = p_actor_user_id,
      action_origin = p_action_origin,
      last_actor_type = 'patient',
      audit_metadata = coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'reason', nullif(btrim(p_reason), ''),
        'withinFreeWindow', v_within_free_window,
        'financialRightProtected', v_right_protected,
        'policySnapshotId', v_snapshot.id,
        'idempotencyKey', 'appointment:' || v_appointment.id::text || ':cancelled'
      )
    where id = v_appointment.id
    returning * into v_appointment;

    perform public.emit_user_notification(
      v_appointment.user_id,
      'appointment:' || v_appointment.id::text || ':patient-cancelled',
      'appointment_cancelled',
      'agenda',
      'warning',
      'Agendamento cancelado pelo paciente',
      'O paciente cancelou a sessão. Consulte a timeline para revisar os impactos.',
      '/agenda?appointmentId=' || v_appointment.id::text,
      'high',
      jsonb_build_object(
        'sourceModule', 'agenda',
        'eventSource', p_action_origin,
        'appointmentId', v_appointment.id,
        'requiresAction', v_appointment.outcome_review_required,
        'nativePushEligible', true
      )
    );

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
    coalesce(p_metadata, '{}'::jsonb)
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
    updated_by = p_actor_user_id,
    action_origin = p_action_origin,
    last_actor_type = 'patient',
    audit_metadata = coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
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

  perform public.emit_user_notification(
    v_appointment.user_id,
    'appointment:' || v_appointment.id::text || ':request:' ||
      v_request.id::text || ':patient-reschedule',
    'appointment_reschedule_requested',
    'agenda',
    'warning',
    'Paciente solicitou outro horário',
    'O horário oficial foi preservado até sua resposta.',
    '/agenda?appointmentId=' || v_appointment.id::text,
    'high',
    jsonb_build_object(
      'sourceModule', 'agenda',
      'eventSource', p_action_origin,
      'appointmentId', v_appointment.id,
      'requiresAction', true,
      'nativePushEligible', true
    )
  );

  return jsonb_build_object(
    'appointment', to_jsonb(v_appointment),
    'request', to_jsonb(v_request),
    'event', 'reschedule_requested'
  );
end;
$$;

revoke all on function private.apply_appointment_command(
  uuid, uuid, text, text, integer, text, text, timestamptz, timestamptz, jsonb
) from public, anon, authenticated, service_role;

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
  v_result jsonb;
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

  v_result := private.apply_appointment_command(
    v_token.appointment_id,
    null,
    'patient',
    'public_appointment',
    v_token.appointment_revision,
    p_action,
    p_reason,
    p_requested_start_time,
    p_requested_end_time,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('tokenId', v_token.id)
  );

  update public.appointment_confirmation_tokens
  set used_at = v_now, status = 'opened', opened_at = coalesce(opened_at, v_now)
  where id = v_token.id
    and appointment_revision = v_token.appointment_revision
    and revoked_at is null;

  return v_result;
end;
$$;

revoke all on function public.process_appointment_public_action(
  text, text, text, timestamptz, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.process_appointment_public_action(
  text, text, text, timestamptz, timestamptz, jsonb
) to service_role;

create or replace function public.process_patient_portal_appointment_action_internal(
  p_patient_user_id uuid,
  p_appointment_id uuid,
  p_expected_revision integer,
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
  v_appointment public.appointments%rowtype;
begin
  if p_patient_user_id is null then
    raise exception 'Patient session is required';
  end if;

  select appointment.* into v_appointment
  from public.appointments appointment
  join public.patient_portal_links portal_link
    on portal_link.patient_id = appointment.patient_id
   and portal_link.psychologist_user_id = appointment.user_id
   and portal_link.patient_user_id = p_patient_user_id
   and portal_link.status = 'active'
  where appointment.id = p_appointment_id;

  if not found then
    raise exception 'Appointment does not belong to the active patient relationship';
  end if;

  return private.apply_appointment_command(
    v_appointment.id,
    p_patient_user_id,
    'patient',
    'patient_portal',
    p_expected_revision,
    p_action,
    p_reason,
    p_requested_start_time,
    p_requested_end_time,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('patientUserId', p_patient_user_id)
  );
end;
$$;

revoke all on function public.process_patient_portal_appointment_action_internal(
  uuid, uuid, integer, text, text, timestamptz, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.process_patient_portal_appointment_action_internal(
  uuid, uuid, integer, text, text, timestamptz, timestamptz, jsonb
) to service_role;

comment on function private.apply_appointment_command(
  uuid, uuid, text, text, integer, text, text, timestamptz, timestamptz, jsonb
) is 'Canonical patient appointment command. Wrappers authenticate the channel; this function owns state, revision, policy and consequences.';
