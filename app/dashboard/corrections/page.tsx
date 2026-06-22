// app/dashboard/corrections/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { buildSessions, type RawEvent } from '@/lib/attendance/timesheet'
import { closeOpenSession } from './actions'

const DAYS = 14

export default async function CorrectionsPage({
  searchParams,
}: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: memberships } = await supabase
    .from('business_members').select('business_id, businesses(timezone)').limit(1)
  if (!memberships || memberships.length === 0) redirect('/onboarding')
  const biz = Array.isArray(memberships[0].businesses) ? memberships[0].businesses[0] : memberships[0].businesses
  const tz = biz?.timezone ?? 'America/Mexico_City'

  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString()
  const { data: rows } = await supabase
    .from('attendance_events')
    .select('id, employee_id, event_type, captured_at, employees(full_name)')
    .gte('captured_at', since).order('captured_at', { ascending: true })

  const events: RawEvent[] = (rows ?? []).map((r) => {
    const emp = Array.isArray(r.employees) ? r.employees[0] : r.employees
    return {
      id: r.id as string, employeeId: r.employee_id as string,
      name: (emp?.full_name as string) ?? 'Desconocido',
      eventType: r.event_type as RawEvent['eventType'],
      capturedAt: r.captured_at as string,
    }
  })

  const { data: corrRows } = await supabase
    .from('attendance_corrections')
    .select('id, event_id, corrected_time, reason, status, created_at, employees(full_name)')
    .order('created_at', { ascending: false })

  // Entradas ya cerradas por corrección -> no volver a ofrecerlas.
  const closedInIds = new Set(
    (corrRows ?? []).filter((c) => c.status === 'approved' && c.event_id).map((c) => c.event_id as string),
  )
  const openSessions = buildSessions(events)
    .filter((s) => s.outAt === null && !closedInIds.has(s.inEventId))
    .sort((a, b) => b.inAt.localeCompare(a.inAt))

  const dtFmt = new Intl.DateTimeFormat('es-MX', { timeZone: tz, dateStyle: 'medium', timeStyle: 'short' })
  const recent = (corrRows ?? []).slice(0, 15).map((c) => {
    const emp = Array.isArray(c.employees) ? c.employees[0] : c.employees
    return { ...c, name: emp?.full_name ?? 'Desconocido' }
  })

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Correcciones</h1>
        <Link href="/dashboard/attendance" className="text-sm text-gray-600 underline">← Asistencia</Link>
      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <h2 className="mb-1 text-sm font-semibold">Sesiones abiertas ({openSessions.length})</h2>
      <p className="mb-3 text-xs text-gray-500">
        Entradas sin salida. Ciérralas con la hora real (en {tz}). Si la persona marca
        su salida por cámara después, esa salida real tendrá prioridad sobre la corrección.
      </p>

      <ul className="mb-8 flex flex-col gap-3">
        {openSessions.map((s) => (
          <li key={s.inEventId} className="rounded border p-4">
            <p className="text-sm font-medium">{s.name}</p>
            <p className="mb-2 text-xs text-gray-500">Entrada: {dtFmt.format(new Date(s.inAt))}</p>
            <form className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="employee_id" value={s.employeeId} />
              <input type="hidden" name="clock_in_event_id" value={s.inEventId} />
              <input type="datetime-local" name="out_local" required className="rounded border px-3 py-2 text-sm" />
              <input name="reason" placeholder="Motivo" required className="flex-1 rounded border px-3 py-2 text-sm" />
              <button formAction={closeOpenSession} className="rounded bg-black px-4 py-2 text-sm text-white">
                Cerrar sesión
              </button>
            </form>
          </li>
        ))}
        {openSessions.length === 0 && (
          <li className="rounded border px-4 py-6 text-center text-sm text-gray-500">
            No hay sesiones abiertas. Todo cuadrado.
          </li>
        )}
      </ul>

      {recent.length > 0 && (
        <>
          <h2 className="mb-2 text-sm font-semibold">Correcciones recientes</h2>
          <ul className="divide-y rounded border">
            {recent.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-gray-600">Salida → {dtFmt.format(new Date(c.corrected_time as string))}</p>
                  <p className="text-xs text-gray-500">{c.reason}</p>
                </div>
                <span className="text-xs text-gray-400">{dtFmt.format(new Date(c.created_at as string))}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  )
}