-- Avoid waking communication Edge Functions when their queues have no claimable work.
-- The cron cadence remains one minute, preserving normal delivery latency when work exists.

create or replace function private.dispatch_appointment_communication_outbox()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_secret text;
  v_base_url constant text := 'https://krewdaklcyzqfxkkgvqr.supabase.co';
begin
  if not exists (
    select 1
    from public.appointment_communication_outbox outbox
    where (
        outbox.status in ('pending', 'failed')
        or (outbox.status = 'processing' and outbox.lease_expires_at <= now())
      )
      and outbox.next_attempt_at <= now()
  ) then
    return;
  end if;

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
$function$;

create or replace function private.dispatch_agenda_change_communication_outbox()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_secret text;
  v_base_url constant text := 'https://krewdaklcyzqfxkkgvqr.supabase.co';
begin
  if not exists (
    select 1
    from private.agenda_change_communication_outbox outbox
    join private.appointment_change_batches batch on batch.id = outbox.batch_id
    where (
        outbox.status in ('pending', 'failed')
        or (outbox.status = 'processing' and outbox.lease_expires_at <= now())
      )
      and outbox.next_attempt_at <= now()
      and batch.status = 'pending_delivery'
  ) then
    return;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'appointment_communication_webhook_secret'
  order by created_at desc
  limit 1;

  if v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := v_base_url || '/functions/v1/process-agenda-change-communications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-neuronex-webhook-secret', v_secret
    ),
    body := jsonb_build_object('limit', 20)
  );
end;
$function$;
