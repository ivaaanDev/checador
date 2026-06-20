import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { addEmployee, setEmployeeActive } from './actions'

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

  // Quién tiene una plantilla facial activa.
  const { data: templates } = await supabase
    .from('biometric_templates')
    .select('employee_id')
    .eq('modality', 'face')
    .eq('is_active', true)
  const enrolled = new Set((templates ?? []).map((t) => t.employee_id))

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Empleados</h1>
        <Link href="/dashboard" className="text-sm text-gray-600 underline">← Panel</Link>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <form className="mb-6 flex flex-wrap gap-2">
        <input name="full_name" placeholder="Nombre completo" required
          className="flex-1 rounded border px-3 py-2" />
        <input name="employee_code" placeholder="Código (opcional)"
          className="w-36 rounded border px-3 py-2" />
        <input name="position" placeholder="Puesto (opcional)"
          className="w-40 rounded border px-3 py-2" />
        <button formAction={addEmployee} className="rounded bg-black px-4 py-2 text-white">
          Agregar
        </button>
      </form>

      <ul className="divide-y rounded border">
        {(employees ?? []).map((e) => {
          const hasFace = enrolled.has(e.id)
          return (
            <li key={e.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className={e.is_active ? 'font-medium' : 'font-medium text-gray-400 line-through'}>
                  {e.full_name}
                </p>
                <p className="text-xs text-gray-500">
                  {e.position || 'Sin puesto'}
                  {e.employee_code ? ` · ${e.employee_code}` : ''}
                  {' · '}
                  <span className={hasFace ? 'text-green-600' : 'text-amber-600'}>
                    {hasFace ? 'Rostro enrolado' : 'Sin enrolar'}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/dashboard/employees/${e.id}/enroll`}
                  className="rounded border px-3 py-1 text-sm">
                  {hasFace ? 'Re-enrolar' : 'Enrolar'}
                </Link>
                <form>
                  <button formAction={setEmployeeActive.bind(null, e.id, !e.is_active)}
                    className="rounded border px-3 py-1 text-sm">
                    {e.is_active ? 'Desactivar' : 'Reactivar'}
                  </button>
                </form>
              </div>
            </li>
          )
        })}
        {(!employees || employees.length === 0) && (
          <li className="px-4 py-6 text-center text-sm text-gray-500">
            Aún no hay empleados. Agrega el primero arriba.
          </li>
        )}
      </ul>
    </main>
  )
}