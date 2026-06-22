// app/api/kiosk/punch/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptEmbedding } from '@/lib/biometrics/crypto'
import { cosineSimilarity } from '@/lib/biometrics/vector'

export const runtime = 'nodejs'

const MATCH_THRESHOLD = 0.6
const COOLDOWN_SECONDS = 10 // ignora otra checada del mismo empleado dentro de esta ventana

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

  const { data: templates } = await admin
    .from('biometric_templates')
    .select('employee_id, embedding')
    .eq('business_id', device.business_id).eq('modality', 'face').eq('is_active', true)
  if (!templates || templates.length === 0) {
    return NextResponse.json({ ok: true, matched: false, message: 'No hay rostros enrolados' })
  }

  let best = { employeeId: '', score: -1 }
  for (const t of templates) {
    const ref = decryptEmbedding(t.embedding as string)
    if (ref.length !== embedding.length) continue
    const score = cosineSimilarity(embedding, ref)
    if (score > best.score) best = { employeeId: t.employee_id, score }
  }
  if (best.score < MATCH_THRESHOLD) {
    return NextResponse.json({ ok: true, matched: false, score: best.score })
  }

  const { data: employee } = await admin
    .from('employees').select('id, full_name, is_active').eq('id', best.employeeId).single()
  if (!employee || !employee.is_active) {
    return NextResponse.json({ ok: true, matched: false, score: best.score })
  }

  const { data: last } = await admin
    .from('attendance_events')
    .select('event_type, captured_at')
    .eq('employee_id', employee.id)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Anti-duplicado: si checó hace muy poco, no insertamos nada.
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
    ok: true, matched: true, employeeName: employee.full_name, eventType: nextType, at, score: best.score,
  })
}