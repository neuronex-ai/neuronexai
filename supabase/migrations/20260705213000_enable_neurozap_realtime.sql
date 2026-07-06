alter table public.whatsapp_settings replica identity full;
alter table public.whatsapp_conversations replica identity full;
alter table public.whatsapp_messages replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'whatsapp_settings'
    ) then
      alter publication supabase_realtime add table public.whatsapp_settings;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'whatsapp_conversations'
    ) then
      alter publication supabase_realtime add table public.whatsapp_conversations;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'whatsapp_messages'
    ) then
      alter publication supabase_realtime add table public.whatsapp_messages;
    end if;
  end if;
end;
$$;
