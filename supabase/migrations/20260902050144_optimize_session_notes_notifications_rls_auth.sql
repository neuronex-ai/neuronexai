alter policy "Service role or self creates notifications"
on public.notifications
with check (((select auth.role()) = 'service_role'::text) OR ((select auth.uid()) = user_id));

alter policy "Users can update their own notifications"
on public.notifications
using ((select auth.uid()) = user_id);

alter policy "Users can view their own notifications"
on public.notifications
using ((select auth.uid()) = user_id);

alter policy "Patients can read their own session notes"
on public.session_notes
using (
  exists (
    select 1
    from public.patients
    where patients.id = session_notes.patient_id
      and patients.email = (select auth.email())
  )
);

alter policy "Users can only delete their own session notes"
on public.session_notes
using ((select auth.uid()) = user_id);

alter policy "Users can only insert their own session notes"
on public.session_notes
with check ((select auth.uid()) = user_id);

alter policy "Users can only see their own session notes"
on public.session_notes
using ((select auth.uid()) = user_id);

alter policy "Users can only update their own session notes"
on public.session_notes
using ((select auth.uid()) = user_id);
