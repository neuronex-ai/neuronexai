-- Desktop/Tablet hot-path cleanup: preserve current product behavior while
-- reducing avoidable per-row RLS work and background database churn.

alter policy "Users can insert their own preferences"
on public.user_preferences
with check ((select auth.uid()) = user_id);

alter policy "Users can update their own preferences"
on public.user_preferences
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

alter policy "Users can view their own preferences"
on public.user_preferences
using ((select auth.uid()) = user_id);

alter policy "Users insert their own Synapse action logs"
on public.synapse_action_logs
with check ((select auth.uid()) = user_id);

alter policy "Users read their own Synapse action logs"
on public.synapse_action_logs
using ((select auth.uid()) = user_id);

create index if not exists appointments_patient_id_idx
  on public.appointments (patient_id);

create index if not exists session_notes_appointment_id_idx
  on public.session_notes (appointment_id)
  where appointment_id is not null;

create index if not exists patient_packages_patient_id_idx
  on public.patient_packages (patient_id);

-- Patient-right expiry is housekeeping rather than an interactive request.
-- Two-minute cadence halves its background executions while keeping the
-- worst-case product delay below two minutes.
do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'neuronex-appointment-patient-rights'
  limit 1;

  if v_job_id is not null then
    perform cron.alter_job(v_job_id, schedule := '*/2 * * * *');
  end if;
end
$$;
