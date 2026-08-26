import Link from 'next/link'
import { signOut } from './actions'
import {
  AdjustIcon,
  ClockIcon,
  HomeIcon,
  LogOutIcon,
  MarkIcon,
  MonitorIcon,
  UsersIcon,
} from '@/components/icons'

const navigation = [
  { href: '/dashboard', label: 'Inicio', icon: HomeIcon },
  { href: '/dashboard/employees', label: 'Equipo', icon: UsersIcon },
  { href: '/dashboard/devices', label: 'Kioscos', icon: MonitorIcon },
  { href: '/dashboard/attendance', label: 'Asistencia', icon: ClockIcon },
  { href: '/dashboard/corrections', label: 'Ajustes', icon: AdjustIcon },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <Link href="/dashboard" className="brand" aria-label="Checador, inicio">
          <span className="brand-mark"><MarkIcon /></span>
          <span>checador.</span>
        </Link>

        <nav className="dashboard-nav" aria-label="Navegación principal">
          {navigation.map(({ href, label, icon: NavIcon }) => (
            <Link key={href} href={href} className="nav-link" aria-label={label}>
              <NavIcon />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <form className="sidebar-footer">
          <button formAction={signOut} className="nav-link nav-button" aria-label="Cerrar sesión">
            <LogOutIcon />
            <span>Salir</span>
          </button>
        </form>
      </aside>
      <div className="dashboard-content">{children}</div>
    </div>
  )
}
