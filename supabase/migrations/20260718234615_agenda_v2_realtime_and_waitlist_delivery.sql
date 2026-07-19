-- Final operational wiring for Agenda v2: rich availability impact copy,
-- realtime publication and leased waitlist offer delivery.

create or replace function private.preview_availability_v2_change(
  p_professional_id uuid,
  p_windows jsonb,
  p_effective_from timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_conflicts jsonb;
begin
  if jsonb_typeof(coalesce(p_windows, '[]'::jsonb)) <> 'array' then
    raise exception 'Janelas de disponibilidade inválidas.' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'appointmentId', appointment.id,
    'patientId', appointment.patient_id,
    'patientName', patient.name,
    'seriesId', appointment.series_id,
    'startTime', appointment.start_time,
    'endTime', appointment.end_time,
    'reasonCode', 'outside_new_availability'
  ) order by appointment.start_time), '[]'::jsonb)
  into v_conflicts
  from public.appointments appointment
  left join public.patients patient
    on patient.id = appointment.patient_id
   and patient.user_id = appointment.user_id
  where appointment.user_id = p_professional_id
    and appointment.start_time >= greatest(p_effective_from, now())
    and appointment.start_time is not null
    and appointment.end_time is not null
    and lower(coalesce(appointment.status, '')) not in ('cancelled', 'canceled')
    and appointment.lifecycle_status <> 'cancelled'
    and not exists (
      select 1
      from jsonb_array_elements(p_windows) availability_window
      where (availability_window ->> 'weekday')::smallint = extract(
          dow from appointment.start_time at time zone coalesce(nullif(availability_window ->> 'timezone', ''), 'America/Sao_Paulo')
        )::smallint
        and (availability_window ->> 'start_time')::time <= (appointment.start_time at time zone coalesce(nullif(availability_window ->> 'timezone', ''), 'America/Sao_Paulo'))::time
        and (availability_window ->> 'end_time')::time >= (appointment.end_time at time zone coalesce(nullif(availability_window ->> 'timezone', ''), 'America/Sao_Paulo'))::time
    );

  return jsonb_build_object(
    'valid', jsonb_array_length(v_conflicts) = 0,
    'effectiveFrom', p_effective_from,
    'conflictCount', jsonb_array_length(v_conflicts),
    'conflicts', v_conflicts
  );
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'professional_waitlist_entries',
    'professional_waitlist_offers',
    'appointment_series_materialization_conflicts'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end
$$;

alter table public.professional_waitlist_offer_outbox
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists provider text,
  add column if not exists provider_message_id text;

create index if not exists professional_waitlist_offer_outbox_lease_idx
  on public.professional_waitlist_offer_outbox (status, lease_expires_at, next_attempt_at);

create or replace function public.claim_waitlist_offer_outbox(p_limit integer default 20)
returns setof public.professional_waitlist_offer_outbox
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token uuid := gen_random_uuid();
begin
  return query
  with candidates as (
    select outbox.id
    from public.professional_waitlist_offer_outbox outbox
    where (
      outbox.status in ('pending', 'failed')
      or (outbox.status = 'processing' and outbox.lease_expires_at <= now())
    )
      and outbox.next_attempt_at <= now()
      and outbox.attempts < 8
    order by outbox.next_attempt_at, outbox.created_at
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
    for update skip locked
  )
  update public.professional_waitlist_offer_outbox outbox
  set status = 'processing',
      attempts = outbox.attempts + 1,
      lease_token = v_token,
      lease_expires_at = now() + interval '5 minutes',
      last_error = null
  from candidates
  where outbox.id = candidates.id
  returning outbox.*;
end;
$$;

create or replace function public.complete_waitlist_offer_outbox(
  p_outbox_id uuid,
  p_lease_token uuid,
  p_success boolean,
  p_provider text default null,
  p_provider_message_id text default null,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.professional_waitlist_offer_outbox outbox
  set status = case when p_success then 'delivered' when outbox.attempts >= 8 then 'cancelled' else 'failed' end,
      delivered_at = case when p_success then now() else outbox.delivered_at end,
      provider = case when p_success then nullif(p_provider, '') else outbox.provider end,
      provider_message_id = case when p_success then nullif(p_provider_message_id, '') else outbox.provider_message_id end,
      last_error = case when p_success then null else left(coalesce(p_error, 'Falha de entrega'), 2000) end,
      next_attempt_at = case when p_success then outbox.next_attempt_at else now() + make_interval(mins => least(60, power(2, least(outbox.attempts, 6))::integer)) end,
      lease_token = null,
      lease_expires_at = null
  where outbox.id = p_outbox_id
    and outbox.status = 'processing'
    and outbox.lease_token = p_lease_token
    and outbox.lease_expires_at > now();
  return found;
end;
$$;

revoke all on function public.claim_waitlist_offer_outbox(integer) from public, anon, authenticated;
revoke all on function public.complete_waitlist_offer_outbox(uuid, uuid, boolean, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_waitlist_offer_outbox(integer) to service_role;
grant execute on function public.complete_waitlist_offer_outbox(uuid, uuid, boolean, text, text, text) to service_role;

create or replace function private.dispatch_waitlist_offer_outbox()
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
  order by created_at desc
  limit 1;
  if v_secret is null then return; end if;

  perform net.http_post(
    url := v_base_url || '/functions/v1/process-waitlist-offers',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-neuronex-webhook-secret', v_secret
    ),
    body := jsonb_build_object('limit', 20)
  );
end;
$$;

revoke all on function private.dispatch_waitlist_offer_outbox() from public, anon, authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname = 'neuronex-waitlist-offer-dispatch';

select cron.schedule(
  'neuronex-waitlist-offer-dispatch',
  '* * * * *',
  $cron$select private.dispatch_waitlist_offer_outbox();$cron$
);
