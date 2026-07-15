begin;

do $qa$
declare
  v_professional_id uuid;
  v_patient_id uuid;
  v_appointment_id uuid := gen_random_uuid();
  v_request_id uuid := gen_random_uuid();
  v_old_token_id uuid := gen_random_uuid();
  v_new_token_id uuid := gen_random_uuid();
  v_old_token_hash text := encode(digest(gen_random_uuid()::text, 'sha256'), 'hex');
  v_new_token_hash text := encode(digest(gen_random_uuid()::text, 'sha256'), 'hex');
  v_original_start timestamptz := date_trunc('day', now() + interval '180 days') + interval '10 hours';
  v_requested_start timestamptz;
  v_professional_start timestamptz;
  v_result jsonb;
  v_count integer;
begin
  select patient.user_id, patient.id
  into v_professional_id, v_patient_id
  from public.patients patient
  join auth.users account on account.id = patient.user_id
  order by patient.created_at nulls last
  limit 1;

  if v_professional_id is null or v_patient_id is null then
    raise exception 'QA requires one existing professional and patient';
  end if;

  v_requested_start := v_original_start + interval '7 days 2 hours';
  v_professional_start := v_requested_start + interval '1 day 1 hour';

  perform set_config('request.jwt.claim.sub', v_professional_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_professional_id, 'role', 'authenticated')::text,
    true
  );

  insert into public.appointments (
    id, user_id, patient_id, start_time, end_time, type, status, location,
    lifecycle_status, confirmed_at, confirmation_revision, confirmed_revision,
    created_by, updated_by, action_origin, last_actor_type, notes
  ) values (
    v_appointment_id, v_professional_id, v_patient_id,
    v_original_start, v_original_start + interval '50 minutes',
    'presencial', 'pending', 'Consultorio A', 'confirmed', now() - interval '1 day',
    1, 1, v_professional_id, v_professional_id, 'professional_app', 'psychologist',
    'QA observacao original'
  );

  perform private.append_appointment_event(
    v_appointment_id,
    'patient_confirmed',
    'awaiting_confirmation',
    'confirmed',
    'patient',
    null,
    'public_appointment',
    jsonb_build_object('confirmationRevision', 1),
    'appointment:' || v_appointment_id::text || ':confirmation-revision:1:confirmed'
  );

  insert into public.appointment_confirmation_tokens (
    id, appointment_id, appointment_revision, token_hash, expires_at, status,
    sent_at, opened_at, created_by, metadata
  ) values (
    v_old_token_id, v_appointment_id, 1, v_old_token_hash,
    now() + interval '30 days', 'opened', now() - interval '1 day',
    now() - interval '1 day', v_professional_id,
    jsonb_build_object('appointmentRevision', 1, 'qa', true)
  );

  update public.appointments
  set lifecycle_status = 'reschedule_requested',
      action_origin = 'public_appointment',
      last_actor_type = 'patient'
  where id = v_appointment_id;

  insert into public.appointment_reschedule_requests (
    id, appointment_id, psychologist_id, patient_id,
    original_start_time, original_end_time,
    requested_start_time, requested_end_time,
    status, reviewed_by, reviewed_at, metadata
  ) values (
    v_request_id, v_appointment_id, v_professional_id, v_patient_id,
    v_original_start, v_original_start + interval '50 minutes',
    v_requested_start, v_requested_start + interval '50 minutes',
    'approved', v_professional_id, now(), jsonb_build_object('qa', true)
  );

  -- Accepting exactly the time requested by the patient keeps the approved
  -- lifecycle and does not demand a redundant confirmation.
  update public.appointments
  set start_time = v_requested_start,
      end_time = v_requested_start + interval '50 minutes',
      lifecycle_status = 'reschedule_approved',
      reschedule_approved_at = now(),
      updated_by = v_professional_id,
      action_origin = 'professional_app',
      last_actor_type = 'psychologist'
  where id = v_appointment_id;

  if not exists (
    select 1 from public.appointments
    where id = v_appointment_id
      and lifecycle_status = 'reschedule_approved'
      and confirmation_revision = 1
      and confirmed_revision = 1
  ) then
    raise exception 'QA patient-requested time approval incorrectly required reconfirmation';
  end if;

  if not exists (
    select 1 from public.appointment_confirmation_tokens
    where id = v_old_token_id and status = 'opened' and revoked_at is null
  ) then
    raise exception 'QA patient-requested time approval incorrectly revoked its token';
  end if;

  -- A later professional drag is a new patient-facing schedule revision.
  update public.appointments
  set start_time = v_professional_start,
      end_time = v_professional_start + interval '60 minutes'
  where id = v_appointment_id;

  if not exists (
    select 1 from public.appointments
    where id = v_appointment_id
      and start_time = v_professional_start
      and end_time = v_professional_start + interval '60 minutes'
      and lifecycle_status = 'awaiting_reconfirmation'
      and confirmation_revision = 2
      and confirmed_revision is null
      and confirmed_at is null
      and invitation_sent_at is null
      and invitation_opened_at is null
  ) then
    raise exception 'QA material professional change did not start revision 2';
  end if;

  if not exists (
    select 1 from public.appointment_confirmation_tokens
    where id = v_old_token_id and status = 'revoked' and revoked_at is not null
  ) then
    raise exception 'QA revision 1 token was not revoked transactionally';
  end if;

  select count(*) into v_count
  from public.appointment_events
  where appointment_id = v_appointment_id
    and event_type = 'appointment_reconfirmation_required'
    and from_status = 'reschedule_approved'
    and to_status = 'awaiting_reconfirmation';
  if v_count <> 1 then
    raise exception 'QA expected one human reconfirmation timeline event, got %', v_count;
  end if;

  -- A retried identical drag and an internal note update are both idempotent.
  update public.appointments
  set start_time = v_professional_start,
      end_time = v_professional_start + interval '60 minutes'
  where id = v_appointment_id;

  update public.appointments
  set notes = 'QA observacao interna alterada'
  where id = v_appointment_id;

  if not exists (
    select 1 from public.appointments
    where id = v_appointment_id and confirmation_revision = 2
  ) then
    raise exception 'QA idempotent or internal update incremented the revision again';
  end if;

  select count(*) into v_count
  from public.appointment_events
  where appointment_id = v_appointment_id
    and event_type = 'appointment_reconfirmation_required';
  if v_count <> 1 then
    raise exception 'QA idempotent replay duplicated the reconfirmation event';
  end if;

  -- Even a privileged attempt cannot reactivate a token for revision 1.
  begin
    update public.appointment_confirmation_tokens
    set status = 'sent', revoked_at = null
    where id = v_old_token_id;
    raise exception 'QA superseded token was reactivated';
  exception
    when others then
      if sqlerrm = 'QA superseded token was reactivated' then
        raise;
      end if;
  end;

  insert into public.appointment_confirmation_tokens (
    id, appointment_id, appointment_revision, token_hash, expires_at,
    status, sent_at, created_by, metadata
  ) values (
    v_new_token_id, v_appointment_id, 2, v_new_token_hash,
    now() + interval '30 days', 'sent', now(), v_professional_id,
    jsonb_build_object('appointmentRevision', 2, 'qa', true)
  );

  v_result := public.process_appointment_public_action(
    v_new_token_hash,
    'confirm',
    null,
    null,
    null,
    jsonb_build_object('qa', true)
  );

  if not exists (
    select 1 from public.appointments
    where id = v_appointment_id
      and lifecycle_status = 'confirmed'
      and confirmation_revision = 2
      and confirmed_revision = 2
      and confirmed_at is not null
  ) then
    raise exception 'QA patient could not confirm revision 2';
  end if;

  v_result := public.process_appointment_public_action(
    v_new_token_hash,
    'confirm',
    null,
    null,
    null,
    jsonb_build_object('qaReplay', true)
  );
  if not coalesce((v_result ->> 'idempotentReplay')::boolean, false) then
    raise exception 'QA confirmation replay was not idempotent';
  end if;

  begin
    perform public.process_appointment_public_action(
      v_old_token_hash,
      'confirm',
      null,
      null,
      null,
      jsonb_build_object('qaOldLink', true)
    );
    raise exception 'QA revision 1 token confirmed revision 2';
  exception
    when others then
      if sqlerrm = 'QA revision 1 token confirmed revision 2' then
        raise;
      end if;
  end;

  select count(*) into v_count
  from public.appointment_events
  where appointment_id = v_appointment_id
    and event_type = 'patient_confirmed'
    and idempotency_key in (
      'appointment:' || v_appointment_id::text || ':confirmation-revision:1:confirmed',
      'appointment:' || v_appointment_id::text || ':confirmation-revision:2:confirmed'
    );
  if v_count <> 2 then
    raise exception 'QA did not preserve both versioned confirmations';
  end if;

  if exists (
    select 1 from public.appointment_confirmation_tokens
    where appointment_id = v_appointment_id and token is not null
  ) then
    raise exception 'QA raw confirmation token was persisted';
  end if;
end;
$qa$;

rollback;
