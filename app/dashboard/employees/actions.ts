// app/dashboard/employees/actions.ts
'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { encryptEmbedding } from '@/lib/biometrics/crypto'

export async function addEmployee(formData: FormData) {
  const supabase = await createClient()

  // Resuelve el negocio del usuario actual (asumimos 1 negocio por ahora).
  const { data: memberships } = await supabase
    .from('business_members')
    .select('business_id')
    .limit(1)
  const businessId = memberships?.[0]?.business_id
  if (!businessId) redirect('/onboarding')

  const { error } = await supabase.from('employees').insert({
    business_id: businessId,
    full_name: formData.get('full_name') as string,
    employee_code: (formData.get('employee_code') as string)?.trim() || null,
    position: (formData.get('position') as string)?.trim() || null,
  })
  if (error) {
    redirect(`/dashboard/employees?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/dashboard/employees')
}

// Borrado suave: nunca eliminamos al empleado (preserva el ledger de asistencia).
// El RLS garantiza que solo puedas tocar empleados de tu propio negocio.
export async function setEmployeeActive(id: string, isActive: boolean) {
  const supabase = await createClient()
  await supabase.from('employees').update({ is_active: isActive }).eq('id', id)
  revalidatePath('/dashboard/employees')
}

export async function saveFaceEnrollment(
  employeeId: string,
  embedding: number[],
  qualityScore: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  // RLS ya restringe a empleados de tu negocio; confirmamos y tomamos el business_id.
  const { data: employee } = await supabase
    .from('employees')
    .select('id, business_id')
    .eq('id', employeeId)
    .single()
  if (!employee) return { ok: false, error: 'Empleado no encontrado' }

  const ciphertext = encryptEmbedding(embedding)

  // Re-enrolar reemplaza: desactiva las plantillas faciales previas.
  await supabase
    .from('biometric_templates')
    .update({ is_active: false })
    .eq('employee_id', employeeId)
    .eq('modality', 'face')

  const { error } = await supabase.from('biometric_templates').insert({
    business_id: employee.business_id,
    employee_id: employeeId,
    modality: 'face',
    embedding: ciphertext,
    model_version: 'human-faceres',
    quality_score: qualityScore,
    enrolled_by: user.id,
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/dashboard/employees')
  return { ok: true }
}