-- Unified authenticated search used by the global command palette and Synapse.
-- The function remains SECURITY INVOKER so the caller's RLS policies stay active.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create index if not exists patients_synapse_name_trgm_idx
  on public.patients
  using gin ((lower(coalesce(name, '') || ' ' || coalesce(social_name, ''))) extensions.gin_trgm_ops);

create index if not exists session_notes_synapse_search_idx
  on public.session_notes
  using gin (to_tsvector('simple'::regconfig, coalesce(notes, '') || ' ' || coalesce(ai_summary::text, '')));

create index if not exists personal_notes_synapse_search_idx
  on public.personal_notes
  using gin (to_tsvector('simple'::regconfig, coalesce(title, '') || ' ' || coalesce(content, '')));

create index if not exists messages_synapse_search_idx
  on public.messages
  using gin (to_tsvector('simple'::regconfig, coalesce(content, '')));

create index if not exists appointments_synapse_search_idx
  on public.appointments
  using gin ((lower(coalesce(notes, '') || ' ' || coalesce(location, ''))) extensions.gin_trgm_ops);

create index if not exists reminders_synapse_title_trgm_idx
  on public.reminders
  using gin ((lower(coalesce(title, ''))) extensions.gin_trgm_ops);

create index if not exists personal_notes_user_updated_idx
  on public.personal_notes (user_id, updated_at desc);

create index if not exists reminders_user_due_idx
  on public.reminders (user_id, due_date desc);

create index if not exists messages_user_created_idx
  on public.messages (user_id, created_at desc);

create or replace function public.search_synapse_workspace(
  p_query text,
  p_entity_types text[] default null,
  p_limit integer default 20
)
returns table (
  entity_type text,
  entity_id uuid,
  patient_id uuid,
  title text,
  subtitle text,
  excerpt text,
  occurred_at timestamptz,
  score real,
  match_reason text
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with search_input as (
    select
      btrim(coalesce(p_query, '')) as raw_query,
      lower(extensions.unaccent(btrim(coalesce(p_query, '')))) as normalized_query,
      websearch_to_tsquery('simple'::regconfig, btrim(coalesce(p_query, ''))) as text_query,
      p_entity_types is null or cardinality(p_entity_types) = 0 as include_all
  ),
  ranked as (
    select
      'patient'::text as entity_type,
      patient.id as entity_id,
      patient.id as patient_id,
      patient.name as title,
      concat_ws(' · ', nullif(patient.social_name, ''), nullif(patient.status, '')) as subtitle,
      null::text as excerpt,
      patient.created_at as occurred_at,
      case
        when lower(extensions.unaccent(patient.name)) = input.normalized_query then 1.0
        when lower(extensions.unaccent(coalesce(patient.social_name, ''))) = input.normalized_query then 0.99
        when lower(extensions.unaccent(patient.name)) like input.normalized_query || '%' then 0.97
        when lower(extensions.unaccent(coalesce(patient.social_name, ''))) like input.normalized_query || '%' then 0.96
        when lower(extensions.unaccent(patient.name)) like '%' || input.normalized_query || '%' then 0.92
        else greatest(
          extensions.similarity(lower(patient.name), lower(input.raw_query)),
          extensions.similarity(lower(coalesce(patient.social_name, '')), lower(input.raw_query))
        ) * 0.86
      end::real as score,
      case
        when lower(extensions.unaccent(patient.name)) = input.normalized_query then 'exact_name'
        when lower(extensions.unaccent(coalesce(patient.social_name, ''))) = input.normalized_query then 'exact_social_name'
        when lower(extensions.unaccent(patient.name)) like input.normalized_query || '%' then 'name_prefix'
        when lower(extensions.unaccent(coalesce(patient.social_name, ''))) like input.normalized_query || '%' then 'social_name_prefix'
        when lower(extensions.unaccent(patient.name)) like '%' || input.normalized_query || '%' then 'name_contains'
        else 'name_trigram'
      end::text as match_reason
    from public.patients as patient
    cross join search_input as input
    where (select auth.uid()) is not null
      and patient.user_id = (select auth.uid())
      and input.normalized_query <> ''
      and (input.include_all or 'patient' = any(p_entity_types))
      and (
        lower(extensions.unaccent(coalesce(patient.name, '') || ' ' || coalesce(patient.social_name, '')))
          like '%' || input.normalized_query || '%'
        or extensions.similarity(
          lower(coalesce(patient.name, '') || ' ' || coalesce(patient.social_name, '')),
          lower(input.raw_query)
        ) >= 0.20
      )

    union all

    select
      'session_note'::text,
      note.id,
      note.patient_id,
      coalesce(patient.name, 'Nota de sessão'),
      'Nota de prontuário'::text,
      left(coalesce(note.notes, note.ai_summary::text, ''), 280),
      note.created_at,
      greatest(
        0.70 + ts_rank(
          to_tsvector('simple'::regconfig, coalesce(note.notes, '') || ' ' || coalesce(note.ai_summary::text, '')),
          input.text_query
        ),
        0.76
      )::real,
      case
        when to_tsvector('simple'::regconfig, coalesce(note.notes, '') || ' ' || coalesce(note.ai_summary::text, '')) @@ input.text_query
          then 'clinical_full_text'
        else 'clinical_contains'
      end::text
    from public.session_notes as note
    left join public.patients as patient on patient.id = note.patient_id and patient.user_id = note.user_id
    cross join search_input as input
    where (select auth.uid()) is not null
      and note.user_id = (select auth.uid())
      and input.normalized_query <> ''
      and (input.include_all or 'session_note' = any(p_entity_types))
      and (
        to_tsvector('simple'::regconfig, coalesce(note.notes, '') || ' ' || coalesce(note.ai_summary::text, '')) @@ input.text_query
        or lower(extensions.unaccent(coalesce(note.notes, '') || ' ' || coalesce(note.ai_summary::text, '')))
          like '%' || input.normalized_query || '%'
      )

    union all

    select
      'appointment'::text,
      appointment.id,
      appointment.patient_id,
      coalesce(patient.name, case when appointment.type = 'block' then 'Bloqueio' else 'Agendamento' end),
      concat_ws(' · ', nullif(appointment.type, ''), nullif(appointment.status, ''), nullif(appointment.location, '')),
      left(coalesce(appointment.notes, ''), 280),
      coalesce(appointment.start_time, appointment.created_at),
      case
        when lower(extensions.unaccent(coalesce(patient.name, ''))) = input.normalized_query then 0.95
        when lower(extensions.unaccent(coalesce(patient.name, ''))) like input.normalized_query || '%' then 0.91
        when lower(extensions.unaccent(coalesce(appointment.notes, '') || ' ' || coalesce(appointment.location, '')))
          like '%' || input.normalized_query || '%' then 0.78
        else greatest(
          extensions.similarity(lower(coalesce(patient.name, '')), lower(input.raw_query)),
          extensions.similarity(lower(coalesce(appointment.notes, '') || ' ' || coalesce(appointment.location, '')), lower(input.raw_query))
        ) * 0.76
      end::real,
      case
        when lower(extensions.unaccent(coalesce(patient.name, ''))) like '%' || input.normalized_query || '%' then 'appointment_patient'
        when lower(extensions.unaccent(coalesce(appointment.location, ''))) like '%' || input.normalized_query || '%' then 'appointment_location'
        else 'appointment_text'
      end::text
    from public.appointments as appointment
    left join public.patients as patient on patient.id = appointment.patient_id and patient.user_id = appointment.user_id
    cross join search_input as input
    where (select auth.uid()) is not null
      and appointment.user_id = (select auth.uid())
      and input.normalized_query <> ''
      and (input.include_all or 'appointment' = any(p_entity_types))
      and (
        lower(extensions.unaccent(coalesce(patient.name, '') || ' ' || coalesce(appointment.notes, '') || ' ' || coalesce(appointment.location, '')))
          like '%' || input.normalized_query || '%'
        or extensions.similarity(
          lower(coalesce(appointment.notes, '') || ' ' || coalesce(appointment.location, '')),
          lower(input.raw_query)
        ) >= 0.20
      )

    union all

    select
      'reminder'::text,
      reminder.id,
      null::uuid,
      reminder.title,
      case when reminder.is_completed then 'Lembrete concluído' else 'Lembrete' end,
      null::text,
      coalesce(reminder.due_date, reminder.created_at),
      case
        when lower(extensions.unaccent(reminder.title)) = input.normalized_query then 0.94
        when lower(extensions.unaccent(reminder.title)) like input.normalized_query || '%' then 0.88
        else greatest(0.72, extensions.similarity(lower(reminder.title), lower(input.raw_query)) * 0.78)
      end::real,
      'reminder_title'::text
    from public.reminders as reminder
    cross join search_input as input
    where (select auth.uid()) is not null
      and reminder.user_id = (select auth.uid())
      and input.normalized_query <> ''
      and (input.include_all or 'reminder' = any(p_entity_types))
      and (
        lower(extensions.unaccent(reminder.title)) like '%' || input.normalized_query || '%'
        or extensions.similarity(lower(reminder.title), lower(input.raw_query)) >= 0.20
      )

    union all

    select
      'personal_note'::text,
      note.id,
      note.patient_id,
      note.title,
      'Nota pessoal'::text,
      left(coalesce(note.content, ''), 280),
      coalesce(note.updated_at, note.created_at),
      greatest(
        case
          when lower(extensions.unaccent(note.title)) = input.normalized_query then 0.94
          when lower(extensions.unaccent(note.title)) like input.normalized_query || '%' then 0.89
          else 0.73
        end,
        0.70 + ts_rank(
          to_tsvector('simple'::regconfig, coalesce(note.title, '') || ' ' || coalesce(note.content, '')),
          input.text_query
        )
      )::real,
      case
        when lower(extensions.unaccent(note.title)) like '%' || input.normalized_query || '%' then 'personal_note_title'
        else 'personal_note_full_text'
      end::text
    from public.personal_notes as note
    cross join search_input as input
    where (select auth.uid()) is not null
      and note.user_id = (select auth.uid())
      and input.normalized_query <> ''
      and (input.include_all or 'personal_note' = any(p_entity_types))
      and (
        to_tsvector('simple'::regconfig, coalesce(note.title, '') || ' ' || coalesce(note.content, '')) @@ input.text_query
        or lower(extensions.unaccent(coalesce(note.title, '') || ' ' || coalesce(note.content, '')))
          like '%' || input.normalized_query || '%'
      )

    union all

    select
      'message'::text,
      message.id,
      null::uuid,
      left(message.content, 120),
      'Histórico Synapse AI'::text,
      left(message.content, 280),
      message.created_at,
      greatest(
        0.66 + ts_rank(to_tsvector('simple'::regconfig, coalesce(message.content, '')), input.text_query),
        0.68
      )::real,
      case
        when to_tsvector('simple'::regconfig, coalesce(message.content, '')) @@ input.text_query then 'message_full_text'
        else 'message_contains'
      end::text
    from public.messages as message
    cross join search_input as input
    where (select auth.uid()) is not null
      and message.user_id = (select auth.uid())
      and input.normalized_query <> ''
      and (input.include_all or 'message' = any(p_entity_types))
      and (
        to_tsvector('simple'::regconfig, coalesce(message.content, '')) @@ input.text_query
        or lower(extensions.unaccent(coalesce(message.content, ''))) like '%' || input.normalized_query || '%'
      )
  )
  select
    ranked.entity_type,
    ranked.entity_id,
    ranked.patient_id,
    ranked.title,
    nullif(ranked.subtitle, ''),
    nullif(ranked.excerpt, ''),
    ranked.occurred_at,
    ranked.score,
    ranked.match_reason
  from ranked
  order by ranked.score desc, ranked.occurred_at desc nulls last, ranked.title
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$function$;

comment on function public.search_synapse_workspace(text, text[], integer) is
  'Tenant-scoped fuzzy and full-text workspace search for the global command palette and Synapse.';

revoke all on function public.search_synapse_workspace(text, text[], integer) from public;
revoke all on function public.search_synapse_workspace(text, text[], integer) from anon;
grant execute on function public.search_synapse_workspace(text, text[], integer) to authenticated;
grant execute on function public.search_synapse_workspace(text, text[], integer) to service_role;
