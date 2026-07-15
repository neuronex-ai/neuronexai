begin;

-- Older appointment creation consumed package sessions immediately, including
-- future occurrences. Preserve those ledger rows and correct their meaning
-- append-only: reverse the premature consume and create an explicit reserve.
create temporary table legacy_future_package_reclassifications on commit drop as
select
  binding.id as binding_id,
  binding.appointment_id,
  binding.series_id,
  binding.package_id,
  binding.professional_id,
  binding.patient_id,
  binding.created_by,
  consume_usage.id as consume_usage_id
from public.appointment_package_bindings binding
join public.appointments appointment
  on appointment.id = binding.appointment_id
join lateral (
  select usage.id
  from public.patient_package_session_usages usage
  where usage.binding_id = binding.id
    and usage.action = 'consume'
  order by usage.created_at desc, usage.id desc
  limit 1
) consume_usage on true
where binding.status = 'consumed'
  and appointment.start_time > now()
  and lower(coalesce(appointment.status, '')) not in (
    'attended',
    'completed',
    'closed',
    'in_progress',
    'started'
  )
  and lower(coalesce(appointment.lifecycle_status, '')) not in (
    'completed',
    'closed',
    'consultation_completed',
    'in_progress',
    'consultation_started'
  )
  and not exists (
    select 1
    from public.patient_package_session_usages usage
    where usage.professional_id = binding.professional_id
      and usage.idempotency_key = 'migration:future-consume-reverse:' || binding.id::text
  );

do $$
declare
  v_invalid_packages integer;
begin
  select count(*)
  into v_invalid_packages
  from (
    select target.package_id, count(*)::integer as sessions_to_reclassify
    from legacy_future_package_reclassifications target
    group by target.package_id
  ) target
  join public.patient_packages package on package.id = target.package_id
  where package.sessions_used < target.sessions_to_reclassify
    or package.sessions_reserved + target.sessions_to_reclassify > package.total_sessions;

  if v_invalid_packages > 0 then
    raise exception 'Legacy future package reservations cannot be normalized safely';
  end if;
end;
$$;

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
)
select
  target.professional_id,
  target.package_id,
  target.patient_id,
  target.appointment_id,
  target.binding_id,
  target.series_id,
  'reverse',
  target.consume_usage_id,
  'Consumo futuro legado reclassificado como reserva',
  'migration:future-consume-reverse:' || target.binding_id::text,
  'migration',
  jsonb_build_object('reclassifiedAs', 'reserve')
from legacy_future_package_reclassifications target
on conflict (professional_id, idempotency_key) do nothing;

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
  target.professional_id,
  target.package_id,
  target.patient_id,
  target.appointment_id,
  target.binding_id,
  target.series_id,
  'reserve',
  'Sessao futura preservada como reserva do pacote',
  'migration:future-reserve:' || target.binding_id::text,
  'migration',
  jsonb_build_object('reclassifiedFrom', 'consume')
from legacy_future_package_reclassifications target
on conflict (professional_id, idempotency_key) do nothing;

update public.appointment_package_bindings binding
set
  status = 'reserved',
  consumed_at = null,
  released_at = null,
  source = 'migration',
  reason = 'Ocorrencia futura migrada de consumo antecipado para reserva'
from legacy_future_package_reclassifications target
where binding.id = target.binding_id;

update public.patient_packages package
set
  sessions_used = package.sessions_used - target.sessions_to_reclassify,
  sessions_reserved = package.sessions_reserved + target.sessions_to_reclassify
from (
  select package_id, count(*)::integer as sessions_to_reclassify
  from legacy_future_package_reclassifications
  group by package_id
) target
where package.id = target.package_id;

comment on table public.appointment_package_bindings is
  'Versioned package coverage per appointment occurrence. Completed bindings are immutable; future legacy consumes are preserved in the ledger and reclassified through reverse plus reserve movements.';

commit;
