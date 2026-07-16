-- Appointment visual archive, safe professional actions and patient-record history.
-- Physical deletion remains prohibited by the lifecycle migration.

alter table public.appointments
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id),
  add column if not exists archive_reason text,
  add column if not exists visibility_status text not null default 'visible',
  add column if not exists archive_origin text;

alter table public.appointments
  drop constraint if exists appointments_visibility_status_check,
  add constraint appointments_visibility_status_check
    check (visibility_status in ('visible', 'archived')),
  drop constraint if exists appointments_archive_consistency_check,
  add constraint appointments_archive_consistency_check
    check (
      (visibility_status = 'visible' and archived_at is null)
      or (visibility_status = 'archived' and archived_at is not null)
    );

create index if not exists appointments_visible_calendar_idx
  on public.appointments (user_id, start_time)
  where visibility_status = 'visible' and archived_at is null;

create index if not exists appointments_patient_history_idx
  on public.appointments (user_id, patient_id, start_time desc);

comment on column public.appointments.archived_at is
  'Visual archive timestamp. The appointment and every historical relationship remain stored.';
comment on column public.appointments.visibility_status is
  'Controls calendar visibility only; never represents physical deletion.';

create table if not exists public.appointment_professional_action_operations (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id),
  psychologist_id uuid not null references auth.users(id),
  action text not null check (action in ('cancel', 'archive')),
  reason text not null check (char_length(btrim(reason)) between 3 and 1000),
  idempotency_key text not null,
  request_fingerprint text not null,
  status text not null default 'completed' check (status in ('completed', 'blocked')),
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (psychologist_id, idempotency_key)
);

alter table public.appointment_professional_action_operations enable row level security;
revoke all on table public.appointment_professional_action_operations from public, anon, authenticated;
grant all on table public.appointment_professional_action_operations to service_role;

drop trigger if exists appointment_professional_action_operations_immutable
  on public.appointment_professional_action_operations;
create trigger appointment_professional_action_operations_immutable
before update or delete on public.appointment_professional_action_operations
for each row execute function private.reject_immutable_appointment_policy_mutation();

-- Extend the database-owned-field guard with one narrowly scoped professional
-- command. Existing protections are intentionally preserved verbatim.
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
      'professional_appointment_action'
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

create or replace function private.human_appointment_status(p_status text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'created' then 'Criado'
    when 'invitation_sent' then 'Convite enviado'
    when 'awaiting_confirmation' then 'Aguardando confirmação'
    when 'awaiting_reconfirmation' then 'Aguardando nova confirmação'
    when 'confirmed' then 'Confirmado pelo paciente'
    when 'cancellation_requested' then 'Cancelamento solicitado'
    when 'cancelled' then 'Cancelado'
    when 'reschedule_requested' then 'Reagendamento solicitado'
    when 'reschedule_approved' then 'Reagendamento aprovado'
    when 'reschedule_rejected' then 'Reagendamento recusado'
    when 'professional_response_overdue' then 'Resposta profissional em atraso'
    when 'in_progress' then 'Em atendimento'
    when 'completed' then 'Realizado'
    when 'closed' then 'Encerrado'
    else 'Situação atualizada'
  end;
$$;

create or replace function private.human_appointment_event(p_event_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_event_type
    when 'appointment_created' then 'Agendamento criado'
    when 'invitation_sent' then 'Convite enviado por e-mail'
    when 'awaiting_confirmation' then 'Aguardando confirmação'
    when 'appointment_reconfirmation_required' then 'Agendamento alterado; nova confirmação solicitada'
    when 'invitation_opened' then 'Paciente abriu o convite'
    when 'patient_confirmed' then 'Paciente confirmou'
    when 'cancellation_requested' then 'Cancelamento solicitado'
    when 'patient_cancelled' then 'Paciente cancelou'
    when 'appointment_cancelled' then 'Agendamento cancelado pelo profissional'
    when 'appointment_archived' then 'Removido apenas da agenda'
    when 'patient_requested_reschedule' then 'Paciente solicitou reagendamento'
    when 'psychologist_approved_reschedule' then 'Reagendamento aprovado'
    when 'psychologist_rejected_reschedule' then 'Reagendamento recusado'
    when 'appointment_rescheduled' then 'Data oficial atualizada'
    when 'clinical_status_changed' then 'Situação clínica atualizada'
    when 'consultation_started' then 'Consulta iniciada'
    when 'consultation_completed' then 'Consulta realizada'
    when 'consultation_closed' then 'Consulta encerrada'
    when 'patient_reaction_window_expired' then 'Prazo de resposta do paciente encerrado'
    when 'financial_entry_created' then 'Cobrança criada'
    when 'financial_launch_created' then 'Lançamento financeiro criado'
    when 'charge_created' then 'Cobrança vinculada'
    when 'charge_cancelled' then 'Cobrança cancelada'
    when 'boleto_generated' then 'Boleto gerado'
    when 'boleto_viewed' then 'Paciente visualizou o boleto'
    when 'charge_viewed' then 'Paciente visualizou a cobrança'
    when 'pix_generated' then 'Pix gerado'
    when 'payment_paid' then 'Cobrança paga'
    when 'payment_overdue' then 'Cobrança vencida'
    when 'payment_expired' then 'Cobrança expirada'
    when 'payment_failed' then 'Falha na cobrança'
    when 'payment_refunded' then 'Pagamento estornado'
    when 'package_session_linked' then 'Sessão vinculada ao pacote'
    when 'package_sessions_reserved' then 'Sessão reservada no pacote'
    when 'package_session_consumed' then 'Sessão consumida do pacote'
    when 'package_reservation_released' then 'Reserva do pacote liberada'
    when 'package_session_reversed' then 'Consumo do pacote estornado'
    when 'package_replacement_linked' then 'Novo pacote vinculado às sessões futuras'
    when 'package_ended_partial' then 'Pacote encerrado após uso parcial'
    when 'future_charges_preserved' then 'Cobranças futuras mantidas'
    when 'charge_cancellation_requested' then 'Cancelamento de cobrança solicitado'
    when 'new_charges_prepared' then 'Novas cobranças preparadas'
    when 'financial_adjustment_review' then 'Ajuste financeiro aguardando revisão'
    when 'cancellation_email_sent' then 'E-mail de cancelamento enviado'
    when 'reschedule_approved_email_sent' then 'Novo horário enviado ao paciente'
    when 'reschedule_rejected_email_sent' then 'Recusa enviada ao paciente'
    when 'reschedule_decision_email_failed' then 'Falha ao enviar a decisão por e-mail'
    when 'reschedule_decision_email_skipped' then 'Decisão registrada sem envio de e-mail'
    when 'appointment_policy_changed_for_future_occurrence' then 'Política da consulta futura atualizada'
    else 'Atualização do agendamento'
  end;
$$;

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
    private.human_appointment_event(event.event_type),
    case
      when event.actor_type = 'patient' then coalesce(
        nullif(btrim(patient.social_name), ''), nullif(btrim(patient.name), ''), 'Paciente'
      )
      when event.actor_type = 'psychologist' then coalesce(
        nullif(btrim(profile.full_name), ''),
        nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
        nullif(btrim(profile.name), ''), 'Psicólogo responsável'
      )
      else 'NeuroNex'
    end,
    case event.action_origin
      when 'public_appointment' then 'Link seguro do paciente'
      when 'professional_app' then 'Painel da NeuroNex'
      when 'email_delivery' then 'Automação de e-mail'
      when 'patient_portal' then 'Portal do paciente'
      when 'google_calendar' then 'Google Agenda'
      when 'synapse' then 'Synapse'
      when 'provider_webhook' then 'Integração financeira segura'
      when 'teleconsultation' then 'Teleconsulta NeuroNex'
      else 'Automação da NeuroNex'
    end,
    event.created_at,
    case
      when event.from_status is null and event.to_status is null then null
      when event.from_status is not distinct from event.to_status then null
      when event.from_status is null then 'Situação atual: ' || private.human_appointment_status(event.to_status)
      when event.to_status is null then 'Situação anterior: ' || private.human_appointment_status(event.from_status)
      else private.human_appointment_status(event.from_status) || ' → ' || private.human_appointment_status(event.to_status)
    end,
    case event.event_type
      when 'invitation_opened' then 'O link seguro da consulta foi acessado.'
      when 'appointment_reconfirmation_required' then 'Os detalhes mudaram e o paciente precisa confirmar esta nova versão.'
      when 'patient_requested_reschedule' then 'A solicitação aguarda análise do profissional.'
      when 'psychologist_approved_reschedule' then 'O novo horário solicitado foi aceito.'
      when 'psychologist_rejected_reschedule' then 'O horário original foi mantido.'
      when 'appointment_rescheduled' then 'O novo horário passou a ser o horário oficial.'
      when 'appointment_archived' then coalesce(nullif(btrim(event.metadata ->> 'reason'), ''), 'O registro continua disponível no prontuário.')
      when 'appointment_cancelled' then coalesce(nullif(btrim(event.metadata ->> 'reason'), ''), 'O cancelamento foi registrado sem apagar o histórico.')
      when 'package_sessions_reserved' then 'A sessão foi reservada sem consumir saldo realizado.'
      when 'package_session_consumed' then 'O consumo foi registrado para esta ocorrência.'
      when 'package_reservation_released' then 'A reserva futura foi liberada sem alterar sessões realizadas.'
      when 'package_replacement_linked' then 'A ocorrência futura passou a ser coberta pelo novo pacote.'
      when 'package_ended_partial' then 'Sessões realizadas, pagamentos e documentos anteriores foram preservados.'
      else null
    end,
    case
      when event.event_type like '%email%' or event.event_type like '%invitation%' then 'email'
      when event.event_type like '%cancel%' then 'cancel'
      when event.event_type like '%archive%' then 'archive'
      when event.event_type like '%reschedule%' then 'reschedule'
      when event.event_type ~ '(payment|financial|charge|pix|boleto|package)' then 'financial'
      when event.event_type ~ '(confirm|completed|closed|approved)' then 'success'
      else 'default'
    end
  from public.appointment_events event
  join public.appointments appointment on appointment.id = event.appointment_id
  left join public.patients patient on patient.id = event.patient_id
  left join public.profiles profile on profile.id = event.psychologist_id
  where event.appointment_id = p_appointment_id
    and appointment.user_id = auth.uid()
  order by event.created_at desc, event.id desc;
end;
$$;

revoke all on function public.get_safe_appointment_timeline(uuid) from public, anon;
grant execute on function public.get_safe_appointment_timeline(uuid) to authenticated;

create or replace function private.preview_professional_appointment_action(
  p_appointment_id uuid,
  p_action text,
  p_psychologist_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_appointment public.appointments%rowtype;
  v_blockers text[] := array[]::text[];
  v_warnings text[] := array[]::text[];
  v_binding_count integer := 0;
  v_financial_count integer := 0;
  v_payment_count integer := 0;
  v_nfse_count integer := 0;
  v_clinical_count integer := 0;
begin
  if p_action not in ('cancel', 'archive') then
    raise exception 'Unsupported appointment action';
  end if;

  select * into v_appointment
  from public.appointments appointment
  where appointment.id = p_appointment_id
    and appointment.user_id = p_psychologist_id;

  if not found then
    raise exception 'Appointment not found for this professional';
  end if;

  select count(*) into v_binding_count
  from public.appointment_package_bindings binding
  where binding.appointment_id = v_appointment.id
    and binding.status in ('reserved', 'consumed');

  select count(*) into v_financial_count
  from public.financial_entries entry
  where entry.appointment_id = v_appointment.id
    and entry.status <> 'cancelled';

  select count(*) into v_payment_count
  from public.nb_payments_safe_v payment
  where payment.appointment_id = v_appointment.id
     or (v_appointment.charge_id is not null and payment.id = v_appointment.charge_id);

  select count(*) into v_nfse_count
  from public.nb_payments_safe_v payment
  where (payment.appointment_id = v_appointment.id
      or (v_appointment.charge_id is not null and payment.id = v_appointment.charge_id))
    and (payment.nfse_reference is not null or payment.nfse_status is not null);

  select count(*) into v_clinical_count
  from public.session_notes note
  where note.appointment_id = v_appointment.id;

  if p_action = 'archive' then
    if v_appointment.archived_at is not null then
      v_blockers := array_append(v_blockers, 'Este agendamento já foi removido da agenda.');
    end if;
    if v_financial_count + v_payment_count > 0 then
      v_warnings := array_append(v_warnings, 'Cobranças e pagamentos continuarão preservados no prontuário.');
    end if;
    if v_nfse_count > 0 then
      v_warnings := array_append(v_warnings, 'Documentos fiscais continuarão vinculados a esta sessão.');
    end if;
    if v_clinical_count > 0 then
      v_warnings := array_append(v_warnings, 'Registros clínicos continuarão disponíveis no histórico completo.');
    end if;
  else
    if v_appointment.lifecycle_status in ('cancelled', 'in_progress', 'completed', 'closed')
      or lower(coalesce(v_appointment.status, '')) in ('cancelled', 'cancelled_by_patient', 'cancelled_by_professional', 'attended', 'completed')
    then
      v_blockers := array_append(v_blockers, 'O estado atual não permite cancelamento direto.');
    end if;
    if v_appointment.patient_right_status in ('request_pending', 'reaction_window', 'financially_protected', 'disputed')
      or exists (
        select 1 from public.appointment_reschedule_requests request_row
        where request_row.appointment_id = v_appointment.id and request_row.status = 'pending'
      )
    then
      v_blockers := array_append(v_blockers, 'Existe uma solicitação ou direito do paciente aguardando resolução.');
    end if;
    if v_binding_count > 0 or v_appointment.package_id is not null then
      v_blockers := array_append(v_blockers, 'A sessão possui cobertura de pacote e exige o motor de impacto financeiro.');
    end if;
    if v_financial_count > 0 or v_payment_count > 0
      or v_appointment.financial_entry_id is not null or v_appointment.charge_id is not null
    then
      v_blockers := array_append(v_blockers, 'A sessão possui cobrança ou lançamento e exige revisão financeira antes do cancelamento.');
    end if;
    if v_nfse_count > 0 then
      v_blockers := array_append(v_blockers, 'Existe situação fiscal vinculada que impede cancelamento automático.');
    end if;
    if v_clinical_count > 0 then
      v_blockers := array_append(v_blockers, 'Existe registro clínico vinculado; use revisão de resultado para corrigir o desfecho.');
    end if;
  end if;

  return jsonb_build_object(
    'action', p_action,
    'actionLabel', case p_action when 'archive' then 'Remover da agenda' else 'Cancelar agendamento' end,
    'canExecute', cardinality(v_blockers) = 0,
    'appointmentDate', v_appointment.start_time,
    'currentStatus', private.human_appointment_status(v_appointment.lifecycle_status),
    'warnings', to_jsonb(v_warnings),
    'blockers', to_jsonb(v_blockers),
    'preserved', jsonb_build_object(
      'history', true,
      'packageLinks', v_binding_count,
      'financialRecords', v_financial_count + v_payment_count,
      'fiscalDocuments', v_nfse_count,
      'clinicalRecords', v_clinical_count
    )
  );
end;
$$;

revoke all on function private.preview_professional_appointment_action(uuid, text, uuid)
  from public, anon, authenticated;

create or replace function public.preview_professional_appointment_action(
  p_appointment_id uuid,
  p_action text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  return private.preview_professional_appointment_action(p_appointment_id, p_action, auth.uid());
end;
$$;

revoke all on function public.preview_professional_appointment_action(uuid, text) from public, anon;
grant execute on function public.preview_professional_appointment_action(uuid, text) to authenticated;

create or replace function public.execute_professional_appointment_action(
  p_appointment_id uuid,
  p_action text,
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
  v_appointment public.appointments%rowtype;
  v_existing public.appointment_professional_action_operations%rowtype;
  v_preview jsonb;
  v_result jsonb;
  v_fingerprint text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_action not in ('cancel', 'archive') then raise exception 'Unsupported appointment action'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'A reason is required'; end if;
  if char_length(btrim(coalesce(p_idempotency_key, ''))) < 12 then raise exception 'A valid idempotency key is required'; end if;

  perform pg_advisory_xact_lock(hashtextextended('appointment:' || p_appointment_id::text, 0));

  select * into v_appointment
  from public.appointments appointment
  where appointment.id = p_appointment_id and appointment.user_id = v_user_id
  for update;
  if not found then raise exception 'Appointment not found for this professional'; end if;

  v_fingerprint := md5(p_appointment_id::text || '|' || p_action || '|' || btrim(p_reason));
  select * into v_existing
  from public.appointment_professional_action_operations operation
  where operation.psychologist_id = v_user_id
    and operation.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.appointment_id <> p_appointment_id
      or v_existing.action <> p_action
      or v_existing.request_fingerprint <> v_fingerprint
    then
      raise exception 'Idempotency key was already used for another request';
    end if;
    return v_existing.result || jsonb_build_object('idempotentReplay', true);
  end if;

  v_preview := private.preview_professional_appointment_action(p_appointment_id, p_action, v_user_id);
  if not coalesce((v_preview ->> 'canExecute')::boolean, false) then
    raise exception 'Appointment action blocked: %', coalesce(v_preview #>> '{blockers,0}', 'review required');
  end if;

  if p_action = 'archive' then
    perform set_config('neuronex.appointment_command', 'archive_appointment', true);
    update public.appointments
    set archived_at = now(),
        archived_by = v_user_id,
        archive_reason = btrim(p_reason),
        visibility_status = 'archived',
        archive_origin = 'professional_app',
        updated_by = v_user_id,
        action_origin = 'professional_app',
        last_actor_type = 'psychologist'
    where id = v_appointment.id;

    insert into public.appointment_events (
      appointment_id, psychologist_id, patient_id, event_type,
      actor_type, actor_user_id, action_origin, from_status, to_status,
      metadata, idempotency_key
    ) values (
      v_appointment.id, v_user_id, v_appointment.patient_id, 'appointment_archived',
      'psychologist', v_user_id, 'professional_app',
      v_appointment.lifecycle_status, v_appointment.lifecycle_status,
      jsonb_build_object('reason', btrim(p_reason), 'historyPreserved', true),
      p_idempotency_key || ':event'
    );
  else
    perform set_config('neuronex.appointment_command', 'professional_appointment_action', true);
    update public.appointments
    set status = 'cancelled_by_professional',
        lifecycle_status = 'cancelled',
        cancelled_at = now(),
        cancellation_reason = btrim(p_reason),
        clinical_outcome = 'cancelled',
        financial_outcome = 'no_consequence',
        updated_by = v_user_id,
        action_origin = 'professional_app',
        last_actor_type = 'psychologist'
    where id = v_appointment.id;

    update public.appointment_confirmation_tokens
    set status = 'revoked', revoked_at = coalesce(revoked_at, now())
    where appointment_id = v_appointment.id
      and revoked_at is null
      and used_at is null;

    insert into public.appointment_events (
      appointment_id, psychologist_id, patient_id, event_type,
      actor_type, actor_user_id, action_origin, from_status, to_status,
      metadata, idempotency_key
    ) values (
      v_appointment.id, v_user_id, v_appointment.patient_id, 'appointment_cancelled',
      'psychologist', v_user_id, 'professional_app',
      v_appointment.lifecycle_status, 'cancelled',
      jsonb_build_object('reason', btrim(p_reason), 'financialConsequence', 'none'),
      p_idempotency_key || ':event'
    );
  end if;

  v_result := jsonb_build_object(
    'success', true,
    'action', p_action,
    'message', case p_action
      when 'archive' then 'Agendamento removido da agenda. O histórico foi preservado.'
      else 'Agendamento cancelado. O histórico foi preservado.'
    end,
    'emailRequired', p_action = 'cancel' and v_appointment.patient_id is not null,
    'idempotentReplay', false
  );

  insert into public.appointment_professional_action_operations (
    appointment_id, psychologist_id, action, reason,
    idempotency_key, request_fingerprint, status, result
  ) values (
    v_appointment.id, v_user_id, p_action, btrim(p_reason),
    p_idempotency_key, v_fingerprint, 'completed', v_result
  );

  return v_result;
end;
$$;

revoke all on function public.execute_professional_appointment_action(uuid, text, text, text)
  from public, anon;
grant execute on function public.execute_professional_appointment_action(uuid, text, text, text)
  to authenticated;

create or replace function private.human_financial_status(p_status text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case lower(coalesce(p_status, ''))
    when 'paid' then 'Pago'
    when 'received' then 'Pago'
    when 'confirmed' then 'Pago'
    when 'pending' then 'Pendente'
    when 'planned' then 'Planejado'
    when 'processing' then 'Processando'
    when 'overdue' then 'Vencido'
    when 'cancelled' then 'Cancelado'
    when 'canceled' then 'Cancelado'
    when 'refunded' then 'Estornado'
    when 'partially_refunded' then 'Parcialmente estornado'
    when 'disputed' then 'Em disputa'
    else null
  end;
$$;

create or replace function public.get_patient_complete_appointment_history(
  p_patient_id uuid,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_appointment public.appointments%rowtype;
  v_items jsonb := '[]'::jsonb;
  v_events jsonb;
  v_package record;
  v_payment record;
  v_entry record;
  v_snapshot record;
  v_teleconsult record;
  v_has_clinical_summary boolean;
  v_total integer;
begin
  if v_user_id is null or not exists (
    select 1 from public.patients patient
    where patient.id = p_patient_id and patient.user_id = v_user_id
  ) then
    raise exception 'Patient record not found for this professional';
  end if;

  select count(*) into v_total
  from public.appointments appointment
  where appointment.user_id = v_user_id
    and appointment.patient_id = p_patient_id;

  for v_appointment in
    select appointment.*
    from public.appointments appointment
    where appointment.user_id = v_user_id
      and appointment.patient_id = p_patient_id
    order by appointment.start_time desc nulls last, appointment.created_at desc
    limit v_limit offset v_offset
  loop
    select coalesce(jsonb_agg(to_jsonb(safe_event) order by safe_event.occurred_at desc), '[]'::jsonb)
      into v_events
    from public.get_safe_appointment_timeline(v_appointment.id) safe_event;

    select package.description, binding.status
      into v_package
    from public.appointment_package_bindings binding
    join public.patient_packages package on package.id = binding.package_id
    where binding.appointment_id = v_appointment.id
    order by binding.bound_at desc
    limit 1;

    select
      private.human_financial_status(payment.normalized_status) as status_label,
      payment.gross_amount,
      private.human_financial_status(payment.nfse_status) as nfse_status_label,
      payment.nfse_number,
      payment.refund_amount
      into v_payment
    from public.nb_payments_safe_v payment
    where payment.appointment_id = v_appointment.id
       or (v_appointment.charge_id is not null and payment.id = v_appointment.charge_id)
    order by payment.created_at desc nulls last
    limit 1;

    select private.human_financial_status(entry.status) as status_label, entry.amount
      into v_entry
    from public.financial_entries entry
    where entry.appointment_id = v_appointment.id
    order by entry.created_at desc
    limit 1;

    select snapshot.free_cancellation_cutoff_at, snapshot.free_reschedule_cutoff_at,
           snapshot.predicted_financial_consequence
      into v_snapshot
    from public.appointment_policy_snapshots snapshot
    where snapshot.appointment_id = v_appointment.id
      and snapshot.appointment_revision = v_appointment.confirmation_revision
    order by snapshot.snapshot_sequence desc
    limit 1;

    select
      case lower(coalesce(session.status, ''))
        when 'active' then 'Em andamento'
        when 'completed' then 'Finalizada'
        when 'ended' then 'Finalizada'
        when 'scheduled' then 'Preparada'
        else 'Vinculada'
      end as status_label
      into v_teleconsult
    from public.teleconsultation_sessions session
    where session.appointment_id = v_appointment.id
    order by session.created_at desc
    limit 1;

    select exists (
      select 1 from public.session_notes note
      where note.appointment_id = v_appointment.id
        and (note.review_status is null or note.review_status in ('confirmed', 'auto_confirmed'))
    ) into v_has_clinical_summary;

    v_items := v_items || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'occurredAt', v_appointment.start_time,
      'endAt', v_appointment.end_time,
      'modality', case
        when lower(coalesce(v_appointment.type, '')) = 'online' then 'Online'
        when lower(coalesce(v_appointment.type, '')) in ('presencial', 'in_person') then 'Presencial'
        else 'Modalidade não informada'
      end,
      'confirmation', case
        when v_appointment.confirmed_revision = v_appointment.confirmation_revision then 'Confirmado pelo paciente'
        when v_appointment.lifecycle_status = 'awaiting_reconfirmation' then 'Aguardando nova confirmação'
        when v_appointment.lifecycle_status in ('awaiting_confirmation', 'invitation_sent') then 'Aguardando confirmação'
        else private.human_appointment_status(v_appointment.lifecycle_status)
      end,
      'lifecycle', private.human_appointment_status(v_appointment.lifecycle_status),
      'attendance', case
        when v_appointment.clinical_outcome = 'attended' then 'Paciente compareceu'
        when v_appointment.clinical_outcome = 'no_show' then 'Não compareceu'
        when v_appointment.clinical_outcome = 'cancelled' then 'Sessão cancelada'
        else null
      end,
      'reason', coalesce(v_appointment.cancellation_reason, v_appointment.archive_reason),
      'reschedules', (
        select count(*) from public.appointment_reschedule_requests request_row
        where request_row.appointment_id = v_appointment.id
      ),
      'policy', case when v_snapshot.free_cancellation_cutoff_at is not null then jsonb_build_object(
        'cancellationDeadline', v_snapshot.free_cancellation_cutoff_at,
        'rescheduleDeadline', v_snapshot.free_reschedule_cutoff_at,
        'consequence', case v_snapshot.predicted_financial_consequence
          when 'no_consequence' then 'Sem consequência dentro do prazo'
          when 'manual_review' then 'Consequência sujeita a revisão'
          when 'credit_consumed' then 'Crédito previsto como consumido'
          when 'charge_kept' then 'Cobrança prevista como mantida'
          else 'Política registrada para esta sessão'
        end
      ) else null end,
      'package', case when v_package.description is not null then jsonb_build_object(
        'name', v_package.description,
        'coverage', case v_package.status
          when 'reserved' then 'Sessão reservada'
          when 'consumed' then 'Sessão consumida'
          when 'released' then 'Reserva liberada'
          when 'replaced' then 'Cobertura substituída'
          when 'reversed' then 'Consumo estornado'
          when 'cancelled' then 'Vínculo cancelado'
          else 'Vínculo registrado'
        end
      ) else null end,
      'financial', case
        when v_payment.status_label is not null then jsonb_build_object(
          'status', v_payment.status_label,
          'amount', round(coalesce(v_payment.gross_amount, 0)::numeric / 100, 2),
          'refundAmount', round(coalesce(v_payment.refund_amount, 0)::numeric / 100, 2)
        )
        when v_entry.status_label is not null then jsonb_build_object(
          'status', v_entry.status_label,
          'amount', abs(v_entry.amount)
        )
        else null
      end,
      'nfse', case when v_payment.nfse_status_label is not null or v_payment.nfse_number is not null then jsonb_build_object(
        'status', coalesce(v_payment.nfse_status_label, 'Registrada'),
        'number', v_payment.nfse_number
      ) else null end,
      'teleconsultation', case when v_teleconsult.status_label is not null then v_teleconsult.status_label else null end,
      'clinicalSummary', case when v_has_clinical_summary then 'Resumo clínico disponível' else null end,
      'archived', v_appointment.archived_at is not null,
      'archiveLabel', case when v_appointment.archived_at is not null then 'Removido apenas da agenda' else null end,
      'events', v_events
    )));
  end loop;

  return jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'hasMore', v_offset + v_limit < v_total,
    'nextOffset', case when v_offset + v_limit < v_total then v_offset + v_limit else null end
  );
end;
$$;

revoke all on function public.get_patient_complete_appointment_history(uuid, integer, integer)
  from public, anon;
grant execute on function public.get_patient_complete_appointment_history(uuid, integer, integer)
  to authenticated;
