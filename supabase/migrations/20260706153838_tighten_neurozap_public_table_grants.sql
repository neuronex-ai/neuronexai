do $$
begin
  revoke all privileges on table public.whatsapp_settings from anon;
  revoke all privileges on table public.whatsapp_conversations from anon;
  revoke all privileges on table public.whatsapp_messages from anon;
  revoke all privileges on table public.synapse_whatsapp_instances from anon;

  revoke all privileges on table public.whatsapp_settings from authenticated;
  revoke all privileges on table public.whatsapp_conversations from authenticated;
  revoke all privileges on table public.whatsapp_messages from authenticated;
  revoke all privileges on table public.synapse_whatsapp_instances from authenticated;

  grant select on table public.whatsapp_settings to authenticated;
  grant select, update on table public.whatsapp_conversations to authenticated;
  grant select on table public.whatsapp_messages to authenticated;
  grant select on table public.synapse_whatsapp_instances to authenticated;
end $$;
