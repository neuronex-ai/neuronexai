-- Keep the waitlist terminal state, the created appointment and the
-- professional feedback in the same transaction. A patient acceptance must
-- never leave a resumable queue entry behind.

create or replace function public.respond_waitlist_offer(
  p_token text,
  p_response text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_offer public.professional_waitlist_offers%rowtype;
  v_hold public.appointment_slot_holds%rowtype;
  v_entry public.professional_waitlist_entries%rowtype;
  v_appointment_id uuid;
begin
  if p_response not in ('accept', 'decline') then
    raise exception 'Resposta inválida.' using errcode = '22023';
  end if;

  if p_token is null or char_length(p_token) <> 64 then
    raise exception 'Oferta inválida ou expirada.' using errcode = '22023';
  end if;

  select offer.* into v_offer
  from public.professional_waitlist_offers offer
  where offer.token_hash = encode(digest(p_token, 'sha256'), 'hex')
  for update;

  if not found then
    raise exception 'Oferta inválida ou expirada.' using errcode = 'P0002';
  end if;

  select hold.* into v_hold
  from public.appointment_slot_holds hold
  where hold.id = v_offer.hold_id
  for update;

  if not found then
    raise exception 'A reserva desta vaga não está mais disponível.' using errcode = '55000';
  end if;

  select entry.* into v_entry
  from public.professional_waitlist_entries entry
  where entry.id = v_offer.waitlist_entry_id
  for update;

  if not found then
    raise exception 'A entrada desta lista de espera não está mais disponível.' using errcode = '55000';
  end if;

  if v_offer.status <> 'pending' or v_hold.status <> 'active' or v_offer.expires_at <= now() then
    update public.professional_waitlist_offers
    set status = case when status = 'pending' then 'expired' else status end,
        responded_at = coalesce(responded_at, now())
    where id = v_offer.id;

    update public.appointment_slot_holds
    set status = case when status = 'active' then 'expired' else status end,
        released_at = coalesce(released_at, now())
    where id = v_hold.id;

    raise exception 'Oferta inválida ou expirada.' using errcode = '55000';
  end if;

  if p_response = 'decline' then
    update public.professional_waitlist_offers
    set status = 'declined', responded_at = now()
    where id = v_offer.id;

    update public.appointment_slot_holds
    set status = 'declined', released_at = now()
    where id = v_hold.id;

    update public.professional_waitlist_entries
    set status = 'active', updated_at = now()
    where id = v_entry.id;

    insert into public.professional_waitlist_events (
      professional_id, waitlist_entry_id, offer_id, event_type, actor_type
    ) values (
      v_offer.professional_id, v_entry.id, v_offer.id, 'offer_declined', 'patient'
    );

    return jsonb_build_object('success', true, 'status', 'declined');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('appointments:' || v_offer.professional_id::text, 0));

  if exists (
    select 1
    from public.appointments appointment
    where appointment.user_id = v_offer.professional_id
      and appointment.start_time is not null
      and appointment.end_time is not null
      and lower(coalesce(appointment.status, '')) not in ('cancelled', 'canceled')
      and appointment.lifecycle_status <> 'cancelled'
      and tstzrange(appointment.start_time, appointment.end_time, '[)')
        && tstzrange(v_offer.offered_start_time, v_offer.offered_end_time, '[)')
  ) then
    update public.professional_waitlist_offers
    set status = 'superseded', responded_at = now()
    where id = v_offer.id;

    update public.appointment_slot_holds
    set status = 'released', released_at = now()
    where id = v_hold.id;

    update public.professional_waitlist_entries
    set status = 'active', updated_at = now()
    where id = v_entry.id;

    raise exception 'O horário acabou de ser ocupado. A oferta foi liberada.' using errcode = '23P01';
  end if;

  insert into public.appointments (
    user_id,
    patient_id,
    start_time,
    end_time,
    type,
    status,
    lifecycle_status,
    visibility_status,
    metadata,
    created_by,
    updated_by,
    action_origin,
    last_actor_type,
    audit_metadata
  ) values (
    v_offer.professional_id,
    v_offer.patient_id,
    v_offer.offered_start_time,
    v_offer.offered_end_time,
    coalesce(v_entry.modality, 'presencial'),
    'unscored',
    'created',
    'visible',
    jsonb_build_object(
      'origin', 'waitlist',
      'waitlistEntryId', v_entry.id,
      'waitlistOfferId', v_offer.id
    ),
    v_offer.professional_id,
    v_offer.professional_id,
    'patient_portal',
    'patient',
    jsonb_build_object('waitlistOfferId', v_offer.id)
  ) returning id into v_appointment_id;

  update public.professional_waitlist_offers
  set status = 'accepted', responded_at = now(), accepted_appointment_id = v_appointment_id
  where id = v_offer.id;

  update public.appointment_slot_holds
  set status = 'accepted', released_at = now()
  where id = v_hold.id;

  update public.professional_waitlist_entries
  set status = 'scheduled', updated_at = now()
  where id = v_entry.id;

  update public.professional_waitlist_offer_outbox
  set status = case when status in ('pending', 'failed') then 'cancelled' else status end
  where offer_id = v_offer.id;

  insert into public.professional_waitlist_events (
    professional_id, waitlist_entry_id, offer_id, event_type, actor_type, safe_metadata
  ) values (
    v_offer.professional_id,
    v_entry.id,
    v_offer.id,
    'offer_accepted',
    'patient',
    jsonb_build_object('appointmentId', v_appointment_id)
  );

  perform public.emit_user_notification(
    p_user_id => v_offer.professional_id,
    p_event_id => 'waitlist-offer-accepted:' || v_offer.id::text,
    p_type => 'waitlist_offer_accepted',
    p_category => 'agenda',
    p_severity => 'success',
    p_title => 'Vaga aceita na lista de espera',
    p_message => 'O paciente aceitou a vaga. O novo agendamento já está disponível na Agenda.',
    p_action_url => '/agenda?appointmentId=' || v_appointment_id::text,
    p_priority => 'high',
    p_data => jsonb_build_object(
      'appointmentId', v_appointment_id,
      'waitlistEntryId', v_entry.id,
      'waitlistOfferId', v_offer.id,
      'sourceModule', 'agenda',
      'requiresAction', true
    ),
    p_payload => jsonb_build_object('origin', 'waitlist'),
    p_organization_id => null
  );

  return jsonb_build_object(
    'success', true,
    'status', 'accepted',
    'appointmentId', v_appointment_id,
    'startTime', v_offer.offered_start_time,
    'endTime', v_offer.offered_end_time
  );
end;
$$;

create or replace function public.set_professional_waitlist_entry_status(
  p_entry_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_professional_id uuid := auth.uid();
  v_requested_status text := lower(coalesce(p_status, ''));
  v_entry public.professional_waitlist_entries%rowtype;
  v_has_accepted_offer boolean := false;
begin
  if v_professional_id is null then
    raise exception 'Autenticação necessária.' using errcode = '42501';
  end if;

  if v_requested_status not in ('active', 'paused', 'removed') then
    raise exception 'Status da lista de espera inválido.' using errcode = '22023';
  end if;

  select entry.* into v_entry
  from public.professional_waitlist_entries entry
  where entry.id = p_entry_id
    and entry.professional_id = v_professional_id
  for update;

  if not found then
    raise exception 'Esta entrada da lista de espera não foi encontrada.' using errcode = 'P0002';
  end if;

  select exists (
    select 1
    from public.professional_waitlist_offers offer
    where offer.waitlist_entry_id = v_entry.id
      and offer.professional_id = v_professional_id
      and offer.status = 'accepted'
      and offer.accepted_appointment_id is not null
  ) into v_has_accepted_offer;

  if v_entry.status = 'scheduled' or v_has_accepted_offer then
    update public.professional_waitlist_entries
    set status = 'scheduled', updated_at = now()
    where id = v_entry.id;

    return jsonb_build_object(
      'success', true,
      'entryId', v_entry.id,
      'status', 'scheduled',
      'message', 'A vaga já foi aceita e o agendamento está confirmado na Agenda.'
    );
  end if;

  if v_entry.status = 'removed' then
    raise exception 'Esta pessoa já foi removida da lista de espera.' using errcode = 'P0002';
  end if;

  if v_requested_status in ('paused', 'removed') then
    update public.appointment_slot_holds
    set status = 'released', released_at = now()
    where waitlist_entry_id = v_entry.id
      and professional_id = v_professional_id
      and status = 'active';

    update public.professional_waitlist_offers
    set status = 'superseded', responded_at = now()
    where waitlist_entry_id = v_entry.id
      and professional_id = v_professional_id
      and status = 'pending';

    update public.professional_waitlist_offer_outbox
    set status = case when status in ('pending', 'failed') then 'cancelled' else status end
    where professional_id = v_professional_id
      and offer_id in (
        select offer.id
        from public.professional_waitlist_offers offer
        where offer.waitlist_entry_id = v_entry.id
      );
  end if;

  update public.professional_waitlist_entries
  set status = v_requested_status, updated_at = now()
  where id = v_entry.id;

  insert into public.professional_waitlist_events (
    professional_id, waitlist_entry_id, event_type, actor_type, safe_metadata
  ) values (
    v_professional_id,
    v_entry.id,
    'entry_status_changed',
    'professional',
    jsonb_build_object(
      'previousStatus', v_entry.status,
      'status', v_requested_status
    )
  );

  return jsonb_build_object(
    'success', true,
    'entryId', v_entry.id,
    'status', v_requested_status
  );
end;
$$;

revoke all on function public.set_professional_waitlist_entry_status(uuid, text)
  from public, anon, authenticated;
grant execute on function public.set_professional_waitlist_entry_status(uuid, text)
  to authenticated;

-- Repair entries already accepted before this feedback loop existed. The
-- update is idempotent and only affects records that are demonstrably linked
-- to an accepted appointment.
update public.professional_waitlist_entries entry
set status = 'scheduled', updated_at = now()
where entry.status in ('active', 'paused', 'offered')
  and exists (
    select 1
    from public.professional_waitlist_offers offer
    where offer.waitlist_entry_id = entry.id
      and offer.status = 'accepted'
      and offer.accepted_appointment_id is not null
  );

-- A successful acceptance is an operational event, not only a row mutation.
-- Backfill the notification once for pre-existing accepted offers as well.
do $$
declare
  v_offer record;
begin
  for v_offer in
    select
      offer.id as offer_id,
      offer.professional_id,
      offer.waitlist_entry_id,
      offer.accepted_appointment_id
    from public.professional_waitlist_offers offer
    where offer.status = 'accepted'
      and offer.accepted_appointment_id is not null
  loop
    perform public.emit_user_notification(
      p_user_id => v_offer.professional_id,
      p_event_id => 'waitlist-offer-accepted:' || v_offer.offer_id::text,
      p_type => 'waitlist_offer_accepted',
      p_category => 'agenda',
      p_severity => 'success',
      p_title => 'Vaga aceita na lista de espera',
      p_message => 'O paciente aceitou a vaga. O novo agendamento já está disponível na Agenda.',
      p_action_url => '/agenda?appointmentId=' || v_offer.accepted_appointment_id::text,
      p_priority => 'high',
      p_data => jsonb_build_object(
        'appointmentId', v_offer.accepted_appointment_id,
        'waitlistEntryId', v_offer.waitlist_entry_id,
        'waitlistOfferId', v_offer.offer_id,
        'sourceModule', 'agenda',
        'requiresAction', true
      ),
      p_payload => jsonb_build_object('origin', 'waitlist'),
      p_organization_id => null
    );
  end loop;
end;
$$;

alter function public.respond_waitlist_offer(text, text)
  set search_path = pg_catalog, extensions;

revoke all on function public.respond_waitlist_offer(text, text)
  from public, anon, authenticated;
grant execute on function public.respond_waitlist_offer(text, text)
  to anon, authenticated;

notify pgrst, 'reload schema';
