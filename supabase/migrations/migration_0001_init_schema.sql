-- =============================================================================
-- Attendance SaaS — Initial multi-tenant schema  (Phase 0)
-- Postgres / Supabase
-- =============================================================================
-- Principios codificados aquí (no romper sin revisar el diseño):
--   1. Multi-tenant: cada fila lleva business_id; RLS aísla a los tenants.
--      Koko's es UNA fila en `businesses`. Nada aquí sabe de pizza.
--   2. Dos clases de identidad:
--        - Usuarios del dashboard (owner/manager) -> auth.users + business_members
--        - Empleados (los que se monitorean)      -> SIN login, identidad = cuerpo
--   3. El tiempo es UTC en todos lados. La visualización y los turnos convierten
--      a businesses.timezone. El almacenamiento siempre queda en UTC.
--   4. attendance_events es un LEDGER APPEND-ONLY (inmutable). Las correcciones
--      son filas separadas en attendance_corrections, nunca ediciones al ledger.
--   5. Biometría: se guardan EMBEDDINGS (vectores), NUNCA imágenes de rostro.
--      La columna del embedding debe cifrarse en la capa de aplicación ANTES
--      de insertarse (p. ej. AES-GCM). RLS + cifrado son ambos obligatorios.
-- =============================================================================

-- Extensiones -----------------------------------------------------------------
create extension if not exists "pgcrypto";        -- gen_random_uuid()
-- create extension if not exists "vector";        -- opcional (pgvector): solo si
                                                    -- luego quieres dedup del lado
                                                    -- del servidor al enrolar. El
                                                    -- match diario es on-device, no
                                                    -- lo necesita.

-- Enums -----------------------------------------------------------------------
create type member_role           as enum ('owner', 'manager');
create type biometric_modality    as enum ('face', 'fingerprint');
create type attendance_event_type as enum ('clock_in', 'clock_out', 'break_start', 'break_end');
create type attendance_source     as enum ('kiosk_online', 'kiosk_offline', 'manual');
create type correction_status     as enum ('pending', 'approved', 'rejected');

-- =============================================================================
-- TENANTS
-- =============================================================================
create table businesses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  -- Timezone IANA, p. ej. 'America/Mexico_City'. Para renderizar timestamps UTC
  -- y computar turnos. El almacenamiento sigue en UTC; esto es solo display/lógica.
  timezone    text not null default 'America/Mexico_City',
  -- Config por tenant: modalidades habilitadas, estrictez de liveness, minutos
  -- de tolerancia, etc.
  settings    jsonb not null default '{}'::jsonb,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Vincula usuarios de Supabase Auth (los que entran al dashboard) con un tenant.
-- Un usuario puede pertenecer a varios negocios (franquicia, o una agencia como A&I).
create table business_members (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        member_role not null default 'manager',
  created_at  timestamptz not null default now(),
  unique (business_id, user_id)
);

-- =============================================================================
-- EMPLEADOS  (trabajadores monitoreados — NO inician sesión)
-- Se borran en suave (is_active=false) para preservar la historia del ledger.
-- =============================================================================
create table employees (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,
  full_name     text not null,
  -- Código definido por el tenant (gafete, etc.). Opcional pero útil en reportes.
  employee_code text,
  -- Etiqueta libre (p. ej. 'repartidor', 'cajero'). NO es un rol de seguridad.
  position      text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (business_id, employee_code)
);

-- =============================================================================
-- DISPOSITIVOS  (kioscos — se autentican como dispositivo, no como persona)
-- =============================================================================
create table devices (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references businesses(id) on delete cascade,
  label               text not null,                  -- 'Entrada motos', etc.
  -- Hash del secreto de enrolamiento del dispositivo. Nunca el secreto en claro.
  secret_hash         text,
  allowed_modalities  biometric_modality[] not null default '{face}',
  -- Cuándo este kiosco bajó por última vez las plantillas del tenant para
  -- el match offline.
  templates_synced_at timestamptz,
  last_seen_at        timestamptz,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now()
);

-- =============================================================================
-- PLANTILLAS BIOMÉTRICAS  (solo embeddings — nunca imágenes)
-- =============================================================================
create table biometric_templates (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references businesses(id) on delete cascade,
  employee_id        uuid not null references employees(id) on delete cascade,
  modality           biometric_modality not null,
  -- Embedding cifrado (vector de floats serializado + cifrado en la app, p. ej.
  -- AES-GCM, ANTES de llegar a la BD). Esta columna nunca debe contener una
  -- imagen ni un embedding en claro. RLS + cifrado son ambos obligatorios.
  embedding          bytea not null,
  -- Tag de modelo/versión para re-enrolar cuando cambies de modelo.
  model_version      text,
  quality_score      real,
  enrolled_by        uuid references auth.users(id),  -- el manager que enroló
  enrolled_on_device uuid references devices(id),
  is_active          boolean not null default true,
  created_at         timestamptz not null default now()
);

-- =============================================================================
-- EVENTOS DE ASISTENCIA  (ledger append-only, inmutable)
-- =============================================================================
create table attendance_events (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references businesses(id) on delete cascade,
  employee_id        uuid not null references employees(id) on delete restrict,
  device_id          uuid references devices(id) on delete set null,
  event_type         attendance_event_type not null,
  -- HORA OFICIAL del fichaje. La sella el kiosco al capturar, en UTC. Para
  -- fichajes offline es la única fuente honesta de verdad — y es confiable
  -- porque el kiosco es un dispositivo controlado, bloqueado y con NTP (a
  -- diferencia del teléfono del trabajador). El servidor NUNCA la sobrescribe.
  captured_at        timestamptz not null,
  -- Cuándo el servidor realmente recibió/guardó la fila. En fichajes online
  -- ~= captured_at; en offline es posterior. Sirve para auditoría + detección
  -- de anomalías (brecha grande captured_at vs server_recorded_at, o un
  -- captured_at futuro -> se marca para revisión, cubre reloj de kiosco alterado).
  server_recorded_at timestamptz not null default now(),
  source             attendance_source not null default 'kiosk_online',
  -- Confianza del match del reconocedor on-device (0..1). Se guarda para la
  -- auditoría: "yo sí marqué" / "ese no fui yo" lo responde el log, no la palabra.
  match_score        real,
  -- Resultado de liveness + metadata de captura (ip, versión de app, geo...).
  metadata           jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- =============================================================================
-- CORRECCIONES  ("sin excusas" != "sin correcciones")
-- Una corrección NUNCA edita el ledger. Es un registro separado y supervisado.
-- El timesheet efectivo = eventos ajustados por correcciones APROBADAS.
-- =============================================================================
create table attendance_corrections (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references businesses(id) on delete cascade,
  employee_id    uuid not null references employees(id) on delete restrict,
  -- El evento que se corrige, si aplica. Null = un fichaje faltante que se agrega.
  event_id       uuid references attendance_events(id) on delete set null,
  event_type     attendance_event_type not null,
  -- La hora corregida que el manager está afirmando (UTC).
  corrected_time timestamptz not null,
  reason         text not null,
  status         correction_status not null default 'pending',
  requested_by   uuid references auth.users(id),
  reviewed_by    uuid references auth.users(id),
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now()
);

-- =============================================================================
-- ÍNDICES
-- =============================================================================
create index on business_members (user_id);
create index on employees (business_id) where is_active;
create index on devices (business_id) where is_active;
create index on biometric_templates (employee_id) where is_active;
create index on biometric_templates (business_id, modality) where is_active;
create index on attendance_events (business_id, employee_id, captured_at desc);
create index on attendance_events (business_id, captured_at desc);
create index on attendance_corrections (business_id, status);

-- =============================================================================
-- APPEND-ONLY (defensa en profundidad: ni una conexión privilegiada muta el ledger)
-- =============================================================================
create or replace function prevent_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'attendance_events es append-only: % no está permitido', tg_op;
end;
$$;

create trigger attendance_events_no_update
  before update or delete on attendance_events
  for each row execute function prevent_mutation();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
-- Helper: el conjunto de business_ids que el llamante puede tocar.
--   * Usuarios del dashboard -> sus filas en business_members.
--   * Kioscos                -> un claim 'business_id' en su JWT (se setea al
--     login del dispositivo vía un custom access-token hook — DEBES cablear ese
--     hook; el SQL por sí solo no lo emite).
-- security definer evita recursión de RLS al leer business_members desde la policy.
create or replace function app_business_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select business_id
  from business_members
  where user_id = auth.uid()
  union
  select (auth.jwt() ->> 'business_id')::uuid
  where (auth.jwt() ->> 'business_id') is not null;
$$;

create or replace function app_is_owner(biz uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from business_members
    where user_id = auth.uid() and business_id = biz and role = 'owner'
  );
$$;

alter table businesses             enable row level security;
alter table business_members       enable row level security;
alter table employees              enable row level security;
alter table devices                enable row level security;
alter table biometric_templates    enable row level security;
alter table attendance_events      enable row level security;
alter table attendance_corrections enable row level security;

-- businesses: un miembro ve los negocios a los que pertenece; solo el owner edita.
create policy businesses_select on businesses
  for select using (id in (select app_business_ids()));
create policy businesses_update on businesses
  for update using (app_is_owner(id));

-- business_members: ves las membresías de tus propios negocios.
-- (La gestión de miembros conviene hacerla por un RPC security definer; deja
--  las policies de escritura apretadas hasta construir esa feature.)
create policy members_select on business_members
  for select using (user_id = auth.uid() or business_id in (select app_business_ids()));

-- employees
create policy employees_rw on employees
  for all using (business_id in (select app_business_ids()))
  with check (business_id in (select app_business_ids()));

-- devices
create policy devices_rw on devices
  for all using (business_id in (select app_business_ids()))
  with check (business_id in (select app_business_ids()));

-- biometric_templates (lectura/inserción dentro del tenant).
-- HARDENING futuro: restringir la lectura de embeddings a la ruta de sync del
-- dispositivo + enrolamiento, no a cualquier manager.
create policy templates_rw on biometric_templates
  for all using (business_id in (select app_business_ids()))
  with check (business_id in (select app_business_ids()));

-- attendance_events: lectura + inserción dentro del tenant; SIN policy de
-- update/delete (las mutaciones además están bloqueadas por el trigger).
create policy events_select on attendance_events
  for select using (business_id in (select app_business_ids()));
create policy events_insert on attendance_events
  for insert with check (business_id in (select app_business_ids()));

-- attendance_corrections: gestión completa dentro del tenant.
-- HARDENING futuro: separar por rol (solo manager/owner aprueba).
create policy corrections_rw on attendance_corrections
  for all using (business_id in (select app_business_ids()))
  with check (business_id in (select app_business_ids()));