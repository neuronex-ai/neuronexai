begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

select ok(to_regclass('public.neuroview_evidence_index') is not null, 'índice clínico do NeuroView existe');
select ok(to_regclass('public.neuroview_evidence_overrides') is not null, 'preferências de evidência existem');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.neuroview_evidence_index'::regclass),
  'índice clínico mantém RLS habilitado'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.neuroview_evidence_overrides'::regclass),
  'preferências mantêm RLS habilitado'
);
select ok(
  not has_table_privilege('anon', 'public.neuroview_evidence_index', 'select'),
  'anon não lê metadados clínicos'
);
select ok(
  has_table_privilege('authenticated', 'public.neuroview_evidence_index', 'select')
    and not has_table_privilege('authenticated', 'public.neuroview_evidence_index', 'insert')
    and not has_table_privilege('authenticated', 'public.neuroview_evidence_index', 'update')
    and not has_table_privilege('authenticated', 'public.neuroview_evidence_index', 'delete'),
  'frontend autenticado lê o índice, mas não o altera diretamente'
);
select ok(
  has_table_privilege('authenticated', 'public.neuroview_evidence_overrides', 'select')
    and has_table_privilege('authenticated', 'public.neuroview_evidence_overrides', 'insert')
    and has_table_privilege('authenticated', 'public.neuroview_evidence_overrides', 'update')
    and has_table_privilege('authenticated', 'public.neuroview_evidence_overrides', 'delete'),
  'psicólogo pode administrar suas preferências sob RLS'
);
select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename in ('neuroview_evidence_index', 'neuroview_evidence_overrides')
      and (coalesce(qual, '') ilike '%auth.uid%' or coalesce(with_check, '') ilike '%auth.uid%')
  ),
  5,
  'todas as operações expostas são isoladas por profissional'
);
select ok(
  to_regprocedure('private.upsert_neuroview_evidence(text,jsonb)') is not null,
  'projeção clínica usa auxiliar privado'
);
select ok(
  to_regprocedure('private.sync_neuroview_evidence_index()') is not null,
  'sincronização por gatilho existe'
);
select ok(
  (
    select prosecdef and coalesce(proconfig::text, '') ilike '%search_path%'
    from pg_proc
    where oid = 'private.upsert_neuroview_evidence(text,jsonb)'::regprocedure
  ),
  'auxiliar privilegiado fixa search_path'
);
select ok(
  not has_function_privilege('authenticated', 'private.upsert_neuroview_evidence(text,jsonb)', 'execute'),
  'frontend não executa o auxiliar privado'
);
select is(
  (
    select count(*)::integer
    from pg_trigger
    where tgname in (
      'sync_neuroview_personal_notes', 'sync_neuroview_flows', 'sync_neuroview_session_notes',
      'sync_neuroview_mood_logs', 'sync_neuroview_goals', 'sync_neuroview_anamneses',
      'sync_neuroview_appointments', 'sync_neuroview_reminders'
    )
      and not tgisinternal
  ),
  8,
  'oito fontes clínicas alimentam uma única projeção'
);
select ok(
  exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'neuroview_evidence_index'
  ),
  'somente a projeção consolidada é assinada pelo NeuroView'
);
select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'neuroview_evidence_index'
      and column_name in ('content', 'notes', 'transcription', 'original_transcription')
  ),
  'índice não duplica conteúdo clínico bruto ou transcrições'
);

select * from finish();

rollback;

