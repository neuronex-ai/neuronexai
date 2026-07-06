create or replace function public.neurozap_store_instance_credential(
  p_user_id uuid,
  p_instance_name text,
  p_instance_api_key text
)
returns void
language plpgsql
security definer
set search_path = private, public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required'
      using errcode = '42501';
  end if;

  insert into private.neurozap_instance_credentials (
    user_id,
    instance_name,
    instance_api_key,
    updated_at
  )
  values (
    p_user_id,
    p_instance_name,
    p_instance_api_key,
    now()
  )
  on conflict (user_id) do update
  set
    instance_name = excluded.instance_name,
    instance_api_key = excluded.instance_api_key,
    updated_at = now();
end;
$$;

create or replace function public.neurozap_get_instance_credential(
  p_user_id uuid,
  p_instance_name text
)
returns text
language sql
security definer
stable
set search_path = private, public, pg_temp
as $$
  select c.instance_api_key
  from private.neurozap_instance_credentials c
  where c.user_id = p_user_id
    and c.instance_name = p_instance_name
  limit 1;
$$;

revoke all on function public.neurozap_store_instance_credential(uuid, text, text) from public;
revoke all on function public.neurozap_store_instance_credential(uuid, text, text) from anon;
revoke all on function public.neurozap_store_instance_credential(uuid, text, text) from authenticated;
grant execute on function public.neurozap_store_instance_credential(uuid, text, text) to service_role;

revoke all on function public.neurozap_get_instance_credential(uuid, text) from public;
revoke all on function public.neurozap_get_instance_credential(uuid, text) from anon;
revoke all on function public.neurozap_get_instance_credential(uuid, text) from authenticated;
grant execute on function public.neurozap_get_instance_credential(uuid, text) to service_role;
