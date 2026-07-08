create or replace function public.consume_synapse_quota(
  p_user_id uuid,
  p_limit_count integer default 15
)
returns table (
  allowed boolean,
  used_count integer,
  limit_count integer,
  remaining_count integer,
  unlocks_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query select true, 0, 2147483647, 2147483647, null::timestamptz;
end;
$$;

revoke all on function public.consume_synapse_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_synapse_quota(uuid, integer) to service_role;

notify pgrst, 'reload schema';
