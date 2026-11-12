import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  buildSessions, applyCloseCorrections, sortSessionsDesc, formatDuration,
  type RawEvent, type CloseCorrection, type Session,
} from '@/lib/attendance/timesheet'
import { AdjustIcon, ArrowUpRightIcon, ClockIcon } from '@/components/icons'

const DAYS = 14

export default async function AttendancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: memberships } = await supabase
    .from('business_members').select('business_id, businesses(timezone)').limit(1)
  if (!memberships || memberships.length === 0) redirect('/onboarding')
  const business = Array.isArray(memberships[0].businesses) ? memberships[0].businesses[0] : memberships[0].businesses
  const timezone = business?.timezone ?? 'America/Mexico_City'

  // This server query intentionally uses a rolling window from request time.
  // eslint-disable-next-line react-hooks/purity
  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString()
  const { data: rows } = await supabase
    .from('attendance_events')
    .select('id, employee_id, event_type, captured_at, employees(full_name)')
    .gte('captured_at', since)
    .order('captured_at', { ascending: true })

  const events: RawEvent[] = (rows ?? []).map((row) => {
    const employee = Array.isArray(row.employees) ? row.employees[0] : row.employees
    return {
      id: row.id as string,
      employeeId: row.employee_id as string,
      name: (employee?.full_name as string) ?? 'Desconocido',
      eventType: row.event_type as RawEvent['eventType'],
      capturedAt: row.captured_at as string,
    }
  })

  const { data: correctionRows } = await supabase
    .from('attendance_corrections')
    .select('id, event_id, corrected_time')
    .eq('status', 'approved')
    .not('event_id', 'is', null)

  const closeCorrections: CloseCorrection[] = (correctionRows ?? []).map((correction) => ({
    id: correction.id as string,
    clockInEventId: correction.event_id as string,
    correctedOutAt: correction.corrected_time as string,
  }))
  const sessions = sortSessionsDesc(applyCloseCorrections(buildSessions(events), closeCorrections))

  const dayKeyFormat = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
  const timeFormat = new Intl.DateTimeFormat('es-MX', { timeZone: timezone, hour: '2-digit', minute: '2-digit' })
  const dayLabelFormat = new Intl.DateTimeFormat('es-MX', { timeZone: timezone, weekday: 'long', day: 'numeric', month: 'long' })
  const byDay = new Map<string, Session[]>()
  for (const session of sessions) {
    const day = dayKeyFormat.format(new Date(session.inAt))
    const current = byDay.get(day)
    if (current) current.push(session)
    else byDay.set(day, [session])
  }
  const days = [...byDay.keys()].sort((a, b) => b.localeCompare(a))

  return (
    <main className="dashboard-page">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-4">Últimos {DAYS} días</p>
          <h1 className="page-title">Asistencia.</h1>
          <p className="page-copy mt-5">Entradas y salidas en horario de {timezone}.</p>
        </div>
        <Link href="/dashboard/corrections" className="btn-secondary w-fit">Ajustar pendientes <AdjustIcon /></Link>
      </header>

      {days.length === 0 && (
        <div className="empty-state mt-10">
          <div><ClockIcon className="mx-auto mb-3 h-5 w-5" /><p className="text-sm">Las primeras checadas aparecerán aquí.</p></div>
        </div>
      )}

      <div className="mt-12 flex flex-col gap-10">
        {days.map((day) => (
          <section key={day}>
            <div className="mb-3 flex items-center justify-between border-b border-[#deded7] pb-3">
              <h2 className="text-sm font-semibold capitalize">{dayLabelFormat.format(new Date(`${day}T12:00:00Z`))}</h2>
              <span className="font-mono text-xs text-[#696963]">{byDay.get(day)?.length}</span>
            </div>
            <ul className="divide-y divide-[#deded7]">
              {byDay.get(day)!.map((session, index) => (
                <li key={`${session.inEventId}-${index}`} className="grid items-center gap-2 py-4 text-sm sm:grid-cols-[1fr_auto_6rem] sm:gap-6">
                  <span className="font-medium">
                    {session.name}
                    {session.corrected && <span className="ml-2 rounded-full bg-[#e8e8e2] px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-[#696963]">ajustada</span>}
                  </span>
                  <span className="flex items-center gap-2 font-mono text-xs text-[#696963]">
                    {timeFormat.format(new Date(session.inAt))} <ArrowUpRightIcon className="h-3.5 w-3.5 rotate-45" />
                    {session.outAt ? timeFormat.format(new Date(session.outAt)) : <span className="text-[#b26a00]">abierta</span>}
                  </span>
                  <span className="font-mono text-xs tabular-nums sm:text-right">{formatDuration(session.ms)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  )
}
