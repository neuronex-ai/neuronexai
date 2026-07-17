-- pgcrypto is installed in the `extensions` schema in hosted Supabase.
-- These SECURITY DEFINER functions intentionally use a restricted search_path,
-- so the extension schema must be explicit for digest()/encode() resolution.

alter function private.prepare_appointment_communication_outbox()
  set search_path = pg_catalog, extensions;

alter function public.apply_appointment_policy_to_future_occurrences(
  uuid, uuid[], text, text
) set search_path = pg_catalog, extensions;

alter function public.create_appointment_policy_version(
  numeric, numeric, numeric, numeric,
  text, text, text, text, text,
  text, timestamp with time zone, text, text
) set search_path = pg_catalog, extensions;

alter function public.prepare_appointment_invitation(
  uuid, uuid, text, integer, text, jsonb
) set search_path = pg_catalog, extensions;

alter function public.request_appointment_outcome_override(
  uuid, text, text, text, text, jsonb, text
) set search_path = pg_catalog, extensions;

alter function public.verify_appointment_communication_webhook_secret(text)
  set search_path = pg_catalog, extensions;
