begin;

-- The desktop record summary is intentionally a single, stable database call.
-- The function remains SECURITY INVOKER so RLS is never bypassed; the explicit
-- ownership check gives callers a clear authorization failure instead of an
-- ambiguous empty summary.
create or replace function public.get_patient_record_summary(p_patient_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.patients p
    where p.id = p_patient_id
      and p.user_id = v_user_id
  ) then
    raise exception 'patient record not available' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'completedSessions', (
      select count(*)
      from public.appointments a
      where a.patient_id = p_patient_id
        and a.user_id = v_user_id
        and a.status in ('attended', 'completed')
    ),
    'pendingReviews', (
      select count(*)
      from public.session_notes sn
      where sn.patient_id = p_patient_id
        and sn.user_id = v_user_id
        and sn.review_status = 'pending_review'
    ),
    'documents', (
      select count(*)
      from public.document_files df
      where df.patient_id = p_patient_id
        and df.user_id = v_user_id
        and df.deleted_at is null
    ),
    'activeGoals', (
      select count(*)
      from public.patient_goals pg
      where pg.patient_id = p_patient_id
        and pg.user_id = v_user_id
        and coalesce(pg.is_completed, false) = false
    ),
    'nextSession', (
      select jsonb_build_object(
        'id', a.id,
        'start_time', a.start_time,
        'type', a.type
      )
      from public.appointments a
      where a.patient_id = p_patient_id
        and a.user_id = v_user_id
        and a.start_time >= now()
        and coalesce(a.status, '') not in ('cancelled', 'cancelled_by_patient', 'cancelled_by_professional')
      order by a.start_time asc
      limit 1
    ),
    'lastSession', (
      select jsonb_build_object(
        'id', a.id,
        'start_time', a.start_time,
        'type', a.type
      )
      from public.appointments a
      where a.patient_id = p_patient_id
        and a.user_id = v_user_id
        and a.status in ('attended', 'completed')
      order by a.start_time desc nulls last
      limit 1
    ),
    'activePackage', (
      select jsonb_build_object(
        'id', pp.id,
        'description', pp.description,
        'total_sessions', pp.total_sessions,
        'sessions_used', pp.sessions_used
      )
      from public.patient_packages pp
      where pp.patient_id = p_patient_id
        and pp.user_id = v_user_id
        and pp.package_status = 'active'
        and lower(coalesce(pp.active, 'true')) not in ('false', 'inactive', 'cancelled', 'completed')
        and pp.sessions_used < pp.total_sessions
        and (pp.end_date is null or pp.end_date >= current_date)
      order by pp.start_date desc nulls last, pp.created_at desc
      limit 1
    ),
    'openBalance', (
      select coalesce(sum(abs(fe.amount)), 0)
      from public.financial_entries fe
      where fe.patient_id = p_patient_id
        and fe.professional_id = v_user_id
        and fe.type = 'income'
        and fe.status not in ('paid', 'cancelled', 'reversed')
    ),
    'latestMood', (
      select jsonb_build_object(
        'mood_score', pml.mood_score,
        'created_at', pml.created_at
      )
      from public.patient_mood_logs pml
      where pml.patient_id = p_patient_id
        and pml.user_id = v_user_id
      order by pml.created_at desc nulls last
      limit 1
    ),
    'riskScore', (
      select coalesce(p.risk_score, 0)
      from public.patients p
      where p.id = p_patient_id
        and p.user_id = v_user_id
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_patient_record_summary(uuid) from public, anon;
grant execute on function public.get_patient_record_summary(uuid) to authenticated;

comment on function public.get_patient_record_summary(uuid) is
  'Returns the owner-scoped aggregate used by the desktop patient record summary without bypassing RLS.';

-- Cover the owner/patient/time access patterns used by the aggregate without
-- widening any policy or duplicating the payload on the client.
create index if not exists appointments_user_patient_start_idx
  on public.appointments (user_id, patient_id, start_time desc);

create index if not exists patient_packages_user_patient_active_idx
  on public.patient_packages (user_id, patient_id, start_date desc)
  where package_status = 'active';

create index if not exists patient_mood_logs_user_patient_created_idx
  on public.patient_mood_logs (user_id, patient_id, created_at desc);

create index if not exists document_files_user_patient_current_idx
  on public.document_files (user_id, patient_id)
  where deleted_at is null;

create index if not exists patient_goals_user_patient_active_idx
  on public.patient_goals (user_id, patient_id)
  where coalesce(is_completed, false) = false;

create index if not exists financial_entries_professional_patient_open_income_idx
  on public.financial_entries (professional_id, patient_id)
  where type = 'income'
    and status not in ('paid', 'cancelled', 'reversed');

-- Older environments carried an unconditional DELETE policy. Public
-- anamnesis access already goes through the service-backed Edge Function, so
-- every direct table operation can and must remain scoped to the psychologist
-- who owns the patient.
alter table public.patient_anamneses enable row level security;
revoke all on table public.patient_anamneses from public, anon;
grant select, insert, update, delete on table public.patient_anamneses to authenticated;

do $policy_cleanup$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'patient_anamneses'
  loop
    execute format('drop policy if exists %I on public.patient_anamneses', policy_row.policyname);
  end loop;
end
$policy_cleanup$;

create policy "Patient anamneses owner read"
  on public.patient_anamneses
  for select
  to authenticated
  using (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and exists (
      select 1
      from public.patients p
      where p.id = patient_anamneses.patient_id
        and p.user_id = (select auth.uid())
    )
  );

create policy "Patient anamneses owner insert"
  on public.patient_anamneses
  for insert
  to authenticated
  with check (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and exists (
      select 1
      from public.patients p
      where p.id = patient_anamneses.patient_id
        and p.user_id = (select auth.uid())
    )
  );

create policy "Patient anamneses owner update"
  on public.patient_anamneses
  for update
  to authenticated
  using (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and exists (
      select 1
      from public.patients p
      where p.id = patient_anamneses.patient_id
        and p.user_id = (select auth.uid())
    )
  )
  with check (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and exists (
      select 1
      from public.patients p
      where p.id = patient_anamneses.patient_id
        and p.user_id = (select auth.uid())
    )
  );

create policy "Patient anamneses owner delete"
  on public.patient_anamneses
  for delete
  to authenticated
  using (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and exists (
      select 1
      from public.patients p
      where p.id = patient_anamneses.patient_id
        and p.user_id = (select auth.uid())
    )
  );

notify pgrst, 'reload schema';

commit;
