-- Gestão Financeira V2: integrity, RLS, partial settlements and package usage.
begin;

drop policy if exists "patient_responsibles_insert_own" on public.patient_responsibles;
create policy "patient_responsibles_insert_own" on public.patient_responsibles
  for insert to authenticated with check (
    (select auth.uid()) = patient_responsibles.user_id and exists (
      select 1 from public.patients p
      where p.id = patient_responsibles.patient_id and p.user_id = (select auth.uid())
    )
  );
drop policy if exists "patient_responsibles_update_own" on public.patient_responsibles;
create policy "patient_responsibles_update_own" on public.patient_responsibles
  for update to authenticated
  using ((select auth.uid()) = patient_responsibles.user_id)
  with check ((select auth.uid()) = patient_responsibles.user_id and exists (
    select 1 from public.patients p
    where p.id = patient_responsibles.patient_id and p.user_id = (select auth.uid())
  ));

drop policy if exists "patient_financial_settings_insert_own" on public.patient_financial_settings;
create policy "patient_financial_settings_insert_own" on public.patient_financial_settings
  for insert to authenticated with check (
    (select auth.uid()) = patient_financial_settings.user_id and exists (
      select 1 from public.patients p
      where p.id = patient_financial_settings.patient_id and p.user_id = (select auth.uid())
    )
  );
drop policy if exists "patient_financial_settings_update_own" on public.patient_financial_settings;
create policy "patient_financial_settings_update_own" on public.patient_financial_settings
  for update to authenticated
  using ((select auth.uid()) = patient_financial_settings.user_id)
  with check ((select auth.uid()) = patient_financial_settings.user_id and exists (
    select 1 from public.patients p
    where p.id = patient_financial_settings.patient_id and p.user_id = (select auth.uid())
  ));

create table if not exists public.financial_entry_settlements (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  financial_entry_id uuid not null references public.financial_entries(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  settled_at timestamptz not null,
  payment_method text not null default 'manual' check (payment_method in ('manual','pix','boleto','card','cash','external_transfer','convenio','other')),
  status text not null default 'posted' check (status in ('posted','reversed')),
  reversed_at timestamptz,
  reversal_reason text,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint financial_entry_settlements_reversal_check check (
    (status = 'posted' and reversed_at is null)
    or (status = 'reversed' and reversed_at is not null and length(btrim(reversal_reason)) >= 3)
  )
);
create unique index if not exists financial_entry_settlements_idempotency_uidx on public.financial_entry_settlements(professional_id,idempotency_key);
create index if not exists financial_entry_settlements_entry_idx on public.financial_entry_settlements(financial_entry_id,status,settled_at desc);
alter table public.financial_entry_settlements enable row level security;
drop policy if exists "financial_entry_settlements_read_own" on public.financial_entry_settlements;
create policy "financial_entry_settlements_read_own" on public.financial_entry_settlements for select to authenticated
  using ((select auth.uid()) = professional_id);
grant select on public.financial_entry_settlements to authenticated;
revoke insert,update,delete,truncate,references,trigger on public.financial_entry_settlements from authenticated;

alter table if exists public.patient_packages
  add column if not exists billing_mode text not null default 'upfront',
  add column if not exists package_status text not null default 'active';
update public.patient_packages pp set package_status = case
  when lower(coalesce(pp.active,'active')) in ('false','inactive','cancelled','canceled') then 'cancelled'
  when pp.sessions_used >= pp.total_sessions then 'completed' else 'active' end;
do $migration$ begin
  if not exists (select 1 from pg_constraint where conname='patient_packages_billing_mode_check' and conrelid='public.patient_packages'::regclass) then
    alter table public.patient_packages add constraint patient_packages_billing_mode_check check (billing_mode in ('upfront','per_session','installment')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='patient_packages_package_status_check' and conrelid='public.patient_packages'::regclass) then
    alter table public.patient_packages add constraint patient_packages_package_status_check check (package_status in ('active','paused','completed','cancelled')) not valid;
  end if;
end $migration$;

create table if not exists public.patient_package_session_usages (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  package_id uuid not null references public.patient_packages(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  action text not null default 'consume' check (action in ('consume','reverse')),
  reverses_usage_id uuid references public.patient_package_session_usages(id) on delete restrict,
  reason text,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint patient_package_session_usages_reverse_check check (
    (action='consume' and reverses_usage_id is null)
    or (action='reverse' and reverses_usage_id is not null and length(btrim(reason)) >= 3)
  )
);
create unique index if not exists patient_package_session_usages_idempotency_uidx on public.patient_package_session_usages(professional_id,idempotency_key);
create unique index if not exists patient_package_session_usages_appointment_uidx on public.patient_package_session_usages(professional_id,package_id,appointment_id) where appointment_id is not null and action='consume';
alter table public.patient_package_session_usages enable row level security;
drop policy if exists "patient_package_session_usages_read_own" on public.patient_package_session_usages;
create policy "patient_package_session_usages_read_own" on public.patient_package_session_usages for select to authenticated using ((select auth.uid())=professional_id);
grant select on public.patient_package_session_usages to authenticated;
revoke insert,update,delete,truncate,references,trigger on public.patient_package_session_usages from authenticated;

create or replace function public.consume_patient_package_session(
  p_package_id uuid,p_patient_id uuid,p_appointment_id uuid default null,p_idempotency_key text default null,p_reason text default 'Uso manual'
) returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  v_user_id uuid := (select auth.uid()); v_package record;
  v_key text := coalesce(nullif(btrim(p_idempotency_key),''),'package-use:'||gen_random_uuid()::text); v_usage_id uuid;
begin
  if v_user_id is null then raise exception 'Sessão inválida.' using errcode='42501'; end if;
  select pp.id,pp.patient_id,pp.total_sessions,pp.sessions_used,pp.end_date,pp.package_status into v_package
  from public.patient_packages pp where pp.id=p_package_id and pp.user_id=v_user_id and pp.patient_id=p_patient_id for update;
  if not found then raise exception 'Pacote não encontrado ou acesso negado.' using errcode='P0002'; end if;
  select u.id into v_usage_id from public.patient_package_session_usages u where u.professional_id=v_user_id and u.idempotency_key=v_key;
  if v_usage_id is not null then return jsonb_build_object('usage_id',v_usage_id,'package_id',v_package.id,'sessions_used',v_package.sessions_used,'total_sessions',v_package.total_sessions,'remaining_sessions',greatest(v_package.total_sessions-v_package.sessions_used,0),'idempotent_replay',true); end if;
  if v_package.package_status<>'active' or (v_package.end_date is not null and v_package.end_date<current_date) or v_package.sessions_used>=v_package.total_sessions then
    raise exception 'Este pacote não possui sessões disponíveis.' using errcode='22023';
  end if;
  insert into public.patient_package_session_usages(professional_id,package_id,patient_id,appointment_id,action,reason,idempotency_key)
  values(v_user_id,p_package_id,p_patient_id,p_appointment_id,'consume',nullif(btrim(p_reason),''),v_key) returning id into v_usage_id;
  update public.patient_packages pp set sessions_used=pp.sessions_used+1,package_status=case when pp.sessions_used+1>=pp.total_sessions then 'completed' else pp.package_status end
  where pp.id=p_package_id returning pp.sessions_used,pp.total_sessions,pp.package_status into v_package.sessions_used,v_package.total_sessions,v_package.package_status;
  return jsonb_build_object('usage_id',v_usage_id,'package_id',p_package_id,'sessions_used',v_package.sessions_used,'total_sessions',v_package.total_sessions,'remaining_sessions',greatest(v_package.total_sessions-v_package.sessions_used,0),'package_status',v_package.package_status,'idempotent_replay',false);
end $function$;
revoke all on function public.consume_patient_package_session(uuid,uuid,uuid,text,text) from public;
grant execute on function public.consume_patient_package_session(uuid,uuid,uuid,text,text) to authenticated;

create or replace function public.transition_financial_entry(
  p_entry_id uuid,p_action text,p_amount numeric default null,p_effective_at timestamptz default now(),p_payment_method text default 'manual',p_reason text default null,p_idempotency_key text default null
) returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  v_user_id uuid := (select auth.uid()); v_entry public.financial_entries%rowtype; v_settlement_id uuid;
  v_settled numeric(14,2):=0; v_remaining numeric(14,2):=0; v_amount numeric(14,2):=0; v_key text; v_reversal_id uuid;
begin
  if v_user_id is null then raise exception 'Sessão inválida.' using errcode='42501'; end if;
  select fe.* into v_entry from public.financial_entries fe where fe.id=p_entry_id and fe.professional_id=v_user_id for update;
  if not found then raise exception 'Lançamento não encontrado ou acesso negado.' using errcode='P0002'; end if;
  select coalesce(sum(s.amount),0)::numeric(14,2) into v_settled from public.financial_entry_settlements s where s.financial_entry_id=v_entry.id and s.status='posted';
  v_remaining:=greatest(v_entry.amount-v_settled,0);
  if p_action='settle' then
    if v_entry.status='cancelled' then raise exception 'Lançamento cancelado não pode ser liquidado.' using errcode='22023'; end if;
    if v_entry.neurofinance_charge_id is not null then raise exception 'Concilie esta cobrança pelo NeuroFinance.' using errcode='22023'; end if;
    if p_payment_method not in ('manual','pix','boleto','card','cash','external_transfer','convenio','other') then raise exception 'Forma de pagamento inválida.' using errcode='22023'; end if;
    v_key:=coalesce(nullif(btrim(p_idempotency_key),''),'settlement:'||v_entry.id::text||':'||gen_random_uuid()::text);
    select s.id into v_settlement_id from public.financial_entry_settlements s where s.professional_id=v_user_id and s.idempotency_key=v_key;
    if v_settlement_id is not null then return jsonb_build_object('entry',to_jsonb(v_entry),'settlement_id',v_settlement_id,'reversal_id',null,'settled_amount',v_settled,'remaining_amount',v_remaining,'idempotent_replay',true); end if;
    v_amount:=coalesce(p_amount,v_remaining);
    if v_amount<=0 or v_amount>v_remaining then raise exception 'O valor deve ser maior que zero e não pode superar o saldo em aberto.' using errcode='22023'; end if;
    insert into public.financial_entry_settlements(professional_id,financial_entry_id,amount,settled_at,payment_method,idempotency_key,metadata)
    values(v_user_id,v_entry.id,v_amount,coalesce(p_effective_at,now()),p_payment_method,v_key,jsonb_build_object('source','financial_management_v2')) returning id into v_settlement_id;
    select coalesce(sum(s.amount),0)::numeric(14,2) into v_settled from public.financial_entry_settlements s where s.financial_entry_id=v_entry.id and s.status='posted';
    update public.financial_entries fe set status=case when v_settled>=fe.amount then 'paid' else 'pending' end,paid_at=case when v_settled>=fe.amount then coalesce(p_effective_at,now()) else null end,payment_method=p_payment_method,updated_at=now()
    where fe.id=v_entry.id returning fe.* into v_entry;
  elsif p_action='cancel' then
    if length(btrim(coalesce(p_reason,'')))<3 then raise exception 'Informe o motivo do cancelamento.' using errcode='22023'; end if;
    if v_entry.status='paid' or v_settled>0 then raise exception 'Um lançamento liquidado deve ser estornado, não cancelado.' using errcode='22023'; end if;
    if v_entry.neurofinance_charge_id is not null then raise exception 'Cancele primeiro a cobrança no NeuroFinance.' using errcode='22023'; end if;
    update public.financial_entries fe set status='cancelled',cancelled_at=now(),cancelled_reason=btrim(p_reason),paid_at=null,updated_at=now() where fe.id=v_entry.id returning fe.* into v_entry;
  elsif p_action='reopen' then
    if v_entry.status<>'cancelled' or v_entry.neurofinance_charge_id is not null then raise exception 'Somente lançamentos manuais cancelados podem ser reabertos.' using errcode='22023'; end if;
    update public.financial_entries fe set status='pending',cancelled_at=null,cancelled_reason=null,updated_at=now() where fe.id=v_entry.id returning fe.* into v_entry;
  elsif p_action='reverse' then
    if v_entry.status<>'paid' or length(btrim(coalesce(p_reason,'')))<3 then raise exception 'Somente lançamentos pagos podem ser estornados, com motivo.' using errcode='22023'; end if;
    v_key:=coalesce(nullif(btrim(p_idempotency_key),''),'reversal:'||v_entry.id::text);
    insert into public.financial_entries(clinic_id,professional_id,patient_id,appointment_id,type,title,description,category_id,amount,due_date,competence_date,paid_at,status,payment_method,origin,idempotency_key,reversal_of_entry_id,reversal_reason,metadata)
    values(v_entry.clinic_id,v_entry.professional_id,v_entry.patient_id,v_entry.appointment_id,case when v_entry.type='income' then 'expense' else 'income' end,'Estorno: '||v_entry.title,'Estorno: '||coalesce(v_entry.description,v_entry.title),null,v_entry.amount,coalesce(p_effective_at,now())::date,coalesce(p_effective_at,now())::date,coalesce(p_effective_at,now()),'paid',coalesce(nullif(p_payment_method,''),v_entry.payment_method),'reversal',v_key,v_entry.id,btrim(p_reason),jsonb_build_object('source','financial_management_v2'))
    on conflict (professional_id,idempotency_key) where idempotency_key is not null do update set idempotency_key=excluded.idempotency_key returning id into v_reversal_id;
  else raise exception 'Ação financeira inválida.' using errcode='22023'; end if;
  return jsonb_build_object('entry',to_jsonb(v_entry),'settlement_id',v_settlement_id,'reversal_id',v_reversal_id,'settled_amount',v_settled,'remaining_amount',greatest(v_entry.amount-v_settled,0));
end $function$;
revoke all on function public.transition_financial_entry(uuid,text,numeric,timestamptz,text,text,text) from public;
grant execute on function public.transition_financial_entry(uuid,text,numeric,timestamptz,text,text,text) to authenticated;

create or replace function public.get_financial_management_snapshot(p_month date default date_trunc('month',current_date)::date,p_basis text default 'cash')
returns jsonb language plpgsql stable security invoker set search_path='' as $function$
declare v_user_id uuid:=(select auth.uid()); v_month_start date:=date_trunc('month',coalesce(p_month,current_date))::date; v_month_end date:=(date_trunc('month',coalesce(p_month,current_date))+interval '1 month - 1 day')::date; v_result jsonb;
begin
  if v_user_id is null then raise exception 'Sessão inválida.' using errcode='42501'; end if;
  if p_basis not in ('cash','competence') then raise exception 'Regime inválido.' using errcode='22023'; end if;
  with scoped as (
    select fe.*,coalesce(fc.name,nullif(fe.metadata->>'category',''),'Sem categoria') category_name,
      coalesce(fe.competence_date,fe.due_date,fe.created_at::date) competence_reference,
      coalesce(fe.paid_at::date,fe.due_date,fe.created_at::date) cash_reference,
      coalesce(st.total,0)::numeric settled_total,coalesce(sm.total,0)::numeric settled_selected_month,coalesce(st.item_count,0)::bigint settlement_count
    from public.financial_entries fe left join public.financial_categories fc on fc.id=fe.category_id
    left join lateral (select sum(s.amount) total,count(*) item_count from public.financial_entry_settlements s where s.financial_entry_id=fe.id and s.status='posted') st on true
    left join lateral (select sum(s.amount) total from public.financial_entry_settlements s where s.financial_entry_id=fe.id and s.status='posted' and s.settled_at::date between v_month_start and v_month_end) sm on true
    where fe.professional_id=v_user_id and fe.status<>'cancelled'
  ), kpis as (
    select jsonb_build_object(
      'received',coalesce(sum(case when type='income' then case when settlement_count>0 then case when p_basis='cash' then settled_selected_month when competence_reference between v_month_start and v_month_end then settled_total else 0 end when status='paid' and (case when p_basis='cash' then cash_reference else competence_reference end) between v_month_start and v_month_end then amount else 0 end else 0 end),0),
      'paid_expenses',coalesce(sum(case when type='expense' then case when settlement_count>0 then case when p_basis='cash' then settled_selected_month when competence_reference between v_month_start and v_month_end then settled_total else 0 end when status='paid' and (case when p_basis='cash' then cash_reference else competence_reference end) between v_month_start and v_month_end then amount else 0 end else 0 end),0)
    ) value from scoped
  ), open_income as (
    select jsonb_build_object('receivable',coalesce(sum(greatest(amount-settled_total,0)),0),'overdue',coalesce(sum(greatest(amount-settled_total,0)) filter(where due_date<current_date),0),'overdue_count',count(*) filter(where due_date<current_date)) value
    from scoped where type='income' and status in ('planned','pending','overdue')
  )
  select jsonb_build_object('month',to_char(v_month_start,'YYYY-MM'),'basis',p_basis,'kpis',kpis.value||open_income.value||jsonb_build_object('result',(kpis.value->>'received')::numeric-(kpis.value->>'paid_expenses')::numeric)) into v_result from kpis,open_income;
  return v_result;
end $function$;
revoke all on function public.get_financial_management_snapshot(date,text) from public;
grant execute on function public.get_financial_management_snapshot(date,text) to authenticated;

commit;
