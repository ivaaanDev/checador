'use server'
import { createHash, randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function registerDevice(
  label: string,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const { data: memberships } = await supabase
    .from('business_members').select('business_id').limit(1)
  const businessId = memberships?.[0]?.business_id
  if (!businessId) return { ok: false, error: 'Sin negocio' }
  if (!label?.trim()) return { ok: false, error: 'La etiqueta es obligatoria' }

  // Token del dispositivo: se muestra UNA vez; en BD solo va su hash SHA-256.
  const token = randomBytes(24).toString('base64url')
  const secretHash = createHash('sha256').update(token).digest('hex')

  const { error } = await supabase.from('devices').insert({
    business_id: businessId,
    label: label.trim(),
    secret_hash: secretHash,
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/dashboard/devices')
  return { ok: true, token }
}