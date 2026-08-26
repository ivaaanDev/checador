import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DeviceRegister } from '@/components/device-register'
import { MonitorIcon } from '@/components/icons'

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
    <main className="dashboard-page">
      <header className="mb-10">
        <p className="eyebrow mb-4">Dispositivos</p>
        <h1 className="page-title">Tus kioscos.</h1>
        <p className="page-copy mt-5">Nombra una pantalla, guarda su token y úsala para registrar entradas y salidas.</p>
      </header>

      <DeviceRegister />

      <div className="mt-10 flex items-center justify-between border-b border-[#deded7] pb-3">
        <h2 className="text-sm font-semibold">Registrados</h2>
        <span className="font-mono text-xs text-[#696963]">{devices?.length ?? 0}</span>
      </div>
      <ul className="divide-y divide-[#deded7]">
        {(devices ?? []).map((device) => (
          <li key={device.id} className="group flex items-center gap-4 py-5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#deded7] bg-white transition group-hover:border-black">
              <MonitorIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className={device.is_active ? 'font-medium' : 'font-medium text-[#96968e]'}>{device.label}</p>
              <p className="mt-1 text-xs text-[#696963]">
                {device.last_seen_at
                  ? `Visto ${new Date(device.last_seen_at).toLocaleString('es-MX')}`
                  : 'Todavía no se conecta'}
              </p>
            </div>
            <span className={`flex items-center gap-2 text-xs ${device.is_active ? 'text-[#18794e]' : 'text-[#96968e]'}`}>
              <span className="status-dot" /> {device.is_active ? 'Activo' : 'Inactivo'}
            </span>
          </li>
        ))}
      </ul>
      {(!devices || devices.length === 0) && (
        <div className="empty-state mt-5">
          <div><MonitorIcon className="mx-auto mb-3 h-5 w-5" /><p className="text-sm">Tu primer kiosco aparecerá aquí.</p></div>
        </div>
      )}
    </main>
  )
}
