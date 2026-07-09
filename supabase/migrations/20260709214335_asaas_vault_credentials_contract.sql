-- Move Asaas connected-account API keys to Supabase Vault and expose a
-- service-role-only RPC contract for Edge Functions.

create extension if not exists supabase_vault with schema vault;

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
grant usage on schema private to service_role;

alter table private.asaas_account_credentials
  add column if not exists vault_secret_id uuid references vault.secrets(id);

-- The old in-table ciphertext columns stay only for the deployment bridge. New
-- writes use vault_secret_id, so these columns must be nullable until the final
-- cleanup migration removes them.
alter table private.asaas_account_credentials
  alter column key_ciphertext drop not null,
  alter column key_iv drop not null,
  alter column key_tag drop not null,
  alter column key_algorithm drop not null,
  alter column key_version drop not null;

comment on column private.asaas_account_credentials.vault_secret_id is
  'Supabase Vault secret id for the Asaas connected-account API key.';

create or replace function private.store_asaas_account_api_key(
  p_financial_account_id uuid,
  p_user_id uuid,
  p_asaas_account_id text,
  p_api_key text,
  p_source text default 'edge_function'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_api_key text := nullif(trim(p_api_key), '');
  v_secret_name text := 'asaas_account_api_key_' || p_financial_account_id::text;
  v_secret_description text := 'Asaas connected-account API key for financial_account_id=' || p_financial_account_id::text;
  v_secret_id uuid;
begin
  if p_financial_account_id is null or p_user_id is null then
    raise exception 'financial_account_id and user_id are required'
      using errcode = '22023';
  end if;

  if v_api_key is null then
    raise exception 'Asaas API key cannot be empty'
      using errcode = '22023';
  end if;

  select c.vault_secret_id
    into v_secret_id
  from private.asaas_account_credentials c
  where c.financial_account_id = p_financial_account_id;

  if v_secret_id is not null and exists (
    select 1 from vault.secrets s where s.id = v_secret_id
  ) then
    perform vault.update_secret(v_secret_id, v_api_key, v_secret_name, v_secret_description);
  else
    select s.id
      into v_secret_id
    from vault.secrets s
    where s.name = v_secret_name;

    if v_secret_id is not null then
      perform vault.update_secret(v_secret_id, v_api_key, v_secret_name, v_secret_description);
    else
      v_secret_id := vault.create_secret(v_api_key, v_secret_name, v_secret_description);
    end if;
  end if;

  insert into private.asaas_account_credentials (
    financial_account_id,
    user_id,
    asaas_account_id,
    vault_secret_id,
    status,
    source,
    rotated_at,
    updated_at
  )
  values (
    p_financial_account_id,
    p_user_id,
    nullif(trim(p_asaas_account_id), ''),
    v_secret_id,
    'active',
    coalesce(nullif(trim(p_source), ''), 'edge_function'),
    now(),
    now()
  )
  on conflict (financial_account_id) do update
    set user_id = excluded.user_id,
        asaas_account_id = excluded.asaas_account_id,
        vault_secret_id = excluded.vault_secret_id,
        status = 'active',
        source = excluded.source,
        rotated_at = now(),
        updated_at = now();

  return v_secret_id;
end;
$$;

create or replace function private.get_asaas_account_api_key(
  p_financial_account_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(trim(ds.decrypted_secret), '')
  from private.asaas_account_credentials c
  join vault.decrypted_secrets ds on ds.id = c.vault_secret_id
  where c.financial_account_id = p_financial_account_id
    and c.status = 'active'
  limit 1;
$$;

revoke all on function private.store_asaas_account_api_key(uuid, uuid, text, text, text) from public;
revoke all on function private.store_asaas_account_api_key(uuid, uuid, text, text, text) from anon;
revoke all on function private.store_asaas_account_api_key(uuid, uuid, text, text, text) from authenticated;
grant execute on function private.store_asaas_account_api_key(uuid, uuid, text, text, text) to service_role;

revoke all on function private.get_asaas_account_api_key(uuid) from public;
revoke all on function private.get_asaas_account_api_key(uuid) from anon;
revoke all on function private.get_asaas_account_api_key(uuid) from authenticated;
grant execute on function private.get_asaas_account_api_key(uuid) to service_role;

do $$
declare
  r record;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'financial_accounts'
      and column_name = 'asaas_api_key'
  ) then
    for r in
      select
        fa.id,
        fa.user_id,
        fa.asaas_account_id,
        fa.asaas_api_key
      from public.financial_accounts fa
      where fa.provider = 'asaas'
        and nullif(trim(fa.asaas_api_key), '') is not null
    loop
      perform private.store_asaas_account_api_key(
        r.id,
        r.user_id,
        r.asaas_account_id,
        r.asaas_api_key,
        'legacy_public_column_migration'
      );
    end loop;
  end if;
end;
$$;
