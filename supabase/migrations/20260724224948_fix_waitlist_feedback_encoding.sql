-- The prior hotfix was sent through a console bridge that could double-encode
-- accented string literals. Correct only affected definitions/records; on a
-- clean database with UTF-8 source this migration is a no-op.
do $$
declare
  v_identity text;
  v_function regprocedure;
  v_definition text;
begin
  foreach v_identity in array array[
    'public.respond_waitlist_offer(text,text)',
    'public.set_professional_waitlist_entry_status(uuid,text)',
    'public.suggest_professional_waitlist_slot(uuid,integer)'
  ]
  loop
    v_function := to_regprocedure(v_identity);
    if v_function is null then
      continue;
    end if;

    select pg_get_functiondef(v_function) into v_definition;
    if position('Ã' in v_definition) > 0 then
      execute convert_from(convert_to(v_definition, 'LATIN1'), 'UTF8');
    end if;
  end loop;
end;
$$;

update public.notifications
set
  title = case
    when position('Ã' in title) > 0
      then convert_from(convert_to(title, 'LATIN1'), 'UTF8')
    else title
  end,
  message = case
    when position('Ã' in message) > 0
      then convert_from(convert_to(message, 'LATIN1'), 'UTF8')
    else message
  end,
  updated_at = now()
where event_id like 'waitlist-offer-accepted:%'
  and (position('Ã' in title) > 0 or position('Ã' in message) > 0);

notify pgrst, 'reload schema';
