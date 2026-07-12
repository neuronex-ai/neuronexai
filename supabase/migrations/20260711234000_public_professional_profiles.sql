-- Public, read-only NEUROID contract.
-- The function returns a deliberately small professional projection and never
-- exposes phone, street address, account settings, billing data or AI metadata.

begin;

drop view if exists public.public_professional_profiles;

alter table public.profiles
  add column if not exists public_slug text;

update public.profiles p
set public_slug = concat(
  trim(both '-' from regexp_replace(
    translate(
      lower(coalesce(nullif(p.full_name, ''), concat_ws(' ', p.first_name, p.last_name), p.name, 'profissional')),
      'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
      'aaaaaaeeeeiiiiooooouuuucnyy'
    ),
    '[^a-z0-9]+',
    '-',
    'g'
  )),
  '-',
  left(replace(p.id::text, '-', ''), 8)
)
where p.public_slug is null or btrim(p.public_slug) = '';

create unique index if not exists profiles_public_slug_unique
  on public.profiles (lower(public_slug))
  where public_slug is not null;

create or replace function public.assign_profile_public_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  slug_base text;
begin
  if new.public_slug is not null and btrim(new.public_slug) <> '' then
    new.public_slug := lower(btrim(new.public_slug));
    return new;
  end if;

  slug_base := trim(both '-' from regexp_replace(
    translate(
      lower(coalesce(nullif(new.full_name, ''), concat_ws(' ', new.first_name, new.last_name), new.name, 'profissional')),
      'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
      'aaaaaaeeeeiiiiooooouuuucnyy'
    ),
    '[^a-z0-9]+',
    '-',
    'g'
  ));

  new.public_slug := concat(coalesce(nullif(slug_base, ''), 'profissional'), '-', left(replace(new.id::text, '-', ''), 8));
  return new;
end;
$$;

drop trigger if exists assign_profile_public_slug_trigger on public.profiles;
create trigger assign_profile_public_slug_trigger
before insert or update of public_slug on public.profiles
for each row execute function public.assign_profile_public_slug();

revoke all on function public.assign_profile_public_slug() from public, anon, authenticated;

drop function if exists public.get_public_professional_profile(uuid);

create or replace function public.get_public_professional_profile(profile_key text)
returns table (
  id uuid,
  display_name text,
  first_name text,
  last_name text,
  avatar_url text,
  clinic_name text,
  crp text,
  specialty text,
  bio text,
  address_city text,
  address_state text,
  founder boolean,
  verified boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    coalesce(
      nullif(btrim(p.full_name), ''),
      nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
      nullif(btrim(p.name), ''),
      'Profissional NeuroNex'
    ) as display_name,
    p.first_name,
    p.last_name,
    p.avatar_url,
    p.clinic_name,
    p.crp,
    p.specialty,
    p.bio,
    p.address_city,
    p.address_state,
    true as founder,
    (nullif(btrim(p.crp), '') is not null) as verified
  from public.profiles p
  where p.id::text = profile_key or lower(p.public_slug) = lower(profile_key)
  limit 1;
$$;

revoke all on function public.get_public_professional_profile(text) from public;
grant execute on function public.get_public_professional_profile(text) to anon, authenticated;

comment on function public.get_public_professional_profile(text) is
  'Safe public NEUROID projection. Never add phone, street address, recovery data, AI preferences or billing fields.';

commit;
