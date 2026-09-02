alter policy "Users can insert messages into their sessions"
on public.messages
with check (
  exists (
    select 1
    from public.chat_sessions
    where chat_sessions.id = messages.session_id
      and chat_sessions.user_id = (select auth.uid())
  )
);

alter policy "Users can view messages from their sessions"
on public.messages
using (
  exists (
    select 1
    from public.chat_sessions
    where chat_sessions.id = messages.session_id
      and chat_sessions.user_id = (select auth.uid())
  )
);

alter policy "Therapists can manage their own patients"
on public.patients
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
