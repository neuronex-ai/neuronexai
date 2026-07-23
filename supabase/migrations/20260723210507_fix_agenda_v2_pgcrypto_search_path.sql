-- Agenda v2 action-plan functions were added after the first pgcrypto
-- search_path repair. They intentionally keep a restricted SECURITY DEFINER
-- search_path, but still need access to pgcrypto's digest() implementation in
-- the hosted `extensions` schema.

alter function private.build_appointment_action_plan_snapshot(
  uuid, text, jsonb, jsonb
) set search_path = pg_catalog, extensions;

alter function private.execute_appointment_action_plan_core(
  uuid, uuid, integer, text, text, uuid
) set search_path = pg_catalog, extensions;

alter function private.prepare_appointment_action_plan_core(
  uuid, text, jsonb, jsonb, text, uuid
) set search_path = pg_catalog, extensions;

alter function private.prepare_waitlist_offer_core(
  uuid, uuid, timestamp with time zone, timestamp with time zone, text, text
) set search_path = pg_catalog, extensions;

alter function public.get_waitlist_offer(text)
  set search_path = pg_catalog, extensions;

alter function public.prepare_agenda_action_plan(text, jsonb, jsonb, text)
  set search_path = pg_catalog, extensions;

alter function public.respond_waitlist_offer(text, text)
  set search_path = pg_catalog, extensions;
