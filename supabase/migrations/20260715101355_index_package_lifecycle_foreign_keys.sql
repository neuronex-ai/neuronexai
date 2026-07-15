begin;

create index if not exists appointment_package_bindings_created_by_idx
  on public.appointment_package_bindings(created_by)
  where created_by is not null;

create index if not exists package_replacement_operations_actor_idx
  on public.package_replacement_operations(actor_user_id)
  where actor_user_id is not null;

create index if not exists appointment_financial_coverages_patient_idx
  on public.appointment_financial_coverages(patient_id);

create index if not exists package_financial_adjustment_outbox_patient_idx
  on public.package_financial_adjustment_outbox(patient_id);

commit;
