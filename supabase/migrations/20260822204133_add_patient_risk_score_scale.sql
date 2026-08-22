do $$
begin
  if exists (
    select 1
    from public.patients
    where risk_score is not null
      and (risk_score < 0 or risk_score > 100)
  ) then
    raise exception 'patients.risk_score contains values outside the supported 0-100 interval';
  end if;
end
$$;

alter table public.patients
  add column risk_score_scale smallint;

update public.patients
set risk_score_scale = case
  when risk_score is not null and risk_score > 10 then 100
  else 10
end;

alter table public.patients
  alter column risk_score_scale set default 10,
  alter column risk_score_scale set not null;

alter table public.patients
  add constraint patients_risk_score_scale_allowed
    check (risk_score_scale in (10, 100)) not valid,
  add constraint patients_risk_score_within_scale
    check (risk_score is null or (risk_score >= 0 and risk_score <= risk_score_scale)) not valid;

alter table public.patients
  validate constraint patients_risk_score_scale_allowed;

alter table public.patients
  validate constraint patients_risk_score_within_scale;

comment on column public.patients.risk_score_scale is
  'Explicit display scale for a recorded risk_score. Supported values are 10 and 100.';
