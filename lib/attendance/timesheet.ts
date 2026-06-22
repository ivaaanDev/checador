// lib/attendance/timesheet.ts
export type EventType = 'clock_in' | 'clock_out' | 'break_start' | 'break_end'

export type RawEvent = {
  id: string
  employeeId: string
  name: string
  eventType: EventType
  capturedAt: string // ISO UTC
}

// Corrección de cierre: aporta la salida para una ENTRADA concreta.
export type CloseCorrection = {
  id: string
  clockInEventId: string
  correctedOutAt: string // ISO UTC
}

export type Session = {
  employeeId: string
  name: string
  inEventId: string
  inAt: string
  outAt: string | null
  ms: number | null // null = abierta
  corrected: boolean
}

// Empareja entrada->salida, ROBUSTO a duplicados consecutivos:
//   - clock_in con sesión ya abierta -> se ignora (duplicado)
//   - clock_out sin sesión abierta   -> se ignora (huérfano/duplicado)
export function buildSessions(events: RawEvent[]): Session[] {
  const byEmp = new Map<string, RawEvent[]>()
  for (const e of events) {
    const arr = byEmp.get(e.employeeId)
    if (arr) arr.push(e)
    else byEmp.set(e.employeeId, [e])
  }

  const sessions: Session[] = []
  for (const list of byEmp.values()) {
    list.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
    let open: RawEvent | null = null
    for (const e of list) {
      if (e.eventType === 'clock_in') {
        if (!open) open = e // si ya hay abierta, ignora el duplicado
      } else if (e.eventType === 'clock_out') {
        if (open) {
          sessions.push({
            employeeId: open.employeeId, name: open.name, inEventId: open.id,
            inAt: open.capturedAt, outAt: e.capturedAt,
            ms: new Date(e.capturedAt).getTime() - new Date(open.capturedAt).getTime(),
            corrected: false,
          })
          open = null
        } // clock_out sin entrada -> ignorado
      }
    }
    if (open) {
      sessions.push({
        employeeId: open.employeeId, name: open.name, inEventId: open.id,
        inAt: open.capturedAt, outAt: null, ms: null, corrected: false,
      })
    }
  }
  return sessions
}

// Cierra sesiones AÚN abiertas con su corrección aprobada.
// Si la sesión ya se cerró por una salida real, la corrección se ignora: gana el ledger.
export function applyCloseCorrections(sessions: Session[], corrections: CloseCorrection[]): Session[] {
  const byIn = new Map<string, CloseCorrection>()
  for (const c of corrections) byIn.set(c.clockInEventId, c)
  return sessions.map((s) => {
    if (s.outAt !== null) return s // ya cerrada por el ledger real -> intacta
    const c = byIn.get(s.inEventId)
    if (!c) return s
    return {
      ...s, outAt: c.correctedOutAt,
      ms: new Date(c.correctedOutAt).getTime() - new Date(s.inAt).getTime(),
      corrected: true,
    }
  })
}

export function sortSessionsDesc(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => b.inAt.localeCompare(a.inAt))
}

export function formatDuration(ms: number | null): string {
  if (ms == null) return '—'
  const min = Math.round(ms / 60000)
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}