-- Cover the audit foreign key used when an auth user is removed.
create index if not exists appointment_series_created_by_idx
  on public.appointment_series(created_by)
  where created_by is not null;
