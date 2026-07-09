-- Final destructive cleanup for the Asaas/NeuroFinance contract.
-- This migration intentionally fails if any connected Asaas account still lacks
-- a private Vault-backed credential.

do $$
declare
  missing_credentials integer;
begin
  select count(*)
    into missing_credentials
  from public.financial_accounts fa
  where fa.provider = 'asaas'
    and fa.asaas_account_id is not null
    and coalesce(fa.status, '') <> 'account_missing'
    and not exists (
      select 1
      from private.asaas_account_credentials c
      where c.financial_account_id = fa.id
        and c.status = 'active'
        and c.vault_secret_id is not null
    );

  if missing_credentials > 0 then
    raise exception 'Cannot finalize Asaas cleanup: % connected account(s) do not have active Vault credentials.', missing_credentials
      using errcode = '23514';
  end if;
end;
$$;

create or replace function public.get_monthly_report_data(start_date date, end_date date)
returns jsonb
language sql
set search_path to ''
as $$
  with appointment_stats as (
    select
      count(*) as total,
      count(*) filter (where a.status in ('attended', 'completed')) as completed,
      count(*) filter (where a.status in ('cancelled_by_patient', 'cancelled_by_professional', 'cancelled')) as cancelled,
      count(*) filter (where a.status in ('unscored', 'pending', 'confirmed')) as scheduled
    from public.appointments a
    where a.user_id = auth.uid()
      and a.start_time >= start_date::timestamptz
      and a.start_time < (end_date + 1)::timestamptz
  ),
  financial_stats as (
    select
      coalesce(sum(fe.amount) filter (
        where fe.type = 'income'
          and coalesce(fe.status, '') <> 'cancelled'
      ), 0) as total_income,
      coalesce(sum(fe.amount) filter (
        where fe.type = 'expense'
          and coalesce(fe.status, '') <> 'cancelled'
      ), 0) as total_expense
    from public.financial_entries fe
    where fe.professional_id = auth.uid()
      and coalesce(fe.competence_date, fe.due_date, fe.paid_at::date, fe.created_at::date) >= start_date
      and coalesce(fe.competence_date, fe.due_date, fe.paid_at::date, fe.created_at::date) <= end_date
  ),
  new_patients as (
    select count(*) as count
    from public.patients p
    where p.user_id = auth.uid()
      and p.created_at >= start_date::timestamptz
      and p.created_at < (end_date + 1)::timestamptz
  )
  select jsonb_build_object(
    'appointments', (select to_jsonb(appointment_stats) from appointment_stats),
    'financial', (select to_jsonb(financial_stats) from financial_stats),
    'new_patients', (select count from new_patients)
  );
$$;

revoke all on function public.get_monthly_report_data(date, date) from public;
grant execute on function public.get_monthly_report_data(date, date) to authenticated;

create or replace function public.export_user_data()
returns jsonb
language sql
set search_path to ''
as $$
  with patient_data as (
    select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) as data
    from public.patients p
    where p.user_id = auth.uid()
  ),
  appointment_data as (
    select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) as data
    from public.appointments a
    where a.user_id = auth.uid()
  ),
  financial_entry_data as (
    select coalesce(jsonb_agg(to_jsonb(fe)), '[]'::jsonb) as data
    from public.financial_entries fe
    where fe.professional_id = auth.uid()
  ),
  note_data as (
    select coalesce(jsonb_agg(to_jsonb(sn)), '[]'::jsonb) as data
    from public.session_notes sn
    where sn.user_id = auth.uid()
  ),
  template_data as (
    select coalesce(jsonb_agg(to_jsonb(tpl)), '[]'::jsonb) as data
    from public.templates tpl
    where tpl.psychologist_id = auth.uid()
  )
  select jsonb_build_object(
    'metadata', jsonb_build_object(
      'generated_at', now(),
      'user_id', auth.uid(),
      'version', '3.0'
    ),
    'patients', (select data from patient_data),
    'appointments', (select data from appointment_data),
    'financial_entries', (select data from financial_entry_data),
    'session_notes', (select data from note_data),
    'templates', (select data from template_data)
  );
$$;

revoke all on function public.export_user_data() from public;
grant execute on function public.export_user_data() to authenticated;

drop table if exists public.base_asaas_events cascade;

alter table public.financial_entries
  drop column if exists legacy_transaction_id;

drop table if exists public.transactions cascade;

alter table private.asaas_account_credentials
  alter column vault_secret_id set not null,
  drop column if exists key_ciphertext,
  drop column if exists key_iv,
  drop column if exists key_tag,
  drop column if exists key_algorithm,
  drop column if exists key_version;

alter table public.financial_accounts
  drop column if exists asaas_api_key;
