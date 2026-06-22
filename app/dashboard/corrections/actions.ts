// app/dashboard/corrections/actions.ts
'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Convierte hora de pared "YYYY-MM-DDTHH:mm" en `timeZone` a UTC,
// correcto aunque el navegador del gerente esté en otra zona que el negocio.
function wallTimeToUtc(local: string, timeZone: string): Date {
  const asUtc = new Date(local + ':00Z')
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const p = Object.fromEntries(dtf.formatToParts(asUtc).map((x) => [x.type, x.value]))
  const shown = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return new Date(asUtc.getTime() - (shown - asUtc.getTime()))
}

// Cierra una sesión abierta aportando la salida para una entrada concreta.
// Se guarda como APROBADA (el dueño cierra y queda registrado). Si luego llega
// una salida real por cámara, el reporte la prioriza y esta corrección queda inerte.
export async function closeOpenSession(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: memberships } = await supabase
    .from('business_members').select('business_id, businesses(timezone)').limit(1)
  const m = memberships?.[0]
  if (!m) redirect('/onboarding')
  const biz = Array.isArray(m.businesses) ? m.businesses[0] : m.businesses
  const tz = biz?.timezone ?? 'America/Mexico_City'

  const err = (msg: string) => redirect(`/dashboard/corrections?error=${encodeURIComponent(msg)}`)
  const employeeId = formData.get('employee_id') as string
  const clockInEventId = formData.get('clock_in_event_id') as string
  const local = formData.get('out_local') as string
  const reason = (formData.get('reason') as string)?.trim()
  if (!employeeId || !clockInEventId || !local || !reason) err('Faltan campos (hora y motivo)')

  const outUtc = wallTimeToUtc(local, tz)
  const { data: inEvent } = await supabase
    .from('attendance_events').select('captured_at').eq('id', clockInEventId).single()
  if (inEvent && outUtc.getTime() <= new Date(inEvent.captured_at).getTime()) {
    err('La salida debe ser posterior a la entrada')
  }

  const { error } = await supabase.from('attendance_corrections').insert({
    business_id: m.business_id,
    employee_id: employeeId,
    event_id: clockInEventId, // la ENTRADA que cierra
    event_type: 'clock_out',
    corrected_time: outUtc.toISOString(),
    reason,
    status: 'approved',
    requested_by: user.id,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
  })
  if (error) err(error.message)

  revalidatePath('/dashboard/corrections')
  revalidatePath('/dashboard/attendance')
}