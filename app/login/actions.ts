'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`)
  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`)

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
