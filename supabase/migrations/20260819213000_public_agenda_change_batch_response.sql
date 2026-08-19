-- Public bearer-token wrappers for agenda-change batch review.
-- No service-role credential is exposed to the browser. The raw token is
-- validated and SHA-256 hashed server-side before the existing internal RPCs
-- are called. The underlying batch/token tables remain private.

create or replace function public.get_agenda_change_batch_public(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_hash text;
begin
  if length(v_token) < 16 or length(v_token) > 256 or v_token !~ '^[A-Za-z0-9_-]+$' then
    return null;
  end if;

  v_hash := encode(digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex');
  return public.get_appointment_change_batch_by_token(v_hash);
end;
$$;

create or replace function public.process_agenda_change_batch_response_public(
  p_token text,
  p_decisions jsonb,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_hash text;
begin
  if length(v_token) < 16 or length(v_token) > 256 or v_token !~ '^[A-Za-z0-9_-]+$' then
    raise exception using errcode = '22023', message = 'invalid agenda change token';
  end if;
  if p_decisions is null or jsonb_typeof(p_decisions) <> 'array' or jsonb_array_length(p_decisions) < 1 or jsonb_array_length(p_decisions) > 100 then
    raise exception using errcode = '22023', message = 'invalid agenda change decisions';
  end if;

  v_hash := encode(digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex');
  return public.process_appointment_change_batch_response(
    v_hash,
    p_decisions,
    nullif(left(coalesce(p_comment, ''), 1000), '')
  );
end;
$$;

revoke all on function public.get_agenda_change_batch_public(text) from public;
revoke all on function public.process_agenda_change_batch_response_public(text, jsonb, text) from public;
grant execute on function public.get_agenda_change_batch_public(text) to anon, authenticated;
grant execute on function public.process_agenda_change_batch_response_public(text, jsonb, text) to anon, authenticated;
