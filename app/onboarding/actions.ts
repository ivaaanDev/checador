'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createBusiness(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('create_business_with_owner', {
    p_name: formData.get('name') as string,
    p_timezone: (formData.get('timezone') as string) || 'America/Mexico_City',
  })
  if (error) redirect(`/onboarding?error=${encodeURIComponent(error.message)}`)
  revalidatePath('/', 'layout')
  redirect('/dashboard')
}