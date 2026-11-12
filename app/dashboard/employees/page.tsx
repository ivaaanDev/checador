import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { addEmployee, setEmployeeActive } from './actions'
import { CameraIcon, ChevronRightIcon, PlusIcon, UsersIcon } from '@/components/icons'

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: memberships } = await supabase
    .from('business_members').select('business_id').limit(1)
  if (!memberships || memberships.length === 0) redirect('/onboarding')

  const { data: employees } = await supabase
    .from('employees')
    .select('id, full_name, employee_code, position, is_active')
    .order('full_name')

  const { data: templates } = await supabase
    .from('biometric_templates')
    .select('employee_id')
    .eq('modality', 'face')
    .eq('is_active', true)
  const enrolled = new Set((templates ?? []).map((template) => template.employee_id))

  return (
    <main className="dashboard-page">
      <header className="mb-10">
        <p className="eyebrow mb-4">Personas</p>
        <h1 className="page-title">Tu equipo.</h1>
        <p className="page-copy mt-5">Agrega a alguien y registra su rostro. Sin perfiles complicados.</p>
      </header>

      {error && <p className="error-note mb-4" role="alert">{error}</p>}

      <form className="panel p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-black text-white"><PlusIcon className="h-4 w-4" /></span>
          <div>
            <h2 className="text-sm font-semibold">Agregar persona</h2>
            <p className="text-xs text-[#696963]">El nombre es lo único obligatorio.</p>
          </div>
        </div>
        <div className="grid gap-2 lg:grid-cols-[1fr_10rem_11rem_auto]">
          <input name="full_name" placeholder="Nombre completo" aria-label="Nombre completo" required className="field" />
          <input name="employee_code" placeholder="Código" aria-label="Código de empleado" className="field" />
          <input name="position" placeholder="Puesto" aria-label="Puesto" className="field" />
          <button formAction={addEmployee} className="btn-primary">Agregar</button>
        </div>
      </form>

      <div className="mt-10 flex items-center justify-between border-b border-[#deded7] pb-3">
        <h2 className="text-sm font-semibold">Personas</h2>
        <span className="font-mono text-xs text-[#696963]">{employees?.length ?? 0}</span>
      </div>
      <ul className="divide-y divide-[#deded7]">
        {(employees ?? []).map((employee) => {
          const hasFace = enrolled.has(employee.id)
          const initials = employee.full_name.split(' ').slice(0, 2).map((part: string) => part[0]).join('').toUpperCase()
          return (
            <li key={employee.id} className="group flex flex-col gap-4 py-5 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e8e8e2] text-xs font-semibold">{initials}</span>
                <div className="min-w-0">
                  <p className={employee.is_active ? 'truncate font-medium' : 'truncate font-medium text-[#96968e] line-through'}>{employee.full_name}</p>
                  <p className="mt-1 truncate text-xs text-[#696963]">
                    {employee.position || 'Sin puesto'}{employee.employee_code ? ` · ${employee.employee_code}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pl-15 sm:pl-0">
                <span className={`mr-1 hidden items-center gap-2 text-xs md:flex ${hasFace ? 'text-[#18794e]' : 'text-[#696963]'}`}>
                  <span className="status-dot" /> {hasFace ? 'Rostro listo' : 'Falta rostro'}
                </span>
                <Link href={`/dashboard/employees/${employee.id}/enroll`} aria-label={`${hasFace ? 'Rehacer rostro de' : 'Enrolar rostro de'} ${employee.full_name}`} className="btn-secondary min-h-10 px-3 py-2">
                  <CameraIcon /> <span className="hidden sm:inline">{hasFace ? 'Rehacer' : 'Enrolar'}</span>
                </Link>
                <form>
                  <button
                    formAction={setEmployeeActive.bind(null, employee.id, !employee.is_active)}
                    className="btn-quiet min-h-10 px-3 py-2"
                  >
                    {employee.is_active ? 'Pausar' : 'Activar'} <ChevronRightIcon />
                  </button>
                </form>
              </div>
            </li>
          )
        })}
      </ul>
      {(!employees || employees.length === 0) && (
        <div className="empty-state mt-5">
          <div><UsersIcon className="mx-auto mb-3 h-5 w-5" /><p className="text-sm">Agrega a la primera persona del equipo.</p></div>
        </div>
      )}
    </main>
  )
}
