begin;

-- Appointment action plans run inside a SECURITY DEFINER command path and are
-- hash-bound to the authenticated professional. The execution core identifies
-- that path with `neuronex.appointment_command = appointment_action_plan`.
-- Keep all existing ownership protections while allowing that canonical
-- command to update database-owned revision/audit fields during rescheduling.
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
      'policy_application', 'outcome_override_request', 'complete_clinical_session',
      'professional_appointment_action', 'appointment_action_plan'
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
    )
  then
    raise exception 'Appointment lifecycle, outcome, patient and financial fields are database-owned';
  end if;

  if v_trusted_command is distinct from 'public_patient_action'
    and v_trusted_command is distinct from 'professional_appointment_action'
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

-- Resolve the vacancy shown in the waitlist confirmation from the same
-- availability, conflict and hold rules enforced by Agenda v2. Returning
-- canonical timestamptz values avoids depending on the browser timezone.
create or replace function public.suggest_professional_waitlist_slot(
  p_entry_id uuid,
  p_search_days integer default 56
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_professional_id uuid := auth.uid();
  v_entry public.professional_waitlist_entries%rowtype;
  v_pending_offer public.professional_waitlist_offers%rowtype;
  v_search_days integer := least(greatest(coalesce(p_search_days, 56), 1), 60);
  v_search_start timestamptz;
  v_search_end timestamptz;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_duration_minutes integer;
begin
  if v_professional_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select entry.* into v_entry
  from public.professional_waitlist_entries entry
  where entry.id = p_entry_id
    and entry.professional_id = v_professional_id
    and entry.status in ('active', 'offered');

  if not found then
    raise exception 'Entrada ativa da lista de espera não encontrada.' using errcode = 'P0002';
  end if;

  select offer.* into v_pending_offer
  from public.professional_waitlist_offers offer
  where offer.waitlist_entry_id = v_entry.id
    and offer.professional_id = v_professional_id
    and offer.status = 'pending'
    and offer.expires_at > now()
    and offer.offered_start_time > now()
    and offer.offered_end_time > offer.offered_start_time
  order by offer.offered_start_time
  limit 1;

  if found then
    return jsonb_build_object(
      'startsAt', v_pending_offer.offered_start_time,
      'endsAt', v_pending_offer.offered_end_time,
      'durationMinutes', round(extract(epoch from (
        v_pending_offer.offered_end_time - v_pending_offer.offered_start_time
      )) / 60),
      'source', 'pending_offer',
      'timezone', 'America/Sao_Paulo'
    );
  end if;

  v_search_start :=
    date_trunc('hour', now())
    + (
      floor(extract(minute from now()) / 5) * 5 + 5
    ) * interval '1 minute';
  v_search_end := now() + make_interval(days => v_search_days);

  with durations as (
    select
      greatest(
        v_entry.preferred_duration_minutes,
        v_entry.minimum_duration_minutes
      ) as minutes,
      0 as duration_penalty
    union all
    select
      v_entry.minimum_duration_minutes as minutes,
      1 as duration_penalty
    where v_entry.minimum_duration_minutes
      <> greatest(
        v_entry.preferred_duration_minutes,
        v_entry.minimum_duration_minutes
      )
  ),
  candidates as (
    select
      slot as starts_at,
      slot + make_interval(mins => duration.minutes) as ends_at,
      duration.minutes,
      duration.duration_penalty
    from durations duration
    cross join lateral generate_series(
      v_search_start,
      v_search_end,
      interval '5 minutes'
    ) slot
    where v_entry.valid_from
        <= (slot at time zone 'America/Sao_Paulo')::date
      and (
        v_entry.valid_until is null
        or v_entry.valid_until
          >= (slot at time zone 'America/Sao_Paulo')::date
      )
      and (slot at time zone 'America/Sao_Paulo')::date
        = (
          (
            slot + make_interval(mins => duration.minutes)
          ) at time zone 'America/Sao_Paulo'
        )::date
      and (
        not exists (
          select 1
          from public.professional_waitlist_windows configured
          where configured.waitlist_entry_id = v_entry.id
        )
        or exists (
          select 1
          from public.professional_waitlist_windows wait_window
          where wait_window.waitlist_entry_id = v_entry.id
            and (
              wait_window.specific_date
                = (slot at time zone 'America/Sao_Paulo')::date
              or wait_window.weekday
                = extract(
                  dow from slot at time zone 'America/Sao_Paulo'
                )::smallint
            )
            and wait_window.start_time
              <= (slot at time zone 'America/Sao_Paulo')::time
            and wait_window.end_time
              >= (
                (
                  slot + make_interval(mins => duration.minutes)
                ) at time zone 'America/Sao_Paulo'
              )::time
        )
      )
      and private.agenda_v2_is_available(
        v_professional_id,
        slot,
        slot + make_interval(mins => duration.minutes),
        v_entry.availability_version_id
      )
      and not exists (
        select 1
        from public.appointments appointment
        where appointment.user_id = v_professional_id
          and appointment.start_time is not null
          and appointment.end_time is not null
          and lower(coalesce(appointment.status, ''))
            not in ('cancelled', 'canceled')
          and coalesce(appointment.lifecycle_status, '') <> 'cancelled'
          and tstzrange(
            appointment.start_time,
            appointment.end_time,
            '[)'
          ) && tstzrange(
            slot,
            slot + make_interval(mins => duration.minutes),
            '[)'
          )
      )
      and not exists (
        select 1
        from public.appointment_slot_holds hold
        where hold.professional_id = v_professional_id
          and hold.status = 'active'
          and hold.expires_at > now()
          and tstzrange(
            hold.starts_at,
            hold.ends_at,
            '[)'
          ) && tstzrange(
            slot,
            slot + make_interval(mins => duration.minutes),
            '[)'
          )
      )
  )
  select
    candidate.starts_at,
    candidate.ends_at,
    candidate.minutes
  into v_starts_at, v_ends_at, v_duration_minutes
  from candidates candidate
  order by
    candidate.duration_penalty,
    candidate.starts_at
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'startsAt', v_starts_at,
    'endsAt', v_ends_at,
    'durationMinutes', v_duration_minutes,
    'source', 'calculated',
    'timezone', 'America/Sao_Paulo'
  );
end;
$$;

revoke all on function public.suggest_professional_waitlist_slot(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.suggest_professional_waitlist_slot(uuid, integer)
  to authenticated;

commit;
