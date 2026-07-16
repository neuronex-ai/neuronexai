begin;

create table if not exists public.neurofinance_saved_pix_recipients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  financial_account_id uuid not null references public.financial_accounts(id) on delete cascade,
  label text not null,
  pix_key text not null,
  pix_key_type text not null check (pix_key_type in ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP')),
  key_fingerprint text not null,
  destination_summary text not null,
  holder_name text,
  holder_document_masked text,
  bank_name text,
  bank_code text,
  active boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key_fingerprint)
);

create index if not exists idx_neurofinance_saved_pix_recipients_user_active
  on public.neurofinance_saved_pix_recipients(user_id, updated_at desc)
  where active;

alter table public.neurofinance_saved_pix_recipients enable row level security;

revoke all on public.neurofinance_saved_pix_recipients from anon, authenticated;

comment on table public.neurofinance_saved_pix_recipients is
  'Destinatários Pix validados e favoritados. A leitura e a escrita ocorrem somente por Edge Functions autenticadas.';

commit;
