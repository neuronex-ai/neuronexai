-- Package coverage for appointment series is versioned per occurrence.
-- Historical consumption, payments and fiscal documents remain attached to
-- the binding that existed when they happened. Provider calls are delegated
-- to the outbox and never run inside these database transactions.

begin;

create schema if not exists private;

alter table public.patient_packages
  add column if not exists sessions_reserved integer not null default 0,
  add column if not exists ended_at timestamptz,
  add column if not exists ended_reason text,
  add column if not exists replaced_by_package_id uuid,
  add column if not exists ended_by uuid,
  add column if not exists ended_origin text,
  add column if not exists billing_status text not null default 'unconfigured',
  add column if not exists default_payment_method text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.patient_packages'::regclass
      and conname = 'patient_packages_replaced_by_package_id_fkey'
  ) then
    alter table public.patient_packages
      add constraint patient_packages_replaced_by_package_id_fkey
      foreign key (replaced_by_package_id)
      references public.patient_packages(id)
      on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.patient_packages'::regclass
      and conname = 'patient_packages_ended_by_fkey'
  ) then
    alter table public.patient_packages
      add constraint patient_packages_ended_by_fkey
      foreign key (ended_by)
      references auth.users(id)
      on delete set null;
  end if;
end
$$;

alter table public.patient_packages
  drop constraint if exists patient_packages_package_status_check;
alter table public.patient_packages
  add constraint patient_packages_package_status_check
  check (package_status in ('active', 'paused', 'completed', 'cancelled', 'ended', 'replaced'))
  not valid;
alter table public.patient_packages
  validate constraint patient_packages_package_status_check;

alter table public.patient_packages
  drop constraint if exists patient_packages_billing_status_check;
alter table public.patient_packages
  add constraint patient_packages_billing_status_check
  check (billing_status in ('unconfigured', 'pending', 'partially_paid', 'paid', 'cancelled'));

alter table public.patient_packages
  drop constraint if exists patient_packages_session_balance_check;
alter table public.patient_packages
  add constraint patient_packages_session_balance_check
  check (
    sessions_used >= 0
    and sessions_reserved >= 0
    and sessions_used + sessions_reserved <= total_sessions
  ) not valid;

create index if not exists patient_packages_replaced_by_idx
  on public.patient_packages(replaced_by_package_id)
  where replaced_by_package_id is not null;
create index if not exists patient_packages_capacity_idx
  on public.patient_packages(user_id, patient_id, package_status, end_date)
  where package_status = 'active';

create table public.appointment_package_bindings (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete restrict,
  series_id uuid references public.appointment_series(id) on delete set null,
  package_id uuid not null references public.patient_packages(id) on delete restrict,
  professional_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete restrict,
  status text not null default 'reserved'
    check (status in ('reserved', 'consumed', 'released', 'replaced', 'reversed', 'cancelled')),
  bound_at timestamptz not null default now(),
  released_at timestamptz,
  consumed_at timestamptz,
  replaced_by_binding_id uuid,
  source text not null default 'professional_app',
  reason text,
  idempotency_key text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_package_bindings_replaced_by_fkey
    foreign key (replaced_by_binding_id)
    references public.appointment_package_bindings(id)
    on delete restrict,
  constraint appointment_package_bindings_terminal_dates_check check (
    (status = 'reserved' and released_at is null and consumed_at is null)
    or (status = 'consumed' and consumed_at is not null)
    or (status in ('released', 'replaced', 'reversed', 'cancelled') and released_at is not null)
  )
);

create unique index appointment_package_bindings_idempotency_uidx
  on public.appointment_package_bindings(professional_id, idempotency_key);
create unique index appointment_package_bindings_current_appointment_uidx
  on public.appointment_package_bindings(appointment_id)
  where status in ('reserved', 'consumed');
create index appointment_package_bindings_package_status_idx
  on public.appointment_package_bindings(package_id, status, bound_at desc);
create index appointment_package_bindings_series_idx
  on public.appointment_package_bindings(series_id, status, appointment_id)
  where series_id is not null;
create index appointment_package_bindings_professional_idx
  on public.appointment_package_bindings(professional_id, created_at desc);
create index appointment_package_bindings_patient_idx
  on public.appointment_package_bindings(patient_id, created_at desc);
create index appointment_package_bindings_replaced_by_idx
  on public.appointment_package_bindings(replaced_by_binding_id)
  where replaced_by_binding_id is not null;

drop trigger if exists appointment_package_bindings_touch_updated_at
  on public.appointment_package_bindings;
create trigger appointment_package_bindings_touch_updated_at
before update on public.appointment_package_bindings
for each row execute function public.update_updated_at_column();

alter table public.patient_package_session_usages
  add column if not exists binding_id uuid,
  add column if not exists series_id uuid,
  add column if not exists source text not null default 'professional_app';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.patient_package_session_usages'::regclass
      and conname = 'patient_package_session_usages_binding_id_fkey'
  ) then
    alter table public.patient_package_session_usages
      add constraint patient_package_session_usages_binding_id_fkey
      foreign key (binding_id)
      references public.appointment_package_bindings(id)
      on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.patient_package_session_usages'::regclass
      and conname = 'patient_package_session_usages_series_id_fkey'
  ) then
    alter table public.patient_package_session_usages
      add constraint patient_package_session_usages_series_id_fkey
      foreign key (series_id)
      references public.appointment_series(id)
      on delete set null;
  end if;
end
$$;

alter table public.patient_package_session_usages
  drop constraint if exists patient_package_session_usages_action_check;
alter table public.patient_package_session_usages
  drop constraint if exists patient_package_session_usages_reverse_check;
alter table public.patient_package_session_usages
  add constraint patient_package_session_usages_action_check
  check (action in ('reserve', 'consume', 'release', 'reverse'));
alter table public.patient_package_session_usages
  add constraint patient_package_session_usages_reference_check check (
    (action in ('reserve', 'consume') and reverses_usage_id is null)
    or (action in ('release', 'reverse') and reverses_usage_id is not null and length(btrim(reason)) >= 3)
  );

drop index if exists public.patient_package_session_usages_appointment_uidx;
create unique index patient_package_session_usages_binding_action_uidx
  on public.patient_package_session_usages(binding_id, action)
  where binding_id is not null;
create index patient_package_session_usages_series_idx
  on public.patient_package_session_usages(series_id, created_at desc)
  where series_id is not null;
create index patient_package_session_usages_binding_idx
  on public.patient_package_session_usages(binding_id, created_at desc)
  where binding_id is not null;

create table public.package_replacement_operations (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete restrict,
  series_id uuid references public.appointment_series(id) on delete set null,
  source_package_id uuid not null references public.patient_packages(id) on delete restrict,
  target_package_id uuid references public.patient_packages(id) on delete restrict,
  operation_type text not null check (operation_type in ('replace', 'end', 'release')),
  scope text not null check (scope in ('only_this', 'this_and_next', 'all_future')),
  anchor_appointment_id uuid references public.appointments(id) on delete restrict,
  financial_strategy text not null check (
    financial_strategy in (
      'keep_existing',
      'cancel_and_recreate_per_session',
      'cancel_and_create_single',
      'cancel_without_replacement',
      'manual_review'
    )
  ),
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'pending_financial', 'review_required', 'failed')),
  affected_appointments integer not null default 0,
  reason text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action_origin text not null default 'professional_app',
  idempotency_key text not null,
  preview_snapshot jsonb not null default '{}'::jsonb,
  financial_summary jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index package_replacement_operations_idempotency_uidx
  on public.package_replacement_operations(professional_id, idempotency_key);
create index package_replacement_operations_source_idx
  on public.package_replacement_operations(source_package_id, created_at desc);
create index package_replacement_operations_target_idx
  on public.package_replacement_operations(target_package_id, created_at desc)
  where target_package_id is not null;
create index package_replacement_operations_patient_idx
  on public.package_replacement_operations(patient_id, created_at desc);
create index package_replacement_operations_series_idx
  on public.package_replacement_operations(series_id, created_at desc)
  where series_id is not null;
create index package_replacement_operations_anchor_idx
  on public.package_replacement_operations(anchor_appointment_id)
  where anchor_appointment_id is not null;

drop trigger if exists package_replacement_operations_touch_updated_at
  on public.package_replacement_operations;
create trigger package_replacement_operations_touch_updated_at
before update on public.package_replacement_operations
for each row execute function public.update_updated_at_column();

create table public.appointment_financial_coverages (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete restrict,
  binding_id uuid not null references public.appointment_package_bindings(id) on delete restrict,
  package_id uuid not null references public.patient_packages(id) on delete restrict,
  professional_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete restrict,
  financial_entry_id uuid references public.financial_entries(id) on delete restrict,
  payment_id uuid references public.nb_payments(id) on delete restrict,
  status text not null default 'active'
    check (status in ('active', 'preserved', 'replaced', 'cancellation_requested', 'review_required')),
  covered_at timestamptz not null default now(),
  released_at timestamptz,
  replaced_by_coverage_id uuid,
  source text not null default 'package_binding',
  reason text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  constraint appointment_financial_coverages_reference_check
    check (financial_entry_id is not null or payment_id is not null),
  constraint appointment_financial_coverages_replaced_by_fkey
    foreign key (replaced_by_coverage_id)
    references public.appointment_financial_coverages(id)
    on delete restrict
);

create unique index appointment_financial_coverages_idempotency_uidx
  on public.appointment_financial_coverages(professional_id, idempotency_key);
create index appointment_financial_coverages_appointment_idx
  on public.appointment_financial_coverages(appointment_id, covered_at desc);
create index appointment_financial_coverages_binding_idx
  on public.appointment_financial_coverages(binding_id, status, covered_at desc);
create index appointment_financial_coverages_package_idx
  on public.appointment_financial_coverages(package_id, status, covered_at desc);
create index appointment_financial_coverages_entry_idx
  on public.appointment_financial_coverages(financial_entry_id, status)
  where financial_entry_id is not null;
create index appointment_financial_coverages_payment_idx
  on public.appointment_financial_coverages(payment_id, status)
  where payment_id is not null;
create index appointment_financial_coverages_replaced_by_idx
  on public.appointment_financial_coverages(replaced_by_coverage_id)
  where replaced_by_coverage_id is not null;

create table public.package_financial_adjustment_outbox (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.package_replacement_operations(id) on delete restrict,
  professional_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete restrict,
  appointment_id uuid references public.appointments(id) on delete restrict,
  source_package_id uuid not null references public.patient_packages(id) on delete restrict,
  target_package_id uuid references public.patient_packages(id) on delete restrict,
  financial_entry_id uuid references public.financial_entries(id) on delete restrict,
  payment_id uuid references public.nb_payments(id) on delete restrict,
  task_type text not null check (
    task_type in (
      'cancel_charge',
      'cancel_financial_entry',
      'create_per_session_charge',
      'create_package_charge',
      'manual_financial_review',
      'manual_fiscal_review'
    )
  ),
  status text not null default 'pending'
    check (status in ('pending', 'blocked', 'processing', 'succeeded', 'failed', 'review_required', 'cancelled')),
  depends_on_idempotency_key text,
  idempotency_key text not null,
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  next_attempt_at timestamptz,
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index package_financial_adjustment_outbox_idempotency_uidx
  on public.package_financial_adjustment_outbox(professional_id, idempotency_key);
create index package_financial_adjustment_outbox_ready_idx
  on public.package_financial_adjustment_outbox(status, available_at, created_at)
  where status in ('pending', 'failed');
create index package_financial_adjustment_outbox_operation_idx
  on public.package_financial_adjustment_outbox(operation_id, created_at);
create index package_financial_adjustment_outbox_appointment_idx
  on public.package_financial_adjustment_outbox(appointment_id, created_at)
  where appointment_id is not null;
create index package_financial_adjustment_outbox_source_idx
  on public.package_financial_adjustment_outbox(source_package_id, created_at);
create index package_financial_adjustment_outbox_target_idx
  on public.package_financial_adjustment_outbox(target_package_id, created_at)
  where target_package_id is not null;
create index package_financial_adjustment_outbox_entry_idx
  on public.package_financial_adjustment_outbox(financial_entry_id)
  where financial_entry_id is not null;
create index package_financial_adjustment_outbox_payment_idx
  on public.package_financial_adjustment_outbox(payment_id)
  where payment_id is not null;

drop trigger if exists package_financial_adjustment_outbox_touch_updated_at
  on public.package_financial_adjustment_outbox;
create trigger package_financial_adjustment_outbox_touch_updated_at
before update on public.package_financial_adjustment_outbox
for each row execute function public.update_updated_at_column();

alter table public.appointment_package_bindings enable row level security;
alter table public.package_replacement_operations enable row level security;
alter table public.appointment_financial_coverages enable row level security;
alter table public.package_financial_adjustment_outbox enable row level security;

create policy appointment_package_bindings_read_own
  on public.appointment_package_bindings for select to authenticated
  using ((select auth.uid()) = professional_id);
create policy package_replacement_operations_read_own
  on public.package_replacement_operations for select to authenticated
  using ((select auth.uid()) = professional_id);
create policy appointment_financial_coverages_read_own
  on public.appointment_financial_coverages for select to authenticated
  using ((select auth.uid()) = professional_id);
create policy package_financial_adjustment_outbox_read_own
  on public.package_financial_adjustment_outbox for select to authenticated
  using ((select auth.uid()) = professional_id);

revoke all on table public.appointment_package_bindings from public, anon, authenticated;
revoke all on table public.package_replacement_operations from public, anon, authenticated;
revoke all on table public.appointment_financial_coverages from public, anon, authenticated;
revoke all on table public.package_financial_adjustment_outbox from public, anon, authenticated;
grant select on table public.appointment_package_bindings to authenticated;
grant select on table public.package_replacement_operations to authenticated;
grant select on table public.appointment_financial_coverages to authenticated;
grant select on table public.package_financial_adjustment_outbox to authenticated;
grant all on table public.appointment_package_bindings to service_role;
grant all on table public.package_replacement_operations to service_role;
grant all on table public.appointment_financial_coverages to service_role;
grant all on table public.package_financial_adjustment_outbox to service_role;

-- Convert the compatibility bridge into versioned historical bindings. Existing
-- consumption counters are deliberately not recalculated by this backfill.
insert into public.appointment_package_bindings (
  appointment_id,
  series_id,
  package_id,
  professional_id,
  patient_id,
  status,
  bound_at,
  released_at,
  consumed_at,
  source,
  reason,
  idempotency_key,
  created_by
)
select
  appointment.id,
  appointment.series_id,
  appointment.package_id,
  appointment.user_id,
  appointment.patient_id,
  case
    when lower(coalesce(appointment.status, '')) in ('completed', 'closed')
      or exists (
        select 1
        from public.patient_package_session_usages usage
        where usage.appointment_id = appointment.id
          and usage.package_id = appointment.package_id
          and usage.action = 'consume'
      ) then 'consumed'
    else 'reserved'
  end,
  coalesce(appointment.created_at, now()),
  null,
  case
    when lower(coalesce(appointment.status, '')) in ('completed', 'closed')
      or exists (
        select 1
        from public.patient_package_session_usages usage
        where usage.appointment_id = appointment.id
          and usage.package_id = appointment.package_id
          and usage.action = 'consume'
      ) then coalesce(appointment.updated_at, appointment.end_time, now())
    else null
  end,
  'migration',
  'Vínculo histórico migrado do agendamento',
  'legacy-binding:' || appointment.id::text,
  appointment.created_by
from public.appointments appointment
where appointment.package_id is not null
  and appointment.patient_id is not null
  and (
    lower(coalesce(appointment.status, '')) in ('completed', 'closed')
    or exists (
      select 1
      from public.patient_package_session_usages usage
      where usage.appointment_id = appointment.id
        and usage.package_id = appointment.package_id
        and usage.action = 'consume'
    )
    or (
      appointment.start_time > now()
      and lower(coalesce(appointment.status, '')) not in ('cancelled', 'canceled')
      and lower(coalesce(appointment.lifecycle_status, '')) <> 'cancelled'
    )
  )
on conflict (professional_id, idempotency_key) do nothing;

update public.patient_package_session_usages usage
set
  binding_id = binding.id,
  series_id = binding.series_id,
  source = coalesce(nullif(usage.source, ''), 'migration')
from public.appointment_package_bindings binding
where usage.binding_id is null
  and usage.appointment_id = binding.appointment_id
  and usage.package_id = binding.package_id
  and usage.action = 'consume';

insert into public.patient_package_session_usages (
  professional_id,
  package_id,
  patient_id,
  appointment_id,
  binding_id,
  series_id,
  action,
  reason,
  idempotency_key,
  source,
  metadata
)
select
  binding.professional_id,
  binding.package_id,
  binding.patient_id,
  binding.appointment_id,
  binding.id,
  binding.series_id,
  case binding.status when 'consumed' then 'consume' else 'reserve' end,
  case binding.status
    when 'consumed' then 'Consumo histórico migrado'
    else 'Reserva histórica migrada'
  end,
  'legacy-' || binding.status || ':' || binding.appointment_id::text,
  'migration',
  jsonb_build_object('migrated', true)
from public.appointment_package_bindings binding
where not exists (
  select 1
  from public.patient_package_session_usages usage
  where usage.binding_id = binding.id
    and usage.action = case binding.status when 'consumed' then 'consume' else 'reserve' end
)
on conflict (professional_id, idempotency_key) do nothing;

update public.patient_packages package
set sessions_reserved = reserved.count
from (
  select binding.package_id, count(*)::integer as count
  from public.appointment_package_bindings binding
  where binding.status = 'reserved'
  group by binding.package_id
) reserved
where package.id = reserved.package_id;

insert into public.appointment_financial_coverages (
  appointment_id,
  binding_id,
  package_id,
  professional_id,
  patient_id,
  financial_entry_id,
  payment_id,
  status,
  covered_at,
  source,
  reason,
  idempotency_key
)
select
  binding.appointment_id,
  binding.id,
  binding.package_id,
  binding.professional_id,
  binding.patient_id,
  entry.id,
  entry.neurofinance_charge_id,
  'active',
  coalesce(entry.created_at, binding.bound_at),
  'migration',
  'Cobertura financeira histórica migrada',
  'legacy-financial-entry:' || entry.id::text
from public.appointment_package_bindings binding
join public.financial_entries entry on entry.appointment_id = binding.appointment_id
on conflict (professional_id, idempotency_key) do nothing;

insert into public.appointment_financial_coverages (
  appointment_id,
  binding_id,
  package_id,
  professional_id,
  patient_id,
  payment_id,
  status,
  covered_at,
  source,
  reason,
  idempotency_key
)
select
  binding.appointment_id,
  binding.id,
  binding.package_id,
  binding.professional_id,
  binding.patient_id,
  payment.id,
  'active',
  coalesce(payment.created_at, binding.bound_at),
  'migration',
  'Cobertura da cobrança histórica migrada',
  'legacy-payment:' || payment.id::text
from public.appointment_package_bindings binding
join public.nb_payments payment on payment.appointment_id = binding.appointment_id
where not exists (
  select 1
  from public.appointment_financial_coverages coverage
  where coverage.payment_id = payment.id
)
on conflict (professional_id, idempotency_key) do nothing;

-- The legacy trigger updates every active package for the patient. It must not
-- coexist with explicit per-appointment bindings.
drop trigger if exists tr_sync_package_sessions on public.appointments;
drop function if exists public.sync_package_sessions();

create or replace function private.capture_package_usage_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_type text;
  v_package_name text;
begin
  if new.appointment_id is null then
    return new;
  end if;

  select package.description into v_package_name
  from public.patient_packages package
  where package.id = new.package_id;

  v_event_type := case new.action
    when 'reserve' then 'package_sessions_reserved'
    when 'consume' then 'package_session_consumed'
    when 'release' then 'package_reservation_released'
    when 'reverse' then 'package_session_reversed'
  end;

  perform private.append_appointment_event(
    new.appointment_id,
    v_event_type,
    null,
    null,
    'system',
    null,
    case when new.source = 'migration' then 'migration' else 'professional_app' end,
    jsonb_strip_nulls(jsonb_build_object(
      'packageName', v_package_name,
      'reason', new.reason
    )),
    'package-usage:' || new.id::text || ':' || new.action
  );

  return new;
end;
$$;

drop trigger if exists package_usages_capture_appointment_event
  on public.patient_package_session_usages;
create trigger package_usages_capture_appointment_event
after insert on public.patient_package_session_usages
for each row execute function private.capture_package_usage_event();

revoke all on function private.capture_package_usage_event()
  from public, anon, authenticated;

create or replace function private.consume_appointment_package_binding(
  p_professional_id uuid,
  p_appointment_id uuid,
  p_reason text,
  p_idempotency_key text,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_binding public.appointment_package_bindings%rowtype;
  v_package public.patient_packages%rowtype;
  v_usage_id uuid;
  v_existing_binding_id uuid;
begin
  select usage.id, usage.binding_id
  into v_usage_id, v_existing_binding_id
  from public.patient_package_session_usages usage
  where usage.professional_id = p_professional_id
    and usage.idempotency_key = p_idempotency_key;

  if v_usage_id is not null then
    select binding.* into v_binding
    from public.appointment_package_bindings binding
    where binding.id = v_existing_binding_id;
    select package.* into v_package
    from public.patient_packages package
    where package.id = v_binding.package_id;
    return jsonb_build_object(
      'consumed', true,
      'usageId', v_usage_id,
      'bindingId', v_binding.id,
      'packageId', v_binding.package_id,
      'sessionsUsed', v_package.sessions_used,
      'sessionsReserved', v_package.sessions_reserved,
      'remainingSessions', greatest(
        v_package.total_sessions - v_package.sessions_used - v_package.sessions_reserved,
        0
      ),
      'idempotentReplay', true
    );
  end if;

  select binding.* into v_binding
  from public.appointment_package_bindings binding
  where binding.appointment_id = p_appointment_id
    and binding.professional_id = p_professional_id
    and binding.status = 'reserved'
  for update;

  if not found then
    return jsonb_build_object('consumed', false, 'reason', 'no_reserved_binding');
  end if;

  select package.* into v_package
  from public.patient_packages package
  where package.id = v_binding.package_id
  for update;

  insert into public.patient_package_session_usages (
    professional_id,
    package_id,
    patient_id,
    appointment_id,
    binding_id,
    series_id,
    action,
    reason,
    idempotency_key,
    source,
    metadata
  ) values (
    p_professional_id,
    v_binding.package_id,
    v_binding.patient_id,
    v_binding.appointment_id,
    v_binding.id,
    v_binding.series_id,
    'consume',
    coalesce(nullif(btrim(p_reason), ''), 'Sessão realizada'),
    p_idempotency_key,
    'professional_app',
    jsonb_build_object('actorUserId', p_actor_user_id)
  )
  returning id into v_usage_id;

  update public.appointment_package_bindings
  set status = 'consumed', consumed_at = now(), updated_at = now()
  where id = v_binding.id;

  update public.patient_packages
  set
    sessions_reserved = greatest(sessions_reserved - 1, 0),
    sessions_used = sessions_used + 1,
    package_status = case
      when sessions_used + 1 >= total_sessions then 'completed'
      else package_status
    end
  where id = v_binding.package_id
  returning * into v_package;

  return jsonb_build_object(
    'consumed', true,
    'usageId', v_usage_id,
    'bindingId', v_binding.id,
    'packageId', v_binding.package_id,
    'sessionsUsed', v_package.sessions_used,
    'sessionsReserved', v_package.sessions_reserved,
    'remainingSessions', greatest(
      v_package.total_sessions - v_package.sessions_used - v_package.sessions_reserved,
      0
    ),
    'idempotentReplay', false
  );
end;
$$;

revoke all on function private.consume_appointment_package_binding(uuid, uuid, text, text, uuid)
  from public, anon, authenticated;

create or replace function public.consume_patient_package_session(
  p_package_id uuid,
  p_patient_id uuid,
  p_appointment_id uuid default null,
  p_idempotency_key text default null,
  p_reason text default 'Sessão realizada'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
  v_key text;
begin
  if v_user_id is null then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;
  if p_appointment_id is null then
    raise exception 'O consumo exige um agendamento vinculado.' using errcode = '22023';
  end if;
  v_key := coalesce(nullif(btrim(p_idempotency_key), ''), 'consume:' || p_appointment_id::text);
  if not exists (
    select 1
    from public.appointment_package_bindings binding
    where binding.appointment_id = p_appointment_id
      and binding.package_id = p_package_id
      and binding.patient_id = p_patient_id
      and binding.professional_id = v_user_id
      and binding.status = 'reserved'
    union all
    select 1
    from public.patient_package_session_usages usage
    where usage.professional_id = v_user_id
      and usage.package_id = p_package_id
      and usage.patient_id = p_patient_id
      and usage.appointment_id = p_appointment_id
      and usage.idempotency_key = v_key
  ) then
    raise exception 'Não existe reserva ativa deste pacote para o agendamento.' using errcode = '22023';
  end if;

  v_result := private.consume_appointment_package_binding(
    v_user_id,
    p_appointment_id,
    p_reason,
    v_key,
    v_user_id
  );
  return v_result;
end;
$$;

revoke all on function public.consume_patient_package_session(uuid, uuid, uuid, text, text)
  from public, anon;
grant execute on function public.consume_patient_package_session(uuid, uuid, uuid, text, text)
  to authenticated, service_role;

create or replace function private.consume_bound_package_on_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(coalesce(new.status, '')) = 'completed'
    and lower(coalesce(old.status, '')) <> 'completed'
  then
    perform private.consume_appointment_package_binding(
      new.user_id,
      new.id,
      'Sessão concluída no agendamento',
      'appointment-completed:' || new.id::text,
      new.updated_by
    );
  end if;
  return new;
end;
$$;

drop trigger if exists tr_consume_bound_package_session on public.appointments;
create trigger tr_consume_bound_package_session
after update of status on public.appointments
for each row execute function private.consume_bound_package_on_completion();

revoke all on function private.consume_bound_package_on_completion()
  from public, anon, authenticated;

create or replace function private.reserve_package_appointments(
  p_professional_id uuid,
  p_patient_id uuid,
  p_package_id uuid,
  p_appointment_ids uuid[],
  p_source text,
  p_idempotency_prefix text,
  p_created_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_package public.patient_packages%rowtype;
  v_appointment public.appointments%rowtype;
  v_binding_id uuid;
  v_count integer := coalesce(array_length(p_appointment_ids, 1), 0);
  v_reserved integer := 0;
begin
  if v_count = 0 then
    return jsonb_build_object('reserved', 0, 'bindingIds', '[]'::jsonb);
  end if;

  select package.* into v_package
  from public.patient_packages package
  where package.id = p_package_id
    and package.user_id = p_professional_id
    and package.patient_id = p_patient_id
  for update;

  if not found then
    raise exception 'Pacote não encontrado para este paciente.' using errcode = 'P0002';
  end if;
  if v_package.package_status <> 'active'
    or lower(coalesce(v_package.active, 'true')) not in ('true', '1', 'yes', 'active')
    or (v_package.end_date is not null and v_package.end_date < current_date)
  then
    raise exception 'O pacote não está ativo ou está fora da validade.' using errcode = '22023';
  end if;
  if v_package.total_sessions - v_package.sessions_used - v_package.sessions_reserved < v_count then
    raise exception 'O pacote não possui saldo para todas as ocorrências.' using errcode = '22023';
  end if;

  for v_appointment in
    select appointment.*
    from public.appointments appointment
    where appointment.id = any(p_appointment_ids)
    order by appointment.start_time, appointment.id
    for update
  loop
    if v_appointment.user_id <> p_professional_id
      or v_appointment.patient_id is distinct from p_patient_id
    then
      raise exception 'Agendamento incompatível com o pacote.' using errcode = '42501';
    end if;
    if v_appointment.start_time <= now()
      or lower(coalesce(v_appointment.status, '')) in ('completed', 'cancelled', 'canceled')
    then
      raise exception 'Somente ocorrências futuras podem ser reservadas.' using errcode = '22023';
    end if;
    if v_package.start_date is not null
      and (v_appointment.start_time at time zone 'America/Sao_Paulo')::date < v_package.start_date
    then
      raise exception 'Uma ocorrência começa antes da validade do pacote.' using errcode = '22023';
    end if;
    if v_package.end_date is not null
      and (v_appointment.start_time at time zone 'America/Sao_Paulo')::date > v_package.end_date
    then
      raise exception 'Uma ocorrência ultrapassa a validade do pacote.' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.appointment_package_bindings binding
      where binding.appointment_id = v_appointment.id
        and binding.status in ('reserved', 'consumed')
    ) then
      raise exception 'Uma ocorrência já possui pacote ativo.' using errcode = '23505';
    end if;

    insert into public.appointment_package_bindings (
      appointment_id,
      series_id,
      package_id,
      professional_id,
      patient_id,
      status,
      source,
      reason,
      idempotency_key,
      created_by
    ) values (
      v_appointment.id,
      v_appointment.series_id,
      p_package_id,
      p_professional_id,
      p_patient_id,
      'reserved',
      p_source,
      'Sessão reservada no pacote',
      p_idempotency_prefix || ':binding:' || v_appointment.id::text,
      p_created_by
    )
    returning id into v_binding_id;

    insert into public.patient_package_session_usages (
      professional_id,
      package_id,
      patient_id,
      appointment_id,
      binding_id,
      series_id,
      action,
      reason,
      idempotency_key,
      source
    ) values (
      p_professional_id,
      p_package_id,
      p_patient_id,
      v_appointment.id,
      v_binding_id,
      v_appointment.series_id,
      'reserve',
      'Sessão reservada no pacote',
      p_idempotency_prefix || ':reserve:' || v_appointment.id::text,
      p_source
    );

    update public.appointments
    set package_id = p_package_id,
        updated_by = p_created_by,
        action_origin = p_source
    where id = v_appointment.id;

    v_reserved := v_reserved + 1;
  end loop;

  if v_reserved <> v_count then
    raise exception 'Nem todas as ocorrências foram encontradas para reserva.' using errcode = '22023';
  end if;

  update public.patient_packages
  set sessions_reserved = sessions_reserved + v_reserved
  where id = p_package_id;

  return jsonb_build_object('reserved', v_reserved);
end;
$$;

revoke all on function private.reserve_package_appointments(uuid, uuid, uuid, uuid[], text, text, uuid)
  from public, anon, authenticated;

create or replace function public.create_appointment_series_with_package(
  p_patient_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_frequency text default 'single',
  p_occurrence_count integer default 1,
  p_type text default 'presencial',
  p_notes text default null,
  p_location text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_package_id uuid default null,
  p_psychologist_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_professional_id uuid;
  v_result jsonb;
  v_appointment_ids uuid[];
begin
  if v_actor_id is not null then
    v_professional_id := v_actor_id;
  elsif v_role = 'service_role' or session_user in ('postgres', 'supabase_admin') then
    v_professional_id := p_psychologist_id;
  else
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('appointment-package:' || v_professional_id::text, 0));

  if p_package_id is not null then
    perform 1
    from public.patient_packages package
    where package.id = p_package_id
      and package.user_id = v_professional_id
      and package.patient_id = p_patient_id
    for update;
    if not found then
      raise exception 'Pacote não encontrado para este paciente.' using errcode = 'P0002';
    end if;
  end if;

  v_result := public.create_appointment_series(
    p_patient_id,
    p_start_time,
    p_end_time,
    p_frequency,
    p_occurrence_count,
    p_type,
    p_notes,
    p_location,
    p_metadata,
    v_professional_id
  );

  if not coalesce((v_result ->> 'success')::boolean, false) or p_package_id is null then
    return v_result;
  end if;

  select array_agg((item ->> 'appointmentId')::uuid order by (item ->> 'occurrenceNumber')::integer nulls first)
  into v_appointment_ids
  from jsonb_array_elements(v_result -> 'appointments') item;

  perform private.reserve_package_appointments(
    v_professional_id,
    p_patient_id,
    p_package_id,
    v_appointment_ids,
    'professional_app',
    'appointment-create:' || coalesce(v_result ->> 'seriesId', v_appointment_ids[1]::text),
    v_actor_id
  );

  return v_result || jsonb_build_object('packageId', p_package_id, 'reservedSessions', p_occurrence_count);
end;
$$;

revoke all on function public.create_appointment_series_with_package(
  uuid, timestamptz, timestamptz, text, integer, text, text, text, jsonb, uuid, uuid
) from public, anon;
grant execute on function public.create_appointment_series_with_package(
  uuid, timestamptz, timestamptz, text, integer, text, text, text, jsonb, uuid, uuid
) to authenticated, service_role;

create or replace function public.preview_package_lifecycle_change_internal(
  p_actor_id uuid,
  p_source_package_id uuid,
  p_target_package_id uuid default null,
  p_operation_type text default 'replace',
  p_scope text default 'all_future',
  p_anchor_appointment_id uuid default null,
  p_financial_strategy text default 'keep_existing'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_source public.patient_packages%rowtype;
  v_target public.patient_packages%rowtype;
  v_anchor public.appointments%rowtype;
  v_occurrences jsonb := '[]'::jsonb;
  v_affected_count integer := 0;
  v_consumed_count integer := 0;
  v_paid_count integer := 0;
  v_historical_paid_count integer := 0;
  v_pending_count integer := 0;
  v_same_condition_count integer := 0;
  v_sensitive_count integer := 0;
  v_nfse_count integer := 0;
  v_historical_nfse_count integer := 0;
  v_first_start timestamptz;
  v_last_start timestamptz;
  v_hard_blocks jsonb := '[]'::jsonb;
  v_review_reasons jsonb := '[]'::jsonb;
  v_target_available integer := 0;
  v_expected_amount numeric;
begin
  if p_actor_id is null then
    raise exception 'Ator obrigatório.' using errcode = '42501';
  end if;
  if p_operation_type not in ('replace', 'end', 'release') then
    raise exception 'Operação de pacote inválida.' using errcode = '22023';
  end if;
  if p_scope not in ('only_this', 'this_and_next', 'all_future') then
    raise exception 'Escopo inválido.' using errcode = '22023';
  end if;
  if p_financial_strategy not in (
    'keep_existing',
    'cancel_and_recreate_per_session',
    'cancel_and_create_single',
    'cancel_without_replacement',
    'manual_review'
  ) then
    raise exception 'Estratégia financeira inválida.' using errcode = '22023';
  end if;
  if p_operation_type <> 'replace'
    and p_financial_strategy in ('cancel_and_recreate_per_session', 'cancel_and_create_single')
  then
    v_hard_blocks := v_hard_blocks || jsonb_build_array('Selecione um novo pacote antes de preparar novas cobranças.');
  end if;

  select package.* into v_source
  from public.patient_packages package
  where package.id = p_source_package_id
    and package.user_id = p_actor_id;
  if not found then
    raise exception 'Pacote de origem não encontrado.' using errcode = 'P0002';
  end if;

  if p_scope in ('only_this', 'this_and_next') then
    if p_anchor_appointment_id is null then
      v_hard_blocks := v_hard_blocks || jsonb_build_array('Selecione a ocorrência inicial.');
    else
      select appointment.* into v_anchor
      from public.appointments appointment
      join public.appointment_package_bindings binding
        on binding.appointment_id = appointment.id
       and binding.package_id = p_source_package_id
       and binding.status = 'reserved'
      where appointment.id = p_anchor_appointment_id
        and appointment.user_id = p_actor_id;
      if not found then
        v_hard_blocks := v_hard_blocks || jsonb_build_array('A ocorrência selecionada não possui reserva ativa neste pacote.');
      elsif v_anchor.start_time <= now() then
        v_hard_blocks := v_hard_blocks || jsonb_build_array('A ocorrência selecionada já começou e exige revisão separada.');
      end if;
    end if;
  end if;

  if p_operation_type = 'replace' then
    if p_target_package_id is null then
      v_hard_blocks := v_hard_blocks || jsonb_build_array('Selecione o novo pacote.');
    elsif p_target_package_id = p_source_package_id then
      v_hard_blocks := v_hard_blocks || jsonb_build_array('O novo pacote deve ser diferente do pacote atual.');
    else
      select package.* into v_target
      from public.patient_packages package
      where package.id = p_target_package_id
        and package.user_id = p_actor_id;
      if not found then
        v_hard_blocks := v_hard_blocks || jsonb_build_array('Novo pacote não encontrado.');
      else
        v_target_available := greatest(
          v_target.total_sessions - v_target.sessions_used - v_target.sessions_reserved,
          0
        );
        if v_target.patient_id <> v_source.patient_id or v_target.user_id <> v_source.user_id then
          v_hard_blocks := v_hard_blocks || jsonb_build_array('O novo pacote deve pertencer ao mesmo paciente e profissional.');
        end if;
        if v_target.package_status <> 'active'
          or lower(coalesce(v_target.active, 'true')) not in ('true', '1', 'yes', 'active')
        then
          v_hard_blocks := v_hard_blocks || jsonb_build_array('O novo pacote não está ativo.');
        end if;
        if v_target.end_date is not null and v_target.end_date < current_date then
          v_hard_blocks := v_hard_blocks || jsonb_build_array('O novo pacote está vencido.');
        end if;
        if v_target.billing_mode = 'upfront'
          and v_target.billing_status = 'paid'
          and p_financial_strategy in ('cancel_and_recreate_per_session', 'cancel_and_create_single')
        then
          v_hard_blocks := v_hard_blocks || jsonb_build_array('O novo pacote já foi pago antecipadamente; criar outra cobrança duplicaria o pagamento.');
        end if;
      end if;
    end if;
  end if;

  with candidates as (
    select
      binding.id as binding_id,
      appointment.id as appointment_id,
      appointment.series_id,
      appointment.occurrence_number,
      appointment.occurrence_count,
      appointment.start_time,
      appointment.end_time
    from public.appointment_package_bindings binding
    join public.appointments appointment on appointment.id = binding.appointment_id
    where binding.package_id = p_source_package_id
      and binding.professional_id = p_actor_id
      and binding.status = 'reserved'
      and appointment.start_time > now()
      and lower(coalesce(appointment.status, '')) not in ('completed', 'cancelled', 'canceled')
      and lower(coalesce(appointment.lifecycle_status, '')) <> 'cancelled'
      and (
        p_scope = 'all_future'
        or (p_scope = 'only_this' and appointment.id = p_anchor_appointment_id)
        or (
          p_scope = 'this_and_next'
          and (
            (v_anchor.series_id is not null
              and appointment.series_id = v_anchor.series_id
              and appointment.occurrence_number >= v_anchor.occurrence_number)
            or (v_anchor.series_id is null and appointment.id = v_anchor.id)
          )
        )
      )
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'appointmentId', candidate.appointment_id,
      'seriesId', candidate.series_id,
      'occurrenceNumber', candidate.occurrence_number,
      'occurrenceCount', candidate.occurrence_count,
      'startTime', candidate.start_time,
      'endTime', candidate.end_time
    ) order by candidate.start_time, candidate.appointment_id), '[]'::jsonb),
    count(*)::integer,
    min(candidate.start_time),
    max(candidate.start_time)
  into v_occurrences, v_affected_count, v_first_start, v_last_start
  from candidates candidate;

  select count(*)::integer into v_consumed_count
  from public.appointment_package_bindings binding
  where binding.package_id = p_source_package_id
    and binding.professional_id = p_actor_id
    and binding.status = 'consumed';

  with consumed as (
    select binding.appointment_id
    from public.appointment_package_bindings binding
    where binding.package_id = p_source_package_id
      and binding.professional_id = p_actor_id
      and binding.status = 'consumed'
  )
  select
    count(distinct entry.id) filter (
      where entry.status = 'paid' or lower(coalesce(payment.status, '')) = 'paid'
    )::integer,
    count(distinct payment.id) filter (
      where payment.nfse_authorized_at is not null
        or lower(coalesce(payment.nfse_status, '')) in ('authorized', 'issued', 'approved')
    )::integer
  into v_historical_paid_count, v_historical_nfse_count
  from consumed
  left join public.financial_entries entry on entry.appointment_id = consumed.appointment_id
  left join public.nb_payments payment
    on payment.appointment_id = consumed.appointment_id
    or payment.id = entry.neurofinance_charge_id;

  with affected as (
    select (item ->> 'appointmentId')::uuid as appointment_id
    from jsonb_array_elements(v_occurrences) item
  )
  select
    count(distinct entry.id) filter (
      where entry.status = 'paid' or lower(coalesce(payment.status, '')) = 'paid'
    )::integer,
    count(distinct entry.id) filter (
      where entry.status in ('planned', 'pending', 'overdue')
        and lower(coalesce(payment.status, 'pending')) not in ('paid', 'processing', 'disputed', 'partially_refunded')
    )::integer,
    count(distinct entry.id) filter (
      where entry.status in ('planned', 'pending', 'overdue')
        and p_operation_type = 'replace'
        and v_target.id is not null
        and v_target.billing_mode = 'per_session'
        and (v_target.price is null or abs(entry.amount - (v_target.price / nullif(v_target.total_sessions, 0))) < 0.01)
        and (v_target.due_day is null or extract(day from entry.due_date)::integer = v_target.due_day)
        and (v_target.default_payment_method is null or entry.payment_method = v_target.default_payment_method)
    )::integer
  into v_paid_count, v_pending_count, v_same_condition_count
  from affected
  join public.financial_entries entry on entry.appointment_id = affected.appointment_id
  left join public.nb_payments payment on payment.id = entry.neurofinance_charge_id;

  with affected as (
    select (item ->> 'appointmentId')::uuid as appointment_id
    from jsonb_array_elements(v_occurrences) item
  )
  select
    count(distinct payment.id) filter (
      where lower(coalesce(payment.status, payment.normalized_status, '')) in (
        'processing', 'partially_paid', 'disputed', 'partially_refunded', 'chargeback'
      )
      or lower(coalesce(payment.dispute_status, '')) in ('open', 'pending', 'disputed', 'chargeback')
      or payment.anticipated is true
    )::integer,
    count(distinct payment.id) filter (
      where payment.nfse_authorized_at is not null
        or lower(coalesce(payment.nfse_status, '')) in ('authorized', 'issued', 'approved', 'processing')
    )::integer
  into v_sensitive_count, v_nfse_count
  from affected
  join public.nb_payments payment on payment.appointment_id = affected.appointment_id;

  if p_operation_type in ('replace', 'release') and v_affected_count = 0 then
    v_hard_blocks := v_hard_blocks || jsonb_build_array('Nenhuma ocorrência futura não consumida foi encontrada para este escopo.');
  end if;
  if p_operation_type = 'end' and p_scope <> 'all_future' then
    v_hard_blocks := v_hard_blocks || jsonb_build_array('Encerrar o pacote exige selecionar todas as ocorrências futuras não realizadas.');
  end if;

  if p_operation_type = 'replace' and v_target.id is not null then
    if v_target_available < v_affected_count then
      v_hard_blocks := v_hard_blocks || jsonb_build_array(
        format('O novo pacote possui saldo para %s de %s sessões.', v_target_available, v_affected_count)
      );
    end if;
    if v_first_start is not null and v_target.start_date is not null
      and (v_first_start at time zone 'America/Sao_Paulo')::date < v_target.start_date
    then
      v_hard_blocks := v_hard_blocks || jsonb_build_array('A primeira ocorrência está fora da validade do novo pacote.');
    end if;
    if v_last_start is not null and v_target.end_date is not null
      and (v_last_start at time zone 'America/Sao_Paulo')::date > v_target.end_date
    then
      v_hard_blocks := v_hard_blocks || jsonb_build_array('A última ocorrência está fora da validade do novo pacote.');
    end if;
    if p_financial_strategy = 'keep_existing' and v_pending_count > v_same_condition_count then
      v_hard_blocks := v_hard_blocks || jsonb_build_array('Há cobranças futuras com valor, vencimento, método ou política diferentes. Escolha como ajustá-las.');
    end if;
    v_expected_amount := case
      when v_target.billing_mode = 'per_session' and v_target.price is not null
        then round(v_target.price / nullif(v_target.total_sessions, 0), 2)
      else v_target.price
    end;
  end if;

  if v_sensitive_count > 0 then
    v_review_reasons := v_review_reasons || jsonb_build_array('Uma ou mais cobranças estão processando ou em estado financeiro sensível.');
  end if;
  if v_nfse_count > 0 then
    v_review_reasons := v_review_reasons || jsonb_build_array('Existe NFS-e emitida ou em processamento para uma ocorrência futura.');
  end if;

  return jsonb_build_object(
    'operationType', p_operation_type,
    'scope', p_scope,
    'sourcePackage', jsonb_build_object(
      'id', v_source.id,
      'description', v_source.description,
      'totalSessions', v_source.total_sessions,
      'sessionsUsed', v_source.sessions_used,
      'sessionsReserved', v_source.sessions_reserved,
      'billingMode', v_source.billing_mode,
      'billingStatus', v_source.billing_status
    ),
    'targetPackage', case when v_target.id is null then null else jsonb_build_object(
      'id', v_target.id,
      'description', v_target.description,
      'availableSessions', v_target_available,
      'billingMode', v_target.billing_mode,
      'billingStatus', v_target.billing_status,
      'expectedAmount', v_expected_amount
    ) end,
    'affectedCount', v_affected_count,
    'occurrences', v_occurrences,
    'firstStartTime', v_first_start,
    'lastStartTime', v_last_start,
    'preservedHistory', jsonb_build_object(
      'consumedSessions', v_consumed_count,
      'paidCharges', v_historical_paid_count,
      'fiscalDocuments', v_historical_nfse_count
    ),
    'financialImpact', jsonb_build_object(
      'pendingCharges', v_pending_count,
      'sameConditionCharges', v_same_condition_count,
      'sensitiveCharges', v_sensitive_count,
      'nfseUnderReview', v_nfse_count,
      'strategy', p_financial_strategy
    ),
    'hardBlocks', v_hard_blocks,
    'reviewReasons', v_review_reasons,
    'canExecute', jsonb_array_length(v_hard_blocks) = 0 and jsonb_array_length(v_review_reasons) = 0
  );
end;
$$;

revoke all on function public.preview_package_lifecycle_change_internal(uuid, uuid, uuid, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.preview_package_lifecycle_change_internal(uuid, uuid, uuid, text, text, uuid, text)
  to service_role;

create or replace function public.execute_package_lifecycle_change_internal(
  p_actor_id uuid,
  p_source_package_id uuid,
  p_target_package_id uuid default null,
  p_operation_type text default 'replace',
  p_scope text default 'all_future',
  p_anchor_appointment_id uuid default null,
  p_financial_strategy text default 'keep_existing',
  p_reason text default null,
  p_idempotency_key text default null,
  p_expected_appointment_ids uuid[] default null,
  p_action_origin text default 'professional_app'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_preview jsonb;
  v_operation public.package_replacement_operations%rowtype;
  v_source public.patient_packages%rowtype;
  v_target public.patient_packages%rowtype;
  v_binding record;
  v_new_binding_id uuid;
  v_reserve_usage_id uuid;
  v_coverage record;
  v_new_coverage_id uuid;
  v_current_ids uuid[];
  v_expected_ids uuid[];
  v_affected_count integer;
  v_remaining_reservations integer;
  v_has_financial_tasks boolean := false;
  v_has_manual_tasks boolean := false;
  v_cancel_key text;
  v_create_key text;
  v_first_appointment_id uuid;
begin
  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Informe o motivo da alteração.' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_idempotency_key, ''))) < 8 then
    raise exception 'Chave de idempotência obrigatória.' using errcode = '22023';
  end if;

  select operation.* into v_operation
  from public.package_replacement_operations operation
  where operation.professional_id = p_actor_id
    and operation.idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'success', v_operation.status in ('completed', 'pending_financial'),
      'operationId', v_operation.id,
      'status', v_operation.status,
      'affectedCount', v_operation.affected_appointments,
      'financialSummary', v_operation.financial_summary,
      'idempotentReplay', true
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'package-lifecycle:' || p_actor_id::text || ':' || p_source_package_id::text,
    0
  ));

  select operation.* into v_operation
  from public.package_replacement_operations operation
  where operation.professional_id = p_actor_id
    and operation.idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'success', v_operation.status in ('completed', 'pending_financial'),
      'operationId', v_operation.id,
      'status', v_operation.status,
      'affectedCount', v_operation.affected_appointments,
      'financialSummary', v_operation.financial_summary,
      'idempotentReplay', true
    );
  end if;

  perform package.id
  from public.patient_packages package
  where package.id = any(array_remove(array[p_source_package_id, p_target_package_id], null))
  order by package.id
  for update;

  select package.* into v_source
  from public.patient_packages package
  where package.id = p_source_package_id
    and package.user_id = p_actor_id;
  if not found then
    raise exception 'Pacote de origem não encontrado.' using errcode = 'P0002';
  end if;

  if p_target_package_id is not null then
    select package.* into v_target
    from public.patient_packages package
    where package.id = p_target_package_id
      and package.user_id = p_actor_id;
  end if;

  perform binding.id
  from public.appointment_package_bindings binding
  join public.appointments appointment on appointment.id = binding.appointment_id
  where binding.package_id = p_source_package_id
    and binding.professional_id = p_actor_id
    and binding.status = 'reserved'
  order by appointment.start_time, binding.id
  for update of binding, appointment;

  v_preview := public.preview_package_lifecycle_change_internal(
    p_actor_id,
    p_source_package_id,
    p_target_package_id,
    p_operation_type,
    p_scope,
    p_anchor_appointment_id,
    p_financial_strategy
  );

  if jsonb_array_length(v_preview -> 'hardBlocks') > 0 then
    raise exception '%', v_preview -> 'hardBlocks' using errcode = '22023';
  end if;

  select coalesce(array_agg((item ->> 'appointmentId')::uuid order by (item ->> 'appointmentId')), '{}'::uuid[])
  into v_current_ids
  from jsonb_array_elements(v_preview -> 'occurrences') item;
  select coalesce(array_agg(id order by id), '{}'::uuid[])
  into v_expected_ids
  from unnest(coalesce(p_expected_appointment_ids, '{}'::uuid[])) id;

  if p_expected_appointment_ids is null then
    raise exception 'Confirme novamente a lista de ocorrências afetadas.' using errcode = '40001';
  end if;
  if p_expected_appointment_ids is not null and v_current_ids is distinct from v_expected_ids then
    raise exception 'A agenda mudou desde a análise. Revise as ocorrências antes de confirmar.' using errcode = '40001';
  end if;

  v_affected_count := coalesce((v_preview ->> 'affectedCount')::integer, 0);

  insert into public.package_replacement_operations (
    professional_id,
    patient_id,
    series_id,
    source_package_id,
    target_package_id,
    operation_type,
    scope,
    anchor_appointment_id,
    financial_strategy,
    status,
    affected_appointments,
    reason,
    actor_user_id,
    action_origin,
    idempotency_key,
    preview_snapshot,
    financial_summary
  ) values (
    p_actor_id,
    v_source.patient_id,
    case when p_anchor_appointment_id is null then null else (
      select appointment.series_id from public.appointments appointment where appointment.id = p_anchor_appointment_id
    ) end,
    p_source_package_id,
    p_target_package_id,
    p_operation_type,
    p_scope,
    p_anchor_appointment_id,
    p_financial_strategy,
    case when jsonb_array_length(v_preview -> 'reviewReasons') > 0 then 'review_required' else 'processing' end,
    v_affected_count,
    btrim(p_reason),
    p_actor_id,
    p_action_origin,
    p_idempotency_key,
    v_preview,
    v_preview -> 'financialImpact'
  )
  returning * into v_operation;

  if jsonb_array_length(v_preview -> 'reviewReasons') > 0 then
    insert into public.package_financial_adjustment_outbox (
      operation_id,
      professional_id,
      patient_id,
      source_package_id,
      target_package_id,
      task_type,
      status,
      idempotency_key,
      payload
    ) values (
      v_operation.id,
      p_actor_id,
      v_source.patient_id,
      p_source_package_id,
      p_target_package_id,
      case when coalesce((v_preview #>> '{financialImpact,nfseUnderReview}')::integer, 0) > 0
        then 'manual_fiscal_review'
        else 'manual_financial_review'
      end,
      'review_required',
      p_idempotency_key || ':review',
      jsonb_build_object('reasons', v_preview -> 'reviewReasons')
    );

    return jsonb_build_object(
      'success', false,
      'operationId', v_operation.id,
      'status', 'review_required',
      'affectedCount', 0,
      'reviewReasons', v_preview -> 'reviewReasons',
      'idempotentReplay', false
    );
  end if;

  for v_binding in
    select
      binding.*,
      appointment.start_time,
      appointment.end_time,
      appointment.occurrence_number,
      appointment.occurrence_count
    from public.appointment_package_bindings binding
    join public.appointments appointment on appointment.id = binding.appointment_id
    where binding.id in (
      select candidate.id
      from public.appointment_package_bindings candidate
      where candidate.appointment_id = any(v_current_ids)
        and candidate.package_id = p_source_package_id
        and candidate.status = 'reserved'
    )
    order by appointment.start_time, binding.id
  loop
    v_first_appointment_id := coalesce(v_first_appointment_id, v_binding.appointment_id);
    v_new_binding_id := null;

    select usage.id into v_reserve_usage_id
    from public.patient_package_session_usages usage
    where usage.binding_id = v_binding.id
      and usage.action = 'reserve';

    insert into public.patient_package_session_usages (
      professional_id,
      package_id,
      patient_id,
      appointment_id,
      binding_id,
      series_id,
      action,
      reverses_usage_id,
      reason,
      idempotency_key,
      source,
      metadata
    ) values (
      p_actor_id,
      p_source_package_id,
      v_source.patient_id,
      v_binding.appointment_id,
      v_binding.id,
      v_binding.series_id,
      'release',
      v_reserve_usage_id,
      btrim(p_reason),
      p_idempotency_key || ':release:' || v_binding.appointment_id::text,
      p_action_origin,
      jsonb_build_object('operationId', v_operation.id)
    );

    update public.appointment_package_bindings
    set
      status = case when p_operation_type = 'replace' then 'replaced' else 'released' end,
      released_at = now(),
      reason = btrim(p_reason),
      updated_at = now()
    where id = v_binding.id;

    if p_operation_type = 'replace' then
      insert into public.appointment_package_bindings (
        appointment_id,
        series_id,
        package_id,
        professional_id,
        patient_id,
        status,
        source,
        reason,
        idempotency_key,
        created_by
      ) values (
        v_binding.appointment_id,
        v_binding.series_id,
        p_target_package_id,
        p_actor_id,
        v_source.patient_id,
        'reserved',
        p_action_origin,
        btrim(p_reason),
        p_idempotency_key || ':binding:' || v_binding.appointment_id::text,
        p_actor_id
      )
      returning id into v_new_binding_id;

      update public.appointment_package_bindings
      set replaced_by_binding_id = v_new_binding_id, updated_at = now()
      where id = v_binding.id;

      insert into public.patient_package_session_usages (
        professional_id,
        package_id,
        patient_id,
        appointment_id,
        binding_id,
        series_id,
        action,
        reason,
        idempotency_key,
        source,
        metadata
      ) values (
        p_actor_id,
        p_target_package_id,
        v_source.patient_id,
        v_binding.appointment_id,
        v_new_binding_id,
        v_binding.series_id,
        'reserve',
        btrim(p_reason),
        p_idempotency_key || ':reserve:' || v_binding.appointment_id::text,
        p_action_origin,
        jsonb_build_object('operationId', v_operation.id)
      );

      update public.appointments
      set package_id = p_target_package_id,
          updated_by = p_actor_id,
          action_origin = p_action_origin
      where id = v_binding.appointment_id;

      perform private.append_appointment_event(
        v_binding.appointment_id,
        'package_replacement_linked',
        null,
        null,
        'psychologist',
        p_actor_id,
        p_action_origin,
        jsonb_build_object('packageName', v_target.description),
        p_idempotency_key || ':linked:' || v_binding.appointment_id::text
      );
    else
      update public.appointments
      set package_id = null,
          updated_by = p_actor_id,
          action_origin = p_action_origin
      where id = v_binding.appointment_id;
    end if;

    for v_coverage in
      select
        coverage.*,
        entry.status as entry_status,
        entry.amount,
        entry.due_date,
        entry.payment_method,
        payment.status as payment_status,
        payment.normalized_status,
        payment.nfse_authorized_at,
        payment.nfse_status
      from public.appointment_financial_coverages coverage
      left join public.financial_entries entry on entry.id = coverage.financial_entry_id
      left join public.nb_payments payment on payment.id = coverage.payment_id
      where coverage.binding_id = v_binding.id
        and coverage.status = 'active'
      order by coverage.id
      for update of coverage
    loop
      if lower(coalesce(v_coverage.payment_status, v_coverage.entry_status, 'pending')) = 'paid' then
        update public.appointment_financial_coverages
        set status = 'preserved', reason = 'Pagamento histórico preservado'
        where id = v_coverage.id;
        perform private.append_appointment_event(
          v_binding.appointment_id,
          'future_charges_preserved',
          null,
          null,
          'system',
          null,
          'neurofinance',
          '{}'::jsonb,
          p_idempotency_key || ':paid-preserved:' || v_coverage.id::text
        );
      elsif p_financial_strategy = 'keep_existing' then
        if p_operation_type = 'replace' then
          insert into public.appointment_financial_coverages (
            appointment_id,
            binding_id,
            package_id,
            professional_id,
            patient_id,
            financial_entry_id,
            payment_id,
            status,
            source,
            reason,
            idempotency_key
          ) values (
            v_binding.appointment_id,
            v_new_binding_id,
            p_target_package_id,
            p_actor_id,
            v_source.patient_id,
            v_coverage.financial_entry_id,
            v_coverage.payment_id,
            'active',
            p_action_origin,
            'Cobrança futura mantida com nova cobertura',
            p_idempotency_key || ':coverage:' || v_coverage.id::text
          )
          returning id into v_new_coverage_id;

          update public.appointment_financial_coverages
          set
            status = 'replaced',
            released_at = now(),
            replaced_by_coverage_id = v_new_coverage_id,
            reason = 'Cobertura transferida sem recriar a cobrança'
          where id = v_coverage.id;
        end if;

        perform private.append_appointment_event(
          v_binding.appointment_id,
          'future_charges_preserved',
          null,
          null,
          'system',
          null,
          'neurofinance',
          '{}'::jsonb,
          p_idempotency_key || ':charge-preserved:' || v_coverage.id::text
        );
      elsif p_financial_strategy = 'manual_review' then
        update public.appointment_financial_coverages
        set status = 'review_required', reason = 'Ajuste financeiro manual solicitado'
        where id = v_coverage.id;

        insert into public.package_financial_adjustment_outbox (
          operation_id,
          professional_id,
          patient_id,
          appointment_id,
          source_package_id,
          target_package_id,
          financial_entry_id,
          payment_id,
          task_type,
          status,
          idempotency_key,
          payload
        ) values (
          v_operation.id,
          p_actor_id,
          v_source.patient_id,
          v_binding.appointment_id,
          p_source_package_id,
          p_target_package_id,
          v_coverage.financial_entry_id,
          v_coverage.payment_id,
          'manual_financial_review',
          'review_required',
          p_idempotency_key || ':manual:' || v_coverage.id::text,
          jsonb_build_object('reason', p_reason)
        );
        v_has_manual_tasks := true;
      else
        v_cancel_key := p_idempotency_key || ':cancel:' || v_coverage.id::text;
        update public.appointment_financial_coverages
        set status = 'cancellation_requested', reason = 'Cancelamento preparado para ajuste do pacote'
        where id = v_coverage.id;

        insert into public.package_financial_adjustment_outbox (
          operation_id,
          professional_id,
          patient_id,
          appointment_id,
          source_package_id,
          target_package_id,
          financial_entry_id,
          payment_id,
          task_type,
          status,
          idempotency_key,
          payload
        ) values (
          v_operation.id,
          p_actor_id,
          v_source.patient_id,
          v_binding.appointment_id,
          p_source_package_id,
          p_target_package_id,
          v_coverage.financial_entry_id,
          v_coverage.payment_id,
          case when v_coverage.payment_id is null then 'cancel_financial_entry' else 'cancel_charge' end,
          'pending',
          v_cancel_key,
          jsonb_build_object('reason', p_reason)
        );

        perform private.append_appointment_event(
          v_binding.appointment_id,
          'charge_cancellation_requested',
          null,
          null,
          'system',
          null,
          'neurofinance',
          '{}'::jsonb,
          p_idempotency_key || ':charge-cancel:' || v_coverage.id::text
        );

        if p_financial_strategy = 'cancel_and_recreate_per_session' then
          v_create_key := p_idempotency_key || ':create:' || v_coverage.id::text;
          insert into public.package_financial_adjustment_outbox (
            operation_id,
            professional_id,
            patient_id,
            appointment_id,
            source_package_id,
            target_package_id,
            financial_entry_id,
            task_type,
            status,
            depends_on_idempotency_key,
            idempotency_key,
            payload
          ) values (
            v_operation.id,
            p_actor_id,
            v_source.patient_id,
            v_binding.appointment_id,
            p_source_package_id,
            p_target_package_id,
            v_coverage.financial_entry_id,
            'create_per_session_charge',
            'blocked',
            v_cancel_key,
            v_create_key,
            jsonb_build_object(
              'releaseAfterCancellation', true,
              'billingMode', v_target.billing_mode,
              'amount', round(v_target.price / nullif(v_target.total_sessions, 0), 2),
              'paymentMethod', v_target.default_payment_method
            )
          );

          perform private.append_appointment_event(
            v_binding.appointment_id,
            'new_charges_prepared',
            null,
            null,
            'system',
            null,
            'neurofinance',
            '{}'::jsonb,
            p_idempotency_key || ':charge-prepared:' || v_coverage.id::text
          );
        end if;
        v_has_financial_tasks := true;
      end if;
    end loop;

    if p_financial_strategy = 'manual_review' then
      perform private.append_appointment_event(
        v_binding.appointment_id,
        'financial_adjustment_review',
        null,
        null,
        'system',
        null,
        'neurofinance',
        '{}'::jsonb,
        p_idempotency_key || ':financial-review:' || v_binding.appointment_id::text
      );
    end if;
  end loop;

  if p_financial_strategy = 'cancel_and_create_single' and v_has_financial_tasks then
    v_create_key := p_idempotency_key || ':create-package-charge';
    insert into public.package_financial_adjustment_outbox (
      operation_id,
      professional_id,
      patient_id,
      source_package_id,
      target_package_id,
      task_type,
      status,
      idempotency_key,
      payload
    ) values (
      v_operation.id,
      p_actor_id,
      v_source.patient_id,
      p_source_package_id,
      p_target_package_id,
      'create_package_charge',
      'blocked',
      v_create_key,
      jsonb_build_object(
        'waitForOperationCancellations', true,
        'requiredCancellationCount', (
          select count(*)
          from public.package_financial_adjustment_outbox task
          where task.operation_id = v_operation.id
            and task.task_type in ('cancel_charge', 'cancel_financial_entry')
        ),
        'billingMode', v_target.billing_mode,
        'amount', v_target.price,
        'paymentMethod', v_target.default_payment_method
      )
    );

    if v_first_appointment_id is not null then
      perform private.append_appointment_event(
        v_first_appointment_id,
        'new_charges_prepared',
        null,
        null,
        'system',
        null,
        'neurofinance',
        '{}'::jsonb,
        p_idempotency_key || ':package-charge-prepared'
      );
    end if;
  end if;

  update public.patient_packages
  set sessions_reserved = greatest(sessions_reserved - v_affected_count, 0)
  where id = p_source_package_id;

  if p_operation_type = 'replace' then
    update public.patient_packages
    set sessions_reserved = sessions_reserved + v_affected_count
    where id = p_target_package_id;
  end if;

  select count(*)::integer into v_remaining_reservations
  from public.appointment_package_bindings binding
  where binding.package_id = p_source_package_id
    and binding.status = 'reserved';

  if p_operation_type = 'end' or (p_operation_type = 'replace' and v_remaining_reservations = 0) then
    update public.patient_packages
    set
      package_status = case when p_operation_type = 'replace' then 'replaced' else 'ended' end,
      active = 'false',
      ended_at = now(),
      ended_reason = btrim(p_reason),
      replaced_by_package_id = case when p_operation_type = 'replace' then p_target_package_id else null end,
      ended_by = p_actor_id,
      ended_origin = p_action_origin
    where id = p_source_package_id;

    if v_first_appointment_id is not null then
      perform private.append_appointment_event(
        v_first_appointment_id,
        'package_ended_partial',
        null,
        null,
        'psychologist',
        p_actor_id,
        p_action_origin,
        jsonb_build_object(
          'packageName', v_source.description,
          'consumedSessions', v_source.sessions_used,
          'releasedSessions', v_affected_count
        ),
        p_idempotency_key || ':package-ended'
      );
    end if;
  end if;

  update public.package_replacement_operations
  set
    status = case
      when v_has_manual_tasks then 'pending_financial'
      when v_has_financial_tasks then 'pending_financial'
      else 'completed'
    end,
    completed_at = now(),
    financial_summary = (v_preview -> 'financialImpact') || jsonb_build_object(
      'hasPendingTasks', v_has_financial_tasks or v_has_manual_tasks
    )
  where id = v_operation.id
  returning * into v_operation;

  return jsonb_build_object(
    'success', true,
    'operationId', v_operation.id,
    'status', v_operation.status,
    'affectedCount', v_affected_count,
    'sourcePackageStatus', case
      when p_operation_type = 'replace' and v_remaining_reservations = 0 then 'replaced'
      when p_operation_type = 'end' then 'ended'
      else v_source.package_status
    end,
    'financialSummary', v_operation.financial_summary,
    'idempotentReplay', false
  );
end;
$$;

revoke all on function public.execute_package_lifecycle_change_internal(
  uuid, uuid, uuid, text, text, uuid, text, text, text, uuid[], text
) from public, anon, authenticated;
grant execute on function public.execute_package_lifecycle_change_internal(
  uuid, uuid, uuid, text, text, uuid, text, text, text, uuid[], text
) to service_role;

create or replace function private.prevent_patient_package_physical_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.appointment_package_bindings binding where binding.package_id = old.id)
    or exists (select 1 from public.patient_package_session_usages usage where usage.package_id = old.id)
    or exists (select 1 from public.appointments appointment where appointment.package_id = old.id)
    or exists (select 1 from public.appointment_financial_coverages coverage where coverage.package_id = old.id)
    or exists (select 1 from public.package_replacement_operations operation where operation.source_package_id = old.id or operation.target_package_id = old.id)
    or exists (
      select 1 from public.financial_entries entry
      where entry.metadata ->> 'packageId' = old.id::text
        or entry.metadata ->> 'package_id' = old.id::text
    )
    or exists (
      select 1 from public.nb_payments payment
      where payment.metadata ->> 'packageId' = old.id::text
        or payment.metadata ->> 'package_id' = old.id::text
        or payment.nfse_authorized_at is not null
          and payment.appointment_id in (
            select binding.appointment_id
            from public.appointment_package_bindings binding
            where binding.package_id = old.id
          )
    )
  then
    raise exception 'Pacotes com histórico, reservas, cobranças, pagamentos ou documentos fiscais não podem ser excluídos. Encerre ou remova apenas os vínculos futuros.'
      using errcode = '23503';
  end if;
  return old;
end;
$$;

drop trigger if exists patient_packages_prevent_historical_delete
  on public.patient_packages;
create trigger patient_packages_prevent_historical_delete
before delete on public.patient_packages
for each row execute function private.prevent_patient_package_physical_delete();

revoke all on function private.prevent_patient_package_physical_delete()
  from public, anon, authenticated;
revoke delete on table public.patient_packages from authenticated;

alter table public.patient_packages
  validate constraint patient_packages_session_balance_check;

comment on table public.appointment_package_bindings is
  'Versioned package coverage per appointment occurrence. Completed bindings are immutable historical references.';
comment on table public.patient_package_session_usages is
  'Append-only package ledger. Reserve/release affect capacity; consume/reverse affect realized usage.';
comment on table public.package_financial_adjustment_outbox is
  'Provider-agnostic outbox. New charges remain blocked until cancellation tasks have succeeded.';
comment on function public.preview_package_lifecycle_change_internal(uuid, uuid, uuid, text, text, uuid, text) is
  'Service-role-only preview for package end, release or replacement. Returns safe operational summaries.';
comment on function public.execute_package_lifecycle_change_internal(uuid, uuid, uuid, text, text, uuid, text, text, text, uuid[], text) is
  'Service-role-only atomic package lifecycle operation. It never performs provider network calls.';

commit;
