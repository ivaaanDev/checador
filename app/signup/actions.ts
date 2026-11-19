'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const MIN_PASSWORD = 8

function fail(message: string): never {
  redirect(`/signup?error=${encodeURIComponent(message)}`)
}

export async function signup(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const confirmPassword = String(formData.get('confirmPassword') ?? '')

  if (password.length < MIN_PASSWORD) {
    fail(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`)
  }
  if (password !== confirmPassword) {
    fail('Las contraseñas no coinciden.')
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) fail(error.message)

  // Supabase NO marca error si el correo ya existe (para no revelar qué correos
  // están registrados): devuelve un usuario sin identidades y sin sesión.
  if (data.user && data.user.identities?.length === 0) {
    redirect(`/login?error=${encodeURIComponent('Ese correo ya tiene cuenta. Inicia sesión.')}`)
  }

  // Con "Confirm email" activo no hay sesión hasta confirmar el correo.
  // Mandar a /onboarding así falla con "No autenticado".
  if (!data.session) {
    redirect(`/login?message=${encodeURIComponent('Te enviamos un correo para confirmar tu cuenta. Confírmalo y luego inicia sesión.')}`)
  }

  revalidatePath('/', 'layout')
  redirect('/onboarding')
}
