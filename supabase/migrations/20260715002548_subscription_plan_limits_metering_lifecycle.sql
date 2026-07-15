begin;

-- This migration only adds structures or replaces computed/read-only contracts.
-- It does not delete subscription, patient, portal, checkout, or usage data.

alter table public.subscription_plan_catalog
  add column if not exists trial_features jsonb not null default '{}'::jsonb,
  add column if not exists trial_limits jsonb not null default '{}'::jsonb,
  add column if not exists trial_internal_flags jsonb not null default '{}'::jsonb;

update public.subscription_plan_catalog
set
  public_name = 'Essential',
  description = 'Plano gratuito para a rotina essencial do profissional.',
  price_cents = 0,
  billing_cycle = 'FREE',
  is_active = true,
  features = jsonb_build_object(
    'ai_copilot', true,
    'telemedicine', true,
    'teleconsultation_transcription', false,
    'manual_finance', true,
    'advanced_finance', false,
    'neurofinance', false,
    'fiscal', false,
    'patient_portal', true,
    'neurodrive', true,
    'neurobox', false,
    'neuroview', false,
    'neuroflow', false,
    'neuropulse', false,
    'neuroscan', false,
    'synapse_whatsapp', false,
    'neurozap', false,
    'external_integrations', false,
    'multiple_professionals', false,
    'admin_dashboard', false,
    'performance_reports', false,
    'api_access', false
  ),
  limits = jsonb_build_object(
    'patients', 5,
    'patient_portal_active_links', 5,
    'session_records_monthly', null,
    'ai_monthly_actions', 30,
    'synapse_text_messages', 30,
    'synapse_voice_minutes', 5,
    'teleconsultations_monthly', 5,
    'teleconsultation_minutes_monthly', 150,
    'teleconsultation_distinct_patients_monthly', 5,
    'teleconsultation_transcription_minutes', 0,
    'neurodrive_documents', 100,
    'neurodrive_storage_mb', 250,
    'whatsapp_business_numbers', 0,
    'whatsapp_utility_messages', 0,
    'integrations', 0,
    'reports_monthly', 0
  ),
  internal_flags = jsonb_build_object(
    'can_use_neurofinance', false,
    'can_use_synapse', true,
    'can_use_neurodrive', true,
    'can_use_neurobox', false,
    'can_use_whatsapp', false,
    'public_visible', true,
    'overage_policy', 'block'
  ),
  trial_features = '{}'::jsonb,
  trial_limits = '{}'::jsonb,
  trial_internal_flags = '{}'::jsonb,
  updated_at = now()
where plan_code = 'essential';

update public.subscription_plan_catalog
set
  public_name = 'Professional',
  description = 'Plano profissional mensal NeuroNex.',
  price_cents = 22990,
  billing_cycle = 'MONTHLY',
  is_active = true,
  features = jsonb_build_object(
    'ai_copilot', true,
    'telemedicine', true,
    'teleconsultation_transcription', true,
    'manual_finance', true,
    'advanced_finance', true,
    'neurofinance', true,
    'fiscal', true,
    'patient_portal', true,
    'neurodrive', true,
    'neurobox', true,
    'neuroview', true,
    'neuroflow', true,
    'neuropulse', true,
    'neuroscan', true,
    'synapse_whatsapp', true,
    'neurozap', true,
    'external_integrations', true,
    'multiple_professionals', false,
    'admin_dashboard', false,
    'performance_reports', false,
    'api_access', false
  ),
  limits = jsonb_build_object(
    'patients', 250,
    'patient_portal_active_links', 250,
    'session_records_monthly', null,
    'ai_monthly_actions', 500,
    'synapse_text_messages', 500,
    'synapse_voice_minutes', 60,
    'teleconsultations_monthly', 80,
    'teleconsultation_minutes_monthly', null,
    'teleconsultation_distinct_patients_monthly', 20,
    'teleconsultation_transcription_minutes', 300,
    'neurodrive_documents', 2000,
    'neurodrive_storage_mb', 5120,
    'whatsapp_business_numbers', 1,
    'whatsapp_utility_messages', 250,
    'integrations', null,
    'reports_monthly', null
  ),
  internal_flags = jsonb_build_object(
    'can_use_neurofinance', true,
    'can_use_synapse', true,
    'can_use_neurodrive', true,
    'can_use_neurobox', true,
    'can_use_whatsapp', true,
    'public_visible', true,
    'overage_policy', 'block'
  ),
  trial_features = jsonb_build_object(
    'ai_copilot', true,
    'telemedicine', true,
    'teleconsultation_transcription', true,
    'manual_finance', true,
    'advanced_finance', false,
    'neurofinance', false,
    'fiscal', false,
    'patient_portal', true,
    'neurodrive', true,
    'neurobox', true,
    'neuroview', true,
    'neuroflow', true,
    'neuropulse', true,
    'neuroscan', true,
    'synapse_whatsapp', false,
    'neurozap', false,
    'external_integrations', false,
    'multiple_professionals', false,
    'admin_dashboard', false,
    'performance_reports', false,
    'api_access', false
  ),
  trial_limits = jsonb_build_object(
    'patients', 250,
    'patient_portal_active_links', 250,
    'session_records_monthly', null,
    'ai_monthly_actions', 50,
    'synapse_text_messages', 50,
    'synapse_voice_minutes', 15,
    'teleconsultations_monthly', 3,
    'teleconsultation_minutes_monthly', null,
    'teleconsultation_distinct_patients_monthly', 3,
    'teleconsultation_transcription_minutes', 60,
    'neurodrive_documents', 2000,
    'neurodrive_storage_mb', 5120,
    'whatsapp_business_numbers', 0,
    'whatsapp_utility_messages', 0,
    'integrations', 0,
    'reports_monthly', null
  ),
  trial_internal_flags = jsonb_build_object(
    'can_use_neurofinance', false,
    'can_use_synapse', true,
    'can_use_neurodrive', true,
    'can_use_neurobox', true,
    'can_use_whatsapp', false,
    'public_visible', true,
    'overage_policy', 'block'
  ),
  updated_at = now()
where plan_code = 'professional';

-- Enterprise stays available for existing internal records, but is not public or sellable.
update public.subscription_plan_catalog
set
  is_active = false,
  internal_flags = coalesce(internal_flags, '{}'::jsonb) || jsonb_build_object(
    'public_visible', false,
    'overage_policy', 'contract'
  ),
  updated_at = now()
where plan_code = 'enterprise';

alter table public.user_subscriptions
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists scheduled_plan_code text,
  add column if not exists scheduled_change_at timestamptz,
  add column if not exists access_ends_at timestamptz,
  add column if not exists transition_ends_at timestamptz,
  add column if not exists data_custody_state text not null default 'active',
  add column if not exists export_available_until timestamptz;

alter table public.user_subscriptions
  drop constraint if exists user_subscriptions_scheduled_plan_code_fkey,
  add constraint user_subscriptions_scheduled_plan_code_fkey
    foreign key (scheduled_plan_code)
    references public.subscription_plan_catalog(plan_code),
  drop constraint if exists user_subscriptions_data_custody_state_check,
  add constraint user_subscriptions_data_custody_state_check
    check (data_custody_state in ('active', 'continuity', 'export_window', 'retained'));

alter table public.subscription_usage_counters
  add column if not exists unit text not null default 'count',
  add column if not exists last_event_at timestamptz;

create table if not exists public.subscription_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null references public.subscription_plan_catalog(plan_code),
  feature_key text not null,
  quantity integer not null,
  unit text not null default 'count',
  period_start date not null,
  period_end date not null,
  idempotency_key text,
  source text not null default 'edge_function',
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint subscription_usage_events_quantity_check check (quantity > 0),
  constraint subscription_usage_events_period_check check (period_end > period_start),
  constraint subscription_usage_events_feature_key_check check (feature_key in (
    'patients',
    'patient_portal_active_links',
    'synapse_text_messages',
    'synapse_voice_minutes',
    'teleconsultations_monthly',
    'teleconsultation_minutes_monthly',
    'teleconsultation_distinct_patients_monthly',
    'teleconsultation_transcription_minutes',
    'neurodrive_documents',
    'neurodrive_storage_mb',
    'whatsapp_business_numbers',
    'whatsapp_utility_messages'
  ))
);

create unique index if not exists subscription_usage_events_idempotency_uidx
  on public.subscription_usage_events(user_id, feature_key, period_start, idempotency_key)
  where idempotency_key is not null;

create index if not exists subscription_usage_events_user_period_idx
  on public.subscription_usage_events(user_id, period_start, feature_key, occurred_at desc);

create table if not exists public.subscription_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_record_id uuid,
  event_type text not null,
  from_plan_code text,
  to_plan_code text,
  effective_at timestamptz not null default now(),
  transition_ends_at timestamptz,
  data_custody_state text,
  source text not null default 'system',
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint subscription_lifecycle_events_type_check check (event_type in (
    'trial_started',
    'checkout_started',
    'payment_confirmed',
    'cancel_scheduled',
    'cancel_reverted',
    'period_ended',
    'payment_failed',
    'grace_started',
    'transition_started',
    'downgrade_completed',
    'access_blocked',
    'access_restored',
    'export_window_started',
    'custody_retained'
  )),
  constraint subscription_lifecycle_events_custody_check check (
    data_custody_state is null or data_custody_state in ('active', 'continuity', 'export_window', 'retained')
  )
);

create unique index if not exists subscription_lifecycle_events_idempotency_uidx
  on public.subscription_lifecycle_events(user_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists subscription_lifecycle_events_user_created_idx
  on public.subscription_lifecycle_events(user_id, created_at desc);

drop function if exists public.current_user_can_use_feature(text);
drop view if exists public.current_subscription_entitlements;

create view public.current_subscription_entitlements
with (security_invoker = true)
as
with entitlement_source as (
  select
    us.*,
    pc.public_name,
    pc.price_cents,
    pc.currency,
    pc.billing_cycle,
    case
      when us.status = 'trialing'
        and us.trial_ends_at is not null
        and us.trial_ends_at > now()
      then coalesce(nullif(pc.trial_features, '{}'::jsonb), pc.features)
      else pc.features
    end as configured_features,
    case
      when us.status = 'trialing'
        and us.trial_ends_at is not null
        and us.trial_ends_at > now()
      then coalesce(nullif(pc.trial_limits, '{}'::jsonb), pc.limits)
      else pc.limits
    end as configured_limits,
    case
      when us.status = 'trialing'
        and us.trial_ends_at is not null
        and us.trial_ends_at > now()
      then coalesce(nullif(pc.trial_internal_flags, '{}'::jsonb), pc.internal_flags)
      else pc.internal_flags
    end as configured_internal_flags,
    ep.public_name as essential_public_name,
    ep.features as essential_features,
    ep.limits as essential_limits,
    ep.internal_flags as essential_internal_flags,
    (
      us.status = 'trialing'
      and us.trial_ends_at is not null
      and us.trial_ends_at <= now()
    ) as trial_is_expired,
    (
      us.status = 'admin_override'
      or (
        us.status = 'active'
        and us.access_state = 'paid_access'
        and (
          us.last_payment_id is not null
          or upper(coalesce(us.last_payment_status, '')) in (
            'CONFIRMED',
            'RECEIVED',
            'RECEIVED_IN_CASH',
            'CHECKOUT_PAID',
            'PAYMENT_CONFIRMED',
            'PAYMENT_RECEIVED'
          )
          or (
            us.asaas_subscription_id is not null
            and us.last_payment_event_at is not null
          )
        )
      )
    ) as payment_backed_paid_access
  from public.user_subscriptions us
  left join public.subscription_plan_catalog pc
    on pc.plan_code = us.plan_code
  left join public.subscription_plan_catalog ep
    on ep.plan_code = 'essential'
),
entitlement_resolved as (
  select
    *,
    (
      not payment_backed_paid_access
      and (
        trial_is_expired
        or status in ('trial_expired', 'checkout_pending', 'payment_pending')
        or (status = 'active' and access_state = 'paid_access')
      )
    ) as should_fallback_to_essential,
    case
      when not payment_backed_paid_access
        and (
          trial_is_expired
          or status in ('trial_expired', 'checkout_pending', 'payment_pending')
          or (status = 'active' and access_state = 'paid_access')
        )
      then 'active'
      else status
    end as resolved_status,
    case
      when not payment_backed_paid_access
        and (
          trial_is_expired
          or status in ('trial_expired', 'checkout_pending', 'payment_pending')
          or (status = 'active' and access_state = 'paid_access')
        )
      then 'limited_access'
      else access_state
    end as resolved_access_state
  from entitlement_source
),
entitlement_gated as (
  select
    *,
    (
      (
        resolved_status = 'trialing'
        and (trial_ends_at is null or trial_ends_at > now())
        and resolved_access_state = 'trial_access'
      )
      or (
        resolved_status = 'active'
        and resolved_access_state = 'limited_access'
      )
      or payment_backed_paid_access
      or resolved_status = 'admin_override'
    ) as has_current_access
  from entitlement_resolved
)
select
  user_id,
  id as subscription_record_id,
  case when should_fallback_to_essential then 'Essential' else plan end as plan,
  case when should_fallback_to_essential then 'essential' else plan_code end as plan_code,
  resolved_status as effective_status,
  resolved_access_state as effective_access_state,
  status,
  access_state,
  current_period_start,
  current_period_end,
  trial_started_at,
  trial_ends_at,
  grace_period_ends_at,
  cancel_at_period_end,
  scheduled_plan_code,
  scheduled_change_at,
  access_ends_at,
  transition_ends_at,
  data_custody_state,
  export_available_until,
  asaas_customer_id,
  asaas_subscription_id,
  last_payment_id,
  last_payment_status,
  last_payment_event_at,
  case when should_fallback_to_essential then essential_public_name else public_name end as public_name,
  case when should_fallback_to_essential then 0 else price_cents end as price_cents,
  currency,
  billing_cycle,
  case
    when should_fallback_to_essential then coalesce(essential_features, '{}'::jsonb)
    when has_current_access then coalesce(configured_features, '{}'::jsonb)
    else coalesce(essential_features, '{}'::jsonb)
  end as features,
  case
    when should_fallback_to_essential then coalesce(essential_limits, '{}'::jsonb)
    when has_current_access then coalesce(configured_limits, '{}'::jsonb)
    else coalesce(essential_limits, '{}'::jsonb)
  end as limits,
  case
    when should_fallback_to_essential then coalesce(essential_internal_flags, '{}'::jsonb)
    when has_current_access then coalesce(configured_internal_flags, '{}'::jsonb)
    else coalesce(essential_internal_flags, '{}'::jsonb)
  end as internal_flags,
  payment_backed_paid_access as has_paid_access,
  has_current_access,
  (
    case
      when should_fallback_to_essential then false
      when status in ('blocked', 'canceled', 'past_due', 'refunded', 'chargeback', 'internal_error') then true
      else false
    end
  ) as requires_upsell
from entitlement_gated;

create or replace function public.current_user_can_use_feature(feature_key text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    (
      select
        case
          when cse.effective_status not in ('active', 'trialing', 'admin_override') then false
          when cse.effective_access_state not in ('paid_access', 'trial_access', 'limited_access', 'admin_override') then false
          when cse.has_current_access is not true then false
          when feature_key in ('basic_access', 'patients') then true
          when feature_key in ('advanced_finance', 'neurofinance', 'fiscal', 'synapse_whatsapp', 'neurozap')
            and cse.has_paid_access is not true then false
          else coalesce((cse.features ->> feature_key)::boolean, false)
        end
      from public.current_subscription_entitlements cse
      where cse.user_id = (select auth.uid())
      limit 1
    ),
    false
  );
$$;

create or replace function public.subscription_usage_status(
  p_user_id uuid,
  p_feature_key text,
  p_at timestamptz default now()
)
returns table (
  allowed boolean,
  used_count integer,
  limit_count integer,
  remaining_count integer,
  period_start date,
  period_end date
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_limit_text text;
  v_limit integer;
  v_used integer;
  v_period_start date := date_trunc('month', p_at)::date;
  v_period_end date := (date_trunc('month', p_at) + interval '1 month')::date;
begin
  select cse.limits ->> p_feature_key
  into v_limit_text
  from public.current_subscription_entitlements cse
  where cse.user_id = p_user_id
    and cse.has_current_access is true
  limit 1;

  if not found then
    return query select false, 0, 0, 0, v_period_start, v_period_end;
    return;
  end if;

  if v_limit_text is null or v_limit_text = 'unlimited' then
    v_limit := null;
  elsif v_limit_text ~ '^\d+$' then
    v_limit := v_limit_text::integer;
  else
    return query select false, 0, 0, 0, v_period_start, v_period_end;
    return;
  end if;

  select coalesce(suc.used_count, 0)
  into v_used
  from public.subscription_usage_counters suc
  where suc.user_id = p_user_id
    and suc.feature_key = p_feature_key
    and suc.period_start = v_period_start;

  v_used := coalesce(v_used, 0);
  return query select
    v_limit is null or v_used < v_limit,
    v_used,
    v_limit,
    case when v_limit is null then null else greatest(v_limit - v_used, 0) end,
    v_period_start,
    v_period_end;
end;
$$;

create or replace function public.record_subscription_usage(
  p_user_id uuid,
  p_feature_key text,
  p_quantity integer,
  p_unit text default 'count',
  p_idempotency_key text default null,
  p_source text default 'edge_function',
  p_metadata jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default now()
)
returns table (
  allowed boolean,
  used_count integer,
  limit_count integer,
  remaining_count integer,
  period_start date,
  period_end date,
  duplicate boolean
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_plan_code text;
  v_limit_text text;
  v_limit integer;
  v_used integer;
  v_period_start date := date_trunc('month', p_occurred_at)::date;
  v_period_end date := (date_trunc('month', p_occurred_at) + interval '1 month')::date;
  v_duplicate boolean := false;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception using errcode = '22023', message = 'subscription_usage_quantity_invalid';
  end if;

  if p_feature_key not in (
    'patients',
    'patient_portal_active_links',
    'synapse_text_messages',
    'synapse_voice_minutes',
    'teleconsultations_monthly',
    'teleconsultation_minutes_monthly',
    'teleconsultation_distinct_patients_monthly',
    'teleconsultation_transcription_minutes',
    'neurodrive_documents',
    'neurodrive_storage_mb',
    'whatsapp_business_numbers',
    'whatsapp_utility_messages'
  ) then
    raise exception using errcode = '22023', message = 'subscription_usage_feature_invalid';
  end if;

  select cse.plan_code, cse.limits ->> p_feature_key
  into v_plan_code, v_limit_text
  from public.current_subscription_entitlements cse
  where cse.user_id = p_user_id
    and cse.has_current_access is true
  limit 1;

  if not found then
    return query select false, 0, 0, 0, v_period_start, v_period_end, false;
    return;
  end if;

  if v_limit_text is null or v_limit_text = 'unlimited' then
    v_limit := null;
  elsif v_limit_text ~ '^\d+$' then
    v_limit := v_limit_text::integer;
  else
    return query select false, 0, 0, 0, v_period_start, v_period_end, false;
    return;
  end if;

  insert into public.subscription_usage_counters (
    user_id,
    plan_code,
    feature_key,
    period_start,
    period_end,
    used_count,
    limit_value,
    unit,
    metadata
  ) values (
    p_user_id,
    v_plan_code,
    p_feature_key,
    v_period_start,
    v_period_end,
    0,
    case when v_limit is null then null else to_jsonb(v_limit) end,
    coalesce(nullif(btrim(p_unit), ''), 'count'),
    jsonb_build_object('created_by', 'record_subscription_usage')
  )
  on conflict (user_id, feature_key, period_start) do nothing;

  select suc.used_count
  into v_used
  from public.subscription_usage_counters suc
  where suc.user_id = p_user_id
    and suc.feature_key = p_feature_key
    and suc.period_start = v_period_start
  for update;

  if p_idempotency_key is not null then
    select exists (
      select 1
      from public.subscription_usage_events sue
      where sue.user_id = p_user_id
        and sue.feature_key = p_feature_key
        and sue.period_start = v_period_start
        and sue.idempotency_key = p_idempotency_key
    ) into v_duplicate;
  end if;

  if v_duplicate then
    return query select
      true,
      v_used,
      v_limit,
      case when v_limit is null then null else greatest(v_limit - v_used, 0) end,
      v_period_start,
      v_period_end,
      true;
    return;
  end if;

  if v_limit is not null and v_used + p_quantity > v_limit then
    return query select
      false,
      v_used,
      v_limit,
      greatest(v_limit - v_used, 0),
      v_period_start,
      v_period_end,
      false;
    return;
  end if;

  insert into public.subscription_usage_events (
    user_id,
    plan_code,
    feature_key,
    quantity,
    unit,
    period_start,
    period_end,
    idempotency_key,
    source,
    metadata,
    occurred_at
  ) values (
    p_user_id,
    v_plan_code,
    p_feature_key,
    p_quantity,
    coalesce(nullif(btrim(p_unit), ''), 'count'),
    v_period_start,
    v_period_end,
    p_idempotency_key,
    coalesce(nullif(btrim(p_source), ''), 'edge_function'),
    coalesce(p_metadata, '{}'::jsonb),
    p_occurred_at
  );

  update public.subscription_usage_counters suc
  set
    plan_code = v_plan_code,
    period_end = v_period_end,
    used_count = suc.used_count + p_quantity,
    limit_value = case when v_limit is null then null else to_jsonb(v_limit) end,
    unit = coalesce(nullif(btrim(p_unit), ''), 'count'),
    last_event_at = p_occurred_at,
    updated_at = now()
  where suc.user_id = p_user_id
    and suc.feature_key = p_feature_key
    and suc.period_start = v_period_start
  returning suc.used_count into v_used;

  return query select
    true,
    v_used,
    v_limit,
    case when v_limit is null then null else greatest(v_limit - v_used, 0) end,
    v_period_start,
    v_period_end,
    false;
end;
$$;

create or replace function public.enforce_patient_portal_subscription_limit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_limit_text text;
  v_limit integer;
  v_existing_count integer;
begin
  if new.status <> 'active' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'active' and old.psychologist_user_id = new.psychologist_user_id then
    return new;
  end if;

  select cse.limits ->> 'patient_portal_active_links'
  into v_limit_text
  from public.current_subscription_entitlements cse
  where cse.user_id = new.psychologist_user_id
    and cse.has_current_access is true
  limit 1;

  if not found then
    raise exception using errcode = 'P0001', message = 'subscription_required';
  end if;

  if v_limit_text is null or v_limit_text = 'unlimited' then
    return new;
  end if;

  v_limit := v_limit_text::integer;

  select count(*)
  into v_existing_count
  from public.patient_portal_links ppl
  where ppl.psychologist_user_id = new.psychologist_user_id
    and ppl.status = 'active'
    and ppl.id is distinct from new.id;

  if v_existing_count >= v_limit then
    raise exception using
      errcode = 'P0001',
      message = 'patient_portal_link_limit_reached',
      detail = format('Active portal link limit is %s.', v_limit);
  end if;

  return new;
end;
$$;

drop trigger if exists patient_portal_links_enforce_subscription_limit on public.patient_portal_links;
create trigger patient_portal_links_enforce_subscription_limit
before insert or update of status, psychologist_user_id on public.patient_portal_links
for each row execute function public.enforce_patient_portal_subscription_limit();

alter table public.subscription_usage_events enable row level security;
alter table public.subscription_lifecycle_events enable row level security;

drop policy if exists "Public can read active subscription plans" on public.subscription_plan_catalog;
create policy "Public can read active subscription plans"
on public.subscription_plan_catalog
for select
to anon
using (is_active = true and coalesce((internal_flags ->> 'public_visible')::boolean, true));

drop policy if exists "Users can read active or assigned subscription plans" on public.subscription_plan_catalog;
create policy "Users can read active or assigned subscription plans"
on public.subscription_plan_catalog
for select
to authenticated
using (
  (is_active = true and coalesce((internal_flags ->> 'public_visible')::boolean, true))
  or exists (
    select 1
    from public.user_subscriptions us
    where us.user_id = (select auth.uid())
      and us.plan_code = subscription_plan_catalog.plan_code
  )
);

drop policy if exists "Anyone can read active subscription plans" on public.subscription_plan_catalog;

drop policy if exists "Users can view own usage events" on public.subscription_usage_events;
create policy "Users can view own usage events"
on public.subscription_usage_events
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Service role manages usage events" on public.subscription_usage_events;
create policy "Service role manages usage events"
on public.subscription_usage_events
for all
to service_role
using (true)
with check (true);

drop policy if exists "Users can view own lifecycle events" on public.subscription_lifecycle_events;
create policy "Users can view own lifecycle events"
on public.subscription_lifecycle_events
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Service role manages lifecycle events" on public.subscription_lifecycle_events;
create policy "Service role manages lifecycle events"
on public.subscription_lifecycle_events
for all
to service_role
using (true)
with check (true);

revoke all on public.subscription_usage_events from anon, authenticated;
grant select on public.subscription_usage_events to authenticated;
grant all on public.subscription_usage_events to service_role;

revoke all on public.subscription_lifecycle_events from anon, authenticated;
grant select on public.subscription_lifecycle_events to authenticated;
grant all on public.subscription_lifecycle_events to service_role;

grant select on public.current_subscription_entitlements to authenticated;

revoke all on function public.current_user_can_use_feature(text) from public, anon;
grant execute on function public.current_user_can_use_feature(text) to authenticated;

revoke all on function public.subscription_usage_status(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.subscription_usage_status(uuid, text, timestamptz) to service_role;

revoke all on function public.record_subscription_usage(uuid, text, integer, text, text, text, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.record_subscription_usage(uuid, text, integer, text, text, text, jsonb, timestamptz) to service_role;

revoke all on function public.enforce_patient_portal_subscription_limit() from public, anon, authenticated;

comment on column public.subscription_plan_catalog.trial_limits is
  'Server-owned limits used only while a Professional trial is valid.';

comment on table public.subscription_usage_events is
  'Idempotent ledger of completed subscription usage. Direct writes are service-role only.';

comment on table public.subscription_lifecycle_events is
  'Append-only subscription lifecycle history. It does not delete retained product data.';

comment on view public.current_subscription_entitlements is
  'Current entitlement surface with trial-specific limits and Essential fallback until confirmed payment.';

notify pgrst, 'reload schema';

commit;
