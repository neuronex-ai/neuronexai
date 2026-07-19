-- The project is at its Edge Function count limit. Reuse the hardened,
-- secret-verified operational communication worker for waitlist deliveries.
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
    url := v_base_url || '/functions/v1/process-appointment-communications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-neuronex-webhook-secret', v_secret
    ),
    body := jsonb_build_object('limit', 20, 'processWaitlist', true)
  );
end;
$$;
