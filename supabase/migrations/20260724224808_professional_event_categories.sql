create table public.professional_event_categories (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  name text not null,
  is_default boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_event_categories_slug_format
    check (slug ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  constraint professional_event_categories_name_format
    check (name = btrim(name) and char_length(name) between 1 and 60),
  constraint professional_event_categories_professional_slug_key
    unique (professional_id, slug)
);

create unique index professional_event_categories_professional_name_key
  on public.professional_event_categories (professional_id, lower(btrim(name)));

create index professional_event_categories_active_name_idx
  on public.professional_event_categories (
    professional_id,
    is_archived,
    is_default desc,
    name
  );

alter table public.professional_event_categories enable row level security;

create policy "Professional event categories read own"
  on public.professional_event_categories
  for select
  to authenticated
  using ((select auth.uid()) = professional_id);

create policy "Professional event categories insert own"
  on public.professional_event_categories
  for insert
  to authenticated
  with check ((select auth.uid()) = professional_id);

create policy "Professional event categories update own"
  on public.professional_event_categories
  for update
  to authenticated
  using ((select auth.uid()) = professional_id)
  with check ((select auth.uid()) = professional_id);

revoke all on table public.professional_event_categories from public, anon, authenticated;
grant select, insert, update (name, is_archived) on table public.professional_event_categories to authenticated;

create trigger set_updated_at
before update on public.professional_event_categories
for each row execute function public.update_updated_at_column();

comment on table public.professional_event_categories is
  'Categorias próprias de compromissos da agenda profissional. A remoção no produto arquiva a categoria para preservar a leitura de eventos históricos.';
comment on column public.professional_event_categories.slug is
  'Identificador estável salvo nos metadados do compromisso; não muda quando o nome visível é editado.';
