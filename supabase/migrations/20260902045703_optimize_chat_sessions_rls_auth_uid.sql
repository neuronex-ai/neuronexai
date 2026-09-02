alter policy "Users can delete their own sessions"
on public.chat_sessions
using ((select auth.uid()) = user_id);

alter policy "Users can insert their own sessions"
on public.chat_sessions
with check ((select auth.uid()) = user_id);

alter policy "Users can update their own sessions"
on public.chat_sessions
using ((select auth.uid()) = user_id);

alter policy "Users can view their own sessions"
on public.chat_sessions
using ((select auth.uid()) = user_id);
