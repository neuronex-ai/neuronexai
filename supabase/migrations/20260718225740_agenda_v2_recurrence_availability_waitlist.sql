-- Agenda Desktop v2: versioned availability, advanced recurrence, templates,
-- financial snapshots and the professional waitlist foundation.

create extension if not exists pgcrypto;
create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Versioned professional availability
-- ---------------------------------------------------------------------------

create table public.professional_availability_versions (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  version_number integer not null,
  timezone text not null default 'America/Sao_Paulo',
  effective_from timestamptz not null,
  status text not null default 'active'
    check (status in ('active', 'scheduled', 'superseded')),
  change_strategy text not null default 'keep_exceptions'
    check (change_strategy in ('keep_exceptions', 'resolve_before_save', 'keep_previous_until')),
  reason text,
  legacy_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(legacy_snapshot) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (professional_id, version_number)
);

create unique index professional_availability_active_uidx
  on public.professional_availability_versions (professional_id)
  where status = 'active';
create index professional_availability_effective_idx
  on public.professional_availability_versions (professional_id, effective_from desc);

create table public.professional_availability_windows (
  id uuid primary key default gen_random_uuid(),
  availability_version_id uuid not null
    references public.professional_availability_versions(id) on delete cascade,
  professional_id uuid not null references auth.users(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  check (end_time > start_time),
  unique (availability_version_id, weekday, start_time, end_time)
);

create index professional_availability_windows_lookup_idx
  on public.professional_availability_windows
  (professional_id, availability_version_id, weekday, start_time, end_time);

create table public.professional_availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  availability_version_id uuid
    references public.professional_availability_versions(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  exception_kind text not null check (exception_kind in ('blocked', 'available')),
  reason text,
  source text not null default 'professional'
    check (source in ('professional', 'holiday', 'synapse', 'migration')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index professional_availability_exceptions_lookup_idx
  on public.professional_availability_exceptions
  (professional_id, starts_at, ends_at);

create table public.professional_availability_impacts (
  id uuid primary key default gen_random_uuid(),
  availability_version_id uuid not null
    references public.professional_availability_versions(id) on delete cascade,
  professional_id uuid not null references auth.users(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  waitlist_entry_id uuid,
  impact_kind text not null check (impact_kind in ('appointment', 'series', 'waitlist')),
  resolution text not null default 'pending'
    check (resolution in ('pending', 'kept_as_exception', 'rescheduled', 'kept_previous_rule', 'dismissed')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index professional_availability_impacts_pending_idx
  on public.professional_availability_impacts
  (professional_id, availability_version_id, impact_kind, created_at)
  where resolution = 'pending';

-- Backfill the current profile JSON as version 1. This is idempotent.
insert into public.professional_availability_versions (
  professional_id,
  version_number,
  timezone,
  effective_from,
  status,
  change_strategy,
  legacy_snapshot,
  created_by
)
select
  profile.id,
  1,
  'America/Sao_Paulo',
  now(),
  'active',
  'keep_exceptions',
  coalesce(profile.working_hours, '{}'::jsonb),
  profile.id
from public.profiles profile
on conflict (professional_id, version_number) do nothing;

insert into public.professional_availability_windows (
  availability_version_id,
  professional_id,
  weekday,
  start_time,
  end_time
)
select
  version.id,
  version.professional_id,
  schedule.key::smallint,
  (schedule.value ->> 'start')::time,
  (schedule.value ->> 'end')::time
from public.professional_availability_versions version
join public.profiles profile on profile.id = version.professional_id
cross join lateral jsonb_each(coalesce(profile.working_hours, '{}'::jsonb)) schedule
where version.version_number = 1
  and coalesce((schedule.value ->> 'enabled')::boolean, false)
  and (schedule.value ->> 'start') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  and (schedule.value ->> 'end') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  and (schedule.value ->> 'end')::time > (schedule.value ->> 'start')::time
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Advanced recurrence and reusable templates
-- ---------------------------------------------------------------------------

create table public.appointment_series_templates (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  source_patient_id uuid references public.patients(id) on delete set null,
  source_series_id uuid references public.appointment_series(id) on delete set null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appointment_series_templates_owner_idx
  on public.appointment_series_templates (professional_id, is_archived, updated_at desc);

create table public.appointment_series_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.appointment_series_templates(id) on delete cascade,
  professional_id uuid not null references auth.users(id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  recurrence_rule jsonb not null check (jsonb_typeof(recurrence_rule) = 'object'),
  default_config jsonb not null default '{}'::jsonb check (jsonb_typeof(default_config) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_id, version_number)
);

alter table public.appointment_series
  drop constraint if exists appointment_series_frequency_check,
  drop constraint if exists appointment_series_total_occurrences_check,
  drop constraint if exists appointment_series_chronology_check;

alter table public.appointment_series
  alter column total_occurrences drop not null,
  alter column last_start_time drop not null,
  add column if not exists status text not null default 'active'
    check (status in ('active', 'paused', 'completed', 'cancelled')),
  add column if not exists rule_kind text not null default 'legacy'
    check (rule_kind in ('legacy', 'weekly', 'monthly', 'interval', 'custom_dates', 'range_distribution')),
  add column if not exists recurrence_rule jsonb not null default '{}'::jsonb
    check (jsonb_typeof(recurrence_rule) = 'object'),
  add column if not exists termination_kind text not null default 'count'
    check (termination_kind in ('count', 'until', 'open')),
  add column if not exists until_date date,
  add column if not exists timezone text not null default 'America/Sao_Paulo',
  add column if not exists materialized_through date,
  add column if not exists next_generation_at timestamptz,
  add column if not exists revision integer not null default 1 check (revision >= 1),
  add column if not exists availability_version_id uuid
    references public.professional_availability_versions(id) on delete set null,
  add column if not exists template_version_id uuid
    references public.appointment_series_template_versions(id) on delete set null,
  add column if not exists default_config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(default_config) = 'object'),
  add column if not exists financial_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(financial_snapshot) = 'object'),
  add constraint appointment_series_frequency_check check (
    frequency in ('single', 'weekly', 'biweekly', 'monthly', 'interval', 'custom_dates', 'range_distribution')
  ),
  add constraint appointment_series_total_occurrences_check check (
    total_occurrences is null or total_occurrences between 1 and 500
  ),
  add constraint appointment_series_chronology_check check (
    last_start_time is null or last_start_time >= first_start_time
  ),
  add constraint appointment_series_open_shape_check check (
    (termination_kind = 'open' and total_occurrences is null)
    or termination_kind <> 'open'
  );

alter table public.appointments
  drop constraint if exists appointments_occurrence_shape_check;

alter table public.appointments
  add column if not exists occurrence_status text not null default 'standard'
    check (occurrence_status in ('standard', 'adjusted', 'customized', 'conflict')),
  add column if not exists personalized_fields text[] not null default '{}',
  add column if not exists series_revision integer,
  add constraint appointments_occurrence_shape_check check (
    (
      series_id is null
      and occurrence_number is null
      and occurrence_count is null
    )
    or
    (
      series_id is not null
      and occurrence_number is not null
      and occurrence_number between 1 and 32767
      and (occurrence_count is null or (
        occurrence_count between occurrence_number and 32767
      ))
    )
  );

create index appointment_series_open_materialization_idx
  on public.appointment_series (next_generation_at, materialized_through)
  where status = 'active' and termination_kind = 'open';

create table public.appointment_occurrence_overrides (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.appointment_series(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  professional_id uuid not null references auth.users(id) on delete cascade,
  occurrence_number integer not null check (occurrence_number between 1 and 500),
  original_values jsonb not null default '{}'::jsonb check (jsonb_typeof(original_values) = 'object'),
  override_values jsonb not null check (jsonb_typeof(override_values) = 'object'),
  changed_fields text[] not null check (cardinality(changed_fields) > 0),
  source text not null default 'professional'
    check (source in ('professional', 'synapse', 'availability_change')),
  reason text,
  action_plan_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (series_id, occurrence_number)
);

create index appointment_occurrence_overrides_owner_idx
  on public.appointment_occurrence_overrides (professional_id, series_id, occurrence_number);

-- ---------------------------------------------------------------------------
-- Professional waitlist (separate from the public marketing waitlist)
-- ---------------------------------------------------------------------------

create table public.professional_waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  availability_version_id uuid
    references public.professional_availability_versions(id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'paused', 'offered', 'scheduled', 'expired', 'removed')),
  priority smallint not null default 3 check (priority between 1 and 5),
  valid_from date not null default current_date,
  valid_until date,
  minimum_duration_minutes integer not null default 50
    check (minimum_duration_minutes between 15 and 1440),
  preferred_duration_minutes integer not null default 50
    check (preferred_duration_minutes between 15 and 1440),
  modality text check (modality in ('presencial', 'online')),
  location text,
  offer_automatically boolean not null default true,
  rules_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(rules_snapshot) = 'object'),
  offer_count integer not null default 0 check (offer_count >= 0),
  last_offered_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (preferred_duration_minutes >= minimum_duration_minutes),
  check (valid_until is null or valid_until >= valid_from)
);

create index professional_waitlist_entries_queue_idx
  on public.professional_waitlist_entries
  (professional_id, status, priority, created_at)
  where status in ('active', 'offered');

create table public.professional_waitlist_windows (
  id uuid primary key default gen_random_uuid(),
  waitlist_entry_id uuid not null
    references public.professional_waitlist_entries(id) on delete cascade,
  professional_id uuid not null references auth.users(id) on delete cascade,
  weekday smallint check (weekday between 0 and 6),
  specific_date date,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  check ((weekday is not null) <> (specific_date is not null)),
  check (end_time > start_time)
);

create index professional_waitlist_windows_match_idx
  on public.professional_waitlist_windows
  (professional_id, weekday, specific_date, start_time, end_time);

create table public.appointment_slot_holds (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  waitlist_entry_id uuid
    references public.professional_waitlist_entries(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'active'
    check (status in ('active', 'accepted', 'declined', 'expired', 'released')),
  expires_at timestamptz not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  check (ends_at > starts_at),
  check (expires_at > created_at),
  unique (professional_id, idempotency_key)
);

create index appointment_slot_holds_active_idx
  on public.appointment_slot_holds (professional_id, starts_at, ends_at, expires_at)
  where status = 'active';

create table public.professional_waitlist_offers (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  waitlist_entry_id uuid not null
    references public.professional_waitlist_entries(id) on delete cascade,
  hold_id uuid not null references public.appointment_slot_holds(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired', 'superseded')),
  offered_start_time timestamptz not null,
  offered_end_time timestamptz not null,
  expires_at timestamptz not null,
  accepted_appointment_id uuid references public.appointments(id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  check (offered_end_time > offered_start_time),
  check (expires_at > created_at)
);

create index professional_waitlist_offers_active_idx
  on public.professional_waitlist_offers (professional_id, status, expires_at)
  where status = 'pending';

create table public.professional_waitlist_events (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  waitlist_entry_id uuid not null
    references public.professional_waitlist_entries(id) on delete cascade,
  offer_id uuid references public.professional_waitlist_offers(id) on delete set null,
  event_type text not null,
  actor_type text not null check (actor_type in ('professional', 'patient', 'synapse', 'system')),
  safe_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(safe_metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index professional_waitlist_events_entry_idx
  on public.professional_waitlist_events (professional_id, waitlist_entry_id, created_at desc);

create table public.professional_waitlist_offer_outbox (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  offer_id uuid not null references public.professional_waitlist_offers(id) on delete cascade,
  template_key text not null default 'appointment_waitlist_offer',
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'delivered', 'failed', 'cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  idempotency_key text not null unique,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create index professional_waitlist_offer_outbox_pending_idx
  on public.professional_waitlist_offer_outbox (next_attempt_at, created_at)
  where status in ('pending', 'failed');

alter table public.professional_availability_impacts
  add constraint professional_availability_impacts_waitlist_fkey
  foreign key (waitlist_entry_id)
  references public.professional_waitlist_entries(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- RLS and Data API grants
-- ---------------------------------------------------------------------------

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'professional_availability_versions',
    'professional_availability_windows',
    'professional_availability_exceptions',
    'professional_availability_impacts',
    'appointment_series_templates',
    'appointment_series_template_versions',
    'appointment_occurrence_overrides',
    'professional_waitlist_entries',
    'professional_waitlist_windows',
    'appointment_slot_holds',
    'professional_waitlist_offers',
    'professional_waitlist_events',
    'professional_waitlist_offer_outbox'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
  end loop;
end
$$;

create policy availability_versions_owner_select
  on public.professional_availability_versions for select to authenticated
  using (professional_id = (select auth.uid()));
create policy availability_windows_owner_select
  on public.professional_availability_windows for select to authenticated
  using (professional_id = (select auth.uid()));
create policy availability_exceptions_owner_all
  on public.professional_availability_exceptions for all to authenticated
  using (professional_id = (select auth.uid()))
  with check (professional_id = (select auth.uid()));
create policy availability_impacts_owner_select
  on public.professional_availability_impacts for select to authenticated
  using (professional_id = (select auth.uid()));

create policy series_templates_owner_all
  on public.appointment_series_templates for all to authenticated
  using (professional_id = (select auth.uid()))
  with check (professional_id = (select auth.uid()));
create policy series_template_versions_owner_all
  on public.appointment_series_template_versions for all to authenticated
  using (professional_id = (select auth.uid()))
  with check (professional_id = (select auth.uid()));
create policy appointment_occurrence_overrides_owner_select
  on public.appointment_occurrence_overrides for select to authenticated
  using (professional_id = (select auth.uid()));

create policy professional_waitlist_entries_owner_all
  on public.professional_waitlist_entries for all to authenticated
  using (professional_id = (select auth.uid()))
  with check (
    professional_id = (select auth.uid())
    and exists (
      select 1 from public.patients patient
      where patient.id = patient_id
        and patient.user_id = (select auth.uid())
    )
  );
create policy professional_waitlist_windows_owner_all
  on public.professional_waitlist_windows for all to authenticated
  using (professional_id = (select auth.uid()))
  with check (
    professional_id = (select auth.uid())
    and exists (
      select 1 from public.professional_waitlist_entries entry
      where entry.id = waitlist_entry_id
        and entry.professional_id = (select auth.uid())
    )
  );
create policy appointment_slot_holds_owner_select
  on public.appointment_slot_holds for select to authenticated
  using (professional_id = (select auth.uid()));
create policy professional_waitlist_offers_owner_select
  on public.professional_waitlist_offers for select to authenticated
  using (professional_id = (select auth.uid()));
create policy professional_waitlist_events_owner_select
  on public.professional_waitlist_events for select to authenticated
  using (professional_id = (select auth.uid()));

grant select on public.professional_availability_versions,
  public.professional_availability_windows,
  public.professional_availability_impacts,
  public.appointment_occurrence_overrides,
  public.appointment_slot_holds,
  public.professional_waitlist_offers,
  public.professional_waitlist_events
to authenticated;
grant select, insert, update, delete on public.professional_availability_exceptions,
  public.appointment_series_templates,
  public.appointment_series_template_versions,
  public.professional_waitlist_entries,
  public.professional_waitlist_windows
to authenticated;

comment on table public.professional_waitlist_entries is
  'Operational professional waitlist. It is intentionally separate from the public product waitlist.';
comment on table public.appointment_slot_holds is
  'Short-lived slot reservations that participate in the same professional scheduling lock as appointments.';
comment on column public.appointment_series.recurrence_rule is
  'Versioned recurrence intent. Materialized appointments remain independent canonical rows.';
