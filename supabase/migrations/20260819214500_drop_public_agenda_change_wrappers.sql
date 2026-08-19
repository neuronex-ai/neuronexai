-- Public agenda-change responses are handled by the tokenized
-- agenda-change-response Edge Function. Keep the browser away from
-- SECURITY DEFINER RPCs and leave private batch tables/functions server-only.

drop function if exists public.process_agenda_change_batch_response_public(text, jsonb, text);
drop function if exists public.get_agenda_change_batch_public(text);
