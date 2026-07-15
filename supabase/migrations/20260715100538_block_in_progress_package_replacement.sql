begin;

create or replace function public.validate_package_lifecycle_progress_internal(
  p_actor_id uuid,
  p_source_package_id uuid,
  p_scope text default 'all_future',
  p_anchor_appointment_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anchor public.appointments%rowtype;
  v_in_progress_count integer := 0;
  v_message text := 'Uma sessão do escopo já está em andamento e exige revisão separada.';
begin
  if p_scope not in ('only_this', 'this_and_next', 'all_future') then
    raise exception 'Escopo de substituição inválido';
  end if;

  if p_scope in ('only_this', 'this_and_next') then
    if p_anchor_appointment_id is null then
      raise exception 'Selecione a ocorrência inicial';
    end if;

    select appointment.*
    into v_anchor
    from public.appointments appointment
    where appointment.id = p_anchor_appointment_id
      and appointment.user_id = p_actor_id;

    if not found then
      raise exception 'Ocorrência inicial não encontrada';
    end if;
  end if;

  select count(*)::integer
  into v_in_progress_count
  from public.appointment_package_bindings binding
  join public.appointments appointment on appointment.id = binding.appointment_id
  where binding.package_id = p_source_package_id
    and binding.professional_id = p_actor_id
    and binding.status = 'reserved'
    and (
      lower(coalesce(appointment.status, '')) in ('in_progress', 'started')
      or lower(coalesce(appointment.lifecycle_status, '')) in (
        'in_progress',
        'consultation_started'
      )
    )
    and (
      p_scope = 'all_future'
      or (p_scope = 'only_this' and appointment.id = p_anchor_appointment_id)
      or (
        p_scope = 'this_and_next'
        and (
          (
            v_anchor.series_id is not null
            and appointment.series_id = v_anchor.series_id
            and appointment.occurrence_number >= v_anchor.occurrence_number
          )
          or (v_anchor.series_id is null and appointment.id = v_anchor.id)
        )
      )
    );

  return jsonb_build_object(
    'hasInProgress', v_in_progress_count > 0,
    'count', v_in_progress_count,
    'hardBlocks', case
      when v_in_progress_count > 0 then jsonb_build_array(v_message)
      else '[]'::jsonb
    end
  );
end;
$$;

revoke all on function public.validate_package_lifecycle_progress_internal(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.validate_package_lifecycle_progress_internal(uuid, uuid, text, uuid)
  to service_role;

create or replace function private.prevent_in_progress_package_binding_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_in_progress boolean;
begin
  if old.status = 'reserved'
    and new.status in ('released', 'replaced', 'reversed', 'cancelled')
  then
    select
      lower(coalesce(appointment.status, '')) in ('in_progress', 'started')
      or lower(coalesce(appointment.lifecycle_status, '')) in (
        'in_progress',
        'consultation_started'
      )
    into v_in_progress
    from public.appointments appointment
    where appointment.id = old.appointment_id;

    if coalesce(v_in_progress, false) then
      raise exception using
        errcode = '55000',
        message = 'A sessão já está em andamento e não pode trocar de pacote automaticamente.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists appointment_package_bindings_block_in_progress
  on public.appointment_package_bindings;
create trigger appointment_package_bindings_block_in_progress
before update of status on public.appointment_package_bindings
for each row execute function private.prevent_in_progress_package_binding_change();

revoke all on function private.prevent_in_progress_package_binding_change()
  from public, anon, authenticated;

comment on function public.validate_package_lifecycle_progress_internal(uuid, uuid, text, uuid) is
  'Service-role-only safe validation used by the package lifecycle Edge Function.';

commit;
