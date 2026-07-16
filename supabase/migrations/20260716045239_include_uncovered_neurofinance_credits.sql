-- Include real account credits that are not already represented by a paid
-- NeuroFinance charge. The ledger remains the source of truth; the view only
-- removes the duplicate provider movement created for the same charge.

create index if not exists idx_nb_payments_overview_provider_coverage
  on public.nb_payments (financial_account_id, provider_payment_id)
  where funds_status = 'available'
    and normalized_status = 'paid'
    and provider_payment_id is not null;

create index if not exists idx_neurofinance_movements_overview_account
  on public.neurofinance_account_movements (
    financial_account_id,
    direction,
    status,
    occurred_at desc
  );

create or replace function public.refresh_neurofinance_overview_snapshot(
  target_financial_account_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_user_id uuid;
  received_total integer;
  uncovered_credit_total integer;
  receivable_total integer;
  outflow_total integer;
  fee_total integer;
  current_available integer;
begin
  select fa.user_id
  into account_user_id
  from public.financial_accounts fa
  where fa.id = target_financial_account_id;

  if account_user_id is null then
    return;
  end if;

  select
    coalesce(sum(p.gross_amount) filter (
      where p.funds_status = 'available'
        and p.normalized_status = 'paid'
    ), 0),
    coalesce(sum(p.gross_amount) filter (
      where p.funds_status in ('pending', 'confirmed')
        and p.normalized_status in ('pending', 'processing', 'confirmed')
    ), 0)
  into received_total, receivable_total
  from public.nb_payments p
  where p.financial_account_id = target_financial_account_id;

  select coalesce(sum(m.amount), 0)
  into uncovered_credit_total
  from public.neurofinance_account_movements m
  where m.financial_account_id = target_financial_account_id
    and m.direction = 'credit'
    and m.status = 'posted'
    and not exists (
      select 1
      from public.nb_payments p
      where p.financial_account_id = m.financial_account_id
        and p.funds_status = 'available'
        and p.normalized_status = 'paid'
        and p.provider_payment_id is not null
        and p.provider_payment_id = m.reference_id
    );

  received_total := received_total + uncovered_credit_total;

  select
    coalesce(sum(m.amount) filter (
      where m.direction = 'debit' and m.status = 'posted'
    ), 0),
    coalesce(sum(m.amount) filter (
      where m.direction = 'debit'
        and m.status = 'posted'
        and m.movement_type in ('payment_fee', 'transfer_fee', 'service_fee')
    ), 0)
  into outflow_total, fee_total
  from public.neurofinance_account_movements m
  where m.financial_account_id = target_financial_account_id;

  select s.available_balance
  into current_available
  from public.neurofinance_overview_snapshots s
  where s.financial_account_id = target_financial_account_id;

  insert into public.neurofinance_overview_snapshots (
    financial_account_id,
    user_id,
    available_balance,
    gross_received,
    pending_receivables,
    total_outflow,
    fees_total,
    calculated_available_balance,
    reconciliation_difference,
    updated_at
  )
  values (
    target_financial_account_id,
    account_user_id,
    coalesce(current_available, 0),
    received_total,
    receivable_total,
    outflow_total,
    fee_total,
    greatest(received_total - outflow_total, 0),
    coalesce(current_available, 0) - greatest(received_total - outflow_total, 0),
    now()
  )
  on conflict (financial_account_id) do update set
    user_id = excluded.user_id,
    gross_received = excluded.gross_received,
    pending_receivables = excluded.pending_receivables,
    total_outflow = excluded.total_outflow,
    fees_total = excluded.fees_total,
    calculated_available_balance = excluded.calculated_available_balance,
    reconciliation_difference =
      public.neurofinance_overview_snapshots.available_balance
      - excluded.calculated_available_balance,
    updated_at = now();
end;
$$;

revoke all on function public.refresh_neurofinance_overview_snapshot(uuid) from public;
revoke all on function public.refresh_neurofinance_overview_snapshot(uuid) from anon;
revoke all on function public.refresh_neurofinance_overview_snapshot(uuid) from authenticated;
grant execute on function public.refresh_neurofinance_overview_snapshot(uuid) to service_role;

-- The legacy view contains provider references and technical metadata. Keep it
-- available to privileged back-office code, but never expose it to clients.
revoke all on public.neurofinance_overview_items_v from public;
revoke all on public.neurofinance_overview_items_v from anon;
revoke all on public.neurofinance_overview_items_v from authenticated;

create or replace function public.get_neurofinance_overview_items(
  p_start_at timestamptz default null,
  p_end_at timestamptz default null,
  p_limit integer default 1000,
  p_offset integer default 0
)
returns table (
  id text,
  overview_group text,
  item_type text,
  description text,
  amount integer,
  currency text,
  status text,
  payment_method text,
  occurred_at timestamptz,
  patient_name text,
  receipt_url text,
  invoice_url text,
  bank_slip_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  with safe_items as (
    select
      md5('payment:income:' || p.id::text) as id,
      'income'::text as overview_group,
      'payment'::text as item_type,
      coalesce(p.description, 'Cobrança recebida') as description,
      p.gross_amount as amount,
      coalesce(p.currency, 'BRL') as currency,
      coalesce(p.normalized_status, 'paid') as status,
      p.payment_method_type as payment_method,
      coalesce(p.available_at, p.paid_at, p.updated_at, p.created_at) as occurred_at,
      patients.name as patient_name,
      coalesce(p.receipt_url, p.metadata ->> 'asaas_transaction_receipt_url') as receipt_url,
      coalesce(p.invoice_url, p.metadata ->> 'asaas_invoice_url', p.checkout_url) as invoice_url,
      coalesce(p.bank_slip_url, p.metadata ->> 'asaas_bank_slip_url') as bank_slip_url
    from public.nb_payments p
    left join public.patients on patients.id = p.patient_id
    where p.user_id = auth.uid()
      and p.funds_status = 'available'
      and p.normalized_status = 'paid'

    union all

    select
      md5('payment:receivable:' || p.id::text),
      'receivable'::text,
      'payment'::text,
      coalesce(p.description, 'Cobrança a receber'),
      p.gross_amount,
      coalesce(p.currency, 'BRL'),
      coalesce(p.normalized_status, 'pending'),
      p.payment_method_type,
      coalesce(p.estimated_credit_at, p.expires_at, p.updated_at, p.created_at),
      patients.name,
      coalesce(p.receipt_url, p.metadata ->> 'asaas_transaction_receipt_url'),
      coalesce(p.invoice_url, p.metadata ->> 'asaas_invoice_url', p.checkout_url),
      coalesce(p.bank_slip_url, p.metadata ->> 'asaas_bank_slip_url')
    from public.nb_payments p
    left join public.patients on patients.id = p.patient_id
    where p.user_id = auth.uid()
      and p.funds_status in ('pending', 'confirmed')
      and p.normalized_status in ('pending', 'processing', 'confirmed')

    union all

    select
      md5('movement:income:' || m.id::text),
      'income'::text,
      coalesce(m.movement_type, 'credit'),
      coalesce(m.description, 'Entrada na conta'),
      m.amount,
      coalesce(m.currency, 'BRL'),
      coalesce(m.status, 'posted'),
      case
        when upper(coalesce(m.metadata ->> 'provider_type', m.movement_type, '')) like '%PIX%'
          then 'pix'::text
        when upper(coalesce(m.metadata ->> 'provider_type', m.movement_type, '')) like '%BOLETO%'
          then 'boleto'::text
        else null::text
      end,
      m.occurred_at,
      null::text,
      coalesce(
        m.metadata ->> 'receipt_url',
        m.metadata ->> 'transaction_receipt_url',
        m.metadata ->> 'asaas_transaction_receipt_url'
      ),
      coalesce(m.metadata ->> 'invoice_url', m.metadata ->> 'asaas_invoice_url'),
      coalesce(m.metadata ->> 'bank_slip_url', m.metadata ->> 'asaas_bank_slip_url')
    from public.neurofinance_account_movements m
    where m.user_id = auth.uid()
      and m.direction = 'credit'
      and m.status = 'posted'
      and not exists (
        select 1
        from public.nb_payments p
        where p.user_id = auth.uid()
          and p.financial_account_id = m.financial_account_id
          and p.funds_status = 'available'
          and p.normalized_status = 'paid'
          and p.provider_payment_id is not null
          and p.provider_payment_id = m.reference_id
      )

    union all

    select
      md5('movement:outflow:' || m.id::text),
      'outflow'::text,
      coalesce(m.movement_type, 'debit'),
      coalesce(m.description, 'Saída da conta'),
      m.amount,
      coalesce(m.currency, 'BRL'),
      coalesce(m.status, 'posted'),
      case
        when upper(coalesce(m.metadata ->> 'provider_type', m.movement_type, '')) like '%PIX%'
          then 'pix'::text
        when upper(coalesce(m.metadata ->> 'provider_type', m.movement_type, '')) like '%BOLETO%'
          then 'boleto'::text
        else null::text
      end,
      m.occurred_at,
      null::text,
      coalesce(
        m.metadata ->> 'receipt_url',
        m.metadata ->> 'transaction_receipt_url',
        m.metadata ->> 'asaas_transaction_receipt_url'
      ),
      coalesce(m.metadata ->> 'invoice_url', m.metadata ->> 'asaas_invoice_url'),
      coalesce(m.metadata ->> 'bank_slip_url', m.metadata ->> 'asaas_bank_slip_url')
    from public.neurofinance_account_movements m
    where m.user_id = auth.uid()
      and m.direction = 'debit'
      and m.status = 'posted'
  )
  select
    safe_items.id,
    safe_items.overview_group,
    safe_items.item_type,
    safe_items.description,
    safe_items.amount,
    safe_items.currency,
    safe_items.status,
    safe_items.payment_method,
    safe_items.occurred_at,
    safe_items.patient_name,
    safe_items.receipt_url,
    safe_items.invoice_url,
    safe_items.bank_slip_url
  from safe_items
  where auth.uid() is not null
    and (p_start_at is null or safe_items.occurred_at >= p_start_at)
    and (p_end_at is null or safe_items.occurred_at <= p_end_at)
  order by safe_items.occurred_at desc, safe_items.id
  limit least(greatest(coalesce(p_limit, 1000), 1), 1000)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.get_neurofinance_overview_items(timestamptz, timestamptz, integer, integer) from public;
revoke all on function public.get_neurofinance_overview_items(timestamptz, timestamptz, integer, integer) from anon;
grant execute on function public.get_neurofinance_overview_items(timestamptz, timestamptz, integer, integer) to authenticated;

comment on function public.get_neurofinance_overview_items(timestamptz, timestamptz, integer, integer) is
  'Owner-scoped NeuroFinance statement DTO. Provider references and raw metadata never leave PostgreSQL.';

-- Recalculate existing snapshots once so the cards and the filtered lists are
-- aligned immediately after the migration.
do $$
declare
  account_record record;
begin
  for account_record in
    select id
    from public.financial_accounts
  loop
    perform public.refresh_neurofinance_overview_snapshot(account_record.id);
  end loop;
end;
$$;
