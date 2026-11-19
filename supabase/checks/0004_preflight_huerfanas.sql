-- Preflight de la migración 0004. SOLO LECTURA. Córrelo ANTES de aplicarla.
-- Debe devolver 0 filas. Cada fila es una referencia que cruza de negocio
-- o apunta a algo inexistente (la 0004 abortaría).
-- Nota: attendance_events es append-only; si salen filas de ahí no se pueden
-- corregir con UPDATE y hay que decidirlo aparte.

select 'biometric_templates.employee_id' as chequeo, t.id as fila_id,
       t.business_id, e.business_id as business_id_referenciado
from biometric_templates t
left join employees e on e.id = t.employee_id
where e.id is null or e.business_id <> t.business_id

union all
select 'attendance_events.employee_id', ev.id, ev.business_id, e.business_id
from attendance_events ev
left join employees e on e.id = ev.employee_id
where e.id is null or e.business_id <> ev.business_id

union all
select 'attendance_events.device_id', ev.id, ev.business_id, d.business_id
from attendance_events ev
left join devices d on d.id = ev.device_id
where ev.device_id is not null and (d.id is null or d.business_id <> ev.business_id)

union all
select 'attendance_corrections.employee_id', c.id, c.business_id, e.business_id
from attendance_corrections c
left join employees e on e.id = c.employee_id
where e.id is null or e.business_id <> c.business_id

union all
select 'attendance_corrections.event_id', c.id, c.business_id, ev.business_id
from attendance_corrections c
left join attendance_events ev on ev.id = c.event_id
where c.event_id is not null and (ev.id is null or ev.business_id <> c.business_id);
