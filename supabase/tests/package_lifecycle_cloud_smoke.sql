begin;

do $qa$
declare
  v_professional_id uuid;
  v_patient_id uuid;
  v_series_id uuid := gen_random_uuid();
  v_package_a uuid := gen_random_uuid();
  v_package_b uuid := gen_random_uuid();
  v_package_small uuid := gen_random_uuid();
  v_package_paid uuid := gen_random_uuid();
  v_appointment_ids uuid[] := array[]::uuid[];
  v_expected_ids uuid[];
  v_appointment_id uuid;
  v_binding_id uuid;
  v_entry_id uuid;
  v_payment_id uuid;
  v_start timestamptz;
  v_base timestamptz := date_trunc('day', now()) + interval '20 hours 13 minutes 37 seconds';
  v_preview jsonb;
  v_small_preview jsonb;
  v_progress jsonb;
  v_result jsonb;
  v_replay jsonb;
  v_review_result jsonb;
  v_operation_id uuid;
  v_count integer;
  i integer;
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

  insert into public.patient_packages (
    id, user_id, patient_id, description, total_sessions, sessions_used,
    sessions_reserved, price, start_date, end_date, active, billing_mode,
    package_status, billing_status, default_payment_method
  ) values
    (
      v_package_a, v_professional_id, v_patient_id, 'QA Package A', 6, 0,
      0, 600, current_date - 30, current_date + 365, 'true', 'per_session',
      'active', 'pending', 'pix'
    ),
    (
      v_package_b, v_professional_id, v_patient_id, 'QA Package B', 4, 0,
      0, 400, current_date - 30, current_date + 365, 'true', 'per_session',
      'active', 'pending', 'pix'
    ),
    (
      v_package_small, v_professional_id, v_patient_id, 'QA Package Small', 3, 0,
      0, 300, current_date - 30, current_date + 365, 'true', 'per_session',
      'active', 'pending', 'pix'
    ),
    (
      v_package_paid, v_professional_id, v_patient_id, 'QA Package Paid', 4, 0,
      0, 400, current_date - 30, current_date + 365, 'true', 'upfront',
      'active', 'paid', 'pix'
    );

  insert into public.appointment_series (
    id, psychologist_id, patient_id, frequency, total_occurrences,
    first_start_time, last_start_time, duration_minutes, appointment_type, created_by
  ) values (
    v_series_id, v_professional_id, v_patient_id, 'weekly', 6,
    v_base, v_base + interval '35 days',
    50, 'online', v_professional_id
  );

  for i in 1..6 loop
    v_appointment_id := gen_random_uuid();
    v_start := case
      when i = 1 then v_base + interval '28 days'
      when i = 2 then v_base + interval '35 days'
      else v_base + make_interval(days => (i - 3) * 7)
    end;

    insert into public.appointments (
      id, user_id, patient_id, start_time, end_time, type, status, location,
      lifecycle_status, series_id, occurrence_number, occurrence_count,
      created_by, updated_by, action_origin
    ) values (
      v_appointment_id, v_professional_id, v_patient_id, v_start,
      v_start + interval '50 minutes', 'online', 'pending', 'online',
      'created', v_series_id, i, 6, v_professional_id, v_professional_id,
      'professional_app'
    );

    v_appointment_ids := array_append(v_appointment_ids, v_appointment_id);
  end loop;

  perform private.reserve_package_appointments(
    v_professional_id,
    v_patient_id,
    v_package_a,
    v_appointment_ids,
    'qa_terminal',
    'qa-package-series',
    v_professional_id
  );

  select count(*) into v_count
  from public.appointment_package_bindings
  where package_id = v_package_a and status = 'reserved';
  if v_count <> 6 then
    raise exception 'QA package with no consumption did not reserve all 6 occurrences';
  end if;

  update public.appointments
  set
    start_time = case
      when id = v_appointment_ids[1] then v_base - interval '14 days'
      else v_base - interval '7 days'
    end,
    end_time = case
      when id = v_appointment_ids[1] then v_base - interval '14 days' + interval '50 minutes'
      else v_base - interval '7 days' + interval '50 minutes'
    end
  where id = any(v_appointment_ids[1:2]);

  update public.appointment_series
  set first_start_time = v_base - interval '14 days',
      last_start_time = v_base + interval '21 days'
  where id = v_series_id;

  update public.appointments
  set status = 'completed',
      lifecycle_status = 'completed',
      updated_by = v_professional_id,
      action_origin = 'professional_app'
  where id = any(v_appointment_ids[1:2]);

  select count(*) into v_count
  from public.appointment_package_bindings
  where package_id = v_package_a and status = 'consumed';
  if v_count <> 2 then
    raise exception 'QA expected 2 consumed bindings, got %', v_count;
  end if;

  select count(*) into v_count
  from public.appointment_package_bindings
  where package_id = v_package_a and status = 'reserved';
  if v_count <> 4 then
    raise exception 'QA expected 4 reserved bindings, got %', v_count;
  end if;

  for i in 1..6 loop
    select start_time into v_start
    from public.appointments
    where id = v_appointment_ids[i];

    insert into public.financial_entries (
      professional_id, patient_id, appointment_id, type, title, amount,
      due_date, competence_date, paid_at, status, payment_method, origin,
      idempotency_key
    ) values (
      v_professional_id, v_patient_id, v_appointment_ids[i], 'income',
      'QA session charge', 100, v_start::date, v_start::date,
      case when i <= 2 then now() else null end,
      case when i <= 2 then 'paid' else 'pending' end,
      'pix', 'package', 'qa-entry-' || i::text || '-' || v_series_id::text
    ) returning id into v_entry_id;

    select id into v_binding_id
    from public.appointment_package_bindings
    where appointment_id = v_appointment_ids[i]
      and package_id = v_package_a;

    insert into public.appointment_financial_coverages (
      appointment_id, binding_id, package_id, professional_id, patient_id,
      financial_entry_id, status, source, reason, idempotency_key
    ) values (
      v_appointment_ids[i], v_binding_id, v_package_a, v_professional_id,
      v_patient_id, v_entry_id, 'active', 'qa_terminal', 'QA coverage',
      'qa-coverage-' || i::text || '-' || v_series_id::text
    );
  end loop;

  v_small_preview := public.preview_package_lifecycle_change_internal(
    v_professional_id, v_package_a, v_package_small, 'replace',
    'all_future', null, 'keep_existing'
  );
  if coalesce((v_small_preview ->> 'canExecute')::boolean, true)
    or jsonb_array_length(v_small_preview -> 'hardBlocks') = 0
  then
    raise exception 'QA insufficient target package was not blocked';
  end if;

  v_small_preview := public.preview_package_lifecycle_change_internal(
    v_professional_id, v_package_a, v_package_paid, 'replace',
    'all_future', null, 'cancel_and_recreate_per_session'
  );
  if coalesce((v_small_preview ->> 'canExecute')::boolean, true)
    or jsonb_array_length(v_small_preview -> 'hardBlocks') = 0
  then
    raise exception 'QA duplicate per-session billing on a paid-upfront package was not blocked';
  end if;

  update public.appointments
  set status = 'in_progress', lifecycle_status = 'in_progress'
  where id = v_appointment_ids[3];

  v_progress := public.validate_package_lifecycle_progress_internal(
    v_professional_id, v_package_a, 'all_future', null
  );
  if not coalesce((v_progress ->> 'hasInProgress')::boolean, false) then
    raise exception 'QA in-progress occurrence was not detected';
  end if;

  begin
    update public.appointment_package_bindings
    set status = 'released', released_at = now()
    where appointment_id = v_appointment_ids[3] and package_id = v_package_a;
    raise exception 'QA in-progress binding update unexpectedly succeeded';
  exception
    when sqlstate '55000' then null;
  end;

  update public.appointments
  set status = 'pending', lifecycle_status = 'created'
  where id = v_appointment_ids[3];

  v_preview := public.preview_package_lifecycle_change_internal(
    v_professional_id, v_package_a, v_package_b, 'replace',
    'all_future', null, 'keep_existing'
  );

  if not coalesce((v_preview ->> 'canExecute')::boolean, false) then
    raise exception 'QA valid replacement preview blocked: %', v_preview;
  end if;
  if (v_preview ->> 'affectedCount')::integer <> 4 then
    raise exception 'QA expected 4 affected occurrences';
  end if;
  if (v_preview #>> '{preservedHistory,consumedSessions}')::integer <> 2
    or (v_preview #>> '{preservedHistory,paidCharges}')::integer <> 2
  then
    raise exception 'QA historical package/charge summary is incorrect';
  end if;
  if (v_preview #>> '{financialImpact,pendingCharges}')::integer <> 4
    or (v_preview #>> '{financialImpact,sameConditionCharges}')::integer <> 4
  then
    raise exception 'QA future charge summary is incorrect';
  end if;

  select array_agg((item ->> 'appointmentId')::uuid order by item ->> 'startTime')
  into v_expected_ids
  from jsonb_array_elements(v_preview -> 'occurrences') item;

  begin
    select id into v_entry_id
    from public.financial_entries
    where appointment_id = v_appointment_ids[3];

    v_payment_id := gen_random_uuid();
    insert into public.nb_payments (
      id, user_id, patient_id, appointment_id, status, normalized_status,
      gross_amount, financial_entry_id
    ) values (
      v_payment_id, v_professional_id, v_patient_id, v_appointment_ids[3],
      'processing', 'processing', 10000, v_entry_id
    );
    update public.financial_entries
    set neurofinance_charge_id = v_payment_id
    where id = v_entry_id;
    update public.appointment_financial_coverages
    set payment_id = v_payment_id
    where financial_entry_id = v_entry_id;

    v_small_preview := public.preview_package_lifecycle_change_internal(
      v_professional_id, v_package_a, v_package_b, 'replace',
      'all_future', null, 'keep_existing'
    );
    if jsonb_array_length(v_small_preview -> 'reviewReasons') = 0
      or (v_small_preview #>> '{financialImpact,sensitiveCharges}')::integer <> 1
    then
      raise exception 'QA processing charge did not require review';
    end if;

    update public.nb_payments
    set status = 'disputed', normalized_status = 'disputed'
    where id = v_payment_id;
    v_small_preview := public.preview_package_lifecycle_change_internal(
      v_professional_id, v_package_a, v_package_b, 'replace',
      'all_future', null, 'keep_existing'
    );
    if (v_small_preview #>> '{financialImpact,sensitiveCharges}')::integer <> 1 then
      raise exception 'QA disputed charge did not require review';
    end if;

    update public.nb_payments
    set status = 'pending',
        normalized_status = 'pending',
        nfse_status = 'authorized',
        nfse_authorized_at = now()
    where id = v_payment_id;
    v_small_preview := public.preview_package_lifecycle_change_internal(
      v_professional_id, v_package_a, v_package_b, 'replace',
      'all_future', null, 'keep_existing'
    );
    if (v_small_preview #>> '{financialImpact,nfseUnderReview}')::integer <> 1 then
      raise exception 'QA authorized NFS-e did not require fiscal review';
    end if;

    v_review_result := public.execute_package_lifecycle_change_internal(
      p_actor_id => v_professional_id,
      p_source_package_id => v_package_a,
      p_target_package_id => v_package_b,
      p_operation_type => 'replace',
      p_scope => 'all_future',
      p_anchor_appointment_id => null,
      p_financial_strategy => 'keep_existing',
      p_reason => 'QA sensitive financial review',
      p_idempotency_key => 'qa-review-' || v_series_id::text,
      p_expected_appointment_ids => v_expected_ids,
      p_action_origin => 'qa_terminal'
    );
    if (v_review_result ->> 'status') <> 'review_required'
      or (v_review_result ->> 'affectedCount')::integer <> 0
    then
      raise exception 'QA sensitive state changed package bindings';
    end if;

    raise exception 'QA_REVIEW_SUBTRANSACTION_ROLLBACK';
  exception
    when raise_exception then
      if sqlerrm <> 'QA_REVIEW_SUBTRANSACTION_ROLLBACK' then raise; end if;
  end;

  begin
    v_result := public.execute_package_lifecycle_change_internal(
      p_actor_id => v_professional_id,
      p_source_package_id => v_package_a,
      p_target_package_id => v_package_b,
      p_operation_type => 'replace',
      p_scope => 'all_future',
      p_anchor_appointment_id => null,
      p_financial_strategy => 'cancel_and_recreate_per_session',
      p_reason => 'QA cancel and recreate per session',
      p_idempotency_key => 'qa-recreate-' || v_series_id::text,
      p_expected_appointment_ids => v_expected_ids,
      p_action_origin => 'qa_terminal'
    );
    v_operation_id := (v_result ->> 'operationId')::uuid;

    select count(*) into v_count
    from public.package_financial_adjustment_outbox
    where operation_id = v_operation_id
      and task_type in ('cancel_charge', 'cancel_financial_entry');
    if v_count <> 4 then raise exception 'QA expected 4 cancellation tasks'; end if;

    select count(*) into v_count
    from public.package_financial_adjustment_outbox
    where operation_id = v_operation_id
      and task_type = 'create_per_session_charge'
      and status = 'blocked'
      and depends_on_idempotency_key is not null;
    if v_count <> 4 then raise exception 'QA expected 4 dependent per-session charges'; end if;

    raise exception 'QA_RECREATE_SUBTRANSACTION_ROLLBACK';
  exception
    when raise_exception then
      if sqlerrm <> 'QA_RECREATE_SUBTRANSACTION_ROLLBACK' then raise; end if;
  end;

  begin
    v_result := public.execute_package_lifecycle_change_internal(
      p_actor_id => v_professional_id,
      p_source_package_id => v_package_a,
      p_target_package_id => v_package_b,
      p_operation_type => 'replace',
      p_scope => 'all_future',
      p_anchor_appointment_id => null,
      p_financial_strategy => 'cancel_and_create_single',
      p_reason => 'QA cancel and create one package charge',
      p_idempotency_key => 'qa-single-' || v_series_id::text,
      p_expected_appointment_ids => v_expected_ids,
      p_action_origin => 'qa_terminal'
    );
    v_operation_id := (v_result ->> 'operationId')::uuid;

    select count(*) into v_count
    from public.package_financial_adjustment_outbox
    where operation_id = v_operation_id
      and task_type in ('cancel_charge', 'cancel_financial_entry');
    if v_count <> 4 then raise exception 'QA expected 4 cancellations before one package charge'; end if;

    select count(*) into v_count
    from public.package_financial_adjustment_outbox
    where operation_id = v_operation_id
      and task_type = 'create_package_charge'
      and status = 'blocked';
    if v_count <> 1 then raise exception 'QA expected exactly one blocked package charge'; end if;

    raise exception 'QA_SINGLE_SUBTRANSACTION_ROLLBACK';
  exception
    when raise_exception then
      if sqlerrm <> 'QA_SINGLE_SUBTRANSACTION_ROLLBACK' then raise; end if;
  end;

  v_result := public.execute_package_lifecycle_change_internal(
    p_actor_id => v_professional_id,
    p_source_package_id => v_package_a,
    p_target_package_id => v_package_b,
    p_operation_type => 'replace',
    p_scope => 'all_future',
    p_anchor_appointment_id => null,
    p_financial_strategy => 'keep_existing',
    p_reason => 'QA controlled partial package replacement',
    p_idempotency_key => 'qa-replace-' || v_series_id::text,
    p_expected_appointment_ids => v_expected_ids,
    p_action_origin => 'qa_terminal'
  );

  v_operation_id := (v_result ->> 'operationId')::uuid;
  if v_operation_id is null or (v_result ->> 'status') <> 'completed' then
    raise exception 'QA replacement did not complete: %', v_result;
  end if;

  v_replay := public.execute_package_lifecycle_change_internal(
    p_actor_id => v_professional_id,
    p_source_package_id => v_package_a,
    p_target_package_id => v_package_b,
    p_operation_type => 'replace',
    p_scope => 'all_future',
    p_anchor_appointment_id => null,
    p_financial_strategy => 'keep_existing',
    p_reason => 'QA controlled partial package replacement',
    p_idempotency_key => 'qa-replace-' || v_series_id::text,
    p_expected_appointment_ids => v_expected_ids,
    p_action_origin => 'qa_terminal'
  );
  if not coalesce((v_replay ->> 'idempotentReplay')::boolean, false)
    or (v_replay ->> 'operationId')::uuid <> v_operation_id
  then
    raise exception 'QA idempotent replay failed';
  end if;

  select count(*) into v_count
  from public.appointment_package_bindings
  where package_id = v_package_a and status = 'consumed';
  if v_count <> 2 then raise exception 'QA historical bindings changed'; end if;

  select count(*) into v_count
  from public.appointment_package_bindings
  where package_id = v_package_a and status = 'replaced';
  if v_count <> 4 then raise exception 'QA source future bindings not replaced'; end if;

  select count(*) into v_count
  from public.appointment_package_bindings
  where package_id = v_package_b and status = 'reserved';
  if v_count <> 4 then raise exception 'QA target did not receive exactly 4 reservations'; end if;

  select count(*) into v_count
  from public.patient_package_session_usages usage
  where usage.package_id = v_package_a
    and usage.action = 'release'
    and usage.idempotency_key like 'qa-replace-%';
  if v_count <> 4 then raise exception 'QA expected exactly 4 source releases'; end if;

  select count(*) into v_count
  from public.patient_package_session_usages usage
  where usage.package_id = v_package_b
    and usage.action = 'reserve'
    and usage.idempotency_key like 'qa-replace-%';
  if v_count <> 4 then raise exception 'QA expected exactly 4 target reserves'; end if;

  select count(*) into v_count
  from public.patient_packages package
  where package.id = v_package_a
    and package.sessions_used = 2
    and package.sessions_reserved = 0
    and package.package_status = 'replaced'
    and package.replaced_by_package_id = v_package_b
    and package.ended_at is not null;
  if v_count <> 1 then raise exception 'QA source package final state is invalid'; end if;

  select count(*) into v_count
  from public.patient_packages package
  where package.id = v_package_b
    and package.sessions_used = 0
    and package.sessions_reserved = 4
    and package.package_status = 'active';
  if v_count <> 1 then raise exception 'QA target package final state is invalid'; end if;

  select count(*) into v_count
  from public.appointments appointment
  where appointment.id = any(v_appointment_ids[1:2])
    and appointment.package_id = v_package_a;
  if v_count <> 2 then raise exception 'QA completed appointments moved package'; end if;

  select count(*) into v_count
  from public.appointments appointment
  where appointment.id = any(v_expected_ids)
    and appointment.package_id = v_package_b;
  if v_count <> 4 then raise exception 'QA future appointment bridge not updated'; end if;

  select count(*) into v_count
  from public.appointment_financial_coverages coverage
  where coverage.package_id = v_package_a
    and coverage.appointment_id = any(v_expected_ids)
    and coverage.status = 'replaced';
  if v_count <> 4 then raise exception 'QA old charge coverages not preserved as history'; end if;

  select count(*) into v_count
  from public.appointment_financial_coverages coverage
  where coverage.package_id = v_package_b
    and coverage.appointment_id = any(v_expected_ids)
    and coverage.status = 'active';
  if v_count <> 4 then raise exception 'QA pending charges were not re-covered by package B'; end if;

  select count(*) into v_count
  from public.package_financial_adjustment_outbox
  where operation_id = v_operation_id;
  if v_count <> 0 then raise exception 'QA keep-existing unexpectedly created provider work'; end if;

  select count(*) into v_count
  from public.appointment_events event
  where event.appointment_id = any(v_expected_ids)
    and event.event_type in (
      'package_reservation_released',
      'package_replacement_linked',
      'future_charges_preserved'
    );
  if v_count < 12 then raise exception 'QA expected human timeline events'; end if;

  if exists (
    select 1 from pg_trigger
    where tgname = 'tr_sync_package_sessions' and not tgisinternal
  ) or to_regprocedure('public.sync_package_sessions()') is not null then
    raise exception 'QA legacy package trigger/function still exists';
  end if;
end;
$qa$;

rollback;
