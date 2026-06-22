import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  buildSessions, applyCloseCorrections, sortSessionsDesc, formatDuration,
  type RawEvent, type CloseCorrection, type Session,
} from '@/lib/attendance/timesheet'

const DAYS = 14

export default async function AttendancePage() {
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
    .gte('captured_at', since)
    .order('captured_at', { ascending: true })

  const events: RawEvent[] = (rows ?? []).map((r) => {
    const emp = Array.isArray(r.employees) ? r.employees[0] : r.employees
    return {
      id: r.id as string,
      employeeId: r.employee_id as string,
      name: (emp?.full_name as string) ?? 'Desconocido',
      eventType: r.event_type as RawEvent['eventType'],
      capturedAt: r.captured_at as string,
    }
  })

  const { data: corrRows } = await supabase
  .from('attendance_corrections')
  .select('id, event_id, corrected_time')
  .eq('status', 'approved')
  .not('event_id', 'is', null)

const closeCorrections: CloseCorrection[] = (corrRows ?? []).map((c) => ({
  id: c.id as string,
  clockInEventId: c.event_id as string,
  correctedOutAt: c.corrected_time as string,
}))

const sessions = sortSessionsDesc(applyCloseCorrections(buildSessions(events), closeCorrections))

  const dayKeyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
  const timeFmt = new Intl.DateTimeFormat('es-MX', { timeZone: tz, hour: '2-digit', minute: '2-digit' })
  const dayLabelFmt = new Intl.DateTimeFormat('es-MX', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' })

  const byDay = new Map<string, Session[]>()
  for (const s of sessions) {
    const day = dayKeyFmt.format(new Date(s.inAt))
    const arr = byDay.get(day)
    if (arr) arr.push(s)
    else byDay.set(day, [s])
  }
  const days = [...byDay.keys()].sort((a, b) => b.localeCompare(a))

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Asistencia</h1>
        <div className="flex gap-3 text-sm">
          <Link href="/dashboard/corrections" className="text-gray-600 underline">Correcciones</Link>
          <Link href="/dashboard" className="text-gray-600 underline">← Panel</Link>
        </div>
      </div>
      <p className="mb-4 text-sm text-gray-500">Últimos {DAYS} días · horario de {tz}</p>

      {days.length === 0 && (
        <p className="rounded border px-4 py-6 text-center text-sm text-gray-500">
          Aún no hay checadas registradas.
        </p>
      )}

      <div className="flex flex-col gap-6">
        {days.map((day) => (
          <section key={day}>
            <h2 className="mb-2 text-sm font-semibold capitalize text-gray-700">
              {dayLabelFmt.format(new Date(day + 'T12:00:00Z'))}
            </h2>
            <ul className="divide-y rounded border">
              {byDay.get(day)!.map((s, i) => (
                <li key={i} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="font-medium">
                    {s.name}
                    {s.corrected && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">corregida</span>
                    )}
                  </span>
                  <span className="text-gray-600">
                    {timeFmt.format(new Date(s.inAt))}{' → '}
                    {s.outAt ? timeFmt.format(new Date(s.outAt)) : <span className="text-amber-600">abierta</span>}
                  </span>
                  <span className="w-20 text-right tabular-nums">{formatDuration(s.ms)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  )
}