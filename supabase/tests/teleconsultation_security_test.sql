begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

select ok(to_regclass('public.teleconsultation_invites') is not null, 'convites seguros existem');
select ok(to_regclass('public.teleconsultation_participants') is not null, 'participantes temporários existem');
select ok(
  to_regclass('public.teleconsultation_participants_one_active_room_per_user_idx') is not null,
  'cada sessão anônima mantém somente uma sala ativa'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.appointments'::regclass),
  'appointments mantém RLS habilitado'
);

select ok(
  not has_table_privilege('anon', 'public.appointments', 'select'),
  'anon não possui SELECT direto em appointments'
);

select ok(
  has_table_privilege('authenticated', 'public.appointments', 'select'),
  'authenticated possui grant, ainda filtrado por RLS'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename = 'appointments'
      and (
        coalesce(qual, '') ilike '%token%'
        or coalesce(with_check, '') ilike '%token%'
      )
  ),
  0,
  'nenhuma policy de appointments autoriza por token público'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'teleconsultation_invites'
      and indexdef ilike '%unique%token_hash%'
  ),
  'hash do convite é único'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'teleconsultation_invites'
      and column_name in ('token', 'raw_token', 'invite_token')
  ),
  'tabela de convites não persiste token bruto'
);

select ok(
  to_regprocedure('public.send_session_chat_message(uuid,text)') is not null,
  'RPC segura do chat existe'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.send_session_chat_message(uuid,text)',
    'execute'
  ),
  'authenticated pode executar a RPC do chat'
);

select ok(
  not has_table_privilege('authenticated', 'public.session_chat_messages', 'insert'),
  'cliente não possui INSERT direto no chat'
);

select ok(
  exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'session_chat_messages'
  ),
  'somente a tabela de chat necessária está publicada para este fluxo'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.appointments'::regclass
      and tgname = 'revoke_teleconsultation_access_after_appointment_change'
      and not tgisinternal
  ),
  'cancelamento revoga acesso da teleconsulta'
);

select ok(
  exists (
    select 1
    from pg_proc
    where oid = 'public.send_session_chat_message(uuid,text)'::regprocedure
      and prosecdef
      and coalesce(proconfig::text, '') ilike '%search_path%'
  ),
  'RPC security definer fixa search_path vazio'
);

select * from finish();

rollback;
