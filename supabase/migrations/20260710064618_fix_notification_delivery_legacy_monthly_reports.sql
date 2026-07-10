begin;

-- email_monthly_reports was removed with the monthly report legacy schema.
-- Keep dashboard notifications valid in-app, but do not request email delivery
-- for that removed monthly-report channel.
create or replace function public.prepare_notification_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings public.user_notification_settings%rowtype;
  push_requested boolean := false;
  push_allowed boolean := false;
  email_requested boolean := false;
  email_allowed boolean := false;
begin
  select * into settings
  from public.user_notification_settings
  where user_id = new.user_id;

  push_requested :=
    lower(coalesce(new.data ->> 'nativePushEligible', new.payload ->> 'nativePushEligible', 'false')) in ('true', '1', 'yes', 'sim')
    or lower(coalesce(new.priority, 'normal')) = 'urgent';

  push_allowed := coalesce(settings.push_enabled, false);

  if push_requested and push_allowed then
    new.push_status := 'pending';
    new.push_requested_at := coalesce(new.push_requested_at, now());
  elsif push_requested then
    new.push_status := 'disabled';
    new.push_requested_at := null;
  else
    new.push_status := 'not_requested';
    new.push_requested_at := null;
  end if;

  email_requested := new.category in ('agenda', 'financeiro', 'seguranca');
  email_allowed := coalesce(settings.email_enabled, true) and case new.category
    when 'agenda' then coalesce(settings.email_appointment_reminders, true)
    when 'financeiro' then coalesce(settings.email_payment_confirmations, true)
    when 'seguranca' then coalesce(settings.email_security_alerts, true)
    else false
  end;

  if email_requested and email_allowed then
    new.email_status := 'pending';
    new.email_requested_at := coalesce(new.email_requested_at, now());
  elsif email_requested then
    new.email_status := 'disabled';
    new.email_requested_at := null;
  else
    new.email_status := 'not_requested';
    new.email_requested_at := null;
  end if;

  return new;
end;
$$;

revoke all on function public.prepare_notification_delivery() from public;
grant execute on function public.prepare_notification_delivery() to service_role;

create or replace function public.emit_user_notification(
  p_user_id uuid,
  p_event_id text,
  p_type text,
  p_category text,
  p_severity text,
  p_title text,
  p_message text,
  p_action_url text default null,
  p_priority text default 'normal',
  p_data jsonb default '{}'::jsonb,
  p_payload jsonb default '{}'::jsonb,
  p_organization_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_category text := lower(coalesce(nullif(p_category, ''), 'sistema'));
  v_severity text := lower(coalesce(nullif(p_severity, ''), 'info'));
  v_priority text := lower(coalesce(nullif(p_priority, ''), 'normal'));
  v_data jsonb := coalesce(p_data, '{}'::jsonb);
  v_email_enabled boolean := true;
  v_email_appointment_reminders boolean := true;
  v_email_payment_confirmations boolean := true;
  v_email_security_alerts boolean := true;
  v_push_enabled boolean := false;
  v_push_requested boolean := false;
  v_email_requested boolean := false;
begin
  if p_user_id is null or coalesce(p_title, '') = '' then
    return null;
  end if;

  if v_category = 'pacientes' then
    v_category := 'prontuario';
  elsif v_category = 'clinica' then
    v_category := 'sistema';
  elsif v_category not in (
    'dashboard',
    'agenda',
    'prontuario',
    'teleconsulta',
    'neurodrive',
    'financeiro',
    'synapse',
    'ajustes',
    'seguranca',
    'sistema'
  ) then
    v_category := 'sistema';
  end if;

  if v_severity not in ('success', 'info', 'warning', 'destructive') then
    v_severity := 'info';
  end if;

  if v_priority not in ('low', 'normal', 'high', 'urgent') then
    v_priority := case when v_severity in ('warning', 'destructive') then 'high' else 'normal' end;
  end if;

  if v_category = 'financeiro' and not (v_data ? 'financeScope') then
    v_data := v_data || jsonb_build_object('financeScope', 'gestao');
  end if;

  v_data := jsonb_strip_nulls(
    v_data ||
    jsonb_build_object(
      'sourceModule',
      coalesce(v_data ->> 'sourceModule', v_category),
      'requiresAction',
      coalesce((lower(coalesce(v_data ->> 'requiresAction', 'false')) in ('true', '1', 'yes', 'sim')), false),
      'nativePushEligible',
      coalesce((lower(coalesce(v_data ->> 'nativePushEligible', 'false')) in ('true', '1', 'yes', 'sim')), false)
    )
  );

  select
    coalesce(email_enabled, true),
    coalesce(email_appointment_reminders, true),
    coalesce(email_payment_confirmations, true),
    coalesce(email_security_alerts, true),
    coalesce(push_enabled, false)
    into
      v_email_enabled,
      v_email_appointment_reminders,
      v_email_payment_confirmations,
      v_email_security_alerts,
      v_push_enabled
  from public.user_notification_settings
  where user_id = p_user_id;

  if not found then
    v_email_enabled := true;
    v_email_appointment_reminders := true;
    v_email_payment_confirmations := true;
    v_email_security_alerts := true;
    v_push_enabled := false;
  end if;

  v_push_requested :=
    v_push_enabled
    and (
      lower(coalesce(v_data ->> 'nativePushEligible', 'false')) in ('true', '1', 'yes', 'sim')
      or v_priority = 'urgent'
    );

  v_email_requested :=
    v_email_enabled
    and case v_category
      when 'agenda' then v_email_appointment_reminders
      when 'financeiro' then v_email_payment_confirmations
      when 'seguranca' then v_email_security_alerts
      else false
    end;

  insert into public.notifications (
    user_id,
    organization_id,
    event_id,
    type,
    category,
    severity,
    title,
    message,
    action_url,
    priority,
    data,
    payload,
    subaccount_id,
    push_status,
    push_requested_at,
    email_status,
    email_requested_at,
    read,
    read_at,
    dismissed_at,
    created_at,
    updated_at
  ) values (
    p_user_id,
    p_organization_id,
    p_event_id,
    coalesce(nullif(p_type, ''), 'system'),
    v_category,
    v_severity,
    p_title,
    coalesce(p_message, ''),
    p_action_url,
    v_priority,
    v_data,
    coalesce(p_payload, '{}'::jsonb),
    v_data ->> 'subaccountId',
    case when v_push_requested then 'pending' else 'not_requested' end,
    case when v_push_requested then now() else null end,
    case when v_email_requested then 'pending' else 'not_requested' end,
    case when v_email_requested then now() else null end,
    false,
    null,
    null,
    now(),
    now()
  )
  on conflict (user_id, event_id)
  do update set
    organization_id = excluded.organization_id,
    type = excluded.type,
    category = excluded.category,
    severity = excluded.severity,
    title = excluded.title,
    message = excluded.message,
    action_url = excluded.action_url,
    priority = excluded.priority,
    data = excluded.data,
    payload = excluded.payload,
    subaccount_id = excluded.subaccount_id,
    push_status = case
      when excluded.push_status = 'pending'
        and public.notifications.push_status in ('not_requested', 'failed', 'no_devices')
      then 'pending'
      else public.notifications.push_status
    end,
    push_requested_at = case
      when excluded.push_status = 'pending'
      then now()
      else public.notifications.push_requested_at
    end,
    email_status = case
      when excluded.email_status = 'pending'
        and public.notifications.email_status in ('not_requested', 'failed', 'no_recipient')
      then 'pending'
      else public.notifications.email_status
    end,
    email_requested_at = case
      when excluded.email_status = 'pending'
      then now()
      else public.notifications.email_requested_at
    end,
    read = false,
    read_at = null,
    dismissed_at = null,
    created_at = now(),
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.emit_user_notification(uuid, text, text, text, text, text, text, text, text, jsonb, jsonb, uuid) from public;
grant execute on function public.emit_user_notification(uuid, text, text, text, text, text, text, text, text, jsonb, jsonb, uuid) to service_role;

notify pgrst, 'reload schema';

commit;
