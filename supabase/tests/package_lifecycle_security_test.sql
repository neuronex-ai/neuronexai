begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

select ok(to_regclass('public.appointment_package_bindings') is not null, 'vínculos por ocorrência existem');
select ok(to_regclass('public.package_replacement_operations') is not null, 'operações idempotentes existem');
select ok(to_regclass('public.appointment_financial_coverages') is not null, 'cobertura financeira versionada existe');
select ok(to_regclass('public.package_financial_adjustment_outbox') is not null, 'outbox financeira existe');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.appointment_package_bindings'::regclass),
  'vínculos possuem RLS'
);
select ok(
  has_table_privilege('authenticated', 'public.appointment_package_bindings', 'select')
    and not has_table_privilege('authenticated', 'public.appointment_package_bindings', 'insert'),
  'frontend pode ler, mas não escrever vínculos'
);
select ok(
  not has_table_privilege('authenticated', 'public.package_financial_adjustment_outbox', 'insert'),
  'frontend não escreve na outbox'
);
select ok(
  not has_table_privilege('authenticated', 'public.patient_packages', 'delete'),
  'frontend não exclui pacotes fisicamente'
);
select ok(
  not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.appointments'::regclass
      and tgname = 'tr_sync_package_sessions'
      and not tgisinternal
  ),
  'trigger legada foi removida'
);
select ok(
  to_regprocedure('public.sync_package_sessions()') is null,
  'função legada foi removida'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.appointments'::regclass
      and tgname = 'tr_consume_bound_package_session'
      and not tgisinternal
  ),
  'conclusão consome somente vínculo explícito'
);
select ok(
  to_regprocedure('public.preview_package_lifecycle_change_internal(uuid,uuid,uuid,text,text,uuid,text)') is not null,
  'preview interno existe'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.preview_package_lifecycle_change_internal(uuid,uuid,uuid,text,text,uuid,text)',
    'execute'
  ),
  'preview interno não está exposto ao frontend'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.execute_package_lifecycle_change_internal(uuid,uuid,uuid,text,text,uuid,text,text,text,uuid[],text)',
    'execute'
  ),
  'execução transacional é exclusiva do serviço autenticado'
);
select ok(
  to_regprocedure('public.validate_package_lifecycle_progress_internal(uuid,uuid,text,uuid)') is not null,
  'validação de sessão em andamento existe'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.validate_package_lifecycle_progress_internal(uuid,uuid,text,uuid)',
    'execute'
  ),
  'validação interna de andamento não está exposta ao frontend'
);

select * from finish();

rollback;
