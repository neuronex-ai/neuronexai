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

commit;
