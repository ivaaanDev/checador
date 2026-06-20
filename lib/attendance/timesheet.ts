export type RawEvent = {
    employeeId: string
    name: string
    eventType: 'clock_in' | 'clock_out' | 'break_start' | 'break_end'
    capturedAt: string // ISO UTC
  }
  
  export type Session = {
    employeeId: string
    name: string
    inAt: string
    outAt: string | null
    ms: number | null // null = sesión abierta (entrada sin salida)
  }
  
  // Empareja clock_in -> clock_out por empleado en orden cronológico.
  // Entrada sin salida = sesión abierta; salida huérfana (sin entrada) se ignora.
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
          if (open) sessions.push({ employeeId: open.employeeId, name: open.name, inAt: open.capturedAt, outAt: null, ms: null })
          open = e
        } else if (e.eventType === 'clock_out' && open) {
          sessions.push({
            employeeId: open.employeeId, name: open.name,
            inAt: open.capturedAt, outAt: e.capturedAt,
            ms: new Date(e.capturedAt).getTime() - new Date(open.capturedAt).getTime(),
          })
          open = null
        }
      }
      if (open) sessions.push({ employeeId: open.employeeId, name: open.name, inAt: open.capturedAt, outAt: null, ms: null })
    }
    return sessions.sort((a, b) => b.inAt.localeCompare(a.inAt)) // recientes primero
  }
  
  export function formatDuration(ms: number | null): string {
    if (ms == null) return '—'
    const min = Math.round(ms / 60000)
    const h = Math.floor(min / 60)
    const m = min % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }