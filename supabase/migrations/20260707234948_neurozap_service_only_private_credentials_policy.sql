drop policy if exists "Service role manages NeuroZap instance credentials" on private.neurozap_instance_credentials;

create policy "Service role manages NeuroZap instance credentials"
  on private.neurozap_instance_credentials
  for all
  to service_role
  using (true)
  with check (true);

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
grant usage on schema private to service_role;

revoke all on table private.neurozap_instance_credentials from public;
revoke all on table private.neurozap_instance_credentials from anon;
revoke all on table private.neurozap_instance_credentials from authenticated;
grant select, insert, update, delete on table private.neurozap_instance_credentials to service_role;

revoke all on function public.neurozap_store_instance_credential(uuid, text, text) from public;
revoke all on function public.neurozap_store_instance_credential(uuid, text, text) from anon;
revoke all on function public.neurozap_store_instance_credential(uuid, text, text) from authenticated;
grant execute on function public.neurozap_store_instance_credential(uuid, text, text) to service_role;

revoke all on function public.neurozap_get_instance_credential(uuid, text) from public;
revoke all on function public.neurozap_get_instance_credential(uuid, text) from anon;
revoke all on function public.neurozap_get_instance_credential(uuid, text) from authenticated;
grant execute on function public.neurozap_get_instance_credential(uuid, text) to service_role;
