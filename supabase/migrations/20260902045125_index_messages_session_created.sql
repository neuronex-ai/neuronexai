create index if not exists messages_session_created_idx
on public.messages (session_id, created_at);
