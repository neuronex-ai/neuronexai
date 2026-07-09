create or replace function public.get_asaas_account_api_key_for_edge(
  p_financial_account_id uuid
)
returns text
language sql
security definer
set search_path = ''
as $$
  select private.get_asaas_account_api_key(p_financial_account_id);
$$;

create or replace function public.store_asaas_account_api_key_for_edge(
  p_financial_account_id uuid,
  p_user_id uuid,
  p_asaas_account_id text,
  p_api_key text,
  p_source text default 'edge_function'
)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.store_asaas_account_api_key(
    p_financial_account_id,
    p_user_id,
    p_asaas_account_id,
    p_api_key,
    p_source
  );
$$;

revoke all on function public.get_asaas_account_api_key_for_edge(uuid) from public;
revoke all on function public.get_asaas_account_api_key_for_edge(uuid) from anon;
revoke all on function public.get_asaas_account_api_key_for_edge(uuid) from authenticated;
grant execute on function public.get_asaas_account_api_key_for_edge(uuid) to service_role;

revoke all on function public.store_asaas_account_api_key_for_edge(uuid, uuid, text, text, text) from public;
revoke all on function public.store_asaas_account_api_key_for_edge(uuid, uuid, text, text, text) from anon;
revoke all on function public.store_asaas_account_api_key_for_edge(uuid, uuid, text, text, text) from authenticated;
grant execute on function public.store_asaas_account_api_key_for_edge(uuid, uuid, text, text, text) to service_role;
