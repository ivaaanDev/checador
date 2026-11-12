import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { buildSessions, type RawEvent } from '@/lib/attendance/timesheet'
import { closeOpenSession } from './actions'
import { AdjustIcon, CheckIcon, ClockIcon } from '@/components/icons'

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
  const business = Array.isArray(memberships[0].businesses) ? memberships[0].businesses[0] : memberships[0].businesses
  const timezone = business?.timezone ?? 'America/Mexico_City'

  // This server query intentionally uses a rolling window from request time.
  // eslint-disable-next-line react-hooks/purity
  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString()
  const { data: rows } = await supabase
    .from('attendance_events')
    .select('id, employee_id, event_type, captured_at, employees(full_name)')
    .gte('captured_at', since).order('captured_at', { ascending: true })

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
    .select('id, event_id, corrected_time, reason, status, created_at, employees(full_name)')
    .order('created_at', { ascending: false })

  const closedInIds = new Set(
    (correctionRows ?? []).filter((correction) => correction.status === 'approved' && correction.event_id).map((correction) => correction.event_id as string),
  )
  const openSessions = buildSessions(events)
    .filter((session) => session.outAt === null && !closedInIds.has(session.inEventId))
    .sort((a, b) => b.inAt.localeCompare(a.inAt))

  const dateTimeFormat = new Intl.DateTimeFormat('es-MX', { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' })
  const recent = (correctionRows ?? []).slice(0, 15).map((correction) => {
    const employee = Array.isArray(correction.employees) ? correction.employees[0] : correction.employees
    return { ...correction, name: employee?.full_name ?? 'Desconocido' }
  })

  return (
    <main className="dashboard-page">
      <header className="mb-10">
        <p className="eyebrow mb-4">Pendientes</p>
        <h1 className="page-title">Todo cuadrado.</h1>
        <p className="page-copy mt-5">Cierra entradas sin salida usando la hora real. Nada más.</p>
      </header>

      {error && <p className="error-note mb-5" role="alert">{error}</p>}

      <div className="mb-4 flex items-center justify-between border-b border-[#deded7] pb-3">
        <h2 className="text-sm font-semibold">Sesiones abiertas</h2>
        <span className="font-mono text-xs text-[#696963]">{openSessions.length}</span>
      </div>
      <ul className="flex flex-col gap-3">
        {openSessions.map((session) => (
          <li key={session.inEventId} className="panel p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{session.name}</p>
                <p className="mt-1 flex items-center gap-2 text-xs text-[#696963]"><ClockIcon className="h-3.5 w-3.5" /> Entró {dateTimeFormat.format(new Date(session.inAt))}</p>
              </div>
              <span className="flex items-center gap-2 text-xs text-[#b26a00]"><span className="status-dot" /> Abierta</span>
            </div>
            <form className="grid gap-2 lg:grid-cols-[12rem_1fr_auto]">
              <input type="hidden" name="employee_id" value={session.employeeId} />
              <input type="hidden" name="clock_in_event_id" value={session.inEventId} />
              <input type="datetime-local" name="out_local" required aria-label="Hora de salida" className="field text-sm" />
              <input name="reason" placeholder="¿Qué pasó?" required aria-label="Motivo" className="field text-sm" />
              <button formAction={closeOpenSession} className="btn-primary">Cerrar <CheckIcon /></button>
            </form>
          </li>
        ))}
        {openSessions.length === 0 && (
          <li className="empty-state">
            <div><CheckIcon className="mx-auto mb-3 h-5 w-5" /><p className="text-sm">No hay pendientes. Todo bien.</p></div>
          </li>
        )}
      </ul>

      {recent.length > 0 && (
        <section className="mt-12">
          <div className="mb-2 flex items-center justify-between border-b border-[#deded7] pb-3">
            <h2 className="text-sm font-semibold">Ajustes recientes</h2>
            <AdjustIcon className="h-4 w-4 text-[#696963]" />
          </div>
          <ul className="divide-y divide-[#deded7]">
            {recent.map((correction) => (
              <li key={correction.id} className="flex flex-col justify-between gap-2 py-4 text-sm sm:flex-row sm:items-center">
                <div>
                  <p className="font-medium">{correction.name}</p>
                  <p className="mt-1 text-xs text-[#696963]">Salida · {dateTimeFormat.format(new Date(correction.corrected_time as string))} · {correction.reason}</p>
                </div>
                <span className="font-mono text-[10px] text-[#96968e]">{dateTimeFormat.format(new Date(correction.created_at as string))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
