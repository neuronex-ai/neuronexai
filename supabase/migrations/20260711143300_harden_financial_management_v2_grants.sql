-- Supabase's DDL hook grants API roles explicitly after function creation.
-- Remove anonymous access from the financial management V2 contract.
begin;

revoke all on function public.consume_patient_package_session(uuid, uuid, uuid, text, text) from anon;
revoke all on function public.transition_financial_entry(uuid, text, numeric, timestamptz, text, text, text) from anon;
revoke all on function public.get_financial_management_snapshot(date, text) from anon;

grant execute on function public.consume_patient_package_session(uuid, uuid, uuid, text, text) to authenticated;
grant execute on function public.transition_financial_entry(uuid, text, numeric, timestamptz, text, text, text) to authenticated;
grant execute on function public.get_financial_management_snapshot(date, text) to authenticated;

revoke all on table public.financial_entry_settlements from anon;
revoke all on table public.patient_package_session_usages from anon;

grant select on table public.financial_entry_settlements to authenticated;
grant select on table public.patient_package_session_usages to authenticated;

commit;
