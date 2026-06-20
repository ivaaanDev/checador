-- =============================================================================
-- Provisioning RPC  (Phase 1)
-- =============================================================================
-- businesses y business_members NO tienen policy de INSERT a propósito: nadie
-- debe poder auto-insertarse en un tenant. La creación del primer negocio + su
-- owner pasa por esta función security definer, que corre como dueño de la
-- función (bypassa RLS) pero solo para el usuario autenticado que la llama.
-- =============================================================================

create or replace function create_business_with_owner(
  p_name     text,
  p_timezone text default 'America/Mexico_City'
)
returns businesses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_business businesses;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'El nombre del negocio es obligatorio';
  end if;

  insert into businesses (name, timezone)
  values (trim(p_name), p_timezone)
  returning * into v_business;

  insert into business_members (business_id, user_id, role)
  values (v_business.id, v_uid, 'owner');

  return v_business;
end;
$$;

-- Solo usuarios autenticados pueden llamarla (no el rol anónimo).
revoke execute on function create_business_with_owner(text, text) from public, anon;
grant  execute on function create_business_with_owner(text, text) to authenticated;