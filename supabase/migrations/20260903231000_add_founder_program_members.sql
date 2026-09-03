create table if not exists public.founder_program_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cohort_key text not null default 'founding_clinicians_2026',
  badge_key text not null default 'founder',
  badge_label text not null default 'Founder',
  program_role text not null default 'founder_member'
    check (program_role in ('founder_member', 'development_collaborator')),
  lifetime_plan_code text null references public.subscription_plan_catalog(plan_code),
  modal_eyebrow text not null,
  modal_title text not null,
  modal_body text not null,
  modal_cta_label text not null default 'Continuar',
  announcement_version integer not null default 1 check (announcement_version > 0),
  acknowledged_version integer not null default 0 check (acknowledged_version >= 0),
  active boolean not null default true,
  granted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  check (acknowledged_version <= announcement_version)
);

comment on table public.founder_program_members is
  'Server-managed Founder cohort membership, personalized announcement copy and optional lifetime plan entitlement metadata.';
comment on column public.founder_program_members.program_role is
  'founder_member identifies an early product member; development_collaborator identifies a Founder invited into the collaborative product-development group. Neither value represents equity or employment.';
comment on column public.founder_program_members.lifetime_plan_code is
  'Optional plan granted without expiration by NeuroNex. Billing enforcement remains in user_subscriptions via admin_override.';

alter table public.founder_program_members enable row level security;

drop policy if exists "Founder members can read own membership" on public.founder_program_members;
create policy "Founder members can read own membership"
  on public.founder_program_members
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on public.founder_program_members from authenticated, anon;
grant select on public.founder_program_members to authenticated;

create or replace function public.acknowledge_founder_program_announcement()
returns public.founder_program_members
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  membership public.founder_program_members;
begin
  update public.founder_program_members
  set acknowledged_version = announcement_version,
      updated_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'last_acknowledged_at', now()
      )
  where user_id = auth.uid()
    and active = true
  returning * into membership;

  if membership.user_id is null then
    raise exception 'Founder membership not found for authenticated user';
  end if;

  return membership;
end;
$$;

revoke all on function public.acknowledge_founder_program_announcement() from public;
grant execute on function public.acknowledge_founder_program_announcement() to authenticated;

with founder_seed(display_name, program_role, lifetime_plan_code, modal_eyebrow, modal_title, modal_body, modal_cta_label, metadata) as (
  values
    (
      'Luisa Riccio',
      'founder_member',
      null::text,
      'Founder',
      'Luisa, você chegou enquanto a NeuroNex ainda está sendo construída.',
      'Isso tem um valor especial para nós. Você passa a fazer parte do grupo Founder da NeuroNex — um grupo pequeno de profissionais que estão usando a plataforma no começo e cujo retorno ajuda a definir o que ela se torna. O selo Founder no seu perfil reconhece essa participação e mantém um canal mais próximo com você para novidades, testes e feedback.',
      'Ver meu selo',
      jsonb_build_object('founder_program', true, 'development_team', false)
    ),
    (
      'Diego Santos',
      'founder_member',
      null::text,
      'Founder',
      'Diego, obrigado por colocar a NeuroNex para trabalhar de verdade.',
      'Você faz parte dos primeiros profissionais que confiaram parte da rotina à NeuroNex. Por isso, sua conta passa a integrar o grupo Founder. O selo no seu perfil é nosso reconhecimento por estar aqui no começo — e um convite para continuar nos dizendo o que funciona, o que atrapalha e o que ainda precisa existir.',
      'Continuar com a NeuroNex',
      jsonb_build_object('founder_program', true, 'development_team', false)
    ),
    (
      'Elisa Almeida',
      'development_collaborator',
      'professional',
      'Founder • Desenvolvimento',
      'Elisa, queremos construir a NeuroNex com você.',
      'Obrigado por usar a NeuroNex enquanto ainda estamos construindo o produto. Queremos transformar essa participação em algo permanente: você passa a fazer parte do grupo Founder, recebe o Plano Professional vitalício, sem custo de assinatura, e integra nosso time de desenvolvimento colaborativo. Sua visão como psicóloga poderá orientar diretamente o que melhoramos, testamos e priorizamos daqui para frente.',
      'Conhecer meu acesso Founder',
      jsonb_build_object('founder_program', true, 'development_team', true, 'lifetime_professional', true)
    ),
    (
      'Bruno Meneguzzi',
      'founder_member',
      null::text,
      'Founder',
      'Bruno, você faz parte das primeiras pessoas que apostaram na NeuroNex.',
      'Estar presente enquanto um produto ainda está encontrando sua melhor forma tem um peso diferente. Queremos reconhecer isso: sua conta passa a fazer parte do grupo Founder da NeuroNex. Seu selo Founder marca essa participação desde o início e mantém você entre os profissionais que queremos ouvir de perto à medida que a plataforma evolui.',
      'Ver meu selo',
      jsonb_build_object('founder_program', true, 'development_team', false)
    ),
    (
      'SIDINEI JAIR MANTHEY',
      'development_collaborator',
      'professional',
      'Founder • Desenvolvimento',
      'Sidinei, queremos construir a NeuroNex com você.',
      'Você esteve entre os profissionais que usaram a NeuroNex quando ela ainda estava tomando forma. Queremos reconhecer isso de um jeito permanente: sua conta passa a fazer parte do grupo Founder, com Plano Professional vitalício, sem custo de assinatura. E queremos ir além: você também passa a integrar nosso time de desenvolvimento colaborativo, trazendo sua experiência prática para ajudar a decidir o que testar, corrigir e construir a seguir.',
      'Conhecer meu acesso Founder',
      jsonb_build_object('founder_program', true, 'development_team', true, 'lifetime_professional', true)
    )
)
insert into public.founder_program_members (
  user_id,
  cohort_key,
  badge_key,
  badge_label,
  program_role,
  lifetime_plan_code,
  modal_eyebrow,
  modal_title,
  modal_body,
  modal_cta_label,
  announcement_version,
  acknowledged_version,
  active,
  metadata
)
select
  p.id,
  'founding_clinicians_2026',
  'founder',
  'Founder',
  s.program_role,
  s.lifetime_plan_code,
  s.modal_eyebrow,
  s.modal_title,
  s.modal_body,
  s.modal_cta_label,
  1,
  0,
  true,
  s.metadata
from founder_seed s
join public.profiles p
  on coalesce(nullif(p.full_name, ''), nullif(p.name, ''), trim(concat_ws(' ', p.first_name, p.last_name))) = s.display_name
on conflict (user_id) do update set
  cohort_key = excluded.cohort_key,
  badge_key = excluded.badge_key,
  badge_label = excluded.badge_label,
  program_role = excluded.program_role,
  lifetime_plan_code = excluded.lifetime_plan_code,
  modal_eyebrow = excluded.modal_eyebrow,
  modal_title = excluded.modal_title,
  modal_body = excluded.modal_body,
  modal_cta_label = excluded.modal_cta_label,
  announcement_version = excluded.announcement_version,
  active = true,
  updated_at = now(),
  metadata = excluded.metadata;

update public.user_subscriptions us
set plan = 'Professional',
    plan_code = 'professional',
    status = 'admin_override',
    access_state = 'admin_override',
    trial_ends_at = null,
    current_period_end = null,
    cancel_at_period_end = false,
    canceled_at = null,
    metadata = coalesce(us.metadata, '{}'::jsonb) || jsonb_build_object(
      'source', 'founder_lifetime',
      'founder_program', true,
      'lifetime_plan', 'professional',
      'lifetime_granted_at', now(),
      'override_reason', 'founder_development_collaborator'
    )
from public.founder_program_members f
where f.user_id = us.user_id
  and f.active = true
  and f.lifetime_plan_code = 'professional'
  and us.asaas_subscription_id is null;

update public.profiles p
set subscription_plan = 'Professional',
    updated_at = now()
from public.founder_program_members f
where f.user_id = p.id
  and f.active = true
  and f.lifetime_plan_code = 'professional';

insert into public.subscription_audit_logs (
  user_id,
  subscription_record_id,
  actor_type,
  action,
  to_status,
  to_access_state,
  reason,
  metadata
)
select
  us.user_id,
  us.id,
  'system',
  'founder_lifetime_granted',
  us.status,
  us.access_state,
  'founder_development_collaborator',
  jsonb_build_object(
    'cohort_key', f.cohort_key,
    'plan_code', f.lifetime_plan_code,
    'program_role', f.program_role
  )
from public.user_subscriptions us
join public.founder_program_members f on f.user_id = us.user_id
where f.active = true
  and f.lifetime_plan_code = 'professional'
  and not exists (
    select 1
    from public.subscription_audit_logs l
    where l.user_id = us.user_id
      and l.action = 'founder_lifetime_granted'
  );
