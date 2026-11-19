-- =============================================================================
-- Lote 1 de la auditoría 2026-11: S5, rama JWT, E1, límite de intentos
-- =============================================================================
-- Correr ANTES supabase/checks/0004_preflight_huerfanas.sql (debe dar 0 filas).
-- Aplicar esta migración ANTES de desplegar el código nuevo de punch/route.ts:
-- sin kiosk_attempts el endpoint responde 500.
-- Todo va en una transacción; los drop constraint NO llevan "if exists" para
-- que un nombre incorrecto aborte y revierta todo.
-- =============================================================================
begin;

-- 0. Guardia: aborta con mensaje claro si hay referencias huérfanas/cruzadas ----
do $$
declare
  n_tpl  bigint; n_evemp bigint; n_evdev bigint; n_coremp bigint; n_corev bigint;
begin
  select count(*) into n_tpl from biometric_templates t
    left join employees e on e.id = t.employee_id
    where e.id is null or e.business_id <> t.business_id;
  select count(*) into n_evemp from attendance_events ev
    left join employees e on e.id = ev.employee_id
    where e.id is null or e.business_id <> ev.business_id;
  select count(*) into n_evdev from attendance_events ev
    left join devices d on d.id = ev.device_id
    where ev.device_id is not null and (d.id is null or d.business_id <> ev.business_id);
  select count(*) into n_coremp from attendance_corrections c
    left join employees e on e.id = c.employee_id
    where e.id is null or e.business_id <> c.business_id;
  select count(*) into n_corev from attendance_corrections c
    left join attendance_events ev on ev.id = c.event_id
    where c.event_id is not null and (ev.id is null or ev.business_id <> c.business_id);

  if n_tpl + n_evemp + n_evdev + n_coremp + n_corev > 0 then
    raise exception
      'Filas huérfanas/cruzadas: templates=%, events.employee=%, events.device=%, corrections.employee=%, corrections.event=%. Corrige antes de migrar.',
      n_tpl, n_evemp, n_evdev, n_coremp, n_corev;
  end if;
end $$;

-- 1. S5: nadie inserta checadas por REST; solo el service role ------------------
drop policy if exists events_insert on attendance_events;

-- 2. app_business_ids() sin la rama del claim business_id del JWT ----------------
-- El kiosco se autentica con token de dispositivo (devices.secret_hash), no JWT.
create or replace function app_business_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select business_id
  from business_members
  where user_id = auth.uid();
$$;

-- 3. E1: llaves únicas y FKs compuestas ------------------------------------------
alter table employees         add constraint employees_business_id_id_key         unique (business_id, id);
alter table devices           add constraint devices_business_id_id_key           unique (business_id, id);
alter table attendance_events add constraint attendance_events_business_id_id_key unique (business_id, id);

alter table biometric_templates
  drop constraint biometric_templates_employee_id_fkey;
alter table biometric_templates
  add constraint biometric_templates_employee_fk
  foreign key (business_id, employee_id) references employees (business_id, id)
  on delete cascade;

alter table attendance_events
  drop constraint attendance_events_employee_id_fkey;
alter table attendance_events
  add constraint attendance_events_employee_fk
  foreign key (business_id, employee_id) references employees (business_id, id)
  on delete restrict;

alter table attendance_events
  drop constraint attendance_events_device_id_fkey;
alter table attendance_events
  add constraint attendance_events_device_fk
  foreign key (business_id, device_id) references devices (business_id, id)
  on delete set null (device_id);   -- PG15+: no tocar business_id

alter table attendance_corrections
  drop constraint attendance_corrections_employee_id_fkey;
alter table attendance_corrections
  add constraint attendance_corrections_employee_fk
  foreign key (business_id, employee_id) references employees (business_id, id)
  on delete restrict;

alter table attendance_corrections
  drop constraint attendance_corrections_event_id_fkey;
alter table attendance_corrections
  add constraint attendance_corrections_event_fk
  foreign key (business_id, event_id) references attendance_events (business_id, id)
  on delete set null (event_id);

-- 4. Límite de intentos fallidos por kiosco ---------------------------------------
-- Solo la toca el service role. RLS activado y SIN policies.
create table kiosk_attempts (
  id         bigint generated always as identity primary key,
  device_id  uuid not null references devices(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index on kiosk_attempts (device_id, created_at desc);
alter table kiosk_attempts enable row level security;
revoke all on kiosk_attempts from anon, authenticated;

commit;
