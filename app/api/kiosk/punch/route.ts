// app/api/kiosk/punch/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptEmbedding } from '@/lib/biometrics/crypto'
import { cosineSimilarity } from '@/lib/biometrics/vector'

export const runtime = 'nodejs'

const MATCH_THRESHOLD = 0.6
const COOLDOWN_SECONDS = 10 // ignora otra checada del mismo empleado dentro de esta ventana
const MAX_FAILED_ATTEMPTS = 10 // intentos sin match por kiosco dentro de la ventana
const ATTEMPT_WINDOW_SECONDS = 60

export async function POST(req: NextRequest) {
  const { deviceToken, embedding } = await req.json().catch(() => ({}))
  if (!deviceToken || !Array.isArray(embedding) || embedding.length === 0) {
    return NextResponse.json({ ok: false, error: 'Petición inválida' }, { status: 400 })
  }

  const admin = createAdminClient()
  const secretHash = createHash('sha256').update(deviceToken).digest('hex')

  const { data: device } = await admin
    .from('devices').select('id, business_id, is_active').eq('secret_hash', secretHash).single()
  if (!device || !device.is_active) {
    return NextResponse.json({ ok: false, error: 'Dispositivo no autorizado' }, { status: 401 })
  }
  await admin.from('devices').update({ last_seen_at: new Date().toISOString() }).eq('id', device.id)

  // Límite de intentos fallidos por kiosco (frena el hill-climbing sobre el match).
  const cutoff = new Date(Date.now() - ATTEMPT_WINDOW_SECONDS * 1000).toISOString()
  const { count, error: countErr } = await admin
    .from('kiosk_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('device_id', device.id).gte('created_at', cutoff)
  if (countErr) {
    console.error('[punch] no se pudo contar intentos:', countErr.message)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
  if ((count ?? 0) >= MAX_FAILED_ATTEMPTS) {
    return NextResponse.json(
      { ok: false, error: 'Demasiados intentos, espera un momento' }, { status: 429 },
    )
  }

  // Respuesta única para "no hubo match": sin score ni datos del cálculo.
  // El detalle queda solo en el log del servidor (para calibrar MATCH_THRESHOLD).
  async function noMatch(bestScore: number | null, employeeId: string | null) {
    console.info('[punch]', {
      businessId: device!.business_id, deviceId: device!.id, bestScore, matched: false, employeeId,
    })
    await Promise.all([
      admin.from('kiosk_attempts').insert({ device_id: device!.id }),
      admin.from('kiosk_attempts').delete().eq('device_id', device!.id).lt('created_at', cutoff),
    ])
    return NextResponse.json({ ok: true, matched: false })
  }

  const { data: templates } = await admin
    .from('biometric_templates')
    .select('employee_id, embedding')
    .eq('business_id', device.business_id).eq('modality', 'face').eq('is_active', true)
  if (!templates || templates.length === 0) {
    return noMatch(null, null)
  }

  let best = { employeeId: '', score: -1 }
  const unreadable: string[] = []
  for (const t of templates) {
    // Una plantilla cifrada con otra llave (o corrupta) hace que decrypt lance.
    // Se salta para que no tumbe el match de todos los demás, pero se reporta.
    let ref: number[]
    try {
      ref = decryptEmbedding(t.embedding as string)
    } catch {
      unreadable.push(t.employee_id as string)
      continue
    }
    if (ref.length !== embedding.length) continue
    const score = cosineSimilarity(embedding, ref)
    if (score > best.score) best = { employeeId: t.employee_id, score }
  }
  if (unreadable.length > 0) {
    console.error(
      `[punch] ${unreadable.length} plantilla(s) ilegible(s) en el negocio ${device.business_id}. ` +
      `¿Cambió BIOMETRIC_ENC_KEY? Re-enrola a: ${unreadable.join(', ')}`,
    )
  }
  if (best.score < MATCH_THRESHOLD) {
    return noMatch(best.score, best.employeeId || null)
  }

  const { data: employee } = await admin
    .from('employees').select('id, full_name, is_active')
    .eq('id', best.employeeId).eq('business_id', device.business_id).single()
  if (!employee || !employee.is_active) {
    return noMatch(best.score, best.employeeId)
  }

  const { data: last } = await admin
    .from('attendance_events')
    .select('event_type, captured_at')
    .eq('employee_id', employee.id)
    .eq('business_id', device.business_id)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Anti-duplicado: si checó hace muy poco, no insertamos nada.
  console.info('[punch]', {
    businessId: device.business_id, deviceId: device.id, bestScore: best.score,
    matched: true, employeeId: employee.id,
  })

  if (last && Date.now() - new Date(last.captured_at).getTime() < COOLDOWN_SECONDS * 1000) {
    return NextResponse.json({
      ok: true, matched: true, duplicate: true, employeeName: employee.full_name,
    })
  }

  const nextType = last?.event_type === 'clock_in' ? 'clock_out' : 'clock_in'
  const at = new Date().toISOString()

  const { error } = await admin.from('attendance_events').insert({
    business_id: device.business_id, employee_id: employee.id, device_id: device.id,
    event_type: nextType, captured_at: at, source: 'kiosk_online', match_score: best.score,
  })
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true, matched: true, employeeName: employee.full_name, eventType: nextType, at,
  })
}