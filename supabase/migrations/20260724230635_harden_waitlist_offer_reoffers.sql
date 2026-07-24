-- A waitlist offer is a one-time capability. Keep its token write-only: a
-- retry can confirm that an offer exists, but can never reconstruct its link.
-- New intentional offers receive a fresh client idempotency key.

create or replace function private.prepare_waitlist_offer_core(
  p_professional_id uuid,
  p_entry_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_idempotency_key text,
  p_actor_type text default 'professional'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_entry public.professional_waitlist_entries%rowtype;
  v_hold public.appointment_slot_holds%rowtype;
  v_offer public.professional_waitlist_offers%rowtype;
  v_existing_hold public.appointment_slot_holds%rowtype;
  v_existing_offer public.professional_waitlist_offers%rowtype;
  v_pending_offer public.professional_waitlist_offers%rowtype;
  v_token text;
  v_expires_at timestamptz;
  v_matches jsonb;
begin
  if nullif(btrim(p_idempotency_key), '') is null
    or char_length(p_idempotency_key) not between 8 and 240
  then
    raise exception 'Uma chave de confirmação válida é obrigatória.' using errcode = '22023';
  end if;

  if p_starts_at <= now() or p_ends_at <= p_starts_at then
    raise exception 'A oferta precisa apontar para um horário futuro válido.' using errcode = '22023';
  end if;

  select entry.* into v_entry
  from public.professional_waitlist_entries entry
  where entry.id = p_entry_id
    and entry.professional_id = p_professional_id
    and entry.status in ('active', 'offered')
  for update;

  if not found then
    raise exception 'Entrada da lista de espera não encontrada.' using errcode = 'P0002';
  end if;

  -- Serialize offers for one professional. This preserves the existing
  -- availability check while keeping the transaction free of external work.
  perform pg_advisory_xact_lock(hashtextextended('appointments:' || p_professional_id::text, 0));

  update public.appointment_slot_holds
  set status = 'expired', released_at = now()
  where professional_id = p_professional_id
    and status = 'active'
    and expires_at <= now();

  update public.professional_waitlist_offers
  set status = 'expired', responded_at = now()
  where professional_id = p_professional_id
    and status = 'pending'
    and expires_at <= now();

  -- Repeating the same request is idempotent only while its hold and offer
  -- remain active. Do not return the token or response path here: both are
  -- write-only capabilities issued exactly once.
  select hold.* into v_existing_hold
  from public.appointment_slot_holds hold
  where hold.professional_id = p_professional_id
    and hold.idempotency_key = p_idempotency_key;

  if found then
    if v_existing_hold.waitlist_entry_id is distinct from v_entry.id
      or v_existing_hold.starts_at is distinct from p_starts_at
      or v_existing_hold.ends_at is distinct from p_ends_at
    then
      raise exception 'Esta confirmação pertence a outra oferta.' using errcode = '22023';
    end if;

    select offer.* into v_existing_offer
    from public.professional_waitlist_offers offer
    where offer.hold_id = v_existing_hold.id;

    if found
      and v_existing_hold.status = 'active'
      and v_existing_hold.expires_at > now()
      and v_existing_offer.status = 'pending'
      and v_existing_offer.expires_at > now()
    then
      return jsonb_build_object(
        'success', true,
        'idempotent', true,
        'linkAvailable', false,
        'offerId', v_existing_offer.id,
        'holdId', v_existing_hold.id,
        'startsAt', v_existing_offer.offered_start_time,
        'endsAt', v_existing_offer.offered_end_time,
        'expiresAt', v_existing_offer.expires_at
      );
    end if;

    return jsonb_build_object(
      'success', false,
      'reofferRequired', true,
      'offerId', v_existing_offer.id,
      'startsAt', v_existing_hold.starts_at,
      'endsAt', v_existing_hold.ends_at
    );
  end if;

  -- A second click with a fresh key must not create another active invitation.
  -- The current pending offer remains the source of truth until the patient
  -- declines, it expires, or the professional explicitly changes its status.
  select offer.* into v_pending_offer
  from public.professional_waitlist_offers offer
  join public.appointment_slot_holds hold on hold.id = offer.hold_id
  where offer.professional_id = p_professional_id
    and offer.waitlist_entry_id = v_entry.id
    and offer.status = 'pending'
    and offer.expires_at > now()
    and hold.status = 'active'
    and hold.expires_at > now()
  order by offer.created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'success', true,
      'alreadyOffered', true,
      'linkAvailable', false,
      'offerId', v_pending_offer.id,
      'startsAt', v_pending_offer.offered_start_time,
      'endsAt', v_pending_offer.offered_end_time,
      'expiresAt', v_pending_offer.expires_at
    );
  end if;

  -- An expired or terminal offer can leave the entry in its historical
  -- "offered" state. Restore it before asking the active-entry matcher for a
  -- genuinely new offer, otherwise a valid reoffer would be rejected.
  if v_entry.status = 'offered' then
    update public.professional_waitlist_entries
    set status = 'active', updated_at = now()
    where id = v_entry.id
    returning * into v_entry;
  end if;

  -- The matcher deliberately lists only active entries. Validate a new offer
  -- after the pending-offer branch, so an offered entry can safely report its
  -- existing invitation instead of failing this unrelated validation.
  v_matches := private.match_professional_waitlist_slot(
    p_professional_id,
    p_starts_at,
    p_ends_at,
    v_entry.modality
  );

  if not exists (
    select 1
    from jsonb_array_elements(v_matches) item
    where item ->> 'entryId' = p_entry_id::text
  ) then
    raise exception 'O horário não atende às regras desta entrada.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.appointments appointment
    where appointment.user_id = p_professional_id
      and appointment.start_time is not null
      and appointment.end_time is not null
      and lower(coalesce(appointment.status, '')) not in ('cancelled', 'canceled')
      and appointment.lifecycle_status <> 'cancelled'
      and tstzrange(appointment.start_time, appointment.end_time, '[)')
        && tstzrange(p_starts_at, p_ends_at, '[)')
  ) or exists (
    select 1
    from public.appointment_slot_holds hold
    where hold.professional_id = p_professional_id
      and hold.status = 'active'
      and hold.expires_at > now()
      and tstzrange(hold.starts_at, hold.ends_at, '[)')
        && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    raise exception 'O horário já foi ocupado ou reservado.' using errcode = '23P01';
  end if;

  v_expires_at := least(now() + interval '2 hours', p_starts_at);
  v_token := encode(gen_random_bytes(32), 'hex');

  insert into public.appointment_slot_holds (
    professional_id,
    patient_id,
    waitlist_entry_id,
    starts_at,
    ends_at,
    expires_at,
    idempotency_key
  ) values (
    p_professional_id,
    v_entry.patient_id,
    v_entry.id,
    p_starts_at,
    p_ends_at,
    v_expires_at,
    p_idempotency_key
  ) returning * into v_hold;

  insert into public.professional_waitlist_offers (
    professional_id,
    waitlist_entry_id,
    hold_id,
    patient_id,
    token_hash,
    offered_start_time,
    offered_end_time,
    expires_at
  ) values (
    p_professional_id,
    v_entry.id,
    v_hold.id,
    v_entry.patient_id,
    encode(digest(v_token, 'sha256'), 'hex'),
    p_starts_at,
    p_ends_at,
    v_expires_at
  ) returning * into v_offer;

  update public.professional_waitlist_entries
  set status = 'offered',
      offer_count = offer_count + 1,
      last_offered_at = now(),
      updated_at = now()
  where id = v_entry.id;

  insert into public.professional_waitlist_events (
    professional_id,
    waitlist_entry_id,
    offer_id,
    event_type,
    actor_type,
    safe_metadata
  ) values (
    p_professional_id,
    v_entry.id,
    v_offer.id,
    'offer_created',
    p_actor_type,
    jsonb_build_object('startsAt', p_starts_at, 'endsAt', p_ends_at, 'expiresAt', v_expires_at)
  );

  insert into public.professional_waitlist_offer_outbox (
    professional_id,
    offer_id,
    payload,
    idempotency_key
  ) values (
    p_professional_id,
    v_offer.id,
    jsonb_build_object(
      'patientId', v_entry.patient_id,
      'startsAt', p_starts_at,
      'endsAt', p_ends_at,
      'expiresAt', v_expires_at,
      'responsePath', '/lista-de-espera/oferta?token=' || v_token
    ),
    'waitlist-offer:' || v_offer.id::text
  );

  return jsonb_build_object(
    'success', true,
    'offerId', v_offer.id,
    'holdId', v_hold.id,
    'token', v_token,
    'startsAt', p_starts_at,
    'endsAt', p_ends_at,
    'expiresAt', v_expires_at,
    'responsePath', '/lista-de-espera/oferta?token=' || v_token
  );
end;
$$;

revoke all on function private.prepare_waitlist_offer_core(uuid, uuid, timestamptz, timestamptz, text, text)
  from public, anon, authenticated;

notify pgrst, 'reload schema';
