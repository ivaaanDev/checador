import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from './actions'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()

  // getUser() hace verificación contra el server de Auth -> seguro para proteger.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: memberships } = await supabase
    .from('business_members')
    .select('role, businesses(id, name, timezone)')

  if (!memberships || memberships.length === 0) redirect('/onboarding')

  const m = memberships[0]
  // El embed puede inferirse como objeto o arreglo según TS; lo resolvemos seguro.
  const business = Array.isArray(m.businesses) ? m.businesses[0] : m.businesses

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{business?.name}</h1>
        <form>
          <button formAction={signOut} className="rounded border px-3 py-1 text-sm">
            Cerrar sesión
          </button>
          <Link href="/dashboard/employees" className="text-sm underline">Empleados</Link>
        </form>
      </div>
      <p className="mt-2 text-sm text-gray-600">
        Sesión: {user.email} · Rol: {m.role} · Zona horaria: {business?.timezone}
      </p>
    </main>
  )
}