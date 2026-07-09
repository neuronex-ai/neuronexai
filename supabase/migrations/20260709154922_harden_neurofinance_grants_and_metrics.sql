-- Harden residual NeuroFinance grants and move metrics off legacy transactions.
--
-- Non-destructive phase:
-- - remove stale anon/authenticated table privileges such as REFERENCES, TRIGGER
--   and TRUNCATE from provider-backed financial tables;
-- - keep authenticated reads limited to safe columns/views;
-- - add the remaining FK-side index introduced with contract acceptances;
-- - make get_financial_metrics read financial_entries instead of transactions.

revoke all privileges on table public.financial_accounts from anon, authenticated;
revoke all privileges on table public.nb_payments from anon, authenticated;
revoke all privileges on table public.nb_payouts from anon, authenticated;

grant select (
  id, user_id, status, provider, onboarding_started_at, onboarding_completed_at,
  charges_enabled, payouts_enabled, details_submitted, default_currency,
  bank_account_last4, bank_name, pix_enabled, card_enabled,
  platform_fee_percent, platform_fee_fixed, created_at, updated_at,
  asaas_account_id, asaas_wallet_id, requirements, asaas_onboarding_url,
  asaas_environment, last_asaas_event_type, last_asaas_event_at,
  last_balance_sync_at, last_sync_error, holder_name, cpf_cnpj, birth_date,
  mobile_phone, pep_status, address_street, address_number, address_complement,
  address_neighborhood, address_city, address_state, address_postal_code,
  company_type, income_value, business_url, business_description, business_mcc,
  bank_code, bank_agency, bank_account_type, bank_holder_name,
  bank_holder_cpf_cnpj, tos_accepted_at, pix_key_consent_at,
  neuronex_terms_version, asaas_terms_reference, asaas_privacy_policy_reference
) on public.financial_accounts to authenticated;

grant select (
  id, user_id, patient_id, appointment_id, financial_account_id, provider,
  payment_method_type, status, normalized_status, funds_status, gross_amount,
  platform_fee_amount, estimated_fee_amount, actual_fee_amount, net_amount,
  currency, description, pix_qr_code, pix_copy_paste, checkout_url,
  boleto_url, boleto_pdf, refund_amount, paid_at, expires_at, confirmed_at,
  available_at, estimated_credit_at, installments, channel, dispute_status,
  dispute_reason, dispute_amount, anticipable, anticipated,
  provider_due_date, nfse_provider, nfse_reference, nfse_status, nfse_number,
  nfse_verification_code, nfse_pdf_url, nfse_xml_url, nfse_status_description,
  nfse_authorized_at, nfse_synced_at, nfse_error_message, created_at, updated_at
) on public.nb_payments to authenticated;

grant select (
  id, user_id, financial_account_id, provider, amount, currency, status,
  operation_type, fee_amount, destination_type, destination_summary,
  requested_at, processed_at, completed_at, created_at, updated_at
) on public.nb_payouts to authenticated;

revoke all privileges on table public.financial_accounts_safe_v from anon;
revoke all privileges on table public.nb_payments_safe_v from anon;
revoke all privileges on table public.nb_payouts_safe_v from anon;

grant select on public.financial_accounts_safe_v to authenticated;
grant select on public.nb_payments_safe_v to authenticated;
grant select on public.nb_payouts_safe_v to authenticated;

revoke all privileges on table public.neurofinance_contract_acceptances from anon, authenticated;
grant select on public.neurofinance_contract_acceptances to authenticated;

create index if not exists idx_neurofinance_acceptances_actor_user
  on public.neurofinance_contract_acceptances(actor_user_id)
  where actor_user_id is not null;

create or replace function public.get_financial_metrics(
  p_user_id uuid,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_revenue numeric := 0;
  v_expenses numeric := 0;
  v_pending_invoices numeric := 0;
  v_projected_revenue numeric := 0;
  v_period_start date := p_start_date;
  v_period_end date := p_end_date;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and auth.uid() is distinct from p_user_id then
    raise exception 'not allowed to read financial metrics for this user'
      using errcode = '42501';
  end if;

  select coalesce(sum(amount), 0)
  into v_revenue
  from public.financial_entries
  where professional_id = p_user_id
    and type = 'income'
    and status <> 'cancelled'
    and (status = 'paid' or paid_at is not null)
    and coalesce(paid_at::date, due_date, competence_date, created_at::date)
      between v_period_start and v_period_end;

  select coalesce(sum(amount), 0)
  into v_expenses
  from public.financial_entries
  where professional_id = p_user_id
    and type = 'expense'
    and status <> 'cancelled'
    and coalesce(paid_at::date, due_date, competence_date, created_at::date)
      between v_period_start and v_period_end;

  select coalesce(sum(amount), 0)
  into v_pending_invoices
  from public.financial_entries
  where professional_id = p_user_id
    and type = 'income'
    and status in ('pending', 'overdue')
    and coalesce(due_date, competence_date, created_at::date)
      between v_period_start and v_period_end;

  v_projected_revenue := v_revenue + v_pending_invoices;

  return jsonb_build_object(
    'currentMonthRevenue', v_revenue,
    'currentMonthExpenses', v_expenses,
    'netProfit', v_revenue - v_expenses,
    'projectedRevenue', v_projected_revenue,
    'pendingInvoices', v_pending_invoices,
    'projectedExpenses', v_expenses,
    'projectedNetProfit', v_projected_revenue - v_expenses,
    'source', 'financial_entries'
  );
end;
$function$;

revoke all on function public.get_financial_metrics(uuid, date, date) from public;
revoke all on function public.get_financial_metrics(uuid, date, date) from anon;
grant execute on function public.get_financial_metrics(uuid, date, date) to authenticated;
grant execute on function public.get_financial_metrics(uuid, date, date) to service_role;

comment on function public.get_financial_metrics(uuid, date, date) is
  'Returns monthly financial metrics from financial_entries, excluding cancelled income and without reading legacy transactions.';
