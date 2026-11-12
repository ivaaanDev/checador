import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  AdjustIcon,
  ArrowUpRightIcon,
  ClockIcon,
  MonitorIcon,
  UsersIcon,
} from '@/components/icons'

const shortcuts = [
  {
    href: '/dashboard/employees',
    label: 'Equipo',
    description: 'Personas, puestos y rostros.',
    icon: UsersIcon,
    number: '01',
  },
  {
    href: '/dashboard/attendance',
    label: 'Asistencia',
    description: 'Entradas, salidas y horas.',
    icon: ClockIcon,
    number: '02',
  },
  {
    href: '/dashboard/devices',
    label: 'Kioscos',
    description: 'Pantallas listas para checar.',
    icon: MonitorIcon,
    number: '03',
  },
  {
    href: '/dashboard/corrections',
    label: 'Ajustes',
    description: 'Cerrar sesiones pendientes.',
    icon: AdjustIcon,
    number: '04',
  },
]

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: memberships } = await supabase
    .from('business_members')
    .select('role, businesses(id, name, timezone)')

  if (!memberships || memberships.length === 0) redirect('/onboarding')

  const membership = memberships[0]
  const business = Array.isArray(membership.businesses) ? membership.businesses[0] : membership.businesses

  return (
    <main className="dashboard-page">
      <header className="flex flex-col gap-6 border-b border-[#deded7] pb-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-4">Panel de hoy</p>
          <h1 className="page-title">Hola, {business?.name}.</h1>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-sm font-medium">Todo en un lugar.</p>
          <p className="mt-1 text-xs text-[#696963]">{business?.timezone}</p>
        </div>
      </header>

      <section className="mt-10 grid gap-3 sm:grid-cols-2">
        {shortcuts.map(({ href, label, description, icon: ShortcutIcon, number }) => (
          <Link
            key={href}
            href={href}
            className="group panel relative min-h-48 overflow-hidden p-6 text-black no-underline transition duration-300 hover:-translate-y-1 hover:border-black hover:shadow-[0_12px_30px_rgba(17,17,15,.08)]"
          >
            <div className="flex items-start justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-black text-white transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-105">
                <ShortcutIcon className="h-4 w-4" />
              </span>
              <span className="font-mono text-xs text-[#96968e]">{number}</span>
            </div>
            <div className="absolute inset-x-6 bottom-6 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold tracking-[-0.04em]">{label}</h2>
                <p className="mt-1 text-sm text-[#696963]">{description}</p>
              </div>
              <ArrowUpRightIcon className="h-5 w-5 shrink-0 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
            </div>
          </Link>
        ))}
      </section>

      <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[#deded7] pt-5 text-xs text-[#696963]">
        <span>{user.email}</span>
        <span className="font-mono uppercase tracking-wider">{membership.role}</span>
      </footer>
    </main>
  )
}
