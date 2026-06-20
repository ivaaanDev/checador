import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DeviceRegister } from '@/components/device-register'

export default async function DevicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: memberships } = await supabase
    .from('business_members').select('business_id').limit(1)
  if (!memberships || memberships.length === 0) redirect('/onboarding')

  const { data: devices } = await supabase
    .from('devices')
    .select('id, label, last_seen_at, is_active, created_at')
    .order('created_at', { ascending: false })

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Kioscos</h1>
        <Link href="/dashboard" className="text-sm text-gray-600 underline">← Panel</Link>
      </div>

      <DeviceRegister />

      <ul className="divide-y rounded border">
        {(devices ?? []).map((d) => (
          <li key={d.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className={d.is_active ? 'font-medium' : 'font-medium text-gray-400'}>{d.label}</p>
              <p className="text-xs text-gray-500">
                {d.last_seen_at
                  ? `Última actividad: ${new Date(d.last_seen_at).toLocaleString()}`
                  : 'Nunca conectado'}
              </p>
            </div>
          </li>
        ))}
        {(!devices || devices.length === 0) && (
          <li className="px-4 py-6 text-center text-sm text-gray-500">
            Aún no hay kioscos. Registra el primero arriba.
          </li>
        )}
      </ul>
    </main>
  )
}